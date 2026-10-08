'use client';

import * as React from 'react';
import { formatIDR, formatNumberForInput, formatNumberLocale, parseFormattedNumber, type Language } from '@/lib/format';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { EASE_OUT, Flash } from '@/components/shared/motion';

export type Lang = Language;

/** Pilih teks sesuai bahasa. */
export const pick = (language: Lang, id: string, en: string) => (language === 'id' ? id : en);

/** Rupiah dibulatkan ke rupiah penuh, mis. "Rp 1.250.000". */
export const rp = (value: number, language: Lang) => formatIDR(Math.round(value), language);

/** Dividen per lembar (bisa berdesimal), mis. "Rp 397,71". */
export const rpShare = (value: number, language: Lang) => formatIDR(Math.round(value * 100) / 100, language);

export const pct = (value: number, language: Lang, digits = 2) => `${formatNumberLocale(value, language, digits)}%`;

export const fmtInput = (value: number, language: Lang, maxFractionDigits = 2) =>
  formatNumberForInput(value, { language, maxFractionDigits });

/** "3 Des 2026" / "3 Dec 2026". Tanggal ISO dibaca sebagai tanggal kalender (tanpa zona waktu). */
export function formatDate(iso: string, language: Lang, withYear = true): string {
  return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', {
    day: 'numeric',
    month: 'short',
    ...(withYear ? { year: 'numeric' } : {}),
    timeZone: 'UTC',
  }).format(Date.parse(`${iso}T00:00:00Z`));
}

export function formatMonth(iso: string, language: Lang, withYear = false): string {
  return new Intl.DateTimeFormat(language === 'id' ? 'id-ID' : 'en-GB', {
    month: 'short',
    ...(withYear ? { year: '2-digit' } : {}),
    timeZone: 'UTC',
  }).format(Date.parse(`${iso.slice(0, 7)}-01T00:00:00Z`));
}

// ─── Input angka ───
export const sanitizeNumber = (s: string) => s.replace(/[^0-9.,]/g, '');
export const sanitizeInteger = (s: string) => s.replace(/[^0-9]/g, '');
export const clamp = (n: number, min: number, max: number) => Math.min(max, Math.max(min, n));

// Langkah nominal mengikuti besarnya angka: 10 juta → ±1 juta, 1,5 juta → ±100 ribu.
const moneyStep = (value: number) => (value < 1_000_000 ? 100_000 : Math.pow(10, Math.floor(Math.log10(value)) - 1));

export function stepMoney(s: string, dir: 1 | -1, language: Lang): string {
  const value = parseFormattedNumber(s);
  const step = moneyStep(dir > 0 ? value : Math.max(0, value - 1));
  return fmtInput(Math.max(0, Math.round((value + dir * step) / step) * step), language, 0);
}

/** Langkah mengikuti besarnya angka bulat: 4.000 → ±100, 250.000 → ±10.000 (minimal ±1). */
export function stepMagnitude(s: string, dir: 1 | -1, language: Lang, min = 0): string {
  const value = Math.round(parseFormattedNumber(s));
  const ref = dir > 0 ? value : Math.max(0, value - 1);
  const step = ref < 10 ? 1 : Math.pow(10, Math.floor(Math.log10(ref)) - 1);
  return fmtInput(Math.max(min, Math.round((value + dir * step) / step) * step), language, 0);
}

export function stepDecimal(s: string, dir: 1 | -1, step: number, min: number, max: number, language: Lang): string {
  const value = parseFormattedNumber(s);
  return fmtInput(clamp(Math.round((value + dir * step) / step) * step, min, max), language, 2);
}

// ─── Komponen kecil ───
/** Kartu standar: muncul halus saat pertama masuk layar, border menyala tipis saat hover. */
export function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -30px 0px' }}
      transition={{ duration: 0.45, ease: EASE_OUT }}
      className={cn('p-4 sm:p-6 rounded-3xl border border-white/10 bg-card-bg shadow-xl w-full', className)}
    >
      {children}
    </motion.section>
  );
}

export function CardTitle({ icon, title, subtitle, right }: { icon: React.ReactNode; title: string; subtitle?: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3 mb-5">
      <div className="min-w-0">
        <h2 className="text-base font-black text-white flex items-center gap-2">
          {icon}
          <span>{title}</span>
        </h2>
        {subtitle && <p className="text-xs text-slate-400 mt-1 leading-relaxed">{subtitle}</p>}
      </div>
      {right}
    </div>
  );
}

export function Field({ label, htmlFor, children, hint }: { label: React.ReactNode; htmlFor?: string; children: React.ReactNode; hint?: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5 min-w-0">
      <label htmlFor={htmlFor} className="text-[10px] font-bold uppercase tracking-wider text-slate-500 flex items-center justify-between gap-2">
        {label}
      </label>
      {children}
      {hint && <div className="text-[10px] text-slate-500 leading-snug">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  className,
  ariaLabel,
}: {
  value: T;
  options: Array<{ value: T; label: React.ReactNode; disabled?: boolean; title?: string }>;
  onChange: (value: T) => void;
  className?: string;
  ariaLabel?: string;
}) {
  return (
    <div role="group" aria-label={ariaLabel} className={cn('flex bg-input-bg border border-border-color p-1 rounded-xl text-[11px] font-extrabold select-none', className)}>
      {options.map((opt) => (
        <button
          key={opt.value}
          type="button"
          disabled={opt.disabled}
          title={opt.title}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          className={cn(
            'flex-1 py-2 px-2 rounded-lg transition-all text-center whitespace-nowrap disabled:opacity-35 disabled:cursor-not-allowed',
            value === opt.value ? 'bg-emerald-500 text-white shadow-md' : 'text-slate-400 hover:text-white cursor-pointer'
          )}
        >
          {opt.label}
        </button>
      ))}
    </div>
  );
}

const TONES = {
  emerald: 'bg-emerald-500/[0.06] border-emerald-500/20 text-emerald-400',
  amber: 'bg-amber-500/[0.06] border-amber-500/20 text-amber-400',
  sky: 'bg-sky-500/[0.06] border-sky-500/20 text-sky-400',
  rose: 'bg-rose-500/[0.06] border-rose-500/20 text-rose-400',
  slate: 'bg-white/[0.02] border-white/10 text-slate-400',
} as const;

export function Stat({
  label,
  value,
  sub,
  tone = 'slate',
  valueClassName,
  className,
}: {
  label: React.ReactNode;
  value: React.ReactNode;
  sub?: React.ReactNode;
  tone?: keyof typeof TONES;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={cn('p-3.5 rounded-2xl border min-w-0 transition-colors duration-500', TONES[tone], className)}>
      <span className="text-[10px] font-bold uppercase tracking-wider block opacity-90">{label}</span>
      <div className={cn('text-lg font-black text-white tracking-tight mt-1 tabular-nums truncate', valueClassName)}>
        {typeof value === 'string' || typeof value === 'number' ? <Flash value={value} className="max-w-full truncate align-bottom" /> : value}
      </div>
      {sub && <div className="text-[11px] text-slate-400 mt-0.5 leading-snug">{sub}</div>}
    </div>
  );
}

export function Badge({ children, tone = 'slate' }: { children: React.ReactNode; tone?: 'emerald' | 'amber' | 'slate' | 'sky' }) {
  const cls = {
    emerald: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/25',
    amber: 'bg-amber-500/15 text-amber-400 border-amber-500/25',
    sky: 'bg-sky-500/15 text-sky-400 border-sky-500/25',
    slate: 'bg-white/5 text-slate-400 border-white/10',
  }[tone];
  return <span className={cn('inline-flex items-center px-1.5 py-0.5 rounded-md text-[9px] font-extrabold uppercase tracking-wide border whitespace-nowrap', cls)}>{children}</span>;
}
