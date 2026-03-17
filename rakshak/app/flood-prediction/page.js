/**
 * FILE: page.js (Natural Disaster Command Map)
 * PURPOSE: Full disaster dashboard with MapLibre —
 *    • Camps pulled from Supabase (/api/camps) + static JSON fallback
 *    • Safe zones pulled from Supabase (/api/safe-zones) + static JSON fallback
 *    • Heatmap / density layer showing camp concentration
 *    • Danger zones around evacuated / at-risk camps
 *    • Multi-disaster risk predictions via /api/predict
 *    • Live alerts from /api/alerts
 */

'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

/* ─── Static fallback data (from ml/ JSON files) ─── */
const STATIC_CAMPS = [
  { id: 'CAMP_01', name: 'Dharavi Relief Camp', area: 'Dharavi', lat: 19.0422, lng: 72.8533, current_headcount: 420, capacity: 600, status: 'EVACUATED', danger_reason: 'Rising floodwater — 2ft in last hour' },
  { id: 'CAMP_02', name: 'Kurla West Relief Camp', area: 'Kurla', lat: 19.0726, lng: 72.8795, current_headcount: 310, capacity: 500, status: 'ACTIVE', danger_reason: '' },
  { id: 'CAMP_03', name: 'Andheri East Relief Camp', area: 'Andheri East', lat: 19.1136, lng: 72.8697, current_headcount: 185, capacity: 350, status: 'EVACUATED', danger_reason: 'Structural damage to camp buildings' },
  { id: 'CAMP_04', name: 'Bandra Reclamation Camp', area: 'Bandra West', lat: 19.0596, lng: 72.8295, current_headcount: 95, capacity: 200, status: 'ACTIVE', danger_reason: '' },
  { id: 'CAMP_05', name: 'Sion Relief Camp', area: 'Sion', lat: 19.043, lng: 72.8625, current_headcount: 270, capacity: 400, status: 'ACTIVE', danger_reason: '' },
  { id: 'CAMP_06', name: 'Malad West Relief Camp', area: 'Malad West', lat: 19.1872, lng: 72.8484, current_headcount: 140, capacity: 300, status: 'ACTIVE', danger_reason: '' },
  { id: 'CAMP_07', name: 'Chembur Relief Camp', area: 'Chembur', lat: 19.0622, lng: 72.9005, current_headcount: 230, capacity: 450, status: 'ACTIVE', danger_reason: '' },
  { id: 'CAMP_08', name: 'Govandi Relief Camp', area: 'Govandi', lat: 19.0742, lng: 72.9186, current_headcount: 380, capacity: 550, status: 'EVACUATED', danger_reason: 'Sewage overflow, health hazard declared' },
];

const STATIC_SAFE_ZONES = [
  { id: 'SZ_H01', name: 'Lilavati Hospital', zone_type: 'hospital', lat: 19.0502, lng: 72.8238, capacity: 800, current_occupancy: 0 },
  { id: 'SZ_H02', name: 'Kokilaben Hospital', zone_type: 'hospital', lat: 19.1347, lng: 72.827, capacity: 600, current_occupancy: 0 },
  { id: 'SZ_H03', name: 'Sion Hospital', zone_type: 'hospital', lat: 19.0399, lng: 72.8576, capacity: 500, current_occupancy: 420 },
  { id: 'SZ_H04', name: 'Rajawadi Hospital', zone_type: 'hospital', lat: 19.0786, lng: 72.9097, capacity: 400, current_occupancy: 380 },
  { id: 'SZ_H05', name: 'Seven Hills Hospital', zone_type: 'hospital', lat: 19.1063, lng: 72.88, capacity: 450, current_occupancy: 185 },
];

const SCAN_LOCATIONS = [
  { name: 'Mumbai', lat: 19.076, lon: 72.8777 },
  { name: 'Delhi', lat: 28.6139, lon: 77.209 },
  { name: 'Chennai', lat: 13.0827, lon: 80.2707 },
  { name: 'Kolkata', lat: 22.5726, lon: 88.3639 },
  { name: 'Bangalore', lat: 12.9716, lon: 77.5946 },
  { name: 'Ahmedabad', lat: 23.0225, lon: 72.5714 },
  { name: 'Pune', lat: 18.5204, lon: 73.8567 },
  { name: 'Hyderabad', lat: 17.385, lon: 78.4867 },
  { name: 'Jaipur', lat: 26.9124, lon: 75.7873 },
  { name: 'Guwahati', lat: 26.1445, lon: 91.7362 },
  { name: 'Shimla', lat: 31.1048, lon: 77.1734 },
  { name: 'Kochi', lat: 9.9312, lon: 76.2673 },
];

const DISASTER_TYPES = {
  FLOOD: { color: '#3B82F6', label: 'Flood', icon: '🌊', radius: 5 },
  EARTHQUAKE: { color: '#EF4444', label: 'Earthquake', icon: '🔴', radius: 8 },
  LANDSLIDE: { color: '#A855F7', label: 'Landslide', icon: '⛰️', radius: 4 },
  CYCLONE: { color: '#F97316', label: 'Cyclone', icon: '🌀', radius: 10 },
};

const RISK_STYLES = {
  HIGH: { bg: 'rgba(239,68,68,0.15)', border: '#EF4444', text: '#FCA5A5', fill: 'rgba(239,68,68,0.25)', glow: '0 0 20px rgba(239,68,68,0.4)' },
  MEDIUM: { bg: 'rgba(249,115,22,0.12)', border: '#F97316', text: '#FDBA74', fill: 'rgba(249,115,22,0.2)', glow: '0 0 15px rgba(249,115,22,0.3)' },
  LOW: { bg: 'rgba(34,197,94,0.1)', border: '#22C55E', text: '#86EFAC', fill: 'rgba(34,197,94,0.08)', glow: 'none' },
};

export default function DisasterDashboard() {
  const [camps, setCamps] = useState([]);
  const [safeZones, setSafeZones] = useState([]);
  const [predictions, setPredictions] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [campsLoading, setCampsLoading] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  const [filter, setFilter] = useState('all');
  const [showPanel, setShowPanel] = useState(true);
  const [tab, setTab] = useState('alerts'); // alerts | camps | zones
  const [layers, setLayers] = useState({ camps: true, safeZones: true, dangerZones: true, heatmap: true, predictions: true });

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef([]);
  const layerIdsRef = useRef([]);

  /* ─── Load camps + safe zones ─── */
  useEffect(() => {
    async function loadData() {
      setCampsLoading(true);
      // Fetch live camps from Supabase
      let liveCamps = [];
      try {
        const res = await fetch('/api/camps');
        const data = await res.json();
        liveCamps = (data.camps || []).map(c => ({
          ...c,
          current_headcount: c.victim_count || c.current_headcount || 0,
          capacity: c.capacity || 500,
          area: c.area || c.name,
        }));
      } catch { }

      // Merge: live camps + static fallback (dedupe by name)
      const liveNames = new Set(liveCamps.map(c => c.name));
      const merged = [...liveCamps, ...STATIC_CAMPS.filter(c => !liveNames.has(c.name))];
      setCamps(merged);

      // Fetch safe zones from Supabase
      let liveZones = [];
      try {
        const res = await fetch('/api/safe-zones');
        const data = await res.json();
        liveZones = (data.zones || []).filter(z => z.lat && z.lng);
      } catch { }

      const liveZoneNames = new Set(liveZones.map(z => z.name));
      const mergedZones = [...liveZones, ...STATIC_SAFE_ZONES.filter(z => !liveZoneNames.has(z.name))];
      setSafeZones(mergedZones);

      // Fetch alerts
      try {
        const res = await fetch('/api/alerts');
        const data = await res.json();
        setAlerts(Array.isArray(data) ? data : data.alerts || []);
      } catch { }

      setCampsLoading(false);
    }
    loadData();
  }, []);

  /* ─── Scan predictions for all cities ─── */
  const fetchPrediction = useCallback(async (lat, lon, name) => {
    try {
      const res = await fetch(`/api/predict?lat=${lat}&lon=${lon}&type=all`);
      if (!res.ok) throw new Error('API error');
      const data = await res.json();
      return { ...data, name, lat, lon, id: `${lat}-${lon}` };
    } catch { return null; }
  }, []);

  const scanAll = useCallback(async () => {
    setLoading(true);
    const data = await Promise.all(SCAN_LOCATIONS.map(l => fetchPrediction(l.lat, l.lon, l.name)));
    setPredictions(data.filter(Boolean));
    setLoading(false);
  }, [fetchPrediction]);

  const useMyLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(async (pos) => {
      setLoading(true);
      const r = await fetchPrediction(pos.coords.latitude, pos.coords.longitude, 'My Location');
      if (r) setPredictions(prev => [r, ...prev.filter(p => p.name !== 'My Location')]);
      setLoading(false);
    });
  };

  useEffect(() => { scanAll(); }, [scanAll]);

  /* ─── Map init ─── */
  useEffect(() => {
    let map;
    const init = async () => {
      if (!mapRef.current || mapInstance.current) return;
      const mgl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');
      if (!mapRef.current || mapInstance.current) return;

      map = new mgl.Map({
        container: mapRef.current,
        style: {
          version: 8,
          sources: {
            'carto-dark': {
              type: 'raster',
              tiles: ['https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}@2x.png'],
              tileSize: 256,
              attribution: '© CARTO © OpenStreetMap',
              maxzoom: 19,
            },
          },
          layers: [{ id: 'carto-dark', type: 'raster', source: 'carto-dark' }],
        },
        center: [78, 22],
        zoom: 4.5,
        maxBounds: [[60, 5], [100, 40]],
      });
      map.addControl(new mgl.NavigationControl({ showCompass: false }), 'bottom-right');
      map.on('load', () => {
        setMapReady(true);
        mapInstance.current = map;
      });
    };
    init();
    return () => { if (map) { map.remove(); mapInstance.current = null; } };
  }, []);

  /* ─── Render everything on map ─── */
  useEffect(() => {
    if (!mapInstance.current || !mapReady) return;
    const map = mapInstance.current;

    const render = async () => {
      const mgl = (await import('maplibre-gl')).default;

      // Clean up old markers and layers
      markersRef.current.forEach(m => m.remove());
      markersRef.current = [];
      layerIdsRef.current.forEach(id => {
        try { if (map.getLayer(id)) map.removeLayer(id); } catch { }
        try { if (map.getSource(id)) map.removeSource(id); } catch { }
      });
      layerIdsRef.current = [];

      /* ── 1. Heatmap layer from camp locations ── */
      if (layers.heatmap && camps.length > 0) {
        const heatFeatures = camps.map(c => ({
          type: 'Feature',
          geometry: { type: 'Point', coordinates: [c.lng, c.lat] },
          properties: { weight: (c.current_headcount || 100) / 100 },
        }));

        const srcId = 'camp-heat-src';
        const layerId = 'camp-heat-layer';
        map.addSource(srcId, {
          type: 'geojson',
          data: { type: 'FeatureCollection', features: heatFeatures },
        });
        map.addLayer({
          id: layerId,
          type: 'heatmap',
          source: srcId,
          paint: {
            'heatmap-weight': ['get', 'weight'],
            'heatmap-intensity': ['interpolate', ['linear'], ['zoom'], 4, 0.5, 10, 2],
            'heatmap-radius': ['interpolate', ['linear'], ['zoom'], 4, 30, 10, 60],
            'heatmap-color': [
              'interpolate', ['linear'], ['heatmap-density'],
              0, 'rgba(0,0,0,0)',
              0.2, 'rgba(59,130,246,0.3)',
              0.4, 'rgba(59,130,246,0.5)',
              0.6, 'rgba(249,115,22,0.6)',
              0.8, 'rgba(239,68,68,0.7)',
              1.0, 'rgba(239,68,68,0.9)',
            ],
            'heatmap-opacity': 0.7,
          },
        });
        layerIdsRef.current.push(layerId, srcId);
      }

      /* ── 2. Danger zones around evacuated / at-risk camps ── */
      if (layers.dangerZones) {
        camps.filter(c => c.status === 'EVACUATED' || c.danger_reason).forEach(c => {
          const radius = 0.4; // km
          const sid = `danger-src-${c.id}`;
          const fid = `danger-fill-${c.id}`;
          const lid = `danger-line-${c.id}`;
          const coords = [];
          for (let i = 0; i <= 64; i++) {
            const a = (i / 64) * 2 * Math.PI;
            const dLat = (radius / 6371) * (180 / Math.PI);
            const dLng = (radius / (6371 * Math.cos((c.lat * Math.PI) / 180))) * (180 / Math.PI);
            coords.push([c.lng + dLng * Math.cos(a), c.lat + dLat * Math.sin(a)]);
          }
          map.addSource(sid, {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }] },
          });
          map.addLayer({ id: fid, type: 'fill', source: sid, paint: { 'fill-color': 'rgba(239,68,68,0.15)', 'fill-opacity': 0.6 } });
          map.addLayer({ id: lid, type: 'line', source: sid, paint: { 'line-color': '#EF4444', 'line-width': 2, 'line-dasharray': [4, 2], 'line-opacity': 0.8 } });
          layerIdsRef.current.push(fid, lid, sid);
        });
      }

      /* ── 3. Prediction risk zones around cities ── */
      if (layers.predictions) {
        predictions.forEach(loc => {
          if (!loc.predictions) return;
          Object.entries(loc.predictions).forEach(([type, pred]) => {
            if (filter !== 'all' && type !== filter) return;
            if (pred.risk === 'LOW') return;
            const cfg = DISASTER_TYPES[pred.type];
            const rs = RISK_STYLES[pred.risk];
            if (!cfg) return;
            const r = cfg.radius * (pred.risk === 'HIGH' ? 1.5 : 1);
            const sid = `pred-src-${loc.id}-${type}`;
            const fid = `pred-fill-${loc.id}-${type}`;
            const lid = `pred-line-${loc.id}-${type}`;
            const coords = [];
            for (let i = 0; i <= 64; i++) {
              const a = (i / 64) * 2 * Math.PI;
              const dLat = (r / 6371) * (180 / Math.PI);
              const dLng = (r / (6371 * Math.cos((loc.lat * Math.PI) / 180))) * (180 / Math.PI);
              coords.push([loc.lon + dLng * Math.cos(a), loc.lat + dLat * Math.sin(a)]);
            }
            map.addSource(sid, { type: 'geojson', data: { type: 'FeatureCollection', features: [{ type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } }] } });
            map.addLayer({ id: fid, type: 'fill', source: sid, paint: { 'fill-color': rs.fill, 'fill-opacity': 0.5 } });
            map.addLayer({ id: lid, type: 'line', source: sid, paint: { 'line-color': cfg.color, 'line-width': 1.5, 'line-opacity': 0.6 } });
            layerIdsRef.current.push(fid, lid, sid);
          });
        });
      }

      /* ── 4. Camp markers ── */
      if (layers.camps) {
        camps.forEach(c => {
          const isEvac = c.status === 'EVACUATED';
          const isDanger = !!c.danger_reason;
          const fill = isEvac ? '#EF4444' : isDanger ? '#F97316' : '#22C55E';
          const sz = isEvac ? 16 : 12;
          const pct = c.capacity ? Math.round((c.current_headcount / c.capacity) * 100) : 0;

          const el = document.createElement('div');
          el.innerHTML = `<div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${fill};border:2px solid rgba(255,255,255,0.9);box-shadow:0 0 ${isEvac ? '14' : '6'}px ${fill};cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.5)'" onmouseout="this.style.transform='scale(1)'"></div>`;

          const popupHTML = `
            <div style="font-family:system-ui;padding:4px;max-width:220px;">
              <p style="font-weight:700;font-size:14px;margin:0 0 4px;color:#111827;">🏕️ ${c.name}</p>
              <p style="font-size:11px;color:#6B7280;margin:0 0 6px;">${c.area || ''}</p>
              <div style="display:flex;gap:12px;margin-bottom:6px;">
                <div><span style="font-size:10px;color:#9CA3AF;">People</span><br/><strong style="color:#111827;">${c.current_headcount || 0}</strong></div>
                <div><span style="font-size:10px;color:#9CA3AF;">Capacity</span><br/><strong style="color:#111827;">${c.capacity}</strong></div>
                <div><span style="font-size:10px;color:#9CA3AF;">Fill</span><br/><strong style="color:${pct > 80 ? '#EF4444' : pct > 50 ? '#F97316' : '#22C55E'};">${pct}%</strong></div>
              </div>
              <span style="display:inline-block;padding:2px 8px;border-radius:4px;font-size:10px;font-weight:700;background:${isEvac ? '#FEE2E2' : '#DCFCE7'};color:${isEvac ? '#DC2626' : '#16A34A'};">${c.status || 'ACTIVE'}</span>
              ${c.danger_reason ? `<p style="font-size:11px;color:#DC2626;margin:6px 0 0;">⚠ ${c.danger_reason}</p>` : ''}
            </div>`;

          const popup = new mgl.Popup({ offset: 12, maxWidth: '260px' }).setHTML(popupHTML);
          const marker = new mgl.Marker({ element: el }).setLngLat([c.lng, c.lat]).setPopup(popup).addTo(map);
          markersRef.current.push(marker);
        });
      }

      /* ── 5. Safe zone markers ── */
      if (layers.safeZones) {
        safeZones.forEach(z => {
          const el = document.createElement('div');
          const typeIcon = z.zone_type === 'hospital' ? '🏥' : z.zone_type === 'school' ? '🏫' : z.zone_type === 'stadium' ? '🏟️' : '🟢';
          el.innerHTML = `<div style="font-size:18px;cursor:pointer;filter:drop-shadow(0 1px 3px rgba(0,0,0,0.5));transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.3)'" onmouseout="this.style.transform='scale(1)'">${typeIcon}</div>`;

          const avail = (z.capacity || 0) - (z.current_occupancy || 0);
          const popup = new mgl.Popup({ offset: 12, maxWidth: '220px' }).setHTML(`
            <div style="font-family:system-ui;padding:4px;">
              <p style="font-weight:700;font-size:13px;margin:0 0 4px;color:#111827;">${z.name}</p>
              <p style="font-size:11px;color:#6B7280;margin:0 0 6px;">${z.zone_type} · ${z.area || ''}</p>
              <div style="display:flex;gap:12px;">
                <div><span style="font-size:10px;color:#9CA3AF;">Capacity</span><br/><strong style="color:#111827;">${z.capacity}</strong></div>
                <div><span style="font-size:10px;color:#9CA3AF;">Available</span><br/><strong style="color:${avail > 100 ? '#22C55E' : avail > 0 ? '#F97316' : '#EF4444'};">${avail}</strong></div>
              </div>
            </div>`);

          const marker = new mgl.Marker({ element: el }).setLngLat([z.lng, z.lat]).setPopup(popup).addTo(map);
          markersRef.current.push(marker);
        });
      }

      /* ── 6. City prediction markers ── */
      if (layers.predictions) {
        predictions.forEach(loc => {
          if (!loc.predictions) return;
          const preds = Object.entries(loc.predictions);
          const highest = preds.reduce((max, [, p]) => {
            const o = { HIGH: 3, MEDIUM: 2, LOW: 1 };
            return (o[p.risk] || 0) > (o[max.risk] || 0) ? p : max;
          }, { risk: 'LOW' });

          const c = highest.risk === 'HIGH' ? '#EF4444' : highest.risk === 'MEDIUM' ? '#F97316' : '#22C55E';
          const sz = highest.risk === 'HIGH' ? 20 : highest.risk === 'MEDIUM' ? 16 : 10;

          const el = document.createElement('div');
          el.innerHTML = `<div style="position:relative;"><div style="width:${sz}px;height:${sz}px;border-radius:50%;background:${c};border:2.5px solid rgba(255,255,255,0.95);box-shadow:0 0 ${highest.risk === 'HIGH' ? '16' : '8'}px ${c};cursor:pointer;transition:transform 0.2s;" onmouseover="this.style.transform='scale(1.4)'" onmouseout="this.style.transform='scale(1)'"></div><span style="position:absolute;top:${sz + 4}px;left:50%;transform:translateX(-50%);font-size:10px;font-weight:700;color:white;text-shadow:0 1px 4px rgba(0,0,0,0.8);white-space:nowrap;">${loc.name}</span></div>`;

          const rows = preds.filter(([t]) => filter === 'all' || t === filter).map(([, p]) => {
            const d = DISASTER_TYPES[p.type]; const r = RISK_STYLES[p.risk];
            if (!d) return '';
            return `<div style="display:flex;justify-content:space-between;align-items:center;padding:4px 0;"><span style="display:flex;align-items:center;gap:4px;color:#374151;font-size:12px;">${d.icon} ${d.label}</span><span style="color:${r.text};background:${r.bg};border:1px solid ${r.border};padding:1px 8px;border-radius:4px;font-size:10px;font-weight:700;">${p.risk}</span></div>`;
          }).join('');

          const popup = new mgl.Popup({ offset: 16, maxWidth: '240px', className: 'prediction-popup' }).setHTML(`
            <div style="font-family:system-ui;padding:2px;">
              <p style="font-weight:700;font-size:14px;margin:0 0 6px;color:#111827;">${loc.name}</p>
              ${rows}
              ${highest.description ? `<p style="font-size:10px;color:#9CA3AF;margin:6px 0 0;line-height:1.4;">${highest.description}</p>` : ''}
            </div>`);

          const marker = new mgl.Marker({ element: el }).setLngLat([loc.lon, loc.lat]).setPopup(popup).addTo(map);
          markersRef.current.push(marker);
        });
      }
    };
    render();
  }, [camps, safeZones, predictions, mapReady, filter, layers]);

  /* ─── Derived data ─── */
  const predAlerts = predictions.flatMap(loc => {
    if (!loc.predictions) return [];
    return Object.values(loc.predictions)
      .filter(p => (filter === 'all' || p.type === filter) && p.risk !== 'LOW')
      .map(p => ({ ...p, city: loc.name }));
  }).sort((a, b) => ({ HIGH: 0, MEDIUM: 1 }[a.risk] ?? 2) - ({ HIGH: 0, MEDIUM: 1 }[b.risk] ?? 2));

  const highCount = predAlerts.filter(a => a.risk === 'HIGH').length;
  const dangerCamps = camps.filter(c => c.status === 'EVACUATED' || c.danger_reason);
  const totalPeople = camps.reduce((s, c) => s + (c.current_headcount || 0), 0);

  const filters = [
    { key: 'all', label: 'All Disasters' },
    { key: 'FLOOD', label: '🌊 Flood' },
    { key: 'EARTHQUAKE', label: '🔴 Earthquake' },
    { key: 'LANDSLIDE', label: '⛰️ Landslide' },
    { key: 'CYCLONE', label: '🌀 Cyclone' },
  ];

  const toggleLayer = (key) => setLayers(prev => ({ ...prev, [key]: !prev[key] }));

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes slideUp { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }
        @keyframes spin { to { transform:rotate(360deg); } }
        .glass { background:rgba(15,23,42,0.82); backdrop-filter:blur(16px); -webkit-backdrop-filter:blur(16px); border:1px solid rgba(255,255,255,0.08); }
        .btn { border:none; cursor:pointer; font-weight:600; font-size:13px; border-radius:8px; padding:8px 18px; transition:all 0.2s; }
        .btn:hover { transform:translateY(-1px); }
        .btn-primary { background:linear-gradient(135deg,#3B82F6,#2563EB); color:white; box-shadow:0 4px 14px rgba(59,130,246,0.3); }
        .btn-ghost { background:rgba(255,255,255,0.05); color:#CBD5E1; border:1px solid rgba(255,255,255,0.1); }
        .btn-ghost:hover { background:rgba(255,255,255,0.1); color:white; }
        .filter-pill { border:none; cursor:pointer; padding:6px 14px; border-radius:20px; font-size:12px; font-weight:600; transition:all 0.2s; }
        .alert-card { animation: slideUp 0.3s ease-out; transition: transform 0.2s, box-shadow 0.2s; }
        .alert-card:hover { transform:translateY(-2px); box-shadow:0 8px 24px rgba(0,0,0,0.3); }
        .tab-btn { border:none; cursor:pointer; padding:8px 16px; font-size:12px; font-weight:700; border-radius:8px; transition:all 0.15s; text-transform:uppercase; letter-spacing:0.5px; }
        .layer-toggle { display:flex; align-items:center; gap:8px; padding:6px 10px; border-radius:6px; cursor:pointer; border:none; font-size:11px; font-weight:600; transition:all 0.15s; width:100%; text-align:left; }
        .maplibregl-popup-content { border-radius:12px !important; padding:12px 14px !important; box-shadow:0 12px 40px rgba(0,0,0,0.25) !important; }
      `}</style>

      <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', background: '#0B1120', color: '#E2E8F0', fontFamily: "'Inter', system-ui, sans-serif", overflow: 'hidden' }}>

        {/* ── Navbar ── */}
        <nav className="glass" style={{ padding: '10px 20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 20, borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <a href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{ width: 32, height: 32, borderRadius: 10, background: 'linear-gradient(135deg,#3B82F6,#8B5CF6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: 'white' }}>R</div>
              <div>
                <h1 style={{ fontSize: 16, fontWeight: 700, margin: 0, color: '#F1F5F9', letterSpacing: '-0.3px' }}>Sahaay</h1>
                <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>Natural Disaster Command Map</p>
              </div>
            </a>
          </div>

          {/* Stats bar */}
          <div style={{ display: 'flex', gap: 20, alignItems: 'center' }}>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>{camps.length}</p>
              <p style={{ fontSize: 9, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Camps</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: totalPeople > 0 ? '#3B82F6' : '#64748B', margin: 0 }}>{totalPeople.toLocaleString()}</p>
              <p style={{ fontSize: 9, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>People</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: dangerCamps.length > 0 ? '#EF4444' : '#22C55E', margin: 0 }}>{dangerCamps.length}</p>
              <p style={{ fontSize: 9, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Danger</p>
            </div>
            <div style={{ textAlign: 'center' }}>
              <p style={{ fontSize: 18, fontWeight: 800, color: '#22C55E', margin: 0 }}>{safeZones.length}</p>
              <p style={{ fontSize: 9, color: '#64748B', margin: 0, textTransform: 'uppercase', letterSpacing: 0.5 }}>Safe Zones</p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn btn-ghost" onClick={useMyLocation}>📍 My Location</button>
            <button className="btn btn-primary" onClick={scanAll} disabled={loading}>
              {loading ? '⏳ Scanning…' : '🔍 Scan All Cities'}
            </button>
          </div>
        </nav>

        {/* ── Filter Bar ── */}
        <div className="glass" style={{ padding: '6px 20px', display: 'flex', gap: 6, alignItems: 'center', zIndex: 20, borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
          {filters.map(f => (
            <button key={f.key} className="filter-pill"
              onClick={() => setFilter(f.key)}
              style={{
                background: filter === f.key ? `${DISASTER_TYPES[f.key]?.color || '#3B82F6'}25` : 'rgba(255,255,255,0.04)',
                color: filter === f.key ? DISASTER_TYPES[f.key]?.color || '#93C5FD' : '#94A3B8',
                border: `1px solid ${filter === f.key ? `${DISASTER_TYPES[f.key]?.color || '#3B82F6'}40` : 'transparent'}`,
              }}>
              {f.label}
            </button>
          ))}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 12, fontSize: 12, color: '#64748B' }}>
            {campsLoading && <span>Loading camps…</span>}
            {highCount > 0 && <span style={{ color: '#EF4444', fontWeight: 700, animation: 'pulse 2s infinite' }}>🚨 {highCount} HIGH alert{highCount > 1 ? 's' : ''}</span>}
            <span>{predictions.length} cities scanned</span>
          </div>
        </div>

        {/* ── Map + Side Panel ── */}
        <div style={{ flex: 1, display: 'flex', position: 'relative', overflow: 'hidden' }}>
          <div ref={mapRef} style={{ flex: 1, height: '100%' }} />

          {/* Side panel */}
          {showPanel && (
            <div className="glass" style={{ width: 360, height: '100%', overflowY: 'auto', borderLeft: '1px solid rgba(255,255,255,0.06)', zIndex: 10, display: 'flex', flexDirection: 'column' }}>

              {/* Layer toggles */}
              <div style={{ padding: '12px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                <p style={{ fontSize: 10, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Map Layers</p>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                  {[
                    { key: 'heatmap', label: 'Heatmap', color: '#F97316' },
                    { key: 'camps', label: 'Camps', color: '#22C55E' },
                    { key: 'safeZones', label: 'Safe Zones', color: '#3B82F6' },
                    { key: 'dangerZones', label: 'Danger Zones', color: '#EF4444' },
                    { key: 'predictions', label: 'Predictions', color: '#A855F7' },
                  ].map(l => (
                    <button key={l.key} className="layer-toggle"
                      onClick={() => toggleLayer(l.key)}
                      style={{
                        background: layers[l.key] ? `${l.color}15` : 'rgba(255,255,255,0.03)',
                        color: layers[l.key] ? l.color : '#475569',
                      }}>
                      <span style={{ width: 8, height: 8, borderRadius: '50%', background: layers[l.key] ? l.color : '#334155', flexShrink: 0 }} />
                      {l.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Tab bar */}
              <div style={{ display: 'flex', gap: 4, padding: '10px 14px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                {[
                  { key: 'alerts', label: `Alerts (${predAlerts.length})` },
                  { key: 'camps', label: `Camps (${camps.length})` },
                  { key: 'zones', label: `Zones (${safeZones.length})` },
                ].map(t2 => (
                  <button key={t2.key} className="tab-btn"
                    onClick={() => setTab(t2.key)}
                    style={{
                      flex: 1,
                      background: tab === t2.key ? 'rgba(59,130,246,0.2)' : 'rgba(255,255,255,0.03)',
                      color: tab === t2.key ? '#93C5FD' : '#64748B',
                    }}>
                    {t2.label}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflowY: 'auto', padding: 14 }}>

                {/* ── ALERTS TAB ── */}
                {tab === 'alerts' && (
                  <>
                    {/* Danger camps */}
                    {dangerCamps.length > 0 && (
                      <div style={{ marginBottom: 16 }}>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#EF4444', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
                          ⚠ Danger Camps ({dangerCamps.length})
                        </p>
                        {dangerCamps.map(c => (
                          <div key={c.id} className="alert-card" style={{
                            background: 'rgba(239,68,68,0.1)', borderRadius: 10, padding: '12px 14px',
                            borderLeft: '3px solid #EF4444', marginBottom: 8,
                          }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                              <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>🏕️ {c.name}</span>
                              <span style={{ fontSize: 10, fontWeight: 700, color: '#FCA5A5', background: 'rgba(239,68,68,0.2)', padding: '2px 8px', borderRadius: 4 }}>
                                {c.status}
                              </span>
                            </div>
                            <p style={{ fontSize: 11, color: '#FCA5A5', margin: '4px 0 0' }}>{c.danger_reason}</p>
                            <p style={{ fontSize: 10, color: '#64748B', margin: '4px 0 0' }}>{c.current_headcount} people · {c.area}</p>
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Prediction alerts */}
                    {predAlerts.length > 0 ? (
                      <>
                        <p style={{ fontSize: 10, fontWeight: 700, color: '#64748B', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>
                          Risk Predictions
                        </p>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {predAlerts.map((a, i) => {
                            const cfg = DISASTER_TYPES[a.type];
                            const rs = RISK_STYLES[a.risk];
                            if (!cfg) return null;
                            return (
                              <div key={`${a.city}-${a.type}-${i}`} className="alert-card" style={{
                                background: rs.bg, borderRadius: 10, padding: '12px 14px',
                                borderLeft: `3px solid ${cfg.color}`, boxShadow: rs.glow,
                              }}>
                                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                  <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>{a.city}</span>
                                  <span style={{ fontSize: 10, fontWeight: 700, color: rs.text, background: `${rs.border}20`, border: `1px solid ${rs.border}50`, padding: '2px 10px', borderRadius: 12 }}>{a.risk}</span>
                                </div>
                                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
                                  <span style={{ fontSize: 14 }}>{cfg.icon}</span>
                                  <span style={{ fontSize: 12, color: '#94A3B8', fontWeight: 500 }}>{cfg.label}</span>
                                </div>
                                <p style={{ fontSize: 11, color: '#64748B', margin: 0, lineHeight: 1.4 }}>{a.description}</p>
                              </div>
                            );
                          })}
                        </div>
                      </>
                    ) : !loading && predictions.length > 0 && dangerCamps.length === 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '40px 0', opacity: 0.6 }}>
                        <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
                          <div style={{ width: 20, height: 20, borderRadius: '50%', background: '#22C55E' }} />
                        </div>
                        <p style={{ fontSize: 14, fontWeight: 600, margin: '0 0 4px' }}>All Clear</p>
                        <p style={{ fontSize: 12, color: '#64748B' }}>No active disaster alerts</p>
                      </div>
                    ) : loading ? (
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '40px 0' }}>
                        <div style={{ width: 32, height: 32, border: '3px solid rgba(59,130,246,0.2)', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 1s linear infinite' }} />
                        <p style={{ fontSize: 13, color: '#64748B', marginTop: 12 }}>Scanning cities…</p>
                      </div>
                    ) : null}
                  </>
                )}

                {/* ── CAMPS TAB ── */}
                {tab === 'camps' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {camps.map(c => {
                      const pct = c.capacity ? Math.round((c.current_headcount / c.capacity) * 100) : 0;
                      const isEvac = c.status === 'EVACUATED';
                      return (
                        <div key={c.id} className="alert-card" style={{
                          background: isEvac ? 'rgba(239,68,68,0.08)' : 'rgba(255,255,255,0.03)',
                          borderRadius: 10, padding: '12px 14px',
                          borderLeft: `3px solid ${isEvac ? '#EF4444' : pct > 80 ? '#F97316' : '#22C55E'}`,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          if (mapInstance.current) mapInstance.current.flyTo({ center: [c.lng, c.lat], zoom: 13, duration: 1200 });
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>🏕️ {c.name}</span>
                            <span style={{
                              fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
                              background: isEvac ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)',
                              color: isEvac ? '#FCA5A5' : '#86EFAC',
                            }}>{c.status || 'ACTIVE'}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#94A3B8' }}>
                            <span>👥 {c.current_headcount || 0}/{c.capacity}</span>
                            <span style={{ color: pct > 80 ? '#EF4444' : pct > 50 ? '#F97316' : '#22C55E' }}>{pct}% full</span>
                            {c.area && <span>{c.area}</span>}
                          </div>
                          {/* capacity bar */}
                          <div style={{ marginTop: 6, height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                            <div style={{ height: '100%', borderRadius: 2, background: pct > 80 ? '#EF4444' : pct > 50 ? '#F97316' : '#22C55E', width: `${Math.min(pct, 100)}%`, transition: 'width 0.6s' }} />
                          </div>
                          {c.danger_reason && <p style={{ fontSize: 11, color: '#FCA5A5', margin: '6px 0 0' }}>⚠ {c.danger_reason}</p>}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* ── SAFE ZONES TAB ── */}
                {tab === 'zones' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                    {safeZones.map(z => {
                      const avail = (z.capacity || 0) - (z.current_occupancy || 0);
                      const typeIcon = z.zone_type === 'hospital' ? '🏥' : z.zone_type === 'school' ? '🏫' : z.zone_type === 'stadium' ? '🏟️' : '🟢';
                      return (
                        <div key={z.id} className="alert-card" style={{
                          background: 'rgba(59,130,246,0.06)', borderRadius: 10, padding: '12px 14px',
                          borderLeft: `3px solid ${avail > 100 ? '#22C55E' : avail > 0 ? '#F97316' : '#EF4444'}`,
                          cursor: 'pointer',
                        }}
                        onClick={() => {
                          if (mapInstance.current) mapInstance.current.flyTo({ center: [z.lng, z.lat], zoom: 14, duration: 1200 });
                        }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9' }}>{typeIcon} {z.name}</span>
                          </div>
                          <div style={{ display: 'flex', gap: 16, marginTop: 6, fontSize: 12, color: '#94A3B8' }}>
                            <span>Cap: {z.capacity}</span>
                            <span style={{ color: avail > 100 ? '#22C55E' : avail > 0 ? '#F97316' : '#EF4444' }}>
                              Available: {avail}
                            </span>
                            {z.area && <span>{z.area}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Legend */}
              <div style={{ padding: '12px 14px', borderTop: '1px solid rgba(255,255,255,0.06)', flexShrink: 0 }}>
                <p style={{ fontSize: 9, fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: 1, margin: '0 0 8px' }}>Legend</p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94A3B8' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22C55E' }} />Active Camp</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94A3B8' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#EF4444' }} />Evacuated</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94A3B8' }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: '#F97316' }} />At Risk</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94A3B8' }}>🏥 Hospital</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94A3B8' }}>🏫 School</span>
                  <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, color: '#94A3B8' }}><span style={{ width: 14, height: 6, borderRadius: 2, background: 'linear-gradient(90deg, #3B82F6, #F97316, #EF4444)' }} />Heatmap</span>
                </div>
              </div>
            </div>
          )}

          {/* Toggle panel */}
          <button onClick={() => setShowPanel(!showPanel)} style={{
            position: 'absolute', right: showPanel ? 360 : 0, top: '50%', transform: 'translateY(-50%)',
            width: 24, height: 48, background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.1)',
            borderRight: showPanel ? 'none' : undefined, borderLeft: showPanel ? undefined : 'none',
            borderRadius: showPanel ? '6px 0 0 6px' : '0 6px 6px 0',
            color: '#94A3B8', cursor: 'pointer', zIndex: 15, fontSize: 14, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>
            {showPanel ? '›' : '‹'}
          </button>
        </div>
      </div>
    </>
  );
}
