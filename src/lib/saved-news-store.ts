'use client';

import * as React from 'react';
import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import { getErrorMessage } from '@/lib/utils';
import type { NewsItem } from '@/lib/news';

/**
 * Berita yang disimpan pengguna (tombol Simpan di halaman Berita).
 * Selalu disimpan di localStorage; bila pengguna login ke Supabase, juga disinkronkan
 * ke tabel `user_saved_news` (migrasi 000013; versi cloud menang saat login), sama seperti watchlist.
 */

export interface SavedNewsItem extends NewsItem {
  /** ISO 8601, waktu disimpan. */
  savedAt: string;
}

export const SAVED_NEWS_MAX = 200;
const STORAGE_KEY = 'nunnn_stock_saved_news';
const EMPTY: SavedNewsItem[] = [];

let items: SavedNewsItem[] | null = null;
const listeners = new Set<() => void>();
let remoteUserId: string | null = null;
let remoteSaveTimer: ReturnType<typeof setTimeout> | null = null;

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.slice(0, max) : '');

function sanitize(value: unknown): SavedNewsItem[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const result: SavedNewsItem[] = [];
  for (const raw of value) {
    const id = str(raw?.id, 1000);
    const link = str(raw?.link, 2000);
    const title = str(raw?.title, 500);
    if (!id || !title || !/^https:\/\//i.test(link) || seen.has(id)) continue;
    seen.add(id);
    result.push({
      id,
      title,
      link,
      pubDate: str(raw?.pubDate, 40),
      source: str(raw?.source, 120),
      sourceDomain: typeof raw?.sourceDomain === 'string' ? raw.sourceDomain.slice(0, 120) : null,
      tickers: Array.isArray(raw?.tickers)
        ? raw.tickers.filter((t: unknown): t is string => typeof t === 'string' && /^[A-Z0-9]{1,6}$/.test(t)).slice(0, 10)
        : [],
      savedAt: str(raw?.savedAt, 40) || new Date(0).toISOString(),
    });
    if (result.length >= SAVED_NEWS_MAX) break;
  }
  return result;
}

function read(): SavedNewsItem[] {
  if (items) return items;
  try {
    items = sanitize(JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'));
  } catch {
    items = [];
  }
  return items;
}

function commit(next: SavedNewsItem[], { syncRemote = true } = {}) {
  items = next;
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
        .from('user_saved_news')
        .upsert({ user_id: userId, items: read(), updated_at: new Date().toISOString() });
      if (error) throw error;
    } catch (err) {
      console.warn('[saved-news] Gagal sinkron ke cloud, tetap tersimpan di browser:', getErrorMessage(err));
    }
  }, 800);
}

/** Hubungkan berita tersimpan ke akun (null = keluar). Data cloud menggantikan data lokal bila ada. */
export async function connectSavedNewsToUser(userId: string | null) {
  remoteUserId = userId;
  if (!userId || !isSupabaseConfigured) return;
  try {
    const { data, error } = await supabase
      .from('user_saved_news')
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
    console.warn('[saved-news] Gagal memuat dari cloud, memakai data browser:', getErrorMessage(err));
  }
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Simpan berita (paling baru di depan). false bila sudah penuh. */
export function saveNews(item: NewsItem): boolean {
  const current = read();
  if (current.some((s) => s.id === item.id)) return true;
  if (current.length >= SAVED_NEWS_MAX) return false;
  const entry: SavedNewsItem = {
    id: item.id,
    title: item.title,
    link: item.link,
    pubDate: item.pubDate,
    source: item.source,
    sourceDomain: item.sourceDomain,
    tickers: item.tickers,
    savedAt: new Date().toISOString(),
  };
  commit([entry, ...current]);
  return true;
}

export function unsaveNews(id: string) {
  commit(read().filter((s) => s.id !== id));
}

export function clearSavedNews() {
  commit([]);
}

export function useSavedNews() {
  const list = React.useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    items: list,
    isFull: list.length >= SAVED_NEWS_MAX,
    has: (id: string) => list.some((s) => s.id === id),
    save: saveNews,
    remove: unsaveNews,
    clear: clearSavedNews,
  };
}
