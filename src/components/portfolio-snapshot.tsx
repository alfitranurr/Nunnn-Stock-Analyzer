'use client';

import * as React from 'react';
import { TrendingUp, TrendingDown, Wallet, Briefcase, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AppUser } from '@/lib/types';
import { loadPortfolio, type Holding } from '@/lib/portfolio-store';
import { fetchQuotes, type QuoteItem } from '@/lib/quotes';
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
  }, [loadData, refreshKey]);

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
  }, [tickersKey]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 animate-pulse h-[110px]" />
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
        className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 flex items-center justify-between gap-4"
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
            <Briefcase className="h-5 w-5 text-emerald-400" />
          </div>
          <div>
            <span className="text-xs font-bold text-white block">
              {isId ? 'Portofolio Kosong' : 'Empty Portfolio'}
            </span>
            <span className="text-[10px] text-slate-400">
              {isId ? 'Tambahkan saham untuk memantau P&L' : 'Add stocks to track P&L'}
            </span>
          </div>
        </div>
        <button
          onClick={onOpenPortfolio}
          className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-400 text-[10px] font-bold transition-all cursor-pointer flex items-center gap-1"
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
      <span className={`text-base font-black tracking-tight flex items-center gap-1 flex-wrap tabular-nums ${up ? 'text-emerald-400' : 'text-rose-400'}`}>
        {up ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
        {up ? '+' : ''}{money(value)}
        <span className="text-[10px] font-semibold">({up ? '+' : ''}{formatNumberLocale(pct, language, 2)}%)</span>
      </span>
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 md:p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            {isId ? 'Ringkasan Portofolio' : 'Portfolio Snapshot'}
          </span>
          <span className="text-[10px] text-slate-600">{holdings.length} {isId ? 'saham' : holdings.length === 1 ? 'stock' : 'stocks'}</span>
        </div>
        <button
          onClick={onOpenPortfolio}
          className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 transition-colors cursor-pointer"
        >
          {isId ? 'Lihat Detail' : 'View Detail'}
          <ArrowRight className="h-3 w-3" />
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div>
          <span className="text-[10px] text-slate-500 block">{isId ? 'Total Ekuitas' : 'Total Equity'}</span>
          <span className="text-base font-black text-white tracking-tight tabular-nums">{money(totalEquity)}</span>
          <span className="text-[10px] text-slate-500 block">{isId ? 'Nilai pasar' : 'Market value'} {money(totalMarketValue)}</span>
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block">{isId ? 'P&L Hari Ini' : "Today's P&L"}</span>
          {pricedCount > 0 ? (
            renderPL(todayPL, todayPLPct)
          ) : (
            <span className="text-base font-black text-slate-500">—</span>
          )}
        </div>

        <div>
          <span className="text-[10px] text-slate-500 block">{isId ? 'P&L Total (Floating)' : 'Total P&L (Unrealized)'}</span>
          {renderPL(totalPL, totalPLPct)}
        </div>

        <div>
          <span className="text-[10px] text-slate-500 flex items-center gap-0.5">
            <Wallet className="h-2.5 w-2.5" />
            {isId ? 'Kas RDN' : 'Cash (RDN)'}
          </span>
          {cashBalance !== null ? (
            <span className="text-base font-black text-white tracking-tight tabular-nums">{money(cashBalance)}</span>
          ) : (
            <button
              type="button"
              onClick={onOpenPortfolio}
              className="text-[11px] font-bold text-slate-400 hover:text-emerald-400 cursor-pointer"
            >
              {isId ? 'Belum diatur →' : 'Not set →'}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
