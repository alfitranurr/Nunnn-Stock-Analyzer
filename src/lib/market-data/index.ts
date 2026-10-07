import type { MarketDataProvider } from './types';
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

/** Ambil kutipan saham dari provider aktif lalu jalankan pengecekan kewajaran. */
export async function getValidatedStockQuotes(
  tickers: string[],
  options?: { intraday?: boolean }
): Promise<ValidatedQuotes> {
  const raw = await getMarketDataProvider().getStockQuotes(tickers, options);
  const quotes = new Map<string, ValidatedQuote>();
  const suspect: ValidatedQuote[] = [];
  for (const [ticker, quote] of raw) {
    const checked = validateIdxQuote(quote);
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
