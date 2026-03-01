/**
 * FILE: page.js (Super Admin Dashboard — Kit Allocation Command Center)
 * PURPOSE: Shows camp status grid, pending requests, inventory, run ML allocation.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';

export default function SuperAdminDashboard() {
  return (
    <RoleGate allowedRole="super_admin">
      <DashboardContent />
    </RoleGate>
  );
}

function DashboardContent() {
  const [camps, setCamps] = useState([]);
  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState({ balance: 0, total_in: 0, total_out: 0 });
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [allocationResult, setAllocationResult] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [totalPeople, setTotalPeople] = useState(0);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      // Camps
      const { data: campsData } = await supabase.from('camps').select('*').eq('status', 'active');
      const campsList = campsData || [];

      // Headcounts per camp
      const headcounts = {};
      let total = 0;
      await Promise.all(
        campsList.map(async (c) => {
          const { count } = await supabase
            .from('camp_victims')
            .select('*', { count: 'exact', head: true })
            .eq('camp_id', c.id);
          headcounts[c.id] = count || 0;
          total += count || 0;
        })
      );
      setTotalPeople(total);

      // Attach headcount to camps
      const campsWithHC = campsList.map((c) => ({ ...c, headcount: headcounts[c.id] || 0 }));
      setCamps(campsWithHC);

      // Pending requests
      const reqRes = await fetch('/api/resource-requests?status=pending');
      const reqData = await reqRes.json();
      setRequests(reqData.requests || []);

      // Inventory
      const invRes = await fetch('/api/kit-inventory');
      const invData = await invRes.json();
      setInventory(invData);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Run prediction for a single camp
  const predictCamp = async (camp) => {
    try {
      const now = new Date();
      const { data: victims } = await supabase
        .from('camp_victims')
        .select('checked_in_at')
        .eq('camp_id', camp.id);

      const arr1h = (victims || []).filter(v => new Date(v.checked_in_at) >= new Date(now - 3600000)).length;
      const arr3h = (victims || []).filter(v => new Date(v.checked_in_at) >= new Date(now - 10800000)).length;
      const arr6h = (victims || []).filter(v => new Date(v.checked_in_at) >= new Date(now - 21600000)).length;

      const { data: alert } = await supabase
        .from('alerts')
        .select('type, risk')
        .is('resolved_at', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      const res = await fetch('/api/ml/predict', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camp_id: camp.id,
          current_headcount: camp.headcount,
          alert_risk: alert?.risk || 'MEDIUM',
          alert_type: alert?.type || 'FLOOD',
          arrivals_last_1h: arr1h,
          arrivals_last_3h: arr3h,
          arrivals_last_6h: arr6h,
        }),
      });
      return await res.json();
    } catch {
      return null;
    }
  };

  // Run predictions for all camps
  const runAllPredictions = async () => {
    const preds = {};
    await Promise.all(
      camps.map(async (c) => {
        const p = await predictCamp(c);
        if (p) preds[c.id] = p;
      })
    );
    setPredictions(preds);
  };

  // Run ML allocation
  const runAllocation = async () => {
    setAllocating(true);
    try {
      // Ensure predictions are fresh
      if (Object.keys(predictions).length < camps.length) {
        await runAllPredictions();
      }

      const campStates = camps.map((c) => ({
        camp_id: c.id,
        camp_name: c.name,
        current_headcount: c.headcount,
        predicted_headcount: predictions[c.id]?.predicted_headcount_24h || c.headcount,
        alert_risk: predictions[c.id]?.features_used?.alert_risk || 'MEDIUM',
        phase_name: predictions[c.id]?.phase_name || 'PLATEAU',
      }));

      const res = await fetch('/api/ml/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camps: campStates,
          total_kits_available: inventory.balance,
          beta: 0.7,
          buffer_pct: 0.15,
          triggered_by: 'super_admin',
        }),
      });
      const data = await res.json();
      setAllocationResult(data);
      setShowModal(true);
    } catch (e) {
      console.error(e);
    }
    setAllocating(false);
  };

  // Handle request action
  const handleRequest = async (id, status) => {
    await fetch('/api/resource-requests', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, status }),
    });
    fetchAll();
  };

  const URGENCY = { CRITICAL: { emoji: '🔴', color: '#EF4444' }, LOW: { emoji: '🟡', color: '#EAB308' }, OK: { emoji: '🟢', color: '#22C55E' } };
  const PHASE_COLORS = { SURGE: '#EF4444', PLATEAU: '#3B82F6', DEPLETION: '#64748B' };
  const RISK_COLORS = { HIGH: '#EF4444', MEDIUM: '#F59E0B', LOW: '#22C55E' };

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.container}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <h1 style={S.title}>⚙️ Super Admin Dashboard</h1>
            <p style={S.subtitle}>Smart Kit Allocation Command Center</p>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <a href="/super-admin/ngos" style={S.navLink}>NGOs</a>
            <a href="/super-admin/safe-zones" style={S.navLink}>Safe Zones</a>
            <a href="/super-admin/allocation-history" style={S.navLink}>History</a>
            <a href="/super-admin/sms-alerts" style={S.navLink}>📲 SMS</a>
            <a href="/super-admin/simulate" style={S.navLink}>⚡ Simulate</a>
          </div>
        </div>

        {loading ? (
          <div style={S.loadingBox}><div style={S.spinner} /></div>
        ) : (
          <>
            {/* Top Stats */}
            <div style={S.statsRow}>
              <StatCard label="Kit Inventory" value={inventory.balance} icon="📦" color="#3B82F6" />
              <StatCard label="Active Camps" value={camps.length} icon="🏕️" color="#8B5CF6" />
              <StatCard label="Total People" value={totalPeople} icon="👥" color="#22C55E" />
              <StatCard label="Pending Requests" value={requests.length} icon="📋" color={requests.length > 0 ? '#EF4444' : '#64748B'} />
            </div>

            {/* Inventory Gauge */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <h2 style={S.cardTitle}>📊 Inventory Overview</h2>
                <span style={{ fontSize: 12, color: '#64748B' }}>Total IN: {inventory.total_in} | Total OUT: {inventory.total_out}</span>
              </div>
              <div style={{ background: '#0F172A', borderRadius: 8, height: 24, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${Math.min(100, inventory.total_in > 0 ? (inventory.balance / inventory.total_in) * 100 : 0)}%`,
                  background: 'linear-gradient(90deg, #3B82F6, #8B5CF6)',
                  borderRadius: 8,
                  transition: 'width 0.5s',
                }} />
              </div>
              <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 4 }}>
                {inventory.balance} kits remaining of {inventory.total_in} total received
              </p>
            </div>

            {/* Camp Status Grid */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 style={S.cardTitle}>🏕️ Camp Status Grid</h2>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button onClick={runAllPredictions} style={S.btnSecondary}>🤖 Run Predictions</button>
                  <button onClick={runAllocation} disabled={allocating || inventory.balance <= 0} style={S.btnPrimary}>
                    {allocating ? 'Allocating...' : '⚡ Run Smart Allocation'}
                  </button>
                </div>
              </div>
              <div style={S.campGrid}>
                {camps.map((c) => {
                  const pred = predictions[c.id];
                  const risk = pred?.features_used?.alert_risk || 'MEDIUM';
                  const phase = pred?.phase_name || '—';
                  const urgencyKey = pred?.predicted_headcount_24h > c.headcount * 1.3 ? 'CRITICAL' : pred?.predicted_headcount_24h < c.headcount * 0.8 ? 'LOW' : 'OK';
                  const u = URGENCY[urgencyKey];
                  return (
                    <div key={c.id} style={S.campCard}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                        <div>
                          <p style={{ fontSize: 14, fontWeight: 700, color: '#F1F5F9', margin: 0 }}>{c.name}</p>
                          <p style={{ fontSize: 11, color: '#64748B', margin: '2px 0 0' }}>{c.operator_name}</p>
                        </div>
                        <span style={{ fontSize: 18 }}>{u.emoji}</span>
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 8 }}>
                        <div>
                          <p style={S.miniLabel}>Current</p>
                          <p style={S.miniVal}>{c.headcount}</p>
                        </div>
                        <div>
                          <p style={S.miniLabel}>Predicted (24h)</p>
                          <p style={{ ...S.miniVal, color: pred ? '#34D399' : '#64748B' }}>{pred?.predicted_headcount_24h ?? '—'}</p>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <span style={{ ...S.smallBadge, background: `${RISK_COLORS[risk]}20`, color: RISK_COLORS[risk] }}>{risk}</span>
                        <span style={{ ...S.smallBadge, background: `${PHASE_COLORS[phase] || '#64748B'}20`, color: PHASE_COLORS[phase] || '#64748B' }}>{phase}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pending Resource Requests */}
            <div style={S.card}>
              <h2 style={S.cardTitle}>📋 Pending Resource Requests</h2>
              {requests.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 13 }}>No pending requests.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Camp</th>
                        <th style={S.th}>Headcount</th>
                        <th style={S.th}>Kits Requested</th>
                        <th style={S.th}>Notes</th>
                        <th style={S.th}>Requested</th>
                        <th style={S.th}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requests.map((r) => (
                        <tr key={r.id}>
                          <td style={S.td}>{r.camps?.name || r.camp_id}</td>
                          <td style={S.td}>{r.current_headcount}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#F1F5F9' }}>{r.min_kits_needed}</td>
                          <td style={{ ...S.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes || '—'}</td>
                          <td style={S.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                          <td style={S.td}>
                            <div style={{ display: 'flex', gap: 6 }}>
                              <button onClick={() => handleRequest(r.id, 'acknowledged')} style={S.actionBtn}>✅</button>
                              <button onClick={() => handleRequest(r.id, 'rejected')} style={{ ...S.actionBtn, background: 'rgba(239,68,68,0.15)', color: '#EF4444' }}>❌</button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {/* Allocation Result Modal */}
      {showModal && allocationResult && (
        <div style={S.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={S.modal} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: 18, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px' }}>⚡ Allocation Result — Round #{allocationResult.round_number}</h2>
            <p style={{ fontSize: 13, color: '#64748B', margin: '0 0 16px' }}>
              Dispatched {allocationResult.total_kits_dispatched} kits | Reserve: {allocationResult.reserve_kits}
            </p>
            <div style={{ overflowX: 'auto', maxHeight: 400 }}>
              <table style={S.table}>
                <thead>
                  <tr>
                    <th style={S.th}>Camp</th>
                    <th style={S.th}>Current</th>
                    <th style={S.th}>Predicted</th>
                    <th style={S.th}>Kits</th>
                    <th style={S.th}>Kits/Person</th>
                    <th style={S.th}>Urgency</th>
                  </tr>
                </thead>
                <tbody>
                  {(allocationResult.allocations || []).map((a) => {
                    const u = URGENCY[a.urgency] || URGENCY.OK;
                    return (
                      <tr key={a.camp_id}>
                        <td style={S.td}>{a.camp_name || a.camp_id}</td>
                        <td style={S.td}>{a.current_headcount}</td>
                        <td style={S.td}>{a.predicted_headcount}</td>
                        <td style={{ ...S.td, fontWeight: 700, color: '#F1F5F9' }}>{a.kits_allocated}</td>
                        <td style={S.td}>{a.kits_per_person_at_delivery}</td>
                        <td style={S.td}><span style={{ color: u.color }}>{u.emoji} {a.urgency}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <button onClick={() => setShowModal(false)} style={S.btnSecondary}>Close</button>
              <button onClick={() => { setShowModal(false); fetchAll(); }} style={S.btnPrimary}>✅ Confirm &amp; Refresh</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value, icon, color }) {
  return (
    <div style={{ background: '#1E293B', borderRadius: 12, padding: 16, border: '1px solid #334155', textAlign: 'center' }}>
      <p style={{ fontSize: 22, margin: '0 0 4px' }}>{icon}</p>
      <p style={{ fontSize: 26, fontWeight: 800, color: color || '#F1F5F9', margin: '0 0 2px' }}>{value}</p>
      <p style={{ fontSize: 11, color: '#64748B', margin: 0, textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 }}>{label}</p>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'system-ui, sans-serif', padding: '20px' },
  container: { maxWidth: 1100, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 800, color: '#F1F5F9', margin: 0, letterSpacing: '-0.5px' },
  subtitle: { fontSize: 14, color: '#64748B', margin: '4px 0 0' },
  navLink: { padding: '6px 14px', background: '#1E293B', border: '1px solid #334155', borderRadius: 8, color: '#94A3B8', fontSize: 12, fontWeight: 600, textDecoration: 'none' },
  loadingBox: { display: 'flex', justifyContent: 'center', padding: 80 },
  spinner: { width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 16 },
  card: { background: '#1E293B', borderRadius: 14, padding: 20, border: '1px solid #334155', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 8px' },
  campGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 12 },
  campCard: { background: '#0F172A', borderRadius: 12, padding: 14, border: '1px solid #334155' },
  miniLabel: { fontSize: 10, color: '#64748B', margin: '0 0 1px', textTransform: 'uppercase', fontWeight: 700 },
  miniVal: { fontSize: 20, fontWeight: 800, color: '#F1F5F9', margin: 0 },
  smallBadge: { padding: '2px 8px', borderRadius: 5, fontSize: 10, fontWeight: 700 },
  btnPrimary: { background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  btnSecondary: { background: '#334155', color: '#94A3B8', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  actionBtn: { background: 'rgba(59,130,246,0.15)', color: '#3B82F6', border: 'none', borderRadius: 6, padding: '4px 10px', fontSize: 14, cursor: 'pointer' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', color: '#64748B', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', color: '#CBD5E1', borderBottom: '1px solid #1E293B' },
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 },
  modal: { background: '#1E293B', borderRadius: 16, padding: 24, border: '1px solid #334155', maxWidth: 800, width: '100%', maxHeight: '90vh', overflow: 'auto' },
};
