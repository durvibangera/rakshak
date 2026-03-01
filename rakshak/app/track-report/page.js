/**
 * FILE: app/track-report/page.js
 * PURPOSE: Allow users to look up and track the status of their
 *          missing person reports using their phone number.
 */
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';

const STATUS_CONFIG = {
  active: {
    label: 'Actively Searching',
    color: '#F59E0B',
    bg: 'rgba(245,158,11,0.12)',
    border: 'rgba(245,158,11,0.3)',
    icon: '🔍',
    description: 'Our system is actively searching across all relief camps and databases.',
  },
  match_found: {
    label: 'Potential Match Found',
    color: '#3B82F6',
    bg: 'rgba(59,130,246,0.12)',
    border: 'rgba(59,130,246,0.3)',
    icon: '📍',
    description: 'A potential match has been identified. Verification is in progress.',
  },
  under_review: {
    label: 'Under Review',
    color: '#A78BFA',
    bg: 'rgba(167,139,250,0.12)',
    border: 'rgba(167,139,250,0.3)',
    icon: '📋',
    description: 'Your report is being reviewed by our response team.',
  },
  reunited: {
    label: 'Reunited',
    color: '#22C55E',
    bg: 'rgba(34,197,94,0.12)',
    border: 'rgba(34,197,94,0.3)',
    icon: '✅',
    description: 'The missing person has been found and reunited.',
  },
  closed: {
    label: 'Closed',
    color: '#64748B',
    bg: 'rgba(100,116,139,0.12)',
    border: 'rgba(100,116,139,0.3)',
    icon: '📁',
    description: 'This report has been closed.',
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

    setLoading(true);
    setError('');
    setReports(null);

    try {
      const cleanPhone = phone.replace(/\D/g, '').slice(-10);
      const fullPhone = `+91${cleanPhone}`;

      // Fetch reports where the reporter's phone matches
      const res = await fetch(`/api/missing-reports?reporter_phone=${encodeURIComponent(fullPhone)}`);
      const data = await res.json();

      if (data.reports && data.reports.length > 0) {
        setReports(data.reports);
      } else {
        // Also try searching by phone_of_missing
        const res2 = await fetch(`/api/missing-reports?phone_of_missing=${encodeURIComponent(fullPhone)}`);
        const data2 = await res2.json();

        if (data2.reports && data2.reports.length > 0) {
          setReports(data2.reports);
        } else {
          setReports([]);
        }
      }
    } catch {
      setError('Failed to fetch reports. Please check your connection.');
    } finally {
      setLoading(false);
    }
  }, [phone]);

  return (
    <div style={s.page}>
      {/* Header */}
      <div style={s.header}>
        <button type="button" onClick={() => router.push('/')} style={s.backBtn}>
          ← Back
        </button>
        <div style={s.logoBadge}>R</div>
        <h1 style={s.title}>Track Report</h1>
        <p style={s.subtitle}>Check the status of your missing person report</p>
      </div>

      {/* Search Section */}
      <div style={s.searchCard}>
        <label style={s.label}>Enter your phone number</label>
        <p style={s.hint}>Use the phone number you used while filing the report</p>
        <div style={s.inputRow}>
          <span style={s.prefix}>+91</span>
          <input
            type="tel"
            value={phone}
            onChange={e => setPhone(e.target.value.replace(/[^0-9]/g, '').slice(0, 10))}
            placeholder="Enter 10-digit number"
            style={s.input}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            maxLength={10}
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          style={{ ...s.searchBtn, opacity: loading ? 0.6 : 1 }}
        >
          {loading ? 'Searching...' : 'Search Reports'}
        </button>
        {error && <p style={s.error}>{error}</p>}
      </div>

      {/* Results */}
      {reports !== null && (
        <>
          {reports.length === 0 ? (
            <div style={s.emptyCard}>
              <span style={{ fontSize: 40 }}>📭</span>
              <h3 style={s.emptyTitle}>No Reports Found</h3>
              <p style={s.emptyText}>
                No missing person reports were found associated with this phone number.
              </p>
              <button type="button" onClick={() => router.push('/report-missing')} style={s.fileBtn}>
                File a New Report
              </button>
            </div>
          ) : (
            <div>
              <p style={s.resultCount}>
                {reports.length} report{reports.length > 1 ? 's' : ''} found
              </p>
              {reports.map(report => (
                <ReportCard
                  key={report.id}
                  report={report}
                  expanded={expandedId === report.id}
                  onToggle={() => setExpandedId(expandedId === report.id ? null : report.id)}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Help Section */}
      <div style={s.helpCard}>
        <h3 style={s.helpTitle}>Need Help?</h3>
        <div style={s.helpItem}>
          <span style={s.helpIcon}>📞</span>
          <div>
            <p style={s.helpLabel}>Emergency Helpline</p>
            <p style={s.helpValue}>112 (National Emergency)</p>
          </div>
        </div>
        <div style={s.helpItem}>
          <span style={s.helpIcon}>🏥</span>
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
    <div style={s.reportCard}>
      {/* Card Header */}
      <button type="button" onClick={onToggle} style={s.cardHeader}>
        <div style={s.cardHeaderLeft}>
          {report.photo_url ? (
            <img src={report.photo_url} alt="" style={s.reportPhoto} />
          ) : (
            <div style={s.photoPlaceholder}>
              <span style={{ fontSize: 20, opacity: 0.5 }}>👤</span>
            </div>
          )}
          <div>
            <p style={s.reportName}>{report.name || 'Unknown Person'}</p>
            <p style={s.reportMeta}>
              {report.age ? `${report.age} yrs` : ''}
              {report.age && report.gender ? ' · ' : ''}
              {report.gender || ''}
            </p>
          </div>
        </div>
        <div style={s.cardHeaderRight}>
          <div style={{
            ...s.statusBadge,
            background: status.bg,
            border: `1px solid ${status.border}`,
            color: status.color,
          }}>
            <span>{status.icon}</span>
            <span>{status.label}</span>
          </div>
          <span style={{ fontSize: 18, color: '#64748B', transform: expanded ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
            ▾
          </span>
        </div>
      </button>

      {/* Expanded Details */}
      {expanded && (
        <div style={s.cardBody}>
          {/* Status Description */}
          <div style={{ ...s.statusInfoBox, background: status.bg, borderColor: status.border }}>
            <p style={{ ...s.statusInfoText, color: status.color }}>{status.description}</p>
          </div>

          {/* Timeline */}
          <div style={s.timelineSection}>
            <p style={s.sectionLabel}>Progress</p>
            <div style={s.timeline}>
              {TIMELINE_STEPS.map((step, i) => {
                const stepConfig = STATUS_CONFIG[step];
                const isActive = i <= timelineIdx;
                const isCurrent = i === timelineIdx;
                return (
                  <div key={step} style={s.timelineStep}>
                    <div style={{
                      ...s.timelineDot,
                      background: isActive ? stepConfig.color : '#334155',
                      boxShadow: isCurrent ? `0 0 10px ${stepConfig.color}40` : 'none',
                    }}>
                      {isActive && <span style={{ fontSize: 10 }}>✓</span>}
                    </div>
                    <p style={{
                      ...s.timelineLabel,
                      color: isActive ? '#E2E8F0' : '#475569',
                      fontWeight: isCurrent ? 700 : 400,
                    }}>{stepConfig.label}</p>
                    {i < TIMELINE_STEPS.length - 1 && (
                      <div style={{ ...s.timelineLine, background: isActive ? stepConfig.color : '#334155' }} />
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Details Grid */}
          <div style={s.detailsGrid}>
            <DetailRow label="Report ID" value={report.id?.slice(0, 8).toUpperCase()} />
            <DetailRow label="Filed On" value={createdDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} />
            <DetailRow label="Days Since Report" value={`${daysSince} day${daysSince !== 1 ? 's' : ''}`} />
            {report.relationship && <DetailRow label="Relationship" value={report.relationship} />}
            {report.last_known_location && <DetailRow label="Last Known Location" value={report.last_known_location} />}
            {report.phone_of_missing && <DetailRow label={"Missing Person's Phone"} value={report.phone_of_missing} />}
            {report.identifying_details && <DetailRow label="Identifying Details" value={report.identifying_details} />}
            {updatedDate && <DetailRow label="Last Updated" value={updatedDate.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })} />}
          </div>

          {/* Match Info */}
          {(report.status === 'match_found' || report.status === 'under_review' || report.status === 'reunited') && (
            <div style={s.matchSection}>
              <p style={s.sectionLabel}>Match Information</p>
              <div style={s.matchCard}>
                {report.matched_camp_name && (
                  <div style={s.matchRow}>
                    <span style={s.matchIcon}>🏕️</span>
                    <div>
                      <p style={s.matchLabel}>Located at Camp</p>
                      <p style={s.matchValue}>{report.matched_camp_name}</p>
                    </div>
                  </div>
                )}
                {report.match_confidence && (
                  <div style={s.matchRow}>
                    <span style={s.matchIcon}>📊</span>
                    <div>
                      <p style={s.matchLabel}>Match Confidence</p>
                      <p style={s.matchValue}>{Math.round(report.match_confidence * 100)}%</p>
                    </div>
                  </div>
                )}
                {report.reviewer_notes && (
                  <div style={s.matchRow}>
                    <span style={s.matchIcon}>📝</span>
                    <div>
                      <p style={s.matchLabel}>Reviewer Notes</p>
                      <p style={s.matchValue}>{report.reviewer_notes}</p>
                    </div>
                  </div>
                )}
                {report.notified_at && (
                  <div style={s.matchRow}>
                    <span style={s.matchIcon}>🔔</span>
                    <div>
                      <p style={s.matchLabel}>Notified Via</p>
                      <p style={s.matchValue}>{report.notification_method || 'In-app'} - {new Date(report.notified_at).toLocaleDateString('en-IN')}</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div style={s.detailRow}>
      <span style={s.detailLabel}>{label}</span>
      <span style={s.detailValue}>{value}</span>
    </div>
  );
}

// ── Styles ──

const s = {
  page: {
    minHeight: '100vh', background: '#0F172A', padding: '20px 16px 60px',
    maxWidth: 520, margin: '0 auto', fontFamily: 'system-ui, sans-serif',
  },
  header: { textAlign: 'center', marginBottom: 24 },
  backBtn: {
    position: 'absolute', left: 16, top: 20, background: 'none', border: 'none',
    color: '#94A3B8', fontSize: 14, cursor: 'pointer', fontWeight: 600,
  },
  logoBadge: {
    width: 44, height: 44, borderRadius: 12, display: 'inline-flex', alignItems: 'center',
    justifyContent: 'center', fontWeight: 800, fontSize: 20, color: 'white',
    background: 'linear-gradient(135deg, #3B82F6, #8B5CF6)', marginBottom: 10,
  },
  title: { fontSize: 24, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px' },
  subtitle: { fontSize: 13, color: '#64748B', margin: 0 },

  // Search
  searchCard: {
    background: '#1E293B', borderRadius: 14, padding: 20, border: '1px solid #334155',
    marginBottom: 20,
  },
  label: { fontSize: 13, fontWeight: 700, color: '#E2E8F0', margin: '0 0 4px', display: 'block' },
  hint: { fontSize: 12, color: '#64748B', margin: '0 0 12px' },
  inputRow: {
    display: 'flex', alignItems: 'center', background: '#0F172A', borderRadius: 10,
    border: '1px solid #334155', overflow: 'hidden', marginBottom: 12,
  },
  prefix: {
    padding: '12px 10px 12px 14px', color: '#64748B', fontSize: 15, fontWeight: 600,
    borderRight: '1px solid #334155', background: 'rgba(51,65,85,0.3)',
  },
  input: {
    flex: 1, padding: '12px 14px', background: 'transparent', border: 'none',
    color: '#F1F5F9', fontSize: 15, outline: 'none',
  },
  searchBtn: {
    width: '100%', padding: '13px', background: 'linear-gradient(135deg, #3B82F6, #2563EB)',
    color: 'white', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700,
    cursor: 'pointer',
  },
  error: { color: '#EF4444', fontSize: 13, margin: '10px 0 0', textAlign: 'center' },

  // Results
  resultCount: { fontSize: 13, color: '#94A3B8', margin: '0 0 12px', fontWeight: 600 },
  emptyCard: {
    textAlign: 'center', padding: 32, background: '#1E293B', borderRadius: 14,
    border: '1px solid #334155',
  },
  emptyTitle: { fontSize: 18, fontWeight: 700, color: '#E2E8F0', margin: '12px 0 6px' },
  emptyText: { fontSize: 13, color: '#64748B', margin: '0 0 20px', lineHeight: 1.5 },
  fileBtn: {
    padding: '12px 28px', background: 'rgba(239,68,68,0.15)', color: '#FCA5A5',
    border: '1px solid rgba(239,68,68,0.3)', borderRadius: 10, fontSize: 14,
    fontWeight: 700, cursor: 'pointer',
  },

  // Report Card
  reportCard: {
    background: '#1E293B', borderRadius: 14, border: '1px solid #334155',
    marginBottom: 12, overflow: 'hidden',
  },
  cardHeader: {
    width: '100%', padding: '16px', display: 'flex', justifyContent: 'space-between',
    alignItems: 'center', background: 'transparent', border: 'none', cursor: 'pointer',
    textAlign: 'left',
  },
  cardHeaderLeft: { display: 'flex', gap: 12, alignItems: 'center' },
  cardHeaderRight: { display: 'flex', gap: 8, alignItems: 'center' },
  reportPhoto: { width: 44, height: 44, borderRadius: 10, objectFit: 'cover' },
  photoPlaceholder: {
    width: 44, height: 44, borderRadius: 10, background: '#334155',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  reportName: { fontSize: 15, fontWeight: 700, color: '#F1F5F9', margin: 0 },
  reportMeta: { fontSize: 12, color: '#64748B', margin: '2px 0 0' },
  statusBadge: {
    display: 'flex', gap: 5, alignItems: 'center', padding: '5px 10px',
    borderRadius: 20, fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap',
  },

  // Card Body
  cardBody: { padding: '0 16px 16px', borderTop: '1px solid #334155' },
  statusInfoBox: {
    padding: 12, borderRadius: 10, border: '1px solid', marginTop: 14, marginBottom: 16,
  },
  statusInfoText: { fontSize: 13, margin: 0, lineHeight: 1.5, fontWeight: 500 },

  // Timeline
  timelineSection: { marginBottom: 16 },
  sectionLabel: {
    fontSize: 11, fontWeight: 700, color: '#64748B', textTransform: 'uppercase',
    letterSpacing: 0.8, margin: '0 0 10px',
  },
  timeline: {
    display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', position: 'relative',
  },
  timelineStep: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', flex: 1,
    position: 'relative',
  },
  timelineDot: {
    width: 22, height: 22, borderRadius: '50%', display: 'flex', alignItems: 'center',
    justifyContent: 'center', color: '#fff', fontSize: 10, fontWeight: 700,
    marginBottom: 6, zIndex: 1,
  },
  timelineLabel: { fontSize: 10, textAlign: 'center', margin: 0, lineHeight: 1.3 },
  timelineLine: {
    position: 'absolute', top: 10, left: '60%', width: '80%', height: 2, zIndex: 0,
  },

  // Details
  detailsGrid: { marginBottom: 16 },
  detailRow: {
    display: 'flex', justifyContent: 'space-between', padding: '8px 0',
    borderBottom: '1px solid rgba(51,65,85,0.5)',
  },
  detailLabel: { fontSize: 12, color: '#64748B', fontWeight: 500 },
  detailValue: { fontSize: 12, color: '#E2E8F0', fontWeight: 600, textAlign: 'right', maxWidth: '60%' },

  // Match Section
  matchSection: { marginTop: 4 },
  matchCard: {
    background: 'rgba(59,130,246,0.06)', borderRadius: 10, border: '1px solid rgba(59,130,246,0.15)',
    padding: 14, display: 'flex', flexDirection: 'column', gap: 12,
  },
  matchRow: { display: 'flex', gap: 10, alignItems: 'flex-start' },
  matchIcon: { fontSize: 18, marginTop: 1 },
  matchLabel: { fontSize: 11, color: '#64748B', margin: 0, fontWeight: 500 },
  matchValue: { fontSize: 13, color: '#E2E8F0', margin: '1px 0 0', fontWeight: 600 },

  // Help
  helpCard: {
    background: '#1E293B', borderRadius: 14, padding: 18, border: '1px solid #334155',
    marginTop: 20,
  },
  helpTitle: { fontSize: 14, fontWeight: 700, color: '#94A3B8', margin: '0 0 14px' },
  helpItem: {
    display: 'flex', gap: 12, alignItems: 'center', padding: '8px 0',
    borderBottom: '1px solid rgba(51,65,85,0.5)',
  },
  helpIcon: { fontSize: 20 },
  helpLabel: { fontSize: 12, color: '#64748B', margin: 0 },
  helpValue: { fontSize: 14, color: '#E2E8F0', margin: '1px 0 0', fontWeight: 700 },
};
