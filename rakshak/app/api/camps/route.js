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
    const { name, operator_name, operator_phone, operator_email, lat, lng, radius_km, helpline_number, camp_code, admin_email, admin_password } = await request.json();

    if (!name?.trim() || !operator_name?.trim() || !operator_phone?.trim()) {
      return NextResponse.json(
        { error: 'Camp name, operator name, and phone are required' },
        { status: 400 }
      );
    }

    if (lat == null || lng == null) {
      return NextResponse.json(
        { error: 'Camp location (lat/lng) is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // If admin credentials provided, create a Supabase auth user + profile for the camp admin
    let admin_user_id = null;
    if (admin_email && admin_password) {
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: admin_email.trim(),
        password: admin_password,
        email_confirm: true,
      });

      if (authError) {
        return NextResponse.json({ error: 'Failed to create admin account', details: authError.message }, { status: 400 });
      }

      // Create or update user profile with camp_admin role
      const { data: profile, error: profileError } = await supabase.from('users').upsert({
        name: operator_name.trim(),
        phone: operator_phone.startsWith('+91') ? operator_phone.trim() : `+91${operator_phone.replace(/\D/g, '')}`,
        auth_uid: authData.user.id,
        role: 'camp_admin',
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone' }).select().single();

      if (!profileError && profile) {
        admin_user_id = profile.id;
      }
    }

    const { data: camp, error } = await supabase
      .from('camps')
      .insert({
        name: name.trim(),
        operator_name: operator_name.trim(),
        operator_phone: operator_phone.trim(),
        operator_email: operator_email?.trim() || null,
        lat,
        lng,
        radius_km: radius_km || 10,
        helpline_number: helpline_number?.trim() || null,
        camp_code: camp_code?.trim() || null,
        admin_user_id: admin_user_id,
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to create camp', details: error.message }, { status: 500 });
    }

    // Link admin profile to camp
    if (admin_user_id) {
      await supabase.from('users').update({ assigned_camp_id: camp.id }).eq('id', admin_user_id);
    }

    return NextResponse.json({ success: true, camp });
  } catch (err) {
    console.error('[Camps API] Error:', err);
    return NextResponse.json({ error: 'Camp creation failed', details: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const code = searchParams.get('code');

    const supabase = getSupabaseAdmin();

    // Lookup by camp code (for operator login)
    if (code) {
      const { data: camp, error } = await supabase
        .from('camps')
        .select('*')
        .eq('camp_code', code.toUpperCase())
        .single();

      if (error || !camp) {
        return NextResponse.json({ camp: null, error: 'Camp not found with this code' });
      }

      return NextResponse.json({ camp });
    }

    if (id) {
      const { data: camp, error } = await supabase
        .from('camps')
        .select('*')
        .eq('id', id)
        .single();

      if (error || !camp) {
        return NextResponse.json({ error: 'Camp not found' }, { status: 404 });
      }

      // Get victim count
      const { count } = await supabase
        .from('camp_victims')
        .select('id', { count: 'exact', head: true })
        .eq('camp_id', id);

      return NextResponse.json({ camp: { ...camp, victim_count: count || 0 } });
    }

    // List all active camps
    const { data: camps, error } = await supabase
      .from('camps')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch camps', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ camps: camps || [] });
  } catch (err) {
    console.error('[Camps API] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch camps', details: err.message }, { status: 500 });
  }
}
