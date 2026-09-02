/**
 * Shared application types.
 *
 * `AppUser` is the minimal shape used across components for the currently
 * logged-in user. A Supabase session user (from `supabase.auth.getSession()`)
 * is structurally compatible — it has `id` and `email` plus many extra fields
 * that we don't rely on directly. A mock/demo user (when Supabase is not
 * configured) carries the `isMock: true` flag.
 */
export interface AppUser {
  id: string;
  email: string;
  /** True when the user originates from the local demo/simulation mode. */
  isMock?: boolean;
  // Supabase User objects carry many additional fields; allow passthrough.
  [key: string]: unknown;
}
