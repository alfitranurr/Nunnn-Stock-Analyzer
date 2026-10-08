/**
 * Cakupan emiten BEI di aplikasi ini vs jumlah resmi BEI (server).
 *
 * - Aktif diperdagangkan: daftar TradingView (lib/idx-universe), ±845 saham.
 * - Suspensi / tidak bertransaksi: kode di daftar bawaan yang tidak ada di TradingView tetapi masih
 *   punya data harga di Yahoo; tanggal transaksi terakhirnya ikut dicatat.
 * - Tanpa data: kode lama yang tidak dikenal Yahoo lagi (delisting, atau suspensi sangat lama).
 * - Resmi BEI: situs BEI (idx.co.id) memblokir akses otomatis (Cloudflare), jadi angkanya diisi admin
 *   lewat tabel `app_settings` (migrasi 000011), dengan nilai bawaan di bawah.
 *
 * Hasil di-cache 6 jam per instance dan ikut kedaluwarsa saat Admin menekan "Refresh semua data".
 */

import { createClient } from '@supabase/supabase-js';
import { IDX_TICKERS } from '@/lib/tickers';
import { getIdxUniverse } from '@/lib/idx-universe';
import { createTtlCache, YAHOO_UA } from '@/lib/yahoo';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase-config';

export const OFFICIAL_SETTING_KEY = 'idx_listed_official';

export interface OfficialListed {
  count: number;
  /** Tanggal data (YYYY-MM-DD). */
  asOf: string;
  source: string;
  /** 'admin' = diisi admin di database; 'default' = nilai bawaan aplikasi. */
  origin: 'admin' | 'default';
  updatedAt?: string;
  updatedBy?: string;
}

/** Nilai bawaan: 963 perusahaan tercatat per Oktober 2026 (BEI, diberitakan ANTARA News). */
export const DEFAULT_OFFICIAL: OfficialListed = { count: 963, asOf: '2026-10-08', source: 'BEI (ANTARA News, Okt 2026)', origin: 'default' };

export interface SuspendedStock {
  symbol: string;
  name: string;
  lastTrade: string;
}

export interface ListingCoverage {
  active: number;
  suspended: SuspendedStock[];
  /** Kode lama tanpa data harga di Yahoo. */
  noData: string[];
  /** Emiten yang terpantau di web ini (aktif + suspensi). */
  tracked: number;
  official: OfficialListed;
  /** Persentase `tracked` terhadap jumlah resmi. */
  coveragePct: number;
  universeSource: 'tradingview' | 'static';
  checkedAt: string;
}

const officialCache = createTtlCache<OfficialListed>(10 * 60_000, 1);
const coverageCache = createTtlCache<ListingCoverage>(6 * 60 * 60_000, 1);

function parseOfficial(value: unknown, updatedAt?: string, updatedBy?: string | null): OfficialListed | null {
  if (!value || typeof value !== 'object') return null;
  const v = value as Record<string, unknown>;
  const count = Number(v.count);
  if (!Number.isInteger(count) || count < 100 || count > 5000) return null;
  const asOf = typeof v.asOf === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.asOf) ? v.asOf : DEFAULT_OFFICIAL.asOf;
  const source = typeof v.source === 'string' && v.source.trim() ? v.source.trim().slice(0, 120) : 'Admin';
  return { count, asOf, source, origin: 'admin', updatedAt, updatedBy: updatedBy ?? undefined };
}

/** Jumlah emiten resmi BEI: dari database (diisi admin) atau nilai bawaan. */
export async function getOfficialListed(): Promise<OfficialListed> {
  if (!isSupabaseConfigured) return DEFAULT_OFFICIAL;
  try {
    const { value } = await officialCache('official', async () => {
      const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
      const { data, error } = await supabase.from('app_settings').select('value, updated_at, updated_by').eq('key', OFFICIAL_SETTING_KEY).maybeSingle();
      // Tabel belum dibuat (migrasi 000011 belum dijalankan) → pakai nilai bawaan.
      if (error) return DEFAULT_OFFICIAL;
      return parseOfficial(data?.value, data?.updated_at, data?.updated_by) ?? DEFAULT_OFFICIAL;
    });
    return value;
  } catch {
    return DEFAULT_OFFICIAL;
  }
}

/** Tanggal transaksi terakhir di Yahoo; null bila simbol tidak dikenal (404 / tanpa meta). */
async function lastTradeDate(symbol: string): Promise<string | null> {
  const res = await fetch(`https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}.JK?range=5d&interval=1d`, {
    headers: { 'User-Agent': YAHOO_UA },
    cache: 'no-store',
    signal: AbortSignal.timeout(6000),
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Yahoo ${res.status}`);
  const json = (await res.json()) as { chart?: { result?: Array<{ meta?: { regularMarketTime?: number } }> } };
  const t = json.chart?.result?.[0]?.meta?.regularMarketTime;
  return typeof t === 'number' ? new Date((t + 7 * 3600) * 1000).toISOString().slice(0, 10) : null;
}

async function loadCoverage(): Promise<ListingCoverage> {
  const [universe, official] = await Promise.all([getIdxUniverse(), getOfficialListed()]);
  const active = new Set(universe.stocks.map((s) => s.symbol));
  const candidates = universe.source === 'tradingview' ? Object.keys(IDX_TICKERS).filter((s) => !active.has(s)) : [];

  const suspended: SuspendedStock[] = [];
  const noData: string[] = [];
  const BATCH = 10;
  for (let i = 0; i < candidates.length; i += BATCH) {
    await Promise.all(
      candidates.slice(i, i + BATCH).map(async (symbol) => {
        try {
          const last = await lastTradeDate(symbol);
          if (last) suspended.push({ symbol, name: IDX_TICKERS[symbol] ?? symbol, lastTrade: last });
          else noData.push(symbol);
        } catch {
          // Gagal sementara: anggap masih tercatat tanpa tanggal agar tidak salah dibuang.
          suspended.push({ symbol, name: IDX_TICKERS[symbol] ?? symbol, lastTrade: '' });
        }
      })
    );
  }
  suspended.sort((a, b) => b.lastTrade.localeCompare(a.lastTrade) || a.symbol.localeCompare(b.symbol));
  noData.sort();

  const tracked = universe.stocks.length + suspended.length;
  return {
    active: universe.stocks.length,
    suspended,
    noData,
    tracked,
    official,
    coveragePct: official.count > 0 ? Math.min(100, (tracked / official.count) * 100) : 0,
    universeSource: universe.source,
    checkedAt: new Date().toISOString(),
  };
}

/** Cakupan emiten (cache 6 jam; dipaksa segar oleh refresh Admin). */
export async function getListingCoverage(): Promise<ListingCoverage> {
  const { value } = await coverageCache('coverage', loadCoverage);
  // Angka resmi bisa diubah admin lebih sering dari 6 jam: selalu pakai nilai terbaru.
  const official = await getOfficialListed();
  return {
    ...value,
    official,
    coveragePct: official.count > 0 ? Math.min(100, (value.tracked / official.count) * 100) : 0,
  };
}
