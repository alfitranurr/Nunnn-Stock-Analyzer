'use client';

import * as React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { getErrorMessage } from '@/lib/utils';
import {
  Info,
  Trash2,
  Save,
  FileText,
  Database,
  TrendingUp,
  Sprout,
  Calendar,
  AlertCircle,
  AlertTriangle,
  RotateCcw,
  Printer,
  FolderOpen,
  Repeat,
  Lightbulb,
  Timer,
  Coins,
  Flame,
  Wallet,
} from 'lucide-react';
import { AnimatedNumber, Stagger, StaggerItem } from '@/components/shared/motion';
import {
  calculateCompounding,
  CompoundingInput,
  calculateTradingCompounding,
  TradingCompoundingInput,
  TradingPeriod,
  TRADING_MAX_PERIODS,
  TRADING_DAYS_PER_MONTH,
  TRADING_DAYS_PER_YEAR,
  groupTradingDetails,
  convertTradingRate,
} from '@/lib/compounding';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppUser } from '@/lib/types';
import { motion, AnimatePresence } from 'framer-motion';
import { useLanguage } from '@/lib/language-context';
import { parseFormattedNumber, formatNumberForInput as _formatNumberForInput } from '@/lib/format';
import { StepperInput } from '@/components/stepper-input';
import { ConfirmModal } from '@/components/confirm-modal';

// Local wrapper preserves the original max-fraction-digits (4) for this tab.
const formatNumberForInput = (num: number | string | undefined | null): string =>
  _formatNumberForInput(num, { maxFractionDigits: 4 });

interface CompoundingTabProps {
  user: AppUser | null;
  onSignInClick: () => void;
}

interface CompoundingPlan {
  id: string;
  title: string;
  initial_amount: number;
  contribution_amount: number;
  contribution_frequency: string;
  annual_return_rate: number;
  compounding_frequency: string;
  duration_years: number;
  duration_months: number;
  tax_rate: number;
  inflation_rate: number;
}

type CalcMode = 'trading' | 'standard';
type ContributionFrequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
type CompoundingFrequency = 'daily' | 'monthly' | 'quarterly' | 'yearly';
type Lang = 'id' | 'en';

interface TradingParams {
  target: string; // % per periode
  duration: string; // jumlah periode
  contribution: string; // Rp per periode
}

// ─── Nilai default ───
const DEFAULT_INITIAL_AMOUNT = '10,000,000';

const TRADING_DEFAULTS: Record<TradingPeriod, TradingParams> = {
  daily: { target: '1', duration: '20', contribution: '0' },
  monthly: { target: '5', duration: '12', contribution: '0' },
  yearly: { target: '20', duration: '10', contribution: '0' },
};

const LONG_TERM_DEFAULTS = {
  contribution: '1,000,000',
  contributionFrequency: 'monthly' as ContributionFrequency,
  annualReturn: '10',
  compoundingFrequency: 'monthly' as CompoundingFrequency,
  years: '10',
  months: '0',
  inflation: '4',
  tax: '0',
};

const BROKER_PRESETS: Record<string, { buy: string; sell: string }> = {
  stockbit: { buy: '0.15', sell: '0.25' },
  ajaib: { buy: '0.15', sell: '0.25' },
  ipot: { buy: '0.19', sell: '0.29' },
  custom: { buy: '0.20', sell: '0.30' },
  none: { buy: '0', sell: '0' },
};

// Kolom compounding_frequency di DB dipakai untuk menandai rencana trading per periode.
const TRADING_DB_FREQ: Record<TradingPeriod, string> = {
  daily: 'trading_daily',
  monthly: 'trading_monthly',
  yearly: 'trading_yearly',
};

const tradingPeriodFromDb = (freq: string): TradingPeriod | null => {
  const entry = (Object.entries(TRADING_DB_FREQ) as [TradingPeriod, string][]).find(([, v]) => v === freq);
  return entry ? entry[0] : null;
};

// ─── Teks per periode ───
const PERIOD_TEXT: Record<TradingPeriod, Record<Lang, { noun: string; plural: string; adj: string; short: string }>> = {
  daily: {
    id: { noun: 'Hari', plural: 'Hari', adj: 'Harian', short: 'H' },
    en: { noun: 'Day', plural: 'Days', adj: 'Daily', short: 'D' },
  },
  monthly: {
    id: { noun: 'Bulan', plural: 'Bulan', adj: 'Bulanan', short: 'B' },
    en: { noun: 'Month', plural: 'Months', adj: 'Monthly', short: 'M' },
  },
  yearly: {
    id: { noun: 'Tahun', plural: 'Tahun', adj: 'Tahunan', short: 'T' },
    en: { noun: 'Year', plural: 'Years', adj: 'Yearly', short: 'Y' },
  },
};

const TARGET_STEP: Record<TradingPeriod, number> = { daily: 0.1, monthly: 0.5, yearly: 1 };

const DURATION_PRESETS: Record<TradingPeriod, Array<{ value: number; id: string; en: string }>> = {
  daily: [
    { value: TRADING_DAYS_PER_MONTH, id: '1 bln', en: '1 mo' },
    { value: TRADING_DAYS_PER_MONTH * 3, id: '3 bln', en: '3 mo' },
    { value: TRADING_DAYS_PER_MONTH * 6, id: '6 bln', en: '6 mo' },
    { value: TRADING_DAYS_PER_YEAR, id: '1 thn', en: '1 yr' },
  ],
  monthly: [
    { value: 6, id: '6 bln', en: '6 mo' },
    { value: 12, id: '1 thn', en: '1 yr' },
    { value: 24, id: '2 thn', en: '2 yr' },
    { value: 60, id: '5 thn', en: '5 yr' },
  ],
  yearly: [
    { value: 5, id: '5 thn', en: '5 yr' },
    { value: 10, id: '10 thn', en: '10 yr' },
    { value: 20, id: '20 thn', en: '20 yr' },
    { value: 30, id: '30 thn', en: '30 yr' },
  ],
};

// ─── Parsing & langkah tombol −/+ ───
const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

// Persen dibaca dengan koma ATAU titik sebagai desimal (0,5 = 0.5).
const parsePercent = (s: string): number => {
  const n = parseFloat(String(s).replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};

const parseCount = (s: string): number => parseInt(String(s).replace(/[^0-9]/g, ''), 10) || 0;

const formatPercentInput = (value: number, language: Lang): string => {
  const str = String(Math.round(value * 100) / 100);
  return language === 'id' ? str.replace('.', ',') : str;
};

const stepPercent = (s: string, dir: 1 | -1, step: number, max: number, language: Lang): string =>
  formatPercentInput(clamp(Math.round((parsePercent(s) + dir * step) * 100) / 100, 0, max), language);

const stepCount = (s: string, dir: 1 | -1, min: number, max: number): string =>
  String(clamp(parseCount(s) + dir, min, max));

// Langkah nominal mengikuti besarnya angka: 10 juta → ±1 juta, 1,5 juta → ±100 ribu.
const moneyStep = (value: number) => (value < 1_000_000 ? 100_000 : Math.pow(10, Math.floor(Math.log10(value)) - 1));

const stepMoney = (s: string, dir: 1 | -1): string => {
  const value = parseFormattedNumber(s);
  const step = moneyStep(dir > 0 ? value : Math.max(0, value - 1));
  return formatNumberForInput(Math.max(0, Math.round((value + dir * step) / step) * step));
};

const sanitizeMoney = (s: string) => s.replace(/[^0-9.,]/g, '');
const sanitizePercent = (s: string) => s.replace(/[^0-9.,]/g, '');
const sanitizeCount = (s: string) => s.replace(/[^0-9]/g, '');

// ─── Komponen kecil ───
function Field({ label, htmlFor, children, hint }: { label: string; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={htmlFor} className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</label>
      {children}
      {hint}
    </div>
  );
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
  className = '',
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode }>;
  onChange: (value: T) => void;
  className?: string;
}) {
  return (
    <div className={`flex bg-input-bg border border-border-color p-1 rounded-xl text-[11px] font-extrabold select-none ${className}`}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={`flex-1 py-2 px-3 rounded-lg transition-all cursor-pointer text-center whitespace-nowrap ${
            value === opt.value ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const STAT_TONES = {
  emerald: { card: 'bg-emerald-500/5 border-emerald-500/20', label: 'text-emerald-400', value: 'text-emerald-400' },
  blue: { card: 'bg-blue-500/5 border-blue-500/20', label: 'text-blue-400', value: 'text-blue-400' },
  indigo: { card: 'bg-indigo-500/5 border-indigo-500/20', label: 'text-indigo-400', value: 'text-white' },
  rose: { card: 'bg-rose-500/5 border-rose-500/20', label: 'text-rose-400', value: 'text-white' },
  slate: { card: 'border-slate-200 dark:border-white/5', label: 'text-slate-500 dark:text-slate-400', value: 'text-white' },
} as const;

function StatCard({
  label,
  value,
  fullValue,
  sub,
  tone,
  amount,
  formatAmount,
}: {
  label: string;
  value: string;
  fullValue?: string;
  sub?: string;
  tone: keyof typeof STAT_TONES;
  /** Bila diisi, nilai ditampilkan sebagai angka berjalan (count-up) memakai `formatAmount`. */
  amount?: number;
  formatAmount?: (v: number) => string;
}) {
  const t = STAT_TONES[tone];
  return (
    <div className={`glass-card p-4 md:p-4.5 overflow-hidden ${t.card}`}>
      <span className={`text-[9px] font-bold uppercase tracking-widest block ${t.label}`}>{label}</span>
      <h3 className={`text-lg md:text-xl font-black mt-1 tracking-tight truncate ${t.value}`} title={fullValue ?? value}>
        {amount !== undefined && formatAmount ? <AnimatedNumber value={amount} format={formatAmount} fromZero /> : value}
      </h3>
      {sub && <p className="text-[10px] font-semibold text-slate-500 dark:text-slate-400 mt-0.5 truncate" title={sub}>{sub}</p>}
    </div>
  );
}

interface TableRow {
  key: string;
  label: string;
  sub?: string;
  start: number;
  deposit: number;
  profit: number;
  cost: number; // fee (trading) atau pajak (jangka panjang)
  end: number;
  real?: number;
  cumPct?: number;
}

export function CompoundingTab({ user }: CompoundingTabProps) {
  const { t, language } = useLanguage();
  const lang: Lang = language === 'id' ? 'id' : 'en';
  const L = React.useCallback((id: string, en: string) => (lang === 'id' ? id : en), [lang]);
  const fieldId = React.useId();

  // ─── Input state ───
  const [calcMode, setCalcMode] = React.useState<CalcMode>('trading');
  const [tradingPeriod, setTradingPeriod] = React.useState<TradingPeriod>('daily');
  const [tradingParams, setTradingParams] = React.useState<Record<TradingPeriod, TradingParams>>(TRADING_DEFAULTS);
  const [initialAmountStr, setInitialAmountStr] = React.useState(DEFAULT_INITIAL_AMOUNT);

  const [contributionAmountStr, setContributionAmountStr] = React.useState(LONG_TERM_DEFAULTS.contribution);
  const [contributionFrequency, setContributionFrequency] = React.useState<ContributionFrequency>(LONG_TERM_DEFAULTS.contributionFrequency);
  const [annualReturnRateStr, setAnnualReturnRateStr] = React.useState(LONG_TERM_DEFAULTS.annualReturn);
  const [compoundingFrequency, setCompoundingFrequency] = React.useState<CompoundingFrequency>(LONG_TERM_DEFAULTS.compoundingFrequency);
  const [durationYearsStr, setDurationYearsStr] = React.useState(LONG_TERM_DEFAULTS.years);
  const [durationMonthsStr, setDurationMonthsStr] = React.useState(LONG_TERM_DEFAULTS.months);
  const [inflationRateStr, setInflationRateStr] = React.useState(LONG_TERM_DEFAULTS.inflation);
  const [taxRateStr, setTaxRateStr] = React.useState(LONG_TERM_DEFAULTS.tax);

  const [brokerPreset, setBrokerPreset] = React.useState('stockbit');
  const [feeBeliStr, setFeeBeliStr] = React.useState(BROKER_PRESETS.stockbit.buy);
  const [feeJualStr, setFeeJualStr] = React.useState(BROKER_PRESETS.stockbit.sell);

  // ─── Simpan / muat rencana ───
  const [planTitle, setPlanTitle] = React.useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedPlans, setSavedPlans] = React.useState<CompoundingPlan[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = React.useState(false);
  const [planToDelete, setPlanToDelete] = React.useState<CompoundingPlan | null>(null);

  // ─── Tabel & grafik ───
  const [longTermTable, setLongTermTable] = React.useState<'yearly' | 'monthly'>('yearly');
  const [tradingTable, setTradingTable] = React.useState<'detail' | 'monthly' | 'yearly'>('detail');
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const chartRef = React.useRef<SVGSVGElement>(null);

  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const showToast = React.useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  }, []);

  const isTrading = calcMode === 'trading';
  const periodText = PERIOD_TEXT[tradingPeriod][lang];
  const current = tradingParams[tradingPeriod];
  const maxPeriods = TRADING_MAX_PERIODS[tradingPeriod];

  const updateTradingParam = (field: keyof TradingParams, value: string | ((prev: string) => string)) => {
    const period = tradingPeriod;
    setTradingParams(prev => ({
      ...prev,
      [period]: {
        ...prev[period],
        [field]: typeof value === 'function' ? value(prev[period][field]) : value,
      },
    }));
  };

  const handlePresetChange = (presetId: string) => {
    setBrokerPreset(presetId);
    const preset = BROKER_PRESETS[presetId];
    if (preset) {
      setFeeBeliStr(preset.buy);
      setFeeJualStr(preset.sell);
    }
  };

  const feeBeli = parsePercent(feeBeliStr);
  const feeJual = parsePercent(feeJualStr);
  const initialAmount = parseFormattedNumber(initialAmountStr);

  // ─── 1. Kalkulasi Investasi Jangka Panjang ───
  const input: CompoundingInput = React.useMemo(() => ({
    title: planTitle || 'Simulasi Compounding',
    initialAmount,
    contributionAmount: parseFormattedNumber(contributionAmountStr),
    contributionFrequency,
    annualReturnRate: parsePercent(annualReturnRateStr),
    compoundingFrequency,
    durationYears: clamp(parseCount(durationYearsStr), 0, 100),
    durationMonths: clamp(parseCount(durationMonthsStr), 0, 11),
    inflationRate: parsePercent(inflationRateStr),
    taxRate: clamp(parsePercent(taxRateStr), 0, 100),
  }), [
    planTitle, initialAmount, contributionAmountStr, contributionFrequency,
    annualReturnRateStr, compoundingFrequency, durationYearsStr,
    durationMonthsStr, inflationRateStr, taxRateStr
  ]);

  const results = React.useMemo(() => calculateCompounding(input), [input]);

  // ─── 2. Kalkulasi Rencana Trading (harian / bulanan / tahunan) ───
  const requestedPeriods = parseCount(current.duration);
  const tradingPeriods = clamp(requestedPeriods, 1, maxPeriods);

  const tradingInput: TradingCompoundingInput = React.useMemo(() => ({
    title: planTitle || 'Simulasi Trading',
    initialAmount,
    contributionAmount: parseFormattedNumber(current.contribution),
    returnRatePerPeriod: parsePercent(current.target),
    periods: tradingPeriods,
    feeBeli,
    feeJual,
  }), [planTitle, initialAmount, current.contribution, current.target, tradingPeriods, feeBeli, feeJual]);

  const tradingResults = React.useMemo(() => calculateTradingCompounding(tradingInput), [tradingInput]);

  const targetRate = parsePercent(current.target);
  const otherPeriods = (['daily', 'monthly', 'yearly'] as TradingPeriod[]).filter(p => p !== tradingPeriod);
  const yearlyEquivalent = convertTradingRate(targetRate, tradingPeriod, 'yearly');
  const isAggressive = yearlyEquivalent > 100;

  // ─── Format angka ───
  const SHORT_SUFFIXES: Array<[number, string, string]> = [
    [1e24, 'Septiliun', 'Septillion'],
    [1e21, 'Sekstiliun', 'Sextillion'],
    [1e18, 'Kuintiliun', 'Quintillion'],
    [1e15, 'Kuadriliun', 'Quadrillion'],
    [1e12, 'Triliun', 'Trillion'],
    [1e9, 'Miliar', 'Billion'],
    [1e6, 'Juta', 'Million'],
  ];
  const numberLocale = lang === 'id' ? 'id-ID' : 'en-US';

  const shorten = (absVal: number): { value: number; suffix: string } => {
    for (const [threshold, idName, enName] of SHORT_SUFFIXES) {
      if (absVal >= threshold) return { value: absVal / threshold, suffix: ` ${lang === 'id' ? idName : enName}` };
    }
    return { value: absVal, suffix: '' };
  };

  const formatIDR = (value: number, isShort = false) => {
    const absVal = Math.abs(value);
    const sign = value < 0 ? '-' : '';
    if (isShort) {
      const { value: v, suffix } = shorten(absVal);
      if (suffix) {
        return `${sign}Rp ${new Intl.NumberFormat(numberLocale, { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(v)}${suffix}`;
      }
    }
    return `${sign}Rp ${new Intl.NumberFormat(numberLocale, { maximumFractionDigits: 0 }).format(absVal)}`;
  };

  const formatPct = (val: number, isShort = true, signed = true) => {
    const absVal = Math.abs(val);
    const sign = val < 0 ? '-' : signed ? '+' : '';
    const { value: v, suffix } = isShort ? shorten(absVal) : { value: absVal, suffix: '' };
    return `${sign}${new Intl.NumberFormat(numberLocale, { minimumFractionDigits: suffix ? 2 : 0, maximumFractionDigits: 2 }).format(v)}${suffix}%`;
  };

  // ─── Rencana tersimpan ───
  const fetchSavedPlans = React.useCallback(async () => {
    setIsLoadingPlans(true);
    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { data, error } = await supabase
          .from('compounding_plans')
          .select('*')
          .order('created_at', { ascending: false });
        if (error) throw error;
        setSavedPlans(data || []);
      } catch (err: unknown) {
        console.error('Error fetching compounding plans:', getErrorMessage(err));
        showToast(L('Gagal memuat rencana dari cloud database', 'Failed to load plans from the cloud database'), 'error');
      } finally {
        setIsLoadingPlans(false);
      }
    } else {
      const stored = localStorage.getItem('nunnn_stock_compounding_plans');
      try {
        setSavedPlans(stored ? JSON.parse(stored) : []);
      } catch {
        setSavedPlans([]);
      }
      setIsLoadingPlans(false);
    }
  }, [user, showToast, L]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchSavedPlans();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSavedPlans]);

  const suggestPlanTitle = () => {
    if (isTrading) {
      return `${L('Trading', 'Trading')} ${periodText.adj} ${formatPercentInput(targetRate, lang)}% × ${tradingPeriods} ${periodText.plural}`;
    }
    const years = input.durationYears + (input.durationMonths ? ` ${L('thn', 'yr')} ${input.durationMonths} ${L('bln', 'mo')}` : ` ${L('Tahun', 'Years')}`);
    return `${L('Investasi', 'Investment')} ${years} @${formatPercentInput(input.annualReturnRate, lang)}%`;
  };

  const openSaveModal = () => {
    setPlanTitle(suggestPlanTitle());
    setIsSaveModalOpen(true);
  };

  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = planTitle.trim();
    if (!title) {
      showToast(L('Masukkan judul rencana terlebih dahulu', 'Enter a plan title first'), 'error');
      return;
    }
    setIsSaving(true);

    // Rencana trading memakai ulang kolom tabel: periode → contribution_frequency,
    // jumlah periode → duration_months, fee beli/jual → tax_rate/inflation_rate.
    const planData = isTrading
      ? {
          title,
          initial_amount: initialAmount,
          contribution_amount: parseFormattedNumber(current.contribution),
          contribution_frequency: tradingPeriod,
          annual_return_rate: targetRate,
          compounding_frequency: TRADING_DB_FREQ[tradingPeriod],
          duration_years: 0,
          duration_months: tradingPeriods,
          inflation_rate: feeJual,
          tax_rate: feeBeli,
        }
      : {
          title,
          initial_amount: initialAmount,
          contribution_amount: input.contributionAmount,
          contribution_frequency: contributionFrequency,
          annual_return_rate: input.annualReturnRate,
          compounding_frequency: compoundingFrequency,
          duration_years: input.durationYears,
          duration_months: input.durationMonths,
          inflation_rate: input.inflationRate,
          tax_rate: input.taxRate,
        };

    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { error } = await supabase
          .from('compounding_plans')
          .insert({ ...planData, user_id: user.id });
        if (error) throw error;
        showToast(L(`Rencana "${title}" berhasil disimpan ke cloud!`, `Plan "${title}" saved to the cloud!`));
        fetchSavedPlans();
        setIsSaveModalOpen(false);
      } catch (err: unknown) {
        console.error('Error saving compounding plan:', getErrorMessage(err));
        showToast(L(`Gagal menyimpan: ${getErrorMessage(err)}`, `Failed to save: ${getErrorMessage(err)}`), 'error');
      } finally {
        setIsSaving(false);
      }
    } else {
      const newPlan = { id: crypto.randomUUID(), ...planData, created_at: new Date().toISOString() };
      const updated = [newPlan, ...savedPlans];
      localStorage.setItem('nunnn_stock_compounding_plans', JSON.stringify(updated));
      setSavedPlans(updated);
      showToast(L(`Rencana "${title}" berhasil disimpan secara lokal!`, `Plan "${title}" saved locally!`));
      setIsSaveModalOpen(false);
      setIsSaving(false);
    }
  };

  const executeDeletePlan = async () => {
    const plan = planToDelete;
    if (!plan) return;
    setPlanToDelete(null);
    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { error } = await supabase.from('compounding_plans').delete().eq('id', plan.id);
        if (error) throw error;
        showToast(L(`Rencana "${plan.title}" berhasil dihapus.`, `Plan "${plan.title}" deleted.`));
        fetchSavedPlans();
      } catch (err: unknown) {
        console.error('Error deleting plan:', getErrorMessage(err));
        showToast(L('Gagal menghapus rencana.', 'Failed to delete the plan.'), 'error');
      }
    } else {
      const updated = savedPlans.filter(p => p.id !== plan.id);
      localStorage.setItem('nunnn_stock_compounding_plans', JSON.stringify(updated));
      setSavedPlans(updated);
      showToast(L(`Rencana "${plan.title}" berhasil dihapus.`, `Plan "${plan.title}" deleted.`));
    }
  };

  const applyFees = (buy: number, sell: number) => {
    const match = Object.entries(BROKER_PRESETS).find(
      ([id, p]) => id !== 'custom' && parseFloat(p.buy) === buy && parseFloat(p.sell) === sell
    );
    setBrokerPreset(match ? match[0] : 'custom');
    setFeeBeliStr(String(buy));
    setFeeJualStr(String(sell));
  };

  const handleLoadPlan = (plan: CompoundingPlan) => {
    const period = tradingPeriodFromDb(plan.compounding_frequency);
    setInitialAmountStr(formatNumberForInput(plan.initial_amount));
    if (period) {
      setCalcMode('trading');
      setTradingPeriod(period);
      setTradingParams(prev => ({
        ...prev,
        [period]: {
          target: formatPercentInput(Number(plan.annual_return_rate), lang),
          duration: String(plan.duration_months),
          contribution: formatNumberForInput(plan.contribution_amount),
        },
      }));
      applyFees(Number(plan.tax_rate) || 0, Number(plan.inflation_rate) || 0);
    } else {
      setCalcMode('standard');
      setContributionAmountStr(formatNumberForInput(plan.contribution_amount));
      setContributionFrequency(plan.contribution_frequency as ContributionFrequency);
      setAnnualReturnRateStr(formatPercentInput(Number(plan.annual_return_rate), lang));
      setCompoundingFrequency(plan.compounding_frequency as CompoundingFrequency);
      setDurationYearsStr(String(plan.duration_years));
      setDurationMonthsStr(String(plan.duration_months));
      setInflationRateStr(formatPercentInput(Number(plan.inflation_rate), lang));
      setTaxRateStr(formatPercentInput(Number(plan.tax_rate), lang));
    }
    showToast(L(`Rencana "${plan.title}" berhasil dimuat.`, `Plan "${plan.title}" loaded.`));
    document.getElementById(`${fieldId}-form`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  const handleReset = () => {
    setInitialAmountStr(DEFAULT_INITIAL_AMOUNT);
    if (isTrading) {
      setTradingParams(prev => ({ ...prev, [tradingPeriod]: TRADING_DEFAULTS[tradingPeriod] }));
      handlePresetChange('stockbit');
    } else {
      setContributionAmountStr(LONG_TERM_DEFAULTS.contribution);
      setContributionFrequency(LONG_TERM_DEFAULTS.contributionFrequency);
      setAnnualReturnRateStr(LONG_TERM_DEFAULTS.annualReturn);
      setCompoundingFrequency(LONG_TERM_DEFAULTS.compoundingFrequency);
      setDurationYearsStr(LONG_TERM_DEFAULTS.years);
      setDurationMonthsStr(LONG_TERM_DEFAULTS.months);
      setInflationRateStr(LONG_TERM_DEFAULTS.inflation);
      setTaxRateStr(LONG_TERM_DEFAULTS.tax);
    }
  };

  const describePlan = (plan: CompoundingPlan): { kind: string; detail: string } => {
    const period = tradingPeriodFromDb(plan.compounding_frequency);
    if (period) {
      const pt = PERIOD_TEXT[period][lang];
      return {
        kind: `${L('Trading', 'Trading')} ${pt.adj}`,
        detail: `${L('Target', 'Target')} ${formatPercentInput(Number(plan.annual_return_rate), lang)}%/${pt.noun.toLowerCase()} • ${plan.duration_months} ${pt.plural}${
          Number(plan.contribution_amount) > 0 ? ` • +${formatIDR(Number(plan.contribution_amount), true)}/${pt.noun.toLowerCase()}` : ''
        }`,
      };
    }
    const freqLabel: Record<string, string> = {
      daily: L('hari', 'day'), weekly: L('minggu', 'week'), monthly: L('bulan', 'month'), yearly: L('tahun', 'year'),
    };
    return {
      kind: L('Investasi Jangka Panjang', 'Long-term Investment'),
      detail: `Return ${formatPercentInput(Number(plan.annual_return_rate), lang)}%/${L('thn', 'yr')} • ${plan.duration_years} ${L('thn', 'yr')}${
        Number(plan.duration_months) > 0 ? ` ${plan.duration_months} ${L('bln', 'mo')}` : ''
      }${Number(plan.contribution_amount) > 0 ? ` • +${formatIDR(Number(plan.contribution_amount), true)}/${freqLabel[plan.contribution_frequency] ?? plan.contribution_frequency}` : ''}`,
    };
  };

  // ─── Data grafik (dimulai dari titik modal awal) ───
  const chartData = React.useMemo(() => {
    const start = {
      label: L('Awal', 'Start'),
      short: '0',
      endingBalance: initialAmount,
      realEndingBalance: initialAmount,
      cumulativeDeposits: initialAmount,
      cumulativeInterest: 0,
    };

    if (isTrading) {
      return [start, ...tradingResults.details.map(d => ({
        label: `${periodText.noun} ${d.period}`,
        short: `${periodText.short}${d.period}`,
        endingBalance: d.endingBalance,
        realEndingBalance: d.endingBalance,
        cumulativeDeposits: d.cumulativeDeposits,
        cumulativeInterest: d.endingBalance - d.cumulativeDeposits,
      }))];
    }

    const yearText = PERIOD_TEXT.yearly[lang];
    const monthText = PERIOD_TEXT.monthly[lang];
    if (results.monthlyDetails.length > 36) {
      return [start, ...results.yearlySummaries.map(y => ({
        label: `${yearText.noun} ${y.year}`,
        short: `${yearText.short}${y.year}`,
        endingBalance: y.endingBalance,
        realEndingBalance: y.realEndingBalance,
        cumulativeDeposits: y.cumulativeDeposits,
        cumulativeInterest: y.endingBalance - y.cumulativeDeposits,
      }))];
    }
    return [start, ...results.monthlyDetails.map(m => ({
      label: `${monthText.noun} ${m.period}`,
      short: `${monthText.short}${m.period}`,
      endingBalance: m.endingBalance,
      realEndingBalance: m.realEndingBalance,
      cumulativeDeposits: m.cumulativeDeposits,
      cumulativeInterest: m.endingBalance - m.cumulativeDeposits,
    }))];
  }, [isTrading, results, tradingResults, initialAmount, periodText, lang, L]);

  // SVG Chart Geometry
  const svgWidth = 800;
  const svgHeight = 300;
  const chartMargin = { top: 20, right: 0, bottom: 30, left: 0 };
  const plotWidth = svgWidth - chartMargin.left - chartMargin.right;
  const plotHeight = svgHeight - chartMargin.top - chartMargin.bottom;

  const maxY = React.useMemo(() => {
    const maxVal = Math.max(0, ...chartData.map(d => Math.max(d.endingBalance, d.cumulativeDeposits)));
    return maxVal > 0 ? maxVal * 1.05 : 1;
  }, [chartData]);
  const hasChartData = chartData.some(d => d.endingBalance > 0 || d.cumulativeDeposits > 0);

  const getX = (index: number) =>
    chartData.length <= 1 ? chartMargin.left : chartMargin.left + (index / (chartData.length - 1)) * plotWidth;
  const getY = (val: number) => svgHeight - chartMargin.bottom - (Math.max(0, val) / maxY) * plotHeight;

  const linePath = (pick: (d: (typeof chartData)[number]) => number) =>
    chartData.length === 0 ? '' : `M ${chartData.map((d, i) => `${getX(i)},${getY(pick(d))}`).join(' L ')}`;
  const areaPath = (pick: (d: (typeof chartData)[number]) => number) =>
    chartData.length === 0 ? '' : `${linePath(pick)} L ${getX(chartData.length - 1)},${getY(0)} L ${getX(0)},${getY(0)} Z`;

  const tickEvery = Math.max(1, Math.ceil(chartData.length / 8));
  const activeIndex = hoveredIndex !== null && hoveredIndex < chartData.length ? hoveredIndex : null;

  // Pointer (mouse & sentuh) → titik data terdekat
  const handlePointerMove = (e: React.PointerEvent<SVGSVGElement>) => {
    if (!chartRef.current || chartData.length === 0) return;
    const rect = chartRef.current.getBoundingClientRect();
    const svgX = (e.clientX - rect.left) * (svgWidth / rect.width) - chartMargin.left;
    if (svgX < 0 || svgX > plotWidth) {
      setHoveredIndex(null);
      return;
    }
    setHoveredIndex(clamp(Math.round((svgX / plotWidth) * (chartData.length - 1)), 0, chartData.length - 1));
  };

  // ─── Baris tabel ───
  const tradingTableOptions: Array<{ value: 'detail' | 'monthly' | 'yearly'; label: string }> = [
    { value: 'detail', label: `${L('Per', 'Per')} ${periodText.noun}` },
    ...(tradingPeriod === 'daily' ? [{ value: 'monthly' as const, label: L('Rekap Bulanan', 'Monthly Recap') }] : []),
    ...(tradingPeriod !== 'yearly' ? [{ value: 'yearly' as const, label: L('Rekap Tahunan', 'Yearly Recap') }] : []),
  ];
  const effectiveTradingTable = tradingTableOptions.some(o => o.value === tradingTable) ? tradingTable : 'detail';

  const tableRows: TableRow[] = React.useMemo(() => {
    if (isTrading) {
      if (effectiveTradingTable === 'detail') {
        return tradingResults.details.map(d => ({
          key: `p${d.period}`,
          label: `${periodText.noun} ${d.period}`,
          start: d.startingBalance,
          deposit: d.deposit,
          profit: d.interestEarned,
          cost: d.taxDeducted,
          end: d.endingBalance,
          cumPct: d.cumulativeDeposits > 0 ? ((d.endingBalance - d.cumulativeDeposits) / d.cumulativeDeposits) * 100 : 0,
        }));
      }
      const groupSize = effectiveTradingTable === 'monthly'
        ? TRADING_DAYS_PER_MONTH
        : tradingPeriod === 'daily' ? TRADING_DAYS_PER_YEAR : 12;
      const groupText = PERIOD_TEXT[effectiveTradingTable][lang];
      return groupTradingDetails(tradingResults.details, groupSize).map(g => ({
        key: `g${g.group}`,
        label: `${groupText.noun} ${g.group}`,
        sub: `${periodText.noun} ${g.fromPeriod}–${g.toPeriod}`,
        start: g.startingBalance,
        deposit: g.totalDeposits,
        profit: g.totalProfit,
        cost: g.totalFees,
        end: g.endingBalance,
        cumPct: g.cumulativeReturnPct,
      }));
    }

    const withReturn = (end: number, deposits: number) => (deposits > 0 ? ((end - deposits) / deposits) * 100 : 0);
    if (longTermTable === 'yearly') {
      return results.yearlySummaries.map(y => ({
        key: `y${y.year}`,
        label: `${PERIOD_TEXT.yearly[lang].noun} ${y.year}`,
        start: y.startingBalance,
        deposit: y.totalDeposits,
        profit: y.totalInterestEarned,
        cost: y.totalTaxDeducted,
        end: y.endingBalance,
        real: y.realEndingBalance,
        cumPct: withReturn(y.endingBalance, y.cumulativeDeposits),
      }));
    }
    return results.monthlyDetails.map(m => ({
      key: `m${m.period}`,
      label: `${PERIOD_TEXT.monthly[lang].noun} ${m.period}`,
      sub: `${PERIOD_TEXT.yearly[lang].short}${m.year} · ${L('Bln', 'Mo')} ${m.month}`,
      start: m.startingBalance,
      deposit: m.deposit,
      profit: m.interestEarned,
      cost: m.taxDeducted,
      end: m.endingBalance,
      real: m.realEndingBalance,
      cumPct: withReturn(m.endingBalance, m.cumulativeDeposits),
    }));
  }, [isTrading, effectiveTradingTable, tradingResults, tradingPeriod, periodText, lang, longTermTable, results, L]);

  const showDepositCol = isTrading ? parseFormattedNumber(current.contribution) > 0 : true;
  const showCostCol = isTrading ? feeBeli > 0 || feeJual > 0 : input.taxRate > 0;
  const showRealCol = !isTrading && input.inflationRate > 0;

  // ─── Ringkasan ───
  const tradingProfit = tradingResults.nominalEndingBalance - tradingResults.totalDeposits;
  const tradingReturnPct = tradingResults.totalDeposits > 0 ? (tradingProfit / tradingResults.totalDeposits) * 100 : 0;
  const longTermProfit = results.nominalEndingBalance - results.totalDeposits;
  const longTermReturnPct = results.totalDeposits > 0 ? (longTermProfit / results.totalDeposits) * 100 : 0;

  // ─── Wawasan dinamis dari hasil hitungan ───
  const shortIDR = (v: number) => formatIDR(v, true);
  const doubling = (ratePct: number) => (ratePct > 0 ? Math.log(2) / Math.log(1 + ratePct / 100) : null);
  const insights: Array<{ key: string; icon: typeof Lightbulb; tone: string; text: React.ReactNode }> = [];
  if (isTrading) {
    const netRate = ((1 + targetRate / 100) * (1 - (feeBeli + feeJual) / 100) - 1) * 100;
    const n = doubling(netRate);
    const grossProfit = tradingProfit + tradingResults.totalTaxDeducted;
    if (n !== null) {
      insights.push({
        key: 'double',
        icon: Timer,
        tone: 'text-emerald-400',
        text: L(
          `Dengan target ${formatPercentInput(targetRate, lang)}% per ${periodText.noun.toLowerCase()} (bersih fee ±${formatPct(netRate, true, false)}), modal berlipat 2 kira-kira tiap ${n < 10 ? n.toFixed(1) : Math.round(n)} ${periodText.plural.toLowerCase()}.`,
          `At ${formatPercentInput(targetRate, lang)}% per ${periodText.noun.toLowerCase()} (net of fees ≈${formatPct(netRate, true, false)}), capital doubles roughly every ${n < 10 ? n.toFixed(1) : Math.round(n)} ${periodText.plural.toLowerCase()}.`
        ),
      });
    } else if (targetRate > 0) {
      insights.push({ key: 'double', icon: Flame, tone: 'text-bearish-red', text: L('Fee broker lebih besar dari target profit per periode: modal justru menyusut.', 'Broker fees exceed the per-period profit target: capital shrinks.') });
    }
    if (tradingResults.nominalEndingBalance > 0 && tradingProfit > 0) {
      insights.push({
        key: 'share',
        icon: Coins,
        tone: 'text-sky-400',
        text: L(
          `Profit menyumbang ${formatPct((tradingProfit / tradingResults.nominalEndingBalance) * 100, true, false)} dari modal akhir; sisanya dana yang kamu setor.`,
          `Profit makes up ${formatPct((tradingProfit / tradingResults.nominalEndingBalance) * 100, true, false)} of the ending capital; the rest is money you deposited.`
        ),
      });
    }
    if (tradingResults.totalTaxDeducted > 0 && grossProfit > 0) {
      insights.push({
        key: 'fee',
        icon: Flame,
        tone: 'text-amber-400',
        text: L(
          `Fee broker memakan ${formatIDR(tradingResults.totalTaxDeducted, true)}, yaitu ${formatPct((tradingResults.totalTaxDeducted / grossProfit) * 100, true, false)} dari profit kotor. Makin sering bertransaksi, makin besar porsinya.`,
          `Broker fees eat ${formatIDR(tradingResults.totalTaxDeducted, true)}, i.e. ${formatPct((tradingResults.totalTaxDeducted / grossProfit) * 100, true, false)} of gross profit. The more often you trade, the bigger the share.`
        ),
      });
    }
    insights.push({
      key: 'year',
      icon: Lightbulb,
      tone: isAggressive ? 'text-bearish-red' : 'text-slate-400',
      text: L(
        `Target ini setara ${formatPct(yearlyEquivalent, true, false)} per tahun${isAggressive ? ' — sangat jarang bisa dipertahankan konsisten, siapkan skenario rugi.' : '.'}`,
        `This target equals ${formatPct(yearlyEquivalent, true, false)} per year${isAggressive ? ' — rarely sustainable consistently; plan for losing streaks.' : '.'}`
      ),
    });
  } else {
    const n = doubling(input.annualReturnRate * (1 - input.taxRate / 100));
    if (n !== null) {
      insights.push({
        key: 'double',
        icon: Timer,
        tone: 'text-emerald-400',
        text: L(
          `Pada return ${formatPercentInput(input.annualReturnRate, lang)}%/tahun${input.taxRate > 0 ? ' setelah pajak' : ''}, dana berlipat 2 kira-kira tiap ${n.toFixed(1)} tahun.`,
          `At ${formatPercentInput(input.annualReturnRate, lang)}%/yr${input.taxRate > 0 ? ' after tax' : ''}, money doubles roughly every ${n.toFixed(1)} years.`
        ),
      });
    }
    if (results.nominalEndingBalance > 0 && results.totalInterestEarned > 0) {
      insights.push({
        key: 'share',
        icon: Coins,
        tone: 'text-sky-400',
        text: L(
          `Bunga majemuk menyumbang ${formatPct((longTermProfit / results.nominalEndingBalance) * 100, true, false)} dari saldo akhir; sisanya setoran kamu.`,
          `Compound growth makes up ${formatPct((longTermProfit / results.nominalEndingBalance) * 100, true, false)} of the ending balance; the rest is your deposits.`
        ),
      });
    }
    if (input.inflationRate > 0 && results.nominalEndingBalance > results.realEndingBalance) {
      insights.push({
        key: 'inflation',
        icon: Flame,
        tone: 'text-amber-400',
        text: L(
          `Inflasi ${formatPercentInput(input.inflationRate, lang)}%/tahun menggerus daya beli ${formatIDR(results.nominalEndingBalance - results.realEndingBalance, true)}: saldo akhir setara ${formatIDR(results.realEndingBalance, true)} uang hari ini.`,
          `${formatPercentInput(input.inflationRate, lang)}%/yr inflation erodes ${formatIDR(results.nominalEndingBalance - results.realEndingBalance, true)} of purchasing power: the ending balance equals ${formatIDR(results.realEndingBalance, true)} in today's money.`
        ),
      });
    }
    if (results.nominalEndingBalance > 0 && input.annualReturnRate > 0) {
      insights.push({
        key: 'income',
        icon: Wallet,
        tone: 'text-emerald-400',
        text: L(
          `Bila saldo akhir tetap diinvestasikan pada return yang sama, hasilnya sekitar ${formatIDR((results.nominalEndingBalance * input.annualReturnRate) / 100 / 12, true)} per bulan (sebelum pajak).`,
          `If the ending balance stays invested at the same return, it yields about ${formatIDR((results.nominalEndingBalance * input.annualReturnRate) / 100 / 12, true)} per month (before tax).`
        ),
      });
    }
  }

  const moneyStepperProps = (value: string, setValue: (updater: (prev: string) => string) => void, label: string) => ({
    type: 'text' as const,
    inputMode: 'numeric' as const,
    value,
    onStep: (dir: 1 | -1) => setValue(prev => stepMoney(prev, dir)),
    canDecrement: parseFormattedNumber(value) > 0,
    decrementLabel: `${t('calculator.decrease')} ${label}`,
    incrementLabel: `${t('calculator.increase')} ${label}`,
    placeholder: '0',
    inputClassName: 'font-extrabold text-white',
  });

  const percentSuffix = <span className="flex items-center pr-1 text-xs text-slate-500">%</span>;

  return (
    <div className="space-y-6 md:space-y-8 animate-fadeIn print-page font-sans">

      {/* Global CSS injected specifically to optimize printing and hide sidebar layout */}
      <style dangerouslySetInnerHTML={{__html: `
        @media print {
          header, aside, .no-print, button, select, input {
            display: none !important;
          }
          main {
            padding: 0 !important;
            margin: 0 !important;
            box-shadow: none !important;
          }
          .print-full-width {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            border: none !important;
          }
          .glass-card {
            background: transparent !important;
            border: none !important;
            box-shadow: none !important;
            padding: 0 !important;
          }
          body {
            background-color: white !important;
            color: black !important;
          }
          h1, h2, h3, h4, th, td, p, span {
            color: black !important;
          }
          .overflow-y-auto, .overflow-x-auto {
            max-height: none !important;
            overflow: visible !important;
            height: auto !important;
          }
          table {
            border-collapse: collapse !important;
            width: 100% !important;
          }
          tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          thead {
            display: table-header-group !important;
          }
        }
      `}} />

      {/* Main Header Banner */}
      <PageHeader
        className="no-print"
        icon={Sprout}
        eyebrow={L('Simulasi pertumbuhan compounding', 'Compounding growth simulation')}
        title={t('compounding.title')}
        description={t('compounding.desc')}
      />

      {/* Database Tip Alert */}
      {!isSupabaseConfigured && (
        <div className="p-4.5 rounded-2xl bg-emerald-500/5 border border-emerald-500/20 text-slate-600 dark:text-slate-300 text-xs flex gap-3 shadow-sm no-print">
          <Info className="h-5 w-5 text-emerald-400 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800 dark:text-white">
              {L('Tips Mode Uji Coba:', 'Trial Mode Tips:')}
            </span>
            <p className="mt-1">
              {L(
                'Aplikasi belum terhubung dengan database PostgreSQL Supabase. Penyimpanan rencana compounding akan dialihkan menggunakan simulasi lokal (localStorage browser). Anda tetap dapat menggunakan seluruh fitur secara penuh.',
                'The application is not connected to the Supabase PostgreSQL database yet. Compounding plan storage will fall back to local browser storage (localStorage). You can still use all features completely.'
              )}
            </p>
          </div>
        </div>
      )}

      {/* Mode Selector */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 no-print">
        <Segmented<CalcMode>
          value={calcMode}
          onChange={(mode) => { setCalcMode(mode); setHoveredIndex(null); }}
          className="w-full sm:max-w-md"
          options={[
            { value: 'trading', label: t('compounding.modeTrading') },
            { value: 'standard', label: t('compounding.modeLongTerm') },
          ]}
        />
        {isTrading && (
          <Segmented<TradingPeriod>
            value={tradingPeriod}
            onChange={(p) => { setTradingPeriod(p); setHoveredIndex(null); }}
            className="w-full sm:w-auto"
            options={(['daily', 'monthly', 'yearly'] as TradingPeriod[]).map(p => ({ value: p, label: PERIOD_TEXT[p][lang].adj }))}
          />
        )}
      </div>

      {/* Parameter Form */}
      <div id={`${fieldId}-form`} className="glass-card p-4 md:p-6 space-y-5 no-print w-full scroll-mt-20 md:scroll-mt-6">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/50 dark:border-white/5 pb-3">
          <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <Calendar className="h-4.5 w-4.5 text-emerald-400" />
            {t('compounding.inputHeader')}
            <span className="normal-case tracking-normal text-emerald-400">
              · {isTrading ? `${t('compounding.modeTrading')} ${periodText.adj}` : t('compounding.modeLongTerm')}
            </span>
          </h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleReset}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-white/10 hover:border-emerald-500/40 bg-white/[0.03] hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 text-[11px] font-bold transition-all cursor-pointer"
              title={L('Kembalikan nilai contoh', 'Restore example values')}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Reset
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="hidden sm:flex items-center gap-1.5 py-1.5 px-3 rounded-lg border border-white/10 hover:border-emerald-500/40 bg-white/[0.03] hover:bg-emerald-500/10 text-slate-400 hover:text-emerald-400 text-[11px] font-bold transition-all cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              {t('compounding.printPdf')}
            </button>
            <button
              type="button"
              onClick={openSaveModal}
              className="flex items-center gap-1.5 py-1.5 px-3.5 rounded-lg bg-emerald-500 hover:bg-emerald-600 text-white text-[11px] font-bold transition-all cursor-pointer shadow-md"
            >
              <Save className="h-3.5 w-3.5" />
              {t('compounding.savePlan')}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 items-start">
          {/* Modal Awal (dipakai kedua mode) */}
          <Field label={L('Modal Awal (Rp)', 'Initial Capital (Rp)')} htmlFor={`${fieldId}-initial`}>
            <StepperInput
              id={`${fieldId}-initial`}
              {...moneyStepperProps(initialAmountStr, (u) => setInitialAmountStr(u), L('Modal Awal', 'Initial Capital'))}
              onChange={(e) => setInitialAmountStr(sanitizeMoney(e.target.value))}
              onBlur={() => initialAmountStr && setInitialAmountStr(formatNumberForInput(initialAmountStr))}
            />
          </Field>

          {isTrading ? (
            <>
              {/* Target Profit per periode */}
              <Field
                label={`${L('Target Profit', 'Target Profit')} / ${periodText.noun} (%)`}
                htmlFor={`${fieldId}-target`}
                hint={
                  <div className="space-y-1">
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      {otherPeriods.map((p, i) => (
                        <span key={p}>
                          {i > 0 && ' · '}≈{' '}
                          <strong className="text-slate-300">{formatPct(convertTradingRate(targetRate, tradingPeriod, p), true, false)}</strong>
                          /{PERIOD_TEXT[p][lang].noun.toLowerCase()}
                        </span>
                      ))}{' '}
                      <span className="text-slate-600">({L('majemuk, sebelum fee', 'compounded, before fees')})</span>
                    </p>
                    {isAggressive && (
                      <p className="flex items-start gap-1 text-[10px] font-semibold text-amber-400 leading-relaxed">
                        <AlertTriangle className="h-3 w-3 shrink-0 mt-0.5" />
                        {L('Setara lebih dari 100% per tahun. Target ini sangat agresif.', 'Equivalent to more than 100% per year. This target is very aggressive.')}
                      </p>
                    )}
                  </div>
                }
              >
                <StepperInput
                  id={`${fieldId}-target`}
                  type="text"
                  inputMode="decimal"
                  value={current.target}
                  onChange={(e) => updateTradingParam('target', sanitizePercent(e.target.value))}
                  onStep={(dir) => updateTradingParam('target', prev => stepPercent(prev, dir, TARGET_STEP[tradingPeriod], 1000, lang))}
                  canDecrement={targetRate > 0}
                  decrementLabel={`${t('calculator.decrease')} Target`}
                  incrementLabel={`${t('calculator.increase')} Target`}
                  inputClassName="font-bold text-white"
                  adornment={percentSuffix}
                />
              </Field>

              {/* Durasi */}
              <Field
                label={`${L('Durasi', 'Duration')} (${periodText.plural})`}
                htmlFor={`${fieldId}-duration`}
                hint={
                  <div className="space-y-1">
                    <div className="flex flex-wrap gap-1.5">
                      {DURATION_PRESETS[tradingPeriod].map(preset => (
                        <button
                          key={preset.value}
                          type="button"
                          onClick={() => updateTradingParam('duration', String(preset.value))}
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold transition-colors cursor-pointer ${
                            tradingPeriods === preset.value
                              ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-400'
                              : 'border-white/10 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/40'
                          }`}
                        >
                          {preset[lang]}
                        </button>
                      ))}
                    </div>
                    {requestedPeriods > maxPeriods && (
                      <p className="text-[10px] font-semibold text-amber-400">
                        {L(`Maksimal ${maxPeriods} ${periodText.plural}; simulasi dibatasi.`, `Maximum ${maxPeriods} ${periodText.plural}; the simulation is capped.`)}
                      </p>
                    )}
                    {tradingPeriod === 'daily' && (
                      <p className="text-[10px] text-slate-500">
                        {L(`Asumsi ${TRADING_DAYS_PER_MONTH} hari bursa per bulan, ${TRADING_DAYS_PER_YEAR} per tahun.`, `Assumes ${TRADING_DAYS_PER_MONTH} trading days per month, ${TRADING_DAYS_PER_YEAR} per year.`)}
                      </p>
                    )}
                  </div>
                }
              >
                <StepperInput
                  id={`${fieldId}-duration`}
                  type="text"
                  inputMode="numeric"
                  value={current.duration}
                  onChange={(e) => updateTradingParam('duration', sanitizeCount(e.target.value))}
                  onStep={(dir) => updateTradingParam('duration', prev => stepCount(prev, dir, 1, maxPeriods))}
                  canDecrement={tradingPeriods > 1}
                  canIncrement={tradingPeriods < maxPeriods}
                  decrementLabel={`${t('calculator.decrease')} ${L('Durasi', 'Duration')}`}
                  incrementLabel={`${t('calculator.increase')} ${L('Durasi', 'Duration')}`}
                  inputClassName="font-bold text-white"
                  adornment={<span className="flex items-center pr-1 text-[10px] font-semibold text-slate-500">{periodText.plural}</span>}
                />
              </Field>

              {/* Setoran Tambahan per periode */}
              <Field label={`${L('Setoran Tambahan', 'Additional Deposit')} / ${periodText.noun} (Rp)`} htmlFor={`${fieldId}-contribution`}>
                <StepperInput
                  id={`${fieldId}-contribution`}
                  {...moneyStepperProps(current.contribution, (u) => updateTradingParam('contribution', u), L('Setoran', 'Deposit'))}
                  onChange={(e) => updateTradingParam('contribution', sanitizeMoney(e.target.value))}
                  onBlur={() => current.contribution && updateTradingParam('contribution', formatNumberForInput(current.contribution))}
                />
              </Field>

              {/* Broker Fee */}
              <Field
                label={L('Broker Fee (per transaksi)', 'Broker Fee (per trade)')}
                htmlFor={`${fieldId}-broker`}
                hint={
                  <p className="text-[10px] text-slate-500 leading-relaxed">
                    {L(`Dipotong 1× beli + 1× jual setiap ${periodText.noun.toLowerCase()}.`, `Charged once on buy and once on sell every ${periodText.noun.toLowerCase()}.`)}
                  </p>
                }
              >
                <select
                  id={`${fieldId}-broker`}
                  value={brokerPreset}
                  onChange={(e) => handlePresetChange(e.target.value)}
                  className="w-full glass-input px-2.5 py-2.5 text-xs font-bold cursor-pointer text-foreground bg-background text-left"
                >
                  <option value="stockbit">Stockbit ({t('calculator.feeBeli')} 0.15% / {t('calculator.feeJual')} 0.25%)</option>
                  <option value="ajaib">Ajaib ({t('calculator.feeBeli')} 0.15% / {t('calculator.feeJual')} 0.25%)</option>
                  <option value="ipot">IPOT ({t('calculator.feeBeli')} 0.19% / {t('calculator.feeJual')} 0.29%)</option>
                  <option value="custom">{t('calculator.presetCustom')}</option>
                  <option value="none">{t('calculator.presetNone')}</option>
                </select>
                {brokerPreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 animate-fadeIn">
                    {([
                      ['beli', feeBeliStr, setFeeBeliStr, t('calculator.feeBeli')],
                      ['jual', feeJualStr, setFeeJualStr, t('calculator.feeJual')],
                    ] as const).map(([key, value, setValue, label]) => (
                      <div key={key}>
                        <StepperInput
                          id={`${fieldId}-fee-${key}`}
                          type="text"
                          inputMode="decimal"
                          value={value}
                          onChange={(e) => setValue(sanitizePercent(e.target.value))}
                          onStep={(dir) => setValue(prev => stepPercent(prev, dir, 0.01, 10, lang))}
                          canDecrement={parsePercent(value) > 0}
                          canIncrement={parsePercent(value) < 10}
                          decrementLabel={`${t('calculator.decrease')} ${label}`}
                          incrementLabel={`${t('calculator.increase')} ${label}`}
                          inputClassName="py-2"
                          adornment={percentSuffix}
                        />
                        <label htmlFor={`${fieldId}-fee-${key}`} className="text-[9px] text-slate-500 text-center block mt-1">{label}</label>
                      </div>
                    ))}
                  </div>
                )}
              </Field>
            </>
          ) : (
            <>
              {/* Setoran Rutin & Frekuensi */}
              <Field label={L('Setoran Berkala (Rp)', 'Periodic Deposit (Rp)')} htmlFor={`${fieldId}-lt-contribution`}>
                <div className="grid grid-cols-5 gap-1.5">
                  <div className="col-span-3 min-w-0">
                    <StepperInput
                      id={`${fieldId}-lt-contribution`}
                      {...moneyStepperProps(contributionAmountStr, (u) => setContributionAmountStr(u), L('Setoran', 'Deposit'))}
                      onChange={(e) => setContributionAmountStr(sanitizeMoney(e.target.value))}
                      onBlur={() => contributionAmountStr && setContributionAmountStr(formatNumberForInput(contributionAmountStr))}
                    />
                  </div>
                  <select
                    value={contributionFrequency}
                    onChange={(e) => setContributionFrequency(e.target.value as ContributionFrequency)}
                    aria-label={t('compounding.frequency')}
                    className="col-span-2 w-full glass-input px-2 py-2.5 text-xs font-bold text-foreground bg-background cursor-pointer text-left"
                  >
                    <option value="daily">{L('Harian', 'Daily')}</option>
                    <option value="weekly">{L('Mingguan', 'Weekly')}</option>
                    <option value="monthly">{L('Bulanan', 'Monthly')}</option>
                    <option value="yearly">{L('Tahunan', 'Yearly')}</option>
                  </select>
                </div>
              </Field>

              {/* Return & Compounding */}
              <Field label={L('Return Tahunan & Frekuensi Bunga', 'Annual Return & Compounding')} htmlFor={`${fieldId}-lt-return`}>
                <div className="grid grid-cols-2 gap-1.5">
                  <StepperInput
                    id={`${fieldId}-lt-return`}
                    type="text"
                    inputMode="decimal"
                    value={annualReturnRateStr}
                    onChange={(e) => setAnnualReturnRateStr(sanitizePercent(e.target.value))}
                    onStep={(dir) => setAnnualReturnRateStr(prev => stepPercent(prev, dir, 0.5, 1000, lang))}
                    canDecrement={input.annualReturnRate > 0}
                    decrementLabel={`${t('calculator.decrease')} Return`}
                    incrementLabel={`${t('calculator.increase')} Return`}
                    inputClassName="font-bold text-white"
                    adornment={percentSuffix}
                  />
                  <select
                    value={compoundingFrequency}
                    onChange={(e) => setCompoundingFrequency(e.target.value as CompoundingFrequency)}
                    aria-label={t('compounding.compoundingFreq')}
                    className="w-full glass-input px-2 py-2.5 text-xs font-bold text-foreground bg-background cursor-pointer text-left"
                  >
                    <option value="daily">{L('Harian', 'Daily')}</option>
                    <option value="monthly">{L('Bulanan', 'Monthly')}</option>
                    <option value="quarterly">{L('Kuartalan', 'Quarterly')}</option>
                    <option value="yearly">{L('Tahunan', 'Yearly')}</option>
                  </select>
                </div>
              </Field>

              {/* Jangka Waktu */}
              <Field label={L('Jangka Waktu', 'Duration')} htmlFor={`${fieldId}-lt-years`}>
                <div className="grid grid-cols-2 gap-1.5">
                  <StepperInput
                    id={`${fieldId}-lt-years`}
                    type="text"
                    inputMode="numeric"
                    value={durationYearsStr}
                    onChange={(e) => setDurationYearsStr(sanitizeCount(e.target.value))}
                    onStep={(dir) => setDurationYearsStr(prev => stepCount(prev, dir, 0, 100))}
                    canDecrement={input.durationYears > 0}
                    canIncrement={input.durationYears < 100}
                    decrementLabel={`${t('calculator.decrease')} ${L('Tahun', 'Years')}`}
                    incrementLabel={`${t('calculator.increase')} ${L('Tahun', 'Years')}`}
                    inputClassName="font-bold text-white"
                    adornment={<span className="flex items-center pr-1 text-[9px] font-semibold text-slate-500">{L('Thn', 'Yrs')}</span>}
                  />
                  <StepperInput
                    type="text"
                    inputMode="numeric"
                    value={durationMonthsStr}
                    onChange={(e) => setDurationMonthsStr(sanitizeCount(e.target.value))}
                    onStep={(dir) => setDurationMonthsStr(prev => stepCount(prev, dir, 0, 11))}
                    canDecrement={input.durationMonths > 0}
                    canIncrement={input.durationMonths < 11}
                    decrementLabel={`${t('calculator.decrease')} ${L('Bulan', 'Months')}`}
                    incrementLabel={`${t('calculator.increase')} ${L('Bulan', 'Months')}`}
                    aria-label={L('Bulan', 'Months')}
                    inputClassName="font-bold text-white"
                    adornment={<span className="flex items-center pr-1 text-[9px] font-semibold text-slate-500">{L('Bln', 'Mths')}</span>}
                  />
                </div>
              </Field>

              {/* Inflasi & Pajak */}
              <Field label={L('Inflasi / Tahun & Pajak Bunga', 'Inflation / Year & Interest Tax')} htmlFor={`${fieldId}-lt-inflation`}>
                <div className="grid grid-cols-2 gap-1.5">
                  <StepperInput
                    id={`${fieldId}-lt-inflation`}
                    type="text"
                    inputMode="decimal"
                    value={inflationRateStr}
                    onChange={(e) => setInflationRateStr(sanitizePercent(e.target.value))}
                    onStep={(dir) => setInflationRateStr(prev => stepPercent(prev, dir, 0.5, 50, lang))}
                    canDecrement={input.inflationRate > 0}
                    decrementLabel={`${t('calculator.decrease')} ${L('Inflasi', 'Inflation')}`}
                    incrementLabel={`${t('calculator.increase')} ${L('Inflasi', 'Inflation')}`}
                    inputClassName="font-bold text-white"
                    adornment={<span className="flex items-center pr-1 text-[9px] text-slate-500">% Inf</span>}
                  />
                  <StepperInput
                    type="text"
                    inputMode="decimal"
                    value={taxRateStr}
                    onChange={(e) => setTaxRateStr(sanitizePercent(e.target.value))}
                    onStep={(dir) => setTaxRateStr(prev => stepPercent(prev, dir, 0.5, 100, lang))}
                    canDecrement={input.taxRate > 0}
                    canIncrement={input.taxRate < 100}
                    decrementLabel={`${t('calculator.decrease')} ${L('Pajak', 'Tax')}`}
                    incrementLabel={`${t('calculator.increase')} ${L('Pajak', 'Tax')}`}
                    aria-label={L('Pajak', 'Tax')}
                    inputClassName="font-bold text-white"
                    adornment={<span className="flex items-center pr-1 text-[9px] text-slate-500">% {L('Pjk', 'Tax')}</span>}
                  />
                </div>
              </Field>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4 w-full">
        {isTrading ? (
          <>
            <StatCard
              tone="emerald"
              label={L('Modal Akhir', 'Ending Capital')}
              value={formatIDR(tradingResults.nominalEndingBalance, true)}
              amount={tradingResults.nominalEndingBalance}
              formatAmount={shortIDR}
              fullValue={formatIDR(tradingResults.nominalEndingBalance)}
              sub={`${L('Setelah', 'After')} ${tradingPeriods} ${periodText.plural}`}
            />
            <StatCard
              tone="blue"
              label={L('Profit Bersih', 'Net Profit')}
              value={formatIDR(tradingProfit, true)}
              amount={tradingProfit}
              formatAmount={shortIDR}
              fullValue={formatIDR(tradingProfit)}
              sub={`${L('Return', 'Return')} ${formatPct(tradingReturnPct)}`}
            />
            <StatCard
              tone="indigo"
              label={L('Total Disetor', 'Total Deposited')}
              value={formatIDR(tradingResults.totalDeposits, true)}
              amount={tradingResults.totalDeposits}
              formatAmount={shortIDR}
              fullValue={formatIDR(tradingResults.totalDeposits)}
              sub={L('Modal awal + setoran', 'Initial capital + deposits')}
            />
            <StatCard
              tone="rose"
              label={L('Total Fee Broker', 'Total Broker Fees')}
              value={formatIDR(tradingResults.totalTaxDeducted, true)}
              amount={tradingResults.totalTaxDeducted}
              formatAmount={shortIDR}
              fullValue={formatIDR(tradingResults.totalTaxDeducted)}
              sub={feeBeli > 0 || feeJual > 0
                ? `${formatPercentInput(feeBeli, lang)}% + ${formatPercentInput(feeJual, lang)}% / ${periodText.noun.toLowerCase()}`
                : L('Tanpa fee', 'No fees')}
            />
          </>
        ) : (
          <>
            <StatCard
              tone="emerald"
              label={t('compounding.totalEndingBalance')}
              value={formatIDR(results.nominalEndingBalance, true)}
              amount={results.nominalEndingBalance}
              formatAmount={shortIDR}
              fullValue={formatIDR(results.nominalEndingBalance)}
              sub={`${L('Return', 'Return')} ${formatPct(longTermReturnPct)}`}
            />
            <StatCard
              tone="indigo"
              label={t('compounding.cumulativeDeposits')}
              value={formatIDR(results.totalDeposits, true)}
              amount={results.totalDeposits}
              formatAmount={shortIDR}
              fullValue={formatIDR(results.totalDeposits)}
              sub={L('Modal awal + setoran', 'Initial capital + deposits')}
            />
            <StatCard
              tone="slate"
              label={L('Akumulasi Bunga (Kotor)', 'Cumulative Interest (Gross)')}
              value={formatIDR(results.totalInterestEarned, true)}
              amount={results.totalInterestEarned}
              formatAmount={shortIDR}
              fullValue={formatIDR(results.totalInterestEarned)}
              sub={input.taxRate > 0 ? `${L('Pajak', 'Tax')} ${formatIDR(results.totalTaxDeducted, true)}` : L('Tanpa pajak', 'No tax')}
            />
            <StatCard
              tone="blue"
              label={L('Saldo Riil (Daya Beli)', 'Real Balance (Purchasing Power)')}
              value={formatIDR(results.realEndingBalance, true)}
              amount={results.realEndingBalance}
              formatAmount={shortIDR}
              fullValue={formatIDR(results.realEndingBalance)}
              sub={`${L('Inflasi', 'Inflation')} ${formatPercentInput(input.inflationRate, lang)}%/${L('thn', 'yr')}`}
            />
          </>
        )}
      </div>

      {/* Wawasan dinamis */}
      {insights.length > 0 && (
        <div className="glass-card p-4 md:p-5 border-sky-500/20 bg-sky-500/[0.03]">
          <h2 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-sky-300 mb-3 flex items-center gap-2">
            <Lightbulb className="h-4 w-4" /> {L('Wawasan', 'Insights')}
          </h2>
          <Stagger className="grid grid-cols-1 md:grid-cols-2 gap-2.5" key={`${calcMode}:${tradingPeriod}`}>
            {insights.map((it) => (
              <StaggerItem key={it.key} className="flex items-start gap-2.5 text-[11px] md:text-xs text-slate-300 leading-relaxed">
                <it.icon className={`h-4 w-4 shrink-0 mt-0.5 ${it.tone}`} />
                <span>{it.text}</span>
              </StaggerItem>
            ))}
          </Stagger>
        </div>
      )}

      {/* Interactive Chart */}
      <div className="glass-card p-4 md:p-6 space-y-4 print-full-width">
        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-2.5 no-print">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-emerald-400" />
            {L('Visualisasi Proyeksi Pertumbuhan Dana', 'Growth Projection Visualization')}
          </h2>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-[10px] font-semibold text-slate-500 dark:text-slate-400 select-none">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-emerald-500" />
              <span>{L('Saldo Nominal', 'Nominal Balance')}</span>
            </div>
            {!isTrading && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded bg-blue-400" />
                <span>{L('Saldo Riil (Inflasi)', 'Real Balance (Inflation)')}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-indigo-500/30 border border-indigo-400/40" />
              <span>{t('compounding.cumulativeDeposits')}</span>
            </div>
          </div>
        </div>

        <div className="relative w-full overflow-hidden select-none bg-black/10 dark:bg-black/20 p-2 md:p-4 rounded-xl border border-slate-300/10 dark:border-white/5">
          {!hasChartData ? (
            <div className="h-[240px] flex items-center justify-center text-xs text-slate-500 text-center px-4">
              {L('Isi modal awal atau setoran untuk melihat grafik pertumbuhan.', 'Enter an initial capital or deposit to see the growth chart.')}
            </div>
          ) : (
            <>
              <svg
                ref={chartRef}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto overflow-visible cursor-crosshair touch-pan-y"
                onPointerMove={handlePointerMove}
                onPointerDown={handlePointerMove}
                onPointerLeave={() => setHoveredIndex(null)}
                role="img"
                aria-label={L('Grafik proyeksi pertumbuhan dana', 'Growth projection chart')}
              >
                {/* Y-axis gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const yVal = chartMargin.top + ratio * plotHeight;
                  return (
                    <g key={index}>
                      <line x1={chartMargin.left} y1={yVal} x2={svgWidth - chartMargin.right} y2={yVal} stroke="#94a3b8" strokeDasharray="3 3" opacity="0.15" />
                      <text x={chartMargin.left + 5} y={yVal - 4} fill="#94a3b8" fontSize="10" fontWeight="bold" opacity="0.7">
                        {formatIDR(maxY * (1 - ratio), true)}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis ticks */}
                {chartData.map((d, index) => {
                  const isLast = index === chartData.length - 1;
                  const isTick = index % tickEvery === 0 && (isLast || chartData.length - 1 - index >= tickEvery / 2);
                  if (!isTick && !isLast) return null;
                  const xVal = getX(index);
                  return (
                    <g key={index}>
                      <line x1={xVal} y1={chartMargin.top} x2={xVal} y2={svgHeight - chartMargin.bottom} stroke="#94a3b8" strokeWidth="0.5" opacity="0.15" />
                      <text
                        x={xVal}
                        y={svgHeight - 10}
                        fill="#94a3b8"
                        fontSize="10"
                        textAnchor={index === 0 ? 'start' : isLast ? 'end' : 'middle'}
                        fontWeight="bold"
                        opacity="0.7"
                      >
                        {d.short}
                      </text>
                    </g>
                  );
                })}

                <motion.path key={`area-${chartData.length}-${calcMode}`} d={areaPath(d => d.endingBalance)} fill="url(#nominalGrad)" initial={{ opacity: 0 }} animate={{ opacity: 0.12 }} transition={{ duration: 0.9, delay: 0.3 }} />
                <path d={areaPath(d => d.cumulativeDeposits)} fill="url(#depositGrad)" opacity="0.08" />
                <path d={linePath(d => d.cumulativeDeposits)} fill="none" stroke="#6366f1" strokeWidth="1.5" strokeDasharray="4 4" opacity="0.5" />
                <motion.path
                  key={`line-${chartData.length}-${calcMode}`}
                  d={linePath(d => d.endingBalance)}
                  fill="none"
                  stroke="#00b15b"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  initial={{ pathLength: 0 }}
                  animate={{ pathLength: 1 }}
                  transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1] }}
                />
                {!isTrading && (
                  <path d={linePath(d => d.realEndingBalance)} fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {activeIndex !== null && (
                  <g>
                    <line x1={getX(activeIndex)} y1={chartMargin.top} x2={getX(activeIndex)} y2={svgHeight - chartMargin.bottom} stroke="#00b15b" strokeWidth="1.2" opacity="0.4" />
                    <circle cx={getX(activeIndex)} cy={getY(chartData[activeIndex].endingBalance)} r="5.5" fill="#00b15b" stroke="#ffffff" strokeWidth="1.5" />
                    {!isTrading && (
                      <circle cx={getX(activeIndex)} cy={getY(chartData[activeIndex].realEndingBalance)} r="4" fill="#3b82f6" stroke="#ffffff" strokeWidth="1.2" />
                    )}
                    <circle cx={getX(activeIndex)} cy={getY(chartData[activeIndex].cumulativeDeposits)} r="4" fill="#6366f1" stroke="#ffffff" strokeWidth="1.2" />
                  </g>
                )}

                <defs>
                  <linearGradient id="nominalGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#00b15b" />
                    <stop offset="100%" stopColor="#00b15b" stopOpacity="0" />
                  </linearGradient>
                  <linearGradient id="depositGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#6366f1" />
                    <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
                  </linearGradient>
                </defs>
              </svg>

              {/* Tooltip mengikuti titik yang disorot */}
              {activeIndex !== null && (() => {
                const point = chartData[activeIndex];
                const leftPct = (getX(activeIndex) / svgWidth) * 100;
                const onRight = leftPct < 55;
                return (
                  <div
                    className="absolute top-2 md:top-4 p-3 bg-slate-950/95 border border-[#00b15b]/30 rounded-xl shadow-xl z-20 space-y-1 text-[10px] text-slate-400 w-[220px] max-w-[70%] backdrop-blur-md pointer-events-none"
                    style={onRight ? { left: `calc(${leftPct}% + 14px)` } : { right: `calc(${100 - leftPct}% + 14px)` }}
                  >
                    <div className="font-extrabold text-white border-b border-white/5 pb-1 uppercase tracking-wider">
                      {point.label}
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span>{L('Saldo', 'Balance')}</span>
                      <strong className="text-[#05fa7b] font-bold">{formatIDR(point.endingBalance)}</strong>
                    </div>
                    {!isTrading && (
                      <div className="flex justify-between items-center gap-3">
                        <span>{L('Saldo Riil', 'Real Balance')}</span>
                        <strong className="text-blue-400 font-bold">{formatIDR(point.realEndingBalance)}</strong>
                      </div>
                    )}
                    <div className="flex justify-between items-center gap-3 border-t border-white/5 pt-1 mt-1">
                      <span>{L('Disetor', 'Deposited')}</span>
                      <strong className="text-slate-200 font-bold">{formatIDR(point.cumulativeDeposits)}</strong>
                    </div>
                    <div className="flex justify-between items-center gap-3">
                      <span>{L('Profit Bersih', 'Net Profit')}</span>
                      <strong className="text-white font-bold">{formatIDR(point.cumulativeInterest)}</strong>
                    </div>
                  </div>
                );
              })()}
            </>
          )}
        </div>
      </div>

      {/* Projection Table */}
      <div className="glass-card p-4 md:p-6 space-y-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-emerald-400" />
            {L('Tabel Rincian Akumulasi Saldo', 'Balance Accumulation Details')}
            <span className="normal-case tracking-normal text-slate-500 font-semibold">({tableRows.length} {L('baris', 'rows')})</span>
          </h2>

          {isTrading ? (
            tradingTableOptions.length > 1 && (
              <Segmented
                value={effectiveTradingTable}
                onChange={setTradingTable}
                className="no-print"
                options={tradingTableOptions}
              />
            )
          ) : (
            <Segmented<'yearly' | 'monthly'>
              value={longTermTable}
              onChange={setLongTermTable}
              className="no-print"
              options={[
                { value: 'yearly', label: L('Tahunan', 'Yearly') },
                { value: 'monthly', label: `${L('Bulanan', 'Monthly')} (${results.monthlyDetails.length})` },
              ]}
            />
          )}
        </div>

        <div className="overflow-x-auto max-h-[440px] overflow-y-auto pr-1">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead className="sticky top-0 z-10 bg-card-bg">
              <tr className="border-b border-border-color text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                <th className="py-3 px-2">{L('Periode', 'Period')}</th>
                <th className="py-3 px-2 text-right">{L('Saldo Awal', 'Start Balance')}</th>
                {showDepositCol && <th className="py-3 px-2 text-right">{L('Setoran', 'Deposit')}</th>}
                <th className="py-3 px-2 text-right text-emerald-400">
                  {isTrading ? `Profit${effectiveTradingTable === 'detail' ? ` (${formatPercentInput(targetRate, lang)}%)` : ''}` : L('Bunga Kotor', 'Gross Interest')}
                </th>
                {showCostCol && <th className="py-3 px-2 text-right text-rose-400">{isTrading ? L('Fee Broker', 'Broker Fee') : L('Pajak', 'Tax')}</th>}
                <th className="py-3 px-2 text-right text-emerald-400">{L('Saldo Akhir', 'End Balance')}</th>
                {showRealCol && <th className="py-3 px-2 text-right text-blue-400">{L('Saldo Riil', 'Real Balance')}</th>}
                <th className="py-3 px-2 text-right text-blue-400">{L('Return Kumulatif', 'Cumulative Return')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-color/30 font-medium">
              {tableRows.map((row) => (
                <tr key={row.key} className="hover:bg-white/2 transition-colors text-[11px]">
                  <td className="py-2.5 px-2">
                    <span className="font-bold text-slate-200 block">{row.label}</span>
                    {row.sub && <span className="text-[9px] text-slate-500">{row.sub}</span>}
                  </td>
                  <td className="py-2.5 px-2 text-right text-slate-300">{formatIDR(row.start)}</td>
                  {showDepositCol && <td className="py-2.5 px-2 text-right text-indigo-400">+{formatIDR(row.deposit)}</td>}
                  <td className="py-2.5 px-2 text-right text-emerald-400">+{formatIDR(row.profit)}</td>
                  {showCostCol && <td className="py-2.5 px-2 text-right text-rose-400">-{formatIDR(row.cost)}</td>}
                  <td className="py-2.5 px-2 text-right font-bold text-white">{formatIDR(row.end)}</td>
                  {showRealCol && <td className="py-2.5 px-2 text-right font-semibold text-blue-400">{formatIDR(row.real ?? 0)}</td>}
                  <td className={`py-2.5 px-2 text-right font-semibold ${(row.cumPct ?? 0) >= 0 ? 'text-blue-400' : 'text-rose-400'}`}>
                    {formatPct(row.cumPct ?? 0)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saved Compounding Plans */}
      <div className="glass-card p-4 md:p-6 no-print">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200/50 dark:border-white/5 pb-3 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <Database className="h-4.5 w-4.5 text-emerald-400" />
            {L('Rencana Compounding Tersimpan', 'Saved Compounding Plans')}
          </h2>
          <span className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[10px] font-bold text-slate-300">
            {savedPlans.length} {L('rencana', savedPlans.length === 1 ? 'plan' : 'plans')}
          </span>
        </div>

        {isLoadingPlans ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {L('Memuat rencana simpanan...', 'Loading saved plans...')}
          </div>
        ) : savedPlans.length === 0 ? (
          <div className="py-8 px-4 text-center text-xs text-slate-500 border border-dashed border-border-color rounded-xl space-y-3">
            <p>{L('Belum ada rencana compounding yang disimpan.', 'No saved compounding plans yet.')}</p>
            <button
              type="button"
              onClick={openSaveModal}
              className="inline-flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-bold text-[11px] transition-colors cursor-pointer"
            >
              <Save className="h-3.5 w-3.5" />
              {L('Simpan simulasi saat ini', 'Save the current simulation')}
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
            {savedPlans.map((plan) => {
              const { kind, detail } = describePlan(plan);
              const isTradingPlan = tradingPeriodFromDb(plan.compounding_frequency) !== null;
              return (
                <div
                  key={plan.id}
                  className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border-color bg-black/10 hover:border-emerald-500/40 hover:bg-black/20 transition-all group"
                >
                  <div className="space-y-1 min-w-0">
                    <span className={`inline-flex items-center gap-1 text-[9px] font-extrabold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                      isTradingPlan ? 'bg-emerald-500/10 text-emerald-400' : 'bg-blue-500/10 text-blue-400'
                    }`}>
                      {isTradingPlan ? <Repeat className="h-2.5 w-2.5" /> : <Sprout className="h-2.5 w-2.5" />}
                      {kind}
                    </span>
                    <h4 className="font-extrabold text-sm text-slate-200 group-hover:text-emerald-400 transition-colors truncate" title={plan.title}>
                      {plan.title}
                    </h4>
                    <p className="text-[10px] text-slate-400">
                      {L('Modal', 'Capital')} <strong className="text-slate-300">{formatIDR(Number(plan.initial_amount), true)}</strong> • {detail}
                    </p>
                  </div>

                  <div className="flex items-center gap-2 self-end sm:self-auto shrink-0">
                    <button
                      type="button"
                      onClick={() => handleLoadPlan(plan)}
                      className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 text-emerald-400 font-extrabold text-[11px] transition-colors cursor-pointer select-none"
                    >
                      <FolderOpen className="h-3.5 w-3.5" />
                      {L('Muat', 'Load')}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPlanToDelete(plan)}
                      className="p-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                      title={L('Hapus Rencana', 'Delete Plan')}
                      aria-label={`${L('Hapus Rencana', 'Delete Plan')} ${plan.title}`}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Save Plan Dialog Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaveModalOpen(false)}
              className="fixed inset-0 bg-black z-50 no-print"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              role="dialog"
              aria-modal="true"
              className="fixed inset-x-4 top-[25%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[420px] bg-sidebar-bg border border-border-color rounded-2xl p-6 z-50 shadow-2xl text-white no-print"
            >
              <h3 className="text-base font-extrabold flex items-center gap-2 mb-2">
                <Save className="h-5 w-5 text-emerald-400" />
                {L('Simpan Rencana Simulasi', 'Save Simulation Plan')}
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                {user
                  ? L('Parameter ini akan disimpan ke akun Anda dan bisa dimuat kembali kapan saja.', 'These parameters will be saved to your account and can be reloaded anytime.')
                  : L('Parameter ini disimpan di browser ini (localStorage). Masuk ke akun untuk menyimpannya ke cloud.', 'These parameters are saved in this browser (localStorage). Sign in to save them to the cloud.')}
              </p>

              <form onSubmit={handleSavePlan} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor={`${fieldId}-plan-title`} className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {L('Judul Rencana', 'Plan Title')}
                  </label>
                  <input
                    id={`${fieldId}-plan-title`}
                    type="text"
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    placeholder={L('Contoh: Dana Pensiun Umur 55', 'e.g. Pension Fund Age 55')}
                    className="w-full glass-input px-3.5 py-2.5 text-xs font-bold"
                    maxLength={100}
                    required
                    autoFocus
                    onFocus={(e) => e.target.select()}
                  />
                </div>

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setIsSaveModalOpen(false)}
                    className="px-4 py-2 text-xs font-bold rounded-xl hover:bg-input-bg text-slate-400 hover:text-white transition-colors cursor-pointer"
                  >
                    {t('common.cancel')}
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !planTitle.trim()}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-emerald-500 text-white hover:bg-emerald-600 disabled:opacity-50 transition-all shadow-md cursor-pointer flex items-center gap-1.5"
                  >
                    {isSaving ? (
                      <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    ) : null}
                    <span>{user ? t('common.save') : t('common.saveLocal')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <ConfirmModal
        isOpen={planToDelete !== null}
        onClose={() => setPlanToDelete(null)}
        onConfirm={executeDeletePlan}
        title={L('Hapus Rencana?', 'Delete Plan?')}
        message={L(
          `Rencana "${planToDelete?.title ?? ''}" akan dihapus permanen.`,
          `The plan "${planToDelete?.title ?? ''}" will be permanently deleted.`
        )}
        confirmText={L('Ya, Hapus', 'Yes, Delete')}
        cancelText={t('common.cancel')}
      />

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            role="status"
            className={`fixed bottom-6 right-6 left-6 sm:left-auto z-50 px-5 py-3.5 rounded-xl border shadow-xl flex items-center gap-3 backdrop-blur-md text-xs font-bold no-print ${
              toast.type === 'success'
                ? 'bg-bullish-green/90 border-bullish-green/30 text-white'
                : 'bg-rose-600/90 border-rose-500/30 text-white'
            }`}
          >
            <AlertCircle className="h-4.5 w-4.5 shrink-0" />
            <span>{toast.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
