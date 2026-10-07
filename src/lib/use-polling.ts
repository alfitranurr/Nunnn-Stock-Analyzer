'use client';

import * as React from 'react';

/**
 * Jalankan `callback` saat `enabled` aktif, lalu ulangi tiap `intervalMs` (null = sekali saja).
 * Tidak berjalan saat tab browser tersembunyi; saat terlihat lagi, dijalankan ulang bila
 * sudah lewat `minGapMs`. Mengubah `key` memaksa pemanggilan ulang (mis. filter berubah).
 */
export function usePolling(
  callback: () => void | Promise<void>,
  {
    enabled,
    intervalMs,
    minGapMs = 0,
    key,
  }: { enabled: boolean; intervalMs: number | null; minGapMs?: number; key?: string | number }
) {
  const callbackRef = React.useRef(callback);
  const lastRunRef = React.useRef(0);
  const prevKeyRef = React.useRef(key);

  React.useLayoutEffect(() => {
    callbackRef.current = callback;
  });

  React.useEffect(() => {
    if (!enabled) return;
    const keyChanged = prevKeyRef.current !== key;
    prevKeyRef.current = key;

    const run = (force: boolean) => {
      if (document.visibilityState !== 'visible') return;
      if (!force && Date.now() - lastRunRef.current < minGapMs) return;
      lastRunRef.current = Date.now();
      void callbackRef.current();
    };

    const kick = window.setTimeout(() => run(keyChanged), 0);
    const interval = intervalMs ? window.setInterval(() => run(true), intervalMs) : null;
    const onVisibilityChange = () => run(false);
    document.addEventListener('visibilitychange', onVisibilityChange);

    return () => {
      window.clearTimeout(kick);
      if (interval !== null) window.clearInterval(interval);
      document.removeEventListener('visibilitychange', onVisibilityChange);
    };
  }, [enabled, intervalMs, minGapMs, key]);
}

/** Waktu sekarang (ms) yang diperbarui tiap `intervalMs`; null sebelum mount agar aman untuk SSR. */
export function useNow(intervalMs: number | null): number | null {
  const [now, setNow] = React.useState<number | null>(null);

  React.useEffect(() => {
    const kick = window.setTimeout(() => setNow(Date.now()), 0);
    const interval = intervalMs ? window.setInterval(() => setNow(Date.now()), intervalMs) : null;
    return () => {
      window.clearTimeout(kick);
      if (interval !== null) window.clearInterval(interval);
    };
  }, [intervalMs]);

  return now;
}
