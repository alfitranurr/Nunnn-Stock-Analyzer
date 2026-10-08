import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/utils';
import { requireUser } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { validateTickerSymbol } from '@/lib/validators';
import { getFundamentals } from '@/lib/fundamentals-source';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/analysis/fundamentals?symbol=BBCA
 * Rasio fundamental (TradingView) + riwayat pendapatan/laba (Yahoo). Tidak ada data buatan:
 * 404 bila emiten tidak dikenal, 502 bila kedua sumber gagal; metrik yang tidak tersedia bernilai null.
 */
export async function GET(request: NextRequest) {
  const { error: authError } = await requireUser(request);
  if (authError) return authError;
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const ticker = validateTickerSymbol(request.nextUrl.searchParams.get('symbol'))?.replace(/\.JK$/, '');
  if (!ticker) return NextResponse.json({ error: 'Invalid or missing symbol parameter', code: 'invalid_symbol' }, { status: 400 });

  try {
    const data = await getFundamentals(ticker);
    if (!data) return NextResponse.json({ error: `Ticker ${ticker} not found`, code: 'not_found' }, { status: 404 });
    return NextResponse.json(data);
  } catch (error) {
    console.error(`[fundamentals] ${ticker}:`, getErrorMessage(error));
    return NextResponse.json({ error: 'Fundamental data sources unavailable', code: 'source_failed' }, { status: 502 });
  }
}
