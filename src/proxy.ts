import { NextResponse, type NextRequest } from 'next/server';
import { isSupabaseConfigured } from '@/lib/supabase-config';

/**
 * Gerbang pertama untuk route AI / berbiaya:
 *   - /api/news/summary        (rangkuman AI berita)
 *   - /api/analysis/*          (analisis saham, termasuk sentimen AI)
 *
 * Proxy hanya memastikan ada kredensial: header `Authorization: Bearer <token>`
 * (klien menyimpan sesi Supabase di localStorage) atau cookie sesi `sb-*-auth-token`.
 * Validasi JWT dan status approval dilakukan di route lewat `requireUser()`.
 *
 * Bila Supabase tidak dikonfigurasi, aplikasi berjalan di mode Demo/Lokal dan gerbang dilewati.
 */
function hasCredentials(request: NextRequest): boolean {
  if (/^Bearer\s+\S+/i.test(request.headers.get('authorization') ?? '')) return true;
  return request.cookies.getAll().some((c) => /^sb-[a-z0-9_-]+-auth-token(\.\d+)?$/i.test(c.name));
}

export function proxy(request: NextRequest) {
  if (!isSupabaseConfigured) {
    return NextResponse.next();
  }

  if (!hasCredentials(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: authentication required.', code: 'unauthenticated' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/news/summary', '/api/analysis/:path*'],
};
