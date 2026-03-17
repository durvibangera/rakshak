/**
 * FILE: route.js (Kit Responses)
 * PURPOSE: NGOs respond to kit requests, Super Admin approves/rejects responses
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
    const request_id = searchParams.get('request_id');
    const ngo_id = searchParams.get('ngo_id');

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('kit_responses')
      .select(`
        *,
        kit_requests(
          id, kits_requested, urgency, reason, deadline, status,
          ngos(name)
        ),
        ngos(name, contact_email)
      `)
      .order('created_at', { ascending: false });

    if (request_id) query = query.eq('request_id', request_id);
    if (ngo_id) query = query.eq('ngo_id', ngo_id);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    
    return NextResponse.json({ responses: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { request_id, ngo_id, kits_offered, estimated_delivery_days, cost_per_kit, notes } = body;

    if (!request_id || !ngo_id || kits_offered < 0) {
      return NextResponse.json({ 
        error: 'request_id, ngo_id, and kits_offered >= 0 required' 
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Check if request exists and is still pending
    const { data: kitRequest, error: reqError } = await supabase
      .from('kit_requests')
      .select('*')
      .eq('id', request_id)
      .eq('status', 'PENDING')
      .single();

    if (reqError || !kitRequest) {
      return NextResponse.json({ 
        error: 'Kit request not found or no longer pending' 
      }, { status: 404 });
    }

    // Create response
    const { data, error } = await supabase
      .from('kit_responses')
      .insert({
        request_id,
        ngo_id,
        kits_offered,
        estimated_delivery_days: estimated_delivery_days || null,
        cost_per_kit: cost_per_kit || null,
        notes: notes || null,
        status: 'PENDING'
      })
      .select(`
        *,
        kit_requests(kits_requested, urgency, reason),
        ngos(name)
      `)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Update request status to ACCEPTED if NGO offered something
    if (kits_offered > 0) {
      await supabase
        .from('kit_requests')
        .update({ status: 'ACCEPTED' })
        .eq('id', request_id);
    }

    return NextResponse.json({ success: true, response: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const body = await request.json();
    const { id, status, ...updates } = body;

    if (!id || !status) {
      return NextResponse.json({ error: 'Response id and status required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('kit_responses')
      .update({ status, ...updates })
      .eq('id', id)
      .select(`
        *,
        kit_requests(id, kits_requested),
        ngos(name)
      `)
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // If approved, update request status to FULFILLED
    if (status === 'APPROVED') {
      await supabase
        .from('kit_requests')
        .update({ status: 'FULFILLED' })
        .eq('id', data.request_id);
    }

    return NextResponse.json({ success: true, response: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}