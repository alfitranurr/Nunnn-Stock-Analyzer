'use client';

import * as React from 'react';
import { RotateCcw, TrendingUp } from 'lucide-react';
import { StepperInput } from '@/components/stepper-input';
import { useLanguage } from '@/lib/language-context';
import { useNow } from '@/lib/use-polling';
import { parseFormattedNumber } from '@/lib/format';
import { getAutoRejectionBounds, roundToNearestIdxTick, roundUpToIdxTick, stepIdxPrice } from '@/lib/calculator';
import { DEFAULT_SELL_FEE_PCT } from '@/lib/dividend';
import { listingPnl, SHARES_PER_LOT } from '@/lib/e-ipo';
import { Card, CardTitle, Field, clamp, fmtInput, pct, pick, rp, sanitizeInteger, sanitizeNumber, stepDecimal, type Lang } from '@/components/shared/calc-ui';

interface ListingSimulatorProps {
  language: Lang;
  ipoPrice: number;
  allottedLots: number;
}

/** Untung/rugi jatah IPO di hari-hari pertama pencatatan untuk beberapa skenario harga. */
export function ListingSimulator({ language, ipoPrice, allottedLots }: ListingSimulatorProps) {
  const { t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const fieldId = React.useId();

  const [lotsStr, setLotsStr] = React.useState<string | null>(null);
  const [targetStr, setTargetStr] = React.useState<string | null>(null);
  const [buyFeeStr, setBuyFeeStr] = React.useState('0');
  const [sellFeeStr, setSellFeeStr] = React.useState(() => fmtInput(DEFAULT_SELL_FEE_PCT, language));

  const [inputLanguage, setInputLanguage] = React.useState(language);
  if (inputLanguage !== language) {
    setInputLanguage(language);
    setBuyFeeStr(fmtInput(parseFormattedNumber(buyFeeStr), language));
    setSellFeeStr(fmtInput(parseFormattedNumber(sellFeeStr), language));
  }

  // Batas ARB bergantung tanggal; null sebelum mount (aman untuk SSR).
  const now = useNow(60_000);
  const usingDefaultLots = lotsStr === null;
  const lots = lotsStr !== null ? parseInt(lotsStr, 10) || 0 : Math.max(1, allottedLots);
  const buyFee = clamp(parseFormattedNumber(buyFeeStr), 0, 5);
  const sellFee = clamp(parseFormattedNumber(sellFeeStr), 0, 5);

  const scenarios = React.useMemo(() => {
    if (ipoPrice <= 0 || now === null) return [];
    const rows: Array<{ id: string; label: string; price: number }> = [];
    const first = getAutoRejectionBounds(ipoPrice, now);
    rows.push({ id: 'arb', label: L(`ARB hari 1 (−${first.downPct}%)`, `Day-1 ARB (−${first.downPct}%)`), price: first.lower });
    rows.push({ id: 'down10', label: L('Turun 10%', 'Down 10%'), price: Math.max(first.lower, roundToNearestIdxTick(ipoPrice * 0.9)) });
    rows.push({ id: 'flat', label: L('Sama dengan harga IPO', 'Flat at IPO price'), price: ipoPrice });
    rows.push({ id: 'up10', label: L('Naik 10%', 'Up 10%'), price: Math.min(first.upper, roundToNearestIdxTick(ipoPrice * 1.1)) });
    let ref = ipoPrice;
    for (let day = 1; day <= 3; day++) {
      const b = getAutoRejectionBounds(ref, now);
      rows.push({ id: `ara${day}`, label: L(`ARA ${day} hari berturut-turut`, `${day} straight ARA day(s)`), price: b.upper });
      ref = b.upper;
    }
    return rows.map((r) => {
      const p = listingPnl(lots, ipoPrice, r.price, buyFee, sellFee);
      return { ...r, changePct: ((r.price - ipoPrice) / ipoPrice) * 100, ...p };
    });
    // L bergantung pada language
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ipoPrice, lots, buyFee, sellFee, language, now]);

  const target = targetStr !== null ? parseFormattedNumber(targetStr) : 0;
  const custom = target > 0 ? listingPnl(lots, ipoPrice, target, buyFee, sellFee) : null;
  const breakEven = ipoPrice > 0 ? roundUpToIdxTick((ipoPrice * (1 + buyFee / 100)) / (1 - sellFee / 100)) : 0;
  const limits = ipoPrice > 0 && now !== null ? getAutoRejectionBounds(ipoPrice, now) : null;
  const arbNote = limits && limits.downPct !== limits.upPct
    ? L(` ARB saat ini ${limits.downPct}% untuk saham di atas Rp10 (Kep-00003/BEI/04-2025) dan kembali simetris mulai 1 Jan 2027.`, ` ARB is currently ${limits.downPct}% for stocks above Rp10 (Kep-00003/BEI/04-2025) and becomes symmetric again from 1 Jan 2027.`)
    : L(' ARA dan ARB simetris sesuai rentang harga.', ' ARA and ARB are symmetric per price range.');

  return (
    <Card>
      <CardTitle
        icon={<TrendingUp className="h-5 w-5 text-emerald-400" />}
        title={L('4. Simulasi Hari Pertama Listing', '4. Listing-Day Simulation')}
        subtitle={L(
          `Untung/rugi bila jatah dijual di beberapa skenario harga. Batas ARA/ARB mengikuti aturan BEI yang berlaku saat ini (juga untuk hari pertama saham IPO), dibulatkan ke fraksi harga.`,
          `P/L if the allotment is sold under several price scenarios. ARA/ARB limits follow the current IDX rules (which also apply on an IPO's first day), rounded to the tick size.`
        )}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Field
          label={
            <>
              <span>{L('Lot dijual', 'Lots sold')}</span>
              {!usingDefaultLots && (
                <button type="button" onClick={() => setLotsStr(null)} className="normal-case tracking-normal text-emerald-400 hover:underline flex items-center gap-1 cursor-pointer">
                  <RotateCcw className="h-3 w-3" /> {L('ikut jatah', 'use allotment')}
                </button>
              )}
            </>
          }
          htmlFor={`${fieldId}-lots`}
          hint={usingDefaultLots && allottedLots === 0 ? L('Perkiraan jatah 0 lot; contoh memakai 1 lot.', 'Estimated allotment is 0; example uses 1 lot.') : undefined}
        >
          <StepperInput
            id={`${fieldId}-lots`}
            type="text"
            inputMode="numeric"
            value={lotsStr ?? String(lots)}
            onChange={(e) => setLotsStr(sanitizeInteger(e.target.value))}
            onStep={(dir) => setLotsStr(String(Math.max(1, lots + dir)))}
            canDecrement={lots > 1}
            decrementLabel={`${t('calculator.decrease')} lot`}
            incrementLabel={`${t('calculator.increase')} lot`}
            inputClassName="font-bold text-white"
          />
        </Field>
        <Field label={L('Harga jual sendiri', 'Your sell price')} htmlFor={`${fieldId}-target`} hint={L(`Impas di ${rp(breakEven, language)}`, `Break-even at ${rp(breakEven, language)}`)}>
          <StepperInput
            id={`${fieldId}-target`}
            type="text"
            inputMode="numeric"
            value={targetStr ?? ''}
            placeholder={fmtInput(ipoPrice, language, 0)}
            onChange={(e) => setTargetStr(sanitizeNumber(e.target.value))}
            onStep={(dir) => setTargetStr(fmtInput(stepIdxPrice(target > 0 ? target : ipoPrice, dir), language, 0))}
            decrementLabel={`${t('calculator.decrease')} ${L('harga', 'price')}`}
            incrementLabel={`${t('calculator.increase')} ${L('harga', 'price')}`}
            inputClassName="font-bold text-white"
          />
        </Field>
        <Field label={L('Fee beli IPO', 'IPO buy fee')} htmlFor={`${fieldId}-bf`} hint={L('Umumnya 0% via e-IPO; cek sekuritas', 'Usually 0% via e-IPO; check your broker')}>
          <StepperInput
            id={`${fieldId}-bf`}
            type="text"
            inputMode="decimal"
            value={buyFeeStr}
            onChange={(e) => setBuyFeeStr(sanitizeNumber(e.target.value))}
            onStep={(dir) => setBuyFeeStr((prev) => stepDecimal(prev, dir, 0.01, 0, 5, language))}
            canDecrement={buyFee > 0}
            decrementLabel={`${t('calculator.decrease')} fee`}
            incrementLabel={`${t('calculator.increase')} fee`}
            inputClassName="font-bold text-white"
            adornment={<span className="flex items-center pr-1 text-xs text-slate-500">%</span>}
          />
        </Field>
        <Field label={L('Fee jual', 'Sell fee')} htmlFor={`${fieldId}-sf`}>
          <StepperInput
            id={`${fieldId}-sf`}
            type="text"
            inputMode="decimal"
            value={sellFeeStr}
            onChange={(e) => setSellFeeStr(sanitizeNumber(e.target.value))}
            onStep={(dir) => setSellFeeStr((prev) => stepDecimal(prev, dir, 0.01, 0, 5, language))}
            canDecrement={sellFee > 0}
            decrementLabel={`${t('calculator.decrease')} fee`}
            incrementLabel={`${t('calculator.increase')} fee`}
            inputClassName="font-bold text-white"
            adornment={<span className="flex items-center pr-1 text-xs text-slate-500">%</span>}
          />
        </Field>
      </div>

      {ipoPrice <= 0 ? (
        <p className="mt-5 py-6 text-center text-xs text-slate-500 rounded-2xl border border-dashed border-white/10">{L('Isi harga penawaran terlebih dahulu.', 'Enter the offering price first.')}</p>
      ) : (
        <div className="mt-5 overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-white/10 text-slate-400 text-[10px] font-bold uppercase tracking-wider">
                <th className="py-2.5 px-3">{L('Skenario', 'Scenario')}</th>
                <th className="py-2.5 px-3 text-right">{L('Harga', 'Price')}</th>
                <th className="py-2.5 px-3 text-right hidden sm:table-cell">{L('Perubahan', 'Change')}</th>
                <th className="py-2.5 px-3 text-right">{L('Untung / rugi bersih', 'Net P/L')}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-slate-300">
              {[...scenarios, ...(custom ? [{ id: 'custom', label: L('Harga jual Anda', 'Your sell price'), price: target, changePct: ((target - ipoPrice) / ipoPrice) * 100, ...custom }] : [])].map((s) => (
                <tr key={s.id} className={s.id === 'custom' ? 'bg-sky-500/5' : ''}>
                  <td className="py-2.5 px-3 font-semibold text-white">{s.label}</td>
                  <td className="py-2.5 px-3 text-right font-mono whitespace-nowrap">
                    {rp(s.price, language)}
                    <span className={`sm:hidden block text-[10px] ${s.changePct > 0 ? 'text-emerald-400' : s.changePct < 0 ? 'text-rose-400' : 'text-slate-500'}`}>{s.changePct > 0 ? '+' : ''}{pct(s.changePct, language)}</span>
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono hidden sm:table-cell ${s.changePct > 0 ? 'text-emerald-400' : s.changePct < 0 ? 'text-rose-400' : ''}`}>
                    {s.changePct > 0 ? '+' : ''}{pct(s.changePct, language)}
                  </td>
                  <td className={`py-2.5 px-3 text-right font-mono font-bold ${s.pnlRp >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {s.pnlRp >= 0 ? '+' : '−'}{rp(Math.abs(s.pnlRp), language)}
                    <span className="block text-[10px] font-semibold opacity-80">{s.pnlRp >= 0 ? '+' : ''}{pct(s.pnlPct, language)}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="text-[10px] text-slate-500 mt-2 leading-relaxed">
            {L(
              `Modal ${lots} lot × ${SHARES_PER_LOT} lembar × ${rp(ipoPrice, language)} = ${rp(lots * SHARES_PER_LOT * ipoPrice, language)}.${arbNote} Saham di Papan Akselerasi dan saham dalam pemantauan khusus memakai batas berbeda.`,
              `Capital ${lots} lots × ${SHARES_PER_LOT} shares × ${rp(ipoPrice, language)} = ${rp(lots * SHARES_PER_LOT * ipoPrice, language)}.${arbNote} Acceleration Board and special-monitoring stocks use different limits.`
            )}
          </p>
        </div>
      )}
    </Card>
  );
}
