'use client';

import * as React from 'react';
import { animate, motion, useReducedMotion } from 'framer-motion';
import { cn } from '@/lib/utils';

/** Kurva standar animasi aplikasi (cepat di awal, mendarat halus). */
export const EASE_OUT = [0.16, 1, 0.3, 1] as const;

/**
 * Angka yang "berjalan" dari nilai lama ke nilai baru (count-up). Teks diperbarui langsung di DOM
 * tanpa render ulang tiap frame. `fromZero` = hitung dari 0 saat pertama tampil (untuk angka hasil).
 * Menghormati preferensi "kurangi gerakan" (langsung ke nilai akhir).
 */
export function AnimatedNumber({
  value,
  format,
  duration = 0.7,
  fromZero = false,
  className,
}: {
  value: number;
  format: (v: number) => string;
  duration?: number;
  fromZero?: boolean;
  className?: string;
}) {
  const ref = React.useRef<HTMLSpanElement>(null);
  const reduce = useReducedMotion();
  const text = format(value);
  // Teks awal ditulis React sekali; selanjutnya DOM diperbarui oleh efek agar tidak berkedip.
  const [initial] = React.useState(() => (fromZero ? format(0) : text));
  const prev = React.useRef<number>(fromZero ? 0 : value);
  const formatRef = React.useRef(format);
  React.useLayoutEffect(() => {
    formatRef.current = format;
  });

  React.useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const from = prev.current;
    prev.current = value;
    if (reduce || from === value || !Number.isFinite(from) || !Number.isFinite(value)) {
      el.textContent = text;
      return;
    }
    const controls = animate(from, value, {
      duration,
      ease: EASE_OUT,
      onUpdate: (v) => {
        el.textContent = formatRef.current(v);
      },
      onComplete: () => {
        el.textContent = formatRef.current(value);
      },
    });
    return () => controls.stop();
  }, [value, text, duration, reduce]);

  return (
    <span ref={ref} className={cn('tabular-nums', className)}>
      {initial}
    </span>
  );
}

/** Muncul halus (fade + naik sedikit) saat masuk layar, sekali saja. */
export function Reveal({ children, className, delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) {
  return (
    <motion.div
      className={className}
      initial={{ opacity: 0, y: 12 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      transition={{ duration: 0.45, ease: EASE_OUT, delay }}
    >
      {children}
    </motion.div>
  );
}

/** Wadah grid/list yang memunculkan anaknya berurutan; pakai bersama `StaggerItem`. */
export function Stagger({ children, className, step = 0.05 }: { children: React.ReactNode; className?: string; step?: number }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '0px 0px -40px 0px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: step } } }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y: 10 }, show: { opacity: 1, y: 0, transition: { duration: 0.4, ease: EASE_OUT } } }}
    >
      {children}
    </motion.div>
  );
}

/** Batang progres yang tumbuh ke `pct` (0–100) dan bergeser halus saat nilainya berubah. */
export function GrowBar({ pct, className, style }: { pct: number; className?: string; style?: React.CSSProperties }) {
  const w = Math.max(0, Math.min(100, Number.isFinite(pct) ? pct : 0));
  return (
    <motion.div
      className={className}
      style={style}
      initial={{ width: 0 }}
      animate={{ width: `${w}%` }}
      transition={{ duration: 0.7, ease: EASE_OUT }}
    />
  );
}

/** Kilatan singkat setiap kali `value` berubah (untuk angka yang diperbarui data live). */
export function Flash({ value, children, className }: { value: string | number; children?: React.ReactNode; className?: string }) {
  return (
    <motion.span
      key={String(value)}
      className={cn('inline-block', className)}
      initial={{ opacity: 0.35, y: -3 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: EASE_OUT }}
    >
      {children ?? value}
    </motion.span>
  );
}
