'use client';

import * as React from 'react';
import { RefreshCw, Clock } from 'lucide-react';
import { SESSION_LABEL, formatWibTime, isSessionOpen, type IdxSession } from '@/lib/market-hours';
import type { Lang } from './types';

interface MarketStatusBarProps {
  language: Lang;
  session: IdxSession | null;
  now: number | null;
  updatedAt: number | null;
  refreshing: boolean;
  onRefresh: () => void;
  source?: { label: string; delayed: boolean } | null;
}

const SESSION_TONE: Record<IdxSession, string> = {
  'pre-open': 'bg-amber-400',
  session1: 'bg-emerald-400',
  break: 'bg-amber-400',
  session2: 'bg-emerald-400',
  'pre-close': 'bg-amber-400',
  closed: 'bg-slate-500',
  holiday: 'bg-slate-500',
};

/** Status sesi BEI, jam WIB, waktu update data, dan tombol refresh manual. */
export function MarketStatusBar({ language, session, now, updatedAt, refreshing, onRefresh, source }: MarketStatusBarProps) {
  const isId = language === 'id';
  const open = session ? isSessionOpen(session) : false;

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-4 py-2.5 rounded-2xl bg-white/[0.02] border border-white/5 text-[11px]">
      <span className="flex items-center gap-2 font-bold text-white">
        <span className="relative flex h-2 w-2">
          {open && <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 animate-ping motion-reduce:animate-none" />}
          <span className={`relative inline-flex h-2 w-2 rounded-full ${session ? SESSION_TONE[session] : 'bg-slate-600'}`} />
        </span>
        {session ? SESSION_LABEL[session][language] : '—'}
      </span>

      <span className="flex items-center gap-1 text-slate-400 tabular-nums">
        <Clock className="h-3 w-3" />
        {now ? `${formatWibTime(now)} WIB` : '--:-- WIB'}
      </span>

      <span className="text-slate-500 tabular-nums">
        {isId ? 'Update' : 'Updated'} {updatedAt ? formatWibTime(updatedAt, true) : '—'}
      </span>

      <span className="text-slate-600 hidden sm:inline">
        {isId ? 'Sumber' : 'Source'} {source?.label ?? '—'}
        {(source?.delayed ?? true) && (isId ? ' · data bisa tertunda' : ' · data may be delayed')}
      </span>

      <button
        type="button"
        onClick={onRefresh}
        disabled={refreshing}
        className="ml-auto flex items-center gap-1 text-slate-400 hover:text-emerald-400 disabled:opacity-50 transition-colors cursor-pointer"
        aria-label={isId ? 'Muat ulang data pasar' : 'Refresh market data'}
      >
        <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
        <span className="hidden sm:inline">{isId ? 'Refresh' : 'Refresh'}</span>
      </button>
    </div>
  );
}
