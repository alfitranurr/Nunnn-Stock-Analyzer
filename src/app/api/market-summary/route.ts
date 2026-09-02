import { NextResponse } from 'next/server';
import { cleanCompanyName } from '@/lib/utils';
import { IDX_TICKERS } from '@/lib/tickers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface StockMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number;
}

const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

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
      { headers: { 'User-Agent': UA }, cache: 'no-store' }
    );
    if (!res.ok) return null;
    const data = await res.json();
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

interface SparkMeta {
  regularMarketPrice?: number;
  chartPreviousClose?: number;
  previousClose?: number;
  regularMarketVolume?: number;
  longName?: string;
  shortName?: string;
}

interface SparkResponse {
  spark?: {
    result?: Array<{
      symbol: string;
      response: Array<{ meta?: SparkMeta }>;
    }>;
    error?: unknown;
  };
}

/**
 * Batch-fetch up to 20 tickers per request using Yahoo Spark API.
 * Returns price, change, changePercent, volume for each stock.
 */
async function fetchBatchMovers(
  entries: Array<[string, string]>,
  batchSize = 20
): Promise<StockMover[]> {
  const movers: StockMover[] = [];

  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    const symbolsParam = batch.map(([sym]) => `${sym}.JK`).join(',');
    const fallbackNames = new Map(batch);

    try {
      const res = await fetch(
        `https://query1.finance.yahoo.com/v7/finance/spark?symbols=${symbolsParam}&range=1d&interval=1d`,
        { headers: { 'User-Agent': UA }, cache: 'no-store' }
      );
      if (!res.ok) continue;
      const data: SparkResponse = await res.json();
      const results = data.spark?.result || [];

      for (const result of results) {
        const meta = result.response[0]?.meta;
        if (!meta || meta.regularMarketPrice == null) continue;

        const symbol = result.symbol.replace(/\.JK$/i, '');
        const price = meta.regularMarketPrice;
        const prevClose = meta.chartPreviousClose ?? meta.previousClose ?? price;
        const change = price - prevClose;
        const changePercent = prevClose > 0 ? (change / prevClose) * 100 : 0;

        movers.push({
          symbol,
          name: cleanCompanyName(meta.longName || meta.shortName || fallbackNames.get(symbol) || symbol),
          price,
          change,
          changePercent,
          volume: meta.regularMarketVolume ?? 0,
        });
      }
    } catch {
      // ignore batch errors
    }
  }

  return movers;
}

export async function GET() {
  // Fetch IHSG composite index
  const ihsg = await fetchIndexQuote('^JKSE');

  // Fetch ALL tickers from the dictionary using batch Spark API.
  // Spark API accepts max 20 symbols per request, so we batch ~105 tickers
  // into ~6 requests (much faster than 105 individual requests).
  const allEntries = Object.entries(IDX_TICKERS);
  const movers = await fetchBatchMovers(allEntries, 20);

  // Sort by absolute change% to find the biggest movers
  movers.sort((a, b) => Math.abs(b.changePercent) - Math.abs(a.changePercent));

  const topGainers = movers.filter((m) => m.change > 0).slice(0, 5);
  const topLosers = movers.filter((m) => m.change < 0).slice(0, 5);

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
    totalScanned: movers.length,
    timestamp: new Date().toISOString(),
  });
}
