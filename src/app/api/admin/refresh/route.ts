import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { clearAllServerCaches } from '@/lib/yahoo';
import { markDataRefreshed } from '@/lib/refresh-generation';
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
 * POST /api/admin/refresh — tandai semua cache server kedaluwarsa (harga, scan pasar, pasar global,
 * berita, dividen, fundamental, teknikal, daftar emiten) di instance ini DAN semua instance lain
 * (lewat generasi refresh bersama), lalu muat ulang daftar emiten aktif. Admin saja.
 * Hasil AI (rangkuman/sentimen) tidak dibuang: kuncinya kumpulan berita yang sama, jadi tetap valid
 * dan tidak perlu memakai token lagi; berita baru otomatis dianalisis ulang.
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
  const generation = await markDataRefreshed();
  const cleared = clearAllServerCaches();
  const universe = await getIdxUniverse();
  return NextResponse.json({
    refreshedAt: new Date().toISOString(),
    durationMs: Date.now() - started,
    cleared,
    // false = cache bersama tidak tersedia; instance lain segar setelah TTL masing-masing.
    allInstances: generation !== null,
    generation: generation !== null ? new Date(generation).toISOString() : null,
    universe: summarize(universe),
  });
}
