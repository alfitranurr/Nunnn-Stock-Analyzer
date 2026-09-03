// SSRF fix example for POST /api/news/summary (Skill 29 remediation)
// Drop-in replacement for the link-fetch validation block.

import { NextResponse, type NextRequest } from 'next/server';

const ALLOWED_HOSTS = new Set([
  'news.google.com',
  'finance.yahoo.com',
  'www.google.com',
]);

function isPrivateIp(host: string): boolean {
  const parts = host.split('.').map(Number);
  if (parts.length === 4 && parts.every((n) => n >= 0 && n <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
  }
  return false;
}

export async function safeFetchArticleText(
  rawLink: string
): Promise<string | null> {
  let url: URL;
  try {
    url = new URL(rawLink);
  } catch {
    return null;
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
  if (!ALLOWED_HOSTS.has(url.hostname)) return null;
  if (isPrivateIp(url.hostname)) return null;

  try {
    const res = await fetch(url.toString(), {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
      signal: AbortSignal.timeout(6000),
      redirect: 'manual', // don't follow redirects; validate each hop
    });
    if (!res.ok) return null;
    const html = await res.text();
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<\/p>|<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/  +/g, ' ');
    text = text.replace(/\n\s*\n+/g, '\n\n');
    return text.substring(0, 6000).trim();
  } catch {
    return null;
  }
}

// Usage in POST handler:
//   if (link && link.startsWith('http')) {
//     const content = await safeFetchArticleText(resolvedUrl || link);
//     ...
//   }
