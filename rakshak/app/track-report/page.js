/**
 * FILE: app/track-report/page.js
 * PURPOSE: Allow users to look up and track the status of their
 *          missing person reports using their phone number.
 */
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

const STATUS_CONFIG = {
  active: {
    label: 'Actively Searching',
    color: '#D97706', bg: '#FEF3C7', border: '#FDE68A',
    desc: 'Our system is actively searching across all relief camps and databases.',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>,
  },
  match_found: {
    label: 'Match Found',
    color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE',
    desc: 'A potential match has been identified. Verification is in progress.',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><circle cx="12" cy="16" r="0.5" fill="currentColor"/></svg>,
  },
  under_review: {
    label: 'Under Review',
    color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE',
    desc: 'Your report is being reviewed by our response team.',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>,
  },
  reunited: {
    label: 'Reunited',
    color: '#059669', bg: '#D1FAE5', border: '#A7F3D0',
    desc: 'The missing person has been found and reunited with family.',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>,
  },
  closed: {
    label: 'Closed',
    color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB',
    desc: 'This report has been closed.',
    icon: <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M22 19a2 2 0 01-2 2H4a2 2 0 01-2-2V5a2 2 0 012-2h5l2 3h9a2 2 0 012 2z"/></svg>,
  },
};

const TIMELINE_STEPS = ['active', 'match_found', 'under_review', 'reunited'];

function getTimelineIndex(status) {
  const idx = TIMELINE_STEPS.indexOf(status);
  return idx >= 0 ? idx : 0;
}

export default function TrackReportPage() {
  const router = useRouter();
  const [phone, setPhone] = useState('');
  const [reports, setReports] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expandedId, setExpandedId] = useState(null);

  const handleSearch = useCallback(async () => {
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('Please enter a valid 10-digit phone number');
      return;
    }
    setLoading(true); setError(''); setReports(null);
    try {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const fullPhone = `+91${cleanPhone}`;
      const res = await fetch(`/api/missing-reports?reporter_phone=${encodeURIComponent(fullPhone)}`);
      const data = await res.json();
      if (data.reports?.length > 0) { setReports(data.reports); }
      else {
        const res2 = await fetch(`/api/missing-reports?phone_of_missing=${encodeURIComponent(fullPhone)}`);
        const data2 = await res2.json();
        setReports(data2.reports?.length > 0 ? data2.reports : []);
      }
    } catch { setError('Failed to fetch reports. Please check your connection.'); }
    finally { setLoading(false); }
  }, [phone]);

  return (
    <div style={s.page}>
      <div style={s.bgPattern} />

      {/* Top bar */}
      <div style={s.topBar}>
        <div style={s.topBarBrand}>
          <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
            <path d="M14 2L3 8v7c0 5.55 4.7 10.74 11 12 6.3-1.26 11-6.45 11-12V8L14 2z" fill="#2563EB"/>
            <path d="M10 14l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          <span style={s.topBarName}>Sahaay</span>
        </div>
        <Link href="/" style={s.topBarBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/>
          </svg>
          Home
        </Link>
      </div>

      {/* Page header */}
      <div style={s.pageHeader}>
        <div style={s.pageHeaderIcon}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
            <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/>
            <polyline points="14 2 14 8 20 8"/>
            <line x1="16" y1="13" x2="8" y2="13"/>
            <line x1="16" y1="17" x2="8" y2="17"/>
          </svg>
        </div>
        <div>
          <p style={s.pageEyebrow}>Missing Person Search</p>
          <h1 style={s.pageTitle}>Track Your Report</h1>
          <p style={s.pageSubtitle}>Check the status of your missing person report using your phone number</p>
        </div>
      </div>

      {/* Search card */}
      <div style={s.card}>
        <div style={s.cardStripe} />
        <div style={s.cardBody}>
          <div style={s.labelRow}>
            <label style={s.label}>Phone Number</label>
            <span style={s.labelHint}>Number used when filing the report</span>
          </div>
          <div style={s.phoneRow}>
            <div style={s.phonePrefix}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.07 8.81 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
              <span style={s.phonePrefixText}>+91</span>
            </div>
            <input
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
              placeholder="Enter 10-digit number"
              style={s.phoneInput}
              onKeyDown={e => e.key === 'Enter' && handleSearch()}
              maxLength={10}
            />
            {phone.replace(/\D/g, '').length === 10 && (
              <div style={s.phoneCheck}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
            )}
          </div>

          {error && (
            <div style={s.errorBox}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              {error}
            </div>
          )}

          <button onClick={handleSearch} disabled={loading} style={{ ...s.searchBtn, opacity: loading ? 0.7 : 1 }}>
            {loading ? (
              <><span style={s.spinner} /> Searching…</>
            ) : (
              <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg> Search Reports</>
            )}
          </button>
        </div>
      </div>

      {/* Results */}
      {reports !== null && (
        <div style={s.resultsSection}>
          {reports.length === 0 ? (
            <div style={s.emptyCard}>
              <div style={s.emptyIcon}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>
              </div>
              <h3 style={s.emptyTitle}>No Reports Found</h3>
              <p style={s.emptyText}>No missing person reports found for this phone number.</p>
              <button onClick={() => router.push('/report-missing')} style={s.fileMissingBtn}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                File a New Report
              </button>
            </div>
          ) : (
            <>
              <p style={s.resultCount}>{reports.length} report{reports.length > 1 ? 's' : ''} found</p>
              {reports.map(report => (
                <ReportCard
                  key={report.id}
                  report={report}
                  expanded={expandedId === report.id}
                  onToggle={() => setExpandedId(expandedId === report.id ? null : report.id)}
                />
              ))}
            </>
          )}
        </div>
      )}

      {/* Help card */}
      <div style={s.helpCard}>
        <p style={s.helpTitle}>Emergency Contacts</p>
        <div style={s.helpRow}>
          <div style={s.helpIconWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.07 8.81 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          </div>
          <div>
            <p style={s.helpLabel}>National Emergency</p>
            <p style={s.helpValue}>112</p>
          </div>
          <div style={s.helpDivider} />
          <div style={s.helpIconWrap}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M22 16.92v3a2 2 0 01-2.18 2A19.79 19.79 0 013.07 8.81 2 2 0 012 0h3a2 2 0 012 1.72c.127.96.361 1.903.7 2.81a2 2 0 01-.45 2.11L6.09 7.91a16 16 0 006 6l1.27-1.27a2 2 0 012.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0122 16.92z"/></svg>
          </div>
          <div>
            <p style={s.helpLabel}>NDRF Helpline</p>
            <p style={s.helpValue}>011-24363260</p>
          </div>
        </div>
      </div>

    </div>
  );
}

function ReportCard({ report, expanded, onToggle }) {
  const status = STATUS_CONFIG[report.status] || STATUS_CONFIG.active;
  const timelineIdx = getTimelineIndex(report.status);
  const createdDate = new Date(report.created_at);
  const updatedDate = report.updated_at ? new Date(report.updated_at) : null;
  const daysSince = Math.floor((Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24));

  return (
    <div style={rc.card}>
      {/* Header */}
      <button type="button" onClick={onToggle} style={rc.header}>
        <div style={rc.headerLeft}>
          {report.photo_url ? (
            <img src={report.photo_url} alt="" style={rc.photo} />
          ) : (
            <div style={rc.photoEmpty}>
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            </div>
          )}
          <div>
            <p style={rc.name}>{report.name || 'Unknown Person'}</p>
            <p style={rc.meta}>{[report.age ? `${report.age} yrs` : null, report.gender].filter(Boolean).join(' · ')}</p>
          </div>
        </div>
        <div style={rc.headerRight}>
          <span style={{ ...rc.statusBadge, background: status.bg, border: `1px solid ${status.border}`, color: status.color }}>
            {status.icon}
            {status.label}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" style={{ transform: expanded ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div style={rc.body}>

          {/* Status description */}
          <div style={{ ...rc.statusInfo, background: status.bg, borderColor: status.border }}>
            <p style={{ fontSize: 13, color: status.color, margin: 0, lineHeight: 1.55, fontWeight: 500 }}>{status.desc}</p>
          </div>

          {/* Timeline */}
          <div style={rc.timelineWrap}>
            <p style={rc.sectionLabel}>Progress</p>
            <div style={rc.timeline}>
              {TIMELINE_STEPS.map((step, i) => {
                const st = STATUS_CONFIG[step];
                const isActive = i <= timelineIdx;
                const isCurrent = i === timelineIdx;
                return (
                  <div key={step} style={rc.timelineStep}>
                    <div style={{ ...rc.timelineDot, background: isActive ? st.color : '#E2E8F0', boxShadow: isCurrent ? `0 0 0 3px ${st.border}` : 'none' }}>
                      {isActive && <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3.5"><polyline points="20 6 9 17 4 12"/></svg>}
                    </div>
                    <p style={{ ...rc.timelineLabel, color: isActive ? '#374151' : '#9CA3AF', fontWeight: isCurrent ? 700 : 400 }}>
                      {st.label}
                    </p>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div style={{ ...rc.timelineLine, background: isActive ? st.color : '#E2E8F0' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details */}
          <div style={rc.detailsTable}>
            <DetailRow label="Report ID" value={report.id?.slice(0, 8).toUpperCase()} />
            <DetailRow label="Filed On" value={createdDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
            <DetailRow label="Days Since" value={`${daysSince} day${daysSince !== 1 ? 's' : ''}`} />
            {report.relationship && <DetailRow label="Relationship" value={report.relationship} />}
            {report.last_known_location && <DetailRow label="Last Known Location" value={report.last_known_location} />}
            {report.phone_of_missing && <DetailRow label="Missing Person's Phone" value={report.phone_of_missing} />}
            {report.identifying_details && <DetailRow label="Identifying Details" value={report.identifying_details} />}
            {updatedDate && <DetailRow label="Last Updated" value={updatedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })} last />}
          </div>

          {/* Match info */}
          {['match_found', 'under_review', 'reunited'].includes(report.status) && (
            report.matched_camp_name || report.match_confidence || report.reviewer_notes || report.notified_at
          ) && (
            <div style={rc.matchSection}>
              <p style={rc.sectionLabel}>Match Information</p>
              <div style={rc.matchCard}>
                {report.matched_camp_name && (
                  <MatchRow icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/></svg>} label="Located at Camp" value={report.matched_camp_name} />
                )}
                {report.match_confidence && (
                  <MatchRow icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>} label="Match Confidence" value={`${Math.round(report.match_confidence * 100)}%`} />
                )}
                {report.reviewer_notes && (
                  <MatchRow icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} label="Reviewer Notes" value={report.reviewer_notes} />
                )}
                {report.notified_at && (
                  <MatchRow icon={<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/></svg>} label="Notified Via" value={`${report.notification_method || 'In-app'} · ${new Date(report.notified_at).toLocaleDateString('en-IN')}`} />
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value, last }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: last ? 'none' : '1px solid #F1F5F9' }}>
      <span style={{ fontSize: 12.5, color: '#6B7280', fontWeight: 500 }}>{label}</span>
      <span style={{ fontSize: 13, color: '#111827', fontWeight: 600, textAlign: 'right', maxWidth: '58%' }}>{value}</span>
    </div>
  );
}

function MatchRow({ icon, label, value }) {
  return (
    <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
      <div style={{ width: 30, height: 30, borderRadius: 7, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 11.5, color: '#6B7280', margin: '0 0 2px', fontWeight: 500 }}>{label}</p>
        <p style={{ fontSize: 13.5, color: '#0F172A', margin: 0, fontWeight: 600 }}>{value}</p>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#F1F5F9', padding: '0 0 60px', maxWidth: 520, margin: '0 auto', fontFamily: FONT, color: '#111827', position: 'relative' },
  bgPattern: { position: 'fixed', inset: 0, backgroundImage: 'radial-gradient(#CBD5E1 1px, transparent 1px)', backgroundSize: '28px 28px', opacity: 0.4, pointerEvents: 'none', zIndex: 0 },

  topBar: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', position: 'relative', zIndex: 1 },
  topBarBrand: { display: 'flex', alignItems: 'center', gap: 7 },
  topBarName: { fontSize: 15, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  topBarBack: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#6B7280', textDecoration: 'none' },

  pageHeader: { display: 'flex', gap: 14, alignItems: 'flex-start', padding: '0 20px 20px', position: 'relative', zIndex: 1 },
  pageHeaderIcon: { width: 52, height: 52, borderRadius: 13, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  pageEyebrow: { fontSize: 11, fontWeight: 600, color: '#2563EB', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 3px' },
  pageTitle: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.4px' },
  pageSubtitle: { fontSize: 13, color: '#6B7280', margin: 0, lineHeight: 1.5 },

  card: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, overflow: 'hidden', margin: '0 16px 18px', boxShadow: '0 2px 12px rgba(0,0,0,0.06)', position: 'relative', zIndex: 1 },
  cardStripe: { height: 4, background: 'linear-gradient(90deg, #1D4ED8, #2563EB, #60A5FA)' },
  cardBody: { padding: '18px 20px 20px' },

  labelRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 },
  label: { fontSize: 13, fontWeight: 600, color: '#374151' },
  labelHint: { fontSize: 11.5, color: '#9CA3AF' },

  phoneRow: { display: 'flex', alignItems: 'center', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden', marginBottom: 12 },
  phonePrefix: { display: 'flex', alignItems: 'center', gap: 5, padding: '12px 11px', borderRight: '1px solid #E2E8F0', background: '#F1F5F9', flexShrink: 0 },
  phonePrefixText: { fontSize: 14, fontWeight: 700, color: '#475569' },
  phoneInput: { flex: 1, padding: '12px 13px', background: 'transparent', border: 'none', color: '#0F172A', fontSize: 15, outline: 'none', fontFamily: FONT },
  phoneCheck: { paddingRight: 12, display: 'flex', alignItems: 'center' },

  errorBox: { display: 'flex', alignItems: 'center', gap: 7, padding: '9px 12px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 8, color: '#DC2626', fontSize: 13.5, marginBottom: 12 },

  searchBtn: { width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '12px', background: '#2563EB', color: 'white', border: 'none', borderRadius: 10, fontSize: 14.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 2px 8px rgba(37,99,235,0.28)', transition: 'opacity 0.15s' },
  spinner: { width: 16, height: 16, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },

  resultsSection: { padding: '0 16px', position: 'relative', zIndex: 1 },
  resultCount: { fontSize: 12.5, fontWeight: 600, color: '#9CA3AF', margin: '0 0 10px', textTransform: 'uppercase', letterSpacing: '0.5px' },

  emptyCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '32px 20px', textAlign: 'center', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  emptyIcon: { width: 56, height: 56, borderRadius: 14, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' },
  emptyTitle: { fontSize: 16, fontWeight: 700, color: '#0F172A', margin: '0 0 6px' },
  emptyText: { fontSize: 13.5, color: '#6B7280', margin: '0 0 18px', lineHeight: 1.5 },
  fileMissingBtn: { display: 'inline-flex', alignItems: 'center', gap: 6, padding: '10px 20px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 9, color: '#DC2626', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT },

  helpCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 14, padding: '16px 18px', margin: '18px 16px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', position: 'relative', zIndex: 1 },
  helpTitle: { fontSize: 12, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 12px' },
  helpRow: { display: 'flex', alignItems: 'center', gap: 12 },
  helpIconWrap: { width: 32, height: 32, borderRadius: 8, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  helpLabel: { fontSize: 11.5, color: '#9CA3AF', margin: '0 0 2px' },
  helpValue: { fontSize: 15, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' },
  helpDivider: { width: 1, height: 32, background: '#E2E8F0', flexShrink: 0 },
};

const rc = {
  card: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 13, overflow: 'hidden', marginBottom: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  header: { width: '100%', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left', fontFamily: FONT, gap: 10 },
  headerLeft: { display: 'flex', gap: 12, alignItems: 'center' },
  headerRight: { display: 'flex', gap: 8, alignItems: 'center', flexShrink: 0 },
  photo: { width: 42, height: 42, borderRadius: 9, objectFit: 'cover', border: '1px solid #E2E8F0', flexShrink: 0 },
  photoEmpty: { width: 42, height: 42, borderRadius: 9, background: '#F8FAFC', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  name: { fontSize: 14.5, fontWeight: 700, color: '#0F172A', margin: 0 },
  meta: { fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' },
  statusBadge: { display: 'flex', gap: 5, alignItems: 'center', padding: '4px 10px', borderRadius: 20, fontSize: 11.5, fontWeight: 700, whiteSpace: 'nowrap' },

  body: { borderTop: '1px solid #F1F5F9', padding: '14px 16px 16px' },
  statusInfo: { padding: '10px 13px', borderRadius: 9, border: '1px solid', marginBottom: 16 },

  timelineWrap: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.7px', margin: '0 0 10px' },
  timeline: { display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative' },
  timelineStep: { display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1, position: 'relative' },
  timelineDot: { width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 6, zIndex: 1, transition: 'all 0.2s' },
  timelineLabel: { fontSize: 10, textAlign: 'center', margin: 0, lineHeight: 1.3 },
  timelineLine: { position: 'absolute', top: 10, left: '55%', width: '90%', height: 2, zIndex: 0, transition: 'background 0.2s' },

  detailsTable: { marginBottom: 14 },

  matchSection: { marginTop: 4 },
  matchCard: { background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 10, padding: '14px', display: 'flex', flexDirection: 'column', gap: 12 },
};