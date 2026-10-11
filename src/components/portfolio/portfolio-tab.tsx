'use client';

import * as React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, ArrowDownRight, ArrowUpDown, ArrowUpRight, Briefcase, Calculator, Edit3, Lightbulb, LineChart, Lock, PieChart, Plus, RefreshCw, Trash2, UserPlus, Wallet } from 'lucide-react';
import { AnimatedNumber, GrowBar, Stagger, StaggerItem } from '@/components/shared/motion';
import { StepperInput } from '@/components/stepper-input';
import { CompanyLogo } from '@/components/company-logo';
import { ConfirmModal } from '@/components/confirm-modal';
import { PageHeader } from '@/components/shared/page-header';
import { useIdxSessionState } from '@/components/home/home-dashboard';
import { useLanguage } from '@/lib/language-context';
import { usePolling } from '@/lib/use-polling';
import { LIVE_POLL_MS, useDataRefreshEpoch } from '@/lib/refresh-signal';
import { fetchQuotes, type QuoteItem } from '@/lib/quotes';
import { formatNumberLocale, parseFormattedNumber } from '@/lib/format';
import { formatWibTime } from '@/lib/market-hours';
import { cleanCompanyName } from '@/lib/utils';
import type { AppUser } from '@/lib/types';
import { deleteHolding, loadPortfolio, saveCash, saveHolding, type Holding, type PortfolioData } from '@/lib/portfolio-store';
import { Badge, Card, CardTitle, Segmented, Stat, fmtInput, formatDate, pct, pick, rp2 as rp, sanitizeNumber, stepMagnitude } from '@/components/shared/calc-ui';
import { HoldingModal, type HoldingModalMode, type HoldingSubmit } from './holding-modal';
import { PerformanceJournal, usePortfolioJournal } from './performance-journal';

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
  div: DividendInfo | null;
  divFailed: boolean;
}

interface DividendInfo {
  ttmDps: number;
  lastExDate: string | null;
  lastAmount: number | null;
}

export function PortfolioTab({ user, isActive, onSignInClick, onAvgDownClick, onAnalyzeClick, onChanged }: PortfolioTabProps) {
  const { language, t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);

  const [data, setData] = React.useState<PortfolioData | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [quotes, setQuotes] = React.useState<Record<string, QuoteItem>>({});
  const [quotesAt, setQuotesAt] = React.useState<number | null>(null);
  const [quotesFailed, setQuotesFailed] = React.useState(false);
  const [dividends, setDividends] = React.useState<Record<string, DividendInfo>>({});
  const [divFailed, setDivFailed] = React.useState<string[]>([]);
  const [divLoaded, setDivLoaded] = React.useState(false);
  const divRetryRef = React.useRef(0);
  const [refreshing, setRefreshing] = React.useState(false);
  const [sortKey, setSortKey] = React.useState<SortKey>('value');
  const [modal, setModal] = React.useState<HoldingModalMode | null>(null);
  const [toDelete, setToDelete] = React.useState<Holding | null>(null);
  const [editingCash, setEditingCash] = React.useState(false);
  const [cashStr, setCashStr] = React.useState('');
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [view, setView] = React.useState<'holdings' | 'journal'>('holdings');
  const [confirmResetJournal, setConfirmResetJournal] = React.useState(false);

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

  /**
   * Dividen 12 bulan per emiten. Emiten yang gagal dimuat ditandai (bukan dianggap "tanpa dividen")
   * dan dicoba lagi otomatis; `only` = hanya muat ulang emiten tertentu (yang gagal).
   */
  const loadDividends = async (only?: string[]) => {
    if (!tickersKey) return;
    const symbols = only ?? tickersKey.split(',');
    if (!only) divRetryRef.current = 0;
    const result: Record<string, DividendInfo> = {};
    const failed: string[] = [];
    for (let i = 0; i < symbols.length; i += DIVIDEND_BATCH) {
      const batch = symbols.slice(i, i + DIVIDEND_BATCH);
      try {
        const res = await fetch(`/api/dividend/summary?symbols=${batch.join(',')}`);
        if (!res.ok) throw new Error(String(res.status));
        const json = (await res.json()) as {
          items: Array<{ symbol: string; ttmDps: number; lastExDate: string | null; lastAmount?: number | null }>;
          failed?: string[];
          unknown?: string[];
        };
        for (const item of json.items) result[item.symbol] = { ttmDps: item.ttmDps, lastExDate: item.lastExDate, lastAmount: item.lastAmount ?? null };
        // Tidak ada data di sumber = belum pernah membagi dividen (bukan gagal).
        for (const s of json.unknown ?? []) result[s] = { ttmDps: 0, lastExDate: null, lastAmount: null };
        failed.push(...(json.failed ?? []), ...batch.filter((s) => !(s in result) && !(json.failed ?? []).includes(s)));
      } catch {
        failed.push(...batch);
      }
    }
    setDividends((prev) => (only ? { ...prev, ...result } : result));
    setDivFailed(failed);
    setDivLoaded(true);
  };

  // Emiten yang gagal dimuat dicoba lagi otomatis (15 dtk, 30 dtk, 45 dtk).
  React.useEffect(() => {
    if (divFailed.length === 0 || !isActive || divRetryRef.current >= 3) return;
    const attempt = ++divRetryRef.current;
    const t = window.setTimeout(() => void loadDividends(divFailed), attempt * 15_000);
    return () => window.clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- loadDividends dibuat ulang tiap render
  }, [divFailed, isActive]);

  // Admin menekan "Refresh semua data" → ambil ulang segera.
  const refreshEpoch = useDataRefreshEpoch();
  usePolling(loadData, { enabled: isActive && !!user, intervalMs: null, minGapMs: 30_000, key: `${user?.id ?? ''}|${refreshEpoch}` });
  usePolling(loadQuotes, { enabled: isActive && !!tickersKey, intervalMs: trading ? LIVE_POLL_MS : null, minGapMs: 15_000, key: `${tickersKey}|${refreshEpoch}` });
  usePolling(() => loadDividends(), { enabled: isActive && !!tickersKey, intervalMs: null, minGapMs: 30 * 60_000, key: `${tickersKey}|${refreshEpoch}` });

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
      const div = dividends[h.ticker.toUpperCase()] ?? null;
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
        dividendYear: div ? div.ttmDps * shares : null,
        div,
        divFailed: divFailed.includes(h.ticker.toUpperCase()),
      };
    });
    const total = base.reduce((s, r) => s + r.value, 0);
    return base.map((r) => ({ ...r, weight: total > 0 ? (r.value / total) * 100 : 0 }));
  }, [holdings, quotes, dividends, divFailed]);

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

  // ─── Jurnal target & performa: nilai portofolio dicatat hanya bila semua harga valid ───
  const journalReady =
    !loading &&
    (holdings.length === 0 ? (cash ?? 0) > 0 : rows.every((r) => r.quote !== null && !r.quote.suspect));
  const journal = usePortfolioJournal({ user, isActive, value: journalReady ? totalValue + (cash ?? 0) : null, ready: journalReady });

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

  // ─── Wawasan dinamis ───
  type InsightTone = 'emerald' | 'amber' | 'rose' | 'sky';
  const insights: Array<{
    key: string;
    icon: typeof Lightbulb;
    tone: InsightTone;
    title: string;
    value: string;
    text: string;
    action?: { label: string; onClick: () => void };
  }> = [];
  if (rows.length > 0 && totalValue > 0) {
    const top = rows.reduce((a, b) => (b.weight > a.weight ? b : a));
    const concentrated = top.weight > 40;
    insights.push({
      key: 'concentration',
      icon: PieChart,
      tone: concentrated ? 'amber' : 'sky',
      title: L('Konsentrasi', 'Concentration'),
      value: `${top.h.ticker} ${pct(top.weight, language, 2)}`,
      text: concentrated
        ? L('Satu saham menentukan sebagian besar hasil portofolio. Pertimbangkan batas per saham.', 'One stock drives most of the result. Consider a per-stock cap.')
        : L(`Posisi terbesar; sebaran ${rows.length} saham cukup seimbang.`, `Largest position; ${rows.length} stocks are reasonably balanced.`),
    });
    const movers = rows.filter((r) => r.todayPct !== null);
    if (movers.length > 0) {
      const best = movers.reduce((a, b) => ((b.todayPct ?? 0) > (a.todayPct ?? 0) ? b : a));
      const worst = movers.reduce((a, b) => ((b.todayPct ?? 0) < (a.todayPct ?? 0) ? b : a));
      if ((best.todayPct ?? 0) > 0) {
        insights.push({
          key: 'best',
          icon: ArrowUpRight,
          tone: 'emerald',
          title: L('Penopang hari ini', "Today's top contributor"),
          value: `${best.h.ticker} ${signedPct(best.todayPct ?? 0)}`,
          text: L(`Menambah ${signed(best.today ?? 0).replace('+', '')} ke nilai portofolio hari ini.`, `Added ${signed(best.today ?? 0).replace('+', '')} to the portfolio today.`),
        });
      }
      if ((worst.todayPct ?? 0) < 0) {
        insights.push({
          key: 'worst',
          icon: ArrowDownRight,
          tone: 'rose',
          title: L('Penekan hari ini', "Today's biggest drag"),
          value: `${worst.h.ticker} ${signedPct(worst.todayPct ?? 0)}`,
          text: L(`Mengurangi ${signed(worst.today ?? 0).replace('−', '')} dari nilai portofolio hari ini.`, `Took ${signed(worst.today ?? 0).replace('−', '')} off the portfolio today.`),
        });
      }
    }
    const deepLoss = rows.filter((r) => r.plPct !== null && r.plPct <= -15).sort((a, b) => (a.plPct ?? 0) - (b.plPct ?? 0))[0];
    if (deepLoss) {
      insights.push({
        key: 'loss',
        icon: AlertTriangle,
        tone: 'amber',
        title: L('Rugi terdalam', 'Deepest loss'),
        value: `${deepLoss.h.ticker} ${signedPct(deepLoss.plPct ?? 0)}`,
        text: L('Dari harga rata-rata. Simulasikan dulu sebelum menambah posisi.', 'From your average price. Simulate before adding to the position.'),
        action: { label: L('Simulasikan Avg Down', 'Simulate Avg Down'), onClick: () => onAvgDownClick(deepLoss.h.ticker, deepLoss.h.lot, deepLoss.h.avg_price) },
      });
    }
    if (cash !== null && cash >= 0) {
      const cashShare = (cash / (totalValue + cash)) * 100;
      insights.push({
        key: 'cash',
        icon: Wallet,
        tone: cash === 0 || cashShare < 5 ? 'amber' : 'sky',
        title: L('Kas RDN', 'RDN cash'),
        value: L(`${pct(cashShare, language, 2)} dari aset`, `${pct(cashShare, language, 2)} of assets`),
        text:
          cash === 0
            ? L('Rp 0,00: belum ada dana cadangan untuk average down atau peluang baru.', 'Rp 0.00: no reserve left for averaging down or new opportunities.')
            : cashShare < 5
              ? L(`${rp(cash, language)}: dana cadangan tipis untuk average down atau peluang baru.`, `${rp(cash, language)}: thin reserve for averaging down or new opportunities.`)
              : L(`${rp(cash, language)} sebagai cadangan untuk peluang berikutnya.`, `${rp(cash, language)} kept as a reserve for the next opportunity.`),
      });
    }
  }
  // Dividen per baris: nominal 12 bulan + dividen terakhir, "gagal dimuat" (dicoba ulang), atau belum pernah.
  const dividendCell = (r: Row, align: 'right' | 'left' = 'right') => {
    const lastLine = r.div?.lastExDate
      ? L(
          `${r.div.lastAmount !== null ? `Rp${formatNumberLocale(r.div.lastAmount, language, r.div.lastAmount % 1 ? 2 : 0)}/lbr · ` : ''}ex ${formatDate(r.div.lastExDate, language)}`,
          `${r.div.lastAmount !== null ? `Rp${formatNumberLocale(r.div.lastAmount, language, r.div.lastAmount % 1 ? 2 : 0)}/sh · ` : ''}ex ${formatDate(r.div.lastExDate, language)}`
        )
      : null;
    if (r.divFailed) {
      return (
        <span className={`inline-flex flex-col ${align === 'right' ? 'items-end' : 'items-start'}`}>
          <span className="text-[10px] font-bold text-amber-400">{L('gagal dimuat', 'failed to load')}</span>
          <button type="button" onClick={() => void loadDividends(divFailed)} className="text-[10px] font-bold text-slate-400 hover:text-white underline cursor-pointer">
            {L('coba lagi', 'retry')}
          </button>
        </span>
      );
    }
    if (!r.div) return <span className="text-slate-600">{divLoaded ? '—' : '…'}</span>;
    if (r.dividendYear !== null && r.dividendYear > 0) {
      return (
        <span className="block">
          <span className="block text-amber-300">{rp(r.dividendYear, language)}</span>
          {lastLine && <span className="block text-[10px] font-sans font-semibold text-slate-500">{lastLine}</span>}
        </span>
      );
    }
    return (
      <span className="block" title={L('Tidak ada dividen dalam 12 bulan terakhir', 'No dividends in the last 12 months')}>
        <span className="block text-slate-600">—</span>
        <span className="block text-[10px] font-sans font-semibold text-slate-500">
          {r.div.lastExDate ? L(`terakhir ${formatDate(r.div.lastExDate, language)}`, `last ${formatDate(r.div.lastExDate, language)}`) : L('belum pernah', 'never paid')}
        </span>
      </span>
    );
  };

  // Kolom tabel yang sedang dipakai untuk mengurutkan diberi warna & panah.
  const sortedCol = (k: SortKey) => (sortKey === k ? 'text-emerald-400' : '');
  const sortMark = (k: SortKey) => (sortKey === k ? (k === 'ticker' ? ' A–Z' : ' ↓') : '');
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
          valueClassName="text-[13.5px] min-[400px]:text-[15px] sm:text-lg"
          tone="emerald"
          className="col-span-2 lg:col-span-1"
          label={L('Nilai portofolio', 'Portfolio value')}
          value={<AnimatedNumber value={totalValue + (cash ?? 0)} format={(v) => rp(v, language)} fromZero />}
          sub={cash !== null ? L(`saham ${rp(totalValue, language)} + kas ${rp(cash, language)}`, `stocks ${rp(totalValue, language)} + cash ${rp(cash, language)}`) : L('nilai pasar saham', 'stock market value')}
        />
        <Stat valueClassName="text-[13.5px] min-[400px]:text-[15px] sm:text-lg" label={L('Modal', 'Cost basis')} value={rp(totalCost, language)} sub={L(`${rows.length} saham`, `${rows.length} stocks`)} />
        <Stat
          valueClassName="text-[13.5px] min-[400px]:text-[15px] sm:text-lg"
          tone={floatingPl > 0 ? 'emerald' : floatingPl < 0 ? 'rose' : 'slate'}
          label={L('Floating P/L', 'Floating P/L')}
          value={<span className={tone(floatingPl)}>{signed(floatingPl)}</span>}
          sub={pricedCost > 0 ? signedPct((floatingPl / pricedCost) * 100) : '—'}
        />
        <Stat
          valueClassName="text-[13.5px] min-[400px]:text-[15px] sm:text-lg"
          tone={todayPl > 0 ? 'emerald' : todayPl < 0 ? 'rose' : 'slate'}
          label={L('Hari ini', 'Today')}
          value={<span className={tone(todayPl)}>{todayRows.length > 0 ? signed(todayPl) : '—'}</span>}
          sub={todayBase > 0 ? signedPct((todayPl / todayBase) * 100) : L('menunggu harga', 'awaiting prices')}
        />
        <Stat
          valueClassName="text-[13.5px] min-[400px]:text-[15px] sm:text-lg"
          tone="amber"
          label={L('Dividen 12 bln', 'Dividends (12m)')}
          value={rp(dividendYear, language)}
          sub={
            divFailed.length > 0
              ? L(`${divFailed.length} saham gagal dimuat · dicoba lagi`, `${divFailed.length} stocks failed · retrying`)
              : totalCost > 0
                ? L(`kotor · yield on cost ${pct((dividendYear / totalCost) * 100, language)}`, `gross · yield on cost ${pct((dividendYear / totalCost) * 100, language)}`)
                : L('kotor', 'gross')
          }
        />
      </div>

      {/* Pilih tampilan: kepemilikan atau jurnal target bulanan */}
      <Segmented
        ariaLabel={L('Tampilan portofolio', 'Portfolio view')}
        value={view}
        onChange={setView}
        className="w-full sm:w-96"
        options={[
          { value: 'holdings', label: L('Kepemilikan', 'Holdings') },
          { value: 'journal', label: L('Target & Performa', 'Target & Performance') },
        ]}
      />

      {view === 'journal' && user && (
        <PerformanceJournal
          language={language}
          user={user}
          journal={journal}
          ready={journalReady}
          hasPortfolio={holdings.length > 0 || (cash ?? 0) > 0}
          onConfirmReset={() => setConfirmResetJournal(true)}
        />
      )}

      {view === 'holdings' && (
      <>
      {/* Wawasan portofolio (dihitung dari posisi & harga live) */}
      {insights.length > 0 && (
        <Card className="py-4 sm:py-5">
          <div className="flex items-center justify-between gap-3 mb-3.5">
            <h2 className="text-[10px] font-bold uppercase tracking-wider text-sky-300 flex items-center gap-2">
              <Lightbulb className="h-4 w-4" /> {L('Wawasan portofolio', 'Portfolio insights')}
            </h2>
            <span className="hidden sm:inline text-[10px] font-semibold text-slate-500">{L(`${insights.length} wawasan · dari posisi & harga terkini`, `${insights.length} insights · from positions & latest prices`)}</span>
          </div>
          <Stagger
            className={`grid grid-cols-1 gap-3 ${
              {
                1: '',
                2: 'sm:grid-cols-2',
                3: 'sm:grid-cols-2 lg:grid-cols-3',
                4: 'sm:grid-cols-2 lg:grid-cols-4',
              }[insights.length] ?? 'sm:grid-cols-2 lg:grid-cols-3'
            }`}
          >
            {insights.map((it) => {
              const toneCls = {
                emerald: { box: 'border-emerald-500/20 bg-emerald-500/[0.04]', chip: 'bg-emerald-500/15 text-emerald-400', value: 'text-emerald-300' },
                amber: { box: 'border-amber-500/20 bg-amber-500/[0.04]', chip: 'bg-amber-500/15 text-amber-400', value: 'text-amber-200' },
                rose: { box: 'border-rose-500/20 bg-rose-500/[0.04]', chip: 'bg-rose-500/15 text-rose-400', value: 'text-rose-300' },
                sky: { box: 'border-sky-500/20 bg-sky-500/[0.04]', chip: 'bg-sky-500/15 text-sky-400', value: 'text-white' },
              }[it.tone];
              return (
                <StaggerItem key={it.key} className={`h-full p-3.5 rounded-2xl border flex gap-3 ${toneCls.box}`}>
                  <span className={`h-8 w-8 shrink-0 rounded-xl flex items-center justify-center ${toneCls.chip}`}>
                    <it.icon className="h-4 w-4" />
                  </span>
                  <div className="min-w-0 flex-1 flex flex-col">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{it.title}</span>
                    <span className={`text-sm font-black tabular-nums mt-0.5 ${toneCls.value}`}>{it.value}</span>
                    <p className="text-[11px] text-slate-400 leading-snug mt-1">{it.text}</p>
                    {it.action && (
                      <button
                        type="button"
                        onClick={it.action.onClick}
                        className="self-start mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-white/10 bg-white/5 hover:bg-white/10 text-[11px] font-bold text-slate-200 cursor-pointer"
                      >
                        <Calculator className="h-3 w-3" /> {it.action.label}
                      </button>
                    )}
                  </div>
                </StaggerItem>
              );
            })}
          </Stagger>
        </Card>
      )}

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
            <div className="self-start flex flex-col items-start sm:items-end gap-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1">
                <ArrowUpDown className="h-3 w-3" /> {L('Urutkan berdasarkan', 'Sort by')}
              </span>
              <Segmented
                ariaLabel={L('Urutkan daftar saham', 'Sort holdings')}
                value={sortKey}
                onChange={setSortKey}
                options={[
                  { value: 'value', label: L('Nilai ↓', 'Value ↓'), title: L('Nilai pasar terbesar di atas', 'Largest market value first') },
                  { value: 'pl', label: 'P/L % ↓', title: L('Persentase untung terbesar di atas, rugi terdalam di bawah', 'Highest P/L % first, deepest loss last') },
                  { value: 'today', label: L('Hari ini ↓', 'Today ↓'), title: L('Kenaikan hari ini terbesar di atas', 'Biggest gain today first') },
                  { value: 'ticker', label: L('Kode A–Z', 'Ticker A–Z'), title: L('Urut abjad kode saham', 'Alphabetical by ticker') },
                ]}
              />
            </div>
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
                  <div key={r.h.id} className="contents" title={`${r.h.ticker} ${pct(r.weight, language, 2)}`}>
                    <GrowBar pct={r.weight} className={ALLOCATION_COLORS[i]} />
                  </div>
                ))}
                {allocation.rest > 0 && <GrowBar pct={allocation.rest} className="bg-slate-500" />}
              </div>
              <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[10px] font-bold text-slate-400">
                {allocation.shown.map((r, i) => (
                  <span key={r.h.id} className="flex items-center gap-1.5">
                    <span className={`h-2 w-2 rounded-full ${ALLOCATION_COLORS[i]}`} />
                    {r.h.ticker} {pct(r.weight, language, 2)}
                  </span>
                ))}
                {allocation.rest > 0 && (
                  <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-slate-500" />{L('Lainnya', 'Others')} {pct(allocation.rest, language, 2)}</span>
                )}
              </div>
            </div>

            {/* Desktop */}
            <div className="hidden lg:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className={`py-2.5 px-3 ${sortedCol('ticker')}`} aria-sort={sortKey === 'ticker' ? 'ascending' : undefined}>{L('Saham', 'Stock')}{sortMark('ticker')}</th>
                    <th className="py-2.5 px-3 text-right">Lot</th>
                    <th className="py-2.5 px-3 text-right">{L('Avg', 'Avg')}</th>
                    <th className={`py-2.5 px-3 text-right ${sortedCol('today')}`} aria-sort={sortKey === 'today' ? 'descending' : undefined}>{L('Harga', 'Price')}{sortMark('today')}</th>
                    <th className={`py-2.5 px-3 text-right ${sortedCol('value')}`} aria-sort={sortKey === 'value' ? 'descending' : undefined}>{L('Nilai pasar', 'Market value')}{sortMark('value')}</th>
                    <th className={`py-2.5 px-3 text-right ${sortedCol('pl')}`} aria-sort={sortKey === 'pl' ? 'descending' : undefined}>{L('Floating P/L', 'Floating P/L')}{sortMark('pl')}</th>
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
                        <span className="block text-[10px] text-slate-500">{pct(r.weight, language, 2)}</span>
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
                      <td className="py-3 px-3 text-right font-mono">{dividendCell(r)}</td>
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
                        <span className="block font-black text-white">{r.h.ticker} <span className="text-[10px] font-bold text-slate-500">{pct(r.weight, language, 2)}</span></span>
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
                    <div><dt className="text-[9px] uppercase font-bold text-slate-500">{L('Nilai', 'Value')}</dt><dd className="font-bold text-white">{rp(r.value, language)}</dd></div>
                  </dl>
                  <div className="flex items-start justify-between gap-3 mt-2.5 pt-2.5 border-t border-white/5 text-[11px]">
                    <span className="text-[9px] uppercase font-bold text-slate-500 pt-0.5">{L('Dividen 12 bln', 'Dividends 12m')}</span>
                    <span className="text-right font-bold">{dividendCell(r)}</span>
                  </div>
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
      </>
      )}

      <HoldingModal language={language} mode={modal} holdings={holdings} onClose={() => setModal(null)} onSubmit={submitHolding} />

      <ConfirmModal
        isOpen={confirmResetJournal}
        onClose={() => setConfirmResetJournal(false)}
        onConfirm={() => {
          setConfirmResetJournal(false);
          journal
            .reset()
            .then(() => showToast(L('Jurnal dimulai ulang; nilai portofolio sekarang menjadi modal awal baru.', 'Journal restarted; the current portfolio value becomes the new starting value.')))
            .catch((err: unknown) => showToast(err instanceof Error ? err.message : String(err), 'error'));
        }}
        title={L('Mulai ulang jurnal?', 'Restart journal?')}
        message={L('Semua catatan bulanan (modal awal, total akhir, setoran) akan dihapus. Jurnal baru dimulai dari nilai portofolio saat ini.', 'All monthly records (start, end, deposits) will be deleted. A new journal starts from the current portfolio value.')}
        confirmText={L('Ya, mulai ulang', 'Yes, restart')}
        cancelText={L('Batal', 'Cancel')}
        type="danger"
      />

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
