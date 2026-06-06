import { NextRequest, NextResponse } from 'next/server';

function cleanXmlString(str: string) {
  return str
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .trim();
}

function parseRss(xmlText: string) {
  const items: any[] = [];
  let match;
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;

  while ((match = itemRegex.exec(xmlText)) !== null) {
    const itemContent = match[1];
    
    const titleMatch = itemContent.match(/<title>([\s\S]*?)<\/title>/);
    const linkMatch = itemContent.match(/<link>([\s\S]*?)<\/link>/);
    const pubDateMatch = itemContent.match(/<pubDate>([\s\S]*?)<\/pubDate>/);
    const sourceMatch = itemContent.match(/<source[^>]*>([\s\S]*?)<\/source>/);

    const title = titleMatch ? cleanXmlString(titleMatch[1]) : '';
    const link = linkMatch ? cleanXmlString(linkMatch[1]) : '';
    const pubDate = pubDateMatch ? cleanXmlString(pubDateMatch[1]) : '';
    const source = sourceMatch ? cleanXmlString(sourceMatch[1]) : '';

    if (title && link) {
      items.push({
        title,
        link,
        pubDate,
        source
      });
    }
  }

  return items;
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const category = searchParams.get('category')?.toLowerCase().trim() || 'saham';
  const q = searchParams.get('q')?.trim();

  let query = '';

  if (q) {
    query = `${q}`;
  } else {
    if (category === 'domestik') {
      query = 'ekonomi indonesia OR inflasi indonesia OR APBN';
    } else if (category === 'foreign') {
      query = 'saham global OR Wall Street OR Nasdaq OR NYSE OR saham AS OR bursa AS OR Dow Jones OR S&P 500';
    } else if (category === 'global') {
      query = 'ekonomi global OR global economy OR federal reserve OR bursa saham global';
    } else if (category === 'politik') {
      query = 'politik indonesia OR pilkada OR DPR OR kebijakan pemerintah OR pemilu indonesia';
    } else {
      // Default: saham
      query = 'saham indonesia OR IHSG OR emiten';
    }
  }

  const encodedQuery = encodeURIComponent(query);
  const feedUrl = `https://news.google.com/rss/search?q=${encodedQuery}&hl=id&gl=ID&ceid=ID:id`;

  try {
    const response = await fetch(feedUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, bg-slug) Chrome/120.0.0.0 Safari/537.36'
      },
      cache: 'no-store' // Always get fresh real-time news
    });

    if (!response.ok) {
      throw new Error(`Google News RSS responded with status ${response.status}`);
    }

    const xmlText = await response.text();
    const newsItems = parseRss(xmlText).slice(0, 15);

    return NextResponse.json({ news: newsItems });
  } catch (error: any) {
    console.error(`Error fetching news feed:`, error.message);
    return NextResponse.json({
      news: [],
      error: error.message
    });
  }
}
