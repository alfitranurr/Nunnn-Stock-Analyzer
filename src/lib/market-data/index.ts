import type { MarketDataProvider, StockQuote } from './types';
import { createTtlCache } from '@/lib/yahoo';
import { yahooProvider } from './yahoo-provider';
import { validateIdxQuote, type ValidatedQuote } from './validate';

export type { IndexQuote, MarketDataProvider, StockQuote } from './types';
export type { QuoteIssue, ValidatedQuote } from './validate';

/**
 * Daftar provider yang tersedia. Untuk menambah vendor berlisensi BEI:
 * 1. buat `src/lib/market-data/<vendor>-provider.ts` yang mengimplementasikan MarketDataProvider,
 * 2. daftarkan di sini,
 * 3. set env `MARKET_DATA_PROVIDER=<id>` (plus API key vendor) di Vercel.
 */
const PROVIDERS: Record<string, MarketDataProvider> = {
  [yahooProvider.id]: yahooProvider,
};

let warnedUnknown = false;

export function getMarketDataProvider(): MarketDataProvider {
  const id = (process.env.MARKET_DATA_PROVIDER || yahooProvider.id).toLowerCase();
  const provider = PROVIDERS[id];
  if (!provider) {
    if (!warnedUnknown) {
      console.warn(`[market-data] Provider "${id}" tidak dikenal, memakai ${yahooProvider.label}.`);
      warnedUnknown = true;
    }
    return yahooProvider;
  }
  return provider;
}

export interface ValidatedQuotes {
  /** Semua kutipan yang berhasil dimuat (sudah dinormalisasi), termasuk yang meragukan. */
  quotes: Map<string, ValidatedQuote>;
  /** Kutipan meragukan, untuk dicatat & ditampilkan sebagai jumlah yang dilewati. */
  suspect: ValidatedQuote[];
}

/** Tanggal WIB (YYYY-MM-DD) dari epoch detik. */
export const wibDate = (sec: number) => new Date((sec + 7 * 3600) * 1000).toISOString().slice(0, 10);

const sessionCache = createTtlCache<string | null>(60_000, 1);

/** Tanggal (WIB) sesi bursa terakhir, dari waktu transaksi terakhir IHSG (cache 60 detik). */
export async function getLatestSessionDate(): Promise<string | null> {
  try {
    const { value } = await sessionCache('session', async () => {
      const ihsg = await getMarketDataProvider().getCompositeIndex();
      return ihsg?.marketTime ? wibDate(ihsg.marketTime) : null;
    });
    return value;
  } catch {
    return null;
  }
}

/**
 * Ambil kutipan saham dari provider aktif lalu jalankan pengecekan kewajaran.
 * Saham yang transaksi terakhirnya sebelum sesi bursa terakhir (suspensi / tidak ditransaksikan)
 * ditandai `stale`, dan perubahan hari ininya dibuat 0 (bukan kenaikan sesi lama, mis. ARA 2 hari lalu).
 */
export async function getValidatedStockQuotes(
  tickers: string[],
  options?: { intraday?: boolean }
): Promise<ValidatedQuotes> {
  const [raw, ihsgSession] = await Promise.all([getMarketDataProvider().getStockQuotes(tickers, options), getLatestSessionDate()]);
  // Cadangan bila IHSG gagal: tanggal transaksi terbaru di antara kutipan yang dimuat.
  let session = ihsgSession;
  if (!session) {
    for (const q of raw.values()) {
      const d = q.marketTime ? wibDate(q.marketTime) : null;
      if (d && (!session || d > session)) session = d;
    }
  }

  const quotes = new Map<string, ValidatedQuote>();
  const suspect: ValidatedQuote[] = [];
  for (const [ticker, quote] of raw) {
    const lastTradeDate = quote.marketTime ? wibDate(quote.marketTime) : null;
    const stale = session !== null && lastTradeDate !== null && lastTradeDate < session;
    const input: StockQuote = stale ? { ...quote, previousClose: quote.price, change: 0, changePercent: 0, volume: 0, intraday: [] } : quote;
    const checked: ValidatedQuote = { ...validateIdxQuote(input), stale, lastTradeDate };
    quotes.set(ticker, checked);
    if (checked.issue) suspect.push(checked);
  }
  return { quotes, suspect };
}

/** Catat ringkasan data meragukan (maks beberapa contoh agar log tidak banjir). */
export function logSuspectQuotes(context: string, suspect: ValidatedQuote[]) {
  if (suspect.length === 0) return;
  const examples = suspect
    .slice(0, 5)
    .map((s) => `${s.quote.ticker} (${s.issue}: ${s.detail})`)
    .join('; ');
  console.warn(`[market-data] ${context}: ${suspect.length} kutipan meragukan → ${examples}${suspect.length > 5 ? '; …' : ''}`);
}
