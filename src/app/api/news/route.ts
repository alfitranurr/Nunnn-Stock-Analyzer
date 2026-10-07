import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/utils';
import { applyRateLimit } from '@/lib/rate-limit';
import { validateTickerSymbol } from '@/lib/validators';
import { YAHOO_UA, createTtlCache } from '@/lib/yahoo';
import {
  CATEGORY_QUERIES,
  MIN_TRUSTED_ITEMS,
  NEWS_CATEGORIES,
  cleanSourceName,
  dedupeKey,
  domainOf,
  extractTickers,
  isTrustedDomain,
  isVideoItem,
  searchableCompanyName,
  stripSourceSuffix,
  type NewsCategory,
  type NewsItem,
} from '@/lib/news';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 40;
const MAX_QUERY_LENGTH = 100;
const MAX_TICKERS = 20;

// Kategori lama (sebelum kurasi) tetap diterima agar tautan/klien lama tidak rusak.
const LEGACY_CATEGORY: Record<string, NewsCategory> = { foreign: 'global', domestik: 'makro', politik: 'makro' };

const feedCache = createTtlCache<{ news: NewsItem[]; filteredUntrusted: number }>(5 * 60_000, 100);

function decodeXml(str: string) {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseRss(xmlText: string): NewsItem[] {
  const items: NewsItem[] = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match: RegExpExecArray | null;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const content = match[1];
    const rawTitle = decodeXml(content.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? '');
    const link = decodeXml(content.match(/<link>([\s\S]*?)<\/link>/)?.[1] ?? '');
    const pubDateRaw = decodeXml(content.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1] ?? '');
    const sourceMatch = content.match(/<source(?:\s+url="([^"]*)")?[^>]*>([\s\S]*?)<\/source>/);
    const sourceDomain = domainOf(sourceMatch?.[1] ? decodeXml(sourceMatch[1]) : null);
    const rawSource = sourceMatch ? decodeXml(sourceMatch[2]) : '';
    if (!rawTitle || !link || isVideoItem(rawTitle, sourceDomain)) continue;

    const source = cleanSourceName(rawSource, sourceDomain);
    const title = stripSourceSuffix(stripSourceSuffix(rawTitle, rawSource), source);
    const time = Date.parse(pubDateRaw);

    items.push({
      id: link,
      title,
      link,
      pubDate: Number.isFinite(time) ? new Date(time).toISOString() : '',
      source,
      sourceDomain,
      tickers: extractTickers(title),
    });
  }
  return items;
}

async function fetchFeed(query: string): Promise<NewsItem[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(`${query} when:7d`)}&hl=id&gl=ID&ceid=ID:id`;
  const res = await fetch(url, {
    headers: { 'User-Agent': YAHOO_UA },
    cache: 'no-store',
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Google News RSS responded with status ${res.status}`);
  return parseRss(await res.text());
}

/** Urutkan terbaru dulu dan buang berita yang sama dari media lain. */
function newestUnique(items: NewsItem[]): NewsItem[] {
  const sorted = [...items].sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  const seen = new Set<string>();
  return sorted.filter((item) => {
    const key = dedupeKey(item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export async function GET(request: NextRequest) {
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const params = request.nextUrl.searchParams;
  const q = (params.get('q') ?? '').replace(/\s+/g, ' ').trim();
  if (q.length > MAX_QUERY_LENGTH) {
    return NextResponse.json({ error: `Query too long (max ${MAX_QUERY_LENGTH} characters)` }, { status: 400 });
  }

  const tickers = Array.from(
    new Set(
      (params.get('tickers') ?? '')
        .split(',')
        .map((t) => validateTickerSymbol(t.trim())?.replace(/\.JK$/i, ''))
        .filter((t): t is string => Boolean(t))
    )
  ).slice(0, MAX_TICKERS);

  const rawCategory = (params.get('category') ?? 'saham').toLowerCase().trim();
  const category: NewsCategory = LEGACY_CATEGORY[rawCategory]
    ?? (NEWS_CATEGORIES.includes(rawCategory as NewsCategory) ? (rawCategory as NewsCategory) : 'saham');

  const mode = q ? 'search' : tickers.length > 0 ? 'tickers' : 'category';
  const cacheKey = mode === 'search' ? `q:${q.toLowerCase()}` : mode === 'tickers' ? `t:${[...tickers].sort().join(',')}` : `c:${category}`;

  try {
    const { value } = await feedCache(cacheKey, async () => {
      if (mode === 'search') {
        return { news: newestUnique(await fetchFeed(q)).slice(0, MAX_ITEMS), filteredUntrusted: 0 };
      }

      if (mode === 'tickers') {
        // Kode saham ATAU nama emiten, lalu disaring ketat agar hanya berita yang benar-benar menyebutnya.
        const names = new Map(tickers.map((t) => [t, searchableCompanyName(t)]));
        const terms = tickers.map((t) => (names.get(t) ? `${t} OR "${names.get(t)}"` : t));
        const items = await fetchFeed(terms.join(' OR '));
        const relevant = items.flatMap((item) => {
          const lower = item.title.toLowerCase();
          const matched = tickers.filter((t) => item.tickers.includes(t) || (names.get(t) && lower.includes(names.get(t)!.toLowerCase())));
          return matched.length > 0 ? [{ ...item, tickers: Array.from(new Set([...matched, ...item.tickers])) }] : [];
        });
        return { news: newestUnique(relevant).slice(0, MAX_ITEMS), filteredUntrusted: 0 };
      }

      const unique = newestUnique(await fetchFeed(CATEGORY_QUERIES[category]));
      const trusted = unique.filter((item) => isTrustedDomain(item.sourceDomain));
      // Saring media di luar daftar hanya bila berita dari media kredibel sudah cukup.
      const news = trusted.length >= MIN_TRUSTED_ITEMS ? trusted : unique;
      return { news: news.slice(0, MAX_ITEMS), filteredUntrusted: unique.length - news.length };
    });

    return NextResponse.json({ ...value, mode, category: mode === 'category' ? category : null });
  } catch (error: unknown) {
    console.error('Error fetching news feed:', getErrorMessage(error));
    return NextResponse.json({ news: [], error: 'Failed to fetch news feed' }, { status: 502 });
  }
}
