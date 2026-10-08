'use client';

import * as React from 'react';
import { AlertTriangle, ChartCandlestick, Lock, RefreshCw, UserPlus } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Badge, Card, pct, pick, rp } from '@/components/shared/calc-ui';
import { CompanyLogo } from '@/components/company-logo';
import { QuickSearchTicker } from '@/components/quick-search-ticker';
import { useIdxSessionState } from '@/components/home/home-dashboard';
import { useLanguage } from '@/lib/language-context';
import { authFetch, classifyApiError, type ApiErrorKind } from '@/lib/auth-fetch';
import { usePolling } from '@/lib/use-polling';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';
import { formatIDRCompact, formatNumberLocale } from '@/lib/format';
import { consensus, fundamentalScore, newsScore, type ScorePoint } from '@/lib/analysis-score';
import type { AppUser } from '@/lib/types';
import type { FundamentalsData } from '@/lib/fundamentals-source';
import type { TechnicalResponse } from '@/app/api/analysis/technical/route';
import { ConsensusCard, type ConsensusPart } from './consensus-card';
import { SrLevels } from './sr-levels';
import { TechnicalPanel } from './technical-panel';
import { FlowPanel } from './flow-panel';
import { FundamentalsPanel } from './fundamentals-panel';
import { NewsPanel, type AnalysisNewsItem, type AnalysisSentiment } from './news-panel';

const POPULAR = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'GOTO', 'ADRO', 'ANTM', 'BRIS', 'AMRT', 'UNVR'];

type LoadError = ApiErrorKind | 'not_found';
interface Section<T> {
  symbol: string;
  data: T | null;
  error: LoadError | null;
}
interface NewsResponse {
  symbol: string;
  news: AnalysisNewsItem[];
  analysis: AnalysisSentiment;
}

async function loadSection<T>(path: string, symbol: string): Promise<{ data: T | null; error: LoadError | null }> {
  try {
    const res = await authFetch(`${path}?symbol=${encodeURIComponent(symbol)}`);
    if (res.ok) return { data: (await res.json()) as T, error: null };
    if (res.status === 404) return { data: null, error: 'not_found' };
    return { data: null, error: (await classifyApiError(res)).kind };
  } catch {
    return { data: null, error: 'failed' };
  }
}

/** Data lama untuk kode yang sama tetap ditampilkan bila pembaruan gagal (dengan penanda error). */
function merge<T>(prev: Section<T> | null, symbol: string, next: { data: T | null; error: LoadError | null }): Section<T> {
  if (next.data) return { symbol, data: next.data, error: null };
  if (prev && prev.symbol === symbol && prev.data) return { ...prev, error: next.error };
  return { symbol, data: null, error: next.error };
}

interface AnalysisTabProps {
  user: AppUser | null;
  isActive: boolean;
  onSignInClick: () => void;
  initialTicker?: string | null;
}

export function AnalysisTab({ user, isActive, onSignInClick, initialTicker }: AnalysisTabProps) {
  const { language } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);

  const [ticker, setTicker] = React.useState(() => (initialTicker ?? 'BBCA').toUpperCase().trim());
  const [prevInitial, setPrevInitial] = React.useState(initialTicker);
  if (initialTicker !== prevInitial) {
    setPrevInitial(initialTicker);
    if (initialTicker) setTicker(initialTicker.toUpperCase().trim());
  }

  const [live, setLive] = React.useState(true);
  const [tech, setTech] = React.useState<Section<TechnicalResponse> | null>(null);
  const [fund, setFund] = React.useState<Section<FundamentalsData> | null>(null);
  const [news, setNews] = React.useState<Section<NewsResponse> | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);

  const epoch = useDataRefreshEpoch();
  const { trading } = useIdxSessionState(isActive);
  const enabled = isActive && user !== null;
  const key = `${ticker}:${epoch}`;

  const loadTech = React.useCallback(async (symbol: string) => {
    const r = await loadSection<TechnicalResponse>('/api/analysis/technical', symbol);
    setTech((prev) => merge(prev, symbol, r));
  }, []);
  const loadFund = React.useCallback(async (symbol: string) => {
    const r = await loadSection<FundamentalsData>('/api/analysis/fundamentals', symbol);
    setFund((prev) => merge(prev, symbol, r));
  }, []);
  const loadNews = React.useCallback(async (symbol: string) => {
    const r = await loadSection<NewsResponse>('/api/analysis/news', symbol);
    setNews((prev) => merge(prev, symbol, r));
  }, []);

  // Harga & indikator: tiap 60 detik selama sesi bursa (server menyimpan cache 60 detik).
  usePolling(() => loadTech(ticker), { enabled, intervalMs: live && trading ? 60_000 : null, minGapMs: 60_000, key });
  // Fundamental berubah per kuartal: cukup sekali per kode saham.
  usePolling(() => loadFund(ticker), { enabled, intervalMs: null, minGapMs: 30 * 60_000, key });
  // Berita: tiap 10 menit saat LIVE.
  usePolling(() => loadNews(ticker), { enabled, intervalMs: live ? 10 * 60_000 : null, minGapMs: 5 * 60_000, key });

  const refreshAll = async () => {
    setRefreshing(true);
    await Promise.allSettled([loadTech(ticker), loadFund(ticker), loadNews(ticker)]);
    setRefreshing(false);
  };

  const selectTicker = (symbol: string) => {
    const clean = symbol.toUpperCase().replace(/\.JK$/, '').trim();
    if (clean) setTicker(clean);
  };

  const header = (
    <PageHeader
      icon={ChartCandlestick}
      eyebrow={L('Analisis', 'Analysis')}
      title={L('Analisis Saham Pro', 'Pro Stock Analysis')}
      description={L(
        'Teknikal multi-timeframe, 9 titik support & resistance, arus volume, fundamental, dan sentimen berita dalam satu layar. Semua angka dari data pasar nyata; yang tidak tersedia ditampilkan "—".',
        'Multi-timeframe technicals, 9 support & resistance levels, volume flow, fundamentals and news sentiment on one screen. All numbers come from real market data; anything unavailable shows "—".'
      )}
      actions={
        user && (
          <>
            <button
              type="button"
              onClick={() => setLive((v) => !v)}
              aria-pressed={live}
              title={L('Perbarui otomatis tiap 60 detik saat bursa buka', 'Auto-refresh every 60 seconds while the market is open')}
              className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-2 cursor-pointer ${live ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-400'}`}
            >
              <span className={`h-2 w-2 rounded-full ${live && trading ? 'bg-emerald-400 animate-pulse' : live ? 'bg-emerald-400/50' : 'bg-slate-500'}`} />
              {live ? (trading ? 'LIVE' : L('LIVE · bursa tutup', 'LIVE · market closed')) : L('Jeda', 'Paused')}
            </button>
            <button
              type="button"
              onClick={refreshAll}
              disabled={refreshing}
              className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-extrabold text-slate-200 flex items-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> {L('Perbarui', 'Refresh')}
            </button>
          </>
        )
      }
    />
  );

  if (!user) {
    return (
      <div className="space-y-6">
        {header}
        <Card className="flex flex-col items-center text-center gap-4 py-12">
          <span className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/25"><Lock className="h-8 w-8 text-emerald-400" /></span>
          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-lg font-black text-white">{L('Masuk untuk membuka analisis', 'Sign in to unlock analysis')}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{L('Analisis Saham Pro memakai kuota data dan AI, jadi hanya tersedia untuk akun terdaftar.', 'Pro Stock Analysis uses data and AI quota, so it is available to registered accounts only.')}</p>
          </div>
          <button type="button" onClick={onSignInClick} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold flex items-center gap-2 cursor-pointer">
            <UserPlus className="h-4 w-4" /> {L('Masuk / Daftar', 'Sign in / Register')}
          </button>
        </Card>
      </div>
    );
  }

  const t = tech?.symbol === ticker ? tech : null;
  const f = fund?.symbol === ticker ? fund : null;
  const n = news?.symbol === ticker ? news : null;
  const td = t?.data ?? null;
  const fd = f?.data ?? null;
  const nd = n?.data ?? null;

  const fScore = fd?.metrics ? fundamentalScore(fd.metrics, fd.sector) : null;
  const parts: ConsensusPart[] = [
    { key: 'technical', score: td?.summary.score ?? null, weight: 35 },
    { key: 'fundamental', score: fScore?.score ?? null, weight: 30 },
    { key: 'flow', score: td?.volumeFlow.score ?? null, weight: 20 },
    { key: 'news', score: nd ? newsScore(nd.analysis.sentiment, nd.analysis.method) : null, weight: 15 },
  ];
  const score = consensus({
    technical: parts[0].score,
    fundamental: parts[1].score,
    flow: parts[2].score,
    news: parts[3].score,
    riskLevel: td?.risk?.riskLevel ?? null,
  });
  const topSignals = [...(td?.signals ?? [])].sort((a, b) => b.weight - a.weight);
  const points: ScorePoint[] = [
    ...topSignals.filter((s) => s.signal === 'bull').slice(0, 3).map((s) => ({ text: `${s.indicator}: ${s.note}`, tone: 'pro' as const })),
    ...topSignals.filter((s) => s.signal === 'bear').slice(0, 3).map((s) => ({ text: `${s.indicator}: ${s.note}`, tone: 'con' as const })),
    ...(fScore?.points ?? []),
  ];

  const name = td?.name || fd?.name || ticker;
  const q = td?.quote;
  const up = (q?.change ?? 0) > 0;
  const down = (q?.change ?? 0) < 0;
  const asOf = td ? new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(new Date(td.asOf)) : null;
  const tvSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(`IDX:${ticker}`)}&interval=D&hidesidetoolbar=0&symboledit=0&saveimage=1&toolbarbg=161b22&theme=dark&style=1&timezone=Asia%2FJakarta&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%2C%22PivotPointsStandard%40tv-basicstudies%22%5D&locale=${language === 'id' ? 'id' : 'en'}`;

  const errorText = (e: LoadError) =>
    ({
      not_found: L(`Kode ${ticker} tidak ditemukan di sumber data.`, `${ticker} was not found in the data source.`),
      unauthenticated: L('Sesi login berakhir. Silakan masuk lagi.', 'Your session expired. Please sign in again.'),
      not_approved: L('Akun kamu masih menunggu persetujuan admin.', 'Your account is awaiting admin approval.'),
      rate_limited: L('Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.', 'Too many requests. Wait a moment and try again.'),
      auth_unavailable: L('Layanan login sedang tidak tersedia.', 'The sign-in service is unavailable.'),
      auth_check_failed: L('Gagal memeriksa sesi login.', 'Could not verify your session.'),
      failed: L('Sumber data sedang tidak bisa diakses.', 'The data source is currently unreachable.'),
    })[e];

  const placeholder = (section: Section<unknown> | null, label: string, retry: () => void, height = 'h-40') =>
    section?.error ? (
      <Card className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
          <div>
            <p className="text-sm font-bold text-white">{label}</p>
            <p className="text-xs text-slate-400 mt-0.5">{errorText(section.error)}</p>
          </div>
        </div>
        {section.error !== 'not_found' && (
          <button type="button" onClick={retry} className="px-3 py-2 rounded-xl border border-white/10 bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-200 cursor-pointer self-start sm:self-auto">
            {L('Coba lagi', 'Retry')}
          </button>
        )}
      </Card>
    ) : (
      <div className={`${height} rounded-3xl border border-white/10 bg-white/[0.02] animate-pulse`} aria-label={L('Memuat…', 'Loading…')} />
    );

  const staleNote = (section: Section<unknown> | null) =>
    section?.data && section.error ? (
      <p className="text-[11px] text-amber-400 flex items-center gap-1.5 -mt-3"><AlertTriangle className="h-3.5 w-3.5" />{L('Gagal memperbarui; menampilkan data terakhir.', 'Update failed; showing the last data.')} {errorText(section.error)}</p>
    ) : null;

  return (
    <div className="space-y-6">
      {header}

      <Card>
        <QuickSearchTicker language={language} onSelectTicker={selectTicker} />
        <div className="flex gap-1.5 mt-3 overflow-x-auto custom-scrollbar pb-1">
          {POPULAR.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => selectTicker(s)}
              aria-pressed={s === ticker}
              className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border shrink-0 cursor-pointer ${s === ticker ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}
            >
              {s}
            </button>
          ))}
        </div>
      </Card>

      {/* Ringkasan harga */}
      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <CompanyLogo symbol={ticker} size={48} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white">{ticker}</h2>
                {fd?.sector && <Badge>{fd.sector}</Badge>}
                {q?.suspect && <Badge tone="amber">{L('harga perlu dicek', 'price needs checking')}</Badge>}
              </div>
              <p className="text-xs text-slate-400 truncate">{name}</p>
            </div>
          </div>
          {q ? (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-2">
              <div>
                <span className="block text-3xl font-black text-white tabular-nums leading-none">{rp(q.price, language)}</span>
                <span className={`block text-sm font-bold tabular-nums mt-1 ${up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-slate-400'}`}>
                  {up ? '+' : ''}{formatNumberLocale(q.change, language)} ({up ? '+' : ''}{pct(q.changePercent, language, 2)})
                </span>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-4 gap-x-5 gap-y-1 text-[11px]">
                <div><dt className="text-slate-500">{L('Rentang hari ini', 'Day range')}</dt><dd className="font-mono text-slate-200">{q.dayLow !== null && q.dayHigh !== null ? `${formatNumberLocale(q.dayLow, language)} – ${formatNumberLocale(q.dayHigh, language)}` : '—'}</dd></div>
                <div><dt className="text-slate-500">{L('Rentang 52 minggu', '52-week range')}</dt><dd className="font-mono text-slate-200">{formatNumberLocale(q.yearLow, language)} – {formatNumberLocale(q.yearHigh, language)}</dd></div>
                <div><dt className="text-slate-500">Volume</dt><dd className="font-mono text-slate-200">{formatNumberLocale(Math.round(q.volume / 100), language)} lot</dd></div>
                <div><dt className="text-slate-500">{L('Nilai transaksi', 'Value traded')}</dt><dd className="font-mono text-slate-200">{formatIDRCompact(q.valueTraded, language)}</dd></div>
              </dl>
            </div>
          ) : t?.error ? (
            <p className="text-xs text-amber-400">{errorText(t.error)}</p>
          ) : (
            <div className="h-12 w-64 rounded-xl bg-white/[0.04] animate-pulse" />
          )}
        </div>
        {td && (
          <p className="text-[10px] text-slate-500 mt-3">
            {L('Data per', 'Data as of')} {asOf} WIB · {td.source.label}
            {td.source.delayed ? L(' · bisa tertunda hingga ~10 menit', ' · may be delayed up to ~10 minutes') : ''}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 !p-0 overflow-hidden flex">
          <iframe
            key={`${ticker}:${language}`}
            title={L(`Grafik ${ticker} dari TradingView`, `${ticker} chart from TradingView`)}
            src={tvSrc}
            loading="lazy"
            className="w-full h-[380px] md:h-[480px] lg:h-auto lg:min-h-[480px] border-0 block"
          />
        </Card>
        <ConsensusCard language={language} result={score} parts={parts} riskLevel={td?.risk?.riskLevel ?? null} points={points} />
      </div>

      {td ? (
        <>
          {staleNote(t)}
          <SrLevels language={language} data={td} />
          <TechnicalPanel language={language} data={td} />
          <FlowPanel language={language} data={td} />
        </>
      ) : (
        placeholder(t, L('Analisis teknikal', 'Technical analysis'), () => void loadTech(ticker), 'h-96')
      )}

      {fd ? (
        <>
          {staleNote(f)}
          <FundamentalsPanel language={language} data={fd} />
        </>
      ) : (
        placeholder(f, L('Fundamental', 'Fundamentals'), () => void loadFund(ticker), 'h-72')
      )}

      {nd ? (
        <>
          {staleNote(n)}
          <NewsPanel language={language} news={nd.news} analysis={nd.analysis} />
        </>
      ) : (
        placeholder(n, L('Sentimen berita', 'News sentiment'), () => void loadNews(ticker), 'h-48')
      )}
    </div>
  );
}
