import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const phone = searchParams.get('phone');
    const qr_code_id = searchParams.get('qr_code_id') || searchParams.get('id');
    const camp_id = searchParams.get('camp_id');

    if (!phone && !qr_code_id) {
      return NextResponse.json({ error: 'phone or qr_code_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const selectFields = 'id, name, phone, state, address, selfie_url, blood_group, medical_conditions, current_medications, disability_status, languages_spoken, emergency_contact_name, emergency_contact_phone, registration_type, qr_code_id, created_at';

    let user = null;
    let error = null;

    // Prefer phone lookup (new QR format), fallback to qr_code_id
    if (phone) {
      const normalized = phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`;
      const result = await supabase
        .from('users')
        .select(selectFields)
        .eq('phone', normalized)
        .single();
      user = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from('users')
        .select(selectFields)
        .eq('qr_code_id', qr_code_id)
        .single();
      user = result.data;
      error = result.error;
    }

    if (error || !user) {
      return NextResponse.json({ found: false, message: 'No user found with this QR code' });
    }

    // Auto-add to camp if camp_id provided
    if (camp_id) {
      await supabase.from('camp_victims').upsert({
        camp_id,
        user_id: user.id,
        checked_in_via: 'qr',
      }, { onConflict: 'camp_id,user_id' });
    }

    return NextResponse.json({ found: true, user });
  } catch (err) {
    console.error('[QR Lookup] Error:', err);
    return NextResponse.json({ error: 'QR lookup failed', details: err.message }, { status: 500 });
  }
}
