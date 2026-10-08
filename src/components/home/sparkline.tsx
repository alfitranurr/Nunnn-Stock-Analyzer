'use client';

import * as React from 'react';
import { motion } from 'framer-motion';

interface SparklineProps {
  values: number[];
  /** Garis acuan putus-putus (mis. harga penutupan kemarin). Juga menentukan warna naik/turun. */
  baseline?: number;
  width?: number;
  height?: number;
  className?: string;
  strokeWidth?: number;
  /** Isi area di bawah garis. */
  filled?: boolean;
}

/** Grafik garis kecil tanpa sumbu untuk harga intraday. */
export function Sparkline({
  values,
  baseline,
  width = 120,
  height = 32,
  className = '',
  strokeWidth = 1.5,
  filled = false,
}: SparklineProps) {
  const gradientId = React.useId();
  const clipId = React.useId();

  if (values.length < 2) {
    return <div className={className} style={{ width, height }} aria-hidden="true" />;
  }

  const reference = baseline ?? values[0];
  const isUp = values[values.length - 1] >= reference;
  const color = isUp ? '#10b981' : '#f43f5e';

  const min = Math.min(...values, reference);
  const max = Math.max(...values, reference);
  const span = max - min || 1;
  const pad = strokeWidth;
  const x = (i: number) => (i / (values.length - 1)) * width;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);

  const line = values.map((v, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(' ');

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="none"
      className={className}
      style={{ width: className.includes('w-') ? undefined : width, height }}
      aria-hidden="true"
    >
      {filled && (
        <>
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity="0.25" />
              <stop offset="100%" stopColor={color} stopOpacity="0" />
            </linearGradient>
          </defs>
          <path d={`${line} L${width},${height} L0,${height} Z`} fill={`url(#${gradientId})`} />
        </>
      )}
      <defs>
        <clipPath id={clipId}>
          <motion.rect x="0" y="0" height={height} initial={{ width: 0 }} animate={{ width }} transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1] }} />
        </clipPath>
      </defs>
      {baseline !== undefined && (
        <line
          x1="0"
          x2={width}
          y1={y(reference)}
          y2={y(reference)}
          stroke="#64748b"
          strokeWidth="1"
          strokeDasharray="3 3"
          vectorEffect="non-scaling-stroke"
        />
      )}
      <path d={line} clipPath={`url(#${clipId})`} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
