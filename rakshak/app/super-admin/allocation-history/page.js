/**
 * FILE: page.js (Super Admin — Allocation History)
 * PURPOSE: Full log of past allocation rounds with expandable dispatch details.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGate from '@/components/common/RoleGate';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function AllocationHistoryPage() {
  return <RoleGate allowedRole="super_admin"><HistoryContent /></RoleGate>;
}

function HistoryContent() {
  const [rounds, setRounds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(null);
  const [dispatches, setDispatches] = useState({});

  const fetchRounds = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/allocation-rounds');
      const data = await res.json();
      setRounds(data.rounds || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchRounds(); }, [fetchRounds]);

  const toggleExpand = async (roundId) => {
    if (expanded === roundId) { setExpanded(null); return; }
    setExpanded(roundId);
    if (!dispatches[roundId]) {
      const res = await fetch(`/api/dispatch-orders?round_id=${roundId}`);
      const data = await res.json();
      setDispatches(prev => ({ ...prev, [roundId]: data.dispatches || [] }));
    }
  };

  const URGENCY = {
    CRITICAL: { bg: '#FEE2E2', text: '#DC2626', label: 'Critical' },
    LOW:      { bg: '#FEF3C7', text: '#B45309', label: 'Low' },
    OK:       { bg: '#D1FAE5', text: '#065F46', label: 'OK' },
  };

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>
            <svg width="22" height="22" viewBox="0 0 28 28" fill="none">
              <path d="M14 2L3 8v7c0 5.55 4.7 10.74 11 12 6.3-1.26 11-6.45 11-12V8L14 2z" fill="#2563EB"/>
              <path d="M10 14l3 3 5-5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            <span style={s.navLogoText}>Sahaay</span>
            <span style={s.navRoleBadge}>Super Admin</span>
          </div>
        </div>
        <Link href="/super-admin/dashboard" style={s.navBack}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
          Back to Dashboard
        </Link>
      </header>

      <div style={s.body}>
        <div style={s.pageHead}>
          <p style={s.eyebrow}>Super Admin</p>
          <h1 style={s.pageTitle}>Allocation History</h1>
          <p style={s.pageSubtitle}>{rounds.length} rounds executed</p>
        </div>

        {loading ? (
          <div style={s.loadingWrap}><div style={s.spinner} /><p style={s.loadingText}>Loading rounds…</p></div>
        ) : rounds.length === 0 ? (
          <div style={s.emptyCard}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            <p style={s.emptyText}>No allocation rounds yet. Run your first allocation from the Dashboard.</p>
          </div>
        ) : (
          <div style={s.roundsList}>
            {rounds.map(r => {
              const isOpen = expanded === r.id;
              const ds = dispatches[r.id] || [];
              const totalKits = ds.reduce((sum, d) => sum + d.kits_allocated, 0);
              const received = ds.filter(d => d.received_at).length;
              const critical = ds.filter(d => d.urgency === 'CRITICAL').length;
              const pct = r.total_kits_available > 0 ? Math.round((r.total_kits_distributed / r.total_kits_available) * 100) : 0;

              return (
                <div key={r.id} style={s.roundCard}>
                  {/* Round header — clickable */}
                  <div onClick={() => toggleExpand(r.id)} style={s.roundHeader}>
                    <div style={s.roundHeaderLeft}>
                      <div style={s.roundNum}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                        Round #{r.round_number}
                      </div>
                      <p style={s.roundMeta}>
                        {new Date(r.created_at).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                        &nbsp;·&nbsp;{r.camps_count} camps
                      </p>
                    </div>
                    <div style={s.roundHeaderRight}>
                      <div style={s.roundChips}>
                        <span style={s.roundChip}><span style={{ color: '#2563EB', fontWeight: 700 }}>{r.total_kits_distributed}</span> / {r.total_kits_available} kits</span>
                        <span style={{ ...s.roundChip, background: '#EFF6FF', color: '#2563EB' }}>{pct}% dispatched</span>
                      </div>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2.5" style={{ transform: isOpen ? 'rotate(180deg)' : 'rotate(0)', transition: 'transform 0.2s', flexShrink: 0 }}><polyline points="6 9 12 15 18 9"/></svg>
                    </div>
                  </div>

                  {/* Expanded dispatch table */}
                  {isOpen && (
                    <div style={s.roundBody}>
                      <div style={s.roundBodyDivider} />
                      {ds.length === 0 ? (
                        <div style={s.loadingWrap}><div style={s.spinner} /></div>
                      ) : (
                        <>
                          <div style={{ overflowX: 'auto' }}>
                            <table style={s.table}>
                              <thead>
                                <tr>
                                  {['Camp', 'Kits', 'Headcount', 'Predicted', 'Phase', 'Urgency', 'Kits/Person', 'Status'].map(h => (
                                    <th key={h} style={s.th}>{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {ds.map(d => {
                                  const u = URGENCY[d.urgency] || URGENCY.OK;
                                  return (
                                    <tr key={d.id} style={s.tr}>
                                      <td style={s.td}><span style={s.tdBold}>{d.camps?.name || d.camp_id?.slice(0, 8)}</span></td>
                                      <td style={s.td}><span style={{ ...s.tdBold, color: '#2563EB' }}>{d.kits_allocated}</span></td>
                                      <td style={s.td}>{d.current_headcount}</td>
                                      <td style={s.td}>{d.predicted_headcount}</td>
                                      <td style={s.td}>{d.camp_phase || '—'}</td>
                                      <td style={s.td}><span style={{ ...s.badge, background: u.bg, color: u.text }}>{u.label}</span></td>
                                      <td style={s.td}>{d.kits_per_person_at_delivery}</td>
                                      <td style={s.td}>
                                        {d.received_at ? (
                                          <span style={{ color: '#059669', fontWeight: 600, fontSize: 12 }}>
                                            ✓ {new Date(d.received_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                                          </span>
                                        ) : (
                                          <span style={{ color: '#D97706', fontWeight: 600, fontSize: 12 }}>Pending</span>
                                        )}
                                      </td>
                                    </tr>
                                  );
                                })}
                              </tbody>
                            </table>
                          </div>

                          {/* Summary chips */}
                          <div style={s.summaryRow}>
                            <SummaryChip label="Total Kits" value={totalKits} color="#2563EB" />
                            <SummaryChip label="Camps Served" value={ds.length} color="#7C3AED" />
                            <SummaryChip label="Received" value={`${received}/${ds.length}`} color="#059669" />
                            <SummaryChip label="Critical" value={critical} color="#DC2626" />
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryChip({ label, value, color }) {
  return (
    <div style={{ background: 'white', border: '1px solid #E2E8F0', borderRadius: 9, padding: '10px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 90 }}>
      <span style={{ fontSize: 18, fontWeight: 800, color, letterSpacing: '-0.5px' }}>{value}</span>
      <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 500 }}>{label}</span>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT, color: '#111827' },
  nav: { background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 28px', height: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  navLeft: { display: 'flex', alignItems: 'center' },
  navLogo: { display: 'flex', alignItems: 'center', gap: 9 },
  navLogoText: { fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  navRoleBadge: { fontSize: 11, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', padding: '2px 8px', borderRadius: 20 },
  navBack: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#6B7280', textDecoration: 'none' },

  body: { maxWidth: 960, margin: '0 auto', padding: '28px 28px 48px' },
  pageHead: { marginBottom: 22 },
  eyebrow: { fontSize: 11, fontWeight: 600, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  pageTitle: { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.5px' },
  pageSubtitle: { fontSize: 14, color: '#6B7280', margin: 0 },

  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '60px 0', gap: 12 },
  spinner: { width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText: { fontSize: 13.5, color: '#9CA3AF', margin: 0 },

  emptyCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '36px 24px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  emptyText: { fontSize: 14, color: '#9CA3AF', margin: 0, textAlign: 'center' },

  roundsList: { display: 'flex', flexDirection: 'column', gap: 12 },
  roundCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  roundHeader: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px 20px', cursor: 'pointer' },
  roundHeaderLeft: {},
  roundNum: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 15, fontWeight: 700, color: '#0F172A', marginBottom: 3 },
  roundMeta: { fontSize: 12.5, color: '#9CA3AF', margin: 0 },
  roundHeaderRight: { display: 'flex', alignItems: 'center', gap: 12 },
  roundChips: { display: 'flex', gap: 8 },
  roundChip: { fontSize: 12.5, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 7, padding: '4px 10px', color: '#6B7280' },
  roundBody: { padding: '0 20px 16px' },
  roundBodyDivider: { height: 1, background: '#F1F5F9', marginBottom: 14 },
  summaryRow: { display: 'flex', gap: 10, marginTop: 14, flexWrap: 'wrap' },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #F1F5F9', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #F8FAFC' },
  td: { padding: '10px 12px', color: '#475569', fontSize: 13 },
  tdBold: { fontWeight: 700, color: '#111827' },
  badge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5 },
};
