/**
 * FILE: route.js (Kit Response Approval)
 * PURPOSE: Super Admin approves NGO responses and adds kits to inventory
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
    const { response_id, action } = body; // action: 'approve' or 'reject'

    if (!response_id || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ 
        error: 'response_id and action (approve/reject) required' 
      }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get the response details
    const { data: response, error: responseError } = await supabase
      .from('kit_responses')
      .select(`
        *,
        kit_requests(id, kits_requested, status),
        ngos(name)
      `)
      .eq('id', response_id)
      .single();

    if (responseError || !response) {
      return NextResponse.json({ error: 'Response not found' }, { status: 404 });
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED';

    // Update response status
    await supabase
      .from('kit_responses')
      .update({ status: newStatus })
      .eq('id', response_id);

    let inventoryEvent = null;

    if (action === 'approve' && response.kits_offered > 0) {
      // Add kits to inventory
      const { data: lastEvent } = await supabase
        .from('kit_inventory')
        .select('balance_after')
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const currentBalance = lastEvent?.balance_after ?? 0;
      const newBalance = currentBalance + response.kits_offered;

      const { data: invEvent, error: invError } = await supabase
        .from('kit_inventory')
        .insert({
          event_type: 'IN',
          kits: response.kits_offered,
          source_ngo_id: response.ngo_id,
          balance_after: newBalance,
          notes: `Approved response: ${response.kits_offered} kits from ${response.ngos?.name || 'NGO'}`
        })
        .select()
        .single();

      if (invError) {
        console.error('Failed to add to inventory:', invError);
      } else {
        inventoryEvent = invEvent;
      }

      // Update request status to FULFILLED
      await supabase
        .from('kit_requests')
        .update({ status: 'FULFILLED' })
        .eq('id', response.request_id);
    }

    return NextResponse.json({ 
      success: true, 
      response: { ...response, status: newStatus },
      inventory_added: inventoryEvent ? response.kits_offered : 0
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}