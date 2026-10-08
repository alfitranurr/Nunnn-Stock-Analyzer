'use client';

import * as React from 'react';
import { Activity, AlertTriangle, Building2, ChartCandlestick, Layers, Lock, Loader2, Newspaper, Play, RotateCw, Sparkles, UserPlus, Waves } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { Badge, Card, pct, pick, rp } from '@/components/shared/calc-ui';
import { CompanyLogo } from '@/components/company-logo';
import { QuickSearchTicker } from '@/components/quick-search-ticker';
import { useIdxSessionState } from '@/components/home/home-dashboard';
import { useLanguage } from '@/lib/language-context';
import { authFetch, classifyApiError, type ApiErrorKind } from '@/lib/auth-fetch';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';
import { formatIDRCompact, formatNumberLocale } from '@/lib/format';
import { getAutoRejectionBounds, getAutoRejectionStatus } from '@/lib/calculator';
import { consensus, fundamentalScore, newsScore, type ScorePoint } from '@/lib/analysis-score';
import type { AppUser } from '@/lib/types';
import type { FundamentalsData } from '@/lib/fundamentals-source';
import type { TechnicalResponse } from '@/app/api/analysis/technical/route';
import { ConsensusCard, type ConsensusPart } from './consensus-card';
import { SrLevels } from './sr-levels';
import { TechnicalPanel } from './technical-panel';
import { FlowPanel } from './flow-panel';
import { FundamentalsPanel } from './fundamentals-panel';
import { NewsPanel, type AiState, type AnalysisNewsItem, type AnalysisSentiment } from './news-panel';

const POPULAR = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'GOTO', 'ADRO', 'ANTM', 'BRIS', 'AMRT', 'UNVR'];
const RECENT_KEY = 'nunnn_stock_analysis_recent';
const AI_PREF_KEY = 'nunnn_stock_analysis_ai';
const MAX_RECENT = 6;

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
  aiState: AiState;
}
interface Preview {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
}

// ─── Preferensi per pengunjung (localStorage, aman bila diblokir) ───
const STORE_EVENT = 'nunnn-analysis-store';
function subscribeStore(cb: () => void) {
  window.addEventListener('storage', cb);
  window.addEventListener(STORE_EVENT, cb);
  return () => {
    window.removeEventListener('storage', cb);
    window.removeEventListener(STORE_EVENT, cb);
  };
}
function readStore(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}
function writeStore(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Penyimpanan diblokir: preferensi hanya berlaku di sesi ini.
  }
  window.dispatchEvent(new Event(STORE_EVENT));
}
function useStored(key: string): string | null {
  return React.useSyncExternalStore(subscribeStore, () => readStore(key), () => null);
}
function parseRecent(raw: string | null): string[] {
  try {
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    return Array.isArray(list) ? list.filter((s): s is string => typeof s === 'string' && /^[A-Z]{1,5}$/.test(s)).slice(0, MAX_RECENT) : [];
  } catch {
    return [];
  }
}

async function loadSection<T>(url: string): Promise<{ data: T | null; error: LoadError | null }> {
  try {
    const res = await authFetch(url);
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

/**
 * Analisis Saham Pro. Tidak ada yang dimuat otomatis: pengguna memilih saham lalu menekan
 * "Analisis" (sentimen AI opsional), sehingga kuota AI hanya terpakai atas permintaan eksplisit.
 * Setelah itu hanya harga & teknikal yang diperbarui otomatis (LIVE, saat bursa buka).
 */
export function AnalysisTab({ user, isActive, onSignInClick, initialTicker }: AnalysisTabProps) {
  const { language } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const signedIn = user !== null;

  // Saham yang dipilih (belum tentu dianalisis) dan saham yang hasil analisisnya tampil.
  const [selected, setSelected] = React.useState<string | null>(() => initialTicker?.toUpperCase().trim() || null);
  const [prevInitial, setPrevInitial] = React.useState(initialTicker);
  if (initialTicker !== prevInitial) {
    setPrevInitial(initialTicker);
    if (initialTicker) setSelected(initialTicker.toUpperCase().trim());
  }
  const [run, setRun] = React.useState<string | null>(null);

  const [live, setLive] = React.useState(true);
  const [busy, setBusy] = React.useState(false);
  const [aiBusy, setAiBusy] = React.useState(false);
  const [preview, setPreview] = React.useState<Preview | null>(null);
  const [tech, setTech] = React.useState<Section<TechnicalResponse> | null>(null);
  const [fund, setFund] = React.useState<Section<FundamentalsData> | null>(null);
  const [news, setNews] = React.useState<Section<NewsResponse> | null>(null);

  const recentRaw = useStored(RECENT_KEY);
  const recent = React.useMemo(() => parseRecent(recentRaw), [recentRaw]);
  const aiOn = useStored(AI_PREF_KEY) !== '0';

  const epoch = useDataRefreshEpoch();
  const { trading } = useIdxSessionState(isActive);

  const loadTech = React.useCallback(async (symbol: string) => {
    const r = await loadSection<TechnicalResponse>(`/api/analysis/technical?symbol=${encodeURIComponent(symbol)}`);
    setTech((prev) => merge(prev, symbol, r));
  }, []);
  const loadFund = React.useCallback(async (symbol: string) => {
    const r = await loadSection<FundamentalsData>(`/api/analysis/fundamentals?symbol=${encodeURIComponent(symbol)}`);
    setFund((prev) => merge(prev, symbol, r));
  }, []);
  const loadNews = React.useCallback(async (symbol: string, ai: boolean) => {
    const r = await loadSection<NewsResponse>(`/api/analysis/news?symbol=${encodeURIComponent(symbol)}${ai ? '&ai=1' : ''}`);
    setNews((prev) => merge(prev, symbol, r));
  }, []);

  // Pratinjau harga saham terpilih (route publik, tanpa AI) agar pengguna yakin sebelum menganalisis.
  React.useEffect(() => {
    if (!selected || !isActive || !signedIn) return;
    let cancelled = false;
    fetch(`/api/ticker?symbol=${encodeURIComponent(selected)}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((j: Preview | null) => {
        if (!cancelled && j) setPreview({ symbol: selected, name: j.name, price: j.price, changePercent: j.changePercent });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [selected, isActive, signedIn]);

  // LIVE: hanya harga & teknikal, tiap 60 detik saat bursa buka dan halaman terlihat (tanpa AI).
  React.useEffect(() => {
    if (!run || !isActive || !live || !trading) return;
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadTech(run);
    }, 60_000);
    return () => window.clearInterval(id);
  }, [run, isActive, live, trading, loadTech]);

  // Tombol "Refresh semua data" di Admin: muat ulang data pasar (berita/AI tidak ikut).
  const lastEpoch = React.useRef(epoch);
  React.useEffect(() => {
    if (lastEpoch.current === epoch) return;
    lastEpoch.current = epoch;
    if (!run) return;
    const id = window.setTimeout(() => {
      void loadTech(run);
      void loadFund(run);
    }, 0);
    return () => window.clearTimeout(id);
  }, [epoch, run, loadTech, loadFund]);

  const choose = (symbol: string) => {
    const clean = symbol.toUpperCase().replace(/\.JK$/, '').trim();
    if (clean) setSelected(clean);
  };

  const analyze = async () => {
    if (!selected || busy) return;
    const symbol = selected;
    setRun(symbol);
    writeStore(RECENT_KEY, JSON.stringify([symbol, ...recent.filter((s) => s !== symbol)].slice(0, MAX_RECENT)));
    setBusy(true);
    await Promise.allSettled([loadTech(symbol), loadFund(symbol), loadNews(symbol, aiOn)]);
    setBusy(false);
  };

  const requestAi = async () => {
    if (!run || aiBusy) return;
    setAiBusy(true);
    await loadNews(run, true);
    setAiBusy(false);
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
        signedIn && run ? (
          <button
            type="button"
            onClick={() => setLive((v) => !v)}
            aria-pressed={live}
            title={L('Perbarui harga & teknikal tiap 60 detik saat bursa buka (tanpa AI)', 'Refresh price & technicals every 60 seconds while the market is open (no AI)')}
            className={`px-3 py-2 rounded-xl border text-xs font-extrabold flex items-center gap-2 cursor-pointer ${live ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-400'}`}
          >
            <span className={`h-2 w-2 rounded-full ${live && trading ? 'bg-emerald-400 animate-pulse' : live ? 'bg-emerald-400/50' : 'bg-slate-500'}`} />
            {live ? (trading ? 'LIVE' : L('LIVE · bursa tutup', 'LIVE · market closed')) : L('Jeda', 'Paused')}
          </button>
        ) : undefined
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

  const p = preview?.symbol === selected ? preview : null;
  const reanalyze = selected !== null && selected === run;

  const chipRow = (label: string, items: string[]) => (
    <div className="flex items-center gap-2 min-w-0">
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 shrink-0 w-16">{label}</span>
      <div className="flex gap-1.5 overflow-x-auto custom-scrollbar pb-1 min-w-0">
        {items.map((s) => (
          <button
            key={s}
            type="button"
            onClick={() => choose(s)}
            aria-pressed={s === selected}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-extrabold border shrink-0 cursor-pointer ${s === selected ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-400' : 'border-white/10 bg-white/5 text-slate-400 hover:text-white'}`}
          >
            {s}
          </button>
        ))}
      </div>
    </div>
  );

  const startCard = (
    <Card>
      <div className="space-y-3">
        <QuickSearchTicker language={language} onSelectTicker={choose} />
        {recent.length > 0 && chipRow(L('Terakhir', 'Recent'), recent)}
        {chipRow(L('Populer', 'Popular'), POPULAR)}
      </div>

      <div className="mt-4 p-3 sm:p-4 rounded-2xl border border-white/10 bg-white/[0.02] flex flex-col lg:flex-row lg:items-center gap-4">
        <div className="flex items-center gap-3 min-w-0 flex-1">
          {selected ? (
            <>
              <CompanyLogo symbol={selected} size={44} />
              <div className="min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-lg font-black text-white">{selected}</span>
                  {p?.price != null && <span className="text-sm font-bold text-white tabular-nums">{rp(p.price, language)}</span>}
                  {p?.changePercent != null && (
                    <span className={`text-xs font-bold tabular-nums ${p.changePercent > 0 ? 'text-emerald-400' : p.changePercent < 0 ? 'text-rose-400' : 'text-slate-400'}`}>
                      {p.changePercent > 0 ? '+' : ''}{pct(p.changePercent, language, 2)}
                    </span>
                  )}
                </div>
                <p className="text-xs text-slate-400 truncate">{p?.name ?? L('Memuat nama emiten…', 'Loading company name…')}</p>
              </div>
            </>
          ) : (
            <p className="text-sm text-slate-400">{L('Pilih saham lewat pencarian atau chip di atas, lalu tekan Analisis.', 'Pick a stock via search or the chips above, then press Analyze.')}</p>
          )}
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center gap-2 shrink-0">
          <button
            type="button"
            role="switch"
            aria-checked={aiOn}
            onClick={() => writeStore(AI_PREF_KEY, aiOn ? '0' : '1')}
            className={`px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center gap-2 cursor-pointer ${aiOn ? 'border-violet-500/30 bg-violet-500/10 text-violet-300' : 'border-white/10 bg-white/5 text-slate-400'}`}
          >
            <span className={`relative h-4 w-7 rounded-full transition-colors ${aiOn ? 'bg-violet-500' : 'bg-slate-600'}`}>
              <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all ${aiOn ? 'left-3.5' : 'left-0.5'}`} />
            </span>
            <Sparkles className="h-3.5 w-3.5" /> {L('Sentimen AI', 'AI sentiment')}
          </button>
          <button
            type="button"
            onClick={analyze}
            disabled={!selected || busy}
            className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed min-w-44"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : reanalyze ? <RotateCw className="h-4 w-4" /> : <Play className="h-4 w-4" />}
            {busy ? L('Menganalisis…', 'Analyzing…') : reanalyze ? L('Analisis ulang', 'Analyze again') : selected ? L(`Analisis ${selected}`, `Analyze ${selected}`) : L('Analisis', 'Analyze')}
          </button>
        </div>
      </div>

      <p className="text-[10px] text-slate-500 mt-2.5 leading-relaxed">
        {aiOn
          ? L(
              'Sentimen AI memakai kuota AI hanya saat tombol Analisis ditekan. Hasilnya disimpan ±30 menit, jadi analisis ulang saham yang sama dengan berita yang sama tidak memakai kuota lagi.',
              'AI sentiment uses AI quota only when you press Analyze. Results are kept for ~30 minutes, so re-analyzing the same stock with the same news costs nothing.'
            )
          : L(
              'Sentimen AI mati: sentimen diperkirakan dari kata kunci judul berita (tanpa kuota AI). AI tetap bisa diminta per saham dari panel Sentimen Berita.',
              'AI sentiment is off: sentiment is estimated from headline keywords (no AI quota). You can still request AI per stock from the News Sentiment panel.'
            )}{' '}
        {L('Mode LIVE hanya memperbarui harga & teknikal, tidak pernah memanggil AI.', 'LIVE mode only refreshes price & technicals and never calls AI.')}
      </p>
    </Card>
  );

  if (!run) {
    const features = [
      { icon: Layers, title: L('9 titik S/R berlabel', '9 labelled S/R levels'), desc: L('Klasik, Fibonacci, Camarilla + konfluensi', 'Classic, Fibonacci, Camarilla + confluence') },
      { icon: Activity, title: L('Teknikal multi-timeframe', 'Multi-timeframe technicals'), desc: L('Mingguan, harian, per jam + 10 indikator', 'Weekly, daily, hourly + 10 indicators') },
      { icon: Waves, title: L('Arus volume & dana', 'Volume & money flow'), desc: L('CMF, MFI, OBV, rasio volume', 'CMF, MFI, OBV, volume ratio') },
      { icon: Building2, title: L('Fundamental', 'Fundamentals'), desc: L('Valuasi, profitabilitas, riwayat laba', 'Valuation, profitability, earnings history') },
      { icon: Newspaper, title: L('Sentimen berita', 'News sentiment'), desc: L('AI opsional, berita 7 hari', 'Optional AI, 7-day news') },
    ];
    return (
      <div className="space-y-6">
        {header}
        {startCard}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          {features.map((f, i) => (
            <div key={f.title} className={`p-4 rounded-2xl border border-white/10 bg-white/[0.02] ${i === features.length - 1 ? 'col-span-2 lg:col-span-1' : ''}`}>
              <f.icon className="h-5 w-5 text-emerald-400" />
              <p className="text-sm font-bold text-white mt-2">{f.title}</p>
              <p className="text-[11px] text-slate-400 mt-0.5 leading-snug">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ─── Hasil analisis untuk `run` ───
  const t = tech?.symbol === run ? tech : null;
  const f = fund?.symbol === run ? fund : null;
  const n = news?.symbol === run ? news : null;
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

  const name = td?.name || fd?.name || run;
  const q = td?.quote;
  const up = (q?.change ?? 0) > 0;
  const down = (q?.change ?? 0) < 0;
  const asOfMs = td ? Date.parse(td.asOf) : null;
  const asOf = asOfMs !== null ? new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' }).format(asOfMs) : null;
  // Batas auto rejection papan reguler dari harga acuan (penutupan sebelumnya) pada tanggal data.
  const limits = q && q.previousClose > 0 && asOfMs !== null ? getAutoRejectionBounds(q.previousClose, asOfMs) : null;
  const arStatus = q && asOfMs !== null ? getAutoRejectionStatus(q.previousClose, q.price, asOfMs) : null;
  const tvSrc = `https://s.tradingview.com/widgetembed/?frameElementId=tradingview_chart&symbol=${encodeURIComponent(`IDX:${run}`)}&interval=D&hidesidetoolbar=0&symboledit=0&saveimage=1&toolbarbg=161b22&theme=dark&style=1&timezone=Asia%2FJakarta&studies=%5B%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%2C%22PivotPointsStandard%40tv-basicstudies%22%5D&locale=${language === 'id' ? 'id' : 'en'}`;

  const errorText = (e: LoadError) =>
    ({
      not_found: L(`Kode ${run} tidak ditemukan di sumber data.`, `${run} was not found in the data source.`),
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
      {startCard}

      {/* Ringkasan harga */}
      <Card>
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
          <div className="flex items-center gap-3 min-w-0">
            <CompanyLogo symbol={run} size={48} />
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-xl font-black text-white">{run}</h2>
                {fd?.sector && <Badge>{fd.sector}</Badge>}
                {arStatus && <Badge tone={arStatus === 'ARA' ? 'emerald' : 'amber'}>{arStatus}</Badge>}
                {q?.suspect && <Badge tone="amber">{L('harga perlu dicek', 'price needs checking')}</Badge>}
              </div>
              <p className="text-xs text-slate-400 truncate">{name}</p>
            </div>
          </div>
          {q ? (
            <div className="flex flex-wrap items-end gap-x-6 gap-y-3">
              <div>
                <span className="block text-3xl font-black text-white tabular-nums leading-none">{rp(q.price, language)}</span>
                <span className={`block text-sm font-bold tabular-nums mt-1 ${up ? 'text-emerald-400' : down ? 'text-rose-400' : 'text-slate-400'}`}>
                  {up ? '+' : ''}{formatNumberLocale(q.change, language)} ({up ? '+' : ''}{pct(q.changePercent, language, 2)})
                </span>
              </div>
              <dl className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-x-5 gap-y-1.5 text-[11px]">
                <div><dt className="text-slate-500">{L('Rentang hari ini', 'Day range')}</dt><dd className="font-mono text-slate-200">{q.dayLow !== null && q.dayHigh !== null ? `${formatNumberLocale(q.dayLow, language)} – ${formatNumberLocale(q.dayHigh, language)}` : '—'}</dd></div>
                <div>
                  <dt className="text-slate-500" title={L('Batas auto rejection papan reguler dari penutupan sebelumnya', 'Regular-board auto-rejection limits from the previous close')}>{L('Batas ARB – ARA', 'ARB – ARA limit')}</dt>
                  <dd className="font-mono text-slate-200">{limits ? `${formatNumberLocale(limits.lower, language)} – ${formatNumberLocale(limits.upper, language)}` : '—'}</dd>
                </div>
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
            {limits && q
              ? q.previousClose <= 10
                ? L(' · ARA/ARB ±Rp1 (harga acuan Rp1–Rp10, papan reguler)', ' · ARA/ARB ±Rp1 (reference price Rp1–Rp10, regular board)')
                : L(` · ARA +${limits.upPct}% / ARB −${limits.downPct}% (papan reguler)`, ` · ARA +${limits.upPct}% / ARB −${limits.downPct}% (regular board)`)
              : ''}
          </p>
        )}
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2 !p-0 overflow-hidden flex">
          <iframe
            key={`${run}:${language}`}
            title={L(`Grafik ${run} dari TradingView`, `${run} chart from TradingView`)}
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
        placeholder(t, L('Analisis teknikal', 'Technical analysis'), () => void loadTech(run), 'h-96')
      )}

      {fd ? (
        <>
          {staleNote(f)}
          <FundamentalsPanel language={language} data={fd} />
        </>
      ) : (
        placeholder(f, L('Fundamental', 'Fundamentals'), () => void loadFund(run), 'h-72')
      )}

      {nd ? (
        <>
          {staleNote(n)}
          <NewsPanel language={language} news={nd.news} analysis={nd.analysis} aiState={nd.aiState} aiBusy={aiBusy} onRequestAi={requestAi} />
        </>
      ) : (
        placeholder(n, L('Sentimen berita', 'News sentiment'), () => void loadNews(run, false), 'h-48')
      )}
    </div>
  );
}
