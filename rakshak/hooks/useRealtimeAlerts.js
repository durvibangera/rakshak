/**
 * FILE: useRealtimeAlerts.js
 * PURPOSE: Supabase realtime subscription for live disaster alerts + periodic flood prediction.
 *
 * CONTEXT: When an NGO broadcasts a new alert (flood warning, road block),
 *          all connected clients should instantly see it. This hook subscribes
 *          to the alerts table via Supabase Realtime and updates the local
 *          state. Additionally, it polls the /api/predict endpoint every 30
 *          minutes using the user's geolocation to check for flood risk.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - useRealtimeAlerts: Hook returning live alerts array + prediction data
 *
 * KEY DEPENDENCIES:
 *   - lib/supabase/client.js
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase/client';

const PREDICTION_INTERVAL_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Subscribe to realtime alert updates and periodically check flood predictions.
 * @returns {{
 *   alerts: Array<Object>,
 *   loading: boolean,
 *   error: string|null,
 *   prediction: Object|null,
 *   predictionLoading: boolean
 * }}
 */
export function useRealtimeAlerts() {
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [prediction, setPrediction] = useState(null);
  const [predictionLoading, setPredictionLoading] = useState(false);
  const predictionTimer = useRef(null);

  // ── Fetch prediction from /api/predict ──────────────────────────
  const fetchPrediction = useCallback(async () => {
    if (!navigator.geolocation) return;

    setPredictionLoading(true);

    try {
      const position = await new Promise((resolve, reject) => {
        navigator.geolocation.getCurrentPosition(resolve, reject, {
          enableHighAccuracy: false,
          timeout: 10000,
          maximumAge: 5 * 60 * 1000, // Allow 5-min cached position
        });
      });

      const { latitude, longitude } = position.coords;
      const res = await fetch(`/api/predict?lat=${latitude}&lon=${longitude}`);

      if (res.ok) {
        const data = await res.json();
        setPrediction(data);
      }
    } catch (err) {
      console.warn('[useRealtimeAlerts] Prediction fetch failed:', err.message);
    } finally {
      setPredictionLoading(false);
    }
  }, []);

  useEffect(() => {
    // ── 1. Initial fetch of alerts ──────────────────────────────────
    const fetchAlerts = async () => {
      try {
        const { data, error: fetchError } = await supabase
          .from('alerts')
          .select('*')
          .eq('is_active', true)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;
        setAlerts(data || []);
      } catch (err) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();

    // ── 2. Subscribe to realtime changes ────────────────────────────
    const subscription = supabase
      .channel('alerts-realtime')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'alerts' },
        (payload) => {
          const { eventType, new: newRecord, old: oldRecord } = payload;

          setAlerts((prev) => {
            switch (eventType) {
              case 'INSERT':
                if (newRecord.is_active) {
                  return [newRecord, ...prev];
                }
                return prev;

              case 'UPDATE':
                if (!newRecord.is_active) {
                  // Alert deactivated — remove it
                  return prev.filter((a) => a.id !== newRecord.id);
                }
                // Alert updated — replace it
                return prev.map((a) => (a.id === newRecord.id ? newRecord : a));

              case 'DELETE':
                return prev.filter((a) => a.id !== (oldRecord?.id || newRecord?.id));

              default:
                return prev;
            }
          });
        }
      )
      .subscribe();

    // ── 3. Start periodic flood prediction polling ──────────────────
    fetchPrediction(); // Initial check
    predictionTimer.current = setInterval(fetchPrediction, PREDICTION_INTERVAL_MS);

    // ── Cleanup ─────────────────────────────────────────────────────
    return () => {
      supabase.removeChannel(subscription);
      if (predictionTimer.current) {
        clearInterval(predictionTimer.current);
      }
    };
  }, [fetchPrediction]);

  return { alerts, loading, error, prediction, predictionLoading };
}
