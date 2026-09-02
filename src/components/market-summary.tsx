'use client';

import * as React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { motion } from 'framer-motion';

interface MarketData {
  ihsg: {
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    dayHigh: number;
    dayLow: number;
    yearHigh: number;
    yearLow: number;
    name: string;
  };
  topGainers: StockMover[];
  topLosers: StockMover[];
  timestamp: string;
}

interface StockMover {
  symbol: string;
  name: string;
  price: number;
  change: number;
  changePercent: number;
}

export function MarketSummary({ language }: { language: 'id' | 'en' }) {
  const [data, setData] = React.useState<MarketData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState(false);

  const isId = language === 'id';

  const fetchData = React.useCallback(async () => {
    try {
      setError(false);
      const res = await fetch('/api/market-summary');
      if (!res.ok) throw new Error('Failed to fetch');
      const json = await res.json();
      setData(json);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchData();
    }, 0);
    const interval = setInterval(fetchData, 60000);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
    };
  }, [fetchData]);

  const fmtNum = (val: number, digits = 2) =>
    new Intl.NumberFormat('en-US', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits,
    }).format(val);

  const fmtVol = (val: number) => {
    if (val >= 1e9) return `${fmtNum(val / 1e9, 2)}B`;
    if (val >= 1e6) return `${fmtNum(val / 1e6, 2)}M`;
    if (val >= 1e3) return `${fmtNum(val / 1e3, 1)}K`;
    return fmtNum(val, 0);
  };

  if (loading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 animate-pulse h-[120px]"
          />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 text-center text-xs text-slate-500">
        {isId
          ? 'Gagal memuat data pasar. Coba refresh halaman.'
          : 'Failed to load market data. Try refreshing the page.'}
      </div>
    );
  }

  const isUp = data.ihsg.change >= 0;
  const changeColor = isUp ? 'text-emerald-400' : 'text-rose-400';
  const ChangeIcon = isUp ? TrendingUp : TrendingDown;

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
      {/* IHSG Index Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 flex flex-col gap-3"
      >
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
            {isId ? 'Indeks IHSG' : 'IHSG Index'}
          </span>
          <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
        </div>
        <div>
          <div className="flex items-baseline gap-2">
            <span className="text-2xl font-black text-white tracking-tight">
              {fmtNum(data.ihsg.price, 2)}
            </span>
            <span className={`text-sm font-bold ${changeColor} flex items-center gap-0.5`}>
              <ChangeIcon className="h-3.5 w-3.5" />
              {isUp ? '+' : ''}{fmtNum(data.ihsg.change, 2)} ({isUp ? '+' : ''}{fmtNum(data.ihsg.changePercent, 2)}%)
            </span>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 text-[10px]">
          <div>
            <span className="text-slate-500 block">{isId ? 'Tertinggi' : 'High'}</span>
            <span className="text-slate-300 font-semibold">{fmtNum(data.ihsg.dayHigh, 2)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{isId ? 'Terendah' : 'Low'}</span>
            <span className="text-slate-300 font-semibold">{fmtNum(data.ihsg.dayLow, 2)}</span>
          </div>
          <div>
            <span className="text-slate-500 block">{isId ? 'Volume' : 'Volume'}</span>
            <span className="text-slate-300 font-semibold">{fmtVol(data.ihsg.volume)}</span>
          </div>
        </div>
      </motion.div>

      {/* Top Gainers Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.1 }}
        className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 flex flex-col gap-3"
      >
        <div className="flex items-center gap-1.5">
          <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
            {isId ? 'Top Gainers' : 'Top Gainers'}
          </span>
        </div>
        {data.topGainers.length > 0 ? (
          <div className="flex flex-col gap-2">
            {data.topGainers.map((m) => (
              <div key={m.symbol} className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">{m.symbol}</span>
                <span className="text-slate-400">{fmtNum(m.price, 0)}</span>
                <span className="text-emerald-400 font-semibold text-[11px]">
                  +{fmtNum(m.changePercent, 2)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-slate-500">
            {isId ? 'Tidak ada kenaikan' : 'No gainers'}
          </span>
        )}
      </motion.div>

      {/* Top Losers Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="rounded-2xl bg-white/[0.02] border border-white/5 p-5 flex flex-col gap-3"
      >
        <div className="flex items-center gap-1.5">
          <TrendingDown className="h-3.5 w-3.5 text-rose-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-rose-400">
            {isId ? 'Top Losers' : 'Top Losers'}
          </span>
        </div>
        {data.topLosers.length > 0 ? (
          <div className="flex flex-col gap-2">
            {data.topLosers.map((m) => (
              <div key={m.symbol} className="flex items-center justify-between text-xs">
                <span className="font-bold text-white">{m.symbol}</span>
                <span className="text-slate-400">{fmtNum(m.price, 0)}</span>
                <span className="text-rose-400 font-semibold text-[11px]">
                  {fmtNum(m.changePercent, 2)}%
                </span>
              </div>
            ))}
          </div>
        ) : (
          <span className="text-[10px] text-slate-500">
            {isId ? 'Tidak ada penurunan' : 'No losers'}
          </span>
        )}
      </motion.div>
    </div>
  );
}
