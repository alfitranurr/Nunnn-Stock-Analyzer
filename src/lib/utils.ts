import { ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
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
