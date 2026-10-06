'use client';

import * as React from 'react';
import { Sparkles, Plus, Trash2, RefreshCw, RotateCcw, AlertTriangle } from 'lucide-react';
import { AvgDownInput, AvgDownResult, isValidIdxPrice, getIdxTickSize, roundDownToIdxTick, stepIdxPrice } from '@/lib/calculator';
import { StepperInput } from '@/components/stepper-input';
import { motion, AnimatePresence } from 'framer-motion';
import Image from 'next/image';
import { cleanCompanyName } from '@/lib/utils';
import type { AppUser } from '@/lib/types';
import { IDX_TICKERS as TICKER_DATABASE } from '@/lib/tickers';
import { useLanguage } from '@/lib/language-context';
import { parseFormattedNumber, formatNumberForInput as _formatNumberForInput, formatIDR, formatPercent } from '@/lib/format';

// Local wrapper preserves the original max-fraction-digits (4) for this tab.
const formatNumberForInput = (num: number | string | undefined | null): string =>
  _formatNumberForInput(num, { maxFractionDigits: 4 });

// Nilai contoh awal form (juga dipakai tombol Reset).
const DEFAULT_FORM = {
  ticker: 'GTSI',
  companyName: 'GTS Internasional Tbk',
  lotAwal: '100',
  avgPriceAwal: '160',
  currentPrice: '135',
  trancheLot: '100',
  tranchePrice: '130',
};

// Tahap baru diisi otomatis sekian persen di bawah harga tahap sebelumnya.
const LADDER_STEP = 0.95;

// Langkah tombol −/+ untuk tiap jenis angka.
const stepLot = (value: string, direction: 1 | -1): string =>
  formatNumberForInput(Math.max(1, Math.round(parseFormattedNumber(value)) + direction));

const stepPrice = (value: string, direction: 1 | -1): string =>
  formatNumberForInput(stepIdxPrice(parseFormattedNumber(value), direction));

// Avg price boleh desimal, jadi digeser satu fraksi tanpa di-snap ke harga valid.
const stepAvgPrice = (value: string, direction: 1 | -1): string => {
  const price = parseFormattedNumber(value);
  const tick = getIdxTickSize(direction > 0 ? price : Math.max(1, price - 1));
  return formatNumberForInput(Math.max(1, price + direction * tick));
};

const stepFee = (value: number, direction: 1 | -1): number =>
  Math.min(10, Math.max(0, Math.round((value + direction * 0.01) * 100) / 100));

// Modal (dana) yang dibutuhkan untuk satu tranche, mengikuti setting fee beli.
function getTrancheCapital(lot: string, price: string, includeFees: boolean, feeBeli: number): number {
  const l = parseFormattedNumber(lot);
  const p = parseFormattedNumber(price);
  if (l <= 0 || p <= 0) return 0;
  let cost = l * 100 * p;
  if (includeFees) {
    cost = cost * (1 + feeBeli / 100);
  }
  return cost;
}

interface CalculatorFormProps {
  onCalculate: (values: AvgDownInput) => void;
  onSavePlan?: (title: string) => void;
  isSaving?: boolean;
  user?: AppUser | null;
  result?: AvgDownResult | null;
  initialValues?: {
    ticker: string;
    company_name?: string;
    lot_awal: number;
    avg_price_awal: number;
    current_price: number;
    lot_baru: number;
    harga_beli_baru: number;
    fee_beli: number;
    fee_jual: number;
    avgPriceAwalIncludesFee?: boolean;
    tranches?: Array<{ id: string; lot: number; price: number }>;
  } | null;
}


const BROKER_PRESETS = [
  { id: 'stockbit', name: 'Stockbit', buy: 0.15, sell: 0.25 },
  { id: 'ajaib', name: 'Ajaib', buy: 0.15, sell: 0.25 },
  { id: 'ipot', name: 'IPOT (Indo Premier)', buy: 0.19, sell: 0.29 },
  { id: 'custom', name: 'Custom Fee', buy: 0.20, sell: 0.30 }
];

const SUB_CARD_CLASS =
  'p-4 md:p-5 rounded-2xl bg-white/[0.03] border border-white/25 hover:border-emerald-500/40 transition-all duration-300 space-y-4 flex flex-col justify-between min-w-0 w-full';

function FormEmitenLogo({ symbol }: { symbol: string }) {
  const [hasError, setHasError] = React.useState(false);
  const [prevSymbol, setPrevSymbol] = React.useState(symbol);

  if (symbol !== prevSymbol) {
    setPrevSymbol(symbol);
    setHasError(false);
  }

  const cleanSymbol = symbol.toUpperCase().trim();

  if (cleanSymbol.length < 3) {
    return (
      <div className="w-10 h-10 md:w-9 md:h-9 rounded-xl bg-slate-100/5 border border-white/10 flex items-center justify-center shrink-0">
        <span className="font-extrabold text-[9px] text-slate-500">IDX</span>
      </div>
    );
  }

  return (
    <div className="w-10 h-10 md:w-9 md:h-9 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
      {!hasError ? (
        <Image
          src={`https://assets.stockbit.com/logos/companies/${cleanSymbol}.png`}
          alt={cleanSymbol}
          width={28}
          height={28}
          className="w-7 h-7 md:w-6 md:h-6 object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-black text-[10px] md:text-[11px] text-emerald-400">
          {cleanSymbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

export function CalculatorForm({ onCalculate, onSavePlan, isSaving = false, user, result, initialValues }: CalculatorFormProps) {
  const { t, language } = useLanguage();
  const fieldId = React.useId();
  const [ticker, setTicker] = React.useState(DEFAULT_FORM.ticker);
  const [companyName, setCompanyName] = React.useState(DEFAULT_FORM.companyName);
  const [lotAwal, setLotAwal] = React.useState<string>(DEFAULT_FORM.lotAwal);
  const [avgPriceAwal, setAvgPriceAwal] = React.useState<string>(DEFAULT_FORM.avgPriceAwal);
  const [currentPrice, setCurrentPrice] = React.useState<string>(DEFAULT_FORM.currentPrice);

  const [tranches, setTranches] = React.useState<Array<{ id: string; lot: string; price: string }>>([
    { id: '1', lot: DEFAULT_FORM.trancheLot, price: DEFAULT_FORM.tranchePrice }
  ]);

  const [brokerPreset, setBrokerPreset] = React.useState('stockbit');
  const [feeBeli, setFeeBeli] = React.useState(0.15);
  const [feeJual, setFeeJual] = React.useState(0.25);
  const [includeFees, setIncludeFees] = React.useState(true);

  // Custom configurations and loading states
  const [avgPriceAwalIncludesFee, setAvgPriceAwalIncludesFee] = React.useState(true);
  const [isFetchingTicker, setIsFetchingTicker] = React.useState(false);
  const [fetchingTrancheId, setFetchingTrancheId] = React.useState<string | null>(null);

  const isLoadedPlanRef = React.useRef(false);
  const prevCurrentPriceRef = React.useRef(currentPrice);


  React.useEffect(() => {
    if (initialValues) {
      isLoadedPlanRef.current = true;
      const timer = setTimeout(() => {
        setTicker(initialValues.ticker);
        setCompanyName(cleanCompanyName(initialValues.company_name) || TICKER_DATABASE[initialValues.ticker] || '');
        setLotAwal(formatNumberForInput(initialValues.lot_awal));
        setAvgPriceAwal(formatNumberForInput(initialValues.avg_price_awal));
        setCurrentPrice(formatNumberForInput(initialValues.current_price));
        if (initialValues.tranches && initialValues.tranches.length > 0) {
          setTranches(initialValues.tranches.map(t => ({
            id: t.id || crypto.randomUUID(),
            lot: formatNumberForInput(t.lot),
            price: formatNumberForInput(t.price)
          })));
        } else {
          setTranches([
            {
              id: '1',
              lot: formatNumberForInput(initialValues.lot_baru),
              price: formatNumberForInput(initialValues.harga_beli_baru)
            }
          ]);
        }
        setFeeBeli(initialValues.fee_beli);
        setFeeJual(initialValues.fee_jual);
        setIncludeFees(initialValues.fee_beli > 0 || initialValues.fee_jual > 0);
        setAvgPriceAwalIncludesFee(initialValues.avgPriceAwalIncludesFee !== false);

        const matchedPreset = BROKER_PRESETS.find(p => p.buy === initialValues.fee_beli && p.sell === initialValues.fee_jual);
        if (matchedPreset) {
          setBrokerPreset(matchedPreset.id);
        } else if (initialValues.fee_beli === 0 && initialValues.fee_jual === 0) {
          setBrokerPreset('none');
        } else {
          setBrokerPreset('custom');
        }

        // Reset plan loaded flag after rendering
        setTimeout(() => {
          isLoadedPlanRef.current = false;
        }, 500);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [initialValues]);

  const fetchRemoteTicker = React.useCallback(async (symbol: string) => {
    setIsFetchingTicker(true);
    try {
      const res = await fetch(`/api/ticker?symbol=${encodeURIComponent(symbol)}`);
      if (res.ok) {
        const data = await res.json();
        if (data.name) {
          setCompanyName(data.name);
        }
        if (data.price !== undefined && data.price !== null) {
          setCurrentPrice(formatNumberForInput(data.price));
        }
      }
    } catch (err) {
      console.error('Error fetching remote ticker data:', err);
    } finally {
      setIsFetchingTicker(false);
    }
  }, []);

  // Mengambil nama emiten & harga secara real-time dari internet (Yahoo Finance) atau database lokal.
  // Nama dari kamus lokal tampil instan; request ke server ditunda sampai user berhenti mengetik.
  React.useEffect(() => {
    const val = ticker.toUpperCase().trim();
    if (val.length < 4) {
      const timer = setTimeout(() => {
        setCompanyName('');
        setCurrentPrice('');
      }, 0);
      return () => clearTimeout(timer);
    }

    const localTimer = setTimeout(() => {
      if (TICKER_DATABASE[val]) {
        setCompanyName(TICKER_DATABASE[val]);
      }
    }, 0);
    const remoteTimer = setTimeout(() => fetchRemoteTicker(val), 400);
    return () => {
      clearTimeout(localTimer);
      clearTimeout(remoteTimer);
    };
  }, [ticker, fetchRemoteTicker]);

  const handleRefreshPrice = React.useCallback(() => {
    const val = ticker.toUpperCase().trim();
    if (val.length >= 4) {
      fetchRemoteTicker(val);
    }
  }, [ticker, fetchRemoteTicker]);

  const handleRefreshTranchePrice = async (trancheId: string) => {
    const val = ticker.toUpperCase().trim();
    if (val.length >= 4) {
      setFetchingTrancheId(trancheId);
      try {
        const res = await fetch(`/api/ticker?symbol=${encodeURIComponent(val)}`);
        if (res.ok) {
          const data = await res.json();
          if (data.price !== undefined && data.price !== null) {
            const formattedPrice = formatNumberForInput(data.price);
            setCurrentPrice(formattedPrice);

            // Set the price of this specific tranche
            setTranches(prev => prev.map(t =>
              t.id === trancheId ? { ...t, price: formattedPrice } : t
            ));
            return;
          }
        }
      } catch (err) {
        console.error('Error refreshing tranche price:', err);
      } finally {
        setFetchingTrancheId(null);
      }
    }

    // Fallback: copy currentPrice if api fetch fails or symbol is invalid
    if (currentPrice) {
      setTranches(prev => prev.map(t =>
        t.id === trancheId ? { ...t, price: currentPrice } : t
      ));
    }
  };

  // Automatically sync tranche prices to currentPrice if they are not customized
  React.useEffect(() => {
    const oldPrice = prevCurrentPriceRef.current;
    const newPrice = currentPrice;
    prevCurrentPriceRef.current = newPrice;

    if (isLoadedPlanRef.current) return;

    if (newPrice !== oldPrice) {
      setTranches(prev => prev.map(t => {
        if (!t.price || t.price === oldPrice || oldPrice === '' || t.price === DEFAULT_FORM.tranchePrice) {
          return { ...t, price: newPrice };
        }
        return t;
      }));
    }
  }, [currentPrice]);

  // Trigger calculation on input changes
  React.useEffect(() => {
    const parsedTranches = tranches.map(t => ({
      id: t.id,
      lot: parseFormattedNumber(t.lot),
      price: parseFormattedNumber(t.price)
    }));

    // Calculate total lots and weighted average price of new buys to support legacy bindings
    let totalLots = 0;
    let totalCost = 0;
    parsedTranches.forEach(t => {
      totalLots += t.lot;
      totalCost += t.lot * t.price;
    });
    const weightedPrice = totalLots > 0 ? totalCost / totalLots : 0;

    const calculationInput: AvgDownInput = {
      ticker: ticker || 'IDX',
      companyName: companyName,
      lotAwal: parseFormattedNumber(lotAwal),
      avgPriceAwal: parseFormattedNumber(avgPriceAwal),
      currentPrice: parseFormattedNumber(currentPrice),
      lotBaru: totalLots,
      hargaBeliBaru: weightedPrice,
      feeBeli: includeFees ? Number(feeBeli) : 0,
      feeJual: includeFees ? Number(feeJual) : 0,
      includeFees,
      avgPriceAwalIncludesFee,
      tranches: parsedTranches
    };
    onCalculate(calculationInput);
  }, [
    ticker, companyName, lotAwal, avgPriceAwal, currentPrice,
    tranches, feeBeli, feeJual, includeFees, avgPriceAwalIncludesFee,
    onCalculate
  ]);

  // Tahap baru: lot sama dengan tahap terakhir, harga 5% di bawahnya (dibulatkan ke fraksi BEI).
  const handleAddTranche = () => {
    const last = tranches[tranches.length - 1];
    const basePrice = parseFormattedNumber(last?.price || '') || parseFormattedNumber(currentPrice);
    const nextPrice = basePrice > 0 ? roundDownToIdxTick(basePrice * LADDER_STEP) : 0;
    setTranches([
      ...tranches,
      {
        id: crypto.randomUUID(),
        lot: last?.lot || '',
        price: nextPrice > 0 ? formatNumberForInput(nextPrice) : ''
      }
    ]);
  };

  const handleRemoveTranche = (id: string) => {
    if (tranches.length <= 1) return;
    setTranches(tranches.filter(t => t.id !== id));
  };

  const handleTrancheChange = (id: string, field: 'lot' | 'price', value: string) => {
    setTranches(tranches.map(t => {
      if (t.id === id) {
        const cleanVal = field === 'lot' ? value.replace(/[^0-9]/g, '') : value.replace(/[^0-9.,]/g, '');
        return { ...t, [field]: cleanVal };
      }
      return t;
    }));
  };

  const handleTrancheBlur = (id: string, field: 'lot' | 'price') => {
    setTranches(tranches.map(t => {
      if (t.id === id) {
        return { ...t, [field]: formatNumberForInput(t[field]) };
      }
      return t;
    }));
  };


  // Functional update agar tombol yang ditahan (repeat) selalu memakai nilai terbaru.
  const handleTrancheStep = (id: string, field: 'lot' | 'price', direction: 1 | -1) => {
    setTranches(prev => prev.map(t => {
      if (t.id !== id) return t;
      return { ...t, [field]: field === 'lot' ? stepLot(t.lot, direction) : stepPrice(t.price, direction) };
    }));
  };

  const handlePresetChange = (presetId: string) => {
    setBrokerPreset(presetId);
    if (presetId === 'none') {
      setIncludeFees(false);
      setFeeBeli(0);
      setFeeJual(0);
    } else {
      setIncludeFees(true);
      const selected = BROKER_PRESETS.find(p => p.id === presetId);
      if (selected) {
        setFeeBeli(selected.buy);
        setFeeJual(selected.sell);
      }
    }
  };

  const handleReset = () => {
    const tickerChanged = ticker !== DEFAULT_FORM.ticker;
    setTicker(DEFAULT_FORM.ticker);
    setCompanyName(DEFAULT_FORM.companyName);
    setLotAwal(DEFAULT_FORM.lotAwal);
    setAvgPriceAwal(DEFAULT_FORM.avgPriceAwal);
    setCurrentPrice(DEFAULT_FORM.currentPrice);
    setTranches([{ id: crypto.randomUUID(), lot: DEFAULT_FORM.trancheLot, price: DEFAULT_FORM.tranchePrice }]);
    handlePresetChange('stockbit');
    setAvgPriceAwalIncludesFee(true);
    // Ticker yang sama tidak memicu effect fetch, jadi ambil harga live secara manual.
    if (!tickerChanged) fetchRemoteTicker(DEFAULT_FORM.ticker);
  };

  const handleBlur = (val: string, setter: (val: string) => void) => {
    if (!val) return;
    setter(formatNumberForInput(val));
  };

  const handleSaveClick = (e: React.FormEvent) => {
    e.preventDefault();
    if (onSavePlan) {
      onSavePlan(`Rencana Avg Down ${ticker}`);
    }
  };

  const totalPurchaseCapital = tranches.reduce(
    (sum, tr) => sum + getTrancheCapital(tr.lot, tr.price, includeFees, feeBeli),
    0
  );

  const canSave =
    parseFormattedNumber(lotAwal) > 0 &&
    parseFormattedNumber(avgPriceAwal) > 0 &&
    tranches.every(t => parseFormattedNumber(t.lot) > 0 && parseFormattedNumber(t.price) > 0);

  const hasLiveResult = !!result && result.sharesAwal > 0 && result.sharesBaru > 0;

  return (
    <div className="glass-card p-4 md:p-6 w-full flex flex-col gap-4">
      {/* Title block */}
      <div className="flex justify-between items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-3">
        <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
          <Sparkles className="h-4.5 w-4.5 text-emerald-400" />
          {t('calculator.title')}
        </h2>
        <button
          type="button"
          onClick={handleReset}
          title={t('calculator.resetTitle')}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-white/10 hover:border-emerald-500/40 bg-white/[0.03] hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 text-[11px] font-bold transition-all cursor-pointer shrink-0"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          {t('calculator.reset')}
        </button>
      </div>

      {/* Responsive Form Layout with Card-Inside-Card design */}
      <form onSubmit={handleSaveClick} className="flex flex-col gap-5 w-full">
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-4 md:gap-5 items-stretch w-full">

          {/* Sub-Card Step 1: Ticker & Nama Emiten */}
          <div className={`${SUB_CARD_CLASS} xl:col-span-5`}>
            <div className="space-y-3">
              <label htmlFor={`${fieldId}-ticker`} className="text-xs font-bold text-slate-300 block">
                {t('calculator.step1')}
              </label>
              <div className="flex gap-2.5 items-center">

                {/* Logo Emiten */}
                <FormEmitenLogo symbol={ticker} />

                {/* Kotak Ticker */}
                <div className="w-1/3 relative">
                  <input
                    id={`${fieldId}-ticker`}
                    type="text"
                    value={ticker}
                    onChange={(e) => {
                      setTicker(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''));
                    }}
                    placeholder="GTSI"
                    maxLength={5}
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    className="w-full text-center font-bold tracking-wider glass-input px-2.5 py-2.5 text-xs uppercase"
                    required
                  />
                </div>

                {/* Kotak Nama Perusahaan */}
                <div className="w-2/3">
                  <input
                    type="text"
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    placeholder={t('calculator.placeholderCompany')}
                    aria-label={t('calculator.placeholderCompany')}
                    className={`w-full glass-input px-3 py-2.5 text-xs font-semibold placeholder:text-slate-500/50 transition-all duration-300 ${
                      isFetchingTicker ? 'animate-pulse text-slate-400 bg-slate-100/5 dark:bg-white/5 border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]' : ''
                    }`}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Card Step 2: Posisi Portofolio Awal */}
          <div className={`${SUB_CARD_CLASS} xl:col-span-7`}>
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">
                {t('calculator.step2')}
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-2">
                <div>
                  <StepperInput
                    id={`${fieldId}-lot-awal`}
                    type="text"
                    inputMode="numeric"
                    value={lotAwal}
                    onChange={(e) => setLotAwal(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onBlur={() => handleBlur(lotAwal, setLotAwal)}
                    onStep={(dir) => setLotAwal(prev => stepLot(prev, dir))}
                    canDecrement={parseFormattedNumber(lotAwal) > 1}
                    decrementLabel={`${t('calculator.decrease')} ${t('calculator.lotAwal')}`}
                    incrementLabel={`${t('calculator.increase')} ${t('calculator.lotAwal')}`}
                    placeholder={t('calculator.lotAwal')}
                    required
                  />
                  <label htmlFor={`${fieldId}-lot-awal`} className="text-[10px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.lotAwal')}</label>
                </div>
                <div>
                  <StepperInput
                    id={`${fieldId}-avg-awal`}
                    type="text"
                    inputMode="decimal"
                    value={avgPriceAwal}
                    onChange={(e) => setAvgPriceAwal(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onBlur={() => handleBlur(avgPriceAwal, setAvgPriceAwal)}
                    onStep={(dir) => setAvgPriceAwal(prev => stepAvgPrice(prev, dir))}
                    canDecrement={parseFormattedNumber(avgPriceAwal) > 1}
                    decrementLabel={`${t('calculator.decrease')} Avg Price`}
                    incrementLabel={`${t('calculator.increase')} Avg Price`}
                    placeholder="Avg Price"
                    required
                  />
                  <label htmlFor={`${fieldId}-avg-awal`} className="text-[10px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.avgPrice').replace(' (Rp)', '')} (Rp)</label>
                </div>
                <div>
                  <StepperInput
                    id={`${fieldId}-current-price`}
                    type="text"
                    inputMode="decimal"
                    value={currentPrice}
                    onChange={(e) => setCurrentPrice(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onBlur={() => handleBlur(currentPrice, setCurrentPrice)}
                    onStep={(dir) => setCurrentPrice(prev => stepPrice(prev, dir))}
                    canDecrement={parseFormattedNumber(currentPrice) > 1}
                    decrementLabel={`${t('calculator.decrease')} ${t('calculator.currentPrice').replace(' (Rp)', '')}`}
                    incrementLabel={`${t('calculator.increase')} ${t('calculator.currentPrice').replace(' (Rp)', '')}`}
                    placeholder={t('calculator.currentPrice').replace(' (Rp)', '')}
                    className={isFetchingTicker ? 'animate-pulse border-emerald-500/40 shadow-[0_0_8px_rgba(16,185,129,0.15)]' : undefined}
                    inputClassName={isFetchingTicker ? 'text-slate-400' : undefined}
                    adornment={
                      <button
                        type="button"
                        onClick={handleRefreshPrice}
                        disabled={isFetchingTicker || ticker.toUpperCase().trim().length < 4}
                        className="w-6 shrink-0 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                        title={t('calculator.useMarketPrice')}
                        aria-label={t('calculator.useMarketPrice')}
                      >
                        <RefreshCw className={`h-3 w-3 ${isFetchingTicker ? 'animate-spin' : ''}`} />
                      </button>
                    }
                    required
                  />
                  <label htmlFor={`${fieldId}-current-price`} className="text-[10px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.currentPrice').replace(' (Rp)', '')} (Rp)</label>
                </div>
              </div>
            </div>

            {/* Checkbox Penyesuaian Fee Beli Awal */}
            {includeFees ? (
              <div className="flex items-center gap-2 pt-1 animate-fadeIn select-none">
                <input
                  type="checkbox"
                  id={`${fieldId}-avg-includes-fee`}
                  checked={avgPriceAwalIncludesFee}
                  onChange={(e) => setAvgPriceAwalIncludesFee(e.target.checked)}
                  className="rounded border-white/10 text-emerald-500 focus:ring-emerald-500 bg-black/40 h-3.5 w-3.5 cursor-pointer"
                />
                <label
                  htmlFor={`${fieldId}-avg-includes-fee`}
                  className="text-[10px] text-slate-400 hover:text-slate-300 cursor-pointer transition-colors font-semibold leading-none"
                >
                  {t('calculator.includingFeeCheckbox')}
                </label>
              </div>
            ) : null}
          </div>

          {/* Sub-Card Step 3: Rencana Pembelian Baru */}
          <div className={`${SUB_CARD_CLASS} xl:col-span-8`}>
            <div className="space-y-3">
              <span className="text-xs font-bold text-slate-300 block">
                {t('calculator.step3')}
              </span>

              <div className="hidden sm:flex items-center gap-2 px-1 text-[10px] font-extrabold uppercase tracking-wider text-slate-400" aria-hidden="true">
                <span className="w-6 shrink-0 text-center">#</span>
                <span className="flex-1 min-w-0 text-center">{t('calculator.trancheLot')}</span>
                <span className="flex-[1.4] min-w-0 text-center">{t('calculator.tranchePrice')}</span>
                <span className="w-28 shrink-0 text-right">{t('calculator.trancheCapital')}</span>
                {tranches.length > 1 && <span className="w-7 shrink-0" />}
              </div>

              <div className="flex flex-col gap-2">
                <AnimatePresence initial={false}>
                  {tranches.map((tranche, index) => {
                    const trancheCapital = getTrancheCapital(tranche.lot, tranche.price, includeFees, feeBeli);
                    const priceNum = parseFormattedNumber(tranche.price);
                    const tickInvalid = priceNum > 0 && !isValidIdxPrice(priceNum);
                    const rowLabel = `${t('calculator.tahap')} ${index + 1}`;
                    const indexBadge = (
                      <span
                        className="w-6 h-6 shrink-0 rounded-full bg-emerald-500/10 border border-emerald-500/25 text-[10px] font-black text-emerald-400 flex items-center justify-center"
                        title={rowLabel}
                      >
                        {index + 1}
                      </span>
                    );
                    const removeButton = tranches.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveTranche(tranche.id)}
                        className="w-7 h-7 flex items-center justify-center text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer shrink-0"
                        title={t('calculator.removeTranche')}
                        aria-label={`${rowLabel} – ${t('calculator.removeTranche')}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    ) : null;
                    return (
                    <motion.div
                      key={tranche.id}
                      initial={{ opacity: 0, height: 0, y: -10 }}
                      animate={{ opacity: 1, height: 'auto', y: 0 }}
                      exit={{ opacity: 0, height: 0, y: -10 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden shrink-0"
                    >
                      <div className="rounded-xl border border-white/5 bg-black/10 p-2.5 sm:p-0 sm:border-0 sm:bg-transparent">
                        {/* Mobile: nomor tahap, dana & hapus di baris atas */}
                        <div className="flex sm:hidden items-center gap-2 pb-2">
                          {indexBadge}
                          <span className="text-[11px] font-bold text-slate-300">{rowLabel}</span>
                          <span className="ml-auto text-[11px] font-bold text-emerald-400 truncate">
                            {trancheCapital > 0 ? formatIDR(trancheCapital, language) : '-'}
                          </span>
                          {removeButton}
                        </div>

                        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center sm:py-0.5">
                          <span className="hidden sm:flex">{indexBadge}</span>

                          <div className="min-w-0 sm:flex-1">
                            <span className="sm:hidden block mb-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{t('calculator.trancheLot')}</span>
                            <StepperInput
                              type="text"
                              inputMode="numeric"
                              value={tranche.lot}
                              onChange={(e) => handleTrancheChange(tranche.id, 'lot', e.target.value)}
                              onBlur={() => handleTrancheBlur(tranche.id, 'lot')}
                              onStep={(dir) => handleTrancheStep(tranche.id, 'lot', dir)}
                              canDecrement={parseFormattedNumber(tranche.lot) > 1}
                              decrementLabel={`${rowLabel} – ${t('calculator.decrease')} ${t('calculator.trancheLot')}`}
                              incrementLabel={`${rowLabel} – ${t('calculator.increase')} ${t('calculator.trancheLot')}`}
                              placeholder={t('calculator.trancheLot')}
                              aria-label={`${rowLabel} – ${t('calculator.trancheLot')}`}
                              className="bg-black/20"
                              inputClassName="py-2"
                              required
                            />
                          </div>

                          <div className="min-w-0 sm:flex-[1.4]">
                            <span className="sm:hidden block mb-1 text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{t('calculator.tranchePrice')}</span>
                            <StepperInput
                              type="text"
                              inputMode="decimal"
                              value={tranche.price}
                              onChange={(e) => handleTrancheChange(tranche.id, 'price', e.target.value)}
                              onBlur={() => handleTrancheBlur(tranche.id, 'price')}
                              onStep={(dir) => handleTrancheStep(tranche.id, 'price', dir)}
                              canDecrement={priceNum > 1}
                              decrementLabel={`${rowLabel} – ${t('calculator.decrease')} ${t('calculator.tranchePrice')}`}
                              incrementLabel={`${rowLabel} – ${t('calculator.increase')} ${t('calculator.tranchePrice')}`}
                              placeholder={t('calculator.tranchePrice')}
                              aria-label={`${rowLabel} – ${t('calculator.tranchePrice')}`}
                              invalid={tickInvalid}
                              className="bg-black/20"
                              inputClassName="py-2"
                              adornment={
                                <button
                                  type="button"
                                  onClick={() => handleRefreshTranchePrice(tranche.id)}
                                  disabled={fetchingTrancheId !== null || isFetchingTicker || ticker.toUpperCase().trim().length < 4}
                                  className="w-6 shrink-0 flex items-center justify-center text-slate-400 hover:text-emerald-400 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                  title={t('calculator.useMarketPrice')}
                                  aria-label={`${rowLabel} – ${t('calculator.useMarketPrice')}`}
                                >
                                  <RefreshCw className={`h-3 w-3 ${fetchingTrancheId === tranche.id ? 'animate-spin' : ''}`} />
                                </button>
                              }
                              required
                            />
                          </div>

                          <span className="hidden sm:block w-28 shrink-0 text-right text-[11px] font-bold text-emerald-400 truncate" title={formatIDR(trancheCapital, language)}>
                            {trancheCapital > 0 ? formatIDR(trancheCapital, language) : '-'}
                          </span>

                          {removeButton && <span className="hidden sm:flex">{removeButton}</span>}
                        </div>

                        {/* Peringatan fraksi harga */}
                        {tickInvalid && (
                          <span className="flex items-center gap-1 pt-1.5 sm:pl-8 text-[10px] font-semibold text-amber-400">
                            <AlertTriangle className="h-3 w-3 shrink-0" />
                            {t('calculator.tickWarning').replace('{tick}', String(getIdxTickSize(priceNum)))}
                          </span>
                        )}
                      </div>
                    </motion.div>
                    );
                  })}
                </AnimatePresence>
              </div>
            </div>

            {/* Total Dana Dibutuhkan untuk seluruh tranche */}
            <div className="flex items-center justify-between gap-2 px-1 pt-2 mt-1 border-t border-white/10">
              <span className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                {t('calculator.totalPurchase')}
              </span>
              <span className="text-xs md:text-sm font-black text-emerald-400">
                {formatIDR(totalPurchaseCapital, language)}
              </span>
            </div>

            <div className="space-y-1.5">
              <button
                type="button"
                onClick={handleAddTranche}
                className="w-full flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl border border-dashed border-emerald-500/30 hover:border-emerald-500 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-400 font-bold text-xs transition-all cursor-pointer select-none"
              >
                <Plus className="h-3.5 w-3.5" />
                {t('calculator.addTranche')}
              </button>
              <p className="text-[10px] text-slate-500 text-center">{t('calculator.ladderHint')}</p>
            </div>
          </div>

          {/* Sub-Card Step 4: Broker Fee Settings */}
          <div className={`${SUB_CARD_CLASS} xl:col-span-4`}>
            <div className="space-y-3">
              <label htmlFor={`${fieldId}-broker`} className="text-xs font-bold text-slate-300 block">
                {t('calculator.step4')}
              </label>
              <select
                id={`${fieldId}-broker`}
                value={brokerPreset}
                onChange={(e) => handlePresetChange(e.target.value)}
                className="w-full glass-input px-3 py-2.5 text-xs font-semibold cursor-pointer text-foreground bg-background rounded-xl"
              >
                <option value="stockbit">Stockbit ({t('calculator.feeBeli')} 0.15% / {t('calculator.feeJual')} 0.25%)</option>
                <option value="ajaib">Ajaib ({t('calculator.feeBeli')} 0.15% / {t('calculator.feeJual')} 0.25%)</option>
                <option value="ipot">IPOT ({t('calculator.feeBeli')} 0.19% / {t('calculator.feeJual')} 0.29%)</option>
                <option value="custom">{t('calculator.presetCustom')}</option>
                <option value="none">{t('calculator.presetNone')}</option>
              </select>

              {brokerPreset === 'custom' && (
                <div className="grid grid-cols-2 gap-2 mt-2 animate-fadeIn">
                  <div>
                    <StepperInput
                      id={`${fieldId}-fee-beli`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max="10"
                      value={feeBeli}
                      onChange={(e) => setFeeBeli(parseFloat(e.target.value) || 0)}
                      onStep={(dir) => setFeeBeli(prev => stepFee(prev, dir))}
                      canDecrement={feeBeli > 0}
                      canIncrement={feeBeli < 10}
                      decrementLabel={`${t('calculator.decrease')} ${t('calculator.feeBeli')}`}
                      incrementLabel={`${t('calculator.increase')} ${t('calculator.feeBeli')}`}
                      inputClassName="py-2"
                      adornment={<span className="flex items-center pr-0.5 text-xs text-slate-500">%</span>}
                    />
                    <label htmlFor={`${fieldId}-fee-beli`} className="text-[9px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.feeBeli')}</label>
                  </div>
                  <div>
                    <StepperInput
                      id={`${fieldId}-fee-jual`}
                      type="number"
                      inputMode="decimal"
                      step="0.01"
                      min="0"
                      max="10"
                      value={feeJual}
                      onChange={(e) => setFeeJual(parseFloat(e.target.value) || 0)}
                      onStep={(dir) => setFeeJual(prev => stepFee(prev, dir))}
                      canDecrement={feeJual > 0}
                      canIncrement={feeJual < 10}
                      decrementLabel={`${t('calculator.decrease')} ${t('calculator.feeJual')}`}
                      incrementLabel={`${t('calculator.increase')} ${t('calculator.feeJual')}`}
                      inputClassName="py-2"
                      adornment={<span className="flex items-center pr-0.5 text-xs text-slate-500">%</span>}
                    />
                    <label htmlFor={`${fieldId}-fee-jual`} className="text-[9px] text-slate-400 text-center block mt-1 font-medium">{t('calculator.feeJual')}</label>
                  </div>
                </div>
              )}
            </div>

            <span className="text-[10px] text-slate-400 text-center block font-medium">
              {includeFees ? t('calculator.feesIncluded') : t('calculator.feesExcluded')}
            </span>
          </div>
        </div>

        {/* Action Row: ringkasan hasil live + tombol simpan */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-3 border-t border-slate-200/50 dark:border-white/5 w-full">
          {hasLiveResult && result ? (
            <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-6 text-left" aria-live="polite">
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block">{t('calculator.liveNewAvg')}</span>
                <span className="text-xs md:text-sm font-black text-white block truncate">{formatIDR(result.avgPriceBaru, language)}</span>
                <span className={`text-[10px] font-bold ${result.avgPriceReductionPct >= 0 ? 'text-bullish-green' : 'text-amber-400'}`}>
                  {formatPercent(-result.avgPriceReductionPct, { language, signed: true })}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block">{t('calculator.liveBep')}</span>
                <span className="text-xs md:text-sm font-black text-white block truncate">{formatIDR(result.breakEvenPriceBaru, language)}</span>
                <span className={`text-[10px] font-bold ${result.gainToBreakEvenBaruPct > 0 ? 'text-slate-400' : 'text-bullish-green'}`}>
                  {formatPercent(result.gainToBreakEvenBaruPct, { language, signed: true })}
                </span>
              </div>
              <div className="min-w-0">
                <span className="text-[9px] font-bold uppercase tracking-widest text-slate-500 block">{t('calculator.liveCapital')}</span>
                <span className="text-xs md:text-sm font-black text-emerald-400 block truncate">{formatIDR(result.capitalRequired, language)}</span>
              </div>
            </div>
          ) : (
            <span />
          )}

          <div className="flex flex-col items-stretch sm:items-end gap-1">
            <button
              type="submit"
              disabled={isSaving || !canSave}
              className="w-full sm:w-auto py-2.5 px-6 rounded-xl bg-emerald-500 hover:bg-emerald-600 hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed text-white font-bold text-xs transition-all duration-300 shadow-md cursor-pointer hover:scale-[1.01] active:scale-[0.99] flex items-center justify-center gap-2"
            >
              {isSaving ? (
                <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
              ) : null}
              <span>{user ? t('common.save') : t('common.saveLocal')}</span>
            </button>
            {!canSave && (
              <span className="text-[10px] text-amber-400 font-semibold text-center sm:text-right">
                {t('calculator.saveDisabledHint')}
              </span>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
