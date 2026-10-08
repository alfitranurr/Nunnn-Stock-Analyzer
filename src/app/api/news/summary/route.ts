import { NextRequest, NextResponse } from 'next/server';
import { getErrorMessage } from '@/lib/utils';
import { requireUser } from '@/lib/auth-guard';
import { applyAiRateLimit, applyRateLimit } from '@/lib/rate-limit';
import { IDX_TICKERS } from '@/lib/tickers';
import { extractTickers } from '@/lib/news';
import { THEME_BY_ID, THEME_IDS, themesForPrompt } from '@/lib/idx-themes';
import { generateJson } from '@/lib/llm';

// Always run dynamically — this route fetches live news and calls AI providers.
export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * Validate that the request Origin matches the deployment host to prevent
 * cross-site requests (CSRF). Same-origin POSTs carry an Origin header that
 * matches the server's host; absence or mismatch → 403.
 */
function isSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get('origin');
  const host = request.headers.get('host');
  if (!origin || !host) return false;
  try {
    return new URL(origin).host === host;
  } catch {
    return false;
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

function isPrivateOrReservedHost(host: string): boolean {
  // URL.hostname untuk IPv6 berbentuk "[::1]"; buang kurung siku sebelum dicek.
  const h = host.toLowerCase().replace(/^\[|\]$/g, '');
  if (h === 'localhost' || h.endsWith('.localhost')) return true;

  if (h.includes(':')) {
    // Literal IPv6: loopback, unspecified, unique-local (fc00::/7), link-local (fe80::/10), IPv4-mapped.
    if (h === '::1' || h === '::' || h === '0:0:0:0:0:0:0:1') return true;
    if (/^f[cd][0-9a-f]{0,2}:/.test(h) || /^fe[89ab][0-9a-f]?:/.test(h)) return true;
    const mapped = h.match(/^::ffff:(\d{1,3}(?:\.\d{1,3}){3})$/);
    return mapped ? isPrivateOrReservedHost(mapped[1]) : false;
  }

  const parts = h.split('.').map((p) => Number(p));
  if (parts.length === 4 && parts.every((n) => Number.isInteger(n) && n >= 0 && n <= 255)) {
    if (parts[0] === 10) return true;
    if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return true;
    if (parts[0] === 192 && parts[1] === 168) return true;
    if (parts[0] === 127) return true;
    if (parts[0] === 169 && parts[1] === 254) return true;
    if (parts[0] === 0) return true;
    if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return true;
  }
  return false;
}

function isSafeArticleUrl(raw: string): boolean {
  let u: URL;
  try {
    u = new URL(raw);
  } catch {
    return false;
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return false;
  if (u.username || u.password) return false;
  if (isPrivateOrReservedHost(u.hostname)) return false;
  return true;
}

async function fetchArticleText(url: string): Promise<string | null> {
  if (!isSafeArticleUrl(url)) {
    console.warn('fetchArticleText: rejected unsafe URL');
    return null;
  }
  try {
    // Ikuti redirect secara manual (maks 3 lompatan) dan cek ulang setiap tujuan terhadap SSRF.
    let current = url;
    let res: Response | null = null;
    for (let hop = 0; hop <= 3; hop++) {
      res = await fetch(current, {
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        },
        signal: AbortSignal.timeout(6000),
        redirect: 'manual',
      });
      const location = res.status >= 300 && res.status < 400 ? res.headers.get('location') : null;
      if (!location) break;
      const next = new URL(location, current).toString();
      if (!isSafeArticleUrl(next)) return null;
      current = next;
      res = null;
    }
    if (!res || !res.ok) return null;
    const html = await res.text();

    // Ambil teks paragraf <p> saja agar menu, iklan, dan footer tidak ikut terbaca.
    const decode = (s: string) => s
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&quot;/g, '"')
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)));
    const cleaned = html
      .replace(/<script\b[\s\S]*?<\/script>/gi, '')
      .replace(/<style\b[\s\S]*?<\/style>/gi, '');
    const paragraphs = Array.from(cleaned.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
      .map((m) => decode(m[1].replace(/<[^>]+>/g, ' ')).replace(/\s+/g, ' ').trim())
      .filter((p) => p.length >= 40);

    return paragraphs.join('\n\n').substring(0, 6000).trim();
  } catch (err) {
    console.error('Error fetching article text:', err);
    return null;
  }
}

// ─── Analisis berita versi trader ───

type Sentiment = 'positive' | 'negative' | 'neutral';
type Confidence = 'high' | 'medium' | 'low';
type Impact = 'corporate' | 'macro' | 'regulation' | 'sector' | 'market' | 'other';
type Horizon = 'short' | 'long' | 'unclear';
type Basis = 'full-article' | 'headline-only';
type ThemeEffect = 'positive' | 'negative' | 'mixed';

interface RelatedTheme {
  theme: string;
  label_id: string;
  label_en: string;
  effect: ThemeEffect;
  reason: string;
  /** Emiten tema ini (dari peta tema terkurasi), tanpa saham yang sudah disebut langsung. */
  tickers: string[];
}

interface NewsAnalysisResponse {
  /** ai = rangkuman AI; extract = cuplikan artikel asli (AI tidak tersedia); unavailable = tidak ada keduanya. */
  mode: 'ai' | 'extract' | 'unavailable';
  basis: Basis;
  articleUrl: string | null;
  generatedAt: string;
  cached?: boolean;
  aiError?: boolean;
  // mode = ai
  headline?: string;
  summary?: string;
  keyPoints?: string[];
  sentiment?: Sentiment;
  confidence?: Confidence;
  impact?: Impact;
  horizon?: Horizon;
  /** Saham yang disebut langsung (judul + AI). */
  affectedTickers?: string[];
  /** Tema/sektor yang berpotensi terdampak beserta emitennya. */
  relatedThemes?: RelatedTheme[];
  watchPoints?: string[];
  provider?: 'Gemini' | 'Groq' | 'OpenAI';
  model?: string;
  // mode = extract
  excerpt?: string[];
}

const SENTIMENTS: Sentiment[] = ['positive', 'negative', 'neutral'];
const CONFIDENCES: Confidence[] = ['high', 'medium', 'low'];
const IMPACTS: Impact[] = ['corporate', 'macro', 'regulation', 'sector', 'market', 'other'];
const HORIZONS: Horizon[] = ['short', 'long', 'unclear'];
const THEME_EFFECTS: ThemeEffect[] = ['positive', 'negative', 'mixed'];
const MAX_THEMES = 3;
const MAX_THEME_TICKERS = 6;

const MAX_TITLE = 300;
const MAX_SOURCE = 120;
const MAX_LINK = 2000;
const AI_CACHE_TTL_MS = 24 * 60 * 60_000;
const FALLBACK_CACHE_TTL_MS = 10 * 60_000;
const CACHE_MAX_ENTRIES = 500;
const TIME_BUDGET_MS = 26_000; // maxDuration route = 30 detik

// Cache in-memory per instance: artikel yang sama tidak dirangkum ulang dan tidak memakan kuota AI.
const analysisCache = new Map<string, { expires: number; value: NewsAnalysisResponse }>();

function cacheGet(key: string): NewsAnalysisResponse | null {
  const hit = analysisCache.get(key);
  if (!hit) return null;
  if (hit.expires < Date.now()) {
    analysisCache.delete(key);
    return null;
  }
  return hit.value;
}

function cacheSet(key: string, value: NewsAnalysisResponse, ttlMs: number) {
  if (analysisCache.size >= CACHE_MAX_ENTRIES) {
    const oldest = analysisCache.keys().next().value;
    if (oldest !== undefined) analysisCache.delete(oldest);
  }
  analysisCache.set(key, { expires: Date.now() + ttlMs, value });
}

const oneOf = <T extends string>(value: unknown, allowed: T[], fallback: T): T =>
  typeof value === 'string' && (allowed as string[]).includes(value.toLowerCase()) ? (value.toLowerCase() as T) : fallback;

const cleanText = (value: unknown, max: number): string =>
  typeof value === 'string' ? value.replace(/\s+/g, ' ').trim().slice(0, max) : '';

const cleanList = (value: unknown, maxItems: number, maxLen: number): string[] =>
  Array.isArray(value) ? value.map((v) => cleanText(v, maxLen)).filter(Boolean).slice(0, maxItems) : [];

/** Validasi & normalisasi keluaran AI; lempar error bila tidak layak tampil (provider berikutnya dicoba). */
function normalizeAnalysis(raw: unknown, basis: Basis, title: string): Omit<NewsAnalysisResponse, 'mode' | 'articleUrl' | 'generatedAt' | 'basis'> {
  if (!raw || typeof raw !== 'object') throw new Error('AI output is not an object');
  const r = raw as Record<string, unknown>;
  const headline = cleanText(r.headline, 200);
  const summary = cleanText(r.summary, 900);
  if (!headline || !summary) throw new Error('AI output is missing headline/summary');

  let confidence = oneOf(r.confidence, CONFIDENCES, 'low');
  // Analisis dari judul saja tidak boleh mengklaim keyakinan tinggi.
  if (basis === 'headline-only' && confidence !== 'low') confidence = 'low';

  // Saham yang disebut langsung: dari judul (kode & nama) ditambah yang disebut AI dari isi artikel.
  const aiTickers = cleanList(r.affectedTickers, 8, 10).map((t) => t.toUpperCase().replace(/\.JK$/, ''));
  const affectedTickers = Array.from(new Set([...extractTickers(title), ...aiTickers]))
    .filter((t) => Boolean(IDX_TICKERS[t]))
    .slice(0, 8);

  // Tema terdampak → emiten dari peta tema terkurasi (selalu kode yang valid).
  const seenThemes = new Set<string>();
  const relatedThemes: RelatedTheme[] = [];
  for (const item of Array.isArray(r.relatedThemes) ? r.relatedThemes : []) {
    if (!item || typeof item !== 'object') continue;
    const t = item as Record<string, unknown>;
    const theme = THEME_BY_ID.get(cleanText(t.theme, 40));
    if (!theme || seenThemes.has(theme.id)) continue;
    seenThemes.add(theme.id);
    const tickers = theme.tickers.filter((tk) => !affectedTickers.includes(tk)).slice(0, MAX_THEME_TICKERS);
    if (tickers.length === 0) continue;
    relatedThemes.push({
      theme: theme.id,
      label_id: theme.id_label,
      label_en: theme.en_label,
      effect: oneOf(t.effect, THEME_EFFECTS, 'mixed'),
      reason: cleanText(t.reason, 220),
      tickers,
    });
    // Analisis dari judul saja: cukup 1 tema agar tidak berspekulasi.
    if (relatedThemes.length >= (basis === 'headline-only' ? 1 : MAX_THEMES)) break;
  }

  return {
    headline,
    summary,
    keyPoints: cleanList(r.keyPoints, 4, 300),
    sentiment: oneOf(r.sentiment, SENTIMENTS, 'neutral'),
    confidence,
    impact: oneOf(r.impact, IMPACTS, 'other'),
    horizon: oneOf(r.horizon, HORIZONS, 'unclear'),
    affectedTickers,
    relatedThemes,
    watchPoints: cleanList(r.watchPoints, 3, 240),
  };
}

function buildPrompt(title: string, source: string, articleContent: string): string {
  const basisRule = articleContent
    ? '- Isi artikel tersedia. Gunakan isi artikel sebagai sumber utama.'
    : '- HANYA judul yang tersedia (isi artikel tidak bisa diambil). Ringkasan cukup 1–2 kalimat, keyPoints hanya berisi hal yang tersurat di judul, dan confidence harus "low".';

  return `Anda adalah analis pasar modal Indonesia. Analisis berita berikut untuk investor saham Bursa Efek Indonesia.

ATURAN:
- Gunakan HANYA fakta yang tertulis di judul/isi di bawah. Jangan menambahkan angka, nama, rasio, atau klaim yang tidak ada.
- Jangan memberi rekomendasi beli/jual/tahan, target harga, atau saran trading.
${basisRule}
- sentiment = arah dampak berita terhadap harga saham/pasar yang terdampak (positive, negative, neutral).
- affectedTickers = kode saham BEI 4 huruf yang disebut atau jelas dimaksud di berita; kosongkan bila tidak ada.
- relatedThemes = tema/sektor dari DAFTAR TEMA yang terdampak LANGSUNG dan JELAS oleh berita ini
  (mis. harga batu bara naik → coal positive; BI Rate naik → bank_big mixed, property negative;
  aliran dana asing keluar dari bursa Indonesia → bluechips negative).
  Jangan memilih tema hanya karena saham sejenis di luar negeri bergerak, dan jangan menebak dampak yang tidak
  dijelaskan berita. Lebih baik kosong daripada keliru. ${articleContent ? 'Maksimal 3 tema.' : 'Karena hanya ada judul, maksimal 1 tema.'}
  effect = positive, negative, atau mixed. reason = 1 kalimat sebab-akibat yang tersurat di berita.
- Tulis dalam Bahasa Indonesia yang ringkas.

DAFTAR TEMA (gunakan hanya id berikut):
${themesForPrompt()}

Judul: "${title}"
Sumber: "${source || '-'}"
${articleContent ? `\nIsi artikel:\n"""\n${articleContent}\n"""\n` : ''}
Balas HANYA dengan objek JSON:
{
  "headline": "inti berita dalam 1 kalimat",
  "summary": "2–3 kalimat konteks berita",
  "keyPoints": ["2–4 poin fakta penting dari berita"],
  "sentiment": "positive | negative | neutral",
  "confidence": "high | medium | low",
  "impact": "corporate | macro | regulation | sector | market | other",
  "horizon": "short | long | unclear",
  "affectedTickers": ["KODE"],
  "relatedThemes": [{ "theme": "id tema", "effect": "positive | negative | mixed", "reason": "1 kalimat" }],
  "watchPoints": ["1–3 hal yang perlu dipantau investor ke depan"]
}`;
}

const GEMINI_SCHEMA = {
  type: 'OBJECT',
  properties: {
    headline: { type: 'STRING' },
    summary: { type: 'STRING' },
    keyPoints: { type: 'ARRAY', items: { type: 'STRING' } },
    sentiment: { type: 'STRING', enum: SENTIMENTS },
    confidence: { type: 'STRING', enum: CONFIDENCES },
    impact: { type: 'STRING', enum: IMPACTS },
    horizon: { type: 'STRING', enum: HORIZONS },
    affectedTickers: { type: 'ARRAY', items: { type: 'STRING' } },
    relatedThemes: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          theme: { type: 'STRING', enum: THEME_IDS },
          effect: { type: 'STRING', enum: THEME_EFFECTS },
          reason: { type: 'STRING' },
        },
        required: ['theme', 'effect', 'reason'],
      },
    },
    watchPoints: { type: 'ARRAY', items: { type: 'STRING' } },
  },
  required: ['headline', 'summary', 'keyPoints', 'sentiment', 'confidence', 'impact', 'horizon', 'affectedTickers', 'relatedThemes', 'watchPoints'],
};

/** Rantai Gemini → Groq → OpenAI (lib/llm) dengan skema JSON; hasil divalidasi normalizeAnalysis. */
async function generateAnalysis(prompt: string, basis: Basis, title: string, deadline: number) {
  const result = await generateJson({
    prompt,
    geminiSchema: GEMINI_SCHEMA,
    deadline,
    tag: 'news-summary',
    normalize: (raw) => normalizeAnalysis(raw, basis, title),
  });
  return result ? { ...result.value, provider: result.provider, model: result.model } : null;
}

/** Cuplikan paragraf pertama artikel asli (tanpa interpretasi) untuk mode tanpa AI. */
function buildExcerpt(articleContent: string): string[] {
  return articleContent
    .split(/\n{2,}/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter((p) => p.length >= 80)
    .slice(0, 3)
    .map((p) => (p.length > 420 ? `${p.slice(0, 417)}…` : p));
}

function isGoogleNewsUrl(raw: string): boolean {
  try {
    return new URL(raw).hostname === 'news.google.com';
  } catch {
    return false;
  }
}

export async function POST(request: NextRequest) {
  const startedAt = Date.now();
  try {
    if (!isSameOrigin(request)) {
      return NextResponse.json({ error: 'Forbidden: cross-origin requests are not allowed.' }, { status: 403 });
    }

    const { user, error: authError } = await requireUser(request);
    if (authError) return authError;

    const limited = await applyRateLimit(request);
    if (limited) return limited;

    let body: Record<string, unknown>;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }
    const title = cleanText(body.title, MAX_TITLE + 1);
    const source = cleanText(body.source, MAX_SOURCE);
    const link = typeof body.link === 'string' ? body.link.trim() : '';
    if (!title || title.length > MAX_TITLE) {
      return NextResponse.json({ error: `Title is required (max ${MAX_TITLE} characters)` }, { status: 400 });
    }
    if (link.length > MAX_LINK) {
      return NextResponse.json({ error: 'Link is too long' }, { status: 400 });
    }

    const cacheKey = `${link || title}`.slice(0, 600);
    const cached = cacheGet(cacheKey);
    if (cached) return NextResponse.json({ ...cached, cached: true });

    const hasAiProvider = Boolean(process.env.GEMINI_API_KEY || process.env.GROQ_API_KEY || process.env.OPENAI_API_KEY);
    if (hasAiProvider) {
      // Kuota AI hanya dipotong saat benar-benar memanggil AI (bukan saat hasil diambil dari cache).
      const aiLimited = await applyAiRateLimit(user.id);
      if (aiLimited) return aiLimited;
    }

    // Ambil isi artikel asli (link Google News di-resolve ke URL media; dijaga dari SSRF).
    let articleContent = '';
    let articleUrl: string | null = null;
    if (link && isSafeArticleUrl(link)) {
      try {
        const resolved = isGoogleNewsUrl(link) ? await getOriginalArticleUrl(link) : link;
        if (resolved && isSafeArticleUrl(resolved)) {
          articleUrl = resolved;
          articleContent = (await fetchArticleText(resolved)) ?? '';
        }
      } catch (err) {
        console.warn('[news-summary] Gagal mengambil isi artikel:', getErrorMessage(err));
      }
    }
    const basis: Basis = articleContent.length >= 300 ? 'full-article' : 'headline-only';
    const generatedAt = new Date().toISOString();

    if (hasAiProvider) {
      const analysis = await generateAnalysis(
        buildPrompt(title, source, basis === 'full-article' ? articleContent : ''),
        basis,
        title,
        startedAt + TIME_BUDGET_MS
      );
      if (analysis) {
        const response: NewsAnalysisResponse = { mode: 'ai', basis, articleUrl, generatedAt, ...analysis };
        cacheSet(cacheKey, response, AI_CACHE_TTL_MS);
        return NextResponse.json(response);
      }
    }

    // Tanpa AI (tidak dikonfigurasi atau semua provider gagal): tampilkan cuplikan artikel asli apa adanya.
    const excerpt = basis === 'full-article' ? buildExcerpt(articleContent) : [];
    const fallback: NewsAnalysisResponse = {
      mode: excerpt.length > 0 ? 'extract' : 'unavailable',
      basis,
      articleUrl,
      generatedAt,
      excerpt,
      aiError: hasAiProvider,
    };
    cacheSet(cacheKey, fallback, FALLBACK_CACHE_TTL_MS);
    return NextResponse.json(fallback);
  } catch (error: unknown) {
    console.error('Error generating news analysis:', getErrorMessage(error));
    return NextResponse.json({ error: 'Failed to generate summary' }, { status: 500 });
  }
}
