/**
 * FILE: client.js
 * PURPOSE: Supabase browser client singleton for use in React components.
 *
 * CONTEXT: This is the primary Supabase client used on the client-side
 *          (browser). It uses the public anon key and respects Row Level
 *          Security policies. Used by all hooks, context providers, and
 *          client-side data fetching throughout the victim and NGO apps.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - supabase: Supabase browser client instance
 *
 * KEY DEPENDENCIES:
 *   - @supabase/supabase-js
 *
 * TODO:
 *   [ ] Initialize Supabase client with env vars
 *   [ ] Ensure singleton pattern (no duplicate instances)
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const hasEnvVars = !!(supabaseUrl && supabaseAnonKey);

if (!hasEnvVars) {
  console.warn(
    'Sahaay: Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Supabase client will not work. Check your .env.local file.'
  );
}

/** @type {import('@supabase/supabase-js').SupabaseClient} */
export const supabase = (() => {
  // Singleton guard — prevents duplicate clients during Next.js hot reloads
  if (typeof globalThis !== 'undefined' && globalThis.__sahaay_supabase) {
    return globalThis.__sahaay_supabase;
  }
  const client = createClient(
    supabaseUrl  || 'https://placeholder.supabase.co',
    supabaseAnonKey || 'placeholder-anon-key',
    {
      auth: {
        persistSession:     hasEnvVars,
        autoRefreshToken:   hasEnvVars,
        detectSessionInUrl: false,
        storageKey:         'sahaay-auth-v1', // unique key avoids Web Lock conflicts
      },
    }
  );
  if (typeof globalThis !== 'undefined') globalThis.__sahaay_supabase = client;
  return client;
})();
