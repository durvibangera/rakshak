/**
 * FILE: page.js (Camp Admin — My Dispatches)
 * PURPOSE: Shows incoming kit dispatch orders for this camp with receipt confirmation.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';

export default function MyDispatchesPage() {
  return (
    <RoleGate minRole="camp_admin">
      <DispatchesContent />
    </RoleGate>
  );
}

function DispatchesContent() {
  const { profile, campId } = useAuth();
  const [dispatches, setDispatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campInfo, setCampInfo] = useState(null);

  const effectiveCampId = campId || profile?.camp_id;

  const fetchData = useCallback(async () => {
    if (!effectiveCampId) return;
    setLoading(true);
    try {
      const { data: camp } = await supabase.from('camps').select('name').eq('id', effectiveCampId).single();
      setCampInfo(camp);

      const res = await fetch(`/api/dispatch-orders?camp_id=${effectiveCampId}`);
      const data = await res.json();
      setDispatches(data.dispatches || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [effectiveCampId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    const channel = supabase
      .channel('dispatches-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kit_dispatch_orders' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  const confirmReceipt = async (id) => {
    await fetch('/api/dispatch-orders', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    });
    fetchData();
  };

  const latest = dispatches[0];
  const URGENCY = { CRITICAL: { emoji: '🔴', color: '#EF4444', bg: 'rgba(239,68,68,0.1)' }, LOW: { emoji: '🟡', color: '#EAB308', bg: 'rgba(234,179,8,0.1)' }, OK: { emoji: '🟢', color: '#22C55E', bg: 'rgba(34,197,94,0.1)' } };

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.container}>
        <div style={{ marginBottom: 20 }}>
          <a href="/camp/dashboard" style={{ color: '#3B82F6', fontSize: 13, textDecoration: 'none' }}>← Back to Dashboard</a>
          <h1 style={S.title}>📦 My Kit Dispatches</h1>
          <p style={S.subtitle}>{campInfo?.name || 'Your Camp'}</p>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div style={S.spinner} /></div>
        ) : !effectiveCampId ? (
          <div style={S.card}><p style={{ color: '#F87171', fontSize: 13 }}>No camp assigned.</p></div>
        ) : (
          <>
            {/* Latest Dispatch */}
            {latest ? (
              <div style={{ ...S.card, border: '1px solid rgba(59,130,246,0.3)', background: 'rgba(30,41,59,0.9)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                  <div>
                    <p style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', margin: '0 0 4px' }}>Latest Dispatch</p>
                    <p style={{ fontSize: 11, color: '#64748B', margin: 0 }}>
                      Round #{latest.kit_allocation_rounds?.round_number || '—'} • {latest.dispatched_at ? new Date(latest.dispatched_at).toLocaleString() : '—'}
                    </p>
                  </div>
                  {(() => {
                    const u = URGENCY[latest.urgency] || URGENCY.OK;
                    return <span style={{ ...S.badge, background: u.bg, color: u.color }}>{u.emoji} {latest.urgency}</span>;
                  })()}
                </div>

                <div style={S.statsRow}>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Kits Allocated</p>
                    <p style={{ ...S.statValue, color: '#3B82F6' }}>{latest.kits_allocated}</p>
                  </div>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Predicted HC</p>
                    <p style={S.statValue}>{latest.predicted_headcount}</p>
                  </div>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Kits/Person</p>
                    <p style={S.statValue}>{latest.kits_per_person_at_delivery}</p>
                  </div>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Phase</p>
                    <p style={S.statValue}>{latest.camp_phase || '—'}</p>
                  </div>
                </div>

                {!latest.received_at ? (
                  <button onClick={() => confirmReceipt(latest.id)} style={S.btnPrimary}>
                    ✅ Confirm Receipt
                  </button>
                ) : (
                  <p style={{ fontSize: 13, color: '#22C55E', margin: 0 }}>
                    ✅ Received on {new Date(latest.received_at).toLocaleString()}
                  </p>
                )}
              </div>
            ) : (
              <div style={S.card}>
                <p style={{ color: '#64748B', fontSize: 14, textAlign: 'center', margin: 0 }}>
                  No dispatches yet. The Super Admin will allocate kits after resource requests are processed.
                </p>
              </div>
            )}

            {/* Historical Table */}
            <div style={S.card}>
              <h2 style={S.cardTitle}>📋 Dispatch History</h2>
              {dispatches.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 13 }}>No dispatches yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Round</th>
                        <th style={S.th}>Kits</th>
                        <th style={S.th}>Headcount</th>
                        <th style={S.th}>Predicted</th>
                        <th style={S.th}>Phase</th>
                        <th style={S.th}>Urgency</th>
                        <th style={S.th}>Dispatched</th>
                        <th style={S.th}>Received</th>
                      </tr>
                    </thead>
                    <tbody>
                      {dispatches.map((d) => {
                        const u = URGENCY[d.urgency] || URGENCY.OK;
                        return (
                          <tr key={d.id}>
                            <td style={S.td}>#{d.kit_allocation_rounds?.round_number || '—'}</td>
                            <td style={{ ...S.td, fontWeight: 700, color: '#F1F5F9' }}>{d.kits_allocated}</td>
                            <td style={S.td}>{d.current_headcount}</td>
                            <td style={S.td}>{d.predicted_headcount}</td>
                            <td style={S.td}>{d.camp_phase || '—'}</td>
                            <td style={S.td}><span style={{ color: u.color }}>{u.emoji} {d.urgency}</span></td>
                            <td style={S.td}>{d.dispatched_at ? new Date(d.dispatched_at).toLocaleDateString() : '—'}</td>
                            <td style={S.td}>
                              {d.received_at ? (
                                <span style={{ color: '#22C55E' }}>✅ {new Date(d.received_at).toLocaleDateString()}</span>
                              ) : (
                                <button onClick={() => confirmReceipt(d.id)} style={{ ...S.btnSmall }}>Confirm</button>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'system-ui, sans-serif', padding: '20px' },
  container: { maxWidth: 800, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 800, color: '#F1F5F9', margin: '8px 0 4px', letterSpacing: '-0.5px' },
  subtitle: { fontSize: 14, color: '#64748B', margin: 0 },
  card: { background: '#1E293B', borderRadius: 14, padding: 20, border: '1px solid #334155', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 12px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 },
  statBox: { background: '#0F172A', borderRadius: 8, padding: 12, textAlign: 'center' },
  statLabel: { fontSize: 10, color: '#64748B', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 700 },
  statValue: { fontSize: 20, fontWeight: 800, color: '#F1F5F9', margin: 0 },
  badge: { padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  btnPrimary: { background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  btnSmall: { background: '#334155', color: '#94A3B8', border: 'none', borderRadius: 6, padding: '4px 12px', fontSize: 12, fontWeight: 600, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', color: '#64748B', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', color: '#CBD5E1', borderBottom: '1px solid #1E293B' },
  spinner: { width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
};
