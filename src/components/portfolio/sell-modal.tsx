'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, X } from 'lucide-react';
import { StepperInput } from '@/components/stepper-input';
import { CompanyLogo } from '@/components/company-logo';
import { useLanguage } from '@/lib/language-context';
import { parseFormattedNumber } from '@/lib/format';
import { stepIdxPrice } from '@/lib/calculator';
import type { Holding } from '@/lib/portfolio-store';
import { DEFAULT_SELL_FEE_PCT, sellBreakdown } from '@/lib/portfolio-transactions';
import { Field, fmtInput, pct, pick, rp2 as rp, sanitizeInteger, sanitizeNumber, type Lang } from '@/components/shared/calc-ui';

export interface SellSubmit {
  holding: Holding;
  lot: number;
  price: number;
  feePct: number;
  addToCash: boolean;
}

interface SellModalProps {
  language: Lang;
  holding: Holding | null;
  /** Harga pasar terakhir (default harga jual). */
  marketPrice: number | null;
  /** Kas RDN; null = belum diatur (pilihan tambah ke kas disembunyikan). */
  cash: number | null;
  onClose: () => void;
  onSubmit: (payload: SellSubmit) => Promise<void>;
}

/** Catat penjualan: posisi berkurang, realized P/L tercatat, hasil bersih bisa ditambahkan ke kas RDN. */
export function SellModal(props: SellModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>{props.holding && <SellForm key={props.holding.id} {...props} holding={props.holding} />}</AnimatePresence>,
    document.body
  );
}

function SellForm({ language, holding, marketPrice, cash, onClose, onSubmit }: SellModalProps & { holding: Holding }) {
  const { t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const fieldId = React.useId();
  const [lotStr, setLotStr] = React.useState(String(holding.lot));
  const [priceStr, setPriceStr] = React.useState(marketPrice ? fmtInput(marketPrice, language, 0) : '');
  const [feeStr, setFeeStr] = React.useState(fmtInput(DEFAULT_SELL_FEE_PCT, language));
  const [addToCash, setAddToCash] = React.useState(cash !== null);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const lot = parseInt(lotStr, 10) || 0;
  const price = parseFormattedNumber(priceStr);
  const feePct = parseFormattedNumber(feeStr);
  const valid = lot >= 1 && lot <= holding.lot && price > 0 && feePct >= 0 && feePct <= 10;
  const b = sellBreakdown(lot, price, holding.avg_price, feePct);
  const remaining = holding.lot - lot;
  const tone = b.realized > 0 ? 'text-emerald-400' : b.realized < 0 ? 'text-rose-400' : 'text-slate-200';
  const signed = (v: number) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${rp(Math.abs(v), language)}`;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!valid || saving) return;
    setSaving(true);
    setError(null);
    try {
      await onSubmit({ holding, lot, price, feePct, addToCash: addToCash && cash !== null });
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-title`}>
      <motion.div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative w-full max-w-md max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-3xl border border-white/10 bg-card-bg shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <CompanyLogo symbol={holding.ticker} size={40} />
            <div className="min-w-0">
              <h2 id={`${fieldId}-title`} className="text-base font-black text-white">{L(`Jual ${holding.ticker}`, `Sell ${holding.ticker}`)}</h2>
              <p className="text-[11px] text-slate-400">{L(`Dimiliki ${holding.lot} lot @ ${rp(holding.avg_price, language)}`, `Holding ${holding.lot} lots @ ${rp(holding.avg_price, language)}`)}</p>
            </div>
          </div>
          <button type="button" onClick={onClose} aria-label={L('Tutup', 'Close')} className="p-1.5 -m-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label={L('Lot dijual', 'Lots sold')} htmlFor={`${fieldId}-lot`} hint={lot > holding.lot ? <span className="text-amber-400">{L(`Maks ${holding.lot} lot`, `Max ${holding.lot} lots`)}</span> : undefined}>
            <StepperInput
              id={`${fieldId}-lot`}
              type="text"
              inputMode="numeric"
              value={lotStr}
              onChange={(e) => setLotStr(sanitizeInteger(e.target.value))}
              onStep={(dir) => setLotStr(String(Math.min(holding.lot, Math.max(1, lot + dir))))}
              canDecrement={lot > 1}
              canIncrement={lot < holding.lot}
              invalid={lot > holding.lot}
              decrementLabel={`${t('calculator.decrease')} lot`}
              incrementLabel={`${t('calculator.increase')} lot`}
              inputClassName="font-bold text-white"
            />
          </Field>
          <Field label={L('Harga jual', 'Sell price')} htmlFor={`${fieldId}-price`} hint={marketPrice ? L(`Pasar ${rp(marketPrice, language)}`, `Market ${rp(marketPrice, language)}`) : undefined}>
            <StepperInput
              id={`${fieldId}-price`}
              type="text"
              inputMode="decimal"
              value={priceStr}
              placeholder="0"
              onChange={(e) => setPriceStr(sanitizeNumber(e.target.value))}
              onStep={(dir) => setPriceStr(fmtInput(stepIdxPrice(price, dir), language, 0))}
              canDecrement={price > 1}
              decrementLabel={`${t('calculator.decrease')} ${L('harga', 'price')}`}
              incrementLabel={`${t('calculator.increase')} ${L('harga', 'price')}`}
              inputClassName="font-bold text-white"
            />
          </Field>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-[11px] font-bold uppercase tracking-wider text-slate-500 mr-1">{L('Cepat', 'Quick')}</span>
          {[25, 50, 100].map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setLotStr(String(Math.max(1, Math.floor((holding.lot * p) / 100))))}
              className="px-2.5 py-1 rounded-lg border border-white/10 bg-white/[0.03] hover:bg-white/10 text-[11px] font-bold text-slate-200 cursor-pointer"
            >
              {p === 100 ? L('Semua', 'All') : `${p}%`}
            </button>
          ))}
        </div>

        <Field label={L('Fee jual broker', 'Broker sell fee')} htmlFor={`${fieldId}-fee`} hint={L('Default 0,25% (termasuk PPh final 0,1%).', 'Default 0.25% (includes the 0.1% final tax).')}>
          <StepperInput
            id={`${fieldId}-fee`}
            type="text"
            inputMode="decimal"
            value={feeStr}
            onChange={(e) => setFeeStr(sanitizeNumber(e.target.value))}
            onStep={(dir) => setFeeStr(fmtInput(Math.min(10, Math.max(0, Math.round((feePct + dir * 0.01) * 100) / 100)), language))}
            canDecrement={feePct > 0}
            decrementLabel={`${t('calculator.decrease')} fee`}
            incrementLabel={`${t('calculator.increase')} fee`}
            inputClassName="font-bold text-white"
            adornment={<span className="flex items-center pr-1 text-xs text-slate-500">%</span>}
          />
        </Field>

        {valid && (
          <dl className="rounded-2xl border border-white/10 bg-white/[0.02] p-3.5 grid grid-cols-2 gap-y-1.5 text-[12px]">
            <dt className="text-slate-400">{L('Nilai jual', 'Gross')}</dt>
            <dd className="text-right font-mono text-slate-200">{rp(b.gross, language)}</dd>
            <dt className="text-slate-400">{L(`Fee jual (${pct(feePct, language)})`, `Sell fee (${pct(feePct, language)})`)}</dt>
            <dd className="text-right font-mono text-rose-300">−{rp(b.fee, language)}</dd>
            <dt className="text-slate-400">{L('Hasil bersih', 'Net proceeds')}</dt>
            <dd className="text-right font-mono font-bold text-white">{rp(b.net, language)}</dd>
            <dt className="text-slate-400">{L('Modal (harga rata-rata)', 'Cost (average price)')}</dt>
            <dd className="text-right font-mono text-slate-200">{rp(b.cost, language)}</dd>
            <dt className="text-slate-300 font-bold pt-1.5 border-t border-white/10">{L('Realized P/L', 'Realized P/L')}</dt>
            <dd className={`text-right font-mono font-black pt-1.5 border-t border-white/10 ${tone}`}>
              {signed(b.realized)}
              {b.realizedPct !== null && <span className="block text-[11px] font-bold">{`${b.realizedPct > 0 ? '+' : ''}${pct(b.realizedPct, language)}`}</span>}
            </dd>
          </dl>
        )}

        <p className="text-[11px] text-slate-400">
          {remaining > 0
            ? L(`Sisa posisi: ${remaining} lot @ ${rp(holding.avg_price, language)} (harga rata-rata tidak berubah).`, `Remaining: ${remaining} lots @ ${rp(holding.avg_price, language)} (average price unchanged).`)
            : L('Semua lot dijual: saham ini keluar dari daftar kepemilikan.', 'All lots sold: this stock leaves your holdings.')}
        </p>

        {cash !== null && (
          <label className="flex items-start gap-2.5 text-[12px] text-slate-200 cursor-pointer">
            <input type="checkbox" checked={addToCash} onChange={(e) => setAddToCash(e.target.checked)} className="mt-0.5 h-4 w-4 accent-emerald-500" />
            <span>
              {L('Tambahkan hasil bersih ke kas RDN', 'Add net proceeds to RDN cash')}
              <span className="block text-[11px] text-slate-400">{L(`Kas: ${rp(cash, language)} → ${rp(cash + (valid ? b.net : 0), language)}`, `Cash: ${rp(cash, language)} → ${rp(cash + (valid ? b.net : 0), language)}`)}</span>
            </span>
          </label>
        )}

        {error && <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl p-2.5">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold cursor-pointer">
            {L('Batal', 'Cancel')}
          </button>
          <button type="submit" disabled={!valid || saving} className="flex-1 py-2.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {L(`Jual ${lot > 0 ? `${lot} lot` : ''}`, `Sell ${lot > 0 ? `${lot} lots` : ''}`)}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
