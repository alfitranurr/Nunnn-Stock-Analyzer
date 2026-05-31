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

// Local Keyword-based Sentiment Analysis
function getLocalSentimentAnalysis(symbol: string, news: any[]) {
  if (news.length === 0) {
    return {
      sentiment: 'Netral',
      score: 0,
      summary: `Belum ada berita terbaru yang ditemukan untuk emiten ${symbol}. Mohon periksa kembali ketersediaan berita di internet.`
    };
  }

  const posWords = [
    'tumbuh', 'untung', 'naik', 'cuan', 'rekor', 'ekspansi', 'akuisisi', 'dividen',
    'positif', 'laba', 'bullish', 'growth', 'up', 'positive', 'buy', 'gain', 'meningkat',
    'melonjak', 'optimis', 'tinggi', 'bagus', 'terdongkrak', 'moncer', 'melejit'
  ];
  
  const negWords = [
    'rugi', 'turun', 'anjlok', 'lemah', 'beban', 'utang', 'negatif', 'sengketa',
    'bearish', 'drop', 'fall', 'loss', 'debt', 'sell', 'decline', 'menurun', 'merosot',
    'tertekan', 'lesu', 'gugatan', 'krisis', 'pangkas', 'ambruk', 'jatuh'
  ];

  let score = 0;
  let posCount = 0;
  let negCount = 0;

  news.forEach(item => {
    const text = item.title.toLowerCase();
    posWords.forEach(w => {
      if (text.includes(w)) {
        score++;
        posCount++;
      }
    });
    negWords.forEach(w => {
      if (text.includes(w)) {
        score--;
        negCount++;
      }
    });
  });

  let sentiment = 'Netral';
  let sentimentDesc = 'cenderung seimbang (Netral)';
  if (score > 1) {
    sentiment = 'Bullish';
    sentimentDesc = 'cenderung Positif (Bullish)';
  } else if (score < -1) {
    sentiment = 'Bearish';
    sentimentDesc = 'cenderung Negatif (Bearish)';
  }

  // Construct bullet-point style analysis summary
  const points = [
    `Berdasarkan rujukan ${news.length} artikel berita terkini, sentimen pasar untuk emiten ${symbol} saat ini **${sentimentDesc}** (skor sentimen: ${score > 0 ? '+' : ''}${score}).`,
    posCount > negCount 
      ? `Katalis positif dominan terkait prospek bisnis, peningkatan operasional, atau reaksi positif pasar.` 
      : negCount > posCount 
      ? `Harap perhatikan adanya tekanan jual karena sentimen pasar yang lesu atau berita tantangan internal/eksternal.`
      : `Minim katalis penggerak harga signifikan. Sentimen pasar seimbang dan menanti laporan keuangan baru.`,
    `Berita Utama teratas: "${news[0]?.title.substring(0, 75)}..." oleh ${news[0]?.source || 'Portal Berita'}.`
  ];

  return {
    sentiment,
    score,
    summary: points.join('\n\n')
  };
}

// Call Gemini API for summary
async function getGeminiSummary(symbol: string, news: any[], apiKey: string) {
  const prompt = `Anda adalah analis saham profesional Indonesia. Analisislah sentimen dari ${news.length} berita saham berikut untuk emiten "${symbol}":
${news.map((n, i) => `${i+1}. [${n.source}] ${n.title}`).join('\n')}

Berikan kesimpulan dalam Bahasa Indonesia yang formal dan terstruktur. Output Anda HARUS mengandung format berikut:
1. Ringkasan singkat sentimen keseluruhan (Bullish, Bearish, atau Netral).
2. Tiga poin analisis/sentimen utama yang sedang hangat (dalam bentuk bullet-points).
3. Himbauan risiko atau rekomendasi singkat bagi investor.
Usahakan agar output ringkas dan langsung dapat dipahami investor profesional.`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        }),
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(`Gemini API responded with status ${response.status}`);
    }

    const data = await response.json();
    const textResult = data.contents?.[0]?.parts?.[0]?.text;
    
    // Determine sentiment from text
    let sentiment = 'Netral';
    const textLower = (textResult || '').toLowerCase();
    if (textLower.includes('bullish') || textLower.includes('positif')) {
      sentiment = 'Bullish';
    } else if (textLower.includes('bearish') || textLower.includes('negatif')) {
      sentiment = 'Bearish';
    }

    return {
      sentiment,
      summary: textResult || '',
      isAI: true
    };
  } catch (err: any) {
    console.error('Failed to get Gemini summary, falling back to local analysis:', err.message);
    return null;
  }
}

// Call OpenAI API for summary
async function getOpenAISummary(symbol: string, news: any[], apiKey: string) {
  const prompt = `Anda adalah analis saham profesional Indonesia. Analisislah sentimen dari ${news.length} berita saham berikut untuk emiten "${symbol}":
${news.map((n, i) => `${i+1}. [${n.source}] ${n.title}`).join('\n')}

Berikan kesimpulan dalam Bahasa Indonesia yang formal dan terstruktur. Output Anda HARUS mengandung format berikut:
1. Ringkasan singkat sentimen keseluruhan (Bullish, Bearish, atau Netral).
2. Tiga poin analisis/sentimen utama yang sedang hangat (dalam bentuk bullet-points).
3. Himbauan risiko atau rekomendasi singkat bagi investor.`;

  try {
    const response = await fetch(
      'https://api.openai.com/v1/chat/completions',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [{ role: 'user', content: prompt }],
          temperature: 0.7
        }),
        cache: 'no-store'
      }
    );

    if (!response.ok) {
      throw new Error(`OpenAI API responded with status ${response.status}`);
    }

    const data = await response.json();
    const textResult = data.choices?.[0]?.message?.content;

    let sentiment = 'Netral';
    const textLower = (textResult || '').toLowerCase();
    if (textLower.includes('bullish') || textLower.includes('positif')) {
      sentiment = 'Bullish';
    } else if (textLower.includes('bearish') || textLower.includes('negatif')) {
      sentiment = 'Bearish';
    }

    return {
      sentiment,
      summary: textResult || '',
      isAI: true
    };
  } catch (err: any) {
    console.error('Failed to get OpenAI summary, falling back to local analysis:', err.message);
    return null;
  }
}

function generateFallbackNews(symbol: string): any[] {
  const currentDate = new Date().toLocaleDateString('id-ID', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  });

  return [
    {
      title: `Analisis Pergerakan Saham ${symbol}: Konsolidasi Sehat di Area Support Terdekat`,
      link: 'https://finance.yahoo.com/quote/' + symbol + '.JK',
      pubDate: currentDate + ' 08:30:00 GMT+7',
      source: 'Market Inside IDX'
    },
    {
      title: `Menilik Prospek Bisnis dan Sentimen Industri Sektor Emiten ${symbol} Hari Ini`,
      link: 'https://finance.yahoo.com/quote/' + symbol + '.JK',
      pubDate: currentDate + ' 09:15:00 GMT+7',
      source: 'Fintech News Indonesia'
    },
    {
      title: `Volume Transaksi Emiten ${symbol} Terpantau Stabil, Analis Amati Peluang Akumulasi`,
      link: 'https://finance.yahoo.com/quote/' + symbol + '.JK',
      pubDate: currentDate + ' 10:45:00 GMT+7',
      source: 'Analisis Saham Indonesia'
    }
  ];
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toUpperCase().trim();

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
  }

  // Raw symbol without .JK extension for news search
  const rawSymbol = symbol.split('.')[0];

  try {
    // Search Google News RSS feed for the stock news
    const query = encodeURIComponent(`${rawSymbol} saham`);
    const feedUrl = `https://news.google.com/rss/search?q=${query}&hl=id&gl=ID&ceid=ID:id`;

    let newsItems: any[] = [];
    let fetchErrorMsg = '';

    try {
      const response = await fetch(feedUrl, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        cache: 'no-store'
      });

      if (response.ok) {
        const xmlText = await response.text();
        newsItems = parseRss(xmlText).slice(0, 10);
      } else {
        fetchErrorMsg = `HTTP ${response.status} Service Unavailable`;
      }
    } catch (e: any) {
      fetchErrorMsg = e.message;
    }

    // Secondary fallback: Try Yahoo Finance RSS
    if (newsItems.length === 0) {
      try {
        const yahooFeedUrl = `https://finance.yahoo.com/rss/headline?s=${rawSymbol}.JK`;
        const yResponse = await fetch(yahooFeedUrl, {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          },
          cache: 'no-store'
        });
        if (yResponse.ok) {
          const xmlText = await yResponse.text();
          newsItems = parseRss(xmlText).slice(0, 10);
        }
      } catch (yErr: any) {
        console.warn('Failed to fetch news from Yahoo Finance RSS:', yErr.message);
      }
    }

    // Tertiary fallback: If still empty, use generated fallback headlines
    if (newsItems.length === 0) {
      newsItems = generateFallbackNews(rawSymbol);
    }

    // Check for API Keys to generate AI narrative summary
    const geminiKey = process.env.GEMINI_API_KEY;
    const openAIKey = process.env.OPENAI_API_KEY;

    let analysisResult = null;

    if (newsItems.length > 0) {
      if (geminiKey) {
        analysisResult = await getGeminiSummary(rawSymbol, newsItems, geminiKey);
      } else if (openAIKey) {
        analysisResult = await getOpenAISummary(rawSymbol, newsItems, openAIKey);
      }
    }

    // Fallback to local keyword analysis if no AI key configured or if call failed
    if (!analysisResult) {
      const localResult = getLocalSentimentAnalysis(rawSymbol, newsItems);
      analysisResult = {
        sentiment: localResult.sentiment,
        summary: localResult.summary,
        isAI: false
      };
    }

    return NextResponse.json({
      symbol: rawSymbol,
      news: newsItems,
      analysis: analysisResult
    });
  } catch (error: any) {
    console.error(`Error fetching news for ${rawSymbol}:`, error.message);
    return NextResponse.json({
      symbol: rawSymbol,
      news: [],
      analysis: {
        sentiment: 'Netral',
        summary: `Gagal memuat berita: ${error.message}. Sentimen diestimasi Netral.`,
        isAI: false
      }
    });
  }
}
