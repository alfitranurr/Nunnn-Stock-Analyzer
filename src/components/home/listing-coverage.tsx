'use client';

import * as React from 'react';
import { Building2 } from 'lucide-react';
import { AnimatedNumber, GrowBar } from '@/components/shared/motion';
import { useDataRefreshEpoch } from '@/lib/refresh-signal';
import { formatNumberLocale } from '@/lib/format';
import type { ListingCoverage as Coverage } from '@/lib/listing-coverage';
import type { Lang } from './types';

/** Cakupan emiten: berapa yang terpantau di web ini dibanding jumlah resmi tercatat di BEI. */
export function ListingCoverage({ language, isActive }: { language: Lang; isActive: boolean }) {
  const isId = language === 'id';
  const [data, setData] = React.useState<Coverage | null>(null);
  const [failed, setFailed] = React.useState(false);
  const epoch = useDataRefreshEpoch();

  React.useEffect(() => {
    if (!isActive) return;
    let cancelled = false;
    fetch('/api/universe')
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error(String(res.status)))))
      .then((json: Coverage) => {
        if (!cancelled) {
          setData(json);
          setFailed(false);
        }
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isActive, epoch]);

  if (failed && !data) return null;
  if (!data) return <div className="h-[92px] rounded-[20px] skeleton-shimmer" aria-hidden />;

  const num = (v: number) => formatNumberLocale(Math.round(v), language);
  const gap = Math.max(0, data.official.count - data.tracked);
  const asOf = new Intl.DateTimeFormat(isId ? 'id-ID' : 'en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(Date.parse(`${data.official.asOf}T00:00:00Z`));
  const activePct = data.official.count > 0 ? (data.active / data.official.count) * 100 : 0;
  const suspendedPct = data.official.count > 0 ? (data.suspended.length / data.official.count) * 100 : 0;

  return (
    <section className="rounded-[20px] border border-white/[0.04] bg-card-bg p-5 md:p-6">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
        <div className="flex items-start gap-3 min-w-0">
          <span className="w-10 h-10 rounded-[12px] bg-accent/15 flex items-center justify-center shrink-0"><Building2 className="h-[18px] w-[18px] text-accent" /></span>
          <div className="min-w-0">
            <h2 className="title-display text-lg text-white">{isId ? 'Cakupan emiten BEI' : 'IDX listing coverage'}</h2>
            <p className="text-sm text-slate-300 mt-0.5">
              <AnimatedNumber value={data.tracked} format={num} fromZero className="font-display text-xl font-medium text-white" />{' '}
              {isId ? 'emiten terpantau di web ini dari' : 'stocks tracked here out of'}{' '}
              <strong className="text-white">{num(data.official.count)}</strong> {isId ? 'tercatat di BEI' : 'listed on IDX'}
            </p>
          </div>
        </div>
        <span className="text-2xl font-black text-emerald-400 tabular-nums shrink-0">{formatNumberLocale(data.coveragePct, language, 1)}%</span>
      </div>

      <div className="flex h-2 rounded-full overflow-hidden bg-white/5 mt-3" role="img" aria-label={`${data.active} / ${data.suspended.length} / ${data.official.count}`}>
        <GrowBar pct={activePct} className="bg-emerald-500" />
        <GrowBar pct={suspendedPct} className="bg-amber-400" />
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2 text-[11px] font-semibold text-slate-400">
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-emerald-500" />{num(data.active)} {isId ? 'aktif diperdagangkan' : 'actively traded'}</span>
        <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-amber-400" />{num(data.suspended.length)} {isId ? 'suspensi / tidak bertransaksi' : 'suspended / not trading'}</span>
        {gap > 0 && <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-full bg-white/15" />{num(gap)} {isId ? 'belum terdeteksi otomatis' : 'not auto-detected'}</span>}
      </div>
      <p className="text-[11px] text-slate-500 mt-1.5">
        {isId
          ? `Jumlah resmi per ${asOf} (${data.official.source}). Data resmi BEI tidak bisa diambil otomatis; diperbarui admin.`
          : `Official count as of ${asOf} (${data.official.source}). IDX's official list can't be fetched automatically; updated by admin.`}
      </p>
    </section>
  );
}
