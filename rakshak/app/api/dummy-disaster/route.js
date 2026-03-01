import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const DUMMY_SCENARIOS = {
  FLOOD: {
    description: 'Heavy rainfall detected — river levels rising rapidly. Flash flood warning issued.',
    severity: 'HIGH',
  },
  EARTHQUAKE: {
    description: 'Seismic activity detected — magnitude 5.2 tremor recorded nearby.',
    severity: 'HIGH',
  },
  LANDSLIDE: {
    description: 'Continuous heavy rainfall in hilly terrain — landslide risk elevated.',
    severity: 'HIGH',
  },
  CYCLONE: {
    description: 'Cyclonic storm approaching coastal area — wind speeds exceeding 120 km/h.',
    severity: 'HIGH',
  },
};

export async function POST(request) {
  try {
    const { camp_id, disaster_type, severity } = await request.json();

    if (!camp_id) {
      return NextResponse.json({ error: 'camp_id is required' }, { status: 400 });
    }

    const type = disaster_type || 'FLOOD';
    const scenario = DUMMY_SCENARIOS[type] || DUMMY_SCENARIOS.FLOOD;

    const supabase = getSupabaseAdmin();

    // Get camp location
    const { data: camp, error: campError } = await supabase
      .from('camps')
      .select('lat, lng, name')
      .eq('id', camp_id)
      .single();

    if (campError || !camp) {
      return NextResponse.json({ error: 'Camp not found' }, { status: 404 });
    }

    // Create camp alert with pending status
    const { data: alert, error: alertError } = await supabase
      .from('camp_alerts')
      .insert({
        camp_id,
        disaster_type: type,
        severity: severity || scenario.severity,
        lat: camp.lat,
        lng: camp.lng,
        location_name: camp.name,
        description: scenario.description,
        status: 'pending',
      })
      .select()
      .single();

    if (alertError) {
      return NextResponse.json({ error: 'Failed to create alert', details: alertError.message }, { status: 500 });
    }

    return NextResponse.json({
      success: true,
      alert,
      message: `Dummy ${type} disaster triggered for camp "${camp.name}". Alert is pending approval.`,
    });
  } catch (err) {
    console.error('[DummyDisaster] Error:', err);
    return NextResponse.json({ error: 'Failed to trigger dummy disaster', details: err.message }, { status: 500 });
  }
}
