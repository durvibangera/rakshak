/**
 * FILE: page.js (Super Admin → Disaster Simulation)
 * PURPOSE: UI for triggering dummy disaster scenarios for testing the full pipeline.
 *
 * CONSUMES: POST /api/dummy-disaster  (creates a pending camp_alert)
 *           GET  /api/camps            (load active camps)
 *           GET  /api/alerts           (view resulting alerts)
 *
 * ROLE ACCESS: super_admin
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function DisasterSimPage() {
  return <RoleGate allowedRole="super_admin"><SimulationContent /></RoleGate>;
}

const DISASTER_TYPES = [
  { id: 'FLOOD',      label: 'Flood',      color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE', desc: 'Heavy rainfall — river levels rising rapidly',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M2 12h20M2 17c2-2 4-2 6 0s4 2 6 0 4-2 6 0"/><path d="M3 7l4-4 4 4"/><path d="M11 3v4"/></svg> },
  { id: 'EARTHQUAKE', label: 'Earthquake', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', desc: 'Seismic activity — magnitude 5.2 tremor',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg> },
  { id: 'LANDSLIDE',  label: 'Landslide',  color: '#B45309', bg: '#FEF3C7', border: '#FDE68A', desc: 'Continuous rainfall in hilly terrain',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 20l7-10 4 5 2-3 5 8z"/><path d="M20 3l-5 5"/></svg> },
  { id: 'CYCLONE',    label: 'Cyclone',    color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', desc: 'Cyclonic storm — winds exceeding 120 km/h',
    icon: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 14a4 4 0 118 0c0 2.5-2 4-4 4"/><path d="M14 10a4 4 0 11-8 0c0-2.5 2-4 4-4"/><circle cx="12" cy="12" r="1"/></svg> },
];

const SEVERITIES = [
  { id: 'LOW',      color: '#059669', bg: '#D1FAE5' },
  { id: 'MEDIUM',   color: '#D97706', bg: '#FEF3C7' },
  { id: 'HIGH',     color: '#DC2626', bg: '#FEE2E2' },
  { id: 'CRITICAL', color: '#7C3AED', bg: '#F5F3FF' },
];

function SimulationContent() {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campId, setCampId] = useState('');
  const [disasterType, setDisasterType] = useState('FLOOD');
  const [severity, setSeverity] = useState('HIGH');
  const [triggering, setTriggering] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);

  const fetchCamps = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('camps').select('id, name, code, lat, lng, status').eq('status', 'active');
      setCamps(data || []);
      if (data?.length > 0) setCampId(data[0].id);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      setRecentAlerts((data.alerts || []).slice(0, 10));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchCamps(); fetchAlerts(); }, [fetchCamps, fetchAlerts]);

  useEffect(() => {
    const ch = supabase.channel('sim-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'camp_alerts' }, () => fetchAlerts())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchAlerts]);

  const triggerDisaster = async () => {
    setError(''); setResult(null);
    if (!campId) return setError('Select a camp');
    setTriggering(true);
    try {
      const res = await fetch('/api/dummy-disaster', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ camp_id: campId, disaster_type: disasterType, severity }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger');
      setResult(data);
      const campName = camps.find(c => c.id === campId)?.name || campId;
      setHistory(prev => [{ type: disasterType, severity, campName, message: data.message, time: new Date().toLocaleTimeString(), alertId: data.alert?.id }, ...prev]);
      fetchAlerts();
    } catch (err) { setError(err.message); }
    setTriggering(false);
  };

  const selectedCamp = camps.find(c => c.id === campId);
  const selectedDisaster = DISASTER_TYPES.find(d => d.id === disasterType);

  const ALERT_STATUS = {
    pending: { bg: '#FEF3C7', text: '#B45309', label: 'Pending' },
    active:  { bg: '#FEE2E2', text: '#DC2626', label: 'Active' },
    resolved:{ bg: '#D1FAE5', text: '#059669', label: 'Resolved' },
  };

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
        <div style={s.navRight}>
          <Link href="/super-admin/sms-alerts" style={s.navLink}>SMS Alerts</Link>
          <Link href="/super-admin/dashboard" style={s.navBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Dashboard
          </Link>
        </div>
      </header>

      <div style={s.body}>
        <div style={s.pageHead}>
          <p style={s.eyebrow}>Super Admin · Testing Tools</p>
          <h1 style={s.pageTitle}>Disaster Simulation</h1>
          <p style={s.pageSubtitle}>Trigger test disaster scenarios — creates a pending alert in the admin approval pipeline</p>
        </div>

        <div style={s.twoCol}>
          {/* Left: Config */}
          <div style={s.configCol}>

            {/* Disaster type */}
            <div style={s.card}>
              <p style={s.stepLabel}>Step 1 — Disaster Type</p>
              <div style={s.disasterGrid}>
                {DISASTER_TYPES.map(d => {
                  const isSelected = disasterType === d.id;
                  return (
                    <button key={d.id} onClick={() => setDisasterType(d.id)} style={{ ...s.disasterCard, ...(isSelected ? { background: d.bg, borderColor: d.border, boxShadow: `0 0 0 2px ${d.border}` } : {}) }}>
                      <div style={{ ...s.disasterIcon, background: isSelected ? d.bg : '#F8FAFC', border: `1px solid ${isSelected ? d.border : '#E2E8F0'}`, color: d.color }}>
                        {d.icon}
                      </div>
                      <p style={{ ...s.disasterLabel, color: isSelected ? d.color : '#374151' }}>{d.label}</p>
                      <p style={s.disasterDesc}>{d.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Camp + Severity */}
            <div style={s.card}>
              <p style={s.stepLabel}>Step 2 — Target Camp &amp; Severity</p>
              <div style={{ marginBottom: 14 }}>
                <label style={s.label}>Camp</label>
                {loading ? <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Loading camps…</p>
                  : camps.length === 0 ? <p style={{ fontSize: 13, color: '#D97706', margin: 0 }}>No active camps</p>
                  : (
                    <select value={campId} onChange={e => setCampId(e.target.value)} style={s.input}>
                      {camps.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code || 'no code'})</option>)}
                    </select>
                  )}
                {selectedCamp && <p style={{ fontSize: 12, color: '#9CA3AF', margin: '5px 0 0', fontFamily: 'monospace' }}>📍 {selectedCamp.lat?.toFixed(4)}, {selectedCamp.lng?.toFixed(4)}</p>}
              </div>
              <div>
                <label style={s.label}>Severity</label>
                <div style={s.severityRow}>
                  {SEVERITIES.map(sv => {
                    const isSel = severity === sv.id;
                    return (
                      <button key={sv.id} onClick={() => setSeverity(sv.id)} style={{ ...s.severityBtn, background: isSel ? sv.bg : 'white', borderColor: isSel ? sv.color : '#E2E8F0', color: isSel ? sv.color : '#9CA3AF' }}>
                        {sv.id}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right: Preview + trigger + alerts */}
          <div style={s.rightCol}>

            {/* Preview & trigger */}
            <div style={s.card}>
              <p style={s.stepLabel}>Step 3 — Trigger Simulation</p>

              {/* Preview */}
              <div style={s.previewBox}>
                <p style={s.previewLabel}>Preview</p>
                <div style={s.previewContent}>
                  <div style={{ ...s.previewIconWrap, background: selectedDisaster?.bg, border: `1px solid ${selectedDisaster?.border}`, color: selectedDisaster?.color }}>
                    {selectedDisaster?.icon}
                  </div>
                  <div>
                    <p style={s.previewTitle}>{disasterType} — {severity}</p>
                    <p style={s.previewCamp}>{selectedCamp?.name || 'Select a camp'}</p>
                    <p style={s.previewDesc}>{selectedDisaster?.desc}</p>
                  </div>
                </div>
              </div>

              {/* Warning */}
              <div style={s.warningBox}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <p style={{ fontSize: 13, color: '#B45309', margin: 0 }}>Creates a <strong>pending</strong> alert for admin approval. Does not send real notifications.</p>
              </div>

              {error && (
                <div style={s.errorBox}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button onClick={triggerDisaster} disabled={triggering || !campId} style={{ ...s.triggerBtn, opacity: (triggering || !campId) ? 0.6 : 1 }}>
                {triggering ? <><span style={s.spinner2} /> Triggering…</> : <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                  Trigger Disaster
                </>}
              </button>

              {result && (
                <div style={s.successBox}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 700, color: '#059669', margin: '0 0 2px' }}>Disaster Triggered</p>
                    <p style={{ fontSize: 12.5, color: '#6B7280', margin: 0 }}>{result.message}</p>
                    {result.alert?.id && <p style={{ fontSize: 11.5, color: '#9CA3AF', margin: '4px 0 0', fontFamily: 'monospace' }}>Alert ID: {result.alert.id}</p>}
                  </div>
                </div>
              )}
            </div>

            {/* Recent alerts */}
            <div style={s.card}>
              <div style={s.cardHead}>
                <h2 style={s.cardTitle}>Recent Alerts</h2>
                <span style={s.cardMeta}>{recentAlerts.length} shown</span>
              </div>
              {recentAlerts.length === 0 ? (
                <p style={{ fontSize: 13.5, color: '#9CA3AF', margin: 0 }}>No alerts yet</p>
              ) : (
                <div style={s.alertList}>
                  {recentAlerts.map((a, i) => {
                    const st = ALERT_STATUS[a.status] || ALERT_STATUS.pending;
                    return (
                      <div key={a.id || i} style={s.alertRow}>
                        <div>
                          <p style={s.alertRowTitle}>{a.disaster_type || a.type} — {a.location_name || a.camp_id?.slice(0, 8)}</p>
                          <p style={s.alertRowMeta}>{a.severity} · {a.status}</p>
                        </div>
                        <span style={{ ...s.badge, background: st.bg, color: st.text }}>{st.label}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <h2 style={s.cardTitle}>Session Simulation History</h2>
              <span style={s.cardMeta}>{history.length} triggered</span>
            </div>
            <div style={s.historyList}>
              {history.map((h, i) => {
                const d = DISASTER_TYPES.find(dt => dt.id === h.type);
                return (
                  <div key={i} style={s.historyRow}>
                    <div style={{ ...s.historyIconWrap, background: d?.bg, color: d?.color }}>
                      {d?.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={s.historyTitle}>{h.type} — {h.campName}</p>
                      <p style={s.historyMeta}>{h.severity} · {h.time}</p>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#059669' }}>✓ Triggered</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT, color: '#111827' },
  nav: { background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 28px', height: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  navLogo: { display: 'flex', alignItems: 'center', gap: 9 },
  navLogoText: { fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  navRoleBadge: { fontSize: 11, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', padding: '2px 8px', borderRadius: 20 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navLink: { fontSize: 13, color: '#6B7280', textDecoration: 'none', padding: '5px 10px', borderRadius: 6 },
  navBack: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#6B7280', textDecoration: 'none' },
  body: { maxWidth: 1100, margin: '0 auto', padding: '28px 28px 48px' },
  pageHead: { marginBottom: 22 },
  eyebrow: { fontSize: 11, fontWeight: 600, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  pageTitle: { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.5px' },
  pageSubtitle: { fontSize: 14, color: '#6B7280', margin: 0 },
  twoCol: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, marginBottom: 18 },
  configCol: { display: 'flex', flexDirection: 'column', gap: 18 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 18 },
  card: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 },
  cardMeta: { fontSize: 12.5, color: '#9CA3AF' },
  stepLabel: { fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 14px' },
  disasterGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  disasterCard: { padding: '14px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: FONT, transition: 'all 0.15s' },
  disasterIcon: { width: 40, height: 40, borderRadius: 9, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 10, transition: 'all 0.15s' },
  disasterLabel: { fontSize: 13.5, fontWeight: 700, margin: '0 0 3px', transition: 'color 0.15s' },
  disasterDesc: { fontSize: 11.5, color: '#9CA3AF', margin: 0, lineHeight: 1.4 },
  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, color: '#0F172A', fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', outline: 'none' },
  severityRow: { display: 'flex', gap: 8 },
  severityBtn: { flex: 1, padding: '9px 6px', fontSize: 12, fontWeight: 700, border: '1px solid', borderRadius: 8, cursor: 'pointer', fontFamily: FONT, transition: 'all 0.15s' },
  previewBox: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px', marginBottom: 12 },
  previewLabel: { fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 10px' },
  previewContent: { display: 'flex', gap: 12, alignItems: 'flex-start' },
  previewIconWrap: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  previewTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 3px' },
  previewCamp: { fontSize: 12.5, color: '#6B7280', margin: '0 0 3px' },
  previewDesc: { fontSize: 12, color: '#9CA3AF', margin: 0, fontStyle: 'italic' },
  warningBox: { display: 'flex', gap: 8, alignItems: 'flex-start', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9, padding: '10px 12px', marginBottom: 12 },
  errorBox: { display: 'flex', gap: 8, alignItems: 'center', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, padding: '10px 12px', color: '#DC2626', fontSize: 13.5, marginBottom: 12 },
  triggerBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px', background: '#DC2626', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 2px 10px rgba(220,38,38,0.25)', transition: 'opacity 0.15s' },
  spinner2: { width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },
  successBox: { display: 'flex', gap: 10, alignItems: 'flex-start', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 9, padding: '12px 14px', marginTop: 12 },
  alertList: { display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 240, overflowY: 'auto' },
  alertRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 10px', background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 8 },
  alertRowTitle: { fontSize: 13, fontWeight: 600, color: '#0F172A', margin: 0 },
  alertRowMeta: { fontSize: 11.5, color: '#9CA3AF', margin: '2px 0 0' },
  badge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, whiteSpace: 'nowrap' },
  historyList: { display: 'flex', flexDirection: 'column', gap: 8 },
  historyRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 9 },
  historyIconWrap: { width: 36, height: 36, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  historyTitle: { fontSize: 13.5, fontWeight: 600, color: '#0F172A', margin: 0 },
  historyMeta: { fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' },
};
