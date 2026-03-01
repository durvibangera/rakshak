/**
 * FILE: app/user/dashboard/page.js
 * PURPOSE: User dashboard shown after login.
 *          Shows: profile info, camp/center assignment, QR card, map, missing reports.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { QRCodeSVG } from 'qrcode.react';

const CampMap = dynamic(() => import('@/components/map/CampMap'), { ssr: false });

export default function UserDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [camp, setCamp] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview'); // overview | reports | map

  useEffect(() => {
    const phone = localStorage.getItem('rakshak_phone');
    if (!phone) {
      router.push('/login');
      return;
    }

    // Load cached data immediately
    try {
      const cachedUser = localStorage.getItem('rakshak_user');
      const cachedCamp = localStorage.getItem('rakshak_camp');
      if (cachedUser) setUser(JSON.parse(cachedUser));
      if (cachedCamp) setCamp(JSON.parse(cachedCamp));
    } catch {}

    // Fetch fresh data
    fetch('/api/auth/phone-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    })
      .then(r => r.json())
      .then(data => {
        if (data.user) {
          setUser(data.user);
          localStorage.setItem('rakshak_user', JSON.stringify(data.user));
        }
        if (data.camp) {
          setCamp(data.camp);
          localStorage.setItem('rakshak_camp', JSON.stringify(data.camp));
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    // Fetch missing reports
    fetch(`/api/missing-reports?reporter_phone=${encodeURIComponent(phone)}`)
      .then(r => r.json())
      .then(data => {
        if (data.reports) setReports(data.reports);
      })
      .catch(() => {});
  }, [router]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('rakshak_phone');
    localStorage.removeItem('rakshak_user');
    localStorage.removeItem('rakshak_camp');
    router.push('/');
  }, [router]);

  if (loading && !user) {
    return (
      <div style={s.page}>
        <div style={{ textAlign: 'center', padding: 60 }}>
          <div style={s.spinner} />
          <p style={{ color: '#94A3B8', marginTop: 16 }}>Loading your dashboard...</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const STATUS_MAP = {
    active: { label: 'Searching', color: '#F59E0B', icon: '🔍' },
    match_found: { label: 'Match Found', color: '#3B82F6', icon: '📍' },
    under_review: { label: 'Under Review', color: '#A78BFA', icon: '📋' },
    reunited: { label: 'Reunited', color: '#22C55E', icon: '✅' },
    closed: { label: 'Closed', color: '#64748B', icon: '📁' },
  };

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <div style={s.headerTop}>
          <div style={s.logoBadge}>R</div>
          <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>
        </div>
        <div style={s.greeting}>
          <div style={s.avatarRow}>
            {user.selfie_url ? (
              <img src={user.selfie_url} alt="" style={s.avatar} />
            ) : (
              <div style={s.avatarPlaceholder}>
                {(user.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <p style={s.welcomeText}>Welcome back,</p>
              <h1 style={s.userName}>{user.name || 'User'}</h1>
              <p style={s.userPhone}>{user.phone}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={s.tabBar}>
        {[
          { key: 'overview', label: 'Overview', icon: '📊' },
          { key: 'reports', label: 'Reports', icon: '📋' },
          { key: 'map', label: 'Map', icon: '🗺️' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              ...s.tab,
              ...(activeTab === tab.key ? s.tabActive : {}),
            }}
          >
            <span>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* Overview Tab */}
      {activeTab === 'overview' && (
        <div style={s.content}>
          {/* Camp Assignment */}
          <div style={s.section}>
            <h3 style={s.sectionTitle}>Your Relief Center</h3>
            {camp ? (
              <div style={s.campCard}>
                <div style={s.campHeader}>
                  <span style={{ fontSize: 24 }}>🏕️</span>
                  <div>
                    <p style={s.campName}>{camp.name}</p>
                    <div style={s.campStatusRow}>
                      <span style={{
                        ...s.campStatusDot,
                        background: camp.status === 'active' ? '#22C55E' : camp.status === 'full' ? '#EF4444' : '#64748B',
                      }} />
                      <span style={s.campStatusText}>
                        {camp.status === 'active' ? 'Open' : camp.status === 'full' ? 'Full' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                {(camp.lat && camp.lng) && (
                  <a
                    href={`https://www.google.com/maps/dir/?api=1&destination=${camp.lat},${camp.lng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={s.directionsBtn}
                  >
                    📍 Get Directions
                  </a>
                )}
              </div>
            ) : (
              <div style={s.noCamp}>
                <span style={{ fontSize: 28, opacity: 0.5 }}>🏠</span>
                <p style={s.noCampText}>Not assigned to any camp yet</p>
                <p style={s.noCampSub}>You&apos;ll be assigned when you check into a relief camp</p>
              </div>
            )}
          </div>

          {/* QR Code */}
          {user.qr_code_id && (
            <div style={s.section}>
              <h3 style={s.sectionTitle}>Your QR Identity</h3>
              <div style={s.qrCard}>
                <div style={s.qrDisplay}>
                  <div style={s.qrCodeBox}>
                    <QRCodeSVG
                      value={user.qr_code_id}
                      size={160}
                      bgColor="#FFFFFF"
                      fgColor="#0F172A"
                      level="H"
                      includeMargin={true}
                    />
                  </div>
                </div>
                <p style={s.qrId}>ID: {user.qr_code_id}</p>
                <p style={s.qrHint}>Show this code at any relief camp for instant check-in</p>
              </div>
            </div>
          )}

          {/* Personal Info */}
          <div style={s.section}>
            <h3 style={s.sectionTitle}>Your Information</h3>
            <div style={s.infoCard}>
              <InfoRow label="Name" value={user.name} />
              <InfoRow label="Phone" value={user.phone} />
              <InfoRow label="State" value={user.state} />
              <InfoRow label="Blood Group" value={user.blood_group || '—'} />
              <InfoRow label="Medical Conditions" value={user.medical_conditions || 'None reported'} />
              <InfoRow label="Disability" value={user.disability_status || 'None'} />
              <InfoRow label="Registration" value={user.registration_type === 'self' ? 'Self Registered' : 'Camp Registered'} />
              {user.emergency_contact_name && (
                <InfoRow label="Emergency Contact" value={`${user.emergency_contact_name} (${user.emergency_contact_phone || '—'})`} />
              )}
              <InfoRow label="Registered On" value={user.created_at ? new Date(user.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'} />
            </div>
          </div>

          {/* Quick Actions */}
          <div style={s.section}>
            <h3 style={s.sectionTitle}>Quick Actions</h3>
            <div style={s.actionsGrid}>
              <button onClick={() => router.push('/report-missing')} style={{ ...s.actionBtn, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)' }}>
                <span>🔍</span>
                <span style={{ color: '#FCA5A5' }}>Report Missing</span>
              </button>
              <button onClick={() => router.push('/track-report')} style={s.actionBtn}>
                <span>📋</span>
                <span>Track Report</span>
              </button>
              <button onClick={() => router.push('/flood-prediction')} style={s.actionBtn}>
                <span>🗺️</span>
                <span>Disaster Map</span>
              </button>
              <button onClick={() => window.location.href = 'tel:112'} style={s.actionBtn}>
                <span>🆘</span>
                <span>Emergency SOS</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Reports Tab */}
      {activeTab === 'reports' && (
        <div style={s.content}>
          <div style={s.section}>
            <div style={s.sectionHeaderRow}>
              <h3 style={s.sectionTitle}>Your Missing Person Reports</h3>
              <button onClick={() => router.push('/report-missing')} style={s.newReportBtn}>+ New Report</button>
            </div>

            {reports.length === 0 ? (
              <div style={s.emptyState}>
                <span style={{ fontSize: 36, opacity: 0.5 }}>📭</span>
                <p style={s.emptyTitle}>No Reports Filed</p>
                <p style={s.emptyText}>You haven&apos;t filed any missing person reports yet.</p>
                <button onClick={() => router.push('/report-missing')} style={s.emptyBtn}>
                  File a Report
                </button>
              </div>
            ) : (
              <div style={s.reportsList}>
                {reports.map(report => {
                  const st = STATUS_MAP[report.status] || STATUS_MAP.active;
                  return (
                    <div key={report.id} style={s.reportCard}>
                      <div style={s.reportHeader}>
                        <div style={s.reportLeft}>
                          {report.photo_url ? (
                            <img src={report.photo_url} alt="" style={s.reportPhoto} />
                          ) : (
                            <div style={s.reportPhotoEmpty}>👤</div>
                          )}
                          <div>
                            <p style={s.reportName}>{report.name || 'Unknown'}</p>
                            <p style={s.reportMeta}>
                              {report.age ? `${report.age} yrs` : ''}
                              {report.age && report.gender ? ' · ' : ''}
                              {report.gender || ''}
                            </p>
                          </div>
                        </div>
                        <div style={{
                          ...s.statusPill,
                          background: `${st.color}18`,
                          border: `1px solid ${st.color}40`,
                          color: st.color,
                        }}>
                          {st.icon} {st.label}
                        </div>
                      </div>

                      {/* Match info */}
                      {report.matched_camp_name && (
                        <div style={s.matchInfo}>
                          <span>🏕️</span>
                          <span>Located at <strong>{report.matched_camp_name}</strong></span>
                          {report.match_confidence && (
                            <span style={s.confidenceBadge}>
                              {Math.round(report.match_confidence * 100)}% match
                            </span>
                          )}
                        </div>
                      )}

                      <div style={s.reportFooter}>
                        <span style={s.reportDate}>
                          Filed {new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>
                        {report.last_known_location && (
                          <span style={s.reportLoc}>📍 {report.last_known_location}</span>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Map Tab */}
      {activeTab === 'map' && (
        <div style={s.content}>
          <div style={s.section}>
            <h3 style={s.sectionTitle}>Relief Camps Near You</h3>
            <div style={s.mapContainer}>
              <CampMap
                camps={camp ? [camp] : []}
                userLocation={user.lat && user.lng ? { lat: user.lat, lng: user.lng } : null}
              />
            </div>
            {camp && (
              <div style={{ ...s.campCard, marginTop: 12 }}>
                <div style={s.campHeader}>
                  <span style={{ fontSize: 20 }}>🏕️</span>
                  <div>
                    <p style={s.campName}>{camp.name}</p>
                    <p style={{ fontSize: 12, color: '#64748B', margin: '2px 0 0' }}>Your assigned camp</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={s.infoRow}>
      <span style={s.infoLabel}>{label}</span>
      <span style={s.infoValue}>{value || '—'}</span>
    </div>
  );
}

const s = {
  page: {
    minHeight: '100vh', background: '#0F172A', maxWidth: 520,
    margin: '0 auto', fontFamily: 'system-ui, sans-serif',
  },
  header: {
    background: 'linear-gradient(180deg, #1E293B 0%, #0F172A 100%)',
    padding: '20px 20px 24px', borderBottom: '1px solid #334155',
  },
  headerTop: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16,
  },
  logoBadge: {
    width: 36, height: 36, borderRadius: 10, display: 'flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 800, fontSize: 16, color: 'white',
    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
  },
  logoutBtn: {
    background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8, padding: '6px 14px', color: '#FCA5A5', fontSize: 12,
    fontWeight: 600, cursor: 'pointer',
  },
  greeting: {},
  avatarRow: { display: 'flex', gap: 14, alignItems: 'center' },
  avatar: { width: 56, height: 56, borderRadius: 14, objectFit: 'cover', border: '2px solid #334155' },
  avatarPlaceholder: {
    width: 56, height: 56, borderRadius: 14, background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    color: '#fff', fontSize: 22, fontWeight: 800,
  },
  welcomeText: { fontSize: 12, color: '#64748B', margin: 0 },
  userName: { fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: '2px 0 0' },
  userPhone: { fontSize: 13, color: '#94A3B8', margin: '2px 0 0' },

  // Tabs
  tabBar: {
    display: 'flex', gap: 4, padding: '8px 16px', background: '#0F172A',
    borderBottom: '1px solid #1E293B', position: 'sticky', top: 0, zIndex: 10,
  },
  tab: {
    flex: 1, display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'center',
    padding: '10px 8px', background: 'transparent', border: 'none', borderRadius: 8,
    color: '#64748B', fontSize: 13, fontWeight: 600, cursor: 'pointer',
  },
  tabActive: {
    background: '#1E293B', color: '#E2E8F0', border: '1px solid #334155',
  },

  content: { padding: '16px' },
  section: { marginBottom: 20 },
  sectionTitle: {
    fontSize: 12, fontWeight: 700, color: '#64748B', textTransform: 'uppercase',
    letterSpacing: 0.8, margin: '0 0 10px',
  },
  sectionHeaderRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10,
  },

  // Camp
  campCard: {
    background: '#1E293B', borderRadius: 12, padding: 16, border: '1px solid #334155',
  },
  campHeader: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 10 },
  campName: { fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: 0 },
  campStatusRow: { display: 'flex', gap: 6, alignItems: 'center', marginTop: 3 },
  campStatusDot: { width: 8, height: 8, borderRadius: '50%' },
  campStatusText: { fontSize: 12, color: '#94A3B8' },
  directionsBtn: {
    display: 'block', textAlign: 'center', padding: '10px', background: 'rgba(59,130,246,0.1)',
    borderRadius: 8, color: '#60A5FA', fontSize: 13, fontWeight: 600,
    textDecoration: 'none', border: '1px solid rgba(59,130,246,0.2)',
  },
  noCamp: {
    textAlign: 'center', padding: 24, background: '#1E293B', borderRadius: 12,
    border: '1px solid #334155',
  },
  noCampText: { fontSize: 14, fontWeight: 600, color: '#94A3B8', margin: '10px 0 4px' },
  noCampSub: { fontSize: 12, color: '#475569', margin: 0 },

  // QR
  qrCard: {
    background: '#1E293B', borderRadius: 12, padding: 16, border: '1px solid #334155',
    textAlign: 'center',
  },
  qrDisplay: {
    display: 'flex', justifyContent: 'center', marginBottom: 10,
  },
  qrCodeBox: {
    background: '#FFFFFF', borderRadius: 12, padding: 4,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  qrId: { fontSize: 12, color: '#94A3B8', margin: '8px 0 4px', fontFamily: 'monospace', fontWeight: 700 },
  qrHint: { fontSize: 12, color: '#64748B', margin: 0 },

  // Info
  infoCard: {
    background: '#1E293B', borderRadius: 12, border: '1px solid #334155',
    overflow: 'hidden',
  },
  infoRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '10px 16px', borderBottom: '1px solid rgba(51,65,85,0.5)',
  },
  infoLabel: { fontSize: 12, color: '#64748B', fontWeight: 500 },
  infoValue: { fontSize: 13, color: '#E2E8F0', fontWeight: 600, textAlign: 'right', maxWidth: '60%' },

  // Actions
  actionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 },
  actionBtn: {
    padding: '14px 12px', background: '#1E293B', border: '1px solid #334155',
    borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center',
    gap: 6, cursor: 'pointer', fontSize: 12, fontWeight: 600, color: '#94A3B8',
  },

  // Reports
  newReportBtn: {
    padding: '6px 14px', background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 8, color: '#FCA5A5', fontSize: 12, fontWeight: 600, cursor: 'pointer',
  },
  reportsList: { display: 'flex', flexDirection: 'column', gap: 10 },
  reportCard: {
    background: '#1E293B', borderRadius: 12, padding: 14, border: '1px solid #334155',
  },
  reportHeader: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8,
  },
  reportLeft: { display: 'flex', gap: 10, alignItems: 'center' },
  reportPhoto: { width: 40, height: 40, borderRadius: 8, objectFit: 'cover' },
  reportPhotoEmpty: {
    width: 40, height: 40, borderRadius: 8, background: '#334155',
    display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16,
  },
  reportName: { fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: 0 },
  reportMeta: { fontSize: 11, color: '#64748B', margin: '1px 0 0' },
  statusPill: {
    padding: '4px 10px', borderRadius: 16, fontSize: 11, fontWeight: 700,
    whiteSpace: 'nowrap',
  },
  matchInfo: {
    display: 'flex', gap: 6, alignItems: 'center', padding: '8px 10px',
    background: 'rgba(59,130,246,0.06)', borderRadius: 8, fontSize: 12,
    color: '#93C5FD', marginBottom: 8,
  },
  confidenceBadge: {
    marginLeft: 'auto', padding: '2px 8px', background: 'rgba(34,197,94,0.1)',
    borderRadius: 10, fontSize: 10, color: '#86EFAC', fontWeight: 700,
  },
  reportFooter: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
  },
  reportDate: { fontSize: 11, color: '#475569' },
  reportLoc: { fontSize: 11, color: '#64748B' },

  // Empty
  emptyState: {
    textAlign: 'center', padding: 32, background: '#1E293B', borderRadius: 12,
    border: '1px solid #334155',
  },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#E2E8F0', margin: '10px 0 4px' },
  emptyText: { fontSize: 13, color: '#64748B', margin: '0 0 16px' },
  emptyBtn: {
    padding: '10px 24px', background: 'rgba(239,68,68,0.12)', border: '1px solid rgba(239,68,68,0.3)',
    borderRadius: 8, color: '#FCA5A5', fontSize: 13, fontWeight: 700, cursor: 'pointer',
  },

  // Map
  mapContainer: {
    height: 300, borderRadius: 12, overflow: 'hidden', border: '1px solid #334155',
  },

  // Spinner
  spinner: {
    width: 40, height: 40, border: '3px solid rgba(59,130,246,0.2)',
    borderTopColor: '#3B82F6', borderRadius: '50%', margin: '0 auto',
    animation: 'spin 0.8s linear infinite',
  },
};
