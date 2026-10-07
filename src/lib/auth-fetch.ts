'use client';

import { isSupabaseConfigured, supabase } from '@/lib/supabase';

/**
 * fetch() yang menyertakan token sesi Supabase sebagai `Authorization: Bearer`.
 * Sesi disimpan supabase-js di localStorage (bukan cookie), jadi route terproteksi
 * hanya bisa memvalidasi pengguna lewat header ini.
 */
export async function authFetch(input: string, init: RequestInit = {}): Promise<Response> {
  const headers = new Headers(init.headers);
  if (isSupabaseConfigured && !headers.has('Authorization')) {
    try {
      const { data } = await supabase.auth.getSession();
      const token = data.session?.access_token;
      if (token) headers.set('Authorization', `Bearer ${token}`);
    } catch {
      // Tanpa token: server akan membalas 401 dan UI menampilkan pesan login.
    }
  }
  return fetch(input, { ...init, headers });
}

export type ApiErrorKind = 'unauthenticated' | 'not_approved' | 'rate_limited' | 'auth_unavailable' | 'auth_check_failed' | 'failed';

/** Klasifikasikan respons gagal dari route terproteksi agar UI bisa memberi pesan yang tepat. */
export async function classifyApiError(res: Response): Promise<{ kind: ApiErrorKind; retryAfterSec: number | null }> {
  const retry = Number(res.headers.get('Retry-After'));
  const retryAfterSec = Number.isFinite(retry) && retry > 0 ? retry : null;
  let code: string | undefined;
  try {
    code = ((await res.clone().json()) as { code?: string }).code;
  } catch {
    // Body bukan JSON
  }
  if (res.status === 401) return { kind: 'unauthenticated', retryAfterSec };
  if (res.status === 403) return { kind: code === 'not_approved' ? 'not_approved' : 'failed', retryAfterSec };
  if (res.status === 429) return { kind: 'rate_limited', retryAfterSec };
  if (res.status === 503) return { kind: 'auth_unavailable', retryAfterSec };
  if (code === 'auth_check_failed') return { kind: 'auth_check_failed', retryAfterSec };
  return { kind: 'failed', retryAfterSec };
}
