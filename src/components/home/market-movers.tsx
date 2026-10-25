'use client';

import * as React from 'react';
import { Star } from 'lucide-react';
import { motion } from 'framer-motion';
import { formatNumberLocale, formatIDRCompact } from '@/lib/format';
import { formatWibTime } from '@/lib/market-hours';
import { LIVE_POLL_MS } from '@/lib/refresh-signal';
import { Flash } from '@/components/shared/motion';
import { useWatchlist } from '@/lib/watchlist-store';
import type { Lang, MarketSummaryData, MoverCategory } from './types';

interface MarketMoversProps {
  language: Lang;
  data: MarketSummaryData | null;
  loading: boolean;
  minValue: number;
  onMinValueChange: (value: number) => void;
  onSelectTicker: (symbol: string) => void;
  /** Bursa sedang dalam jam perdagangan (data diperbarui otomatis). */
  trading: boolean;
}

const TABS: Array<{ id: MoverCategory; label: { id: string; en: string } }> = [
  { id: 'gainers', label: { id: 'Naik', en: 'Gainers' } },
  { id: 'losers', label: { id: 'Turun', en: 'Losers' } },
  { id: 'value', label: { id: 'Nilai', en: 'Value' } },
  { id: 'volume', label: { id: 'Volume', en: 'Volume' } },
];

const MIN_VALUE_OPTIONS: Array<{ value: number; label: { id: string; en: string } }> = [
  { value: 0, label: { id: 'Semua', en: 'All' } },
  { value: 1e9, label: { id: '≥ Rp1 M', en: '≥ Rp1B' } },
  { value: 1e10, label: { id: '≥ Rp10 M', en: '≥ Rp10B' } },
];

/** Avatar bulat berisi dua huruf pertama kode saham. */
export function TickerAvatar({ symbol, className = '' }: { symbol: string; className?: string }) {
  return (
    <span className={`h-10 w-10 shrink-0 rounded-full bg-surface-3 flex items-center justify-center text-xs font-semibold text-white ${className}`} aria-hidden>
      {symbol.slice(0, 2)}
    </span>
  );
}

/** Label perubahan persentase berbentuk pill (hijau naik, merah turun, abu tetap). */
export function ChangePill({ value, language }: { value: number; language: Lang }) {
  const tone = value > 0 ? 'bg-emerald-400/10 text-emerald-400' : value < 0 ? 'bg-rose-400/10 text-rose-400' : 'bg-surface-2 text-slate-400';
  const arrow = value > 0 ? '▲' : value < 0 ? '▼' : '•';
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold tabular-nums whitespace-nowrap ${tone}`}>
      <span className="text-[9px]" aria-hidden>{arrow}</span>
      <Flash value={`${value > 0 ? '+' : value < 0 ? '−' : ''}${formatNumberLocale(Math.abs(value), language, 2)}%`} />
    </span>
  );
}

/** Daftar saham penggerak pasar dengan filter likuiditas, badge ARA/ARB, dan tombol watchlist. */
export function MarketMovers({ language, data, loading, minValue, onMinValueChange, onSelectTicker, trading }: MarketMoversProps) {
  const isId = language === 'id';
  const [tab, setTab] = React.useState<MoverCategory>('gainers');
  const watchlist = useWatchlist();
  const rows = data?.movers[tab] ?? [];
  const showsLiquidityFilter = tab === 'gainers' || tab === 'losers';

  return (
    <section className="rounded-[20px] bg-card-bg border border-white/[0.04] p-5 md:p-6 flex flex-col gap-4 h-full" aria-labelledby="movers-title">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 id="movers-title" className="title-display text-lg text-white flex items-center gap-2">
            {isId ? 'Penggerak pasar' : 'Market movers'}
            {data && (
              <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full font-sans text-[11px] font-semibold tracking-normal ${trading ? 'bg-emerald-400/10 text-emerald-400' : 'bg-surface-2 text-slate-400'}`}
                title={trading
                  ? (isId ? `Diperbarui otomatis tiap ${LIVE_POLL_MS / 1000} detik selama jam bursa` : `Auto-refreshes every ${LIVE_POLL_MS / 1000} s during market hours`)
                  : (isId ? 'Bursa tutup: menampilkan data penutupan sesi terakhir' : 'Market closed: showing the last session close')}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${trading ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
                {trading ? 'LIVE' : isId ? 'Penutupan' : 'Close'}
              </span>
            )}
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">{isId ? 'Saham teratas sesi ini · klik untuk analisis' : 'Top stocks this session · click to analyze'}</p>
        </div>
        <div className="inline-flex gap-1 p-1 rounded-full bg-surface-2" role="tablist" aria-label={isId ? 'Kategori' : 'Category'}>
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={`px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap transition-colors cursor-pointer ${
                tab === t.id ? 'bg-white text-slate-950' : 'text-slate-400 hover:text-white'
              }`}
            >
              {t.label[language]}
            </button>
          ))}
        </div>
      </div>

      {showsLiquidityFilter && (
        <div className="flex flex-wrap items-center gap-1.5 text-xs" role="group" aria-label={isId ? 'Filter nilai transaksi' : 'Turnover filter'}>
          <span className="text-slate-500 mr-1">{isId ? 'Nilai transaksi' : 'Turnover'}</span>
          {MIN_VALUE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => onMinValueChange(opt.value)}
              aria-pressed={minValue === opt.value}
              className={`px-2.5 py-1 rounded-full font-semibold transition-colors cursor-pointer ${
                minValue === opt.value ? 'bg-surface-3 text-white' : 'text-slate-400 hover:text-white'
              }`}
            >
              {opt.label[language]}
            </button>
          ))}
        </div>
      )}

      {loading && !data ? (
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => <div key={i} className="h-14 rounded-2xl skeleton-shimmer" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">
          {isId ? 'Tidak ada saham yang memenuhi filter.' : 'No stocks match this filter.'}
        </p>
      ) : (
        <ul className="flex flex-col gap-0.5" role="tabpanel">
          {rows.map((m) => {
            const watched = watchlist.has(m.symbol);
            return (
              <motion.li
                key={m.symbol}
                layout="position"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                className="group grid grid-cols-[minmax(0,1fr)_auto_2rem] sm:grid-cols-[minmax(0,1fr)_auto_auto_2rem] items-center gap-3 -mx-2.5 px-2.5 py-2 rounded-2xl hover:bg-surface-2 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectTicker(m.symbol)}
                  className="min-w-0 flex items-center gap-3 text-left cursor-pointer"
                  title={isId ? `Analisis ${m.symbol}` : `Analyze ${m.symbol}`}
                >
                  <TickerAvatar symbol={m.symbol} />
                  <span className="min-w-0">
                    <span className="flex items-center gap-1.5">
                      <span className="font-semibold text-white">{m.symbol}</span>
                      {m.limit && (
                        <span className={`px-1.5 py-px rounded-full text-[10px] font-bold tracking-wide ${m.limit === 'ARA' ? 'bg-emerald-400/10 text-emerald-400' : 'bg-rose-400/10 text-rose-400'}`}>
                          {m.limit}
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-slate-500 truncate">{m.name}</span>
                  </span>
                </button>
                <span
                  className="hidden sm:block text-right tabular-nums"
                  title={tab === 'volume' ? undefined : isId ? 'Perkiraan: harga terakhir × volume' : 'Estimate: last price × volume'}
                >
                  <span className="block text-sm font-semibold text-slate-200">
                    {tab === 'volume' ? `${formatNumberLocale(m.volume / 100, language)} lot` : formatIDRCompact(m.value, language)}
                  </span>
                  <span className="block text-xs text-slate-500">{tab === 'volume' ? 'volume' : isId ? 'nilai ≈' : 'value ≈'}</span>
                </span>
                <span className="text-right tabular-nums flex flex-col items-end gap-0.5">
                  <span className="font-semibold text-white"><Flash value={formatNumberLocale(m.price, language)} /></span>
                  <ChangePill value={m.changePercent} language={language} />
                </span>
                <button
                  type="button"
                  onClick={() => watchlist.toggle({ symbol: m.symbol, name: m.name })}
                  disabled={!watched && watchlist.isFull}
                  aria-pressed={watched}
                  aria-label={watched
                    ? (isId ? `Hapus ${m.symbol} dari watchlist` : `Remove ${m.symbol} from watchlist`)
                    : (isId ? `Tambah ${m.symbol} ke watchlist` : `Add ${m.symbol} to watchlist`)}
                  title={!watched && watchlist.isFull ? (isId ? 'Watchlist penuh' : 'Watchlist is full') : undefined}
                  className="h-8 w-8 flex items-center justify-center rounded-full hover:bg-surface-3 disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <Star className={`h-4 w-4 ${watched ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} />
                </button>
              </motion.li>
            );
          })}
        </ul>
      )}

      <p className="text-xs text-slate-500 mt-auto">
        {data && <>{isId ? 'Diperbarui' : 'Updated'} {formatWibTime(Date.parse(data.scannedAt), true)} WIB · </>}
        {isId ? 'ARA/ARB: harga menyentuh batas auto rejection harian.' : 'ARA/ARB: price hit the daily auto-rejection limit.'}
      </p>
    </section>
  );
}
