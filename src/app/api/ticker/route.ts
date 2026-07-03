import { NextRequest, NextResponse } from 'next/server';
import { cleanCompanyName } from '@/lib/utils';

// Dictionary data emiten BEI populer untuk pencarian lokal instan & presisi
const LOCAL_IDX_DICTIONARY: Record<string, string> = {
  'BELL': 'Trisula Textile Industries Tbk',
  'BBCA': 'Bank Central Asia Tbk',
  'BBRI': 'Bank Rakyat Indonesia Tbk',
  'BMRI': 'Bank Mandiri (Persero) Tbk',
  'TLKM': 'Telkom Indonesia (Persero) Tbk',
  'GOTO': 'GoTo Gojek Tokopedia Tbk',
  'ASII': 'Astra International Tbk',
  'ADRO': 'Adaro Energy Indonesia Tbk',
  'PTBA': 'Bukit Asam Tbk',
  'ITMG': 'Indo Tambangraya Megah Tbk',
  'UNVR': 'Unilever Indonesia Tbk',
  'SIDO': 'Industri Jamu Dan Farmasi Sido Muncul Tbk',
  'PGAS': 'Perusahaan Gas Negara Tbk',
  'ANTM': 'Aneka Tambang Tbk',
  'BBNI': 'Bank Negara Indonesia Tbk',
  'AUTO': 'Astra Otoparts Tbk',
  'BDMN': 'Bank Danamon Indonesia Tbk',
  'BINO': 'Perma Plasindo Tbk',
  'BTPS': 'Bank BTPN Syariah Tbk',
  'BSSR': 'Baramulti Suksessarana Tbk',
  'CLEO': 'Sariguna Primatirta Tbk',
  'CTRA': 'Ciputra Development Tbk',
  'DMAS': 'Puradelta Lestari Tbk',
  'DRMA': 'Dharma Polimetal Tbk',
  'DOID': 'Delta Dunia Makmur Tbk',
  'FILM': 'MD Pictures Tbk',
  'HEAL': 'Medikaloka Hermina Tbk',
  'HRUM': 'Harum Energy Tbk',
  'INDF': 'Indofood Sukses Makmur Tbk',
  'INKP': 'Indah Kiat Pulp & Paper Tbk',
  'JPFA': 'Japfa Comfeed Indonesia Tbk',
  'MARK': 'Mark Dynamics Indonesia Tbk',
  'MEDC': 'Medco Energi Internasional Tbk',
  'MAPI': 'Mitra Adiperkasa Tbk',
  'MPMX': 'Mitra Pinasthika Mustika Tbk',
  'MYOR': 'Mayora Indah Tbk',
  'PWON': 'Pakuwon Jati Tbk',
  'SMRA': 'Summarecon Agung Tbk',
  'SMSM': 'Selamat Sempurna Tbk',
  'SRTG': 'Saratoga Investama Sedaya Tbk',
  'TAPG': 'Triputra Agro Persada Tbk',
  'TPIA': 'Chandra Asri Pacific Tbk',
  'UNTR': 'United Tractors Tbk',
  'ACES': 'Aspirasi Hidup Indonesia Tbk',
  'AKRA': 'AKR Corporindo Tbk',
  'AMMN': 'Amman Mineral Internasional Tbk',
  'BRPT': 'Barito Pacific Tbk',
  'CPIN': 'Charoen Pokphand Indonesia Tbk',
  'EMTK': 'Elang Mahkota Teknologi Tbk',
  'EXCL': 'XL Axiata Tbk',
  'GGRM': 'Gudang Garam Tbk',
  'HMSP': 'H.M. Sampoerna Tbk',
  'ICBP': 'Indofood CBP Sukses Makmur Tbk',
  'MBMA': 'Merdeka Battery Materials Tbk',
  'MDKA': 'Merdeka Copper Gold Tbk',
  'MIKA': 'Mitra Keluarga Karyasehat Tbk',
  'MNCN': 'Media Nusantara Citra Tbk',
  'SCMA': 'Surya Citra Media Tbk',
  'TBIG': 'Tower Bersama Infrastructure Tbk',
  'TOWR': 'Sarana Menara Nusantara Tbk',
  'BUMI': 'Bumi Resources Tbk',
  'NSSI': 'Nusantara Sejahtera Raya Tbk',
  'NICL': 'Mineral Sumberdaya Mandiri Tbk',
  'NCKL': 'Trimegah Bangun Persada Tbk',
  'MBSS': 'Mitrabahtera Suksesjaya Tbk',
  'PANS': 'Panin Sekuritas Tbk',
  'TOTL': 'Total Bangun Persada Tbk',
  'KLBF': 'Kalbe Farma Tbk',
  'BRIS': 'Bank Syariah Indonesia Tbk',
  'AMRT': 'Sumber Alfaria Trijaya Tbk',
  'ISAT': 'Indosat Ooredoo Hutchison Tbk',
  'INTP': 'Indocement Tunggal Prakarsa Tbk',
  'SMGR': 'Semen Indonesia (Persero) Tbk',
  'BSDE': 'Bumi Serpong Damai Tbk',
  'MEDS': 'Minna Padi Investama Sekuritas Tbk',
  'BSIM': 'Bank Sinarmas Tbk',
  'BBYB': 'Bank Neo Commerce Tbk',
  'ARTO': 'Bank Jago Tbk',
  'BBTN': 'Bank Tabungan Negara (Persero) Tbk',
  'BJBR': 'Bank Pembangunan Daerah Jawa Barat dan Banten Tbk',
  'BJTM': 'Bank Pembangunan Daerah Jawa Timur Tbk'
};

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get('q')?.trim();

  if (q) {
    try {
      const cleanQ = q.toUpperCase();
      const resultsMap = new Map<string, { symbol: string; name: string }>();

      // 1. Cek Dictionary Lokal BEI dulu untuk pencarian instan
      Object.entries(LOCAL_IDX_DICTIONARY).forEach(([sym, name]) => {
        if (sym.includes(cleanQ) || name.toUpperCase().includes(cleanQ)) {
          resultsMap.set(sym, { symbol: sym, name: cleanCompanyName(name) });
        }
      });

      // 2. Query Yahoo Finance Search API dengan q dan q.JK
      const searchUrls = [
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q)}&quotesCount=20`,
        `https://query1.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(q + '.JK')}&quotesCount=20`
      ];

      for (const url of searchUrls) {
        try {
          const res = await fetch(url, {
            headers: {
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
            }
          });
          if (res.ok) {
            const data = await res.json();
            const rawQuotes = data.quotes || [];
            rawQuotes.forEach((quote: any) => {
              const sym = (quote.symbol || '').toUpperCase();
              const exch = (quote.exchange || '').toUpperCase();
              const disp = (quote.exchDisp || '').toUpperCase();
              if (sym.endsWith('.JK') || exch === 'JKT' || disp === 'JAKARTA') {
                const cleanSymbol = sym.replace(/\.JK$/i, '').toUpperCase();
                if (!resultsMap.has(cleanSymbol)) {
                  const name = cleanCompanyName(quote.longname || quote.shortname || cleanSymbol);
                  resultsMap.set(cleanSymbol, { symbol: cleanSymbol, name });
                }
              }
            });
          }
        } catch {
          // Abaikan kesalahan parsial Yahoo API
        }
      }

      // 3. Jika q berukuran 3-6 karakter dan belum ditemukan di hasil, tes langsung ke Yahoo Chart API (${cleanQ}.JK)
      if (cleanQ.length >= 3 && cleanQ.length <= 6 && !resultsMap.has(cleanQ)) {
        try {
          const chartRes = await fetch(
            `https://query1.finance.yahoo.com/v8/finance/chart/${cleanQ}.JK`,
            {
              headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
              },
              cache: 'no-store'
            }
          );
          if (chartRes.ok) {
            const chartData = await chartRes.json();
            const meta = chartData.chart?.result?.[0]?.meta;
            if (meta) {
              const name = cleanCompanyName(meta.longName || meta.shortName || cleanQ);
              resultsMap.set(cleanQ, { symbol: cleanQ, name });
            }
          }
        } catch {
          // Abaikan
        }
      }

      const quotes = Array.from(resultsMap.values());
      return NextResponse.json({ quotes });
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
    // Check local dictionary first for instant name fallback
    const localName = LOCAL_IDX_DICTIONARY[symbol] || '';

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
      return NextResponse.json({ symbol, name: cleanCompanyName(localName || symbol), price: null });
    }

    const data = await response.json();
    const meta = data.chart?.result?.[0]?.meta;

    if (meta) {
      const name = cleanCompanyName(meta.longName || meta.shortName || localName || symbol);
      const price = meta.regularMarketPrice || null;
      
      return NextResponse.json({ symbol, name, price });
    }

    return NextResponse.json({ symbol, name: cleanCompanyName(localName || symbol), price: null });
  } catch (error: any) {
    console.error('Error fetching ticker data from internet:', error.message);
    const localName = LOCAL_IDX_DICTIONARY[symbol] || '';
    return NextResponse.json({ symbol, name: cleanCompanyName(localName || symbol), price: null });
  }
}
