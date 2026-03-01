/**
 * POST /api/camp-preparedness-alert
 *
 * When flood levels rise at a place that already has an evacuation centre (camp),
 * call this to create a camp_alert so admin/super admin see:
 * "Evacuate - you're going into danger. Approve to send preparedness calls to everyone registered in this camp."
 *
 * Only after they approve (via /api/alerts/approve) will Twilio calls go out
 * to everyone in camp_victims with the preparedness message (get ready with essentials, evac centre moving).
 *
 * Body: { camp_id, lat?, lng?, location_name? }
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
    const body = await request.json().catch(() => ({}));
    const { camp_id, lat, lng, location_name } = body;

    if (!camp_id) {
      return NextResponse.json({ error: 'camp_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const { data: camp, error: campError } = await supabase
      .from('camps')
      .select('id, name, lat, lng')
      .eq('id', camp_id)
      .single();

    if (campError || !camp) {
      return NextResponse.json({ error: 'Camp not found' }, { status: 404 });
    }

    const { data: alert, error: insertError } = await supabase
      .from('camp_alerts')
      .insert({
        camp_id: camp.id,
        disaster_type: 'FLOOD',
        severity: 'HIGH',
        lat: lat ?? camp.lat,
        lng: lng ?? camp.lng,
        location_name: location_name || camp.name,
        description: 'PREPAREDNESS: Flood levels rising at evacuation centre. Evacuate - area going into danger. Approve to send preparedness calls to all registered in this camp.',
        status: 'pending',
      })
      .select()
      .single();

    if (insertError) {
      return NextResponse.json(
        { error: 'Failed to create preparedness alert', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Preparedness alert created. Admin/Super Admin will see it; calls go only after approval.',
      alert_id: alert.id,
      camp_id: camp.id,
      camp_name: camp.name,
    });
  } catch (err) {
    console.error('[CampPreparednessAlert] Error:', err);
    return NextResponse.json(
      { error: 'Failed to create alert', details: err.message },
      { status: 500 }
    );
  }
}
