import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

/**
 * Server-side Supabase client bound to the incoming request's auth cookies.
 *
 * Use this in route handlers / server components / server actions to validate
 * the user's JWT cryptographically (`auth.getUser()`). The browser-oriented
 * client in `supabase.ts` cannot read cookies on the server, so this client is
 * required for any server-side authorization check.
 */
export async function createServerSupabaseClient() {
  const cookieStore = await cookies();
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || '',
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '',
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Called from a Server Component — setAll is a no-op there.
          }
        },
      },
    }
  );
}
