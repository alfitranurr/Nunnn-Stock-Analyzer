'use client';

import * as React from 'react';
import { Star, Flame } from 'lucide-react';
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
  { id: 'gainers', label: { id: 'Gainers', en: 'Gainers' } },
  { id: 'losers', label: { id: 'Losers', en: 'Losers' } },
  { id: 'value', label: { id: 'Top Nilai', en: 'Top Value' } },
  { id: 'volume', label: { id: 'Top Volume', en: 'Top Volume' } },
];

const MIN_VALUE_OPTIONS: Array<{ value: number; label: { id: string; en: string } }> = [
  { value: 0, label: { id: 'Semua', en: 'All' } },
  { value: 1e9, label: { id: '≥ Rp1 M', en: '≥ Rp1B' } },
  { value: 1e10, label: { id: '≥ Rp10 M', en: '≥ Rp10B' } },
];

/** Daftar saham penggerak pasar dengan filter likuiditas, badge ARA/ARB, dan tombol watchlist. */
export function MarketMovers({ language, data, loading, minValue, onMinValueChange, onSelectTicker, trading }: MarketMoversProps) {
  const isId = language === 'id';
  const [tab, setTab] = React.useState<MoverCategory>('gainers');
  const watchlist = useWatchlist();
  const rows = data?.movers[tab] ?? [];
  const showsLiquidityFilter = tab === 'gainers' || tab === 'losers';

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 md:p-5 flex flex-col gap-3 h-full">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400 flex items-center gap-1.5">
          <Flame className="h-3.5 w-3.5 text-emerald-400" />
          {isId ? 'Penggerak Pasar' : 'Market Movers'}
          {data && (
            <span
              className={`ml-1 inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-extrabold normal-case tracking-normal ${trading ? 'bg-emerald-500/10 text-emerald-400' : 'bg-white/5 text-slate-500'}`}
              title={trading
                ? (isId ? `Diperbarui otomatis tiap ${LIVE_POLL_MS / 1000} detik selama jam bursa` : `Auto-refreshes every ${LIVE_POLL_MS / 1000} s during market hours`)
                : (isId ? 'Bursa tutup: menampilkan data penutupan sesi terakhir' : 'Market closed: showing the last session close')}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${trading ? 'bg-emerald-400 animate-pulse' : 'bg-slate-500'}`} />
              {trading ? `LIVE · ${LIVE_POLL_MS / 1000} ${isId ? 'dtk' : 's'}` : isId ? 'Data penutupan' : 'Closing data'}
            </span>
          )}
        </span>
        {showsLiquidityFilter && (
          <div className="flex items-center gap-1 text-[10px]" role="group" aria-label={isId ? 'Filter nilai transaksi' : 'Turnover filter'}>
            <span className="text-slate-500 mr-0.5">{isId ? 'Nilai transaksi' : 'Turnover'}</span>
            {MIN_VALUE_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => onMinValueChange(opt.value)}
                aria-pressed={minValue === opt.value}
                className={`px-2 py-0.5 rounded-md border font-bold transition-colors cursor-pointer ${
                  minValue === opt.value
                    ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                    : 'border-white/10 text-slate-400 hover:text-emerald-400'
                }`}
              >
                {opt.label[language]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex bg-input-bg border border-border-color p-0.5 rounded-xl text-[11px] font-bold" role="tablist">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={tab === t.id}
            onClick={() => setTab(t.id)}
            className={`flex-1 py-1.5 px-2 rounded-lg transition-all cursor-pointer whitespace-nowrap ${
              tab === t.id ? 'bg-emerald-500 text-white shadow-sm' : 'text-slate-400 hover:text-white'
            }`}
          >
            {t.label[language]}
          </button>
        ))}
      </div>

      {loading && !data ? (
        <div className="space-y-2">
          {[...Array(6)].map((_, i) => <div key={i} className="h-10 rounded-xl bg-white/[0.03] animate-pulse" />)}
        </div>
      ) : rows.length === 0 ? (
        <p className="py-8 text-center text-xs text-slate-500">
          {isId ? 'Tidak ada saham yang memenuhi filter.' : 'No stocks match this filter.'}
        </p>
      ) : (
        <div className="flex flex-col divide-y divide-white/5" role="tabpanel">
          <div className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto_auto_1.75rem] gap-2 pb-1.5 text-[9px] font-bold uppercase tracking-wider text-slate-500">
            <span>#</span>
            <span>{isId ? 'Saham' : 'Stock'}</span>
            <span className="text-right">{isId ? 'Harga · %' : 'Price · %'}</span>
            <span
              className="text-right w-16 sm:w-20"
              title={tab === 'volume' ? undefined : isId ? 'Perkiraan: harga terakhir × volume (sumber gratis tidak menyediakan nilai transaksi persis)' : 'Estimate: last price × volume (free sources do not provide exact traded value)'}
            >
              {tab === 'volume' ? 'Volume' : isId ? 'Nilai ≈' : 'Value ≈'}
            </span>
            <span />
          </div>
          {rows.map((m, i) => {
            const isUp = m.change >= 0;
            const watched = watchlist.has(m.symbol);
            return (
              <motion.div
                key={m.symbol}
                layout="position"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ type: 'spring', stiffness: 420, damping: 36 }}
                className="grid grid-cols-[1.25rem_minmax(0,1fr)_auto_auto_1.75rem] gap-2 items-center py-2"
              >
                <span className="text-[10px] font-bold text-slate-600 tabular-nums">{i + 1}</span>
                <button
                  type="button"
                  onClick={() => onSelectTicker(m.symbol)}
                  className="min-w-0 text-left cursor-pointer group"
                  title={isId ? `Analisis ${m.symbol}` : `Analyze ${m.symbol}`}
                >
                  <span className="flex items-center gap-1.5">
                    <span className="font-bold text-xs text-white group-hover:text-emerald-400 transition-colors">{m.symbol}</span>
                    {m.limit && (
                      <span className={`px-1 rounded text-[8px] font-black ${m.limit === 'ARA' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-rose-500/15 text-rose-400'}`}>
                        {m.limit}
                      </span>
                    )}
                  </span>
                  <span className="block text-[10px] text-slate-500 truncate">{m.name}</span>
                </button>
                <span className="text-right tabular-nums">
                  <span className="block text-xs font-semibold text-slate-200"><Flash value={formatNumberLocale(m.price, language)} /></span>
                  <span className={`block text-[10px] font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    <Flash value={`${isUp ? '+' : ''}${formatNumberLocale(m.changePercent, language, 2)}%`} />
                  </span>
                </span>
                <span className="text-right text-[10px] text-slate-400 tabular-nums w-16 sm:w-20">
                  {tab === 'volume'
                    ? `${formatNumberLocale(m.volume / 100, language)} lot`
                    : formatIDRCompact(m.value, language)}
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
                  className="h-7 w-7 flex items-center justify-center rounded-lg hover:bg-white/5 disabled:opacity-30 cursor-pointer transition-colors"
                >
                  <Star className={`h-3.5 w-3.5 ${watched ? 'fill-amber-400 text-amber-400' : 'text-slate-500'}`} />
                </button>
              </motion.div>
            );
          })}
        </div>
      )}

      <p className="text-[10px] text-slate-600 mt-auto">
        {data && (
          <span className="text-slate-500">
            {isId ? 'Diperbarui' : 'Updated'} {formatWibTime(Date.parse(data.scannedAt), true)} WIB
            {(data.breadth.notTraded ?? 0) > 0 &&
              (isId
                ? ` · ${data.breadth.notTraded} saham tidak ditransaksikan sesi ini (mis. suspensi) tidak ikut dihitung`
                : ` · ${data.breadth.notTraded} stocks not traded this session (e.g. suspended) are excluded`)}
            {' · '}
          </span>
        )}
        {isId
          ? 'Klik kode saham untuk analisis. ARA/ARB: harga menyentuh batas auto rejection harian.'
          : 'Click a ticker to analyze. ARA/ARB: price hit the daily auto-rejection limit.'}
      </p>
    </div>
  );
}
