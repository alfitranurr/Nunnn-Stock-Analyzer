'use client';

import * as React from 'react';
import { ChevronDown, Repeat } from 'lucide-react';
import { StepperInput } from '@/components/stepper-input';
import { useLanguage } from '@/lib/language-context';
import { formatIDRCompact, parseFormattedNumber } from '@/lib/format';
import { daysBetween, projectDrip, type ScheduledPayment } from '@/lib/dividend';
import { Card, CardTitle, Field, Stat, clamp, fmtInput, pct, pick, rp, sanitizeInteger, stepDecimal, type Lang } from '@/components/shared/calc-ui';

interface DripProjectionProps {
  language: Lang;
  shares: number;
  buyPrice: number;
  initialCostRp: number;
  annualDps: number;
  taxRatePct: number;
  buyFeePct: number;
  schedule: ScheduledPayment[];
  todayIso: string;
  historicalCagrPct: number | null;
}

const MAX_YEARS = 30;

/** Proyeksi dividen diinvestasikan ulang (DRIP) dibandingkan diambil tunai. */
export function DripProjection(props: DripProjectionProps) {
  const { language, shares, buyPrice, initialCostRp, annualDps, taxRatePct, buyFeePct, schedule, todayIso, historicalCagrPct } = props;
  const { t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const fieldId = React.useId();

  const [yearsStr, setYearsStr] = React.useState('10');
  const [dpsGrowthStr, setDpsGrowthStr] = React.useState('0');
  const [priceGrowthStr, setPriceGrowthStr] = React.useState('0');
  const [showTable, setShowTable] = React.useState(false);

  const years = clamp(parseInt(yearsStr, 10) || 1, 1, MAX_YEARS);
  const dpsGrowth = clamp(parseFormattedNumber(dpsGrowthStr), -50, 50);
  const priceGrowth = clamp(parseFormattedNumber(priceGrowthStr), -50, 50);

  const payments = React.useMemo(() => {
    const total = schedule.reduce((s, p) => s + p.dps, 0);
    if (total <= 0) return [];
    return schedule.map((p) => ({ at: clamp(daysBetween(todayIso, p.payDate) / 365, 0.01, 1), share: p.dps / total }));
  }, [schedule, todayIso]);

  const result = React.useMemo(
    () =>
      projectDrip({
        shares,
        buyPrice,
        initialCostRp,
        annualDps,
        taxRatePct,
        buyFeePct,
        years,
        dpsGrowthPct: dpsGrowth,
        priceGrowthPct: priceGrowth,
        payments,
      }),
    [shares, buyPrice, initialCostRp, annualDps, taxRatePct, buyFeePct, years, dpsGrowth, priceGrowth, payments]
  );

  const disabled = shares <= 0 || annualDps <= 0 || buyPrice <= 0;
  const last = result.rows[result.rows.length - 1];

  // Grafik nilai total (tahun 0 = modal awal).
  const series = [
    { drip: initialCostRp, plain: initialCostRp },
    ...result.rows.map((r) => ({ drip: r.drip.valueRp, plain: r.plain.valueRp })),
  ];
  const maxV = Math.max(...series.map((s) => Math.max(s.drip, s.plain)), 1);
  const minV = Math.min(...series.map((s) => Math.min(s.drip, s.plain)), maxV);
  const lo = minV * 0.95;
  const W = 600;
  const H = 200;
  const x = (i: number) => (series.length > 1 ? (i / (series.length - 1)) * W : 0);
  const y = (v: number) => H - ((v - lo) / (maxV - lo || 1)) * (H - 10) - 5;
  const path = (key: 'drip' | 'plain') => series.map((s, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(s[key]).toFixed(1)}`).join(' ');

  return (
    <Card>
      <CardTitle
        icon={<Repeat className="h-5 w-5 text-emerald-400" />}
        title={L('Proyeksi DRIP vs Diambil Tunai', 'DRIP vs Cash Projection')}
        subtitle={L(
          'DRIP = dividen bersih langsung dibelikan saham lagi (per lot, termasuk fee beli; sisa dana dibawa ke pembayaran berikutnya). Bandingkan dengan dividen yang diambil tunai.',
          'DRIP = net dividends are used to buy more shares (whole lots, incl. buy fee; leftovers carry to the next payout). Compare with taking dividends as cash.'
        )}
      />

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Field label={L('Jangka waktu', 'Horizon')} htmlFor={`${fieldId}-years`}>
          <StepperInput
            id={`${fieldId}-years`}
            type="text"
            inputMode="numeric"
            value={yearsStr}
            onChange={(e) => setYearsStr(sanitizeInteger(e.target.value))}
            onBlur={() => setYearsStr(String(years))}
            onStep={(dir) => setYearsStr((prev) => String(clamp((parseInt(prev, 10) || 0) + dir, 1, MAX_YEARS)))}
            canDecrement={years > 1}
            canIncrement={years < MAX_YEARS}
            decrementLabel={`${t('calculator.decrease')} ${L('tahun', 'years')}`}
            incrementLabel={`${t('calculator.increase')} ${L('tahun', 'years')}`}
            inputClassName="font-bold text-white"
            adornment={<span className="flex items-center pr-1 text-[10px] font-semibold text-slate-500">{L('tahun', 'years')}</span>}
          />
        </Field>
        <Field
          label={L('Pertumbuhan dividen / thn', 'Dividend growth / yr')}
          htmlFor={`${fieldId}-dg`}
          hint={historicalCagrPct !== null && (
            <button
              type="button"
              onClick={() => setDpsGrowthStr(fmtInput(clamp(Math.round(historicalCagrPct * 10) / 10, -50, 50), language, 1))}
              className="text-emerald-400 hover:underline cursor-pointer"
            >
              {L(`Pakai CAGR historis (${pct(historicalCagrPct, language, 1)})`, `Use historical CAGR (${pct(historicalCagrPct, language, 1)})`)}
            </button>
          )}
        >
          <StepperInput
            id={`${fieldId}-dg`}
            type="text"
            inputMode="decimal"
            value={dpsGrowthStr}
            onChange={(e) => setDpsGrowthStr(e.target.value.replace(/[^0-9.,-]/g, ''))}
            onStep={(dir) => setDpsGrowthStr((prev) => stepDecimal(prev, dir, 1, -50, 50, language))}
            decrementLabel={`${t('calculator.decrease')} ${L('pertumbuhan dividen', 'dividend growth')}`}
            incrementLabel={`${t('calculator.increase')} ${L('pertumbuhan dividen', 'dividend growth')}`}
            inputClassName="font-bold text-white"
            adornment={<span className="flex items-center pr-1 text-xs text-slate-500">%</span>}
          />
        </Field>
        <Field label={L('Pertumbuhan harga / thn', 'Price growth / yr')} htmlFor={`${fieldId}-pg`} hint={L('0% = harga tetap (konservatif)', '0% = flat price (conservative)')}>
          <StepperInput
            id={`${fieldId}-pg`}
            type="text"
            inputMode="decimal"
            value={priceGrowthStr}
            onChange={(e) => setPriceGrowthStr(e.target.value.replace(/[^0-9.,-]/g, ''))}
            onStep={(dir) => setPriceGrowthStr((prev) => stepDecimal(prev, dir, 1, -50, 50, language))}
            decrementLabel={`${t('calculator.decrease')} ${L('pertumbuhan harga', 'price growth')}`}
            incrementLabel={`${t('calculator.increase')} ${L('pertumbuhan harga', 'price growth')}`}
            inputClassName="font-bold text-white"
            adornment={<span className="flex items-center pr-1 text-xs text-slate-500">%</span>}
          />
        </Field>
      </div>

      {disabled ? (
        <p className="mt-5 py-6 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-white/10">
          {L('Isi modal/lot, harga beli, dan dividen per lembar untuk melihat proyeksi.', 'Fill in capital/lots, buy price and dividend per share to see the projection.')}
        </p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mt-5">
            <Stat
              tone="emerald"
              label={L(`Nilai akhir DRIP (thn ${years})`, `DRIP value (yr ${years})`)}
              value={formatIDRCompact(result.dripFinalRp, language, 2)}
              sub={`${result.dripReturnPct >= 0 ? '+' : ''}${pct(result.dripReturnPct, language, 1)} ${L('dari modal', 'vs capital')}`}
            />
            <Stat
              label={L(`Tanpa DRIP (thn ${years})`, `Cash (yr ${years})`)}
              value={formatIDRCompact(result.plainFinalRp, language, 2)}
              sub={`${result.plainReturnPct >= 0 ? '+' : ''}${pct(result.plainReturnPct, language, 1)} · ${L('saham + dividen tunai', 'shares + cash dividends')}`}
            />
            <Stat
              tone="sky"
              label={L('Keunggulan DRIP', 'DRIP advantage')}
              value={`+${formatIDRCompact(result.dripFinalRp - result.plainFinalRp, language, 2)}`}
              sub={L(`+${result.addedLots} lot dari reinvestasi`, `+${result.addedLots} lots from reinvesting`)}
            />
            <Stat
              tone="amber"
              label={L(`Passive income / bln (thn ${years})`, `Income / month (yr ${years})`)}
              value={formatIDRCompact(last.drip.netDividendRp / 12, language, 2)}
              sub={L(`tanpa DRIP: ${formatIDRCompact(last.plain.netDividendRp / 12, language, 2)}`, `cash: ${formatIDRCompact(last.plain.netDividendRp / 12, language, 2)}`)}
            />
          </div>

          <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.02] p-3 sm:p-4">
            <div className="flex flex-wrap items-center justify-between gap-2 mb-2 text-[10px] font-bold">
              <span className="text-slate-500">{L('Nilai total portofolio', 'Total portfolio value')} · {L('maks', 'max')} {formatIDRCompact(maxV, language, 1)}</span>
              <span className="flex items-center gap-3">
                <span className="flex items-center gap-1 text-emerald-400"><span className="h-0.5 w-4 bg-emerald-400 rounded" />DRIP</span>
                <span className="flex items-center gap-1 text-slate-400"><span className="w-4 border-t-2 border-dashed border-slate-400" />{L('Tunai', 'Cash')}</span>
              </span>
            </div>
            <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="w-full h-44" role="img" aria-label={L('Grafik DRIP vs tunai', 'DRIP vs cash chart')}>
              <defs>
                <linearGradient id={`${fieldId}-fill`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor="rgb(16 185 129)" stopOpacity="0.25" />
                  <stop offset="100%" stopColor="rgb(16 185 129)" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path d={`${path('drip')} L${W},${H} L0,${H} Z`} fill={`url(#${fieldId}-fill)`} />
              <path d={path('plain')} fill="none" stroke="rgb(148 163 184)" strokeWidth="2" strokeDasharray="6 5" vectorEffect="non-scaling-stroke" />
              <path d={path('drip')} fill="none" stroke="rgb(52 211 153)" strokeWidth="2.5" vectorEffect="non-scaling-stroke" />
            </svg>
            <div className="flex justify-between text-[10px] text-slate-500 mt-1">
              <span>{L('Sekarang', 'Now')}</span>
              <span>{L(`Tahun ${Math.ceil(years / 2)}`, `Year ${Math.ceil(years / 2)}`)}</span>
              <span>{L(`Tahun ${years}`, `Year ${years}`)}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowTable((v) => !v)}
            aria-expanded={showTable}
            className="mt-3 w-full py-2 rounded-xl text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/5 flex items-center justify-center gap-1 cursor-pointer"
          >
            <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showTable ? 'rotate-180' : ''}`} />
            {showTable ? L('Sembunyikan rincian per tahun', 'Hide yearly details') : L('Lihat rincian per tahun', 'Show yearly details')}
          </button>

          {showTable && (
            <div className="overflow-x-auto custom-scrollbar mt-2">
              <table className="w-full min-w-[720px] text-left border-collapse text-xs">
                <thead>
                  <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                    <th className="py-2.5 px-3">{L('Thn', 'Yr')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Harga', 'Price')}</th>
                    <th className="py-2.5 px-3 text-right">DPS</th>
                    <th className="py-2.5 px-3 text-right text-emerald-400">DRIP · {L('Lot', 'Lots')}</th>
                    <th className="py-2.5 px-3 text-right text-emerald-400">DRIP · {L('Dividen bersih', 'Net dividend')}</th>
                    <th className="py-2.5 px-3 text-right text-emerald-400">DRIP · {L('Nilai', 'Value')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Tunai · Dividen bersih', 'Cash · Net dividend')}</th>
                    <th className="py-2.5 px-3 text-right">{L('Tunai · Nilai', 'Cash · Value')}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5 text-slate-300">
                  {result.rows.map((r) => (
                    <tr key={r.year} className="hover:bg-white/[0.03]">
                      <td className="py-2 px-3 font-bold text-white">{r.year}</td>
                      <td className="py-2 px-3 text-right font-mono">{rp(r.price, language)}</td>
                      <td className="py-2 px-3 text-right font-mono">{rp(r.dps, language)}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-300">{r.drip.lots.toLocaleString(language === 'id' ? 'id-ID' : 'en-US')}</td>
                      <td className="py-2 px-3 text-right font-mono text-emerald-300">{rp(r.drip.netDividendRp, language)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold text-emerald-400">{rp(r.drip.valueRp, language)}</td>
                      <td className="py-2 px-3 text-right font-mono">{rp(r.plain.netDividendRp, language)}</td>
                      <td className="py-2 px-3 text-right font-mono font-bold">{rp(r.plain.valueRp, language)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <p className="text-[10px] text-slate-500 mt-3 leading-relaxed">
            {L(
              'Asumsi: harga & dividen tumbuh konstan sesuai input, jadwal pembayaran mengikuti pola 12 bulan terakhir, tanpa pajak atas capital gain. Proyeksi bukan jaminan hasil.',
              'Assumptions: price and dividend grow at the constant rates above, payouts follow the last 12-month pattern, no capital-gain tax. Projections are not guarantees.'
            )}
            {taxRatePct === 10 && L(
              ' Dividen yang diinvestasikan kembali di Indonesia ≥3 tahun bisa bebas pajak (0%) untuk investor individu dalam negeri.',
              ' Dividends reinvested in Indonesia for ≥3 years can be tax-exempt (0%) for domestic individual investors.'
            )}
          </p>
        </>
      )}
    </Card>
  );
}
