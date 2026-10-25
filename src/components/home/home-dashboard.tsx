'use client';

import * as React from 'react';
import {
  Sparkles,
  ChartCandlestick,
  Newspaper,
  Calculator,
  Sprout,
  Percent,
  HandCoins,
  Rocket,
  Briefcase,
  Lock,
  ArrowRight,
  Cloud,
  HardDrive,
} from 'lucide-react';
import type { AppUser } from '@/lib/types';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useLanguage } from '@/lib/language-context';
import { usePolling, useNow } from '@/lib/use-polling';
import { LIVE_POLL_MS, useDataRefreshEpoch } from '@/lib/refresh-signal';
import { getEffectiveIdxSession, getWibGreeting, isTradingWindow, type IdxSession } from '@/lib/market-hours';
import { QuickSearchTicker } from '@/components/quick-search-ticker';
import { PortfolioSnapshot } from '@/components/portfolio-snapshot';
import { TrendingNewsStrip } from '@/components/trending-news-strip';
import { EducationalTipCard } from '@/components/educational-tip-card';
import { WatchlistPanel } from '@/components/watchlist-panel';
import { MarketStatusBar } from './market-status-bar';
import { ListingCoverage } from './listing-coverage';
import { MarketOverview } from './market-overview';
import { MarketMovers } from './market-movers';
import { GlobalMarkets } from './global-markets';
import { HOME_SPLIT, type MarketSummaryData } from './types';

/** Status sesi BEI yang diperbarui tiap 30 detik selama `enabled`. */
export function useIdxSessionState(enabled: boolean, lastIndexTradeSec?: number | null) {
  const now = useNow(enabled ? 30_000 : null);
  const session: IdxSession | null = now === null ? null : getEffectiveIdxSession(now, lastIndexTradeSec);
  return { now, session, trading: session !== null && isTradingWindow(session) };
}

interface HomeDashboardProps {
  user: AppUser | null;
  isActive: boolean;
  portfolioRefreshKey: number;
  onNavigate: (tab: string) => void;
  onSelectTicker: (symbol: string) => void;
  onSignInClick: () => void;
}

const QUICK_ACCESS = [
  { tab: 'analysis', icon: ChartCandlestick, title: { id: 'Analisis Saham', en: 'Stock Analysis' }, sub: { id: 'Teknikal, fundamental, bandar', en: 'Technical, fundamental, flow' }, locked: true },
  { tab: 'news', icon: Newspaper, title: { id: 'Berita & Sentimen', en: 'News & Sentiment' }, sub: { id: 'Rangkuman AI', en: 'AI summaries' } },
  { tab: 'avg-down', icon: Calculator, title: { id: 'Average Down', en: 'Average Down' }, sub: { id: 'Floating loss, fee & BEP', en: 'Floating loss, fees & BEP' } },
  { tab: 'compounding', icon: Sprout, title: { id: 'Compounding', en: 'Compounding' }, sub: { id: 'Harian, bulanan, tahunan', en: 'Daily, monthly, yearly' } },
  { tab: 'percentage', icon: Percent, title: { id: 'Persentase', en: 'Percentage' }, sub: { id: 'Naik/turun berapa %', en: 'Increase/decrease %' } },
  { tab: 'dividend', icon: HandCoins, title: { id: 'Kalkulator Dividen', en: 'Dividend Calculator' }, sub: { id: 'Passive income & pajak', en: 'Passive income & tax' } },
  { tab: 'ipo', icon: Rocket, title: { id: 'Jatah E-IPO', en: 'E-IPO Allotment' }, sub: { id: 'Pooling & clawback', en: 'Pooling & clawback' } },
  { tab: 'portfolio', icon: Briefcase, title: { id: 'Portofolio Saya', en: 'My Portfolio' }, sub: { id: 'P&L & kas RDN', en: 'P&L & cash' }, locked: true },
] as const;

export function HomeDashboard({ user, isActive, portfolioRefreshKey, onNavigate, onSelectTicker, onSignInClick }: HomeDashboardProps) {
  const { t, language } = useLanguage();
  const isId = language === 'id';

  // ─── Data pasar (satu sumber untuk status, IHSG, breadth, movers) ───
  const [minValue, setMinValue] = React.useState(1e9);
  const [data, setData] = React.useState<MarketSummaryData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [refreshing, setRefreshing] = React.useState(false);
  const [error, setError] = React.useState(false);

  const loadMarket = React.useCallback(async () => {
    setRefreshing(true);
    try {
      const res = await fetch(`/api/market-summary?minValue=${minValue}`);
      if (!res.ok) throw new Error(String(res.status));
      setData(await res.json());
      setError(false);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [minValue]);

  const { now, session, trading } = useIdxSessionState(isActive, data?.ihsg.marketTime);

  // Refresh tiap 30 detik hanya saat jam bursa, tab Beranda aktif, dan browser terlihat.
  // Admin menekan "Refresh semua data" → ambil ulang segera.
  const refreshEpoch = useDataRefreshEpoch();
  usePolling(loadMarket, { enabled: isActive, intervalMs: trading ? LIVE_POLL_MS : null, minGapMs: 15_000, key: `${minValue}|${refreshEpoch}` });

  const updatedAt = data ? Date.parse(data.scannedAt) || null : null;
  const userName = user?.email?.split('@')[0];

  return (
    <div className="space-y-4 md:space-y-5">
      {/* Sapaan (login) atau hero ringkas (pengunjung baru) */}
      {user ? (
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="title-display text-[28px] md:text-[34px] leading-tight text-white">
              {now ? getWibGreeting(now, language) : isId ? 'Halo' : 'Hello'}, <span className="text-emerald-400">{userName}</span>
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              {isId ? 'Ringkasan pasar dan saham pantauan Anda hari ini.' : 'Your market overview and watched stocks for today.'}
            </p>
          </div>
          <span className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-card-bg text-xs font-semibold text-slate-300">
            {isSupabaseConfigured && !user.isMock ? <Cloud className="h-3.5 w-3.5 text-emerald-400" /> : <HardDrive className="h-3.5 w-3.5 text-slate-400" />}
            {isSupabaseConfigured && !user.isMock ? (isId ? 'Mode Cloud' : 'Cloud mode') : (isId ? 'Mode Lokal' : 'Local mode')}
          </span>
        </div>
      ) : (
        <div className="rounded-[20px] hero-surface border border-white/[0.04] p-5 md:p-7">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.07] text-xs font-semibold text-slate-200">
                <Sparkles className="h-3.5 w-3.5 text-accent" />
                {t('cover.sparkles')}
              </span>
              <h1 className="title-display text-[28px] md:text-4xl leading-[1.08] text-white">
                {t('cover.title1')} <span className="text-profit-glow">{t('cover.title2')}</span>
              </h1>
              <p className="text-sm text-slate-300/80 leading-relaxed max-w-2xl">{t('cover.desc')}</p>
            </div>
            <button
              type="button"
              onClick={onSignInClick}
              className="self-start md:self-center shrink-0 px-6 py-2.5 rounded-full bg-white hover:bg-white/85 text-slate-950 font-semibold text-sm transition-colors cursor-pointer"
            >
              {t('sidebar.login')}
            </button>
          </div>
        </div>
      )}

      {/* Status pasar + pencarian */}
      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] gap-3 items-center">
        <MarketStatusBar
          language={language}
          session={session}
          now={now}
          updatedAt={updatedAt}
          refreshing={refreshing}
          onRefresh={loadMarket}
          source={data?.source ?? null}
        />
        <QuickSearchTicker language={language} onSelectTicker={onSelectTicker} />
      </div>

      <MarketOverview language={language} data={data} loading={loading} trading={trading} error={error} />

      <ListingCoverage language={language} isActive={isActive} />

      <GlobalMarkets language={language} isActive={isActive} />

      <div className={`${HOME_SPLIT} items-stretch`}>
        <div className="min-w-0">
          <MarketMovers
            language={language}
            data={data}
            loading={loading}
            minValue={minValue}
            onMinValueChange={setMinValue}
            onSelectTicker={onSelectTicker}
            trading={trading}
          />
        </div>
        <WatchlistPanel
          language={language}
          isActive={isActive}
          trading={trading}
          onSelectTicker={onSelectTicker}
          onOpenFull={() => onNavigate('watchlist')}
        />
      </div>

      {user && (
        <PortfolioSnapshot
          user={user}
          language={language}
          onOpenPortfolio={() => onNavigate('portfolio')}
          refreshKey={portfolioRefreshKey}
        />
      )}

      <div className={HOME_SPLIT}>
        <div className="min-w-0">
          <TrendingNewsStrip language={language} />
        </div>
        <EducationalTipCard language={language} market={data} />
      </div>

      {/* Akses cepat */}
      <section aria-label={isId ? 'Akses cepat' : 'Quick access'}>
        <h2 className="mb-3 title-display text-lg text-white">
          {isId ? 'Akses cepat' : 'Quick access'}
        </h2>
        <div className="grid grid-cols-1 min-[420px]:grid-cols-2 md:grid-cols-4 gap-3">
          {QUICK_ACCESS.map((item) => {
            const Icon = item.icon;
            const locked = 'locked' in item && item.locked && !user;
            return (
              <button
                key={item.tab}
                type="button"
                onClick={() => onNavigate(item.tab)}
                className="group p-4 rounded-2xl bg-card-bg hover:bg-surface-2 border border-white/[0.04] flex items-center gap-3 text-left transition-colors cursor-pointer"
              >
                <span className="w-10 h-10 shrink-0 rounded-[12px] bg-accent/15 flex items-center justify-center">
                  <Icon className="h-[18px] w-[18px] text-accent" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-1 font-semibold text-sm text-white">
                    <span className="truncate">{item.title[language]}</span>
                    {locked && <Lock className="h-3 w-3 text-slate-500 shrink-0" />}
                  </span>
                  <span className="block text-xs text-slate-500 truncate">{item.sub[language]}</span>
                </span>
                <ArrowRight className="h-4 w-4 text-slate-600 group-hover:text-white group-hover:translate-x-0.5 transition-transform shrink-0 hidden sm:block" />
              </button>
            );
          })}
        </div>
      </section>

      {/* Disclaimer */}
      <div className="max-w-3xl mx-auto w-full px-4 py-3 text-[11px] md:text-xs text-slate-500 leading-relaxed text-center">
        {t('common.disclaimer')}
      </div>
    </div>
  );
}
