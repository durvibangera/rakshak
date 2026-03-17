'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { QRCodeSVG } from 'qrcode.react';

const CampMap = dynamic(() => import('@/components/map/CampMap'), { ssr: false });

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function UserDashboard() {
  const router = useRouter();
  const [user, setUser] = useState(null);
  const [camp, setCamp] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const phone = localStorage.getItem('sahaay_phone');
    if (!phone) { router.push('/login'); return; }
    try {
      const cachedUser = localStorage.getItem('sahaay_user');
      const cachedCamp = localStorage.getItem('sahaay_camp');
      if (cachedUser) setUser(JSON.parse(cachedUser));
      if (cachedCamp) setCamp(JSON.parse(cachedCamp));
    } catch {}
    fetch('/api/auth/phone-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone }),
    }).then(r => r.json()).then(data => {
      if (data.user) { setUser(data.user); localStorage.setItem('sahaay_user', JSON.stringify(data.user)); }
      if (data.camp) { setCamp(data.camp); localStorage.setItem('sahaay_camp', JSON.stringify(data.camp)); }
    }).catch(() => {}).finally(() => setLoading(false));
    fetch(`/api/missing-reports?reporter_phone=${encodeURIComponent(phone)}`)
      .then(r => r.json()).then(data => { if (data.reports) setReports(data.reports); }).catch(() => {});
  }, [router]);

  const handleLogout = useCallback(() => {
    localStorage.removeItem('sahaay_phone');
    localStorage.removeItem('sahaay_user');
    localStorage.removeItem('sahaay_camp');
    router.push('/');
  }, [router]);

  if (loading && !user) {
    return (
      <div style={s.page}>
        <div style={s.loadingWrap}>
          <div style={s.loadingLogo}>
            <svg width="32" height="32" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L3 8v7c0 5.55 4.7 10.74 11 12 6.3-1.26 11-6.45 11-12V8L14 2z" fill="#2563EB"/>
              <path d="M10 14l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <div style={s.spinner} />
          <p style={s.loadingText}>Loading your dashboard…</p>
        </div>
      </div>
    );
  }

  if (!user) return null;

  const STATUS_MAP = {
    active:       { label: 'Searching',    color: '#D97706', bg: '#FEF3C7' },
    match_found:  { label: 'Match Found',  color: '#2563EB', bg: '#EFF6FF' },
    under_review: { label: 'Under Review', color: '#7C3AED', bg: '#F5F3FF' },
    reunited:     { label: 'Reunited',     color: '#059669', bg: '#D1FAE5' },
    closed:       { label: 'Closed',       color: '#6B7280', bg: '#F3F4F6' },
  };

  const TABS = [
    { key: 'overview', label: 'Overview', icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
    )},
    { key: 'reports', label: 'Reports', icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
    )},
    { key: 'map', label: 'Map', icon: (
      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg>
    )},
  ];

  return (
    <div style={s.page}>

      {/* ── Nav Bar ── */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L3 8v7c0 5.55 4.7 10.74 11 12 6.3-1.26 11-6.45 11-12V8L14 2z" fill="#2563EB"/>
              <path d="M10 14l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={s.navLogoText}>Sahaay</span>
          </div>
        </div>
        <button onClick={handleLogout} style={s.logoutBtn}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
          Logout
        </button>
      </header>

      {/* ── Profile Banner ── */}
      <div style={s.profileBanner}>
        <div style={s.profileBannerBg} />
        <div style={s.profileInner}>
          <div style={s.profileLeft}>
            {user.selfie_url ? (
              <img src={user.selfie_url} alt="" style={s.avatar} />
            ) : (
              <div style={s.avatarPlaceholder}>
                {(user.name || 'U').charAt(0).toUpperCase()}
              </div>
            )}
            <div style={s.profileMeta}>
              <p style={s.profileEyebrow}>Registered Civilian</p>
              <h1 style={s.profileName}>{user.name || 'User'}</h1>
              <p style={s.profilePhone}>{user.phone}</p>
            </div>
          </div>
          <div style={s.profileBadge}>
            <div style={s.profileBadgeDot} />
            Active
          </div>
        </div>
      </div>

      {/* ── Tab Bar ── */}
      <div style={s.tabBar}>
        {TABS.map(tab => (
          <button key={tab.key} onClick={() => setActiveTab(tab.key)} style={{ ...s.tab, ...(activeTab === tab.key ? s.tabActive : {}) }}>
            <span style={{ color: activeTab === tab.key ? '#2563EB' : '#9CA3AF' }}>{tab.icon}</span>
            <span>{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ══════════ OVERVIEW TAB ══════════ */}
      {activeTab === 'overview' && (
        <div style={s.tabContent}>

          {/* Camp Assignment */}
          <SectionBlock title="Relief Center Assignment">
            {camp ? (
              <div style={s.campCard}>
                <div style={s.campCardTop}>
                  <div style={s.campIconWrap}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div style={s.campInfo}>
                    <p style={s.campName}>{camp.name}</p>
                    <div style={s.campStatusRow}>
                      <span style={{ ...s.campDot, background: camp.status === 'active' ? '#22C55E' : camp.status === 'full' ? '#EF4444' : '#9CA3AF' }} />
                      <span style={s.campStatusText}>
                        {camp.status === 'active' ? 'Open & Operational' : camp.status === 'full' ? 'At Capacity' : 'Inactive'}
                      </span>
                    </div>
                  </div>
                </div>
                {camp.lat && camp.lng && (
                  <a href={`https://www.google.com/maps/dir/?api=1&destination=${camp.lat},${camp.lng}`} target="_blank" rel="noopener noreferrer" style={s.directionsBtn}>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>
                    Get Directions
                  </a>
                )}
              </div>
            ) : (
              <div style={s.emptyCard}>
                <div style={s.emptyIcon}>
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                </div>
                <p style={s.emptyCardTitle}>No Camp Assigned</p>
                <p style={s.emptyCardSub}>You&apos;ll be assigned when you check into a relief camp</p>
              </div>
            )}
          </SectionBlock>

          {/* QR Card */}
          {user.qr_code_id && (
            <SectionBlock title="QR Identity Card">
              <div style={s.qrCard}>
                <div style={s.qrLeft}>
                  <div style={s.qrBox}>
                    <QRCodeSVG value={user.qr_code_id} size={100} bgColor="#FFFFFF" fgColor="#0F172A" level="H" includeMargin={true} />
                  </div>
                </div>
                <div style={s.qrRight}>
                  <p style={s.qrEyebrow}>Identity Code</p>
                  <p style={s.qrId}>{user.qr_code_id}</p>
                  <p style={s.qrHint}>Show this at any camp entrance for instant check-in</p>
                  <div style={s.qrBadge}>
                    <div style={s.qrBadgeDot} />
                    Verified
                  </div>
                </div>
              </div>
            </SectionBlock>
          )}

          {/* Info Table */}
          <SectionBlock title="Personal Information">
            <div style={s.infoTable}>
              <InfoRow label="Full Name"         value={user.name} />
              <InfoRow label="Phone"             value={user.phone} />
              <InfoRow label="State"             value={user.state} />
              <InfoRow label="Blood Group"       value={user.blood_group} />
              <InfoRow label="Medical Notes"     value={user.medical_conditions || 'None reported'} />
              <InfoRow label="Disability"        value={user.disability_status || 'None'} last />
              {user.emergency_contact_name && (
                <InfoRow label="Emergency Contact" value={`${user.emergency_contact_name} · ${user.emergency_contact_phone || '—'}`} last />
              )}
            </div>
          </SectionBlock>

          {/* Quick Actions */}
          <SectionBlock title="Quick Actions">
            <div style={s.actionsGrid}>
              <ActionBtn onClick={() => router.push('/report-missing')} icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
              } label="Report Missing" urgent />
              <ActionBtn onClick={() => router.push('/track-report')} icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
              } label="Track Report" />
              <ActionBtn onClick={() => router.push('/flood-prediction')} icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/></svg>
              } label="Disaster Map" />
              <ActionBtn onClick={() => window.location.href = 'tel:112'} icon={
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.2"><path d="M22 16.92v3a2 2 0 01-2.18 2 19.79 19.79 0 01-8.63-3.07A19.5 19.5 0 013.07 8.81a19.79 19.79 0 01-3.07-8.7A2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              } label="Emergency 112" urgent />
            </div>
          </SectionBlock>
        </div>
      )}

      {/* ══════════ REPORTS TAB ══════════ */}
      {activeTab === 'reports' && (
        <div style={s.tabContent}>
          <div style={s.reportsHeader}>
            <div>
              <p style={s.reportsEyebrow}>Filed by you</p>
              <h2 style={s.reportsTitle}>Missing Person Reports</h2>
            </div>
            <button onClick={() => router.push('/report-missing')} style={s.newReportBtn}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              New Report
            </button>
          </div>

          {reports.length === 0 ? (
            <div style={s.emptyState}>
              <div style={s.emptyStateIcon}>
                <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <p style={s.emptyStateTitle}>No Reports Filed</p>
              <p style={s.emptyStateSub}>You haven&apos;t filed any missing person reports yet.</p>
              <button onClick={() => router.push('/report-missing')} style={s.emptyStateBtn}>File a Report</button>
            </div>
          ) : (
            <div style={s.reportsList}>
              {reports.map(report => {
                const st = STATUS_MAP[report.status] || STATUS_MAP.active;
                return (
                  <div key={report.id} style={s.reportCard}>
                    <div style={s.reportCardTop}>
                      <div style={s.reportPersonRow}>
                        {report.photo_url ? (
                          <img src={report.photo_url} alt="" style={s.reportPhoto} />
                        ) : (
                          <div style={s.reportPhotoEmpty}>
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                          </div>
                        )}
                        <div>
                          <p style={s.reportName}>{report.name || 'Unknown'}</p>
                          <p style={s.reportMeta}>
                            {[report.age ? `${report.age} yrs` : null, report.gender].filter(Boolean).join(' · ')}
                          </p>
                        </div>
                      </div>
                      <span style={{ ...s.statusPill, background: st.bg, color: st.color }}>
                        {st.label}
                      </span>
                    </div>

                    {report.matched_camp_name && (
                      <div style={s.matchBanner}>
                        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>
                        Located at <strong>{report.matched_camp_name}</strong>
                        {report.match_confidence && (
                          <span style={s.matchConfidence}>{Math.round(report.match_confidence * 100)}% match</span>
                        )}
                      </div>
                    )}

                    <div style={s.reportFooter}>
                      <span style={s.reportFooterText}>
                        Filed {new Date(report.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                      </span>
                      {report.last_known_location && (
                        <span style={s.reportFooterText}>📍 {report.last_known_location}</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* ══════════ MAP TAB ══════════ */}
      {activeTab === 'map' && (
        <div style={s.tabContent}>
          <SectionBlock title="Relief Camps Near You">
            <div style={s.mapWrap}>
              <CampMap
                camps={camp ? [camp] : []}
                userLocation={user.lat && user.lng ? { lat: user.lat, lng: user.lng } : null}
              />
            </div>
          </SectionBlock>

          {camp && (
            <SectionBlock title="Your Assigned Camp">
              <div style={s.campCard}>
                <div style={s.campCardTop}>
                  <div style={s.campIconWrap}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                  </div>
                  <div style={s.campInfo}>
                    <p style={s.campName}>{camp.name}</p>
                    <p style={{ fontSize: 12, color: '#6B7280', margin: '3px 0 0' }}>Your assigned relief camp</p>
                  </div>
                </div>
              </div>
            </SectionBlock>
          )}
        </div>
      )}

    </div>
  );
}

/* ─── Sub-components ─── */

function SectionBlock({ title, children }) {
  return (
    <div style={sc.sectionBlock}>
      <p style={sc.sectionEyebrow}>{title}</p>
      {children}
    </div>
  );
}

function InfoRow({ label, value, last }) {
  return (
    <div style={{ ...sc.infoRow, ...(last ? { borderBottom: 'none' } : {}) }}>
      <span style={sc.infoLabel}>{label}</span>
      <span style={sc.infoValue}>{value || '—'}</span>
    </div>
  );
}

function ActionBtn({ onClick, icon, label, urgent }) {
  return (
    <button onClick={onClick} style={{ ...sc.actionBtn, ...(urgent ? sc.actionBtnUrgent : {}) }}>
      <div style={sc.actionBtnIcon}>{icon}</div>
      <span style={{ ...sc.actionBtnLabel, color: urgent ? '#DC2626' : '#374151' }}>{label}</span>
    </button>
  );
}

/* ─── Styles ─── */

const s = {
  page: {
    minHeight: '100vh',
    background: '#F1F5F9',
    maxWidth: 520,
    margin: '0 auto',
    fontFamily: FONT,
    color: '#111827',
    paddingBottom: 40,
  },

  /* Loading */
  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', gap: 16 },
  loadingLogo: { width: 56, height: 56, borderRadius: 14, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  spinner: { width: 32, height: 32, border: '3px solid #DBEAFE', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText: { fontSize: 14, color: '#9CA3AF', margin: 0 },

  /* Nav */
  nav: { background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 18px', height: 52, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  navLeft: { display: 'flex', alignItems: 'center' },
  navLogo: { display: 'flex', alignItems: 'center', gap: 8 },
  navLogoText: { fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  logoutBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '6px 12px', borderRadius: 7, cursor: 'pointer' },

  /* Profile Banner */
  profileBanner: { background: 'white', borderBottom: '1px solid #E2E8F0', padding: '20px 18px 20px', position: 'relative', overflow: 'hidden' },
  profileBannerBg: { position: 'absolute', top: 0, left: 0, right: 0, height: 4, background: 'linear-gradient(90deg, #2563EB, #3B82F6, #60A5FA)' },
  profileInner: { display: 'flex', justifyContent: 'space-between', alignItems: 'center' },
  profileLeft: { display: 'flex', gap: 14, alignItems: 'center' },
  avatar: { width: 52, height: 52, borderRadius: 12, objectFit: 'cover', border: '2px solid #E2E8F0' },
  avatarPlaceholder: { width: 52, height: 52, borderRadius: 12, background: 'linear-gradient(135deg, #2563EB, #3B82F6)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white', fontSize: 20, fontWeight: 800, flexShrink: 0 },
  profileMeta: {},
  profileEyebrow: { fontSize: 11, fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 3px' },
  profileName: { fontSize: 19, fontWeight: 800, color: '#0F172A', margin: '0 0 2px', letterSpacing: '-0.4px' },
  profilePhone: { fontSize: 12.5, color: '#6B7280', margin: 0 },
  profileBadge: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '4px 10px', borderRadius: 20 },
  profileBadgeDot: { width: 6, height: 6, borderRadius: '50%', background: '#22C55E' },

  /* Tabs */
  tabBar: { background: 'white', borderBottom: '1px solid #E2E8F0', display: 'flex', padding: '0 8px', position: 'sticky', top: 52, zIndex: 100 },
  tab: { flex: 1, display: 'flex', gap: 5, alignItems: 'center', justifyContent: 'center', padding: '12px 8px', background: 'transparent', border: 'none', borderBottom: '2px solid transparent', fontSize: 13, fontWeight: 600, color: '#9CA3AF', cursor: 'pointer', transition: 'all 0.15s' },
  tabActive: { color: '#2563EB', borderBottomColor: '#2563EB' },

  /* Tab Content */
  tabContent: { padding: '16px 16px 0' },

  /* Reports Header */
  reportsHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 14 },
  reportsEyebrow: { fontSize: 11, fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 3px' },
  reportsTitle: { fontSize: 17, fontWeight: 700, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' },
  newReportBtn: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '7px 13px', borderRadius: 8, cursor: 'pointer' },

  /* Camp Card */
  campCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  campCardTop: { display: 'flex', gap: 12, alignItems: 'center', marginBottom: 12 },
  campIconWrap: { width: 40, height: 40, borderRadius: 9, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  campInfo: {},
  campName: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 },
  campStatusRow: { display: 'flex', gap: 5, alignItems: 'center', marginTop: 4 },
  campDot: { width: 7, height: 7, borderRadius: '50%' },
  campStatusText: { fontSize: 12, color: '#6B7280' },
  directionsBtn: { display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, padding: '10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, color: '#2563EB', fontSize: 13.5, fontWeight: 600, textDecoration: 'none' },

  /* QR Card */
  qrCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px', display: 'flex', gap: 16, alignItems: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  qrLeft: { flexShrink: 0 },
  qrBox: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 8, padding: 4, display: 'inline-flex' },
  qrRight: { flex: 1 },
  qrEyebrow: { fontSize: 11, fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 4px' },
  qrId: { fontSize: 13, fontWeight: 700, color: '#0F172A', fontFamily: 'monospace', margin: '0 0 6px', wordBreak: 'break-all' },
  qrHint: { fontSize: 12, color: '#6B7280', lineHeight: 1.5, margin: '0 0 10px' },
  qrBadge: { display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 11.5, fontWeight: 600, color: '#059669', background: '#ECFDF5', border: '1px solid #A7F3D0', padding: '3px 9px', borderRadius: 20 },
  qrBadgeDot: { width: 6, height: 6, borderRadius: '50%', background: '#22C55E' },

  /* Info Table */
  infoTable: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },

  /* Actions Grid */
  actionsGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 },

  /* Reports list */
  reportsList: { display: 'flex', flexDirection: 'column', gap: 10 },
  reportCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '14px 16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  reportCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 },
  reportPersonRow: { display: 'flex', gap: 10, alignItems: 'center' },
  reportPhoto: { width: 38, height: 38, borderRadius: 8, objectFit: 'cover', border: '1px solid #E2E8F0' },
  reportPhotoEmpty: { width: 38, height: 38, borderRadius: 8, background: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  reportName: { fontSize: 14, fontWeight: 700, color: '#0F172A', margin: 0 },
  reportMeta: { fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' },
  statusPill: { fontSize: 11.5, fontWeight: 700, padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap' },
  matchBanner: { display: 'flex', alignItems: 'center', gap: 6, padding: '8px 10px', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, fontSize: 12.5, color: '#1D4ED8', marginBottom: 10 },
  matchConfidence: { marginLeft: 'auto', fontSize: 11, fontWeight: 700, color: '#059669', background: '#ECFDF5', padding: '2px 7px', borderRadius: 12 },
  reportFooter: { display: 'flex', justifyContent: 'space-between' },
  reportFooterText: { fontSize: 11.5, color: '#9CA3AF' },

  /* Empty states */
  emptyCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '28px 16px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  emptyIcon: { width: 48, height: 48, borderRadius: 12, background: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' },
  emptyCardTitle: { fontSize: 14.5, fontWeight: 700, color: '#374151', margin: '0 0 4px' },
  emptyCardSub: { fontSize: 13, color: '#9CA3AF', margin: 0, lineHeight: 1.5 },
  emptyState: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '36px 20px', textAlign: 'center', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  emptyStateIcon: { width: 56, height: 56, borderRadius: 14, background: '#F1F5F9', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' },
  emptyStateTitle: { fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' },
  emptyStateSub: { fontSize: 13.5, color: '#6B7280', margin: '0 0 18px', lineHeight: 1.5 },
  emptyStateBtn: { padding: '10px 24px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13.5, fontWeight: 700, cursor: 'pointer' },

  /* Map */
  mapWrap: { height: 300, borderRadius: 12, overflow: 'hidden', border: '1px solid #E2E8F0', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
};

const sc = {
  /* Section Block */
  sectionBlock: { marginBottom: 16 },
  sectionEyebrow: { fontSize: 11, fontWeight: 700, color: '#6B7280', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' },

  /* Info Row */
  infoRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '10px 14px', borderBottom: '1px solid #F1F5F9' },
  infoLabel: { fontSize: 12.5, color: '#6B7280', fontWeight: 500 },
  infoValue: { fontSize: 13, color: '#111827', fontWeight: 600, textAlign: 'right', maxWidth: '58%' },

  /* Action Button */
  actionBtn: { padding: '14px 10px', background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 7, cursor: 'pointer', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  actionBtnUrgent: { background: '#FFF5F5', borderColor: '#FECACA' },
  actionBtnIcon: { width: 36, height: 36, borderRadius: 9, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center' },
  actionBtnLabel: { fontSize: 12.5, fontWeight: 600, color: '#374151' },
};