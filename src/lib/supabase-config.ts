/**
 * Satu sumber kebenaran untuk konfigurasi Supabase (klien, server, dan proxy).
 * Sebelumnya proxy dan klien memakai pola placeholder yang berbeda (temuan M-18).
 */

const PLACEHOLDER_PATTERNS = ['your-supabase-project', 'your-project-id', 'placeholder.supabase.co'];

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
export const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

export const isSupabaseConfigured =
  SUPABASE_URL !== '' &&
  SUPABASE_ANON_KEY !== '' &&
  !PLACEHOLDER_PATTERNS.some((p) => SUPABASE_URL.includes(p));
