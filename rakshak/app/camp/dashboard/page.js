'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import CameraCapture from '@/components/common/CameraCapture';
import QRScanner from '@/components/common/QRScanner';
import FaceScanner from '@/components/common/FaceScanner';
import RoleGate from '@/components/common/RoleGate';
import { useOfflineSync } from '@/hooks/useOfflineSync';
import { supabase } from '@/lib/supabase/client';

const TABS = [
  { id: 'victims', label: 'Victims' },
  { id: 'register', label: 'Register' },
  { id: 'face', label: 'Face Scan' },
  { id: 'qr', label: 'QR Scan' },
  { id: 'unidentified', label: 'Unknown' },
  { id: 'resources', label: 'Resources' },
  { id: 'evacuate', label: 'Evacuate' },
  { id: 'alerts', label: 'Alerts' },
  { id: 'map', label: 'Map' },
];

const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function CampDashboard() {
  return (
    <RoleGate allowedRole="camp_admin">
      <CampDashboardContent />
    </RoleGate>
  );
}

function CampDashboardContent() {
  const [campId, setCampId] = useState('');
  const [campData, setCampData] = useState(null);
  const [activeTab, setActiveTab] = useState('victims');
  const [victims, setVictims] = useState([]);
  const [alerts, setAlerts] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(false);
  const [selectedVictim, setSelectedVictim] = useState(null);
  const [showQrFor, setShowQrFor] = useState(null);

  const { isOnline, isSyncing, pendingCount, connectionStatus, syncNow, refreshCount } = useOfflineSync();

  // Load camp ID from localStorage
  useEffect(() => {
    const id = localStorage.getItem('sahaay_camp_id');
    if (id) setCampId(id);
  }, []);

  // Fetch camp data
  useEffect(() => {
    if (!campId || !isOnline) return;
    fetch(`/api/camps?id=${campId}`)
      .then(r => r.json())
      .then(d => { if (d.camp) setCampData(d.camp); })
      .catch(() => {});
  }, [campId, isOnline]);

  // Fetch victims
  const fetchVictims = useCallback(async () => {
    if (!campId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/victims?camp_id=${campId}`);
      const data = await res.json();
      setVictims(data.victims || []);
    } catch {}
    setLoading(false);
  }, [campId, isOnline]);

  useEffect(() => { fetchVictims(); }, [fetchVictims]);

  // Fetch alerts
  const fetchAlerts = useCallback(async () => {
    if (!campId || !isOnline) return;
    try {
      const { createClient } = await import('@supabase/supabase-js');
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
      );
      const { data } = await supabase
        .from('camp_alerts')
        .select('*')
        .eq('camp_id', campId)
        .order('created_at', { ascending: false });
      setAlerts(data || []);
    } catch {}
  }, [campId, isOnline]);

  useEffect(() => { fetchAlerts(); }, [fetchAlerts]);

  // Poll for new alerts every 60 seconds
  useEffect(() => {
    if (!campId || !isOnline) return;
    const interval = setInterval(fetchAlerts, 60000);
    return () => clearInterval(interval);
  }, [campId, isOnline, fetchAlerts]);

  const filteredVictims = victims.filter(v =>
    !searchQuery ||
    v.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    v.phone?.includes(searchQuery)
  );

  const pendingAlerts = alerts.filter(a => a.status === 'pending');

  // No camp registered
  if (!campId) {
    return (
      <div style={s.page}>
        <div style={{ ...s.card, maxWidth: 440, textAlign: 'center' }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', margin: '0 0 8px' }}>No Camp Registered</h2>
          <p style={{ color: '#475569', fontSize: 14, margin: '0 0 20px' }}>
            Register a relief camp first to access the dashboard.
          </p>
          <a href="/camp/register" style={s.primaryBtn}>Register a Camp</a>
        </div>
      </div>
    );
  }

  return (
    <>
      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.5; } }
        @keyframes spin { to { transform:rotate(360deg); } }
        @keyframes slideUp { from { opacity:0; transform:translateY(8px); } to { opacity:1; transform:translateY(0); } }
      `}</style>

      <div style={s.page}>
        <div style={{ width: '100%', maxWidth: 1200, display: 'flex', flexDirection: 'column', height: '100vh' }}>

          {/* Header */}
          <header style={s.header}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <div style={s.logo}>R</div>
              <div>
                <h1 style={{ fontSize: 17, fontWeight: 700, margin: 0, color: '#0F172A' }}>
                  {campData?.name || 'Camp Dashboard'}
                </h1>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
                  {campData ? `${campData.radius_km}km radius • ${campData.victim_count || victims.length} victims` : 'Loading...'}
                </p>
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Connection status */}
              <div style={{
                ...s.statusBadge,
                background: connectionStatus === 'online' ? 'rgba(34,197,94,0.15)' :
                  connectionStatus === 'syncing' ? 'rgba(59,130,246,0.15)' : 'rgba(239,68,68,0.15)',
                color: connectionStatus === 'online' ? '#166534' :
                  connectionStatus === 'syncing' ? '#1E3A8A' : '#991B1B',
                borderColor: connectionStatus === 'online' ? 'rgba(34,197,94,0.3)' :
                  connectionStatus === 'syncing' ? 'rgba(59,130,246,0.3)' : 'rgba(239,68,68,0.3)',
              }}>
                <div style={{
                  width: 6, height: 6, borderRadius: '50%',
                  background: connectionStatus === 'online' ? '#22C55E' :
                    connectionStatus === 'syncing' ? '#3B82F6' : '#EF4444',
                  animation: connectionStatus === 'syncing' ? 'pulse 1s infinite' : 'none',
                }} />
                {connectionStatus === 'online' ? 'Online' :
                  connectionStatus === 'syncing' ? `Syncing (${pendingCount})` :
                    `Offline${pendingCount > 0 ? ` (${pendingCount} queued)` : ''}`}
              </div>

              {pendingAlerts.length > 0 && (
                <div style={s.alertBadge}>
                  {pendingAlerts.length} Alert{pendingAlerts.length > 1 ? 's' : ''}
                </div>
              )}

              <a href="/flood-prediction" style={{ color: '#6B7280', fontSize: 12, textDecoration: 'none' }}>Map</a>
              <button onClick={async () => { await supabase.auth.signOut(); localStorage.removeItem('sahaay_camp_id'); localStorage.removeItem('sahaay_camp_name'); window.location.href = '/'; }}
                style={{ background: '#E2E8F0', border: 'none', color: '#475569', padding: '6px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                Logout
              </button>
            </div>
          </header>

          {/* Tabs */}
          <nav style={s.tabBar}>
            {TABS.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={{
                  ...s.tab,
                  ...(activeTab === tab.id ? s.tabActive : {}),
                }}
              >
                {tab.label}
                {tab.id === 'alerts' && pendingAlerts.length > 0 && (
                  <span style={s.tabBadge}>{pendingAlerts.length}</span>
                )}
              </button>
            ))}
          </nav>

          {/* Content */}
          <div style={s.content}>
            {activeTab === 'victims' && (
              <VictimsTab
                victims={filteredVictims}
                searchQuery={searchQuery}
                setSearchQuery={setSearchQuery}
                loading={loading}
                selectedVictim={selectedVictim}
                setSelectedVictim={setSelectedVictim}
                showQrFor={showQrFor}
                setShowQrFor={setShowQrFor}
              />
            )}
            {activeTab === 'register' && (
              <RegisterTab campId={campId} isOnline={isOnline} onRegistered={() => { fetchVictims(); refreshCount(); }} />
            )}
            {activeTab === 'face' && (
              <FaceScanTab campId={campId} onDone={() => { fetchVictims(); setActiveTab('victims'); }} />
            )}
            {activeTab === 'qr' && (
              <QRScanTab campId={campId} isOnline={isOnline} onDone={() => { fetchVictims(); setActiveTab('victims'); }} />
            )}
            {activeTab === 'alerts' && (
              <AlertsTab alerts={alerts} campId={campId} isOnline={isOnline} onUpdate={fetchAlerts} />
            )}
            {activeTab === 'unidentified' && (
              <UnidentifiedTab campId={campId} isOnline={isOnline} />
            )}
            {activeTab === 'resources' && (
              <ResourcesTab campId={campId} isOnline={isOnline} victimCount={victims.length} />
            )}
            {activeTab === 'evacuate' && (
              <EvacuateTab campId={campId} campData={campData} victims={victims} isOnline={isOnline} />
            )}
            {activeTab === 'map' && (
              <MapTab campData={campData} alerts={alerts} />
            )}
          </div>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════
// VICTIMS TAB
// ═══════════════════════════════════════════════════════════

function VictimsTab({ victims, searchQuery, setSearchQuery, loading, selectedVictim, setSelectedVictim, showQrFor, setShowQrFor }) {
  if (selectedVictim) {
    return <VictimProfile victim={selectedVictim} onBack={() => setSelectedVictim(null)} />;
  }

  return (
    <div>
      <div style={{ marginBottom: 16 }}>
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder="Search victims by name or phone..."
          style={s.searchInput}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <div style={s.spinner} />
          <p style={{ color: '#6B7280', fontSize: 13 }}>Loading victims...</p>
        </div>
      ) : victims.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
          <p style={{ fontSize: 40, margin: '0 0 8px' }}>0</p>
          <p style={{ fontSize: 14 }}>No victims registered yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {victims.map((v, i) => (
            <div key={v.id || i} style={s.victimCard} onClick={() => setSelectedVictim(v)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                {v.selfie_url ? (
                  <img src={v.selfie_url} alt="" style={s.victimThumb} />
                ) : (
                  <div style={s.victimThumbPlaceholder}>{(v.name || '?')[0].toUpperCase()}</div>
                )}
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: 0 }}>{v.name || 'Unknown'}</p>
                  <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>{v.phone || 'No phone'}</p>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    ...s.regTypeBadge,
                    background: v.registration_type === 'self' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
                    color: v.registration_type === 'self' ? '#166534' : '#1E3A8A',
                  }}>
                    {v.registration_type === 'self' ? 'Self' : 'Camp'}
                  </span>
                  {v.checked_in_via && (
                    <span style={s.checkinBadge}>via {v.checked_in_via}</span>
                  )}
                  {v.qr_code_id && (
                    <button
                      onClick={(e) => { e.stopPropagation(); setShowQrFor(showQrFor === v.qr_code_id ? null : v.qr_code_id); }}
                      style={s.qrBtn}
                    >QR</button>
                  )}
                </div>
              </div>
              {showQrFor === v.qr_code_id && (
                <div style={{ marginTop: 12, padding: 16, background: '#FFFFFF', borderRadius: 10, textAlign: 'center' }}>
                  <QRCodeSVG value={v.qr_code_id} size={120} bgColor="#FFFFFF" fgColor="#0F172A" level="M" />
                  <p style={{ fontSize: 11, color: '#6B7280', margin: '8px 0 0' }}>{v.qr_code_id}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// VICTIM PROFILE
// ═══════════════════════════════════════════════════════════

function VictimProfile({ victim, onBack }) {
  return (
    <div style={{ animation: 'slideUp 0.2s ease-out' }}>
      <button onClick={onBack} style={s.backBtn}>← Back to list</button>

      <div style={s.profileCard}>
        <div style={{ display: 'flex', gap: 16, marginBottom: 20 }}>
          {victim.selfie_url ? (
            <img src={victim.selfie_url} alt="" style={{ width: 80, height: 80, borderRadius: 12, objectFit: 'cover' }} />
          ) : (
            <div style={{ ...s.victimThumbPlaceholder, width: 80, height: 80, fontSize: 28 }}>
              {(victim.name || '?')[0].toUpperCase()}
            </div>
          )}
          <div>
            <h3 style={{ fontSize: 20, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>{victim.name || 'Unknown'}</h3>
            <span style={{
              ...s.regTypeBadge,
              background: victim.registration_type === 'self' ? 'rgba(34,197,94,0.12)' : 'rgba(59,130,246,0.12)',
              color: victim.registration_type === 'self' ? '#166534' : '#1E3A8A',
            }}>
              {victim.registration_type === 'self' ? 'Self Registered' : 'Camp Registered'}
            </span>
          </div>
        </div>

        <div style={s.detailGrid}>
          <DetailRow label="Phone" value={victim.phone} />
          <DetailRow label="Address" value={victim.address} />
          <DetailRow label="State" value={victim.state} />
          <DetailRow label="Blood Group" value={victim.blood_group} />
          <DetailRow label="Medical Conditions" value={victim.medical_conditions} />
          <DetailRow label="Current Medications" value={victim.current_medications} />
          <DetailRow label="Disability" value={victim.disability_status} />
          <DetailRow label="Languages" value={victim.languages_spoken?.join(', ')} />
          <DetailRow label="Emergency Contact" value={victim.emergency_contact_name} />
          <DetailRow label="Emergency Phone" value={victim.emergency_contact_phone} />
          <DetailRow label="Checked In" value={victim.checked_in_at ? new Date(victim.checked_in_at).toLocaleString() : null} />
          <DetailRow label="Check-in Method" value={victim.checked_in_via} />
        </div>

        {victim.qr_code_id && (
          <div style={{ marginTop: 20, padding: 16, background: '#FFFFFF', borderRadius: 10, textAlign: 'center' }}>
            <QRCodeSVG value={victim.qr_code_id} size={140} bgColor="#FFFFFF" fgColor="#0F172A" level="M" />
            <p style={{ fontSize: 11, color: '#6B7280', margin: '8px 0 0' }}>{victim.qr_code_id}</p>
          </div>
        )}
      </div>
    </div>
  );
}

function DetailRow({ label, value }) {
  if (!value) return null;
  return (
    <div style={{ padding: '8px 0', borderBottom: '1px solid #F8FAFC' }}>
      <p style={{ fontSize: 11, color: '#6B7280', margin: '0 0 2px', fontWeight: 600 }}>{label}</p>
      <p style={{ fontSize: 14, color: '#0F172A', margin: 0 }}>{value}</p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// REGISTER TAB
// ═══════════════════════════════════════════════════════════

function RegisterTab({ campId, isOnline, onRegistered }) {
  const [photo, setPhoto] = useState(null);
  const [showCamera, setShowCamera] = useState(false);
  const [form, setForm] = useState({
    name: '', phone: '', address: '', blood_group: '', medical_conditions: '',
    current_medications: '', disability_status: '', languages_spoken: '',
    emergency_contact_name: '', emergency_contact_phone: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const updateField = (key, val) => setForm(prev => ({ ...prev, [key]: val }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!photo) return setError('Photo is required');

    setSubmitting(true);
    setError('');

    // Compress photo to reduce payload size
    const compressed = await compressImage(photo, 320, 0.6);

    const payload = {
      selfie_base64: compressed,
      name: form.name || undefined,
      phone: form.phone || undefined,
      address: form.address || undefined,
      blood_group: form.blood_group || undefined,
      medical_conditions: form.medical_conditions || undefined,
      current_medications: form.current_medications || undefined,
      disability_status: form.disability_status || undefined,
      languages_spoken: form.languages_spoken ? form.languages_spoken.split(',').map(l => l.trim()).filter(Boolean) : undefined,
      emergency_contact_name: form.emergency_contact_name || undefined,
      emergency_contact_phone: form.emergency_contact_phone || undefined,
      registration_type: 'camp',
      camp_id: campId,
    };

    try {
      if (isOnline) {
        const res = await fetch('/api/victims', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.details || data.error || 'Unknown error');
        setResult(data);
      } else {
        const { addToQueue } = await import('@/lib/offline/offlineStore');
        await addToQueue({ action_type: 'register_victim', payload, camp_id: campId });
        setResult({ offline: true, qr_code_id: 'pending-sync' });
      }
      onRegistered?.();
    } catch (err) {
      setError(err.message || 'Registration failed');
    }
    setSubmitting(false);
  };

  if (result) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ ...s.successIcon, margin: '0 auto 16px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
          {result.offline ? 'Saved Offline' : 'Victim Registered'}
        </h3>
        <p style={{ color: '#475569', fontSize: 13, margin: '0 0 16px' }}>
          {result.offline ? 'Will sync when internet is available' : 'Added to camp database'}
        </p>
        {(result.qr_code_id || result?.user?.qr_code_id) && (
          <div style={{ padding: 16, background: '#FFFFFF', borderRadius: 10, display: 'inline-block', marginBottom: 16 }}>
            <QRCodeSVG value={result.qr_code_id || result?.user?.qr_code_id} size={140} bgColor="#FFFFFF" fgColor="#0F172A" level="M" />
            <p style={{ fontSize: 11, color: '#6B7280', margin: '8px 0 0' }}>{result.qr_code_id || result?.user?.qr_code_id}</p>
          </div>
        )}
        <br />
        <button onClick={() => { setResult(null); setPhoto(null); setForm({ name: '', phone: '', address: '', blood_group: '', medical_conditions: '', current_medications: '', disability_status: '', languages_spoken: '', emergency_contact_name: '', emergency_contact_phone: '' }); }} style={s.secondaryBtn}>
          Register Another
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
        Only photo is required. All other fields are optional.
      </p>

      {/* Photo (required) */}
      <div>
        <label style={s.fieldLabel}>Photo <span style={{ color: '#EF4444' }}>*</span></label>
        {photo ? (
          <div style={{ position: 'relative', borderRadius: 10, overflow: 'hidden' }}>
            <img src={photo} alt="" style={{ width: '100%', maxHeight: 180, objectFit: 'cover', display: 'block' }} />
            <button type="button" onClick={() => { setPhoto(null); setShowCamera(false); }} style={{ position: 'absolute', top: 6, right: 6, padding: '4px 10px', background: 'rgba(0,0,0,0.7)', border: 'none', borderRadius: 6, color: 'white', fontSize: 11, cursor: 'pointer' }}>
              Retake
            </button>
          </div>
        ) : showCamera ? (
          <CameraCapture onCapture={d => { setPhoto(d); setShowCamera(false); }} onClose={() => setShowCamera(false)} label="Take Photo" />
        ) : (
          <button type="button" onClick={() => setShowCamera(true)} style={s.cameraOpenBtn}>
            Open Camera
          </button>
        )}
      </div>

      {/* Optional fields */}
      <FormField label="Full Name" value={form.name} onChange={v => updateField('name', v)} placeholder="Victim's name (if known)" />
      <FormField label="Phone" value={form.phone} onChange={v => updateField('phone', v)} placeholder="Phone number" type="tel" />
      <FormField label="Address" value={form.address} onChange={v => updateField('address', v)} placeholder="Home address" />

      <div>
        <label style={s.fieldLabel}>Blood Group</label>
        <select value={form.blood_group} onChange={e => updateField('blood_group', e.target.value)} style={s.fieldInput}>
          <option value="">Unknown</option>
          {BLOOD_GROUPS.map(bg => <option key={bg} value={bg}>{bg}</option>)}
        </select>
      </div>

      <FormField label="Medical Conditions" value={form.medical_conditions} onChange={v => updateField('medical_conditions', v)} placeholder="e.g. Diabetes, Asthma" />
      <FormField label="Current Medications" value={form.current_medications} onChange={v => updateField('current_medications', v)} placeholder="e.g. Insulin, Inhaler" />
      <FormField label="Disability Status" value={form.disability_status} onChange={v => updateField('disability_status', v)} placeholder="e.g. Wheelchair user" />
      <FormField label="Languages Spoken" value={form.languages_spoken} onChange={v => updateField('languages_spoken', v)} placeholder="e.g. Hindi, Marathi" />
      <FormField label="Emergency Contact Name" value={form.emergency_contact_name} onChange={v => updateField('emergency_contact_name', v)} placeholder="Out-of-state contact" />
      <FormField label="Emergency Contact Phone" value={form.emergency_contact_phone} onChange={v => updateField('emergency_contact_phone', v)} placeholder="Contact phone" type="tel" />

      {error && <p style={{ color: '#EF4444', fontSize: 13, margin: 0 }}>{error}</p>}

      <button type="submit" disabled={submitting} style={{ ...s.submitBtn, opacity: submitting ? 0.6 : 1 }}>
        {submitting ? 'Registering...' : 'Register Victim'}
      </button>
    </form>
  );
}

function FormField({ label, value, onChange, placeholder, type = 'text' }) {
  return (
    <div>
      <label style={s.fieldLabel}>{label}</label>
      <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} style={s.fieldInput} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// FACE SCAN TAB
// ═══════════════════════════════════════════════════════════

function FaceScanTab({ campId, onDone }) {
  return (
    <div>
      <p style={{ fontSize: 14, color: '#475569', margin: '0 0 16px' }}>
        Capture a person&apos;s face to check if they are pre-registered in the system.
      </p>
      <FaceScanner
        campId={campId}
        onMatch={() => onDone?.()}
        onNoMatch={() => {}}
      />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// QR SCAN TAB
// ═══════════════════════════════════════════════════════════

function QRScanTab({ campId, isOnline, onDone }) {
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [scanning, setScanning] = useState(true);

  const handleScan = async (data) => {
    setError('');
    const phone = data.phone;
    const qrId = data.qr_code_id || data.id;
    const raw = data.raw;
    let url = `/api/qr-lookup?camp_id=${campId}`;

    if (phone) {
      url += `&phone=${encodeURIComponent(phone)}`;
    } else if (qrId) {
      url += `&qr_code_id=${encodeURIComponent(qrId)}`;
    } else if (raw) {
      // If raw looks like a phone, query by phone; otherwise query by qr_code_id.
      const onlyDigits = raw.replace(/\D/g, '');
      if (onlyDigits.length >= 10) {
        url += `&phone=${encodeURIComponent(raw)}`;
      } else {
        url += `&qr_code_id=${encodeURIComponent(raw)}`;
      }
    } else {
      setError('Invalid QR code');
      return;
    }

    if (!isOnline) {
      setResult({ offline: true, phone });
      return;
    }

    try {
      const res = await fetch(url);
      const json = await res.json();
      if (json.found) {
        setResult({ user: json.user });
      } else {
        setError('No user found with this QR code');
      }
    } catch {
      setError('QR lookup failed');
    }
  };

  if (result) {
    return (
      <div style={{ animation: 'slideUp 0.2s ease-out' }}>
        {result.user ? (
          <div style={s.profileCard}>
            <div style={{ ...s.successBadge, marginBottom: 16 }}>Registered User Found — Added to Camp Database</div>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 }}>
              {result.user.selfie_url && <img src={result.user.selfie_url} alt="" style={{ width: 56, height: 56, borderRadius: 10, objectFit: 'cover' }} />}
              <div>
                <p style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>{result.user.name}</p>
                <p style={{ fontSize: 12, color: '#475569', margin: '2px 0' }}>{result.user.phone || 'No phone'}</p>
                <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>{result.user.state}</p>
              </div>
            </div>
            <button onClick={() => { setResult(null); setScanning(true); onDone?.(); }} style={s.secondaryBtn}>Done</button>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: 20 }}>
            <p style={{ color: '#9A3412', fontSize: 14, fontWeight: 600 }}>Saved offline — will sync later</p>
            <button onClick={() => { setResult(null); setScanning(true); }} style={s.secondaryBtn}>Scan Another</button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div>
      <p style={{ fontSize: 14, color: '#475569', margin: '0 0 16px' }}>
        Scan a victim&apos;s Sahaay QR code to retrieve their profile and add them to this camp.
      </p>
      {error && <p style={{ color: '#EF4444', fontSize: 13, margin: '0 0 12px' }}>{error}</p>}
      {scanning && <QRScanner onScan={handleScan} onClose={() => setScanning(false)} />}
      {!scanning && (
        <button onClick={() => { setScanning(true); setError(''); }} style={s.secondaryBtn}>Open Scanner</button>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// ALERTS TAB
// ═══════════════════════════════════════════════════════════

function AlertsTab({ alerts, campId, isOnline, onUpdate }) {
  const [processing, setProcessing] = useState(null);
  const [triggerType, setTriggerType] = useState('FLOOD');

  const handleAction = async (alertId, action) => {
    setProcessing(alertId);
    try {
      if (isOnline) {
        await fetch('/api/alerts/approve', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ alert_id: alertId, action }),
        });
      } else {
        const { addToQueue } = await import('@/lib/offline/offlineStore');
        await addToQueue({ action_type: 'approve_alert', payload: { alert_id: alertId, action }, camp_id: campId });
      }
      onUpdate?.();
    } catch {}
    setProcessing(null);
  };

  const triggerDummy = async () => {
    try {
      await fetch('/api/dummy-disaster', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camp_id: campId, disaster_type: triggerType }),
      });
      onUpdate?.();
    } catch {}
  };

  const SEVERITY_COLORS = {
    HIGH: { bg: 'rgba(239,68,68,0.12)', border: '#EF4444', text: '#991B1B' },
    MEDIUM: { bg: 'rgba(249,115,22,0.12)', border: '#F97316', text: '#9A3412' },
    LOW: { bg: 'rgba(34,197,94,0.1)', border: '#22C55E', text: '#166534' },
  };

  const STATUS_COLORS = {
    pending: { bg: 'rgba(249,115,22,0.12)', color: '#9A3412' },
    approved: { bg: 'rgba(59,130,246,0.12)', color: '#1E3A8A' },
    rejected: { bg: 'rgba(100,116,139,0.12)', color: '#475569' },
    calls_sent: { bg: 'rgba(34,197,94,0.12)', color: '#166534' },
  };

  return (
    <div>
      {/* Simulate disaster */}
      {isOnline && (
        <div style={{ padding: 16, background: '#FFFFFF', borderRadius: 10, marginBottom: 16, border: '1px solid #E2E8F0' }}>
          <p style={{ fontSize: 12, fontWeight: 700, color: '#6B7280', margin: '0 0 8px', textTransform: 'uppercase', letterSpacing: 1 }}>
            Simulate Disaster (Demo)
          </p>
          <div style={{ display: 'flex', gap: 8 }}>
            <select value={triggerType} onChange={e => setTriggerType(e.target.value)} style={{ ...s.fieldInput, flex: 1 }}>
              <option value="FLOOD">Flood</option>
              <option value="EARTHQUAKE">Earthquake</option>
              <option value="LANDSLIDE">Landslide</option>
              <option value="CYCLONE">Cyclone</option>
            </select>
            <button onClick={triggerDummy} style={{ ...s.dangerBtn, whiteSpace: 'nowrap' }}>
              Trigger Alert
            </button>
          </div>
        </div>
      )}

      {alerts.length === 0 ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#6B7280' }}>
          <p style={{ fontSize: 14 }}>No alerts yet</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {alerts.map(alert => {
            const sev = SEVERITY_COLORS[alert.severity] || SEVERITY_COLORS.LOW;
            const stat = STATUS_COLORS[alert.status] || STATUS_COLORS.pending;
            return (
              <div key={alert.id} style={{ ...s.alertCard, borderLeftColor: sev.border }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                  <div>
                    <span style={{ fontSize: 14, fontWeight: 700, color: '#0F172A' }}>{alert.disaster_type}</span>
                    <span style={{ ...s.severityBadge, background: sev.bg, color: sev.text, marginLeft: 8 }}>{alert.severity}</span>
                  </div>
                  <span style={{ ...s.statusBadgeSmall, background: stat.bg, color: stat.color }}>{alert.status.toUpperCase()}</span>
                </div>
                <p style={{ fontSize: 12, color: '#475569', margin: '0 0 4px' }}>{alert.description}</p>
                <p style={{ fontSize: 11, color: '#6B7280', margin: 0 }}>
                  {alert.location_name} • {new Date(alert.created_at).toLocaleString()}
                </p>

                {alert.status === 'pending' && (
                  <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                    <button
                      onClick={() => handleAction(alert.id, 'approve')}
                      disabled={processing === alert.id}
                      style={s.approveBtn}
                    >
                      {processing === alert.id ? '...' : 'Approve Alert'}
                    </button>
                    <button
                      onClick={() => handleAction(alert.id, 'reject')}
                      disabled={processing === alert.id}
                      style={s.rejectBtn}
                    >
                      Reject
                    </button>
                  </div>
                )}

                {alert.status === 'calls_sent' && (
                  <p style={{ fontSize: 12, color: '#166534', margin: '8px 0 0', fontWeight: 600 }}>
                    Evacuation calls sent
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAP TAB
// ═══════════════════════════════════════════════════════════

function MapTab({ campData, alerts }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);

  useEffect(() => {
    let map;
    const init = async () => {
      if (!mapRef.current || mapInstance.current || !campData) return;
      const mgl = (await import('maplibre-gl')).default;
      await import('maplibre-gl/dist/maplibre-gl.css');

      map = new mgl.Map({
        container: mapRef.current,
        style: {
          version: 8,
          sources: { osm: { type: 'raster', tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'], tileSize: 256, maxzoom: 19 } },
          layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
        },
        center: [campData.lng, campData.lat],
        zoom: 10,
      });

      map.on('load', () => {
        mapInstance.current = map;

        // Camp radius
        const coords = [];
        const r = campData.radius_km || 10;
        for (let i = 0; i <= 64; i++) {
          const a = (i / 64) * 2 * Math.PI;
          const dLat = (r / 6371) * (180 / Math.PI);
          const dLng = (r / (6371 * Math.cos((campData.lat * Math.PI) / 180))) * (180 / Math.PI);
          coords.push([campData.lng + dLng * Math.cos(a), campData.lat + dLat * Math.sin(a)]);
        }

        map.addSource('camp-area', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } },
        });
        map.addLayer({ id: 'camp-fill', type: 'fill', source: 'camp-area', paint: { 'fill-color': 'rgba(59,130,246,0.12)' } });
        map.addLayer({ id: 'camp-line', type: 'line', source: 'camp-area', paint: { 'line-color': '#3B82F6', 'line-width': 2 } });

        // Danger overlay for active alerts
        const dangerAlerts = alerts.filter(a => a.status === 'pending' || a.status === 'approved');
        if (dangerAlerts.length > 0) {
          map.addSource('danger-area', {
            type: 'geojson',
            data: { type: 'Feature', geometry: { type: 'Polygon', coordinates: [coords] } },
          });
          map.addLayer({ id: 'danger-fill', type: 'fill', source: 'danger-area', paint: { 'fill-color': 'rgba(239,68,68,0.2)' } });
          map.addLayer({ id: 'danger-line', type: 'line', source: 'danger-area', paint: { 'line-color': '#EF4444', 'line-width': 2 } });
        }

        // Camp marker
        const el = document.createElement('div');
        el.innerHTML = `<div style="width:24px;height:24px;border-radius:50%;background:#3B82F6;border:3px solid white;box-shadow:0 0 12px rgba(59,130,246,0.5);"></div>`;
        new mgl.Marker({ element: el }).setLngLat([campData.lng, campData.lat]).addTo(map);
      });
    };
    init();
    return () => { if (map) map.remove(); mapInstance.current = null; };
  }, [campData, alerts]);

  if (!campData) {
    return <p style={{ color: '#6B7280', textAlign: 'center', padding: 40 }}>Loading camp data...</p>;
  }

  return (
    <div>
      <div style={{ marginBottom: 12 }}>
        <p style={{ fontSize: 13, color: '#475569', margin: 0 }}>
          {campData.name} — {campData.radius_km}km coverage at {campData.lat?.toFixed(4)}, {campData.lng?.toFixed(4)}
        </p>
      </div>
      <div ref={mapRef} style={{ width: '100%', height: 400, borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0' }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// IMAGE COMPRESSION
// ═══════════════════════════════════════════════════════════

function compressImage(base64, maxWidth = 320, quality = 0.6) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      const scale = Math.min(1, maxWidth / img.width);
      canvas.width = img.width * scale;
      canvas.height = img.height * scale;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', quality));
    };
    img.onerror = () => resolve(base64);
    img.src = base64;
  });
}

// ═══════════════════════════════════════════════════════════
// STYLES
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
// UNIDENTIFIED PERSONS TAB — register & manage unknown arrivals
// ═══════════════════════════════════════════════════════════

function UnidentifiedTab({ campId, isOnline }) {
  const [persons, setPersons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [formLoading, setFormLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(null);
  const [cameraActive, setCameraActive] = useState(false);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  // Form fields
  const [photo, setPhoto] = useState(null);
  const [approxAge, setApproxAge] = useState('');
  const [gender, setGender] = useState('');
  const [injuries, setInjuries] = useState('');
  const [clothing, setClothing] = useState('');
  const [marks, setMarks] = useState('');
  const [notes, setNotes] = useState('');
  const [wristbandId, setWristbandId] = useState('');

  const fetchPersons = useCallback(async () => {
    if (!campId || !isOnline) return;
    setLoading(true);
    try {
      const res = await fetch(`/api/unidentified-persons?camp_id=${campId}`);
      const data = await res.json();
      setPersons(data.persons || []);
    } catch {}
    setLoading(false);
  }, [campId, isOnline]);

  useEffect(() => { fetchPersons(); }, [fetchPersons]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play(); }
      setCameraActive(true);
    } catch { setError('Camera access denied'); }
  };

  const capturePhoto = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const video = videoRef.current;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);
    setPhoto(canvas.toDataURL('image/jpeg', 0.8));
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
    setCameraActive(false);
  };

  const resetForm = () => {
    setPhoto(null); setApproxAge(''); setGender(''); setInjuries('');
    setClothing(''); setMarks(''); setNotes(''); setWristbandId('');
    setShowForm(false); setError(''); setSuccess(null);
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); }
    setCameraActive(false);
  };

  const handleSubmit = async () => {
    setError('');
    setFormLoading(true);
    try {
      const res = await fetch('/api/unidentified-persons', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camp_id: campId,
          photo: photo || null,
          approximate_age: approxAge || null,
          gender: gender || null,
          injuries: injuries || null,
          clothing_description: clothing || null,
          identifying_marks: marks || null,
          notes: notes || null,
          temp_wristband_id: wristbandId || null,
        }),
      });
      const data = await res.json();

      if (data.success) {
        setSuccess(data);
        fetchPersons();
        setTimeout(() => resetForm(), 3000);
      } else {
        setError(data.error || 'Registration failed');
      }
    } catch {
      setError('Network error');
    }
    setFormLoading(false);
  };

  const updateStatus = async (id, newStatus) => {
    try {
      await fetch('/api/unidentified-persons', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status: newStatus }),
      });
      fetchPersons();
    } catch {}
  };

  if (success) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
        </div>
        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#166534', margin: '0 0 8px' }}>
          Unknown Person Registered
        </h3>
        {success.autoMatch && (
          <div style={{ padding: 12, background: 'rgba(234,179,8,0.1)', borderRadius: 10, border: '1px solid rgba(234,179,8,0.2)', marginTop: 12 }}>
            <p style={{ fontSize: 14, fontWeight: 700, color: '#854D0E', margin: '0 0 4px' }}>
              🎯 Possible Match Found!
            </p>
            <p style={{ fontSize: 13, color: '#0F172A', margin: 0 }}>
              Matches missing report for <strong>{success.autoMatch.missing_name}</strong>
              {' '}({Math.round(success.autoMatch.confidence * 100)}% confidence)
            </p>
          </div>
        )}
      </div>
    );
  }

  if (showForm) {
    return (
      <div>
        <canvas ref={canvasRef} style={{ display: 'none' }} />
        <button onClick={resetForm} style={{ background: 'none', border: 'none', color: '#1E3A8A', fontSize: 13, fontWeight: 600, cursor: 'pointer', marginBottom: 12, padding: 0 }}>
          ← Back to List
        </button>

        <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 16px' }}>
          Register Unknown Person
        </h3>

        {/* Photo */}
        <div style={{ marginBottom: 14 }}>
          {photo ? (
            <div style={{ position: 'relative', display: 'inline-block' }}>
              <img src={photo} alt="Person" style={{ width: '100%', maxHeight: 200, objectFit: 'cover', borderRadius: 10, border: '1px solid #E2E8F0' }} />
              <button onClick={() => setPhoto(null)} style={{ position: 'absolute', top: 6, right: 6, width: 28, height: 28, borderRadius: '50%', background: 'rgba(239,68,68,0.9)', color: 'white', border: 'none', fontSize: 14, cursor: 'pointer' }}>✕</button>
            </div>
          ) : cameraActive ? (
            <div>
              <video ref={videoRef} style={{ width: '100%', borderRadius: 10, border: '1px solid #E2E8F0', maxHeight: 200 }} autoPlay playsInline muted />
              <button onClick={capturePhoto} style={{ width: '100%', padding: 10, marginTop: 6, background: '#22C55E', color: 'white', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>📸 Capture</button>
            </div>
          ) : (
            <button onClick={startCamera} style={{ width: '100%', padding: 16, background: '#F8FAFC', border: '2px dashed #E2E8F0', borderRadius: 10, color: '#475569', fontSize: 13, cursor: 'pointer' }}>
              📷 Take Photo
            </button>
          )}
        </div>

        <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Approx Age</label>
            <input type="number" value={approxAge} onChange={e => setApproxAge(e.target.value)} placeholder="Age" style={s.fieldInput} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Gender</label>
            <select value={gender} onChange={e => setGender(e.target.value)} style={s.fieldInput}>
              <option value="">Select</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
            </select>
          </div>
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Wristband ID (if assigned)</label>
          <input type="text" value={wristbandId} onChange={e => setWristbandId(e.target.value)} placeholder="WB-001" style={s.fieldInput} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Injuries</label>
          <input type="text" value={injuries} onChange={e => setInjuries(e.target.value)} placeholder="Describe any injuries" style={s.fieldInput} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Clothing Description</label>
          <input type="text" value={clothing} onChange={e => setClothing(e.target.value)} placeholder="What are they wearing?" style={s.fieldInput} />
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Identifying Marks</label>
          <input type="text" value={marks} onChange={e => setMarks(e.target.value)} placeholder="Scars, tattoos, birthmarks..." style={s.fieldInput} />
        </div>

        <div style={{ marginBottom: 14 }}>
          <label style={{ display: 'block', fontSize: 11, fontWeight: 600, color: '#475569', marginBottom: 4 }}>Notes</label>
          <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Any other observations..." rows={2} style={{ ...s.fieldInput, resize: 'vertical' }} />
        </div>

        {error && <p style={{ color: '#991B1B', fontSize: 13, margin: '0 0 10px' }}>{error}</p>}

        <button onClick={handleSubmit} disabled={formLoading} style={{
          ...s.submitBtn,
          opacity: formLoading ? 0.6 : 1,
          cursor: formLoading ? 'not-allowed' : 'pointer',
        }}>
          {formLoading ? 'Registering...' : '✓ Register Unknown Person'}
        </button>
      </div>
    );
  }

  // List view
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Unidentified Persons
          </h3>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
            {persons.length} person{persons.length !== 1 ? 's' : ''} registered
          </p>
        </div>
        <button onClick={() => setShowForm(true)} style={{
          padding: '8px 16px', background: 'linear-gradient(135deg, #F59E0B, #D97706)',
          color: 'white', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
        }}>
          + Add Person
        </button>
      </div>

      {loading && <div style={s.spinner} />}

      {!loading && persons.length === 0 && (
        <div style={{ textAlign: 'center', padding: 40 }}>
          <p style={{ fontSize: 28, margin: '0 0 8px' }}>👤</p>
          <p style={{ color: '#6B7280', fontSize: 14, margin: 0 }}>No unidentified persons registered</p>
          <p style={{ color: '#475569', fontSize: 12, margin: '4px 0 0' }}>
            Use &quot;+ Add Person&quot; to register someone who cannot identify themselves
          </p>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {persons.map(p => (
          <div key={p.id} style={{ padding: 14, background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
              {p.photo_url ? (
                <img src={p.photo_url} alt="" style={{ width: 48, height: 48, borderRadius: 10, objectFit: 'cover' }} />
              ) : (
                <div style={{ width: 48, height: 48, borderRadius: 10, background: '#E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#475569', fontWeight: 700, fontSize: 18 }}>?</div>
              )}

              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <div>
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: 0 }}>
                      {p.temp_wristband_id ? `Wristband: ${p.temp_wristband_id}` : `ID: ${p.id.slice(0, 8)}`}
                    </p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
                      {p.approximate_age ? `~${p.approximate_age}y` : '?'} • {p.gender || '?'}
                      {p.injuries && ` • ${p.injuries}`}
                    </p>
                  </div>
                  <span style={{
                    padding: '2px 8px', borderRadius: 6, fontSize: 10, fontWeight: 600,
                    background: p.status === 'unidentified' ? 'rgba(234,179,8,0.15)' : p.status === 'matched' ? 'rgba(34,197,94,0.15)' : 'rgba(59,130,246,0.15)',
                    color: p.status === 'unidentified' ? '#854D0E' : p.status === 'matched' ? '#166534' : '#1E3A8A',
                  }}>
                    {p.status}
                  </span>
                </div>

                {p.clothing_description && <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>Clothing: {p.clothing_description}</p>}
                {p.identifying_marks && <p style={{ fontSize: 11, color: '#475569', margin: '2px 0 0' }}>Marks: {p.identifying_marks}</p>}

                {p.status === 'unidentified' && (
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => updateStatus(p.id, 'claimed')} style={{ padding: '4px 10px', background: 'rgba(34,197,94,0.15)', border: 'none', borderRadius: 6, color: '#166534', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Mark Claimed
                    </button>
                    <button onClick={() => updateStatus(p.id, 'transferred')} style={{ padding: '4px 10px', background: 'rgba(59,130,246,0.15)', border: 'none', borderRadius: 6, color: '#1E3A8A', fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
                      Transfer
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// RESOURCES TAB — manage camp capacity & supplies
// ═══════════════════════════════════════════════════════════

const SUPPLY_OPTIONS = [
  { value: 'adequate', label: 'Adequate', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  { value: 'low', label: 'Low', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { value: 'critical', label: 'Critical', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
  { value: 'out', label: 'Out', color: '#DC2626', bg: 'rgba(220,38,38,0.25)' },
];

const POWER_OPTIONS = [
  { value: 'available', label: 'Grid Power', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  { value: 'generator', label: 'Generator', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { value: 'none', label: 'No Power', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
];

const NET_OPTIONS = [
  { value: 'available', label: 'Available', color: '#22C55E', bg: 'rgba(34,197,94,0.15)' },
  { value: 'intermittent', label: 'Intermittent', color: '#F59E0B', bg: 'rgba(245,158,11,0.15)' },
  { value: 'none', label: 'None', color: '#EF4444', bg: 'rgba(239,68,68,0.15)' },
];

function ResourcesTab({ campId, isOnline, victimCount }) {
  const [res, setRes] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [isNew, setIsNew] = useState(false);

  // Form state
  const [totalCapacity, setTotalCapacity] = useState(0);
  const [availableBeds, setAvailableBeds] = useState(0);
  const [foodStatus, setFoodStatus] = useState('adequate');
  const [waterStatus, setWaterStatus] = useState('adequate');
  const [medicalSupplies, setMedicalSupplies] = useState('adequate');
  const [powerStatus, setPowerStatus] = useState('available');
  const [internetStatus, setInternetStatus] = useState('available');
  const [specialNeeds, setSpecialNeeds] = useState(0);
  const [criticalFlag, setCriticalFlag] = useState('');

  useEffect(() => {
    if (!campId || !isOnline) return;
    setLoading(true);
    fetch(`/api/camp-resources?camp_id=${campId}`)
      .then(r => r.json())
      .then(d => {
        const r = d.resources;
        if (r) {
          setTotalCapacity(r.total_capacity || 0);
          setAvailableBeds(r.available_beds || 0);
          setFoodStatus(r.food_status || 'adequate');
          setWaterStatus(r.water_status || 'adequate');
          setMedicalSupplies(r.medical_supplies || 'adequate');
          setPowerStatus(r.power_status || 'available');
          setInternetStatus(r.internet_status || 'available');
          setSpecialNeeds(r.special_needs_count || 0);
          setCriticalFlag(r.critical_flag || '');
          setRes(r);
        }
        setIsNew(!!d.isNew);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [campId, isOnline]);

  const handleSave = async () => {
    setSaving(true);
    setSaved(false);
    try {
      const payload = {
        camp_id: campId,
        total_capacity: totalCapacity,
        current_population: victimCount,
        available_beds: availableBeds,
        food_status: foodStatus,
        water_status: waterStatus,
        medical_supplies: medicalSupplies,
        power_status: powerStatus,
        internet_status: internetStatus,
        special_needs_count: specialNeeds,
        critical_flag: criticalFlag || null,
      };

      const res = await fetch('/api/camp-resources', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        setRes(data.resources);
        setIsNew(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    } catch {}
    setSaving(false);
  };

  const StatusSelector = ({ label, icon, value, onChange, options }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
        {icon} {label}
      </label>
      <div style={{ display: 'flex', gap: 6 }}>
        {options.map(opt => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            style={{
              flex: 1, padding: '8px 4px',
              background: value === opt.value ? opt.bg : '#FFFFFF',
              border: value === opt.value ? `1px solid ${opt.color}` : '1px solid #E2E8F0',
              borderRadius: 8, color: value === opt.value ? opt.color : '#6B7280',
              fontSize: 11, fontWeight: 600, cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );

  if (loading) return <div style={s.spinner} />;

  const occupancyPct = totalCapacity > 0 ? Math.round((victimCount / totalCapacity) * 100) : 0;
  const hasCritical = foodStatus === 'critical' || foodStatus === 'out' ||
    waterStatus === 'critical' || waterStatus === 'out' ||
    medicalSupplies === 'critical' || medicalSupplies === 'out' ||
    powerStatus === 'none';

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: 0 }}>Camp Resources</h3>
          <p style={{ fontSize: 12, color: '#6B7280', margin: '2px 0 0' }}>
            {isNew ? 'Set up initial resource tracking' : `Last updated: ${res?.updated_at ? new Date(res.updated_at).toLocaleString() : 'Never'}`}
          </p>
        </div>
        {saved && (
          <span style={{ padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 600, background: 'rgba(34,197,94,0.15)', color: '#166534' }}>Saved!</span>
        )}
      </div>

      {/* Occupancy overview */}
      <div style={{ padding: 16, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0', marginBottom: 16 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>Camp Occupancy</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: occupancyPct > 90 ? '#EF4444' : occupancyPct > 70 ? '#F59E0B' : '#22C55E' }}>
            {victimCount} / {totalCapacity || '?'}
          </span>
        </div>
        <div style={{ width: '100%', height: 8, background: '#FFFFFF', borderRadius: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4, transition: 'width 0.5s',
            width: `${Math.min(occupancyPct, 100)}%`,
            background: occupancyPct > 90 ? '#EF4444' : occupancyPct > 70 ? '#F59E0B' : '#22C55E',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 10 }}>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Total Capacity</label>
            <input type="number" value={totalCapacity} onChange={e => setTotalCapacity(parseInt(e.target.value) || 0)}
              style={s.fieldInput} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Available Beds</label>
            <input type="number" value={availableBeds} onChange={e => setAvailableBeds(parseInt(e.target.value) || 0)}
              style={s.fieldInput} />
          </div>
          <div style={{ flex: 1 }}>
            <label style={{ display: 'block', fontSize: 11, color: '#6B7280', marginBottom: 4 }}>Special Needs</label>
            <input type="number" value={specialNeeds} onChange={e => setSpecialNeeds(parseInt(e.target.value) || 0)}
              style={s.fieldInput} />
          </div>
        </div>
      </div>

      {/* Supply statuses */}
      <StatusSelector label="Food Supply" icon="🍚" value={foodStatus} onChange={setFoodStatus} options={SUPPLY_OPTIONS} />
      <StatusSelector label="Water Supply" icon="💧" value={waterStatus} onChange={setWaterStatus} options={SUPPLY_OPTIONS} />
      <StatusSelector label="Medical Supplies" icon="💊" value={medicalSupplies} onChange={setMedicalSupplies} options={SUPPLY_OPTIONS} />
      <StatusSelector label="Power" icon="⚡" value={powerStatus} onChange={setPowerStatus} options={POWER_OPTIONS} />
      <StatusSelector label="Internet" icon="📶" value={internetStatus} onChange={setInternetStatus} options={NET_OPTIONS} />

      {/* Critical flag */}
      <div style={{ marginBottom: 16 }}>
        <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
          🚨 Critical Alert (optional)
        </label>
        <input
          type="text" value={criticalFlag} onChange={e => setCriticalFlag(e.target.value)}
          placeholder="e.g. Need 50 blankets urgently, medical team required"
          style={s.fieldInput}
        />
        <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0' }}>This will trigger an alert visible to Super Admin</p>
      </div>

      {hasCritical && (
        <div style={{ padding: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', margin: '0 0 4px' }}>⚠️ Critical Resource Levels</p>
          <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>Saving will auto-alert Super Admins about critical supply levels.</p>
        </div>
      )}

      <button onClick={handleSave} disabled={saving} style={{
        ...s.submitBtn,
        opacity: saving ? 0.6 : 1,
        cursor: saving ? 'not-allowed' : 'pointer',
      }}>
        {saving ? 'Saving...' : saved ? '✓ Saved!' : '💾 Save Resource Status'}
      </button>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// EVACUATE / SHIFT TAB
// ═══════════════════════════════════════════════════════════

function EvacuateTab({ campId, campData, victims, isOnline }) {
  const [targetCamps, setTargetCamps] = useState([]);
  const [selectedTarget, setSelectedTarget] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [reason, setReason] = useState('');

  useEffect(() => {
    if (!isOnline) return;
    fetch('/api/camps')
      .then(r => r.json())
      .then(d => {
        const others = (d.camps || []).filter(c => c.id !== campId && c.status === 'active');
        setTargetCamps(others);
      })
      .catch(() => {});
  }, [campId, isOnline]);

  const handleEvacuate = async () => {
    if (!selectedTarget) return;
    setLoading(true);
    try {
      const res = await fetch('/api/evacuate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_camp_id: campId,
          target_camp_id: selectedTarget,
          reason: reason.trim() || 'Location no longer safe',
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Evacuation failed');

      setResult({
        success: true,
        moved: data.moved || victims.length,
        targetName: targetCamps.find(c => c.id === selectedTarget)?.name || 'Target camp',
      });
    } catch (err) {
      setResult({ success: false, error: err.message });
    }
    setLoading(false);
  };

  if (result) {
    return (
      <div style={{ textAlign: 'center', padding: 20 }}>
        {result.success ? (
          <>
            <div style={{ width: 56, height: 56, borderRadius: '50%', background: 'rgba(34,197,94,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#22C55E" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            </div>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#166534', margin: '0 0 8px' }}>
              Evacuation Initiated
            </h3>
            <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>
              {result.moved} people being shifted to {result.targetName}
            </p>
          </>
        ) : (
          <>
            <h3 style={{ fontSize: 18, fontWeight: 700, color: '#991B1B', margin: '0 0 8px' }}>
              Evacuation Failed
            </h3>
            <p style={{ fontSize: 14, color: '#475569', margin: 0 }}>{result.error}</p>
          </>
        )}
        <button onClick={() => setResult(null)} style={{
          marginTop: 16, padding: '10px 24px', background: '#E2E8F0', border: 'none',
          borderRadius: 8, color: '#0F172A', fontSize: 13, fontWeight: 600, cursor: 'pointer',
        }}>
          Back
        </button>
      </div>
    );
  }

  return (
    <div>
      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
        Evacuate / Shift Camp
      </h3>
      <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 16px' }}>
        Transfer all {victims.length} victims to another camp if this location is no longer safe.
      </p>

      <div style={{ padding: 16, background: 'rgba(239,68,68,0.06)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 12, marginBottom: 16 }}>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#991B1B', margin: '0 0 4px' }}>⚠️ Warning</p>
        <p style={{ fontSize: 12, color: '#475569', margin: 0 }}>
          This will move ALL checked-in victims to the target camp and mark this camp as evacuated.
          This action should only be used when the current location is unsafe.
        </p>
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
          Reason for Evacuation
        </label>
        <input
          type="text" value={reason} onChange={e => setReason(e.target.value)}
          placeholder="e.g. Flood water rising, structural damage"
          style={{ width: '100%', padding: '12px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 10, color: '#0F172A', fontSize: 14, outline: 'none', boxSizing: 'border-box' }}
        />
      </div>

      <div style={{ marginBottom: 14 }}>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 }}>
          Transfer To
        </label>
        {targetCamps.length === 0 ? (
          <p style={{ fontSize: 13, color: '#6B7280' }}>No other active camps available</p>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {targetCamps.map(camp => (
              <button
                key={camp.id}
                onClick={() => setSelectedTarget(camp.id)}
                style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: 14, background: selectedTarget === camp.id ? 'rgba(59,130,246,0.1)' : '#F8FAFC',
                  border: selectedTarget === camp.id ? '1px solid #3B82F6' : '1px solid #E2E8F0',
                  borderRadius: 10, cursor: 'pointer', textAlign: 'left',
                }}
              >
                <div>
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#0F172A', margin: 0 }}>{camp.name}</p>
                  <p style={{ fontSize: 11, color: '#6B7280', margin: '2px 0 0' }}>
                    {camp.operator_name} • {camp.radius_km}km radius
                  </p>
                </div>
                {selectedTarget === camp.id && (
                  <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#3B82F6' }} />
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      <button
        onClick={handleEvacuate}
        disabled={!selectedTarget || loading}
        style={{
          width: '100%', padding: 14,
          background: selectedTarget ? 'linear-gradient(135deg, #EF4444, #DC2626)' : '#E2E8F0',
          color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
          cursor: selectedTarget && !loading ? 'pointer' : 'not-allowed',
          opacity: selectedTarget && !loading ? 1 : 0.5,
        }}
      >
        {loading ? 'Initiating Evacuation...' : `Evacuate ${victims.length} People`}
      </button>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh', background: '#F1F5F9', display: 'flex', flexDirection: 'column', alignItems: 'center',
    fontFamily: "'Inter', system-ui, sans-serif", color: '#0F172A',
  },
  card: {
    background: '#FFFFFF', border: '1px solid #E2E8F0', borderRadius: 16, padding: 32, color: '#0F172A',
  },
  header: {
    padding: '16px 24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    background: '#FFFFFF', borderBottom: '1px solid #E2E8F0', width: '100%', maxWidth: '1320px',
  },
  logo: {
    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontWeight: 800, fontSize: 18, color: 'white', background: 'linear-gradient(135deg, #1B3676, #2A5298)',
  },
  statusBadge: {
    display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px', borderRadius: 20,
    fontSize: 12, fontWeight: 700, border: '1px solid',
  },
  alertBadge: {
    padding: '4px 12px', borderRadius: 20, fontSize: 11, fontWeight: 700,
    background: '#FEF2F2', color: '#DC2626', border: '1px solid #FECACA',
    animation: 'pulse 2s infinite',
  },
  tabBar: {
    display: 'flex', gap: 4, padding: '0 24px', background: 'transparent', width: '100%', maxWidth: '1320px',
    borderBottom: '1px solid #E2E8F0', overflowX: 'auto', marginTop: 16,
  },
  tab: {
    padding: '14px 20px', border: '1px solid transparent', background: 'transparent', color: '#6B7280', fontSize: 14,
    fontWeight: 600, cursor: 'pointer', borderBottom: '3px solid transparent', whiteSpace: 'nowrap',
    position: 'relative', display: 'flex', alignItems: 'center', gap: 6,
    transition: 'all 0.15s ease',
  },
  tabActive: { color: '#1B3676', borderBottomColor: '#1B3676' },
  tabBadge: {
    padding: '2px 8px', borderRadius: 12, fontSize: 11, fontWeight: 700,
    background: '#FEF2F2', color: '#DC2626',
  },
  content: { flex: 1, overflowY: 'auto', padding: '24px', background: 'white', borderTop: 'none', margin: '0 0 24px 0', borderRadius: '0 0 12px 12px', border: '1px solid #E2E8F0', boxShadow: '0 4px 12px rgba(0,0,0,0.03)', width: '100%', maxWidth: '1320px' },
  searchInput: {
    width: '100%', padding: '12px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0',
    borderRadius: 10, color: '#0F172A', fontSize: 14, outline: 'none', boxSizing: 'border-box',
    transition: 'border-color 0.2s',
  },
  spinner: {
    width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#1B3676',
    borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '20px auto',
  },
  victimCard: {
    padding: '14px 20px', background: '#F8FAFC', borderRadius: 10, border: '1px solid #E2E8F0',
    cursor: 'pointer', transition: 'border-color 0.2s, background 0.2s',
  },
  victimThumb: { width: 44, height: 44, borderRadius: 10, objectFit: 'cover' },
  victimThumbPlaceholder: {
    width: 44, height: 44, borderRadius: 10, background: '#E2E8F0', display: 'flex',
    alignItems: 'center', justifyContent: 'center', color: '#6B7280', fontWeight: 700, fontSize: 16,
  },
  regTypeBadge: { padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  checkinBadge: { padding: '4px 10px', borderRadius: 6, fontSize: 11, fontWeight: 600, background: '#F1F5F9', color: '#64748B' },
  qrBtn: {
    padding: '6px 12px', background: '#EEF2FF', border: '1px solid #C7D2FE',
    borderRadius: 6, color: '#4F46E5', fontSize: 11, fontWeight: 700, cursor: 'pointer',
  },
  backBtn: {
    padding: '8px 0', border: 'none', background: 'none', color: '#4F46E5', fontSize: 14,
    fontWeight: 600, cursor: 'pointer', marginBottom: 16, display: 'block',
  },
  profileCard: { padding: 24, background: '#F8FAFC', borderRadius: 12, border: '1px solid #E2E8F0' },
  detailGrid: { display: 'flex', flexDirection: 'column' },
  fieldLabel: { display: 'block', fontSize: 13, fontWeight: 600, color: '#475569', marginBottom: 6 },
  fieldInput: {
    width: '100%', padding: '12px 14px', background: '#FFFFFF', border: '1px solid #E2E8F0',
    borderRadius: 8, color: '#0F172A', fontSize: 14, outline: 'none', boxSizing: 'border-box',
  },
  cameraOpenBtn: {
    width: '100%', padding: 14, background: '#F8FAFC', border: '2px dashed #CBD5E1',
    borderRadius: 10, color: '#64748B', fontSize: 14, fontWeight: 600, cursor: 'pointer', textAlign: 'center',
  },
  submitBtn: {
    width: '100%', padding: '14px 20px', background: 'linear-gradient(135deg, #1B3676, #2A5298)',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer',
  },
  secondaryBtn: {
    padding: '10px 24px', background: '#F1F5F9', border: '1px solid #E2E8F0', borderRadius: 8,
    color: '#0F172A', fontSize: 14, fontWeight: 600, cursor: 'pointer',
  },
  primaryBtn: {
    display: 'inline-block', padding: '12px 28px', background: 'linear-gradient(135deg, #1B3676, #2A5298)',
    color: 'white', borderRadius: 10, fontWeight: 700, textDecoration: 'none', fontSize: 14,
  },
  successIcon: {
    width: 64, height: 64, borderRadius: '50%', background: '#D1FAE5',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  successBadge: {
    display: 'inline-block', padding: '8px 16px', background: '#D1FAE5',
    color: '#065F46', borderRadius: 20, fontSize: 13, fontWeight: 700,
    border: '1px solid #A7F3D0',
  },
  alertCard: {
    padding: '16px 20px', background: '#FFFFFF', borderRadius: 10,
    border: '1px solid #E2E8F0', borderLeft: '3px solid',
  },
  severityBadge: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
  },
  statusBadgeSmall: {
    display: 'inline-block', padding: '3px 10px', borderRadius: 10, fontSize: 11, fontWeight: 700,
  },
  approveBtn: {
    flex: 1, padding: '12px', background: '#DCFCE7', border: '1px solid #166534',
    borderRadius: 8, color: '#166534', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
  rejectBtn: {
    padding: '12px 18px', background: '#FEE2E2', border: '1px solid #991B1B',
    borderRadius: 8, color: '#991B1B', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  dangerBtn: {
    padding: '12px 18px', background: '#FEF2F2', border: '1px solid #FECACA',
    borderRadius: 8, color: '#DC2626', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },
};
