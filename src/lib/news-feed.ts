/**
 * Pengambilan feed berita Google News RSS (server), dipakai halaman Berita dan Analisis Saham.
 */

import {
  dedupeKey,
  cleanSourceName,
  domainOf,
  extractTickers,
  isVideoItem,
  searchableCompanyName,
  stripSourceSuffix,
  type NewsItem,
} from '@/lib/news';
import { YAHOO_UA } from '@/lib/yahoo';

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

export function parseRss(xmlText: string): NewsItem[] {
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
    const title = stripSourceSuffix(stripSourceSuffix(rawTitle, rawSource), source)
      .replace(/^(foto|video|infografis)\s*:\s*/i, '')
      .replace(/\s+halaman\s+\d+$/i, '');
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

export async function fetchFeed(query: string): Promise<NewsItem[]> {
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
export function newestUnique(items: NewsItem[]): NewsItem[] {
  const sorted = [...items].sort((a, b) => (Date.parse(b.pubDate) || 0) - (Date.parse(a.pubDate) || 0));
  const seen = new Set<string>();
  return sorted.filter((item) => {
    const key = dedupeKey(item.title);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

/**
 * Berita yang benar-benar menyebut saham tertentu: dicari dengan kode ATAU nama emiten,
 * lalu disaring ketat (kode/alias terdeteksi di judul, atau nama emiten tertulis di judul).
 */
export async function fetchTickerNews(tickers: string[]): Promise<NewsItem[]> {
  const names = new Map(tickers.map((t) => [t, searchableCompanyName(t)]));
  const terms = tickers.map((t) => (names.get(t) ? `${t} OR "${names.get(t)}"` : t));
  const items = await fetchFeed(terms.join(' OR '));
  const relevant = items.flatMap((item) => {
    const lower = item.title.toLowerCase();
    const matched = tickers.filter((t) => item.tickers.includes(t) || (names.get(t) && lower.includes(names.get(t)!.toLowerCase())));
    return matched.length > 0 ? [{ ...item, tickers: Array.from(new Set([...matched, ...item.tickers])) }] : [];
  });
  return newestUnique(relevant);
}
