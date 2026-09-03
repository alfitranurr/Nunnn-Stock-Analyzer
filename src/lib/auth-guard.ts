import { NextResponse } from 'next/server';
import { createServerSupabaseClient } from './supabase-server';

/**
 * Cryptographically validate the Supabase JWT carried by the request and return
 * the authenticated user, or a 401 NextResponse when the caller is anonymous /
 * has an invalid / expired session.
 *
 * Use this inside route handlers that are behind the proxy gate so that a
 * proxy-bypass CVE (e.g. GHSA-6gpp-xcg3-4w24) or a forged cookie cannot reach
 * cost-bearing / mutating logic.
 */
export async function requireUser():
  Promise<{ user: { id: string; email?: string } | null; error: NextResponse | null }> {
  const supabase = await createServerSupabaseClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return {
      user: null,
      error: NextResponse.json(
        { error: 'Unauthorized: authentication required.' },
        { status: 401 }
      ),
    };
  }

  return { user, error: null };
}
