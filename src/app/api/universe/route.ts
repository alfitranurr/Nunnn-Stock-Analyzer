import { NextRequest, NextResponse } from 'next/server';
import { applyRateLimit } from '@/lib/rate-limit';
import { getListingCoverage } from '@/lib/listing-coverage';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/universe — cakupan emiten: aktif (TradingView), suspensi terdeteksi (Yahoo),
 * kode lama tanpa data, dan jumlah resmi BEI (diisi admin / nilai bawaan).
 */
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;
  try {
    return NextResponse.json(await getListingCoverage());
  } catch (error) {
    console.error('[universe]', getErrorMessage(error));
    return NextResponse.json({ error: 'Listing data unavailable', code: 'source_failed' }, { status: 502 });
  }
}
