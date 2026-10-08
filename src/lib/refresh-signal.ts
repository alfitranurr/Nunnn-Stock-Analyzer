'use client';

import * as React from 'react';

/**
 * Sinyal "muat ulang semua data" di sisi klien. Admin menekan Refresh → `bumpDataRefresh()`;
 * komponen yang memasukkan `useDataRefreshEpoch()` ke `key` usePolling langsung mengambil data baru.
 * Disiarkan juga ke tab browser lain lewat BroadcastChannel.
 */

/** Interval pembaruan otomatis data harga selama jam bursa (semua halaman). */
export const LIVE_POLL_MS = 30_000;

let epoch = 0;
const listeners = new Set<() => void>();
const CHANNEL = 'nunnn-data-refresh';
let channel: BroadcastChannel | null = null;

function notify() {
  epoch += 1;
  listeners.forEach((l) => l());
}

function ensureChannel() {
  if (channel || typeof window === 'undefined' || typeof BroadcastChannel === 'undefined') return;
  channel = new BroadcastChannel(CHANNEL);
  channel.onmessage = () => notify();
}

export function bumpDataRefresh() {
  ensureChannel();
  notify();
  channel?.postMessage('refresh');
}

function subscribe(listener: () => void) {
  ensureChannel();
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useDataRefreshEpoch(): number {
  return React.useSyncExternalStore(subscribe, () => epoch, () => 0);
}

/** Ringkasan respons POST /api/admin/refresh (refresh server oleh admin dari tombol sidebar). */
export interface ServerRefreshResult {
  refreshedAt: string;
  durationMs: number;
  cleared: { caches: number; entries: number };
  allInstances?: boolean;
  generation?: string | null;
  universe: unknown;
  coverage?: unknown;
}

let lastServerRefresh: ServerRefreshResult | null = null;
const serverListeners = new Set<() => void>();

export function publishServerRefresh(result: ServerRefreshResult) {
  lastServerRefresh = result;
  serverListeners.forEach((l) => l());
}

/** Hasil refresh server terakhir di sesi browser ini (null bila belum pernah). */
export function useLastServerRefresh(): ServerRefreshResult | null {
  return React.useSyncExternalStore(
    (l) => {
      serverListeners.add(l);
      return () => serverListeners.delete(l);
    },
    () => lastServerRefresh,
    () => null
  );
}
