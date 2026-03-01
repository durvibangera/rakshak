/**
 * FILE: route.js (Kit Inventory)
 * PURPOSE: Track kit inventory — IN (from NGOs) and OUT (dispatches).
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

    // Get all events
    const { data: events, error } = await supabase
      .from('kit_inventory')
      .select('*, ngos(name), camps(name)')
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });

    // Get current balance (latest event)
    const balance = events?.[0]?.balance_after ?? 0;

    // Totals
    const total_in = (events || []).filter(e => e.event_type === 'IN').reduce((s, e) => s + e.kits, 0);
    const total_out = (events || []).filter(e => e.event_type === 'OUT').reduce((s, e) => s + e.kits, 0);

    return NextResponse.json({
      balance,
      total_in,
      total_out,
      events: events || [],
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { event_type, kits, source_ngo_id, destination_camp_id, notes } = body;

    if (!event_type || !kits || kits <= 0) {
      return NextResponse.json({ error: 'event_type and kits > 0 required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get current balance
    const { data: lastEvent } = await supabase
      .from('kit_inventory')
      .select('balance_after')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    const currentBalance = lastEvent?.balance_after ?? 0;
    const newBalance = event_type === 'IN' ? currentBalance + kits : Math.max(0, currentBalance - kits);

    const { data, error } = await supabase
      .from('kit_inventory')
      .insert({
        event_type,
        kits,
        source_ngo_id: source_ngo_id || null,
        destination_camp_id: destination_camp_id || null,
        balance_after: newBalance,
        notes: notes || null,
      })
      .select()
      .single();

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ success: true, event: data, balance: newBalance });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
