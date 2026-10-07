import { getAutoRejectionBounds, isValidIdxPrice, roundToNearestIdxTick } from '@/lib/calculator';
import type { StockQuote } from './types';

export type QuoteIssue = 'invalid-price' | 'off-tick' | 'exceeds-limit' | 'no-volume';

export interface ValidatedQuote {
  quote: StockQuote;
  /** null = data wajar. Selain itu perubahan harganya tidak bisa dipercaya. */
  issue: QuoteIssue | null;
  detail: string | null;
}

const fmt = (n: number) => (Math.round(n * 100) / 100).toString();

/**
 * Normalisasi & pengecekan kewajaran kutipan saham BEI:
 * - acuan dibulatkan ke fraksi terdekat (provider kadang menskalakan histori, mis. 675 → 672,87);
 * - harga ≤ 0 atau bukan kelipatan fraksi → tidak valid;
 * - perubahan melewati batas auto rejection → mustahil, acuan pasti salah;
 * - harga berubah padahal volume 0 → kemungkinan data basi.
 */
export function validateIdxQuote(raw: StockQuote): ValidatedQuote {
  if (!(raw.price > 0) || !(raw.previousClose > 0)) {
    return { quote: raw, issue: 'invalid-price', detail: `harga ${fmt(raw.price)} / acuan ${fmt(raw.previousClose)}` };
  }

  const previousClose = roundToNearestIdxTick(raw.previousClose);
  const change = raw.price - previousClose;
  const quote: StockQuote = {
    ...raw,
    previousClose,
    change,
    changePercent: (change / previousClose) * 100,
  };

  if (!isValidIdxPrice(raw.price)) {
    return { quote, issue: 'off-tick', detail: `harga ${fmt(raw.price)} bukan kelipatan fraksi BEI` };
  }

  const { upper, lower, pct } = getAutoRejectionBounds(previousClose);
  if (raw.price > upper || raw.price < lower) {
    return {
      quote,
      issue: 'exceeds-limit',
      detail: `${fmt(quote.changePercent)}% dari acuan ${fmt(previousClose)} melewati batas ±${pct}%`,
    };
  }

  if (change !== 0 && raw.volume === 0) {
    return { quote, issue: 'no-volume', detail: `berubah ${fmt(quote.changePercent)}% tanpa transaksi` };
  }

  return { quote, issue: null, detail: null };
}
