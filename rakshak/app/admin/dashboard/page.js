'use client';

import { useState, useEffect } from 'react';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';

const TABS = [
  { id: 'overview', label: 'Overview', icon: '📊' },
  { id: 'camps', label: 'All Camps', icon: '🏕️' },
  { id: 'resources', label: 'Resources', icon: '📦' },
  { id: 'missing', label: 'Missing Reports', icon: '🔍' },
  { id: 'alerts', label: 'Alerts', icon: '🔔' },
];

export default function AdminDashboard() {
  return (
    <RoleGate allowedRole="super_admin">
      <AdminContent />
    </RoleGate>
  );
}

function AdminContent() {
  const [activeTab, setActiveTab] = useState('overview');
  const [camps, setCamps] = useState([]);
  const [missingReports, setMissingReports] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalCamps: 0, totalMissing: 0, totalCheckedIn: 0 });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [campsRes, usersCount, missingRes, alertsRes, checkinCount] = await Promise.all([
        supabase.from('camps').select('*').order('created_at', { ascending: false }),
        supabase.from('users').select('id', { count: 'exact', head: true }),
        supabase.from('missing_reports').select('*').order('created_at', { ascending: false }).limit(50),
        supabase.from('alerts').select('*').order('created_at', { ascending: false }).limit(20),
        supabase.from('camp_victims').select('id', { count: 'exact', head: true }),
      ]);

      setCamps(campsRes.data || []);
      setMissingReports(missingRes.data || []);
      setAlerts(alertsRes.data || []);
      setStats({
        totalUsers: usersCount.count || 0,
        totalCamps: (campsRes.data || []).length,
        totalMissing: (missingRes.data || []).filter(r => r.status === 'active').length,
        totalCheckedIn: checkinCount.count || 0,
      });
    } catch (err) {
      console.error('Failed to load admin data:', err);
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await supabase.auth.signOut();
    window.location.href = '/';
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Super Admin</h1>
          <p style={s.subtitle}>System-wide oversight</p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={loadData} style={s.refreshBtn}>↻</button>
          <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      <div style={s.content}>
        {loading && <p style={{ color: '#94A3B8', textAlign: 'center' }}>Loading...</p>}

        {!loading && activeTab === 'overview' && (
          <OverviewTab stats={stats} camps={camps} />
        )}
        {!loading && activeTab === 'camps' && (
          <CampsTab camps={camps} onRefresh={loadData} />
        )}
        {!loading && activeTab === 'resources' && (
          <ResourcesOverviewTab />
        )}
        {!loading && activeTab === 'missing' && (
          <MissingTab reports={missingReports} onRefresh={loadData} />
        )}
        {!loading && activeTab === 'alerts' && (
          <AlertsTab alerts={alerts} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// OVERVIEW TAB
// ═══════════════════════════════════════════════════════════

function OverviewTab({ stats, camps }) {
  const statCards = [
    { label: 'Registered Users', value: stats.totalUsers, color: '#3B82F6' },
    { label: 'Active Camps', value: stats.totalCamps, color: '#22C55E' },
    { label: 'Checked In', value: stats.totalCheckedIn, color: '#8B5CF6' },
    { label: 'Active Missing', value: stats.totalMissing, color: '#EF4444' },
  ];

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 }}>
        {statCards.map((sc, i) => (
          <div key={i} style={{ ...s.statCard, borderLeftColor: sc.color }}>
            <p style={{ fontSize: 24, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>{sc.value}</p>
            <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{sc.label}</p>
          </div>
        ))}
      </div>

      <h3 style={s.sectionTitle}>Camp Capacities</h3>
      {camps.map(camp => (
        <div key={camp.id} style={s.campRow}>
          <div>
            <p style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', margin: 0 }}>{camp.name}</p>
            <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0' }}>
              {camp.operator_name} • {camp.operator_phone}
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <span style={{
              ...s.statusBadge,
              background: camp.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
              color: camp.status === 'active' ? '#86EFAC' : '#FCA5A5',
            }}>
              {camp.status || 'active'}
            </span>
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ALL CAMPS TAB
// ═══════════════════════════════════════════════════════════

function CampsTab({ camps, onRefresh }) {
  const [expandedCamp, setExpandedCamp] = useState(null);
  const [campDetails, setCampDetails] = useState(null);

  const viewCamp = async (camp) => {
    if (expandedCamp === camp.id) { setExpandedCamp(null); setCampDetails(null); return; }
    setExpandedCamp(camp.id);

    try {
      const res = await fetch(`/api/camps?id=${camp.id}`);
      const data = await res.json();
      setCampDetails(data.camp);
    } catch {
      setCampDetails(null);
    }
  };

  const toggleCampStatus = async (camp) => {
    const newStatus = camp.status === 'active' ? 'inactive' : 'active';
    await supabase.from('camps').update({ status: newStatus }).eq('id', camp.id);
    onRefresh();
  };

  return (
    <div>
      <h3 style={s.sectionTitle}>All Camps ({camps.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {camps.map(camp => (
          <div key={camp.id}>
            <div style={s.campCard} onClick={() => viewCamp(camp)}>
              <div style={{ flex: 1 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{camp.name}</p>
                <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                  {camp.operator_name} • {camp.camp_code || 'No code'} • {camp.radius_km}km radius
                </p>
                <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>
                  {camp.lat?.toFixed(4)}, {camp.lng?.toFixed(4)}
                </p>
              </div>
              <span style={{
                ...s.statusBadge,
                background: camp.status === 'active' ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)',
                color: camp.status === 'active' ? '#86EFAC' : '#FCA5A5',
              }}>
                {camp.status || 'active'}
              </span>
            </div>

            {expandedCamp === camp.id && (
              <div style={s.campExpanded}>
                {campDetails && (
                  <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 8px' }}>
                    Victims: <strong style={{ color: '#F1F5F9' }}>{campDetails.victim_count || 0}</strong>
                    {campDetails.helpline_number && <> • Helpline: <strong style={{ color: '#F1F5F9' }}>{campDetails.helpline_number}</strong></>}
                  </p>
                )}
                <button onClick={() => toggleCampStatus(camp)} style={{
                  ...s.smallBtn,
                  background: camp.status === 'active' ? 'rgba(239,68,68,0.15)' : 'rgba(34,197,94,0.15)',
                  color: camp.status === 'active' ? '#FCA5A5' : '#86EFAC',
                }}>
                  {camp.status === 'active' ? 'Deactivate Camp' : 'Reactivate Camp'}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MISSING REPORTS TAB
// ═══════════════════════════════════════════════════════════

function MissingTab({ reports, onRefresh }) {
  const updateStatus = async (id, newStatus) => {
    await supabase.from('missing_reports').update({
      status: newStatus,
      updated_at: new Date().toISOString(),
    }).eq('id', id);
    onRefresh();
  };

  if (reports.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: 40 }}>
        <p style={{ fontSize: 28, margin: '0 0 8px' }}>🔍</p>
        <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>No missing person reports</p>
      </div>
    );
  }

  return (
    <div>
      <h3 style={s.sectionTitle}>Missing Reports ({reports.length})</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {reports.map(r => (
          <div key={r.id} style={s.missingCard}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
              <div>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>
                  {r.name || 'Unknown'}
                </p>
                <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>
                  {r.relationship || ''} • Age: {r.age || '?'} • {r.gender || ''}
                </p>
              </div>
              <span style={{
                ...s.statusBadge,
                background: r.status === 'active' ? 'rgba(239,68,68,0.15)' : r.status === 'reunited' ? 'rgba(34,197,94,0.15)' : 'rgba(234,179,8,0.15)',
                color: r.status === 'active' ? '#FCA5A5' : r.status === 'reunited' ? '#86EFAC' : '#FDE68A',
              }}>
                {r.status}
              </span>
            </div>

            {r.last_known_location && (
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0' }}>
                Last seen: {r.last_known_location}
              </p>
            )}
            {r.identifying_details && (
              <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0' }}>
                Details: {r.identifying_details}
              </p>
            )}
            {r.matched_camp_name && (
              <p style={{ fontSize: 12, color: '#86EFAC', margin: '4px 0 0', fontWeight: 600 }}>
                Possible match at: {r.matched_camp_name} ({(r.match_confidence * 100).toFixed(0)}%)
              </p>
            )}

            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {r.status === 'active' && (
                <button onClick={() => updateStatus(r.id, 'under_review')} style={{ ...s.smallBtn, background: 'rgba(234,179,8,0.15)', color: '#FDE68A' }}>
                  Mark Under Review
                </button>
              )}
              {(r.status === 'active' || r.status === 'match_found' || r.status === 'under_review') && (
                <button onClick={() => updateStatus(r.id, 'reunited')} style={{ ...s.smallBtn, background: 'rgba(34,197,94,0.15)', color: '#86EFAC' }}>
                  Mark Reunited
                </button>
              )}
              {r.status !== 'closed' && (
                <button onClick={() => updateStatus(r.id, 'closed')} style={{ ...s.smallBtn, background: 'rgba(100,116,139,0.15)', color: '#94A3B8' }}>
                  Close
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RESOURCES OVERVIEW TAB — system-wide supply dashboard
// ═══════════════════════════════════════════════════════════

function ResourcesOverviewTab() {
  const [allResources, setAllResources] = useState([]);
  const [campsWithout, setCampsWithout] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/camp-resources?all=true')
      .then(r => r.json())
      .then(d => {
        setAllResources(d.resources || []);
        setCampsWithout(d.campsWithoutResources || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p style={{ color: '#94A3B8', textAlign: 'center' }}>Loading resources...</p>;

  const statusColor = (val) => {
    if (val === 'adequate' || val === 'available') return '#22C55E';
    if (val === 'low' || val === 'generator' || val === 'intermittent') return '#F59E0B';
    return '#EF4444';
  };

  const statusBg = (val) => {
    if (val === 'adequate' || val === 'available') return 'rgba(34,197,94,0.15)';
    if (val === 'low' || val === 'generator' || val === 'intermittent') return 'rgba(245,158,11,0.15)';
    return 'rgba(239,68,68,0.15)';
  };

  // Summary stats
  const criticalCamps = allResources.filter(r =>
    r.food_status === 'critical' || r.food_status === 'out' ||
    r.water_status === 'critical' || r.water_status === 'out' ||
    r.medical_supplies === 'critical' || r.medical_supplies === 'out'
  );

  const totalPop = allResources.reduce((sum, r) => sum + (r.current_population || 0), 0);
  const totalCap = allResources.reduce((sum, r) => sum + (r.total_capacity || 0), 0);
  const totalBeds = allResources.reduce((sum, r) => sum + (r.available_beds || 0), 0);

  return (
    <div>
      <h3 style={s.sectionTitle}>System Resource Overview</h3>

      {/* Summary cards */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr', gap: 10, marginBottom: 20 }}>
        <div style={{ padding: 14, background: '#1E293B', borderRadius: 12, border: '1px solid #334155' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>{totalPop}</p>
          <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>Total Population</p>
        </div>
        <div style={{ padding: 14, background: '#1E293B', borderRadius: 12, border: '1px solid #334155' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>{totalCap}</p>
          <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>Total Capacity</p>
        </div>
        <div style={{ padding: 14, background: '#1E293B', borderRadius: 12, border: '1px solid #334155' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: '#22C55E', margin: 0 }}>{totalBeds}</p>
          <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>Available Beds</p>
        </div>
        <div style={{ padding: 14, background: criticalCamps.length > 0 ? 'rgba(239,68,68,0.08)' : '#1E293B', borderRadius: 12, border: criticalCamps.length > 0 ? '1px solid rgba(239,68,68,0.3)' : '1px solid #334155' }}>
          <p style={{ fontSize: 22, fontWeight: 800, color: criticalCamps.length > 0 ? '#EF4444' : '#F1F5F9', margin: 0 }}>{criticalCamps.length}</p>
          <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>Critical Camps</p>
        </div>
      </div>

      {/* Critical alerts first */}
      {criticalCamps.length > 0 && (
        <div style={{ marginBottom: 20 }}>
          <h4 style={{ fontSize: 13, fontWeight: 700, color: '#FCA5A5', margin: '0 0 10px', textTransform: 'uppercase' }}>
            ⚠️ Camps Needing Attention
          </h4>
          {criticalCamps.map(r => (
            <div key={r.id} style={{ padding: 14, background: 'rgba(239,68,68,0.06)', borderRadius: 10, border: '1px solid rgba(239,68,68,0.15)', marginBottom: 8 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <p style={{ fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{r.camps?.name || 'Unknown Camp'}</p>
                <span style={{ fontSize: 11, color: '#64748B' }}>{r.current_population}/{r.total_capacity}</span>
              </div>
              {r.critical_flag && (
                <p style={{ fontSize: 13, color: '#FCA5A5', margin: '0 0 6px', fontWeight: 600 }}>
                  🚨 {r.critical_flag}
                </p>
              )}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {['food_status', 'water_status', 'medical_supplies'].map(field => {
                  const val = r[field];
                  if (val === 'critical' || val === 'out') {
                    const label = field.replace('_status', '').replace('_supplies', '').replace('_', ' ');
                    return (
                      <span key={field} style={{ padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600, background: statusBg(val), color: statusColor(val), textTransform: 'capitalize' }}>
                        {label}: {val}
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* All camps resource table */}
      <h4 style={{ fontSize: 13, fontWeight: 700, color: '#94A3B8', margin: '0 0 10px', textTransform: 'uppercase' }}>
        All Camp Resources ({allResources.length})
      </h4>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {allResources.map(r => (
          <div key={r.id} style={{ padding: 14, background: '#1E293B', borderRadius: 10, border: '1px solid #334155' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{r.camps?.name || 'Unknown'}</p>
              <span style={{ fontSize: 12, color: '#94A3B8' }}>
                {r.current_population}/{r.total_capacity} ({r.total_capacity > 0 ? Math.round((r.current_population / r.total_capacity) * 100) : 0}%)
              </span>
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[
                { label: '🍚 Food', val: r.food_status },
                { label: '💧 Water', val: r.water_status },
                { label: '💊 Medical', val: r.medical_supplies },
                { label: '⚡ Power', val: r.power_status },
                { label: '📶 Net', val: r.internet_status },
              ].map(item => (
                <span key={item.label} style={{
                  padding: '3px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                  background: statusBg(item.val), color: statusColor(item.val),
                }}>
                  {item.label}: {item.val}
                </span>
              ))}
            </div>
            {r.available_beds > 0 && (
              <p style={{ fontSize: 11, color: '#64748B', margin: '6px 0 0' }}>
                {r.available_beds} beds available • {r.special_needs_count || 0} special needs
              </p>
            )}
            <p style={{ fontSize: 10, color: '#475569', margin: '4px 0 0' }}>
              Updated: {r.updated_at ? new Date(r.updated_at).toLocaleString() : 'Never'}
            </p>
          </div>
        ))}
      </div>

      {/* Camps without resources */}
      {campsWithout.length > 0 && (
        <div style={{ marginTop: 16, padding: 12, background: 'rgba(234,179,8,0.06)', border: '1px solid rgba(234,179,8,0.15)', borderRadius: 10 }}>
          <p style={{ fontSize: 12, fontWeight: 600, color: '#FDE68A', margin: '0 0 4px' }}>
            {campsWithout.length} camp{campsWithout.length > 1 ? 's' : ''} without resource tracking
          </p>
          <p style={{ fontSize: 11, color: '#94A3B8', margin: 0 }}>
            {campsWithout.map(c => c.name).join(', ')}
          </p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ALERTS TAB
// ═══════════════════════════════════════════════════════════

function AlertsTab({ alerts }) {
  const [smsMode, setSmsMode] = useState(false);
  const [smsMessage, setSmsMessage] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsResult, setSmsResult] = useState(null);

  const sendBulkSms = async () => {
    if (!smsMessage.trim()) return;
    setSmsSending(true);
    setSmsResult(null);
    try {
      const res = await fetch('/api/sms-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mode: 'all_registered',
          message: smsMessage.trim(),
          alert_type: 'emergency_sms',
        }),
      });
      const data = await res.json();
      setSmsResult(data);
      setSmsMessage('');
    } catch (err) {
      setSmsResult({ error: err.message });
    }
    setSmsSending(false);
  };

  return (
    <div>
      {/* SMS Alert Section */}
      <div style={{ marginBottom: 20 }}>
        <button
          onClick={() => setSmsMode(!smsMode)}
          style={{
            width: '100%', padding: '12px 16px', borderRadius: 10,
            background: 'rgba(245,158,11,0.1)', border: '1px solid rgba(245,158,11,0.25)',
            color: '#FDE68A', fontSize: 14, fontWeight: 700, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          }}
        >
          📱 {smsMode ? 'Hide' : 'Send'} Bulk SMS Alert
        </button>

        {smsMode && (
          <div style={{ marginTop: 10, padding: 16, background: '#1E293B', borderRadius: 10, border: '1px solid #334155' }}>
            <textarea
              value={smsMessage}
              onChange={e => setSmsMessage(e.target.value)}
              placeholder="Type emergency SMS message..."
              maxLength={320}
              style={{
                width: '100%', minHeight: 80, padding: 12, borderRadius: 8,
                background: '#0F172A', border: '1px solid #334155', color: '#F1F5F9',
                fontSize: 14, resize: 'vertical', fontFamily: 'inherit',
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <span style={{ fontSize: 11, color: '#64748B' }}>
                {smsMessage.length}/320 chars &bull; Sends to ALL registered users
              </span>
              <button
                onClick={sendBulkSms}
                disabled={smsSending || !smsMessage.trim()}
                style={{
                  padding: '8px 20px', borderRadius: 8, border: 'none',
                  background: smsSending ? '#334155' : '#F59E0B', color: '#0F172A',
                  fontSize: 13, fontWeight: 700, cursor: smsSending ? 'not-allowed' : 'pointer',
                }}
              >
                {smsSending ? 'Sending...' : 'Send SMS'}
              </button>
            </div>
            {smsResult && (
              <div style={{
                marginTop: 8, padding: 10, borderRadius: 8,
                background: smsResult.error ? 'rgba(239,68,68,0.1)' : 'rgba(34,197,94,0.1)',
                border: `1px solid ${smsResult.error ? 'rgba(239,68,68,0.2)' : 'rgba(34,197,94,0.2)'}`,
              }}>
                <p style={{ fontSize: 12, margin: 0, color: smsResult.error ? '#FCA5A5' : '#86EFAC' }}>
                  {smsResult.error
                    ? `Error: ${smsResult.error}`
                    : `✓ Sent: ${smsResult.sent || 0}, Failed: ${smsResult.failed || 0}${smsResult.queued ? `, Queued: ${smsResult.queued}` : ''}`
                  }
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      <h3 style={s.sectionTitle}>Disaster Alerts ({alerts.length})</h3>
      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 28, margin: '0 0 8px' }}>🔔</p>
          <p style={{ color: '#64748B', fontSize: 14, margin: 0 }}>No alerts issued yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {alerts.map(a => (
            <div key={a.id} style={s.alertCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#FCA5A5' }}>
                  {a.type || a.disaster_type || 'Alert'}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  {a.created_at ? new Date(a.created_at).toLocaleString() : ''}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#CBD5E1', margin: '4px 0 0' }}>
                {a.message || a.title}
              </p>
              {a.affected_area && (
                <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                  Area: {a.affected_area}
                </p>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh', background: '#0F172A', fontFamily: 'system-ui, sans-serif',
    maxWidth: 800, margin: '0 auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 24px 12px', borderBottom: '1px solid #1E293B',
  },
  title: { fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: 0 },
  subtitle: { fontSize: 12, color: '#64748B', margin: '2px 0 0' },
  refreshBtn: {
    background: '#1E293B', border: '1px solid #334155', color: '#94A3B8',
    padding: '8px 12px', borderRadius: 8, fontSize: 16, cursor: 'pointer',
  },
  logoutBtn: {
    background: '#334155', border: 'none', color: '#94A3B8', padding: '8px 14px',
    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  tabs: {
    display: 'flex', gap: 0, borderBottom: '1px solid #1E293B',
    padding: '0 12px', background: '#0F172A', position: 'sticky', top: 0, zIndex: 10,
  },
  tab: {
    flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    padding: '12px 8px', background: 'none', border: 'none', borderBottom: '2px solid transparent',
    color: '#64748B', fontSize: 11, fontWeight: 600, cursor: 'pointer',
  },
  tabActive: { color: '#3B82F6', borderBottomColor: '#3B82F6' },
  content: { padding: 20 },
  sectionTitle: {
    fontSize: 14, fontWeight: 700, color: '#94A3B8', margin: '0 0 12px',
    textTransform: 'uppercase', letterSpacing: 0.5,
  },
  statCard: {
    padding: 16, background: '#1E293B', borderRadius: 12, borderLeft: '3px solid',
    border: '1px solid #334155',
  },
  campRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 14, background: '#1E293B', borderRadius: 10, border: '1px solid #334155',
    marginBottom: 8,
  },
  campCard: {
    display: 'flex', gap: 12, alignItems: 'center', padding: 16,
    background: '#1E293B', borderRadius: 12, border: '1px solid #334155',
    cursor: 'pointer',
  },
  campExpanded: {
    padding: '12px 16px', background: '#0F172A', border: '1px solid #334155',
    borderTop: 'none', borderRadius: '0 0 12px 12px', marginTop: -4,
  },
  statusBadge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 6,
    fontSize: 11, fontWeight: 600, textTransform: 'uppercase',
  },
  missingCard: {
    padding: 16, background: '#1E293B', borderRadius: 12,
    border: '1px solid #334155',
  },
  alertCard: {
    padding: 14, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.15)',
    borderRadius: 10,
  },
  smallBtn: {
    padding: '6px 12px', borderRadius: 6, border: 'none', fontSize: 11,
    fontWeight: 600, cursor: 'pointer',
  },
};
