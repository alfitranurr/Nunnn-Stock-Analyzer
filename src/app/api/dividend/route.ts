import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { validateTickerSymbol } from '@/lib/validators';
import { DIVIDEND_SOURCE, getDividendData } from '@/lib/dividend-source';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/dividend?symbol=BBCA
 * Riwayat dividen per lembar (tanggal ex-date) + rata-rata harga tahunan untuk yield historis.
 * Harga terkini diambil terpisah lewat /api/quotes (tervalidasi & di-refresh berkala).
 *
 * 404 = emiten tidak dikenal; 502 = sumber data gagal. Emiten yang belum pernah membagikan
 * dividen mengembalikan `events: []`, bukan data perkiraan.
 */
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const ticker = validateTickerSymbol(request.nextUrl.searchParams.get('symbol'))?.replace(/\.JK$/, '');
  if (!ticker) {
    return NextResponse.json({ error: 'Invalid or missing symbol parameter', code: 'invalid_symbol' }, { status: 400 });
  }

  try {
    const { data, cachedAt } = await getDividendData(ticker);
    if (!data) {
      return NextResponse.json({ error: `Ticker ${ticker} not found`, code: 'not_found' }, { status: 404 });
    }
    return NextResponse.json({
      ...data,
      source: DIVIDEND_SOURCE,
      fetchedAt: new Date(cachedAt).toISOString(),
    });
  } catch (err) {
    console.warn(`[dividend] ${ticker}:`, err instanceof Error ? err.message : err);
    return NextResponse.json({ error: 'Dividend data source unavailable', code: 'source_failed' }, { status: 502 });
  }
}
