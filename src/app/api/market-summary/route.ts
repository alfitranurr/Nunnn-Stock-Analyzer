import { NextResponse, NextRequest } from 'next/server';
import { getIdxUniverse, nameFromUniverse } from '@/lib/idx-universe';
import { applyRateLimit } from '@/lib/rate-limit';
import { getAutoRejectionStatus } from '@/lib/calculator';
import { createTtlCache } from '@/lib/yahoo';
import { getMarketDataProvider, getValidatedStockQuotes, logSuspectQuotes } from '@/lib/market-data';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface StockMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
  volume: number; // lembar
  value: number; // nilai transaksi (Rp) ≈ harga × volume
  limit: 'ARA' | 'ARB' | null;
}

interface MarketScan {
  ihsg: {
    price: number;
    previousClose: number;
    change: number;
    changePercent: number;
    dayHigh: number;
    dayLow: number;
    yearHigh: number;
    yearLow: number;
    marketTime: number | null;
    intraday: number[];
  };
  movers: StockMover[];
  /** Saham yang datanya dilewati karena tidak lolos pengecekan kewajaran. */
  excluded: Array<{ symbol: string; issue: string }>;
  scannedAt: string;
}

const TOP_N = 6;
const MAX_MIN_VALUE = 1e13;

// Satu scan dipakai bersama oleh semua pengunjung selama 45 detik.
const scanCache = createTtlCache<MarketScan>(45_000, 1);

async function scanMarket(): Promise<MarketScan> {
  const provider = getMarketDataProvider();
  // Daftar emiten aktif (termasuk IPO baru); cadangan daftar bawaan bila sumber gagal.
  const universe = await getIdxUniverse();
  const tickers = universe.stocks.map((s) => s.symbol);
  const [ihsg, { quotes, suspect }] = await Promise.all([
    provider.getCompositeIndex(),
    getValidatedStockQuotes(tickers),
  ]);

  if (!ihsg) throw new Error('IHSG quote unavailable');
  logSuspectQuotes('scan pasar', suspect);

  const movers: StockMover[] = [];
  for (const { quote, issue } of quotes.values()) {
    if (issue) continue;
    movers.push({
      symbol: quote.ticker,
      name: quote.name || nameFromUniverse(universe, quote.ticker),
      price: quote.price,
      change: quote.change,
      changePercent: quote.changePercent,
      volume: quote.volume,
      value: quote.price * quote.volume,
      limit: getAutoRejectionStatus(quote.previousClose, quote.price, quote.marketTime ? quote.marketTime * 1000 : Date.now()),
    });
  }

  return {
    ihsg: {
      price: ihsg.price,
      previousClose: ihsg.previousClose,
      change: ihsg.change,
      changePercent: ihsg.changePercent,
      dayHigh: ihsg.dayHigh,
      dayLow: ihsg.dayLow,
      yearHigh: ihsg.yearHigh,
      yearLow: ihsg.yearLow,
      marketTime: ihsg.marketTime,
      intraday: ihsg.intraday,
    },
    movers,
    excluded: suspect.map((s) => ({ symbol: s.quote.ticker, issue: s.issue ?? 'unknown' })),
    scannedAt: new Date().toISOString(),
  };
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const minValueParam = Number(request.nextUrl.searchParams.get('minValue') ?? 0);
  const minValue = Number.isFinite(minValueParam) ? Math.min(Math.max(0, minValueParam), MAX_MIN_VALUE) : 0;

  let scan: MarketScan;
  try {
    ({ value: scan } = await scanCache('scan', scanMarket));
  } catch {
    return NextResponse.json({ error: 'Failed to fetch market data' }, { status: 502 });
  }

  const { movers } = scan;
  const liquid = movers.filter((m) => m.value >= minValue);
  const provider = getMarketDataProvider();

  const breadth = {
    advancers: movers.filter((m) => m.change > 0).length,
    decliners: movers.filter((m) => m.change < 0).length,
    unchanged: movers.filter((m) => m.change === 0).length,
    ara: movers.filter((m) => m.limit === 'ARA').length,
    arb: movers.filter((m) => m.limit === 'ARB').length,
    totalValue: movers.reduce((sum, m) => sum + m.value, 0),
  };

  return NextResponse.json({
    ihsg: scan.ihsg,
    breadth,
    movers: {
      gainers: liquid.filter((m) => m.change > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, TOP_N),
      losers: liquid.filter((m) => m.change < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, TOP_N),
      value: [...movers].sort((a, b) => b.value - a.value).slice(0, TOP_N),
      volume: [...movers].sort((a, b) => b.volume - a.volume).slice(0, TOP_N),
    },
    minValue,
    totalScanned: movers.length,
    dataQuality: {
      excludedCount: scan.excluded.length,
      excluded: scan.excluded.slice(0, 20),
    },
    source: { id: provider.id, label: provider.label, delayed: provider.delayed },
    scannedAt: scan.scannedAt,
  });
}
