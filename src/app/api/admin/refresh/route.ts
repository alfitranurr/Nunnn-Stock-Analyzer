import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { clearAllServerCaches } from '@/lib/yahoo';
import { getIdxUniverse, type IdxUniverse } from '@/lib/idx-universe';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

function summarize(universe: IdxUniverse) {
  return {
    count: universe.stocks.length,
    source: universe.source,
    fetchedAt: new Date(universe.fetchedAt).toISOString(),
    newSymbols: universe.newSymbols.slice(0, 200),
    inactiveCount: universe.inactiveSymbols.length,
    error: universe.error,
  };
}

/** GET /api/admin/refresh — status daftar emiten aktif (admin). */
export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;
  const { error } = await requireAdmin(request);
  if (error) return error;
  return NextResponse.json({ universe: summarize(await getIdxUniverse()) });
}

/**
 * POST /api/admin/refresh — kosongkan semua cache server (harga, scan pasar, pasar global,
 * berita, dividen, daftar emiten) lalu muat ulang daftar emiten aktif. Admin saja.
 */
export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin');
  if (origin && origin !== request.nextUrl.origin) {
    return NextResponse.json({ error: 'Forbidden origin', code: 'bad_origin' }, { status: 403 });
  }
  const limited = await applyRateLimit(request);
  if (limited) return limited;
  const { error } = await requireAdmin(request);
  if (error) return error;

  const started = Date.now();
  const cleared = clearAllServerCaches();
  const universe = await getIdxUniverse();
  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    cleared,
    universe: summarize(universe),
  });
}
