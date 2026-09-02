import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// Periksa apakah Supabase URL/Key masih default placeholder
export const isSupabaseConfigured =
  supabaseUrl !== '' &&
  supabaseAnonKey !== '' &&
  !supabaseUrl.includes('your-supabase-project');

// In-memory storage that never reads from / writes to real localStorage.
// Used by the unconfigured client so Supabase's auth initializer cannot pick
// up stale `sb-*` tokens from a previous real session and attempt a network
// refresh against the placeholder URL (which would throw "Failed to fetch").
const noopStorage = {
  getItem: () => null,
  setItem: () => undefined,
  removeItem: () => undefined,
};

// When unconfigured, create a no-op client with in-memory storage rather than
// a hardcoded placeholder JWT that could leak into the bundle or trigger
// network errors during the auth recovery flow on init.
export const supabase: SupabaseClient = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : createClient('https://placeholder.supabase.co', 'placeholder-anon-key', {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storage: noopStorage,
      },
    });

