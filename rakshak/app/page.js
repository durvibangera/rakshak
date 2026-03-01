/**
 * FILE: page.js (Homepage)
 * PURPOSE: User-focused landing page with disaster registration.
 *          Admin login is accessible via a subtle link at the bottom.
 */

'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';

export default function HomePage() {
  const [alerts, setAlerts] = useState([]);

  useEffect(() => {
    fetch('/api/alerts').then(r => r.json()).then(d => {
      if (Array.isArray(d)) setAlerts(d.slice(0, 3));
      else if (d.alerts) setAlerts(d.alerts.slice(0, 3));
    }).catch(() => {});
  }, []);

  const linkBtn = { ...p.primaryBtn, textDecoration: 'none', boxSizing: 'border-box' };
  const linkCard = { ...p.actionCard, textDecoration: 'none', boxSizing: 'border-box', color: 'inherit' };
  const linkAdmin = { ...p.adminBtn, textDecoration: 'none', boxSizing: 'border-box', color: 'inherit', display: 'inline-block' };

  return (
    <div style={p.page}>
      {/* Hero */}
      <div style={p.hero}>
        <div style={p.logoBadge}>R</div>
        <h1 style={p.title}>Rakshak</h1>
        <p style={p.subtitle}>India&apos;s Disaster Response &amp; Family Safety Platform</p>
        <p style={p.desc}>
          Pre-register so we can find you, alert you, and reunite your family during any disaster.
        </p>
      </div>

      {/* Main CTA */}
      <div style={p.ctaSection}>
        <Link href="/register" style={linkBtn}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><line x1="19" y1="8" x2="19" y2="14"/><line x1="22" y1="11" x2="16" y2="11"/></svg>
          Register Me & My Family
        </Link>
        <p style={{ fontSize: 12, color: '#64748B', margin: '8px 0 0', textAlign: 'center' }}>
          Takes 2 minutes - get a QR identity card + voice call alerts
        </p>
      </div>

      {/* Quick actions */}
      <div style={p.grid}>
        <Link href="/report-missing" style={{ ...linkCard, border: '1px solid rgba(239,68,68,0.3)', background: 'rgba(239,68,68,0.06)' }}>
          <span style={{ fontSize: 24 }}>🔍</span>
          <span style={p.actionLabel}>Report Missing</span>
          <span style={p.actionSub}>Find a lost family member</span>
        </Link>
        <Link href="/flood-prediction" style={linkCard}>
          <span style={{ fontSize: 24 }}>🗺️</span>
          <span style={p.actionLabel}>Disaster Map</span>
          <span style={p.actionSub}>Live alerts & predictions</span>
        </Link>
        <Link href="/register" style={linkCard}>
          <span style={{ fontSize: 24 }}>📱</span>
          <span style={p.actionLabel}>My QR Card</span>
          <span style={p.actionSub}>View your identity card</span>
        </Link>
        <Link href="/track-report" style={linkCard}>
          <span style={{ fontSize: 24 }}>📋</span>
          <span style={p.actionLabel}>Track Report</span>
          <span style={p.actionSub}>Check report status</span>
        </Link>
      </div>

      {/* Active alerts */}
      {alerts.length > 0 && (
        <div style={p.alertSection}>
          <h3 style={p.sectionTitle}>Active Alerts</h3>
          {alerts.map((a, i) => (
            <div key={i} style={p.alertCard}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: 14, fontWeight: 600, color: '#FCA5A5' }}>
                  {a.type || a.disaster_type || 'Alert'}
                </span>
                <span style={{ fontSize: 11, color: '#64748B' }}>
                  {a.created_at ? new Date(a.created_at).toLocaleDateString() : ''}
                </span>
              </div>
              <p style={{ fontSize: 13, color: '#CBD5E1', margin: '4px 0 0' }}>
                {a.message || a.title || 'Disaster alert in your area'}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Safety info */}
      <div style={p.infoSection}>
        <h3 style={p.sectionTitle}>What Rakshak Does For You</h3>
        <div style={p.infoGrid}>
          <InfoItem icon="🔔" title="Voice Call Alerts" desc="Automated calls in your language when disaster is near" />
          <InfoItem icon="📸" title="Face Recognition" desc="Find missing family members across relief camps" />
          <InfoItem icon="🏕️" title="Camp Check-in" desc="Scan your QR at any camp for instant registration" />
          <InfoItem icon="👨‍👩‍👧‍👦" title="Family Linking" desc="Register dependents so they can be tracked to you" />
        </div>
      </div>

      {/* Login section */}
      <div style={p.adminSection}>
        <div style={p.divider} />
        <Link href="/login" style={{ ...linkBtn, marginBottom: 8, fontSize: 15 }}>
          Login (Registered Users)
        </Link>
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link href="/admin-login" style={linkAdmin}>
            Admin / Staff Login →
          </Link>
          <Link href="/ngo/login" style={linkAdmin}>
            NGO Login →
          </Link>
        </div>
        <p style={{ fontSize: 11, color: '#475569', margin: '4px 0 0', textAlign: 'center' }}>
          Registered Users, Camp Admins, Operators & Staff
        </p>
      </div>
    </div>
  );
}

function InfoItem({ icon, title, desc }) {
  return (
    <div style={p.infoItem}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <div>
        <p style={{ fontSize: 13, fontWeight: 700, color: '#E2E8F0', margin: 0 }}>{title}</p>
        <p style={{ fontSize: 12, color: '#94A3B8', margin: '2px 0 0' }}>{desc}</p>
      </div>
    </div>
  );
}

const p = {
  page: {
    minHeight: '100vh', background: '#0F172A', padding: '40px 20px 60px',
    maxWidth: 480, margin: '0 auto', fontFamily: 'system-ui, sans-serif',
  },
  hero: { textAlign: 'center', marginBottom: 28 },
  logoBadge: {
    width: 56, height: 56, borderRadius: 16, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 800, fontSize: 24, color: 'white',
    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', marginBottom: 12,
  },
  title: { fontSize: 32, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px' },
  subtitle: { fontSize: 14, fontWeight: 600, color: '#94A3B8', margin: '0 0 8px' },
  desc: { fontSize: 13, color: '#64748B', margin: 0, lineHeight: 1.5 },
  ctaSection: { marginBottom: 24 },
  primaryBtn: {
    width: '100%', padding: '16px 24px', display: 'flex', alignItems: 'center',
    justifyContent: 'center', gap: 10, background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white', border: 'none', borderRadius: 14, fontSize: 17, fontWeight: 700,
    cursor: 'pointer', boxShadow: '0 4px 20px rgba(59,130,246,0.35)',
  },
  grid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 24 },
  actionCard: {
    padding: '18px 14px', background: '#1E293B', border: '1px solid #334155',
    borderRadius: 12, textAlign: 'center', cursor: 'pointer', display: 'flex',
    flexDirection: 'column', gap: 6, alignItems: 'center',
  },
  actionLabel: { fontSize: 14, fontWeight: 700, color: '#E2E8F0' },
  actionSub: { fontSize: 11, color: '#64748B' },
  alertSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 14, fontWeight: 700, color: '#94A3B8', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: 0.5 },
  alertCard: {
    padding: 14, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)',
    borderRadius: 10, marginBottom: 8,
  },
  infoSection: { marginBottom: 32 },
  infoGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  infoItem: {
    display: 'flex', gap: 12, alignItems: 'flex-start', padding: 14,
    background: '#1E293B', borderRadius: 10, border: '1px solid #334155',
  },
  adminSection: { textAlign: 'center' },
  divider: { width: 60, height: 1, background: '#334155', margin: '0 auto 16px' },
  adminBtn: {
    background: 'none', border: '1px solid #334155', borderRadius: 10,
    padding: '10px 24px', color: '#64748B', fontSize: 13, fontWeight: 600,
    cursor: 'pointer', transition: 'all 0.2s',
  },
};
