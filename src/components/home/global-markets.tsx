'use client';

import * as React from 'react';
import { Globe2 } from 'lucide-react';
import { GLOBAL_INSTRUMENTS } from '@/lib/global-markets';
import { formatNumberLocale } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';
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

  usePolling(load, { enabled: isActive, intervalMs: 120_000, minGapMs: 60_000 });

  if (status === 'error') {
    return (
      <div className="rounded-2xl bg-white/[0.02] border border-white/5 px-4 py-3 text-[11px] text-slate-500">
        {isId ? 'Data pasar global belum bisa dimuat.' : 'Global market data could not be loaded.'}
      </div>
    );
  }

  return (
    <section aria-label={isId ? 'Pasar global & makro' : 'Global markets & macro'}>
      <div className="flex items-center gap-1.5 mb-2">
        <Globe2 className="h-3.5 w-3.5 text-emerald-400" />
        <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
          {isId ? 'Global & Makro' : 'Global & Macro'}
        </span>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1 custom-scrollbar snap-x">
        {GLOBAL_INSTRUMENTS.map((inst) => {
          const q = quotes[inst.symbol];
          const isUp = (q?.change ?? 0) >= 0;
          return (
            <div
              key={inst.symbol}
              className="snap-start shrink-0 w-[150px] rounded-xl bg-white/[0.02] border border-white/5 px-3 py-2.5 flex flex-col gap-1"
            >
              <span className="text-[10px] font-bold text-slate-400 truncate" title={inst.unit ? `${inst[language]} (${inst.unit})` : inst[language]}>
                {inst[language]}
              </span>
              {q ? (
                <>
                  <div className="flex items-baseline justify-between gap-1 tabular-nums">
                    <span className="text-sm font-black text-white">{formatNumberLocale(q.price, language, inst.decimals)}</span>
                    <span className={`text-[10px] font-bold ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                      {isUp ? '+' : ''}{formatNumberLocale(q.changePercent, language, 2)}%
                    </span>
                  </div>
                  <Sparkline values={q.closes} baseline={q.price - q.change} width={126} height={20} />
                </>
              ) : (
                <div className="h-[38px] rounded bg-white/[0.03] animate-pulse" />
              )}
            </div>
          );
        })}
      </div>
    </section>
  );
}
