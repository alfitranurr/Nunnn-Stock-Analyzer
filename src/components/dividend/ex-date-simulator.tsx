'use client';

import * as React from 'react';
import { AlertTriangle, CheckCircle2, RotateCcw, Scale } from 'lucide-react';
import { StepperInput } from '@/components/stepper-input';
import { useLanguage } from '@/lib/language-context';
import { parseFormattedNumber } from '@/lib/format';
import { stepIdxPrice } from '@/lib/calculator';
import { DEFAULT_SELL_FEE_PCT, simulateExDate, type ScheduledPayment } from '@/lib/dividend';
import { Card, CardTitle, Field, clamp, fmtInput, formatDate, pct, pick, rp, rpShare, sanitizeInteger, sanitizeNumber, stepDecimal, type Lang } from '@/components/shared/calc-ui';

interface ExDateSimulatorProps {
  language: Lang;
  ticker: string;
  defaultPrice: number;
  defaultLots: number;
  nextPayment: ScheduledPayment | null;
  fallbackDps: number;
  taxRatePct: number;
  buyFeePct: number;
}

/**
 * "Beli saat cum date, jual saat ex date": apakah dividen menutup turunnya harga + fee + pajak?
 * Nilai input mengikuti simulasi utama sampai pengguna mengubahnya sendiri.
 */
export function ExDateSimulator({ language, ticker, defaultPrice, defaultLots, nextPayment, fallbackDps, taxRatePct, buyFeePct }: ExDateSimulatorProps) {
  const { t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const fieldId = React.useId();

  const [cumPriceStr, setCumPriceStr] = React.useState<string | null>(null);
  const [lotsStr, setLotsStr] = React.useState<string | null>(null);
  const [dpsStr, setDpsStr] = React.useState<string | null>(null);
  const [exPriceStr, setExPriceStr] = React.useState<string | null>(null);
  const [sellFeeStr, setSellFeeStr] = React.useState(() => fmtInput(DEFAULT_SELL_FEE_PCT, language));

  const [inputLanguage, setInputLanguage] = React.useState(language);
  if (inputLanguage !== language) {
    setInputLanguage(language);
    setSellFeeStr(fmtInput(parseFormattedNumber(sellFeeStr), language));
  }

  const defaultDps =Math.round((nextPayment?.dps ?? fallbackDps) * 100) / 100;
  const cumPrice = cumPriceStr !== null ? parseFormattedNumber(cumPriceStr) : defaultPrice;
  const lots = lotsStr !== null ? parseInt(lotsStr, 10) || 0 : Math.max(1, defaultLots);
  const dps = dpsStr !== null ? parseFormattedNumber(dpsStr) : defaultDps;
  const sellFee = clamp(parseFormattedNumber(sellFeeStr), 0, 5);

  const theoretical = simulateExDate({ cumPrice, lots, dps, taxRatePct, buyFeePct, sellFeePct: sellFee });
  const exPrice = exPriceStr !== null ? parseFormattedNumber(exPriceStr) : theoretical.theoreticalExPrice;
  const sim = exPriceStr !== null ? simulateExDate({ cumPrice, lots, dps, taxRatePct, buyFeePct, sellFeePct: sellFee, exPrice }) : theoretical;

  const overridden = cumPriceStr !== null || lotsStr !== null || dpsStr !== null || exPriceStr !== null;
  const resetAll = () => {
    setCumPriceStr(null);
    setLotsStr(null);
    setDpsStr(null);
    setExPriceStr(null);
  };

  const show = (override: string | null, value: number, digits = 0) => override ?? (value > 0 ? fmtInput(value, language, digits) : '');
  const ready = cumPrice > 0 && lots > 0 && dps > 0;
  const profit = sim.pnlRp >= 0;
  const bepVsEx = sim.exPrice > 0 ? ((sim.breakEvenPrice - sim.exPrice) / sim.exPrice) * 100 : 0;
  const priceFieldProps = (label: string) => ({
    type: 'text' as const,
    inputMode: 'numeric' as const,
    decrementLabel: `${t('calculator.decrease')} ${label}`,
    incrementLabel: `${t('calculator.increase')} ${label}`,
    inputClassName: 'font-bold text-white',
  });

  return (
    <Card>
      <CardTitle
        icon={<Scale className="h-5 w-5 text-amber-400" />}
        title={L('Simulasi Cum → Ex Date (Dividend Trap)', 'Cum → Ex Date Simulation (Dividend Trap)')}
        subtitle={L(
          'Beli di cum date hanya untuk mengejar dividen? Pada ex date harga umumnya turun kira-kira sebesar dividen. Hitung apakah dividen bersih menutup turunnya harga, fee beli/jual, dan pajak.',
          'Buying on the cum date just for the dividend? On the ex date the price usually drops by roughly the dividend. Check whether the net dividend covers the drop, buy/sell fees and tax.'
        )}
        right={overridden ? (
          <button type="button" onClick={resetAll} className="self-start flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-bold text-slate-400 hover:text-white hover:bg-white/5 cursor-pointer">
            <RotateCcw className="h-3.5 w-3.5" /> {L('Ikuti simulasi utama', 'Sync with main simulation')}
          </button>
        ) : undefined}
      />

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-5">
        <div className="lg:col-span-2 grid grid-cols-2 gap-3 content-start">
          <Field label={L('Harga beli (cum)', 'Buy price (cum)')} htmlFor={`${fieldId}-cum`}>
            <StepperInput
              id={`${fieldId}-cum`}
              {...priceFieldProps(L('harga cum', 'cum price'))}
              value={show(cumPriceStr, cumPrice)}
              onChange={(e) => setCumPriceStr(sanitizeNumber(e.target.value))}
              onStep={(dir) => setCumPriceStr(fmtInput(stepIdxPrice(cumPrice, dir), language, 0))}
              canDecrement={cumPrice > 1}
            />
          </Field>
          <Field label={L('Jumlah lot', 'Lots')} htmlFor={`${fieldId}-lots`}>
            <StepperInput
              id={`${fieldId}-lots`}
              {...priceFieldProps('lot')}
              value={show(lotsStr, lots)}
              onChange={(e) => setLotsStr(sanitizeInteger(e.target.value))}
              onStep={(dir) => setLotsStr(String(Math.max(1, lots + dir)))}
              canDecrement={lots > 1}
            />
          </Field>
          <Field
            label={L('Dividen / lembar', 'Dividend / share')}
            htmlFor={`${fieldId}-dps`}
            hint={nextPayment && dpsStr === null ? L(`pembagian berikutnya ${nextPayment.confirmed ? '' : '(perkiraan)'}`, `next payout ${nextPayment.confirmed ? '' : '(estimate)'}`) : undefined}
          >
            <StepperInput
              id={`${fieldId}-dps`}
              {...priceFieldProps(L('dividen', 'dividend'))}
              inputMode="decimal"
              value={show(dpsStr, dps, 2)}
              onChange={(e) => setDpsStr(sanitizeNumber(e.target.value))}
              onStep={(dir) => setDpsStr(stepDecimal(fmtInput(dps, language), dir, dps >= 100 ? 5 : 1, 0, 1_000_000, language))}
              canDecrement={dps > 0}
            />
          </Field>
          <Field label={L('Fee jual', 'Sell fee')} htmlFor={`${fieldId}-fee`}>
            <StepperInput
              id={`${fieldId}-fee`}
              {...priceFieldProps(L('fee jual', 'sell fee'))}
              inputMode="decimal"
              value={sellFeeStr}
              onChange={(e) => setSellFeeStr(sanitizeNumber(e.target.value))}
              onStep={(dir) => setSellFeeStr((prev) => stepDecimal(prev, dir, 0.01, 0, 5, language))}
              canDecrement={sellFee > 0}
              adornment={<span className="flex items-center pr-1 text-xs text-slate-500">%</span>}
            />
          </Field>
          <div className="col-span-2">
            <Field
              label={
                <>
                  <span>{L('Harga jual di ex date', 'Sell price on ex date')}</span>
                  {exPriceStr !== null && (
                    <button type="button" onClick={() => setExPriceStr(null)} className="normal-case tracking-normal text-emerald-400 hover:underline cursor-pointer">
                      {L('pakai harga teoritis', 'use theoretical')}
                    </button>
                  )}
                </>
              }
              htmlFor={`${fieldId}-ex`}
              hint={L(
                `Teoritis: ${rp(cumPrice, language)} − ${rpShare(dps, language)} ≈ ${rp(theoretical.theoreticalExPrice, language)} (dibulatkan ke fraksi BEI)`,
                `Theoretical: ${rp(cumPrice, language)} − ${rpShare(dps, language)} ≈ ${rp(theoretical.theoreticalExPrice, language)} (rounded to IDX tick)`
              )}
            >
              <StepperInput
                id={`${fieldId}-ex`}
                {...priceFieldProps(L('harga ex', 'ex price'))}
                value={show(exPriceStr, exPrice)}
                onChange={(e) => setExPriceStr(sanitizeNumber(e.target.value))}
                onStep={(dir) => setExPriceStr(fmtInput(stepIdxPrice(exPrice, dir), language, 0))}
                canDecrement={exPrice > 1}
              />
            </Field>
          </div>
        </div>

        <div className="lg:col-span-3">
          {!ready ? (
            <p className="h-full min-h-[160px] flex items-center justify-center text-center text-xs text-slate-500 rounded-2xl border border-dashed border-white/10 p-6">
              {L('Isi harga, lot, dan dividen per lembar.', 'Fill in price, lots and dividend per share.')}
            </p>
          ) : (
            <div className="rounded-2xl border border-white/10 bg-white/[0.02] p-4 space-y-2.5 text-xs">
              <Row label={L(`Beli ${lots} lot ${ticker} @ ${rp(cumPrice, language)} (+fee ${pct(buyFeePct, language)})`, `Buy ${lots} lots ${ticker} @ ${rp(cumPrice, language)} (+fee ${pct(buyFeePct, language)})`)} value={`−${rp(sim.buyCostRp, language)}`} />
              <Row
                label={L(
                  `Dividen bersih (pajak ${pct(taxRatePct, language, 0)})${nextPayment ? `, cair ≈ ${formatDate(nextPayment.payDate, language)}` : ''}`,
                  `Net dividend (tax ${pct(taxRatePct, language, 0)})${nextPayment ? `, paid ≈ ${formatDate(nextPayment.payDate, language)}` : ''}`
                )}
                value={`+${rp(sim.netDividendRp, language)}`}
                tone="emerald"
              />
              <Row label={L(`Jual di ex date @ ${rp(sim.exPrice, language)} (−fee ${pct(sellFee, language)})`, `Sell on ex date @ ${rp(sim.exPrice, language)} (−fee ${pct(sellFee, language)})`)} value={`+${rp(sim.sellProceedsRp, language)}`} />
              <div className="border-t border-white/10 pt-2.5 flex items-center justify-between gap-3">
                <span className="font-black text-white">{L('Hasil bersih', 'Net result')}</span>
                <span className={`font-black text-base tabular-nums ${profit ? 'text-emerald-400' : 'text-rose-400'}`}>
                  {profit ? '+' : '−'}{rp(Math.abs(sim.pnlRp), language)} ({profit ? '+' : ''}{pct(sim.pnlPct, language)})
                </span>
              </div>

              <div className={`mt-3 p-3 rounded-xl border flex gap-2.5 ${profit ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-rose-500/5 border-rose-500/20'}`}>
                {profit ? <CheckCircle2 className="h-4 w-4 text-emerald-400 shrink-0 mt-0.5" /> : <AlertTriangle className="h-4 w-4 text-rose-400 shrink-0 mt-0.5" />}
                <p className="text-[11px] text-slate-300 leading-relaxed">
                  {L(
                    `Agar impas, harga jual di ex date minimal ${rp(sim.breakEvenPrice, language)} (${bepVsEx >= 0 ? '+' : ''}${pct(bepVsEx, language)} dari ${rp(sim.exPrice, language)}). `,
                    `To break even, the ex-date sell price must be at least ${rp(sim.breakEvenPrice, language)} (${bepVsEx >= 0 ? '+' : ''}${pct(bepVsEx, language)} from ${rp(sim.exPrice, language)}). `
                  )}
                  {profit
                    ? L('Dengan harga ini dividen menutup penurunan harga dan biaya.', 'At this price the dividend covers the drop and costs.')
                    : L(
                        'Dividen tidak menutup turunnya harga + fee + pajak: ini yang disebut dividend trap. Membeli demi dividen lebih masuk akal untuk investasi jangka panjang.',
                        'The dividend does not cover the price drop + fees + tax: the classic dividend trap. Buying for dividends makes more sense as a long-term holding.'
                      )}
                </p>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                {L(
                  'BEI tidak menyesuaikan harga secara otomatis saat ex date; penurunan sebesar dividen adalah perilaku pasar yang umum, bukan aturan. Dividen baru masuk RDN beberapa minggu setelah ex date.',
                  'IDX does not adjust prices automatically on the ex date; a drop of about the dividend is common market behaviour, not a rule. The dividend reaches your RDN a few weeks after the ex date.'
                )}
              </p>
            </div>
          )}
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: 'emerald' }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <span className="text-slate-400 leading-snug">{label}</span>
      <span className={`font-bold tabular-nums whitespace-nowrap ${tone === 'emerald' ? 'text-emerald-400' : 'text-white'}`}>{value}</span>
    </div>
  );
}
