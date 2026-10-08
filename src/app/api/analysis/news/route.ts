import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/utils';
import { requireUser } from '@/lib/auth-guard';
import { applyAiRateLimit, applyRateLimit } from '@/lib/rate-limit';
import { validateTickerSymbol } from '@/lib/validators';
import { createTtlCache } from '@/lib/yahoo';
import { fetchTickerNews } from '@/lib/news-feed';
import { isTrustedDomain, type NewsItem } from '@/lib/news';
import { generateJson, hasLlmKey } from '@/lib/llm';
import { IDX_TICKERS } from '@/lib/tickers';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

type Sentiment = 'Bullish' | 'Bearish' | 'Netral';
type Confidence = 'high' | 'medium' | 'low';

interface StockSentiment {
  sentiment: Sentiment;
  confidence: Confidence;
  summary: string;
  keyPoints: string[];
  /** 'ai' = model bahasa, 'keyword' = hitungan kata, 'none' = tidak ada berita. */
  method: 'ai' | 'keyword' | 'none';
  model?: string;
  generatedAt: string;
}

/**
 * Status AI untuk respons ini: 'fresh' = baru dipanggil (memakai kuota), 'cached' = hasil AI tersimpan,
 * 'not_requested' = klien tidak meminta AI (`ai=1`), 'quota_exhausted' = kuota AI pengguna habis,
 * 'unavailable' = kunci AI tidak ada / semua penyedia gagal, 'no_news' = tidak ada berita.
 */
type AiState = 'fresh' | 'cached' | 'not_requested' | 'quota_exhausted' | 'unavailable' | 'no_news';

const MAX_NEWS = 8;
const AI_TTL_MS = 30 * 60_000;
const TIME_BUDGET_MS = 20_000;

const feedCache = createTtlCache<NewsItem[]>(10 * 60_000, 300);
/** Analisis per (ticker + daftar berita): berita sama → tidak memanggil AI lagi (hemat kuota saat LIVE). */
const analysisCache = new Map<string, { expires: number; value: StockSentiment }>();

const POSITIVE = ['naik', 'menguat', 'melonjak', 'melesat', 'laba', 'untung', 'tumbuh', 'positif', 'akuisisi', 'dividen', 'rekor', 'ekspansi', 'buyback', 'kontrak', 'surplus', 'rebound', 'bullish', 'upgrade', 'diborong', 'borong', 'ara'];
const NEGATIVE = ['turun', 'melemah', 'anjlok', 'merosot', 'ambles', 'ambruk', 'tertekan', 'terseret', 'rugi', 'defisit', 'negatif', 'gugatan', 'suspensi', 'gagal', 'koreksi', 'bearish', 'downgrade', 'pailit', 'phk', 'dilepas', 'dijual', 'arb'];
// Frasa dinilai lebih dulu (bobot 2) lalu dihapus dari judul, agar "aliran keluar dana asing naik"
// tidak terhitung positif karena kata "naik".
const POSITIVE_PHRASES = ['net buy', 'beli bersih', 'asing borong', 'dana asing masuk', 'aliran masuk', 'laba bersih naik', 'laba naik', 'target harga naik'];
const NEGATIVE_PHRASES = ['net sell', 'jual bersih', 'asing jual', 'dana asing keluar', 'aliran keluar', 'laba turun', 'laba bersih turun', 'target harga turun', 'gagal bayar'];

/** Skor satu judul: + / − / 0. Kata utuh (bukan substring: "Rupiah" bukan "up", "jatuh tempo" bukan negatif). */
function headlineScore(title: string): number {
  let text = ` ${title.toLowerCase().replace(/jatuh tempo/g, ' ')} `;
  let score = 0;
  for (const [phrases, sign] of [[POSITIVE_PHRASES, 2], [NEGATIVE_PHRASES, -2]] as const) {
    for (const p of phrases) {
      if (text.includes(p)) {
        score += sign;
        text = text.split(p).join(' ');
      }
    }
  }
  const words = new Set(text.split(/[^a-z0-9]+/));
  score += POSITIVE.filter((w) => words.has(w)).length - NEGATIVE.filter((w) => words.has(w)).length;
  return score;
}

/** Perkiraan sentimen dari judul: dihitung per berita, label hanya berubah bila selisihnya jelas. */
function keywordSentiment(news: NewsItem[]): Omit<StockSentiment, 'generatedAt'> {
  let pos = 0;
  let neg = 0;
  for (const item of news) {
    const s = headlineScore(item.title);
    if (s > 0) pos++;
    else if (s < 0) neg++;
  }
  const sentiment: Sentiment = pos - neg >= 2 && pos >= neg * 1.5 ? 'Bullish' : neg - pos >= 2 && neg >= pos * 1.5 ? 'Bearish' : 'Netral';
  return {
    sentiment,
    confidence: 'low',
    summary: `Perkiraan dari kata kunci judul ${news.length} berita terbaru: ${pos} bernada positif, ${neg} negatif, ${news.length - pos - neg} netral. Bukan analisis isi berita.`,
    keyPoints: [],
    method: 'keyword',
  };
}

const SCHEMA = {
  type: 'OBJECT',
  properties: {
    sentiment: { type: 'STRING', enum: ['Bullish', 'Bearish', 'Netral'] },
    confidence: { type: 'STRING', enum: ['high', 'medium', 'low'] },
    summary: { type: 'STRING' },
    keyPoints: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['sentiment', 'confidence', 'summary', 'keyPoints'],
};

function buildPrompt(ticker: string, name: string, news: NewsItem[]): string {
  const list = news.map((n, i) => `${i + 1}. [${n.pubDate.slice(0, 10)}] ${n.title} (${n.source})`).join('\n');
  return `Anda analis pasar modal Indonesia. Nilai sentimen berita terhadap saham ${ticker} (${name}) HANYA berdasarkan judul berita berikut (7 hari terakhir):
${list}

Aturan:
- sentiment = Bullish, Bearish, atau Netral untuk harga saham ${ticker} dalam jangka pendek. Bila berita campuran atau tidak spesifik ke emiten, pilih Netral.
- confidence = high hanya bila beberapa berita konsisten dan jelas berdampak ke emiten; low bila hanya sedikit/tidak langsung.
- summary = 2–3 kalimat bahasa Indonesia, faktual, tanpa saran beli/jual dan tanpa angka yang tidak ada di judul.
- keyPoints = maksimal 3 poin pendek tentang apa yang mendorong sentimen.
Jawab dalam JSON sesuai skema.`;
}

function normalize(raw: unknown): Omit<StockSentiment, 'method' | 'generatedAt' | 'model'> | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  const sentiment = (['Bullish', 'Bearish', 'Netral'] as Sentiment[]).find((s) => s === r.sentiment);
  const confidence = (['high', 'medium', 'low'] as Confidence[]).find((c) => c === r.confidence) ?? 'low';
  const summary = typeof r.summary === 'string' ? r.summary.trim().slice(0, 600) : '';
  if (!sentiment || summary.length < 20) return null;
  const keyPoints = Array.isArray(r.keyPoints) ? r.keyPoints.filter((p): p is string => typeof p === 'string' && p.trim().length > 0).map((p) => p.trim().slice(0, 200)).slice(0, 3) : [];
  return { sentiment, confidence, summary, keyPoints };
}

/**
 * GET /api/analysis/news?symbol=BBCA[&ai=1]
 * Berita 7 hari terakhir yang benar-benar menyebut emiten (kode atau nama), plus sentimen.
 * AI hanya dipanggil bila klien meminta `ai=1` (tombol eksplisit di UI) dan hasilnya belum tersimpan;
 * tanpa itu dipakai hasil AI tersimpan atau perkiraan kata kunci (tanpa token).
 * Tidak ada judul buatan: bila tidak ada berita relevan, daftar kosong dan sentimen "Netral (tanpa berita)".
 */
export async function GET(request: NextRequest) {
  const { user, error: authError } = await requireUser(request);
  if (authError) return authError;
  const limited = await applyRateLimit(request);
  if (limited) return limited;

  const ticker = validateTickerSymbol(request.nextUrl.searchParams.get('symbol'))?.replace(/\.JK$/, '');
  if (!ticker) return NextResponse.json({ error: 'Invalid or missing symbol parameter', code: 'invalid_symbol' }, { status: 400 });
  const name = IDX_TICKERS[ticker] || ticker;
  const wantAi = request.nextUrl.searchParams.get('ai') === '1';

  let news: NewsItem[];
  try {
    const { value } = await feedCache(ticker, async () => {
      const items = await fetchTickerNews([ticker]);
      // Media kredibel didahulukan, lalu terbaru.
      return [...items.filter((n) => isTrustedDomain(n.sourceDomain)), ...items.filter((n) => !isTrustedDomain(n.sourceDomain))].slice(0, MAX_NEWS);
    });
    news = value;
  } catch (error) {
    console.error(`[analysis-news] ${ticker}:`, getErrorMessage(error));
    return NextResponse.json({ error: 'News source unavailable', code: 'source_failed' }, { status: 502 });
  }

  const now = new Date().toISOString();
  if (news.length === 0) {
    return NextResponse.json({
      symbol: ticker,
      news: [],
      analysis: { sentiment: 'Netral', confidence: 'low', summary: 'Tidak ada berita yang menyebut emiten ini dalam 7 hari terakhir.', keyPoints: [], method: 'none', generatedAt: now } satisfies StockSentiment,
      aiState: 'no_news' satisfies AiState,
    });
  }

  const key = `${ticker}:${news.map((n) => n.id).join('|')}`;
  const hit = analysisCache.get(key);
  // Hasil AI tersimpan selalu dipakai; perkiraan kata kunci tersimpan hanya bila AI tidak diminta.
  if (hit && hit.expires > Date.now() && (hit.value.method === 'ai' || !wantAi)) {
    const aiState: AiState = hit.value.method === 'ai' ? 'cached' : 'not_requested';
    return NextResponse.json({ symbol: ticker, news, analysis: hit.value, aiState });
  }

  let analysis: StockSentiment | null = null;
  let aiState: AiState = 'not_requested';
  if (wantAi) {
    if (!hasLlmKey() || !user) {
      aiState = 'unavailable';
    } else if (await applyAiRateLimit(user.id)) {
      // Kuota AI hanya terpakai saat benar-benar memanggil AI (bukan dari cache).
      aiState = 'quota_exhausted';
    } else {
      const result = await generateJson({
        prompt: buildPrompt(ticker, name, news),
        geminiSchema: SCHEMA,
        deadline: Date.now() + TIME_BUDGET_MS,
        tag: 'analysis-news',
        normalize,
      });
      if (result) {
        analysis = { ...result.value, method: 'ai', model: `${result.provider} ${result.model}`, generatedAt: now };
        aiState = 'fresh';
      } else {
        aiState = 'unavailable';
      }
    }
  }
  if (!analysis) analysis = { ...keywordSentiment(news), generatedAt: now };

  analysisCache.set(key, { expires: Date.now() + (analysis.method === 'ai' ? AI_TTL_MS : 5 * 60_000), value: analysis });
  if (analysisCache.size > 500) analysisCache.delete(analysisCache.keys().next().value as string);
  return NextResponse.json({ symbol: ticker, news, analysis, aiState });
}
