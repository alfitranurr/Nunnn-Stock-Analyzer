'use client';

import * as React from 'react';
import { TrendingDown, ArrowRight, ShieldCheck, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react';
import { AvgDownResult } from '@/lib/calculator';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { cleanCompanyName } from '@/lib/utils';
import { useLanguage } from '@/lib/language-context';

interface ResultsDisplayProps {
  result: AvgDownResult | null;
  ticker: string;
  companyName?: string;
}

function ResultsEmitenLogo({ symbol }: { symbol: string }) {
  const [hasError, setHasError] = React.useState(false);
  const [prevSymbol, setPrevSymbol] = React.useState(symbol);
  
  if (symbol !== prevSymbol) {
    setPrevSymbol(symbol);
    setHasError(false);
  }

  const cleanSymbol = symbol.toUpperCase().trim();

  if (cleanSymbol.length < 3) return null;

  return (
    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
      {!hasError ? (
        <img
          src={`https://assets.stockbit.com/logos/companies/${cleanSymbol}.png`}
          alt={cleanSymbol}
          className="w-8.5 h-8.5 object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-black text-[12px] text-brand-purple">
          {cleanSymbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

export function ResultsDisplay({ result, ticker, companyName }: ResultsDisplayProps) {
  const { t, language } = useLanguage();
  const [hasConfettiFired, setHasConfettiFired] = React.useState(false);
  const [prevResult, setPrevResult] = React.useState(result);
  const [prevTicker, setPrevTicker] = React.useState(ticker);

  if (result !== prevResult || ticker !== prevTicker) {
    setPrevResult(result);
    setPrevTicker(ticker);
    if (result && !result.turnedIntoProfit) {
      setHasConfettiFired(false);
    }
  }

  const cleanName = cleanCompanyName(companyName);

  // Format ke Rupiah
  const formatIDR = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
  };

  // Dynamic font size based on company name length
  const getCompanyFontSize = (name?: string) => {
    if (!name) return 'text-lg';
    const cleanN = cleanCompanyName(name);
    if (cleanN.length > 25) return 'text-sm sm:text-base';
    if (cleanN.length > 18) return 'text-base sm:text-lg';
    return 'text-lg';
  };

  // Efek Confetti ketika berhasil mengubah Loss jadi Profit
  React.useEffect(() => {
    if (result && result.turnedIntoProfit && !hasConfettiFired) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00b15b', '#05fa7b', '#008f47', '#ffffff']
      });
      const timer = setTimeout(() => {
        setHasConfettiFired(true);
      }, 0);
      return () => clearTimeout(timer);
    }
  }, [result, hasConfettiFired]);

  if (!result || result.sharesAwal === 0) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center text-center h-full min-h-[350px] border-dashed border-2 border-slate-300/40 dark:border-white/10">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center border border-slate-200 dark:border-white/5 mb-4 animate-pulse">
          <TrendingDown className="h-8 w-8 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          {language === 'id' ? 'Menunggu Input Data' : 'Waiting for Input Data'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs">
          {language === 'id' 
            ? 'Masukkan lot awal, rata-rata harga beli modal, dan rencana lot baru untuk memproyeksikan hasil secara instan.' 
            : 'Enter initial lots, average buy price, and new purchase lots to project results instantly.'}
        </p>
      </div>
    );
  }

  const isProfitAwal = result.floatingPLAwal >= 0;
  const isProfitTotal = result.floatingPLTotal >= 0;

  return (
    <div className="space-y-4 md:space-y-6 w-full animate-fadeIn">
      {/* Ticker & Nama Perusahaan - Terpisah menjadi 2 Card */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5.5 w-full">
        {/* Card 1: Saham BEI Aktif */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="glass-card p-4 md:p-5 border-brand-purple/20 bg-card-bg relative overflow-hidden flex items-center gap-4 min-h-[84px] md:min-h-[92px]"
        >
          <div className="absolute top-0 left-0 w-32 h-32 bg-brand-purple/2 rounded-full blur-3xl pointer-events-none" />
          <ResultsEmitenLogo symbol={ticker} />
          <div className="flex flex-col justify-center">
            <span className="text-[9px] font-bold text-brand-purple uppercase tracking-widest block">
              Ticker
            </span>
            <h2 className="text-2xl md:text-3.5xl font-black text-white tracking-wider leading-none">
              {ticker}
            </h2>
          </div>
        </motion.div>

        {/* Card 2: Nama Emiten */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: 0.05 }}
          className="glass-card p-4 md:p-5 border-slate-200 dark:border-white/5 bg-card-bg relative overflow-hidden flex flex-col justify-center min-h-[84px] md:min-h-[92px]"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-slate-500/5 rounded-full blur-3xl pointer-events-none" />
          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
            {language === 'id' ? 'Nama Emiten' : 'Company Name'}
          </span>
          <h3 className={`${getCompanyFontSize(cleanName)} font-bold text-brand-purple dark:text-brand-purple mt-1 break-words leading-tight`} title={cleanName}>
            {cleanName || '-'}
          </h3>
        </motion.div>
      </div>

      {/* Rencana Pembelian Baru & Total Lot Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5.5 w-full"
      >
        {/* Card 1: Modal Baru yang Dibutuhkan */}
        <div className="md:col-span-2 glass-card p-4 md:p-5 bg-brand-purple/5 border-brand-purple/20 relative overflow-hidden flex flex-col justify-center min-h-[96px] md:min-h-[110px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-purple/5 rounded-full blur-2xl pointer-events-none" />
          <span className="text-[9px] font-bold text-brand-purple dark:text-brand-purple uppercase tracking-widest block">
            {language === 'id' ? 'Modal Baru yang Dibutuhkan' : 'Required New Capital'}
          </span>
          <div className="flex flex-col md:flex-row md:items-baseline gap-1.5 md:gap-4 mt-1.5 flex-wrap">
            <h3 className="text-xl md:text-3xl font-black tracking-tight text-brand-purple dark:text-brand-purple">
              {formatIDR(result.capitalRequired)}
            </h3>
            <p className="text-xs md:text-base font-medium text-slate-500 dark:text-slate-400">
              {language === 'id' 
                ? `Membeli ${result.sharesBaru.toLocaleString('en-US')} lembar (${(result.sharesBaru / 100).toLocaleString('en-US')} Lot) baru`
                : `Buying ${result.sharesBaru.toLocaleString('en-US')} shares (${(result.sharesBaru / 100).toLocaleString('en-US')} Lots) new`}
            </p>
          </div>
        </div>

        {/* Card 2: Total Lot Akhir */}
        <div className="glass-card p-4 md:p-5 bg-white/5 dark:bg-black/25 border-slate-200 dark:border-white/5 flex flex-col justify-center min-h-[96px] md:min-h-[110px]">
          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
            {language === 'id' ? 'Total Lot Akhir' : 'Total Final Lots'}
          </span>
          <h3 className="text-xl md:text-3xl font-black text-slate-800 dark:text-white mt-1.5 flex items-baseline gap-1.5 flex-wrap">
            <span>{result.lotTotal.toLocaleString('en-US')} Lot</span>
            <span className="text-[10px] md:text-sm font-bold text-slate-500 dark:text-slate-400">
              ({result.sharesTotal.toLocaleString('en-US')} {language === 'id' ? 'lembar' : 'shares'})
            </span>
          </h3>
        </div>
      </motion.div>

      {/* Grid Utama: Sebelum vs Sesudah */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5.5">
        {/* Sebelum Average Down */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-card p-4 md:p-6 border-slate-200 dark:border-white/5 flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-4 md:mb-5.5">
              <span className="text-[10px] md:text-xs font-extrabold uppercase tracking-widest text-slate-400">
                {language === 'id' ? 'SEBELUM AVG DOWN' : 'BEFORE AVG DOWN'}
              </span>
              <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                {language === 'id' ? 'Holding Sekarang' : 'Current Holding'}
              </span>
            </div>
            
            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-[11px] md:text-xs text-slate-500">
                  {language === 'id' ? 'Harga Rata-Rata Awal' : 'Initial Average Price'}
                </span>
                <span className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-200">{formatIDR(result.avgPriceAwal)}</span>
              </div>
              <div className="flex justify-between items-baseline gap-2 border-t border-slate-200/50 dark:border-white/5 pt-2.5 md:pt-3">
                <span className="text-[11px] md:text-xs text-slate-500">
                  {language === 'id' ? 'Total Modal Awal' : 'Total Initial Capital'}
                </span>
                <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">{formatIDR(result.investedAmountAwal)}</span>
              </div>
              <div className="flex justify-between items-baseline gap-2 border-t border-slate-200/50 dark:border-white/5 pt-2.5 md:pt-3">
                <span className="text-[11px] md:text-xs text-slate-500">
                  {language === 'id' ? 'Nilai Pasar (Market Value)' : 'Market Value'}
                </span>
                <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">{formatIDR(result.marketValueAwal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 md:mt-8 pt-3.5 md:pt-4.5 border-t border-slate-200 dark:border-white/10">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase block mb-1">Floating P&L</span>
            <div className="flex justify-between items-center">
              <span className={`text-lg md:text-xl font-extrabold tracking-tight ${isProfitAwal ? 'text-bullish-green dark:text-bullish-neon' : 'text-bearish-red dark:text-bearish-crimson'}`}>
                {formatIDR(result.floatingPLAwal)}
              </span>
              <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg border ${
                isProfitAwal 
                  ? 'bg-bullish-green/10 border-bullish-green/20 text-bullish-green' 
                  : 'bg-bearish-red/10 border-bearish-red/20 text-bearish-red'
              }`}>
                {isProfitAwal ? '+' : ''}{result.floatingPLAwalPct.toFixed(2)}%
              </span>
            </div>
          </div>
        </motion.div>

        {/* Sesudah Average Down */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="glass-card p-4 md:p-6 border-brand-purple/20 bg-slate-900/10 flex flex-col justify-between relative overflow-hidden"
        >
          {result.turnedIntoProfit && (
            <div className="absolute -right-12 -top-12 w-28 h-28 bg-bullish-green/10 rounded-full blur-xl pointer-events-none" />
          )}
          <div>
            <div className="flex justify-between items-center mb-4 md:mb-5.5">
              <span className="text-[10px] md:text-xs font-extrabold uppercase tracking-widest text-brand-purple">
                {language === 'id' ? 'SESUDAH AVG DOWN' : 'AFTER AVG DOWN'}
              </span>
              {result.turnedIntoProfit ? (
                <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full bg-bullish-green/10 text-bullish-green border border-bullish-green/20 flex items-center gap-1 animate-bounce">
                  <Sparkles className="h-2.5 w-2.5" />
                  Turned Profit!
                </span>
              ) : (
                <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-purple/10 text-brand-purple border border-brand-purple/20">
                  {language === 'id' ? 'Target Posisi Baru' : 'New Target Position'}
                </span>
              )}
            </div>

            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-[11px] md:text-xs text-brand-purple dark:text-brand-purple font-semibold">
                  {language === 'id' ? 'Harga Rata-Rata Baru' : 'New Average Price'}
                </span>
                <span className="text-base md:text-lg font-black text-brand-purple dark:text-brand-purple">{formatIDR(result.avgPriceBaru)}</span>
              </div>
              <div className="flex justify-between items-baseline gap-2 border-t border-slate-200/50 dark:border-white/5 pt-2.5 md:pt-3">
                <span className="text-[11px] md:text-xs text-slate-500">
                  {language === 'id' ? 'Total Modal Baru (Gross)' : 'Total New Capital (Gross)'}
                </span>
                <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">{formatIDR(result.investedAmountTotal)}</span>
              </div>
              <div className="flex justify-between items-baseline gap-2 border-t border-slate-200/50 dark:border-white/5 pt-2.5 md:pt-3">
                <span className="text-[11px] md:text-xs text-slate-500">
                  {language === 'id' ? 'Nilai Pasar Baru' : 'New Market Value'}
                </span>
                <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300">{formatIDR(result.marketValueTotal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-6 md:mt-8 pt-3.5 md:pt-4.5 border-t border-slate-200 dark:border-white/10">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase block mb-1">
              {language === 'id' ? 'Estimasi Floating P&L Baru' : 'Estimated New Floating P&L'}
            </span>
            <div className="flex justify-between items-center">
              <span className={`text-lg md:text-xl font-extrabold tracking-tight ${isProfitTotal ? 'text-bullish-green dark:text-bullish-neon' : 'text-bearish-red dark:text-bearish-crimson'}`}>
                {formatIDR(result.floatingPLTotal)}
              </span>
              <span className={`text-[10px] md:text-xs font-bold px-2 py-0.5 md:px-2.5 md:py-1 rounded-lg border ${
                isProfitTotal 
                  ? 'bg-bullish-green/10 border-bullish-green/20 text-bullish-green' 
                  : 'bg-bearish-red/10 border-bearish-red/20 text-bearish-red'
              }`}>
                {isProfitTotal ? '+' : ''}{result.floatingPLTotalPct.toFixed(2)}%
              </span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Rangkuman Perbaikan Posisi */}
      <motion.div
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="glass-card p-4 md:p-6 border-slate-200 dark:border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-36 h-36 bg-brand-purple/5 rounded-full blur-3xl pointer-events-none" />
        
        <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 mb-4.5 md:mb-6 flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-3">
          <ShieldCheck className="h-4.5 w-4.5 text-brand-purple" />
          {language === 'id' ? `Rangkuman Perbaikan Posisi (${ticker})` : `Position Improvement Summary (${ticker})`}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">
          
          {/* Penurunan Harga Rata-Rata */}
          <div className="space-y-3.5">
            <div className="flex justify-between items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {language === 'id' ? 'Harga Rata-Rata (Avg Price)' : 'Average Price (Avg Price)'}
              </span>
              <span className="text-sm md:text-base font-bold text-brand-purple dark:text-brand-purple shrink-0 text-right">
                -{result.avgPriceReductionPct.toFixed(2)}%
              </span>
            </div>
            
            {/* Custom Progress Bar */}
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-full overflow-hidden border border-slate-200/20 dark:border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, result.avgPriceReductionPct)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-brand-purple rounded-full"
              />
            </div>

            {/* Perbandingan Harga */}
            <div className="flex items-center gap-2.5 justify-between bg-white/85 dark:bg-slate-950/50 p-3 md:p-3.5 rounded-xl border border-slate-300/60 dark:border-white/10 shadow-md backdrop-blur-md hover:scale-[1.01] transition-transform duration-200">
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider mb-0.5 block truncate">
                  {language === 'id' ? 'Harga Awal' : 'Initial Price'}
                </span>
                <span className="font-semibold text-slate-600 dark:text-slate-300 text-xs md:text-sm block truncate">{formatIDR(result.avgPriceAwal)}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-brand-purple shrink-0 drop-shadow-[0_0_4px_rgba(0,177,91,0.2)]" />
              <div className="flex flex-col text-right min-w-0">
                <span className="text-[9px] md:text-[10px] text-brand-purple dark:text-brand-purple uppercase font-semibold tracking-wider mb-0.5 block truncate">
                  {language === 'id' ? 'Harga Baru' : 'New Price'}
                </span>
                <span className="font-bold text-slate-800 dark:text-white text-xs md:text-sm block truncate">{formatIDR(result.avgPriceBaru)}</span>
              </div>
            </div>
          </div>

          {/* Penyusutan Loss atau Pertumbuhan Profit */}
          <div className="space-y-3.5">
            {!isProfitAwal && result.lossShrunkPct !== null ? (
              <>
                <div className="flex justify-between items-center gap-2 flex-wrap sm:flex-nowrap">
                  <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {language === 'id' ? 'Floating Loss Menyusut' : 'Floating Loss Reduced'}
                  </span>
                  <span className="text-sm md:text-base font-bold text-bullish-green dark:text-bullish-neon shrink-0 text-right">
                    {result.lossShrunkPct >= 100 
                      ? (language === 'id' ? '100% (Sembuh!)' : '100% (Recovered!)') 
                      : `-${result.lossShrunkPct.toFixed(2)}%`}
                  </span>
                </div>

                {/* Custom Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-full overflow-hidden border border-slate-200/20 dark:border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, result.lossShrunkPct)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-bullish-green rounded-full"
                  />
                </div>

                {/* Perbandingan Loss */}
                <div className="flex items-center gap-2.5 justify-between bg-white/85 dark:bg-slate-950/50 p-3 md:p-3.5 rounded-xl border border-slate-300/60 dark:border-white/10 shadow-md backdrop-blur-md hover:scale-[1.01] transition-transform duration-200">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider mb-0.5 block truncate">
                      {language === 'id' ? 'Loss Awal' : 'Initial Loss'}
                    </span>
                    <span className="font-semibold text-bearish-red text-xs md:text-sm block truncate">{result.floatingPLAwalPct.toFixed(2)}%</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-bullish-green dark:text-bullish-neon shrink-0 drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]" />
                  <div className="flex flex-col text-right min-w-0">
                    <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider mb-0.5 block truncate">
                      {language === 'id' ? 'Loss Baru' : 'New Loss'}
                    </span>
                    <span className={`font-bold text-xs md:text-sm block truncate ${isProfitTotal ? 'text-bullish-green' : 'text-bearish-red'}`}>
                      {isProfitTotal ? '+' : ''}{result.floatingPLTotalPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center">
                <div className="flex items-start gap-2.5 text-xs p-3.5 rounded-xl bg-bullish-green/5 dark:bg-bullish-green/10 border border-bullish-green/20 text-bullish-green w-full">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-bullish-green mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-1">
                      {language === 'id' ? 'Posisi Portofolio Sehat' : 'Healthy Portfolio Position'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                      {language === 'id' 
                        ? `Posisi awal Anda sudah profit. Pembelian baru ini akan menambah kepemilikan Anda sebesar ${((result.capitalRequired / result.investedAmountAwal) * 100).toFixed(1)}% dari modal awal, dengan proyeksi profit akhir sebesar ${result.floatingPLTotalPct.toFixed(2)}%.`
                        : `Your initial position is already in profit. This new purchase will increase your holdings by ${((result.capitalRequired / result.investedAmountAwal) * 100).toFixed(1)}% from your initial capital, with a projected final profit of ${result.floatingPLTotalPct.toFixed(2)}%.`}
                    </span>
                  </div>
                </div>
              </div>
            )}
          </div>

        </div>
      </motion.div>
    </div>
  );
}
