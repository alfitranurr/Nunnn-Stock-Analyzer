'use client';

import * as React from 'react';
import { TrendingUp, TrendingDown, Wallet, Briefcase, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AppUser } from '@/lib/types';
import { loadPortfolio, type Holding } from '@/lib/portfolio-store';
import { fetchQuotes, type QuoteItem } from '@/lib/quotes';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';
import { formatIDRCompact, formatNumberLocale } from '@/lib/format';

interface PortfolioSnapshotProps {
  user: AppUser | null;
  language: 'id' | 'en';
  onOpenPortfolio: () => void;
  /** Bump this to force a re-fetch (e.g. when returning from portfolio tab). */
  refreshKey?: number;
}

export function PortfolioSnapshot({ user, language, onOpenPortfolio, refreshKey = 0 }: PortfolioSnapshotProps) {
  const [holdings, setHoldings] = React.useState<Holding[]>([]);
  // null = kas RDN belum pernah diatur (jangan tampilkan angka fiktif)
  const [cashBalance, setCashBalance] = React.useState<number | null>(null);
  const [quotes, setQuotes] = React.useState<Record<string, QuoteItem>>({});
  const [loading, setLoading] = React.useState(true);

  const isId = language === 'id';
  const money = (v: number) => formatIDRCompact(v, language);
  const refreshEpoch = useDataRefreshEpoch();

  // Sumber data sama dengan halaman Portofolio (lib/portfolio-store).
  const loadData = React.useCallback(async () => {
    if (!user) return;
    const data = await loadPortfolio(user);
    setHoldings(data.holdings);
    setCashBalance(data.cash);
    setLoading(false);
  }, [user]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData, refreshKey, refreshEpoch]);

  // Harga terkini semua saham dalam satu request.
  const tickersKey = holdings.map((h) => h.ticker.toUpperCase()).sort().join(',');
  React.useEffect(() => {
    if (!tickersKey) return;
    let cancelled = false;
    fetchQuotes(tickersKey.split(','))
      .then((data) => { if (!cancelled) setQuotes(data); })
      .catch(() => { /* tetap pakai avg price */ });
    return () => {
      cancelled = true;
    };
  }, [tickersKey, refreshEpoch]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="rounded-[20px] bg-card-bg border border-white/[0.04] p-5 animate-pulse h-[110px]" />
    );
  }

  // Calculate totals
  let totalInvested = 0;
  let totalMarketValue = 0;
  let todayPL = 0;
  let pricedCount = 0;

  holdings.forEach((h) => {
    const shares = h.lot * 100;
    const quote = quotes[h.ticker.toUpperCase()];
    const price = quote?.price ?? h.avg_price;
    totalInvested += shares * h.avg_price;
    totalMarketValue += shares * price;
    // Perubahan harga yang meragukan tidak dihitung ke P&L hari ini.
    if (quote && !quote.suspect) {
      todayPL += shares * quote.change;
      pricedCount += 1;
    }
  });

  const totalPL = totalMarketValue - totalInvested;
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
  const prevMarketValue = totalMarketValue - todayPL;
  const todayPLPct = prevMarketValue > 0 ? (todayPL / prevMarketValue) * 100 : 0;
  const totalEquity = totalMarketValue + (cashBalance ?? 0);

  if (holdings.length === 0) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-[20px] bg-card-bg border border-white/[0.04] p-5 md:p-6 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[12px] bg-accent/15 flex items-center justify-center shrink-0">
            <Briefcase className="h-[18px] w-[18px] text-accent" />
          </div>
          <div>
            <span className="title-display text-base text-white block">
              {isId ? 'Portofolio Kosong' : 'Empty Portfolio'}
            </span>
            <span className="text-xs text-slate-400">
              {isId ? 'Tambahkan saham untuk memantau P&L' : 'Add stocks to track P&L'}
            </span>
          </div>
        </div>
        <button
          onClick={onOpenPortfolio}
          className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-white transition-colors cursor-pointer flex items-center gap-1.5"
        >
          {isId ? 'Buka' : 'Open'}
          <ArrowRight className="h-3 w-3" />
        </button>
      </motion.div>
    );
  }

  const renderPL = (value: number, pct: number) => {
    const up = value >= 0;
    return (
      <>
        <span className={`flex items-center gap-1.5 font-display text-xl font-medium tracking-tight tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
          {up ? <TrendingUp className="h-4 w-4 shrink-0" /> : <TrendingDown className="h-4 w-4 shrink-0" />}
          {up ? '+' : ''}{money(value)}
        </span>
        <span className={`block text-xs font-semibold tabular-nums ${up ? 'text-emerald-400/80' : 'text-rose-400/80'}`}>
          {up ? '+' : ''}{formatNumberLocale(pct, language, 2)}%
        </span>
      </>
    );
  };

  const TILE = 'rounded-2xl bg-surface-2 px-4 py-3.5 min-w-0';
  const LABEL = 'flex items-center gap-1 text-xs text-slate-500 mb-1';
  const VALUE = 'block font-display text-xl font-medium tracking-tight text-white tabular-nums truncate';

  return (
    <motion.section
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-[20px] bg-card-bg border border-white/[0.04] p-5 md:p-6 flex flex-col gap-4"
      aria-labelledby="snapshot-title"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-accent" aria-hidden />
          <h2 id="snapshot-title" className="title-display text-lg text-white">
            {isId ? 'Ringkasan portofolio' : 'Portfolio snapshot'}
          </h2>
          <span className="px-2 py-0.5 rounded-full bg-surface-2 text-[11px] font-semibold text-slate-400">{holdings.length} {isId ? 'saham' : holdings.length === 1 ? 'stock' : 'stocks'}</span>
        </div>
        <button
          onClick={onOpenPortfolio}
          className="px-3 py-1.5 rounded-full bg-surface-2 hover:bg-surface-3 text-xs font-semibold text-white flex items-center gap-1.5 transition-colors cursor-pointer"
        >
          {isId ? 'Lihat detail' : 'View details'}
          <ArrowRight className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-2.5">
        <div className={`${TILE} col-span-2 md:col-span-1`}>
          <span className={LABEL}>{isId ? 'Total ekuitas' : 'Total equity'}</span>
          <span className={VALUE}>{money(totalEquity)}</span>
          <span className="block text-xs text-slate-500 truncate">{isId ? 'Nilai pasar' : 'Market value'} {money(totalMarketValue)}</span>
        </div>

        <div className={TILE}>
          <span className={LABEL}>{isId ? 'Modal' : 'Invested'}</span>
          <span className={VALUE}>{money(totalInvested)}</span>
          <span className="block text-xs text-slate-500">{isId ? 'lembar × harga rata-rata' : 'shares × average price'}</span>
        </div>

        <div className={TILE}>
          <span className={LABEL}>{isId ? 'P&L hari ini' : "Today's P&L"}</span>
          {pricedCount > 0 ? renderPL(todayPL, todayPLPct) : <span className={`${VALUE} text-slate-500`}>—</span>}
        </div>

        <div className={TILE}>
          <span className={LABEL}>{isId ? 'P&L floating' : 'Unrealized P&L'}</span>
          {renderPL(totalPL, totalPLPct)}
        </div>

        <div className={TILE}>
          <span className={LABEL}>
            <Wallet className="h-3.5 w-3.5" aria-hidden />
            {isId ? 'Kas RDN' : 'Cash (RDN)'}
          </span>
          {cashBalance !== null ? (
            <span className={VALUE}>{money(cashBalance)}</span>
          ) : (
            <button
              type="button"
              onClick={onOpenPortfolio}
              className="text-sm font-semibold text-slate-400 hover:text-white cursor-pointer"
            >
              {isId ? 'Belum diatur →' : 'Not set →'}
            </button>
          )}
        </div>
      </div>
    </motion.section>
  );
}
