/**
 * "Generasi refresh" data yang dipakai bersama SEMUA instance server.
 *
 * Cache data pasar (`createTtlCache` di lib/yahoo) ada di memori tiap instance. Di Vercel bisa ada
 * beberapa instance sekaligus, jadi tombol "Refresh semua data" di Admin hanya mengosongkan cache
 * instance yang kebetulan menerima request. Untuk menjangkau instance lain, waktu refresh terakhir
 * disimpan di cache data Next.js (`unstable_cache` + tag). Di Vercel cache ini dipakai bersama dan
 * `revalidateTag` berlaku global; tiap instance memeriksanya paling sering tiap 10 detik.
 */

import { revalidateTag, unstable_cache } from 'next/cache';

const TAG = 'nunnn-data-refresh';
const CHECK_INTERVAL_MS = 10_000;

/** Nilai berubah (= waktu dihitung ulang) hanya setelah tag di-revalidate oleh Admin. */
const readGeneration = unstable_cache(async () => Date.now(), ['nunnn-data-refresh-generation'], { tags: [TAG] });

const host = globalThis as typeof globalThis & {
  __nunnnRefreshGen?: { checkedAt: number; generation: number | null; pending: Promise<number | null> | null };
};
const state = (host.__nunnnRefreshGen ??= { checkedAt: 0, generation: null, pending: null });

/**
 * Generasi refresh terkini (ms epoch), dibaca dari cache bersama paling sering tiap 10 detik per instance.
 * Null bila belum terbaca (mis. cache data tidak tersedia); pemanggil lalu memakai perilaku lokal saja.
 */
export async function getRefreshGeneration(): Promise<number | null> {
  if (Date.now() - state.checkedAt < CHECK_INTERVAL_MS) return state.generation;
  if (!state.pending) {
    state.pending = readGeneration()
      .then((g) => {
        state.generation = g;
        return g;
      })
      .catch(() => state.generation)
      .finally(() => {
        state.checkedAt = Date.now();
        state.pending = null;
      });
  }
  return state.pending;
}

/** Tandai semua data kedaluwarsa di semua instance (dipanggil dari route Admin). */
export async function markDataRefreshed(): Promise<number | null> {
  try {
    revalidateTag(TAG, { expire: 0 });
    state.checkedAt = 0;
    const g = await readGeneration();
    state.generation = g;
    state.checkedAt = Date.now();
    return g;
  } catch {
    return null;
  }
}
