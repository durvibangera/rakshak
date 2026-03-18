//homepage 
'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [alerts, setAlerts] = useState([]);
  const [stats, setStats] = useState({ totalRefugees: 12430, activeCamps: 8, activeAlerts: 3 });
  const [time, setTime] = useState('');

  useEffect(() => {
    fetch('/api/alerts').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAlerts(d.slice(0, 3));
      else if (d.alerts) setAlerts(d.alerts.slice(0, 3));
    }).catch(() => { });

    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const mockAlerts = alerts.length > 0 ? alerts : [
    { type: 'FLOOD', location_name: 'Assam — Dibrugarh District', message: 'Rising water levels reported. Evacuate low-lying zones immediately.', created_at: '2024-01-01T10:00:00.000Z', severity: 'High' },
    { type: 'CYCLONE', location_name: 'Odisha — Puri Coastline', message: 'Category 2 landfall expected in 18 hours. Coastal evacuation underway.', created_at: '2024-01-01T09:00:00.000Z', severity: 'Medium' },
    { type: 'LANDSLIDE', location_name: 'Himachal Pradesh — Manali', message: 'Road blockage reported on NH-3. Relief teams dispatched.', created_at: '2024-01-01T08:00:00.000Z', severity: 'Low' },
  ];

  return (
    <div style={s.root}>
      {/* ── Top Nav ── */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>
            <img src="/logo-light.png" alt="Sahaay" style={{ height: 96, width: 'auto', objectFit: 'contain' }} />
            <span style={s.navBadge}>LIVE</span>
          </div>
          <nav style={s.navLinks}>
            <span style={{ ...s.navLink, ...s.navLinkActive }}>Overview</span>
            <Link href="/flood-prediction" style={s.navLink}>Disaster Map</Link>
            <Link href="/report-missing" style={s.navLink}>Missing Persons</Link>
            <Link href="/track-report" style={s.navLink}>Track Report</Link>
          </nav>
        </div>
        <div style={s.navRight}>
          <div style={s.navClock}>
            <span style={s.navClockDot} />
            {time || '--:--'} IST
          </div>
          <div style={s.navAlertChip}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            {stats.activeAlerts} Alerts
          </div>
          <Link href="/login" style={s.navLoginBtnSecondary}>User Login</Link>
          <Link href="/admin-login" style={s.navLoginBtn}>Admin Login</Link>
        </div>
      </header>

      {/* ── Body: two-column layout ── */}
      <div style={s.body}>

        {/* ═══ MAIN COLUMN ═══ */}
        <main style={s.main}>

          {/* Overview Banner */}
          <section style={s.overviewBanner}>
            <div style={s.overviewText}>
              <p style={s.overviewEyebrow}>India&apos;s National Disaster Response Platform</p>
              <h1 style={s.overviewTitle}>Sahaay — Emergency Operations</h1>
              <p style={s.overviewDesc}>
                Pre-register civilians, issue QR identity cards, coordinate relief camps, and reunite families across disaster zones in real time.
              </p>
              <div style={s.overviewActions}>
                <Link href="/register" style={s.btnPrimary}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><line x1="19" y1="8" x2="19" y2="14" /><line x1="22" y1="11" x2="16" y2="11" /></svg>
                  Register Now
                </Link>
                <Link href="/flood-prediction" style={s.btnSecondary}>View Live Map</Link>
              </div>
            </div>
            <div style={s.overviewMapThumb}>
              <div style={s.mapThumbInner}>
                <svg width="100%" height="100%" viewBox="0 0 260 160" xmlns="http://www.w3.org/2000/svg">
                  <rect width="260" height="160" fill="#EEF2FF" rx="8" />
                  {/* simplified India outline suggestion */}
                  <path d="M80 20 Q120 15 160 25 L175 60 Q180 80 170 110 Q160 135 130 145 Q100 150 80 130 Q55 110 50 80 Q45 50 80 20Z" fill="#C7D2FE" stroke="#93C5FD" strokeWidth="1.5" />
                  <circle cx="130" cy="75" r="5" fill="#1B3676" opacity="0.9" />
                  <circle cx="110" cy="55" r="3.5" fill="#EF4444" opacity="0.85" />
                  <circle cx="155" cy="95" r="3.5" fill="#F59E0B" opacity="0.85" />
                  <circle cx="100" cy="100" r="3" fill="#1B3676" opacity="0.7" />
                  <circle cx="145" cy="50" r="3" fill="#EF4444" opacity="0.7" />
                  <circle cx="130" cy="75" r="12" fill="none" stroke="#1B3676" strokeWidth="1" opacity="0.4" />
                  <circle cx="130" cy="75" r="20" fill="none" stroke="#1B3676" strokeWidth="0.5" opacity="0.2" />
                </svg>
              </div>
              <div style={s.mapThumbLabel}>Live — {stats.activeCamps} camps active</div>
            </div>
          </section>

          {/* Stats Row */}
          <div style={s.statsRow}>
            <StatCard icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B3676" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M23 21v-2a4 4 0 00-3-3.87" /><path d="M16 3.13a4 4 0 010 7.75" /></svg>
            } value={stats.totalRefugees.toLocaleString('en-IN')} label="Registered Civilians" color="#EEF2FF" />
            <StatCard icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></svg>
            } value={stats.activeCamps} label="Active Relief Camps" color="#ECFDF5" accent="#059669" />
            <StatCard icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" /></svg>
            } value={stats.activeAlerts} label="Active Alerts" color="#FEF2F2" accent="#DC2626" urgent />
            <StatCard icon={
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></svg>
            } value="—" label="Missing Reports Open" color="#F5F3FF" accent="#7C3AED" />
          </div>

          {/* Quick Actions */}
          <section style={s.sectionBlock}>
            <div style={s.sectionHead}>
              <h2 style={s.sectionTitle}>Quick Actions</h2>
            </div>
            <div style={s.actionGrid}>
              <ActionCard href="/report-missing" urgent
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="11" cy="11" r="8" fill="#FEE2E2"/>
                    <line x1="21" y1="21" x2="16.65" y2="16.65"/>
                    <line x1="11" y1="8" x2="11" y2="14"/>
                    <line x1="8" y1="11" x2="14" y2="11"/>
                  </svg>
                }
                label="Report Missing Person" desc="File a missing person report with photo and details" />
              <ActionCard href="/flood-prediction"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B3676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7l5-4 8 4 5-3v13l-5 3-8-4-5 4z" fill="#C7D2FE" fillOpacity="0.5"/>
                    <path d="M3 7l5-4 8 4 5-3v13l-5 3-8-4-5 4z"/>
                    <line x1="8" y1="3" x2="8" y2="17"/>
                    <line x1="16" y1="7" x2="16" y2="21"/>
                  </svg>
                }
                label="Disaster Map" desc="Live alerts, camp locations & flood zones" />
              <ActionCard href="/track-report"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" fill="#EDE9FE" fillOpacity="0.7"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <line x1="10" y1="9" x2="8" y2="9"/>
                  </svg>
                }
                label="Track Report" desc="Check status of your filed report" />
              <ActionCard href="/register"
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" fill="#D1FAE5" fillOpacity="0.7"/>
                    <path d="M3 9h18M9 21V9"/>
                    <rect x="6" y="12" width="2" height="2" fill="#059669" rx="0.5"/>
                    <rect x="11" y="12" width="2" height="2" fill="#059669" rx="0.5"/>
                    <rect x="6" y="16" width="2" height="2" fill="#059669" rx="0.5"/>
                    <rect x="11" y="16" width="2" height="2" fill="#059669" rx="0.5"/>
                  </svg>
                }
                label="My QR Identity Card" desc="Register & download your emergency QR card" />
            </div>
          </section>

          {/* Active Alerts Feed */}
          <section style={s.sectionBlock}>
            <div style={s.sectionHead}>
              <h2 style={s.sectionTitle}>Active Alert Feed</h2>
              <span style={s.sectionMeta}>Updated {time || 'just now'}</span>
            </div>
            <div style={s.alertList}>
              {mockAlerts.map((alert, i) => (
                <AlertCard key={i} alert={alert} />
              ))}
            </div>
          </section>

          {/* Features */}
          <section style={s.sectionBlock}>
            <div style={s.sectionHead}>
              <h2 style={s.sectionTitle}>Platform Capabilities</h2>
            </div>
            <div style={s.featureGrid}>
              <FeatureCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.8 19.8 0 01.06 2.18 2 2 0 012.06 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z" fill="#FEF3C7" fillOpacity="0.8"/>
                    <path d="M22 16.92v3a2 2 0 01-2.18 2 19.8 19.8 0 01-8.63-3.07A19.5 19.5 0 013.07 10.8 19.8 19.8 0 01.06 2.18 2 2 0 012.06 0h3a2 2 0 012 1.72 12.84 12.84 0 00.7 2.81 2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45 12.84 12.84 0 002.81.7A2 2 0 0122 16.92z"/>
                  </svg>
                }
                title="Voice Call Alerts" desc="Automated multilingual calls in 12+ Indian languages when disaster strikes near you." />
              <FeatureCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#1B3676" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="7" r="4" fill="#C7D2FE" fillOpacity="0.6"/>
                    <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
                    <path d="M16 3.13a4 4 0 010 7.75" strokeDasharray="2 1"/>
                    <path d="M21 21v-2a4 4 0 00-3-3.87"/>
                    <circle cx="9" cy="7" r="4"/>
                  </svg>
                }
                title="AI Face Recognition" desc="Match displaced persons across camps using face-scan technology for faster reunification." />
              <FeatureCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" fill="#D1FAE5" fillOpacity="0.6"/>
                    <path d="M3 9h18M9 21V9"/>
                    <rect x="6" y="12" width="2" height="2" rx="0.5" fill="#059669"/>
                    <rect x="11" y="12" width="2" height="2" rx="0.5" fill="#059669"/>
                    <rect x="6" y="16" width="2" height="2" rx="0.5" fill="#059669"/>
                    <rect x="11" y="16" width="2" height="2" rx="0.5" fill="#059669"/>
                  </svg>
                }
                title="QR Camp Check-in" desc="Instant camp registration — scan your QR identity card at any relief camp entry point." />
              <FeatureCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                    <circle cx="9" cy="7" r="4" fill="#EDE9FE" fillOpacity="0.7"/>
                    <circle cx="9" cy="7" r="4"/>
                    <path d="M3 21v-2a4 4 0 014-4h4a4 4 0 014 4v2"/>
                    <path d="M16 3.13a4 4 0 010 7.75" strokeDasharray="2 1"/>
                    <path d="M21 21v-2a4 4 0 00-3-3.87"/>
                  </svg>
                }
                title="Family Group Linking" desc="Register dependents once — automatic tracking and notifications for entire family units." />
            </div>
          </section>
        </main>

        {/* ═══ SIDEBAR ═══ */}
        <aside style={s.sidebar}>

          {/* Register CTA */}
          <div style={s.sideRegisterCard}>
            <p style={s.sideRegisterEye}>Get Protected Today</p>
            <p style={s.sideRegisterTitle}>Pre-register before the next disaster</p>
            <p style={s.sideRegisterDesc}>Takes 2 minutes. Gives you emergency QR card, family linking & priority alerts.</p>
            <Link href="/register" style={s.sideRegisterBtn}>Register Free →</Link>
          </div>

          {/* Alert Summary */}
          <div style={s.sideCard}>
            <div style={s.sideCardHead}>
              <span style={s.sideCardTitle}>Alert Summary</span>
              <span style={s.sideCardBadge}>Live</span>
            </div>
            <div style={s.sideStat}><span style={s.sideStatLabel}>High Severity</span><span style={{ ...s.sideStatVal, color: '#DC2626' }}>2</span></div>
            <div style={s.sideDivider} />
            <div style={s.sideStat}><span style={s.sideStatLabel}>Medium Severity</span><span style={{ ...s.sideStatVal, color: '#D97706' }}>1</span></div>
            <div style={s.sideDivider} />
            <div style={s.sideStat}><span style={s.sideStatLabel}>States Affected</span><span style={{ ...s.sideStatVal, color: '#1B3676' }}>4</span></div>
            <div style={s.sideDivider} />
            <div style={s.sideStat}><span style={s.sideStatLabel}>Relief Ops Active</span><span style={{ ...s.sideStatVal, color: '#059669' }}>6</span></div>
          </div>

          {/* Camp Occupancy */}
          <div style={s.sideCard}>
            <div style={s.sideCardHead}>
              <span style={s.sideCardTitle}>Camp Occupancy</span>
              <span style={s.sideCardMeta}>Today</span>
            </div>
            {[
              { name: 'Guwahati Camp A', pct: 82, status: 'Critical' },
              { name: 'Bhubaneswar Sector 1', pct: 61, status: 'Moderate' },
              { name: 'Manali Relief Base', pct: 34, status: 'Open' },
            ].map((camp, i) => (
              <div key={i} style={s.campRow}>
                <div style={s.campMeta}>
                  <span style={s.campName}>{camp.name}</span>
                  <span style={{ ...s.campStatus, color: camp.pct > 75 ? '#DC2626' : camp.pct > 50 ? '#D97706' : '#059669' }}>{camp.status}</span>
                </div>
                <div style={s.campBarBg}>
                  <div style={{ ...s.campBarFill, width: `${camp.pct}%`, background: camp.pct > 75 ? '#EF4444' : camp.pct > 50 ? '#F59E0B' : '#10B981' }} />
                </div>
                <span style={s.campPct}>{camp.pct}%</span>
              </div>
            ))}
          </div>

          {/* Quick Links */}
          <div style={s.sideCard}>
            <div style={s.sideCardHead}>
              <span style={s.sideCardTitle}>Quick Links</span>
            </div>
            {[
              { href: '/ngo/login', label: 'NGO Portal Login' },
              { href: '/camp/register', label: 'Register a Camp' },
              { href: '/admin-login', label: 'Admin Dashboard' },
              { href: '/track-report', label: 'Report Archive' },
            ].map((l, i) => (
              <Link key={i} href={l.href} style={s.sideLink}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#6B7280" strokeWidth="2"><polyline points="9 18 15 12 9 6" /></svg>
                {l.label}
              </Link>
            ))}
          </div>

          {/* Help Line */}
          <div style={s.helpCard}>
            <div style={s.helpIcon}>📞</div>
            <div>
              <div style={s.helpTitle}>National Helpline</div>
              <div style={s.helpNumber}>1078</div>
              <div style={s.helpSub}>Available 24 × 7 in all states</div>
            </div>
          </div>
        </aside>
      </div>

      {/* ── Footer ── */}
      <footer style={s.footer}>
        <div style={s.footerInner}>
          <div style={s.footerBrand}>
            <img src="/logo-light.png" alt="Sahaay" style={{ height: 44, width: 'auto', objectFit: 'contain' }} />
            <span style={s.footerBrandName}>Emergency Response</span>
          </div>
          <div style={s.footerLinks}>
            <Link href="/admin-login" style={s.footerLink}>Admin Login</Link>
            <span style={s.dot}>·</span>
            <Link href="/ngo/login" style={s.footerLink}>NGO Portal</Link>
            <span style={s.dot}>·</span>
            <Link href="/camp/register" style={s.footerLink}>Register Camp</Link>
          </div>
          <div style={s.footerCopy}>© 2024 Government of India — Disaster Management Division</div>
        </div>
      </footer>
    </div>
  );
}

/* ─── Sub-components ─── */

function StatCard({ icon, value, label, color, accent = '#1B3676', urgent }) {
  return (
    <div style={{ ...sc.statCard, background: color, borderColor: urgent ? '#FECACA' : '#E5E7EB' }}>
      <div style={{ ...sc.statIconWrap, background: urgent ? '#FEE2E2' : color }}>{icon}</div>
      <div>
        <div style={{ ...sc.statValue, color: urgent ? '#DC2626' : '#111827' }}>{value}</div>
        <div style={sc.statLabel}>{label}</div>
      </div>
    </div>
  );
}

function ActionCard({ href, icon, label, desc, urgent }) {
  const accent = urgent ? '#DC2626' : '#1B3676';
  const bg = urgent ? '#FEF2F2' : '#EEF2FF';
  return (
    <Link href={href} style={{
      background: 'white',
      border: `1px solid ${urgent ? '#FECACA' : '#E2E8F0'}`,
      borderTop: `3px solid ${accent}`,
      borderRadius: 12,
      padding: '18px 16px',
      textDecoration: 'none',
      display: 'flex',
      flexDirection: 'column',
      gap: 12,
      position: 'relative',
      boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
    }}>
      <div style={{
        width: 44, height: 44, borderRadius: 10,
        background: bg,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 4 }}>{label}</div>
        <div style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.45 }}>{desc}</div>
      </div>
      <div style={{ position: 'absolute', top: 16, right: 16, color: accent, display: 'flex' }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
      </div>
    </Link>
  );
}

function AlertCard({ alert }) {
  const sev = alert.severity || 'Medium';
  const sevColor = sev === 'High' ? { bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444' }
    : sev === 'Medium' ? { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' }
      : { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' };

  return (
    <div style={sc.alertCard}>
      <div style={sc.alertLeft}>
        <div style={{ ...sc.alertDot, background: sevColor.dot }} />
      </div>
      <div style={sc.alertBody}>
        <div style={sc.alertTop}>
          <span style={{ ...sc.alertBadge, background: sevColor.bg, color: sevColor.text }}>
            {alert.type || alert.disaster_type || 'ALERT'}
          </span>
          <span style={sc.alertSev}>{sev} severity</span>
          <span style={sc.alertTime}>
            {alert.created_at ? new Date(alert.created_at).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : 'Now'}
          </span>
        </div>
        <div style={sc.alertTitle}>{alert.location_name || alert.title || 'Disaster Alert'}</div>
        <div style={sc.alertDesc}>{alert.message || 'Emergency situation. Please follow safety protocols.'}</div>
      </div>
      <Link href="/flood-prediction" style={sc.alertDetailsBtn}>Details</Link>
    </div>
  );
}

function FeatureCard({ icon, title, desc }) {
  return (
    <div style={{
      background: 'white',
      border: '1px solid #E2E8F0',
      borderRadius: 12,
      padding: '20px 20px',
      display: 'flex',
      gap: 14,
      alignItems: 'flex-start',
      boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: '#F8FAFC',
        border: '1px solid #E2E8F0',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>{icon}</div>
      <div>
        <div style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', marginBottom: 5 }}>{title}</div>
        <div style={{ fontSize: 13, color: '#6B7280', lineHeight: 1.6 }}>{desc}</div>
      </div>
    </div>
  );
}

/* ─── Styles ─── */

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const s = {
  root: { minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT, color: '#111827' },

  /* Nav */
  nav: { background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', height: 88, position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 2px 8px rgba(0,0,0,0.07)' },
  navLeft: { display: 'flex', alignItems: 'center', gap: 44 },
  navLogo: { display: 'flex', alignItems: 'center', gap: 10 },
  navLogoText: { fontSize: 19, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  navBadge: { fontSize: 10.5, fontWeight: 700, background: '#DCFCE7', color: '#16A34A', padding: '3px 9px', borderRadius: 20, letterSpacing: '0.5px' },
  navLinks: { display: 'flex', gap: 6 },
  navLink: { fontSize: 15, color: '#6B7280', padding: '8px 14px', borderRadius: 7, textDecoration: 'none', fontWeight: 500, transition: 'all 0.15s' },
  navLinkActive: { color: '#1B3676', background: '#EEF2FF', fontWeight: 600 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navClock: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', fontVariantNumeric: 'tabular-nums' },
  navLoginBtn: { fontSize: 13.5, fontWeight: 600, color: 'white', background: '#1B3676', padding: '7px 16px', borderRadius: 7, textDecoration: 'none' },
  navLoginBtnSecondary: { fontSize: 13.5, fontWeight: 600, color: '#374151', background: 'white', border: '1px solid #D1D5DB', padding: '7px 16px', borderRadius: 7, textDecoration: 'none' },
  navAlertChip: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '5px 11px', borderRadius: 20 },
  navLoginBtn: { fontSize: 13.5, fontWeight: 600, color: 'white', background: '#1B3676', padding: '7px 16px', borderRadius: 7, textDecoration: 'none' },

  /* Layout */
  body: { display: 'grid', gridTemplateColumns: '1fr 320px', gap: 24, maxWidth: 1280, margin: '0 auto', padding: '28px 28px 0' },
  main: { display: 'flex', flexDirection: 'column', gap: 24, minWidth: 0 },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 16 },

  /* Overview Banner */
  overviewBanner: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '28px 28px', display: 'flex', gap: 28, alignItems: 'flex-start', boxShadow: '0 1px 4px rgba(0,0,0,0.05)' },
  overviewText: { flex: 1 },
  overviewEyebrow: { fontSize: 12, fontWeight: 600, color: '#1B3676', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 8px' },
  overviewTitle: { fontSize: 26, fontWeight: 700, color: '#0F172A', margin: '0 0 10px', letterSpacing: '-0.5px', lineHeight: 1.25 },
  overviewDesc: { fontSize: 14.5, color: '#475569', lineHeight: 1.65, margin: '0 0 22px', maxWidth: 480 },
  overviewActions: { display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' },
  btnPrimary: { display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 22px', background: '#1B3676', color: 'white', borderRadius: 8, fontSize: 14, fontWeight: 600, textDecoration: 'none', boxShadow: '0 2px 8px rgba(37,99,235,0.3)' },
  btnSecondary: { display: 'inline-flex', alignItems: 'center', padding: '10px 22px', background: 'white', color: '#374151', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, fontWeight: 500, textDecoration: 'none' },
  overviewMapThumb: { width: 260, flexShrink: 0 },
  mapThumbInner: { borderRadius: 8, overflow: 'hidden', border: '1px solid #DBE4FE', height: 160 },
  mapThumbLabel: { fontSize: 12, color: '#6B7280', marginTop: 6, textAlign: 'center' },

  /* Stats */
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },

  /* Sections */
  sectionBlock: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '22px 24px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  sectionHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  sectionTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 },
  sectionMeta: { fontSize: 12, color: '#9CA3AF' },

  /* Actions */
  actionGrid: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 },

  /* Alerts */
  alertList: { display: 'flex', flexDirection: 'column', gap: 10 },

  /* Features */
  featureGrid: { display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 12 },

  /* Sidebar cards */
  sideRegisterCard: { background: 'linear-gradient(135deg, #152C62 0%, #1B3676 100%)', borderRadius: 12, padding: '22px 20px', color: 'white' },
  sideRegisterEye: { fontSize: 11, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.75, margin: '0 0 6px' },
  sideRegisterTitle: { fontSize: 15.5, fontWeight: 700, margin: '0 0 8px', lineHeight: 1.3 },
  sideRegisterDesc: { fontSize: 13, opacity: 0.85, lineHeight: 1.5, margin: '0 0 16px' },
  sideRegisterBtn: { display: 'inline-block', background: 'white', color: '#152C62', fontSize: 13.5, fontWeight: 700, padding: '9px 18px', borderRadius: 7, textDecoration: 'none' },

  sideCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '18px 18px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  sideCardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  sideCardTitle: { fontSize: 13.5, fontWeight: 700, color: '#0F172A' },
  sideCardBadge: { fontSize: 10.5, fontWeight: 600, background: '#DCFCE7', color: '#15803D', padding: '2px 8px', borderRadius: 20 },
  sideCardMeta: { fontSize: 12, color: '#9CA3AF' },
  sideStat: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0' },
  sideStatLabel: { fontSize: 13, color: '#6B7280' },
  sideStatVal: { fontSize: 16, fontWeight: 700 },
  sideDivider: { height: 1, background: '#F1F5F9', margin: '2px 0' },

  campRow: { marginBottom: 12 },
  campMeta: { display: 'flex', justifyContent: 'space-between', marginBottom: 5 },
  campName: { fontSize: 12.5, fontWeight: 500, color: '#374151' },
  campStatus: { fontSize: 11.5, fontWeight: 600 },
  campBarBg: { height: 5, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 3 },
  campBarFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease' },
  campPct: { fontSize: 11, color: '#9CA3AF' },

  sideLink: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: '#374151', textDecoration: 'none', padding: '8px 0', borderBottom: '1px solid #F8FAFC', fontWeight: 500 },

  helpCard: { background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 12, padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14 },
  helpIcon: { fontSize: 26, flexShrink: 0 },
  helpTitle: { fontSize: 12, color: '#6B7280', fontWeight: 500 },
  helpNumber: { fontSize: 22, fontWeight: 800, color: '#15803D', letterSpacing: '-0.5px' },
  helpSub: { fontSize: 11.5, color: '#6B7280', marginTop: 2 },

  /* Footer */
  footer: { background: 'white', borderTop: '1px solid #E2E8F0', marginTop: 40, padding: '24px 28px' },
  footerInner: { maxWidth: 1280, margin: '0 auto', display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12 },
  footerBrand: { display: 'flex', alignItems: 'center', gap: 8 },
  footerBrandName: { fontSize: 14, fontWeight: 600, color: '#374151' },
  footerLinks: { display: 'flex', alignItems: 'center', gap: 10 },
  footerLink: { fontSize: 13.5, color: '#6B7280', textDecoration: 'none' },
  dot: { color: '#D1D5DB', fontSize: 16 },
  footerCopy: { fontSize: 12.5, color: '#9CA3AF' },
};

const sc = {
  /* Stat card */
  statCard: { background: '#EEF2FF', border: '1px solid #E5E7EB', borderRadius: 10, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 },
  statIconWrap: { width: 38, height: 38, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, background: 'white', border: '1px solid #E2E8F0' },
  statValue: { fontSize: 20, fontWeight: 800, letterSpacing: '-0.5px', color: '#111827' },
  statLabel: { fontSize: 11.5, color: '#6B7280', marginTop: 1, fontWeight: 500 },

  /* Action card */
  actionCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 10, padding: '18px 16px', textDecoration: 'none', display: 'block', transition: 'box-shadow 0.15s', cursor: 'pointer', position: 'relative' },
  actionCardUrgent: { background: '#FFF5F5', borderColor: '#FECACA' },
  actionIcon: { fontSize: 26, marginBottom: 10 },
  actionLabel: { fontSize: 13.5, fontWeight: 700, color: '#111827', marginBottom: 4 },
  actionDesc: { fontSize: 12.5, color: '#6B7280', lineHeight: 1.45 },
  actionArrow: { position: 'absolute', top: 16, right: 16, fontSize: 16, fontWeight: 700 },

  /* Alert card */
  alertCard: { border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', display: 'flex', gap: 14, alignItems: 'flex-start', background: 'white' },
  alertLeft: { paddingTop: 4 },
  alertDot: { width: 8, height: 8, borderRadius: '50%', flexShrink: 0 },
  alertBody: { flex: 1, minWidth: 0 },
  alertTop: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' },
  alertBadge: { fontSize: 11, fontWeight: 700, padding: '2px 9px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.4px' },
  alertSev: { fontSize: 12, color: '#9CA3AF' },
  alertTime: { fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' },
  alertTitle: { fontSize: 14.5, fontWeight: 700, color: '#0F172A', marginBottom: 4 },
  alertDesc: { fontSize: 13, color: '#6B7280', lineHeight: 1.5 },
  alertDetailsBtn: { flexShrink: 0, fontSize: 13, fontWeight: 600, color: '#1B3676', background: '#EEF2FF', border: '1px solid #C7D2FE', padding: '7px 14px', borderRadius: 7, textDecoration: 'none', alignSelf: 'center' },

  /* Feature card */
  featureCard: { border: '1px solid #E2E8F0', borderRadius: 10, padding: '18px', background: '#FAFBFC' },
  featureIcon: { fontSize: 26, marginBottom: 10 },
  featureTitle: { fontSize: 14, fontWeight: 700, color: '#111827', marginBottom: 5 },
  featureDesc: { fontSize: 13, color: '#6B7280', lineHeight: 1.55 },
};

