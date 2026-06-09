import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (q) {
    try {
      const response = await fetch(
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20`,
        {
          headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
          }
        }
      );

      if (!response.ok) {
        return NextResponse.json({ quotes: [] });
      }

      const data = await response.json();
      const rawQuotes = data.quotes || [];

      // Filter only Indonesian stocks (.JK or JKT exchange or exchDisp Jakarta)
      const filtered = rawQuotes
        .filter((quote: any) => {
          const sym = (quote.symbol || '').toUpperCase();
          const exch = (quote.exchange || '').toUpperCase();
          const disp = (quote.exchDisp || '').toUpperCase();
          return sym.endsWith('.JK') || exch === 'JKT' || disp === 'JAKARTA';
        })
        .map((quote: any) => {
          const cleanSymbol = quote.symbol.replace(/\.JK$/i, '').toUpperCase();
          let name = quote.longname || quote.shortname || cleanSymbol;
          name = name.replace(/\.JK/gi, '');
          name = name.replace(/^(PT\.?\s+)/i, ''); // Hapus awalan PT
          name = name.replace(/Persero/gi, '').replace(/  +/g, ' ').trim();
          
          return {
            symbol: cleanSymbol,
            name: name
          };
        });

      return NextResponse.json({ quotes: filtered });
    } catch (err: any) {
      console.error('Error in ticker search:', err.message);
      return NextResponse.json({ error: 'Search failed' }, { status: 500 });
    }
  }

  const symbol = searchParams.get('symbol')?.toUpperCase().trim();

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol or q parameter is required' }, { status: 400 });
  }

  try {
    // Mengambil data chart (termasuk harga real-time dan nama) dari Yahoo Finance
    const response = await fetch(
      `https://query1.finance.yahoo.com/v8/finance/chart/${symbol}.JK`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        cache: 'no-store' // Jangan di-cache agar harga selalu real-time
      }
    );

    if (!response.ok) {
      return NextResponse.json({ symbol, name: '', price: null });
    }

    const data = await response.json();
    const meta = data.chart?.result?.[0]?.meta;

    if (meta) {
      let name = meta.longName || meta.shortName || '';
      const price = meta.regularMarketPrice || null;
      
      // Rapikan nama perusahaan
      if (name) {
        name = name.replace(/\.JK/gi, '');
        name = name.replace(/^(PT\.?\s+)/i, ''); // Hapus awalan PT
        name = name.replace(/Persero/gi, '').replace(/  +/g, ' ').trim();
      }

      return NextResponse.json({ symbol, name, price });
    }

    return NextResponse.json({ symbol, name: '', price: null });
  } catch (error: any) {
    console.error('Error fetching ticker data from internet:', error.message);
    return NextResponse.json({ error: 'Failed to fetch ticker data' }, { status: 500 });
  }
}
