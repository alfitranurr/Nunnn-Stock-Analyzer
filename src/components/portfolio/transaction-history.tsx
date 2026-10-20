'use client';

import * as React from 'react';
import { History, Trash2 } from 'lucide-react';
import { Badge, Card, CardTitle, Stat, pct, pick, rp2 as rp, type Lang } from '@/components/shared/calc-ui';
import { CompanyLogo } from '@/components/company-logo';
import { formatNumberLocale } from '@/lib/format';
import { SHARES_PER_LOT, summarizeRealized, type PortfolioTransaction, type TransactionSource } from '@/lib/portfolio-transactions';

interface TransactionHistoryProps {
  language: Lang;
  list: PortfolioTransaction[];
  loaded: boolean;
  source: TransactionSource;
  warning: string | null;
  onDelete: (tx: PortfolioTransaction) => void;
}

/** Tab "Riwayat & Realized": ringkasan untung/rugi yang sudah direalisasi dan daftar transaksi. */
export function TransactionHistory({ language, list, loaded, source, warning, onDelete }: TransactionHistoryProps) {
  const L = (id: string, en: string) => pick(language, id, en);
  const summary = React.useMemo(() => summarizeRealized(list), [list]);
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${rp(Math.abs(v), language)}`;
  const tone = (v: number) => (v > 0 ? 'text-emerald-400' : v < 0 ? 'text-rose-400' : 'text-slate-200');
  const toneOf = (v: number) => (v > 0 ? 'emerald' : v < 0 ? 'rose' : 'slate') as 'emerald' | 'rose' | 'slate';
  const when = (iso: string) =>
    new Date(iso).toLocaleString(language === 'id' ? 'id-ID' : 'en-US', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Jakarta' });
  const stat = 'text-[13.5px] min-[400px]:text-[15px] sm:text-lg';

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat tone={toneOf(summary.monthPl)} valueClassName={stat} label={L('Realized bulan ini', 'Realized this month')} value={<span className={tone(summary.monthPl)}>{signed(summary.monthPl)}</span>} sub={L('dari penjualan bulan ini (WIB)', 'from sales this month (WIB)')} />
        <Stat tone={toneOf(summary.yearPl)} valueClassName={stat} label={L('Realized tahun ini', 'Realized this year')} value={<span className={tone(summary.yearPl)}>{signed(summary.yearPl)}</span>} sub={L('sejak 1 Januari', 'since 1 January')} />
        <Stat tone={toneOf(summary.totalPl)} valueClassName={stat} label={L('Total realized', 'Total realized')} value={<span className={tone(summary.totalPl)}>{signed(summary.totalPl)}</span>} sub={L(`${summary.sells} penjualan tercatat`, `${summary.sells} sales recorded`)} />
        <Stat
          tone={summary.winRate === null ? 'slate' : summary.winRate >= 50 ? 'emerald' : 'amber'}
          valueClassName={stat}
          label={L('Win rate', 'Win rate')}
          value={summary.winRate === null ? '—' : pct(summary.winRate, language)}
          sub={L(`${summary.wins} untung · ${summary.losses} rugi`, `${summary.wins} wins · ${summary.losses} losses`)}
        />
      </div>

      <Card>
        <CardTitle
          icon={<History className="h-5 w-5 text-emerald-400" />}
          title={L('Riwayat transaksi', 'Transaction history')}
          subtitle={L(
            `Beli dicatat saat menambah/beli lagi saham, jual dari tombol Jual. ${source === 'cloud' ? 'Tersimpan di akun Anda.' : 'Tersimpan di perangkat ini.'}`,
            `Buys are recorded when adding/buying more, sells from the Sell button. ${source === 'cloud' ? 'Saved to your account.' : 'Saved on this device.'}`
          )}
        />
        {warning && (
          <p className="mb-3 text-[11px] text-amber-200 bg-amber-500/10 border border-amber-500/25 rounded-xl p-2.5">
            {L(
              'Tabel riwayat belum ada di database. Jalankan migrasi supabase/migrations/20261020000014_portfolio_transactions.sql di Supabase SQL Editor; sementara riwayat disimpan di browser ini.',
              'The history table is missing in the database. Run supabase/migrations/20261020000014_portfolio_transactions.sql in the Supabase SQL Editor; meanwhile history is stored in this browser.'
            )}
          </p>
        )}

        {!loaded ? (
          <div className="space-y-2 animate-pulse" aria-busy="true">
            {Array.from({ length: 3 }, (_, i) => <div key={i} className="h-12 rounded-2xl bg-white/5" />)}
          </div>
        ) : list.length === 0 ? (
          <div className="py-10 flex flex-col items-center text-center gap-2 rounded-2xl border border-dashed border-white/10">
            <History className="h-8 w-8 text-slate-600" />
            <p className="text-sm font-bold text-white">{L('Belum ada transaksi', 'No transactions yet')}</p>
            <p className="text-xs text-slate-400 max-w-sm">{L('Tekan Jual pada saham di tab Kepemilikan untuk mencatat penjualan dan realized P/L.', 'Press Sell on a holding in the Holdings tab to record a sale and its realized P/L.')}</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/5">
            {list.map((tx) => {
              const value = tx.lot * SHARES_PER_LOT * tx.price;
              const plPct = tx.realizedPl !== null && tx.avgCost ? (tx.realizedPl / (tx.lot * SHARES_PER_LOT * tx.avgCost)) * 100 : null;
              return (
                <li key={tx.id} className="py-3 flex items-center gap-3">
                  <CompanyLogo symbol={tx.ticker} size={34} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-sm font-black text-white">{tx.ticker}</span>
                      <Badge tone={tx.side === 'sell' ? 'rose' : 'emerald'}>{tx.side === 'sell' ? L('Jual', 'Sell') : L('Beli', 'Buy')}</Badge>
                      <span className="text-[11px] text-slate-400">{when(tx.tradedAt)}</span>
                    </div>
                    <p className="text-[12px] text-slate-300 mt-0.5 font-mono">
                      {formatNumberLocale(tx.lot, language, 0)} lot @ {rp(tx.price, language)} · {rp(value, language)}
                      {tx.side === 'sell' && tx.avgCost !== null && <span className="text-slate-500"> · avg {rp(tx.avgCost, language)}</span>}
                    </p>
                  </div>
                  {tx.side === 'sell' && tx.realizedPl !== null && (
                    <div className="text-right shrink-0">
                      <p className={`text-sm font-black font-mono ${tone(tx.realizedPl)}`}>{signed(tx.realizedPl)}</p>
                      {plPct !== null && <p className={`text-[11px] font-bold ${tone(tx.realizedPl)}`}>{`${plPct > 0 ? '+' : ''}${pct(plPct, language)}`}</p>}
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => onDelete(tx)}
                    title={L('Hapus catatan', 'Delete record')}
                    aria-label={L(`Hapus catatan ${tx.ticker}`, `Delete ${tx.ticker} record`)}
                    className="p-2 rounded-lg border border-rose-500/20 bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 cursor-pointer shrink-0"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </li>
              );
            })}
          </ul>
        )}
        <p className="text-[11px] text-slate-500 mt-3 leading-relaxed">
          {L(
            'Realized P/L = hasil jual setelah fee − lot × 100 × harga rata-rata saat dijual. Menghapus catatan tidak mengubah posisi atau kas.',
            'Realized P/L = sale proceeds after fees − lots × 100 × average price at the time of sale. Deleting a record does not change positions or cash.'
          )}
        </p>
      </Card>
    </div>
  );
}
