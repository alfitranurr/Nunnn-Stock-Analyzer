'use client';

import * as React from 'react';
import { 
  Sparkles, 
  Info, 
  Download, 
  Printer, 
  Trash2, 
  Save, 
  FileText, 
  Database,
  TrendingUp,
  Percent,
  Calendar,
  DollarSign,
  AlertCircle
} from 'lucide-react';
import { calculateCompounding, CompoundingInput, CompoundingResult, calculateDailyCompounding, DailyCompoundingInput, DailyCompoundingResult } from '@/lib/compounding';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useLanguage } from '@/lib/language-context';

interface CompoundingTabProps {
  user: any;
  onSignInClick: () => void;
}

// Helpers for parsing and formatting numbers
const parseFormattedNumber = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  let clean = val.toString().trim();
  
  // Remove currency symbols, spaces, and other non-numeric formatting characters
  clean = clean.replace(/[Rp$\s]/g, '');

  const hasComma = clean.includes(',');
  const hasPeriod = clean.includes('.');

  if (hasComma && !hasPeriod) {
    // If there is a comma and no period, and it ends with a comma followed by 3 digits (e.g. "700,000")
    // or has multiple commas (e.g. "1,250,000")
    if (/,\d{3}(?:,\d{3})*$/.test(clean) || (clean.match(/,/g) || []).length > 1) {
      clean = clean.replace(/,/g, '');
    } else {
      // Otherwise treat as decimal separator (e.g. "12,5")
      clean = clean.replace(/,/g, '.');
    }
  } else if (hasPeriod && !hasComma) {
    // If there is a period and no comma, and it ends with a period followed by 3 digits (e.g. "700.000")
    // or has multiple periods (e.g. "1.250.000")
    if (/\.\d{3}(?:\.\d{3})*$/.test(clean) || (clean.match(/\./g) || []).length > 1) {
      clean = clean.replace(/\./g, '');
    }
  } else if (hasComma && hasPeriod) {
    // Both exist (e.g., "1,250.50" or "1.250,50")
    const commaIndex = clean.lastIndexOf(',');
    const periodIndex = clean.lastIndexOf('.');
    if (commaIndex > periodIndex) {
      // Comma is the decimal separator (e.g., "1.250,50")
      clean = clean.replace(/\./g, '').replace(/,/g, '.');
    } else {
      // Period is the decimal separator (e.g., "1,250.50")
      clean = clean.replace(/,/g, '');
    }
  }

  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const formatNumberForInput = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === '') return '';
  const parsed = typeof num === 'number' ? num : parseFloat(num.toString().replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 4,
  }).format(parsed);
};

export function CompoundingTab({ user, onSignInClick }: CompoundingTabProps) {
  const { t, language } = useLanguage();
  // Input States
  const [calcMode, setCalcMode] = React.useState<'standard' | 'daily'>('daily');
  const [initialAmountStr, setInitialAmountStr] = React.useState('10,000,000');
  const [contributionAmountStr, setContributionAmountStr] = React.useState('0');
  const [contributionFrequency, setContributionFrequency] = React.useState<'daily' | 'weekly' | 'monthly' | 'yearly'>('monthly');
  const [annualReturnRateStr, setAnnualReturnRateStr] = React.useState('5');
  const [compoundingFrequency, setCompoundingFrequency] = React.useState<'daily' | 'monthly' | 'quarterly' | 'yearly'>('monthly');
  const [durationYearsStr, setDurationYearsStr] = React.useState('10');
  const [durationMonthsStr, setDurationMonthsStr] = React.useState('0');
  const [durationDaysStr, setDurationDaysStr] = React.useState('20');
  const [inflationRateStr, setInflationRateStr] = React.useState('4');
  const [taxRateStr, setTaxRateStr] = React.useState('0');

  // Daily trading fees (similar to avg down)
  const [dailyBrokerPreset, setDailyBrokerPreset] = React.useState('stockbit');
  const [dailyFeeBeliStr, setDailyFeeBeliStr] = React.useState('0.15');
  const [dailyFeeJualStr, setDailyFeeJualStr] = React.useState('0.25');

  const handleDailyPresetChange = (presetId: string) => {
    setDailyBrokerPreset(presetId);
    if (presetId === 'none') {
      setDailyFeeBeliStr('0');
      setDailyFeeJualStr('0');
    } else if (presetId === 'stockbit' || presetId === 'ajaib') {
      setDailyFeeBeliStr('0.15');
      setDailyFeeJualStr('0.25');
    } else if (presetId === 'ipot') {
      setDailyFeeBeliStr('0.19');
      setDailyFeeJualStr('0.29');
    } else if (presetId === 'custom') {
      setDailyFeeBeliStr('0.20');
      setDailyFeeJualStr('0.30');
    }
  };

  // Plan Title state for saving
  const [planTitle, setPlanTitle] = React.useState('');
  const [isSaveModalOpen, setIsSaveModalOpen] = React.useState(false);
  const [isSaving, setIsSaving] = React.useState(false);
  const [savedPlans, setSavedPlans] = React.useState<any[]>([]);
  const [isLoadingPlans, setIsLoadingPlans] = React.useState(false);

  // Table options
  const [tableType, setTableType] = React.useState<'yearly' | 'monthly'>('yearly');
  
  // Custom SVG chart state
  const [hoveredIndex, setHoveredIndex] = React.useState<number | null>(null);
  const chartRef = React.useRef<SVGSVGElement>(null);

  // Toast notification state
  const [toast, setToast] = React.useState<{ message: string; type: 'success' | 'error' } | null>(null);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 3000);
  };

  // 1. Calculate the values (Standard Mode)
  const input: CompoundingInput = {
    title: planTitle || 'Simulasi Compounding',
    initialAmount: parseFormattedNumber(initialAmountStr),
    contributionAmount: parseFormattedNumber(contributionAmountStr),
    contributionFrequency,
    annualReturnRate: parseFloat(annualReturnRateStr) || 0,
    compoundingFrequency,
    durationYears: parseInt(durationYearsStr, 10) || 0,
    durationMonths: parseInt(durationMonthsStr, 10) || 0,
    inflationRate: parseFloat(inflationRateStr) || 0,
    taxRate: parseFloat(taxRateStr) || 0,
  };

  const results = React.useMemo(() => {
    return calculateCompounding(input);
  }, [
    initialAmountStr, contributionAmountStr, contributionFrequency,
    annualReturnRateStr, compoundingFrequency, durationYearsStr,
    durationMonthsStr, inflationRateStr, taxRateStr
  ]);

  // Daily trading calculation
  const dailyInput: DailyCompoundingInput = {
    title: planTitle || 'Simulasi Trading Harian',
    initialAmount: parseFormattedNumber(initialAmountStr),
    contributionAmount: parseFormattedNumber(contributionAmountStr),
    dailyReturnRate: parseFloat(annualReturnRateStr) || 0,
    durationDays: parseInt(durationDaysStr, 10) || 0,
    feeBeli: parseFloat(dailyFeeBeliStr) || 0,
    feeJual: parseFloat(dailyFeeJualStr) || 0,
  };

  const dailyResults = React.useMemo(() => {
    return calculateDailyCompounding(dailyInput);
  }, [
    initialAmountStr, contributionAmountStr, annualReturnRateStr,
    durationDaysStr, dailyBrokerPreset, dailyFeeBeliStr, dailyFeeJualStr
  ]);

  const isDaily = calcMode === 'daily';

  // Load Saved Plans
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
      } catch (err: any) {
        console.error('Error fetching compounding plans:', err.message);
        showToast('Gagal memuat rencana dari cloud database', 'error');
      } finally {
        setIsLoadingPlans(false);
      }
    } else {
      const stored = localStorage.getItem('nunnn_stock_compounding_plans');
      if (stored) {
        try {
          setSavedPlans(JSON.parse(stored));
        } catch {
          setSavedPlans([]);
        }
      } else {
        setSavedPlans([]);
      }
      setIsLoadingPlans(false);
    }
  }, [user]);

  React.useEffect(() => {
    const timer = setTimeout(() => {
      fetchSavedPlans();
    }, 0);
    return () => clearTimeout(timer);
  }, [fetchSavedPlans]);

  // Save Plan Action
  const handleSavePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!planTitle.trim()) {
      showToast('Masukkan judul rencana terlebih dahulu', 'error');
      return;
    }
    setIsSaving(true);
    
    // DB parameters mapping workaround
    const dbCompoundingFreq = isDaily ? 'trading_daily' : compoundingFrequency;
    const dbAnnualReturnRate = isDaily ? (parseFloat(annualReturnRateStr) || 0) : input.annualReturnRate;
    const dbDurationYears = isDaily ? 0 : input.durationYears;
    const dbDurationMonths = isDaily ? (parseInt(durationDaysStr, 10) || 0) : input.durationMonths;
    const dbContributionFreq = isDaily ? 'daily' : contributionFrequency;

    const feeBeliVal = parseFloat(dailyFeeBeliStr) || 0;
    const feeJualVal = parseFloat(dailyFeeJualStr) || 0;

    const planData = {
      title: planTitle,
      initial_amount: parseFormattedNumber(initialAmountStr),
      contribution_amount: parseFormattedNumber(contributionAmountStr),
      contribution_frequency: dbContributionFreq,
      annual_return_rate: dbAnnualReturnRate,
      compounding_frequency: dbCompoundingFreq,
      duration_years: dbDurationYears,
      duration_months: dbDurationMonths,
      inflation_rate: isDaily ? feeJualVal : (parseFloat(inflationRateStr) || 0),
      tax_rate: isDaily ? feeBeliVal : (parseFloat(taxRateStr) || 0),
    };

    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { error } = await supabase
          .from('compounding_plans')
          .insert({
            ...planData,
            user_id: user.id
          });
        if (error) throw error;
        showToast(`Rencana "${planTitle}" berhasil disimpan ke cloud!`);
        fetchSavedPlans();
        setIsSaveModalOpen(false);
        setPlanTitle('');
      } catch (err: any) {
        console.error('Error saving compounding plan:', err.message);
        showToast(`Gagal menyimpan: ${err.message}`, 'error');
      } finally {
        setIsSaving(false);
      }
    } else {
      // Offline Local Storage save
      const newPlan = {
        id: crypto.randomUUID(),
        ...planData,
        created_at: new Date().toISOString()
      };
      const updated = [newPlan, ...savedPlans];
      localStorage.setItem('nunnn_stock_compounding_plans', JSON.stringify(updated));
      setSavedPlans(updated);
      showToast(`Rencana "${planTitle}" berhasil disimpan secara lokal!`);
      setIsSaveModalOpen(false);
      setPlanTitle('');
      setIsSaving(false);
    }
  };

  // Delete Plan Action
  const handleDeletePlan = async (id: string, title: string) => {
    if (isSupabaseConfigured && user && !user.isMock) {
      try {
        const { error } = await supabase
          .from('compounding_plans')
          .delete()
          .eq('id', id);
        if (error) throw error;
        showToast(`Rencana "${title}" berhasil dihapus.`);
        fetchSavedPlans();
      } catch (err: any) {
        console.error('Error deleting plan:', err.message);
        showToast('Gagal menghapus rencana.', 'error');
      }
    } else {
      const updated = savedPlans.filter(p => p.id !== id);
      localStorage.setItem('nunnn_stock_compounding_plans', JSON.stringify(updated));
      setSavedPlans(updated);
      showToast(`Rencana "${title}" berhasil dihapus.`);
    }
  };

  // Load Parameters of Saved Plan
  const handleLoadPlan = (plan: any) => {
    const isDailyPlan = plan.compounding_frequency === 'trading_daily';
    if (isDailyPlan) {
      setCalcMode('daily');
      setInitialAmountStr(formatNumberForInput(plan.initial_amount));
      setContributionAmountStr(formatNumberForInput(plan.contribution_amount));
      setAnnualReturnRateStr(plan.annual_return_rate.toString());
      setDurationDaysStr(plan.duration_months.toString());
      
      const fBeli = plan.tax_rate || 0;
      const fJual = plan.inflation_rate || 0;

      if (fBeli === 0 && fJual === 0) {
        setDailyBrokerPreset('none');
        setDailyFeeBeliStr('0');
        setDailyFeeJualStr('0');
      } else if (fBeli === 0.15 && fJual === 0.25) {
        setDailyBrokerPreset('stockbit');
        setDailyFeeBeliStr('0.15');
        setDailyFeeJualStr('0.25');
      } else if (fBeli === 0.19 && fJual === 0.29) {
        setDailyBrokerPreset('ipot');
        setDailyFeeBeliStr('0.19');
        setDailyFeeJualStr('0.29');
      } else {
        setDailyBrokerPreset('custom');
        setDailyFeeBeliStr(fBeli.toString());
        setDailyFeeJualStr(fJual.toString());
      }
    } else {
      setCalcMode('standard');
      setInitialAmountStr(formatNumberForInput(plan.initial_amount));
      setContributionAmountStr(formatNumberForInput(plan.contribution_amount));
      setContributionFrequency(plan.contribution_frequency);
      setAnnualReturnRateStr(plan.annual_return_rate.toString());
      setCompoundingFrequency(plan.compounding_frequency);
      setDurationYearsStr(plan.duration_years.toString());
      setDurationMonthsStr(plan.duration_months.toString());
      setInflationRateStr(plan.inflation_rate.toString());
      setTaxRateStr(plan.tax_rate.toString());
    }
    showToast(`Rencana "${plan.title}" berhasil dimuat.`);
  };

  // Formatting Rupiah values
  const formatIDR = (value: number, isShort = false) => {
    const absVal = Math.abs(value);
    
    if (isShort) {
      let suffix = '';
      let formattedVal = absVal;

      if (absVal >= 1e24) {
        formattedVal = absVal / 1e24;
        suffix = ' Septiliun';
      } else if (absVal >= 1e21) {
        formattedVal = absVal / 1e21;
        suffix = ' Sekstiliun';
      } else if (absVal >= 1e18) {
        formattedVal = absVal / 1e18;
        suffix = ' Kuintiliun';
      } else if (absVal >= 1e15) {
        formattedVal = absVal / 1e15;
        suffix = ' Kuadriliun';
      } else if (absVal >= 1e12) {
        formattedVal = absVal / 1e12;
        suffix = ' Triliun';
      } else if (absVal >= 1e9) {
        formattedVal = absVal / 1e9;
        suffix = ' Miliar';
      } else if (absVal >= 1e6) {
        formattedVal = absVal / 1e6;
        suffix = ' Juta';
      }

      if (suffix) {
        const formatted = new Intl.NumberFormat('id-ID', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(formattedVal);
        return value < 0 ? `-Rp ${formatted}${suffix}` : `Rp ${formatted}${suffix}`;
      }
    }

    const formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(absVal);
    return value < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
  };

  // Formatting Percentage values
  const formatPercentage = (val: number, isShort = false) => {
    const absVal = Math.abs(val);
    
    if (isShort) {
      let suffix = '';
      let formattedVal = absVal;

      if (absVal >= 1e24) {
        formattedVal = absVal / 1e24;
        suffix = ' Septiliun';
      } else if (absVal >= 1e21) {
        formattedVal = absVal / 1e21;
        suffix = ' Sekstiliun';
      } else if (absVal >= 1e18) {
        formattedVal = absVal / 1e18;
        suffix = ' Kuintiliun';
      } else if (absVal >= 1e15) {
        formattedVal = absVal / 1e15;
        suffix = ' Kuadriliun';
      } else if (absVal >= 1e12) {
        formattedVal = absVal / 1e12;
        suffix = ' Triliun';
      } else if (absVal >= 1e9) {
        formattedVal = absVal / 1e9;
        suffix = ' Miliar';
      } else if (absVal >= 1e6) {
        formattedVal = absVal / 1e6;
        suffix = ' Juta';
      }

      if (suffix) {
        const formatted = new Intl.NumberFormat('id-ID', {
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(formattedVal);
        return `${val >= 0 ? '+' : '-'}${formatted}${suffix}%`;
      }
    }

    const formatted = new Intl.NumberFormat('id-ID', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(absVal);
    return `${val >= 0 ? '+' : '-'}${formatted}%`;
  };

  // Excel Export
  const handleExportExcel = () => {
    const wb = XLSX.utils.book_new();
    let ws;
    let fileName = '';

    if (isDaily) {
      const headers = [
        "Hari", "Modal Awal Hari (Rp)", "Setoran Harian (Rp)", 
        "Profit (Rp)", "Pajak (Rp)", "Modal Akhir Hari (Rp)",
        "Akumulasi Setoran (Rp)", "Akumulasi Profit (Rp)"
      ];
      
      const rows = dailyResults.details.map(d => [
        d.period,
        Math.round(d.startingBalance),
        Math.round(d.deposit),
        Math.round(d.interestEarned),
        Math.round(d.taxDeducted),
        Math.round(d.endingBalance),
        Math.round(d.cumulativeDeposits),
        Math.round(d.cumulativeInterest)
      ]);

      ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      fileName = `Rencana_Trading_Harian_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.utils.book_append_sheet(wb, ws, "Trading Harian");
    } else {
      const headers = [
        "Bulan", "Tahun", "Bulan Ke", "Saldo Awal (Rp)", 
        "Setoran (Rp)", "Bunga Kotor (Rp)", "Pajak (Rp)", 
        "Saldo Akhir Nominal (Rp)", "Saldo Akhir Riil (Rp)", 
        "Akumulasi Setoran (Rp)", "Akumulasi Bunga (Rp)"
      ];
      
      const rows = results.monthlyDetails.map(d => [
        d.period,
        d.year,
        d.month,
        Math.round(d.startingBalance),
        Math.round(d.deposit),
        Math.round(d.interestEarned),
        Math.round(d.taxDeducted),
        Math.round(d.endingBalance),
        Math.round(d.realEndingBalance),
        Math.round(d.cumulativeDeposits),
        Math.round(d.cumulativeInterest)
      ]);

      ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
      fileName = `Simulasi_Compounding_${new Date().toISOString().slice(0, 10)}.xlsx`;
      XLSX.utils.book_append_sheet(wb, ws, "Compounding");
    }

    XLSX.writeFile(wb, fileName);
  };

  // Print PDF Trigger
  const handlePrint = () => {
    window.print();
  };

  // Custom Chart Calculations
  const chartData = React.useMemo(() => {
    if (isDaily) {
      return dailyResults.details.map(d => ({
        label: `Hari ${d.period}`,
        endingBalance: d.endingBalance,
        realEndingBalance: d.endingBalance,
        cumulativeDeposits: d.cumulativeDeposits,
        cumulativeInterest: d.cumulativeInterest,
      }));
    }

    const totalMonths = results.monthlyDetails.length;
    const isYearly = totalMonths > 36;
    
    if (isYearly) {
      return results.yearlySummaries.map(y => ({
        label: `Tahun ${y.year}`,
        endingBalance: y.endingBalance,
        realEndingBalance: y.realEndingBalance,
        cumulativeDeposits: y.cumulativeDeposits,
        cumulativeInterest: y.cumulativeInterest,
      }));
    } else {
      return results.monthlyDetails.map(m => ({
        label: `Bulan ${m.period}`,
        endingBalance: m.endingBalance,
        realEndingBalance: m.realEndingBalance,
        cumulativeDeposits: m.cumulativeDeposits,
        cumulativeInterest: m.cumulativeInterest,
      }));
    }
  }, [isDaily, results, dailyResults]);

  // SVG Chart Geometry
  const svgWidth = 800;
  const svgHeight = 300;
  const chartMargin = { top: 20, right: 0, bottom: 30, left: 0 };
  const plotWidth = svgWidth - chartMargin.left - chartMargin.right;
  const plotHeight = svgHeight - chartMargin.top - chartMargin.bottom;

  const maxY = React.useMemo(() => {
    if (chartData.length === 0) return 1000;
    const maxVal = Math.max(...chartData.map(d => Math.max(d.endingBalance, d.cumulativeDeposits)));
    return maxVal * 1.05; // 5% padding on top
  }, [chartData]);

  // Points mapping functions
  const getX = (index: number) => {
    if (chartData.length <= 1) return chartMargin.left;
    return chartMargin.left + (index / (chartData.length - 1)) * plotWidth;
  };

  const getY = (val: number) => {
    return svgHeight - chartMargin.bottom - (val / maxY) * plotHeight;
  };

  // Area Path String Builder
  const nominalAreaPath = React.useMemo(() => {
    if (chartData.length === 0) return '';
    const points = chartData.map((d, i) => `${getX(i)},${getY(d.endingBalance)}`);
    return `M ${getX(0)},${getY(0)} L ${points.join(' L ')} L ${getX(chartData.length - 1)},${getY(0)} Z`;
  }, [chartData, maxY]);

  const realLinePath = React.useMemo(() => {
    if (chartData.length === 0) return '';
    const points = chartData.map((d, i) => `${getX(i)},${getY(d.realEndingBalance)}`);
    return `M ${points.join(' L ')}`;
  }, [chartData, maxY]);

  const depositAreaPath = React.useMemo(() => {
    if (chartData.length === 0) return '';
    const points = chartData.map((d, i) => `${getX(i)},${getY(d.cumulativeDeposits)}`);
    return `M ${getX(0)},${getY(0)} L ${points.join(' L ')} L ${getX(chartData.length - 1)},${getY(0)} Z`;
  }, [chartData, maxY]);

  const depositLinePath = React.useMemo(() => {
    if (chartData.length === 0) return '';
    const points = chartData.map((d, i) => `${getX(i)},${getY(d.cumulativeDeposits)}`);
    return `M ${points.join(' L ')}`;
  }, [chartData, maxY]);

  const nominalLinePath = React.useMemo(() => {
    if (chartData.length === 0) return '';
    const points = chartData.map((d, i) => `${getX(i)},${getY(d.endingBalance)}`);
    return `M ${points.join(' L ')}`;
  }, [chartData, maxY]);

  // Mouse move handler for chart hover
  const handleMouseMove = (e: React.MouseEvent<SVGSVGElement, MouseEvent>) => {
    if (!chartRef.current || chartData.length === 0) return;
    const rect = chartRef.current.getBoundingClientRect();
    const clientX = e.clientX - rect.left;
    
    // Scale clientX back to SVG grid width
    const svgRatio = svgWidth / rect.width;
    const svgX = clientX * svgRatio;
    const plotX = svgX - chartMargin.left;
    
    if (plotX < 0 || plotX > plotWidth) {
      setHoveredIndex(null);
      return;
    }

    const ratio = plotX / plotWidth;
    const index = Math.round(ratio * (chartData.length - 1));
    if (index >= 0 && index < chartData.length) {
      setHoveredIndex(index);
    }
  };

  // Blur validation handlers
  const handleBlur = (val: string, setter: (v: string) => void) => {
    if (!val) return;
    setter(formatNumberForInput(val));
  };

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

      {/* Main Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold tracking-tight flex items-center gap-2">
            {t('compounding.title')}
            <Sparkles className="h-6 w-6 text-brand-purple animate-pulse shrink-0" />
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            {t('compounding.desc')}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsSaveModalOpen(true)}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-brand-purple hover:bg-brand-purple/95 text-white font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save className="h-4 w-4" />
            <span>{t('compounding.savePlan')}</span>
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-input-bg border border-border-color hover:bg-glass-border text-foreground font-bold text-xs transition-all cursor-pointer"
          >
            <Download className="h-4 w-4 text-brand-purple" />
            <span>{t('compounding.exportExcel')}</span>
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-input-bg border border-border-color hover:bg-glass-border text-foreground font-bold text-xs transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4 text-brand-purple" />
            <span>{t('compounding.printPdf')}</span>
          </button>
        </div>
      </div>

      {/* Database Tip Alert */}
      {!isSupabaseConfigured && (
        <div className="p-4.5 rounded-2xl bg-brand-purple/5 border border-brand-purple/20 text-slate-600 dark:text-slate-300 text-xs flex gap-3 shadow-sm no-print">
          <Info className="h-5 w-5 text-brand-purple shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800 dark:text-white">
              {language === 'id' ? 'Tips Mode Uji Coba:' : 'Trial Mode Tips:'}
            </span>
            <p className="mt-1">
              {language === 'id' 
                ? 'Aplikasi belum terhubung dengan database PostgreSQL Supabase. Penyimpanan rencana compounding akan dialihkan menggunakan simulasi lokal (localStorage browser). Anda tetap dapat menggunakan seluruh fitur secara penuh.' 
                : 'The application is not connected to the Supabase PostgreSQL database yet. Compounding plan storage will fall back to local browser storage (localStorage). You can still use all features completely.'}
            </p>
          </div>
        </div>
      )}

      {/* Mode Selector Toggle */}
      <div className="flex bg-input-bg border border-border-color p-1 rounded-2xl text-[11px] font-extrabold max-w-md no-print select-none">
        <button
          onClick={() => {
            setCalcMode('daily');
            if (annualReturnRateStr === '10' || annualReturnRateStr === '8') setAnnualReturnRateStr('5');
            if (contributionAmountStr === '1,000,000') setContributionAmountStr('0');
          }}
          className={`flex-1 py-2 rounded-xl transition-all cursor-pointer text-center ${
            calcMode === 'daily' ? 'bg-brand-purple text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          {t('compounding.modeTrading')}
        </button>
        <button
          onClick={() => {
            setCalcMode('standard');
            if (annualReturnRateStr === '5') setAnnualReturnRateStr('10');
            if (contributionAmountStr === '0') setContributionAmountStr('1,000,000');
          }}
          className={`flex-1 py-2 rounded-xl transition-all cursor-pointer text-center ${
            calcMode === 'standard' ? 'bg-brand-purple text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          {t('compounding.modeLongTerm')}
        </button>
      </div>

      {/* Parameter Form Box (Full Width, Horizontal Layout) */}
      <div className="glass-card p-5 md:p-6 space-y-4 no-print w-full">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-2">
          <Calendar className="h-4.5 w-4.5 text-brand-purple" />
          {t('compounding.inputHeader')} ({isDaily ? t('compounding.modeTrading') : t('compounding.modeLongTerm')})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
          {isDaily ? (
            <>
              {/* Modal Investasi Awal */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('compounding.modalAwal')}</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                  <input
                    type="text"
                    value={initialAmountStr}
                    onChange={(e) => setInitialAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onBlur={() => handleBlur(initialAmountStr, setInitialAmountStr)}
                    className="w-full glass-input pl-10 pr-4 py-2.5 text-xs font-extrabold text-white bg-black/25 focus:bg-background"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Target Profit / Hari (%) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('compounding.targetReturn')}</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={annualReturnRateStr}
                    onChange={(e) => setAnnualReturnRateStr(e.target.value)}
                    className="w-full glass-input pl-3 pr-10 py-2.5 text-xs font-bold text-white text-left bg-black/25 focus:bg-background"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                </div>
              </div>

              {/* Durasi (Hari) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('compounding.durasiHari')}</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={durationDaysStr}
                    onChange={(e) => setDurationDaysStr(e.target.value)}
                    className="w-full glass-input px-3 py-2.5 text-xs font-bold text-white text-left bg-black/25 focus:bg-background"
                  />
                </div>
              </div>

              {/* Setoran Tambahan Harian (Rp) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('compounding.setoranTambahan')}</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                  <input
                    type="text"
                    value={contributionAmountStr}
                    onChange={(e) => setContributionAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onBlur={() => handleBlur(contributionAmountStr, setContributionAmountStr)}
                    className="w-full glass-input pl-10 pr-4 py-2.5 text-xs font-extrabold text-white bg-black/25 focus:bg-background"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Broker Fee Settings */}
              <div className="flex flex-col gap-1.5 shrink-0">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">{t('compounding.brokerFee')}</label>
                <select
                  value={dailyBrokerPreset}
                  onChange={(e) => handleDailyPresetChange(e.target.value)}
                  className="w-full glass-input px-2.5 py-2.5 text-xs font-bold cursor-pointer text-foreground bg-background text-left"
                >
                  <option value="stockbit">Stockbit ({t('calculator.feeBeli')} 0.15% / {t('calculator.feeJual')} 0.25%)</option>
                  <option value="ajaib">Ajaib ({t('calculator.feeBeli')} 0.15% / {t('calculator.feeJual')} 0.25%)</option>
                  <option value="ipot">IPOT ({t('calculator.feeBeli')} 0.19% / {t('calculator.feeJual')} 0.29%)</option>
                  <option value="custom">{t('calculator.presetCustom')}</option>
                  <option value="none">{t('calculator.presetNone')}</option>
                </select>
                
                {dailyBrokerPreset === 'custom' && (
                  <div className="grid grid-cols-2 gap-2 mt-1.5 animate-fadeIn">
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          value={dailyFeeBeliStr}
                          onChange={(e) => setDailyFeeBeliStr(e.target.value)}
                          className="w-full glass-input pl-2 pr-5 py-1.5 text-[10px] text-center font-bold"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">%</span>
                      </div>
                      <span className="text-[8px] text-slate-500 text-center block mt-0.5">{t('calculator.feeBeli')}</span>
                    </div>
                    <div>
                      <div className="relative">
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          max="10"
                          value={dailyFeeJualStr}
                          onChange={(e) => setDailyFeeJualStr(e.target.value)}
                          className="w-full glass-input pl-2 pr-5 py-1.5 text-[10px] text-center font-bold"
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">%</span>
                      </div>
                      <span className="text-[8px] text-slate-500 text-center block mt-0.5">{t('calculator.feeJual')}</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Modal Investasi Awal */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('compounding.modalAwal')}</label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                  <input
                    type="text"
                    value={initialAmountStr}
                    onChange={(e) => setInitialAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                    onBlur={() => handleBlur(initialAmountStr, setInitialAmountStr)}
                    className="w-full glass-input pl-10 pr-4 py-2.5 text-xs font-extrabold text-white bg-black/25 focus:bg-background"
                    placeholder="0"
                  />
                </div>
              </div>

              {/* Setoran Rutin & Frekuensi */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{t('compounding.setoranTambahanLong')}</label>
                <div className="grid grid-cols-5 gap-1.5">
                  <div className="col-span-3 relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-500">Rp</span>
                    <input
                      type="text"
                      value={contributionAmountStr}
                      onChange={(e) => setContributionAmountStr(e.target.value.replace(/[^0-9.,]/g, ''))}
                      onBlur={() => handleBlur(contributionAmountStr, setContributionAmountStr)}
                      className="w-full glass-input pl-9 pr-3 py-2.5 text-xs font-extrabold text-white bg-black/25 focus:bg-background"
                      placeholder="0"
                    />
                  </div>
                  <div className="col-span-2">
                    <select
                      value={contributionFrequency}
                      onChange={(e) => setContributionFrequency(e.target.value as any)}
                      className="w-full glass-input px-2.5 py-2.5 text-xs font-bold text-foreground bg-black/25 focus:bg-background cursor-pointer text-left"
                    >
                      <option value="daily">{language === 'id' ? 'Harian' : 'Daily'}</option>
                      <option value="weekly">{language === 'id' ? 'Mingguan' : 'Weekly'}</option>
                      <option value="monthly">{language === 'id' ? 'Bulanan' : 'Monthly'}</option>
                      <option value="yearly">{language === 'id' ? 'Tahunan' : 'Yearly'}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Return & Compounding */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{language === 'id' ? '3. Return & Compounding' : '3. Return & Compounding'}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={annualReturnRateStr}
                      onChange={(e) => setAnnualReturnRateStr(e.target.value)}
                      className="w-full glass-input pl-3 pr-10 py-2.5 text-xs font-bold text-white text-left bg-black/25 focus:bg-background"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                  </div>
                  <div>
                    <select
                      value={compoundingFrequency}
                      onChange={(e) => setCompoundingFrequency(e.target.value as any)}
                      className="w-full glass-input px-2.5 py-2.5 text-xs font-bold text-foreground bg-black/25 focus:bg-background cursor-pointer text-left"
                    >
                      <option value="daily">{language === 'id' ? 'Harian' : 'Daily'}</option>
                      <option value="monthly">{language === 'id' ? 'Bulanan' : 'Monthly'}</option>
                      <option value="quarterly">{language === 'id' ? 'Kuartalan' : 'Quarterly'}</option>
                      <option value="yearly">{language === 'id' ? 'Tahunan' : 'Yearly'}</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Jangka Waktu */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{language === 'id' ? '4. Jangka Waktu' : '4. Duration'}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={durationYearsStr}
                      onChange={(e) => setDurationYearsStr(e.target.value)}
                      className="w-full glass-input pl-3 pr-12 py-2.5 text-xs font-bold text-white text-left bg-black/25 focus:bg-background"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-500">{language === 'id' ? 'Thn' : 'Yrs'}</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="11"
                      value={durationMonthsStr}
                      onChange={(e) => setDurationMonthsStr(e.target.value)}
                      className="w-full glass-input pl-3 pr-12 py-2.5 text-xs font-bold text-white text-left bg-black/25 focus:bg-background"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-500">{language === 'id' ? 'Bln' : 'Mths'}</span>
                  </div>
                </div>
              </div>

              {/* Inflasi & Pajak */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{language === 'id' ? '5. Inflasi & Pajak' : '5. Inflation & Tax'}</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="50"
                      value={inflationRateStr}
                      onChange={(e) => setInflationRateStr(e.target.value)}
                      className="w-full glass-input pl-3 pr-14 py-2.5 text-xs font-bold text-white text-left bg-black/25 focus:bg-background"
                      placeholder="Inflasi"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">% Inf</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="100"
                      value={taxRateStr}
                      onChange={(e) => setTaxRateStr(e.target.value)}
                      className="w-full glass-input pl-3 pr-14 py-2.5 text-xs font-bold text-white text-left bg-black/25 focus:bg-background"
                      placeholder="Pajak"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] text-slate-500">% Paj</span>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Summary Cards (Full Width) */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 w-full">
        {isDaily ? (
          <>
            <div className="glass-card p-4.5 bg-brand-purple/5 border-brand-purple/20 overflow-hidden">
              <span className="text-[9px] font-bold text-brand-purple uppercase tracking-widest block">
                {language === 'id' ? `Modal Akhir (Hari ke-${durationDaysStr})` : `Ending Capital (Day ${durationDaysStr})`}
              </span>
              <h3 
                className="text-lg md:text-xl font-black text-brand-purple mt-1 tracking-tight truncate"
                title={formatIDR(dailyResults.nominalEndingBalance, false)}
              >
                {formatIDR(dailyResults.nominalEndingBalance, true)}
              </h3>
            </div>

            <div className="glass-card p-4.5 bg-blue-500/5 border-blue-500/20 overflow-hidden">
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block">
                {language === 'id' ? 'Return Total' : 'Total Return'}
              </span>
              <h3 
                className="text-lg md:text-xl font-black text-blue-400 mt-1 tracking-tight truncate"
                title={(() => {
                  const dailyReturnPct = dailyResults.totalDeposits > 0 
                    ? ((dailyResults.nominalEndingBalance - dailyResults.totalDeposits) / dailyResults.totalDeposits) * 100
                    : 0;
                  return formatPercentage(dailyReturnPct, false);
                })()}
              >
                {(() => {
                  const dailyReturnPct = dailyResults.totalDeposits > 0 
                    ? ((dailyResults.nominalEndingBalance - dailyResults.totalDeposits) / dailyResults.totalDeposits) * 100
                    : 0;
                  return formatPercentage(dailyReturnPct, true);
                })()}
              </h3>
            </div>

            <div className="glass-card p-4.5 border-slate-200 dark:border-white/5 overflow-hidden">
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                {language === 'id' ? 'Total Disetor' : 'Total Invested'}
              </span>
              <h3 
                className="text-lg md:text-xl font-bold text-white mt-1 tracking-tight truncate"
                title={formatIDR(dailyResults.totalDeposits, false)}
              >
                {formatIDR(dailyResults.totalDeposits, true)}
              </h3>
            </div>

            <div className="glass-card p-4.5 border-slate-200 dark:border-white/5 overflow-hidden">
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
                {language === 'id' ? 'Total Profit' : 'Total Profit'}
              </span>
              <h3 
                className="text-lg md:text-xl font-bold text-white mt-1 tracking-tight truncate"
                title={formatIDR(dailyResults.nominalEndingBalance - dailyResults.totalDeposits, false)}
              >
                {formatIDR(dailyResults.nominalEndingBalance - dailyResults.totalDeposits, true)}
              </h3>
            </div>
          </>
        ) : (
          <>
            <div className="glass-card p-4.5 bg-brand-purple/5 border-brand-purple/20 overflow-hidden">
              <span className="text-[9px] font-bold text-brand-purple uppercase tracking-widest block">
                {t('compounding.totalEndingBalance')}
              </span>
              <h3 
                className="text-lg md:text-xl font-black text-brand-purple mt-1 tracking-tight truncate"
                title={formatIDR(results.nominalEndingBalance, false)}
              >
                {formatIDR(results.nominalEndingBalance, true)}
              </h3>
            </div>

            <div className="glass-card p-4.5 bg-indigo-500/5 border-indigo-500/20 overflow-hidden">
              <span className="text-[9px] font-bold text-indigo-450 dark:text-indigo-400 uppercase tracking-widest block">
                {t('compounding.cumulativeDeposits')}
              </span>
              <h3 
                className="text-lg md:text-xl font-bold text-white mt-1 tracking-tight truncate"
                title={formatIDR(results.totalDeposits, false)}
              >
                {formatIDR(results.totalDeposits, true)}
              </h3>
            </div>

            <div className="glass-card p-4.5 bg-emerald-500/5 border-emerald-500/20 overflow-hidden">
              <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block">
                {t('compounding.cumulativeInterest')}
              </span>
              <h3 
                className="text-lg md:text-xl font-bold text-white mt-1 tracking-tight truncate"
                title={formatIDR(results.totalInterestEarned, false)}
              >
                {formatIDR(results.totalInterestEarned, true)}
              </h3>
            </div>

            <div className="glass-card p-4.5 bg-blue-500/5 border-blue-500/20 overflow-hidden border-l-2 border-l-blue-450 dark:border-l-blue-400">
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block">
                {t('compounding.realEndingBalance')}
              </span>
              <h3 
                className="text-lg md:text-xl font-black text-blue-400 mt-1 tracking-tight truncate"
                title={formatIDR(results.realEndingBalance, false)}
              >
                {formatIDR(results.realEndingBalance, true)}
              </h3>
            </div>
          </>
        )}
      </div>

      {/* Interactive Charts Area */}
      <div className="glass-card p-5 md:p-6 space-y-4 print-full-width">
        <div className="flex justify-between items-center border-b border-slate-200/50 dark:border-white/5 pb-2.5 no-print">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <TrendingUp className="h-4.5 w-4.5 text-brand-purple" />
            {language === 'id' ? 'Visualisasi Proyeksi Pertumbuhan Dana' : 'Growth Projection Visualization'}
          </h2>
          <div className="flex gap-4 text-[10px] font-semibold text-slate-500 dark:text-slate-400 select-none">
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-brand-purple" />
              <span>{language === 'id' ? 'Saldo Nominal' : 'Nominal Balance'}</span>
            </div>
            {!isDaily && (
              <div className="flex items-center gap-1.5">
                <div className="w-2.5 h-2.5 rounded bg-blue-400" />
                <span>{language === 'id' ? 'Saldo Riil (Inflasi)' : 'Real Balance (Inflation)'}</span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <div className="w-2.5 h-2.5 rounded bg-indigo-500/30 border border-indigo-400/40" />
              <span>{t('compounding.cumulativeDeposits')}</span>
            </div>
          </div>
        </div>

        {/* SVG Drawing Zone */}
        <div className="relative w-full overflow-hidden select-none bg-black/10 dark:bg-black/20 p-2 md:p-4 rounded-xl border border-slate-300/10 dark:border-white/5">
          {chartData.length === 0 ? (
            <div className="h-[300px] flex items-center justify-center text-xs text-slate-500">
              {language === 'id' ? 'Data simulasi tidak valid untuk membuat grafik.' : 'Simulation data invalid to draw chart.'}
            </div>
          ) : (
            <>
              <svg 
                ref={chartRef}
                viewBox={`0 0 ${svgWidth} ${svgHeight}`}
                className="w-full h-auto overflow-visible cursor-crosshair"
                onMouseMove={handleMouseMove}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                {/* Y-axis gridlines */}
                {[0, 0.25, 0.5, 0.75, 1].map((ratio, index) => {
                  const yVal = chartMargin.top + ratio * plotHeight;
                  const labelVal = maxY * (1 - ratio);
                  return (
                    <g key={index} opacity="0.15">
                      <line x1={chartMargin.left} y1={yVal} x2={svgWidth - chartMargin.right} y2={yVal} stroke="#94a3b8" strokeDasharray="3 3" />
                      <text x={chartMargin.left + 5} y={yVal - 4} fill="#ffffff" fontSize="9" fontWeight="bold">
                        {formatIDR(labelVal, true)}
                      </text>
                    </g>
                  );
                })}

                {/* X-axis labels (yearly/period grid ticks) */}
                {chartData.map((d, index) => {
                  const isTickPoint = chartData.length < 15 
                    || (chartData.length < 50 && index % 5 === 0) 
                    || (chartData.length >= 50 && index % 10 === 0)
                    || index === chartData.length - 1;
                  
                  if (!isTickPoint) return null;
                  const xVal = getX(index);
                  
                  return (
                    <g key={index} opacity="0.25">
                      <line x1={xVal} y1={chartMargin.top} x2={xVal} y2={svgHeight - chartMargin.bottom} stroke="#94a3b8" strokeWidth="0.5" />
                      <text x={xVal} y={svgHeight - 10} fill="#ffffff" fontSize="8.5" textAnchor="middle" fontWeight="bold">
                        {d.label.replace('Tahun ', 'T').replace('Hari ', 'H').replace('Bulan ', 'B')}
                      </text>
                    </g>
                  );
                })}

                {/* Draw Areas */}
                {/* 1. Nominal Growth Area (Violet Gradient) */}
                <path d={nominalAreaPath} fill="url(#nominalGrad)" opacity="0.12" />
                
                {/* 2. Cumulative Deposits Area (Indigo Solid) */}
                <path d={depositAreaPath} fill="url(#depositGrad)" opacity="0.08" />

                {/* Draw Lines */}
                {/* 1. Cumulative Deposit Line */}
                <path 
                  d={depositLinePath} 
                  fill="none" 
                  stroke="#6366f1" 
                  strokeWidth="1.5" 
                  strokeDasharray="4 4"
                  opacity="0.35" 
                />

                {/* 2. Nominal Growth Line */}
                <path d={nominalLinePath} fill="none" stroke="#00b15b" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round" />

                {/* 3. Real Value Line (Inflation Adjusted) */}
                {!isDaily && (
                  <path d={realLinePath} fill="none" stroke="#3b82f6" strokeWidth="2.2" strokeDasharray="3 2" strokeLinecap="round" strokeLinejoin="round" />
                )}

                {/* Hover line guide */}
                {hoveredIndex !== null && (
                  <line 
                    x1={getX(hoveredIndex)} 
                    y1={chartMargin.top} 
                    x2={getX(hoveredIndex)} 
                    y2={svgHeight - chartMargin.bottom} 
                    stroke="#00b15b" 
                    strokeWidth="1.2" 
                    opacity="0.4"
                  />
                )}

                {/* Hover points */}
                {hoveredIndex !== null && (
                  <g>
                    {/* Nominal Point */}
                    <circle 
                      cx={getX(hoveredIndex)} 
                      cy={getY(chartData[hoveredIndex].endingBalance)} 
                      r="5.5" 
                      fill="#00b15b" 
                      stroke="#ffffff" 
                      strokeWidth="1.5" 
                    />
                    {/* Real Value Point */}
                    {!isDaily && (
                      <circle 
                        cx={getX(hoveredIndex)} 
                        cy={getY(chartData[hoveredIndex].realEndingBalance)} 
                        r="4" 
                        fill="#3b82f6" 
                        stroke="#ffffff" 
                        strokeWidth="1.2" 
                      />
                    )}
                    {/* Deposit Point */}
                    <circle 
                      cx={getX(hoveredIndex)} 
                      cy={getY(chartData[hoveredIndex].cumulativeDeposits)} 
                      r="4" 
                      fill="#6366f1" 
                      stroke="#ffffff" 
                      strokeWidth="1.2" 
                    />
                  </g>
                )}

                {/* Definitions for SVG gradients */}
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

              {/* Dynamic Interactive Tooltip */}
              {hoveredIndex !== null && (
                <div className="absolute top-2 left-2 md:top-4 md:left-4 p-3 bg-slate-950/95 border border-[#00b15b]/30 rounded-xl shadow-xl z-20 space-y-1 font-mono text-[10px] text-slate-350 max-w-[280px] backdrop-blur-md animate-fadeIn">
                  <div className="font-extrabold text-white border-b border-white/5 pb-1 uppercase tracking-wider">
                    {chartData[hoveredIndex].label}
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span>{language === 'id' ? 'Nominal Saldo' : 'Nominal Balance'}:</span>
                    <strong className="text-[#05fa7b] font-bold">{formatIDR(chartData[hoveredIndex].endingBalance)}</strong>
                  </div>
                  {!isDaily && (
                    <div className="flex justify-between items-center gap-4">
                      <span>{language === 'id' ? 'Saldo Riil (Net)' : 'Real Balance (Net)'}:</span>
                      <strong className="text-blue-400 font-bold">{formatIDR(chartData[hoveredIndex].realEndingBalance)}</strong>
                    </div>
                  )}
                  <div className="flex justify-between items-center gap-4 border-t border-white/5 pt-1 mt-1">
                    <span>{language === 'id' ? 'Total Disetor' : 'Total Deposited'}:</span>
                    <strong className="text-slate-200 font-bold">{formatIDR(chartData[hoveredIndex].cumulativeDeposits)}</strong>
                  </div>
                  <div className="flex justify-between items-center gap-4">
                    <span>{language === 'id' ? 'Total Profit' : 'Total Profit'}:</span>
                    <strong className="text-white font-bold">{formatIDR(chartData[hoveredIndex].cumulativeInterest)}</strong>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>

      {/* Projection Table Card */}
      <div className="glass-card p-5 md:p-6 space-y-4">
        
        {/* Table Controls (Title and switch layout) */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-3">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-brand-purple" />
            {language === 'id' ? 'Tabel Rincian Akumulasi Saldo' : 'Balance Accumulation Details Table'}
          </h2>
          
          {!isDaily && (
            <div className="flex bg-input-bg border border-border-color p-0.5 rounded-xl text-[10px] font-bold no-print select-none">
              <button
                onClick={() => setTableType('yearly')}
                className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
                  tableType === 'yearly' ? 'bg-brand-purple text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {language === 'id' ? 'Tahunan' : 'Yearly'}
              </button>
              <button
                onClick={() => setTableType('monthly')}
                className={`py-1.5 px-3 rounded-lg transition-all cursor-pointer text-center ${
                  tableType === 'monthly' ? 'bg-brand-purple text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                {language === 'id' ? 'Bulanan' : 'Monthly'} ({results.monthlyDetails.length})
              </button>
            </div>
          )}
        </div>

        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-1">
          <table className="w-full text-left text-xs border-collapse whitespace-nowrap">
            <thead>
              {isDaily ? (
                <tr className="border-b border-border-color text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-3 px-2">{language === 'id' ? 'Hari' : 'Day'}</th>
                  <th className="py-3 px-2 text-right">{language === 'id' ? 'Modal Awal Hari' : 'Start Balance'}</th>
                  {parseFormattedNumber(contributionAmountStr) > 0 && <th className="py-3 px-2 text-right">{language === 'id' ? 'Setoran Harian' : 'Daily Deposit'}</th>}
                  <th className="py-3 px-2 text-right text-emerald-400">Profit ({annualReturnRateStr}%)</th>
                  <th className="py-3 px-2 text-right text-blue-400">{language === 'id' ? 'Akumulasi %' : 'Cumulative %'}</th>
                  {parseFloat(taxRateStr) > 0 && <th className="py-3 px-2 text-right text-rose-400">{language === 'id' ? 'Pajak' : 'Tax'}</th>}
                  <th className="py-3 px-2 text-right text-brand-purple">{language === 'id' ? 'Modal Akhir Hari' : 'End Balance'}</th>
                </tr>
              ) : (
                <tr className="border-b border-border-color text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-3 px-2">{language === 'id' ? 'Periode' : 'Period'}</th>
                  <th className="py-3 px-2 text-right">{language === 'id' ? 'Saldo Awal' : 'Start Balance'}</th>
                  <th className="py-3 px-2 text-right">{language === 'id' ? 'Total Setoran' : 'Total Deposit'}</th>
                  <th className="py-3 px-2 text-right">{language === 'id' ? 'Bunga Kotor' : 'Gross Interest'}</th>
                  {input.taxRate > 0 && <th className="py-3 px-2 text-right text-rose-400">{language === 'id' ? 'Pajak' : 'Tax'}</th>}
                  <th className="py-3 px-2 text-right text-brand-purple">{language === 'id' ? 'Saldo Akhir' : 'Ending Balance'}</th>
                  {input.inflationRate > 0 && <th className="py-3 px-2 text-right text-blue-400">{language === 'id' ? 'Saldo Riil' : 'Real Balance'}</th>}
                </tr>
              )}
            </thead>
            <tbody className="divide-y divide-border-color/30 font-medium">
              {isDaily ? (
                dailyResults.details.map((d, i) => (
                  <tr key={i} className="hover:bg-white/2 dark:hover:bg-white/2 transition-colors text-[11px]">
                    <td className="py-2.5 px-2 font-bold text-slate-200">{d.period}</td>
                    <td className="py-2.5 px-2 text-right text-slate-300">{formatIDR(d.startingBalance)}</td>
                    {parseFormattedNumber(contributionAmountStr) > 0 && (
                      <td className="py-2.5 px-2 text-right text-indigo-400">+{formatIDR(d.deposit)}</td>
                    )}
                    <td className="py-2.5 px-2 text-right text-emerald-400">+{formatIDR(d.interestEarned)}</td>
                    <td className="py-2.5 px-2 text-right text-blue-400 font-semibold">
                      {(() => {
                        const cumPct = d.cumulativeDeposits > 0 
                          ? ((d.endingBalance - d.cumulativeDeposits) / d.cumulativeDeposits) * 100
                          : 0;
                        const sign = cumPct >= 0 ? '+' : '';
                        return `${sign}${cumPct.toFixed(2).replace('.', ',')}%`;
                      })()}
                    </td>
                    {parseFloat(taxRateStr) > 0 && (
                      <td className="py-2.5 px-2 text-right text-rose-400">-{formatIDR(d.taxDeducted)}</td>
                    )}
                    <td className="py-2.5 px-2 text-right font-bold text-white">{formatIDR(d.endingBalance)}</td>
                  </tr>
                ))
              ) : tableType === 'yearly' ? (
                results.yearlySummaries.map((y, i) => (
                  <tr key={i} className="hover:bg-white/2 dark:hover:bg-white/2 transition-colors">
                    <td className="py-2.5 px-2 font-bold text-slate-200">{language === 'id' ? `Tahun ${y.year}` : `Year ${y.year}`}</td>
                    <td className="py-2.5 px-2 text-right text-slate-300">{formatIDR(y.startingBalance)}</td>
                    <td className="py-2.5 px-2 text-right text-indigo-400">+{formatIDR(y.totalDeposits)}</td>
                    <td className="py-2.5 px-2 text-right text-emerald-400">+{formatIDR(y.totalInterestEarned)}</td>
                    {input.taxRate > 0 && (
                      <td className="py-2.5 px-2 text-right text-rose-400">-{formatIDR(y.totalTaxDeducted)}</td>
                    )}
                    <td className="py-2.5 px-2 text-right font-bold text-white">{formatIDR(y.endingBalance)}</td>
                    {input.inflationRate > 0 && (
                      <td className="py-2.5 px-2 text-right font-semibold text-blue-400">{formatIDR(y.realEndingBalance)}</td>
                    )}
                  </tr>
                ))
              ) : (
                results.monthlyDetails.map((m, i) => (
                  <tr key={i} className="hover:bg-white/2 dark:hover:bg-white/2 transition-colors text-[11px]">
                    <td className="py-2 px-2 text-slate-300 font-semibold">{language === 'id' ? `T${m.year} - Bln ${m.month} (${m.period})` : `Y${m.year} - Mth ${m.month} (${m.period})`}</td>
                    <td className="py-2 px-2 text-right text-slate-300">{formatIDR(m.startingBalance)}</td>
                    <td className="py-2 px-2 text-right text-indigo-400">+{formatIDR(m.deposit)}</td>
                    <td className="py-2 px-2 text-right text-emerald-400">+{formatIDR(m.interestEarned)}</td>
                    {input.taxRate > 0 && (
                      <td className="py-2 px-2 text-right text-rose-400">-{formatIDR(m.taxDeducted)}</td>
                    )}
                    <td className="py-2 px-2 text-right font-bold text-white">{formatIDR(m.endingBalance)}</td>
                    {input.inflationRate > 0 && (
                      <td className="py-2 px-2 text-right font-semibold text-blue-400">{formatIDR(m.realEndingBalance)}</td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Saved Compounding Plans List */}
      <div className="glass-card p-5 md:p-6 no-print">
        <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-3 mb-4">
          <Database className="h-4.5 w-4.5 text-brand-purple" />
          {language === 'id' ? 'Rencana Compounding Tersimpan' : 'Saved Compounding Plans'}
        </h2>

        {isLoadingPlans ? (
          <div className="py-8 text-center text-xs text-slate-400">
            {language === 'id' ? 'Memuat rencana simpanan...' : 'Loading saved plans...'}
          </div>
        ) : savedPlans.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-border-color rounded-xl">
            {language === 'id' ? 'Belum ada rencana compounding yang disimpan.' : 'No saved compounding plans found.'}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedPlans.map((plan: any) => (
              <div 
                key={plan.id}
                className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 rounded-xl border border-border-color bg-black/10 hover:border-brand-purple/40 hover:bg-black/20 transition-all group"
              >
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 group-hover:text-brand-purple transition-colors">
                    {plan.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    {language === 'id' ? 'Awal' : 'Initial'}: <strong>{formatIDR(Number(plan.initial_amount))}</strong> • {language === 'id' ? 'Rutin' : 'Regular'}: <strong>{formatIDR(Number(plan.contribution_amount))} ({plan.compounding_frequency === 'trading_daily' ? (language === 'id' ? 'Hari' : 'Day') : plan.contribution_frequency === 'monthly' ? (language === 'id' ? 'Bulan' : 'Month') : plan.contribution_frequency === 'yearly' ? (language === 'id' ? 'Tahun' : 'Year') : plan.contribution_frequency === 'weekly' ? (language === 'id' ? 'Minggu' : 'Week') : (language === 'id' ? 'Hari' : 'Day')})</strong> • Return: <strong>{plan.annual_return_rate}%</strong>
                  </p>
                  <p className="text-[9px] text-slate-400/70">
                    {language === 'id' ? 'Durasi' : 'Duration'}: {plan.compounding_frequency === 'trading_daily' ? `${plan.duration_months} ${language === 'id' ? 'Hari' : 'Days'}` : `${plan.duration_years} ${language === 'id' ? 'Tahun' : 'Years'} ${plan.duration_months} ${language === 'id' ? 'Bulan' : 'Months'}`} • Compounding: {plan.compounding_frequency === 'trading_daily' ? (language === 'id' ? 'Harian' : 'Daily') : plan.compounding_frequency}
                  </p>
                </div>

                <div className="flex items-center gap-2 self-end sm:self-auto">
                  <button
                    onClick={() => handleLoadPlan(plan)}
                    className="py-1.5 px-3 rounded-lg bg-brand-purple/10 border border-brand-purple/20 hover:bg-brand-purple/20 text-brand-purple font-extrabold text-[10px] transition-colors cursor-pointer select-none"
                  >
                    {language === 'id' ? 'Muat' : 'Load'}
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id, plan.title)}
                    className="p-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title={language === 'id' ? 'Hapus Rencana' : 'Delete Plan'}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Save Plan Dialog Modal */}
      <AnimatePresence>
        {isSaveModalOpen && (
          <>
            {/* Backdrop */}
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.5 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSaveModalOpen(false)}
              className="fixed inset-0 bg-black z-50 no-print"
            />
            {/* Modal Box */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="fixed inset-x-4 top-[25%] md:inset-x-auto md:left-1/2 md:-translate-x-1/2 md:w-[420px] bg-sidebar-bg border border-border-color rounded-2xl p-6 z-50 shadow-2xl text-white no-print"
            >
              <h3 className="text-base font-extrabold flex items-center gap-2 mb-2">
                <Save className="h-5 w-5 text-brand-purple" />
                {language === 'id' ? 'Simpan Rencana Simulasi' : 'Save Simulation Plan'}
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                {language === 'id' ? 'Simpan parameter compounding ini agar dapat dimuat kembali secara instan di masa depan.' : 'Save these compounding parameters to reload them instantly in the future.'}
              </p>

              <form onSubmit={handleSavePlan} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    {language === 'id' ? 'Judul Rencana / Target Simulasi' : 'Plan Title / Simulation Target'}
                  </label>
                  <input
                    type="text"
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    placeholder={language === 'id' ? 'Contoh: Dana Pensiun Umur 55' : 'e.g. Pension Fund Age 55'}
                    className="w-full glass-input px-3.5 py-2.5 text-xs font-bold"
                    maxLength={100}
                    required
                    autoFocus
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
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-brand-purple text-white hover:bg-brand-purple/95 transition-all shadow-md cursor-pointer hover:scale-[1.02] active:scale-[0.98] flex items-center gap-1.5"
                  >
                    {isSaving ? (
                      <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    ) : null}
                    <span>{t('common.save')}</span>
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Floating Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className={`fixed bottom-6 right-6 z-50 px-5 py-3.5 rounded-xl border shadow-xl flex items-center gap-3 backdrop-blur-md text-xs font-bold no-print ${
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
