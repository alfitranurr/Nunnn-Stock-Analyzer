'use client';

import * as React from 'react';
import { PageHeader } from '@/components/shared/page-header';
import { motion, AnimatePresence } from 'framer-motion';
import { AnimatedNumber } from '@/components/shared/motion';
import { AlertTriangle, CheckCircle2, ClipboardList, FolderOpen, Rocket, Save, Trash2, Users, Wallet } from 'lucide-react';
import { StepperInput } from '@/components/stepper-input';
import { CompanyLogo } from '@/components/company-logo';
import { ConfirmModal } from '@/components/confirm-modal';
import { useLanguage } from '@/lib/language-context';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { AppUser } from '@/lib/types';
import { cleanCompanyName, getErrorMessage } from '@/lib/utils';
import { IDX_TICKERS } from '@/lib/tickers';
import { formatIDRCompact, formatNumberLocale, parseFormattedNumber } from '@/lib/format';
import { isValidIdxPrice, stepIdxPrice } from '@/lib/calculator';
import {
  RETAIL_MAX_ORDER_RP,
  SHARES_PER_LOT,
  calculateEIpo,
  compareOrderSizes,
  smallestOrderForBestAllotment,
  type EIpoInput,
  type PoolResult,
} from '@/lib/e-ipo';
import {
  Badge,
  Card,
  CardTitle,
  Field,
  Segmented,
  Stat,
  clamp,
  fmtInput,
  pct,
  pick,
  rp,
  sanitizeInteger,
  sanitizeNumber,
  stepDecimal,
  stepMagnitude,
} from '@/components/shared/calc-ui';
import { IpoRules } from './ipo-rules';
import { ListingSimulator } from './listing-simulator';

interface IpoTabProps {
  user: AppUser | null;
}

interface IpoPlan {
  id: string;
  ticker: string;
  company_name: string;
  price: number;
  total_lots: number;
  oversubscription: number;
  total_subscribers: number;
  retail_ratio: number;
  personal_order_lots: number;
  retail_demand_pct?: number | null;
  queue_pct?: number | null;
  created_at?: string;
}

type QueuePreset = 'early' | 'middle' | 'late' | 'custom';
const QUEUE_PRESETS: Record<Exclude<QueuePreset, 'custom'>, number> = { early: 10, middle: 50, late: 90 };
const PLANS_KEY = 'nunnn_stock_ipo_plans';
const DEFAULT_RETAIL_DEMAND_PCT = 35;
const DEFAULT_QUEUE_PCT = 50;

const ROMAN = ['I', 'II', 'III', 'IV', 'V'];

/** Kalkulator penjatahan E-IPO (SEOJK 25/SEOJK.04/2025). */
export function IpoTab({ user }: IpoTabProps) {
  const { language, t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const fieldId = React.useId();

  // ─── Input ───
  const [tickerStr, setTickerStr] = React.useState('');
  const [companyStr, setCompanyStr] = React.useState('');
  const [priceStr, setPriceStr] = React.useState(() => fmtInput(200, language, 0));
  const [totalLotsStr, setTotalLotsStr] = React.useState(() => fmtInput(5_000_000, language, 0));
  const [oversubStr, setOversubStr] = React.useState('150');
  const [retailInvStr, setRetailInvStr] = React.useState(() => fmtInput(250_000, language, 0));
  const [nonRetailInvStr, setNonRetailInvStr] = React.useState(() => fmtInput(4_000, language, 0));
  const [retailDemandStr, setRetailDemandStr] = React.useState(String(DEFAULT_RETAIL_DEMAND_PCT));
  const [myOrderStr, setMyOrderStr] = React.useState('50');
  const [queuePreset, setQueuePreset] = React.useState<QueuePreset>('early');
  const [customQueueStr, setCustomQueueStr] = React.useState('25');

  const [inputLanguage, setInputLanguage] = React.useState(language);
  if (inputLanguage !== language) {
    setInputLanguage(language);
    const re = (s: string, d = 0) => (s ? fmtInput(parseFormattedNumber(s), language, d) : s);
    setPriceStr(re(priceStr));
    setTotalLotsStr(re(totalLotsStr));
    setOversubStr(re(oversubStr, 2));
    setRetailInvStr(re(retailInvStr));
    setNonRetailInvStr(re(nonRetailInvStr));
    setRetailDemandStr(re(retailDemandStr, 2));
    setCustomQueueStr(re(customQueueStr, 2));
  }

  const ticker = tickerStr.toUpperCase();
  const listedName = ticker.length >= 3 ? IDX_TICKERS[ticker] : undefined;
  const price = parseFormattedNumber(priceStr);
  const totalLots = Math.floor(parseFormattedNumber(totalLotsStr));
  const oversub = Math.max(0, parseFormattedNumber(oversubStr));
  const retailInvestors = Math.floor(parseFormattedNumber(retailInvStr));
  const nonRetailInvestors = Math.floor(parseFormattedNumber(nonRetailInvStr));
  const retailDemandPct = clamp(parseFormattedNumber(retailDemandStr), 0, 100);
  const myOrderLots = parseInt(myOrderStr, 10) || 0;
  const queuePct = queuePreset === 'custom' ? clamp(parseFormattedNumber(customQueueStr), 0, 100) : QUEUE_PRESETS[queuePreset];

  const input: EIpoInput = {
    price,
    totalLots,
    poolOversubscription: oversub,
    retailInvestors,
    nonRetailInvestors,
    retailDemandPct,
    myOrderLots,
    myQueuePct: queuePct,
  };
  const ready = price > 0 && totalLots > 0;
  const result = calculateEIpo(input);
  const { allocation, me } = result;
  const lotValue = price * SHARES_PER_LOT;

  const { strategy, efficientRetail } = React.useMemo(() => {
    if (!ready) return { strategy: [], efficientRetail: null };
    const retailCap = Math.min(me.maxRetailLots, Math.max(1, me.maxOrderLots));
    const efficient = smallestOrderForBestAllotment(input, retailCap);
    const sizes = [1, 10, efficient?.lots ?? 0, retailCap, me.maxRetailLots + 1, myOrderLots].filter((s) => s > 0 && s <= Math.max(1, me.maxOrderLots));
    return { strategy: compareOrderSizes(input, sizes), efficientRetail: efficient };
    // input dibangun ulang setiap render; nilai primitifnya sudah tercakup di bawah
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, price, totalLots, oversub, retailInvestors, nonRetailInvestors, retailDemandPct, myOrderLots, queuePct, me.maxRetailLots, me.maxOrderLots]);

  // ─── Simpan / muat ───
  const [savedPlans, setSavedPlans] = React.useState<IpoPlan[]>([]);
  const [loadingPlans, setLoadingPlans] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [planToDelete, setPlanToDelete] = React.useState<IpoPlan | null>(null);
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const useCloud = isSupabaseConfigured && !!user && !user.isMock;

  const showToast = React.useCallback((message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    window.setTimeout(() => setToast(null), 3500);
  }, []);

  const readLocalPlans = (): IpoPlan[] => {
    try {
      const stored = localStorage.getItem(PLANS_KEY);
      return stored ? (JSON.parse(stored) as IpoPlan[]) : [];
    } catch {
      return [];
    }
  };

  const fetchPlans = React.useCallback(async () => {
    setLoadingPlans(true);
    if (useCloud) {
      const { data, error } = await supabase.from('ipo_plans').select('*').order('created_at', { ascending: false });
      if (error) {
        console.error('Error fetching E-IPO plans:', getErrorMessage(error));
        setSavedPlans(readLocalPlans());
      } else {
        setSavedPlans((data as IpoPlan[]) ?? []);
      }
    } else {
      setSavedPlans(readLocalPlans());
    }
    setLoadingPlans(false);
  }, [useCloud]);

  React.useEffect(() => {
    const timer = window.setTimeout(() => void fetchPlans(), 0);
    return () => window.clearTimeout(timer);
  }, [fetchPlans]);

  const savePlan = async () => {
    const totalSubscribers = retailInvestors + nonRetailInvestors;
    if (!ready || totalSubscribers <= 0) {
      showToast(L('Lengkapi harga, jumlah lot, dan jumlah pemesan terlebih dahulu.', 'Fill in price, lots and number of investors first.'), 'error');
      return;
    }
    const label = ticker || 'IPO';
    const plan = {
      ticker: label.slice(0, 10),
      company_name: (companyStr.trim() || listedName || L('Simulasi IPO', 'IPO simulation')).slice(0, 100),
      price,
      total_lots: totalLots,
      oversubscription: oversub,
      total_subscribers: totalSubscribers,
      retail_ratio: (retailInvestors / totalSubscribers) * 100,
      personal_order_lots: myOrderLots,
      retail_demand_pct: retailDemandPct,
      queue_pct: queuePct,
    };
    setSaving(true);
    try {
      if (useCloud && user) {
        let { error } = await supabase.from('ipo_plans').insert({ ...plan, user_id: user.id });
        // Database belum menjalankan migrasi 000008: simpan dengan kolom lama.
        if (error && /retail_demand_pct|queue_pct|oversubscription_check|column/i.test(error.message)) {
          const { retail_demand_pct: _r, queue_pct: _q, ...legacy } = plan;
          void _r;
          void _q;
          ({ error } = await supabase.from('ipo_plans').insert({ ...legacy, oversubscription: Math.max(1, oversub), user_id: user.id }));
        }
        if (error) throw error;
        await fetchPlans();
        showToast(L(`Simulasi ${label} tersimpan di akun.`, `${label} simulation saved to your account.`));
      } else {
        const updated = [{ id: crypto.randomUUID(), ...plan, created_at: new Date().toISOString() }, ...readLocalPlans()];
        localStorage.setItem(PLANS_KEY, JSON.stringify(updated));
        setSavedPlans(updated);
        showToast(L(`Simulasi ${label} tersimpan di perangkat ini.`, `${label} simulation saved on this device.`));
      }
    } catch (err) {
      showToast(L(`Gagal menyimpan: ${getErrorMessage(err)}`, `Failed to save: ${getErrorMessage(err)}`), 'error');
    } finally {
      setSaving(false);
    }
  };

  const loadPlan = (plan: IpoPlan) => {
    const total = Number(plan.total_subscribers) || 0;
    const retail = Math.round((total * (Number(plan.retail_ratio) || 0)) / 100);
    setTickerStr(plan.ticker === 'IPO' ? '' : plan.ticker);
    setCompanyStr(cleanCompanyName(plan.company_name));
    setPriceStr(fmtInput(Number(plan.price), language, 0));
    setTotalLotsStr(fmtInput(Number(plan.total_lots), language, 0));
    setOversubStr(fmtInput(Number(plan.oversubscription), language, 2));
    setRetailInvStr(fmtInput(retail, language, 0));
    setNonRetailInvStr(fmtInput(Math.max(0, total - retail), language, 0));
    setRetailDemandStr(fmtInput(Number(plan.retail_demand_pct ?? DEFAULT_RETAIL_DEMAND_PCT), language, 2));
    setMyOrderStr(String(Number(plan.personal_order_lots) || 0));
    const q = Number(plan.queue_pct ?? DEFAULT_QUEUE_PCT);
    const preset = (Object.keys(QUEUE_PRESETS) as Array<keyof typeof QUEUE_PRESETS>).find((k) => QUEUE_PRESETS[k] === q);
    setQueuePreset(preset ?? 'custom');
    if (!preset) setCustomQueueStr(fmtInput(q, language, 2));
    showToast(L(`Simulasi ${plan.ticker} dimuat.`, `${plan.ticker} simulation loaded.`));
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const deletePlan = async () => {
    const plan = planToDelete;
    setPlanToDelete(null);
    if (!plan) return;
    if (useCloud) {
      const { error } = await supabase.from('ipo_plans').delete().eq('id', plan.id);
      if (error) {
        showToast(L(`Gagal menghapus: ${getErrorMessage(error)}`, `Failed to delete: ${getErrorMessage(error)}`), 'error');
        return;
      }
      await fetchPlans();
    } else {
      const updated = readLocalPlans().filter((p) => p.id !== plan.id);
      localStorage.setItem(PLANS_KEY, JSON.stringify(updated));
      setSavedPlans(updated);
    }
    showToast(L(`Simulasi ${plan.ticker} dihapus.`, `${plan.ticker} simulation deleted.`));
  };

  // ─── Tampilan bantu ───
  const n0 = (v: number) => formatNumberLocale(v, language, 0);
  const lotsTxt = (v: number) => `${n0(v)} ${language === 'en' && Math.round(v) !== 1 ? 'lots' : 'lot'}`;
  const catLabel = (c: 'retail' | 'non-retail') => (c === 'retail' ? L('Ritel', 'Retail') : L('Selain ritel', 'Non-retail'));
  const priceOffTick = price > 0 && !isValidIdxPrice(price);
  const retailAvgTooBig = retailInvestors > 0 && result.avgRetailOrderRp > RETAIL_MAX_ORDER_RP;
  const nonRetailAvgTooSmall = nonRetailInvestors > 0 && result.avgNonRetailOrderRp > 0 && result.avgNonRetailOrderRp <= RETAIL_MAX_ORDER_RP;

  const stageText = (r: PoolResult, mine: boolean): string => {
    switch (r.stage) {
      case 'filled':
        return L('Pesanan di porsi ini tidak melebihi lot tersedia, jadi seluruh pesanan terpenuhi.', 'Demand in this portion does not exceed the lots available, so every order is filled.');
      case 'queue-one-lot': {
        const cut = pct(r.queueCutoffPct ?? 0, language, 1);
        const base = L(
          `Lot porsi ini (${n0(r.poolLots)}) lebih sedikit dari jumlah pemesan (${n0(r.investors)}): hanya ${cut} pemesan tercepat yang mendapat 1 lot, sisanya tidak dapat.`,
          `This portion has fewer lots (${n0(r.poolLots)}) than investors (${n0(r.investors)}): only the fastest ${cut} of investors get 1 lot, the rest get none.`
        );
        if (!mine) return base;
        return `${base} ${r.myLots > 0
          ? L(`Dengan posisi antrean ${pct(queuePct, language, 0)}, Anda termasuk yang dapat.`, `With a queue position of ${pct(queuePct, language, 0)}, you are among them.`)
          : L(`Dengan posisi antrean ${pct(queuePct, language, 0)}, Anda di luar batas itu.`, `With a queue position of ${pct(queuePct, language, 0)}, you are past that cutoff.`)} ${L('Memesan lebih dari 1 lot tidak menambah jatah.', 'Ordering more than 1 lot does not increase the allotment.')}`;
      }
      case 'equal-rounds': {
        const base = L(
          `Lot cukup untuk ${n0(r.baseLotsPerInvestor)} lot per pemesan di tahap pertama (maks 10 lot).`,
          `There are enough lots for ${n0(r.baseLotsPerInvestor)} lot(s) per investor in the first tier (max 10).`
        );
        const leftover = r.queueCutoffPct !== null && r.queueCutoffPct > 0
          ? L(` Sisa lot dibagikan 1 lot lagi ke ±${pct(r.queueCutoffPct, language, 1)} pemesan tercepat.`, ` Leftover lots give 1 more lot to the fastest ~${pct(r.queueCutoffPct, language, 1)}.`)
          : '';
        const useful = r.baseLotsPerInvestor + (leftover ? 1 : 0);
        return `${base}${leftover}${mine ? L(` Memesan lebih dari ${n0(useful)} lot tidak menambah jatah.`, ` Ordering more than ${n0(useful)} lots does not increase the allotment.`) : ''}`;
      }
      case 'proportional':
        return mine
          ? L(
              `Semua pemesan mendapat jatah tahap pertama (Anda ${n0(r.myFirstTierLots)} lot), lalu sisa lot dibagi proporsional terhadap pesanan yang belum terpenuhi: Anda +${n0(r.myExtraLots)} lot.${r.myRoundingBonusPossible ? ' Masih mungkin +1 lot dari sisa pembulatan bila memesan cukup awal.' : ''}`,
              `Every investor gets the first tier (you: ${n0(r.myFirstTierLots)} lots), then the rest is split pro rata to unfilled orders: you +${n0(r.myExtraLots)} lots.${r.myRoundingBonusPossible ? ' You may get +1 more lot from rounding leftovers if you ordered early.' : ''}`
            )
          : L(
              `Semua pemesan mendapat hingga 10 lot dulu, lalu sisa lot dibagi proporsional terhadap pesanan yang belum terpenuhi.`,
              `Every investor first gets up to 10 lots, then the rest is split pro rata to unfilled orders.`
            );
    }
  };

  const poolSummary = (r: PoolResult) =>
    r.stage === 'queue-one-lot'
      ? L(`1 lot untuk ${pct(r.queueCutoffPct ?? 0, language, 1)} tercepat`, `1 lot for the fastest ${pct(r.queueCutoffPct ?? 0, language, 1)}`)
      : r.stage === 'equal-rounds'
        ? L(`≈ ${n0(r.baseLotsPerInvestor)} lot per pemesan`, `≈ ${n0(r.baseLotsPerInvestor)} lots per investor`)
        : r.stage === 'proportional'
          ? L('10 lot + proporsional', '10 lots + pro rata')
          : L('Semua terpenuhi', 'All filled');

  const stepper = (label: string) => ({
    decrementLabel: `${t('calculator.decrease')} ${label}`,
    incrementLabel: `${t('calculator.increase')} ${label}`,
    inputClassName: 'font-bold text-white',
  });
  const suffix = (s: string) => <span className="flex items-center pr-1 text-[10px] font-bold text-slate-500">{s}</span>;
  const oversubStep = (v: number) => (v < 10 ? 0.5 : v < 100 ? 5 : 10);

  return (
    <div className="space-y-6 w-full">
      {/* Header */}
      <PageHeader
        icon={Rocket}
        eyebrow={L('Penjatahan E-IPO · SEOJK 25/2025', 'E-IPO allocation · SEOJK 25/2025')}
        title={L('Kalkulator E-IPO', 'E-IPO Calculator')}
        description={L(
          'Perkirakan berapa lot yang benar-benar Anda dapat di penjatahan terpusat, berapa dana yang kembali, ukuran pesanan yang efisien, dan untung/rugi di hari pertama listing.',
          'Estimate how many lots you will actually get in pooling allocation, how much money is refunded, the efficient order size, and listing-day P/L.'
        )}
      />

      {/* 1. Data IPO */}
      <Card>
        <CardTitle
          icon={<ClipboardList className="h-5 w-5 text-emerald-400" />}
          title={L('1. Data IPO (dari prospektus)', '1. IPO data (from the prospectus)')}
          subtitle={L('Data IPO live tidak tersedia otomatis (e-ipo.co.id tidak bisa diakses mesin), jadi isi dari prospektus atau e-ipo.co.id.', 'Live IPO data is not available automatically (e-ipo.co.id blocks automated access), so fill this in from the prospectus or e-ipo.co.id.')}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field
            label={L('Kode saham (opsional)', 'Ticker (optional)')}
            htmlFor={`${fieldId}-ticker`}
            hint={listedName ? <span className="text-amber-400">{L(`Kode ini sudah tercatat: ${listedName}. Pastikan ini IPO baru.`, `Already listed: ${listedName}. Make sure this is a new IPO.`)}</span> : undefined}
          >
            <div className="flex items-center gap-2">
              {ticker.length >= 3 && <CompanyLogo symbol={ticker} size={38} />}
              <input
                id={`${fieldId}-ticker`}
                type="text"
                maxLength={5}
                value={tickerStr}
                onChange={(e) => setTickerStr(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
                placeholder="ABCD"
                className="w-full glass-input px-3 py-2.5 text-xs font-extrabold text-white uppercase tracking-wider"
              />
            </div>
          </Field>
          <Field label={L('Nama perusahaan (opsional)', 'Company name (optional)')} htmlFor={`${fieldId}-name`}>
            <input
              id={`${fieldId}-name`}
              type="text"
              maxLength={100}
              value={companyStr}
              onChange={(e) => setCompanyStr(e.target.value)}
              placeholder={listedName ?? 'PT … Tbk'}
              className="w-full glass-input px-3 py-2.5 text-xs font-bold text-white"
            />
          </Field>
          <Field
            label={L('Harga penawaran / lembar', 'Offering price / share')}
            htmlFor={`${fieldId}-price`}
            hint={priceOffTick ? <span className="text-amber-400">{L('Bukan kelipatan fraksi harga BEI', 'Not a valid IDX tick price')}</span> : price > 0 ? L(`1 lot = ${rp(lotValue, language)}`, `1 lot = ${rp(lotValue, language)}`) : undefined}
          >
            <StepperInput
              id={`${fieldId}-price`}
              type="text"
              inputMode="numeric"
              value={priceStr}
              onChange={(e) => setPriceStr(sanitizeNumber(e.target.value))}
              onBlur={() => setPriceStr((v) => (v ? fmtInput(parseFormattedNumber(v), language, 0) : v))}
              onStep={(dir) => setPriceStr(fmtInput(stepIdxPrice(price, dir), language, 0))}
              canDecrement={price > 1}
              invalid={priceOffTick}
              {...stepper(L('harga', 'price'))}
              adornment={suffix('Rp')}
            />
          </Field>
          <Field
            label={L('Jumlah lot ditawarkan', 'Lots offered')}
            htmlFor={`${fieldId}-lots`}
            hint={ready ? L(`Nilai ${formatIDRCompact(allocation.offeringRp, language, 2)} · Golongan ${ROMAN[allocation.golongan - 1]}`, `Value ${formatIDRCompact(allocation.offeringRp, language, 2)} · Class ${ROMAN[allocation.golongan - 1]}`) : undefined}
          >
            <StepperInput
              id={`${fieldId}-lots`}
              type="text"
              inputMode="numeric"
              value={totalLotsStr}
              onChange={(e) => setTotalLotsStr(sanitizeNumber(e.target.value))}
              onBlur={() => setTotalLotsStr((v) => (v ? fmtInput(parseFormattedNumber(v), language, 0) : v))}
              onStep={(dir) => setTotalLotsStr((prev) => stepMagnitude(prev, dir, language, 1))}
              canDecrement={totalLots > 1}
              {...stepper('lot')}
              adornment={suffix('lot')}
            />
          </Field>
        </div>
      </Card>

      {/* 2. Kondisi pemesanan */}
      <Card>
        <CardTitle
          icon={<Users className="h-5 w-5 text-emerald-400" />}
          title={L('2. Kondisi Pemesanan Penjatahan Terpusat', '2. Pooling Demand')}
          subtitle={L(
            'Biasanya diumumkan setelah masa penawaran (oversubscribe & jumlah pemesan). Sebelum itu, isi dengan perkiraan dan ubah untuk melihat skenario.',
            'Usually announced after the offering period (oversubscription & number of investors). Before that, use estimates and adjust to explore scenarios.'
          )}
        />
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Field
            label={L('Oversubscribe terpusat', 'Pooling oversubscription')}
            htmlFor={`${fieldId}-x`}
            hint={ready ? L(`Total pesanan ≈ ${lotsTxt(result.poolDemandLots)} (÷ alokasi awal ${lotsTxt(allocation.initialLots)})`, `Total demand ≈ ${lotsTxt(result.poolDemandLots)} (÷ initial ${lotsTxt(allocation.initialLots)})`) : undefined}
          >
            <StepperInput
              id={`${fieldId}-x`}
              type="text"
              inputMode="decimal"
              value={oversubStr}
              onChange={(e) => setOversubStr(sanitizeNumber(e.target.value))}
              onStep={(dir) => setOversubStr((prev) => stepDecimal(prev, dir, oversubStep(dir > 0 ? oversub : Math.max(0, oversub - 0.01)), 0, 100_000, language))}
              canDecrement={oversub > 0}
              {...stepper('oversubscribe')}
              adornment={suffix('×')}
            />
          </Field>
          <Field
            label={L('Pemesan ritel', 'Retail investors')}
            htmlFor={`${fieldId}-ret`}
            hint={retailAvgTooBig
              ? <span className="text-amber-400">{L(`Rata-rata pesanan ritel ${formatIDRCompact(result.avgRetailOrderRp, language)} > Rp100 jt; turunkan porsi pesanan ritel.`, `Average retail order ${formatIDRCompact(result.avgRetailOrderRp, language)} > Rp100M; lower the retail demand share.`)}</span>
              : retailInvestors > 0 ? L(`Rata-rata ${lotsTxt(result.retailDemandLots / retailInvestors)} (${formatIDRCompact(result.avgRetailOrderRp, language)})`, `Average ${lotsTxt(result.retailDemandLots / retailInvestors)} (${formatIDRCompact(result.avgRetailOrderRp, language)})`) : undefined}
          >
            <StepperInput
              id={`${fieldId}-ret`}
              type="text"
              inputMode="numeric"
              value={retailInvStr}
              onChange={(e) => setRetailInvStr(sanitizeNumber(e.target.value))}
              onBlur={() => setRetailInvStr((v) => (v ? fmtInput(parseFormattedNumber(v), language, 0) : v))}
              onStep={(dir) => setRetailInvStr((prev) => stepMagnitude(prev, dir, language))}
              canDecrement={retailInvestors > 0}
              {...stepper(L('pemesan ritel', 'retail investors'))}
              adornment={suffix(L('orang', 'ppl'))}
            />
          </Field>
          <Field
            label={L('Pemesan selain ritel', 'Non-retail investors')}
            htmlFor={`${fieldId}-non`}
            hint={nonRetailAvgTooSmall
              ? <span className="text-amber-400">{L('Rata-rata pesanan selain ritel harus > Rp100 jt; naikkan porsi pesanan selain ritel.', 'Average non-retail order must be > Rp100M; raise the non-retail demand share.')}</span>
              : nonRetailInvestors > 0 ? L(`Rata-rata ${formatIDRCompact(result.avgNonRetailOrderRp, language)}`, `Average ${formatIDRCompact(result.avgNonRetailOrderRp, language)}`) : undefined}
          >
            <StepperInput
              id={`${fieldId}-non`}
              type="text"
              inputMode="numeric"
              value={nonRetailInvStr}
              onChange={(e) => setNonRetailInvStr(sanitizeNumber(e.target.value))}
              onBlur={() => setNonRetailInvStr((v) => (v ? fmtInput(parseFormattedNumber(v), language, 0) : v))}
              onStep={(dir) => setNonRetailInvStr((prev) => stepMagnitude(prev, dir, language))}
              canDecrement={nonRetailInvestors > 0}
              {...stepper(L('pemesan selain ritel', 'non-retail investors'))}
              adornment={suffix(L('orang', 'ppl'))}
            />
          </Field>
          <Field
            label={L('Porsi pesanan dari ritel', 'Retail share of demand')}
            htmlFor={`${fieldId}-rd`}
            hint={L('% dari total lot dipesan di penjatahan terpusat', '% of total lots ordered in pooling')}
          >
            <StepperInput
              id={`${fieldId}-rd`}
              type="text"
              inputMode="decimal"
              value={retailDemandStr}
              onChange={(e) => setRetailDemandStr(sanitizeNumber(e.target.value))}
              onStep={(dir) => setRetailDemandStr((prev) => stepDecimal(prev, dir, 5, 0, 100, language))}
              canDecrement={retailDemandPct > 0}
              canIncrement={retailDemandPct < 100}
              {...stepper(L('porsi ritel', 'retail share'))}
              adornment={suffix('%')}
            />
          </Field>
        </div>
      </Card>

      {/* 3. Pesanan Anda */}
      <Card>
        <CardTitle
          icon={<Wallet className="h-5 w-5 text-emerald-400" />}
          title={L('3. Pesanan Anda', '3. Your Order')}
          right={ready ? <span className="self-start"><Badge tone={me.category === 'retail' ? 'emerald' : 'sky'}>{catLabel(me.category)}</Badge></span> : undefined}
        />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field
            label={
              <>
                <span>{L('Jumlah lot dipesan', 'Lots ordered')}</span>
                {ready && me.maxRetailLots > 0 && myOrderLots !== me.maxRetailLots && (
                  <button type="button" onClick={() => setMyOrderStr(String(Math.min(me.maxRetailLots, Math.max(1, me.maxOrderLots))))} className="normal-case tracking-normal text-emerald-400 hover:underline cursor-pointer">
                    {L(`maks ritel: ${n0(me.maxRetailLots)} lot`, `retail max: ${n0(me.maxRetailLots)} lots`)}
                  </button>
                )}
              </>
            }
            htmlFor={`${fieldId}-order`}
            hint={me.exceedsOrderCap
              ? <span className="text-rose-400">{L(`Melebihi batas 10% nilai penawaran (maks ${n0(me.maxOrderLots)} lot): pesanan akan dikembalikan.`, `Exceeds the 10% offering cap (max ${n0(me.maxOrderLots)} lots): the order would be returned.`)}</span>
              : ready ? L(`Dana disetor ${rp(me.orderValueRp, language)} · ritel bila ≤ Rp100 jt`, `Funds ${rp(me.orderValueRp, language)} · retail if ≤ Rp100M`) : undefined}
          >
            <StepperInput
              id={`${fieldId}-order`}
              type="text"
              inputMode="numeric"
              value={myOrderStr}
              onChange={(e) => setMyOrderStr(sanitizeInteger(e.target.value))}
              onStep={(dir) => setMyOrderStr((prev) => String(Math.max(1, (parseInt(prev, 10) || 0) + dir)))}
              canDecrement={myOrderLots > 1}
              invalid={me.exceedsOrderCap}
              {...stepper('lot')}
              adornment={suffix('lot')}
            />
          </Field>
          <div className="space-y-2">
            <Field label={L('Kapan Anda memesan?', 'When do you order?')} hint={L('Urutan waktu pesan menentukan siapa yang dapat bila lot lebih sedikit dari pemesan.', 'Order time decides who gets lots when lots are fewer than investors.')}>
              <Segmented
                ariaLabel={L('Posisi antrean', 'Queue position')}
                value={queuePreset}
                onChange={setQueuePreset}
                options={[
                  { value: 'early', label: L('Awal (10%)', 'Early (10%)') },
                  { value: 'middle', label: L('Tengah (50%)', 'Middle (50%)') },
                  { value: 'late', label: L('Akhir (90%)', 'Late (90%)') },
                  { value: 'custom', label: L('Atur', 'Custom') },
                ]}
              />
            </Field>
            {queuePreset === 'custom' && (
              <StepperInput
                aria-label={L('Posisi antrean (%)', 'Queue position (%)')}
                type="text"
                inputMode="decimal"
                value={customQueueStr}
                onChange={(e) => setCustomQueueStr(sanitizeNumber(e.target.value))}
                onStep={(dir) => setCustomQueueStr((prev) => stepDecimal(prev, dir, 5, 0, 100, language))}
                canDecrement={queuePct > 0}
                canIncrement={queuePct < 100}
                {...stepper(L('posisi antrean', 'queue position'))}
                adornment={suffix(L('% tercepat', '% fastest'))}
              />
            )}
          </div>
        </div>
      </Card>

      {/* Hasil */}
      {!ready ? (
        <Card>
          <p className="py-6 text-center text-xs text-slate-500">{L('Isi harga penawaran dan jumlah lot ditawarkan untuk melihat hasil.', 'Enter the offering price and lots offered to see results.')}</p>
        </Card>
      ) : (
        <Card>
          <CardTitle
            icon={<CheckCircle2 className="h-5 w-5 text-emerald-400" />}
            title={L('Hasil Penjatahan', 'Allocation Result')}
            right={
              <button
                type="button"
                onClick={() => void savePlan()}
                disabled={saving}
                className="self-start flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold cursor-pointer disabled:opacity-60"
              >
                <Save className="h-3.5 w-3.5" /> {saving ? L('Menyimpan…', 'Saving…') : L('Simpan simulasi', 'Save simulation')}
              </button>
            }
          />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
            <div className="lg:col-span-2 p-5 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-card-bg to-[#121619]">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">
                {L(`Perkiraan jatah Anda · porsi ${catLabel(me.category).toLowerCase()}`, `Your estimated allotment · ${catLabel(me.category).toLowerCase()} portion`)}
              </span>
              <div className="flex items-baseline flex-wrap gap-x-3 gap-y-1 mt-1">
                <span className="text-4xl font-black text-emerald-400 tabular-nums"><AnimatedNumber value={me.result.myLots} format={(v) => lotsTxt(Math.round(v))} /></span>
                <span className="text-sm text-slate-400">{L(`dari ${lotsTxt(myOrderLots)} dipesan`, `of ${lotsTxt(myOrderLots)} ordered`)}</span>
              </div>
              <p className="text-xs text-slate-300 mt-3 leading-relaxed">{stageText(me.result, true)}</p>
              {me.exceedsOrderCap && (
                <p className="mt-3 text-xs text-rose-300 flex gap-2"><AlertTriangle className="h-4 w-4 shrink-0" />{L('Pesanan melebihi batas 10% dan tidak akan diproses sampai disesuaikan.', 'The order exceeds the 10% cap and will not be processed until adjusted.')}</p>
              )}
            </div>
            <div className="grid grid-cols-2 lg:grid-cols-1 gap-3">
              <Stat tone="emerald" label={L('Nilai jatah', 'Allotted value')} value={rp(me.allottedValueRp, language)} sub={L(`${n0(me.result.myLots * SHARES_PER_LOT)} lembar`, `${n0(me.result.myLots * SHARES_PER_LOT)} shares`)} />
              <Stat tone="sky" label={L('Dana dikembalikan', 'Refund')} value={rp(me.refundRp, language)} sub={L(`dari ${rp(me.orderValueRp, language)} disetor`, `of ${rp(me.orderValueRp, language)} paid in`)} />
            </div>
          </div>

          {/* Alur alokasi */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-4">
            <Stat label={L('Nilai penawaran', 'Offering value')} value={formatIDRCompact(allocation.offeringRp, language, 2)} sub={L(`Golongan ${ROMAN[allocation.golongan - 1]} · ${lotsTxt(totalLots)}`, `Class ${ROMAN[allocation.golongan - 1]} · ${lotsTxt(totalLots)}`)} />
            <Stat
              label={L('Alokasi terpusat awal', 'Initial pooling')}
              value={lotsTxt(allocation.initialLots)}
              sub={allocation.allPooling ? L('Seluruh saham (≤ Rp10 miliar)', 'All shares (≤ Rp10 billion)') : `${pct(allocation.initialPct, language)} ${L('dari penawaran', 'of offering')}`}
            />
            <Stat
              tone="emerald"
              label={allocation.adjustmentTier > 0 ? L(`Setelah penyesuaian ${ROMAN[allocation.adjustmentTier - 1]}`, `After adjustment ${ROMAN[allocation.adjustmentTier - 1]}`) : L('Tanpa penyesuaian', 'No adjustment')}
              value={lotsTxt(allocation.finalLots)}
              sub={`${pct(allocation.finalPct, language)} · ${L('oversubscribe', 'oversub')} ${formatNumberLocale(oversub, language, oversub % 1 ? 1 : 0)}×`}
            />
            <Stat label={L('Per porsi (ritel = selain ritel)', 'Per portion (retail = non-retail)')} value={lotsTxt(allocation.retailLots)} sub={L('dibagi 1 : 1', 'split 1 : 1')} />
          </div>

          {/* Dua porsi */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            {([
              { key: 'retail' as const, r: result.retailPool, tone: 'emerald' as const },
              { key: 'non-retail' as const, r: result.nonRetailPool, tone: 'sky' as const },
            ]).map(({ key, r, tone }) => (
              <div key={key} className={`p-4 rounded-2xl border ${me.category === key ? 'border-emerald-500/40 bg-emerald-500/[0.04]' : 'border-white/10 bg-white/[0.02]'}`}>
                <div className="flex items-center justify-between gap-2 mb-3">
                  <span className="text-xs font-black text-white">{L(`Porsi ${catLabel(key).toLowerCase()}`, `${catLabel(key)} portion`)}</span>
                  <Badge tone={tone}>{poolSummary(r)}</Badge>
                </div>
                <dl className="grid grid-cols-2 gap-y-1.5 text-[11px]">
                  <dt className="text-slate-400">{L('Lot tersedia', 'Lots available')}</dt>
                  <dd className="text-right font-bold text-white tabular-nums">{lotsTxt(r.poolLots)}</dd>
                  <dt className="text-slate-400">{L('Pemesan', 'Investors')}</dt>
                  <dd className="text-right font-bold text-white tabular-nums">{n0(key === 'retail' ? retailInvestors : nonRetailInvestors)}</dd>
                  <dt className="text-slate-400">{L('Total dipesan', 'Total ordered')}</dt>
                  <dd className="text-right font-bold text-white tabular-nums">{lotsTxt(r.demandLots)}</dd>
                  <dt className="text-slate-400">{L('Oversubscribe porsi', 'Portion oversub')}</dt>
                  <dd className="text-right font-bold text-white tabular-nums">{formatNumberLocale(r.oversubscription, language, 1)}×</dd>
                </dl>
                <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">{stageText(r, false)}</p>
              </div>
            ))}
          </div>

          {/* Strategi pesanan */}
          {strategy.length > 0 && (
            <div className="mt-6">
              <h3 className="text-xs font-bold text-slate-300 mb-1">{L('Strategi pesanan: berapa lot yang efisien?', 'Order strategy: what size is efficient?')}</h3>
              {efficientRetail && (
                <p className="text-[11px] text-slate-400 mb-3">
                  {efficientRetail.allotted > 0
                    ? L(
                        `Di porsi ritel, memesan ${lotsTxt(efficientRetail.lots)} (${rp(efficientRetail.lots * lotValue, language)}) sudah memberi jatah sama dengan pesanan ritel terbesar: ${lotsTxt(efficientRetail.allotted)}. Pesanan lebih besar hanya mengunci dana lebih lama lalu dikembalikan.`,
                        `In the retail portion, ordering ${lotsTxt(efficientRetail.lots)} (${rp(efficientRetail.lots * lotValue, language)}) already gets the same allotment as the largest retail order: ${lotsTxt(efficientRetail.allotted)}. Larger orders only lock money longer before it is refunded.`
                      )
                    : L(
                        'Dengan posisi antrean ini, pesanan ritel berapa pun diperkirakan tidak mendapat jatah. Yang menentukan adalah memesan lebih awal, bukan memesan lebih banyak.',
                        'With this queue position, no retail order size is expected to get an allotment. What matters is ordering earlier, not ordering more.'
                      )}
                </p>
              )}
              <div className="overflow-x-auto custom-scrollbar">
                <table className="w-full sm:min-w-[560px] text-left border-collapse text-xs">
                  <thead>
                    <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                      <th className="py-2.5 px-3">{L('Pesan', 'Order')}</th>
                      <th className="py-2.5 px-3 hidden sm:table-cell">{L('Porsi', 'Portion')}</th>
                      <th className="py-2.5 px-3 text-right">{L('Dana disetor', 'Funds')}</th>
                      <th className="py-2.5 px-3 text-right">{L('Perkiraan jatah', 'Est. allotment')}</th>
                      <th className="py-2.5 px-3 text-right hidden sm:table-cell">{L('Dana kembali', 'Refund')}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 text-slate-300">
                    {strategy.map((s) => (
                      <tr key={s.lots} className={s.lots === myOrderLots ? 'bg-emerald-500/[0.06]' : ''}>
                        <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                          {lotsTxt(s.lots)}
                          <span className="sm:hidden block text-[10px] font-semibold text-slate-500">{catLabel(s.category)}</span>
                          {s.lots === myOrderLots && <span className="ml-2"><Badge tone="emerald">{L('Anda', 'You')}</Badge></span>}
                          {s.lots === me.maxRetailLots && s.lots !== myOrderLots && <span className="ml-2"><Badge>{L('maks ritel', 'retail max')}</Badge></span>}
                          {efficientRetail && s.lots === efficientRetail.lots && efficientRetail.allotted > 0 && s.lots !== myOrderLots && <span className="ml-2"><Badge tone="sky">{L('efisien', 'efficient')}</Badge></span>}
                        </td>
                        <td className="py-2.5 px-3 hidden sm:table-cell">{catLabel(s.category)}</td>
                        <td className="py-2.5 px-3 text-right font-mono">{rp(s.orderValueRp, language)}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400">{lotsTxt(s.allotted)}</td>
                        <td className="py-2.5 px-3 text-right font-mono hidden sm:table-cell">{rp(s.refundRp, language)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <p className="text-[10px] text-slate-500 mt-4 leading-relaxed">
            {L(
              `Model: pemodal lain diasumsikan memesan rata-rata sama besar di porsinya (data sebaran pesanan per orang tidak dipublikasikan), dan posisi antrean adalah perkiraan Anda. Hasil resmi tetap ditentukan Sistem e-IPO; cek pengumuman penjatahan di e-ipo.co.id.`,
              `Model: other investors are assumed to order the same average size within their portion (per-investor order distributions are not published), and the queue position is your estimate. The official result is determined by the e-IPO system; check the allotment announcement on e-ipo.co.id.`
            )}
          </p>
        </Card>
      )}

      {ready && <ListingSimulator language={language} ipoPrice={price} allottedLots={me.result.myLots} />}

      <IpoRules language={language} activeGolongan={ready ? allocation.golongan : null} />

      {/* Simulasi tersimpan */}
      <Card>
        <CardTitle
          icon={<FolderOpen className="h-5 w-5 text-emerald-400" />}
          title={L('Simulasi Tersimpan', 'Saved Simulations')}
          subtitle={useCloud ? L('Tersimpan di akun Anda.', 'Stored in your account.') : L('Tersimpan di perangkat ini. Masuk ke akun untuk menyimpan di cloud.', 'Stored on this device. Sign in to save to the cloud.')}
        />
        {loadingPlans ? (
          <p className="py-6 text-center text-xs text-slate-500">{L('Memuat…', 'Loading…')}</p>
        ) : savedPlans.length === 0 ? (
          <p className="py-6 text-center text-xs text-slate-500">{L('Belum ada simulasi. Tekan "Simpan simulasi" di hasil penjatahan.', 'No simulations yet. Press "Save simulation" in the result.')}</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {savedPlans.map((plan) => (
              <li key={plan.id} className="p-3.5 rounded-2xl border border-white/10 bg-white/[0.02] flex items-center gap-3">
                {plan.ticker !== 'IPO' ? (
                  <CompanyLogo symbol={plan.ticker} size={36} />
                ) : (
                  <span className="h-9 w-9 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0"><Rocket className="h-4 w-4 text-emerald-400" /></span>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-black text-sm text-white">{plan.ticker}</div>
                  <div className="text-[10px] text-slate-400 truncate">{cleanCompanyName(plan.company_name)}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">
                    {rp(Number(plan.price), language)} · {lotsTxt(Number(plan.total_lots))} · {formatNumberLocale(Number(plan.oversubscription), language, 1)}× · {L('pesan', 'order')} {lotsTxt(Number(plan.personal_order_lots))}
                  </div>
                </div>
                <button type="button" onClick={() => loadPlan(plan)} className="px-3 py-1.5 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-[11px] font-bold border border-emerald-500/25 cursor-pointer">
                  {L('Muat', 'Load')}
                </button>
                <button
                  type="button"
                  onClick={() => setPlanToDelete(plan)}
                  aria-label={L(`Hapus simulasi ${plan.ticker}`, `Delete ${plan.ticker} simulation`)}
                  className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/25 cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </Card>

      <ConfirmModal
        isOpen={planToDelete !== null}
        onClose={() => setPlanToDelete(null)}
        onConfirm={() => void deletePlan()}
        title={L('Hapus simulasi?', 'Delete simulation?')}
        message={L(`Simulasi ${planToDelete?.ticker ?? ''} akan dihapus permanen.`, `The ${planToDelete?.ticker ?? ''} simulation will be permanently deleted.`)}
        confirmText={L('Ya, hapus', 'Yes, delete')}
        cancelText={L('Batal', 'Cancel')}
      />

      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            role="status"
            className={`fixed bottom-6 right-6 z-50 px-4 py-3 rounded-xl border shadow-xl text-xs font-bold text-white ${toast.type === 'success' ? 'bg-emerald-600/95 border-emerald-400/40' : 'bg-rose-600/95 border-rose-400/40'}`}
          >
            {toast.message}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

