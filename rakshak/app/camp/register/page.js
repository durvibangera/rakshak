'use client';

import { useState, useEffect, useRef, useCallback } from 'react';

export default function CampRegisterPage() {
  const [campName, setCampName] = useState('');
  const [operatorName, setOperatorName] = useState('');
  const [operatorPhone, setOperatorPhone] = useState('');
  const [operatorEmail, setOperatorEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [helplineNumber, setHelplineNumber] = useState('');
  const [campCode, setCampCode] = useState('');
  const [lat, setLat] = useState(null);
  const [lng, setLng] = useState(null);
  const [radius, setRadius] = useState(10);
  const [mapReady, setMapReady] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [campId, setCampId] = useState('');

  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markerRef = useRef(null);
  const circleLayerIds = useRef([]);

  // Initialize map
  useEffect(() => {
    let map;
    const init = async () => {
      if (!mapRef.current || mapInstance.current) return;
      const mgl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');

      map = new mgl.Map({
        container: mapRef.current,
        style: {
          version: 8,
          sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, attribution: '© OpenStreetMap', maxzoom: 19 } },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [78, 20],
        zoom: 4.5,
        maxBounds: [[60, 5], [100, 40]],
      });

      map.addControl(new mgl.NavigationControl({ showCompass: false }), 'bottom-right');

      map.on('load', () => {
        setMapReady(true);
        mapInstance.current = map;
      });

      map.on('click', (e) => {
        const { lng: clickLng, lat: clickLat } = e.lngLat;
        setLat(clickLat);
        setLng(clickLng);
      });
    };
    init();
    return () => { if (map) map.remove(); };
  }, []);

  // Update marker and circle when lat/lng/radius change
  const updateMapOverlay = useCallback(async () => {
    if (!mapInstance.current || !mapReady || lat == null || lng == null) return;
    const map = mapInstance.current;
    const mgl = (await import('maplibre-gl')).default;

    // Remove old marker
    if (markerRef.current) markerRef.current.remove();

    // Remove old circle layers
    circleLayerIds.current.forEach(id => {
      try { if (map.getLayer(id)) map.removeLayer(id); } catch {}
      try { if (map.getSource(id)) map.removeSource(id); } catch {}
    });
    circleLayerIds.current = [];

    // Add marker
    const el = document.createElement('div');
    el.innerHTML = `<div style="width:20px;height:20px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.5);"></div>`;
    markerRef.current = new mgl.Marker({ element: el, draggable: true })
      .setLngLat([lng, lat])
      .addTo(map);

    markerRef.current.on('dragend', () => {
      const pos = markerRef.current.getLngLat();
      setLat(pos.lat);
      setLng(pos.lng);
    });

    // Draw radius circle
    const coords = [];
    for (let i = 0; i <= 64; i++) {
      const angle = (i / 64) * 2 * Math.PI;
      const dLat = (radius / 6371) * (180 / Math.PI);
      const dLng = (radius / (6371 * Math.cos((lat * Math.PI) / 180))) * (180 / Math.PI);
      coords.push([lng + dLng * Math.cos(angle), lat + dLat * Math.sin(angle)]);
    }

    const srcId = 'camp-radius-src';
    const fillId = 'camp-radius-fill';
    const lineId = 'camp-radius-line';

    map.addSource(srcId, {
      type: 'geojson',
      data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } },
    });
    map.addLayer({ id: fillId, type: 'fill', source: srcId, paint: { 'fill-color': 'rgba(59,130,246,0.15)' } });
    map.addLayer({ id: lineId, type: 'line', source: srcId, paint: { 'line-color': '#3B82F6', 'line-width': 2, 'line-dasharray': [3, 2] } });
    circleLayerIds.current = [fillId, lineId, srcId];

    map.flyTo({ center: [lng, lat], zoom: 10, duration: 1000 });
  }, [lat, lng, radius, mapReady]);

  useEffect(() => { updateMapOverlay(); }, [updateMapOverlay]);

  const detectLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => { setLat(pos.coords.latitude); setLng(pos.coords.longitude); },
      () => setError('Location access denied — click on the map instead'),
      { timeout: 5000, maximumAge: 60000 }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!campName.trim()) return setError('Enter camp name');
    if (!operatorName.trim()) return setError('Enter operator name');
    if (!operatorPhone.trim()) return setError('Enter contact phone');
    if (lat == null || lng == null) return setError('Select camp location on the map');

    setLoading(true);
    try {
      const res = await fetch('/api/camps', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: campName.trim(),
          operator_name: operatorName.trim(),
          operator_phone: operatorPhone.trim(),
          operator_email: operatorEmail.trim() || null,
          admin_email: operatorEmail.trim() || null,
          admin_password: adminPassword || null,
          helpline_number: helplineNumber.trim() || null,
          camp_code: campCode.trim() || null,
          lat, lng,
          radius_km: radius,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to register camp');

      localStorage.setItem('sahaay_camp_id', data.camp.id);
      localStorage.setItem('sahaay_camp_name', data.camp.name);
      setCampId(data.camp.id);
      setSuccess(true);
    } catch (err) {
      setError(err.message);
    }
    setLoading(false);
  };

  if (success) {
    return (
      <div style={styles.page}>
        <div style={{ ...styles.card, maxWidth: 480, textAlign: 'center' }}>
          <div style={styles.successIcon}>
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 8px', color: '#F1F5F9' }}>Camp Registered!</h2>
          <p style={{ color: '#94A3B8', fontSize: 14, margin: '0 0 4px' }}>{campName}</p>
          <p style={{ color: '#64748B', fontSize: 12, margin: '0 0 20px' }}>
            Coverage: {radius}km radius at {lat?.toFixed(4)}, {lng?.toFixed(4)}
          </p>
          <a href="/camp/dashboard" style={styles.dashboardLink}>
            Open Camp Dashboard
          </a>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.page}>
      <div style={{ display: 'flex', gap: 24, width: '100%', maxWidth: 1100, flexWrap: 'wrap' }}>
        {/* Form */}
        <div style={{ ...styles.card, flex: '1 1 360px', minWidth: 320 }}>
          <div style={{ marginBottom: 24 }}>
            <a href="/flood-prediction" style={{ color: '#64748B', fontSize: 13, textDecoration: 'none' }}>
              ← Back to Dashboard
            </a>
            <h1 style={{ fontSize: 24, fontWeight: 800, margin: '12px 0 0', color: '#F1F5F9' }}>Register Relief Camp</h1>
            <p style={{ color: '#94A3B8', fontSize: 14, margin: '6px 0 0' }}>
              Set up your camp to manage victims and receive disaster alerts
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={styles.label}>Camp Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input type="text" value={campName} onChange={e => setCampName(e.target.value)} placeholder="e.g. KJ Somaiya Relief Camp" style={styles.input} />
            </div>

            <div>
              <label style={styles.label}>Operator Name <span style={{ color: '#EF4444' }}>*</span></label>
              <input type="text" value={operatorName} onChange={e => setOperatorName(e.target.value)} placeholder="Your name" style={styles.input} />
            </div>

            <div>
              <label style={styles.label}>Contact Phone <span style={{ color: '#EF4444' }}>*</span></label>
              <input type="tel" value={operatorPhone} onChange={e => setOperatorPhone(e.target.value)} placeholder="9999000001" style={styles.input} />
            </div>

            <div>
              <label style={styles.label}>Email (for admin login) <span style={{ color: '#EF4444' }}>*</span></label>
              <input type="email" value={operatorEmail} onChange={e => setOperatorEmail(e.target.value)} placeholder="admin@camporg.com" style={styles.input} />
            </div>

            <div>
              <label style={styles.label}>Admin Password <span style={{ color: '#EF4444' }}>*</span></label>
              <input type="password" value={adminPassword} onChange={e => setAdminPassword(e.target.value)} placeholder="Min 6 characters" style={styles.input} />
              <p style={{ fontSize: 11, color: '#64748B', margin: '4px 0 0' }}>
                Use this email + password to log in as camp admin
              </p>
            </div>

            <div style={{ display: 'flex', gap: 8 }}>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Helpline Number</label>
                <input type="tel" value={helplineNumber} onChange={e => setHelplineNumber(e.target.value)} placeholder="1800-XXX-XXXX" style={styles.input} />
              </div>
              <div style={{ flex: 1 }}>
                <label style={styles.label}>Camp Code</label>
                <input type="text" value={campCode} onChange={e => setCampCode(e.target.value)} placeholder="e.g. MH-CAMP-01" style={styles.input} />
              </div>
            </div>

            <div>
              <label style={styles.label}>Coverage Radius: {radius} km</label>
              <input
                type="range" min="1" max="50" value={radius}
                onChange={e => setRadius(Number(e.target.value))}
                style={{ width: '100%', accentColor: '#3B82F6' }}
              />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: '#64748B' }}>
                <span>1 km</span><span>50 km</span>
              </div>
            </div>

            <div>
              <label style={styles.label}>Camp Location <span style={{ color: '#EF4444' }}>*</span></label>
              {lat != null ? (
                <p style={{ fontSize: 13, color: '#86EFAC', margin: 0 }}>
                  Selected: {lat.toFixed(4)}, {lng.toFixed(4)}
                </p>
              ) : (
                <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
                  Click on the map or use GPS below
                </p>
              )}
              <button type="button" onClick={detectLocation} style={{ ...styles.locationBtn, marginTop: 8 }}>
                Use My Current Location
              </button>
            </div>

            {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}

            <button type="submit" disabled={loading} style={{
              ...styles.submitBtn,
              opacity: loading ? 0.6 : 1,
              cursor: loading ? 'wait' : 'pointer',
            }}>
              {loading ? 'Registering Camp...' : 'Register Camp'}
            </button>
          </form>
        </div>

        {/* Map */}
        <div style={{ flex: '1 1 400px', minWidth: 350, minHeight: 500, borderRadius: 16, overflow: 'hidden', border: '1px solid #334155' }}>
          <div ref={mapRef} style={{ width: '100%', height: '100%', minHeight: 500 }} />
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: '100vh', background: '#0F172A', display: 'flex', alignItems: 'center',
    justifyContent: 'center', padding: 24, fontFamily: 'system-ui, sans-serif',
  },
  card: {
    background: '#1E293B', border: '1px solid #334155', borderRadius: 16, padding: 32, color: '#E2E8F0',
  },
  label: { display: 'block', fontSize: 13, fontWeight: 600, color: '#94A3B8', marginBottom: 6 },
  input: {
    width: '100%', padding: '12px 14px', background: '#0F172A', border: '1px solid #334155',
    borderRadius: 10, color: '#E2E8F0', fontSize: 15, outline: 'none', boxSizing: 'border-box',
  },
  locationBtn: {
    width: '100%', padding: 10, background: '#0F172A', border: '1px dashed #334155',
    borderRadius: 10, color: '#94A3B8', fontSize: 13, cursor: 'pointer', textAlign: 'center',
  },
  submitBtn: {
    width: '100%', padding: 14, background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700, cursor: 'pointer',
    boxShadow: '0 4px 14px rgba(59,130,246,0.3)',
  },
  successIcon: {
    width: 64, height: 64, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center', marginBottom: 16,
  },
  dashboardLink: {
    display: 'inline-block', padding: '14px 32px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 15,
  },
};
