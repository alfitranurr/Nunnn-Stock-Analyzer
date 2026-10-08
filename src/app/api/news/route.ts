import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/utils';
import { applyRateLimit } from '@/lib/rate-limit';
import { validateTickerSymbol } from '@/lib/validators';
import { createTtlCache } from '@/lib/yahoo';
import { CATEGORY_QUERIES, MIN_TRUSTED_ITEMS, NEWS_CATEGORIES, isTrustedDomain, type NewsCategory, type NewsItem } from '@/lib/news';
import { fetchFeed, fetchTickerNews, newestUnique } from '@/lib/news-feed';

export const dynamic = 'force-dynamic';

const MAX_ITEMS = 40;
const MAX_QUERY_LENGTH = 100;
const MAX_TICKERS = 20;

// Kategori lama (sebelum kurasi) tetap diterima agar tautan/klien lama tidak rusak.
const LEGACY_CATEGORY: Record<string, NewsCategory> = { foreign: 'global', domestik: 'makro', politik: 'makro' };

const feedCache = createTtlCache<{ news: NewsItem[]; filteredUntrusted: number }>(5 * 60_000, 100);

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
        return { news: (await fetchTickerNews(tickers)).slice(0, MAX_ITEMS), filteredUntrusted: 0 };
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
