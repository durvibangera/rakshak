/**
 * FILE: route.js (Test Disaster Trigger)
 * PURPOSE: Simulate a disaster at a location, find nearby users from Supabase,
 *          and trigger voice calls to them.
 *
 * USAGE:
 *   GET /api/test-trigger
 *     → Triggers at KJ Somaiya (19.0732, 72.8995) by default
 *
 *   GET /api/test-trigger?lat=19.07&lon=72.89&type=EARTHQUAKE&radius=10
 *     → Custom location, disaster type, and radius
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callUsers } from '@/lib/external/callService';
import { DISASTER_MESSAGES, getLanguagesForUser } from '@/lib/utils/languageSelector';

// Use service role key to bypass RLS
function getSupabaseAdmin() {
    return createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.SUPABASE_SERVICE_ROLE_KEY
    );
}

// Haversine distance in km
function distanceKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function GET(request) {
    try {
        const { searchParams } = new URL(request.url);
        const lat = parseFloat(searchParams.get('lat') || '19.0732');
        const lon = parseFloat(searchParams.get('lon') || '72.8995');
        const disasterType = searchParams.get('type') || 'FLOOD';
        const radiusKm = parseFloat(searchParams.get('radius') || '10');

        console.log(`\n[TEST TRIGGER] Simulating ${disasterType} at ${lat}, ${lon} (radius: ${radiusKm}km)`);

        // ── Step 1: Find nearby users from Supabase ──────────────
        const supabase = getSupabaseAdmin();

        // Query users with lat/lng in a rough bounding box first
        const degOffset = radiusKm / 111; // ~1 degree = 111km
        const { data: users, error: dbError } = await supabase
            .from('users')
            .select('id, name, phone, state, lat, lng')
            .gte('lat', lat - degOffset)
            .lte('lat', lat + degOffset)
            .gte('lng', lon - degOffset)
            .lte('lng', lon + degOffset);

        if (dbError) {
            console.error('[TEST TRIGGER] Supabase error:', dbError);
            return NextResponse.json({ error: 'Database error', details: dbError.message }, { status: 500 });
        }

        // Fine-filter by exact Haversine distance
        const nearbyUsers = (users || []).filter((u) => {
            if (!u.lat || !u.lng) return false;
            const dist = distanceKm(lat, lon, u.lat, u.lng);
            u.distance = Math.round(dist * 100) / 100;
            return dist <= radiusKm;
        });

        console.log(`[TEST TRIGGER] Found ${nearbyUsers.length} users within ${radiusKm}km`);
        nearbyUsers.forEach((u) => {
            console.log(`  → ${u.name} (${u.phone}) — ${u.distance}km away`);
        });

        if (nearbyUsers.length === 0) {
            return NextResponse.json({
                success: false,
                message: `No registered users found within ${radiusKm}km of (${lat}, ${lon}). Register first at /login!`,
                location: { lat, lon },
                disasterType,
                usersFound: 0,
            });
        }

        // ── Step 2: Create alert in Supabase ─────────────────────
        const { data: alert } = await supabase.from('alerts').insert({
            type: disasterType,
            risk: 'HIGH',
            lat,
            lng: lon,
            location_name: `Test Alert — KJ Somaiya Area`,
            description: `Test ${disasterType} alert triggered for ${nearbyUsers.length} nearby users`,
            source: 'test-trigger',
        }).select().single();

        console.log(`[TEST TRIGGER] Alert created: ${alert?.id}`);

        // ── Step 3: Build voice messages ─────────────────────────
        const messages = DISASTER_MESSAGES[disasterType] || DISASTER_MESSAGES.FLOOD;

        // For each user, call with Hindi + their regional language
        const callPromises = nearbyUsers.map(async (user) => {
            const { primary, secondary } = getLanguagesForUser(user.state);
            const voiceMessages = [
                { lang: 'Hindi', langCode: 'hi-IN', text: messages.hi },
            ];
            if (secondary && messages[secondary]) {
                voiceMessages.push({
                    lang: secondary,
                    langCode: `${secondary}-IN`,
                    text: messages[secondary],
                });
            }

            // Log call in Supabase
            await supabase.from('call_logs').insert({
                alert_id: alert?.id,
                user_id: user.id,
                phone: user.phone,
                language: secondary || 'hi',
                disaster_type: disasterType,
            });

            return { user, voiceMessages };
        });

        const callData = await Promise.all(callPromises);

        // ── Step 4: Make voice calls via Twilio ───────────────────
        const allUsers = callData.map((c) => c.user);
        const primaryMessages = callData[0]?.voiceMessages || [
            { lang: 'Hindi', langCode: 'hi-IN', text: messages.hi },
        ];

        const callResult = await callUsers(allUsers, primaryMessages);

        console.log(`[TEST TRIGGER] Calls complete:`, callResult);

        return NextResponse.json({
            success: true,
            location: { lat, lon, name: 'KJ Somaiya Area' },
            disasterType,
            radius: radiusKm,
            usersFound: nearbyUsers.length,
            users: nearbyUsers.map((u) => ({
                name: u.name,
                phone: u.phone.replace(/(\+91)\d{6}/, '$1******'),
                state: u.state,
                distance: `${u.distance}km`,
            })),
            callResult,
            alertId: alert?.id,
        });
    } catch (err) {
        console.error('[TEST TRIGGER] Error:', err);
        return NextResponse.json(
            { error: 'Trigger failed', details: err.message },
            { status: 500 }
        );
    }
}
