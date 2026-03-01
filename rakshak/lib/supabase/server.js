/**
 * FILE: server.js
 * PURPOSE: Supabase server client for use in Next.js API routes.
 *
 * CONTEXT: Creates a Supabase client using the service role key for server-side
 *          operations. Also provides a helper to extract and verify the user's
 *          auth session from the Authorization header (Bearer token).
 *
 * ROLE ACCESS: BOTH (server-side only)
 *
 * EXPORTS:
 *   - createServerSupabase: Factory function for admin-level Supabase client
 *   - getUserFromRequest: Extract authenticated user from API request headers
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

/**
 * Create a Supabase admin client (service role, bypasses RLS).
 * Use this for privileged server-side operations.
 * @returns {import('@supabase/supabase-js').SupabaseClient}
 */
export function createServerSupabase() {
  return createClient(supabaseUrl || '', serviceRoleKey || '', {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

/**
 * Extract the authenticated user from an API request.
 * Checks the Authorization header for a Bearer token, verifies it with Supabase,
 * then looks up the user profile (including role) from the users table.
 *
 * Falls back to checking X-User-Phone header for operator-assisted flows
 * where the operator's device acts on behalf of a victim.
 *
 * @param {Request} request - Next.js API request
 * @returns {Promise<{ user: Object|null, profile: Object|null, error: string|null }>}
 */
export async function getUserFromRequest(request) {
  const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '', {
    auth: { persistSession: false },
  });
  const adminClient = createServerSupabase();

  // 1. Try Authorization: Bearer <token>
  const authHeader = request.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    try {
      const { data: { user }, error } = await supabase.auth.getUser(token);
      if (error || !user) {
        return { user: null, profile: null, error: 'Invalid or expired token' };
      }

      // Look up profile by auth UID or user ID
      let profile = null;
      const { data: byAuthUid } = await adminClient
        .from('users')
        .select('*')
        .eq('auth_uid', user.id)
        .single();

      if (byAuthUid) {
        profile = byAuthUid;
      } else {
        // Fallback: try by user.id = users.id
        const { data: byId } = await adminClient
          .from('users')
          .select('*')
          .eq('id', user.id)
          .single();
        profile = byId || null;
      }

      if (!profile) {
        // User authenticated but no profile — might be new
        return { user, profile: null, error: 'No user profile found' };
      }

      return { user, profile, error: null };
    } catch {
      return { user: null, profile: null, error: 'Token verification failed' };
    }
  }

  // 2. Fallback: X-User-Phone header (operator-assisted, localStorage-based)
  const phone = request.headers.get('x-user-phone');
  if (phone) {
    const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`;
    const { data: profile } = await adminClient
      .from('users')
      .select('*')
      .eq('phone', formattedPhone)
      .single();

    if (profile) {
      return { user: null, profile, error: null };
    }
  }

  return { user: null, profile: null, error: 'No authentication provided' };
}
