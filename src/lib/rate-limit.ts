import { NextRequest, NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const redisUrl = process.env.UPSTASH_REDIS_REST_URL;
const redisToken = process.env.UPSTASH_REDIS_REST_TOKEN;
const isConfigured = Boolean(redisUrl && redisToken);

// AI / cost-bearing endpoints: 10 requests per hour per identifier (user id or IP)
const aiLimiter = isConfigured
  ? new Ratelimit({
      redis: new Redis({ url: redisUrl!, token: redisToken! }),
      limiter: Ratelimit.slidingWindow(10, '1 h'),
      prefix: 'ratelimit:ai',
      analytics: true,
    })
  : null;

// General API: 100 requests per minute per IP
const ipLimiter = isConfigured
  ? new Ratelimit({
      redis: new Redis({ url: redisUrl!, token: redisToken! }),
      limiter: Ratelimit.slidingWindow(100, '1 m'),
      prefix: 'ratelimit:ip',
      analytics: true,
    })
  : null;

function getClientIp(request: NextRequest): string {
  return (
    request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
    request.headers.get('x-real-ip') ||
    '127.0.0.1'
  );
}

/**
 * Apply rate limiting to an API route handler.
 *
 * - Always enforces a global per-IP limit (100/min) when Upstash is configured.
 * - When `identifier` is provided (e.g. a user id), also enforces an AI
 *   per-identifier limit (10/hour).
 * - When Upstash is not configured (local dev / preview without env), the
 *   function is a no-op so the route still works.
 *
 * Returns a 429 NextResponse when the limit is exceeded, or `null` when the
 * request may proceed.
 */
export async function applyRateLimit(
  request: NextRequest,
  identifier?: string
): Promise<NextResponse | null> {
  if (!isConfigured || !ipLimiter) return null;

  const ip = getClientIp(request);

  const { success: ipOk, reset: ipReset } = await ipLimiter.limit(ip);
  if (!ipOk) {
    return NextResponse.json(
      { error: 'Too many requests. Please slow down.' },
      {
        status: 429,
        headers: {
          'Retry-After': String(Math.ceil((ipReset - Date.now()) / 1000)),
        },
      }
    );
  }

  if (identifier && aiLimiter) {
    const { success, reset } = await aiLimiter.limit(identifier);
    if (!success) {
      return NextResponse.json(
        { error: 'AI request limit reached. Try again later.' },
        {
          status: 429,
          headers: {
            'Retry-After': String(Math.ceil((reset - Date.now()) / 1000)),
          },
        }
      );
    }
  }

  return null;
}
