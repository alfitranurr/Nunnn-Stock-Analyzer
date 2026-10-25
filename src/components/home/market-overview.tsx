'use client';

import * as React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { formatNumberLocale, formatIDRCompact } from '@/lib/format';
import { formatWibTime } from '@/lib/market-hours';
import { IntradayChart } from './intraday-chart';
import { AnimatedNumber } from '@/components/shared/motion';
import { HOME_SPLIT, type Lang, type MarketSummaryData } from './types';

interface MarketOverviewProps {
  language: Lang;
  data: MarketSummaryData | null;
  loading: boolean;
  /** Sesi bursa sedang berjalan: label ujung grafik memakai jam data terakhir, bukan 16:00. */
  trading: boolean;
  error: boolean;
}

const CARD = 'rounded-[20px] bg-card-bg border border-white/[0.04] p-5 md:p-6';

const ISSUE_LABEL: Record<string, { id: string; en: string }> = {
  'invalid-price': { id: 'harga tidak valid', en: 'invalid price' },
  'off-tick': { id: 'bukan kelipatan fraksi', en: 'off tick size' },
  'exceeds-limit': { id: 'melewati batas ARA/ARB', en: 'beyond ARA/ARB limit' },
  'no-volume': { id: 'berubah tanpa transaksi', en: 'moved without volume' },
};

/** Cincin proporsi saham naik / tetap / turun dengan persentase naik di tengah. */
function BreadthRing({ up, flat, down, label, center }: { up: number; flat: number; down: number; label: string; center: string }) {
  const total = up + flat + down || 1;
  const C = 2 * Math.PI * 48;
  const GAP = 3;
  let offset = 0;
  const segments = [
    { v: up, color: '#2fd39f' },
    { v: flat, color: '#7d8590' },
    { v: down, color: '#ff6670' },
  ].map((s) => {
    const len = (s.v / total) * C;
    const seg = { ...s, len, offset };
    offset += len;
    return seg;
  });
  return (
    <svg viewBox="0 0 120 120" className="w-24 h-24 sm:w-[116px] sm:h-[116px] shrink-0" role="img" aria-label={label}>
      <circle cx="60" cy="60" r="48" fill="none" stroke="#1f2227" strokeWidth="12" />
      {segments.map((s) =>
        s.v > 0 ? (
          <circle
            key={s.color}
            cx="60"
            cy="60"
            r="48"
            fill="none"
            stroke={s.color}
            strokeWidth="12"
            strokeDasharray={`${Math.max(0, s.len - GAP)} ${C}`}
            strokeDashoffset={-s.offset}
            transform="rotate(-90 60 60)"
          />
        ) : null
      )}
      <text x="60" y="58" textAnchor="middle" className="fill-white font-display text-[24px] font-medium">
        {Math.round((up / total) * 100)}%
      </text>
      <text x="60" y="76" textAnchor="middle" className="fill-slate-500 text-[11px]">
        {center}
      </text>
    </svg>
  );
}

/** Kartu IHSG (harga, grafik intraday, fakta harian) dan breadth pasar. */
export function MarketOverview({ language, data, loading, trading, error }: MarketOverviewProps) {
  const isId = language === 'id';
  const num = (v: number, d = 2) => formatNumberLocale(v, language, d);

  if (loading && !data) {
    return (
      <div className={HOME_SPLIT}>
        <div className="rounded-[20px] h-[440px] skeleton-shimmer" />
        <div className="rounded-[20px] h-[440px] skeleton-shimmer" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className={`${CARD} text-center text-sm text-slate-400`}>
        {error
          ? (isId ? 'Gagal memuat data pasar. Coba tombol Refresh.' : 'Failed to load market data. Try the Refresh button.')
          : (isId ? 'Data pasar belum tersedia.' : 'Market data is not available yet.')}
      </div>
    );
  }

  const { ihsg, breadth } = data;
  const isUp = ihsg.change >= 0;
  const ChangeIcon = isUp ? TrendingUp : TrendingDown;
  const sign = (v: number) => (v > 0 ? '+' : v < 0 ? '−' : '');

  const breadthTone =
    breadth.advancers > breadth.decliners * 1.2
      ? { id: 'Mayoritas naik', en: 'Mostly up', cls: 'bg-emerald-400/10 text-emerald-400' }
      : breadth.decliners > breadth.advancers * 1.2
        ? { id: 'Mayoritas turun', en: 'Mostly down', cls: 'bg-rose-400/10 text-rose-400' }
        : { id: 'Berimbang', en: 'Balanced', cls: 'bg-surface-2 text-slate-300' };

  const lastTime = ihsg.marketTime ? formatWibTime(ihsg.marketTime * 1000) : null;
  const endLabel = trading && lastTime ? `${isId ? 'Terakhir' : 'Last'} ${lastTime}` : '16:00';

  const facts: Array<[string, string]> = [
    [isId ? 'Penutupan sebelumnya' : 'Previous close', num(ihsg.previousClose)],
    [isId ? 'Tertinggi hari ini' : 'Day high', num(ihsg.dayHigh)],
    [isId ? 'Terendah hari ini' : 'Day low', num(ihsg.dayLow)],
    [isId ? 'Rentang 52 minggu' : '52-week range', `${num(ihsg.yearLow, 0)} – ${num(ihsg.yearHigh, 0)}`],
  ];

  return (
    <div className={HOME_SPLIT}>
      {/* IHSG: satu-satunya kartu bergradien (kartu utama) */}
      <section className="min-w-0 rounded-[20px] hero-surface border border-white/[0.04] p-5 md:p-6 flex flex-col gap-4" aria-label="IHSG">
        <div>
          <span className="text-sm font-medium text-slate-300">
            {isId ? 'IHSG · Indeks Harga Saham Gabungan' : 'IHSG · Jakarta Composite Index'}
          </span>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 mt-1">
            <AnimatedNumber value={ihsg.price} format={num} className="title-display text-[40px] md:text-[56px] leading-none text-white tabular-nums" />
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-semibold tabular-nums ${isUp ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'}`}
            >
              <ChangeIcon className="h-4 w-4" />
              {sign(ihsg.change)}{num(Math.abs(ihsg.change))} ({sign(ihsg.changePercent)}{num(Math.abs(ihsg.changePercent))}%)
            </span>
          </div>
        </div>

        {ihsg.intraday.length > 1 ? (
          <>
            <IntradayChart language={language} values={ihsg.intraday} previousClose={ihsg.previousClose} endLabel={endLabel} />
            <div className="flex flex-wrap gap-x-5 gap-y-1 text-xs text-slate-500">
              <span className="inline-flex items-center gap-2">
                <i className={`inline-block w-3.5 h-[3px] rounded ${isUp ? 'bg-emerald-400' : 'bg-rose-400'}`} />
                {isId ? 'IHSG intraday (bar 5 menit)' : 'IHSG intraday (5-minute bars)'}
              </span>
              <span className="inline-flex items-center gap-2">
                <i className="inline-block w-3.5 h-[3px] bg-[repeating-linear-gradient(90deg,#7d8590_0_4px,transparent_4px_7px)]" />
                {isId ? 'Penutupan sebelumnya' : 'Previous close'}
              </span>
              <span className="hidden sm:inline">{isId ? 'Arahkan kursor untuk membaca nilai' : 'Hover to read values'}</span>
            </div>
          </>
        ) : (
          <div className="h-40 flex items-center justify-center text-xs text-slate-500">
            {isId ? 'Grafik intraday belum tersedia' : 'Intraday chart not available yet'}
          </div>
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {facts.map(([label, value]) => (
            <div key={label} className="rounded-2xl bg-white/[0.04] px-3.5 py-3 min-w-0">
              <span className="block text-xs text-slate-500">{label}</span>
              <span className="block mt-0.5 font-semibold text-white tabular-nums truncate">{value}</span>
            </div>
          ))}
        </div>
      </section>

      {/* Breadth */}
      <section className={`${CARD} flex flex-col gap-4`} aria-labelledby="breadth-title">
        <div className="flex items-center justify-between gap-3">
          <h2 id="breadth-title" className="title-display text-lg text-white">{isId ? 'Breadth pasar' : 'Market breadth'}</h2>
          <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${breadthTone.cls}`}>{breadthTone[language]}</span>
        </div>

        <div className="flex items-center gap-5">
          <BreadthRing
            up={breadth.advancers}
            flat={breadth.unchanged}
            down={breadth.decliners}
            center={isId ? 'naik' : 'up'}
            label={isId
              ? `Naik ${breadth.advancers}, tetap ${breadth.unchanged}, turun ${breadth.decliners} saham`
              : `Up ${breadth.advancers}, flat ${breadth.unchanged}, down ${breadth.decliners} stocks`}
          />
          <div className="flex-1 min-w-0 grid gap-2.5">
            {([
              [isId ? 'Naik' : 'Up', breadth.advancers, 'bg-emerald-400'],
              [isId ? 'Tetap' : 'Flat', breadth.unchanged, 'bg-slate-500'],
              [isId ? 'Turun' : 'Down', breadth.decliners, 'bg-rose-400'],
            ] as const).map(([label, value, dot]) => (
              <div key={label} className="flex items-center justify-between gap-3">
                <span className="inline-flex items-center gap-2 text-sm text-slate-300">
                  <i className={`inline-block h-2 w-2 rounded-full ${dot}`} />
                  {label}
                </span>
                <span className="font-display text-xl font-medium text-white tabular-nums">{num(value, 0)}</span>
              </div>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          {([
            [isId ? 'Menyentuh ARA' : 'Hit ARA', <span key="ara" className="text-emerald-400">{num(breadth.ara, 0)}</span>, undefined],
            [isId ? 'Menyentuh ARB' : 'Hit ARB', <span key="arb" className="text-rose-400">{num(breadth.arb, 0)}</span>, undefined],
            [isId ? 'Nilai transaksi ≈' : 'Turnover ≈', formatIDRCompact(breadth.totalValue, language), undefined],
            [
              isId ? 'Bertransaksi sesi ini' : 'Traded this session',
              num(data.totalScanned, 0),
              isId
                ? 'Saham yang bertransaksi sesi terakhir dengan data lolos pengecekan (= naik + tetap + turun). Berbeda dengan Cakupan emiten, yang juga menghitung saham suspensi.'
                : 'Stocks that traded last session with data passing checks (= up + flat + down). Unlike Listing coverage, which also counts suspended stocks.',
            ],
          ] as const).map(([label, value, hint]) => (
            <div key={label} className="rounded-2xl bg-surface-2 px-3.5 py-3 min-w-0" title={hint}>
              <span className="block text-xs text-slate-500">{label}</span>
              <span className="block mt-0.5 font-display text-xl font-medium text-white tabular-nums truncate">{value}</span>
            </div>
          ))}
        </div>

        <p className="text-xs text-slate-500 leading-relaxed mt-auto">
          {isId
            ? 'ARA/ARB: harga menyentuh batas auto rejection harian.'
            : 'ARA/ARB: price hit the daily auto-rejection limit.'}
          {(breadth.notTraded ?? 0) > 0 &&
            (isId
              ? ` ${num(breadth.notTraded ?? 0, 0)} saham tidak bertransaksi sesi ini dan tidak ikut dihitung.`
              : ` ${num(breadth.notTraded ?? 0, 0)} stocks did not trade this session and are excluded.`)}
        </p>
        {data.dataQuality.excludedCount > 0 && (
          <p
            className="text-xs text-amber-400/80 -mt-2"
            title={data.dataQuality.excluded
              .map((e) => `${e.symbol}: ${(ISSUE_LABEL[e.issue] ?? { id: e.issue, en: e.issue })[language]}`)
              .join(', ')}
          >
            {isId
              ? `${num(data.dataQuality.excludedCount, 0)} saham dilewati karena datanya meragukan`
              : `${num(data.dataQuality.excludedCount, 0)} stocks skipped due to unreliable data`}
          </p>
        )}
      </section>
    </div>
  );
}
