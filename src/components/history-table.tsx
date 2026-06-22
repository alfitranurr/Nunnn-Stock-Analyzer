'use client';

import * as React from 'react';
import { Trash2, ExternalLink, Calendar, Calculator, Info } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { cleanCompanyName } from '@/lib/utils';

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
  user: any;
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
        <img
          src={`https://assets.stockbit.com/logos/companies/${cleanSymbol}.png`}
          alt={cleanSymbol}
          className="w-6 h-6 object-contain"
          onError={() => setHasError(true)}
        />
      ) : (
        <span className="font-black text-[9.5px] text-brand-purple">
          {cleanSymbol.slice(0, 2)}
        </span>
      )}
    </div>
  );
}

export function HistoryTable({ plans, onDeletePlan, onLoadPlan, user }: HistoryTableProps) {
  const formatIDR = (value: number) => {
    const formatted = new Intl.NumberFormat('en-US', {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(Math.abs(value));
    return value < 0 ? `-Rp ${formatted}` : `Rp ${formatted}`;
  };

  const formatDate = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString('id-ID', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="glass-card p-6 w-full border border-slate-200/50 dark:border-white/5 overflow-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3 mb-6 pb-4 border-b border-slate-200/50 dark:border-white/5">
        <div>
          <h3 className="text-lg font-bold tracking-tight flex items-center gap-2">
            <Calendar className="h-5 w-5 text-brand-purple" />
            Riwayat Simulasi Rencana
          </h3>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Daftar simulasi average down yang telah disimpan sebelumnya.
          </p>
        </div>
        <div className="text-[10px] font-bold px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-slate-400">
          Total: {plans.length} Rencana
        </div>
      </div>

      {plans.length === 0 ? (
        <div className="py-12 flex flex-col items-center justify-center text-center text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-white/5 rounded-xl">
          <Calculator className="h-10 w-10 text-slate-300 dark:text-slate-700 mb-3" />
          <p className="text-sm font-semibold">Belum Ada Rencana Tersimpan</p>
          <p className="text-xs text-slate-400 max-w-xs mt-1">
            Simulasikan data Anda pada form kalkulator di atas lalu klik tombol Simpan untuk merekam riwayat.
          </p>
        </div>
      ) : (
        <>
          {/* Desktop View (Table) */}
          <div className="hidden md:block overflow-x-auto">
          <div className="inline-block min-w-full align-middle md:px-0">
            <div className="overflow-hidden border border-slate-200/50 dark:border-white/5 rounded-xl">
              <table className="min-w-full divide-y divide-slate-200/50 dark:divide-white/5">
                <thead className="bg-slate-100/50 dark:bg-black/45">
                  <tr>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Saham</th>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Posisi Awal</th>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Rencana Baru</th>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Estimasi Baru</th>
                    <th scope="col" className="px-4 py-3 text-left text-[10px] font-bold text-slate-500 uppercase tracking-wider">Tanggal</th>
                    <th scope="col" className="px-4 py-3 text-right text-[10px] font-bold text-slate-500 uppercase tracking-wider">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200/30 dark:divide-white/5 bg-transparent">
                  {plans.map((plan) => {
                    // Quick calculations for display summary
                    const modalBaru = plan.lot_baru * 100 * plan.harga_beli_baru * (1 + (plan.fee_beli / 100));
                    const totalLot = plan.lot_awal + plan.lot_baru;
                    const totalShares = totalLot * 100;
                    const investedAwal = plan.lot_awal * 100 * plan.avg_price_awal;
                    const newAvgPrice = (investedAwal + modalBaru) / totalShares;
                    const reductionPct = ((plan.avg_price_awal - newAvgPrice) / plan.avg_price_awal) * 100;

                    return (
                      <tr key={plan.id} className="hover:bg-slate-100/30 dark:hover:bg-white/3 transition-colors">
                        {/* Saham */}
                        <td className="px-4 py-4.5 whitespace-nowrap">
                          <div className="flex items-center gap-2.5">
                            <HistoryEmitenLogo symbol={plan.ticker} />
                            <div className="flex flex-col">
                              <span className="font-extrabold text-sm text-brand-purple dark:text-brand-purple tracking-wider leading-tight">
                                {plan.ticker}
                              </span>
                              <span className="text-[10px] text-slate-400 truncate max-w-[130px] leading-tight" title={cleanCompanyName(plan.company_name)}>
                                {cleanCompanyName(plan.company_name) || '-'}
                              </span>
                            </div>
                          </div>
                        </td>
                        
                        {/* Posisi Awal */}
                        <td className="px-4 py-4.5 whitespace-nowrap">
                          <div className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-medium">{plan.lot_awal.toLocaleString('en-US')} Lot</span>
                            <span className="text-[10px] text-slate-400">@ {formatIDR(plan.avg_price_awal)}</span>
                          </div>
                        </td>
                        
                        {/* Rencana Baru */}
                        <td className="px-4 py-4.5 whitespace-nowrap">
                          <div className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-semibold text-brand-purple dark:text-brand-purple">+{plan.lot_baru.toLocaleString('en-US')} Lot</span>
                            <span className="text-[10px] text-slate-400">@ {formatIDR(plan.harga_beli_baru)}</span>
                          </div>
                        </td>
                        
                        {/* Estimasi Baru */}
                        <td className="px-4 py-4.5 whitespace-nowrap">
                          <div className="flex flex-col text-xs text-slate-600 dark:text-slate-300">
                            <span className="font-bold text-slate-800 dark:text-white">{formatIDR(newAvgPrice)}</span>
                            <span className="text-[10px] text-bullish-green font-semibold">
                              Turun {reductionPct.toFixed(1)}%
                            </span>
                          </div>
                        </td>

                        {/* Tanggal */}
                        <td className="px-4 py-4.5 whitespace-nowrap text-xs text-slate-400">
                          {formatDate(plan.created_at)}
                        </td>

                        {/* Aksi */}
                        <td className="px-4 py-4.5 whitespace-nowrap text-right text-xs font-medium">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => onLoadPlan(plan)}
                              className="p-2 rounded-lg bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple dark:text-brand-purple border border-brand-purple/20 transition-all cursor-pointer flex items-center justify-center"
                              title="Terapkan Parameter"
                            >
                              <ExternalLink className="h-4 w-4" />
                            </button>
                            <button
                              onClick={() => onDeletePlan(plan.id)}
                              className="p-2 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                              title="Hapus Rencana"
                            >
                              <Trash2 className="h-4 w-4" />
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
        </div>

        {/* Mobile View (Cards) */}
        <div className="block md:hidden space-y-3">
          {plans.map((plan) => {
            const modalBaru = plan.lot_baru * 100 * plan.harga_beli_baru * (1 + (plan.fee_beli / 100));
            const totalLot = plan.lot_awal + plan.lot_baru;
            const totalShares = totalLot * 100;
            const investedAwal = plan.lot_awal * 100 * plan.avg_price_awal;
            const newAvgPrice = (investedAwal + modalBaru) / totalShares;
            const reductionPct = ((plan.avg_price_awal - newAvgPrice) / plan.avg_price_awal) * 100;

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
                      <span className="font-extrabold text-sm text-brand-purple tracking-wider leading-none">
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
                    <span className="text-slate-500 text-[10px] block">Posisi Awal</span>
                    <span className="font-bold text-slate-700 dark:text-slate-350">{plan.lot_awal.toLocaleString('en-US')} Lot</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">@ {formatIDR(plan.avg_price_awal)}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] block">Rencana Baru</span>
                    <span className="font-bold text-brand-purple">+{plan.lot_baru.toLocaleString('en-US')} Lot</span>
                    <span className="text-[10px] text-slate-400 block mt-0.5">@ {formatIDR(plan.harga_beli_baru)}</span>
                  </div>
                </div>

                {/* Estimate & Actions */}
                <div className="flex items-center justify-between pt-2 border-t border-slate-200/30 dark:border-white/5 bg-slate-100/10 dark:bg-black/10 -mx-4 -mb-4 p-3 rounded-b-xl">
                  <div>
                    <span className="text-[9px] text-slate-500 uppercase block font-bold leading-none mb-1">Estimasi Avg Baru</span>
                    <div className="flex items-center gap-1.5">
                      <span className="font-black text-slate-800 dark:text-white text-xs">{formatIDR(newAvgPrice)}</span>
                      <span className="text-[9px] text-bullish-green font-extrabold bg-bullish-green/10 px-1 rounded">
                        -{reductionPct.toFixed(1)}%
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onLoadPlan(plan)}
                      className="py-1.5 px-3 rounded-lg bg-brand-purple/10 hover:bg-brand-purple/20 text-brand-purple dark:text-brand-purple border border-brand-purple/20 text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" />
                      <span>Muat</span>
                    </button>
                    <button
                      onClick={() => onDeletePlan(plan.id)}
                      className="p-1.5 rounded-lg bg-rose-500/10 hover:bg-rose-500/20 text-rose-500 border border-rose-500/20 transition-all cursor-pointer flex items-center justify-center"
                      title="Hapus Rencana"
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
        <div className="mt-4 p-3 rounded-xl bg-slate-100/50 dark:bg-black/25 border border-slate-200/50 dark:border-white/5 text-[11px] text-slate-500 flex items-start gap-2">
          <Info className="h-4 w-4 text-brand-purple shrink-0 mt-0.5" />
          <span>
            Anda saat ini menggunakan <strong>Penyimpanan Lokal (localStorage)</strong>. Riwayat ini akan hilang jika cache browser dibersihkan. 
            <button 
              onClick={() => {
                const el = document.querySelector('[title="Masuk ke Akun"]') as HTMLButtonElement;
                if (el) el.click();
              }}
              className="text-brand-purple hover:underline font-bold ml-1 cursor-pointer bg-transparent border-none p-0 inline"
            >
              Masuk ke akun Anda
            </button> untuk menyinkronkan data secara otomatis ke cloud database.
          </span>
        </div>
      )}
    </div>
  );
}
