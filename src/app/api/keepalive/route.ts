import { NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';

/**
 * Keepalive endpoint — invoked by Vercel Cron every 6 hours.
 *
 * Supabase free-tier projects auto-pause after 7 days of inactivity.
 * This endpoint pings the database with a trivial query so the project
 * stays "active" and doesn't get paused.
 *
 * Configure the cron schedule in vercel.json:
 *   { "crons": [{ "path": "/api/keepalive", "schedule": "0 0,6,12,18 * * *" }] }
 */

export const dynamic = 'force-dynamic';

export async function GET() {
  // Lightweight query — selects a single row from a system view.
  const { error } = await supabase
    .from('user_approvals')
    .select('id')
    .limit(1);

  if (error) {
    console.error('[keepalive] Supabase ping failed:', error.message);
    return NextResponse.json(
      { ok: false, error: 'Database ping failed', timestamp: new Date().toISOString() },
      { status: 500 }
    );
  }

  return NextResponse.json(
    { ok: true, timestamp: new Date().toISOString() },
    { status: 200 }
  );
}
