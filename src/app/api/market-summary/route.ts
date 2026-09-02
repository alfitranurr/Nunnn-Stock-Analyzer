import { NextResponse } from 'next/server';
import { cleanCompanyName } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface ChartMeta {
  regularMarketPrice?: number | null;
  previousClose?: number | null;
  chartPreviousClose?: number | null;
  regularMarketVolume?: number | null;
  longName?: string;
  shortName?: string;
  fiftyTwoWeekHigh?: number | null;
  fiftyTwoWeekLow?: number | null;
  regularMarketDayHigh?: number | null;
  regularMarketDayLow?: number | null;
}

interface ChartResult {
  meta?: ChartMeta;
}

interface ChartResponse {
  chart?: {
    result?: ChartResult[];
    error?: unknown;
  };
}

interface StockMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

async function fetchIndexQuote(symbol: string): Promise<{
  price: number;
  previousClose: number;
  change: number;
  changePercent: number;
  volume: number;
  dayHigh: number;
  dayLow: number;
  yearHigh: number;
  yearLow: number;
  name: string;
} | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}?range=1d&interval=1d`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    const data: ChartResponse = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice == null) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;
    const name = cleanCompanyName(meta.longName || meta.shortName || symbol);

    return {
      price,
      previousClose: prevClose,
      change,
      changePercent,
      volume: meta.regularMarketVolume ?? 0,
      dayHigh: meta.regularMarketDayHigh ?? price,
      dayLow: meta.regularMarketDayLow ?? price,
      yearHigh: meta.fiftyTwoWeekHigh ?? price,
      yearLow: meta.fiftyTwoWeekLow ?? price,
      name,
    };
  } catch {
    return null;
  }
}

async function fetchStockMover(symbol: string): Promise<StockMover | null> {
  try {
    const res = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.JK?range=1d&interval=1d`,
      {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
        cache: 'no-store',
      }
    );
    if (!res.ok) return null;
    const data: ChartResponse = await res.json();
    const meta = data.chart?.result?.[0]?.meta;
    if (!meta || meta.regularMarketPrice == null) return null;

    const price = meta.regularMarketPrice;
    const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
    const change = price - prevClose;
    const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

    return {
      symbol: symbol.toUpperCase(),
      name: cleanCompanyName(meta.longName || meta.shortName || symbol),
      price,
      change,
      changePercent,
    };
  } catch {
    return null;
  }
}

export async function GET() {
  // Fetch IHSG composite index
  const ihsg = await fetchIndexQuote('^JKSE');

  // Fetch a curated list of blue-chip stocks for top movers display
  const moverSymbols = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'GOTO', 'ANTM'];
  const moverResults = await Promise.all(moverSymbols.map(fetchStockMover));
  const movers = moverResults
    .filter((m): m is StockMover => m !== null)
    .sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  const topGainers = movers.filter((m) => m.change > 0).slice(0, 3);
  const topLosers = movers.filter((m) => m.change < 0).slice(0, 3);

  if (!ihsg) {
    return NextResponse.json(
      { error: 'Failed to fetch market data' },
      { status: 502 }
    );
  }

  return NextResponse.json({
    ihsg,
    topGainers,
    topLosers,
    timestamp: new Date().toISOString(),
  });
}
