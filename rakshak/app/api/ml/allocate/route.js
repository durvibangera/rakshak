/**
 * FILE: route.js (ML Allocate)
 * PURPOSE: Run smart kit allocation across all camps using ML predictions.
 * Distributes kits proportionally based on effective demand with reserve buffer.
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
    const body = await request.json();
    const {
      camps = [],
      total_kits_available = 0,
      beta = 0.7,
      buffer_pct = 0.15,
      disaster_id = null,
      triggered_by = 'manual',
    } = body;

    console.log('[ML Allocate] Received request:', { camps_count: camps.length, total_kits_available, beta, buffer_pct });
    console.log('[ML Allocate] First 3 camps:', camps.slice(0, 3));

    if (!camps.length || total_kits_available <= 0) {
      console.error('[ML Allocate] Validation failed:', { camps_length: camps.length, total_kits_available });
      return NextResponse.json(
        { error: 'camps array and total_kits_available > 0 required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();

    // Hold reserve buffer
    const reserve_kits = Math.floor(total_kits_available * buffer_pct);
    const distributable = total_kits_available - reserve_kits;

    // Calculate effective demand for each camp
    const campsWithDemand = camps.map((c) => {
      const current = c.current_headcount || 0;
      const predicted = c.predicted_headcount || current;
      const effective_demand = current + beta * (predicted - current);
      return { ...c, effective_demand: Math.max(0, effective_demand) };
    });

    const totalDemand = campsWithDemand.reduce((s, c) => s + c.effective_demand, 0);

    // Proportional allocation
    const allocations = campsWithDemand.map((c) => {
      const share = totalDemand > 0 ? c.effective_demand / totalDemand : 1 / camps.length;
      const kits_allocated = Math.floor(distributable * share);
      const kits_per_person_now = c.current_headcount > 0 ? kits_allocated / c.current_headcount : 0;
      const kits_per_person_at_delivery = (c.predicted_headcount || c.current_headcount) > 0
        ? kits_allocated / (c.predicted_headcount || c.current_headcount) : 0;

      let urgency = 'OK';
      if (kits_per_person_at_delivery < 0.5) urgency = 'CRITICAL';
      else if (kits_per_person_at_delivery < 0.8) urgency = 'LOW';

      return {
        camp_id: c.camp_id,
        camp_name: c.camp_name || '',
        current_headcount: c.current_headcount || 0,
        predicted_headcount: c.predicted_headcount || c.current_headcount || 0,
        effective_demand: Math.round(c.effective_demand * 10) / 10,
        camp_phase: c.phase_name || 'PLATEAU',
        alert_risk: c.alert_risk || 'MEDIUM',
        kits_allocated,
        kits_per_person_now: Math.round(kits_per_person_now * 100) / 100,
        kits_per_person_at_delivery: Math.round(kits_per_person_at_delivery * 100) / 100,
        urgency,
      };
    });

    const total_dispatched = allocations.reduce((s, a) => s + a.kits_allocated, 0);

    console.log('[ML Allocate] Calculated allocations:', { total_dispatched, allocations_count: allocations.length });
    console.log('[ML Allocate] Top 3 allocations:', allocations.slice(0, 3).map(a => ({ camp: a.camp_name, kits: a.kits_allocated, urgency: a.urgency })));

    // Get next round number
    const { count } = await supabase
      .from('kit_allocation_rounds')
      .select('*', { count: 'exact', head: true });
    const round_number = (count || 0) + 1;

    console.log('[ML Allocate] Inserting round:', { round_number, total_kits_available, total_dispatched, camps_count: camps.length });

    // Write allocation round
    const { data: round, error: roundErr } = await supabase
      .from('kit_allocation_rounds')
      .insert({
        round_number,
        disaster_id,
        total_kits_available,
        total_kits_dispatched: total_dispatched,
        camps_count: camps.length,
        reserve_kits,
        buffer_pct,
        beta_weight: beta,
        triggered_by,
      })
      .select()
      .single();

    if (roundErr) {
      console.error('[ML Allocate] Round insert failed:', roundErr);
      return NextResponse.json({ error: 'Failed to save allocation round', details: roundErr.message }, { status: 500 });
    }

    console.log('[ML Allocate] Round saved:', round.id);

    // Write dispatch orders
    const dispatchRows = allocations.map((a) => ({
      round_id: round.id,
      camp_id: a.camp_id,
      current_headcount: a.current_headcount,
      predicted_headcount: a.predicted_headcount,
      effective_demand: a.effective_demand,
      camp_phase: a.camp_phase,
      alert_risk: a.alert_risk,
      kits_allocated: a.kits_allocated,
      kits_per_person_now: a.kits_per_person_now,
      kits_per_person_at_delivery: a.kits_per_person_at_delivery,
      urgency: a.urgency,
    }));

    await supabase.from('kit_dispatch_orders').insert(dispatchRows);

    // Write inventory OUT events
    // Get current balance
    const { data: lastInv } = await supabase
      .from('kit_inventory')
      .select('balance_after')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    let runningBalance = lastInv?.balance_after ?? total_kits_available;

    const inventoryRows = allocations
      .filter((a) => a.kits_allocated > 0)
      .map((a) => {
        runningBalance -= a.kits_allocated;
        return {
          event_type: 'OUT',
          kits: a.kits_allocated,
          destination_camp_id: a.camp_id,
          allocation_round_id: round.id,
          balance_after: Math.max(0, runningBalance),
          notes: `Allocation round #${round_number} dispatch`,
        };
      });

    if (inventoryRows.length > 0) {
      const { error: invErr } = await supabase.from('kit_inventory').insert(inventoryRows);
      if (invErr) console.error('[ML Allocate] Inventory insert failed:', invErr);
    }

    console.log('[ML Allocate] Success! Returning result');

    return NextResponse.json({
      success: true,
      round_id: round.id,
      round_number,
      total_kits_available,
      total_kits_dispatched: total_dispatched,
      reserve_kits,
      allocations,
    });
  } catch (err) {
    console.error('[ML Allocate] Error:', err);
    return NextResponse.json({ error: 'Allocation failed', details: err.message }, { status: 500 });
  }
}
