/**
 * FILE: page.js (Super Admin — Allocation History)
 * PURPOSE: Full log of past allocation rounds with expandable dispatch details.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGate from '@/components/common/RoleGate';

export default function AllocationHistoryPage() {
  return (
    <RoleGate allowedRole="super_admin">
      <HistoryContent />
    </RoleGate>
  );
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

  const URGENCY = { CRITICAL: { emoji: '🔴', color: '#EF4444' }, LOW: { emoji: '🟡', color: '#EAB308' }, OK: { emoji: '🟢', color: '#22C55E' } };

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.container}>
        <div style={{ marginBottom: 20 }}>
          <a href="/super-admin/dashboard" style={{ color: '#3B82F6', fontSize: 13, textDecoration: 'none' }}>← Back to Dashboard</a>
          <h1 style={S.title}>📊 Allocation History</h1>
          <p style={S.subtitle}>{rounds.length} rounds executed</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div style={S.spinner} /></div>
        ) : rounds.length === 0 ? (
          <div style={S.card}>
            <p style={{ color: '#64748B', textAlign: 'center', margin: 0 }}>No allocation rounds yet. Run your first allocation from the Dashboard.</p>
          </div>
        ) : (
          rounds.map(r => {
            const isOpen = expanded === r.id;
            const ds = dispatches[r.id] || [];
            return (
              <div key={r.id} style={S.card}>
                <div onClick={() => toggleExpand(r.id)} style={{ cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <p style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 4px' }}>
                      Round #{r.round_number}
                    </p>
                    <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                      {new Date(r.created_at).toLocaleString()} • {r.camps_count} camps • {r.total_kits_distributed} kits
                    </p>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={S.statsInline}>
                      <span style={{ color: '#3B82F6', fontWeight: 700 }}>{r.total_kits_distributed}</span>
                      <span style={{ color: '#64748B', fontSize: 11 }}> / {r.total_kits_available}</span>
                    </div>
                    <span style={{ color: '#64748B', fontSize: 18, transition: 'transform 0.2s', transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)' }}>▼</span>
                  </div>
                </div>

                {isOpen && (
                  <div style={{ marginTop: 14, borderTop: '1px solid #334155', paddingTop: 14 }}>
                    {ds.length === 0 ? (
                      <div style={{ textAlign: 'center', padding: 16 }}><div style={S.spinner} /></div>
                    ) : (
                      <div style={{ overflowX: 'auto' }}>
                        <table style={S.table}>
                          <thead>
                            <tr>
                              <th style={S.th}>Camp</th>
                              <th style={S.th}>Kits</th>
                              <th style={S.th}>Headcount</th>
                              <th style={S.th}>Predicted</th>
                              <th style={S.th}>Phase</th>
                              <th style={S.th}>Urgency</th>
                              <th style={S.th}>Kits/Person</th>
                              <th style={S.th}>Received</th>
                            </tr>
                          </thead>
                          <tbody>
                            {ds.map(d => {
                              const u = URGENCY[d.urgency] || URGENCY.OK;
                              return (
                                <tr key={d.id}>
                                  <td style={{ ...S.td, fontWeight: 600, color: '#F1F5F9' }}>{d.camps?.name || d.camp_id?.slice(0, 8)}</td>
                                  <td style={{ ...S.td, fontWeight: 700, color: '#3B82F6' }}>{d.kits_allocated}</td>
                                  <td style={S.td}>{d.current_headcount}</td>
                                  <td style={S.td}>{d.predicted_headcount}</td>
                                  <td style={S.td}>{d.camp_phase || '—'}</td>
                                  <td style={S.td}><span style={{ color: u.color }}>{u.emoji} {d.urgency}</span></td>
                                  <td style={S.td}>{d.kits_per_person_at_delivery}</td>
                                  <td style={S.td}>
                                    {d.received_at ? (
                                      <span style={{ color: '#22C55E' }}>✅ {new Date(d.received_at).toLocaleDateString()}</span>
                                    ) : (
                                      <span style={{ color: '#F97316' }}>Pending</span>
                                    )}
                                  </td>
                                </tr>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* Summary row */}
                    {ds.length > 0 && (
                      <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                        <div style={S.summaryChip}>
                          <span style={{ color: '#64748B', fontSize: 11 }}>Total Kits</span>
                          <span style={{ color: '#3B82F6', fontWeight: 700 }}>{ds.reduce((s, d) => s + d.kits_allocated, 0)}</span>
                        </div>
                        <div style={S.summaryChip}>
                          <span style={{ color: '#64748B', fontSize: 11 }}>Camps Served</span>
                          <span style={{ color: '#F1F5F9', fontWeight: 700 }}>{ds.length}</span>
                        </div>
                        <div style={S.summaryChip}>
                          <span style={{ color: '#64748B', fontSize: 11 }}>Received</span>
                          <span style={{ color: '#22C55E', fontWeight: 700 }}>{ds.filter(d => d.received_at).length}/{ds.length}</span>
                        </div>
                        <div style={S.summaryChip}>
                          <span style={{ color: '#64748B', fontSize: 11 }}>Critical</span>
                          <span style={{ color: '#EF4444', fontWeight: 700 }}>{ds.filter(d => d.urgency === 'CRITICAL').length}</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'system-ui, sans-serif', padding: '20px' },
  container: { maxWidth: 900, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 800, color: '#F1F5F9', margin: '8px 0 4px', letterSpacing: '-0.5px' },
  subtitle: { fontSize: 14, color: '#64748B', margin: '0 0 0' },
  card: { background: '#1E293B', borderRadius: 14, padding: 20, border: '1px solid #334155', marginBottom: 12 },
  statsInline: { fontSize: 14 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 12 },
  th: { textAlign: 'left', padding: '8px 10px', color: '#64748B', fontSize: 10, textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #334155' },
  td: { padding: '8px 10px', color: '#CBD5E1', borderBottom: '1px solid #1E293B' },
  summaryChip: { background: '#0F172A', borderRadius: 8, padding: '8px 14px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 },
  spinner: { width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
};
