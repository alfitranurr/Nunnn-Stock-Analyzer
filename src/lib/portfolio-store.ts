/**
 * Penyimpanan portofolio: Supabase (`portfolio_holdings`, `portfolio_cash`) untuk akun cloud,
 * atau localStorage untuk mode Demo/Lokal. Dipakai halaman Portofolio dan ringkasan di Beranda
 * agar keduanya selalu membaca data yang sama.
 *
 * Tidak ada data contoh atau kas fiktif: portofolio kosong tetap kosong, kas RDN null sampai
 * pengguna mengisinya sendiri.
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppUser } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';

export interface Holding {
  id: string;
  ticker: string;
  company_name?: string;
  lot: number;
  avg_price: number;
}

export type PortfolioSource = 'cloud' | 'local';

export interface PortfolioData {
  holdings: Holding[];
  /** Kas RDN yang diisi pengguna; null = belum diatur. */
  cash: number | null;
  source: PortfolioSource;
  /** Diisi bila data cloud gagal dimuat dan yang ditampilkan adalah data lokal. */
  warning: string | null;
}

const holdingsKey = (userId: string) => `nunnn_stock_portfolio_holdings_${userId}`;
const cashKey = (userId: string) => `nunnn_stock_portfolio_cash_${userId}`;

export const usesCloud = (user: AppUser | null): boolean => isSupabaseConfigured && !!user && !user.isMock;

function readLocal(userId: string): { holdings: Holding[]; cash: number | null } {
  try {
    const raw = localStorage.getItem(holdingsKey(userId));
    const parsed: unknown = raw ? JSON.parse(raw) : [];
    const holdings = Array.isArray(parsed)
      ? parsed
          .filter((h): h is Holding => !!h && typeof h === 'object' && typeof (h as Holding).ticker === 'string')
          .map((h) => ({ ...h, lot: Number(h.lot) || 0, avg_price: Number(h.avg_price) || 0 }))
      : [];
    const cashRaw = localStorage.getItem(cashKey(userId));
    const cash = cashRaw !== null && Number.isFinite(parseFloat(cashRaw)) ? parseFloat(cashRaw) : null;
    return { holdings, cash };
  } catch {
    return { holdings: [], cash: null };
  }
}

function writeLocalHoldings(userId: string, holdings: Holding[]) {
  localStorage.setItem(holdingsKey(userId), JSON.stringify(holdings));
}

const byTicker = (a: Holding, b: Holding) => a.ticker.localeCompare(b.ticker);

export async function loadPortfolio(user: AppUser): Promise<PortfolioData> {
  if (!usesCloud(user)) {
    const local = readLocal(user.id);
    return { holdings: local.holdings.sort(byTicker), cash: local.cash, source: 'local', warning: null };
  }

  const { data, error } = await supabase.from('portfolio_holdings').select('id, ticker, company_name, lot, avg_price').order('ticker');
  if (error) {
    const local = readLocal(user.id);
    return { holdings: local.holdings.sort(byTicker), cash: local.cash, source: 'local', warning: getErrorMessage(error) };
  }

  let cash: number | null = null;
  const cashRes = await supabase.from('portfolio_cash').select('cash_balance').eq('user_id', user.id).maybeSingle();
  if (!cashRes.error && cashRes.data) cash = Number(cashRes.data.cash_balance);

  return {
    holdings: (data ?? []).map((h) => ({
      id: String(h.id),
      ticker: String(h.ticker).toUpperCase(),
      company_name: h.company_name ?? undefined,
      lot: Number(h.lot) || 0,
      avg_price: Number(h.avg_price) || 0,
    })),
    cash,
    source: 'cloud',
    warning: null,
  };
}

/** Tambah posisi baru, atau perbarui posisi yang sudah ada bila `holding.id` diisi. */
export async function saveHolding(user: AppUser, source: PortfolioSource, holding: Omit<Holding, 'id'> & { id?: string }): Promise<void> {
  const payload = {
    ticker: holding.ticker.toUpperCase(),
    company_name: holding.company_name?.slice(0, 100) || null,
    lot: Math.max(0, Math.floor(holding.lot)),
    avg_price: Math.max(0, holding.avg_price),
  };

  if (source === 'cloud') {
    const { error } = holding.id
      ? await supabase.from('portfolio_holdings').update({ ...payload, updated_at: new Date().toISOString() }).eq('id', holding.id)
      : await supabase.from('portfolio_holdings').insert({ ...payload, user_id: user.id });
    if (error) throw new Error(getErrorMessage(error));
    return;
  }

  const { holdings } = readLocal(user.id);
  const next = holding.id
    ? holdings.map((h) => (h.id === holding.id ? { ...h, ...payload, company_name: payload.company_name ?? undefined } : h))
    : [...holdings, { id: crypto.randomUUID(), ...payload, company_name: payload.company_name ?? undefined }];
  writeLocalHoldings(user.id, next);
}

export async function deleteHolding(user: AppUser, source: PortfolioSource, id: string): Promise<void> {
  if (source === 'cloud') {
    const { error } = await supabase.from('portfolio_holdings').delete().eq('id', id);
    if (error) throw new Error(getErrorMessage(error));
    return;
  }
  writeLocalHoldings(user.id, readLocal(user.id).holdings.filter((h) => h.id !== id));
}

/** Simpan kas RDN (≥ 0). */
export async function saveCash(user: AppUser, source: PortfolioSource, cash: number): Promise<void> {
  const value = Math.max(0, cash);
  if (source === 'cloud') {
    const { error } = await supabase
      .from('portfolio_cash')
      .upsert({ user_id: user.id, cash_balance: value, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
    if (error) throw new Error(getErrorMessage(error));
    return;
  }
  localStorage.setItem(cashKey(user.id), String(value));
}

/** Rata-rata harga baru bila membeli lagi saham yang sudah dimiliki. */
export function mergeAveragePrice(existingLot: number, existingAvg: number, addLot: number, addPrice: number): number {
  const total = existingLot + addLot;
  return total > 0 ? (existingLot * existingAvg + addLot * addPrice) / total : 0;
}
