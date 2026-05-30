'use client';

import * as React from 'react';
import { TrendingDown, ArrowRight, ShieldCheck, CheckCircle2, TrendingUp, Sparkles } from 'lucide-react';
import { AvgDownResult } from '@/lib/calculator';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';

interface ResultsDisplayProps {
  result: AvgDownResult | null;
  ticker: string;
  companyName?: string;
}

export function ResultsDisplay({ result, ticker, companyName }: ResultsDisplayProps) {
  const [hasConfettiFired, setHasConfettiFired] = React.useState(false);

  // Format ke Rupiah
  const formatIDR = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
  };

  // Reset confetti status jika ticker atau input berubah secara mendasar
  React.useEffect(() => {
    if (result && !result.turnedIntoProfit) {
      setHasConfettiFired(false);
    }
  }, [result, ticker]);

  // Efek Confetti ketika berhasil mengubah Loss jadi Profit
  React.useEffect(() => {
    if (result && result.turnedIntoProfit && !hasConfettiFired) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#00ff87', '#6366f1', '#8b5cf6', '#a78bfa']
      });
      setHasConfettiFired(true);
    }
  }, [result, hasConfettiFired]);

  if (!result || result.sharesAwal === 0) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center text-center h-full min-h-[350px] border-dashed border-2 border-slate-300/40 dark:border-white/10">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center border border-slate-200 dark:border-white/5 mb-4 animate-pulse">
          <TrendingDown className="h-8 w-8 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">Menunggu Input Data</h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs">
          Masukkan lot awal, rata-rata harga beli modal, dan rencana lot baru untuk memproyeksikan hasil secara instan.
        </p>
      </div>
    );
  }

  const isProfitAwal = result.floatingPLAwal >= 0;
  const isProfitTotal = result.floatingPLTotal >= 0;

  return (
    <div className="space-y-6 w-full animate-fadeIn">
      {/* Ticker & Nama Perusahaan Header Card */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="glass-card p-5 border-brand-purple/20 bg-slate-900/45 dark:bg-black/35 flex justify-between items-center relative overflow-hidden"
      >
        <div className="absolute top-0 left-0 w-32 h-32 bg-brand-purple/5 rounded-full blur-3xl pointer-events-none" />
        <div>
          <span className="text-[10px] font-black text-brand-purple uppercase tracking-widest">Saham BEI Aktif</span>
          <h2 className="text-4xl font-extrabold text-white tracking-widest mt-1">
            {ticker}
          </h2>
        </div>
        {companyName && (
          <div className="text-right">
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nama Emiten</span>
            <h3 className="text-base font-extrabold text-brand-indigo dark:text-violet-300 mt-1 max-w-[250px] md:max-w-[400px] truncate">
              {companyName}
            </h3>
          </div>
        )}
      </motion.div>

      {/* Rencana Pembelian Baru & Total Lot Banner */}
      <motion.div 
        initial={{ opacity: 0, y: 15 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.05 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-5.5 w-full"
      >
        {/* Card 1: Modal Baru yang Dibutuhkan */}
        <div className="md:col-span-2 glass-card p-5.5 bg-gradient-to-r from-brand-indigo/15 to-brand-purple/15 border-brand-purple/35 relative overflow-hidden flex flex-col justify-center min-h-[110px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-purple/10 rounded-full blur-2xl pointer-events-none" />
          <span className="text-[9px] font-bold text-brand-purple dark:text-violet-400 uppercase tracking-widest block">
            Modal Baru yang Dibutuhkan
          </span>
          <div className="flex flex-col md:flex-row md:items-baseline gap-2 md:gap-4 mt-1.5 flex-wrap">
            <h3 className="text-2xl md:text-3xl font-black tracking-tight text-brand-indigo dark:text-violet-300">
              {formatIDR(result.capitalRequired)}
            </h3>
            <p className="text-sm md:text-base font-medium text-slate-500 dark:text-slate-400">
              Membeli {result.sharesBaru.toLocaleString('en-US')} lembar (<strong className="font-extrabold text-slate-800 dark:text-white">{(result.sharesBaru / 100).toLocaleString('en-US')} Lot</strong>) baru
            </p>
          </div>
        </div>

        {/* Card 2: Total Lot Akhir */}
        <div className="glass-card p-5.5 bg-white/5 dark:bg-black/25 border-slate-200 dark:border-white/5 flex flex-col justify-center min-h-[110px]">
          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
            Total Lot Akhir
          </span>
          <h3 className="text-2xl md:text-3xl font-black text-slate-800 dark:text-white mt-1.5 flex items-baseline gap-1.5 flex-wrap">
            <span>{result.lotTotal.toLocaleString('en-US')} Lot</span>
            <span className="text-xs md:text-sm font-bold text-slate-500 dark:text-slate-400">({result.sharesTotal.toLocaleString('en-US')} lembar)</span>
          </h3>
        </div>
      </motion.div>

      {/* Grid Utama: Sebelum vs Sesudah */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5.5">
        {/* Sebelum Average Down */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-card p-6 border-slate-200 dark:border-white/5 flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-5.5">
              <span className="text-xs font-extrabold uppercase tracking-widest text-slate-400">SEBELUM AVG DOWN</span>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                Holding Sekarang
              </span>
            </div>
            
            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-slate-500">Harga Rata-Rata Awal</span>
                <span className="text-base font-bold text-slate-700 dark:text-slate-200">{formatIDR(result.avgPriceAwal)}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-200/50 dark:border-white/5 pt-3">
                <span className="text-xs text-slate-500">Total Modal Awal</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatIDR(result.investedAmountAwal)}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-200/50 dark:border-white/5 pt-3">
                <span className="text-xs text-slate-500">Nilai Pasar (Market Value)</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatIDR(result.marketValueAwal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4.5 border-t border-slate-200 dark:border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Floating P&L</span>
            <div className="flex justify-between items-center">
              <span className={`text-xl font-extrabold tracking-tight ${isProfitAwal ? 'text-bullish-green dark:text-bullish-neon' : 'text-bearish-red dark:text-bearish-crimson'}`}>
                {formatIDR(result.floatingPLAwal)}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
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
          className="glass-card p-6 border-brand-purple/20 bg-slate-900/10 flex flex-col justify-between relative overflow-hidden"
        >
          {result.turnedIntoProfit && (
            <div className="absolute -right-12 -top-12 w-28 h-28 bg-bullish-green/10 rounded-full blur-xl pointer-events-none" />
          )}
          <div>
            <div className="flex justify-between items-center mb-5.5">
              <span className="text-xs font-extrabold uppercase tracking-widest text-brand-purple">SESUDAH AVG DOWN</span>
              {result.turnedIntoProfit ? (
                <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full bg-bullish-green/20 text-bullish-green border border-bullish-green/30 flex items-center gap-1 animate-bounce">
                  <Sparkles className="h-3 w-3" />
                  Turned Profit!
                </span>
              ) : (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-brand-purple/20 text-brand-purple border border-brand-purple/30">
                  Target Posisi Baru
                </span>
              )}
            </div>

            <div className="space-y-4">
              <div className="flex justify-between items-baseline">
                <span className="text-xs text-brand-purple dark:text-violet-300 font-semibold">Harga Rata-Rata Baru</span>
                <span className="text-lg font-black text-brand-purple dark:text-violet-300">{formatIDR(result.avgPriceBaru)}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-200/50 dark:border-white/5 pt-3">
                <span className="text-xs text-slate-500">Total Modal Baru (Gross)</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatIDR(result.investedAmountTotal)}</span>
              </div>
              <div className="flex justify-between items-baseline border-t border-slate-200/50 dark:border-white/5 pt-3">
                <span className="text-xs text-slate-500">Nilai Pasar Baru</span>
                <span className="text-sm font-semibold text-slate-700 dark:text-slate-300">{formatIDR(result.marketValueTotal)}</span>
              </div>
            </div>
          </div>

          <div className="mt-8 pt-4.5 border-t border-slate-200 dark:border-white/10">
            <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1">Estimasi Floating P&L Baru</span>
            <div className="flex justify-between items-center">
              <span className={`text-xl font-extrabold tracking-tight ${isProfitTotal ? 'text-bullish-green dark:text-bullish-neon' : 'text-bearish-red dark:text-bearish-crimson'}`}>
                {formatIDR(result.floatingPLTotal)}
              </span>
              <span className={`text-xs font-bold px-2.5 py-1 rounded-lg border ${
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
        className="glass-card p-6 border-slate-200 dark:border-white/5 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-36 h-36 bg-brand-purple/5 rounded-full blur-3xl pointer-events-none" />
        
        <h4 className="text-xs font-bold uppercase tracking-widest text-slate-500 mb-6 flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-3">
          <ShieldCheck className="h-4.5 w-4.5 text-brand-purple" />
          Rangkuman Perbaikan Posisi ({ticker})
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          
          {/* Penurunan Harga Rata-Rata */}
          <div className="space-y-4">
            <div className="flex justify-between items-baseline">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Harga Rata-Rata (Avg Price)</span>
              <span className="text-lg font-black text-brand-purple dark:text-violet-300">
                -{result.avgPriceReductionPct.toFixed(2)}%
              </span>
            </div>
            
            {/* Custom Progress Bar */}
            <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-900/60 rounded-full overflow-hidden border border-slate-200/20 dark:border-white/5">
              <motion.div 
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, result.avgPriceReductionPct)}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className="h-full bg-gradient-to-r from-brand-indigo to-brand-purple rounded-full"
              />
            </div>

            {/* Perbandingan Harga */}
            <div className="flex items-center gap-3 justify-between bg-white/85 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-300/60 dark:border-white/10 text-xs shadow-md backdrop-blur-md hover:scale-[1.01] transition-transform duration-200">
              <div className="flex flex-col">
                <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-0.5">Harga Awal</span>
                <span className="font-bold text-slate-600 dark:text-slate-300">{formatIDR(result.avgPriceAwal)}</span>
              </div>
              <ArrowRight className="h-4.5 w-4.5 text-brand-purple shrink-0 drop-shadow-[0_0_4px_rgba(139,92,246,0.3)]" />
              <div className="flex flex-col text-right">
                <span className="text-[10px] text-brand-purple dark:text-violet-400 uppercase font-bold tracking-wider mb-0.5">Harga Baru</span>
                <span className="font-extrabold text-slate-800 dark:text-white">{formatIDR(result.avgPriceBaru)}</span>
              </div>
            </div>
          </div>

          {/* Penyusutan Loss atau Pertumbuhan Profit */}
          <div className="space-y-4">
            {!isProfitAwal && result.lossShrunkPct !== null ? (
              <>
                <div className="flex justify-between items-baseline">
                  <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Floating Loss Menyusut</span>
                  <span className="text-lg font-black text-bullish-green dark:text-bullish-neon">
                    {result.lossShrunkPct >= 100 ? '100% (Sembuh!)' : `-${result.lossShrunkPct.toFixed(2)}%`}
                  </span>
                </div>

                {/* Custom Progress Bar */}
                <div className="w-full h-2.5 bg-slate-100 dark:bg-slate-900/60 rounded-full overflow-hidden border border-slate-200/20 dark:border-white/5">
                  <motion.div 
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, result.lossShrunkPct)}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className="h-full bg-gradient-to-r from-bullish-green to-bullish-neon rounded-full"
                  />
                </div>

                {/* Perbandingan Loss */}
                <div className="flex items-center gap-3 justify-between bg-white/85 dark:bg-slate-950/50 p-4 rounded-xl border border-slate-300/60 dark:border-white/10 text-xs shadow-md backdrop-blur-md hover:scale-[1.01] transition-transform duration-200">
                  <div className="flex flex-col">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-0.5">Loss Awal</span>
                    <span className="font-bold text-bearish-red">{result.floatingPLAwalPct.toFixed(2)}%</span>
                  </div>
                  <ArrowRight className="h-4.5 w-4.5 text-bullish-green dark:text-bullish-neon shrink-0 drop-shadow-[0_0_4px_rgba(16,185,129,0.3)]" />
                  <div className="flex flex-col text-right">
                    <span className="text-[10px] text-slate-400 dark:text-slate-500 uppercase font-bold tracking-wider mb-0.5">Loss Baru</span>
                    <span className={`font-extrabold ${isProfitTotal ? 'text-bullish-green' : 'text-bearish-red'}`}>
                      {isProfitTotal ? '+' : ''}{result.floatingPLTotalPct.toFixed(2)}%
                    </span>
                  </div>
                </div>
              </>
            ) : (
              <div className="h-full flex items-center">
                <div className="flex items-start gap-3 text-xs p-4 rounded-xl bg-bullish-green/5 dark:bg-bullish-green/10 border border-bullish-green/20 text-bullish-green w-full">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-bullish-green mt-0.5" />
                  <div>
                    <span className="font-extrabold block mb-1">Posisi Portofolio Sehat</span>
                    <span>
                      Posisi awal Anda sudah profit. Pembelian baru ini akan menambah kepemilikan Anda sebesar 
                      {' '}<strong className="text-slate-800 dark:text-white">{((result.capitalRequired / result.investedAmountAwal) * 100).toFixed(1)}%</strong> dari modal awal, dengan proyeksi profit akhir sebesar <strong>{result.floatingPLTotalPct.toFixed(2)}%</strong>.
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
