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

export default function DisasterSimPage() {
  return (
    <RoleGate allowedRole="super_admin">
      <SimulationContent />
    </RoleGate>
  );
}

const DISASTER_TYPES = [
  { id: 'FLOOD', label: 'Flood', icon: '🌊', color: '#3B82F6', desc: 'Heavy rainfall — river levels rising rapidly' },
  { id: 'EARTHQUAKE', label: 'Earthquake', icon: '🔴', color: '#EF4444', desc: 'Seismic activity — magnitude 5.2 tremor' },
  { id: 'LANDSLIDE', label: 'Landslide', icon: '⛰️', color: '#A16207', desc: 'Continuous rainfall in hilly terrain' },
  { id: 'CYCLONE', label: 'Cyclone', icon: '🌀', color: '#7C3AED', desc: 'Cyclonic storm — winds exceeding 120 km/h' },
];

const SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

function SimulationContent() {
  const [camps, setCamps] = useState([]);
  const [loading, setLoading] = useState(true);

  // Form
  const [campId, setCampId] = useState('');
  const [disasterType, setDisasterType] = useState('FLOOD');
  const [severity, setSeverity] = useState('HIGH');

  // State
  const [triggering, setTriggering] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);
  const [recentAlerts, setRecentAlerts] = useState([]);

  // Load camps
  const fetchCamps = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await supabase.from('camps').select('id, name, code, lat, lng, status').eq('status', 'active');
      setCamps(data || []);
      if (data?.length > 0) setCampId(data[0].id);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  // Load recent alerts
  const fetchAlerts = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts');
      const data = await res.json();
      setRecentAlerts((data.alerts || []).slice(0, 10));
    } catch (e) { console.error(e); }
  }, []);

  useEffect(() => { fetchCamps(); fetchAlerts(); }, [fetchCamps, fetchAlerts]);

  // Realtime alerts
  useEffect(() => {
    const ch = supabase
      .channel('sim-alerts')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'camp_alerts' }, () => fetchAlerts())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchAlerts]);

  const triggerDisaster = async () => {
    setError('');
    setResult(null);
    if (!campId) return setError('Select a camp');

    setTriggering(true);
    try {
      const res = await fetch('/api/dummy-disaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camp_id: campId,
          disaster_type: disasterType,
          severity,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to trigger');
      setResult(data);
      const campName = camps.find(c => c.id === campId)?.name || campId;
      setHistory(prev => [{
        type: disasterType, severity, campName,
        message: data.message, time: new Date().toLocaleTimeString(),
        alertId: data.alert?.id,
      }, ...prev]);
      fetchAlerts();
    } catch (err) {
      setError(err.message);
    }
    setTriggering(false);
  };

  const selectedCamp = camps.find(c => c.id === campId);

  return (
    <div style={{ minHeight: '100vh', background: '#0F172A', padding: 24, fontFamily: 'system-ui, sans-serif', color: '#E2E8F0' }}>
      <div style={{ maxWidth: 900, margin: '0 auto' }}>

        {/* Header */}
        <div style={panel}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
            <div>
              <h1 style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px' }}>⚡ Disaster Simulation</h1>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: 0 }}>
                Trigger test disaster scenarios for camps — creates pending alerts in the pipeline
              </p>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <a href="/super-admin/dashboard" style={linkBtnStyle}>← Dashboard</a>
              <a href="/super-admin/sms-alerts" style={linkBtnStyle}>📲 SMS Alerts</a>
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {/* Left column: Configuration */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Disaster type picker */}
            <div style={panel}>
              <h3 style={sectionTitle}>1. Disaster Type</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {DISASTER_TYPES.map(d => (
                  <button
                    key={d.id}
                    onClick={() => setDisasterType(d.id)}
                    style={{
                      padding: '14px 12px', textAlign: 'left', cursor: 'pointer', color: '#E2E8F0',
                      background: disasterType === d.id ? `${d.color}15` : '#0F172A',
                      border: `1px solid ${disasterType === d.id ? d.color : '#334155'}`,
                      borderRadius: 10, transition: 'all 0.15s',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 4 }}>{d.icon}</div>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{d.label}</div>
                    <div style={{ fontSize: 11, color: '#64748B', marginTop: 2 }}>{d.desc}</div>
                  </button>
                ))}
              </div>
            </div>

            {/* Camp + Severity */}
            <div style={panel}>
              <h3 style={sectionTitle}>2. Target Camp & Severity</h3>

              <div style={{ marginBottom: 14 }}>
                <label style={labelStyle}>Camp</label>
                {loading ? (
                  <p style={{ color: '#64748B', fontSize: 13, margin: 0 }}>Loading camps…</p>
                ) : camps.length === 0 ? (
                  <p style={{ color: '#EAB308', fontSize: 13, margin: 0 }}>No active camps</p>
                ) : (
                  <select value={campId} onChange={e => setCampId(e.target.value)} style={inputStyle}>
                    {camps.map(c => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.code || 'no code'})
                      </option>
                    ))}
                  </select>
                )}
                {selectedCamp && (
                  <p style={{ fontSize: 11, color: '#64748B', margin: '4px 0 0' }}>
                    Location: {selectedCamp.lat?.toFixed(4)}, {selectedCamp.lng?.toFixed(4)}
                  </p>
                )}
              </div>

              <div>
                <label style={labelStyle}>Severity</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  {SEVERITIES.map(s => {
                    const colors = { LOW: '#22C55E', MEDIUM: '#EAB308', HIGH: '#F97316', CRITICAL: '#EF4444' };
                    return (
                      <button
                        key={s}
                        onClick={() => setSeverity(s)}
                        style={{
                          flex: 1, padding: '8px 4px', fontSize: 12, fontWeight: 600, cursor: 'pointer',
                          background: severity === s ? `${colors[s]}20` : '#0F172A',
                          border: `1px solid ${severity === s ? colors[s] : '#334155'}`,
                          borderRadius: 8, color: severity === s ? colors[s] : '#64748B',
                        }}
                      >
                        {s}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          {/* Right column: Preview + trigger */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>

            {/* Preview + Trigger */}
            <div style={panel}>
              <h3 style={sectionTitle}>3. Trigger Simulation</h3>

              <div style={{ padding: 14, background: '#0F172A', borderRadius: 10, border: '1px solid #334155', marginBottom: 14 }}>
                <p style={{ fontSize: 11, color: '#64748B', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>Preview</p>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 28 }}>{DISASTER_TYPES.find(d => d.id === disasterType)?.icon}</span>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
                      {disasterType} — {severity}
                    </p>
                    <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>
                      {selectedCamp?.name || 'Select a camp'}
                    </p>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#94A3B8', margin: 0, fontStyle: 'italic' }}>
                  {DISASTER_TYPES.find(d => d.id === disasterType)?.desc}
                </p>
              </div>

              <div style={{ padding: '10px 14px', background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.2)', borderRadius: 10, marginBottom: 14 }}>
                <p style={{ fontSize: 12, color: '#EAB308', margin: 0 }}>
                  ⚠ This creates a <strong>pending</strong> alert in the system. It will appear in the Admin Dashboard for approval.
                </p>
              </div>

              {error && <p style={{ color: '#EF4444', fontSize: 13, margin: '0 0 8px' }}>{error}</p>}

              <button
                onClick={triggerDisaster}
                disabled={triggering || !campId}
                style={{
                  width: '100%', padding: 14,
                  background: triggering ? '#334155' : 'linear-gradient(135deg, #F97316, #EF4444)',
                  color: 'white', border: 'none', borderRadius: 10, fontSize: 16, fontWeight: 700,
                  cursor: triggering ? 'not-allowed' : 'pointer',
                  boxShadow: '0 4px 14px rgba(249,115,22,0.3)',
                  opacity: triggering || !campId ? 0.6 : 1,
                }}
              >
                {triggering ? '⚡ Triggering…' : '⚡ Trigger Disaster'}
              </button>

              {result && (
                <div style={{
                  marginTop: 12, padding: 14, borderRadius: 10,
                  background: 'rgba(74,222,128,0.08)', border: '1px solid rgba(74,222,128,0.2)',
                }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#4ADE80', margin: '0 0 4px' }}>✅ Disaster Triggered</p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>{result.message}</p>
                  {result.alert?.id && (
                    <p style={{ fontSize: 11, color: '#64748B', margin: '6px 0 0' }}>Alert ID: {result.alert.id}</p>
                  )}
                </div>
              )}
            </div>

            {/* Recent alerts */}
            <div style={panel}>
              <h3 style={sectionTitle}>Recent Alerts</h3>
              {recentAlerts.length === 0 ? (
                <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>No alerts yet</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 220, overflowY: 'auto' }}>
                  {recentAlerts.map((a, i) => (
                    <div key={a.id || i} style={{
                      display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                      padding: '8px 12px', background: '#0F172A', borderRadius: 8, border: '1px solid #1E293B',
                    }}>
                      <div>
                        <p style={{ fontSize: 12, fontWeight: 600, color: '#E2E8F0', margin: 0 }}>
                          {a.disaster_type || a.type} — {a.location_name || a.camp_id?.slice(0, 8)}
                        </p>
                        <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>
                          {a.severity} · {a.status}
                        </p>
                      </div>
                      <span style={{
                        fontSize: 10, padding: '2px 8px', borderRadius: 6, fontWeight: 600,
                        background: a.status === 'pending' ? 'rgba(234,179,8,0.15)' : a.status === 'active' ? 'rgba(239,68,68,0.15)' : 'rgba(74,222,128,0.15)',
                        color: a.status === 'pending' ? '#EAB308' : a.status === 'active' ? '#EF4444' : '#4ADE80',
                      }}>
                        {a.status?.toUpperCase()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Trigger history */}
        {history.length > 0 && (
          <div style={{ ...panel, marginTop: 16 }}>
            <h3 style={sectionTitle}>Simulation History (this session)</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {history.map((h, i) => (
                <div key={i} style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '10px 14px', background: '#0F172A', borderRadius: 8, border: '1px solid #1E293B',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 18 }}>{DISASTER_TYPES.find(d => d.id === h.type)?.icon || '⚡'}</span>
                    <div>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#E2E8F0', margin: 0 }}>
                        {h.type} — {h.campName}
                      </p>
                      <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>
                        {h.severity} · {h.time}
                      </p>
                    </div>
                  </div>
                  <span style={{ fontSize: 12, color: '#4ADE80', fontWeight: 600 }}>✅ Triggered</span>
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
const linkBtnStyle = {
  padding: '6px 14px', background: '#0F172A', border: '1px solid #334155',
  borderRadius: 8, color: '#60A5FA', fontSize: 13, textDecoration: 'none',
};
