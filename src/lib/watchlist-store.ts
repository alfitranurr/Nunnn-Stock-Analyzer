'use client';

import * as React from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/utils';

/**
 * Watchlist bersama untuk seluruh aplikasi (widget Beranda, tab Watchlist, tombol ☆).
 * Selalu disimpan di localStorage; bila pengguna login ke Supabase, juga disinkronkan
 * ke tabel `user_watchlists` (versi cloud menang saat login).
 */

export interface WatchlistEntry {
  symbol: string;
  name: string;
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
    result.push({ symbol, name: typeof item?.name === 'string' ? item.name : symbol });
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

export function useWatchlist() {
  const list = React.useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    entries: list,
    isFull: list.length >= WATCHLIST_MAX,
    has: (symbol: string) => list.some((e) => e.symbol === symbol.toUpperCase()),
    add: addToWatchlist,
    remove: removeFromWatchlist,
    toggle: toggleWatchlist,
  };
}
