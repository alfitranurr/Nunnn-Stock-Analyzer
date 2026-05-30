import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const symbol = searchParams.get('symbol')?.toUpperCase().trim();

  if (!symbol) {
    return NextResponse.json({ error: 'Symbol parameter is required' }, { status: 400 });
  }

  try {
    // Mencari dengan suffix .JK (Jakarta/BEI) di Yahoo Finance search API
    const response = await fetch(
      `https://query1.finance.yahoo.com/v1/finance/search?q=${symbol}.JK`,
      {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        next: { revalidate: 86400 } // Cache hasil pencarian di server selama 24 jam untuk kecepatan
      }
    );

    if (!response.ok) {
      throw new Error('Failed to fetch from Yahoo Finance');
    }

    const data = await response.json();
    const quote = data.quotes?.[0];

    if (quote) {
      // Mengambil longname atau shortname dan merapikan teksnya
      let name = quote.longname || quote.shortname || '';
      
      // Rapikan teks kapitalisasi dari Yahoo (contoh: ANEKA TAMBANG -> Aneka Tambang Tbk)
      if (name) {
        // Hapus suffix ".JK" jika terbawa
        name = name.replace(/\.JK/gi, '');
        // Hapus teks berlebih yang kurang estetik
        name = name.replace(/Persero/gi, '').replace(/  +/g, ' ').trim();
      }

      return NextResponse.json({ symbol, name });
    }

    return NextResponse.json({ symbol, name: '' });
  } catch (error: any) {
    console.error('Error fetching ticker name from internet:', error.message);
    return NextResponse.json({ error: 'Failed to fetch ticker name' }, { status: 500 });
  }
}
