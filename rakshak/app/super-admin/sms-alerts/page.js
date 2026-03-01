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

export default function SMSAlertPage() {
  return (
    <RoleGate allowedRole="super_admin">
      <SMSAlertContent />
    </RoleGate>
  );
}

function SMSAlertContent() {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form state
  const [mode, setMode] = useState('camp');
  const [message, setMessage] = useState('');
  const [campId, setCampId] = useState('');
  const [phones, setPhones] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [radiusKm, setRadiusKm] = useState('5');

  // Result
  const [sending, setSending] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  // Load camps
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

  const MODES = [
    { id: 'camp', label: 'Camp Users', icon: '🏕️', desc: 'All victims checked into a specific camp' },
    { id: 'all_registered', label: 'All Users', icon: '📢', desc: 'Every registered user with a phone number' },
    { id: 'nearby', label: 'Nearby Area', icon: '📍', desc: 'Users within a radius of a location' },
    { id: 'phones', label: 'Direct Numbers', icon: '📱', desc: 'Manually enter specific phone numbers' },
  ];

  const TEMPLATES = [
    { label: 'Evacuation Warning', text: 'URGENT: Evacuation order issued for your area. Move to the nearest safe zone immediately. Stay calm and follow instructions from camp staff.' },
    { label: 'Supply Incoming', text: 'Relief supplies are being dispatched to your camp. Distribution will begin within 2-4 hours. Please stay at your camp.' },
    { label: 'Weather Alert', text: 'Severe weather warning: Heavy rainfall expected in the next 6-12 hours. Seek shelter and avoid low-lying areas.' },
    { label: 'Camp Relocation', text: 'Your camp is being relocated to a safer zone. Please gather your belongings and wait for transport instructions from camp staff.' },
    { label: 'Medical Camp', text: 'A medical camp is operational at your location. If you or your family need medical attention, please visit the medical tent.' },
  ];

  const sendAlert = async () => {
    setError('');
    setResult(null);
    if (!message.trim()) return setError('Message cannot be empty');

    const body = { mode, message: message.trim() };

    if (mode === 'camp') {
      if (!campId) return setError('Select a camp');
      body.camp_id = campId;
    } else if (mode === 'phones') {
      const phoneList = phones.split(/[\n,;]+/).map(p => p.trim()).filter(Boolean).map(p =>
        p.startsWith('+91') ? p : `+91${p.replace(/\D/g, '')}`
      );
      if (phoneList.length === 0) return setError('Enter at least one phone number');
      body.phones = phoneList;
    } else if (mode === 'nearby') {
      if (!lat || !lng) return setError('Enter latitude and longitude');
      body.lat = parseFloat(lat);
      body.lng = parseFloat(lng);
      body.radius_km = parseFloat(radiusKm) || 5;
    }

    setSending(true);
    try {
      const res = await fetch('/api/sms-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send');
      setResult(data);
      setHistory(prev => [{ ...data, mode, message: message.trim(), time: new Date().toLocaleTimeString() }, ...prev]);
    } catch (err) {
      setError(err.message);
    }
    setSending(false);
  };

  const selectedCampName = camps.find(c => c.id === campId)?.name || '';

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', padding: '24px', fontFamily: 'system-ui, sans-serif', color: '#E2E8F0' }}>
      <div style={{ maxWidth: 800, margin: '0 auto' }}>

        {/* Header */}
        <div style={{ background: '#1E293B', borderRadius: 16, border: '1px solid #334155', padding: 24, marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px' }}>📲 SMS Alert Broadcast</h1>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
                Send emergency SMS to affected users via Twilio — works even when internet is down
              </p>
            </div>
            <a href="/super-admin/dashboard" style={{ color: '#60A5FA', fontSize: 13, textDecoration: 'none' }}>
              ← Back to Dashboard
            </a>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Left: Form */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Mode selector */}
            <div style={panel}>
              <h3 style={sectionTitle}>1. Select Recipients</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {MODES.map(m => (
                  <button
                    key={m.id}
                    onClick={() => setMode(m.id)}
                    style={{
                      padding: '12px 10px', background: mode === m.id ? 'rgba(59,130,246,0.12)' : '#0F172A',
                      border: `1px solid ${mode === m.id ? '#3B82F6' : '#334155'}`, borderRadius: 10,
                      cursor: 'pointer', textAlign: 'left', color: '#E2E8F0',
                    }}
                  >
                    <div style={{ fontSize: 18, marginBottom: 4 }}>{m.icon}</div>
                    <div style={{ fontSize: 13, fontWeight: 600 }}>{m.label}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{m.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Mode-specific fields */}
            <div style={panel}>
              <h3 style={sectionTitle}>2. Target Details</h3>

              {mode === 'camp' && (
                <div>
                  <label style={labelStyle}>Camp</label>
                  {loading ? (
                    <p style={{ color: '#64748B', fontSize: 13 }}>Loading camps…</p>
                  ) : camps.length === 0 ? (
                    <p style={{ color: '#EAB308', fontSize: 13 }}>No active camps found</p>
                  ) : (
                    <select
                      value={campId}
                      onChange={e => setCampId(e.target.value)}
                      style={inputStyle}
                    >
                      {camps.map(c => (
                        <option key={c.id} value={c.id}>{c.name} ({c.code})</option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              {mode === 'phones' && (
                <div>
                  <label style={labelStyle}>Phone Numbers (one per line or comma-separated)</label>
                  <textarea
                    value={phones}
                    onChange={e => setPhones(e.target.value)}
                    placeholder={'+919876543210\n+919999000001\n...'}
                    rows={4}
                    style={{ ...inputStyle, resize: 'vertical', fontFamily: 'monospace' }}
                  />
                  <p style={{ fontSize: 11, color: '#64748B', margin: '4px 0 0' }}>
                    {phones.split(/[\n,;]+/).filter(p => p.trim()).length} number(s) entered
                  </p>
                </div>
              )}

              {mode === 'nearby' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    <div>
                      <label style={labelStyle}>Latitude</label>
                      <input type="number" step="any" value={lat} onChange={e => setLat(e.target.value)} placeholder="19.076" style={inputStyle} />
                    </div>
                    <div>
                      <label style={labelStyle}>Longitude</label>
                      <input type="number" step="any" value={lng} onChange={e => setLng(e.target.value)} placeholder="72.877" style={inputStyle} />
                    </div>
                  </div>
                  <div>
                    <label style={labelStyle}>Radius (km)</label>
                    <input type="number" value={radiusKm} onChange={e => setRadiusKm(e.target.value)} placeholder="5" style={{ ...inputStyle, maxWidth: 120 }} />
                  </div>
                </div>
              )}

              {mode === 'all_registered' && (
                <div style={{ padding: '12px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 10 }}>
                  <p style={{ fontSize: 13, color: '#EAB308', margin: 0, fontWeight: 600 }}>⚠ Warning</p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: '4px 0 0' }}>
                    This will send SMS to <strong>every registered user</strong> in the system. Use with caution — each SMS costs money.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Right: Message + Send */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {/* Message templates */}
            <div style={panel}>
              <h3 style={sectionTitle}>3. Compose Message</h3>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {TEMPLATES.map((t, i) => (
                  <button
                    key={i}
                    onClick={() => setMessage(t.text)}
                    style={{
                      padding: '4px 10px', fontSize: 11, background: '#0F172A', border: '1px solid #334155',
                      borderRadius: 6, color: '#94A3B8', cursor: 'pointer',
                    }}
                  >
                    {t.label}
                  </button>
                ))}
              </div>

              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Type your emergency message here…"
                rows={5}
                style={{ ...inputStyle, resize: 'vertical' }}
              />
              <p style={{ fontSize: 11, color: message.length > 140 ? '#EAB308' : '#64748B', margin: '4px 0 0' }}>
                {message.length}/160 chars {message.length > 160 && '(will be sent as multi-part SMS)'}
              </p>
            </div>

            {/* Preview + Send */}
            <div style={panel}>
              <h3 style={sectionTitle}>4. Review & Send</h3>

              <div style={{ padding: '12px 14px', background: '#0F172A', borderRadius: 10, border: '1px solid #334155', marginBottom: 12 }}>
                <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 6px' }}>PREVIEW</p>
                <p style={{ fontSize: 13, color: '#E2E8F0', margin: 0, whiteSpace: 'pre-wrap' }}>
                  🚨 RAKSHAK: {message || '(empty message)'}
                </p>
                <p style={{ fontSize: 11, color: '#64748B', margin: '8px 0 0' }}>
                  Mode: <strong style={{ color: '#94A3B8' }}>{MODES.find(m => m.id === mode)?.label}</strong>
                  {mode === 'camp' && selectedCampName && <> · Camp: <strong style={{ color: '#94A3B8' }}>{selectedCampName}</strong></>}
                </p>
              </div>

              {error && <p style={{ color: '#EF4444', fontSize: 13, margin: '0 0 8px' }}>{error}</p>}

              <button
                onClick={sendAlert}
                disabled={sending || !message.trim()}
                style={{
                  width: '100%', padding: 14,
                  background: sending ? '#334155' : 'linear-gradient(135deg, #EF4444, #DC2626)',
                  color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
                  cursor: sending ? 'not-allowed' : 'pointer', boxShadow: '0 4px 14px rgba(239,68,68,0.3)',
                  opacity: sending || !message.trim() ? 0.6 : 1,
                }}
              >
                {sending ? '📡 Sending…' : '🚨 Send SMS Alert'}
              </button>

              {/* Result */}
              {result && (
                <div style={{
                  marginTop: 12, padding: '12px 14px', borderRadius: 10,
                  background: result.sent > 0 ? 'rgba(74,222,128,0.08)' : 'rgba(234,179,8,0.08)',
                  border: `1px solid ${result.sent > 0 ? 'rgba(74,222,128,0.2)' : 'rgba(234,179,8,0.2)'}`,
                }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: result.sent > 0 ? '#4ADE80' : '#EAB308', margin: '0 0 6px' }}>
                    {result.sent > 0 ? '✅ SMS Sent' : result.queued ? '📋 Queued' : '⚠ No recipients'}
                  </p>
                  <div style={{ display: 'flex', gap: 16, fontSize: 13, color: '#94A3B8' }}>
                    {result.sent != null && <span>Sent: <strong style={{ color: '#4ADE80' }}>{result.sent}</strong></span>}
                    {result.failed > 0 && <span>Failed: <strong style={{ color: '#EF4444' }}>{result.failed}</strong></span>}
                    {result.queued > 0 && <span>Queued: <strong style={{ color: '#EAB308' }}>{result.queued}</strong></span>}
                    {result.total > 0 && <span>Total: <strong>{result.total}</strong></span>}
                  </div>
                  {result.message && <p style={{ fontSize: 12, color: '#64748B', margin: '6px 0 0' }}>{result.message}</p>}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* History */}
        {history.length > 0 && (
          <div style={{ ...panel, marginTop: 16 }}>
            <h3 style={sectionTitle}>Send History (this session)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#0F172A', borderRadius: 8, border: '1px solid #1E293B',
                }}>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 13, color: '#E2E8F0', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 500 }}>
                      {h.message}
                    </p>
                    <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>
                      {h.mode} · {h.time}
                    </p>
                  </div>
                  <div style={{ fontSize: 12, color: h.sent > 0 ? '#4ADE80' : '#EAB308', fontWeight: 600, whiteSpace: 'nowrap' }}>
                    {h.sent > 0 ? `${h.sent} sent` : h.queued > 0 ? `${h.queued} queued` : 'no recipients'}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const panel = {
  background: '#1E293B', borderRadius: 14, border: '1px solid #334155', padding: 20,
};
const sectionTitle = {
  fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: '0 0 12px',
};
const labelStyle = {
  display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6,
};
const inputStyle = {
  width: '100%', padding: '10px 12px', background: '#0F172A', border: '1px solid #334155',
  borderRadius: 8, color: '#E2E8F0', fontSize: 14, outline: 'none', boxSizing: 'border-box',
};
