'use client';

import * as React from 'react';
import { RefreshCw } from 'lucide-react';
import { bumpDataRefresh, LIVE_POLL_MS } from '@/lib/refresh-signal';
import { formatWibTime } from '@/lib/market-hours';
import { cn } from '@/lib/utils';

const SPIN_MS = 1200;
/** Jeda minimum antar-klik agar sumber data tidak dibanjiri permintaan. */
const COOLDOWN_MS = 8000;

/**
 * Tombol "Perbarui data" terpusat (sidebar desktop & header mobile), untuk semua pengguna.
 * Mengirim sinyal refresh: semua halaman yang memakai `useDataRefreshEpoch` (Beranda, Berita,
 * Watchlist, Portofolio, Dividen, Analisis, dst.) langsung mengambil data terbaru dari server,
 * juga di tab lain browser ini. Cache server tetap berlaku (harga ±15–20 detik) agar sumber data
 * tidak dibanjiri; refresh total semua cache server ada di Admin Panel.
 */
export function GlobalRefreshButton({ language, variant }: { language: 'id' | 'en'; variant: 'full' | 'icon' }) {
  const isId = language === 'id';
  const [lastAt, setLastAt] = React.useState<number | null>(null);
  const [spinning, setSpinning] = React.useState(false);
  const [cooling, setCooling] = React.useState(false);

  const refresh = () => {
    if (cooling) return;
    bumpDataRefresh();
    setLastAt(Date.now());
    setSpinning(true);
    setCooling(true);
    window.setTimeout(() => setSpinning(false), SPIN_MS);
    window.setTimeout(() => setCooling(false), COOLDOWN_MS);
  };

  const title = isId
    ? `Perbarui semua data di semua halaman sekarang (otomatis tiap ${LIVE_POLL_MS / 1000} detik saat bursa buka)`
    : `Refresh all data on every page now (auto every ${LIVE_POLL_MS / 1000} s while the market is open)`;

  if (variant === 'icon') {
    return (
      <button
        type="button"
        onClick={refresh}
        disabled={cooling && !spinning}
        title={title}
        aria-label={isId ? 'Perbarui semua data' : 'Refresh all data'}
        className="w-11 h-11 shrink-0 rounded-xl border border-border-color bg-input-bg flex items-center justify-center text-emerald-400 hover:bg-glass-border hover:text-white transition-all cursor-pointer disabled:opacity-50 disabled:cursor-default"
      >
        <RefreshCw className={cn('h-4.5 w-4.5', spinning && 'animate-spin')} />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={cooling && !spinning}
      title={title}
      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl border border-emerald-500/25 bg-emerald-500/[0.07] hover:bg-emerald-500/15 text-left transition-colors cursor-pointer disabled:cursor-default"
    >
      <RefreshCw className={cn('h-4 w-4 text-emerald-400 shrink-0', spinning && 'animate-spin')} />
      <span className="min-w-0">
        <span className="block text-[12px] font-bold text-emerald-300 leading-tight">{spinning ? (isId ? 'Memperbarui…' : 'Refreshing…') : isId ? 'Perbarui data' : 'Refresh data'}</span>
        <span className="block text-[9.5px] font-semibold text-slate-500 leading-tight mt-0.5 truncate">
          {lastAt !== null
            ? `${isId ? 'Terakhir' : 'Last'} ${formatWibTime(lastAt, true)} WIB`
            : isId
              ? `Otomatis tiap ${LIVE_POLL_MS / 1000} dtk saat bursa buka`
              : `Auto every ${LIVE_POLL_MS / 1000}s in market hours`}
        </span>
      </span>
    </button>
  );
}
