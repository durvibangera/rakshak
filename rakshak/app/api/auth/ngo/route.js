/**
 * FILE: route.js (NGO Auth)
 * PURPOSE: Handle email/password login for NGO administrators.
 *
 * CONTEXT: NGO admins authenticate with email + password (not OTP).
 *          POST /api/auth/ngo — sign in with email/password via Supabase Auth.
 *          Only users with role=NGO in the users table are allowed.
 *
 * ROLE ACCESS: Public (unauthenticated)
 *
 * EXPORTS:
 *   - POST: Sign in NGO admin with email/password
 *
 * KEY DEPENDENCIES:
 *   - lib/supabase/admin.js
 *   - constants/roles.js
 *
 * TODO:
 *   [ ] POST handler — validate email/password
 *   [ ] Call supabase.auth.signInWithPassword()
 *   [ ] Verify user has NGO role in users table
 *   [ ] Reject non-NGO users with clear error
 *   [ ] Rate limiting (max 10 attempts per email per hour)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ROLES } from '@/constants/roles';

export async function POST(request) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        { status: 400 }
      );
    }

    // Sign in
    const { data, error } = await supabaseAdmin.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 401 });
    }

    // Verify admin role — must be super_admin or camp_admin
    const { data: userProfile, error: profileError } = await supabaseAdmin
      .from('users')
      .select('id, role, assigned_camp_id, name')
      .eq('id', data.user.id)
      .single();

    // Also try by auth_uid if not found by id
    let profile = userProfile;
    if (!profile) {
      const { data: byAuthUid } = await supabaseAdmin
        .from('users')
        .select('id, role, assigned_camp_id, name')
        .eq('auth_uid', data.user.id)
        .single();
      profile = byAuthUid;
    }

    const adminRoles = [ROLES.SUPER_ADMIN, ROLES.CAMP_ADMIN];
    if (!profile || !adminRoles.includes(profile.role)) {
      return NextResponse.json(
        { error: 'Access denied. Admin credentials required.' },
        { status: 403 }
      );
    }

    return NextResponse.json({
      session: data.session,
      user: data.user,
      profile: {
        id: profile.id,
        role: profile.role,
        name: profile.name,
        assigned_camp_id: profile.assigned_camp_id,
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
