'use client';

import * as React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import {
  Search,
  Newspaper,
  Clock,
  Sparkles,
  Lock,
  ChevronUp,
  ChevronDown,
  AlertTriangle,
  RefreshCw,
  ExternalLink,
  Star,
  X,
  FileText,
  Eye,
  Flame,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import type { AppUser } from '@/lib/types';
import type { NewsCategory, NewsItem } from '@/lib/news';
import { useWatchlist } from '@/lib/watchlist-store';
import { fetchQuotes, type QuoteItem } from '@/lib/quotes';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';
import { formatNumberLocale } from '@/lib/format';
import { authFetch, classifyApiError, type ApiErrorKind } from '@/lib/auth-fetch';
import { IDX_TICKERS } from '@/lib/tickers';

interface NewsTabProps {
  user: AppUser | null;
  onSignInClick: () => void;
  onSelectTicker: (symbol: string) => void;
  onOpenWatchlist: () => void;
  /** Tab Berita sedang dibuka (semua tab selalu ter-mount; data hanya diambil saat aktif). */
  isActive: boolean;
}

type Tab = 'foryou' | NewsCategory;

type Sentiment = 'positive' | 'negative' | 'neutral';

interface NewsAnalysis {
  mode: 'ai' | 'extract' | 'unavailable';
  basis: 'full-article' | 'headline-only';
  articleUrl: string | null;
  aiError?: boolean;
  headline?: string;
  summary?: string;
  keyPoints?: string[];
  sentiment?: Sentiment;
  confidence?: 'high' | 'medium' | 'low';
  impact?: 'corporate' | 'macro' | 'regulation' | 'sector' | 'market' | 'other';
  horizon?: 'short' | 'long' | 'unclear';
  affectedTickers?: string[];
  relatedThemes?: Array<{
    theme: string;
    label_id: string;
    label_en: string;
    effect: 'positive' | 'negative' | 'mixed';
    reason: string;
    tickers: string[];
  }>;
  watchPoints?: string[];
  provider?: string;
  model?: string;
  excerpt?: string[];
}

type AnalysisState =
  | { status: 'loading' }
  | { status: 'ready'; data: NewsAnalysis }
  | { status: 'error'; kind: ApiErrorKind; retryAfterSec: number | null };

interface FeedResponse {
  news: NewsItem[];
  filteredUntrusted?: number;
}

const PAGE_SIZE = 12;
const CLIENT_CACHE_MS = 5 * 60_000;
const TABS: Tab[] = ['foryou', 'saham', 'global', 'makro', 'komoditas'];
const TAB_KEY: Record<Tab, string> = {
  foryou: 'news.tabForYou',
  saham: 'news.tabSaham',
  global: 'news.tabGlobal',
  makro: 'news.tabMakro',
  komoditas: 'news.tabKomoditas',
};

const SENTIMENT_STYLE: Record<Sentiment, { cls: string; id: string; en: string }> = {
  positive: { cls: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/25', id: 'Positif', en: 'Positive' },
  negative: { cls: 'bg-rose-500/10 text-rose-400 border-rose-500/25', id: 'Negatif', en: 'Negative' },
  neutral: { cls: 'bg-slate-500/10 text-slate-300 border-slate-500/25', id: 'Netral', en: 'Neutral' },
};
const CONFIDENCE_LABEL = { high: { id: 'keyakinan tinggi', en: 'high confidence' }, medium: { id: 'keyakinan sedang', en: 'medium confidence' }, low: { id: 'keyakinan rendah', en: 'low confidence' } };
const IMPACT_LABEL = {
  corporate: { id: 'Korporasi', en: 'Corporate' },
  macro: { id: 'Makro', en: 'Macro' },
  regulation: { id: 'Regulasi', en: 'Regulation' },
  sector: { id: 'Sektor', en: 'Sector' },
  market: { id: 'Pasar', en: 'Market' },
  other: { id: 'Lainnya', en: 'Other' },
};
const EFFECT_STYLE = {
  positive: { cls: 'text-emerald-400 border-emerald-500/25 bg-emerald-500/10', id: '▲ Positif', en: '▲ Positive' },
  negative: { cls: 'text-rose-400 border-rose-500/25 bg-rose-500/10', id: '▼ Negatif', en: '▼ Negative' },
  mixed: { cls: 'text-amber-400 border-amber-500/25 bg-amber-500/10', id: '◆ Campuran', en: '◆ Mixed' },
};
const HORIZON_LABEL = { short: { id: 'Jangka pendek', en: 'Short term' }, long: { id: 'Jangka panjang', en: 'Long term' }, unclear: { id: 'Horizon belum jelas', en: 'Unclear horizon' } };

const WIB_OFFSET_MS = 7 * 3600_000;
const wibDateKey = (ms: number) => new Date(ms + WIB_OFFSET_MS).toISOString().slice(0, 10);

/** Chip kode saham: harga & perubahan live, klik → Analisis, ☆ → watchlist. */
function TickerChip({
  ticker,
  quote,
  language,
  onSelect,
}: {
  ticker: string;
  quote?: QuoteItem;
  language: 'id' | 'en';
  onSelect: (symbol: string) => void;
}) {
  const watchlist = useWatchlist();
  const watched = watchlist.has(ticker);
  const isId = language === 'id';
  const up = (quote?.change ?? 0) >= 0;
  return (
    <span className="inline-flex items-stretch rounded-lg border border-white/10 bg-white/[0.03] overflow-hidden text-[10px] font-bold">
      <button
        type="button"
        onClick={() => onSelect(ticker)}
        className="flex items-center gap-1.5 px-2 py-1 hover:bg-emerald-500/10 transition-colors cursor-pointer"
        title={`${IDX_TICKERS[ticker] ?? ticker} · ${isId ? 'buka analisis' : 'open analysis'}`}
      >
        <span className="text-white">{ticker}</span>
        {quote && !quote.suspect && (
          <span className={`tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
            {up ? '+' : ''}{formatNumberLocale(quote.changePercent, language, 2)}%
          </span>
        )}
      </button>
      <button
        type="button"
        onClick={() => watchlist.toggle({ symbol: ticker, name: IDX_TICKERS[ticker] ?? ticker })}
        disabled={!watched && watchlist.isFull}
        aria-pressed={watched}
        aria-label={watched ? (isId ? `Hapus ${ticker} dari watchlist` : `Remove ${ticker} from watchlist`) : (isId ? `Tambah ${ticker} ke watchlist` : `Add ${ticker} to watchlist`)}
        className="px-1.5 border-l border-white/10 hover:bg-white/5 disabled:opacity-30 cursor-pointer"
      >
        <Star className={`h-3 w-3 ${watched ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} />
      </button>
    </span>
  );
}

export function NewsTab({ user, onSignInClick, onSelectTicker, onOpenWatchlist, isActive }: NewsTabProps) {
  const { language, t } = useLanguage();
  const isId = language === 'id';
  const L = (id: string, en: string) => (isId ? id : en);
  const watchlist = useWatchlist();

  const [tab, setTab] = React.useState<Tab>('saham');
  const [searchInput, setSearchInput] = React.useState('');
  const [activeQuery, setActiveQuery] = React.useState('');
  const [items, setItems] = React.useState<NewsItem[]>([]);
  const [filteredUntrusted, setFilteredUntrusted] = React.useState(0);
  const [status, setStatus] = React.useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [visibleCount, setVisibleCount] = React.useState(PAGE_SIZE);
  const [now, setNow] = React.useState<number | null>(null);

  const [expanded, setExpanded] = React.useState<Record<string, boolean>>({});
  const [analyses, setAnalyses] = React.useState<Record<string, AnalysisState>>({});
  const [quotes, setQuotes] = React.useState<Record<string, QuoteItem>>({});

  const cacheRef = React.useRef(new Map<string, { at: number; data: FeedResponse }>());

  const watchSymbols = watchlist.entries.map((e) => e.symbol).sort().join(',');
  const feedKey = activeQuery
    ? `q:${activeQuery.toLowerCase()}`
    : tab === 'foryou'
      ? `t:${watchSymbols}`
      : `c:${tab}`;
  const needsWatchlist = !activeQuery && tab === 'foryou' && watchSymbols === '';

  const loadFeed = React.useCallback(async (force = false) => {
    setVisibleCount(PAGE_SIZE);
    if (needsWatchlist) {
      setItems([]);
      setFilteredUntrusted(0);
      setStatus('ready');
      return;
    }
    const cached = cacheRef.current.get(feedKey);
    if (!force && cached && Date.now() - cached.at < CLIENT_CACHE_MS) {
      setItems(cached.data.news);
      setFilteredUntrusted(cached.data.filteredUntrusted ?? 0);
      setStatus('ready');
      return;
    }
    setStatus('loading');
    try {
      const url = activeQuery
        ? `/api/news?q=${encodeURIComponent(activeQuery)}`
        : tab === 'foryou'
          ? `/api/news?tickers=${encodeURIComponent(watchSymbols)}`
          : `/api/news?category=${tab}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(String(res.status));
      const data: FeedResponse = await res.json();
      cacheRef.current.set(feedKey, { at: Date.now(), data });
      setItems(data.news ?? []);
      setFilteredUntrusted(data.filteredUntrusted ?? 0);
      setStatus('ready');
    } catch {
      setStatus('error');
    }
    setNow(Date.now());
  }, [feedKey, activeQuery, tab, watchSymbols, needsWatchlist]);

  React.useEffect(() => {
    if (!isActive) return;
    const timer = setTimeout(() => {
      setNow(Date.now());
      loadFeed();
    }, 0);
    return () => clearTimeout(timer);
  }, [isActive, loadFeed]);

  // "Refresh semua data" (Admin): buang cache feed di browser lalu muat ulang (atau saat tab dibuka nanti).
  const refreshEpoch = useDataRefreshEpoch();
  const seenEpoch = React.useRef(refreshEpoch);
  React.useEffect(() => {
    if (seenEpoch.current === refreshEpoch) return;
    cacheRef.current.clear();
    if (!isActive) return;
    seenEpoch.current = refreshEpoch;
    const timer = setTimeout(() => loadFeed(true), 0);
    return () => clearTimeout(timer);
  }, [refreshEpoch, isActive, loadFeed]);

  // Waktu relatif diperbarui tiap menit selama tab terbuka.
  React.useEffect(() => {
    if (!isActive) return;
    const interval = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(interval);
  }, [isActive]);

  const visible = items.slice(0, visibleCount);

  // ─── Sorotan feed: emiten paling banyak diberitakan & rangkuman sentimen AI yang sudah dibuka ───
  const highlights = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const item of items) for (const tk of new Set(item.tickers)) counts.set(tk, (counts.get(tk) ?? 0) + 1);
    const top = [...counts.entries()].filter(([, c]) => c >= 2).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, 6);
    const sources = new Set(items.map((i) => i.source)).size;
    const sentiments = { positive: 0, negative: 0, neutral: 0 };
    for (const a of Object.values(analyses)) {
      if (a?.status === 'ready' && a.data.mode === 'ai' && a.data.sentiment) sentiments[a.data.sentiment] += 1;
    }
    return { top, sources, sentiments, analyzed: sentiments.positive + sentiments.negative + sentiments.neutral };
  }, [items, analyses]);

  // Harga saham yang disebut di berita yang tampil + saham terdampak hasil analisis AI.
  const quoteSymbols = React.useMemo(() => {
    const set = new Set<string>();
    for (const item of visible) item.tickers.forEach((tk) => set.add(tk));
    for (const id of Object.keys(expanded)) {
      const a = analyses[id];
      if (expanded[id] && a?.status === 'ready') {
        a.data.affectedTickers?.forEach((tk) => set.add(tk));
        a.data.relatedThemes?.forEach((theme) => theme.tickers.forEach((tk) => set.add(tk)));
      }
    }
    return Array.from(set).sort().slice(0, 30).join(',');
  }, [visible, expanded, analyses]);

  React.useEffect(() => {
    if (!isActive || !quoteSymbols) return;
    let cancelled = false;
    fetchQuotes(quoteSymbols.split(','))
      .then((data) => { if (!cancelled) setQuotes((prev) => ({ ...prev, ...data })); })
      .catch(() => { /* chip tetap tampil tanpa harga */ });
    return () => {
      cancelled = true;
    };
  }, [isActive, quoteSymbols]);

  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setActiveQuery(searchInput.replace(/\s+/g, ' ').trim().slice(0, 100));
  };

  const clearSearch = () => {
    setSearchInput('');
    setActiveQuery('');
  };

  const requestAnalysis = async (item: NewsItem) => {
    setAnalyses((prev) => ({ ...prev, [item.id]: { status: 'loading' } }));
    try {
      const res = await authFetch('/api/news/summary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: item.title, source: item.source, link: item.link }),
      });
      if (!res.ok) {
        const { kind, retryAfterSec } = await classifyApiError(res);
        setAnalyses((prev) => ({ ...prev, [item.id]: { status: 'error', kind, retryAfterSec } }));
        return;
      }
      const data: NewsAnalysis = await res.json();
      setAnalyses((prev) => ({ ...prev, [item.id]: { status: 'ready', data } }));
    } catch {
      setAnalyses((prev) => ({ ...prev, [item.id]: { status: 'error', kind: 'failed', retryAfterSec: null } }));
    }
  };

  const toggleAnalysis = (item: NewsItem) => {
    if (!user) {
      onSignInClick();
      return;
    }
    const open = !expanded[item.id];
    setExpanded((prev) => ({ ...prev, [item.id]: open }));
    const current = analyses[item.id];
    if (open && (!current || current.status === 'error')) requestAnalysis(item);
  };

  const relativeTime = (iso: string) => {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms) || now === null) return '';
    const diffMin = Math.max(0, Math.floor((now - ms) / 60_000));
    if (diffMin < 1) return L('Baru saja', 'Just now');
    if (diffMin < 60) return L(`${diffMin} mnt lalu`, `${diffMin}m ago`);
    const diffH = Math.floor(diffMin / 60);
    if (diffH < 24) return L(`${diffH} jam lalu`, `${diffH}h ago`);
    return new Date(ms).toLocaleString(isId ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  };

  const dayLabel = (iso: string) => {
    const ms = Date.parse(iso);
    if (!Number.isFinite(ms) || now === null) return L('Lainnya', 'Other');
    const key = wibDateKey(ms);
    if (key === wibDateKey(now)) return L('Hari ini', 'Today');
    if (key === wibDateKey(now - 86_400_000)) return L('Kemarin', 'Yesterday');
    return new Date(ms).toLocaleDateString(isId ? 'id-ID' : 'en-US', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Asia/Jakarta' });
  };

  const errorMessage = (state: Extract<AnalysisState, { status: 'error' }>) => {
    switch (state.kind) {
      case 'unauthenticated':
        return L('Sesi login tidak valid atau sudah berakhir. Silakan masuk ulang.', 'Your session is invalid or has expired. Please sign in again.');
      case 'not_approved':
        return L('Akun Anda masih menunggu persetujuan admin.', 'Your account is still waiting for administrator approval.');
      case 'rate_limited': {
        const minutes = state.retryAfterSec ? Math.ceil(state.retryAfterSec / 60) : null;
        return L(
          `Batas 10 analisis AI per jam tercapai.${minutes ? ` Coba lagi dalam ±${minutes} menit.` : ''}`,
          `You reached the limit of 10 AI analyses per hour.${minutes ? ` Try again in ~${minutes} min.` : ''}`
        );
      }
      case 'auth_unavailable':
        return L('Layanan login sedang tidak dapat dihubungi. Coba lagi nanti.', 'The sign-in service is unreachable. Please try again later.');
      case 'auth_check_failed':
        return L('Pemeriksaan akun di server gagal (kemungkinan skema database belum lengkap). Hubungi admin.', 'The account check failed on the server (the database schema may be incomplete). Please contact the admin.');
      default:
        return L('Analisis AI gagal dibuat. Silakan coba lagi.', 'The AI analysis could not be generated. Please try again.');
    }
  };

  // Kelompokkan berita yang tampil per hari (WIB).
  const groups: Array<{ label: string; items: NewsItem[] }> = [];
  for (const item of visible) {
    const label = dayLabel(item.pubDate);
    const last = groups[groups.length - 1];
    if (last && last.label === label) last.items.push(item);
    else groups.push({ label, items: [item] });
  }

  const renderAnalysis = (item: NewsItem, state: AnalysisState | undefined) => {
    if (!state || state.status === 'loading') {
      return (
        <div className="space-y-3 py-1" aria-live="polite">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-400">
            <Sparkles className="w-3.5 h-3.5 animate-spin" />
            {t('news.aiGenerating')}
          </div>
          <div className="h-5 bg-white/5 rounded w-2/3 animate-pulse" />
          <div className="h-4 bg-white/5 rounded w-full animate-pulse" />
          <div className="h-4 bg-white/5 rounded w-5/6 animate-pulse" />
        </div>
      );
    }

    if (state.status === 'error') {
      return (
        <div className="p-3.5 bg-rose-500/5 border border-rose-500/15 rounded-xl text-xs flex gap-2.5">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-rose-400" />
          <div className="space-y-2">
            <p className="font-bold text-rose-300">{t('news.aiFailed')}</p>
            <p className="text-slate-400">{errorMessage(state)}</p>
            {state.kind === 'unauthenticated' ? (
              <button type="button" onClick={onSignInClick} className="text-emerald-400 font-bold hover:underline cursor-pointer">
                {L('Masuk', 'Sign in')}
              </button>
            ) : state.kind !== 'not_approved' && (
              <button type="button" onClick={() => requestAnalysis(item)} className="text-emerald-400 font-bold hover:underline cursor-pointer">
                {t('news.aiRetry')}
              </button>
            )}
          </div>
        </div>
      );
    }

    const a = state.data;
    const sourceLink = a.articleUrl ?? item.link;

    if (a.mode !== 'ai') {
      return (
        <div className="space-y-3">
          <div className="p-3 rounded-xl bg-amber-500/5 border border-amber-500/20 text-[11px] text-amber-300/90 flex gap-2">
            <AlertTriangle className="h-3.5 w-3.5 shrink-0 mt-0.5" />
            <span>
              {a.aiError
                ? L('Layanan AI sedang gagal merespons, jadi analisis belum tersedia.', 'The AI service failed to respond, so no analysis is available yet.')
                : L('Analisis AI belum diaktifkan di server ini.', 'AI analysis is not enabled on this server.')}
              {' '}
              {a.mode === 'extract'
                ? L('Berikut cuplikan dari artikel aslinya, tanpa interpretasi:', 'Here is an excerpt from the original article, without interpretation:')
                : L('Isi artikel juga tidak dapat dibaca; silakan buka sumbernya.', 'The article text could not be read either; please open the source.')}
            </span>
          </div>
          {a.excerpt?.map((p, i) => (
            <p key={i} className="text-xs text-slate-300 leading-relaxed pl-3 border-l-2 border-white/10">{p}</p>
          ))}
          <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-emerald-400 hover:underline">
            {t('news.readSource')} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      );
    }

    const sentiment = SENTIMENT_STYLE[a.sentiment ?? 'neutral'];
    return (
      <div className="space-y-4">
        {/* Label analisis */}
        <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-bold">
          <span className={`px-2 py-0.5 rounded-md border ${sentiment.cls}`}>
            {sentiment[language]}
            {a.confidence && <span className="font-medium opacity-80"> · {CONFIDENCE_LABEL[a.confidence][language]}</span>}
          </span>
          {a.impact && <span className="px-2 py-0.5 rounded-md border border-white/10 text-slate-300">{IMPACT_LABEL[a.impact][language]}</span>}
          {a.horizon && <span className="px-2 py-0.5 rounded-md border border-white/10 text-slate-300">{HORIZON_LABEL[a.horizon][language]}</span>}
          <span
            className={`px-2 py-0.5 rounded-md border flex items-center gap-1 ${
              a.basis === 'full-article' ? 'border-white/10 text-slate-400' : 'border-amber-500/30 text-amber-400 bg-amber-500/5'
            }`}
            title={a.basis === 'full-article'
              ? L('AI membaca isi artikel lengkap', 'AI read the full article')
              : L('Isi artikel tidak dapat dibaca (mis. diproteksi situsnya); analisis hanya dari judul', 'The article text could not be read (e.g. protected by the site); analysis is based on the headline only')}
          >
            <FileText className="h-3 w-3" />
            {a.basis === 'full-article' ? L('Dari artikel lengkap', 'From full article') : L('Hanya dari judul', 'Headline only')}
          </span>
          {a.provider && <span className="ml-auto text-slate-500 font-mono font-medium">{a.provider}</span>}
        </div>

        <div className="space-y-1.5">
          <p className="text-sm font-bold text-white leading-snug">{a.headline}</p>
          <p className="text-xs text-slate-300 leading-relaxed">{a.summary}</p>
        </div>

        {a.keyPoints && a.keyPoints.length > 0 && (
          <div className="space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{L('Poin Penting', 'Key Points')}</span>
            <ul className="space-y-1.5">
              {a.keyPoints.map((point, i) => (
                <li key={i} className="flex gap-2 text-xs text-slate-300 leading-relaxed">
                  <span className="mt-1.5 h-1.5 w-1.5 rounded-full bg-emerald-500 shrink-0" />
                  {point}
                </li>
              ))}
            </ul>
          </div>
        )}

        {((a.affectedTickers?.length ?? 0) > 0 || (a.relatedThemes?.length ?? 0) > 0) && (
          <div className="space-y-2.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{L('Saham Terdampak', 'Affected Stocks')}</span>

            {a.affectedTickers && a.affectedTickers.length > 0 && (
              <div className="space-y-1">
                <span className="text-[10px] font-semibold text-slate-400">{L('Disebut di berita', 'Mentioned in the article')}</span>
                <div className="flex flex-wrap gap-1.5">
                  {a.affectedTickers.map((tk) => (
                    <TickerChip key={tk} ticker={tk} quote={quotes[tk]} language={language} onSelect={onSelectTicker} />
                  ))}
                </div>
              </div>
            )}

            {a.relatedThemes && a.relatedThemes.length > 0 && (
              <div className="space-y-2">
                <span className="text-[10px] font-semibold text-slate-400">{L('Berpotensi terdampak (per sektor)', 'Potentially affected (by sector)')}</span>
                {a.relatedThemes.map((theme) => {
                  const effect = EFFECT_STYLE[theme.effect];
                  return (
                    <div key={theme.theme} className="p-2.5 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="text-[11px] font-bold text-slate-200">{isId ? theme.label_id : theme.label_en}</span>
                        <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${effect.cls}`}>{effect[language]}</span>
                      </div>
                      {theme.reason && <p className="text-[11px] text-slate-400 leading-relaxed">{theme.reason}</p>}
                      <div className="flex flex-wrap gap-1.5">
                        {theme.tickers.map((tk) => (
                          <TickerChip key={tk} ticker={tk} quote={quotes[tk]} language={language} onSelect={onSelectTicker} />
                        ))}
                      </div>
                    </div>
                  );
                })}
                <p className="text-[10px] text-slate-500">
                  {L(
                    'Emiten per sektor diambil dari peta tema terkurasi (urut dari yang terbesar), bukan rekomendasi.',
                    'Stocks per sector come from a curated theme map (largest first), not recommendations.'
                  )}
                </p>
              </div>
            )}
          </div>
        )}

        {a.watchPoints && a.watchPoints.length > 0 && (
          <div className="p-3 rounded-xl bg-white/[0.02] border border-white/5 space-y-1.5">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
              <Eye className="h-3 w-3 text-emerald-400" />
              {L('Yang Perlu Dipantau', 'What to Watch')}
            </span>
            <ul className="space-y-1">
              {a.watchPoints.map((point, i) => (
                <li key={i} className="text-xs text-slate-300 leading-relaxed">• {point}</li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
          <p className="text-[10px] text-slate-500 leading-relaxed">{t('news.aiDisclaimer')}</p>
          <a href={sourceLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-400 hover:underline shrink-0">
            {t('news.readSource')} <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-5">
      {/* Header ringkas */}
      <PageHeader
        icon={Newspaper}
        eyebrow={L('Berita pasar · analisis AI', 'Market news · AI analysis')}
        title={t('news.title')}
        description={t('news.desc')}
      />

      {/* Pencarian & kategori */}
      <div className="space-y-3">
        <div className="flex items-center gap-2">
          <form onSubmit={submitSearch} className="relative flex-1" role="search">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400" />
            <input
              type="search"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder={t('news.searchPlaceholder')}
              maxLength={100}
              aria-label={t('news.searchPlaceholder')}
              className="w-full pl-9 pr-9 py-2.5 bg-input-bg border border-border-color rounded-xl text-xs text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500 transition-all [&::-webkit-search-cancel-button]:hidden"
            />
            {searchInput && (
              <button
                type="button"
                onClick={clearSearch}
                aria-label={L('Hapus pencarian', 'Clear search')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 p-0.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </form>
          <button
            type="button"
            onClick={() => loadFeed(true)}
            disabled={status === 'loading'}
            className="p-2.5 bg-white/5 border border-white/10 text-slate-300 hover:text-white rounded-xl hover:bg-white/10 transition-all shrink-0 cursor-pointer disabled:opacity-50"
            title={t('news.refresh')}
            aria-label={t('news.refresh')}
          >
            <RefreshCw className={`w-4 h-4 ${status === 'loading' ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>

        <div className="flex gap-1.5 overflow-x-auto pb-1 [&::-webkit-scrollbar]:hidden" role="tablist">
          {TABS.map((id) => {
            const active = !activeQuery && tab === id;
            return (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => {
                  setTab(id);
                  clearSearch();
                }}
                className={`shrink-0 flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold border transition-all cursor-pointer whitespace-nowrap ${
                  active
                    ? 'bg-emerald-500 border-emerald-500 text-white shadow-md'
                    : 'border-white/10 text-slate-400 hover:text-white hover:bg-white/5'
                }`}
              >
                {id === 'foryou' && <Star className={`h-3.5 w-3.5 ${active ? 'fill-white' : 'text-amber-400'}`} />}
                {t(TAB_KEY[id])}
                {id === 'foryou' && watchlist.entries.length > 0 && (
                  <span className={`text-[10px] ${active ? 'text-white/80' : 'text-slate-500'}`}>{watchlist.entries.length}</span>
                )}
              </button>
            );
          })}
        </div>

        {activeQuery && (
          <div className="flex items-center gap-2 text-xs text-slate-400">
            {L('Hasil pencarian untuk', 'Search results for')} <span className="text-emerald-400 font-semibold">&quot;{activeQuery}&quot;</span>
            <button type="button" onClick={clearSearch} className="text-slate-400 hover:text-white underline cursor-pointer">
              {t('news.clearSearch')}
            </button>
          </div>
        )}
      </div>

      {/* Sorotan feed */}
      {status === 'ready' && items.length > 0 && (highlights.top.length > 0 || highlights.analyzed > 0) && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
          className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 space-y-2.5"
        >
          {highlights.top.length > 0 && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="text-[10px] font-extrabold uppercase tracking-widest text-amber-400 flex items-center gap-1 shrink-0">
                <Flame className="h-3.5 w-3.5" /> {L('Paling diberitakan', 'Most covered')}
              </span>
              <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-0.5 min-w-0">
                {highlights.top.map(([tk, count]) => {
                  const q = quotes[tk];
                  return (
                    <button
                      key={tk}
                      type="button"
                      onClick={() => {
                        setSearchInput(tk);
                        setActiveQuery(tk);
                      }}
                      title={L(`Tampilkan berita ${tk}`, `Show ${tk} news`)}
                      className="shrink-0 px-2 py-1 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-amber-500/10 hover:border-amber-500/30 text-[10px] font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
                    >
                      <span className="text-white">{tk}</span>
                      <span className="text-slate-500">×{count}</span>
                      {q && !q.suspect && (
                        <span className={`tabular-nums ${q.change >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {q.change >= 0 ? '+' : ''}{formatNumberLocale(q.changePercent, language, 1)}%
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
          <p className="text-[10px] text-slate-500">
            {L(`${items.length} berita dari ${highlights.sources} media`, `${items.length} stories from ${highlights.sources} outlets`)}
            {highlights.analyzed > 0 &&
              L(
                ` · ${highlights.analyzed} dianalisis AI: ${highlights.sentiments.positive} positif, ${highlights.sentiments.negative} negatif, ${highlights.sentiments.neutral} netral`,
                ` · ${highlights.analyzed} analyzed by AI: ${highlights.sentiments.positive} positive, ${highlights.sentiments.negative} negative, ${highlights.sentiments.neutral} neutral`
              )}
          </p>
        </motion.div>
      )}

      {/* Feed */}
      {status === 'error' ? (
        <div className="border border-red-500/20 bg-red-500/10 p-4 rounded-xl flex items-start gap-3">
          <AlertTriangle className="w-5 h-5 text-red-400 shrink-0 mt-0.5" />
          <div className="text-xs text-red-200 space-y-2">
            <p>{L('Gagal memuat berita. Periksa koneksi lalu coba lagi.', 'Failed to load the news. Check your connection and try again.')}</p>
            <button type="button" onClick={() => loadFeed(true)} className="font-bold text-emerald-400 hover:underline cursor-pointer">
              {L('Coba lagi', 'Try again')}
            </button>
          </div>
        </div>
      ) : status === 'loading' || status === 'idle' ? (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="border border-white/5 bg-white/[0.02] rounded-2xl p-5 space-y-3 animate-pulse">
              <div className="h-4 bg-white/5 rounded w-3/4" />
              <div className="h-3 bg-white/5 rounded w-1/3" />
            </div>
          ))}
        </div>
      ) : needsWatchlist ? (
        <div className="border border-border-color bg-card-bg rounded-2xl p-10 text-center flex flex-col items-center gap-3">
          <Star className="w-8 h-8 text-amber-400" />
          <h3 className="text-base font-bold text-white">{L('Belum ada saham yang dipantau', 'No watched stocks yet')}</h3>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            {L('Tambahkan saham ke watchlist, dan tab ini akan menampilkan berita khusus saham-saham tersebut.', 'Add stocks to your watchlist and this tab will show news about those stocks.')}
          </p>
          <button type="button" onClick={onOpenWatchlist} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold cursor-pointer">
            {L('Buka Watchlist', 'Open Watchlist')}
          </button>
        </div>
      ) : items.length === 0 ? (
        <div className="border border-border-color bg-card-bg rounded-2xl p-10 text-center flex flex-col items-center gap-3">
          <Newspaper className="w-8 h-8 text-emerald-400" />
          <h3 className="text-base font-bold text-white">{t('news.noNews')}</h3>
          <p className="text-xs text-slate-400 max-w-sm leading-relaxed">
            {tab === 'foryou' && !activeQuery
              ? L('Belum ada berita 7 hari terakhir untuk saham di watchlist Anda.', 'No news in the last 7 days for the stocks in your watchlist.')
              : t('news.noNewsDesc')}
          </p>
          {activeQuery && (
            <button type="button" onClick={clearSearch} className="px-4 py-2 rounded-xl border border-white/10 text-slate-200 text-xs font-semibold cursor-pointer hover:bg-white/5">
              {t('news.clearSearch')}
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-5">
          {groups.map((group) => (
            <section key={group.label} className="space-y-2.5">
              <h2 className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">{group.label}</h2>
              {group.items.map((item) => {
                const state = analyses[item.id];
                const isOpen = !!expanded[item.id];
                const sentiment = state?.status === 'ready' && state.data.mode === 'ai' ? SENTIMENT_STYLE[state.data.sentiment ?? 'neutral'] : null;
                return (
                  <motion.article
                    key={item.id}
                    initial={{ opacity: 0, y: 10 }}
                    whileInView={{ opacity: 1, y: 0 }}
                    viewport={{ once: true, margin: '0px 0px -30px 0px' }}
                    transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                    className="border border-border-color bg-card-bg rounded-2xl hover:border-emerald-500/30 transition-colors overflow-hidden"
                  >
                    <div className="p-4 md:p-5 space-y-3">
                      <a href={item.link} target="_blank" rel="noopener noreferrer" className="group block">
                        <h3 className="font-bold text-slate-100 text-sm md:text-[15px] leading-snug group-hover:text-emerald-400 transition-colors">
                          {item.title}
                          <ExternalLink className="inline h-3 w-3 ml-1.5 text-slate-600 group-hover:text-emerald-400" />
                        </h3>
                      </a>

                      <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-400">
                        <span className="font-semibold text-slate-300">{item.source}</span>
                        <span className="flex items-center gap-1 text-slate-500">
                          <Clock className="w-3 h-3" />
                          <time dateTime={item.pubDate}>{relativeTime(item.pubDate)}</time>
                        </span>
                        {sentiment && (
                          <span className={`px-1.5 py-0.5 rounded border text-[10px] font-bold ${sentiment.cls}`}>{sentiment[language]}</span>
                        )}
                      </div>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {item.tickers.map((tk) => (
                          <TickerChip key={tk} ticker={tk} quote={quotes[tk]} language={language} onSelect={onSelectTicker} />
                        ))}
                        <button
                          type="button"
                          onClick={() => toggleAnalysis(item)}
                          aria-expanded={isOpen}
                          className={`ml-auto px-3 py-1.5 rounded-lg text-[11px] font-bold flex items-center gap-1.5 cursor-pointer border transition-colors ${
                            isOpen
                              ? 'bg-emerald-500/15 border-emerald-500/35 text-emerald-400'
                              : 'bg-input-bg border-border-color hover:border-emerald-500/30 text-slate-300 hover:text-white'
                          }`}
                          title={!user ? L('Masuk untuk membuka Analisis AI', 'Sign in to unlock AI Analysis') : undefined}
                        >
                          <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                          {t('news.aiSummary')}
                          {user ? (isOpen ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />) : <Lock className="w-3 h-3 text-slate-400" />}
                        </button>
                      </div>
                    </div>

                    <AnimatePresence initial={false}>
                      {isOpen && user && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.25, ease: 'easeInOut' }}
                          className="border-t border-white/5 bg-black/20 overflow-hidden"
                        >
                          <div className="p-4 md:p-5 border-l-2 border-emerald-500/70">{renderAnalysis(item, state)}</div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.article>
                );
              })}
            </section>
          ))}

          {visibleCount < items.length && (
            <button
              type="button"
              onClick={() => setVisibleCount((c) => c + PAGE_SIZE)}
              className="w-full py-2.5 rounded-xl border border-white/10 text-xs font-bold text-slate-300 hover:text-white hover:bg-white/5 cursor-pointer"
            >
              {L(`Muat lebih banyak (${items.length - visibleCount} lagi)`, `Load more (${items.length - visibleCount} more)`)}
            </button>
          )}

          <p className="text-[10px] text-slate-500 text-center">
            {L('Sumber: Google News · berita 7 hari terakhir', 'Source: Google News · last 7 days')}
            {filteredUntrusted > 0 && L(
              ` · ${filteredUntrusted} berita dari media di luar daftar kurasi disembunyikan`,
              ` · ${filteredUntrusted} articles from outlets outside the curated list are hidden`
            )}
          </p>
        </div>
      )}
    </div>
  );
}
