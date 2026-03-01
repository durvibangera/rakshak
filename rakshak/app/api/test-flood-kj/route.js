/**
 * TEST API: Flood at KJ Somaiya — call everyone nearby in Hindi + Marathi.
 * For testing evacuation calls in Maharashtra.
 *
 * GET /api/test-flood-kj
 *   → Flood at KJ (19.0732, 72.8995), radius 10km, Hindi + Marathi
 *
 * GET /api/test-flood-kj?radius=15
 *   → Same, but 15km radius
 *
 * GET /api/test-flood-kj?includeMaharashtra=1
 *   → Also include all users with state Maharashtra + phone (even without lat/lng) for testing
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callUsers } from '@/lib/external/callService';
import { FLOOD_MESSAGES, LANGUAGE_CODES } from '@/lib/utils/languageSelector';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function distanceKm(lat1, lon1, lat2, lon2) {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// KJ Somaiya coordinates (Maharashtra)
const KJ_LAT = 19.0732;
const KJ_LON = 72.8995;

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const radiusKm = parseFloat(searchParams.get('radius') || '10');
    const includeMaharashtra = searchParams.get('includeMaharashtra') === '1';

    const supabase = getSupabaseAdmin();

    let nearbyUsers = [];

    // 1) Find users with lat/lng within radius of KJ
    const degOffset = radiusKm / 111;
    const { data: usersWithLocation } = await supabase
      .from('users')
      .select('id, name, phone, state, lat, lng')
      .not('phone', 'is', null)
      .gte('lat', KJ_LAT - degOffset)
      .lte('lat', KJ_LAT + degOffset)
      .gte('lng', KJ_LON - degOffset)
      .lte('lng', KJ_LON + degOffset);

    if (usersWithLocation?.length) {
      nearbyUsers = usersWithLocation.filter((u) => {
        if (!u.lat || !u.lng) return false;
        const dist = distanceKm(KJ_LAT, KJ_LON, u.lat, u.lng);
        u.distance = Math.round(dist * 100) / 100;
        return dist <= radiusKm;
      });
    }

    // 2) For testing: if no one in radius, optionally add Maharashtra users with phone
    if (includeMaharashtra && nearbyUsers.length === 0) {
      const { data: mhUsers } = await supabase
        .from('users')
        .select('id, name, phone, state, lat, lng')
        .not('phone', 'is', null)
        .ilike('state', '%maharashtra%')
        .limit(20);
      if (mhUsers?.length) {
        nearbyUsers = mhUsers.map((u) => ({ ...u, distance: null }));
      }
    }

    if (nearbyUsers.length === 0) {
      return NextResponse.json({
        success: false,
        message: `No users with phone found within ${radiusKm}km of KJ Somaiya. Register users with lat/lng near (19.07, 72.90) or call with ?includeMaharashtra=1 to include Maharashtra users for testing.`,
        location: { lat: KJ_LAT, lon: KJ_LON, name: 'KJ Somaiya' },
        usersFound: 0,
      });
    }

    // Create alert
    const { data: alert } = await supabase
      .from('alerts')
      .insert({
        type: 'FLOOD',
        risk: 'HIGH',
        lat: KJ_LAT,
        lng: KJ_LON,
        location_name: 'KJ Somaiya — Flood Alert',
        description: `Test flood alert at KJ Somaiya. Calls in Hindi + Marathi to ${nearbyUsers.length} user(s).`,
        source: 'test-flood-kj',
      })
      .select()
      .single();

    // Hindi + Marathi messages for everyone (Maharashtra)
    const voiceMessages = [
      { lang: 'Hindi', langCode: LANGUAGE_CODES.hi, text: FLOOD_MESSAGES.hi },
      { lang: 'Marathi', langCode: LANGUAGE_CODES.mr, text: FLOOD_MESSAGES.mr },
    ];

    // Log and call
    for (const user of nearbyUsers) {
      await supabase.from('call_logs').insert({
        alert_id: alert?.id,
        user_id: user.id,
        phone: user.phone,
        language: 'hi,mr',
        disaster_type: 'FLOOD',
      });
    }

    const callResult = await callUsers(nearbyUsers, voiceMessages);

    return NextResponse.json({
      success: true,
      message: 'Flood alert at KJ Somaiya — calls in Hindi + Marathi',
      location: { lat: KJ_LAT, lon: KJ_LON, name: 'KJ Somaiya' },
      disasterType: 'FLOOD',
      radiusKm,
      usersFound: nearbyUsers.length,
      users: nearbyUsers.map((u) => ({
        name: u.name,
        phone: u.phone?.replace(/(\+91)\d{6}/, '$1******'),
        state: u.state,
        distance: u.distance != null ? `${u.distance}km` : '—',
      })),
      callResult,
      alertId: alert?.id,
    });
  } catch (err) {
    console.error('[Test Flood KJ] Error:', err);
    return NextResponse.json(
      { error: 'Trigger failed', details: err.message },
      { status: 500 }
    );
  }
}
