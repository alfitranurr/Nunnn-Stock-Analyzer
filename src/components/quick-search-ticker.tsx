'use client';

import * as React from 'react';
import { Search, ArrowRight, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface SearchResult {
  symbol: string;
  name: string;
}

interface QuickSearchTickerProps {
  language: 'id' | 'en';
  onSelectTicker: (symbol: string) => void;
}

export function QuickSearchTicker({ language, onSelectTicker }: QuickSearchTickerProps) {
  const [query, setQuery] = React.useState('');
  const [results, setResults] = React.useState<SearchResult[]>([]);
  const [loading, setLoading] = React.useState(false);
  const [showResults, setShowResults] = React.useState(false);
  const [highlightIdx, setHighlightIdx] = React.useState(-1);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const debounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const isId = language === 'id';

  React.useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length < 1) {
      // Clear results via a microtask to avoid set-state-in-effect lint.
      debounceRef.current = setTimeout(() => {
        setResults([]);
        setShowResults(false);
      }, 0);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/ticker?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setResults(data.quotes || []);
          setShowResults(true);
          setHighlightIdx(-1);
        }
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query]);

  const handleSelect = (result: SearchResult) => {
    onSelectTicker(result.symbol);
    setQuery('');
    setShowResults(false);
    setResults([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showResults || results.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev + 1) % results.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIdx((prev) => (prev <= 0 ? results.length - 1 : prev - 1));
    } else if (e.key === 'Enter' && highlightIdx >= 0) {
      e.preventDefault();
      handleSelect(results[highlightIdx]);
    } else if (e.key === 'Escape') {
      setShowResults(false);
    }
  };

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500 pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results.length > 0 && setShowResults(true)}
          onKeyDown={handleKeyDown}
          placeholder={
            isId
              ? 'Cari emiten BEI (mis. BBCA, BBRI, TLKM)...'
              : 'Search IDX ticker (e.g. BBCA, BBRI, TLKM)...'
          }
          className="w-full glass-input pl-11 pr-10 py-3 text-sm font-medium placeholder:text-slate-500 text-white rounded-2xl"
          aria-label={isId ? 'Cari emiten' : 'Search ticker'}
        />
        {query && (
          <button
            onClick={() => {
              setQuery('');
              setResults([]);
              setShowResults(false);
            }}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-300 rounded-md transition-colors"
            aria-label="Clear"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      <AnimatePresence>
        {showResults && (results.length > 0 || loading) && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2 }}
            className="absolute z-50 w-full mt-2 rounded-2xl bg-slate-900/95 border border-white/10 shadow-2xl backdrop-blur-xl max-h-72 overflow-y-auto custom-scrollbar"
          >
            {loading && results.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                {isId ? 'Mencari...' : 'Searching...'}
              </div>
            ) : results.length === 0 ? (
              <div className="p-4 text-center text-xs text-slate-500">
                {isId ? 'Tidak ditemukan.' : 'No results found.'}
              </div>
            ) : (
              <div className="p-1.5">
                {results.slice(0, 10).map((r, i) => (
                  <button
                    key={r.symbol}
                    onClick={() => handleSelect(r)}
                    onMouseEnter={() => setHighlightIdx(i)}
                    className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-xl transition-colors text-left ${
                      highlightIdx === i
                        ? 'bg-emerald-500/10 border border-emerald-500/20'
                        : 'hover:bg-white/5 border border-transparent'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span className="font-black text-xs text-emerald-400 shrink-0 w-14">
                        {r.symbol}
                      </span>
                      <span className="text-xs text-slate-300 truncate font-medium">
                        {r.name}
                      </span>
                    </div>
                    <ArrowRight className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                  </button>
                ))}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
