import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/utils';

// Always run dynamically — this route fetches live news and calls AI providers.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

function cleanJsonString(str: string) {
  let clean = str.trim();
  if (clean.startsWith('```json')) {
    clean = clean.substring(7);
  } else if (clean.startsWith('```')) {
    clean = clean.substring(3);
  }
  if (clean.endsWith('```')) {
    clean = clean.substring(0, clean.length - 3);
  }
  return clean.trim();
}

function generateMockSummary(title: string, source: string) {
  const titleLower = title.toLowerCase();
  
  const isPositive = [
    'untung', 'naik', 'tumbuh', 'cuan', 'rekor', 'ekspansi', 'akuisisi', 'dividen',
    'positif', 'laba', 'growth', 'gain', 'meningkat', 'melonjak', 'optimis', 'terdongkrak', 
    'moncer', 'melejit', 'meroket', 'melesat'
  ].some(w => titleLower.includes(w));

  const isNegative = [
    'rugi', 'turun', 'anjlok', 'lemah', 'beban', 'utang', 'negatif', 'sengketa',
    'bearish', 'drop', 'fall', 'loss', 'decline', 'menurun', 'merosot', 'tertekan', 
    'lesu', 'gugatan', 'krisis', 'pangkas', 'ambruk', 'jatuh', 'koreksi', 'memerah'
  ].some(w => titleLower.includes(w));

  // Tentukan subjek berita secara cerdas agar tidak menyematkan nama publisher/sumber berita
  let subject = 'Emiten terkait';
  if (titleLower.includes('ihsg')) {
    subject = 'IHSG';
  } else if (titleLower.includes('rupiah')) {
    subject = 'Nilai Tukar Rupiah';
  } else {
    // Ambil kata pertama atau cari potongan judul sebelum pemisah
    const cleanTitle = title.replace(/persero/gi, '').trim();
    const parts = cleanTitle.split(/[-:|]/);
    if (parts[0] && parts[0].trim().length > 3) {
      subject = parts[0].trim();
    }
  }

  if (isPositive) {
    return {
      highlight: `Katalis Positif Berpotensi Mendorong Penguatan ${subject}`,
      context: `Berita utama bertajuk "${title}" dari ${source || 'sumber informasi'} mencerminkan perkembangan bisnis positif yang berpotensi memberikan dorongan bagi ${subject}.`,
      keyFindings: [
        "Aktivitas bisnis berjalan ekspansif dengan indikasi pertumbuhan volume penjualan atau peningkatan layanan.",
        "Efisiensi biaya operasional diproyeksikan mampu meningkatkan marjin keuntungan bersih (Net Profit Margin).",
        "Respon pelaku pasar di bursa cenderung menyambut baik sentimen ini, terlihat dari stabilitas volume transaksi.",
        "Peluang dividen atau aksi korporasi strategis lainnya dinilai tetap menarik bagi pemegang saham jangka panjang."
      ],
      takeaway: "Sentimen positif ini memperkuat basis fundamental. Investor dapat memanfaatkan momentum koreksi sehat untuk melakukan akumulasi bertahap."
    };
  } else if (isNegative) {
    return {
      highlight: `Waspada Tekanan Sentimen Negatif Terhadap ${subject}`,
      context: `Kabar terkini bertajuk "${title}" menyoroti tantangan atau sentimen negatif yang sedang memengaruhi ${subject}, memicu kehati-hatian pelaku pasar.`,
      keyFindings: [
        "Adanya tekanan pada margin laba yang disebabkan oleh kenaikan beban input atau biaya logistik.",
        "Struktur permodalan atau rasio liabilitas (utang) memerlukan pengawasan lebih lanjut guna mengukur solvabilitas.",
        "Pelaku pasar merespons dengan kecenderungan wait-and-see, membatasi aliran dana masuk jangka pendek.",
        "Manajemen diharapkan segera merilis rencana mitigasi risiko atau langkah restrukturisasi untuk menjaga kinerja bisnis."
      ],
      takeaway: "Tantangan operasional ini meningkatkan profil risiko jangka pendek. Disarankan untuk wait-and-see dan menunda pembelian agresif hingga ada kejelasan pemulihan fundamental."
    };
  } else {
    return {
      highlight: `Konsolidasi Sentimen & Prospek Netral Pada ${subject}`,
      context: `Informasi "${title}" yang dilansir oleh ${source || 'media'} menunjukkan kondisi ${subject} cenderung stabil tanpa katalis penggerak harga ekstrem untuk saat ini.`,
      keyFindings: [
        "Emiten berada dalam fase konsolidasi bisnis sehat, menyeimbangkan ekspansi dengan pengelolaan risiko internal.",
        "Rasio valuasi harga saham (P/E dan PBV) saat ini diperdagangkan dalam area rata-rata historisnya.",
        "Aliran dana transaksi bandar maupun pelaku pasar asing terpantau seimbang tanpa akumulasi dominan.",
        "Pasar sedang menanti rilis data laporan keuangan kuartalan berikutnya sebagai penentu arah tren baru."
      ],
      takeaway: "Ketiadaan katalis utama mengindikasikan harga akan bergerak menyamping (sideways). Strategi swing trading jangka pendek pada area support-resistance dapat dipertimbangkan."
    };
  }
}

async function getOriginalArticleUrl(googleRssUrl: string): Promise<string | null> {
  try {
    const response = await fetch(googleRssUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(8000)
    });
    if (!response.ok) {
      console.warn('Google News RSS fetch failed:', response.status);
      return null;
    }
    const html = await response.text();
    const match = html.match(/data-p="([^"]+)"/);
    if (!match) {
      console.warn('No data-p attribute found in Google News page');
      return null;
    }
    const dataP = match[1];

    // Decode HTML entities
    const cleanDataP = dataP
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/%\.@\./g, '["garturlreq",');

    let obj: unknown[];
    try {
      obj = JSON.parse(cleanDataP);
    } catch {
      console.warn('Failed to parse data-p JSON from Google News page');
      return null;
    }

    if (!Array.isArray(obj) || obj.length < 8) {
      console.warn('Unexpected data-p structure from Google News');
      return null;
    }

    const payload = {
      'f.req': JSON.stringify([[
        ['Fbv4je', JSON.stringify([...obj.slice(0, -6), ...obj.slice(-2)]), 'null', 'generic']
      ]])
    };

    const postResponse = await fetch('https://news.google.com/_/DotsSplashUi/data/batchexecute', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded;charset=UTF-8'
      },
      body: new URLSearchParams(payload).toString(),
      signal: AbortSignal.timeout(8000)
    });

    if (!postResponse.ok) {
      console.warn('Google News batchexecute failed:', postResponse.status);
      return null;
    }

    const resText = await postResponse.text();
    const cleanResText = resText.replace(/^\)\]\}'\n/, '');

    let responseData: unknown;
    try {
      responseData = JSON.parse(cleanResText);
    } catch {
      console.warn('Failed to parse batchexecute response JSON');
      return null;
    }

    // Navigate the nested response structure safely.
    const outer = Array.isArray(responseData) ? responseData[0] : null;
    if (!Array.isArray(outer) || typeof outer[2] !== 'string') {
      console.warn('Unexpected batchexecute response structure');
      return null;
    }
    const arrayString = outer[2];

    let finalUrl: string | null = null;
    try {
      const parsed = JSON.parse(arrayString);
      finalUrl = Array.isArray(parsed) && typeof parsed[1] === 'string' ? parsed[1] : null;
    } catch {
      console.warn('Failed to parse final URL from batchexecute inner JSON');
      return null;
    }

    return finalUrl;
  } catch (err) {
    console.error('Error decoding Google News URL:', getErrorMessage(err));
    return null;
  }
}

async function fetchArticleText(url: string): Promise<string | null> {
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      },
      signal: AbortSignal.timeout(6000) // 6 seconds timeout
    });
    if (!res.ok) return null;
    const html = await res.text();
    
    // Clean HTML to text
    let text = html.replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
    text = text.replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '');
    text = text.replace(/<\/p>|<br\s*\/?>/gi, '\n');
    text = text.replace(/<[^>]+>/g, ' ');
    text = text.replace(/  +/g, ' ');
    text = text.replace(/\n\s*\n+/g, '\n\n');
    
    return text.substring(0, 6000).trim();
  } catch (err) {
    console.error('Error fetching article text:', err);
    return null;
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { title, source, link } = body;

    if (!title) {
      return NextResponse.json({ error: 'Title is required' }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const groqKey = process.env.GROQ_API_KEY;
    const openAIKey = process.env.OPENAI_API_KEY;

    // Resolve original URL and fetch article text if link is provided
    let articleContent = '';
    let resolvedUrl = link || '';
    if (link && link.startsWith('http')) {
      try {
        if (link.includes('news.google.com')) {
          const decoded = await getOriginalArticleUrl(link);
          if (decoded) {
            resolvedUrl = decoded;
          }
        }
        if (resolvedUrl) {
          const content = await fetchArticleText(resolvedUrl);
          if (content) {
            articleContent = content;
          }
        }
      } catch (fetchErr) {
        console.error('Failed to retrieve full article content:', fetchErr);
      }
    }

    if (!geminiKey && !groqKey && !openAIKey) {
      const mockData = generateMockSummary(title, source);
      return NextResponse.json({ ...mockData, isMock: true });
    }

    let prompt = `Anda adalah analis finansial profesional. Analisislah berita/artikel berikut ini:
Judul: "${title}"
Sumber: "${source}"\n`;

    if (articleContent) {
      prompt += `\nKonten Lengkap Artikel:\n"""\n${articleContent}\n"""\n`;
    }

    const promptGemini = prompt + `\nBerikan analisis mendalam dan ringkasan berita tersebut dalam Bahasa Indonesia.`;

    const promptOpenAI = prompt + `\nBerikan ringkasan analisis mendalam dalam Bahasa Indonesia berdasarkan data yang tersedia di atas. Output Anda HARUS berupa objek JSON dengan format persis seperti di bawah ini dan tidak ada penjelasan/teks lain di luar JSON tersebut:
{
  "highlight": "Highlight Utama (1 kalimat ringkas, padat, dan tebal, e.g., 'Kinerja Keuangan Kuartalan Meningkat')",
  "context": "Konteks Singkat (2-3 kalimat menjelaskan detail berita tersebut secara kronologis/kontekstual)",
  "keyFindings": [
    "Poin temuan kunci 1 (singkat, berupa kalimat data bernomor)",
    "Poin temuan kunci 2 (singkat, berupa kalimat data bernomor)",
    "Poin temuan kunci 3 (singkat, berupa kalimat data bernomor)",
    "Poin temuan kunci 4 (opsional, jika ada temuan kunci tambahan)"
  ],
  "takeaway": "Kesimpulan Inti / Key Takeaway (1-2 kalimat kesimpulan mendalam bagi investor)"
}
Pastikan data dan format JSON valid.`;

    if (geminiKey) {
      const models = [
        'gemini-2.5-flash',
        'gemini-2.5-flash-lite',
        'gemini-3.1-flash-lite',
        'gemini-flash-lite-latest',
        'gemini-3-flash-preview'
      ];
      
      let lastError: unknown = null;
      for (const model of models) {
        try {
          console.log(`Attempting Gemini summary using model: ${model}`);
          const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
            {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-goog-api-key': geminiKey
              },
              body: JSON.stringify({
                contents: [{
                  parts: [{ text: promptGemini }]
                }],
                generationConfig: {
                  responseMimeType: "application/json",
                  responseSchema: {
                    type: "OBJECT",
                    properties: {
                      highlight: {
                        type: "STRING",
                        description: "Highlight Utama (1 kalimat ringkas, padat, dan tebal tentang inti berita)."
                      },
                      context: {
                        type: "STRING",
                        description: "Konteks Singkat (2-3 kalimat menjelaskan detail berita tersebut secara kronologis/kontekstual)."
                      },
                      keyFindings: {
                        type: "ARRAY",
                        items: {
                          type: "STRING"
                        },
                        description: "Temuan kunci berupa poin-poin penting (3-4 poin)."
                      },
                      takeaway: {
                        type: "STRING",
                        description: "Kesimpulan Inti / Key Takeaway (1-2 kalimat kesimpulan mendalam bagi investor)."
                      }
                    },
                    required: ["highlight", "context", "keyFindings", "takeaway"]
                  }
                }
              })
            }
          );

          if (response.ok) {
            const data = await response.json();
            const textResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (textResult) {
              const cleanText = cleanJsonString(textResult);
              const parsed = JSON.parse(cleanText);
              console.log(`Successfully generated summary using model: ${model}`);
              return NextResponse.json({ ...parsed, isAI: true, modelUsed: model });
            }
          }
          throw new Error(`Response status ${response.status}`);
        } catch (geminiErr: unknown) {
          console.warn(`Gemini summary failed for model ${model}:`, getErrorMessage(geminiErr));
          lastError = geminiErr;
        }
      }
      console.error('All Gemini models failed, checking Groq. Last error:', lastError ? getErrorMessage(lastError) : 'none');
    }

    if (groqKey) {
      try {
        console.log('Attempting Groq summary using model: llama-3.3-70b-versatile');
        const response = await fetch(
          'https://api.groq.com/openai/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${groqKey}`
            },
            body: JSON.stringify({
              model: 'llama-3.3-70b-versatile',
              messages: [{ role: 'user', content: promptOpenAI }],
              temperature: 0.5,
              response_format: { type: "json_object" }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const textResult = data.choices?.[0]?.message?.content;
          if (textResult) {
            const cleanText = cleanJsonString(textResult);
            const parsed = JSON.parse(cleanText);
            console.log('Successfully generated summary using Groq model: llama-3.3-70b-versatile');
            return NextResponse.json({ ...parsed, isAI: true, modelUsed: 'llama-3.3-70b-versatile' });
          }
        }
        throw new Error(`Groq API responded with status ${response.status}`);
      } catch (groqErr: unknown) {
        console.error('Groq summary failed, checking OpenAI. Error:', getErrorMessage(groqErr));
      }
    }

    if (openAIKey) {
      try {
        const response = await fetch(
          'https://api.openai.com/v1/chat/completions',
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${openAIKey}`
            },
            body: JSON.stringify({
              model: 'gpt-3.5-turbo',
              messages: [{ role: 'user', content: promptOpenAI }],
              temperature: 0.5,
              response_format: { type: "json_object" }
            })
          }
        );

        if (response.ok) {
          const data = await response.json();
          const textResult = data.choices?.[0]?.message?.content;
          if (textResult) {
            const cleanText = cleanJsonString(textResult);
            const parsed = JSON.parse(cleanText);
            return NextResponse.json({ ...parsed, isAI: true });
          }
        }
        throw new Error(`OpenAI response not ok: ${response.status}`);
      } catch (openaiErr: unknown) {
        console.error('OpenAI summary failed:', getErrorMessage(openaiErr));
      }
    }

    const mockData = generateMockSummary(title, source);
    return NextResponse.json({ ...mockData, isMock: true });

  } catch (error: unknown) {
    console.error('Error generating AI news summary:', getErrorMessage(error));
    return NextResponse.json({
      error: 'Failed to generate summary',
      details: getErrorMessage(error)
    }, { status: 500 });
  }
}
