'use client';

import * as React from 'react';

/**
 * Sinyal "muat ulang semua data" di sisi klien. Admin menekan Refresh → `bumpDataRefresh()`;
 * komponen yang memasukkan `useDataRefreshEpoch()` ke `key` usePolling langsung mengambil data baru.
 * Disiarkan juga ke tab browser lain lewat BroadcastChannel.
 */

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
