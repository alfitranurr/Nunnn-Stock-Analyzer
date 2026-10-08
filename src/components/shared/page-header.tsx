import * as React from 'react';
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

/** Header standar setiap halaman agar ukuran, jarak, dan gaya seragam. */
export function PageHeader({ icon: Icon, eyebrow, title, description, actions, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'relative overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-card-bg via-[#161b22] to-[#0d1117] p-5 md:p-7 shadow-xl w-full',
        className
      )}
    >
      <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-emerald-500/10 blur-[90px] pointer-events-none" aria-hidden />
      <div className="relative z-10 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-2 min-w-0">
          <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-extrabold uppercase tracking-widest text-emerald-400">
            <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden />
            <span>{eyebrow}</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-black tracking-tight text-white">{title}</h1>
          {description && <div className="text-xs md:text-sm text-slate-400 leading-relaxed max-w-3xl">{description}</div>}
        </div>
        {actions && <div className="flex items-center gap-2 w-full md:w-auto shrink-0">{actions}</div>}
      </div>
    </header>
  );
}
