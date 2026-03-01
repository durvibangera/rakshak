/**
 * FILE: route.js (Donations)
 * PURPOSE: Record donations to NGOs, update running totals, auto-trigger production.
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

    const supabase = getSupabaseAdmin();
    let query = supabase
      .from('donations')
      .select('*, ngos(name)')
      .order('donated_at', { ascending: false });

    if (ngo_id) query = query.eq('ngo_id', ngo_id);

    const { data, error } = await query;
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ donations: data || [] });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { ngo_id, donor_name, amount, payment_reference } = body;

    if (!ngo_id || !amount || amount <= 0) {
      return NextResponse.json({ error: 'ngo_id and amount > 0 required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get current NGO state
    const { data: ngo, error: ngoErr } = await supabase
      .from('ngos')
      .select('*')
      .eq('id', ngo_id)
      .single();

    if (ngoErr || !ngo) {
      return NextResponse.json({ error: 'NGO not found' }, { status: 404 });
    }

    const newTotal = parseFloat(ngo.total_raised || 0) + parseFloat(amount);

    // Insert donation
    const { data: donation, error: donErr } = await supabase
      .from('donations')
      .insert({
        ngo_id,
        donor_name: donor_name || 'Anonymous',
        amount,
        payment_reference: payment_reference || null,
        running_total: newTotal,
      })
      .select()
      .single();

    if (donErr) return NextResponse.json({ error: donErr.message }, { status: 500 });

    // Update NGO total_raised
    const ngoUpdates = { total_raised: newTotal, updated_at: new Date().toISOString() };

    // Auto-trigger production if threshold met
    if (newTotal >= parseFloat(ngo.amount_needed || 0) && ngo.status === 'FUNDRAISING') {
      const now = new Date();
      const readyAt = new Date(now.getTime() + 24 * 60 * 60 * 1000); // +24 hours
      ngoUpdates.status = 'PRODUCING';
      ngoUpdates.production_started_at = now.toISOString();
      ngoUpdates.production_ready_at = readyAt.toISOString();
      ngoUpdates.kits_produced = ngo.kits_assigned;
    }

    await supabase.from('ngos').update(ngoUpdates).eq('id', ngo_id);

    return NextResponse.json({
      success: true,
      donation,
      ngo_total_raised: newTotal,
      threshold_met: newTotal >= parseFloat(ngo.amount_needed || 0),
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
