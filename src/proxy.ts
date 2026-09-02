import { NextResponse, type NextRequest } from 'next/server';

/**
 * Protect AI/cost-bearing API routes from anonymous abuse.
 *
 * Routes guarded:
 *   - /api/news/summary        (Gemini/Groq/OpenAI summarizer)
 *   - /api/analysis/news       (per-ticker AI sentiment)
 *   - /api/analysis/fundamentals, /api/analysis/technical (optional, off by default)
 *
 * This is a first-line gate: it verifies that a Supabase auth cookie is present.
 * It does NOT cryptographically validate the JWT (that should happen in the route
 * handler via `supabase.auth.getUser()`). Without this gate, anyone with the
 * public anon key (bundled in the client) could hit these endpoints directly and
 * burn the Gemini quota.
 *
 * When Supabase is not configured (NEXT_PUBLIC_SUPABASE_URL unset), the app runs
 * in demo/local mode and we skip the gate so local dev still works.
 */
function isSupabaseConfigured() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  return Boolean(url && !url.includes('placeholder.supabase.co'));
}

function hasSupabaseSession(request: NextRequest): boolean {
  // Supabase stores the auth token in a cookie named `sb-<ref>-auth-token`
  // (and possibly a `.0`/`.1` chunked variant). Match any of them.
  const cookies = request.cookies.getAll();
  return cookies.some((c) => /^sb-[a-z0-9_-]+-auth-token(\.\d+)?$/i.test(c.name));
}

export function proxy(request: NextRequest) {
  // Demo/local mode: no Supabase configured → allow through.
  if (!isSupabaseConfigured()) {
    return NextResponse.next();
  }

  if (!hasSupabaseSession(request)) {
    return NextResponse.json(
      { error: 'Unauthorized: authentication required.' },
      { status: 401 }
    );
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/api/news/summary', '/api/analysis/:path*'],
};
