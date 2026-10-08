'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, Briefcase, Calculator, Edit3, LineChart, Lock, Plus, RefreshCw, Trash2, UserPlus, Wallet } from 'lucide-react';
import { StepperInput } from '@/components/stepper-input';
import { CompanyLogo } from '@/components/company-logo';
import { ConfirmModal } from '@/components/confirm-modal';
import { PageHeader } from '@/components/shared/page-header';
import { useIdxSessionState } from '@/components/home/home-dashboard';
import { useLanguage } from '@/lib/language-context';
import { usePolling } from '@/lib/use-polling';
import { fetchQuotes, type QuoteItem } from '@/lib/quotes';
import { formatIDRCompact, formatNumberLocale, parseFormattedNumber } from '@/lib/format';
import { formatWibTime } from '@/lib/market-hours';
import { cleanCompanyName } from '@/lib/utils';
import type { AppUser } from '@/lib/types';
import { deleteHolding, loadPortfolio, saveCash, saveHolding, type Holding, type PortfolioData } from '@/lib/portfolio-store';
import { Badge, Card, CardTitle, Segmented, Stat, fmtInput, pct, pick, rp, sanitizeNumber, stepMagnitude } from '@/components/shared/calc-ui';
import { HoldingModal, type HoldingModalMode, type HoldingSubmit } from './holding-modal';

interface PortfolioTabProps {
  user: AppUser | null;
  isActive: boolean;
  onSignInClick: () => void;
  onAvgDownClick: (ticker: string, lot: number, avgPrice: number) => void;
  onAnalyzeClick: (ticker: string) => void;
  /** Dipanggil setelah data berubah agar ringkasan di Beranda ikut diperbarui. */
  onChanged?: () => void;
}

type SortKey = 'value' | 'pl' | 'today' | 'ticker';

const ALLOCATION_COLORS = ['bg-emerald-400', 'bg-sky-400', 'bg-amber-400', 'bg-violet-400', 'bg-rose-400', 'bg-teal-300'];
const DIVIDEND_BATCH = 20;

interface Row {
  h: Holding;
  quote: QuoteItem | null;
  shares: number;
  price: number | null;
  cost: number;
  value: number;
  pl: number | null;
  plPct: number | null;
  today: number | null;
  todayPct: number | null;
  weight: number;
  dividendYear: number | null;
}

export function PortfolioTab({ user, isActive, onSignInClick, onAvgDownClick, onAnalyzeClick, onChanged }: PortfolioTabProps) {
  const { language, t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);

  const [data, setData] = React.useState<PortfolioData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [quotes, setQuotes] = React.useState<Record<string, QuoteItem>>({});
  const [quotesAt, setQuotesAt] = React.useState<number | null>(null);
  const [quotesFailed, setQuotesFailed] = React.useState(false);
  const [dividends, setDividends] = React.useState<Record<string, number>>({});
  const [refreshing, setRefreshing] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>('value');
  const [modal, setModal] = React.useState<HoldingModalMode | null>(null);
  const [toDelete, setToDelete] = React.useState<Holding | null>(null);
  const [editingCash, setEditingCash] = React.useState(false);
  const [cashStr, setCashStr] = React.useState('');
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const { trading } = useIdxSessionState(isActive);

  const showToast = React.useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const loadData = async () => {
    if (!user) return;
    const next = await loadPortfolio(user);
    setData(next);
    setLoading(false);
  };

  const holdings = React.useMemo(() => data?.holdings ?? [], [data]);
  const tickersKey = holdings.map((h) => h.ticker.toUpperCase()).sort().join(',');

  const loadQuotes = async () => {
    if (!tickersKey) return;
    try {
      const q = await fetchQuotes(tickersKey.split(','));
      setQuotes(q);
      setQuotesAt(Date.now());
      setQuotesFailed(false);
    } catch {
      setQuotesFailed(true);
    }
  };

  const loadDividends = async () => {
    if (!tickersKey) return;
    const symbols = tickersKey.split(',');
    const result: Record<string, number> = {};
    for (let i = 0; i < symbols.length; i += DIVIDEND_BATCH) {
      try {
        const res = await fetch(`/api/dividend/summary?symbols=${symbols.slice(i, i + DIVIDEND_BATCH).join(',')}`);
        if (!res.ok) continue;
        const json = (await res.json()) as { items: Array<{ symbol: string; ttmDps: number }> };
        for (const item of json.items) result[item.symbol] = item.ttmDps;
      } catch {
        // Estimasi dividen bersifat tambahan; abaikan bila gagal.
      }
    }
    setDividends(result);
  };

  usePolling(loadData, { enabled: isActive && !!user, intervalMs: null, minGapMs: 30_000, key: user?.id ?? '' });
  usePolling(loadQuotes, { enabled: isActive && !!tickersKey, intervalMs: trading ? 60_000 : null, minGapMs: 60_000, key: tickersKey });
  usePolling(loadDividends, { enabled: isActive && !!tickersKey, intervalMs: null, minGapMs: 6 * 3600_000, key: tickersKey });

  // ─── Perhitungan ───
  const rows: Row[] = React.useMemo(() => {
    const base = holdings.map((h) => {
      const shares = h.lot * 100;
      const quote = quotes[h.ticker.toUpperCase()] ?? null;
      const price = quote?.price ?? null;
      const cost = shares * h.avg_price;
      const value = shares * (price ?? h.avg_price);
      const pl = price !== null ? value - cost : null;
      const valid = quote && !quote.suspect;
      const dps = dividends[h.ticker.toUpperCase()];
      return {
        h,
        quote,
        shares,
        price,
        cost,
        value,
        pl,
        plPct: pl !== null && cost > 0 ? (pl / cost) * 100 : null,
        today: valid ? shares * quote.change : null,
        todayPct: valid ? quote.changePercent : null,
        weight: 0,
        dividendYear: dps !== undefined ? dps * shares : null,
      };
    });
    const total = base.reduce((s, r) => s + r.value, 0);
    return base.map((r) => ({ ...r, weight: total > 0 ? (r.value / total) * 100 : 0 }));
  }, [holdings, quotes, dividends]);

  const sorted = React.useMemo(() => {
    const copy = [...rows];
    const num = (v: number | null) => (v === null ? -Infinity : v);
    if (sortKey === 'ticker') copy.sort((a, b) => a.h.ticker.localeCompare(b.h.ticker));
    else if (sortKey === 'pl') copy.sort((a, b) => num(b.plPct) - num(a.plPct));
    else if (sortKey === 'today') copy.sort((a, b) => num(b.todayPct) - num(a.todayPct));
    else copy.sort((a, b) => b.value - a.value);
    return copy;
  }, [rows, sortKey]);

  const totalValue = rows.reduce((s, r) => s + r.value, 0);
  const totalCost = rows.reduce((s, r) => s + r.cost, 0);
  const pricedRows = rows.filter((r) => r.pl !== null);
  const floatingPl = pricedRows.reduce((s, r) => s + (r.pl ?? 0), 0);
  const pricedCost = pricedRows.reduce((s, r) => s + r.cost, 0);
  const todayRows = rows.filter((r) => r.today !== null);
  const todayPl = todayRows.reduce((s, r) => s + (r.today ?? 0), 0);
  const todayBase = todayRows.reduce((s, r) => s + (r.value - (r.today ?? 0)), 0);
  const dividendYear = rows.reduce((s, r) => s + (r.dividendYear ?? 0), 0);
  const missingPrices = rows.length - pricedRows.length;
  const cash = data?.cash ?? null;

  const allocation = React.useMemo(() => {
    const top = [...rows].sort((a, b) => b.weight - a.weight);
    const shown = top.slice(0, ALLOCATION_COLORS.length - (top.length > ALLOCATION_COLORS.length ? 1 : 0));
    const rest = top.slice(shown.length).reduce((s, r) => s + r.weight, 0);
    return { shown, rest };
  }, [rows]);

  // ─── Aksi ───
  const afterChange = async (message: string) => {
    await loadData();
    onChanged?.();
    showToast(message);
  };

  const submitHolding = async (payload: HoldingSubmit) => {
    if (!user || !data) return;
    await saveHolding(user, data.source, payload);
    setModal(null);
    await afterChange(payload.id ? L(`Posisi ${payload.ticker} diperbarui.`, `${payload.ticker} position updated.`) : L(`${payload.ticker} ditambahkan.`, `${payload.ticker} added.`));
  };

  const confirmDelete = async () => {
    const target = toDelete;
    setToDelete(null);
    if (!user || !data || !target) return;
    try {
      await deleteHolding(user, data.source, target.id);
      await afterChange(L(`${target.ticker} dihapus dari portofolio.`, `${target.ticker} removed from the portfolio.`));
    } catch (err) {
      showToast(L(`Gagal menghapus: ${err instanceof Error ? err.message : err}`, `Failed to delete: ${err instanceof Error ? err.message : err}`), 'error');
    }
  };

  const submitCash = async () => {
    if (!user || !data) return;
    try {
      await saveCash(user, data.source, parseFormattedNumber(cashStr));
      setEditingCash(false);
      await afterChange(L('Kas RDN disimpan.', 'RDN cash saved.'));
    } catch (err) {
      showToast(L(`Gagal menyimpan kas: ${err instanceof Error ? err.message : err}`, `Failed to save cash: ${err instanceof Error ? err.message : err}`), 'error');
    }
  };

  const refresh = async () => {
    setRefreshing(true);
    await loadData();
    await loadQuotes();
    setRefreshing(false);
  };

  // ─── Tampilan bantu ───
  const n0 = (v: number) => formatNumberLocale(v, language, 0);
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${rp(Math.abs(v), language)}`;
  const signedPct = (v: number) => `${v > 0 ? '+' : ''}${pct(v, language)}`;
  const tone = (v: number | null) => (v === null || v === 0 ? 'text-slate-300' : v > 0 ? 'text-emerald-400' : 'text-rose-400');

  if (!user) {
    return (
      <div className="space-y-6">
        <PageHeader icon={Briefcase} eyebrow={L('Portofolio', 'Portfolio')} title={L('Portofolio Saya', 'My Portfolio')} />
        <Card className="flex flex-col items-center text-center gap-4 py-12">
          <span className="p-4 rounded-3xl bg-emerald-500/10 border border-emerald-500/25"><Lock className="h-8 w-8 text-emerald-400" /></span>
          <div className="space-y-1.5 max-w-sm">
            <h2 className="text-lg font-black text-white">{t('portfolio.portfolioLocked')}</h2>
            <p className="text-sm text-slate-400 leading-relaxed">{t('portfolio.portfolioLockedDesc')}</p>
          </div>
          <button type="button" onClick={onSignInClick} className="px-5 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-sm font-bold flex items-center gap-2 cursor-pointer">
            <UserPlus className="h-4 w-4" /> {t('portfolio.loginButton')}
          </button>
        </Card>
      </div>
    );
  }

  const actionBtn = 'p-2 rounded-lg border transition-colors cursor-pointer flex items-center justify-center';

  return (
    <div className="space-y-6 w-full">
      <PageHeader
        icon={Briefcase}
        eyebrow={L('Portofolio', 'Portfolio')}
        title={L('Portofolio Saya', 'My Portfolio')}
        description={L(
          'Pantau nilai pasar, floating P/L, perubahan hari ini, bobot, dan estimasi dividen setiap saham yang Anda pegang.',
          'Track market value, floating P/L, today’s change, weights and estimated dividends for every stock you hold.'
        )}
        actions={
          <>
            <button type="button" onClick={() => setModal({ kind: 'add' })} className="flex-1 md:flex-none flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold cursor-pointer">
              <Plus className="h-4 w-4" /> {L('Tambah saham', 'Add stock')}
            </button>
            <button
              type="button"
              onClick={() => void refresh()}
              disabled={refreshing}
              aria-label={L('Muat ulang', 'Refresh')}
              title={L('Muat ulang', 'Refresh')}
              className="p-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 cursor-pointer disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </>
        }
      />

      {data?.warning && (
        <Card className="border-amber-500/30">
          <p className="text-xs text-slate-300 flex gap-2.5">
            <AlertTriangle className="h-4 w-4 text-amber-400 shrink-0" />
            {L(`Data cloud gagal dimuat (${data.warning}); menampilkan data di perangkat ini.`, `Cloud data failed to load (${data.warning}); showing data from this device.`)}
          </p>
        </Card>
      )}

      {/* Ringkasan */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat
          tone="emerald"
          className="col-span-2 lg:col-span-1"
          label={L('Nilai portofolio', 'Portfolio value')}
          value={rp(totalValue + (cash ?? 0), language)}
          sub={cash !== null ? L(`saham ${formatIDRCompact(totalValue, language)} + kas ${formatIDRCompact(cash, language)}`, `stocks ${formatIDRCompact(totalValue, language)} + cash ${formatIDRCompact(cash, language)}`) : L('nilai pasar saham', 'stock market value')}
        />
        <Stat label={L('Modal', 'Cost basis')} value={formatIDRCompact(totalCost, language, 2)} sub={L(`${rows.length} saham`, `${rows.length} stocks`)} />
        <Stat
          tone={floatingPl > 0 ? 'emerald' : floatingPl < 0 ? 'rose' : 'slate'}
          label={L('Floating P/L', 'Floating P/L')}
          value={<span className={tone(floatingPl)}>{signed(floatingPl)}</span>}
          sub={pricedCost > 0 ? signedPct((floatingPl / pricedCost) * 100) : '—'}
        />
        <Stat
          tone={todayPl > 0 ? 'emerald' : todayPl < 0 ? 'rose' : 'slate'}
          label={L('Hari ini', 'Today')}
          value={<span className={tone(todayPl)}>{todayRows.length > 0 ? signed(todayPl) : '—'}</span>}
          sub={todayBase > 0 ? signedPct((todayPl / todayBase) * 100) : L('menunggu harga', 'awaiting prices')}
        />
        <Stat
          tone="amber"
          label={L('Dividen 12 bln', 'Dividends (12m)')}
          value={formatIDRCompact(dividendYear, language, 2)}
          sub={totalCost > 0 ? L(`kotor · yield on cost ${pct((dividendYear / totalCost) * 100, language)}`, `gross · yield on cost ${pct((dividendYear / totalCost) * 100, language)}`) : L('kotor', 'gross')}
        />
      </div>

      {/* Kas RDN */}
      <Card className="py-4 sm:py-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="p-2 rounded-xl bg-sky-500/10 border border-sky-500/20"><Wallet className="h-4 w-4 text-sky-400" /></span>
            <div>
              <span className="block text-[10px] font-bold uppercase tracking-wider text-slate-500">{L('Kas RDN (opsional)', 'RDN cash (optional)')}</span>
              <span className="block text-sm font-black text-white">{cash !== null ? rp(cash, language) : L('Belum diatur', 'Not set')}</span>
            </div>
          </div>
          {editingCash ? (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <StepperInput
                aria-label={L('Kas RDN', 'RDN cash')}
                type="text"
                inputMode="numeric"
                autoFocus
                value={cashStr}
                onChange={(e) => setCashStr(sanitizeNumber(e.target.value))}
                onStep={(dir) => setCashStr((prev) => stepMagnitude(prev, dir, language))}
                decrementLabel={`${t('calculator.decrease')} ${L('kas', 'cash')}`}
                incrementLabel={`${t('calculator.increase')} ${L('kas', 'cash')}`}
                className="flex-1 sm:w-56"
                inputClassName="font-bold text-white"
              />
              <button type="button" onClick={() => void submitCash()} className="px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold cursor-pointer">{L('Simpan', 'Save')}</button>
              <button type="button" onClick={() => setEditingCash(false)} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold cursor-pointer">{L('Batal', 'Cancel')}</button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => {
                setCashStr(cash !== null ? fmtInput(cash, language, 0) : '');
                setEditingCash(true);
              }}
              className="self-start sm:self-auto px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-300 text-xs font-bold cursor-pointer"
            >
              {cash !== null ? L('Ubah kas', 'Edit cash') : L('Atur kas', 'Set cash')}
            </button>
          )}
        </div>
      </Card>

      {/* Kepemilikan */}
      <Card>
        <CardTitle
          icon={<Briefcase className="h-5 w-5 text-emerald-400" />}
          title={L('Kepemilikan saham', 'Holdings')}
          subtitle={
            <>
              {data?.source === 'cloud' ? L('Tersimpan di akun Anda.', 'Stored in your account.') : L('Tersimpan di perangkat ini (mode lokal).', 'Stored on this device (local mode).')}{' '}
              {quotesAt && L(`Harga Yahoo Finance (tertunda), update ${formatWibTime(quotesAt)} WIB.`, `Yahoo Finance prices (delayed), updated ${formatWibTime(quotesAt)} WIB.`)}
              {quotesFailed && <span className="text-amber-400"> {L('Harga gagal dimuat.', 'Prices failed to load.')}</span>}
            </>
          }
          right={rows.length > 1 ? (
            <Segmented
              ariaLabel={L('Urutkan', 'Sort')}
              value={sortKey}
              onChange={setSortKey}
              className="self-start"
              options={[
                { value: 'value', label: L('Nilai', 'Value') },
                { value: 'pl', label: 'P/L %' },
                { value: 'today', label: L('Hari ini', 'Today') },
                { value: 'ticker', label: L('Kode', 'Ticker') },
              ]}
            />
          ) : undefined}
        />

        {loading ? (
          <div className="space-y-2 animate-pulse" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-14 rounded-2xl bg-white/5" />)}
          </div>
        ) : rows.length === 0 ? (
          <div className="py-12 flex flex-col items-center text-center gap-3 rounded-2xl border border-dashed border-white/10">
            <Briefcase className="h-9 w-9 text-slate-600" />
            <div>
              <p className="text-sm font-bold text-white">{L('Portofolio masih kosong', 'Your portfolio is empty')}</p>
              <p className="text-xs text-slate-400 mt-1">{L('Tambahkan saham yang Anda pegang untuk mulai memantau.', 'Add the stocks you hold to start tracking.')}</p>
            </div>
            <button type="button" onClick={() => setModal({ kind: 'add' })} className="px-4 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer">
              <Plus className="h-4 w-4" /> {L('Tambah saham', 'Add stock')}
            </button>
          </div>
        ) : (
          <>
            {/* Alokasi */}
            <div className="mb-5">
              <div className="flex h-3 rounded-full overflow-hidden bg-white/5" role="img" aria-label={L('Alokasi portofolio', 'Portfolio allocation')}>
                {allocation.shown.map((r, i) => (
                  <div key={r.h.id} className={ALLOCATION_COLORS[i]} style={{ width: `${r.weight}%` }} title={`${r.h.ticker} ${pct(r.weight, language, 1)}`} />
                ))}
                {allocation.rest > 0 && <div className="bg-slate-500" style={{ width: `${allocation.rest}%` }} />}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] font-bold text-slate-400">
                {allocation.shown.map((r, i) => (
                  <span key={r.h.id} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${ALLOCATION_COLORS[i]}`} />
                    {r.h.ticker} {pct(r.weight, language, 1)}
                  </span>
                ))}
                {allocation.rest > 0 && (
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-500" />{L('Lainnya', 'Others')} {pct(allocation.rest, language, 1)}</span>
                )}
              </div>
            </div>

            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">{L('Saham', 'Stock')}</th>
                    <th className="py-2.5 px-3 text-right">Lot</th>
                    <th className="py-2.5 px-3 text-right">{L('Avg', 'Avg')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Harga', 'Price')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Nilai pasar', 'Market value')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Floating P/L', 'Floating P/L')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Div. 12 bln', 'Div. 12m')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Aksi', 'Actions')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {sorted.map((r) => (
                    <tr key={r.h.id} className="hover:bg-white/[0.03]">
                      <td className="py-3 px-3">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <CompanyLogo symbol={r.h.ticker} size={34} />
                          <div className="min-w-0">
                            <span className="block font-black text-white">{r.h.ticker}</span>
                            <span className="block text-[10px] text-slate-500 truncate max-w-[160px]">{cleanCompanyName(r.h.company_name) || '—'}</span>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3 text-right tabular-nums">
                        {n0(r.h.lot)}
                        <span className="block text-[10px] text-slate-500">{pct(r.weight, language, 1)}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono">{rp(r.h.avg_price, language)}</td>
                      <td className="py-3 px-3 text-right font-mono">
                        {r.price !== null ? rp(r.price, language) : '—'}
                        <span className={`block text-[10px] ${tone(r.todayPct)}`}>
                          {r.todayPct !== null ? signedPct(r.todayPct) : r.quote?.suspect ? L('data meragukan', 'suspect data') : ''}
                        </span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono font-bold text-white">{rp(r.value, language)}</td>
                      <td className={`py-3 px-3 text-right font-mono font-bold ${tone(r.pl)}`}>
                        {r.pl !== null ? signed(r.pl) : '—'}
                        <span className="block text-[10px]">{r.plPct !== null ? signedPct(r.plPct) : L('harga belum ada', 'no price yet')}</span>
                      </td>
                      <td className="py-3 px-3 text-right font-mono text-amber-300">{r.dividendYear !== null ? formatIDRCompact(r.dividendYear, language, 1) : '—'}</td>
                      <td className="py-3 px-3">
                        <div className="flex justify-end gap-1.5">
                          <button type="button" onClick={() => onAnalyzeClick(r.h.ticker)} className={`${actionBtn} bg-teal-500/10 hover:bg-teal-500/20 text-teal-400 border-teal-500/20`} title={L('Analisis', 'Analyze')} aria-label={L(`Analisis ${r.h.ticker}`, `Analyze ${r.h.ticker}`)}>
                            <LineChart className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => onAvgDownClick(r.h.ticker, r.h.lot, r.h.avg_price)} className={`${actionBtn} bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border-emerald-500/20`} title="Avg Down" aria-label={`Avg Down ${r.h.ticker}`}>
                            <Calculator className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => setModal({ kind: 'edit', holding: r.h })} className={`${actionBtn} bg-white/5 hover:bg-white/10 text-slate-300 border-white/10`} title={L('Ubah', 'Edit')} aria-label={L(`Ubah ${r.h.ticker}`, `Edit ${r.h.ticker}`)}>
                            <Edit3 className="h-4 w-4" />
                          </button>
                          <button type="button" onClick={() => setToDelete(r.h)} className={`${actionBtn} bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border-rose-500/20`} title={L('Hapus', 'Delete')} aria-label={L(`Hapus ${r.h.ticker}`, `Delete ${r.h.ticker}`)}>
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile & tablet */}
            <ul className="lg:hidden space-y-3">
              {sorted.map((r) => (
                <li key={r.h.id} className="p-4 rounded-2xl border border-white/10 bg-white/[0.02]">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <CompanyLogo symbol={r.h.ticker} size={38} />
                      <div className="min-w-0">
                        <span className="block font-black text-white">{r.h.ticker} <span className="text-[10px] font-bold text-slate-500">{pct(r.weight, language, 1)}</span></span>
                        <span className="block text-[10px] text-slate-500 truncate">{cleanCompanyName(r.h.company_name) || '—'}</span>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className={`block text-sm font-black tabular-nums ${tone(r.pl)}`}>{r.pl !== null ? signed(r.pl) : '—'}</span>
                      <span className={`block text-[10px] font-bold ${tone(r.pl)}`}>{r.plPct !== null ? signedPct(r.plPct) : L('harga belum ada', 'no price yet')}</span>
                    </div>
                  </div>
                  <dl className="grid grid-cols-3 gap-2 mt-3 text-[11px]">
                    <div><dt className="text-[9px] uppercase font-bold text-slate-500">Lot · Avg</dt><dd className="font-bold text-slate-200">{n0(r.h.lot)} · {rp(r.h.avg_price, language)}</dd></div>
                    <div>
                      <dt className="text-[9px] uppercase font-bold text-slate-500">{L('Harga', 'Price')}</dt>
                      <dd className="font-bold text-slate-200">{r.price !== null ? rp(r.price, language) : '—'} <span className={tone(r.todayPct)}>{r.todayPct !== null ? signedPct(r.todayPct) : ''}</span></dd>
                    </div>
                    <div><dt className="text-[9px] uppercase font-bold text-slate-500">{L('Nilai', 'Value')}</dt><dd className="font-bold text-white">{formatIDRCompact(r.value, language, 2)}</dd></div>
                  </dl>
                  <div className="grid grid-cols-4 gap-2 mt-3 pt-3 border-t border-white/5">
                    <button type="button" onClick={() => onAnalyzeClick(r.h.ticker)} className={`${actionBtn} gap-1 py-1.5 text-[10px] font-bold bg-teal-500/10 text-teal-400 border-teal-500/20`}><LineChart className="h-3.5 w-3.5" />{L('Analisis', 'Analyze')}</button>
                    <button type="button" onClick={() => onAvgDownClick(r.h.ticker, r.h.lot, r.h.avg_price)} className={`${actionBtn} gap-1 py-1.5 text-[10px] font-bold bg-emerald-500/10 text-emerald-400 border-emerald-500/20`}><Calculator className="h-3.5 w-3.5" />Avg</button>
                    <button type="button" onClick={() => setModal({ kind: 'edit', holding: r.h })} className={`${actionBtn} gap-1 py-1.5 text-[10px] font-bold bg-white/5 text-slate-300 border-white/10`}><Edit3 className="h-3.5 w-3.5" />{L('Ubah', 'Edit')}</button>
                    <button type="button" onClick={() => setToDelete(r.h)} className={`${actionBtn} gap-1 py-1.5 text-[10px] font-bold bg-rose-500/10 text-rose-400 border-rose-500/20`}><Trash2 className="h-3.5 w-3.5" />{L('Hapus', 'Delete')}</button>
                  </div>
                </li>
              ))}
            </ul>

            <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
              {missingPrices > 0 && <><Badge tone="amber">{L(`${missingPrices} tanpa harga`, `${missingPrices} without price`)}</Badge>{' '}</>}
              {L(
                'Floating P/L belum dipotong fee jual & PPh final 0,1%. Saham tanpa harga dinilai di harga rata-rata dan tidak dihitung ke P/L. Dividen 12 bln = dividen kotor per lembar 12 bulan terakhir × jumlah lembar sekarang.',
                'Floating P/L excludes sell fees & 0.1% final tax. Stocks without a price are valued at their average and excluded from P/L. 12-month dividends = gross dividend per share over the last 12 months × current shares.'
              )}
            </p>
          </>
        )}
      </Card>

      <HoldingModal language={language} mode={modal} holdings={holdings} onClose={() => setModal(null)} onSubmit={submitHolding} />

      <ConfirmModal
        isOpen={toDelete !== null}
        onClose={() => setToDelete(null)}
        onConfirm={() => void confirmDelete()}
        title={L(`Hapus ${toDelete?.ticker ?? ''}?`, `Delete ${toDelete?.ticker ?? ''}?`)}
        message={L(
          `${toDelete?.lot ?? 0} lot ${toDelete?.ticker ?? ''} akan dihapus permanen dari portofolio.`,
          `${toDelete?.lot ?? 0} lots of ${toDelete?.ticker ?? ''} will be permanently removed from the portfolio.`
        )}
        confirmText={L('Ya, hapus', 'Yes, delete')}
        cancelText={L('Batal', 'Cancel')}
        type="danger"
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="status"
            className={`fixed bottom-6 right-6 z-[80] px-4 py-3 rounded-xl border shadow-xl text-xs font-bold text-white ${toast.type === 'success' ? 'bg-emerald-600/95 border-emerald-400/40' : 'bg-rose-600/95 border-rose-400/40'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
