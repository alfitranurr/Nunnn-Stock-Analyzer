import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerSupabaseClient } from './supabase-server';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from './supabase-config';
import { getErrorMessage, isNetworkError } from './utils';

export interface AuthedUser {
  id: string;
  email?: string;
  /** true di mode Demo/Lokal (Supabase tidak dikonfigurasi): tidak ada akun sungguhan. */
  isDemo?: boolean;
}

type GuardResult = { user: AuthedUser; error: null } | { user: null; error: NextResponse };

const fail = (status: number, error: string, code: string): GuardResult => ({
  user: null,
  error: NextResponse.json({ error, code }, { status }),
});

function clientIp(request: NextRequest): string {
  return request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || request.headers.get('x-real-ip') || 'unknown';
}

function bearerToken(request: NextRequest): string | null {
  const match = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i);
  return match ? match[1].trim() : null;
}

/**
 * Validasi pengguna untuk route berbiaya (AI) / terproteksi.
 *
 * - Mode Demo/Lokal (Supabase tidak dikonfigurasi): tidak ada akun sungguhan, jadi request
 *   diizinkan dengan identitas `demo:<ip>` (tetap kena rate limit per IP).
 * - Mode Supabase: token diambil dari header `Authorization: Bearer <access_token>`
 *   (klien menyimpan sesi di localStorage, bukan cookie — temuan C-01), dengan fallback cookie.
 *   JWT divalidasi lewat `auth.getUser()`, lalu status approval admin dicek (temuan H-02).
 *
 * Kode error: 401 belum login/sesi tidak valid, 403 akun belum disetujui, 503 Supabase tidak terjangkau.
 */
export async function requireUser(request: NextRequest): Promise<GuardResult> {
  if (!isSupabaseConfigured) {
    return { user: { id: `demo:${clientIp(request)}`, isDemo: true }, error: null };
  }

  try {
    const token = bearerToken(request);

    if (!token) {
      // Fallback: sesi berbasis cookie (@supabase/ssr), bila suatu saat dipakai.
      const supabase = await createServerSupabaseClient();
      const { data } = await supabase.auth.getUser();
      if (!data.user) return fail(401, 'Unauthorized: authentication required.', 'unauthenticated');
      return { user: { id: data.user.id, email: data.user.email }, error: null };
    }

    // Klien yang bertindak sebagai pengguna (RLS memakai JWT-nya).
    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: userData, error: userError } = await supabase.auth.getUser(token);
    if (userError || !userData.user) {
      if (userError && isNetworkError(userError)) {
        console.warn('[auth] Supabase tidak terjangkau:', getErrorMessage(userError));
        return fail(503, 'Authentication service is unreachable.', 'auth_unavailable');
      }
      return fail(401, 'Unauthorized: invalid or expired session.', 'unauthenticated');
    }

    const user = userData.user;
    // select('*'): skema produksi bisa tertinggal migrasi (mis. kolom is_admin belum ada).
    const { data: approval, error: approvalError } = await supabase
      .from('user_approvals')
      .select('*')
      .eq('email', user.email ?? '')
      .maybeSingle();
    if (approvalError) throw approvalError;
    const row = (approval ?? {}) as { approved?: boolean; is_admin?: boolean };
    if (!row.approved && !row.is_admin) {
      return fail(403, 'Forbidden: account is pending administrator approval.', 'not_approved');
    }

    return { user: { id: user.id, email: user.email }, error: null };
  } catch (err) {
    console.warn('[auth] Validasi sesi gagal:', getErrorMessage(err));
    if (isNetworkError(err)) {
      return fail(503, 'Authentication service is unreachable.', 'auth_unavailable');
    }
    return fail(500, 'Account check failed on the server.', 'auth_check_failed');
  }
}
