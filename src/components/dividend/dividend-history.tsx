'use client';

import * as React from 'react';
import { BarChart3, ChevronDown, History } from 'lucide-react';
import type { DividendProfile } from '@/lib/dividend';
import { Badge, Card, CardTitle, Stat, formatDate, pct, pick, rpShare, type Lang } from './ui';

const VISIBLE_YEARS = 12;
const MOBILE_YEARS = 6;
const VISIBLE_EVENTS = 8;

interface DividendHistoryProps {
  language: Lang;
  ticker: string;
  profile: DividendProfile;
  marketPrice: number | null;
}

/** Profil dividen: ringkasan kualitas, grafik DPS per tahun, dan riwayat pembagian. */
export function DividendHistory({ language, ticker, profile, marketPrice }: DividendHistoryProps) {
  const L = (id: string, en: string) => pick(language, id, en);
  const [showAll, setShowAll] = React.useState(false);

  const years = profile.annual.slice(-VISIBLE_YEARS);
  const maxDps = Math.max(...years.map((y) => y.dps), 0);
  const ttmYield = marketPrice && marketPrice > 0 ? (profile.ttmDps / marketPrice) * 100 : null;
  const events = showAll ? profile.events : profile.events.slice(0, VISIBLE_EVENTS);

  return (
    <Card>
      <CardTitle
        icon={<History className="h-5 w-5 text-emerald-400" />}
        title={L(`Profil Dividen ${ticker}`, `${ticker} Dividend Profile`)}
        subtitle={L(
          'Dihitung dari seluruh riwayat pembagian. Tahun = tahun ex-date (ex-date Januari dihitung ke tahun sebelumnya).',
          'Computed from the full payout history. Year = ex-date year (January ex-dates count toward the previous year).'
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
        <Stat
          tone="emerald"
          label={L('Dividen 12 bln (TTM)', 'Dividend (TTM)')}
          value={rpShare(profile.ttmDps, language)}
          sub={profile.ttmPayments > 0
            ? L(`${profile.ttmPayments}× pembayaran / lembar`, `${profile.ttmPayments} payment(s) / share`)
            : L('Tidak ada dalam 12 bln terakhir', 'None in the last 12 months')}
        />
        <Stat
          tone="emerald"
          label={L('Yield TTM', 'TTM Yield')}
          value={ttmYield !== null ? pct(ttmYield, language) : '—'}
          sub={L('di harga pasar sekarang', 'at current market price')}
        />
        <Stat
          tone="sky"
          label={L('Konsistensi', 'Consistency')}
          value={profile.consecutiveYears > 0 ? L(`${profile.consecutiveYears} thn`, `${profile.consecutiveYears} yrs`) : '—'}
          sub={L('berturut-turut membagikan', 'of consecutive payouts')}
        />
        <Stat
          tone={profile.growth && profile.growth.cagrPct < 0 ? 'rose' : 'sky'}
          label={profile.growth ? L(`Pertumbuhan ${profile.growth.years} thn`, `${profile.growth.years}-yr growth`) : L('Pertumbuhan', 'Growth')}
          value={profile.growth ? `${profile.growth.cagrPct >= 0 ? '+' : ''}${pct(profile.growth.cagrPct, language, 1)}` : '—'}
          sub={L('CAGR dividen per lembar / thn', 'Dividend-per-share CAGR / yr')}
        />
        <Stat
          className="col-span-2 lg:col-span-1"
          tone={profile.declinesLast5 >= 3 ? 'amber' : 'slate'}
          label={L('Stabilitas', 'Stability')}
          value={profile.lastFullYear !== null ? L(`Turun ${profile.declinesLast5}×`, `${profile.declinesLast5} cut(s)`) : '—'}
          sub={L('dalam 5 tahun penuh terakhir', 'in the last 5 full years')}
        />
      </div>

      {years.length > 0 && (
        <div className="mt-6">
          <h3 className="text-xs font-bold text-slate-300 flex items-center gap-2 mb-3">
            <BarChart3 className="h-4 w-4 text-emerald-400" />
            {L('Dividen per lembar per tahun', 'Dividend per share by year')}
          </h3>
          <div>
            <div className="flex items-end gap-1.5 sm:gap-2 h-48 px-1" role="img" aria-label={L('Grafik dividen per tahun', 'Dividend per year chart')}>
              {years.map((y, i) => {
                const h = maxDps > 0 ? Math.max(2, (y.dps / maxDps) * 100) : 0;
                return (
                  <div
                    key={y.year}
                    className={`flex-1 min-w-0 h-full flex-col items-center justify-end gap-1 ${i < years.length - MOBILE_YEARS ? 'hidden sm:flex' : 'flex'}`}
                    title={`${y.year}: ${rpShare(y.dps, language)} (${y.payments}×)${y.yieldPct !== null ? ` · yield ${pct(y.yieldPct, language)}` : ''}`}
                  >
                    <span className="text-[9px] sm:text-[10px] font-bold text-slate-300 tabular-nums whitespace-nowrap">
                      {y.dps > 0 ? rpShare(y.dps, language).replace('Rp ', '') : '0'}
                    </span>
                    <div className="flex-1 w-full flex items-end justify-center">
                      <div
                        className={`w-full max-w-[44px] rounded-t-md ${
                          y.partial
                            ? 'bg-emerald-500/25 border border-dashed border-emerald-400/60'
                            : y.dps > 0
                              ? 'bg-gradient-to-t from-emerald-600 to-emerald-400'
                              : 'bg-rose-500/40'
                        }`}
                        style={{ height: `${h}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-1.5 sm:gap-2 px-1 mt-1.5 border-t border-white/10 pt-1.5">
              {years.map((y, i) => (
                <div key={y.year} className={`flex-1 min-w-0 text-center ${i < years.length - MOBILE_YEARS ? 'hidden sm:block' : ''}`}>
                  <span className="block text-[10px] font-bold text-slate-400">{y.year}{y.partial ? '*' : ''}</span>
                  <span className="block text-[9px] text-slate-500 tabular-nums">{y.yieldPct !== null ? pct(y.yieldPct, language, 1) : '—'}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-[10px] text-slate-500 mt-2">
            {L(
              '* tahun berjalan (belum lengkap). Baris bawah = yield terhadap rata-rata harga tahun itu.',
              '* current year (incomplete). Bottom row = yield on that year’s average price.'
            )}
          </p>
        </div>
      )}

      <div className="mt-6">
        <h3 className="text-xs font-bold text-slate-300 mb-2">
          {L(`Riwayat pembagian (${profile.events.length})`, `Payout history (${profile.events.length})`)}
        </h3>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full min-w-[560px] text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">{L('Tahun', 'Year')}</th>
                <th className="py-2.5 px-3">{L('Cum date ≈', 'Cum date ≈')}</th>
                <th className="py-2.5 px-3">Ex date</th>
                <th className="py-2.5 px-3">{L('Cair ≈', 'Paid ≈')}</th>
                <th className="py-2.5 px-3 text-right">{L('Dividen / lembar', 'Dividend / share')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {events.map((e) => (
                <tr key={e.exDate} className="hover:bg-white/[0.03]">
                  <td className="py-2.5 px-3 font-bold text-white whitespace-nowrap">
                    {e.dividendYear}
                    {e.upcoming && <span className="ml-2"><Badge tone="sky">{L('Terjadwal', 'Scheduled')}</Badge></span>}
                  </td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{formatDate(e.cumDate, language)}</td>
                  <td className="py-2.5 px-3 whitespace-nowrap">{formatDate(e.exDate, language)}</td>
                  <td className="py-2.5 px-3 text-slate-400 whitespace-nowrap">{formatDate(e.payDate, language)}</td>
                  <td className="py-2.5 px-3 text-right font-mono font-bold text-emerald-400 whitespace-nowrap">{rpShare(e.amount, language)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {profile.events.length > VISIBLE_EVENTS && (
          <button
            type="button"
            onClick={() => setShowAll((v) => !v)}
            className="mt-2 w-full py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAll ? 'rotate-180' : ''}`} />
            {showAll ? L('Ringkas', 'Show less') : L(`Tampilkan semua (${profile.events.length})`, `Show all (${profile.events.length})`)}
          </button>
        )}
        <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
          {L(
            'Ex date dari sumber data. Cum date = 1 hari bursa sebelum ex date (batas akhir beli); tanggal cair diperkirakan ±18 hari setelah ex date. Hari libur bursa belum diperhitungkan, jadi cek pengumuman resmi emiten di KSEI/BEI.',
            'Ex date comes from the data source. Cum date = 1 trading day before the ex date (last day to buy); payment is estimated ~18 days after the ex date. Exchange holidays are not accounted for, so check the official KSEI/IDX announcement.'
          )}
        </p>
      </div>
    </Card>
  );
}
