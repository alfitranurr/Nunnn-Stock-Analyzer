/**
 * Jurnal target & performa bulanan portofolio.
 *
 * - Penyimpanan: Supabase `portfolio_monthly` (migrasi 000012) untuk akun cloud, localStorage untuk mode lokal.
 * - Pencatatan: nilai portofolio (nilai pasar saham + kas RDN) dicatat otomatis saat halaman Portofolio
 *   terbuka dan semua harga termuat. Bulan pertama memakai nilai saat pertama dicatat sebagai modal awal;
 *   bulan berikutnya memakai total akhir bulan sebelumnya.
 * - Perhitungan (fungsi murni): untung = total akhir − modal awal − setoran bersih; untung % terhadap
 *   modal awal (+ setoran positif); return kumulatif = perkalian return bulanan (time-weighted, tidak
 *   terdistorsi setoran); jalur target = (target bulan lalu + setoran) × (1 + target %).
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppUser } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';

export interface MonthlyRecord {
  /** "YYYY-MM" (bulan kalender WIB). */
  month: string;
  startValue: number;
  endValue: number;
  /** Positif = setoran, negatif = penarikan. */
  netFlow: number;
  firstRecordedAt: string;
  updatedAt: string;
}

export type JournalSource = 'cloud' | 'local';

export const DEFAULT_TARGET_RATES = [20, 30, 40, 50];

const localKey = (userId: string) => `nunnn_stock_portfolio_monthly_${userId}`;
const usesCloud = (user: AppUser) => isSupabaseConfigured && !user.isMock;

/** Bulan berjalan (WIB) sebagai "YYYY-MM". */
export const currentMonthKey = (now: number = Date.now()) => new Date(now + 7 * 3600_000).toISOString().slice(0, 7);

/** Tambah `n` bulan ke "YYYY-MM". */
export function addMonths(month: string, n: number): string {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(Date.UTC(y, m - 1 + n, 1));
  return d.toISOString().slice(0, 7);
}

export function monthsBetween(from: string, to: string): number {
  const [y1, m1] = from.split('-').map(Number);
  const [y2, m2] = to.split('-').map(Number);
  return (y2 - y1) * 12 + (m2 - m1);
}

function readLocal(userId: string): MonthlyRecord[] {
  try {
    const raw = localStorage.getItem(localKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed)
      ? parsed.filter((r): r is MonthlyRecord => !!r && typeof r === 'object' && /^\d{4}-\d{2}$/.test((r as MonthlyRecord).month))
      : [];
  } catch {
    return [];
  }
}

function writeLocal(userId: string, records: MonthlyRecord[]) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(records));
  } catch {
    // Penyimpanan diblokir: jurnal hanya bertahan di sesi ini.
  }
}

const sortRecords = (r: MonthlyRecord[]) => [...r].sort((a, b) => a.month.localeCompare(b.month));

export async function loadJournal(user: AppUser): Promise<{ records: MonthlyRecord[]; source: JournalSource; warning: string | null }> {
  if (!usesCloud(user)) return { records: sortRecords(readLocal(user.id)), source: 'local', warning: null };
  const { data, error } = await supabase
    .from('portfolio_monthly')
    .select('month, start_value, end_value, net_flow, first_recorded_at, updated_at')
    .order('month');
  if (error) {
    return { records: sortRecords(readLocal(user.id)), source: 'local', warning: getErrorMessage(error) };
  }
  return {
    records: (data ?? []).map((r) => ({
      month: String(r.month).slice(0, 7),
      startValue: Number(r.start_value) || 0,
      endValue: Number(r.end_value) || 0,
      netFlow: Number(r.net_flow) || 0,
      firstRecordedAt: String(r.first_recorded_at),
      updatedAt: String(r.updated_at),
    })),
    source: 'cloud',
    warning: null,
  };
}

export async function saveRecord(user: AppUser, source: JournalSource, record: MonthlyRecord): Promise<void> {
  if (source === 'cloud') {
    const { error } = await supabase.from('portfolio_monthly').upsert(
      {
        user_id: user.id,
        month: `${record.month}-01`,
        start_value: Math.max(0, record.startValue),
        end_value: Math.max(0, record.endValue),
        net_flow: record.netFlow,
        first_recorded_at: record.firstRecordedAt,
        updated_at: record.updatedAt,
      },
      { onConflict: 'user_id,month' }
    );
    if (error) throw new Error(getErrorMessage(error));
    return;
  }
  const others = readLocal(user.id).filter((r) => r.month !== record.month);
  writeLocal(user.id, sortRecords([...others, record]));
}

export async function resetJournal(user: AppUser, source: JournalSource): Promise<void> {
  if (source === 'cloud') {
    const { error } = await supabase.from('portfolio_monthly').delete().eq('user_id', user.id);
    if (error) throw new Error(getErrorMessage(error));
    return;
  }
  writeLocal(user.id, []);
}

/**
 * Catat nilai portofolio untuk bulan berjalan. Bulan baru memakai total akhir catatan terakhir
 * sebagai modal awal (atau nilai sekarang bila jurnal baru dimulai). Mengembalikan catatan baru/terbarui.
 */
export function snapshotRecord(records: MonthlyRecord[], month: string, value: number, nowIso: string): MonthlyRecord {
  const existing = records.find((r) => r.month === month);
  if (existing) return { ...existing, endValue: value, updatedAt: nowIso };
  const previous = sortRecords(records).filter((r) => r.month < month).pop();
  return { month, startValue: previous ? previous.endValue : value, endValue: value, netFlow: 0, firstRecordedAt: nowIso, updatedAt: nowIso };
}

export type JournalStatus =
  | { kind: 'hit'; rate: number }
  | { kind: 'below' }
  | { kind: 'loss' }
  | { kind: 'none' };

export interface JournalRow {
  month: string;
  record: MonthlyRecord | null;
  isCurrent: boolean;
  isFuture: boolean;
  gain: number | null;
  returnPct: number | null;
  cumulativePct: number | null;
  /** Nilai jalur target per tingkat (urutan sama dengan `rates`). */
  targets: number[];
  status: JournalStatus;
}

export interface JournalTable {
  rows: JournalRow[];
  startMonth: string | null;
  startValue: number;
  currentValue: number | null;
  totalGain: number;
  totalFlow: number;
  cumulativePct: number | null;
}

/** Bangun tabel jurnal dari catatan bulanan, target % per bulan, dan bulan berjalan (minimal 12 bulan). */
export function buildJournal(records: MonthlyRecord[], rates: number[], currentMonth: string, minMonths = 12): JournalTable {
  const sorted = sortRecords(records);
  if (sorted.length === 0) {
    return { rows: [], startMonth: null, startValue: 0, currentValue: null, totalGain: 0, totalFlow: 0, cumulativePct: null };
  }
  const startMonth = sorted[0].month;
  const lastMonth = sorted[sorted.length - 1].month > currentMonth ? sorted[sorted.length - 1].month : currentMonth;
  const count = Math.max(minMonths, monthsBetween(startMonth, lastMonth) + 1);
  const byMonth = new Map(sorted.map((r) => [r.month, r]));

  const targetPaths = rates.map(() => sorted[0].startValue);
  let factor = 1;
  let hasReturn = false;
  let totalGain = 0;
  let totalFlow = 0;
  const rows: JournalRow[] = [];

  for (let i = 0; i < count; i++) {
    const month = addMonths(startMonth, i);
    const record = byMonth.get(month) ?? null;
    const flow = record?.netFlow ?? 0;
    rates.forEach((rate, k) => {
      targetPaths[k] = (targetPaths[k] + flow) * (1 + rate / 100);
    });

    let gain: number | null = null;
    let returnPct: number | null = null;
    let status: JournalStatus = { kind: 'none' };
    if (record) {
      gain = record.endValue - record.startValue - record.netFlow;
      const base = record.startValue + Math.max(0, record.netFlow);
      returnPct = base > 0 ? (gain / base) * 100 : null;
      totalGain += gain;
      totalFlow += record.netFlow;
      if (returnPct !== null) {
        factor *= 1 + returnPct / 100;
        hasReturn = true;
        const hit = [...rates].sort((a, b) => b - a).find((r) => returnPct! >= r);
        status = hit !== undefined ? { kind: 'hit', rate: hit } : returnPct >= 0 ? { kind: 'below' } : { kind: 'loss' };
      }
    }
    rows.push({
      month,
      record,
      isCurrent: month === currentMonth,
      isFuture: month > currentMonth,
      gain,
      returnPct,
      cumulativePct: record && hasReturn ? (factor - 1) * 100 : null,
      targets: [...targetPaths],
      status,
    });
  }

  const current = byMonth.get(currentMonth) ?? sorted[sorted.length - 1];
  return {
    rows,
    startMonth,
    startValue: sorted[0].startValue,
    currentValue: current ? current.endValue : null,
    totalGain,
    totalFlow,
    cumulativePct: hasReturn ? (factor - 1) * 100 : null,
  };
}
