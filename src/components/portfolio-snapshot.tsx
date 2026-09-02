'use client';

import * as React from 'react';
import { TrendingUp, TrendingDown, Wallet, Briefcase, ArrowRight } from 'lucide-react';
import { motion } from 'framer-motion';
import type { AppUser } from '@/lib/types';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';

interface Holding {
  id: string;
  ticker: string;
  company_name?: string;
  lot: number;
  avg_price: number;
}

interface PortfolioSnapshotProps {
  user: AppUser | null;
  language: 'id' | 'en';
  onOpenPortfolio: () => void;
  /** Bump this to force a re-fetch (e.g. when returning from portfolio tab). */
  refreshKey?: number;
}

export function PortfolioSnapshot({ user, language, onOpenPortfolio, refreshKey = 0 }: PortfolioSnapshotProps) {
  const [holdings, setHoldings] = React.useState<Holding[]>([]);
  const [cashBalance, setCashBalance] = React.useState(0);
  const [currentPrices, setCurrentPrices] = React.useState<Record<string, number>>({});
  const [loading, setLoading] = React.useState(true);

  const isId = language === 'id';

  const formatShortIDR = (value: number) => {
    if (Math.abs(value) >= 1e12) return `Rp ${(value / 1e12).toFixed(1)}T`;
    if (Math.abs(value) >= 1e9) return `Rp ${(value / 1e9).toFixed(1)}B`;
    if (Math.abs(value) >= 1e6) return `Rp ${(value / 1e6).toFixed(1)}M`;
    if (Math.abs(value) >= 1e3) return `Rp ${(value / 1e3).toFixed(0)}K`;
    return `Rp ${value.toFixed(0)}`;
  };

  const loadFromLocalStorage = React.useCallback(() => {
    if (!user) return;
    try {
      const storedHoldings = localStorage.getItem(`nunnn_stock_portfolio_holdings_${user.id}`);
      const storedCash = localStorage.getItem(`nunnn_stock_portfolio_cash_${user.id}`);

      if (storedHoldings) {
        setHoldings(JSON.parse(storedHoldings));
      }
      setCashBalance(storedCash ? parseFloat(storedCash) : 100000000);
    } catch {
      // ignore
    }
  }, [user]);

  // Load holdings + cash from Supabase (if configured) or localStorage.
  // Mirrors the logic in PortfolioTab.fetchData so the snapshot stays in sync.
  const loadData = React.useCallback(async () => {
    if (!user) return;

    if (isSupabaseConfigured && !user.isMock) {
      try {
        // Fetch cash
        const { data: cashDataArray } = await supabase
          .from('portfolio_cash')
          .select('cash_balance')
          .eq('user_id', user.id);

        if (cashDataArray && cashDataArray.length > 0) {
          setCashBalance(Number(cashDataArray[0].cash_balance));
        } else {
          setCashBalance(100000000); // Default Rp 100M
        }

        // Fetch holdings
        const { data: holdingsData } = await supabase
          .from('portfolio_holdings')
          .select('*')
          .order('ticker');

        setHoldings(
          (holdingsData || []).map((h: Record<string, unknown>) => ({
            id: h.id as string,
            ticker: h.ticker as string,
            company_name: h.company_name as string | undefined,
            lot: h.lot as number,
            avg_price: Number(h.avg_price),
          }))
        );
      } catch {
        // Fall back to localStorage on error
        loadFromLocalStorage();
      }
    } else {
      loadFromLocalStorage();
    }

    setLoading(false);
  }, [user, loadFromLocalStorage]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      loadData();
    }, 0);
    return () => clearTimeout(timer);
  }, [loadData, refreshKey]);

  // Fetch current prices for holdings (batched, same pattern as portfolio-tab).
  React.useEffect(() => {
    if (holdings.length === 0) return;

    let cancelled = false;
    const missing = holdings
      .map((h) => h.ticker.toUpperCase())
      .filter((sym) => currentPrices[sym] === undefined);

    if (missing.length === 0) return;

    (async () => {
      const CONCURRENCY = 4;
      for (let i = 0; i < missing.length; i += CONCURRENCY) {
        if (cancelled) break;
        const batch = missing.slice(i, i + CONCURRENCY);
        await Promise.all(
          batch.map(async (symbol) => {
            try {
              const res = await fetch(`/api/ticker?symbol=${symbol}`);
              if (res.ok) {
                const data = await res.json();
                if (!cancelled && data.price) {
                  setCurrentPrices((prev) => ({ ...prev, [symbol]: data.price }));
                }
              }
            } catch {
              // ignore
            }
          })
        );
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [holdings]);

  if (!user) return null;

  if (loading) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 animate-pulse h-[110px]" />
    );
  }

  // Calculate totals
  let totalInvested = 0;
  let totalMarketValue = 0;

  holdings.forEach((h) => {
    const shares = h.lot * 100;
    const price = currentPrices[h.ticker.toUpperCase()] ?? h.avg_price;
    totalInvested += shares * h.avg_price;
    totalMarketValue += shares * price;
  });

  const totalPL = totalMarketValue - totalInvested;
  const totalPLPct = totalInvested > 0 ? (totalPL / totalInvested) * 100 : 0;
  const totalEquity = totalMarketValue + cashBalance;
  const isProfit = totalPL >= 0;

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="rounded-2xl bg-white/[0.02] border border-white/5 p-5"
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            {isId ? 'Ringkasan Portofolio' : 'Portfolio Snapshot'}
          </span>
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
        {/* Total Equity */}
        <div>
          <span className="text-[10px] text-slate-500 block">
            {isId ? 'Total Ekuitas' : 'Total Equity'}
          </span>
          <span className="text-base font-black text-white tracking-tight">
            {formatShortIDR(totalEquity)}
          </span>
        </div>

        {/* Market Value */}
        <div>
          <span className="text-[10px] text-slate-500 block">
            {isId ? 'Nilai Pasar' : 'Market Value'}
          </span>
          <span className="text-base font-black text-white tracking-tight">
            {formatShortIDR(totalMarketValue)}
          </span>
        </div>

        {/* Unrealized P&L */}
        <div>
          <span className="text-[10px] text-slate-500 block">
            {isId ? 'Profit/Loss' : 'Unrealized P&L'}
          </span>
          <span
            className={`text-base font-black tracking-tight flex items-center gap-1 ${
              isProfit ? 'text-emerald-400' : 'text-rose-400'
            }`}
          >
            {isProfit ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
            {formatShortIDR(totalPL)}
            <span className="text-[10px] font-semibold">
              ({isProfit ? '+' : ''}{totalPLPct.toFixed(2)}%)
            </span>
          </span>
        </div>

        {/* Buying Power */}
        <div>
          <span className="text-[10px] text-slate-500 block flex items-center gap-0.5">
            <Wallet className="h-2.5 w-2.5" />
            {isId ? 'Kekuatan Beli (RDN)' : 'Buying Power'}
          </span>
          <span className="text-base font-black text-white tracking-tight">
            {formatShortIDR(cashBalance)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
