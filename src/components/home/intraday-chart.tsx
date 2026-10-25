'use client';

import * as React from 'react';
import { formatNumberLocale } from '@/lib/format';
import type { Lang } from './types';

interface IntradayChartProps {
  language: Lang;
  values: number[];
  /** Penutupan kemarin: garis acuan putus-putus dan dasar warna/persentase. */
  previousClose: number;
  /** Label ujung kanan sumbu waktu, mis. "16:00" atau "Terakhir 10:35". */
  endLabel: string;
  height?: number;
}

const GAIN = '#2fd39f';
const LOSS = '#ff6670';
const L = 52, R = 8, T = 10, B = 24;

/** Grafik intraday IHSG dengan sumbu harga, garis penutupan kemarin, dan pembacaan nilai saat diarahkan kursor. */
export function IntradayChart({ language, values, previousClose, endLabel, height = 220 }: IntradayChartProps) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [width, setWidth] = React.useState(720);
  const [hover, setHover] = React.useState<number | null>(null);
  const gradientId = React.useId();
  const isId = language === 'id';

  React.useEffect(() => {
    const el = wrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const H = height;
  const lo0 = Math.min(...values, previousClose);
  const hi0 = Math.max(...values, previousClose);
  // Langkah gridline "bulat" agar paling banyak ±5 garis.
  const step = [1, 2, 5, 10, 20, 25, 50, 100, 200].find((s) => (hi0 - lo0) / s <= 5) ?? 500;
  const lo = Math.floor(lo0 / step) * step;
  const hi = Math.max(lo + step, Math.ceil(hi0 / step) * step);
  const ticks: number[] = [];
  for (let v = lo; v <= hi + 1e-9; v += step) ticks.push(v);

  const x = (i: number) => L + (i / Math.max(1, values.length - 1)) * (width - L - R);
  const y = (v: number) => T + (1 - (v - lo) / (hi - lo)) * (H - T - B);
  const line = values.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
  const last = values[values.length - 1];
  const color = last >= previousClose ? GAIN : LOSS;

  const onMove = (e: React.PointerEvent<SVGSVGElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    const px = ((e.clientX - r.left) / r.width) * width;
    setHover(Math.max(0, Math.min(values.length - 1, Math.round(((px - L) / (width - L - R)) * (values.length - 1)))));
  };

  const hv = hover !== null ? values[hover] : null;
  const hoverPct = hv !== null && previousClose ? (hv / previousClose - 1) * 100 : 0;

  return (
    <div ref={wrapRef} className="relative -mx-1">
      <svg
        viewBox={`0 0 ${width} ${H}`}
        className="block w-full h-auto touch-pan-y"
        role="img"
        aria-label={isId ? 'Grafik IHSG intraday' : 'IHSG intraday chart'}
        onPointerMove={onMove}
        onPointerLeave={() => setHover(null)}
      >
        <defs>
          <linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
            <stop offset="0" stopColor={color} stopOpacity="0.28" />
            <stop offset="1" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        {ticks.map((v) => (
          <g key={v}>
            <line x1={L} x2={width - R} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" />
            <text x={L - 10} y={y(v) + 4} textAnchor="end" className="fill-slate-500 text-[11px] font-medium tabular-nums">
              {formatNumberLocale(v, language, step < 1 ? 1 : 0)}
            </text>
          </g>
        ))}
        <line x1={L} x2={width - R} y1={y(previousClose)} y2={y(previousClose)} stroke="#7d8590" strokeDasharray="4 4" />
        <path d={`${line}L${x(values.length - 1)},${y(lo)}L${x(0)},${y(lo)}Z`} fill={`url(#${gradientId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth="2.25" strokeLinejoin="round" strokeLinecap="round" />
        <circle cx={x(values.length - 1)} cy={y(last)} r="4.5" fill={color} stroke="var(--card-bg)" strokeWidth="2" />
        <text x={L} y={H - 4} className="fill-slate-500 text-[11px] font-medium">09:00</text>
        <text x={width - R} y={H - 4} textAnchor="end" className="fill-slate-500 text-[11px] font-medium">{endLabel}</text>
        {hover !== null && hv !== null && (
          <g>
            <line x1={x(hover)} x2={x(hover)} y1={T} y2={H - B} stroke="#7d8590" />
            <circle cx={x(hover)} cy={y(hv)} r="5" fill="var(--card-bg)" stroke={color} strokeWidth="2.25" />
          </g>
        )}
      </svg>
      {hover !== null && hv !== null && (
        <div className="pointer-events-none absolute top-1 right-2 px-3 py-1.5 rounded-xl bg-surface-3 text-xs leading-snug tabular-nums">
          <b className="text-white">{formatNumberLocale(hv, language, 2)}</b>{' '}
          <span className={hoverPct >= 0 ? 'text-emerald-400' : 'text-rose-400'}>
            {hoverPct >= 0 ? '+' : ''}{formatNumberLocale(hoverPct, language, 2)}%
          </span>
          <br />
          <span className="text-slate-500">{isId ? `bar ${hover + 1} dari ${values.length}` : `bar ${hover + 1} of ${values.length}`}</span>
        </div>
      )}
    </div>
  );
}
