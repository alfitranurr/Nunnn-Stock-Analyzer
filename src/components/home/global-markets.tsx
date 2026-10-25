'use client';

import * as React from 'react';
import { Globe2 } from 'lucide-react';
import { GLOBAL_INSTRUMENTS } from '@/lib/global-markets';
import { formatNumberLocale } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';
import { Sparkline } from './sparkline';
import type { Lang } from './types';

interface GlobalQuote {
  symbol: string;
  price: number;
  change: number;
  changePercent: number;
  closes: number[];
}

interface GlobalMarketsProps {
  language: Lang;
  isActive: boolean;
}

/** Strip makro & global: USD/IDR, LQ45, komoditas, indeks regional/AS. Refresh tiap 2 menit saat Beranda aktif. */
export function GlobalMarkets({ language, isActive }: GlobalMarketsProps) {
  const isId = language === 'id';
  const [quotes, setQuotes] = React.useState<Record<string, GlobalQuote>>({});
  const [status, setStatus] = React.useState<'loading' | 'ready' | 'error'>('loading');

  const load = React.useCallback(async () => {
    try {
      const res = await fetch('/api/global-markets');
      if (!res.ok) throw new Error(String(res.status));
      const data: { quotes?: GlobalQuote[] } = await res.json();
      setQuotes(Object.fromEntries((data.quotes ?? []).map((q) => [q.symbol, q])));
      setStatus('ready');
    } catch {
      setStatus((prev) => (prev === 'ready' ? prev : 'error'));
    }
  }, []);

  // Admin menekan "Refresh semua data" → ambil ulang segera.
  const refreshEpoch = useDataRefreshEpoch();
  usePolling(load, { enabled: isActive, intervalMs: 60_000, minGapMs: 30_000, key: refreshEpoch });

  if (status === 'error') {
    return (
      <div className="rounded-[20px] bg-card-bg border border-white/[0.04] px-5 py-4 text-xs text-slate-500">
        {isId ? 'Data pasar global belum bisa dimuat.' : 'Global market data could not be loaded.'}
      </div>
    );
  }

  return (
    <section aria-label={isId ? 'Pasar global & makro' : 'Global markets & macro'}>
      <h2 className="flex items-center gap-2 mb-3 title-display text-lg text-white">
        <Globe2 className="h-4 w-4 text-accent" aria-hidden />
        {isId ? 'Global & makro' : 'Global & macro'}
      </h2>
      {/* Kartu dibagi rata selebar layar; bila tidak muat (layar sempit), geser ke samping. */}
      <div className="grid grid-flow-col auto-cols-[minmax(150px,1fr)] gap-3 overflow-x-auto pb-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden snap-x">
        {GLOBAL_INSTRUMENTS.map((inst) => {
          const q = quotes[inst.symbol];
          const isUp = (q?.change ?? 0) >= 0;
          return (
            <div
              key={inst.symbol}
              className="snap-start min-w-0 rounded-2xl bg-card-bg border border-white/[0.04] px-4 py-3.5 flex flex-col gap-1.5"
            >
              <span className="text-xs text-slate-500 truncate" title={inst.unit ? `${inst[language]} (${inst.unit})` : inst[language]}>
                {inst[language]}
              </span>
              {q ? (
                <>
                  <span className="font-display text-lg font-medium text-white tabular-nums leading-tight truncate">
                    {formatNumberLocale(q.price, language, inst.decimals)}
                  </span>
                  <span className={`text-xs font-semibold tabular-nums ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {isUp ? '▲ +' : '▼ '}{formatNumberLocale(q.changePercent, language, 2)}%
                  </span>
                  <Sparkline values={q.closes} baseline={q.price - q.change} width={160} height={22} className="w-full" />
                </>
              ) : (
                <div className="h-[62px] rounded-xl skeleton-shimmer" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
