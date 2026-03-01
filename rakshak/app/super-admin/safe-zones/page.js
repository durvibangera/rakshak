/**
 * FILE: page.js (Super Admin — Safe Zones & Camp Migration)
 * PURPOSE: Map view of camps + safe zones, flag camps as danger, get migration recommendations.
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';

export default function SafeZonesPage() {
  return (
    <RoleGate allowedRole="super_admin">
      <SafeZonesContent />
    </RoleGate>
  );
}

function SafeZonesContent() {
  const [camps, setCamps] = useState([]);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedCamp, setSelectedCamp] = useState(null);
  const [dangerReason, setDangerReason] = useState('');
  const [showDangerModal, setShowDangerModal] = useState(false);
  const [migrationResult, setMigrationResult] = useState(null);
  const [predicting, setPredicting] = useState(false);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [campsRes, zonesRes] = await Promise.all([
        supabase.from('camps').select('*'),
        fetch('/api/safe-zones').then(r => r.json()),
      ]);

      // Attach headcounts to camps
      const campsList = campsRes.data || [];
      await Promise.all(
        campsList.map(async (c) => {
          const { count } = await supabase
            .from('camp_victims')
            .select('*', { count: 'exact', head: true })
            .eq('camp_id', c.id);
          c.headcount = count || 0;
        })
      );

      setCamps(campsList);
      setZones(zonesRes.zones || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Init map
  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return;

    let mgl;
    try { mgl = require('maplibre-gl'); } catch { return; }

    const map = new mgl.Map({
      container: mapContainerRef.current,
      style: 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json',
      center: [72.87, 19.07],
      zoom: 11,
    });

    map.on('load', () => {
      // Camp markers (red/orange)
      camps.forEach((c) => {
        if (!c.lat || !c.lng) return;
        const color = c.status === 'full' ? '#EF4444' : '#F59E0B';
        const el = document.createElement('div');
        el.style.cssText = `width:16px;height:16px;border-radius:50%;background:${color};border:2px solid white;cursor:pointer;`;
        el.title = `${c.name} (${c.headcount} people)`;

        new mgl.Marker({ element: el })
          .setLngLat([c.lng, c.lat])
          .setPopup(new mgl.Popup({ offset: 10 }).setHTML(
            `<div style="font-family:system-ui;padding:4px;"><strong>${c.name}</strong><br/>Status: ${c.status}<br/>People: ${c.headcount}</div>`
          ))
          .addTo(map);
      });

      // Safe zone markers (green)
      zones.forEach((z) => {
        const el = document.createElement('div');
        el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#22C55E;border:2px solid white;cursor:pointer;';
        el.title = `${z.name} (${z.zone_type})`;

        new mgl.Marker({ element: el })
          .setLngLat([z.lng, z.lat])
          .setPopup(new mgl.Popup({ offset: 10 }).setHTML(
            `<div style="font-family:system-ui;padding:4px;"><strong>${z.name}</strong><br/>Type: ${z.zone_type}<br/>Capacity: ${z.current_occupancy || 0}/${z.capacity}</div>`
          ))
          .addTo(map);
      });
    });

    mapRef.current = map;
    return () => map.remove();
  }, [loading, camps, zones]);

  const flagAsDanger = (camp) => {
    setSelectedCamp(camp);
    setDangerReason('');
    setMigrationResult(null);
    setShowDangerModal(true);
  };

  const runSafeZonePrediction = async () => {
    if (!selectedCamp || !dangerReason.trim()) return;
    setPredicting(true);
    try {
      const res = await fetch('/api/ml/safe-zone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camp_id: selectedCamp.id, danger_reason: dangerReason }),
      });
      const data = await res.json();
      setMigrationResult(data);
    } catch (e) { console.error(e); }
    setPredicting(false);
  };

  const confirmMigration = async () => {
    if (!selectedCamp) return;
    try {
      // Insert camp alert
      await supabase.from('camp_alerts').insert({
        camp_id: selectedCamp.id,
        disaster_type: 'FLOOD',
        severity: 'HIGH',
        lat: selectedCamp.lat,
        lng: selectedCamp.lng,
        location_name: selectedCamp.name,
        description: `DANGER: ${dangerReason}. Migration recommended.`,
        status: 'pending',
      });

      // Update camp status to full
      await supabase.from('camps').update({ status: 'full' }).eq('id', selectedCamp.id);

      setShowDangerModal(false);
      setSelectedCamp(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const ZONE_TYPE_EMOJI = { hospital: '🏥', school: '🏫', college: '🎓', community_hall: '🏛️', stadium: '🏟️' };

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }
        .maplibregl-popup-content { background: #1E293B !important; color: #F1F5F9 !important; border-radius: 8px !important; box-shadow: 0 8px 24px rgba(0,0,0,0.4) !important; }
        .maplibregl-popup-tip { border-top-color: #1E293B !important; }`}
      </style>
      <div style={S.container}>
        <div style={{ marginBottom: 20 }}>
          <a href="/super-admin/dashboard" style={{ color: '#3B82F6', fontSize: 13, textDecoration: 'none' }}>← Dashboard</a>
          <h1 style={S.title}>🗺️ Safe Zones &amp; Camp Migration</h1>
          <p style={S.subtitle}>Map of camps (🟠) and safe zones (🟢). Flag a camp as DANGER to get migration recommendations.</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div style={S.spinner} /></div>
        ) : (
          <>
            {/* Map */}
            <div style={{ borderRadius: 14, overflow: 'hidden', border: '1px solid #334155', marginBottom: 16, height: 400 }}>
              <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
            </div>

            {/* Camp Status */}
            <div style={S.card}>
              <h2 style={S.cardTitle}>🏕️ Camp Status</h2>
              <div style={{ overflowX: 'auto' }}>
                <table style={S.table}>
                  <thead>
                    <tr>
                      <th style={S.th}>Camp</th>
                      <th style={S.th}>Status</th>
                      <th style={S.th}>People</th>
                      <th style={S.th}>Location</th>
                      <th style={S.th}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {camps.map((c) => (
                      <tr key={c.id}>
                        <td style={{ ...S.td, fontWeight: 600, color: '#F1F5F9' }}>{c.name}</td>
                        <td style={S.td}>
                          <span style={{
                            ...S.badge,
                            background: c.status === 'full' ? '#FEE2E2' : c.status === 'active' ? '#D1FAE5' : '#F1F5F9',
                            color: c.status === 'full' ? '#991B1B' : c.status === 'active' ? '#065F46' : '#64748B',
                          }}>
                            {c.status === 'full' ? '⚠️ DANGER' : c.status}
                          </span>
                        </td>
                        <td style={S.td}>{c.headcount}</td>
                        <td style={{ ...S.td, fontSize: 11, color: '#64748B' }}>{c.lat?.toFixed(4)}, {c.lng?.toFixed(4)}</td>
                        <td style={S.td}>
                          {c.status !== 'full' && (
                            <button onClick={() => flagAsDanger(c)} style={{ ...S.btnDanger, fontSize: 12 }}>🚨 Flag Danger</button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Safe Zone Occupancy */}
            <div style={S.card}>
              <h2 style={S.cardTitle}>🟢 Safe Zone Occupancy</h2>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 10 }}>
                {zones.map((z) => {
                  const pct = z.capacity > 0 ? ((z.current_occupancy || 0) / z.capacity) * 100 : 0;
                  return (
                    <div key={z.id} style={{ background: '#0F172A', borderRadius: 10, padding: 12, border: '1px solid #334155' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                        <span>{ZONE_TYPE_EMOJI[z.zone_type] || '📍'}</span>
                        <span style={{ fontSize: 13, fontWeight: 600, color: '#F1F5F9' }}>{z.name}</span>
                      </div>
                      <div style={{ background: '#1E293B', borderRadius: 4, height: 6, marginBottom: 4 }}>
                        <div style={{ height: '100%', width: `${Math.min(100, pct)}%`, background: pct > 80 ? '#EF4444' : '#22C55E', borderRadius: 4 }} />
                      </div>
                      <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>
                        {z.current_occupancy || 0}/{z.capacity} ({Math.round(pct)}%)
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Danger Modal */}
      {showDangerModal && selectedCamp && (
        <div style={S.modalOverlay} onClick={() => setShowDangerModal(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px' }}>
              🚨 Flag {selectedCamp.name} as DANGER
            </h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px' }}>
              People in camp: <strong style={{ color: '#F1F5F9' }}>{selectedCamp.headcount}</strong>
            </p>

            <div style={{ marginBottom: 12 }}>
              <label style={S.label}>Danger Reason*</label>
              <input
                value={dangerReason}
                onChange={(e) => setDangerReason(e.target.value)}
                style={S.input}
                placeholder="e.g., Severe flooding, structural damage"
              />
            </div>

            <button onClick={runSafeZonePrediction} disabled={predicting || !dangerReason.trim()} style={S.btnPrimary}>
              {predicting ? 'Finding Safe Zones...' : '🤖 Find Best Safe Zone'}
            </button>

            {migrationResult && (
              <div style={{ marginTop: 16 }}>
                <h3 style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', marginBottom: 8 }}>Top Migration Options</h3>
                {(migrationResult.all_options || []).slice(0, 3).map((z, i) => (
                  <div key={z.zone_id} style={{
                    background: i === 0 ? 'rgba(34,197,94,0.1)' : '#0F172A',
                    borderRadius: 10, padding: 12, marginBottom: 8,
                    border: `1px solid ${i === 0 ? 'rgba(34,197,94,0.3)' : '#334155'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                      <div>
                        <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: '0 0 2px' }}>
                          {i === 0 ? '⭐ ' : ''}{z.name}
                        </p>
                        <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>
                          {ZONE_TYPE_EMOJI[z.zone_type] || '📍'} {z.zone_type} • {z.area || '—'}
                        </p>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <p style={{ fontSize: 16, fontWeight: 800, color: '#22C55E', margin: 0 }}>{z.score}</p>
                        <p style={{ fontSize: 10, color: '#64748B', margin: 0 }}>score</p>
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 12, color: '#94A3B8' }}>
                      <span>📏 {z.distance_km} km</span>
                      <span>👥 {z.available_capacity} spots</span>
                      <span>{z.can_fit_all ? '✅ Can fit all' : '⚠️ Partial'}</span>
                    </div>
                    {z.facilities?.length > 0 && (
                      <p style={{ fontSize: 11, color: '#64748B', margin: '4px 0 0' }}>
                        Facilities: {z.facilities.join(', ')}
                      </p>
                    )}
                  </div>
                ))}

                <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button onClick={confirmMigration} style={S.btnDanger}>
                    ⚠️ Confirm Danger &amp; Alert
                  </button>
                  <button onClick={() => setShowDangerModal(false)} style={S.btnSecondary}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'system-ui, sans-serif', padding: '20px' },
  container: { maxWidth: 1100, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 800, color: '#F1F5F9', margin: '8px 0 4px', letterSpacing: '-0.5px' },
  subtitle: { fontSize: 14, color: '#64748B', margin: 0 },
  card: { background: '#1E293B', borderRadius: 14, padding: 20, border: '1px solid #334155', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 12px' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', color: '#64748B', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', color: '#CBD5E1', borderBottom: '1px solid #1E293B' },
  badge: { padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 4 },
  input: { width: '100%', padding: '8px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: 8, color: '#F1F5F9', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' },
  btnPrimary: { background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  btnSecondary: { background: '#334155', color: '#94A3B8', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  btnDanger: { background: 'linear-gradient(135deg, #EF4444, #DC2626)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  spinner: { width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 },
  modal: { background: '#1E293B', borderRadius: 16, padding: 24, border: '1px solid #334155', maxWidth: 600, width: '100%', maxHeight: '90vh', overflow: 'auto' },
};
