'use client';

import * as React from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/utils';

/**
 * Watchlist bersama untuk seluruh aplikasi (widget Beranda, tab Watchlist, tombol ☆).
 * Selalu disimpan di localStorage; bila pengguna login ke Supabase, juga disinkronkan
 * ke tabel `user_watchlists` (versi cloud menang saat login).
 */

export type WatchlistTargetKind = 'buy' | 'sell';

/** Harga incaran: beli bila harga turun ke/di bawahnya, jual bila naik ke/di atasnya. */
export interface WatchlistTarget {
  price: number;
  kind: WatchlistTargetKind;
}

export interface WatchlistEntry {
  symbol: string;
  name: string;
  target?: WatchlistTarget;
}

export const WATCHLIST_MAX = 20;
const STORAGE_KEY = 'nunnn_stock_watchlist';
const EMPTY: WatchlistEntry[] = [];

let entries: WatchlistEntry[] | null = null;
const listeners = new Set<() => void>();
let remoteUserId: string | null = null;
let remoteSaveTimer: ReturnType<typeof setTimeout> | null = null;

function sanitize(value: unknown): WatchlistEntry[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: WatchlistEntry[] = [];
  for (const item of value) {
    const symbol = typeof item?.symbol === 'string' ? item.symbol.toUpperCase().trim() : '';
    if (!/^[A-Z0-9]{1,6}$/.test(symbol) || seen.has(symbol)) continue;
    seen.add(symbol);
    const entry: WatchlistEntry = { symbol, name: typeof item?.name === 'string' ? item.name : symbol };
    const t = item?.target;
    if (t && typeof t.price === 'number' && t.price > 0 && Number.isFinite(t.price) && (t.kind === 'buy' || t.kind === 'sell')) {
      entry.target = { price: t.price, kind: t.kind };
    }
    result.push(entry);
    if (result.length >= WATCHLIST_MAX) break;
  }
  return result;
}

function read(): WatchlistEntry[] {
  if (entries) return entries;
  try {
    entries = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    entries = [];
  }
  return entries;
}

function commit(next: WatchlistEntry[], { syncRemote = true } = {}) {
  entries = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage penuh/diblokir: tetap simpan di memori.
  }
  listeners.forEach((listener) => listener());
  if (syncRemote) scheduleRemoteSave();
}

function scheduleRemoteSave() {
  if (!remoteUserId || !isSupabaseConfigured) return;
  if (remoteSaveTimer) clearTimeout(remoteSaveTimer);
  const userId = remoteUserId;
  remoteSaveTimer = setTimeout(async () => {
    try {
      const { error } = await supabase
        .from('user_watchlists')
        .upsert({ user_id: userId, items: read(), updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (err) {
      console.warn('[watchlist] Gagal sinkron ke cloud, tetap tersimpan di browser:', getErrorMessage(err));
    }
  }, 800);
}

/** Hubungkan watchlist ke akun (null = keluar). Data cloud menggantikan data lokal bila ada. */
export async function connectWatchlistToUser(userId: string | null) {
  remoteUserId = userId;
  if (!userId || !isSupabaseConfigured) return;
  try {
    const { data, error } = await supabase
      .from('user_watchlists')
      .select('items')
      .eq('user_id', userId)
      .maybeSingle();
    if (error) throw error;
    if (remoteUserId !== userId) return; // Pengguna berganti selama request
    const remote = sanitize(data?.items);
    if (data && remote.length > 0) {
      commit(remote, { syncRemote: false });
    } else if (read().length > 0) {
      scheduleRemoteSave();
    }
  } catch (err) {
    console.warn('[watchlist] Gagal memuat dari cloud, memakai data browser:', getErrorMessage(err));
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function addToWatchlist(entry: WatchlistEntry): boolean {
  const current = read();
  const symbol = entry.symbol.toUpperCase();
  if (current.length >= WATCHLIST_MAX || current.some((e) => e.symbol === symbol)) return false;
  commit([...current, { symbol, name: entry.name || symbol }]);
  return true;
}

export function removeFromWatchlist(symbol: string) {
  commit(read().filter((e) => e.symbol !== symbol.toUpperCase()));
}

export function toggleWatchlist(entry: WatchlistEntry): boolean {
  const symbol = entry.symbol.toUpperCase();
  if (read().some((e) => e.symbol === symbol)) {
    removeFromWatchlist(symbol);
    return false;
  }
  return addToWatchlist(entry);
}

/** Pasang atau hapus (null) harga incaran untuk satu saham. */
export function setWatchlistTarget(symbol: string, target: WatchlistTarget | null) {
  const upper = symbol.toUpperCase();
  commit(
    read().map((e) => {
      if (e.symbol !== upper) return e;
      const next: WatchlistEntry = { symbol: e.symbol, name: e.name };
      if (target && target.price > 0) next.target = { price: target.price, kind: target.kind };
      return next;
    })
  );
}

/** Geser saham satu posisi ke atas (-1) atau ke bawah (+1) dalam urutan manual. */
export function moveWatchlistEntry(symbol: string, direction: -1 | 1) {
  const list = [...read()];
  const i = list.findIndex((e) => e.symbol === symbol.toUpperCase());
  const j = i + direction;
  if (i < 0 || j < 0 || j >= list.length) return;
  [list[i], list[j]] = [list[j], list[i]];
  commit(list);
}

/** Status harga incaran pada harga sekarang. */
export function isTargetReached(target: WatchlistTarget | undefined, price: number | null | undefined): boolean {
  if (!target || price == null || !(price > 0)) return false;
  return target.kind === 'buy' ? price <= target.price : price >= target.price;
}

export function useWatchlist() {
  const list = React.useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    entries: list,
    isFull: list.length >= WATCHLIST_MAX,
    has: (symbol: string) => list.some((e) => e.symbol === symbol.toUpperCase()),
    add: addToWatchlist,
    remove: removeFromWatchlist,
    toggle: toggleWatchlist,
    setTarget: setWatchlistTarget,
    move: moveWatchlistEntry,
  };
}
