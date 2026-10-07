import { NextRequest, NextResponse } from 'next/server';
import { cleanCompanyName } from '@/lib/utils';
import { IDX_TICKERS } from '@/lib/tickers';
import { applyRateLimit } from '@/lib/rate-limit';
import { validateTickerSymbol } from '@/lib/validators';
import { getMarketDataProvider, getValidatedStockQuotes, logSuspectQuotes } from '@/lib/market-data';

// Always run dynamically — this route proxies Yahoo Finance real-time data.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface YahooQuote {
  symbol?: string;
  exchange?: string;
  exchDisp?: string;
  longname?: string;
  shortname?: string;
}

interface YahooSearchResponse {
  quotes?: YahooQuote[];
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (q) {
    // Limit search query length and characters to prevent abuse of upstream API.
    if (q.length > 20 || !/^[A-Za-z0-9.\s-]+$/.test(q)) {
      return NextResponse.json({ error: 'Invalid search query' }, { status: 400 });
    }
    try {
      const cleanQ = q.toUpperCase();
      const resultsMap = new Map<string, { symbol: string; name: string }>();

      // 1. Cek Dictionary Lokal BEI dulu untuk pencarian instan
      Object.entries(IDX_TICKERS).forEach(([sym, name]) => {
        if (sym.includes(cleanQ) || name.toUpperCase().includes(cleanQ)) {
          resultsMap.set(sym, { symbol: sym, name: cleanCompanyName(name) });
        }
      });

      // 2. Query Yahoo Finance Search API dengan q dan q.JK
      const searchUrls = [
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20`,
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q + '.JK')}&quotesCount=20`
      ];

      for (const url of searchUrls) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (res.ok) {
            const data: YahooSearchResponse = await res.json();
            const rawQuotes = data.quotes || [];
            rawQuotes.forEach((quote: YahooQuote) => {
              const sym = (quote.symbol || '').toUpperCase();
              const exch = (quote.exchange || '').toUpperCase();
              const disp = (quote.exchDisp || '').toUpperCase();
              if (sym.endsWith('.JK') || exch === 'JKT' || disp === 'JAKARTA') {
                const cleanSymbol = sym.replace(/\.JK$/i, '').toUpperCase();
                if (!resultsMap.has(cleanSymbol)) {
                  const name = cleanCompanyName(quote.longname || quote.shortname || cleanSymbol);
                  resultsMap.set(cleanSymbol, { symbol: cleanSymbol, name });
                }
              }
            });
          }
        } catch {
          // Abaikan kesalahan parsial Yahoo API
        }
      }

      // 3. Jika q berukuran 3-6 karakter dan belum ditemukan di hasil, tes langsung ke Yahoo Chart API (${cleanQ}.JK)
      if (cleanQ.length >= 3 && cleanQ.length <= 6 && !resultsMap.has(cleanQ)) {
        try {
          const quote = (await getMarketDataProvider().getStockQuotes([cleanQ])).get(cleanQ);
          if (quote) {
            resultsMap.set(cleanQ, { symbol: cleanQ, name: quote.name || IDX_TICKERS[cleanQ] || cleanQ });
          }
        } catch {
          // Abaikan
        }
      }

      const quotes = Array.from(resultsMap.values());
      return NextResponse.json({ quotes });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      console.error('Error in ticker search:', message);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
  }

  const symbol = validateTickerSymbol(searchParams.get('symbol'))?.replace(/\.JK$/i, '') ?? null;

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol or q parameter is required' }, { status: 400 });
  }

  try {
    // Check local dictionary first for instant name fallback
    const localName = IDX_TICKERS[symbol] || '';

    // Harga terkini + acuan sesi sebelumnya dari provider aktif, lalu dicek kewajarannya.
    const { quotes, suspect } = await getValidatedStockQuotes([symbol]);
    const checked = quotes.get(symbol);
    if (!checked) {
      return NextResponse.json({ symbol, name: cleanCompanyName(localName || symbol), price: null });
    }
    logSuspectQuotes(`ticker ${symbol}`, suspect);

    const { quote, issue } = checked;
    return NextResponse.json({
      symbol,
      name: cleanCompanyName(quote.name || localName || symbol),
      price: quote.price,
      previousClose: issue ? null : quote.previousClose,
      // Perubahan yang tidak lolos pengecekan tidak dikirim agar tidak menyesatkan.
      changePercent: issue ? null : quote.changePercent,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('Error fetching ticker data from internet:', message);
    const localName = IDX_TICKERS[symbol] || '';
    return NextResponse.json({ symbol, name: cleanCompanyName(localName || symbol), price: null });
  }
}
