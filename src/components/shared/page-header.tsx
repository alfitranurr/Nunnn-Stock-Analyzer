'use client';

import * as React from 'react';
import { motion } from 'framer-motion';
import { EASE_OUT } from '@/components/shared/motion';
import type { LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PageHeaderProps {
  icon: LucideIcon;
  /** Label kecil di atas judul (kategori halaman). */
  eyebrow: string;
  title: React.ReactNode;
  description?: React.ReactNode;
  /** Tombol/aksi di sisi kanan (di bawah judul pada layar kecil). */
  actions?: React.ReactNode;
  className?: string;
}

const ITEM = { hidden: { opacity: 0, y: 8 }, show: { opacity: 1, y: 0, transition: { duration: 0.45, ease: EASE_OUT } } };

/** Header standar setiap halaman agar ukuran, jarak, dan gaya seragam. */
export function PageHeader({ icon: Icon, eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-[20px] hero-surface p-5 md:p-7 w-full',
        className
      )}
    >
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <motion.div
          className="space-y-2 min-w-0 flex-1"
          initial="hidden"
          animate="show"
          variants={{ hidden: {}, show: { transition: { staggerChildren: 0.07 } } }}
        >
          <motion.div variants={ITEM} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/[0.07] text-xs font-semibold text-slate-200">
            <Icon className="h-3.5 w-3.5 shrink-0 text-accent" aria-hidden />
            <span>{eyebrow}</span>
          </motion.div>
          <motion.h1 variants={ITEM} className="title-display text-[28px] md:text-4xl leading-[1.08] text-white">{title}</motion.h1>
          {description && <motion.div variants={ITEM} className="text-sm text-slate-300/80 leading-relaxed">{description}</motion.div>}
        </motion.div>
        {actions && <div className="flex items-center gap-2 w-full md:w-auto shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
