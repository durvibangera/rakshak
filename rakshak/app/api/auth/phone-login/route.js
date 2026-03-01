/**
 * POST /api/auth/phone-login
 * Phone-based login — looks up user by phone number in the users table.
 * No OTP required. Returns user profile if found.
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { phone } = await request.json();

    if (!phone || !/^\+91\d{10}$/.test(phone)) {
      return NextResponse.json(
        { error: 'Invalid phone number. Use format: +91XXXXXXXXXX' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Look up user by phone
    const { data: user, error } = await supabase
      .from('users')
      .select('id, name, phone, role, state, selfie_url, qr_code_id, registration_type, assigned_camp_id, blood_group, medical_conditions, disability_status, emergency_contact_name, emergency_contact_phone, created_at')
      .eq('phone', phone)
      .single();

    if (error || !user) {
      return NextResponse.json(
        { error: 'No account found with this phone number. Please register first.' },
        { status: 404 }
      );
    }

    // Get camp info if assigned
    let camp = null;
    if (user.assigned_camp_id) {
      const { data: campData } = await supabase
        .from('camps')
        .select('id, name, lat, lng, status')
        .eq('id', user.assigned_camp_id)
        .single();
      camp = campData;
    }

    // Also check camp_victims for latest camp check-in
    if (!camp) {
      const { data: cv } = await supabase
        .from('camp_victims')
        .select('camp_id, checked_in_at, checked_in_via, camps(id, name, lat, lng, status)')
        .eq('user_id', user.id)
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .single();
      if (cv?.camps) {
        camp = cv.camps;
      }
    }

    return NextResponse.json({
      success: true,
      user,
      camp,
    });
  } catch (err) {
    console.error('[PhoneLogin] Error:', err);
    return NextResponse.json({ error: 'Login failed' }, { status: 500 });
  }
}
