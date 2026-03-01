/**
 * FILE: admin.js
 * PURPOSE: Supabase admin client with service role key — bypasses all RLS.
 *
 * CONTEXT: Used ONLY in server-side API routes for privileged operations
 *          like creating camps, updating resources, and running the allocation
 *          algorithm. This client uses the SUPABASE_SERVICE_ROLE_KEY which
 *          has full read/write access to all tables. NEVER expose this on
 *          the client side.
 *
 * ROLE ACCESS: NGO (server-side only)
 *
 * EXPORTS:
 *   - supabaseAdmin: Supabase admin client (bypasses RLS)
 *
 * KEY DEPENDENCIES:
 *   - @supabase/supabase-js
 *
 * TODO:
 *   [ ] Initialize admin client with service role key
 *   [ ] Add safety check — this must NEVER run on browser
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (typeof window !== 'undefined') {
  throw new Error(
    'Rakshak SECURITY: supabaseAdmin must NEVER be imported in client-side code!'
  );
}

/** @type {import('@supabase/supabase-js').SupabaseClient} */
export const supabaseAdmin = createClient(
  supabaseUrl || '',
  serviceRoleKey || '',
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);
