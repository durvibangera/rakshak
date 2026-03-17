/**
 * FILE: route.js (Kit Requests)
 * PURPOSE: Super Admin creates kit requests to NGOs, NGOs respond with availability
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
    const ngo_id = searchParams.get('ngo_id');
    const status = searchParams.get('status');

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('kit_requests')
      .select(`
        *,
        ngos(name, contact_email),
        kit_responses(
          id, kits_offered, estimated_delivery_days, 
          cost_per_kit, notes, status, created_at
        )
      `)
      .order('created_at', { ascending: false });

    if (ngo_id) query = query.eq('ngo_id', ngo_id);
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
    const { ngo_id, kits_requested, urgency, reason, deadline_hours } = body;

    if (!ngo_id || !kits_requested || kits_requested <= 0) {
      return NextResponse.json({ 
        error: 'ngo_id and kits_requested > 0 required' 
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    
    // Calculate deadline if provided
    let deadline = null;
    if (deadline_hours && deadline_hours > 0) {
      deadline = new Date(Date.now() + deadline_hours * 60 * 60 * 1000).toISOString();
    }

    const { data, error } = await supabase
      .from('kit_requests')
      .insert({
        ngo_id,
        kits_requested,
        urgency: urgency || 'NORMAL',
        reason: reason || null,
        deadline,
        status: 'PENDING'
      })
      .select(`
        *,
        ngos(name, contact_email)
      `)
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
    const { id, status, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Request id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('kit_requests')
      .update({ status, ...updates })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, request: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}