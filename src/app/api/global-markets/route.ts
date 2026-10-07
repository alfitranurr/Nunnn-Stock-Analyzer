import { NextResponse, NextRequest } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { GLOBAL_INSTRUMENTS } from '@/lib/global-markets';
import { createTtlCache, fetchQuotesWithIntraday } from '@/lib/yahoo';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface GlobalQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  closes: number[];
}

const globalCache = createTtlCache<GlobalQuote[]>(60_000, 1);

/** GET /api/global-markets: USD/IDR, LQ45, komoditas, dan indeks regional/AS. */
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  try {
    const { value: quotes, cachedAt } = await globalCache('global', async () => {
      const map = await fetchQuotesWithIntraday(GLOBAL_INSTRUMENTS.map((i) => i.symbol), '15m');
      if (map.size === 0) throw new Error('No global quotes');
      return GLOBAL_INSTRUMENTS.flatMap((i) => {
        const q = map.get(i.symbol);
        return q ? [{ symbol: i.symbol, price: q.price, change: q.change, changePercent: q.changePercent, closes: q.closes }] : [];
      });
    });
    return NextResponse.json({ quotes, updatedAt: new Date(cachedAt).toISOString() });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch global markets' }, { status: 502 });
  }
}
