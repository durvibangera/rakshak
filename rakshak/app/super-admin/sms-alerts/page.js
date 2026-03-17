/**
 * FILE: page.js (Super Admin → SMS Alert Broadcast)
 * PURPOSE: UI for super admins to send SMS alerts to affected users via Twilio.
 *
 * CONSUMES: POST /api/sms-alert
 *
 * MODES: phones (direct list), camp (all users in a camp), all_registered, nearby (lat/lng/radius)
 *
 * ROLE ACCESS: super_admin
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function SMSAlertPage() {
  return <RoleGate allowedRole="super_admin"><SMSAlertContent /></RoleGate>;
}

const MODES = [
  { id: 'camp',           label: 'Camp Users',     desc: 'All victims in a specific camp',        icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
  { id: 'all_registered', label: 'All Users',       desc: 'Every registered user (use sparingly)', icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
  { id: 'nearby',         label: 'Nearby Area',     desc: 'Users within a radius of a location',   icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg> },
  { id: 'phones',         label: 'Direct Numbers',  desc: 'Manually specified phone numbers',       icon: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.07 8.81 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg> },
];

const TEMPLATES = [
  { label: 'Evacuation',   text: 'URGENT: Evacuation order issued for your area. Move to the nearest safe zone immediately. Stay calm and follow instructions from camp staff.' },
  { label: 'Supply ETA',   text: 'Relief supplies are being dispatched to your camp. Distribution will begin within 2-4 hours. Please stay at your camp.' },
  { label: 'Weather',      text: 'Severe weather warning: Heavy rainfall expected in the next 6-12 hours. Seek shelter and avoid low-lying areas.' },
  { label: 'Relocation',   text: 'Your camp is being relocated to a safer zone. Please gather your belongings and wait for transport instructions from camp staff.' },
  { label: 'Medical Camp', text: 'A medical camp is operational at your location. If you or your family need medical attention, please visit the medical tent.' },
];

function SMSAlertContent() {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [mode, setMode] = useState('camp');
  const [message, setMessage] = useState('');
  const [campId, setCampId] = useState('');
  const [phones, setPhones] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radiusKm, setRadiusKm] = useState('5');
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const fetchCamps = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('camps').select('id, name, code, status').eq('status', 'active');
      setCamps(data || []);
      if (data?.length > 0) setCampId(data[0].id);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchCamps(); }, [fetchCamps]);

  const sendAlert = async () => {
    setError(''); setResult(null);
    if (!message.trim()) return setError('Message cannot be empty');
    const body = { mode, message: message.trim() };
    if (mode === 'camp') {
      if (!campId) return setError('Select a camp');
      body.camp_id = campId;
    } else if (mode === 'phones') {
      const phoneList = phones.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean).map(p => p.startsWith('+91') ? p : `+91${p.replace(/\D/g, '')}`);
      if (phoneList.length === 0) return setError('Enter at least one phone number');
      body.phones = phoneList;
    } else if (mode === 'nearby') {
      if (!lat || !lng) return setError('Enter latitude and longitude');
      body.lat = parseFloat(lat); body.lng = parseFloat(lng); body.radius_km = parseFloat(radiusKm) || 5;
    }
    setSending(true);
    try {
      const res = await fetch('/api/sms-alert', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setResult(data);
      setHistory(prev => [{ ...data, mode, message: message.trim(), time: new Date().toLocaleTimeString() }, ...prev]);
    } catch (err) { setError(err.message); }
    setSending(false);
  };

  const selectedCampName = camps.find(c => c.id === campId)?.name || '';
  const charCount = message.length;

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <header style={s.nav}>
        <div style={s.navLogo}>
          <img src="/logo-light.png" alt="Sahaay" style={{ height: 46, width: 'auto', objectFit: 'contain' }} />
          <span style={s.navRoleBadge}>Super Admin</span>
        </div>
        <div style={s.navRight}>
          <Link href="/super-admin/simulate" style={s.navLink}>Simulate</Link>
          <Link href="/super-admin/dashboard" style={s.navBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Dashboard
          </Link>
        </div>
      </header>

      <div style={s.body}>
        <div style={s.pageHead}>
          <p style={s.eyebrow}>Super Admin · Communications</p>
          <h1 style={s.pageTitle}>SMS Alert Broadcast</h1>
          <p style={s.pageSubtitle}>Send emergency SMS to affected users via Twilio — works even when internet is down</p>
        </div>

        <div style={s.twoCol}>

          {/* Left: Recipients + Target */}
          <div style={s.leftCol}>

            {/* Mode selector */}
            <div style={s.card}>
              <p style={s.stepLabel}>Step 1 — Select Recipients</p>
              <div style={s.modeGrid}>
                {MODES.map(m => {
                  const isSel = mode === m.id;
                  return (
                    <button key={m.id} onClick={() => setMode(m.id)} style={{ ...s.modeCard, ...(isSel ? s.modeCardActive : {}) }}>
                      <div style={{ ...s.modeIcon, color: isSel ? '#2563EB' : '#9CA3AF' }}>{m.icon}</div>
                      <p style={{ ...s.modeLabel, color: isSel ? '#2563EB' : '#374151' }}>{m.label}</p>
                      <p style={s.modeDesc}>{m.desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Target details */}
            <div style={s.card}>
              <p style={s.stepLabel}>Step 2 — Target Details</p>

              {mode === 'camp' && (
                <div>
                  <label style={s.label}>Camp</label>
                  {loading ? <p style={{ fontSize: 13, color: '#9CA3AF', margin: 0 }}>Loading…</p>
                    : camps.length === 0 ? <p style={{ fontSize: 13, color: '#D97706', margin: 0 }}>No active camps</p>
                    : <select value={campId} onChange={e => setCampId(e.target.value)} style={s.input}>
                        {camps.map(c => <option key={c.id} value={c.id}>{c.name} ({c.code})</option>)}
                      </select>}
                </div>
              )}

              {mode === 'phones' && (
                <div>
                  <div style={s.labelRow}>
                    <label style={s.label}>Phone Numbers</label>
                    <span style={s.labelHint}>{phones.split(/[\n,;]+/).filter(p => p.trim()).length} entered</span>
                  </div>
                  <textarea value={phones} onChange={e => setPhones(e.target.value)} placeholder={'+919876543210\n+919999000001'} rows={4} style={{ ...s.input, resize: 'vertical', fontFamily: 'monospace', fontSize: 13 }} />
                </div>
              )}

              {mode === 'nearby' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={s.twoColSmall}>
                    <div><label style={s.label}>Latitude</label><input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="19.076" style={s.input} /></div>
                    <div><label style={s.label}>Longitude</label><input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="72.877" style={s.input} /></div>
                  </div>
                  <div><label style={s.label}>Radius (km)</label><input type="number" value={radiusKm} onChange={e => setRadiusKm(e.target.value)} placeholder="5" style={{ ...s.input, maxWidth: 100 }} /></div>
                </div>
              )}

              {mode === 'all_registered' && (
                <div style={s.warningBox}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                  <div>
                    <p style={{ fontSize: 13, fontWeight: 700, color: '#B45309', margin: '0 0 3px' }}>Broad Broadcast Warning</p>
                    <p style={{ fontSize: 12.5, color: '#92400E', margin: 0 }}>This sends SMS to every registered user. Each message costs money. Use only for national emergencies.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Right: Message + Send */}
          <div style={s.rightCol}>

            {/* Compose */}
            <div style={s.card}>
              <p style={s.stepLabel}>Step 3 — Compose Message</p>

              {/* Templates */}
              <div style={s.templateRow}>
                {TEMPLATES.map((t, i) => (
                  <button key={i} onClick={() => setMessage(t.text)} style={s.templateChip}>{t.label}</button>
                ))}
              </div>

              <textarea value={message} onChange={e => setMessage(e.target.value)} placeholder="Type your emergency message here…" rows={5} style={{ ...s.input, resize: 'vertical', marginBottom: 6 }} />
              <div style={s.charRow}>
                <span style={{ ...s.charCount, color: charCount > 140 ? '#D97706' : '#9CA3AF' }}>{charCount}/160</span>
                {charCount > 160 && <span style={{ fontSize: 12, color: '#D97706' }}>Will send as multi-part SMS</span>}
              </div>
            </div>

            {/* Preview & Send */}
            <div style={s.card}>
              <p style={s.stepLabel}>Step 4 — Review &amp; Send</p>

              <div style={s.previewBox}>
                <p style={s.previewLabel}>SMS Preview</p>
                <p style={s.previewText}>🚨 SAHAAY: {message || '(empty message)'}</p>
                <p style={s.previewMeta}>
                  Mode: <strong>{MODES.find(m => m.id === mode)?.label}</strong>
                  {mode === 'camp' && selectedCampName && <> · {selectedCampName}</>}
                </p>
              </div>

              {error && (
                <div style={s.errorBox}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  {error}
                </div>
              )}

              <button onClick={sendAlert} disabled={sending || !message.trim()} style={{ ...s.sendBtn, opacity: (sending || !message.trim()) ? 0.6 : 1 }}>
                {sending ? <><span style={s.spinner2} /> Sending…</> : <>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  Send SMS Alert
                </>}
              </button>

              {result && (
                <div style={{ ...s.resultBox, background: result.sent > 0 ? '#ECFDF5' : '#FFFBEB', borderColor: result.sent > 0 ? '#A7F3D0' : '#FDE68A' }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: result.sent > 0 ? '#059669' : '#D97706', margin: '0 0 8px' }}>
                    {result.sent > 0 ? '✓ SMS Sent' : result.queued ? 'Queued' : 'No recipients found'}
                  </p>
                  <div style={s.resultStats}>
                    {result.sent != null && <ResultStat label="Sent" value={result.sent} color="#059669" />}
                    {result.failed > 0 && <ResultStat label="Failed" value={result.failed} color="#DC2626" />}
                    {result.queued > 0 && <ResultStat label="Queued" value={result.queued} color="#D97706" />}
                    {result.total > 0 && <ResultStat label="Total" value={result.total} color="#6B7280" />}
                  </div>
                  {result.message && <p style={{ fontSize: 12.5, color: '#6B7280', margin: '8px 0 0' }}>{result.message}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <h2 style={s.cardTitle}>Send History (this session)</h2>
              <span style={s.cardMeta}>{history.length} sent</span>
            </div>
            <div style={s.historyList}>
              {history.map((h, i) => (
                <div key={i} style={s.historyRow}>
                  <div style={s.historyIconWrap}>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={s.historyMsg}>{h.message}</p>
                    <p style={s.historyMeta}>{MODES.find(m => m.id === h.mode)?.label} · {h.time}</p>
                  </div>
                  <span style={{ fontSize: 12.5, fontWeight: 600, color: h.sent > 0 ? '#059669' : '#D97706', whiteSpace: 'nowrap' }}>
                    {h.sent > 0 ? `${h.sent} sent` : h.queued > 0 ? `${h.queued} queued` : 'no recipients'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function ResultStat({ label, value, color }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 18, fontWeight: 800, color, margin: '0 0 1px', letterSpacing: '-0.5px' }}>{value}</p>
      <p style={{ fontSize: 11, color: '#9CA3AF', margin: 0 }}>{label}</p>
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
  twoColSmall: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },
  leftCol: { display: 'flex', flexDirection: 'column', gap: 18 },
  rightCol: { display: 'flex', flexDirection: 'column', gap: 18 },
  card: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 },
  cardMeta: { fontSize: 12.5, color: '#9CA3AF' },
  stepLabel: { fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 14px' },
  modeGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9 },
  modeCard: { padding: '13px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, cursor: 'pointer', textAlign: 'left', fontFamily: FONT, transition: 'all 0.15s' },
  modeCardActive: { background: '#EFF6FF', borderColor: '#BFDBFE', boxShadow: '0 0 0 2px #BFDBFE' },
  modeIcon: { marginBottom: 8, display: 'flex' },
  modeLabel: { fontSize: 13, fontWeight: 700, margin: '0 0 3px', transition: 'color 0.15s' },
  modeDesc: { fontSize: 11.5, color: '#9CA3AF', margin: 0, lineHeight: 1.4 },
  label: { display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 },
  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 },
  labelHint: { fontSize: 12, color: '#9CA3AF' },
  input: { width: '100%', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, color: '#0F172A', fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', outline: 'none' },
  warningBox: { display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9, padding: '12px 14px' },
  templateRow: { display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 },
  templateChip: { padding: '4px 10px', fontSize: 12, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 6, color: '#6B7280', cursor: 'pointer', fontFamily: FONT },
  charRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  charCount: { fontSize: 12, fontWeight: 500 },
  previewBox: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '13px 14px', marginBottom: 12 },
  previewLabel: { fontSize: 10.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 7px' },
  previewText: { fontSize: 13.5, color: '#0F172A', margin: '0 0 8px', lineHeight: 1.55, whiteSpace: 'pre-wrap' },
  previewMeta: { fontSize: 12, color: '#9CA3AF', margin: 0 },
  errorBox: { display: 'flex', gap: 8, alignItems: 'center', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, padding: '10px 12px', color: '#DC2626', fontSize: 13.5, marginBottom: 12 },
  sendBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '13px', background: '#DC2626', color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 2px 10px rgba(220,38,38,0.25)', transition: 'opacity 0.15s' },
  spinner2: { width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },
  resultBox: { marginTop: 12, padding: '14px', borderRadius: 10, border: '1px solid' },
  resultStats: { display: 'flex', gap: 24 },
  historyList: { display: 'flex', flexDirection: 'column', gap: 8 },
  historyRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: '#F8FAFC', border: '1px solid #F1F5F9', borderRadius: 9 },
  historyIconWrap: { width: 34, height: 34, borderRadius: 8, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  historyMsg: { fontSize: 13, color: '#0F172A', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 600 },
  historyMeta: { fontSize: 11.5, color: '#9CA3AF', margin: '2px 0 0' },
};
