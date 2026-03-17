/**
 * FILE: page.js (Super Admin — Safe Zones & Camp Migration)
 * PURPOSE: Map view of camps + safe zones, flag camps as danger, get migration recommendations.
 */
'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function SafeZonesPage() {
  return <RoleGate allowedRole="super_admin"><SafeZonesContent /></RoleGate>;
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
      const campsList = campsRes.data || [];
      await Promise.all(campsList.map(async (c) => {
        const { count } = await supabase.from('camp_victims').select('*', { count: 'exact', head: true }).eq('camp_id', c.id);
        c.headcount = count || 0;
      }));
      setCamps(campsList);
      setZones(zonesRes.zones || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    if (loading || !mapContainerRef.current || mapRef.current) return;
    let mgl;
    try { mgl = require('maplibre-gl'); } catch { return; }
    const map = new mgl.Map({ container: mapContainerRef.current, style: 'https://basemaps.cartocdn.com/gl/positron-gl-style/style.json', center: [72.87, 19.07], zoom: 11 });
    map.on('load', () => {
      camps.forEach((c) => {
        if (!c.lat || !c.lng) return;
        const color = c.status === 'full' ? '#DC2626' : '#D97706';
        const el = document.createElement('div');
        el.style.cssText = `width:14px;height:14px;border-radius:50%;background:${color};border:2px solid white;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.2);`;
        new mgl.Marker({ element: el }).setLngLat([c.lng, c.lat])
          .setPopup(new mgl.Popup({ offset: 10 }).setHTML(`<div style="font-family:system-ui;padding:6px;font-size:13px;"><strong>${c.name}</strong><br/>Status: ${c.status}<br/>People: ${c.headcount}</div>`))
          .addTo(map);
      });
      zones.forEach((z) => {
        const el = document.createElement('div');
        el.style.cssText = 'width:12px;height:12px;border-radius:50%;background:#059669;border:2px solid white;cursor:pointer;box-shadow:0 2px 6px rgba(0,0,0,0.15);';
        new mgl.Marker({ element: el }).setLngLat([z.lng, z.lat])
          .setPopup(new mgl.Popup({ offset: 10 }).setHTML(`<div style="font-family:system-ui;padding:6px;font-size:13px;"><strong>${z.name}</strong><br/>Type: ${z.zone_type}<br/>Capacity: ${z.current_occupancy || 0}/${z.capacity}</div>`))
          .addTo(map);
      });
    });
    mapRef.current = map;
    return () => map.remove();
  }, [loading, camps, zones]);

  const flagAsDanger = (camp) => { setSelectedCamp(camp); setDangerReason(''); setMigrationResult(null); setShowDangerModal(true); };

  const runSafeZonePrediction = async () => {
    if (!selectedCamp || !dangerReason.trim()) return;
    setPredicting(true);
    try {
      const res = await fetch('/api/ml/safe-zone', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ camp_id: selectedCamp.id, danger_reason: dangerReason }) });
      setMigrationResult(await res.json());
    } catch (e) { console.error(e); }
    setPredicting(false);
  };

  const confirmMigration = async () => {
    if (!selectedCamp) return;
    try {
      await supabase.from('camp_alerts').insert({ camp_id: selectedCamp.id, disaster_type: 'FLOOD', severity: 'HIGH', lat: selectedCamp.lat, lng: selectedCamp.lng, location_name: selectedCamp.name, description: `DANGER: ${dangerReason}. Migration recommended.`, status: 'pending' });
      await supabase.from('camps').update({ status: 'full' }).eq('id', selectedCamp.id);
      setShowDangerModal(false);
      setSelectedCamp(null);
      fetchData();
    } catch (e) { console.error(e); }
  };

  const ZONE_ICON = { hospital: '🏥', school: '🏫', college: '🎓', community_hall: '🏛️', stadium: '🏟️' };

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <header style={s.nav}>
        <div style={s.navLogo}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L3 8v7c0 5.55 4.7 10.74 11 12 6.3-1.26 11-6.45 11-12V8L14 2z" fill="#2563EB"/>
            <path d="M10 14l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={s.navLogoText}>Sahaay</span>
          <span style={s.navRoleBadge}>Super Admin</span>
        </div>
        <Link href="/super-admin/dashboard" style={s.navBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Dashboard
        </Link>
      </header>

      <div style={s.body}>
        <div style={s.pageHead}>
          <p style={s.eyebrow}>Super Admin</p>
          <h1 style={s.pageTitle}>Safe Zones &amp; Camp Migration</h1>
          <p style={s.pageSubtitle}>Camps shown in orange · Safe zones in green. Flag a camp as danger to get AI migration recommendations.</p>
        </div>

        {loading ? (
          <div style={s.loadingWrap}><div style={s.spinner} /><p style={s.loadingText}>Loading map data…</p></div>
        ) : (
          <>
            {/* Map legend + map */}
            <div style={s.card}>
              <div style={s.cardHead}>
                <h2 style={s.cardTitle}>Live Map</h2>
                <div style={s.mapLegend}>
                  <span style={s.legendItem}><span style={{ ...s.legendDot, background: '#D97706' }} />Camp (Active)</span>
                  <span style={s.legendItem}><span style={{ ...s.legendDot, background: '#DC2626' }} />Camp (Full/Danger)</span>
                  <span style={s.legendItem}><span style={{ ...s.legendDot, background: '#059669' }} />Safe Zone</span>
                </div>
              </div>
              <div style={s.mapWrap}>
                <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
              </div>
            </div>

            {/* Two-column layout */}
            <div style={s.twoCol}>
              {/* Camp status table */}
              <div style={s.card}>
                <div style={s.cardHead}>
                  <h2 style={s.cardTitle}>Camp Status</h2>
                  <span style={s.cardMeta}>{camps.length} camps</span>
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table style={s.table}>
                    <thead>
                      <tr>
                        {['Camp', 'Status', 'People', 'Coordinates', 'Action'].map(h => <th key={h} style={s.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {camps.map(c => (
                        <tr key={c.id} style={s.tr}>
                          <td style={s.td}><span style={s.tdBold}>{c.name}</span></td>
                          <td style={s.td}>
                            <span style={{ ...s.badge, background: c.status === 'full' ? '#FEE2E2' : c.status === 'active' ? '#D1FAE5' : '#F3F4F6', color: c.status === 'full' ? '#DC2626' : c.status === 'active' ? '#059669' : '#6B7280' }}>
                              {c.status === 'full' ? 'Danger' : c.status}
                            </span>
                          </td>
                          <td style={s.td}>{c.headcount}</td>
                          <td style={{ ...s.td, fontSize: 12, color: '#9CA3AF', fontFamily: 'monospace' }}>{c.lat?.toFixed(4)}, {c.lng?.toFixed(4)}</td>
                          <td style={s.td}>
                            {c.status !== 'full' && (
                              <button onClick={() => flagAsDanger(c)} style={s.dangerBtn}>
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                                Flag Danger
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Safe zone occupancy */}
              <div style={s.card}>
                <div style={s.cardHead}>
                  <h2 style={s.cardTitle}>Safe Zone Occupancy</h2>
                  <span style={s.cardMeta}>{zones.length} zones</span>
                </div>
                <div style={s.zoneGrid}>
                  {zones.map(z => {
                    const pct = z.capacity > 0 ? ((z.current_occupancy || 0) / z.capacity) * 100 : 0;
                    const fillColor = pct > 80 ? '#DC2626' : pct > 50 ? '#D97706' : '#059669';
                    return (
                      <div key={z.id} style={s.zoneCard}>
                        <div style={s.zoneCardTop}>
                          <span style={s.zoneEmoji}>{ZONE_ICON[z.zone_type] || '📍'}</span>
                          <span style={s.zoneName}>{z.name}</span>
                          <span style={{ ...s.badge, background: pct > 80 ? '#FEE2E2' : '#D1FAE5', color: pct > 80 ? '#DC2626' : '#059669' }}>{Math.round(pct)}%</span>
                        </div>
                        <div style={s.zoneBar}><div style={{ ...s.zoneBarFill, width: `${Math.min(100, pct)}%`, background: fillColor }} /></div>
                        <p style={s.zoneCapacity}>{z.current_occupancy || 0} / {z.capacity} capacity</p>
                      </div>
                    );
                  })}
                  {zones.length === 0 && <p style={{ fontSize: 13.5, color: '#9CA3AF', margin: 0 }}>No safe zones registered</p>}
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Danger modal */}
      {showDangerModal && selectedCamp && (
        <div style={s.modalOverlay} onClick={() => setShowDangerModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalStripe} />
            <div style={s.modalBody}>
              <div style={s.modalHead}>
                <div>
                  <p style={s.modalEyebrow}>Camp Migration</p>
                  <h2 style={s.modalTitle}>Flag {selectedCamp.name} as Danger</h2>
                  <p style={s.modalSubtitle}>{selectedCamp.headcount} people currently in camp</p>
                </div>
                <button onClick={() => setShowDangerModal(false)} style={s.modalClose}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>Danger Reason *</label>
                <input value={dangerReason} onChange={e => setDangerReason(e.target.value)} style={s.input} placeholder="e.g. Severe flooding, structural damage" />
              </div>

              <button onClick={runSafeZonePrediction} disabled={predicting || !dangerReason.trim()} style={{ ...s.btnPrimary, opacity: (predicting || !dangerReason.trim()) ? 0.6 : 1 }}>
                {predicting ? <><span style={s.spinner2} /> Finding Safe Zones…</> : <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                  Find Best Safe Zone
                </>}
              </button>

              {migrationResult && (
                <div style={{ marginTop: 18 }}>
                  <p style={s.migrationTitle}>Top Migration Options</p>
                  {(migrationResult.all_options || []).slice(0, 3).map((z, i) => (
                    <div key={z.zone_id} style={{ ...s.migrationCard, ...(i === 0 ? s.migrationCardBest : {}) }}>
                      <div style={s.migrationCardTop}>
                        <div>
                          <p style={s.migrationZoneName}>{i === 0 && '⭐ '}{z.name}</p>
                          <p style={s.migrationZoneMeta}>{ZONE_ICON[z.zone_type] || '📍'} {z.zone_type} · {z.area || '—'}</p>
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <p style={s.migrationScore}>{z.score}</p>
                          <p style={{ fontSize: 10.5, color: '#9CA3AF', margin: 0 }}>score</p>
                        </div>
                      </div>
                      <div style={s.migrationChips}>
                        <span style={s.migrationChip}>{z.distance_km} km away</span>
                        <span style={s.migrationChip}>{z.available_capacity} spots</span>
                        <span style={{ ...s.migrationChip, background: z.can_fit_all ? '#D1FAE5' : '#FEF3C7', color: z.can_fit_all ? '#059669' : '#B45309' }}>{z.can_fit_all ? 'Can fit all' : 'Partial'}</span>
                      </div>
                      {z.facilities?.length > 0 && <p style={s.migrationFacilities}>Facilities: {z.facilities.join(', ')}</p>}
                    </div>
                  ))}
                  <div style={s.modalFooter}>
                    <button onClick={confirmMigration} style={s.btnDanger}>
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/></svg>
                      Confirm Danger &amp; Alert
                    </button>
                    <button onClick={() => setShowDangerModal(false)} style={s.btnSecondary}>Cancel</button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT, color: '#111827' },
  nav: { background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 28px', height: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  navLogo: { display: 'flex', alignItems: 'center', gap: 9 },
  navLogoText: { fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  navRoleBadge: { fontSize: 11, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', padding: '2px 8px', borderRadius: 20 },
  navBack: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#6B7280', textDecoration: 'none' },
  body: { maxWidth: 1200, margin: '0 auto', padding: '28px 28px 48px' },
  pageHead: { marginBottom: 22 },
  eyebrow: { fontSize: 11, fontWeight: 600, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  pageTitle: { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.5px' },
  pageSubtitle: { fontSize: 14, color: '#6B7280', margin: 0 },
  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 },
  spinner: { width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText: { fontSize: 13.5, color: '#9CA3AF', margin: 0 },
  card: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 18 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 },
  cardMeta: { fontSize: 12.5, color: '#9CA3AF' },
  mapLegend: { display: 'flex', gap: 14, alignItems: 'center' },
  legendItem: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#6B7280' },
  legendDot: { width: 10, height: 10, borderRadius: '50%', flexShrink: 0 },
  mapWrap: { height: 380, borderRadius: 9, overflow: 'hidden', border: '1px solid #E2E8F0' },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 360px', gap: 18, alignItems: 'start' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #F1F5F9', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #F8FAFC' },
  td: { padding: '10px 12px', color: '#475569', fontSize: 13 },
  tdBold: { fontWeight: 700, color: '#111827' },
  badge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5 },
  dangerBtn: { display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT },
  zoneGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  zoneCard: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '12px 14px' },
  zoneCardTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  zoneEmoji: { fontSize: 16, flexShrink: 0 },
  zoneName: { fontSize: 13.5, fontWeight: 600, color: '#0F172A', flex: 1 },
  zoneBar: { height: 5, background: '#E2E8F0', borderRadius: 4, overflow: 'hidden', marginBottom: 5 },
  zoneBarFill: { height: '100%', borderRadius: 4 },
  zoneCapacity: { fontSize: 11.5, color: '#9CA3AF', margin: 0 },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 },
  modal: { background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', maxWidth: 580, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.15)' },
  modalStripe: { height: 4, background: 'linear-gradient(90deg, #DC2626, #EF4444, #FCA5A5)', borderRadius: '16px 16px 0 0' },
  modalBody: { padding: '22px 26px 26px' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalEyebrow: { fontSize: 11, fontWeight: 600, color: '#DC2626', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  modalTitle: { fontSize: 19, fontWeight: 800, color: '#0F172A', margin: '0 0 3px', letterSpacing: '-0.4px' },
  modalSubtitle: { fontSize: 13, color: '#6B7280', margin: 0 },
  modalClose: { background: '#F1F5F9', border: 'none', borderRadius: 8, width: 30, height: 30, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', flexShrink: 0 },
  modalFooter: { display: 'flex', gap: 10, marginTop: 16, paddingTop: 14, borderTop: '1px solid #F1F5F9' },
  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, color: '#0F172A', fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', outline: 'none' },
  btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#2563EB', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 2px 8px rgba(37,99,235,0.25)' },
  btnDanger: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 18px', background: '#DC2626', color: 'white', border: 'none', borderRadius: 9, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: FONT },
  btnSecondary: { display: 'flex', alignItems: 'center', gap: 6, padding: '10px 16px', background: 'white', color: '#374151', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 14, fontWeight: 600, cursor: 'pointer', fontFamily: FONT },
  spinner2: { width: 15, height: 15, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },
  migrationTitle: { fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: '0 0 10px' },
  migrationCard: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', marginBottom: 8 },
  migrationCardBest: { background: '#ECFDF5', borderColor: '#A7F3D0' },
  migrationCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 },
  migrationZoneName: { fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 3px' },
  migrationZoneMeta: { fontSize: 12, color: '#9CA3AF', margin: 0 },
  migrationScore: { fontSize: 18, fontWeight: 800, color: '#059669', margin: 0 },
  migrationChips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  migrationChip: { fontSize: 11.5, background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 6, padding: '2px 8px', color: '#6B7280', fontWeight: 500 },
  migrationFacilities: { fontSize: 12, color: '#9CA3AF', margin: '6px 0 0' },
};
