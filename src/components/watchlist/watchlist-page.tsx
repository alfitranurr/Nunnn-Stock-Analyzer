'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BellRing, ChevronDown, ChevronUp, LineChart, Plus, Star, Target, Trash2 } from 'lucide-react';
import { PageHeader } from '@/components/shared/page-header';
import { QuickSearchTicker } from '@/components/quick-search-ticker';
import { CompanyLogo } from '@/components/company-logo';
import { StepperInput } from '@/components/stepper-input';
import { Sparkline } from '@/components/home/sparkline';
import { MarketStatusBar } from '@/components/home/market-status-bar';
import { useIdxSessionState } from '@/components/home/home-dashboard';
import { Badge, Card, Segmented, Stat, fmtInput, pct, pick, rp, sanitizeNumber, type Lang } from '@/components/shared/calc-ui';
import { useLanguage } from '@/lib/language-context';
import { usePolling } from '@/lib/use-polling';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';
import { fetchQuotes, type QuoteItem } from '@/lib/quotes';
import { IDX_TICKERS } from '@/lib/tickers';
import { formatIDRCompact, formatNumberLocale, parseFormattedNumber } from '@/lib/format';
import { getAutoRejectionStatus, stepIdxPrice } from '@/lib/calculator';
import { WATCHLIST_MAX, isTargetReached, useWatchlist, type WatchlistEntry, type WatchlistTargetKind } from '@/lib/watchlist-store';

type SortMode = 'manual' | 'gain' | 'loss' | 'value' | 'az';

const SUGGESTIONS = ['BBCA', 'BBRI', 'BMRI', 'TLKM', 'ASII', 'ANTM', 'GOTO', 'ADRO'];

interface WatchlistPageProps {
  language: Lang;
  isActive: boolean;
  onSelectTicker: (symbol: string) => void;
}

interface Row {
  entry: WatchlistEntry;
  quote: QuoteItem | null;
  /** Perubahan yang bisa dipercaya (null bila data meragukan / belum ada). */
  changePct: number | null;
  value: number | null;
  low: number | null;
  high: number | null;
  limit: 'ARA' | 'ARB' | null;
  targetDistancePct: number | null;
  targetReached: boolean;
}

/** Halaman Watchlist penuh: harga live, rentang intraday, nilai transaksi, ARA/ARB, dan harga incaran. */
export function WatchlistPage({ language, isActive, onSelectTicker }: WatchlistPageProps) {
  const { t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const { entries, isFull, has, add, remove, setTarget, move } = useWatchlist();
  const { now, session, trading } = useIdxSessionState(isActive);

  const [quotes, setQuotes] = React.useState<Record<string, QuoteItem>>({});
  const [updatedAt, setUpdatedAt] = React.useState<number | null>(null);
  const [refreshing, setRefreshing] = React.useState(false);
  const [quoteError, setQuoteError] = React.useState(false);
  const [sort, setSort] = React.useState<SortMode>('manual');
  const [editing, setEditing] = React.useState<string | null>(null);
  const [toast, setToast] = React.useState<string | null>(null);

  const symbolsKey = entries.map((e) => e.symbol).join(',');

  const showToast = React.useCallback((message: string) => {
    setToast(message);
    window.setTimeout(() => setToast(null), 3000);
  }, []);

  const loadQuotes = async () => {
    if (!symbolsKey) return;
    setRefreshing(true);
    try {
      const data = await fetchQuotes(symbolsKey.split(','));
      setQuotes((prev) => ({ ...prev, ...data }));
      setUpdatedAt(Date.now());
      setQuoteError(false);
    } catch {
      setQuoteError(true);
    } finally {
      setRefreshing(false);
    }
  };

  // Admin menekan "Refresh semua data" → ambil ulang segera.
  const refreshEpoch = useDataRefreshEpoch();
  usePolling(loadQuotes, { enabled: isActive && entries.length > 0, intervalMs: trading ? 60_000 : null, minGapMs: 30_000, key: `${symbolsKey}|${refreshEpoch}` });

  const addSymbol = (raw: string) => {
    const symbol = raw.toUpperCase().replace(/\.JK$/, '');
    if (has(symbol)) {
      showToast(L(`${symbol} sudah ada di watchlist.`, `${symbol} is already on the watchlist.`));
      return;
    }
    if (isFull) {
      showToast(L(`Watchlist penuh (maks ${WATCHLIST_MAX}).`, `Watchlist is full (max ${WATCHLIST_MAX}).`));
      return;
    }
    if (add({ symbol, name: IDX_TICKERS[symbol] ?? symbol })) showToast(L(`${symbol} ditambahkan.`, `${symbol} added.`));
  };

  // ─── Baris ───
  const rows: Row[] = entries.map((entry) => {
    const quote = quotes[entry.symbol] ?? null;
    const valid = quote && !quote.suspect;
    const series = quote ? [...quote.closes, quote.price].filter((v) => v > 0) : [];
    const target = entry.target;
    return {
      entry,
      quote,
      changePct: valid ? quote.changePercent : null,
      value: quote ? quote.price * quote.volume : null,
      low: series.length > 0 ? Math.min(...series) : null,
      high: series.length > 0 ? Math.max(...series) : null,
      limit: valid && now !== null ? getAutoRejectionStatus(quote.previousClose, quote.price, now) : null,
      targetDistancePct: target && quote ? ((target.price - quote.price) / quote.price) * 100 : null,
      targetReached: isTargetReached(target, quote?.price),
    };
  });

  const sorted = [...rows];
  const num = (v: number | null, fallback: number) => (v === null ? fallback : v);
  if (sort === 'gain') sorted.sort((a, b) => num(b.changePct, -Infinity) - num(a.changePct, -Infinity));
  else if (sort === 'loss') sorted.sort((a, b) => num(a.changePct, Infinity) - num(b.changePct, Infinity));
  else if (sort === 'value') sorted.sort((a, b) => num(b.value, -1) - num(a.value, -1));
  else if (sort === 'az') sorted.sort((a, b) => a.entry.symbol.localeCompare(b.entry.symbol));

  const priced = rows.filter((r) => r.changePct !== null);
  const up = priced.filter((r) => (r.changePct ?? 0) > 0).length;
  const down = priced.filter((r) => (r.changePct ?? 0) < 0).length;
  const flat = priced.length - up - down;
  const avg = priced.length > 0 ? priced.reduce((s, r) => s + (r.changePct ?? 0), 0) / priced.length : null;
  const best = priced.length > 0 ? priced.reduce((a, b) => ((b.changePct ?? 0) > (a.changePct ?? 0) ? b : a)) : null;
  const worst = priced.length > 0 ? priced.reduce((a, b) => ((b.changePct ?? 0) < (a.changePct ?? 0) ? b : a)) : null;
  const reached = rows.filter((r) => r.targetReached);

  const signedPct = (v: number) => `${v > 0 ? '+' : ''}${pct(v, language)}`;
  const tone = (v: number | null) => (v === null || v === 0 ? 'text-slate-300' : v > 0 ? 'text-emerald-400' : 'text-rose-400');
  const lastOf = (r: Row) => (r.quote ? rp(r.quote.price, language) : quoteError ? '—' : '…');

  const changeCell = (r: Row) =>
    r.quote ? (
      r.changePct !== null ? (
        <span className={`tabular-nums ${tone(r.quote.change)}`}>
          {r.quote.change > 0 ? '+' : ''}{formatNumberLocale(r.quote.change, language)}
          <span className="block text-[10px] font-bold">{signedPct(r.changePct)}</span>
        </span>
      ) : (
        <span className="text-amber-400 text-[10px] font-bold" title={L('Data perubahan harga dari sumber meragukan', 'Price change data from the source looks unreliable')}>{L('data meragukan', 'suspect data')}</span>
      )
    ) : (
      <span className="text-slate-600">—</span>
    );

  const rangeCell = (r: Row) => {
    if (!r.quote || r.low === null || r.high === null) return <span className="text-slate-600">—</span>;
    const span = r.high - r.low;
    const pos = span > 0 ? ((r.quote.price - r.low) / span) * 100 : 50;
    return (
      <div className="w-28" title={L('Rentang intraday (bar 5 menit)', 'Intraday range (5-minute bars)')}>
        <div className="relative h-1.5 rounded-full bg-white/10">
          <span className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 h-3 w-1 rounded bg-white" style={{ left: `${pos}%` }} />
        </div>
        <div className="flex justify-between text-[9px] text-slate-500 mt-1 tabular-nums">
          <span>{formatNumberLocale(r.low, language)}</span>
          <span>{formatNumberLocale(r.high, language)}</span>
        </div>
      </div>
    );
  };

  const targetCell = (r: Row) => {
    const tg = r.entry.target;
    if (!tg) {
      return (
        <button type="button" onClick={() => setEditing(r.entry.symbol)} className="text-[11px] font-bold text-slate-500 hover:text-emerald-400 flex items-center gap-1 cursor-pointer">
          <Target className="h-3.5 w-3.5" /> {L('Atur target', 'Set target')}
        </button>
      );
    }
    return (
      <button type="button" onClick={() => setEditing(r.entry.symbol)} className="text-left cursor-pointer group/target">
        <span className={`block text-[11px] font-bold ${r.targetReached ? 'text-amber-300' : 'text-slate-200'} group-hover/target:text-emerald-400`}>
          {tg.kind === 'buy' ? L('Beli ≤', 'Buy ≤') : L('Jual ≥', 'Sell ≥')} {rp(tg.price, language)}
        </span>
        <span className="block text-[10px] text-slate-500">
          {r.targetReached ? L('tercapai', 'reached') : r.targetDistancePct !== null ? L(`${signedPct(r.targetDistancePct)} lagi`, `${signedPct(r.targetDistancePct)} away`) : ''}
        </span>
      </button>
    );
  };

  const actions = (r: Row, index: number) => (
    <div className="flex items-center justify-end gap-1">
      {sort === 'manual' && (
        <>
          <button type="button" onClick={() => move(r.entry.symbol, -1)} disabled={index === 0} aria-label={L(`Naikkan ${r.entry.symbol}`, `Move ${r.entry.symbol} up`)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 cursor-pointer">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={() => move(r.entry.symbol, 1)} disabled={index === sorted.length - 1} aria-label={L(`Turunkan ${r.entry.symbol}`, `Move ${r.entry.symbol} down`)} className="p-1.5 rounded-lg text-slate-500 hover:text-white hover:bg-white/5 disabled:opacity-25 cursor-pointer">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
        </>
      )}
      <button type="button" onClick={() => onSelectTicker(r.entry.symbol)} title={L('Analisis', 'Analyze')} aria-label={L(`Analisis ${r.entry.symbol}`, `Analyze ${r.entry.symbol}`)} className="p-1.5 rounded-lg border border-teal-500/20 bg-teal-500/10 text-teal-400 hover:bg-teal-500/20 cursor-pointer">
        <LineChart className="h-3.5 w-3.5" />
      </button>
      <button type="button" onClick={() => remove(r.entry.symbol)} title={L('Hapus', 'Remove')} aria-label={L(`Hapus ${r.entry.symbol}`, `Remove ${r.entry.symbol}`)} className="p-1.5 rounded-lg border border-rose-500/20 bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 cursor-pointer">
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );

  const nameCell = (r: Row) => (
    <button type="button" onClick={() => onSelectTicker(r.entry.symbol)} className="flex items-center gap-2.5 min-w-0 text-left cursor-pointer group/name" title={L(`Analisis ${r.entry.symbol}`, `Analyze ${r.entry.symbol}`)}>
      <CompanyLogo symbol={r.entry.symbol} size={34} />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className="font-black text-white group-hover/name:text-emerald-400">{r.entry.symbol}</span>
          {r.limit && <Badge tone={r.limit === 'ARA' ? 'emerald' : 'amber'}>{r.limit}</Badge>}
          {r.targetReached && <BellRing className="h-3.5 w-3.5 text-amber-300" aria-label={L('Target tercapai', 'Target reached')} />}
        </span>
        <span className="block text-[10px] text-slate-500 truncate max-w-[180px]">{r.entry.name !== r.entry.symbol ? r.entry.name : IDX_TICKERS[r.entry.symbol] ?? '—'}</span>
      </span>
    </button>
  );

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        icon={Star}
        eyebrow={L('Pantau saham', 'Track stocks')}
        title={L('Watchlist Saham', 'Stock Watchlist')}
        description={L(
          `Pantau hingga ${WATCHLIST_MAX} saham dengan harga live, rentang intraday, nilai transaksi, status ARA/ARB, dan harga incaran beli/jual.`,
          `Track up to ${WATCHLIST_MAX} stocks with live prices, intraday range, traded value, ARA/ARB status and buy/sell target prices.`
        )}
      />

      <MarketStatusBar
        language={language}
        session={session}
        now={now}
        updatedAt={updatedAt}
        refreshing={refreshing}
        onRefresh={() => void loadQuotes()}
        source={{ label: 'Yahoo Finance', delayed: true }}
      />

      {entries.length > 0 && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Stat label={L('Dipantau', 'Watching')} value={`${entries.length}/${WATCHLIST_MAX}`} sub={L(`${up} naik · ${down} turun · ${flat} tetap`, `${up} up · ${down} down · ${flat} flat`)} />
          <Stat tone={avg === null ? 'slate' : avg >= 0 ? 'emerald' : 'rose'} label={L('Rata-rata hari ini', 'Average today')} value={<span className={tone(avg)}>{avg !== null ? signedPct(avg) : '—'}</span>} sub={L('perubahan rata-rata', 'mean change')} />
          <Stat tone="emerald" label={L('Terkuat', 'Strongest')} value={best ? best.entry.symbol : '—'} sub={best ? signedPct(best.changePct ?? 0) : undefined} />
          <Stat tone="rose" label={L('Terlemah', 'Weakest')} value={worst ? worst.entry.symbol : '—'} sub={worst ? signedPct(worst.changePct ?? 0) : undefined} />
        </div>
      )}

      {reached.length > 0 && (
        <div role="status" className="p-4 rounded-2xl border border-amber-500/40 bg-amber-500/10 flex items-start gap-3">
          <BellRing className="h-5 w-5 text-amber-300 shrink-0" />
          <div className="text-xs text-amber-100 space-y-0.5">
            <p className="font-bold">{L('Harga incaran tercapai', 'Target price reached')}</p>
            {reached.map((r) => (
              <p key={r.entry.symbol}>
                {r.entry.symbol}: {r.entry.target?.kind === 'buy' ? L('harga turun ke', 'price fell to') : L('harga naik ke', 'price rose to')} {r.quote ? rp(r.quote.price, language) : '—'} ({L('target', 'target')} {rp(r.entry.target?.price ?? 0, language)})
              </p>
            ))}
          </div>
        </div>
      )}

      <Card>
        <div className="flex flex-col lg:flex-row lg:items-center gap-3 mb-4">
          <div className="flex-1">
            {isFull ? (
              <p className="text-xs text-amber-400">{L(`Watchlist penuh (maks ${WATCHLIST_MAX}). Hapus saham untuk menambah yang baru.`, `Watchlist is full (max ${WATCHLIST_MAX}). Remove a stock to add another.`)}</p>
            ) : (
              <QuickSearchTicker language={language} onSelectTicker={addSymbol} />
            )}
          </div>
          {entries.length > 1 && (
            <Segmented
              ariaLabel={L('Urutkan', 'Sort')}
              value={sort}
              onChange={setSort}
              className="lg:w-[420px]"
              options={[
                { value: 'manual', label: L('Urutan saya', 'My order') },
                { value: 'gain', label: L('Naik', 'Gainers') },
                { value: 'loss', label: L('Turun', 'Losers') },
                { value: 'value', label: L('Nilai', 'Value') },
                { value: 'az', label: 'A–Z' },
              ]}
            />
          )}
        </div>

        {entries.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center gap-3 rounded-2xl border border-dashed border-white/10">
            <Star className="h-9 w-9 text-slate-600" />
            <div>
              <p className="text-sm font-bold text-white">{L('Belum ada saham yang dipantau', 'No stocks on your watchlist yet')}</p>
              <p className="text-xs text-slate-400 mt-1">{L('Cari kode saham di atas, atau mulai dengan salah satu ini:', 'Search a ticker above, or start with one of these:')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-1.5">
              {SUGGESTIONS.map((s) => (
                <button key={s} type="button" onClick={() => addSymbol(s)} className="px-3 py-1.5 rounded-xl border border-white/10 hover:border-emerald-500/40 text-[11px] font-bold text-slate-300 hover:text-emerald-400 flex items-center gap-1 cursor-pointer">
                  <Plus className="h-3 w-3" /> {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">{L('Saham', 'Stock')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Harga', 'Price')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Perubahan', 'Change')}</th>
                    <th className="py-2.5 px-3">{L('Intraday', 'Intraday')}</th>
                    <th className="py-2.5 px-3">{L('Rentang hari ini', 'Day range')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Nilai transaksi', 'Traded value')}</th>
                    <th className="py-2.5 px-3">{L('Harga incaran', 'Target')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Aksi', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {sorted.map((r, i) => (
                    <React.Fragment key={r.entry.symbol}>
                      <tr className={r.targetReached ? 'bg-amber-500/[0.05]' : 'hover:bg-white/[0.03]'}>
                        <td className="py-3 px-3">{nameCell(r)}</td>
                        <td className="py-3 px-3 text-right font-mono font-bold text-white">{lastOf(r)}</td>
                        <td className="py-3 px-3 text-right font-mono">{changeCell(r)}</td>
                        <td className="py-3 px-3">
                          {r.quote && !r.quote.suspect && r.quote.closes.length > 1 ? <Sparkline values={r.quote.closes} baseline={r.quote.previousClose} width={110} height={30} /> : <span className="text-slate-600">—</span>}
                        </td>
                        <td className="py-3 px-3">{rangeCell(r)}</td>
                        <td className="py-3 px-3 text-right font-mono">{r.value !== null && r.value > 0 ? formatIDRCompact(r.value, language, 1) : '—'}</td>
                        <td className="py-3 px-3">{targetCell(r)}</td>
                        <td className="py-3 px-3">{actions(r, i)}</td>
                      </tr>
                      {editing === r.entry.symbol && (
                        <tr>
                          <td colSpan={8} className="px-3 pb-3">
                            <TargetEditor language={language} entry={r.entry} marketPrice={r.quote?.price ?? null} onClose={() => setEditing(null)} onSave={(target) => { setTarget(r.entry.symbol, target); setEditing(null); }} decrease={t('calculator.decrease')} increase={t('calculator.increase')} />
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile & tablet */}
            <ul className="lg:hidden space-y-2.5">
              {sorted.map((r, i) => (
                <li key={r.entry.symbol} className={`p-3.5 rounded-2xl border ${r.targetReached ? 'border-amber-500/40 bg-amber-500/[0.05]' : 'border-white/10 bg-white/[0.02]'}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">{nameCell(r)}</div>
                    <div className="text-right shrink-0">
                      <span className="block font-mono font-bold text-white text-sm">{lastOf(r)}</span>
                      <span className="block font-mono text-xs">{changeCell(r)}</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-3 mt-3">
                    {r.quote && !r.quote.suspect && r.quote.closes.length > 1 ? <Sparkline values={r.quote.closes} baseline={r.quote.previousClose} width={120} height={30} /> : <span />}
                    {rangeCell(r)}
                  </div>
                  <div className="flex items-center justify-between gap-2 mt-3 pt-3 border-t border-white/5">
                    <div className="min-w-0">
                      {targetCell(r)}
                      <span className="block text-[10px] text-slate-500 mt-0.5">{L('Nilai', 'Value')} {r.value !== null && r.value > 0 ? formatIDRCompact(r.value, language, 1) : '—'}</span>
                    </div>
                    {actions(r, i)}
                  </div>
                  {editing === r.entry.symbol && (
                    <div className="mt-3">
                      <TargetEditor language={language} entry={r.entry} marketPrice={r.quote?.price ?? null} onClose={() => setEditing(null)} onSave={(target) => { setTarget(r.entry.symbol, target); setEditing(null); }} decrease={t('calculator.decrease')} increase={t('calculator.increase')} />
                    </div>
                  )}
                </li>
              ))}
            </ul>

            <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
              {L(
                'Harga Yahoo Finance (tertunda), diperbarui tiap menit selama jam bursa. Rentang hari ini dihitung dari bar 5 menit. Harga incaran tersimpan bersama watchlist (ikut tersinkron ke akun) dan ditandai saat tercapai ketika halaman ini dibuka.',
                'Yahoo Finance prices (delayed), refreshed every minute during market hours. The day range comes from 5-minute bars. Targets are saved with the watchlist (synced to your account) and flagged when reached while this page is open.'
              )}
            </p>
          </>
        )}
      </Card>

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="status"
            className="fixed bottom-6 right-6 z-[80] px-4 py-3 rounded-xl border shadow-xl text-xs font-bold text-white bg-emerald-600/95 border-emerald-400/40"
          >
            {toast}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function TargetEditor({
  language,
  entry,
  marketPrice,
  onSave,
  onClose,
  decrease,
  increase,
}: {
  language: Lang;
  entry: WatchlistEntry;
  marketPrice: number | null;
  onSave: (target: { price: number; kind: WatchlistTargetKind } | null) => void;
  onClose: () => void;
  decrease: string;
  increase: string;
}) {
  const L = (id: string, en: string) => pick(language, id, en);
  const [kind, setKind] = React.useState<WatchlistTargetKind>(entry.target?.kind ?? 'buy');
  const [priceStr, setPriceStr] = React.useState(() => fmtInput(entry.target?.price ?? marketPrice ?? 0, language, 0));
  const price = parseFormattedNumber(priceStr);
  const distance = marketPrice && price > 0 ? ((price - marketPrice) / marketPrice) * 100 : null;

  return (
    <div className="p-3.5 rounded-2xl border border-emerald-500/25 bg-emerald-500/[0.04] flex flex-col md:flex-row md:items-end gap-3">
      <div className="space-y-1.5">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{L(`Harga incaran ${entry.symbol}`, `${entry.symbol} target`)}</span>
        <Segmented
          ariaLabel={L('Jenis target', 'Target type')}
          value={kind}
          onChange={setKind}
          className="md:w-64"
          options={[
            { value: 'buy', label: L('Beli di bawah', 'Buy below') },
            { value: 'sell', label: L('Jual di atas', 'Sell above') },
          ]}
        />
      </div>
      <div className="md:w-48 space-y-1.5">
        <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">
          {L('Harga', 'Price')}
          {distance !== null && <span className="normal-case tracking-normal font-semibold text-slate-400"> · {distance > 0 ? '+' : ''}{pct(distance, language)} {L('dari harga', 'from price')}</span>}
        </span>
        <StepperInput
          aria-label={L('Harga incaran', 'Target price')}
          type="text"
          inputMode="numeric"
          value={priceStr}
          onChange={(e) => setPriceStr(sanitizeNumber(e.target.value))}
          onStep={(dir) => setPriceStr(fmtInput(stepIdxPrice(price, dir), language, 0))}
          canDecrement={price > 1}
          decrementLabel={`${decrease} ${L('harga', 'price')}`}
          incrementLabel={`${increase} ${L('harga', 'price')}`}
          inputClassName="font-bold text-white"
        />
      </div>
      <div className="flex gap-2 md:ml-auto">
        {entry.target && (
          <button type="button" onClick={() => onSave(null)} className="px-3 py-2 rounded-xl text-xs font-bold text-rose-300 hover:bg-rose-500/10 cursor-pointer">{L('Hapus target', 'Remove')}</button>
        )}
        <button type="button" onClick={onClose} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-slate-300 cursor-pointer">{L('Batal', 'Cancel')}</button>
        <button type="button" disabled={!(price > 0)} onClick={() => onSave({ price, kind })} className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-xs font-bold text-white cursor-pointer disabled:opacity-50">{L('Simpan', 'Save')}</button>
      </div>
    </div>
  );
}
