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
  AlertCircle,
  Coins,
  RefreshCw,
  Search,
  Check,
  CheckCircle2,
  Copy,
  ChevronDown,
  ArrowRight
} from 'lucide-react';
import { calculateDividend, DividendInput, DividendResult, MonthlyDividendBreakdown } from '@/lib/dividend';
import { cleanCompanyName } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import * as XLSX from 'xlsx';
import { useLanguage } from '@/lib/language-context';

interface DividendTabProps {
  user: any;
  onSignInClick: () => void;
}

// Popular dividend stocks for quick-click badges
const POPULAR_DIVIDEND_STOCKS = [
  { symbol: 'BBCA', name: 'Bank Central Asia Tbk', yield: '2.6%' },
  { symbol: 'BBRI', name: 'Bank Rakyat Indonesia Tbk', yield: '7.1%' },
  { symbol: 'BMRI', name: 'Bank Mandiri Tbk', yield: '5.6%' },
  { symbol: 'BBNI', name: 'Bank Negara Indonesia Tbk', yield: '5.6%' },
  { symbol: 'TLKM', name: 'Telkom Indonesia Tbk', yield: '6.5%' },
  { symbol: 'ASII', name: 'Astra International Tbk', yield: '10.7%' },
  { symbol: 'ITMG', name: 'Indo Tambangraya Megah Tbk', yield: '17.0%' },
  { symbol: 'PTBA', name: 'Bukit Asam Tbk', yield: '16.4%' },
  { symbol: 'ADRO', name: 'Adaro Energy Indonesia Tbk', yield: '15.5%' },
  { symbol: 'UNVR', name: 'Unilever Indonesia Tbk', yield: '6.4%' },
  { symbol: 'SIDO', name: 'Industri Jamu Sido Muncul Tbk', yield: '6.5%' },
  { symbol: 'PGAS', name: 'Perusahaan Gas Negara Tbk', yield: '9.7%' },
  { symbol: 'ANTM', name: 'Aneka Tambang Tbk', yield: '9.0%' },
];

// Parser & Formatter helpers
const parseFormattedNumber = (val: string | number): number => {
  if (typeof val === 'number') return val;
  if (!val) return 0;
  const clean = val.toString().trim().replace(/[Rp$\s]/g, '').replace(/,/g, '');
  const parsed = parseFloat(clean);
  return isNaN(parsed) ? 0 : parsed;
};

const formatNumberForInput = (num: number | string | undefined | null): string => {
  if (num === undefined || num === null || num === '') return '';
  const parsed = typeof num === 'number' ? num : parseFloat(num.toString().replace(/,/g, ''));
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(parsed);
};

const formatLiveCurrencyInput = (valStr: string): string => {
  if (valStr === undefined || valStr === null || valStr === '') return '';

  const hasDot = valStr.includes('.');
  if (hasDot) {
    const parts = valStr.split('.');
    const rawInt = parts[0].replace(/,/g, '');
    const intNum = parseInt(rawInt, 10);
    const formattedInt = isNaN(intNum) ? '0' : new Intl.NumberFormat('en-US').format(intNum);
    const decPart = parts.slice(1).join('').slice(0, 2);
    return `${formattedInt}.${decPart}`;
  }

  const rawNum = valStr.replace(/,/g, '');
  if (rawNum === '') return '';
  const parsed = parseInt(rawNum, 10);
  if (isNaN(parsed)) return '';
  return new Intl.NumberFormat('en-US').format(parsed);
};

const formatIDR = (val: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0
  }).format(val);
};

function CompanyLogo({ symbol }: { symbol: string }) {
  const [hasError, setHasError] = React.useState(false);
  const cleanSymbol = symbol.toUpperCase().trim();

  React.useEffect(() => {
    setHasError(false);
  }, [cleanSymbol]);

  if (cleanSymbol.length < 3) {
    return (
      <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center shrink-0">
        <span className="font-extrabold text-[10px] text-slate-500">IDX</span>
      </div>
    );
  }

  return (
    <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/15 flex items-center justify-center overflow-hidden shrink-0 shadow-inner">
      {!hasError ? (
        <img
          src={`https://assets.stockbit.com/logos/companies/${cleanSymbol}.png`}
          alt={cleanSymbol}
          className="w-7 h-7 object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-black text-xs text-brand-purple">
          {cleanSymbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

export function DividendTab({ user, onSignInClick }: DividendTabProps) {
  const { t, language } = useLanguage();
  const isEn = language === 'en';
  
  // Ticker state & search
  const [ticker, setTicker] = React.useState('BBCA');
  const [companyName, setCompanyName] = React.useState('Bank Central Asia Tbk');
  const [currentPrice, setCurrentPrice] = React.useState<number>(10150);
  const [expectedBuyPriceStr, setExpectedBuyPriceStr] = React.useState<string>('10,150');
  const [isFetchingData, setIsFetchingData] = React.useState(false);
  
  // Search autocomplete state
  const [searchQuery, setSearchQuery] = React.useState('');
  const [isSearchOpen, setIsSearchOpen] = React.useState(false);
  const [searchResults, setSearchResults] = React.useState<Array<{ symbol: string; name: string }>>([]);
  const [isSearching, setIsSearching] = React.useState(false);

  // Simulation input mode: 'amount' | 'lot'
  const [inputMode, setInputMode] = React.useState<'amount' | 'lot'>('amount');
  const [investmentAmountStr, setInvestmentAmountStr] = React.useState('100,000,000');
  const [lotCountStr, setLotCountStr] = React.useState('98');

  // Dividend & Tax Config
  const [annualDivPerShareStr, setAnnualDivPerShareStr] = React.useState('270');
  const [taxOption, setTaxOption] = React.useState<'0' | '10' | 'custom'>('0');
  const [customTaxStr, setCustomTaxStr] = React.useState('10');
  const [isDripEnabled, setIsDripEnabled] = React.useState(false);

  // Data history state from API
  const [payoutMonths, setPayoutMonths] = React.useState<number[]>([4, 12]);
  const [dividendHistory, setDividendHistory] = React.useState<Array<{
    id: string;
    year: number;
    cumDate: string;
    paymentDate: string;
    amount: number;
    type: string;
  }>>([]);
  const [annualSummary, setAnnualSummary] = React.useState<Array<{
    year: number;
    totalAmount: number;
    yieldPercent?: number;
  }>>([]);

  // Copy report state
  const [isCopied, setIsCopied] = React.useState(false);

  // Toast notification
  const [toast, setToast] = React.useState<string | null>(null);
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // Fetch dividend history & real-time price from API
  const fetchDividendData = React.useCallback(async (symbol: string) => {
    setIsFetchingData(true);
    try {
      const res = await fetch(`/api/dividend?symbol=${symbol}`);
      if (res.ok) {
        const data = await res.json();
        if (data.companyName) setCompanyName(data.companyName);
        if (data.price) {
          setCurrentPrice(data.price);
          setExpectedBuyPriceStr(formatNumberForInput(data.price));
        }
        if (data.annualDividendPerShare !== undefined) {
          setAnnualDivPerShareStr(formatNumberForInput(data.annualDividendPerShare));
        }
        if (data.payoutMonths && data.payoutMonths.length > 0) {
          setPayoutMonths(data.payoutMonths);
        }
        if (data.history) setDividendHistory(data.history);
        if (data.annualSummary) setAnnualSummary(data.annualSummary);
      }
    } catch (err) {
      console.error('Failed to fetch dividend data:', err);
    } finally {
      setIsFetchingData(false);
    }
  }, []);

  // Sync ticker changes
  React.useEffect(() => {
    const val = ticker.toUpperCase().trim();
    if (val.length >= 3) {
      fetchDividendData(val);
    }
  }, [ticker, fetchDividendData]);

  // Handle live search debounced
  React.useEffect(() => {
    if (!searchQuery || searchQuery.trim().length < 2) {
      setSearchResults([]);
      return;
    }
    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/ticker?q=${encodeURIComponent(searchQuery.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.quotes || []);
        }
      } finally {
        setIsSearching(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const formatLiveInput = (valStr: string): string => {
    if (!valStr) return '';
    const endsWithDot = valStr.endsWith('.') || valStr.endsWith(',');
    const parsed = parseFormattedNumber(valStr);
    if (parsed === 0 && !valStr.includes('0')) return valStr;
    const formatted = formatNumberForInput(parsed);
    return endsWithDot ? `${formatted}.` : formatted;
  };

  // Sync Investment Amount & Lot Count
  const handleInvestmentAmountChange = (valStr: string) => {
    const formatted = formatLiveCurrencyInput(valStr);
    setInvestmentAmountStr(formatted);
    const amount = parseFormattedNumber(valStr);
    const buyPrice = parseFormattedNumber(expectedBuyPriceStr) || currentPrice;
    if (buyPrice > 0) {
      const shares = Math.floor(amount / buyPrice);
      const lots = Math.floor(shares / 100);
      setLotCountStr(formatLiveCurrencyInput(lots.toString()));
    }
  };

  const handleLotCountChange = (valStr: string) => {
    const formatted = formatLiveCurrencyInput(valStr);
    setLotCountStr(formatted);
    const lots = parseFormattedNumber(valStr);
    const buyPrice = parseFormattedNumber(expectedBuyPriceStr) || currentPrice;
    const amount = lots * 100 * buyPrice;
    setInvestmentAmountStr(formatLiveCurrencyInput(amount.toString()));
  };

  const handleExpectedPriceChange = (valStr: string) => {
    const formatted = formatLiveCurrencyInput(valStr);
    setExpectedBuyPriceStr(formatted);
    const buyPrice = parseFormattedNumber(valStr);
    if (inputMode === 'lot') {
      const lots = parseFormattedNumber(lotCountStr);
      const amount = lots * 100 * buyPrice;
      setInvestmentAmountStr(formatLiveCurrencyInput(amount.toString()));
    } else {
      const amount = parseFormattedNumber(investmentAmountStr);
      if (buyPrice > 0) {
        const shares = Math.floor(amount / buyPrice);
        const lots = Math.floor(shares / 100);
        setLotCountStr(formatLiveCurrencyInput(lots.toString()));
      }
    }
  };

  const handleAnnualDivChange = (valStr: string) => {
    const formatted = formatLiveCurrencyInput(valStr);
    setAnnualDivPerShareStr(formatted);
  };

  // Determine active tax rate %
  const getTaxRate = (): number => {
    if (taxOption === '0') return 0;
    if (taxOption === '10') return 10;
    return parseFormattedNumber(customTaxStr);
  };

  // Calculate current dividend simulation results
  const result: DividendResult = React.useMemo(() => {
    const buyPrice = parseFormattedNumber(expectedBuyPriceStr) || currentPrice;
    const invAmount = parseFormattedNumber(investmentAmountStr);
    const lots = parseFormattedNumber(lotCountStr);
    const divPerShare = parseFormattedNumber(annualDivPerShareStr);
    const taxRate = getTaxRate();

    const inputData: DividendInput = {
      ticker,
      companyName,
      currentPrice,
      expectedBuyPrice: buyPrice,
      totalInvestmentRp: invAmount,
      totalLot: lots,
      inputMode,
      annualDividendPerShare: divPerShare,
      taxRatePercent: taxRate,
      payoutMonths,
      isDripEnabled,
      language,
    };

    return calculateDividend(inputData);
  }, [
    ticker,
    companyName,
    currentPrice,
    expectedBuyPriceStr,
    investmentAmountStr,
    lotCountStr,
    inputMode,
    annualDivPerShareStr,
    taxOption,
    customTaxStr,
    payoutMonths,
    isDripEnabled,
    language,
  ]);

  // Export report to Excel (.xlsx)
  const handleExportExcel = () => {
    try {
      const wb = XLSX.utils.book_new();

      // Sheet 1: Rangkuman Simulasi
      const summaryData = [
        [isEn ? 'DIVIDEND CALCULATOR SIMULATION SUMMARY' : 'RANGKUMAN SIMULASI KALKULATOR DIVIDEN'],
        [isEn ? 'Stock Symbol' : 'Emiten Saham', `${result.ticker} - ${result.companyName}`],
        [isEn ? 'Buy Price (Rp)' : 'Harga Saham Beli', result.buyPrice],
        [isEn ? 'Total Investment (Rp)' : 'Total Modal Investasi (Rp)', result.totalInvestmentRp],
        [isEn ? 'Total Lots' : 'Total Kepemilikan (Lot)', result.totalLots],
        [isEn ? 'Total Shares' : 'Total Kepemilikan (Lembar)', result.totalShares],
        [isEn ? 'Dividend per Share / Yr (Rp)' : 'Dividen per Saham / Tahun (Rp)', result.annualDividendPerShare],
        [isEn ? 'Est. Gross Dividend 1 Yr (Rp)' : 'Estimasi Dividen Kotor 1 Tahun (Rp)', result.grossAnnualDividendRp],
        [isEn ? 'Tax Rate (%)' : 'Tarif Pajak Dividen (%)', `${result.taxRatePercent}%`],
        [isEn ? 'Tax Deduction (Rp)' : 'Potongan Pajak (Rp)', result.taxAnnualAmountRp],
        [isEn ? 'Est. Net Dividend 1 Yr (Rp)' : 'Estimasi Dividen Bersih 1 Tahun (Rp)', result.netAnnualDividendRp],
        [isEn ? 'Effective Net Yield (%)' : 'Effective Net Yield (%)', `${result.effectiveNetYield.toFixed(2)}%`],
        [isEn ? 'Avg. Net Dividend / Month (Rp)' : 'Rata-rata Dividen Bersih per Bulan (Rp)', result.averageMonthlyNetIncomeRp],
      ];
      const wsSummary = XLSX.utils.aoa_to_sheet(summaryData);
      XLSX.utils.book_append_sheet(wb, wsSummary, isEn ? 'Simulation Summary' : 'Ringkasan Simulasi');

      // Sheet 2: Jadwal Rincian per Bulan
      const monthlyHeaders = [[
        isEn ? 'Month' : 'Bulan',
        isEn ? 'Payment Status' : 'Status Pembayaran',
        isEn ? 'Dividend Label' : 'Label Dividen',
        isEn ? 'Gross Dividend (Rp)' : 'Dividen Kotor (Rp)',
        isEn ? 'Tax (Rp)' : 'Pajak (Rp)',
        isEn ? 'Net Dividend (Rp)' : 'Dividen Bersih (Rp)'
      ]];
      const monthlyRows = result.monthlyBreakdown.map(m => [
        m.monthName,
        m.isPayoutMonth ? (isEn ? 'Paid' : 'Cair') : '-',
        m.payoutLabel || '-',
        m.grossAmount,
        m.taxAmount,
        m.netAmount,
      ]);
      const wsMonthly = XLSX.utils.aoa_to_sheet([...monthlyHeaders, ...monthlyRows]);
      XLSX.utils.book_append_sheet(wb, wsMonthly, isEn ? 'Monthly Breakdown' : 'Rincian Per Bulan');

      // Sheet 3: Historis Dividen
      if (dividendHistory.length > 0) {
        const histHeaders = [[
          isEn ? 'Year' : 'Tahun',
          isEn ? 'Cum Date' : 'Tanggal Cum',
          isEn ? 'Payment Date' : 'Tanggal Bayar',
          isEn ? 'Dividend Type' : 'Tipe Dividen',
          isEn ? 'Dividend / Share (Rp)' : 'Dividen per Lembar (Rp)'
        ]];
        const histRows = dividendHistory.map(h => [
          h.year,
          h.cumDate,
          h.paymentDate || h.cumDate,
          h.type,
          h.amount,
        ]);
        const wsHist = XLSX.utils.aoa_to_sheet([...histHeaders, ...histRows]);
        XLSX.utils.book_append_sheet(wb, wsHist, isEn ? 'Dividend History' : 'Historis Dividen');
      }

      XLSX.writeFile(wb, `Dividend_${result.ticker}_Simulation.xlsx`);
      showToast(isEn ? 'Successfully exported Excel report.' : 'Berhasil mengunduh laporan Excel.');
    } catch (err) {
      console.error('Export Excel failed:', err);
    }
  };

  // Copy Summary to Clipboard
  const handleCopyReport = () => {
    const text = isEn ? `
📊 IDX STOCK DIVIDEND CALCULATOR SIMULATION
------------------------------------------
Stock Symbol    : ${result.ticker} (${result.companyName})
Buy Price       : ${formatIDR(result.buyPrice)}
Total Capital   : ${formatIDR(result.totalInvestmentRp)} (${result.totalLots} Lots / ${result.totalShares.toLocaleString('en-US')} shares)
Dividend/Share  : Rp ${result.annualDividendPerShare}/year

💰 ESTIMATED 1-YEAR DIVIDEND PROJECTION:
- Gross Dividend: ${formatIDR(result.grossAnnualDividendRp)}
- Tax (${result.taxRatePercent}%)     : ${formatIDR(result.taxAnnualAmountRp)}
- Net Dividend  : ${formatIDR(result.netAnnualDividendRp)}
- Net Yield     : ${result.effectiveNetYield.toFixed(2)}%

🗓️ MONTHLY PASSIVE CASHFLOW:
- Average/Month : ${formatIDR(result.averageMonthlyNetIncomeRp)} / month

Generated via NUNNN STOCK ANALYZER
`.trim() : `
📊 SIMULASI KALKULATOR DIVIDEN SAHAM BEI
------------------------------------------
Emiten          : ${result.ticker} (${result.companyName})
Harga Beli      : ${formatIDR(result.buyPrice)}
Total Modal     : ${formatIDR(result.totalInvestmentRp)} (${result.totalLots} Lot / ${result.totalShares.toLocaleString('id-ID')} lembar)
Dividen/Saham   : Rp ${result.annualDividendPerShare}/tahun

💰 ESTIMASI PROYEKSI DIVIDEN 1 TAHUN:
- Dividen Kotor : ${formatIDR(result.grossAnnualDividendRp)}
- Pajak (${result.taxRatePercent}%)  : ${formatIDR(result.taxAnnualAmountRp)}
- Dividen Bersih: ${formatIDR(result.netAnnualDividendRp)}
- Net Yield     : ${result.effectiveNetYield.toFixed(2)}%

🗓️ CASHFLOW PASIF PER BULAN:
- Rata-rata/Bulan : ${formatIDR(result.averageMonthlyNetIncomeRp)} / bulan

Dibuat via NUNNN STOCK ANALYZER
`.trim();

    navigator.clipboard.writeText(text);
    setIsCopied(true);
    showToast(isEn ? 'Summary report copied to clipboard!' : 'Laporan ringkas disalin ke clipboard!');
    setTimeout(() => setIsCopied(false), 2500);
  };

  return (
    <div className="space-y-6 w-full">
      {/* Toast Notification */}
      <AnimatePresence>
        {toast && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            className="fixed top-5 right-5 z-50 px-4 py-2.5 rounded-xl bg-emerald-500 text-white font-semibold text-xs shadow-xl flex items-center gap-2 border border-emerald-400/40"
          >
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span>{toast}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Header Banner */}
      <div className="relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-card-bg via-[#161b22] to-[#0d1117] p-6 md:p-8 shadow-2xl w-full">
        <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-emerald-500/10 blur-[90px] pointer-events-none" />
        <div className="absolute -bottom-10 -left-10 w-72 h-72 rounded-full bg-brand-purple/10 blur-[90px] pointer-events-none" />
        
        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2 w-full">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
              <Coins className="h-3.5 w-3.5 text-emerald-400 animate-pulse" />
              <span>{isEn ? 'Dividend & Passive Income Analysis' : 'Analisis Dividen & Passive Income'}</span>
            </div>
            
            <h1 className="text-2xl md:text-4xl font-black tracking-tight text-white flex items-center gap-2">
              {isEn ? 'Stock Dividend Calculator' : 'Kalkulator Dividen Saham'}
              <Sparkles className="h-6 w-6 text-emerald-400 shrink-0" />
            </h1>
            
            <p className="text-xs md:text-sm text-slate-400 leading-relaxed w-full">
              {isEn 
                ? 'Calculate 1-year dividend projections, monthly cashflow schedules, and real-time historical dividends for all IDX stocks with tax options.'
                : 'Hitung proyeksi dividen 1 tahun, jadwal cashflow bulanan, serta historis dividen seluruh saham BEI secara real-time terintegrasi opsi pajak Indonesia.'}
            </p>
          </div>
        </div>
      </div>

      {/* DISTINCT CARD 1: STOCK SELECTION & REAL-TIME PRICE */}
      <div className="p-4 sm:p-6 md:p-8 rounded-3xl border border-white/10 bg-card-bg shadow-xl space-y-5 w-full">
        
        {/* Grid Row for Titles & Input Boxes */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 items-stretch">
          
          {/* Left (Col 1 & 2): Ticker Selector */}
          <div className="lg:col-span-2 space-y-2 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-300">
                {isEn ? '1. Select Stock / Ticker' : '1. Pilih Saham / Ticker BEI'}
              </label>
              {isFetchingData && (
                <span className="text-[10px] text-emerald-400 flex items-center gap-1">
                  <RefreshCw className="h-3 w-3 animate-spin" /> {isEn ? 'Fetching data...' : 'Mengambil data...'}
                </span>
              )}
            </div>

            <div className="relative flex-1">
              <div className="flex items-center justify-between gap-2.5 p-3 rounded-2xl bg-input-bg border border-border-color focus-within:border-emerald-500 transition-all h-full min-h-[56px]">
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  <CompanyLogo symbol={ticker} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">
                      <span className="font-black text-base text-white tracking-wide">{ticker}</span>
                      <span className="text-[9px] px-1.5 py-0.5 rounded-md bg-emerald-500/20 text-emerald-400 font-extrabold border border-emerald-500/30 whitespace-nowrap shrink-0">
                        BEI / IDX
                      </span>
                    </div>
                    <p className="text-[11px] text-slate-400 truncate mt-0.5">{companyName || (isEn ? 'Loading stock...' : 'Memuat emiten...')}</p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => setIsSearchOpen(!isSearchOpen)}
                  className="px-2.5 sm:px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 cursor-pointer transition-all flex items-center gap-1.5 text-xs font-bold shrink-0 border border-white/5"
                >
                  <Search className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline">{isEn ? 'Search Stock' : 'Cari Saham'}</span>
                  <span className="sm:hidden">{isEn ? 'Search' : 'Cari'}</span>
                </button>
              </div>

              {/* Search Dropdown Modal */}
              <AnimatePresence>
                {isSearchOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: 10 }}
                    className="absolute left-0 right-0 top-full mt-2 z-30 p-4 rounded-2xl bg-[#161b22] border border-white/15 shadow-2xl space-y-3 max-w-xl"
                  >
                    <div className="relative">
                      <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
                      <input
                        type="text"
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder={isEn ? 'Type stock symbol (e.g. BBRI, TLKM)...' : 'Ketik kode saham (misal: BBRI, TLKM)...'}
                        className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-input-bg border border-border-color text-xs text-white placeholder:text-slate-500 focus:outline-none focus:border-emerald-500"
                        autoFocus
                      />
                    </div>

                    {isSearching && (
                      <div className="py-4 text-center text-xs text-slate-400 flex items-center justify-center gap-2">
                        <RefreshCw className="h-4 w-4 animate-spin text-emerald-400" />
                        <span>{isEn ? 'Searching stock in exchange...' : 'Mencari emiten di bursa...'}</span>
                      </div>
                    )}

                    {!isSearching && searchResults.length > 0 && (
                      <div className="max-h-60 overflow-y-auto space-y-1 custom-scrollbar">
                        {searchResults.map((item) => (
                          <button
                            key={item.symbol}
                            type="button"
                            onClick={() => {
                              setTicker(item.symbol);
                              setSearchQuery('');
                              setIsSearchOpen(false);
                            }}
                            className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-white/10 transition-all text-left cursor-pointer"
                          >
                            <div className="flex items-center gap-3 overflow-hidden">
                              <CompanyLogo symbol={item.symbol} />
                              <div className="truncate">
                                <span className="font-bold text-xs text-white block">{item.symbol}</span>
                                <span className="text-[10px] text-slate-400 truncate block">{item.name}</span>
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {!isSearching && searchQuery.length >= 2 && searchResults.length === 0 && (
                      <div className="py-4 text-center text-xs text-slate-400">
                        {isEn ? 'No stocks found matching query.' : 'Tidak ditemukan saham dengan kode kunci tersebut.'}
                      </div>
                    )}

                    <div className="pt-2 border-t border-white/10 flex justify-between items-center text-[10px] text-slate-400">
                      <span>{isEn ? 'Use ticker code directly:' : 'Gunakan kode ticker langsung:'}</span>
                      <button
                        type="button"
                        onClick={() => {
                          if (searchQuery.trim()) {
                            setTicker(searchQuery.trim().toUpperCase());
                            setSearchQuery('');
                            setIsSearchOpen(false);
                          }
                        }}
                        className="px-3 py-1 rounded-lg bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        {isEn ? 'Select' : 'Pilih'} {searchQuery.toUpperCase() || 'Ticker'}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Right (Col 3): Real-Time Price */}
          <div className="lg:col-span-1 space-y-2 flex flex-col justify-between">
            <label className="text-xs font-bold text-slate-300 block">
              {isEn ? 'Real-Time Stock Price' : 'Harga Saham Real-Time'}
            </label>

            <div className="p-3 px-4 rounded-2xl bg-input-bg border border-border-color flex items-center justify-between gap-4 h-full min-h-[56px]">
              <div>
                <span className="text-[10px] text-slate-400 block font-semibold uppercase tracking-wider">{isEn ? 'Live Price' : 'Harga Bursa'}</span>
                <span className="text-lg font-black text-emerald-400 tracking-wide block">{formatIDR(currentPrice)}</span>
              </div>
              <button
                type="button"
                onClick={() => fetchDividendData(ticker)}
                className="px-3 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer shrink-0 border border-white/5"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isFetchingData ? 'animate-spin text-emerald-400' : ''}`} />
                <span>{isEn ? 'Refresh' : 'Segarkan'}</span>
              </button>
            </div>
          </div>

        </div>

        {/* Popular Badges Section */}
        <div className="space-y-2 pt-3 border-t border-white/10">
          <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
            {isEn ? 'Popular Dividend Stocks:' : 'Saham Dividen Populer:'}
          </span>
          <div className="flex flex-wrap items-center gap-1.5">
            {POPULAR_DIVIDEND_STOCKS.map((stk) => (
              <button
                key={stk.symbol}
                type="button"
                onClick={() => setTicker(stk.symbol)}
                className={`px-2.5 py-1 rounded-xl text-[10px] font-bold border transition-all cursor-pointer flex items-center gap-1 shrink-0 ${
                  ticker === stk.symbol
                    ? 'bg-emerald-500 text-white border-emerald-400 shadow-md scale-105'
                    : 'bg-white/5 border-white/10 text-slate-300 hover:bg-white/10 hover:text-white'
                }`}
              >
                <span>{stk.symbol}</span>
                <span className={`text-[9px] ${ticker === stk.symbol ? 'text-white/80' : 'text-emerald-400 font-bold'}`}>{stk.yield}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* DISTINCT CARD 2: SIMULATION PARAMETERS & TAX OPTIONS */}
      <div className="p-6 md:p-8 rounded-3xl border border-white/10 bg-card-bg shadow-xl space-y-6 w-full">
        <h3 className="text-sm font-black text-white uppercase tracking-wider flex items-center gap-2 pb-2 border-b border-white/10">
          <Sparkles className="h-4 w-4 text-emerald-400" />
          <span>{isEn ? 'Dividend Simulation Parameters' : 'Parameter Simulasi Dividen & Pajak'}</span>
        </h3>

        {/* Form Inputs Grid (3 Separate Inner Cards) */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          
          {/* Inner Card A: Mode & Nominal/Lot */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-300 block">
                {isEn ? '2. Capital Parameters' : '2. Parameter Capital'}
              </label>

              {/* Mode Tabs */}
              <div className="grid grid-cols-2 p-1 rounded-xl bg-input-bg border border-border-color text-xs font-bold">
                <button
                  type="button"
                  onClick={() => setInputMode('amount')}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    inputMode === 'amount' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isEn ? 'Amount (Rp)' : 'Nominal (Rp)'}
                </button>
                <button
                  type="button"
                  onClick={() => setInputMode('lot')}
                  className={`py-2 rounded-lg transition-all cursor-pointer ${
                    inputMode === 'lot' ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {isEn ? 'Lot Count' : 'Jumlah Lot'}
                </button>
              </div>

              {inputMode === 'amount' ? (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {isEn ? 'Total Investment Capital (Rp)' : 'Total Modal Investasi (Rp)'}
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">Rp</span>
                    <input
                      type="text"
                      value={investmentAmountStr}
                      onChange={(e) => handleInvestmentAmountChange(e.target.value)}
                      onBlur={() => setInvestmentAmountStr(formatNumberForInput(parseFormattedNumber(investmentAmountStr)))}
                      className="w-full pl-9 pr-3 py-2 rounded-xl bg-input-bg border border-border-color text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                    />
                  </div>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <label className="text-[11px] text-slate-400 font-medium">
                    {isEn ? 'Lot Count' : 'Jumlah Lot Saham'}
                  </label>
                  <div className="relative">
                    <input
                      type="text"
                      value={lotCountStr}
                      onChange={(e) => handleLotCountChange(e.target.value)}
                      onBlur={() => setLotCountStr(formatNumberForInput(parseFormattedNumber(lotCountStr)))}
                      className="w-full px-3 py-2 rounded-xl bg-input-bg border border-border-color text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                    />
                    <span className="absolute right-3 top-2.5 text-xs font-bold text-slate-500">Lot</span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/5">
              <span className="text-[11px] text-slate-400 font-semibold block">
                {inputMode === 'amount'
                  ? (isEn 
                      ? `Equivalent ≈ ${lotCountStr} Lots (${(parseFormattedNumber(lotCountStr) * 100).toLocaleString('en-US')} shares)`
                      : `Setara ≈ ${lotCountStr} Lot (${(parseFormattedNumber(lotCountStr) * 100).toLocaleString('id-ID')} lembar)`)
                  : (isEn
                      ? `Capital ≈ ${formatIDR(parseFormattedNumber(investmentAmountStr))} (${(parseFormattedNumber(lotCountStr) * 100).toLocaleString('en-US')} shares)`
                      : `Modal ≈ ${formatIDR(parseFormattedNumber(investmentAmountStr))} (${(parseFormattedNumber(lotCountStr) * 100).toLocaleString('id-ID')} lembar)`)}
              </span>
            </div>
          </div>

          {/* Inner Card B: Buy Price & Annual Dividend */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-300 block">
                {isEn ? '3. Buy Price & Expected Dividend' : '3. Harga & Estimasi Dividen'}
              </label>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-medium">
                  {isEn ? 'Buy Price per Share (Rp)' : 'Harga Beli per Saham (Rp)'}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">Rp</span>
                  <input
                    type="text"
                    value={expectedBuyPriceStr}
                    onChange={(e) => handleExpectedPriceChange(e.target.value)}
                    onBlur={() => setExpectedBuyPriceStr(formatNumberForInput(parseFormattedNumber(expectedBuyPriceStr)))}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-input-bg border border-border-color text-sm font-bold text-white focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[11px] text-slate-400 font-medium flex items-center justify-between">
                  <span>{isEn ? '1-Year Dividend (Rp/Share)' : 'Dividen 1 Thn (Rp/Lembar)'}</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2.5 text-xs font-bold text-slate-500">Rp</span>
                  <input
                    type="text"
                    value={annualDivPerShareStr}
                    onChange={(e) => handleAnnualDivChange(e.target.value)}
                    onBlur={() => setAnnualDivPerShareStr(formatNumberForInput(parseFormattedNumber(annualDivPerShareStr)))}
                    className="w-full pl-9 pr-3 py-2 rounded-xl bg-input-bg border border-border-color text-sm font-bold text-emerald-400 focus:outline-none focus:border-emerald-500 transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex items-center justify-between">
              <span className="text-[11px] text-slate-400 font-semibold">{isEn ? 'Yield on Cost:' : 'Estimasi Yield:'}</span>
              <span className="text-xs text-emerald-400 font-black">
                ~{((parseFormattedNumber(annualDivPerShareStr) / (parseFormattedNumber(expectedBuyPriceStr) || 1)) * 100).toFixed(2)}% / {isEn ? 'year' : 'tahun'}
              </span>
            </div>
          </div>

          {/* Inner Card C: Tax Options & DRIP */}
          <div className="p-5 rounded-2xl bg-white/[0.03] border border-white/10 space-y-4 flex flex-col justify-between">
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-300 block">
                {isEn ? '4. Dividend Tax Options' : '4. Opsional Pajak Dividen'}
              </label>

              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setTaxOption('0')}
                  className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                    taxOption === '0'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md font-extrabold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs block font-bold">0%</span>
                  <span className="text-[9px] block text-slate-400">{isEn ? 'Tax-Free' : 'Bebas Pajak'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTaxOption('10')}
                  className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                    taxOption === '10'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md font-extrabold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs block font-bold">10%</span>
                  <span className="text-[9px] block text-slate-400">{isEn ? 'Final Tax' : 'Pajak Final'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTaxOption('custom')}
                  className={`p-2.5 rounded-2xl border text-center transition-all cursor-pointer ${
                    taxOption === 'custom'
                      ? 'bg-emerald-500/20 border-emerald-500 text-emerald-400 shadow-md font-extrabold'
                      : 'bg-white/5 border-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  <span className="text-xs block font-bold">Custom</span>
                  <span className="text-[9px] block text-slate-400">{isEn ? 'Custom Rate' : 'Atur Sendiri'}</span>
                </button>
              </div>

              {taxOption === 'custom' && (
                <div className="relative">
                  <input
                    type="text"
                    value={customTaxStr}
                    onChange={(e) => setCustomTaxStr(e.target.value)}
                    placeholder={isEn ? 'Tax Rate %' : 'Persentase Pajak %'}
                    className="w-full px-3 py-2 rounded-xl bg-input-bg border border-border-color text-xs font-bold text-white focus:outline-none focus:border-emerald-500"
                  />
                  <span className="absolute right-3 top-2 text-xs font-bold text-slate-500">%</span>
                </div>
              )}
            </div>

            <div className="pt-2 border-t border-white/5">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={isDripEnabled}
                  onChange={(e) => setIsDripEnabled(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-700 bg-input-bg text-emerald-500 focus:ring-emerald-500 cursor-pointer accent-emerald-500"
                />
                <div>
                  <span className="text-xs font-bold text-white block">{isEn ? 'DRIP Simulation' : 'Simulasi DRIP'}</span>
                  <span className="text-[10px] text-slate-400 block">{isEn ? 'Automatically reinvest dividends' : 'Reinvestasikan dividen otomatis'}</span>
                </div>
              </label>
            </div>
          </div>

        </div>
      </div>

      {/* FULL-WIDTH HORIZONTAL CARD 2: RESULTS OVERVIEW & MONTHLY CASHFLOW */}
      <div className="p-6 md:p-8 rounded-3xl border border-white/10 bg-card-bg shadow-2xl space-y-6 w-full">
        
        {/* Row 1: Featured Monthly Passive Income Banner */}
        <div className="p-5 sm:p-6 md:p-8 rounded-3xl border border-emerald-500/30 bg-gradient-to-br from-emerald-950/40 via-card-bg to-[#121619] shadow-xl relative overflow-hidden w-full">
          <div className="absolute top-0 right-0 w-60 h-60 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
          
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 relative z-10">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/20 text-[10px] font-extrabold text-emerald-400 uppercase tracking-widest border border-emerald-500/30 mb-2">
                <Coins className="h-3.5 w-3.5" />
                <span>Monthly Passive Income</span>
              </div>
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                {isEn ? 'Average Net Dividend Received Per Month' : 'Rata-rata Dividen Bersih Diterima Per Bulan'}
              </h3>
              <div className="text-2xl sm:text-4xl md:text-5xl font-black text-emerald-400 tracking-tight mt-1 flex items-baseline flex-wrap gap-1">
                <span>{formatIDR(result.averageMonthlyNetIncomeRp)}</span>
                <span className="text-xs sm:text-sm text-slate-400 font-normal">{isEn ? '/ month' : '/ bulan'}</span>
              </div>
            </div>

            <div className="flex items-center gap-4 p-3.5 sm:p-4 rounded-2xl bg-white/5 border border-white/10 shrink-0 self-start sm:self-auto">
              <div>
                <span className="text-[10px] text-slate-400 block uppercase font-bold">Effective Net Yield</span>
                <span className="text-xl sm:text-2xl font-black text-white block mt-0.5">{result.effectiveNetYield.toFixed(2)}%</span>
                <span className="text-[10px] text-emerald-400 block font-semibold">Yield on Cost</span>
              </div>
            </div>
          </div>
        </div>

        {/* Row 2: Summary Metric Cards (Clean Vertical Stack Layout) */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          
          {/* Gross Dividend Card */}
          <div className="p-5 sm:p-6 rounded-3xl border border-white/10 bg-white/[0.02] shadow-lg flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block w-full">
                {isEn ? 'Estimated Gross Dividend (1 Year)' : 'Estimasi Dividen Kotor (1 Tahun)'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-white tracking-tight mt-2">
                {formatIDR(result.grossAnnualDividendRp)}
              </div>
            </div>
            <div className="pt-2 border-t border-white/5 text-xs text-slate-400 font-medium">
              {isEn 
                ? `${result.totalShares.toLocaleString('en-US')} shares x Rp ${result.annualDividendPerShare}`
                : `${result.totalShares.toLocaleString('id-ID')} lembar x Rp ${result.annualDividendPerShare}`}
            </div>
          </div>

          {/* Net Dividend Card */}
          <div className="p-5 sm:p-6 rounded-3xl border border-white/10 bg-white/[0.02] shadow-lg flex flex-col justify-between space-y-3">
            <div>
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider block w-full">
                {isEn ? 'Estimated Net Dividend (1 Year)' : 'Estimasi Dividen Bersih (1 Tahun)'}
              </span>
              <div className="text-2xl sm:text-3xl font-black text-emerald-400 tracking-tight mt-2">
                {formatIDR(result.netAnnualDividendRp)}
              </div>
            </div>
            <div className="pt-2 border-t border-white/5 text-xs text-slate-400 font-medium">
              {result.taxRatePercent > 0 
                ? (isEn ? `Tax ${result.taxRatePercent}% (${formatIDR(result.taxAnnualAmountRp)})` : `Pajak ${result.taxRatePercent}% (${formatIDR(result.taxAnnualAmountRp)})`)
                : (isEn ? 'Tax-Free (0%)' : 'Bebas Potongan Pajak (0%)')}
            </div>
          </div>

        </div>

        {/* Row 3: Monthly Breakdown Schedule */}
        <div className="space-y-4 pt-2 border-t border-white/10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h3 className="text-base font-black text-white flex items-center gap-2">
                <Calendar className="h-5 w-5 text-emerald-400" />
                <span>{isEn ? 'Monthly Dividend Schedule (Jan - Dec)' : 'Rincian Dividen Per Bulan (Jan - Des)'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEn
                  ? `Monthly dividend distribution for ${result.ticker} based on historical IDX schedule.`
                  : `Daftar bulan pencairan dividen saham ${result.ticker} berdasarkan historis jadwal BEI.`}
              </p>
            </div>
            <span className="sm:hidden text-[10px] text-slate-500 font-medium self-end">
              {isEn ? '← Scroll table →' : '← Geser tabel →'}
            </span>
          </div>

          {/* Monthly Detailed Table */}
          <div className="overflow-x-auto custom-scrollbar pt-2">
            <table className="w-full min-w-[540px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-2.5 px-3 whitespace-nowrap">{isEn ? 'Month' : 'Bulan'}</th>
                  <th className="py-2.5 px-3 whitespace-nowrap">{isEn ? 'Payment Schedule' : 'Jadwal Pembayaran'}</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">{isEn ? 'Gross Dividend' : 'Dividen Kotor'}</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">{isEn ? `Tax (${result.taxRatePercent}%)` : `Pajak (${result.taxRatePercent}%)`}</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">{isEn ? 'Net Dividend Received' : 'Dividen Bersih Diterima'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {result.monthlyBreakdown.map((m) => (
                  <tr key={`tbl-${m.month}`} className={m.isPayoutMonth ? 'bg-emerald-500/5 font-semibold text-white' : ''}>
                    <td className="py-2.5 px-3 whitespace-nowrap">{m.monthName}</td>
                    <td className="py-2.5 px-3 whitespace-nowrap">
                      {m.isPayoutMonth ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold text-emerald-400">
                          <CheckCircle2 className="h-3 w-3" /> {m.payoutLabel || (isEn ? 'Estimated Payout' : 'Estimasi Cair')}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-600">{isEn ? 'No dividend' : 'Tidak ada dividen'}</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">{m.isPayoutMonth ? formatIDR(m.grossAmount) : '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-slate-400 whitespace-nowrap">{m.isPayoutMonth && m.taxAmount > 0 ? formatIDR(m.taxAmount) : '-'}</td>
                    <td className="py-2.5 px-3 text-right font-mono text-emerald-400 font-bold whitespace-nowrap">{m.isPayoutMonth ? formatIDR(m.netAmount) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* FULL-WIDTH HORIZONTAL CARD 3: REAL-TIME DIVIDEND HISTORY TABLE */}
      <div className="p-4.5 sm:p-6 md:p-8 rounded-3xl border border-white/10 bg-card-bg shadow-xl space-y-4 w-full">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
          <div>
            <h3 className="text-base font-black text-white flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-emerald-400" />
              <span>{isEn ? `Real-Time Dividend History (${result.ticker})` : `Historis Dividen Real-Time (${result.ticker})`}</span>
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {isEn ? 'Historical record of cum-date & dividend payouts per share from exchange.' : 'Catatan riwayat cum-date & pembayaran dividen per lembar dari bursa.'}
            </p>
          </div>

          {annualSummary.length > 0 && (
            <div className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 self-start sm:self-auto">
              {isEn ? `Total ${dividendHistory.length} Payouts` : `Total ${dividendHistory.length} Pembayaran`}
            </div>
          )}
        </div>

        {dividendHistory.length > 0 ? (
          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[480px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-3 sm:px-4 whitespace-nowrap">{isEn ? 'Year' : 'Tahun'}</th>
                  <th className="py-3 px-3 sm:px-4 whitespace-nowrap">{isEn ? 'Dividend Type' : 'Tipe Dividen'}</th>
                  <th className="py-3 px-3 sm:px-4 whitespace-nowrap">{isEn ? 'Cum-Date' : 'Tanggal Cum-Date'}</th>
                  <th className="py-3 px-3 sm:px-4 text-right whitespace-nowrap">{isEn ? 'Dividend / Share' : 'Dividen / Lembar'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {dividendHistory.map((item) => (
                  <tr key={item.id} className="hover:bg-white/5 transition-all">
                    <td className="py-3 px-3 sm:px-4 font-bold text-white whitespace-nowrap">{item.year}</td>
                    <td className="py-3 px-3 sm:px-4 whitespace-nowrap">
                      <span className="px-2.5 py-0.5 rounded text-[10px] font-bold bg-white/10 text-emerald-300 border border-white/10">
                        {item.type}
                      </span>
                    </td>
                    <td className="py-3 px-3 sm:px-4 text-slate-400 whitespace-nowrap">{item.cumDate}</td>
                    <td className="py-3 px-3 sm:px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">
                      Rp {item.amount.toLocaleString('id-ID')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="py-8 text-center text-xs text-slate-500">
            {isFetchingData 
              ? (isEn ? 'Loading historical dividend data...' : 'Memuat data historis dividen...') 
              : (isEn ? 'No historical dividend data stored yet.' : 'Belum ada data historis dividen tersimpan.')}
          </div>
        )}
      </div>

      {/* FULL-WIDTH HORIZONTAL CARD 4: 5-YEAR DRIP PROJECTION */}
      {isDripEnabled && result.dripProjections && (
        <div className="p-4.5 sm:p-6 md:p-8 rounded-3xl border border-emerald-500/30 bg-card-bg shadow-xl space-y-4 w-full">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div>
              <h3 className="text-base font-black text-emerald-400 flex items-center gap-2">
                <Sparkles className="h-5 w-5 text-emerald-400" />
                <span>{isEn ? 'DRIP Compounding Projection (5 Years)' : 'Proyeksi Compounding DRIP (5 Tahun)'}</span>
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">
                {isEn ? 'Growth of shares & dividends if net dividends are continuously reinvested.' : 'Pertumbuhan jumlah saham & dividen jika dividen bersih diinvestasikan kembali secara terus menerus.'}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto custom-scrollbar">
            <table className="w-full min-w-[540px] text-left border-collapse text-xs">
              <thead>
                <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                  <th className="py-3 px-4 whitespace-nowrap">{isEn ? 'Year' : 'Tahun'}</th>
                  <th className="py-3 px-4 whitespace-nowrap">{isEn ? 'Lot Count' : 'Jumlah Lot'}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{isEn ? 'Portfolio Value (Rp)' : 'Nilai Portofolio (Rp)'}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{isEn ? 'Net Dividend/Yr' : 'Dividen Bersih/Thn'}</th>
                  <th className="py-3 px-4 text-right whitespace-nowrap">{isEn ? 'Passive Income/Mo' : 'Passive Income/Bln'}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5 text-slate-300">
                {result.dripProjections.map((p) => (
                  <tr key={`drip-${p.year}`} className="hover:bg-white/5 transition-all">
                    <td className="py-3 px-4 font-bold text-white whitespace-nowrap">{isEn ? `Year ${p.year}` : `Tahun Ke-${p.year}`}</td>
                    <td className="py-3 px-4 font-bold text-emerald-400 whitespace-nowrap">
                      {isEn 
                        ? `${p.lotsCount} Lots (${p.sharesCount.toLocaleString('en-US')} shares)`
                        : `${p.lotsCount} Lot (${p.sharesCount.toLocaleString('id-ID')} lembar)`}
                    </td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-white whitespace-nowrap">{formatIDR(p.portfolioValueRp)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">{formatIDR(p.netAnnualDividendRp)}</td>
                    <td className="py-3 px-4 text-right font-mono font-bold text-emerald-300 whitespace-nowrap">{formatIDR(p.monthlyNetIncomeRp)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

    </div>
  );
}
