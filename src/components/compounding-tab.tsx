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

interface CompoundingTabProps {
  user: any;
  onSignInClick: () => void;
}

// Helpers for parsing and formatting numbers
const parseFormattedNumber = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = val.replace(/,/g, '');
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
    fetchSavedPlans();
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
            Kalkulator Compounding
            <Sparkles className="h-6 w-6 text-brand-purple animate-pulse shrink-0" />
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 mt-1">
            Simulasikan efek bunga majemuk, setoran berkala, pajak investasi, serta penyesuaian daya beli riil terhadap inflasi secara dinamis.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2.5">
          <button 
            onClick={() => setIsSaveModalOpen(true)}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-brand-purple hover:bg-brand-purple/95 text-white font-bold text-xs shadow-md transition-all cursor-pointer hover:scale-[1.02] active:scale-[0.98]"
          >
            <Save className="h-4 w-4" />
            <span>Simpan Rencana</span>
          </button>
          <button 
            onClick={handleExportExcel}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-input-bg border border-border-color hover:bg-glass-border text-foreground font-bold text-xs transition-all cursor-pointer"
          >
            <Download className="h-4 w-4 text-brand-purple" />
            <span>Ekspor Excel</span>
          </button>
          <button 
            onClick={handlePrint}
            className="flex items-center gap-2 py-2.5 px-4 rounded-xl bg-input-bg border border-border-color hover:bg-glass-border text-foreground font-bold text-xs transition-all cursor-pointer"
          >
            <Printer className="h-4 w-4 text-brand-purple" />
            <span>Cetak PDF</span>
          </button>
        </div>
      </div>

      {/* Database Tip Alert */}
      {!isSupabaseConfigured && (
        <div className="p-4.5 rounded-2xl bg-brand-purple/5 border border-brand-purple/20 text-slate-600 dark:text-slate-300 text-xs flex gap-3 shadow-sm no-print">
          <Info className="h-5 w-5 text-brand-purple shrink-0 mt-0.5" />
          <div>
            <span className="font-bold text-slate-800 dark:text-white">Tips Mode Uji Coba:</span>
            <p className="mt-1">
              Aplikasi belum terhubung dengan database PostgreSQL Supabase. 
              Penyimpanan rencana compounding akan dialihkan menggunakan simulasi lokal (*localStorage* browser). 
              Anda tetap dapat menggunakan seluruh fitur secara penuh.
            </p>
          </div>
        </div>
      )}

      {/* Mode Selector Toggle */}
      <div className="flex bg-input-bg border border-border-color p-1 rounded-2xl text-[11px] font-extrabold max-w-md no-print select-none">
        <button
          onClick={() => {
            setCalcMode('daily');
            if (annualReturnRateStr === '10') setAnnualReturnRateStr('5');
            if (contributionAmountStr === '1,000,000') setContributionAmountStr('0');
          }}
          className={`flex-1 py-2 rounded-xl transition-all cursor-pointer text-center ${
            calcMode === 'daily' ? 'bg-brand-purple text-white shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          Rencana Trading Harian
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
          Investasi Jangka Panjang
        </button>
      </div>

      {/* Parameter Form Box (Full Width, Horizontal Layout) */}
      <div className="glass-card p-5 md:p-6 space-y-4 no-print w-full">
        <h2 className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-2">
          <Calendar className="h-4.5 w-4.5 text-brand-purple" />
          Input Parameter ({isDaily ? 'Trading Harian' : 'Jangka Panjang'})
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 items-end">
          {isDaily ? (
            <>
              {/* Modal Investasi Awal */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">1. Modal Awal (Rp)</label>
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">2. Target Profit / Hari</label>
                <div className="relative">
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={annualReturnRateStr}
                    onChange={(e) => setAnnualReturnRateStr(e.target.value)}
                    className="w-full glass-input pl-3 pr-8 py-2.5 text-xs font-bold text-white text-center bg-black/25 focus:bg-background"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                </div>
              </div>

              {/* Durasi (Hari) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">3. Durasi (Hari)</label>
                <div className="relative">
                  <input
                    type="number"
                    min="1"
                    max="1000"
                    value={durationDaysStr}
                    onChange={(e) => setDurationDaysStr(e.target.value)}
                    className="w-full glass-input px-3 py-2.5 text-xs font-bold text-white text-center bg-black/25 focus:bg-background"
                  />
                </div>
              </div>

              {/* Setoran Tambahan Harian (Rp) */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">4. Setoran Tambahan / Hari (Rp) - Opsional</label>
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">5. Broker Fee</label>
                <select
                  value={dailyBrokerPreset}
                  onChange={(e) => handleDailyPresetChange(e.target.value)}
                  className="w-full glass-input px-3 py-2.5 text-xs font-bold cursor-pointer text-foreground bg-background text-center"
                >
                  <option value="stockbit">Stockbit (Buy 0.15% / Sell 0.25%)</option>
                  <option value="ajaib">Ajaib (Buy 0.15% / Sell 0.25%)</option>
                  <option value="ipot">IPOT (Buy 0.19% / Sell 0.29%)</option>
                  <option value="custom">Custom Fee</option>
                  <option value="none">Tanpa Fee (0.00%)</option>
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
                      <span className="text-[8px] text-slate-500 text-center block mt-0.5">Fee Beli</span>
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
                      <span className="text-[8px] text-slate-500 text-center block mt-0.5">Fee Jual</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              {/* Modal Investasi Awal */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">1. Modal Awal (Rp)</label>
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
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">2. Setoran Rutin</label>
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
                      className="w-full glass-input px-1 py-2.5 text-xs font-bold text-foreground bg-black/25 focus:bg-background cursor-pointer text-center"
                    >
                      <option value="daily">Harian</option>
                      <option value="weekly">Mingguan</option>
                      <option value="monthly">Bulanan</option>
                      <option value="yearly">Tahunan</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Return & Compounding */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">3. Return & Compounding</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={annualReturnRateStr}
                      onChange={(e) => setAnnualReturnRateStr(e.target.value)}
                      className="w-full glass-input pl-3 pr-8 py-2.5 text-xs font-bold text-white text-center bg-black/25 focus:bg-background"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">%</span>
                  </div>
                  <div>
                    <select
                      value={compoundingFrequency}
                      onChange={(e) => setCompoundingFrequency(e.target.value as any)}
                      className="w-full glass-input px-1.5 py-2.5 text-xs font-bold text-foreground bg-black/25 focus:bg-background cursor-pointer text-center"
                    >
                      <option value="daily">Harian</option>
                      <option value="monthly">Bulanan</option>
                      <option value="quarterly">Kuartalan</option>
                      <option value="yearly">Tahunan</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Jangka Waktu */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">4. Jangka Waktu</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={durationYearsStr}
                      onChange={(e) => setDurationYearsStr(e.target.value)}
                      className="w-full glass-input pl-3 pr-10 py-2.5 text-xs font-bold text-white text-center bg-black/25 focus:bg-background"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-500">Thn</span>
                  </div>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      max="11"
                      value={durationMonthsStr}
                      onChange={(e) => setDurationMonthsStr(e.target.value)}
                      className="w-full glass-input pl-3 pr-10 py-2.5 text-xs font-bold text-white text-center bg-black/25 focus:bg-background"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[9px] font-semibold text-slate-500">Bln</span>
                  </div>
                </div>
              </div>

              {/* Inflasi & Pajak */}
              <div className="flex flex-col gap-1.5">
                <label className="text-[10px] font-bold uppercase tracking-wider text-slate-500">5. Inflasi & Pajak</label>
                <div className="grid grid-cols-2 gap-1.5">
                  <div className="relative">
                    <input
                      type="number"
                      step="0.1"
                      min="0"
                      max="50"
                      value={inflationRateStr}
                      onChange={(e) => setInflationRateStr(e.target.value)}
                      className="w-full glass-input pl-3 pr-12 py-2.5 text-xs font-bold text-white text-center bg-black/25 focus:bg-background"
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
                      className="w-full glass-input pl-3 pr-12 py-2.5 text-xs font-bold text-white text-center bg-black/25 focus:bg-background"
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
                Modal Akhir (Hari ke-{durationDaysStr})
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
                Return Total
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
                Total Disetor
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
                Total Profit
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
              <span className="text-[9px] font-bold text-brand-purple uppercase tracking-widest block">Total Nilai Akhir</span>
              <h3 
                className="text-lg md:text-xl font-black text-brand-purple mt-1 tracking-tight truncate"
                title={formatIDR(results.nominalEndingBalance, false)}
              >
                {formatIDR(results.nominalEndingBalance, true)}
              </h3>
            </div>

            <div className="glass-card p-4.5 bg-blue-500/5 border-blue-500/20 overflow-hidden">
              <span className="text-[9px] font-bold text-blue-400 uppercase tracking-widest block">Nilai Riil (Inflasi)</span>
              <h3 
                className="text-lg md:text-xl font-black text-blue-400 mt-1 tracking-tight truncate"
                title={formatIDR(results.realEndingBalance, false)}
              >
                {formatIDR(results.realEndingBalance, true)}
              </h3>
            </div>

            <div className="glass-card p-4.5 border-slate-200 dark:border-white/5 overflow-hidden">
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Total Disetor</span>
              <h3 
                className="text-lg md:text-xl font-bold text-white mt-1 tracking-tight truncate"
                title={formatIDR(results.totalDeposits, false)}
              >
                {formatIDR(results.totalDeposits, true)}
              </h3>
            </div>

            <div className="glass-card p-4.5 border-slate-200 dark:border-white/5 overflow-hidden">
              <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">Hasil Bunga Bersih</span>
              <h3 
                className="text-lg md:text-xl font-bold text-white mt-1 tracking-tight truncate"
                title={formatIDR(results.nominalEndingBalance - results.totalDeposits, false)}
              >
                {formatIDR(results.nominalEndingBalance - results.totalDeposits, true)}
              </h3>
            </div>
          </>
        )}
      </div>

      {/* Interactive SVG Chart Card (Full Width) */}
      <div className="glass-card p-5 md:p-6 bg-card-bg relative overflow-hidden flex flex-col no-print w-full">
        <h3 className="text-xs font-bold uppercase tracking-widest text-slate-400 mb-4.5 flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-2">
          <TrendingUp className="h-4.5 w-4.5 text-brand-purple" />
          Proyeksi Pertumbuhan Dana Investasi
        </h3>

        {/* Custom Interactive SVG Graph */}
        <div className="relative -mx-5 md:-mx-6 h-[300px] w-[calc(100%+2.5rem)] md:w-[calc(100%+3rem)]">
          <svg 
            ref={chartRef}
            viewBox={`0 0 ${svgWidth} ${svgHeight}`} 
            width="100%" 
            height="100%" 
            className="overflow-visible select-none"
            onMouseMove={handleMouseMove}
            onMouseLeave={() => setHoveredIndex(null)}
          >
            {/* Defs for gradients & clip-paths */}
            <defs>
              <linearGradient id="chartNominalGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#00b15b" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="#00b15b" stopOpacity="0.0"/>
              </linearGradient>
              <linearGradient id="chartDepositGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#4f46e5" stopOpacity="0.2"/>
                <stop offset="100%" stopColor="#4f46e5" stopOpacity="0.0"/>
              </linearGradient>
            </defs>

            {/* Horizontal Grid lines */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const y = chartMargin.top + ratio * plotHeight;
              return (
                <line 
                  key={i}
                  x1={chartMargin.left} 
                  y1={y} 
                  x2={svgWidth - chartMargin.right} 
                  y2={y} 
                  stroke="rgba(255,255,255,0.05)" 
                  strokeWidth="1"
                />
              );
            })}

            {/* Areas */}
            <path d={nominalAreaPath} fill="url(#chartNominalGrad)" />
            <path d={depositAreaPath} fill="url(#chartDepositGrad)" />

            {/* Lines */}
            <path d={nominalLinePath} fill="none" stroke="#00b15b" strokeWidth="2.5" />
            <path d={depositAreaPath.replace(/ Z$/, '')} fill="none" stroke="#4f46e5" strokeWidth="2" strokeDasharray="2 2" />
            {!isDaily && input.inflationRate > 0 && (
              <path d={realLinePath} fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeDasharray="4 4" />
            )}

            {chartData.map((d, i) => {
              const total = chartData.length;
              const step = Math.max(1, Math.ceil(total / 6));
              if (i % step !== 0 && i !== total - 1) return null;
              
              let anchor: "start" | "middle" | "end" = "middle";
              let xPos = getX(i);
              if (i === 0) {
                anchor = "start";
                xPos += 20;
              } else if (i === total - 1) {
                anchor = "end";
                xPos -= 20;
              }

              return (
                <text
                  key={i}
                  x={xPos}
                  y={svgHeight - 10}
                  fill="rgba(255,255,255,0.4)"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor={anchor}
                >
                  {d.label}
                </text>
              );
            })}

            {/* Y-Axis values */}
            {[0, 0.25, 0.5, 0.75, 1].map((ratio, i) => {
              const val = (1 - ratio) * maxY;
              const y = chartMargin.top + ratio * plotHeight;
              
              // Clean formatting of large numbers (e.g. 1.2M, 500K)
              let formatted = '';
              if (val >= 1000000000) {
                formatted = `Rp ${(val / 1000000000).toFixed(1)}M`;
              } else if (val >= 1000000) {
                formatted = `Rp ${(val / 1000000).toFixed(1)}Jt`;
              } else if (val >= 1000) {
                formatted = `Rp ${(val / 1000).toFixed(0)}Rb`;
              } else {
                formatted = `Rp ${val.toFixed(0)}`;
              }

              return (
                <text
                  key={i}
                  x={10}
                  y={y - 6}
                  fill="rgba(255,255,255,0.55)"
                  fontSize="9"
                  fontWeight="bold"
                  textAnchor="start"
                >
                  {formatted}
                </text>
              );
            })}

            {/* Hover vertical line and intersection dots */}
            {hoveredIndex !== null && hoveredIndex < chartData.length && (
              <>
                <line 
                  x1={getX(hoveredIndex)}
                  y1={chartMargin.top}
                  x2={getX(hoveredIndex)}
                  y2={svgHeight - chartMargin.bottom}
                  stroke="rgba(255, 255, 255, 0.2)"
                  strokeWidth="1.5"
                  strokeDasharray="3 3"
                  className="pointer-events-none"
                />

                {/* Nominal Dot */}
                <circle 
                  cx={getX(hoveredIndex)}
                  cy={getY(chartData[hoveredIndex].endingBalance)}
                  r="5.5"
                  fill="#00b15b"
                  stroke="#121518"
                  strokeWidth="2"
                  className="pointer-events-none"
                />

                {/* Deposits Dot */}
                <circle 
                  cx={getX(hoveredIndex)}
                  cy={getY(chartData[hoveredIndex].cumulativeDeposits)}
                  r="4.5"
                  fill="#4f46e5"
                  stroke="#121518"
                  strokeWidth="1.5"
                  className="pointer-events-none"
                />

                {/* Real Value Dot */}
                {!isDaily && input.inflationRate > 0 && (
                  <circle 
                    cx={getX(hoveredIndex)}
                    cy={getY(chartData[hoveredIndex].realEndingBalance)}
                    r="4.5"
                    fill="#3b82f6"
                    stroke="#121518"
                    strokeWidth="1.5"
                    className="pointer-events-none"
                  />
                )}
              </>
            )}
          </svg>

          {/* Float HTML Tooltip Box on Hover */}
          {hoveredIndex !== null && hoveredIndex < chartData.length && (
            <div 
              className="absolute z-10 p-3 bg-slate-900/95 border border-white/10 rounded-xl shadow-2xl text-[10px] space-y-1.5 backdrop-blur-md pointer-events-none"
              style={{
                left: `${Math.min(85, Math.max(15, (getX(hoveredIndex) * 100) / svgWidth))}%`,
                top: '15px',
                transform: 'translateX(-50%)',
                minWidth: '220px',
                width: 'max-content'
              }}
            >
              <p className="font-extrabold text-white text-center pb-1 border-b border-white/5 uppercase tracking-wider">
                {chartData[hoveredIndex].label}
              </p>
              <div className="flex justify-between items-baseline">
                <span className="text-slate-400">Total Nominal:</span>
                <span className="font-bold text-brand-purple">{formatIDR(chartData[hoveredIndex].endingBalance)}</span>
              </div>
              {!isDaily && input.inflationRate > 0 && (
                <div className="flex justify-between items-baseline text-blue-400">
                  <span>Nilai Riil:</span>
                  <span className="font-bold">{formatIDR(chartData[hoveredIndex].realEndingBalance)}</span>
                </div>
              )}
              <div className="flex justify-between items-baseline text-indigo-400">
                <span>Modal Disetor:</span>
                <span className="font-bold">{formatIDR(chartData[hoveredIndex].cumulativeDeposits)}</span>
              </div>
              <div className="flex justify-between items-baseline text-slate-300">
                <span>{isDaily ? 'Total Profit:' : 'Hasil Bunga:'}</span>
                <span className="font-bold text-slate-100">
                  {formatIDR(Math.max(0, chartData[hoveredIndex].endingBalance - chartData[hoveredIndex].cumulativeDeposits))}
                </span>
              </div>
            </div>
          )}
        </div>

        {/* Legends */}
        <div className="flex justify-center items-center gap-6 text-[10px] font-bold text-slate-400 mt-2 select-none">
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-brand-purple" />
            <span>{isDaily ? 'Modal Akhir Hari' : 'Nilai Akhir Nominal'}</span>
          </div>
          {!isDaily && input.inflationRate > 0 && (
            <div className="flex items-center gap-1.5">
              <span className="w-3 h-1.5 rounded-full bg-blue-400" />
              <span>Nilai Riil (Disesuaikan Inflasi {input.inflationRate}%)</span>
            </div>
          )}
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-1.5 rounded-full bg-indigo-500" />
            <span>{isDaily ? 'Total Modal + Setoran' : 'Total Modal Disetor'}</span>
          </div>
        </div>
      </div>

      {/* Amortization Table */}
      <div className="glass-card p-5 md:p-6 print-full-width">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3 border-b border-slate-200/50 dark:border-white/5 pb-3 mb-4">
          <h2 className="text-xs font-bold uppercase tracking-widest text-slate-400 flex items-center gap-2">
            <FileText className="h-4.5 w-4.5 text-brand-purple animate-pulse" />
            {isDaily ? 'Tabel Simulasi Compounding Harian' : 'Jadwal Rincian Saldo Pertumbuhan'}
          </h2>
          
          {/* Table Toggles */}
          {!isDaily && (
            <div className="flex bg-input-bg border border-border-color p-1 rounded-xl text-[10px] font-extrabold no-print">
              <button
                onClick={() => setTableType('yearly')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  tableType === 'yearly' ? 'bg-brand-purple text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Tahunan
              </button>
              <button
                onClick={() => setTableType('monthly')}
                className={`px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                  tableType === 'monthly' ? 'bg-brand-purple text-white shadow-sm' : 'text-slate-400 hover:text-white'
                }`}
              >
                Bulanan ({results.monthlyDetails.length})
              </button>
            </div>
          )}
        </div>

        {/* Responsive Table Wrapper */}
        <div className="overflow-x-auto max-h-[400px] overflow-y-auto pr-1">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              {isDaily ? (
                <tr className="border-b border-border-color text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-3 px-2">Hari</th>
                  <th className="py-3 px-2 text-right">Modal Awal Hari</th>
                  {parseFormattedNumber(contributionAmountStr) > 0 && <th className="py-3 px-2 text-right">Setoran Harian</th>}
                  <th className="py-3 px-2 text-right text-emerald-400">Profit ({annualReturnRateStr}%)</th>
                  <th className="py-3 px-2 text-right text-blue-400">Akumulasi %</th>
                  {parseFloat(taxRateStr) > 0 && <th className="py-3 px-2 text-right text-rose-400">Pajak</th>}
                  <th className="py-3 px-2 text-right text-brand-purple">Modal Akhir Hari</th>
                </tr>
              ) : (
                <tr className="border-b border-border-color text-slate-500 font-bold uppercase tracking-wider text-[9px]">
                  <th className="py-3 px-2">Periode</th>
                  <th className="py-3 px-2 text-right">Saldo Awal</th>
                  <th className="py-3 px-2 text-right">Total Setoran</th>
                  <th className="py-3 px-2 text-right">Bunga Kotor</th>
                  {input.taxRate > 0 && <th className="py-3 px-2 text-right text-rose-400">Pajak</th>}
                  <th className="py-3 px-2 text-right text-brand-purple">Saldo Akhir</th>
                  {input.inflationRate > 0 && <th className="py-3 px-2 text-right text-blue-400">Saldo Riil</th>}
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
                    <td className="py-2.5 px-2 font-bold text-slate-200">Tahun {y.year}</td>
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
                    <td className="py-2 px-2 text-slate-300 font-semibold">T{m.year} - Bln {m.month} ({m.period})</td>
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
          Rencana Compounding Tersimpan
        </h2>

        {isLoadingPlans ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Memuat rencana simpanan...
          </div>
        ) : savedPlans.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-500 border border-dashed border-border-color rounded-xl">
            Belum ada rencana compounding yang disimpan.
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {savedPlans.map((plan: any) => (
              <div 
                key={plan.id}
                className="flex items-center justify-between p-4 rounded-xl border border-border-color bg-black/10 hover:border-brand-purple/40 hover:bg-black/20 transition-all group"
              >
                <div className="space-y-1">
                  <h4 className="font-extrabold text-sm text-slate-800 dark:text-slate-200 group-hover:text-brand-purple transition-colors">
                    {plan.title}
                  </h4>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400">
                    Awal: <strong>{formatIDR(Number(plan.initial_amount))}</strong> • Rutin: <strong>{formatIDR(Number(plan.contribution_amount))} ({plan.compounding_frequency === 'trading_daily' ? 'Hari' : plan.contribution_frequency === 'monthly' ? 'Bulan' : plan.contribution_frequency === 'yearly' ? 'Tahun' : plan.contribution_frequency === 'weekly' ? 'Minggu' : 'Hari'})</strong> • Return: <strong>{plan.annual_return_rate}%</strong>
                  </p>
                  <p className="text-[9px] text-slate-400/70">
                    Durasi: {plan.compounding_frequency === 'trading_daily' ? `${plan.duration_months} Hari` : `${plan.duration_years} Tahun ${plan.duration_months} Bulan`} • Compounding: {plan.compounding_frequency === 'trading_daily' ? 'Harian' : plan.compounding_frequency}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() => handleLoadPlan(plan)}
                    className="py-1.5 px-3 rounded-lg bg-brand-purple/10 border border-brand-purple/20 hover:bg-brand-purple/20 text-brand-purple font-extrabold text-[10px] transition-colors cursor-pointer select-none"
                  >
                    Muat
                  </button>
                  <button
                    onClick={() => handleDeletePlan(plan.id, plan.title)}
                    className="p-2 text-rose-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors cursor-pointer"
                    title="Hapus Rencana"
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
                Simpan Rencana Simulasi
              </h3>
              <p className="text-xs text-slate-400 mb-5">
                Simpan parameter compounding ini agar dapat dimuat kembali secara instan di masa depan.
              </p>

              <form onSubmit={handleSavePlan} className="space-y-4">
                <div className="flex flex-col gap-1.5">
                  <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Judul Rencana / Target Simulasi</label>
                  <input
                    type="text"
                    value={planTitle}
                    onChange={(e) => setPlanTitle(e.target.value)}
                    placeholder="Contoh: Dana Pensiun Umur 55"
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
                    Batal
                  </button>
                  <button
                    type="submit"
                    disabled={isSaving || !planTitle.trim()}
                    className="px-5 py-2 text-xs font-bold rounded-xl bg-brand-purple hover:bg-brand-purple/90 text-white disabled:opacity-50 transition-all cursor-pointer flex items-center gap-1.5"
                  >
                    {isSaving && (
                      <span className="inline-block animate-spin h-3.5 w-3.5 border-2 border-white border-t-transparent rounded-full" />
                    )}
                    <span>Simpan</span>
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
