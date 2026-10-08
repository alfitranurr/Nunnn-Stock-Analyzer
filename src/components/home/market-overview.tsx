'use client';

import * as React from 'react';
import { TrendingUp, TrendingDown, Activity } from 'lucide-react';
import { formatNumberLocale, formatIDRCompact } from '@/lib/format';
import { Sparkline } from './sparkline';
import { AnimatedNumber, GrowBar } from '@/components/shared/motion';
import type { Lang, MarketSummaryData } from './types';

interface MarketOverviewProps {
  language: Lang;
  data: MarketSummaryData | null;
  loading: boolean;
  error: boolean;
}

function CardShell({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl bg-white/[0.02] border border-white/5 p-4 md:p-5 ${className}`}>{children}</div>;
}

const ISSUE_LABEL: Record<string, { id: string; en: string }> = {
  'invalid-price': { id: 'harga tidak valid', en: 'invalid price' },
  'off-tick': { id: 'bukan kelipatan fraksi', en: 'off tick size' },
  'exceeds-limit': { id: 'melewati batas ARA/ARB', en: 'beyond ARA/ARB limit' },
  'no-volume': { id: 'berubah tanpa transaksi', en: 'moved without volume' },
};

/** Kartu IHSG (harga, grafik intraday, rentang 52 minggu) dan breadth pasar. */
export function MarketOverview({ language, data, loading, error }: MarketOverviewProps) {
  const isId = language === 'id';
  const num = (v: number, d = 2) => formatNumberLocale(v, language, d);

  if (loading && !data) {
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
        <div className="lg:col-span-2 rounded-2xl bg-white/[0.02] border border-white/5 h-[188px] animate-pulse" />
        <div className="rounded-2xl bg-white/[0.02] border border-white/5 h-[188px] animate-pulse" />
      </div>
    );
  }

  if (!data) {
    return (
      <CardShell className="text-center text-xs text-slate-500">
        {error
          ? (isId ? 'Gagal memuat data pasar. Coba tombol Refresh.' : 'Failed to load market data. Try the Refresh button.')
          : (isId ? 'Data pasar belum tersedia.' : 'Market data is not available yet.')}
      </CardShell>
    );
  }

  const { ihsg, breadth } = data;
  const isUp = ihsg.change >= 0;
  const ChangeIcon = isUp ? TrendingUp : TrendingDown;
  const changeColor = isUp ? 'text-emerald-400' : 'text-rose-400';

  const yearSpan = ihsg.yearHigh - ihsg.yearLow;
  const yearPos = yearSpan > 0 ? Math.min(100, Math.max(0, ((ihsg.price - ihsg.yearLow) / yearSpan) * 100)) : 50;

  const totalBreadth = breadth.advancers + breadth.decliners + breadth.unchanged || 1;
  const pct = (n: number) => (n / totalBreadth) * 100;
  const breadthTone =
    breadth.advancers > breadth.decliners * 1.2
      ? { id: 'Mayoritas saham naik', en: 'Most stocks are rising', cls: 'text-emerald-400' }
      : breadth.decliners > breadth.advancers * 1.2
        ? { id: 'Mayoritas saham turun', en: 'Most stocks are falling', cls: 'text-rose-400' }
        : { id: 'Pasar berimbang', en: 'Balanced market', cls: 'text-slate-300' };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
      {/* IHSG */}
      <CardShell className="lg:col-span-2 flex flex-col gap-3">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500">
              {isId ? 'IHSG · Indeks Harga Saham Gabungan' : 'IHSG · Jakarta Composite Index'}
            </span>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mt-1">
              <AnimatedNumber value={ihsg.price} format={num} className="text-3xl font-black text-white tracking-tight" />
              <span className={`text-sm font-bold flex items-center gap-1 tabular-nums ${changeColor}`}>
                <ChangeIcon className="h-4 w-4" />
                {isUp ? '+' : ''}{num(ihsg.change)} ({isUp ? '+' : ''}{num(ihsg.changePercent)}%)
              </span>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-4 text-[10px] tabular-nums">
            <div>
              <span className="text-slate-500 block">{isId ? 'Tutup Kemarin' : 'Prev Close'}</span>
              <span className="text-slate-200 font-semibold">{num(ihsg.previousClose)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">{isId ? 'Tertinggi' : 'High'}</span>
              <span className="text-slate-200 font-semibold">{num(ihsg.dayHigh)}</span>
            </div>
            <div>
              <span className="text-slate-500 block">{isId ? 'Terendah' : 'Low'}</span>
              <span className="text-slate-200 font-semibold">{num(ihsg.dayLow)}</span>
            </div>
          </div>
        </div>

        {ihsg.intraday.length > 1 ? (
          <Sparkline values={ihsg.intraday} baseline={ihsg.previousClose} width={600} height={64} className="w-full" strokeWidth={2} filled />
        ) : (
          <div className="h-16 flex items-center justify-center text-[10px] text-slate-600">
            {isId ? 'Grafik intraday belum tersedia' : 'Intraday chart not available yet'}
          </div>
        )}

        {/* Rentang 52 minggu */}
        <div className="space-y-1">
          <div className="flex justify-between text-[10px] text-slate-500 tabular-nums">
            <span>{isId ? '52 mgg rendah' : '52w low'} {num(ihsg.yearLow)}</span>
            <span>{isId ? '52 mgg tinggi' : '52w high'} {num(ihsg.yearHigh)}</span>
          </div>
          <div className="relative h-1.5 rounded-full bg-gradient-to-r from-rose-500/40 via-slate-500/30 to-emerald-500/40">
            <span
              className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-1.5 rounded-sm bg-white shadow"
              style={{ left: `${yearPos}%` }}
              title={`${num(yearPos, 0)}%`}
            />
          </div>
        </div>
      </CardShell>

      {/* Breadth */}
      <CardShell className="flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-500 flex items-center gap-1.5">
            <Activity className="h-3.5 w-3.5 text-emerald-400" />
            {isId ? 'Breadth Pasar' : 'Market Breadth'}
          </span>
          <span className={`text-[10px] font-bold ${breadthTone.cls}`}>{breadthTone[language]}</span>
        </div>

        <div className="grid grid-cols-3 gap-2 text-center tabular-nums">
          <div>
            <span className="text-xl font-black text-emerald-400 block">{num(breadth.advancers, 0)}</span>
            <span className="text-[10px] text-slate-500">{isId ? 'Naik' : 'Up'}</span>
          </div>
          <div>
            <span className="text-xl font-black text-slate-300 block">{num(breadth.unchanged, 0)}</span>
            <span className="text-[10px] text-slate-500">{isId ? 'Tetap' : 'Flat'}</span>
          </div>
          <div>
            <span className="text-xl font-black text-rose-400 block">{num(breadth.decliners, 0)}</span>
            <span className="text-[10px] text-slate-500">{isId ? 'Turun' : 'Down'}</span>
          </div>
        </div>

        <div className="flex h-2 rounded-full overflow-hidden bg-white/5" role="img" aria-label={`${breadth.advancers} / ${breadth.unchanged} / ${breadth.decliners}`}>
          <GrowBar pct={pct(breadth.advancers)} className="bg-emerald-500" />
          <GrowBar pct={pct(breadth.unchanged)} className="bg-slate-500" />
          <GrowBar pct={pct(breadth.decliners)} className="bg-rose-500" />
        </div>

        <div className="grid grid-cols-2 gap-2 text-[10px] tabular-nums">
          <div className="px-2.5 py-1.5 rounded-lg bg-emerald-500/5 border border-emerald-500/15 flex justify-between">
            <span className="text-slate-400">ARA</span>
            <span className="font-bold text-emerald-400">{num(breadth.ara, 0)}</span>
          </div>
          <div className="px-2.5 py-1.5 rounded-lg bg-rose-500/5 border border-rose-500/15 flex justify-between">
            <span className="text-slate-400">ARB</span>
            <span className="font-bold text-rose-400">{num(breadth.arb, 0)}</span>
          </div>
        </div>

        <p className="text-[10px] text-slate-500 mt-auto">
          {isId ? 'Nilai transaksi' : 'Turnover'} ≈ <strong className="text-slate-300">{formatIDRCompact(breadth.totalValue, language)}</strong>
          {' · '}
          {num(data.totalScanned, 0)} {isId ? 'saham dipantau' : 'stocks tracked'}
        </p>
        {data.dataQuality.excludedCount > 0 && (
          <p
            className="text-[10px] text-amber-400/80"
            title={data.dataQuality.excluded
              .map((e) => `${e.symbol}: ${(ISSUE_LABEL[e.issue] ?? { id: e.issue, en: e.issue })[language]}`)
              .join(', ')}
          >
            {isId
              ? `${num(data.dataQuality.excludedCount, 0)} saham dilewati karena datanya meragukan`
              : `${num(data.dataQuality.excludedCount, 0)} stocks skipped due to unreliable data`}
          </p>
        )}
      </CardShell>
    </div>
  );
}
