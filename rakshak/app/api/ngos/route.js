/**
 * FILE: route.js (NGOs)
 * PURPOSE: CRUD for NGO management — register, list, update status, assign kits.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('ngos')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ ngos: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, contact_phone, contact_email, cost_per_kit, campaign_url } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'NGO name is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('ngos')
      .insert({
        name: name.trim(),
        contact_phone: contact_phone || null,
        contact_email: contact_email || null,
        cost_per_kit: cost_per_kit || 120.0,
        campaign_url: campaign_url || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, ngo: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'NGO id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('ngos')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, ngo: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
