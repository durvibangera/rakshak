/**
 * FILE: route.js (OTP Auth)
 * PURPOSE: Handle phone-based OTP login for victims via Supabase Auth.
 *
 * CONTEXT: Victims authenticate with phone number + OTP (no email/password).
 *          POST /api/auth/otp — sends OTP to phone via Supabase (uses Twilio under the hood).
 *          PUT /api/auth/otp — verifies OTP and returns session.
 *          On first login, creates a user profile with VICTIM role.
 *
 * ROLE ACCESS: Public (unauthenticated)
 *
 * EXPORTS:
 *   - POST: Send OTP to phone number
 *   - PUT: Verify OTP and create session
 *
 * KEY DEPENDENCIES:
 *   - lib/supabase/admin.js
 *   - constants/roles.js
 *
 * TODO:
 *   [ ] POST handler — validate phone, call supabase.auth.signInWithOtp()
 *   [ ] PUT handler — verify OTP with supabase.auth.verifyOtp()
 *   [ ] Create user profile in `users` table on first login
 *   [ ] Rate limiting (max 5 OTP requests per phone per hour)
 *   [ ] Input validation (Indian phone number format: +91XXXXXXXXXX)
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { ROLES } from '@/constants/roles';

export async function POST(request) {
  try {
    const { phone } = await request.json();

    if (!phone || !/^\+91\d{10}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Use format: +91XXXXXXXXXX' },
        { status: 400 }
      );
    }

    // TODO: Rate limiting check

    const { data, error } = await supabaseAdmin.auth.signInWithOtp({ phone });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ message: 'OTP sent successfully', data });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const { phone, token } = await request.json();

    if (!phone || !token) {
      return NextResponse.json(
        { error: 'Phone and OTP token are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabaseAdmin.auth.verifyOtp({
      phone,
      token,
      type: 'sms',
    });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // Create user profile if first login
    if (data?.user) {
      const { data: existing } = await supabaseAdmin
        .from('users')
        .select('id, role')
        .eq('id', data.user.id)
        .single();

      if (!existing) {
        // Also check if a profile already exists by phone (camp-registered)
        const { data: byPhone } = await supabaseAdmin
          .from('users')
          .select('id')
          .eq('phone', phone)
          .single();

        if (byPhone) {
          // Link existing profile to Supabase Auth UID
          await supabaseAdmin.from('users').update({
            auth_uid: data.user.id,
            role: byPhone.role || ROLES.VERIFIED_USER,
          }).eq('id', byPhone.id);
        } else {
          // Create new profile
          await supabaseAdmin.from('users').insert({
            id: data.user.id,
            auth_uid: data.user.id,
            phone: phone,
            role: ROLES.VERIFIED_USER,
          });
        }
      }
    }

    return NextResponse.json({ session: data.session, user: data.user });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
