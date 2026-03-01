/**
 * FILE: CampMap.js
 * PURPOSE: MapLibre GL JS map showing all relief camps with status-colored markers.
 *
 * CONTEXT: The core map component used by both victims (find nearest camp) and
 *          NGOs (bird's-eye overview). Shows camp pins colored by status:
 *          green (OPEN), orange (NEARLY_FULL), red (FULL). Victims can tap
 *          a pin to see camp details and navigate. NGOs see additional resource data.
 *          Uses free OpenStreetMap tiles via MapLibre — no API key required.
 *          Supports offline rendering with cached tiles.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - CampMap: React component
 *
 * KEY DEPENDENCIES:
 *   - maplibre-gl
 *   - hooks/useRealtimeCamps.js
 *   - components/map/CampMarkerPopup.js
 *   - components/map/DangerZoneLayer.js
 */

'use client';

import { useEffect, useRef, useState } from 'react';
import DangerZoneLayer from './DangerZoneLayer';
import { useRealtimeAlerts } from '@/hooks/useRealtimeAlerts';

// Status → marker color
const STATUS_COLORS = {
  OPEN: '#22c55e',
  NEARLY_FULL: '#f97316',
  FULL: '#ef4444',
  CLOSED: '#6b7280',
};

// Default center: Pune, India
const DEFAULT_CENTER = [73.8567, 18.5204];
const DEFAULT_ZOOM = 11;

export default function CampMap({ camps = [], userLocation = null, showResources = false }) {
  const mapContainer = useRef(null);
  const mapRef = useRef(null);
  const markersRef = useRef([]);
  const [mapReady, setMapReady] = useState(false);
  const { alerts } = useRealtimeAlerts();

  // Get flood alerts for danger zones
  const dangerZones = alerts.filter(
    (a) => a.type === 'FLOOD' && a.severity === 'HIGH' && a.is_active
  );

  // ── Initialize MapLibre map ────────────────────────────────────
  useEffect(() => {
    if (!mapContainer.current || mapRef.current) return;

    let maplibregl;
    const initMap = async () => {
      maplibregl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');

      const map = new maplibregl.Map({
        container: mapContainer.current,
        // Free OpenStreetMap raster tiles — works offline with cached tiles
        style: {
          version: 8,
          sources: {
            'osm-tiles': {
              type: 'raster',
              tiles: [
                'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
              ],
              tileSize: 256,
              attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
              maxzoom: 19,
            },
          },
          layers: [
            {
              id: 'osm-tiles-layer',
              type: 'raster',
              source: 'osm-tiles',
              minzoom: 0,
              maxzoom: 19,
            },
          ],
        },
        center: userLocation
          ? [userLocation.lng, userLocation.lat]
          : DEFAULT_CENTER,
        zoom: DEFAULT_ZOOM,
      });

      // Add navigation controls
      map.addControl(new maplibregl.NavigationControl(), 'top-right');

      // Add user location marker
      if (userLocation) {
        new maplibregl.Marker({ color: '#3b82f6' })
          .setLngLat([userLocation.lng, userLocation.lat])
          .setPopup(
            new maplibregl.Popup({ offset: 25 }).setHTML(
              '<div style="color:#1f2937;font-weight:bold;">📍 You are here</div>'
            )
          )
          .addTo(map);
      }

      map.on('load', () => {
        setMapReady(true);
      });

      mapRef.current = map;
    };

    initMap();

    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
        setMapReady(false);
      }
    };
  }, [userLocation]);

  // ── Add/update camp markers ────────────────────────────────────
  useEffect(() => {
    if (!mapRef.current || !mapReady) return;

    const addMarkers = async () => {
      const maplibregl = (await import('maplibre-gl')).default;

      // Clear existing markers
      markersRef.current.forEach((m) => m.remove());
      markersRef.current = [];

      camps.forEach((camp) => {
        if (!camp.lat || !camp.lng) return;

        const color = STATUS_COLORS[camp.status] || STATUS_COLORS.OPEN;

        const popupHtml = `
          <div style="color:#1f2937;min-width:180px;font-family:system-ui,sans-serif;">
            <h3 style="font-weight:700;font-size:14px;margin:0 0 4px;">${camp.name || 'Camp'}</h3>
            <p style="font-size:12px;margin:2px 0;color:#6b7280;">
              Status: <span style="color:${color};font-weight:600;">${camp.status || 'Unknown'}</span>
            </p>
            <p style="font-size:12px;margin:2px 0;color:#6b7280;">
              ${camp.current_count || 0} / ${camp.capacity || 0} people
            </p>
            ${showResources ? `
            <hr style="margin:6px 0;border-color:#e5e7eb;"/>
            <p style="font-size:11px;color:#6b7280;">
              🍚 Food: ${camp.food_packets || 0} &nbsp; 💧 Water: ${camp.water_liters || 0}L
            </p>` : ''}
            <button onclick="window.open('https://www.google.com/maps/dir/?api=1&destination=${camp.lat},${camp.lng}','_blank')"
              style="margin-top:8px;width:100%;padding:6px;background:#3b82f6;color:white;border:none;border-radius:6px;font-size:12px;font-weight:600;cursor:pointer;">
              🧭 Navigate
            </button>
          </div>
        `;

        const marker = new maplibregl.Marker({ color })
          .setLngLat([camp.lng, camp.lat])
          .setPopup(new maplibregl.Popup({ offset: 25 }).setHTML(popupHtml))
          .addTo(mapRef.current);

        markersRef.current.push(marker);
      });
    };

    addMarkers();
  }, [camps, mapReady, showResources]);

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <div
        ref={mapContainer}
        style={{
          width: '100%',
          height: '500px',
          borderRadius: '12px',
          overflow: 'hidden',
        }}
      />
      {/* Render danger zone overlays */}
      {mapReady && mapRef.current && (
        <DangerZoneLayer map={mapRef.current} dangerZones={dangerZones} />
      )}
    </div>
  );
}
