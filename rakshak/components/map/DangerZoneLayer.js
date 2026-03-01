/**
 * FILE: DangerZoneLayer.js
 * PURPOSE: Red overlay layer for flood zones and danger areas on the Mapbox map.
 *
 * CONTEXT: During floods, certain areas are submerged or dangerous. This component
 *          renders semi-transparent red circles over danger zones on the Mapbox map.
 *          For HIGH risk flood zones, it shows a 5km radius red circle. For MEDIUM,
 *          a 3km orange circle. The routing algorithm avoids these zones.
 *
 * ROLE ACCESS: BOTH
 *
 * EXPORTS:
 *   - DangerZoneLayer: React component (used as child of CampMap)
 *
 * KEY DEPENDENCIES:
 *   - maplibre-gl
 *   - hooks/useRealtimeAlerts.js
 */

'use client';

import { useEffect, useRef } from 'react';

const SEVERITY_COLORS = {
  HIGH: { fill: 'rgba(220, 38, 38, 0.25)', border: 'rgba(220, 38, 38, 0.7)', radiusKm: 5 },
  MEDIUM: { fill: 'rgba(249, 115, 22, 0.2)', border: 'rgba(249, 115, 22, 0.6)', radiusKm: 3 },
  LOW: { fill: 'rgba(234, 179, 8, 0.15)', border: 'rgba(234, 179, 8, 0.5)', radiusKm: 2 },
};

/**
 * Generate a GeoJSON circle polygon for a given center and radius.
 * Uses 64 points to approximate a circle on the Earth's surface.
 *
 * @param {number} lat - Center latitude
 * @param {number} lng - Center longitude
 * @param {number} radiusKm - Radius in kilometers
 * @returns {Object} GeoJSON Polygon Feature
 */
function createCircleGeoJSON(lat, lng, radiusKm) {
  const points = 64;
  const coords = [];
  const earthRadiusKm = 6371;

  for (let i = 0; i <= points; i++) {
    const angle = (i / points) * 2 * Math.PI;
    const dLat = (radiusKm / earthRadiusKm) * (180 / Math.PI);
    const dLng =
      (radiusKm / (earthRadiusKm * Math.cos((lat * Math.PI) / 180))) *
      (180 / Math.PI);

    coords.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
  }

  return {
    type: 'Feature',
    geometry: {
      type: 'Polygon',
      coordinates: [coords],
    },
  };
}

export default function DangerZoneLayer({ map = null, dangerZones = [] }) {
  const addedLayers = useRef(new Set());

  useEffect(() => {
    if (!map || !dangerZones || dangerZones.length === 0) return;

    // Wait for map style to load
    const addZones = () => {
      dangerZones.forEach((zone, index) => {
        const sourceId = `danger-zone-source-${index}`;
        const fillLayerId = `danger-zone-fill-${index}`;
        const borderLayerId = `danger-zone-border-${index}`;

        // Skip if already added
        if (addedLayers.current.has(sourceId)) return;

        // Parse zone data
        let lat, lng, severity;
        try {
          const area =
            typeof zone.affected_area === 'string'
              ? JSON.parse(zone.affected_area)
              : zone.affected_area;
          lat = area?.lat;
          lng = area?.lon || area?.lng;
          severity = (zone.severity || 'MEDIUM').toUpperCase();
        } catch {
          return; // Skip invalid zones
        }

        if (!lat || !lng) return;

        const colors = SEVERITY_COLORS[severity] || SEVERITY_COLORS.MEDIUM;
        const circleGeoJSON = createCircleGeoJSON(lat, lng, colors.radiusKm);

        // Remove existing layers/sources if they exist
        try {
          if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
          if (map.getLayer(borderLayerId)) map.removeLayer(borderLayerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        } catch {
          // Ignore cleanup errors
        }

        // Add source
        map.addSource(sourceId, {
          type: 'geojson',
          data: {
            type: 'FeatureCollection',
            features: [circleGeoJSON],
          },
        });

        // Add fill layer
        map.addLayer({
          id: fillLayerId,
          type: 'fill',
          source: sourceId,
          paint: {
            'fill-color': colors.fill,
          },
        });

        // Add border layer
        map.addLayer({
          id: borderLayerId,
          type: 'line',
          source: sourceId,
          paint: {
            'line-color': colors.border,
            'line-width': 2,
            'line-dasharray': [3, 2],
          },
        });

        addedLayers.current.add(sourceId);
      });
    };

    if (map.isStyleLoaded()) {
      addZones();
    } else {
      map.on('style.load', addZones);
    }

    // Cleanup on unmount
    return () => {
      addedLayers.current.forEach((sourceId) => {
        const index = sourceId.replace('danger-zone-source-', '');
        const fillLayerId = `danger-zone-fill-${index}`;
        const borderLayerId = `danger-zone-border-${index}`;

        try {
          if (map.getLayer(fillLayerId)) map.removeLayer(fillLayerId);
          if (map.getLayer(borderLayerId)) map.removeLayer(borderLayerId);
          if (map.getSource(sourceId)) map.removeSource(sourceId);
        } catch {
          // Ignore cleanup errors
        }
      });
      addedLayers.current.clear();
    };
  }, [map, dangerZones]);

  return null; // This component manipulates the map instance directly
}
