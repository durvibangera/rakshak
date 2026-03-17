'use client';

import { useState, useEffect, useCallback } from 'react';
import QRScanner from '@/components/common/QRScanner';
import RoleGate from '@/components/common/RoleGate';

const TABS = [
  { id: 'qr', label: 'QR Check-in' },
  { id: 'inventory', label: 'Inventory' },
];

export default function OperatorDashboard() {
  return (
    <RoleGate allowedRole="operator">
      <OperatorContent />
    </RoleGate>
  );
}

function OperatorContent() {
  const [campId, setCampId] = useState('');
  const [campName, setCampName] = useState('');
  const [activeTab, setActiveTab] = useState('qr');
  const [campVictims, setCampVictims] = useState([]);
  const [refreshKey, setRefreshKey] = useState(0);

  useEffect(() => {
    setCampId(localStorage.getItem('sahaay') || '');
    setCampName(localStorage.getItem('sahaay_camp_name') || 'Camp');
  }, []);

  const refreshVictims = () => setRefreshKey(k => k + 1);

  const handleLogout = () => {
    localStorage.removeItem('sahaay_phone');
    localStorage.removeItem('sahaay_camp_id');
    localStorage.removeItem('sahaay_camp_name');
    window.location.href = '/';
  };

  return (
    <div style={s.page}>
      <div style={s.header}>
        <div>
          <h1 style={s.title}>Operator Panel</h1>
          <p style={s.campLabel}>{campName}</p>
        </div>
        <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>
      </div>

      <div style={s.tabs}>
        {TABS.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{ ...s.tab, ...(activeTab === tab.id ? s.tabActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div style={s.content}>
        {activeTab === 'qr' && (
          <QRCheckinTab campId={campId} onCheckin={refreshVictims} refreshKey={refreshKey} />
        )}
        {activeTab === 'inventory' && (
          <InventoryTab campId={campId} />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// QR CHECK-IN TAB
// ═══════════════════════════════════════════════════════════

function QRCheckinTab({ campId, onCheckin, refreshKey }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [victims, setVictims] = useState([]);

  useEffect(() => {
    if (!campId) return;
    fetch(`/api/victims?camp_id=${campId}`)
      .then(r => r.json())
      .then(d => setVictims(d.victims || []))
      .catch(() => {});
  }, [campId, refreshKey]);

  const handleScan = async (data) => {
    setError('');

    // Build lookup params -- QR may contain { phone } or { qr_code_id } or raw text
    const phone = data.phone;
    const qrId = data.qr_code_id || data.id;
    const raw = data.raw;

    let url = `/api/qr-lookup?camp_id=${campId}`;
    if (phone) {
      url += `&phone=${encodeURIComponent(phone)}`;
    } else if (qrId) {
      url += `&qr_code_id=${encodeURIComponent(qrId)}`;
    } else if (raw) {
      // Raw string -- could be a phone number or qr_code_id
      const cleaned = raw.replace(/\D/g, '');
      if (cleaned.length >= 10) {
        url += `&phone=${encodeURIComponent(raw)}`;
      } else {
        url += `&qr_code_id=${encodeURIComponent(raw)}`;
      }
    } else {
      setError('Invalid QR code');
      return;
    }

    try {
      const res = await fetch(url);
      const json = await res.json();

      if (json.found) {
        setResult({ user: json.user, time: new Date().toLocaleTimeString() });
        onCheckin();
      } else {
        setError('Person not found — they may need to register first');
      }
    } catch {
      setError('Lookup failed. Check your connection.');
    }
  };

  if (result) {
    const u = result.user;
    return (
      <div>
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div style={s.successCircle}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          </div>
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>Checked In Successfully</h3>
          <p style={{ fontSize: 12, color: '#22C55E', fontWeight: 600, margin: '2px 0 0' }}>Added to Camp Database</p>
          <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>at {result.time}</p>
        </div>

        <div style={s.profileCard}>
          {u.selfie_url && <img src={u.selfie_url} alt="" style={s.profileImg} />}
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{u.name}</p>
            <p style={{ fontSize: 13, color: '#94A3B8', margin: '2px 0 0' }}>{u.phone}</p>
            {u.blood_group && <span style={s.badge}>{u.blood_group}</span>}
          </div>
        </div>

        {u.medical_conditions && (
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Medical</span>
            <span style={s.infoVal}>{u.medical_conditions}</span>
          </div>
        )}
        {u.emergency_contact_name && (
          <div style={s.infoRow}>
            <span style={s.infoLabel}>Emergency Contact</span>
            <span style={s.infoVal}>{u.emergency_contact_name} — {u.emergency_contact_phone}</span>
          </div>
        )}

        <button onClick={() => { setResult(null); }} style={s.primaryBtn}>
          Scan Next Person
        </button>
      </div>
    );
  }

  return (
    <div>
      <h3 style={s.tabTitle}>Scan QR to Check In</h3>
      <p style={s.tabDesc}>Point camera at the person&apos;s QR identity card</p>

      <div style={{ borderRadius: 12, overflow: 'hidden', marginBottom: 12 }}>
        <QRScanner onScan={handleScan} />
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: 13, margin: '8px 0' }}>{error}</p>}

      {victims.length > 0 && (
        <div style={{ marginTop: 20 }}>
          <h4 style={{ fontSize: 14, fontWeight: 700, color: '#94A3B8', margin: '0 0 10px' }}>
            Checked In at Camp ({victims.length})
          </h4>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {victims.map((v) => (
              <div key={v.camp_victim_id || v.id} style={s.recentRow}>
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#E2E8F0', margin: 0 }}>{v.name}</p>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>{v.phone || '—'}</p>
                </div>
                <span style={{ fontSize: 12, color: '#64748B' }}>
                  {v.checked_in_at ? new Date(v.checked_in_at).toLocaleTimeString() : ''}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// INVENTORY TAB
// ═══════════════════════════════════════════════════════════

const STATUS_OPTIONS = [
  { value: 'adequate', label: 'Adequate', color: '#22C55E' },
  { value: 'low', label: 'Low', color: '#F59E0B' },
  { value: 'critical', label: 'Critical', color: '#EF4444' },
  { value: 'out', label: 'Out', color: '#DC2626' },
];

const POWER_OPTIONS = [
  { value: 'available', label: 'Available', color: '#22C55E' },
  { value: 'generator', label: 'Generator', color: '#F59E0B' },
  { value: 'none', label: 'None', color: '#EF4444' },
];

const NET_OPTIONS = [
  { value: 'available', label: 'Available', color: '#22C55E' },
  { value: 'intermittent', label: 'Intermittent', color: '#F59E0B' },
  { value: 'none', label: 'None', color: '#EF4444' },
];

function InventoryTab({ campId }) {
  const [resources, setResources] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  const fetchResources = useCallback(async () => {
    if (!campId) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/camp-resources?camp_id=${campId}`);
      const data = await res.json();
      setResources(data.resources || {});
    } catch {
      setError('Failed to load inventory');
    }
    setLoading(false);
  }, [campId]);

  useEffect(() => { fetchResources(); }, [fetchResources]);

  const updateField = (field, value) => {
    setResources(prev => ({ ...prev, [field]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError('');
    setSaved(false);
    try {
      const res = await fetch('/api/camp-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...resources, camp_id: campId }),
      });
      const data = await res.json();
      if (data.success) {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      } else {
        setError(data.error || 'Failed to save');
      }
    } catch {
      setError('Save failed. Check your connection.');
    }
    setSaving(false);
  };

  if (loading) {
    return (
      <div style={{ textAlign: 'center', padding: 40, color: '#94A3B8' }}>
        Loading inventory...
      </div>
    );
  }

  if (!resources) return null;

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <h3 style={s.tabTitle}>Camp Inventory</h3>
        {saved && <span style={{ fontSize: 13, color: '#22C55E', fontWeight: 600 }}>Saved</span>}
      </div>

      {/* Capacity Numbers */}
      <div style={s.section}>
        <p style={s.sectionTitle}>Capacity</p>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10 }}>
          <NumberField label="Total Capacity" value={resources.total_capacity} onChange={v => updateField('total_capacity', v)} />
          <NumberField label="Population" value={resources.current_population} onChange={v => updateField('current_population', v)} />
          <NumberField label="Beds Free" value={resources.available_beds} onChange={v => updateField('available_beds', v)} />
        </div>
      </div>

      {/* Supply Statuses */}
      <div style={s.section}>
        <p style={s.sectionTitle}>Supplies</p>
        <StatusPicker label="Food" value={resources.food_status} options={STATUS_OPTIONS} onChange={v => updateField('food_status', v)} />
        <StatusPicker label="Water" value={resources.water_status} options={STATUS_OPTIONS} onChange={v => updateField('water_status', v)} />
        <StatusPicker label="Medical" value={resources.medical_supplies} options={STATUS_OPTIONS} onChange={v => updateField('medical_supplies', v)} />
      </div>

      {/* Infrastructure */}
      <div style={s.section}>
        <p style={s.sectionTitle}>Infrastructure</p>
        <StatusPicker label="Power" value={resources.power_status} options={POWER_OPTIONS} onChange={v => updateField('power_status', v)} />
        <StatusPicker label="Internet" value={resources.internet_status} options={NET_OPTIONS} onChange={v => updateField('internet_status', v)} />
      </div>

      {/* Special Needs */}
      <div style={s.section}>
        <p style={s.sectionTitle}>Special Needs</p>
        <NumberField label="Special Needs Count" value={resources.special_needs_count} onChange={v => updateField('special_needs_count', v)} />
      </div>

      {/* Critical Flag */}
      <div style={s.section}>
        <p style={s.sectionTitle}>Urgent Issues</p>
        <textarea
          value={resources.critical_flag || ''}
          onChange={e => updateField('critical_flag', e.target.value)}
          placeholder="Any critical issues to flag (e.g. generator fuel running out, medical emergency...)"
          style={s.textarea}
          rows={3}
        />
      </div>

      {error && <p style={{ color: '#EF4444', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}

      <button onClick={handleSave} disabled={saving} style={{ ...s.primaryBtn, opacity: saving ? 0.6 : 1 }}>
        {saving ? 'Saving...' : 'Update Inventory'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// REUSABLE FORM COMPONENTS
// ═══════════════════════════════════════════════════════════

function NumberField({ label, value, onChange }) {
  return (
    <div>
      <label style={s.fieldLabel}>{label}</label>
      <input
        type="number"
        min="0"
        value={value || 0}
        onChange={e => onChange(parseInt(e.target.value) || 0)}
        style={s.numberInput}
      />
    </div>
  );
}

function StatusPicker({ label, value, options, onChange }) {
  return (
    <div style={s.statusRow}>
      <span style={s.statusLabel}>{label}</span>
      <div style={{ display: 'flex', gap: 4 }}>
        {options.map(opt => {
          const active = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                border: active ? `1.5px solid ${opt.color}` : '1.5px solid #334155',
                background: active ? `${opt.color}18` : 'transparent',
                color: active ? opt.color : '#64748B',
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

const s = {
  page: {
    minHeight: '100vh', background: '#0F172A', fontFamily: 'system-ui, sans-serif',
    maxWidth: 520, margin: '0 auto',
  },
  header: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '20px 20px 12px', borderBottom: '1px solid #1E293B',
  },
  title: { fontSize: 20, fontWeight: 800, color: '#F1F5F9', margin: 0 },
  campLabel: { fontSize: 12, color: '#64748B', margin: '2px 0 0' },
  logoutBtn: {
    background: '#334155', border: 'none', color: '#94A3B8', padding: '8px 14px',
    borderRadius: 8, fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  tabs: {
    display: 'flex', gap: 0, borderBottom: '1px solid #1E293B',
    padding: '0 12px', background: '#0F172A', position: 'sticky', top: 0, zIndex: 10,
  },
  tab: {
    flex: 1, padding: '14px 8px', background: 'none', border: 'none',
    borderBottom: '2px solid transparent', color: '#64748B', fontSize: 14,
    fontWeight: 600, cursor: 'pointer', textAlign: 'center',
  },
  tabActive: { color: '#3B82F6', borderBottomColor: '#3B82F6' },
  content: { padding: 20 },
  tabTitle: { fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' },
  tabDesc: { fontSize: 13, color: '#64748B', margin: '0 0 16px' },
  successCircle: {
    width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
  },
  profileCard: {
    display: 'flex', gap: 14, alignItems: 'center', padding: 16,
    background: '#1E293B', borderRadius: 12, border: '1px solid #334155', marginBottom: 12,
  },
  profileImg: { width: 52, height: 52, borderRadius: 12, objectFit: 'cover' },
  badge: {
    display: 'inline-block', marginTop: 4, padding: '2px 8px', background: 'rgba(239,68,68,0.15)',
    color: '#FCA5A5', borderRadius: 6, fontSize: 11, fontWeight: 600,
  },
  infoRow: {
    display: 'flex', justifyContent: 'space-between', padding: '10px 0',
    borderBottom: '1px solid #1E293B',
  },
  infoLabel: { fontSize: 12, color: '#64748B', fontWeight: 600 },
  infoVal: { fontSize: 13, color: '#E2E8F0', textAlign: 'right' },
  primaryBtn: {
    width: '100%', padding: 14, background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer', marginTop: 16,
  },
  recentRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, background: '#1E293B', borderRadius: 10, border: '1px solid #334155',
  },
  section: {
    marginBottom: 20, padding: 16, background: '#1E293B', borderRadius: 12,
    border: '1px solid #334155',
  },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase',
    letterSpacing: 0.5, margin: '0 0 12px',
  },
  fieldLabel: {
    display: 'block', fontSize: 11, color: '#64748B', fontWeight: 600, marginBottom: 4,
  },
  numberInput: {
    width: '100%', padding: '10px 8px', background: '#0F172A', border: '1px solid #334155',
    borderRadius: 8, color: '#E2E8F0', fontSize: 16, fontWeight: 700, textAlign: 'center',
    outline: 'none', boxSizing: 'border-box',
  },
  statusRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid rgba(51,65,85,0.5)',
  },
  statusLabel: { fontSize: 14, fontWeight: 600, color: '#E2E8F0' },
  textarea: {
    width: '100%', padding: 12, background: '#0F172A', border: '1px solid #334155',
    borderRadius: 8, color: '#E2E8F0', fontSize: 14, outline: 'none', resize: 'vertical',
    boxSizing: 'border-box', fontFamily: 'inherit',
  },
};
