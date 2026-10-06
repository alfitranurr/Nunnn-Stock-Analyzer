import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Extract a human-readable message from an unknown caught value. */
export function getErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  // Error Supabase/PostgREST berupa objek biasa { message, details, hint, code }.
  if (err && typeof err === 'object' && typeof (err as { message?: unknown }).message === 'string') {
    return (err as { message: string }).message;
  }
  try {
    return JSON.stringify(err);
  } catch {
    return String(err);
  }
}

/** True bila error berasal dari kegagalan jaringan (server tidak terjangkau), bukan dari server. */
export function isNetworkError(err: unknown): boolean {
  return /failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(getErrorMessage(err));
}

export function cleanCompanyName(name: string | null | undefined): string {
  if (!name) return '';
  return name
    .replace(/\.JK/gi, '')
    .replace(/Perusahaan Perseroan \(Persero\) PT/gi, '')
    .replace(/Perusahaan Perseroan PT/gi, '')
    .replace(/Perusahaan Perseroan \(Persero\)/gi, '')
    .replace(/Perusahaan Perseroan/gi, '')
    .replace(/\bPerseroan\b/gi, '')
    .replace(/\(\s*Persero\s*\)/gi, '')
    .replace(/\bPersero\b/gi, '')
    .replace(/^(PT\.?\s+)/i, '') // Hapus awalan PT
    .replace(/\bPT\.?\s+/gi, '') // Hapus PT di mana pun
    .replace(/\(\s*\)/g, '') // Hapus tanda kurung kosong jika ada
    .replace(/  +/g, ' ')
    .trim();
}
