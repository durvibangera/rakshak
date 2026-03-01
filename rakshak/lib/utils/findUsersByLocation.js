/**
 * FILE: findUsersByLocation.js
 * PURPOSE: Query Supabase users table and filter by proximity using Haversine.
 *
 * CONTEXT: When a flood alert is triggered, we need to find all registered
 *          users within a given radius of the danger zone to send them
 *          voice call alerts. Uses the existing haversineDistance function
 *          from distanceCalculator.js.
 *
 * ROLE ACCESS: SERVER-SIDE ONLY
 *
 * EXPORTS:
 *   - findUsersNearby: Find users within a radius of a lat/lon point
 *
 * KEY DEPENDENCIES:
 *   - lib/supabase/admin.js
 *   - lib/utils/distanceCalculator.js
 */

import { supabaseAdmin } from '@/lib/supabase/admin';
import { haversineDistance } from '@/lib/utils/distanceCalculator';

/**
 * Find all users within a given radius (km) of a coordinate.
 * Fetches all users with location data from Supabase, then filters
 * in-memory using the Haversine formula.
 *
 * @param {number} lat - Latitude of the danger zone center
 * @param {number} lon - Longitude of the danger zone center
 * @param {number} [radiusKm=10] - Search radius in kilometers
 * @returns {Promise<Array<{ phone: string, language: string, name: string, state: string, lat: number, lng: number }>>}
 */
export async function findUsersNearby(lat, lon, radiusKm = 10) {
    // Fetch all users who have location and phone data
    const { data: users, error } = await supabaseAdmin
        .from('users')
        .select('id, full_name, phone, language, state, lat, lng')
        .not('phone', 'is', null)
        .not('lat', 'is', null)
        .not('lng', 'is', null);

    if (error) {
        console.error('[findUsersNearby] Supabase query error:', error.message);
        return [];
    }

    if (!users || users.length === 0) {
        console.log('[findUsersNearby] No users with location data found');
        return [];
    }

    // Filter users within the radius using Haversine distance
    const nearbyUsers = users
        .map((user) => {
            const distance = haversineDistance(lat, lon, user.lat, user.lng);
            return { ...user, distance };
        })
        .filter((user) => user.distance <= radiusKm)
        .sort((a, b) => a.distance - b.distance)
        .map((user) => ({
            phone: user.phone,
            language: user.language || 'hi',
            name: user.full_name || 'User',
            state: user.state || '',
            lat: user.lat,
            lng: user.lng,
        }));

    console.log(
        `[findUsersNearby] Found ${nearbyUsers.length} users within ${radiusKm}km of (${lat}, ${lon})`
    );

    return nearbyUsers;
}
