// Rate limiting example using @upstash/ratelimit + Upstash Redis (Skill 34)
// Install: npm install @upstash/ratelimit @upstash/redis
// Env: UPSTASH_REDIS_REST_URL, UPSTASH_REDIS_REST_TOKEN (Vercel env, server-only)

import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import { NextRequest, NextResponse } from 'next/server';

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

// AI/cost-bearing endpoints: 10 requests per hour per user (or IP for anon)
const aiLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(10, '1 h'),
  prefix: 'ratelimit:ai',
  analytics: true,
});

// General API: 100 requests per minute per IP
const ipLimiter = new Ratelimit({
  redis,
  limiter: Ratelimit.slidingWindow(100, '1 m'),
  prefix: 'ratelimit:ip',
  analytics: true,
});

export async function applyRateLimit(
  request: NextRequest,
  identifier?: string
): Promise<NextResponse | null> {
  const ip =
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1';

  const { success: ipOk, reset: ipReset } = await ipLimiter.limit(ip);
  if (!ipOk) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(Math.ceil((ipReset - Date.now()) / 1000)) } }
    );
  }

  if (identifier) {
    const { success, reset } = await aiLimiter.limit(identifier);
    if (!success) {
      return NextResponse.json(
        { error: 'AI request limit reached. Try again later.' },
        { status: 429, headers: { 'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)) } }
      );
    }
  }

  return null;
}

// Usage in a route handler:
//   import { applyRateLimit } from '@/lib/rate-limit';
//   export async function POST(request: NextRequest) {
//     const limited = await applyRateLimit(request, user?.id || ip);
//     if (limited) return limited;
//     ...
//   }
