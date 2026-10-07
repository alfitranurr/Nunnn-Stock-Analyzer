/** Kutipan harga saham BEI dari /api/quotes. */
export interface QuoteItem {
  symbol: string;
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  closes: number[]; // Harga intraday per 5 menit (sparkline)
  /** true bila perubahan harga tidak lolos pengecekan kewajaran (jangan dipakai untuk P&L). */
  suspect: boolean;
}

export const QUOTES_MAX_SYMBOLS = 30;

/** Ambil harga banyak saham sekaligus (otomatis dipecah per 30 simbol). */
export async function fetchQuotes(symbols: string[]): Promise<Record<string, QuoteItem>> {
  const unique = Array.from(new Set(symbols.map((s) => s.toUpperCase())));
  const result: Record<string, QuoteItem> = {};
  for (let i = 0; i < unique.length; i += QUOTES_MAX_SYMBOLS) {
    const chunk = unique.slice(i, i + QUOTES_MAX_SYMBOLS);
    const res = await fetch(`/api/quotes?symbols=${encodeURIComponent(chunk.join(','))}`);
    if (!res.ok) throw new Error(`Quotes request failed (${res.status})`);
    const data: { quotes?: QuoteItem[] } = await res.json();
    for (const q of data.quotes ?? []) result[q.symbol] = q;
  }
  return result;
}
