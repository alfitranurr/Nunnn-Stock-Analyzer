'use client';

import * as React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { motion } from 'framer-motion';
import { AnimatedNumber, EASE_OUT } from '@/components/shared/motion';
import {
  AlertTriangle,
  CalendarDays,
  HandCoins,
  Info,
  Landmark,
  RefreshCw,
  RotateCcw,
  SlidersHorizontal,
  Wallet,
} from 'lucide-react';
import { QuickSearchTicker } from '@/components/quick-search-ticker';
import { CompanyLogo } from '@/components/company-logo';
import { StepperInput } from '@/components/stepper-input';
import { useIdxSessionState } from '@/components/home/home-dashboard';
import { useLanguage } from '@/lib/language-context';
import { usePolling } from '@/lib/use-polling';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';
import { fetchQuotes } from '@/lib/quotes';
import { formatIDRCompact, formatNumberLocale, parseFormattedNumber } from '@/lib/format';
import { formatWibTime } from '@/lib/market-hours';
import { isValidIdxPrice, stepIdxPrice } from '@/lib/calculator';
import { IDX_TICKERS } from '@/lib/tickers';
import {
  DEFAULT_BUY_FEE_PCT,
  TAX_PRESET_RATES,
  analyzeDividends,
  buildPaymentSchedule,
  daysBetween,
  dpsForBasis,
  simulateDividend,
  type DividendEvent,
  type DpsBasis,
  type TaxPresetId,
} from '@/lib/dividend';
import { DividendHistory } from './dividend-history';
import { DripProjection } from './drip-projection';
import { ExDateSimulator } from './ex-date-simulator';
import {
  Badge,
  Card,
  CardTitle,
  Field,
  Segmented,
  Stat,
  clamp,
  fmtInput,
  formatDate,
  formatMonth,
  pct,
  pick,
  rp,
  rpShare,
  sanitizeInteger,
  sanitizeNumber,
  stepDecimal,
  stepMoney,
} from '@/components/shared/calc-ui';

interface DividendTabProps {
  isActive: boolean;
}

interface DividendApiData {
  ticker: string;
  companyName: string;
  events: DividendEvent[];
  yearlyAvgClose: Record<number, number>;
  source: { label: string; delayed: boolean };
  fetchedAt: string;
}

type DividendState =
  | { ticker: string; status: 'loading' }
  | { ticker: string; status: 'ready'; data: DividendApiData }
  | { ticker: string; status: 'not-found' }
  | { ticker: string; status: 'error'; kind: 'rate_limited' | 'failed' };

interface LiveQuote {
  ticker: string;
  price: number;
  change: number;
  changePercent: number;
  suspect: boolean;
  at: number;
}

/** Emiten pembagi dividen rutin; yield-nya dihitung live (TTM / harga sekarang), bukan angka tetap. */
const POPULAR_DIVIDEND_TICKERS = ['BBCA', 'BBRI', 'BMRI', 'BBNI', 'TLKM', 'ASII', 'UNVR', 'ITMG', 'PTBA', 'ADRO', 'PGAS', 'ANTM', 'SIDO', 'HMSP', 'INDF', 'BJTM'];

const DEFAULT_TICKER = 'BBCA';
const WIB_OFFSET_MS = 7 * 3600_000;

export function DividendTab({ isActive }: DividendTabProps) {
  const { language, t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const fieldId = React.useId();

  // ─── Saham terpilih & data ───
  const [ticker, setTicker] = React.useState(DEFAULT_TICKER);
  const tickerRef = React.useRef(ticker);
  const [div, setDiv] = React.useState<DividendState>({ ticker: DEFAULT_TICKER, status: 'loading' });
  const [quote, setQuote] = React.useState<LiveQuote | null>(null);
  const [quoteFailed, setQuoteFailed] = React.useState(false);
  const [quoteLoading, setQuoteLoading] = React.useState(false);
  const [popularYields, setPopularYields] = React.useState<Record<string, number> | null>(null);
  const divAbortRef = React.useRef<AbortController | null>(null);

  // ─── Input simulasi ───
  const [inputMode, setInputMode] = React.useState<'amount' | 'lot'>('amount');
  const [capitalStr, setCapitalStr] = React.useState(() => fmtInput(100_000_000, language, 0));
  const [lotsStr, setLotsStr] = React.useState('100');
  const [buyPriceStr, setBuyPriceStr] = React.useState('');
  const buyTouchedRef = React.useRef(false);
  const [buyTouched, setBuyTouched] = React.useState(false);
  const [basis, setBasis] = React.useState<DpsBasis>('ttm');
  const [manualDpsStr, setManualDpsStr] = React.useState('');
  const [taxPreset, setTaxPreset] = React.useState<TaxPresetId>('final10');
  const [customTaxStr, setCustomTaxStr] = React.useState('10');
  const [buyFeeStr, setBuyFeeStr] = React.useState(() => fmtInput(DEFAULT_BUY_FEE_PCT, language));

  // Ganti bahasa → format ulang isi input (titik/koma ribuan) tanpa mengubah nilainya.
  const [inputLanguage, setInputLanguage] = React.useState(language);
  if (inputLanguage !== language) {
    setInputLanguage(language);
    const reformat = (s: string, digits = 2) => (s ? fmtInput(parseFormattedNumber(s), language, digits) : s);
    setCapitalStr(reformat(capitalStr, 0));
    setBuyPriceStr(reformat(buyPriceStr, 0));
    setManualDpsStr(reformat(manualDpsStr));
    setCustomTaxStr(reformat(customTaxStr));
    setBuyFeeStr(reformat(buyFeeStr));
  }

  const { now, trading } = useIdxSessionState(isActive);
  const todayIso = now !== null ? new Date(now + WIB_OFFSET_MS).toISOString().slice(0, 10) : null;

  // ─── Pemuatan data ───
  const loadDividends = async () => {
    const symbol = ticker;
    divAbortRef.current?.abort();
    const ctrl = new AbortController();
    divAbortRef.current = ctrl;
    // Saat memuat ulang saham yang sama, data lama tetap ditampilkan.
    setDiv((prev) => (prev.ticker === symbol && prev.status === 'ready' ? prev : { ticker: symbol, status: 'loading' }));
    const failKeepingData = (kind: 'rate_limited' | 'failed') =>
      setDiv((prev) => (prev.ticker === symbol && prev.status === 'ready' ? prev : { ticker: symbol, status: 'error', kind }));
    try {
      const res = await fetch(`/api/dividend?symbol=${encodeURIComponent(symbol)}`, { signal: ctrl.signal });
      if (ctrl.signal.aborted) return;
      if (res.status === 404) {
        setDiv({ ticker: symbol, status: 'not-found' });
        return;
      }
      if (!res.ok) {
        failKeepingData(res.status === 429 ? 'rate_limited' : 'failed');
        return;
      }
      const data: DividendApiData = await res.json();
      if (!ctrl.signal.aborted) setDiv({ ticker: symbol, status: 'ready', data });
    } catch {
      if (!ctrl.signal.aborted) failKeepingData('failed');
    }
  };

  const loadQuote = async () => {
    const symbol = ticker;
    setQuoteLoading(true);
    try {
      const map = await fetchQuotes([symbol]);
      if (tickerRef.current !== symbol) return;
      const q = map[symbol];
      if (!q) {
        setQuoteFailed(true);
        return;
      }
      setQuote({ ticker: symbol, price: q.price, change: q.change, changePercent: q.changePercent, suspect: q.suspect, at: Date.now() });
      setQuoteFailed(false);
      if (!buyTouchedRef.current) setBuyPriceStr(fmtInput(q.price, language, 0));
    } catch {
      if (tickerRef.current === symbol) setQuoteFailed(true);
    } finally {
      if (tickerRef.current === symbol) setQuoteLoading(false);
    }
  };

  const loadPopular = async () => {
    try {
      const [summaryRes, quotes] = await Promise.all([
        fetch(`/api/dividend/summary?symbols=${POPULAR_DIVIDEND_TICKERS.join(',')}`),
        fetchQuotes(POPULAR_DIVIDEND_TICKERS),
      ]);
      if (!summaryRes.ok) return;
      const { items } = (await summaryRes.json()) as { items: Array<{ symbol: string; ttmDps: number }> };
      const yields: Record<string, number> = {};
      for (const item of items) {
        const price = quotes[item.symbol]?.price;
        if (price && price > 0) yields[item.symbol] = (item.ttmDps / price) * 100;
      }
      setPopularYields(yields);
    } catch {
      // Chip tetap bisa dipakai tanpa angka yield.
    }
  };

  // Admin menekan "Refresh semua data" → ambil ulang segera.
  const refreshEpoch = useDataRefreshEpoch();
  usePolling(loadDividends, { enabled: isActive, intervalMs: null, minGapMs: 30 * 60_000, key: `${ticker}|${refreshEpoch}` });
  usePolling(loadQuote, { enabled: isActive, intervalMs: trading ? 60_000 : null, minGapMs: 60_000, key: `${ticker}|${refreshEpoch}` });
  usePolling(loadPopular, { enabled: isActive, intervalMs: null, minGapMs: 6 * 3600_000, key: refreshEpoch });

  React.useEffect(() => () => divAbortRef.current?.abort(), []);

  const selectTicker = (raw: string) => {
    const symbol = raw.toUpperCase().replace(/\.JK$/, '').trim();
    if (!/^[A-Z]{1,5}$/.test(symbol) || symbol === ticker) return;
    tickerRef.current = symbol;
    setTicker(symbol);
    setQuote(null);
    setQuoteFailed(false);
    setBuyPriceStr('');
    buyTouchedRef.current = false;
    setBuyTouched(false);
    if (basis === 'manual') setBasis('ttm');
  };

  // ─── Turunan ───
  const ready = div.status === 'ready' && div.ticker === ticker ? div.data : null;
  const profile = React.useMemo(
    () => (ready && todayIso ? analyzeDividends(ready.events, todayIso, ready.yearlyAvgClose) : null),
    [ready, todayIso]
  );
  const companyName = ready?.companyName || IDX_TICKERS[ticker] || '';
  const livePrice = quote && quote.ticker === ticker ? quote : null;
  const marketPrice = livePrice?.price ?? null;

  const buyPrice = parseFormattedNumber(buyPriceStr) || marketPrice || 0;
  const buyPriceOffTick = buyPrice > 0 && !isValidIdxPrice(buyPrice);
  const basisDps = profile && basis !== 'manual' ? dpsForBasis(profile, basis) : 0;
  const annualDps = basis === 'manual' ? Math.max(0, parseFormattedNumber(manualDpsStr)) : basisDps;
  const taxRate = taxPreset === 'custom' ? clamp(parseFormattedNumber(customTaxStr), 0, 100) : TAX_PRESET_RATES[taxPreset];
  const buyFee = clamp(parseFormattedNumber(buyFeeStr), 0, 5);

  const sim = simulateDividend({
    buyPrice,
    inputMode,
    capitalRp: parseFormattedNumber(capitalStr),
    lots: parseInt(lotsStr, 10) || 0,
    buyFeePct: buyFee,
    annualDps,
    taxRatePct: taxRate,
  });
  const schedule = React.useMemo(
    () => (profile ? buildPaymentSchedule(profile, annualDps, sim.shares, taxRate) : []),
    [profile, annualDps, sim.shares, taxRate]
  );
  const nextPayment = schedule[0] ?? null;
  const currentYield = marketPrice && marketPrice > 0 ? (annualDps / marketPrice) * 100 : null;
  const scheduleNet = schedule.reduce((s, p) => s + p.netRp, 0);

  // Kalender 12 bulan mulai bulan ini.
  const calendar = React.useMemo(() => {
    if (!todayIso) return [];
    const startY = Number(todayIso.slice(0, 4));
    const startM = Number(todayIso.slice(5, 7)) - 1;
    return Array.from({ length: 12 }, (_, i) => {
      const y = startY + Math.floor((startM + i) / 12);
      const m = (startM + i) % 12;
      const key = `${y}-${String(m + 1).padStart(2, '0')}`;
      const payments = schedule.filter((p) => p.payDate.startsWith(key));
      return { key, net: payments.reduce((s, p) => s + p.netRp, 0), count: payments.length, estimated: payments.some((p) => !p.confirmed) };
    });
  }, [schedule, todayIso]);
  const maxMonthNet = Math.max(...calendar.map((c) => c.net), 0);

  // ─── Handler input ───
  const switchMode = (mode: 'amount' | 'lot') => {
    if (mode === inputMode) return;
    // Bawa nilai yang setara agar hasil tidak berubah saat berpindah mode.
    if (mode === 'lot') setLotsStr(String(sim.lots));
    else if (sim.totalCostRp > 0) setCapitalStr(fmtInput(Math.ceil(sim.totalCostRp), language, 0));
    setInputMode(mode);
  };

  const setBuyPrice = (value: string) => {
    buyTouchedRef.current = true;
    setBuyTouched(true);
    setBuyPriceStr(value);
  };

  const resetBuyPrice = () => {
    buyTouchedRef.current = false;
    setBuyTouched(false);
    setBuyPriceStr(marketPrice ? fmtInput(marketPrice, language, 0) : '');
  };

  const setManualDps = (value: string) => {
    setBasis('manual');
    setManualDpsStr(value);
  };

  const dpsStep = (v: number) => (v < 100 ? 1 : v < 1000 ? 5 : 25);
  const dpsDisplay = basis === 'manual' ? manualDpsStr : annualDps > 0 ? fmtInput(annualDps, language) : '0';

  const basisHint = (() => {
    if (!profile) return null;
    switch (basis) {
      case 'ttm':
        return L(`Total ${profile.ttmPayments}× pembagian dalam 12 bulan terakhir`, `Sum of ${profile.ttmPayments} payout(s) in the last 12 months`);
      case 'last-year':
        return L(`Total pembagian tahun ${profile.lastFullYear}`, `Total payouts in ${profile.lastFullYear}`);
      case 'avg-3y':
        return profile.lastFullYear !== null
          ? L(`Rata-rata ${profile.lastFullYear - 2}–${profile.lastFullYear}, cocok untuk dividen yang naik-turun`, `Average of ${profile.lastFullYear - 2}–${profile.lastFullYear}, suits volatile payouts`)
          : null;
      default:
        return L('Diisi manual', 'Entered manually');
    }
  })();

  const quoteTone = !livePrice ? 'text-slate-400' : livePrice.change > 0 ? 'text-emerald-400' : livePrice.change < 0 ? 'text-rose-400' : 'text-slate-400';
  const sortedPopular = popularYields
    ? [...POPULAR_DIVIDEND_TICKERS].sort((a, b) => (popularYields[b] ?? -1) - (popularYields[a] ?? -1))
    : POPULAR_DIVIDEND_TICKERS;

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <PageHeader
        icon={HandCoins}
        eyebrow={L('Dividen & passive income', 'Dividends & passive income')}
        title={L('Kalkulator Dividen Saham', 'Stock Dividend Calculator')}
        description={L(
          'Riwayat dividen asli dari bursa, jadwal cum date & pembayaran berikutnya, simulasi pajak, DRIP, dan cek dividend trap untuk saham BEI.',
          'Actual dividend history, upcoming cum & payment dates, tax simulation, DRIP and a dividend-trap check for IDX stocks.'
        )}
      />

      {/* 1. Pilih saham */}
      <Card className="space-y-4">
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-4 items-stretch">
          <div className="lg:col-span-2 flex flex-col gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{L('1. Pilih saham', '1. Choose a stock')}</span>
            <QuickSearchTicker language={language} onSelectTicker={selectTicker} />
          </div>
          <div className="lg:col-span-3 flex items-center gap-3 p-3 rounded-2xl bg-input-bg border border-border-color min-w-0">
            <CompanyLogo symbol={ticker} size={44} />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-black text-lg text-white tracking-wide">{ticker}</span>
                {livePrice?.suspect && <Badge tone="amber">{L('Data meragukan', 'Suspect data')}</Badge>}
              </div>
              <p className="text-[11px] text-slate-400 truncate">{companyName || '—'}</p>
            </div>
            <div className="text-right shrink-0">
              <div className="text-lg font-black text-white tabular-nums">{marketPrice ? rp(marketPrice, language) : quoteFailed ? '—' : '…'}</div>
              <div className={`text-[11px] font-bold tabular-nums ${quoteTone}`}>
                {livePrice
                  ? `${livePrice.change > 0 ? '+' : ''}${formatNumberLocale(livePrice.change, language)} (${livePrice.changePercent > 0 ? '+' : ''}${pct(livePrice.changePercent, language)})`
                  : quoteFailed ? L('Harga gagal dimuat', 'Price unavailable') : ''}
              </div>
              <div className="text-[9px] text-slate-500">
                {livePrice ? `${L('Update', 'Updated')} ${formatWibTime(livePrice.at)} WIB · ${L('tertunda', 'delayed')}` : ''}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                void loadQuote();
                if (div.status !== 'ready') void loadDividends();
              }}
              disabled={quoteLoading}
              className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer disabled:opacity-50 shrink-0"
              aria-label={L('Muat ulang harga', 'Refresh price')}
              title={L('Muat ulang harga', 'Refresh price')}
            >
              <RefreshCw className={`h-4 w-4 ${quoteLoading ? 'animate-spin text-emerald-400' : ''}`} />
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-white/10">
          <span className="text-[10px] font-bold text-slate-500 uppercase tracking-wider block mb-2">
            {L('Saham dividen populer · yield 12 bln di harga sekarang', 'Popular dividend stocks · 12-month yield at current price')}
          </span>
          <div className="flex flex-wrap gap-1.5">
            {sortedPopular.map((s) => {
              const y = popularYields?.[s];
              const active = s === ticker;
              return (
                <button
                  key={s}
                  type="button"
                  onClick={() => selectTicker(s)}
                  aria-pressed={active}
                  className={`px-2.5 py-1 rounded-xl text-[11px] font-bold border transition-all cursor-pointer flex items-center gap-1.5 ${
                    active ? 'bg-emerald-500 text-white border-emerald-400 shadow-md' : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span>{s}</span>
                  {y !== undefined && <span className={active ? 'text-white/80' : 'text-emerald-400'}>{pct(y, language, 1)}</span>}
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {/* Status data dividen */}
      {div.ticker === ticker && div.status === 'loading' && (
        <Card>
          <div className="animate-pulse space-y-3" aria-busy="true">
            <div className="h-4 w-48 bg-white/10 rounded" />
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
              {Array.from({ length: 5 }, (_, i) => <div key={i} className="h-20 bg-white/5 rounded-2xl" />)}
            </div>
            <div className="h-40 bg-white/5 rounded-2xl" />
          </div>
        </Card>
      )}
      {div.ticker === ticker && (div.status === 'error' || div.status === 'not-found') && (
        <Card className="border-amber-500/30">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-400 shrink-0" />
            <p className="text-sm text-slate-300 flex-1">
              {div.status === 'not-found'
                ? L(`Kode ${ticker} tidak ditemukan di sumber data.`, `Ticker ${ticker} was not found in the data source.`)
                : div.kind === 'rate_limited'
                  ? L('Terlalu banyak permintaan. Tunggu sebentar lalu coba lagi.', 'Too many requests. Please wait a moment and retry.')
                  : L(`Riwayat dividen ${ticker} gagal dimuat. Simulasi di bawah tetap bisa dipakai dengan dividen manual.`, `Failed to load ${ticker} dividend history. You can still simulate with a manual dividend below.`)}
            </p>
            {div.status === 'error' && (
              <button type="button" onClick={() => void loadDividends()} className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer">
                <RefreshCw className="h-3.5 w-3.5" /> {L('Coba lagi', 'Retry')}
              </button>
            )}
          </div>
        </Card>
      )}
      {profile && profile.events.length === 0 && (
        <Card className="border-sky-500/30">
          <div className="flex gap-3">
            <Info className="h-5 w-5 text-sky-400 shrink-0" />
            <p className="text-sm text-slate-300">
              {L(
                `${ticker} belum pernah membagikan dividen tunai menurut data ${ready?.source.label}. Anda tetap bisa mensimulasikan dengan mengisi dividen per lembar secara manual.`,
                `${ticker} has never paid a cash dividend according to ${ready?.source.label}. You can still simulate by entering a dividend per share manually.`
              )}
            </p>
          </div>
        </Card>
      )}
      {profile && profile.events.length > 0 && (
        <DividendHistory language={language} ticker={ticker} profile={profile} marketPrice={marketPrice} />
      )}

      {/* 2. Simulasi */}
      <Card>
        <CardTitle
          icon={<SlidersHorizontal className="h-5 w-5 text-emerald-400" />}
          title={L('2. Simulasi Dividen', '2. Dividend Simulation')}
          subtitle={L('Semua angka bisa diketik atau diatur dengan tombol −/+ (tahan untuk cepat).', 'Type any number or use the −/+ buttons (hold to repeat).')}
        />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-5">
          {/* Modal / lot */}
          <div className="space-y-2">
            <Segmented
              ariaLabel={L('Mode input', 'Input mode')}
              value={inputMode}
              onChange={switchMode}
              options={[
                { value: 'amount', label: L('Nominal (Rp)', 'Amount (Rp)') },
                { value: 'lot', label: L('Jumlah lot', 'Lots') },
              ]}
            />
            {inputMode === 'amount' ? (
              <Field
                label={L('Modal investasi', 'Investment capital')}
                htmlFor={`${fieldId}-capital`}
                hint={sim.lots > 0
                  ? L(`= ${formatNumberLocale(sim.lots, language)} lot · sisa ${rp(sim.leftoverRp, language)}`, `= ${formatNumberLocale(sim.lots, language)} lots · leftover ${rp(sim.leftoverRp, language)}`)
                  : buyPrice > 0 ? L('Belum cukup untuk 1 lot', 'Not enough for 1 lot') : undefined}
              >
                <StepperInput
                  id={`${fieldId}-capital`}
                  type="text"
                  inputMode="numeric"
                  value={capitalStr}
                  onChange={(e) => setCapitalStr(sanitizeNumber(e.target.value))}
                  onBlur={() => setCapitalStr((v) => fmtInput(parseFormattedNumber(v), language, 0))}
                  onStep={(dir) => setCapitalStr((prev) => stepMoney(prev, dir, language))}
                  canDecrement={parseFormattedNumber(capitalStr) > 0}
                  decrementLabel={`${t('calculator.decrease')} ${L('modal', 'capital')}`}
                  incrementLabel={`${t('calculator.increase')} ${L('modal', 'capital')}`}
                  inputClassName="font-extrabold text-white"
                  adornment={<span className="flex items-center pr-1 text-[10px] font-bold text-slate-500">Rp</span>}
                />
              </Field>
            ) : (
              <Field
                label={L('Jumlah lot', 'Number of lots')}
                htmlFor={`${fieldId}-lots`}
                hint={L(`= ${formatNumberLocale(sim.shares, language)} lembar · ${rp(sim.totalCostRp, language)}`, `= ${formatNumberLocale(sim.shares, language)} shares · ${rp(sim.totalCostRp, language)}`)}
              >
                <StepperInput
                  id={`${fieldId}-lots`}
                  type="text"
                  inputMode="numeric"
                  value={lotsStr}
                  onChange={(e) => setLotsStr(sanitizeInteger(e.target.value))}
                  onStep={(dir) => setLotsStr((prev) => String(Math.max(0, (parseInt(prev, 10) || 0) + dir)))}
                  canDecrement={(parseInt(lotsStr, 10) || 0) > 0}
                  decrementLabel={`${t('calculator.decrease')} lot`}
                  incrementLabel={`${t('calculator.increase')} lot`}
                  inputClassName="font-extrabold text-white"
                  adornment={<span className="flex items-center pr-1 text-[10px] font-bold text-slate-500">lot</span>}
                />
              </Field>
            )}
          </div>

          {/* Harga beli */}
          <Field
            label={
              <>
                <span>{L('Harga beli / lembar', 'Buy price / share')}</span>
                {buyTouched && marketPrice && (
                  <button type="button" onClick={resetBuyPrice} className="normal-case tracking-normal text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer">
                    <RotateCcw className="h-3 w-3" /> {L('harga pasar', 'market price')}
                  </button>
                )}
              </>
            }
            htmlFor={`${fieldId}-price`}
            hint={buyPriceOffTick
              ? <span className="text-amber-400">{L('Bukan kelipatan fraksi harga BEI', 'Not a valid IDX tick price')}</span>
              : marketPrice ? L(`Harga pasar ${rp(marketPrice, language)}`, `Market price ${rp(marketPrice, language)}`) : undefined}
          >
            <StepperInput
              id={`${fieldId}-price`}
              type="text"
              inputMode="numeric"
              value={buyPriceStr}
              placeholder={marketPrice ? fmtInput(marketPrice, language, 0) : '0'}
              onChange={(e) => setBuyPrice(sanitizeNumber(e.target.value))}
              onBlur={() => buyPriceStr && setBuyPriceStr((v) => fmtInput(parseFormattedNumber(v), language, 0))}
              onStep={(dir) => setBuyPrice(fmtInput(stepIdxPrice(buyPrice, dir), language, 0))}
              canDecrement={buyPrice > 1}
              invalid={buyPriceOffTick}
              decrementLabel={`${t('calculator.decrease')} ${L('harga', 'price')}`}
              incrementLabel={`${t('calculator.increase')} ${L('harga', 'price')}`}
              inputClassName="font-extrabold text-white"
              adornment={<span className="flex items-center pr-1 text-[10px] font-bold text-slate-500">Rp</span>}
            />
          </Field>

          {/* Dividen per lembar */}
          <div className="space-y-2">
            <Segmented
              ariaLabel={L('Dasar dividen', 'Dividend basis')}
              value={basis}
              onChange={setBasis}
              options={[
                { value: 'ttm', label: 'TTM', disabled: !profile, title: L('12 bulan terakhir', 'Trailing 12 months') },
                { value: 'last-year', label: profile?.lastFullYear ? String(profile.lastFullYear) : L('Thn lalu', 'Last yr'), disabled: !profile || profile.lastFullYear === null },
                { value: 'avg-3y', label: L('Rata² 3th', '3y avg'), disabled: !profile || profile.avg3yDps === null },
                { value: 'manual', label: 'Manual' },
              ]}
            />
            <Field
              label={L('Dividen / lembar / tahun', 'Dividend / share / year')}
              htmlFor={`${fieldId}-dps`}
              hint={basis !== 'manual' && profile && annualDps === 0
                ? <span className="text-amber-400">{L('Tidak ada pembagian pada periode ini', 'No payouts in this period')}</span>
                : basisHint}
            >
              <StepperInput
                id={`${fieldId}-dps`}
                type="text"
                inputMode="decimal"
                value={dpsDisplay}
                onChange={(e) => setManualDps(sanitizeNumber(e.target.value))}
                onStep={(dir) => setManualDps(stepDecimal(fmtInput(annualDps, language), dir, dpsStep(dir > 0 ? annualDps : Math.max(0, annualDps - 0.01)), 0, 1_000_000, language))}
                canDecrement={annualDps > 0}
                decrementLabel={`${t('calculator.decrease')} ${L('dividen', 'dividend')}`}
                incrementLabel={`${t('calculator.increase')} ${L('dividen', 'dividend')}`}
                inputClassName="font-extrabold text-emerald-400"
                adornment={<span className="flex items-center pr-1 text-[10px] font-bold text-slate-500">Rp</span>}
              />
            </Field>
          </div>

          {/* Pajak & fee */}
          <div className="space-y-3">
            <Field label={L('Pajak dividen', 'Dividend tax')}>
              <div className="grid grid-cols-2 gap-1.5">
                {([
                  { id: 'final10', rate: '10%', sub: L('Individu, tidak reinvestasi', 'Individual, not reinvested') },
                  { id: 'reinvest', rate: '0%', sub: L('Individu, reinvestasi ≥3 thn', 'Individual, reinvested ≥3 yrs') },
                  { id: 'foreign', rate: '20%', sub: L('Investor asing (atau tarif P3B)', 'Foreign investor (or treaty rate)') },
                  { id: 'custom', rate: L('Atur', 'Custom'), sub: L('Tarif lain', 'Other rate') },
                ] as Array<{ id: TaxPresetId; rate: string; sub: string }>).map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => setTaxPreset(opt.id)}
                    aria-pressed={taxPreset === opt.id}
                    className={`p-2 rounded-xl border text-left transition-all cursor-pointer ${
                      taxPreset === opt.id ? 'bg-emerald-500/15 border-emerald-500/60' : 'bg-white/[0.03] border-white/10 hover:border-white/20'
                    }`}
                  >
                    <span className={`block text-xs font-black ${taxPreset === opt.id ? 'text-emerald-400' : 'text-white'}`}>{opt.rate}</span>
                    <span className="block text-[9px] leading-tight text-slate-400 mt-0.5">{opt.sub}</span>
                  </button>
                ))}
              </div>
            </Field>
            {taxPreset === 'custom' && (
              <StepperInput
                aria-label={L('Tarif pajak', 'Tax rate')}
                type="text"
                inputMode="decimal"
                value={customTaxStr}
                onChange={(e) => setCustomTaxStr(sanitizeNumber(e.target.value))}
                onStep={(dir) => setCustomTaxStr((prev) => stepDecimal(prev, dir, 1, 0, 100, language))}
                canDecrement={taxRate > 0}
                canIncrement={taxRate < 100}
                decrementLabel={`${t('calculator.decrease')} ${L('pajak', 'tax')}`}
                incrementLabel={`${t('calculator.increase')} ${L('pajak', 'tax')}`}
                inputClassName="font-bold text-white"
                adornment={<span className="flex items-center pr-1 text-xs text-slate-500">%</span>}
              />
            )}
            <Field label={L('Fee beli broker', 'Broker buy fee')} htmlFor={`${fieldId}-fee`}>
              <StepperInput
                id={`${fieldId}-fee`}
                type="text"
                inputMode="decimal"
                value={buyFeeStr}
                onChange={(e) => setBuyFeeStr(sanitizeNumber(e.target.value))}
                onStep={(dir) => setBuyFeeStr((prev) => stepDecimal(prev, dir, 0.01, 0, 5, language))}
                canDecrement={buyFee > 0}
                decrementLabel={`${t('calculator.decrease')} fee`}
                incrementLabel={`${t('calculator.increase')} fee`}
                inputClassName="font-bold text-white"
                adornment={<span className="flex items-center pr-1 text-xs text-slate-500">%</span>}
              />
            </Field>
          </div>
        </div>
      </Card>

      {/* 3. Hasil */}
      <Card>
        <CardTitle icon={<Wallet className="h-5 w-5 text-emerald-400" />} title={L('3. Hasil Dividen', '3. Dividend Result')} />

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="p-5 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-card-bg to-[#121619] relative overflow-hidden">
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">{L('Dividen bersih / tahun', 'Net dividend / year')}</span>
            <div className="text-3xl md:text-4xl font-black text-emerald-400 tracking-tight mt-1 tabular-nums break-all">
              <AnimatedNumber value={sim.netAnnualRp} format={(v) => rp(v, language)} fromZero />
            </div>
            <p className="text-xs text-slate-400 mt-1">
              {L(`≈ ${rp(sim.avgMonthlyNetRp, language)} / bulan bila dirata-rata`, `≈ ${rp(sim.avgMonthlyNetRp, language)} / month on average`)}
            </p>
            {sim.netYieldOnCostPct > 0 && (
              <p className="text-[11px] text-emerald-300/80 mt-1">
                {L(
                  `Target Rp1 juta/bulan bersih butuh modal ≈ ${formatIDRCompact(12_000_000 / (sim.netYieldOnCostPct / 100), language, 1)} di yield ini.`,
                  `A Rp1M/month net target needs ≈ ${formatIDRCompact(12_000_000 / (sim.netYieldOnCostPct / 100), language, 1)} of capital at this yield.`
                )}
              </p>
            )}
            <div className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-2 text-[11px]">
              <span className="text-slate-400">{L('Kotor', 'Gross')}</span>
              <span className="text-right font-bold text-white tabular-nums">{rp(sim.grossAnnualRp, language)}</span>
              <span className="text-slate-400">{L(`Pajak ${pct(taxRate, language, 0)}`, `Tax ${pct(taxRate, language, 0)}`)}</span>
              <span className="text-right font-bold text-amber-400 tabular-nums">−{rp(sim.taxAnnualRp, language)}</span>
            </div>
          </div>

          <div className="p-5 rounded-3xl border border-white/10 bg-white/[0.02]">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-sky-400">{L('Pembagian berikutnya', 'Next payout')}</span>
              {nextPayment && <Badge tone={nextPayment.confirmed ? 'sky' : 'amber'}>{nextPayment.confirmed ? L('Terjadwal', 'Scheduled') : L('Perkiraan', 'Estimate')}</Badge>}
            </div>
            {nextPayment && todayIso ? (
              <>
                <div className="text-2xl font-black text-white mt-1 tabular-nums"><AnimatedNumber value={nextPayment.netRp} format={(v) => rp(v, language)} /></div>
                <p className="text-[11px] text-slate-400">{L(`bersih · ${rpShare(nextPayment.dps, language)}/lembar`, `net · ${rpShare(nextPayment.dps, language)}/share`)}</p>
                <dl className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-y-1.5 text-[11px]">
                  <dt className="text-slate-400">{L('Batas beli (cum) ≈', 'Last buy (cum) ≈')}</dt>
                  <dd className="text-right font-bold text-white">
                    {formatDate(nextPayment.cumDate, language)}
                    <span className="block text-[10px] font-semibold text-slate-500">
                      {(() => {
                        const d = daysBetween(todayIso, nextPayment.cumDate);
                        return d > 0 ? L(`${d} hari lagi`, `in ${d} days`) : d === 0 ? L('hari ini', 'today') : L('sudah lewat', 'passed');
                      })()}
                    </span>
                  </dd>
                  <dt className="text-slate-400">{L('Cair ke RDN ≈', 'Paid to RDN ≈')}</dt>
                  <dd className="text-right font-bold text-white">{formatDate(nextPayment.payDate, language)}</dd>
                </dl>
              </>
            ) : (
              <p className="text-xs text-slate-500 mt-3">
                {profile && profile.events.length > 0
                  ? L('Belum bisa diperkirakan: tidak ada pola pembagian dalam 12 bulan terakhir.', 'Cannot estimate: no payout pattern in the last 12 months.')
                  : L('Tidak ada jadwal pembagian.', 'No payout schedule.')}
              </p>
            )}
          </div>

          <div className="p-5 rounded-3xl border border-white/10 bg-white/[0.02]">
            <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">{L('Yield', 'Yield')}</span>
            <div className="text-2xl font-black text-white mt-1 tabular-nums">{pct(sim.netYieldOnCostPct, language)}</div>
            <p className="text-[11px] text-slate-400">{L('bersih terhadap modal terpakai (yield on cost)', 'net on capital used (yield on cost)')}</p>
            <dl className="mt-3 pt-3 border-t border-white/10 grid grid-cols-2 gap-y-1.5 text-[11px]">
              <dt className="text-slate-400">{L('Kotor on cost', 'Gross on cost')}</dt>
              <dd className="text-right font-bold text-white tabular-nums">{pct(sim.grossYieldOnCostPct, language)}</dd>
              <dt className="text-slate-400">{L('Di harga pasar', 'At market price')}</dt>
              <dd className="text-right font-bold text-white tabular-nums">{currentYield !== null ? pct(currentYield, language) : '—'}</dd>
            </dl>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
          <Stat label={L('Kepemilikan', 'Holding')} value={`${formatNumberLocale(sim.lots, language)} lot`} sub={L(`${formatNumberLocale(sim.shares, language)} lembar`, `${formatNumberLocale(sim.shares, language)} shares`)} />
          <Stat label={L('Nilai transaksi', 'Trade value')} value={formatIDRCompact(sim.tradeValueRp, language, 2)} sub={`${L('fee beli', 'buy fee')} ${rp(sim.buyFeeRp, language)}`} />
          <Stat label={L('Modal terpakai', 'Capital used')} value={formatIDRCompact(sim.totalCostRp, language, 2)} sub={L('termasuk fee', 'incl. fee')} />
          <Stat label={L('Sisa modal', 'Leftover cash')} value={inputMode === 'amount' ? formatIDRCompact(sim.leftoverRp, language, 2) : '—'} sub={L('tidak cukup 1 lot lagi', 'not enough for another lot')} />
        </div>

        {/* Kalender 12 bulan */}
        <div className="mt-6">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-3">
            <CalendarDays className="h-4 w-4 text-emerald-400" />
            {L('Kalender dividen 12 bulan ke depan (tanggal cair)', 'Dividend calendar, next 12 months (payment date)')}
          </h3>
          {schedule.length === 0 ? (
            <p className="py-5 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-white/10">
              {L('Jadwal belum bisa diperkirakan karena tidak ada riwayat pembagian yang bisa dijadikan pola.', 'No schedule can be estimated because there is no payout history to use as a pattern.')}
            </p>
          ) : (
            <>
              <div className="grid grid-cols-6 lg:grid-cols-12 gap-1 sm:gap-1.5">
                {calendar.map((c) => (
                  <div
                    key={c.key}
                    className={`p-1.5 sm:p-2 rounded-xl border text-center min-w-0 ${c.count > 0 ? 'bg-emerald-500/10 border-emerald-500/40' : 'bg-white/[0.02] border-white/5'}`}
                    title={c.count > 0 ? `${formatMonth(c.key, language, true)}: ${rp(c.net, language)}` : undefined}
                  >
                    <span className={`block text-[9px] sm:text-[10px] font-bold uppercase whitespace-nowrap ${c.count > 0 ? 'text-emerald-400' : 'text-slate-500'}`}>{formatMonth(c.key, language, true)}</span>
                    <div className="h-6 sm:h-8 flex items-end justify-center mt-1">
                      {c.count > 0 && (
                        <motion.div
                          className="w-3 rounded-t bg-emerald-400"
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(15, (c.net / (maxMonthNet || 1)) * 100)}%` }}
                          transition={{ duration: 0.6, ease: EASE_OUT }}
                        />
                      )}
                    </div>
                    <span className={`block text-[9px] sm:text-[10px] font-bold tabular-nums truncate mt-1 ${c.count > 0 ? 'text-white' : 'text-slate-600'}`}>
                      {c.count > 0 ? formatIDRCompact(c.net, language, 1).replace('Rp ', '') : '–'}
                    </span>
                  </div>
                ))}
              </div>

              {/* Mobile: kartu per pembayaran */}
              <ul className="sm:hidden mt-3 space-y-2">
                {schedule.map((p) => (
                  <li key={p.exDate} className="p-3 rounded-2xl border border-white/10 bg-white/[0.02] text-[11px]">
                    <div className="flex items-center justify-between gap-2">
                      <Badge tone={p.confirmed ? 'sky' : 'amber'}>{p.confirmed ? L('Terjadwal', 'Scheduled') : L('Perkiraan', 'Estimate')}</Badge>
                      <span className="font-black text-emerald-400 tabular-nums">{rp(p.netRp, language)}</span>
                    </div>
                    <dl className="grid grid-cols-3 gap-2 mt-2">
                      <div><dt className="text-[9px] uppercase font-bold text-slate-500">{L('Batas beli', 'Last buy')}</dt><dd className="font-bold text-white">{formatDate(p.cumDate, language)}</dd></div>
                      <div><dt className="text-[9px] uppercase font-bold text-slate-500">Ex date</dt><dd className="text-slate-300">{formatDate(p.exDate, language)}</dd></div>
                      <div><dt className="text-[9px] uppercase font-bold text-slate-500">{L('Cair ≈', 'Paid ≈')}</dt><dd className="text-slate-300">{formatDate(p.payDate, language)}</dd></div>
                    </dl>
                    <p className="text-[10px] text-slate-500 mt-1.5">{L(`${rpShare(p.dps, language)} / lembar`, `${rpShare(p.dps, language)} / share`)}</p>
                  </li>
                ))}
              </ul>

              <div className="hidden sm:block overflow-x-auto custom-scrollbar mt-3">
                <table className="w-full min-w-[640px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3">{L('Batas beli (cum) ≈', 'Last buy (cum) ≈')}</th>
                      <th className="py-2.5 px-3">Ex date</th>
                      <th className="py-2.5 px-3">{L('Cair ≈', 'Paid ≈')}</th>
                      <th className="py-2.5 px-3 text-right">{L('Dividen / lembar', 'Dividend / share')}</th>
                      <th className="py-2.5 px-3 text-right">{L('Bersih diterima', 'Net received')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {schedule.map((p) => (
                      <tr key={p.exDate}>
                        <td className="py-2.5 px-3"><Badge tone={p.confirmed ? 'sky' : 'amber'}>{p.confirmed ? L('Terjadwal', 'Scheduled') : L('Perkiraan', 'Estimate')}</Badge></td>
                        <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">{formatDate(p.cumDate, language)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(p.exDate, language)}</td>
                        <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(p.payDate, language)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{rpShare(p.dps, language)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">{rp(p.netRp, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
                {L(
                  `Total 12 bulan ke depan: ${rp(scheduleNet, language)}. Tanggal perkiraan mengikuti pola pembagian 12 bulan terakhir, nominalnya diskalakan ke dividen tahunan yang dipilih dengan proporsi interim/final aslinya. Pastikan dengan pengumuman resmi emiten.`,
                  `Next 12 months total: ${rp(scheduleNet, language)}. Estimated dates follow the last 12-month payout pattern; amounts are scaled to the chosen annual dividend using the actual interim/final proportions. Confirm with the issuer's official announcement.`
                )}
              </p>
            </>
          )}
        </div>
      </Card>

      {/* 4. DRIP */}
      {todayIso && (
        <DripProjection
          language={language}
          shares={sim.shares}
          buyPrice={buyPrice}
          initialCostRp={sim.totalCostRp}
          annualDps={annualDps}
          taxRatePct={taxRate}
          buyFeePct={buyFee}
          schedule={schedule}
          todayIso={todayIso}
          historicalCagrPct={profile?.growth?.cagrPct ?? null}
        />
      )}

      {/* 5. Dividend trap */}
      <ExDateSimulator
        key={ticker}
        language={language}
        ticker={ticker}
        defaultPrice={buyPrice}
        defaultLots={sim.lots}
        nextPayment={nextPayment}
        fallbackDps={annualDps}
        taxRatePct={taxRate}
        buyFeePct={buyFee}
      />

      {/* Catatan */}
      <Card className="bg-white/[0.02]">
        <CardTitle icon={<Landmark className="h-5 w-5 text-slate-400" />} title={L('Catatan pajak & data', 'Tax & data notes')} />
        <ul className="space-y-2 text-[11px] text-slate-400 leading-relaxed list-disc pl-4">
          <li>
            {L(
              'Investor individu dalam negeri: dividen saham emiten Indonesia bebas pajak bila diinvestasikan kembali di Indonesia minimal 3 tahun pajak (dilaporkan di SPT). Bila tidak, terutang PPh final 10% yang disetor sendiri.',
              'Domestic individual investors: dividends from Indonesian issuers are tax-exempt when reinvested in Indonesia for at least 3 tax years (reported in the annual tax return). Otherwise a 10% final tax applies, self-paid.'
            )}
          </li>
          <li>
            {L(
              'Investor asing: PPh 26 sebesar 20% dipotong saat pembayaran, atau tarif tax treaty (P3B) yang lebih rendah bila memenuhi syarat.',
              'Foreign investors: 20% withholding tax at payment, or a lower tax-treaty rate when eligible.'
            )}
          </li>
          <li>
            {L(
              `Riwayat dividen & harga: ${ready?.source.label ?? 'Yahoo Finance'} (data tertunda, nominal disesuaikan stock split). Data riwayat diperbarui maksimal tiap 6 jam; harga diperbarui tiap menit selama jam bursa.`,
              `Dividend history & prices: ${ready?.source.label ?? 'Yahoo Finance'} (delayed data, split-adjusted amounts). History refreshes at most every 6 hours; prices refresh every minute during market hours.`
            )}
          </li>
          <li>{L('Simulasi ini alat bantu hitung, bukan rekomendasi beli/jual.', 'This simulation is a calculation aid, not a buy/sell recommendation.')}</li>
        </ul>
      </Card>
    </div>
  );
}
