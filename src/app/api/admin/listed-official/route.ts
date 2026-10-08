import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/auth-guard';
import { applyRateLimit } from '@/lib/rate-limit';
import { SUPABASE_ANON_KEY, SUPABASE_URL, isSupabaseConfigured } from '@/lib/supabase-config';
import { OFFICIAL_SETTING_KEY } from '@/lib/listing-coverage';
import { clearAllServerCaches } from '@/lib/yahoo';
import { markDataRefreshed } from '@/lib/refresh-generation';
import { getErrorMessage } from '@/lib/utils';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * POST /api/admin/listed-official {count, asOf, source} — simpan jumlah emiten resmi BEI (admin).
 * Ditulis lewat RPC `admin_set_app_setting` dengan JWT admin (RLS), lalu semua cache disegarkan.
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
  if (!isSupabaseConfigured) {
    return NextResponse.json({ error: 'Supabase is not configured', code: 'no_database' }, { status: 501 });
  }

  let body: { count?: unknown; asOf?: unknown; source?: unknown };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body', code: 'invalid_body' }, { status: 400 });
  }
  const count = Number(body.count);
  const asOf = typeof body.asOf === 'string' ? body.asOf : '';
  const source = typeof body.source === 'string' ? body.source.trim().slice(0, 120) : '';
  if (!Number.isInteger(count) || count < 100 || count > 5000) {
    return NextResponse.json({ error: 'count must be an integer between 100 and 5000', code: 'invalid_count' }, { status: 400 });
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(asOf) || Number.isNaN(Date.parse(asOf))) {
    return NextResponse.json({ error: 'asOf must be YYYY-MM-DD', code: 'invalid_date' }, { status: 400 });
  }

  const token = request.headers.get('authorization')?.match(/^Bearer\s+(.+)$/i)?.[1]?.trim();
  if (!token) return NextResponse.json({ error: 'Bearer token required', code: 'unauthenticated' }, { status: 401 });

  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { error: rpcError } = await supabase.rpc('admin_set_app_setting', {
    p_key: OFFICIAL_SETTING_KEY,
    p_value: { count, asOf, source: source || 'Admin' },
  });
  if (rpcError) {
    console.error('[listed-official]', getErrorMessage(rpcError));
    // PGRST202 / 42883: fungsi belum ada → migrasi 000011 belum dijalankan.
    const missing = rpcError.code === 'PGRST202' || rpcError.code === '42883' || /admin_set_app_setting/.test(rpcError.message);
    return NextResponse.json(
      { error: missing ? 'Run migration 20261008000011_app_settings.sql first' : rpcError.message, code: missing ? 'migration_missing' : 'save_failed' },
      { status: missing ? 503 : 500 }
    );
  }

  await markDataRefreshed();
  clearAllServerCaches();
  return NextResponse.json({ ok: true, official: { count, asOf, source: source || 'Admin', origin: 'admin' } });
}
