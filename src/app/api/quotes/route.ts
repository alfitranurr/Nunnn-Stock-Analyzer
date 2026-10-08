import { NextResponse, NextRequest } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { validateTickerSymbol } from '@/lib/validators';
import { createTtlCache } from '@/lib/yahoo';
import { QUOTES_MAX_SYMBOLS as MAX_SYMBOLS, type QuoteItem } from '@/lib/quotes';
import { getValidatedStockQuotes, logSuspectQuotes } from '@/lib/market-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const quotesCache = createTtlCache<QuoteItem[]>(15_000, 200);

/**
 * GET /api/quotes?symbols=BBCA,GTSI
 * Harga terkini + data intraday banyak saham BEI dalam satu request (dipakai watchlist & portofolio).
 * Kutipan yang tidak lolos pengecekan kewajaran tetap dikirim dengan `suspect: true`.
 */
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const raw = request.nextUrl.searchParams.get('symbols') ?? '';
  const symbols = Array.from(
    new Set(
      raw
        .split(',')
        .map((s) => validateTickerSymbol(s.trim())?.replace(/\.JK$/i, ''))
        .filter((s): s is string => Boolean(s))
    )
  ).slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json({ error: 'symbols parameter is required' }, { status: 400 });
  }

  const key = [...symbols].sort().join(',');
  try {
    const { value: quotes } = await quotesCache(key, async () => {
      const { quotes: validated, suspect } = await getValidatedStockQuotes(symbols, { intraday: true });
      logSuspectQuotes('quotes', suspect);
      return Array.from(validated.values()).map(({ quote, issue, stale, lastTradeDate }) => ({
        symbol: quote.ticker,
        price: quote.price,
        previousClose: quote.previousClose,
        change: quote.change,
        changePercent: quote.changePercent,
        volume: quote.volume,
        closes: quote.intraday,
        suspect: issue !== null,
        stale: stale === true,
        lastTradeDate: lastTradeDate ?? null,
      }));
    });
    return NextResponse.json({ quotes });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch quotes' }, { status: 502 });
  }
}
