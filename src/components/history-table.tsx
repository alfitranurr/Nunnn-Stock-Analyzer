'use client';

import * as React from 'react';
import { Trash2, FolderOpen, Calculator, Info, History } from 'lucide-react';
import type { AppUser } from '@/lib/types';
import { cleanCompanyName } from '@/lib/utils';
import { calculateAvgDown } from '@/lib/calculator';
import { formatIDR, formatPercent } from '@/lib/format';
import { useLanguage } from '@/lib/language-context';
import Image from 'next/image';

export interface SavedPlan {
  id: string;
  ticker: string;
  company_name?: string;
  lot_awal: number;
  avg_price_awal: number;
  current_price: number;
  lot_baru: number;
  harga_beli_baru: number;
  fee_beli: number;
  fee_jual: number;
  created_at: string;
  avgPriceAwalIncludesFee?: boolean;
  tranches?: Array<{ id: string; lot: number; price: number }>;
}

interface HistoryTableProps {
  plans: SavedPlan[];
  onDeletePlan: (id: string) => void;
  onLoadPlan: (plan: SavedPlan) => void;
  onSignInClick?: () => void;
  user: AppUser | null;
}

function HistoryEmitenLogo({ symbol }: { symbol: string }) {
  const [hasError, setHasError] = React.useState(false);
  const [prevSymbol, setPrevSymbol] = React.useState(symbol);

  if (symbol !== prevSymbol) {
    setPrevSymbol(symbol);
    setHasError(false);
  }

  const cleanSymbol = symbol.toUpperCase().trim();

  if (cleanSymbol.length < 3) return null;

  return (
    <div className="w-8.5 h-8.5 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0 shadow-sm">
      {!hasError ? (
        <Image
          src={`https://assets.stockbit.com/logos/companies/${cleanSymbol}.png`}
          alt={cleanSymbol}
          width={34}
          height={34}
          className="w-full h-full object-contain p-0.5"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="text-[10px] font-extrabold text-slate-400 tracking-wider">
          {cleanSymbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

// Estimasi avg baru memakai rumus yang sama dengan kalkulator (termasuk fee).
function estimatePlan(plan: SavedPlan) {
  return calculateAvgDown({
    ticker: plan.ticker,
    lotAwal: plan.lot_awal,
    avgPriceAwal: plan.avg_price_awal,
    currentPrice: plan.current_price,
    lotBaru: plan.lot_baru,
    hargaBeliBaru: plan.harga_beli_baru,
    feeBeli: plan.fee_beli,
    feeJual: plan.fee_jual,
    includeFees: plan.fee_beli > 0 || plan.fee_jual > 0,
    avgPriceAwalIncludesFee: plan.avgPriceAwalIncludesFee !== false,
    tranches: plan.tranches,
  });
}

export function HistoryTable({ plans, onDeletePlan, onLoadPlan, onSignInClick, user }: HistoryTableProps) {
  const { language } = useLanguage();
  const isId = language === 'id';
  const numberLocale = isId ? 'id-ID' : 'en-US';

  const rows = React.useMemo(
    () => plans.map((plan) => ({ plan, estimate: estimatePlan(plan) })),
    [plans]
  );

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(numberLocale, {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return dateStr;
    }
  };

  const reductionBadge = (reductionPct: number) => {
    const isDown = reductionPct >= 0;
    return {
      className: isDown ? 'text-bullish-green bg-bullish-green/10' : 'text-amber-400 bg-amber-400/10',
      text: isDown
        ? `${isId ? 'Turun' : 'Down'} ${formatPercent(reductionPct, { language, maxFractionDigits: 1 })}`
        : `${isId ? 'Naik' : 'Up'} ${formatPercent(Math.abs(reductionPct), { language, maxFractionDigits: 1 })}`,
    };
  };

  const loadLabel = isId ? 'Muat' : 'Load';
  const loadTitle = isId ? 'Muat parameter ke kalkulator' : 'Load parameters into the calculator';
  const deleteTitle = isId ? 'Hapus rencana' : 'Delete plan';

  return (
    <div className="glass-card p-4 md:p-6 space-y-5 w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 border-b border-slate-200/50 dark:border-white/5 pb-3">
        <div className="space-y-1">
          <h2 className="text-lg font-extrabold tracking-tight flex items-center gap-2">
            <History className="h-4.5 w-4.5 text-emerald-400" />
            {isId ? 'Rencana Tersimpan' : 'Saved Plans'}
          </h2>
          <p className="text-xs text-slate-400">
            {isId
              ? 'Klik Muat untuk memasukkan kembali rencana ke kalkulator di atas.'
              : 'Click Load to put a plan back into the calculator above.'}
          </p>
        </div>
        <span className="px-3 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-bold text-slate-300 shrink-0 self-start sm:self-auto">
          {plans.length} {isId ? 'rencana' : plans.length === 1 ? 'plan' : 'plans'}
        </span>
      </div>

      {plans.length === 0 ? (
        <div className="py-10 flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-white/5 rounded-xl">
          <Calculator className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
          <p className="text-sm font-semibold">{isId ? 'Belum Ada Rencana Tersimpan' : 'No Saved Plans Yet'}</p>
          <p className="text-xs text-slate-400 max-w-xs mt-1">
            {isId
              ? 'Isi kalkulator di atas lalu klik Simpan untuk menyimpan rencana.'
              : 'Fill in the calculator above and click Save to keep a plan.'}
          </p>
        </div>
      ) : (
        <>
          {/* Desktop View (Table) */}
          <div className="hidden md:block overflow-x-auto">
            <div className="overflow-hidden border border-slate-200/50 dark:border-white/5 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200/50 dark:divide-white/5">
                <thead className="bg-slate-100/50 dark:bg-black/45">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isId ? 'Saham' : 'Stock'}</th>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isId ? 'Posisi Awal' : 'Initial Position'}</th>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isId ? 'Rencana Baru' : 'New Plan'}</th>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isId ? 'Estimasi Avg Baru' : 'Est. New Avg'}</th>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isId ? 'Tanggal' : 'Date'}</th>
                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">{isId ? 'Aksi' : 'Actions'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/30 dark:divide-white/5 bg-transparent">
                  {rows.map(({ plan, estimate }) => {
                    const badge = reductionBadge(estimate.avgPriceReductionPct);
                    return (
                      <tr key={plan.id} className="hover:bg-slate-100/30 dark:hover:bg-white/3 transition-colors">
                        {/* Saham */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <HistoryEmitenLogo symbol={plan.ticker} />
                            <div className="flex flex-col">
                              <span className="font-extrabold text-sm text-emerald-400 tracking-wider leading-tight">
                                {plan.ticker}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[130px] leading-tight" title={cleanCompanyName(plan.company_name)}>
                                {cleanCompanyName(plan.company_name) || '-'}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Posisi Awal */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-medium">{plan.lot_awal.toLocaleString(numberLocale)} Lot</span>
                            <span className="text-[10px] text-slate-400">@ {formatIDR(plan.avg_price_awal, language)}</span>
                          </div>
                        </td>

                        {/* Rencana Baru */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-emerald-400">+{plan.lot_baru.toLocaleString(numberLocale)} Lot</span>
                            <span className="text-[10px] text-slate-400">@ {formatIDR(plan.harga_beli_baru, language)}</span>
                          </div>
                        </td>

                        {/* Estimasi Baru */}
                        <td className="px-4 py-4 whitespace-nowrap">
                          <div className="flex flex-col items-start gap-0.5 text-xs">
                            <span className="font-bold text-slate-800 dark:text-white">{formatIDR(estimate.avgPriceBaru, language)}</span>
                            <span className={`text-[10px] font-semibold px-1 rounded ${badge.className}`}>{badge.text}</span>
                          </div>
                        </td>

                        {/* Tanggal */}
                        <td className="px-4 py-4 whitespace-nowrap text-xs text-slate-400">
                          {formatDate(plan.created_at)}
                        </td>

                        {/* Aksi */}
                        <td className="px-4 py-4 whitespace-nowrap text-right text-xs font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onLoadPlan(plan)}
                              className="py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5"
                              title={loadTitle}
                            >
                              <FolderOpen className="h-3.5 w-3.5" />
                              <span>{loadLabel}</span>
                            </button>
                            <button
                              onClick={() => onDeletePlan(plan.id)}
                              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                              title={deleteTitle}
                              aria-label={`${deleteTitle} ${plan.ticker}`}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Mobile View (Cards) */}
          <div className="block md:hidden space-y-3">
            {rows.map(({ plan, estimate }) => {
              const badge = reductionBadge(estimate.avgPriceReductionPct);
              return (
                <div
                  key={plan.id}
                  className="p-4 rounded-xl border border-slate-200/40 dark:border-white/5 bg-white/2 dark:bg-black/15 space-y-3"
                >
                  {/* Ticker & Logo & Date */}
                  <div className="flex items-center justify-between border-b border-slate-200/30 dark:border-white/5 pb-2">
                    <div className="flex items-center gap-2">
                      <HistoryEmitenLogo symbol={plan.ticker} />
                      <div className="flex flex-col">
                        <span className="font-extrabold text-sm text-emerald-400 tracking-wider leading-none">
                          {plan.ticker}
                        </span>
                        <span className="text-[9px] text-slate-400 truncate max-w-[150px] mt-0.5">
                          {cleanCompanyName(plan.company_name) || '-'}
                        </span>
                      </div>
                    </div>
                    <span className="text-[9px] text-slate-500 font-medium">
                      {formatDate(plan.created_at)}
                    </span>
                  </div>

                  {/* Info Grid */}
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-500 text-[10px] block">{isId ? 'Posisi Awal' : 'Initial Position'}</span>
                      <span className="font-bold text-slate-700 dark:text-slate-400">{plan.lot_awal.toLocaleString(numberLocale)} Lot</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">@ {formatIDR(plan.avg_price_awal, language)}</span>
                    </div>
                    <div>
                      <span className="text-slate-500 text-[10px] block">{isId ? 'Rencana Baru' : 'New Plan'}</span>
                      <span className="font-bold text-emerald-400">+{plan.lot_baru.toLocaleString(numberLocale)} Lot</span>
                      <span className="text-[10px] text-slate-400 block mt-0.5">@ {formatIDR(plan.harga_beli_baru, language)}</span>
                    </div>
                  </div>

                  {/* Estimate & Actions */}
                  <div className="flex items-center justify-between pt-2 border-t border-slate-200/30 dark:border-white/5 bg-slate-100/10 dark:bg-black/10 -mx-4 -mb-4 p-3 rounded-b-xl">
                    <div>
                      <span className="text-[9px] text-slate-500 uppercase block font-bold leading-none mb-1">{isId ? 'Estimasi Avg Baru' : 'Est. New Avg'}</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-black text-slate-800 dark:text-white text-xs">{formatIDR(estimate.avgPriceBaru, language)}</span>
                        <span className={`text-[9px] font-extrabold px-1 rounded ${badge.className}`}>{badge.text}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onLoadPlan(plan)}
                        className="py-1.5 px-3 rounded-lg bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 border border-emerald-500/20 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                        title={loadTitle}
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>{loadLabel}</span>
                      </button>
                      <button
                        onClick={() => onDeletePlan(plan.id)}
                        className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                        title={deleteTitle}
                        aria-label={`${deleteTitle} ${plan.ticker}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {!user && plans.length > 0 && (
        <div className="p-3 rounded-xl bg-slate-100/50 dark:bg-black/25 border border-slate-200/50 dark:border-white/5 text-[11px] text-slate-500 flex items-start gap-2">
          <Info className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" />
          <span>
            {isId ? (
              <>Anda saat ini menggunakan <strong>Penyimpanan Lokal (localStorage)</strong>. Riwayat ini akan hilang jika cache browser dibersihkan.</>
            ) : (
              <>You are currently using <strong>Local Storage</strong>. This history will be lost if the browser cache is cleared.</>
            )}
            {onSignInClick && (
              <>
                {' '}
                <button
                  type="button"
                  onClick={onSignInClick}
                  className="text-emerald-400 hover:underline font-bold cursor-pointer bg-transparent border-none p-0 inline"
                >
                  {isId ? 'Masuk ke akun Anda' : 'Sign in to your account'}
                </button>{' '}
                {isId ? 'untuk menyinkronkan data ke cloud database.' : 'to sync your data to the cloud database.'}
              </>
            )}
          </span>
        </div>
      )}
    </div>
  );
}
