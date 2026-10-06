'use client';

import * as React from 'react';
import { TrendingDown, ArrowRight, ShieldCheck, CheckCircle2, Sparkles, Target } from 'lucide-react';
import { AvgDownResult } from '@/lib/calculator';
import { motion } from 'framer-motion';
import Image from 'next/image';
import { cleanCompanyName } from '@/lib/utils';
import { useLanguage } from '@/lib/language-context';
import { formatIDR as formatIDRBase, formatPercent } from '@/lib/format';

interface ResultsDisplayProps {
  result: AvgDownResult | null;
  ticker: string;
  companyName?: string;
}

function ResultsEmitenLogo({ symbol }: { symbol: string }) {
  const [hasError, setHasError] = React.useState(false);

  const cleanSymbol = symbol.toUpperCase().trim();

  if (cleanSymbol.length < 3) return null;

  return (
    <div className="w-12 h-12 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-md">
      {!hasError ? (
        <Image
          src={`https://assets.stockbit.com/logos/companies/${cleanSymbol}.png`}
          alt={cleanSymbol}
          width={34}
          height={34}
          className="w-8.5 h-8.5 object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-black text-[12px] text-emerald-400">
          {cleanSymbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

function MetricRow({ label, value, sub, subClassName }: { label: string; value: string; sub?: string; subClassName?: string }) {
  return (
    <div className="flex justify-between items-baseline gap-2 border-t border-slate-200/50 dark:border-white/5 pt-2.5 md:pt-3">
      <span className="text-[11px] md:text-xs text-slate-500">{label}</span>
      <span className="text-right">
        <span className="text-xs md:text-sm font-semibold text-slate-700 dark:text-slate-300 block">{value}</span>
        {sub && <span className={`text-[10px] font-semibold block ${subClassName ?? 'text-slate-400'}`}>{sub}</span>}
      </span>
    </div>
  );
}

export function ResultsDisplay({ result, ticker, companyName }: ResultsDisplayProps) {
  const { language } = useLanguage();
  const isId = language === 'id';

  const cleanName = cleanCompanyName(companyName);

  const formatIDR = (value: number) => formatIDRBase(value, language);
  const pct = (value: number, signed = false) => formatPercent(value, { language, signed });

  // Keterangan jarak harga sekarang ke Break Even Point
  const breakEvenNote = (gainPct: number) => {
    if (gainPct > 0) return isId ? `Butuh naik ${pct(gainPct)}` : `Needs a ${pct(gainPct)} rise`;
    return isId ? 'Sudah di atas BEP' : 'Already above break-even';
  };

  if (!result || result.sharesAwal === 0) {
    return (
      <div className="glass-card p-8 flex flex-col items-center justify-center text-center h-full min-h-[350px] border-dashed border-2 border-slate-300/40 dark:border-white/10">
        <div className="w-16 h-16 rounded-2xl bg-slate-100 dark:bg-slate-900/50 flex items-center justify-center border border-slate-200 dark:border-white/5 mb-4 animate-pulse">
          <TrendingDown className="h-8 w-8 text-slate-400 dark:text-slate-500" />
        </div>
        <h3 className="text-lg font-bold text-slate-800 dark:text-slate-200">
          {isId ? 'Menunggu Input Data' : 'Waiting for Input Data'}
        </h3>
        <p className="text-sm text-slate-500 dark:text-slate-400 mt-2 max-w-xs">
          {isId
            ? 'Masukkan lot awal, rata-rata harga beli modal, dan rencana lot baru untuk memproyeksikan hasil secara instan.'
            : 'Enter initial lots, average buy price, and new purchase lots to project results instantly.'}
        </p>
      </div>
    );
  }

  const isProfitAwal = result.floatingPLAwal >= 0;
  const isProfitTotal = result.floatingPLTotalPct >= 0;
  const isAvgUp = result.avgPriceReductionPct < 0;
  const lossGrew = result.lossShrunkPct !== null && result.lossShrunkPct < 0;

  return (
    <div className="space-y-4 md:space-y-6 w-full animate-fadeIn">
      {/* Ringkasan atas: Emiten, Modal Baru, Total Lot */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-5.5 w-full"
      >
        {/* Card 1: Emiten */}
        <div className="glass-card p-4 md:p-5 border-emerald-500/40 bg-card-bg relative overflow-hidden flex items-center gap-4 min-h-[96px]">
          <div className="absolute top-0 left-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />
          <ResultsEmitenLogo key={ticker} symbol={ticker} />
          <div className="flex flex-col justify-center min-w-0">
            <h2 className="text-2xl md:text-3xl font-black text-white tracking-wider leading-none">
              {ticker}
            </h2>
            <span className="text-xs font-semibold text-emerald-400 mt-1 truncate" title={cleanName}>
              {cleanName || '-'}
            </span>
          </div>
        </div>

        {/* Card 2: Modal Baru yang Dibutuhkan */}
        <div className="glass-card p-4 md:p-5 bg-emerald-500/5 border-emerald-500/40 relative overflow-hidden flex flex-col justify-center min-h-[96px]">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full blur-2xl pointer-events-none" />
          <span className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block">
            {isId ? 'Modal Baru yang Dibutuhkan' : 'Required New Capital'}
          </span>
          <h3 className="text-xl md:text-2xl font-black tracking-tight text-emerald-400 mt-1">
            {formatIDR(result.capitalRequired)}
          </h3>
          <p className="text-[11px] md:text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {isId
              ? `+${(result.sharesBaru / 100).toLocaleString('id-ID')} Lot (${result.sharesBaru.toLocaleString('id-ID')} lembar)`
              : `+${(result.sharesBaru / 100).toLocaleString('en-US')} Lots (${result.sharesBaru.toLocaleString('en-US')} shares)`}
          </p>
        </div>

        {/* Card 3: Total Lot Akhir */}
        <div className="glass-card p-4 md:p-5 bg-white/5 dark:bg-black/25 border-slate-300 dark:border-white/25 flex flex-col justify-center min-h-[96px]">
          <span className="text-[9px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-widest block">
            {isId ? 'Total Lot Akhir' : 'Total Final Lots'}
          </span>
          <h3 className="text-xl md:text-2xl font-black text-slate-800 dark:text-white mt-1">
            {result.lotTotal.toLocaleString(isId ? 'id-ID' : 'en-US')} Lot
          </h3>
          <p className="text-[11px] md:text-xs font-medium text-slate-500 dark:text-slate-400 mt-0.5">
            {result.sharesTotal.toLocaleString(isId ? 'id-ID' : 'en-US')} {isId ? 'lembar' : 'shares'}
          </p>
        </div>
      </motion.div>

      {/* Grid Utama: Sebelum vs Sesudah */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5.5">
        {/* Sebelum Average Down */}
        <motion.div
          initial={{ opacity: 0, x: -15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
          className="glass-card p-4 md:p-6 border-slate-300 dark:border-white/25 flex flex-col justify-between"
        >
          <div>
            <div className="flex justify-between items-center mb-4 md:mb-5.5">
              <span className="text-[10px] md:text-xs font-extrabold uppercase tracking-widest text-slate-400">
                {isId ? 'SEBELUM AVG DOWN' : 'BEFORE AVG DOWN'}
              </span>
              <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full bg-slate-500/10 text-slate-400 border border-slate-500/20">
                {isId ? 'Holding Sekarang' : 'Current Holding'}
              </span>
            </div>

            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-[11px] md:text-xs text-slate-500">
                  {isId ? 'Harga Rata-Rata Awal' : 'Initial Average Price'}
                </span>
                <span className="text-sm md:text-base font-bold text-slate-700 dark:text-slate-200">{formatIDR(result.avgPriceAwal)}</span>
              </div>
              <MetricRow label={isId ? 'Total Modal Awal' : 'Total Initial Capital'} value={formatIDR(result.investedAmountAwal)} />
              <MetricRow label={isId ? 'Nilai Pasar (Market Value)' : 'Market Value'} value={formatIDR(result.marketValueAwal)} />
              <MetricRow
                label={isId ? 'Harga BEP (Impas)' : 'Break-even Price'}
                value={formatIDR(result.breakEvenPriceAwal)}
                sub={breakEvenNote(result.gainToBreakEvenAwalPct)}
                subClassName={result.gainToBreakEvenAwalPct > 0 ? 'text-bearish-red' : 'text-bullish-green'}
              />
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
                {pct(result.floatingPLAwalPct, true)}
              </span>
            </div>
          </div>
        </motion.div>

        {/* Sesudah Average Down */}
        <motion.div
          initial={{ opacity: 0, x: 15 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.4, delay: 0.15 }}
          className="glass-card p-4 md:p-6 border-emerald-500/40 bg-slate-900/10 flex flex-col justify-between relative overflow-hidden"
        >
          {result.turnedIntoProfit && (
            <div className="absolute -right-12 -top-12 w-28 h-28 bg-bullish-green/10 rounded-full blur-xl pointer-events-none" />
          )}
          <div>
            <div className="flex justify-between items-center mb-4 md:mb-5.5">
              <span className="text-[10px] md:text-xs font-extrabold uppercase tracking-widest text-emerald-400">
                {isId ? 'SESUDAH AVG DOWN' : 'AFTER AVG DOWN'}
              </span>
              {result.turnedIntoProfit ? (
                <motion.span
                  key="turned-profit"
                  initial={{ scale: 0.6, opacity: 0 }}
                  animate={{ scale: [0.6, 1.15, 1], opacity: 1 }}
                  transition={{ duration: 0.5 }}
                  className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full bg-bullish-green/10 text-bullish-green border border-bullish-green/20 flex items-center gap-1"
                >
                  <Sparkles className="h-2.5 w-2.5" />
                  {isId ? 'Berbalik Profit!' : 'Turned Profit!'}
                </motion.span>
              ) : (
                <span className="text-[9px] md:text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                  {isId ? 'Target Posisi Baru' : 'New Target Position'}
                </span>
              )}
            </div>

            <div className="space-y-3 md:space-y-4">
              <div className="flex justify-between items-baseline gap-2">
                <span className="text-[11px] md:text-xs text-emerald-400 font-semibold">
                  {isId ? 'Harga Rata-Rata Baru' : 'New Average Price'}
                </span>
                <span className="text-base md:text-lg font-black text-emerald-400">{formatIDR(result.avgPriceBaru)}</span>
              </div>
              <MetricRow label={isId ? 'Total Modal Baru (Gross)' : 'Total New Capital (Gross)'} value={formatIDR(result.investedAmountTotal)} />
              <MetricRow label={isId ? 'Nilai Pasar Baru' : 'New Market Value'} value={formatIDR(result.marketValueTotal)} />
              <MetricRow
                label={isId ? 'Harga BEP Baru (Impas)' : 'New Break-even Price'}
                value={formatIDR(result.breakEvenPriceBaru)}
                sub={breakEvenNote(result.gainToBreakEvenBaruPct)}
                subClassName={result.gainToBreakEvenBaruPct > 0 ? 'text-amber-400' : 'text-bullish-green'}
              />
            </div>
          </div>

          <div className="mt-6 md:mt-8 pt-3.5 md:pt-4.5 border-t border-slate-200 dark:border-white/10">
            <span className="text-[9px] md:text-[10px] font-bold text-slate-400 uppercase block mb-1">
              {isId ? 'Estimasi Floating P&L Baru' : 'Estimated New Floating P&L'}
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
                {pct(result.floatingPLTotalPct, true)}
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
        className="glass-card p-4 md:p-6 border-slate-300 dark:border-white/25 relative overflow-hidden"
      >
        <div className="absolute top-0 right-0 w-36 h-36 bg-emerald-500/5 rounded-full blur-3xl pointer-events-none" />

        <h4 className="text-[10px] md:text-xs font-bold uppercase tracking-wider text-slate-500 mb-4.5 md:mb-6 flex items-center gap-2 border-b border-slate-200/50 dark:border-white/5 pb-3">
          <ShieldCheck className="h-4.5 w-4.5 text-emerald-400" />
          {isId ? `Rangkuman Perbaikan Posisi (${ticker})` : `Position Improvement Summary (${ticker})`}
        </h4>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8">

          {/* Perubahan Harga Rata-Rata */}
          <div className="space-y-3.5">
            <div className="flex justify-between items-center gap-2 flex-wrap sm:flex-nowrap">
              <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                {isAvgUp
                  ? (isId ? 'Harga Rata-Rata Naik' : 'Average Price Increased')
                  : (isId ? 'Harga Rata-Rata Turun' : 'Average Price Reduced')}
              </span>
              <span className={`text-sm md:text-base font-bold shrink-0 text-right ${isAvgUp ? 'text-amber-400' : 'text-emerald-400'}`}>
                {pct(-result.avgPriceReductionPct, true)}
              </span>
            </div>

            {/* Custom Progress Bar */}
            <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-full overflow-hidden border border-slate-200/20 dark:border-white/5">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(100, Math.abs(result.avgPriceReductionPct))}%` }}
                transition={{ duration: 0.8, ease: 'easeOut' }}
                className={`h-full rounded-full ${isAvgUp ? 'bg-amber-400' : 'bg-emerald-500'}`}
              />
            </div>

            {/* Perbandingan Harga */}
            <div className="flex items-center gap-2.5 justify-between bg-white/85 dark:bg-slate-950/50 p-3 md:p-3.5 rounded-xl border border-slate-300/60 dark:border-white/10 shadow-md">
              <div className="flex flex-col min-w-0">
                <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider mb-0.5 block truncate">
                  {isId ? 'Avg Awal' : 'Initial Avg'}
                </span>
                <span className="font-semibold text-slate-600 dark:text-slate-300 text-xs md:text-sm block truncate">{formatIDR(result.avgPriceAwal)}</span>
              </div>
              <ArrowRight className="h-4 w-4 text-emerald-400 shrink-0" />
              <div className="flex flex-col text-right min-w-0">
                <span className="text-[9px] md:text-[10px] text-emerald-400 uppercase font-semibold tracking-wider mb-0.5 block truncate">
                  {isId ? 'Avg Baru' : 'New Avg'}
                </span>
                <span className="font-bold text-slate-800 dark:text-white text-xs md:text-sm block truncate">{formatIDR(result.avgPriceBaru)}</span>
              </div>
            </div>

            {isAvgUp && (
              <p className="text-[11px] text-amber-400/90 leading-relaxed">
                {isId
                  ? 'Harga beli baru lebih tinggi dari avg awal, jadi ini sebenarnya average up.'
                  : 'The new buy price is above your initial average, so this is actually averaging up.'}
              </p>
            )}
          </div>

          {/* Penyusutan Loss atau Pertumbuhan Profit */}
          <div className="space-y-3.5">
            {!isProfitAwal && result.lossShrunkPct !== null ? (
              <>
                <div className="flex justify-between items-center gap-2 flex-wrap sm:flex-nowrap">
                  <span className="text-[10px] md:text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
                    {lossGrew
                      ? (isId ? 'Floating Loss Membesar' : 'Floating Loss Increased')
                      : (isId ? 'Floating Loss Menyusut' : 'Floating Loss Reduced')}
                  </span>
                  <span className={`text-sm md:text-base font-bold shrink-0 text-right ${lossGrew ? 'text-bearish-red' : 'text-bullish-green dark:text-bullish-neon'}`}>
                    {result.lossShrunkPct >= 100
                      ? (isId ? '100% (Sembuh!)' : '100% (Recovered!)')
                      : pct(Math.abs(result.lossShrunkPct))}
                  </span>
                </div>

                {/* Custom Progress Bar */}
                <div className="w-full h-1.5 bg-slate-100 dark:bg-slate-900/60 rounded-full overflow-hidden border border-slate-200/20 dark:border-white/5">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.min(100, Math.abs(result.lossShrunkPct))}%` }}
                    transition={{ duration: 0.8, ease: 'easeOut' }}
                    className={`h-full rounded-full ${lossGrew ? 'bg-bearish-red' : 'bg-bullish-green'}`}
                  />
                </div>

                {/* Perbandingan Loss */}
                <div className="flex items-center gap-2.5 justify-between bg-white/85 dark:bg-slate-950/50 p-3 md:p-3.5 rounded-xl border border-slate-300/60 dark:border-white/10 shadow-md">
                  <div className="flex flex-col min-w-0">
                    <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider mb-0.5 block truncate">
                      {isId ? 'Loss Awal' : 'Initial Loss'}
                    </span>
                    <span className="font-semibold text-bearish-red text-xs md:text-sm block truncate">{pct(result.floatingPLAwalPct, true)}</span>
                  </div>
                  <ArrowRight className="h-4 w-4 text-bullish-green dark:text-bullish-neon shrink-0" />
                  <div className="flex flex-col text-right min-w-0">
                    <span className="text-[9px] md:text-[10px] text-slate-400 dark:text-slate-500 uppercase font-semibold tracking-wider mb-0.5 block truncate">
                      {isProfitTotal ? (isId ? 'Profit Baru' : 'New Profit') : (isId ? 'Loss Baru' : 'New Loss')}
                    </span>
                    <span className={`font-bold text-xs md:text-sm block truncate ${isProfitTotal ? 'text-bullish-green' : 'text-bearish-red'}`}>
                      {pct(result.floatingPLTotalPct, true)}
                    </span>
                  </div>
                </div>

                {/* Jarak ke BEP sebelum vs sesudah */}
                {result.gainToBreakEvenAwalPct > 0 && (
                  <p className="flex items-start gap-1.5 text-[11px] text-slate-400 leading-relaxed">
                    <Target className="h-3.5 w-3.5 text-emerald-400 shrink-0 mt-0.5" />
                    <span>
                      {result.gainToBreakEvenBaruPct > 0
                        ? (isId
                            ? <>Untuk impas, harga perlu naik <strong className="text-white">{pct(result.gainToBreakEvenBaruPct)}</strong> (sebelumnya {pct(result.gainToBreakEvenAwalPct)}).</>
                            : <>To break even, the price needs to rise <strong className="text-white">{pct(result.gainToBreakEvenBaruPct)}</strong> (previously {pct(result.gainToBreakEvenAwalPct)}).</>)
                        : (isId
                            ? <>Harga sekarang sudah di atas BEP baru (sebelumnya perlu naik {pct(result.gainToBreakEvenAwalPct)}).</>
                            : <>The current price is already above the new break-even (previously needed a {pct(result.gainToBreakEvenAwalPct)} rise).</>)}
                    </span>
                  </p>
                )}
              </>
            ) : (
              <div className="h-full flex items-center">
                <div className="flex items-start gap-2.5 text-xs p-3.5 rounded-xl bg-bullish-green/5 dark:bg-bullish-green/10 border border-bullish-green/20 text-bullish-green w-full">
                  <CheckCircle2 className="h-5 w-5 shrink-0 text-bullish-green mt-0.5" />
                  <div>
                    <span className="font-semibold block mb-1">
                      {isId ? 'Posisi Portofolio Sehat' : 'Healthy Portfolio Position'}
                    </span>
                    <span className="text-slate-500 dark:text-slate-400 text-[11px] leading-relaxed">
                      {isId
                        ? `Posisi awal Anda sudah profit. Pembelian baru ini akan menambah kepemilikan Anda sebesar ${pct((result.capitalRequired / result.investedAmountAwal) * 100)} dari modal awal, dengan proyeksi profit akhir sebesar ${pct(result.floatingPLTotalPct, true)}.`
                        : `Your initial position is already in profit. This new purchase will increase your holdings by ${pct((result.capitalRequired / result.investedAmountAwal) * 100)} of your initial capital, with a projected final profit of ${pct(result.floatingPLTotalPct, true)}.`}
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
