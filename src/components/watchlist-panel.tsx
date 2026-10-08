'use client';

import * as React from 'react';
import { Star, Plus, X, ArrowRight, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useWatchlist, WATCHLIST_MAX, type WatchlistEntry } from '@/lib/watchlist-store';
import { fetchQuotes, type QuoteItem } from '@/lib/quotes';
import { formatNumberLocale } from '@/lib/format';
import { usePolling } from '@/lib/use-polling';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';
import { Sparkline } from '@/components/home/sparkline';
import { IDX_TICKERS } from '@/lib/tickers';

type SortMode = 'manual' | 'gain' | 'loss' | 'az';

interface WatchlistPanelProps {
  language: 'id' | 'en';
  /** Tab yang memuat panel ini sedang dibuka. */
  isActive: boolean;
  /** Bursa dalam jam perdagangan: harga di-refresh tiap menit. */
  trading: boolean;
  onSelectTicker: (symbol: string) => void;
  /** Buka halaman Watchlist penuh. */
  onOpenFull?: () => void;
}

const COMPACT_ROWS = 6;
const SUGGESTIONS = ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'GTSI'];

/** Ringkasan watchlist untuk Beranda; halaman penuh ada di components/watchlist/watchlist-page.tsx. */
export function WatchlistPanel({ language, isActive, trading, onSelectTicker, onOpenFull }: WatchlistPanelProps) {
  const isId = language === 'id';
  const { entries, isFull, has, add, remove } = useWatchlist();

  const [quotes, setQuotes] = React.useState<Record<string, QuoteItem>>({});
  const [quoteError, setQuoteError] = React.useState(false);
  const [sort, setSort] = React.useState<SortMode>('manual');
  const [showAdd, setShowAdd] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<WatchlistEntry[]>([]);
  const [searching, setSearching] = React.useState(false);

  const symbolsKey = entries.map((e) => e.symbol).join(',');

  const loadQuotes = React.useCallback(async () => {
    if (!symbolsKey) return;
    try {
      const data = await fetchQuotes(symbolsKey.split(','));
      setQuotes((prev) => ({ ...prev, ...data }));
      setQuoteError(false);
    } catch {
      setQuoteError(true);
    }
  }, [symbolsKey]);

  // Admin menekan "Refresh semua data" → ambil ulang segera.
  const refreshEpoch = useDataRefreshEpoch();
  usePolling(loadQuotes, {
    enabled: isActive && entries.length > 0,
    intervalMs: trading ? 60_000 : null,
    minGapMs: 30_000,
    key: `${symbolsKey}|${refreshEpoch}`,
  });

  // Pencarian emiten untuk ditambahkan
  React.useEffect(() => {
    const q = query.trim();
    if (!q) {
      const reset = setTimeout(() => setResults([]), 0);
      return () => clearTimeout(reset);
    }
    const timer = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(`/api/ticker?q=${encodeURIComponent(q)}`);
        const data = res.ok ? await res.json() : { quotes: [] };
        setResults(data.quotes || []);
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const handleAdd = (entry: WatchlistEntry) => {
    if (add(entry)) {
      setQuery('');
      setResults([]);
      setShowAdd(false);
    }
  };

  const sorted = React.useMemo(() => {
    const list = [...entries];
    const pct = (s: string) => quotes[s]?.changePercent ?? 0;
    if (sort === 'gain') list.sort((a, b) => pct(b.symbol) - pct(a.symbol));
    else if (sort === 'loss') list.sort((a, b) => pct(a.symbol) - pct(b.symbol));
    else if (sort === 'az') list.sort((a, b) => a.symbol.localeCompare(b.symbol));
    return list;
  }, [entries, quotes, sort]);

  const visible = sorted.slice(0, COMPACT_ROWS);
  const hiddenCount = sorted.length - visible.length;

  const sortOptions: Array<{ value: SortMode; label: string }> = [
    { value: 'manual', label: isId ? 'Urutan tambah' : 'Added order' },
    { value: 'gain', label: isId ? 'Naik tertinggi' : 'Top gain' },
    { value: 'loss', label: isId ? 'Turun terdalam' : 'Top loss' },
    { value: 'az', label: 'A–Z' },
  ];

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-4 md:p-5 flex flex-col gap-3 h-full">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Star className="h-4 w-4 text-amber-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">Watchlist</span>
          <span className="text-[10px] text-slate-600 tabular-nums">{entries.length}/{WATCHLIST_MAX}</span>
        </div>
        <div className="flex items-center gap-2">
          {entries.length > 1 && (
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortMode)}
              aria-label={isId ? 'Urutkan watchlist' : 'Sort watchlist'}
              className="glass-input bg-background text-foreground px-2 py-1 text-[10px] font-bold rounded-lg cursor-pointer"
            >
              {sortOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          )}
          {!isFull && (
            <button
              type="button"
              onClick={() => setShowAdd((v) => !v)}
              aria-expanded={showAdd}
              className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 transition-colors cursor-pointer"
            >
              <Plus className="h-3 w-3" />
              {isId ? 'Tambah' : 'Add'}
            </button>
          )}
        </div>
      </div>

      {/* Tambah saham */}
      <AnimatePresence>
        {showAdd && !isFull && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-slate-500" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={isId ? 'Cari kode atau nama emiten...' : 'Search ticker or company...'}
                className="w-full glass-input pl-8 pr-20 py-2 text-xs font-medium text-white rounded-xl"
                autoFocus
              />
              {searching && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                  {isId ? 'Mencari...' : 'Searching...'}
                </span>
              )}
            </div>
            {results.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto custom-scrollbar rounded-xl bg-slate-900/95 border border-white/10 p-1.5">
                {results.slice(0, 8).map((r) => {
                  const already = has(r.symbol);
                  return (
                    <button
                      key={r.symbol}
                      type="button"
                      onClick={() => handleAdd(r)}
                      disabled={already}
                      className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/10 disabled:opacity-50 disabled:hover:bg-transparent text-left transition-colors cursor-pointer"
                    >
                      <span className="font-bold text-[11px] text-emerald-400 shrink-0 w-12">{r.symbol}</span>
                      <span className="text-[11px] text-slate-300 truncate flex-1">{r.name}</span>
                      {already ? <Star className="h-3 w-3 fill-amber-400 text-amber-400 shrink-0" /> : <Plus className="h-3 w-3 text-slate-500 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Daftar */}
      {entries.length === 0 ? (
        <div className="text-center py-5 space-y-3">
          <Star className="h-6 w-6 text-slate-700 mx-auto" />
          <p className="text-[11px] text-slate-500">
            {isId ? 'Belum ada saham yang dipantau. Mulai dengan salah satu ini:' : 'No stocks watched yet. Start with one of these:'}
          </p>
          <div className="flex flex-wrap justify-center gap-1.5">
            {SUGGESTIONS.map((symbol) => (
              <button
                key={symbol}
                type="button"
                onClick={() => add({ symbol, name: IDX_TICKERS[symbol] ?? symbol })}
                className="px-2.5 py-1 rounded-lg border border-white/10 hover:border-emerald-500/40 text-[10px] font-bold text-slate-300 hover:text-emerald-400 transition-colors cursor-pointer"
              >
                + {symbol}
              </button>
            ))}
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-1.5">
          {visible.map((entry) => {
            const q = quotes[entry.symbol];
            const isUp = (q?.change ?? 0) >= 0;
            return (
              <div
                key={entry.symbol}
                className="group grid grid-cols-[minmax(0,1fr)_auto_auto_1.5rem] sm:grid-cols-[minmax(0,1fr)_64px_auto_auto_1.5rem] items-center gap-2 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/20 transition-colors"
              >
                <button
                  type="button"
                  onClick={() => onSelectTicker(entry.symbol)}
                  className="min-w-0 text-left cursor-pointer"
                  title={isId ? `Analisis ${entry.symbol}` : `Analyze ${entry.symbol}`}
                >
                  <span className="block font-bold text-xs text-emerald-400 group-hover:text-emerald-300">{entry.symbol}</span>
                  {entry.name !== entry.symbol && (
                    <span className="hidden sm:block text-[10px] text-slate-500 truncate">{entry.name}</span>
                  )}
                </button>
                <span className="hidden sm:block">
                  {q && !q.suspect && <Sparkline values={q.closes} baseline={q.previousClose} width={64} height={22} />}
                </span>
                {q ? (
                  <>
                    <span className="text-xs font-semibold text-slate-200 text-right tabular-nums">
                      {formatNumberLocale(q.price, language)}
                    </span>
                    {q.suspect ? (
                      <span
                        className="text-[10px] font-bold text-right w-14 text-amber-400 cursor-help"
                        title={isId ? 'Data perubahan harga dari sumber meragukan' : 'Price change data from the source looks unreliable'}
                      >
                        ?
                      </span>
                    ) : (
                      <span className={`text-[10px] font-bold text-right tabular-nums w-14 ${isUp ? 'text-emerald-400' : 'text-rose-400'}`}>
                        {isUp ? '+' : ''}{formatNumberLocale(q.changePercent, language, 2)}%
                      </span>
                    )}
                  </>
                ) : (
                  <span className="col-span-2 text-[10px] text-slate-600 text-right">
                    {quoteError ? '—' : isId ? 'Memuat...' : 'Loading...'}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => remove(entry.symbol)}
                  className="h-6 w-6 flex items-center justify-center text-slate-500 hover:text-rose-400 rounded-md transition-all cursor-pointer [@media(hover:hover)]:opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                  aria-label={isId ? `Hapus ${entry.symbol} dari watchlist` : `Remove ${entry.symbol} from watchlist`}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            );
          })}
        </div>
      )}

      {entries.length > 0 && onOpenFull && (
        <button
          type="button"
          onClick={onOpenFull}
          className="mt-auto self-start text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 cursor-pointer"
        >
          {hiddenCount > 0
            ? (isId ? `Lihat semua (${entries.length})` : `View all (${entries.length})`)
            : (isId ? 'Buka watchlist' : 'Open watchlist')}
          <ArrowRight className="h-3 w-3" />
        </button>
      )}

      {isFull && (
        <p className="text-[10px] text-amber-400/80">
          {isId ? `Watchlist penuh (maks ${WATCHLIST_MAX}). Hapus saham untuk menambah yang baru.` : `Watchlist is full (max ${WATCHLIST_MAX}). Remove a stock to add another.`}
        </p>
      )}
    </div>
  );
}
