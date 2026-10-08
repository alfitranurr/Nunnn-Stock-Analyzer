'use client';

import * as React from 'react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

/** Logo emiten dari CDN Stockbit; bila gagal dimuat, tampilkan 2 huruf awal kode saham. */
export function CompanyLogo({ symbol, size = 40, className }: { symbol: string; size?: number; className?: string }) {
  const clean = symbol.toUpperCase().trim();
  const [failedFor, setFailedFor] = React.useState<string | null>(null);
  const failed = failedFor === clean || clean.length < 3;
  const inner = Math.round(size * 0.7);

  return (
    <div
      className={cn('rounded-xl bg-white/5 border border-white/10 flex items-center justify-center overflow-hidden shrink-0', className)}
      style={{ width: size, height: size }}
    >
      {failed ? (
        <span className="font-black text-xs text-emerald-400">{clean.slice(0, 2) || 'ID'}</span>
      ) : (
        <Image
          src={`https://assets.stockbit.com/logos/companies/${clean}.png`}
          alt={clean}
          width={inner}
          height={inner}
          className="object-contain"
          style={{ width: inner, height: inner }}
          onError={() => setFailedFor(clean)}
        />
      )}
    </div>
  );
}
