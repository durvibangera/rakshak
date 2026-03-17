/**
 * FILE: route.js (Dispatch Orders)
 * PURPOSE: List and confirm receipt of kit dispatch orders for a camp.
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
    const round_id = searchParams.get('round_id');

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('kit_dispatch_orders')
      .select('*, camps(name), kit_allocation_rounds(round_number, created_at)')
      .order('dispatched_at', { ascending: false });

    if (camp_id) query = query.eq('camp_id', camp_id);
    if (round_id) query = query.eq('round_id', round_id);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ dispatches: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function PATCH(request) {
  try {
    const { id } = await request.json();
    if (!id) return NextResponse.json({ error: 'dispatch order id required' }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from('kit_dispatch_orders')
      .update({ received_at: new Date().toISOString() })
      .eq('id', id)
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, dispatch: data });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
