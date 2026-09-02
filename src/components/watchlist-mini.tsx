'use client';

import * as React from 'react';
import { Eye, Plus, X, TrendingUp, TrendingDown } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface WatchlistEntry {
  symbol: string;
  name: string;
}

interface PriceData {
  price: number;
  change: number;
  changePercent: number;
}

interface WatchlistMiniProps {
  language: 'id' | 'en';
  onSelectTicker: (symbol: string) => void;
}

const STORAGE_KEY = 'nunnn_stock_watchlist';
const MAX_WATCHLIST = 5;

export function WatchlistMini({ language, onSelectTicker }: WatchlistMiniProps) {
  const [watchlist, setWatchlist] = React.useState<WatchlistEntry[]>([]);
  const [prices, setPrices] = React.useState<Record<string, PriceData>>({});
  const [showAdd, setShowAdd] = React.useState(false);
  const [searchQuery, setSearchQuery] = React.useState('');
  const [searchResults, setSearchResults] = React.useState<WatchlistEntry[]>([]);
  const [searchLoading, setSearchLoading] = React.useState(false);

  const isId = language === 'id';

  // Load watchlist from localStorage
  React.useEffect(() => {
    const timer = setTimeout(() => {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setWatchlist(JSON.parse(stored));
        }
      } catch {
        // ignore
      }
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  // Fetch prices for watchlist tickers
  React.useEffect(() => {
    if (watchlist.length === 0) return;

    let cancelled = false;

    (async () => {
      for (const entry of watchlist) {
        if (cancelled) break;
        if (prices[entry.symbol]) continue;
        try {
            const res = await fetch(`/api/ticker?symbol=${entry.symbol}`);
            if (res.ok) {
              const data = await res.json();
              if (!cancelled && data.price) {
                const price = data.price;
                const prevClose = data.previousClose ?? price;
                const change = price - prevClose;
                const changePercent =
                  data.changePercent != null
                    ? data.changePercent
                    : prevClose > 0
                      ? (change / prevClose) * 100
                      : 0;
                setPrices((prev) => ({
                  ...prev,
                  [entry.symbol]: { price, change, changePercent },
                }));
            }
          }
        } catch {
          // ignore
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [watchlist]);

  // Debounced search for add modal
  React.useEffect(() => {
    if (searchQuery.trim().length < 1) {
      const timer = setTimeout(() => setSearchResults([]), 0);
      return () => clearTimeout(timer);
    }

    const timer = setTimeout(async () => {
      setSearchLoading(true);
      try {
        const res = await fetch(`/api/ticker?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.quotes || []);
        }
      } catch {
        setSearchResults([]);
      } finally {
        setSearchLoading(false);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const saveWatchlist = (list: WatchlistEntry[]) => {
    setWatchlist(list);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  };

  const handleAdd = (entry: WatchlistEntry) => {
    if (watchlist.length >= MAX_WATCHLIST) return;
    if (watchlist.some((w) => w.symbol === entry.symbol)) return;
    saveWatchlist([...watchlist, entry]);
    setSearchQuery('');
    setSearchResults([]);
    setShowAdd(false);
  };

  const handleRemove = (symbol: string) => {
    saveWatchlist(watchlist.filter((w) => w.symbol !== symbol));
    setPrices((prev) => {
      const next = { ...prev };
      delete next[symbol];
      return next;
    });
  };

  const fmtPrice = (val: number) =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(val);

  return (
    <div className="rounded-2xl bg-white/[0.02] border border-white/5 p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Eye className="h-4 w-4 text-emerald-400" />
          <span className="text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
            {isId ? 'Watchlist' : 'Watchlist'}
          </span>
          <span className="text-[10px] text-slate-600">
            {watchlist.length}/{MAX_WATCHLIST}
          </span>
        </div>
        {watchlist.length < MAX_WATCHLIST && (
          <button
            onClick={() => setShowAdd(!showAdd)}
            className="text-[10px] font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-0.5 transition-colors cursor-pointer"
          >
            <Plus className="h-3 w-3" />
            {isId ? 'Tambah' : 'Add'}
          </button>
        )}
      </div>

      {/* Add Search */}
      <AnimatePresence>
        {showAdd && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden mb-3"
          >
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={isId ? 'Cari emiten...' : 'Search ticker...'}
                className="w-full glass-input px-3 py-2 text-xs font-medium text-white rounded-xl"
                autoFocus
              />
              {searchLoading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] text-slate-500">
                  {isId ? 'Mencari...' : 'Searching...'}
                </span>
              )}
            </div>
            {searchResults.length > 0 && (
              <div className="mt-2 max-h-32 overflow-y-auto custom-scrollbar rounded-xl bg-slate-900/95 border border-white/10 p-1.5">
                {searchResults.slice(0, 5).map((r) => (
                  <button
                    key={r.symbol}
                    onClick={() => handleAdd(r)}
                    className="w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg hover:bg-emerald-500/10 text-left transition-colors"
                  >
                    <span className="font-bold text-[11px] text-emerald-400 shrink-0 w-12">
                      {r.symbol}
                    </span>
                    <span className="text-[11px] text-slate-300 truncate">{r.name}</span>
                    <Plus className="h-3 w-3 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Watchlist Items */}
      {watchlist.length === 0 ? (
        <div className="text-center py-6">
          <Eye className="h-6 w-6 text-slate-700 mx-auto mb-2" />
          <p className="text-[10px] text-slate-500">
            {isId
              ? 'Belum ada saham yang dipantau. Klik tambah untuk mulai.'
              : 'No stocks watched yet. Click add to start.'}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {watchlist.map((entry) => {
            const priceData = prices[entry.symbol];
            const isUp = (priceData?.change ?? 0) >= 0;
            return (
              <div
                key={entry.symbol}
                className="group flex items-center justify-between gap-3 px-3 py-2 rounded-xl bg-white/[0.02] border border-white/5 hover:border-emerald-500/10 transition-all"
              >
                <button
                  onClick={() => onSelectTicker(entry.symbol)}
                  className="flex items-center gap-2 min-w-0 flex-1 text-left cursor-pointer"
                >
                  <span className="font-bold text-xs text-emerald-400 shrink-0 w-14">
                    {entry.symbol}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate hidden sm:block">
                    {entry.name}
                  </span>
                </button>
                {priceData ? (
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-xs font-semibold text-slate-200">
                      {fmtPrice(priceData.price)}
                    </span>
                    <span
                      className={`text-[10px] font-bold flex items-center gap-0.5 w-16 justify-end ${
                        isUp ? 'text-emerald-400' : 'text-rose-400'
                      }`}
                    >
                      {isUp ? <TrendingUp className="h-2.5 w-2.5" /> : <TrendingDown className="h-2.5 w-2.5" />}
                      {isUp ? '+' : ''}{priceData.changePercent.toFixed(2)}%
                    </span>
                  </div>
                ) : (
                  <span className="text-[10px] text-slate-600 shrink-0 w-16 text-right">
                    {isId ? 'Memuat...' : 'Loading...'}
                  </span>
                )}
                <button
                  onClick={() => handleRemove(entry.symbol)}
                  className="p-1 text-slate-600 hover:text-rose-400 rounded-md transition-colors opacity-0 group-hover:opacity-100 cursor-pointer shrink-0"
                  aria-label="Remove"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
