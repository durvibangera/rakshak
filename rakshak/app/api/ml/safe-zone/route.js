/**
 * FILE: route.js (ML Safe Zone)
 * PURPOSE: When a camp goes DANGER, predict the best safe zone for migration.
 * Uses distance + capacity scoring to rank nearby safe zones.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/** Haversine distance in km */
function haversineKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function POST(request) {
  try {
    const { camp_id, danger_reason = 'Flooding' } = await request.json();

    if (!camp_id) {
      return NextResponse.json({ error: 'camp_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Get camp details
    const { data: camp, error: campErr } = await supabase
      .from('camps')
      .select('*')
      .eq('id', camp_id)
      .single();

    if (campErr || !camp) {
      return NextResponse.json({ error: 'Camp not found' }, { status: 404 });
    }

    // Get camp headcount
    const { count: headcount } = await supabase
      .from('camp_victims')
      .select('*', { count: 'exact', head: true })
      .eq('camp_id', camp_id);

    // Get all safe zones
    const { data: zones, error: zoneErr } = await supabase
      .from('safe_zones')
      .select('*')
      .eq('is_safe', true);

    if (zoneErr || !zones?.length) {
      return NextResponse.json({ error: 'No safe zones available' }, { status: 404 });
    }

    // Score each zone: lower distance + higher available capacity = better
    const scored = zones.map((z) => {
      const distance_km = haversineKm(camp.lat, camp.lng, z.lat, z.lng);
      const available_capacity = z.capacity - (z.current_occupancy || 0);
      const canFit = available_capacity >= (headcount || 0);

      // Scoring: closer is better (max 50pts), more capacity is better (max 50pts)
      const distScore = Math.max(0, 50 - distance_km * 5); // 0-50
      const capScore = Math.min(50, (available_capacity / Math.max(headcount || 1, 1)) * 25); // 0-50
      const fitBonus = canFit ? 20 : 0;
      const score = distScore + capScore + fitBonus;

      return {
        zone_id: z.id,
        name: z.name,
        zone_type: z.zone_type,
        area: z.area,
        lat: z.lat,
        lng: z.lng,
        distance_km: Math.round(distance_km * 100) / 100,
        capacity: z.capacity,
        current_occupancy: z.current_occupancy || 0,
        available_capacity,
        can_fit_all: canFit,
        facilities: z.facilities || [],
        score: Math.round(score * 10) / 10,
      };
    });

    // Sort by score descending
    scored.sort((a, b) => b.score - a.score);

    return NextResponse.json({
      camp_id,
      camp_name: camp.name,
      camp_headcount: headcount || 0,
      danger_reason,
      recommended_zone: scored[0] || null,
      all_options: scored.slice(0, 10),
    });
  } catch (err) {
    console.error('[ML SafeZone] Error:', err);
    return NextResponse.json({ error: 'Safe zone prediction failed', details: err.message }, { status: 500 });
  }
}
