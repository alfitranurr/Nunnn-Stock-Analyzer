/**
 * Data fundamental (server), tanpa angka buatan:
 * - Rasio & angka terkini: screener publik TradingView (P/E, PBV, ROE, ROA, DER, margin, dividend
 *   yield, EPS, kapitalisasi, pendapatan, laba, sektor), satu request per emiten.
 * - Riwayat pendapatan & laba bersih: Yahoo fundamentals-timeseries (tahunan & kuartalan).
 * Yahoo v7/quote dan v10/quoteSummary sudah menolak tanpa crumb (401), jadi tidak dipakai.
 */

import { createTtlCache, YAHOO_UA } from '@/lib/yahoo';
import { IDX_TICKERS } from '@/lib/tickers';
import { cleanCompanyName } from '@/lib/utils';

export interface FundamentalMetrics {
  price: number | null;
  marketCap: number | null;
  pe: number | null;
  pbv: number | null;
  ps: number | null;
  eps: number | null;
  roe: number | null;
  roa: number | null;
  /** Rasio utang terhadap ekuitas (x). */
  der: number | null;
  currentRatio: number | null;
  netMargin: number | null;
  operatingMargin: number | null;
  grossMargin: number | null;
  dividendYield: number | null;
  revenue: number | null;
  netIncome: number | null;
  freeCashFlow: number | null;
  totalDebt: number | null;
  beta: number | null;
  sharesOutstanding: number | null;
  freeFloatPct: number | null;
}

export interface FinancialPoint {
  label: string;
  date: string;
  revenue: number | null;
  netIncome: number | null;
}

export interface FundamentalsData {
  symbol: string;
  name: string;
  sector: string | null;
  industry: string | null;
  metrics: FundamentalMetrics | null;
  history: { annual: FinancialPoint[]; quarterly: FinancialPoint[] };
  sources: { metrics: string | null; history: string | null };
  fetchedAt: string;
}

const TV_COLUMNS = [
  'name', 'description', 'sector', 'industry', 'close', 'market_cap_basic', 'price_earnings_ttm', 'price_book_ratio',
  'price_sales_current', 'earnings_per_share_basic_ttm', 'return_on_equity', 'return_on_assets', 'debt_to_equity',
  'current_ratio', 'net_margin', 'operating_margin', 'gross_margin', 'dividends_yield_current', 'total_revenue',
  'net_income', 'free_cash_flow', 'total_debt', 'beta_1_year', 'total_shares_outstanding', 'float_shares_outstanding',
] as const;

const num = (v: unknown): number | null => (typeof v === 'number' && Number.isFinite(v) ? v : null);

async function fetchTradingView(ticker: string) {
  const res = await fetch('https://scanner.tradingview.com/indonesia/scan', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'User-Agent': YAHOO_UA },
    body: JSON.stringify({ filter: [{ left: 'name', operation: 'equal', right: ticker }], columns: TV_COLUMNS, range: [0, 5] }),
    cache: 'no-store',
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`TradingView ${res.status}`);
  const json: { data?: Array<{ s?: string; d?: unknown[] }> } = await res.json();
  const row = (json.data ?? []).find((r) => r.s === `IDX:${ticker}`) ?? json.data?.[0];
  if (!row?.d) return null;
  const v = Object.fromEntries(TV_COLUMNS.map((c, i) => [c, row.d?.[i]])) as Record<(typeof TV_COLUMNS)[number], unknown>;
  const shares = num(v.total_shares_outstanding);
  const float = num(v.float_shares_outstanding);
  const metrics: FundamentalMetrics = {
    price: num(v.close),
    marketCap: num(v.market_cap_basic),
    pe: num(v.price_earnings_ttm),
    pbv: num(v.price_book_ratio),
    ps: num(v.price_sales_current),
    eps: num(v.earnings_per_share_basic_ttm),
    roe: num(v.return_on_equity),
    roa: num(v.return_on_assets),
    der: num(v.debt_to_equity),
    currentRatio: num(v.current_ratio),
    netMargin: num(v.net_margin),
    operatingMargin: num(v.operating_margin),
    grossMargin: num(v.gross_margin),
    dividendYield: num(v.dividends_yield_current),
    revenue: num(v.total_revenue),
    netIncome: num(v.net_income),
    freeCashFlow: num(v.free_cash_flow),
    totalDebt: num(v.total_debt),
    beta: num(v.beta_1_year),
    sharesOutstanding: shares,
    freeFloatPct: shares && float ? (float / shares) * 100 : null,
  };
  return {
    metrics,
    name: typeof v.description === 'string' ? cleanCompanyName(v.description) : null,
    sector: typeof v.sector === 'string' ? v.sector : null,
    industry: typeof v.industry === 'string' ? v.industry : null,
  };
}

interface TimeseriesEntry { asOfDate?: string; reportedValue?: { raw?: number } }

async function fetchHistory(ticker: string): Promise<{ annual: FinancialPoint[]; quarterly: FinancialPoint[] }> {
  const types = ['annualTotalRevenue', 'annualNetIncome', 'quarterlyTotalRevenue', 'quarterlyNetIncome'];
  const now = Math.floor(Date.now() / 1000);
  const url = `https://query1.finance.yahoo.com/ws/fundamentals-timeseries/v1/finance/timeseries/${ticker}.JK?symbol=${ticker}.JK&type=${types.join(',')}&period1=1483228800&period2=${now}`;
  const res = await fetch(url, { headers: { 'User-Agent': YAHOO_UA }, cache: 'no-store', signal: AbortSignal.timeout(10_000) });
  if (!res.ok) throw new Error(`Yahoo timeseries ${res.status}`);
  const json: { timeseries?: { result?: Array<Record<string, unknown> & { meta?: { type?: string[] } }> } } = await res.json();
  const byType: Record<string, Map<string, number>> = {};
  for (const r of json.timeseries?.result ?? []) {
    const type = r.meta?.type?.[0];
    if (!type) continue;
    const map = new Map<string, number>();
    for (const e of (r[type] as TimeseriesEntry[] | undefined) ?? []) {
      if (e?.asOfDate && typeof e.reportedValue?.raw === 'number') map.set(e.asOfDate, e.reportedValue.raw);
    }
    byType[type] = map;
  }
  const build = (rev: string, ni: string, label: (d: string) => string, keep: number): FinancialPoint[] => {
    const dates = Array.from(new Set([...(byType[rev]?.keys() ?? []), ...(byType[ni]?.keys() ?? [])])).sort();
    return dates.slice(-keep).map((date) => ({ label: label(date), date, revenue: byType[rev]?.get(date) ?? null, netIncome: byType[ni]?.get(date) ?? null }));
  };
  const quarterLabel = (d: string) => `Q${Math.ceil(Number(d.slice(5, 7)) / 3)} ${d.slice(2, 4)}`;
  return {
    annual: build('annualTotalRevenue', 'annualNetIncome', (d) => d.slice(0, 4), 5),
    quarterly: build('quarterlyTotalRevenue', 'quarterlyNetIncome', quarterLabel, 6),
  };
}

const cache = createTtlCache<FundamentalsData | null>(6 * 60 * 60 * 1000, 300);

/** null = emiten tidak dikenal kedua sumber. Melempar error bila kedua sumber gagal. */
export async function getFundamentals(ticker: string): Promise<FundamentalsData | null> {
  const { value } = await cache(ticker, async () => {
    const [tv, hist] = await Promise.allSettled([fetchTradingView(ticker), fetchHistory(ticker)]);
    if (tv.status === 'rejected' && hist.status === 'rejected') throw new Error(`${tv.reason}; ${hist.reason}`);
    const tvValue = tv.status === 'fulfilled' ? tv.value : null;
    const history = hist.status === 'fulfilled' ? hist.value : { annual: [], quarterly: [] };
    if (!tvValue && history.annual.length === 0 && history.quarterly.length === 0) return null;
    return {
      symbol: ticker,
      name: IDX_TICKERS[ticker] || tvValue?.name || ticker,
      sector: tvValue?.sector ?? null,
      industry: tvValue?.industry ?? null,
      metrics: tvValue?.metrics ?? null,
      history,
      sources: {
        metrics: tvValue ? 'TradingView' : null,
        history: history.annual.length + history.quarterly.length > 0 ? 'Yahoo Finance' : null,
      },
      fetchedAt: new Date().toISOString(),
    };
  });
  return value;
}
