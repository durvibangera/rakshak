/**
 * FILE: useLocationTracker.js
 * PURPOSE: Track user's GPS location in real-time.
 *          Updates Supabase every 5 minutes or when location changes significantly.
 *
 * USAGE: Import and call useLocationTracker(phone) in any page.
 */

'use client';

import { useEffect, useRef, useCallback } from 'react';
import { supabase } from '@/lib/supabase/client';

const UPDATE_INTERVAL_MS = 5 * 60 * 1000;   // 5 minutes
const MIN_DISTANCE_METERS = 100;              // Only update if moved 100m+

function distanceInMeters(lat1, lon1, lat2, lon2) {
    const R = 6371000;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a = Math.sin(dLat / 2) ** 2 +
        Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useLocationTracker(phone) {
    const lastPos = useRef({ lat: null, lng: null });
    const lastUpdate = useRef(0);

    const updateLocation = useCallback(async (lat, lng) => {
        if (!phone) return;

        const now = Date.now();
        const timeSinceLastUpdate = now - lastUpdate.current;

        // Check if moved enough or enough time passed
        const moved = lastPos.current.lat !== null
            ? distanceInMeters(lastPos.current.lat, lastPos.current.lng, lat, lng)
            : Infinity;

        if (moved < MIN_DISTANCE_METERS && timeSinceLastUpdate < UPDATE_INTERVAL_MS) {
            return; // No significant change
        }

        try {
            const fullPhone = phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`;
            await supabase.from('users').update({
                lat,
                lng,
                updated_at: new Date().toISOString(),
            }).eq('phone', fullPhone);

            lastPos.current = { lat, lng };
            lastUpdate.current = now;
            console.log(`[Location] Updated: ${lat.toFixed(4)}, ${lng.toFixed(4)}`);
        } catch (err) {
            console.error('[Location] Update failed:', err);
        }
    }, [phone]);

    useEffect(() => {
        if (!phone || !navigator.geolocation) return;

        // Watch for position changes (triggers on movement)
        const watchId = navigator.geolocation.watchPosition(
            (pos) => updateLocation(pos.coords.latitude, pos.coords.longitude),
            (err) => console.error('[Location] Watch error:', err),
            { enableHighAccuracy: true, maximumAge: 60000 }
        );

        // Also force-update every 5 minutes even if no movement detected
        const intervalId = setInterval(() => {
            navigator.geolocation.getCurrentPosition(
                (pos) => {
                    lastUpdate.current = 0; // Force update
                    updateLocation(pos.coords.latitude, pos.coords.longitude);
                },
                () => { }
            );
        }, UPDATE_INTERVAL_MS);

        return () => {
            navigator.geolocation.clearWatch(watchId);
            clearInterval(intervalId);
        };
    }, [phone, updateLocation]);
}
