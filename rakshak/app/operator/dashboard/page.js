'use client';

import { useState, useEffect, useCallback } from 'react';
import QRScanner from '@/components/common/QRScanner';
import RoleGate from '@/components/common/RoleGate';

const TABS = [
  { id: 'qr', label: 'QR Check-in' },
  { id: 'missing', label: 'Missing Report' },
  { id: 'inventory', label: 'Resources' },
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
      {/* Navbar */}
      <header style={s.navbar}>
        <div style={s.navBrand}>
          <img src="/logo-light.png" alt="Sahaay" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
        </div>
        <div style={s.navMeta}>
          <div style={s.campChip}>
            <span style={s.campDot} />
            <span style={s.campChipLabel}>{campName || 'Camp'}</span>
          </div>
        </div>
        <div style={s.navActions}>
          <a href="/" style={s.homeLink}>← Home</a>
          <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>
        </div>
      </header>

      {/* Page title */}
      <div style={s.pageHead}>
        <div>
          <h1 style={s.pageTitle}>Operator Panel</h1>
          <p style={s.pageSubtitle}>QR check-ins, missing reports, and resources</p>
        </div>
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
        {activeTab === 'missing' && (
          <MissingReportTab campId={campId} />
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
          <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>Checked In Successfully</h3>
          <p style={{ fontSize: 12, color: '#059669', fontWeight: 600, margin: '2px 0 0' }}>Added to Camp Database</p>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>at {result.time}</p>
        </div>

        <div style={s.profileCard}>
          {u.selfie_url && <img src={u.selfie_url} alt="" style={s.profileImg} />}
          <div>
            <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>{u.name}</p>
            <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>{u.phone}</p>
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
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: 0 }}>{v.name}</p>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{v.phone || '—'}</p>
                </div>
                <span style={{ fontSize: 12, color: '#9CA3AF' }}>
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

// ═══════════════════════════════════════════════════════════
// MISSING REPORT TAB
// ═══════════════════════════════════════════════════════════

function MissingReportTab({ campId }) {
  const [form, setForm] = useState({ name: '', age: '', gender: 'M', lastSeenDetails: '', relation: '', reporterPhone: '', contactInfo: '' });
  const [photo, setPhoto] = useState(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  const submitReport = async (e) => {
    e.preventDefault();
    setError('');
    const repPhone = localStorage.getItem('sahaay_phone') || '';
    if (!form.name || !form.lastSeenDetails) return setError('Name and last seen details are required');
    setLoading(true);
    try {
      let photoUrl = null;
      if (photo) {
        const ext = photo.name.split('.').pop();
        const fileName = `${Date.now()}_${Math.random().toString(36).substring(2)}.${ext}`;
        const { error: uploadErr } = await supabase.storage.from('missing_persons').upload(fileName, photo);
        if (uploadErr) throw new Error('Photo upload failed: ' + uploadErr.message);
        const { data: pubData } = supabase.storage.from('missing_persons').getPublicUrl(fileName);
        photoUrl = pubData.publicUrl;
      }
      const { error: dbErr } = await supabase.from('missing_reports').insert({
        person_name: form.name,
        age_approx: form.age || null,
        gender: form.gender,
        last_seen_details: form.lastSeenDetails,
        reporter_phone: form.reporterPhone || repPhone,
        contact_info: form.contactInfo,
        relation_to_person: form.relation || 'Operator filed',
        photo_url: photoUrl,
        status: 'open',
        camp_id_reported_at: campId,
      });
      if (dbErr) throw dbErr;
      setSuccess(true);
      setForm({ name: '', age: '', gender: 'M', lastSeenDetails: '', relation: '', reporterPhone: '', contactInfo: '' });
      setPhoto(null);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h2 style={s.tabTitle}>File Missing Report</h2>
      <p style={s.tabDesc}>Create a verifiable missing person record to instantly alert all active camps and field agents.</p>

      {success && (
        <div style={{ padding: 16, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 10, marginBottom: 16, display: 'flex', gap: 10, alignItems: 'center' }}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
          <div>
            <p style={{ margin: 0, fontWeight: 700, color: '#065F46', fontSize: 13.5 }}>Report Filed Successfully</p>
            <p style={{ margin: '2px 0 0', color: '#047857', fontSize: 12 }}>Added to the national tracing database.</p>
          </div>
        </div>
      )}

      {error && <p style={{ color: '#DC2626', fontSize: 13, background: '#FEF2F2', padding: 10, borderRadius: 8, margin: '0 0 16px' }}>{error}</p>}

      <form onSubmit={submitReport} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={s.section}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 2 }}>
              <label style={s.fieldLabel}>Person's Full Name *</label>
              <input type="text" value={form.name} onChange={e => setForm({...form, name: e.target.value})} style={{ ...s.textarea, height: 44, resize: 'none' }} placeholder="E.g. Ramesh Kumar" required />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>Age</label>
              <input type="number" value={form.age} onChange={e => setForm({...form, age: e.target.value})} style={{ ...s.numberInput, padding: '10px 8px', height: 44, textAlign: 'left', fontSize: 14, fontWeight: 400 }} placeholder="Approx." />
            </div>
            <div style={{ width: 80 }}>
              <label style={s.fieldLabel}>Gender</label>
              <select value={form.gender} onChange={e => setForm({...form, gender: e.target.value})} style={{ ...s.textarea, height: 44, padding: '0 8px' }}>
                <option value="M">M</option>
                <option value="F">F</option>
                <option value="O">O</option>
              </select>
            </div>
          </div>
        </div>

        <div style={s.section}>
          <label style={s.fieldLabel}>Recent Photo (Highly Recommended)</label>
          <input type="file" accept="image/*" onChange={e => setPhoto(e.target.files[0])} style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }} />
        </div>

        <div style={s.section}>
          <label style={s.fieldLabel}>Last Known Location & Details *</label>
          <textarea value={form.lastSeenDetails} onChange={e => setForm({...form, lastSeenDetails: e.target.value})} style={{ ...s.textarea, height: 80 }} placeholder="Where were they last seen? What were they wearing? Any distinguishing marks?" required />
        </div>

        <div style={s.section}>
          <div style={{ display: 'flex', gap: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>Contact (Finder to call)</label>
              <input type="text" value={form.reporterPhone} onChange={e => setForm({...form, reporterPhone: e.target.value})} style={{ ...s.textarea, height: 44, resize: 'none' }} placeholder="+91..." />
            </div>
            <div style={{ flex: 1 }}>
              <label style={s.fieldLabel}>Relation</label>
              <input type="text" value={form.relation} onChange={e => setForm({...form, relation: e.target.value})} style={{ ...s.textarea, height: 44, resize: 'none' }} placeholder="E.g. Father/Wife" />
            </div>
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ ...s.primaryBtn, opacity: loading ? 0.7 : 1 }}>
          {loading ? 'Filing Report...' : 'File Missing Person Report'}
        </button>
      </form>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RESOURCES TAB
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
                border: active ? `1.5px solid ${opt.color}` : '1.5px solid #E2E8F0',
                background: active ? `${opt.color}18` : 'white',
                color: active ? opt.color : '#6B7280',
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

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const s = {
  page: {
    minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT,
  },

  // ── Navbar ──────────────────────────────────────
  navbar: {
    display: 'flex', alignItems: 'center', gap: 12,
    padding: '0 20px', height: 72,
    background: 'white', borderBottom: '1px solid #E2E8F0',
    boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
    position: 'sticky', top: 0, zIndex: 20,
  },
  navBrand: { display: 'flex', alignItems: 'center' },
  navMeta: { flex: 1, display: 'flex', alignItems: 'center', paddingLeft: 12 },
  campChip: {
    display: 'flex', alignItems: 'center', gap: 6,
    background: '#EEF2FF', border: '1px solid #C7D2FE',
    borderRadius: 20, padding: '4px 10px',
  },
  campDot: {
    width: 7, height: 7, borderRadius: '50%', background: '#1B3676', flexShrink: 0,
  },
  campChipLabel: { fontSize: 12, fontWeight: 700, color: '#1B3676' },
  navActions: { display: 'flex', gap: 8, alignItems: 'center' },
  homeLink: {
    fontSize: 13, fontWeight: 500, color: '#6B7280',
    textDecoration: 'none', padding: '6px 10px',
    borderRadius: 8, border: '1px solid #E2E8F0',
    background: 'white',
  },
  logoutBtn: {
    background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },

  // ── Page heading ────────────────────────────────
  pageHead: {
    padding: '30px 20px 10px',
    maxWidth: 1320, margin: '0 auto',
  },
  pageTitle: { fontSize: 24, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.3px' },
  pageSubtitle: { fontSize: 13, color: '#6B7280', margin: 0 },

  // ── Tabs ────────────────────────────────────────
  tabs: {
    display: 'flex', gap: 0,
    padding: '14px 20px 0', background: 'transparent',
    maxWidth: 1320, margin: '0 auto',
  },
  tab: {
    padding: '12px 24px', background: 'white',
    border: '1px solid #E2E8F0', borderBottom: 'none',
    borderRadius: '10px 10px 0 0',
    color: '#6B7280', fontSize: 14, fontWeight: 600,
    cursor: 'pointer', textAlign: 'center',
    marginRight: 6, transition: 'all 0.15s',
  },
  tabActive: {
    color: '#1B3676', background: 'white',
    borderTopColor: '#1B3676', borderTopWidth: 3,
    borderLeftColor: '#E2E8F0', borderRightColor: '#E2E8F0',
  },
  content: {
    padding: 32,
    background: 'white', borderTop: '1px solid #E2E8F0', border: '1px solid #E2E8F0',
    borderRadius: '0 12px 12px 12px',
    maxWidth: 1320, margin: '0 auto 40px',
    boxShadow: '0 4px 12px rgba(0,0,0,0.03)',
  },

  // ── Tab content ─────────────────────────────────
  tabTitle: { fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' },
  tabDesc: { fontSize: 13, color: '#6B7280', margin: '0 0 16px' },

  // ── QR Check-in result ──────────────────────────
  successCircle: {
    width: 56, height: 56, borderRadius: '50%', background: '#D1FAE5',
    display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px',
  },
  profileCard: {
    display: 'flex', gap: 14, alignItems: 'center', padding: 16,
    background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 12,
  },
  profileImg: { width: 52, height: 52, borderRadius: 12, objectFit: 'cover' },
  badge: {
    display: 'inline-block', marginTop: 4, padding: '2px 8px',
    background: '#FEE2E2', color: '#DC2626',
    borderRadius: 6, fontSize: 11, fontWeight: 600,
  },
  infoRow: {
    display: 'flex', justifyContent: 'space-between', padding: '10px 0',
    borderBottom: '1px solid #F1F5F9',
  },
  infoLabel: { fontSize: 12, color: '#6B7280', fontWeight: 600 },
  infoVal: { fontSize: 13, color: '#0F172A', textAlign: 'right' },

  primaryBtn: {
    width: '100%', padding: 14,
    background: 'linear-gradient(135deg, #1B3676, #2A5298)',
    color: 'white', border: 'none', borderRadius: 10,
    fontSize: 15, fontWeight: 700, cursor: 'pointer', marginTop: 16,
    boxShadow: '0 2px 8px rgba(27,54,118,0.25)',
  },

  // ── Victims list ────────────────────────────────
  recentRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: 12, background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
  },

  // ── Inventory ───────────────────────────────────
  section: {
    marginBottom: 16, padding: 16, background: '#F8FAFC', borderRadius: 12,
    border: '1px solid #E2E8F0',
  },
  sectionTitle: {
    fontSize: 11, fontWeight: 700, color: '#1B3676', textTransform: 'uppercase',
    letterSpacing: '0.6px', margin: '0 0 12px',
  },
  fieldLabel: {
    display: 'block', fontSize: 11, color: '#6B7280', fontWeight: 600, marginBottom: 4,
  },
  numberInput: {
    width: '100%', padding: '10px 8px', background: 'white',
    border: '1.5px solid #E2E8F0', borderRadius: 8,
    color: '#0F172A', fontSize: 16, fontWeight: 700,
    textAlign: 'center', outline: 'none', boxSizing: 'border-box',
    fontFamily: FONT,
  },
  statusRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 0', borderBottom: '1px solid #F1F5F9',
  },
  statusLabel: { fontSize: 14, fontWeight: 600, color: '#374151' },
  textarea: {
    width: '100%', padding: 12, background: 'white',
    border: '1.5px solid #E2E8F0', borderRadius: 8,
    color: '#0F172A', fontSize: 14, outline: 'none',
    resize: 'vertical', boxSizing: 'border-box', fontFamily: FONT,
  },
};

