/**
 * Riwayat transaksi portofolio & realized P/L.
 *
 * - Penyimpanan: Supabase `portfolio_transactions` (migrasi 000014) untuk akun cloud, localStorage untuk
 *   mode lokal. Bila tabel cloud belum ada, riwayat disimpan di browser dan `warning` diisi.
 * - Beli dicatat saat menambah/beli lagi saham; jual dicatat dari tombol Jual.
 * - Realized P/L jual = lot × 100 × harga × (1 − fee jual) − lot × 100 × harga rata-rata.
 *   Fee jual default 0,25% (termasuk PPh final 0,1% atas penjualan saham).
 */

import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppUser } from '@/lib/types';
import { getErrorMessage } from '@/lib/utils';

export const SHARES_PER_LOT = 100;
export const DEFAULT_SELL_FEE_PCT = 0.25;

export type TransactionSide = 'buy' | 'sell';

export interface PortfolioTransaction {
  id: string;
  ticker: string;
  side: TransactionSide;
  lot: number;
  price: number;
  feePct: number | null;
  avgCost: number | null;
  realizedPl: number | null;
  tradedAt: string;
}

export type TransactionSource = 'cloud' | 'local';

const localKey = (userId: string) => `nunnn_stock_portfolio_tx_${userId}`;
const usesCloud = (user: AppUser) => isSupabaseConfigured && !user.isMock;
const newest = (a: PortfolioTransaction, b: PortfolioTransaction) => b.tradedAt.localeCompare(a.tradedAt);

function readLocal(userId: string): PortfolioTransaction[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(localKey(userId)) || '[]');
    return Array.isArray(parsed)
      ? parsed.filter((t): t is PortfolioTransaction => !!t && typeof t === 'object' && typeof (t as PortfolioTransaction).ticker === 'string')
      : [];
  } catch {
    return [];
  }
}

function writeLocal(userId: string, list: PortfolioTransaction[]) {
  try {
    localStorage.setItem(localKey(userId), JSON.stringify(list));
  } catch {
    // Storage diblokir: riwayat hanya bertahan di sesi ini.
  }
}

export async function loadTransactions(user: AppUser): Promise<{ list: PortfolioTransaction[]; source: TransactionSource; warning: string | null }> {
  if (!usesCloud(user)) return { list: readLocal(user.id).sort(newest), source: 'local', warning: null };
  const { data, error } = await supabase
    .from('portfolio_transactions')
    .select('id, ticker, side, lot, price, fee_pct, avg_cost, realized_pl, traded_at')
    .order('traded_at', { ascending: false })
    .limit(1000);
  if (error) return { list: readLocal(user.id).sort(newest), source: 'local', warning: getErrorMessage(error) };
  return {
    list: (data ?? []).map((r) => ({
      id: String(r.id),
      ticker: String(r.ticker).toUpperCase(),
      side: r.side === 'sell' ? 'sell' : 'buy',
      lot: Number(r.lot) || 0,
      price: Number(r.price) || 0,
      feePct: r.fee_pct === null ? null : Number(r.fee_pct),
      avgCost: r.avg_cost === null ? null : Number(r.avg_cost),
      realizedPl: r.realized_pl === null ? null : Number(r.realized_pl),
      tradedAt: String(r.traded_at),
    })),
    source: 'cloud',
    warning: null,
  };
}

export async function addTransaction(user: AppUser, source: TransactionSource, tx: Omit<PortfolioTransaction, 'id' | 'tradedAt'> & { tradedAt?: string }): Promise<void> {
  const tradedAt = tx.tradedAt ?? new Date().toISOString();
  if (source === 'cloud') {
    const { error } = await supabase.from('portfolio_transactions').insert({
      user_id: user.id,
      ticker: tx.ticker.toUpperCase(),
      side: tx.side,
      lot: tx.lot,
      price: tx.price,
      fee_pct: tx.feePct,
      avg_cost: tx.avgCost,
      realized_pl: tx.realizedPl,
      traded_at: tradedAt,
    });
    if (error) throw new Error(getErrorMessage(error));
    return;
  }
  writeLocal(user.id, [{ ...tx, id: crypto.randomUUID(), tradedAt }, ...readLocal(user.id)].sort(newest));
}

export async function deleteTransaction(user: AppUser, source: TransactionSource, id: string): Promise<void> {
  if (source === 'cloud') {
    const { error } = await supabase.from('portfolio_transactions').delete().eq('id', id);
    if (error) throw new Error(getErrorMessage(error));
    return;
  }
  writeLocal(user.id, readLocal(user.id).filter((t) => t.id !== id));
}

/** Rincian penjualan: nilai, fee, hasil bersih, modal, dan realized P/L. */
export function sellBreakdown(lot: number, price: number, avgCost: number, feePct: number) {
  const shares = Math.max(0, Math.floor(lot)) * SHARES_PER_LOT;
  const gross = shares * price;
  const fee = gross * (Math.max(0, feePct) / 100);
  const net = gross - fee;
  const cost = shares * avgCost;
  const realized = net - cost;
  return { shares, gross, fee, net, cost, realized, realizedPct: cost > 0 ? (realized / cost) * 100 : null };
}

const wibKey = (iso: string, len: 7 | 4) => new Date(Date.parse(iso) + 7 * 3600_000).toISOString().slice(0, len);

/** Ringkasan realized P/L: bulan ini, tahun ini (WIB), total, dan jumlah jual untung/rugi. */
export function summarizeRealized(list: PortfolioTransaction[], now: number = Date.now()) {
  const nowIso = new Date(now).toISOString();
  const month = wibKey(nowIso, 7);
  const year = wibKey(nowIso, 4);
  let monthPl = 0, yearPl = 0, totalPl = 0, wins = 0, losses = 0, sells = 0;
  for (const t of list) {
    if (t.side !== 'sell' || t.realizedPl === null) continue;
    sells++;
    totalPl += t.realizedPl;
    if (wibKey(t.tradedAt, 4) === year) yearPl += t.realizedPl;
    if (wibKey(t.tradedAt, 7) === month) monthPl += t.realizedPl;
    if (t.realizedPl > 0) wins++;
    else if (t.realizedPl < 0) losses++;
  }
  return { monthPl, yearPl, totalPl, sells, wins, losses, winRate: wins + losses > 0 ? (wins / (wins + losses)) * 100 : null };
}
