import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { validateTickerSymbol } from '@/lib/validators';
import { DIVIDEND_SOURCE, getDividendData } from '@/lib/dividend-source';
import { addDays } from '@/lib/dividend';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

const MAX_SYMBOLS = 20;

/**
 * GET /api/dividend/summary?symbols=BBCA,TLKM
 * Total dividen 12 bulan terakhir (TTM) per emiten, untuk menghitung yield saham-saham pilihan.
 * Emiten yang gagal dimuat dilewati.
 */
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const symbols = Array.from(
    new Set(
      (request.nextUrl.searchParams.get('symbols') ?? '')
        .split(',')
        .map((s) => validateTickerSymbol(s.trim())?.replace(/\.JK$/, ''))
        .filter((s): s is string => Boolean(s))
    )
  ).slice(0, MAX_SYMBOLS);

  if (symbols.length === 0) {
    return NextResponse.json({ error: 'symbols parameter is required' }, { status: 400 });
  }

  const today = new Date(Date.now() + 7 * 3600_000).toISOString().slice(0, 10); // WIB
  const ttmStart = addDays(today, -365);

  const settled = await Promise.allSettled(symbols.map((s) => getDividendData(s)));
  const items = settled.flatMap((r, i) => {
    if (r.status !== 'fulfilled' || !r.value.data) return [];
    const ttm = r.value.data.events.filter((e) => e.exDate > ttmStart && e.exDate <= today);
    const events = r.value.data.events;
    return [{
      symbol: symbols[i],
      ttmDps: Math.round(ttm.reduce((sum, e) => sum + e.amount, 0) * 100) / 100,
      ttmPayments: ttm.length,
      lastExDate: events.length > 0 ? events[events.length - 1].exDate : null,
    }];
  });

  return NextResponse.json({ items, source: DIVIDEND_SOURCE });
}
