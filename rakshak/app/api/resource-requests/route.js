/**
 * FILE: route.js (Resource Requests)
 * PURPOSE: CRUD for camp resource requests to Super Admin.
 */
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
    const camp_id = searchParams.get('camp_id');
    const status = searchParams.get('status');

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('resource_requests')
      .select('*, camps(name, lat, lng), users!resource_requests_requested_by_fkey(name)')
      .order('created_at', { ascending: false });

    if (camp_id) query = query.eq('camp_id', camp_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    return NextResponse.json({ requests: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { camp_id, requested_by, min_kits_needed, current_headcount, notes } = body;

    if (!camp_id || !min_kits_needed) {
      return NextResponse.json({ error: 'camp_id and min_kits_needed required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('resource_requests')
      .insert({
        camp_id,
        requested_by: requested_by || null,
        min_kits_needed,
        current_headcount: current_headcount || 0,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, request: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, status, reviewed_by } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'id and status required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('resource_requests')
      .update({
        status,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewed_by || null,
      })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, request: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
