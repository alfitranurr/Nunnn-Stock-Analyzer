'use client';

import * as React from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Info, Loader2, X } from 'lucide-react';
import { StepperInput } from '@/components/stepper-input';
import { CompanyLogo } from '@/components/company-logo';
import { useLanguage } from '@/lib/language-context';
import { IDX_TICKERS } from '@/lib/tickers';
import { fetchQuotes } from '@/lib/quotes';
import { parseFormattedNumber } from '@/lib/format';
import { isValidIdxPrice, stepIdxPrice } from '@/lib/calculator';
import { mergeAveragePrice, type Holding } from '@/lib/portfolio-store';
import { Field, fmtInput, pick, rp, sanitizeInteger, sanitizeNumber, type Lang } from '@/components/shared/calc-ui';

export type HoldingModalMode = { kind: 'add' } | { kind: 'edit'; holding: Holding };

export interface HoldingSubmit {
  id?: string;
  ticker: string;
  company_name?: string;
  lot: number;
  avg_price: number;
}

interface HoldingModalProps {
  language: Lang;
  mode: HoldingModalMode | null;
  holdings: Holding[];
  onClose: () => void;
  onSubmit: (payload: HoldingSubmit) => Promise<void>;
}

/** Form tambah/ubah posisi. Menambah saham yang sudah dimiliki = beli lagi (digabung dengan rata-rata tertimbang). */
export function HoldingModal({ language, mode, holdings, onClose, onSubmit }: HoldingModalProps) {
  const [mounted, setMounted] = React.useState(false);
  React.useEffect(() => {
    const t = window.setTimeout(() => setMounted(true), 0);
    return () => window.clearTimeout(t);
  }, []);
  if (!mounted) return null;
  return createPortal(
    <AnimatePresence>
      {mode && <HoldingForm key={mode.kind === 'edit' ? mode.holding.id : 'add'} language={language} mode={mode} holdings={holdings} onClose={onClose} onSubmit={onSubmit} />}
    </AnimatePresence>,
    document.body
  );
}

function HoldingForm({ language, mode, holdings, onClose, onSubmit }: Omit<HoldingModalProps, 'mode'> & { mode: HoldingModalMode }) {
  const { t } = useLanguage();
  const L = (id: string, en: string) => pick(language, id, en);
  const fieldId = React.useId();
  const editing = mode.kind === 'edit' ? mode.holding : null;

  const [tickerStr, setTickerStr] = React.useState(editing?.ticker ?? '');
  const [lotStr, setLotStr] = React.useState(editing ? String(editing.lot) : '');
  const [priceStr, setPriceStr] = React.useState(editing ? fmtInput(editing.avg_price, language) : '');
  const [marketPrice, setMarketPrice] = React.useState<number | null>(null);
  const [fetchingPrice, setFetchingPrice] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  const ticker = tickerStr.trim().toUpperCase();
  const knownName = IDX_TICKERS[ticker];
  const lot = parseInt(lotStr, 10) || 0;
  const price = parseFormattedNumber(priceStr);
  const existing = !editing ? holdings.find((h) => h.ticker.toUpperCase() === ticker) ?? null : null;
  const merged = existing && lot > 0 && price > 0
    ? { lot: existing.lot + lot, avg: mergeAveragePrice(existing.lot, existing.avg_price, lot, price) }
    : null;
  const tickerValid = /^[A-Z]{4}$/.test(ticker);
  const canSubmit = tickerValid && lot >= 1 && price > 0 && !saving;

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const applyMarketPrice = async () => {
    if (!tickerValid) return;
    setFetchingPrice(true);
    try {
      const quotes = await fetchQuotes([ticker]);
      const q = quotes[ticker];
      if (q) {
        setMarketPrice(q.price);
        setPriceStr(fmtInput(q.price, language, 0));
      } else {
        setError(L(`Harga ${ticker} tidak ditemukan.`, `No price found for ${ticker}.`));
      }
    } catch {
      setError(L('Gagal mengambil harga pasar.', 'Failed to fetch the market price.'));
    } finally {
      setFetchingPrice(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canSubmit) return;
    setSaving(true);
    setError(null);
    try {
      if (editing) {
        await onSubmit({ id: editing.id, ticker: editing.ticker, company_name: editing.company_name, lot, avg_price: price });
      } else if (existing && merged) {
        await onSubmit({ id: existing.id, ticker, company_name: existing.company_name || knownName, lot: merged.lot, avg_price: Math.round(merged.avg * 100) / 100 });
      } else {
        await onSubmit({ ticker, company_name: knownName, lot, avg_price: price });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setSaving(false);
    }
  };

  const title = editing
    ? L(`Ubah posisi ${editing.ticker}`, `Edit ${editing.ticker} position`)
    : existing
      ? L(`Beli lagi ${ticker}`, `Buy more ${ticker}`)
      : L('Tambah saham', 'Add stock');

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" role="dialog" aria-modal="true" aria-labelledby={`${fieldId}-title`}>
      <motion.div className="absolute inset-0 bg-slate-950/70 backdrop-blur-sm" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={onClose} />
      <motion.form
        onSubmit={submit}
        initial={{ opacity: 0, scale: 0.96, y: 12 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.96, y: 12 }}
        className="relative w-full max-w-md rounded-3xl border border-white/10 bg-card-bg shadow-2xl p-5 sm:p-6 space-y-4"
      >
        <div className="flex items-start justify-between gap-3">
          <h2 id={`${fieldId}-title`} className="text-base font-black text-white">{title}</h2>
          <button type="button" onClick={onClose} aria-label={L('Tutup', 'Close')} className="p-1.5 -m-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer">
            <X className="h-5 w-5" />
          </button>
        </div>

        <Field
          label={L('Kode saham', 'Ticker')}
          htmlFor={`${fieldId}-ticker`}
          hint={ticker.length === 4
            ? knownName
              ? knownName
              : <span className="text-amber-400">{L('Kode tidak ada di daftar BEI (Des 2024). Tetap bisa disimpan bila emiten baru.', 'Not in the IDX list (Dec 2024). You can still save it for a new listing.')}</span>
            : undefined}
        >
          <div className="flex items-center gap-2">
            {ticker.length >= 3 && <CompanyLogo symbol={ticker} size={40} />}
            <input
              id={`${fieldId}-ticker`}
              type="text"
              autoFocus={!editing}
              disabled={!!editing}
              maxLength={4}
              value={tickerStr}
              onChange={(e) => setTickerStr(e.target.value.replace(/[^a-zA-Z]/g, '').toUpperCase())}
              placeholder="BBCA"
              className="w-full glass-input px-3 py-2.5 text-sm font-extrabold text-white uppercase tracking-wider disabled:opacity-60"
            />
          </div>
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={existing ? L('Lot dibeli', 'Lots bought') : L('Jumlah lot', 'Lots')} htmlFor={`${fieldId}-lot`}>
            <StepperInput
              id={`${fieldId}-lot`}
              type="text"
              inputMode="numeric"
              autoFocus={!!editing}
              value={lotStr}
              placeholder="10"
              onChange={(e) => setLotStr(sanitizeInteger(e.target.value))}
              onStep={(dir) => setLotStr(String(Math.max(1, lot + dir)))}
              canDecrement={lot > 1}
              decrementLabel={`${t('calculator.decrease')} lot`}
              incrementLabel={`${t('calculator.increase')} lot`}
              inputClassName="font-bold text-white"
            />
          </Field>
          <Field
            label={
              <>
                <span>{existing ? L('Harga beli', 'Buy price') : L('Harga rata-rata', 'Average price')}</span>
                {tickerValid && (
                  <button type="button" onClick={() => void applyMarketPrice()} disabled={fetchingPrice} className="normal-case tracking-normal text-emerald-400 hover:underline cursor-pointer disabled:opacity-60 flex items-center gap-1">
                    {fetchingPrice && <Loader2 className="h-3 w-3 animate-spin" />}
                    {L('harga pasar', 'market')}
                  </button>
                )}
              </>
            }
            htmlFor={`${fieldId}-price`}
            hint={price > 0 && !isValidIdxPrice(price) && !editing
              ? <span className="text-amber-400">{L('Bukan kelipatan fraksi (wajar bila rata-rata).', 'Not a tick price (fine for an average).')}</span>
              : marketPrice ? L(`Pasar ${rp(marketPrice, language)}`, `Market ${rp(marketPrice, language)}`) : undefined}
          >
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

        {lot > 0 && price > 0 && (
          <p className="text-[11px] text-slate-400">
            {L(`Nilai: ${rp(lot * 100 * price, language)} (${(lot * 100).toLocaleString('id-ID')} lembar)`, `Value: ${rp(lot * 100 * price, language)} (${(lot * 100).toLocaleString('en-US')} shares)`)}
          </p>
        )}

        {existing && (
          <div className="p-3 rounded-2xl bg-sky-500/5 border border-sky-500/25 text-[11px] text-slate-300 flex gap-2.5">
            <Info className="h-4 w-4 text-sky-400 shrink-0 mt-0.5" />
            <div>
              {L(`Anda sudah punya ${existing.lot} lot ${existing.ticker} @ ${rp(existing.avg_price, language)}. Pembelian ini akan digabung.`, `You already hold ${existing.lot} lots of ${existing.ticker} @ ${rp(existing.avg_price, language)}. This purchase will be merged.`)}
              {merged && (
                <span className="block mt-1 font-bold text-white">
                  {L(`Setelah digabung: ${merged.lot} lot @ ${rp(merged.avg, language)}`, `After merging: ${merged.lot} lots @ ${rp(merged.avg, language)}`)}
                </span>
              )}
            </div>
          </div>
        )}

        {error && <p className="text-xs text-rose-300 bg-rose-500/10 border border-rose-500/25 rounded-xl p-2.5">{error}</p>}

        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-slate-200 text-xs font-bold cursor-pointer">
            {L('Batal', 'Cancel')}
          </button>
          <button type="submit" disabled={!canSubmit} className="flex-1 py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-white text-xs font-bold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5">
            {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {existing ? L('Gabungkan', 'Merge') : L('Simpan', 'Save')}
          </button>
        </div>
      </motion.form>
    </div>
  );
}
