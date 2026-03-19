import { createClient } from '@supabase/supabase-js';
import type { Database } from './database.types';

const supabaseUrl     = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase URL and Anon Key must be provided in .env');
}

const fetchWithTimeout: typeof fetch = (input, init) => {
  const ctrl = new AbortController();
  const id   = setTimeout(() => ctrl.abort(), 10_000);
  return fetch(input, { ...init, signal: ctrl.signal }).finally(() => clearTimeout(id));
};

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey, {
  global: { fetch: fetchWithTimeout },
});

// supabaseAdmin is intentionally absent from the browser client.
// Admin operations (create/delete users) go through /api/* Vercel functions
// which read SUPABASE_SERVICE_ROLE_KEY from process.env (never exposed to browser).
