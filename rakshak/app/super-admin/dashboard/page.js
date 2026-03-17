'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function SuperAdminDashboard() {
  const { handleLogout } = useAuth();
  return (
    <RoleGate allowedRole="super_admin">
      <DashboardContent handleLogout={handleLogout} />
    </RoleGate>
  );
}

function DashboardContent({ handleLogout }) {
  const [camps, setCamps] = useState([]);
  const [requests, setRequests] = useState([]);
  const [inventory, setInventory] = useState({ balance: 0, total_in: 0, total_out: 0 });
  const [predictions, setPredictions] = useState({});
  const [loading, setLoading] = useState(true);
  const [allocating, setAllocating] = useState(false);
  const [allocationResult, setAllocationResult] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [totalPeople, setTotalPeople] = useState(0);
  const [time, setTime] = useState('');
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [kitRequests, setKitRequests] = useState([]);
  const [kitResponses, setKitResponses] = useState([]);
  const [ngos, setNgos] = useState([]);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState({ ngo_id: '', kits_requested: '', urgency: 'NORMAL', reason: '', deadline_hours: '' });

  useEffect(() => {
    const tick = () => setTime(new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }));
    tick();
    const id = setInterval(tick, 60000);
    return () => clearInterval(id);
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data: campsData } = await supabase.from('camps').select('*').eq('status', 'active');
      const campsList = campsData || [];
      const headcounts = {};
      let total = 0;
      await Promise.all(campsList.map(async (c) => {
        const { count } = await supabase.from('camp_victims').select('*', { count: 'exact', head: true }).eq('camp_id', c.id);
        // Use real victim count if available, otherwise fall back to demo_headcount
        headcounts[c.id] = (count > 0 ? count : null) ?? c.demo_headcount ?? 0;
        total += headcounts[c.id];
      }));
      setTotalPeople(total);
      setCamps(campsList.map((c) => ({ ...c, headcount: headcounts[c.id] })));
      const reqRes = await fetch('/api/resource-requests?status=pending');
      const reqData = await reqRes.json();
      setRequests(reqData.requests || []);
      const invRes = await fetch('/api/kit-inventory');
      const invData = await invRes.json();
      setInventory(invData);
      
      // Fetch kit requests and NGOs
      const kitReqRes = await fetch('/api/kit-requests');
      const kitReqData = await kitReqRes.json();
      setKitRequests(kitReqData.requests || []);
      
      const ngoRes = await fetch('/api/ngos');
      const ngoData = await ngoRes.json();
      setNgos(ngoData.ngos || []);

      // Fetch pending kit responses
      const kitRespRes = await fetch('/api/kit-responses');
      const kitRespData = await kitRespRes.json();
      setKitResponses(kitRespData.responses || []);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const predictCamp = async (camp) => {
    try {
      const now = new Date();
      const { data: victims } = await supabase.from('camp_victims').select('checked_in_at').eq('camp_id', camp.id);
      const arr1h = (victims || []).filter(v => new Date(v.checked_in_at) >= new Date(now - 3600000)).length;
      const arr3h = (victims || []).filter(v => new Date(v.checked_in_at) >= new Date(now - 10800000)).length;
      const arr6h = (victims || []).filter(v => new Date(v.checked_in_at) >= new Date(now - 21600000)).length;
      const { data: alertRows } = await supabase.from('alerts').select('type, risk').is('resolved_at', null).order('created_at', { ascending: false }).limit(1);
      const alert = alertRows?.[0] || null;
      const res = await fetch('/api/ml/predict', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camp_id: camp.id,
          current_headcount: camp.headcount || camp.demo_headcount || 0,
          alert_risk: camp.demo_risk || alert?.risk || 'MEDIUM',
          alert_type: alert?.type || 'FLOOD',
          arrivals_last_1h: arr1h,
          arrivals_last_3h: arr3h,
          arrivals_last_6h: arr6h,
        }),
      });
      const pred = await res.json();
      // If demo data exists, override predicted headcount with seeded value
      if (camp.demo_predicted) {
        pred.predicted_headcount_24h = camp.demo_predicted;
        pred.phase_name = camp.demo_phase || pred.phase_name;
        pred.features_used = { ...pred.features_used, alert_risk: camp.demo_risk || pred.features_used?.alert_risk };
      }
      return pred;
    } catch (e) { console.error('[predictCamp] failed for', camp.name, e); return null; }
  };

  const runAllPredictions = async () => {
    const preds = {};
    await Promise.all(camps.map(async (c) => { const p = await predictCamp(c); if (p) preds[c.id] = p; }));
    setPredictions(preds);
  };

  const runAllocation = async () => {
    setAllocating(true);
    try {
      if (Object.keys(predictions).length < camps.length) await runAllPredictions();
      const campStates = camps.map((c) => ({
        camp_id: c.id, camp_name: c.name,
        current_headcount: c.headcount || c.demo_headcount || 0,
        predicted_headcount: predictions[c.id]?.predicted_headcount_24h || c.demo_predicted || c.headcount || 0,
        alert_risk: predictions[c.id]?.features_used?.alert_risk || c.demo_risk || 'MEDIUM',
        phase_name: predictions[c.id]?.phase_name || c.demo_phase || 'PLATEAU',
      }));
      const res = await fetch('/api/ml/allocate', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camps: campStates, total_kits_available: inventory.balance, beta: 0.7, buffer_pct: 0.15, triggered_by: 'manual' }),
      });
      const data = await res.json();
      setAllocationResult(data);
      setShowModal(true);
    } catch (e) { console.error(e); }
    setAllocating(false);
  };

  const handleRequest = async (id, status) => {
    await fetch('/api/resource-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    fetchAll();
  };

  const createKitRequest = async () => {
    if (!requestForm.ngo_id || !requestForm.kits_requested) return;
    await fetch('/api/kit-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ngo_id: requestForm.ngo_id,
        kits_requested: parseInt(requestForm.kits_requested),
        urgency: requestForm.urgency,
        reason: requestForm.reason || null,
        deadline_hours: requestForm.deadline_hours ? parseInt(requestForm.deadline_hours) : null
      })
    });
    setRequestForm({ ngo_id: '', kits_requested: '', urgency: 'NORMAL', reason: '', deadline_hours: '' });
    setShowRequestForm(false);
    fetchAll();
  };

  const handleKitRequestStatus = async (id, status) => {
    await fetch('/api/kit-requests', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) });
    fetchAll();
  };

  const handleResponseApproval = async (responseId, action) => {
    await fetch('/api/kit-responses/approve', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json' }, 
      body: JSON.stringify({ response_id: responseId, action }) 
    });
    fetchAll();
  };

  const RISK = {
    HIGH:   { bg: '#FEE2E2', text: '#DC2626', dot: '#EF4444' },
    MEDIUM: { bg: '#FEF3C7', text: '#B45309', dot: '#F59E0B' },
    LOW:    { bg: '#D1FAE5', text: '#065F46', dot: '#10B981' },
  };
  const PHASE = {
    SURGE:     { bg: '#FEF2F2', text: '#DC2626' },
    PLATEAU:   { bg: '#EEF2FF', text: '#1B3676' },
    DEPLETION: { bg: '#F3F4F6', text: '#6B7280' },
  };
  const URGENCY = {
    CRITICAL: { color: '#DC2626', bg: '#FEF2F2', label: 'Critical' },
    LOW:      { color: '#D97706', bg: '#FEF3C7', label: 'Low' },
    OK:       { color: '#059669', bg: '#ECFDF5', label: 'OK' },
  };

  const inventoryPct = inventory.total_in > 0 ? Math.min(100, (inventory.balance / inventory.total_in) * 100) : 0;
  const inventoryColor = inventoryPct > 50 ? '#059669' : inventoryPct > 20 ? '#D97706' : '#DC2626';

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } } @keyframes slideIn { from { transform: translateX(100%); opacity: 0; } to { transform: translateX(0); opacity: 1; } } @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }`}</style>

      {/* ── Nav ── */}
      <header style={s.nav}>
        <div style={s.navLeft}>
          <div style={s.navLogo}>
            <img src="/logo-light.png" alt="Sahaay" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
          </div>
          <span style={s.navRoleBadge}>Super Admin</span>
          <button onClick={() => setDrawerOpen(true)} style={s.modulesBtn}>
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            All Modules
          </button>
        </div>
        <div style={s.navRight}>
          <div style={s.navClock}>
            <span style={s.navClockDot} />
            {time || '--:--'} IST
          </div>
          {requests.length > 0 && (
            <div style={s.navAlertChip}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              {requests.length} Pending
            </div>
          )}
          <div style={{ width: 1, height: 24, background: '#E2E8F0', margin: '0 8px' }} />
          <div style={s.navActions}>
            <a href="/" style={s.homeLink}>← Home</a>
            <button onClick={handleLogout} style={s.logoutBtn}>Logout</button>
          </div>
        </div>
      </header>

      {/* ── Body ── */}
      <div style={s.body}>

        {/* Page title */}
        <div style={s.pageHead}>
          <div>
            <p style={s.pageEyebrow}>Super Admin · Command Center</p>
            <h1 style={s.pageTitle}>Operations Dashboard</h1>
          </div>
          <div style={s.pageHeadActions}>
            <button onClick={() => setShowRequestForm(true)} style={s.btnSecondary}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
              Request Kits from NGOs
            </button>
            <button onClick={runAllPredictions} disabled={loading} style={s.btnSecondary}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Run Predictions
            </button>
            <button onClick={runAllocation} disabled={allocating || inventory.balance <= 0 || loading} style={{ ...s.btnPrimary, opacity: (allocating || inventory.balance <= 0) ? 0.6 : 1 }}>
              {allocating ? (
                <><span style={s.spinner} /> Allocating…</>
              ) : (
                <><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> Run Smart Allocation</>
              )}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={s.loadingWrap}>
            <div style={s.loadingSpinner} />
            <p style={s.loadingText}>Loading operational data…</p>
          </div>
        ) : (
          <>
            {/* Stats row */}
            <div style={s.statsRow}>
              <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#1B3676" strokeWidth="2"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>} value={inventory.balance.toLocaleString('en-IN')} label="Kit Inventory" bg="#EEF2FF" accent="#1B3676" />
              <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>} value={camps.length} label="Active Camps" bg="#F5F3FF" accent="#7C3AED" />
              <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>} value={totalPeople.toLocaleString('en-IN')} label="Total People" bg="#ECFDF5" accent="#059669" />
              <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={requests.length > 0 ? '#DC2626' : '#6B7280'} strokeWidth="2"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>} value={requests.length} label="Pending Requests" bg={requests.length > 0 ? '#FEF2F2' : '#F3F4F6'} accent={requests.length > 0 ? '#DC2626' : '#6B7280'} urgent={requests.length > 0} />
            </div>
            {/* ── Two-column layout ── */}
            <div style={s.twoCol}>

              {/* ─ MAIN ─ */}
              <div style={s.main}>

                {/* Inventory gauge */}
                <div style={s.card}>
                  <div style={s.cardHead}>
                    <h2 style={s.cardTitle}>Inventory Overview</h2>
                    <span style={s.cardMeta}>IN: {inventory.total_in.toLocaleString('en-IN')} · OUT: {inventory.total_out.toLocaleString('en-IN')}</span>
                  </div>
                  <div style={s.gaugeBar}>
                    <div style={{ ...s.gaugeFill, width: `${inventoryPct}%`, background: inventoryColor }} />
                  </div>
                  <div style={s.gaugeFooter}>
                    <span style={{ ...s.gaugeLabel, color: inventoryColor }}>{inventory.balance.toLocaleString('en-IN')} kits remaining</span>
                    <span style={s.gaugeLabel}>{inventoryPct.toFixed(1)}% of total received</span>
                  </div>
                  {inventory.balance < 500 && (
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#FEF3C7', border: '1px solid #FDE68A', borderRadius: 8, fontSize: 13, color: '#B45309' }}>
                      ⚠️ Low inventory detected. Consider requesting more kits from NGOs.
                    </div>
                  )}
                </div>

                {/* Kit Requests from NGOs */}
                <div style={s.card}>
                  <div style={s.cardHead}>
                    <h2 style={s.cardTitle}>Kit Requests to NGOs</h2>
                    <span style={s.cardMeta}>{kitRequests.filter(r => r.status === 'PENDING').length} pending</span>
                  </div>
                  {kitRequests.length === 0 ? (
                    <div style={s.emptyTable}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                      <span>No kit requests sent yet</span>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            {['NGO', 'Kits Requested', 'Urgency', 'Status', 'Responses', 'Date', 'Actions'].map(h => (
                              <th key={h} style={s.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {kitRequests.map((req) => {
                            const urgencyColors = {
                              CRITICAL: { bg: '#FEF2F2', text: '#DC2626' },
                              HIGH: { bg: '#FEF3C7', text: '#B45309' },
                              NORMAL: { bg: '#EFF6FF', text: '#2563EB' },
                              LOW: { bg: '#F3F4F6', text: '#6B7280' }
                            };
                            const statusColors = {
                              PENDING: { bg: '#FEF3C7', text: '#B45309' },
                              ACCEPTED: { bg: '#EFF6FF', text: '#2563EB' },
                              FULFILLED: { bg: '#ECFDF5', text: '#059669' },
                              REJECTED: { bg: '#FEF2F2', text: '#DC2626' },
                              CANCELLED: { bg: '#F3F4F6', text: '#6B7280' }
                            };
                            const uc = urgencyColors[req.urgency] || urgencyColors.NORMAL;
                            const sc = statusColors[req.status] || statusColors.PENDING;
                            const responses = req.kit_responses || [];
                            return (
                              <tr key={req.id} style={s.tr}>
                                <td style={s.td}><span style={s.tdBold}>{req.ngos?.name || 'Unknown NGO'}</span></td>
                                <td style={s.td}><span style={{ ...s.tdBold, color: '#1B3676' }}>{req.kits_requested}</span></td>
                                <td style={s.td}><span style={{ ...s.badge, background: uc.bg, color: uc.text }}>{req.urgency}</span></td>
                                <td style={s.td}><span style={{ ...s.badge, background: sc.bg, color: sc.text }}>{req.status}</span></td>
                                <td style={s.td}>{responses.length > 0 ? `${responses.length} response${responses.length > 1 ? 's' : ''}` : '—'}</td>
                                <td style={s.td}>{new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                                <td style={s.td}>
                                  {req.status === 'PENDING' && (
                                    <button onClick={() => handleKitRequestStatus(req.id, 'CANCELLED')} style={s.actionReject} title="Cancel">
                                      Cancel
                                    </button>
                                  )}
                                  {responses.length > 0 && (
                                    <span style={{ fontSize: 12, color: '#059669' }}>
                                      {responses.reduce((sum, r) => sum + (r.kits_offered || 0), 0)} kits offered
                                    </span>
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

                {/* Camp grid */}
                <div style={s.card}>
                  <div style={s.cardHead}>
                    <h2 style={s.cardTitle}>Camp Status Grid</h2>
                    <span style={s.cardMeta}>{camps.length} active camps</span>
                  </div>
                  <div style={s.campGrid}>
                    {camps.map((c) => {
                      const pred = predictions[c.id];
                      const risk = pred?.features_used?.alert_risk || 'MEDIUM';
                      const phase = pred?.phase_name || '—';
                      const urgencyKey = pred?.predicted_headcount_24h > c.headcount * 1.3 ? 'CRITICAL' : pred?.predicted_headcount_24h < c.headcount * 0.8 ? 'LOW' : 'OK';
                      const u = URGENCY[urgencyKey];
                      const r = RISK[risk] || RISK.MEDIUM;
                      const p = PHASE[phase] || PHASE.PLATEAU;
                      return (
                        <div key={c.id} style={s.campCard}>
                          <div style={s.campCardTop}>
                            <div>
                              <p style={s.campName}>{c.name}</p>
                              <p style={s.campOperator}>{c.operator_name || 'No operator'}</p>
                            </div>
                            <div style={{ ...s.urgencyPill, background: u.bg, color: u.color }}>{u.label}</div>
                          </div>
                          <div style={s.campStats}>
                            <div style={s.campStat}>
                              <p style={s.campStatLabel}>Current</p>
                              <p style={s.campStatVal}>{c.headcount}</p>
                            </div>
                            <div style={s.campStatDivider} />
                            <div style={s.campStat}>
                              <p style={s.campStatLabel}>Predicted 24h</p>
                              <p style={{ ...s.campStatVal, color: pred ? '#059669' : '#9CA3AF' }}>
                                {pred?.predicted_headcount_24h ?? '—'}
                              </p>
                            </div>
                          </div>
                          <div style={s.campBadges}>
                            <span style={{ ...s.badge, background: r.bg, color: r.text }}>{risk}</span>
                            <span style={{ ...s.badge, background: p.bg, color: p.text }}>{phase}</span>
                          </div>
                        </div>
                      );
                    })}
                    {camps.length === 0 && (
                      <div style={s.emptyCell}>No active camps found</div>
                    )}
                  </div>
                </div>

                {/* NGO Responses Awaiting Approval */}
                <div style={s.card}>
                  <div style={s.cardHead}>
                    <h2 style={s.cardTitle}>NGO Responses Awaiting Approval</h2>
                    <span style={s.cardMeta}>{kitResponses.filter(r => r.status === 'PENDING').length} pending</span>
                  </div>
                  {kitResponses.filter(r => r.status === 'PENDING').length === 0 ? (
                    <div style={s.emptyTable}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                      <span>No responses awaiting approval</span>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            {['NGO', 'Original Request', 'Kits Offered', 'Delivery', 'Cost/Kit', 'Notes', 'Actions'].map(h => (
                              <th key={h} style={s.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {kitResponses.filter(r => r.status === 'PENDING').map((resp) => (
                            <tr key={resp.id} style={s.tr}>
                              <td style={s.td}><span style={s.tdBold}>{resp.ngos?.name || 'Unknown NGO'}</span></td>
                              <td style={s.td}>{resp.kit_requests?.kits_requested || '—'} kits requested</td>
                              <td style={s.td}><span style={{ ...s.tdBold, color: '#059669' }}>{resp.kits_offered}</span></td>
                              <td style={s.td}>{resp.estimated_delivery_days ? `${resp.estimated_delivery_days} days` : '—'}</td>
                              <td style={s.td}>{resp.cost_per_kit ? `₹${resp.cost_per_kit}` : '—'}</td>
                              <td style={{ ...s.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{resp.notes || '—'}</td>
                              <td style={s.td}>
                                <div style={s.actionBtns}>
                                  <button onClick={() => handleResponseApproval(resp.id, 'approve')} style={s.actionApprove} title="Approve & Add to Inventory">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                    Approve
                                  </button>
                                  <button onClick={() => handleResponseApproval(resp.id, 'reject')} style={s.actionReject} title="Reject">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Requests table */}
                <div style={s.card}>
                  <div style={s.cardHead}>
                    <h2 style={s.cardTitle}>Pending Resource Requests</h2>
                    {requests.length > 0 && <span style={{ ...s.cardMeta, color: '#DC2626', fontWeight: 600 }}>{requests.length} pending</span>}
                  </div>
                  {requests.length === 0 ? (
                    <div style={s.emptyTable}>
                      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.8"><path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span>No pending requests</span>
                    </div>
                  ) : (
                    <div style={{ overflowX: 'auto' }}>
                      <table style={s.table}>
                        <thead>
                          <tr>
                            {['Camp', 'Headcount', 'Kits Requested', 'Notes', 'Date', 'Actions'].map(h => (
                              <th key={h} style={s.th}>{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {requests.map((r) => (
                            <tr key={r.id} style={s.tr}>
                              <td style={s.td}><span style={s.tdBold}>{r.camps?.name || r.camp_id}</span></td>
                              <td style={s.td}>{r.current_headcount}</td>
                              <td style={s.td}><span style={{ ...s.tdBold, color: '#1B3676' }}>{r.min_kits_needed}</span></td>
                              <td style={{ ...s.td, maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.notes || '—'}</td>
                              <td style={s.td}>{new Date(r.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}</td>
                              <td style={s.td}>
                                <div style={s.actionBtns}>
                                  <button onClick={() => handleRequest(r.id, 'acknowledged')} style={s.actionApprove} title="Approve">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                                    Approve
                                  </button>
                                  <button onClick={() => handleRequest(r.id, 'rejected')} style={s.actionReject} title="Reject">
                                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                                    Reject
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>

              {/* ─ SIDEBAR ─ */}
              <aside style={s.sidebar}>

                {/* Allocation CTA */}
                <div style={s.sideAllocationCard}>
                  <p style={s.sideAllocEye}>ML-Powered</p>
                  <p style={s.sideAllocTitle}>Smart Kit Allocation</p>
                  <p style={s.sideAllocDesc}>Uses predicted headcounts, risk levels, and arrival rates to optimally distribute kits across all camps.</p>
                  {inventory.balance <= 0 && (
                    <div style={{ background: 'rgba(255,255,255,0.15)', borderRadius: 8, padding: '10px 12px', marginBottom: 10, fontSize: 12, lineHeight: 1.5 }}>
                      ⚠️ No kits in inventory. Add kits via NGO Management to enable allocation.
                    </div>
                  )}
                  <button onClick={runAllocation} disabled={allocating || inventory.balance <= 0} style={{ ...s.sideAllocBtn, opacity: (allocating || inventory.balance <= 0) ? 0.6 : 1 }}>
                    {allocating ? 'Running…' : inventory.balance <= 0 ? 'No Inventory' : 'Run Allocation →'}
                  </button>
                </div>

                {/* Inventory summary */}
                <div style={s.sideCard}>
                  <div style={s.sideCardHead}>
                    <span style={s.sideCardTitle}>Inventory Status</span>
                    <span style={{ ...s.sideCardBadge, background: inventoryColor === '#059669' ? '#ECFDF5' : inventoryColor === '#D97706' ? '#FEF3C7' : '#FEF2F2', color: inventoryColor }}>
                      {inventoryPct.toFixed(0)}%
                    </span>
                  </div>
                  <div style={s.sideStat}><span style={s.sideStatLabel}>Available</span><span style={{ ...s.sideStatVal, color: '#1B3676' }}>{inventory.balance.toLocaleString('en-IN')}</span></div>
                  <div style={s.sideDivider} />
                  <div style={s.sideStat}><span style={s.sideStatLabel}>Total In</span><span style={{ ...s.sideStatVal, color: '#059669' }}>{inventory.total_in.toLocaleString('en-IN')}</span></div>
                  <div style={s.sideDivider} />
                  <div style={s.sideStat}><span style={s.sideStatLabel}>Total Out</span><span style={{ ...s.sideStatVal, color: '#6B7280' }}>{inventory.total_out.toLocaleString('en-IN')}</span></div>
                </div>

                {/* Camp summary */}
                <div style={s.sideCard}>
                  <div style={s.sideCardHead}>
                    <span style={s.sideCardTitle}>Predictions</span>
                    <span style={s.sideCardMeta}>{Object.keys(predictions).length}/{camps.length} run</span>
                  </div>
                  {camps.slice(0, 5).map(c => {
                    const pred = predictions[c.id];
                    const pct = c.headcount > 0 && pred ? Math.round(((pred.predicted_headcount_24h - c.headcount) / c.headcount) * 100) : null;
                    return (
                      <div key={c.id} style={s.campSideRow}>
                        <span style={s.campSideName}>{c.name}</span>
                        <span style={{ fontSize: 12, fontWeight: 600, color: pct === null ? '#9CA3AF' : pct > 20 ? '#DC2626' : pct < -10 ? '#059669' : '#D97706' }}>
                          {pct === null ? '—' : `${pct > 0 ? '+' : ''}${pct}%`}
                        </span>
                      </div>
                    );
                  })}
                  {camps.length > 5 && <p style={{ fontSize: 12, color: '#9CA3AF', margin: '8px 0 0', textAlign: 'center' }}>+{camps.length - 5} more camps</p>}
                  {Object.keys(predictions).length === 0 && <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: '4px 0 0' }}>Run predictions to see 24h forecasts</p>}
                </div>
              </aside>
            </div>
          </>
        )}
      </div>

      {/* ── Allocation Modal ── */}
      {showModal && allocationResult && (
        <div style={s.modalOverlay} onClick={() => setShowModal(false)}>
          <div style={s.modal} onClick={e => e.stopPropagation()}>
            <div style={s.modalStripe} />
            <div style={s.modalBody}>
              <div style={s.modalHead}>
                <div>
                  <p style={s.modalEyebrow}>Round #{allocationResult.round_number}</p>
                  <h2 style={s.modalTitle}>Allocation Result</h2>
                </div>
                <button onClick={() => setShowModal(false)} style={s.modalClose}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div style={s.modalStats}>
                <div style={s.modalStat}>
                  <p style={s.modalStatVal}>{allocationResult.total_kits_dispatched}</p>
                  <p style={s.modalStatLabel}>Kits Dispatched</p>
                </div>
                <div style={s.modalStatDivider} />
                <div style={s.modalStat}>
                  <p style={s.modalStatVal}>{allocationResult.reserve_kits}</p>
                  <p style={s.modalStatLabel}>Reserve Kept</p>
                </div>
                <div style={s.modalStatDivider} />
                <div style={s.modalStat}>
                  <p style={s.modalStatVal}>{(allocationResult.allocations || []).length}</p>
                  <p style={s.modalStatLabel}>Camps Served</p>
                </div>
              </div>

              <div style={{ overflowX: 'auto', maxHeight: 360 }}>
                <table style={s.table}>
                  <thead>
                    <tr>
                      {['Camp', 'Current', 'Predicted', 'Kits', 'Per Person', 'Urgency'].map(h => (
                        <th key={h} style={s.th}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {(allocationResult.allocations || []).map((a) => {
                      const u = { CRITICAL: { color: '#DC2626', bg: '#FEF2F2', label: 'Critical' }, LOW: { color: '#D97706', bg: '#FEF3C7', label: 'Low' }, OK: { color: '#059669', bg: '#ECFDF5', label: 'OK' } }[a.urgency] || { color: '#6B7280', bg: '#F3F4F6', label: a.urgency };
                      return (
                        <tr key={a.camp_id} style={s.tr}>
                          <td style={s.td}><span style={s.tdBold}>{a.camp_name || a.camp_id}</span></td>
                          <td style={s.td}>{a.current_headcount}</td>
                          <td style={s.td}>{a.predicted_headcount}</td>
                          <td style={s.td}><span style={{ ...s.tdBold, color: '#1B3676' }}>{a.kits_allocated}</span></td>
                          <td style={s.td}>{a.kits_per_person_at_delivery}</td>
                          <td style={s.td}><span style={{ ...s.badge, background: u.bg, color: u.color }}>{u.label}</span></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              <div style={s.modalFooter}>
                <button onClick={() => setShowModal(false)} style={s.btnSecondary}>Close</button>
                <button onClick={() => { setShowModal(false); fetchAll(); }} style={s.btnPrimary}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                  Confirm & Refresh
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Kit Request Form Modal ── */}
      {showRequestForm && (
        <div style={s.modalOverlay} onClick={() => setShowRequestForm(false)}>
          <div style={{ ...s.modal, maxWidth: 500 }} onClick={e => e.stopPropagation()}>
            <div style={s.modalStripe} />
            <div style={s.modalBody}>
              <div style={s.modalHead}>
                <div>
                  <p style={s.modalEyebrow}>NGO Kit Request</p>
                  <h2 style={s.modalTitle}>Request Kits from NGO</h2>
                </div>
                <button onClick={() => setShowRequestForm(false)} style={s.modalClose}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
              </div>

              <div style={{ display: 'grid', gap: 16 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Select NGO *</label>
                  <select value={requestForm.ngo_id} onChange={e => setRequestForm({ ...requestForm, ngo_id: e.target.value })} style={{ ...s.input, width: '100%' }}>
                    <option value="">Choose an NGO...</option>
                    {ngos.map(ngo => (
                      <option key={ngo.id} value={ngo.id}>{ngo.name}</option>
                    ))}
                  </select>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Kits Needed *</label>
                    <input type="number" value={requestForm.kits_requested} onChange={e => setRequestForm({ ...requestForm, kits_requested: e.target.value })} style={s.input} placeholder="e.g. 500" />
                  </div>
                  <div>
                    <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Urgency</label>
                    <select value={requestForm.urgency} onChange={e => setRequestForm({ ...requestForm, urgency: e.target.value })} style={s.input}>
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="CRITICAL">Critical</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Reason</label>
                  <textarea value={requestForm.reason} onChange={e => setRequestForm({ ...requestForm, reason: e.target.value })} style={{ ...s.input, minHeight: 80, resize: 'vertical' }} placeholder="Why are these kits needed?" />
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Deadline (hours from now)</label>
                  <input type="number" value={requestForm.deadline_hours} onChange={e => setRequestForm({ ...requestForm, deadline_hours: e.target.value })} style={s.input} placeholder="e.g. 48" />
                </div>
              </div>

              <div style={s.modalFooter}>
                <button onClick={() => setShowRequestForm(false)} style={s.btnSecondary}>Cancel</button>
                <button onClick={createKitRequest} disabled={!requestForm.ngo_id || !requestForm.kits_requested} style={{ ...s.btnPrimary, opacity: (!requestForm.ngo_id || !requestForm.kits_requested) ? 0.6 : 1 }}>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                  Send Request
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* ── Modules Drawer ── */}
      {drawerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setDrawerOpen(false)}
            style={{ position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.45)', backdropFilter: 'blur(2px)', zIndex: 300, animation: 'fadeIn 0.2s ease' }}
          />
          {/* Drawer panel */}
          <div style={{ position: 'fixed', top: 0, right: 0, bottom: 0, width: 340, background: 'white', zIndex: 400, boxShadow: '-8px 0 40px rgba(0,0,0,0.15)', display: 'flex', flexDirection: 'column', animation: 'slideIn 0.25s ease', fontFamily: FONT }}>
            {/* Drawer header */}
            <div style={{ padding: '20px 24px 16px', borderBottom: '1px solid #E2E8F0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <p style={{ fontSize: 11, fontWeight: 700, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 3px' }}>Super Admin</p>
                <h2 style={{ fontSize: 18, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.4px' }}>Operations Modules</h2>
              </div>
              <button onClick={() => setDrawerOpen(false)} style={{ width: 34, height: 34, borderRadius: 9, background: '#F1F5F9', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            {/* Drawer links */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              {[
                { href: '/super-admin/ngos',              label: 'NGO Management',    desc: 'Register NGOs · assign kits · track fundraising & production pipeline', color: '#7C3AED', bg: '#F5F3FF', border: '#DDD6FE', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg> },
                { href: '/super-admin/safe-zones',         label: 'Safe Zones',         desc: 'Map relief camps · flag danger zones · get AI migration recommendations', color: '#059669', bg: '#ECFDF5', border: '#A7F3D0', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><polygon points="1 6 1 22 8 18 16 22 23 18 23 2 16 6 8 2 1 6"/><line x1="8" y1="2" x2="8" y2="18"/><line x1="16" y1="6" x2="16" y2="22"/></svg> },
                { href: '/super-admin/sms-alerts',         label: 'SMS Broadcast',      desc: 'Send emergency SMS via Twilio · target by camp, area, or all users', color: '#DC2626', bg: '#FEF2F2', border: '#FECACA', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#DC2626" strokeWidth="2"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg> },
                { href: '/super-admin/simulate',           label: 'Simulation',         desc: 'Trigger test disaster scenarios · validate the full alert pipeline', color: '#D97706', bg: '#FEF3C7', border: '#FDE68A', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> },
                { href: '/super-admin/allocation-history', label: 'Allocation History', desc: 'Full log of past allocation rounds · dispatch orders · delivery status', color: '#1B3676', bg: '#EEF2FF', border: '#C7D2FE', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#1B3676" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg> },
              ].map(m => (
                <Link key={m.href} href={m.href} onClick={() => setDrawerOpen(false)}
                  style={{ display: 'flex', gap: 14, alignItems: 'flex-start', padding: '14px 16px', background: m.bg, border: `1px solid ${m.border}`, borderRadius: 12, textDecoration: 'none' }}>
                  <div style={{ width: 42, height: 42, borderRadius: 10, background: 'white', border: `1px solid ${m.border}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, boxShadow: '0 1px 4px rgba(0,0,0,0.06)' }}>{m.icon}</div>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 14.5, fontWeight: 700, color: m.color, margin: '0 0 4px' }}>{m.label}</p>
                    <p style={{ fontSize: 12.5, color: '#6B7280', margin: 0, lineHeight: 1.5 }}>{m.desc}</p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={m.color} strokeWidth="2.5" style={{ flexShrink: 0, marginTop: 4, opacity: 0.6 }}><polyline points="9 18 15 12 9 6"/></svg>
                </Link>
              ))}
            </div>
            {/* Drawer footer */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #E2E8F0', background: '#F8FAFC' }}>
              <p style={{ fontSize: 12, color: '#9CA3AF', margin: 0, textAlign: 'center' }}>Click any module to navigate · Press Esc or click outside to close</p>
            </div>
          </div>
        </>
      )}

    </div>
  );
}

function StatCard({ icon, value, label, bg, accent, urgent }) {
  return (
    <div style={{ background: bg, border: `1px solid ${urgent ? '#FECACA' : '#E2E8F0'}`, borderRadius: 12, padding: '16px', display: 'flex', alignItems: 'center', gap: 14 }}>
      <div style={{ width: 40, height: 40, borderRadius: 9, background: 'white', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
        {icon}
      </div>
      <div>
        <p style={{ fontSize: 22, fontWeight: 800, color: urgent ? '#DC2626' : '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>{value}</p>
        <p style={{ fontSize: 11.5, color: '#6B7280', margin: '1px 0 0', fontWeight: 500 }}>{label}</p>
      </div>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT, color: '#111827' },

  nav: { background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 28px', height: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 200, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  navLeft: { display: 'flex', alignItems: 'center', gap: 32 },
  navLogo: { display: 'flex', alignItems: 'center', gap: 9 },
  navLogoText: { fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  navRoleBadge: { fontSize: 11, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', padding: '2px 8px', borderRadius: 20, letterSpacing: '0.3px' },
  navLinks: { display: 'flex', gap: 2 },
  navLink: { fontSize: 13, color: '#6B7280', padding: '5px 10px', borderRadius: 6, textDecoration: 'none', fontWeight: 500 },
  modulesBtn: { display: 'flex', alignItems: 'center', gap: 7, padding: '8px 16px', background: '#F5F3FF', border: '1px solid #DDD6FE', borderRadius: 8, color: '#7C3AED', fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navClock: { display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: '#6B7280', fontVariantNumeric: 'tabular-nums' },
  navClockDot: { width: 6, height: 6, borderRadius: '50%', background: '#22C55E' },
  navAlertChip: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 12.5, fontWeight: 600, color: '#DC2626', background: '#FEF2F2', border: '1px solid #FECACA', padding: '4px 10px', borderRadius: 20 },
  
  navActions: { display: 'flex', gap: 8, alignItems: 'center' },
  homeLink: {
    fontSize: 13, fontWeight: 500, color: '#6B7280',
    textDecoration: 'none', padding: '6px 10px',
    borderRadius: 8, border: '1px solid #E2E8F0',
    background: 'white',
  },
  logoutBtn: {
    background: '#FEF2F2', border: '1px solid #FECACA', color: '#DC2626',
    padding: '6px 14px', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer',
  },

  body: { maxWidth: 1320, margin: '0 auto', padding: '28px 28px 48px' },

  pageHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 22 },
  pageEyebrow: { fontSize: 11, fontWeight: 600, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  pageTitle: { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' },
  pageHeadActions: { display: 'flex', gap: 10 },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 22 },

  twoCol: { display: 'grid', gridTemplateColumns: '1fr 300px', gap: 20, alignItems: 'start' },
  main: { display: 'flex', flexDirection: 'column', gap: 18 },
  sidebar: { display: 'flex', flexDirection: 'column', gap: 14 },

  card: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 13, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 },
  cardMeta: { fontSize: 12.5, color: '#9CA3AF' },

  gaugeBar: { height: 10, background: '#F1F5F9', borderRadius: 6, overflow: 'hidden', marginBottom: 8 },
  gaugeFill: { height: '100%', borderRadius: 6, transition: 'width 0.5s ease' },
  gaugeFooter: { display: 'flex', justifyContent: 'space-between' },
  gaugeLabel: { fontSize: 12.5, color: '#6B7280' },

  campGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 },
  campCard: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 11, padding: '14px 14px' },
  campCardTop: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 },
  campName: { fontSize: 13.5, fontWeight: 700, color: '#0F172A', margin: 0 },
  campOperator: { fontSize: 11.5, color: '#9CA3AF', margin: '2px 0 0' },
  urgencyPill: { fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 20, whiteSpace: 'nowrap' },
  campStats: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 10 },
  campStat: {},
  campStatLabel: { fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.4px', margin: '0 0 1px' },
  campStatVal: { fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' },
  campStatDivider: { width: 1, height: 32, background: '#E2E8F0', flexShrink: 0 },
  campBadges: { display: 'flex', gap: 6 },
  badge: { fontSize: 11, fontWeight: 700, padding: '2px 8px', borderRadius: 5, textTransform: 'uppercase', letterSpacing: '0.3px' },
  emptyCell: { gridColumn: '1/-1', textAlign: 'center', padding: 28, fontSize: 13.5, color: '#9CA3AF' },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', borderBottom: '2px solid #F1F5F9', whiteSpace: 'nowrap' },
  tr: { borderBottom: '1px solid #F8FAFC' },
  td: { padding: '11px 12px', color: '#475569', fontSize: 13.5 },
  tdBold: { fontWeight: 700, color: '#111827' },
  actionBtns: { display: 'flex', gap: 6 },
  actionApprove: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 7, color: '#059669', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT },
  actionReject: { display: 'flex', alignItems: 'center', gap: 4, padding: '5px 10px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 7, color: '#DC2626', fontSize: 12, fontWeight: 600, cursor: 'pointer', fontFamily: FONT },
  emptyTable: { display: 'flex', alignItems: 'center', gap: 8, color: '#9CA3AF', fontSize: 13.5, padding: '8px 0' },

  btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 18px', background: 'linear-gradient(135deg, #1B3676, #2A5298)', color: 'white', border: 'none', borderRadius: 9, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, boxShadow: '0 2px 8px rgba(27,54,118,0.25)', transition: 'opacity 0.15s' },
  btnSecondary: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'white', color: '#374151', border: '1px solid #E2E8F0', borderRadius: 9, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT },
  spinner: { width: 15, height: 15, border: '2.5px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%', animation: 'spin 0.7s linear infinite', display: 'inline-block', flexShrink: 0 },

  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '80px 0', gap: 14 },
  loadingSpinner: { width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#1B3676', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText: { fontSize: 14, color: '#9CA3AF', margin: 0 },

  /* Sidebar */
  sideAllocationCard: { background: 'linear-gradient(135deg, #1B3676, #2A5298)', borderRadius: 13, padding: '18px 18px', color: 'white', boxShadow: '0 4px 12px rgba(27,54,118,0.15)' },
  sideAllocEye: { fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', opacity: 0.7, margin: '0 0 5px' },
  sideAllocTitle: { fontSize: 15.5, fontWeight: 700, margin: '0 0 7px', lineHeight: 1.3 },
  sideAllocDesc: { fontSize: 12.5, opacity: 0.85, lineHeight: 1.55, margin: '0 0 14px' },
  sideAllocBtn: { display: 'inline-block', background: 'white', color: '#1B3676', fontSize: 13.5, fontWeight: 700, padding: '8px 16px', borderRadius: 8, border: 'none', cursor: 'pointer', fontFamily: FONT, width: '100%', textAlign: 'center', transition: 'opacity 0.15s' },

  sideCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '16px', boxShadow: '0 1px 3px rgba(0,0,0,0.04)' },
  sideCardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  sideCardTitle: { fontSize: 13.5, fontWeight: 700, color: '#0F172A' },
  sideCardBadge: { fontSize: 12, fontWeight: 700, padding: '2px 8px', borderRadius: 20 },
  sideCardMeta: { fontSize: 12, color: '#9CA3AF' },
  sideStat: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '5px 0' },
  sideStatLabel: { fontSize: 13, color: '#6B7280' },
  sideStatVal: { fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px' },
  sideDivider: { height: 1, background: '#F1F5F9', margin: '2px 0' },
  campSideRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F8FAFC' },
  campSideName: { fontSize: 12.5, color: '#374151', fontWeight: 500 },
  sideLink: { display: 'flex', alignItems: 'center', gap: 7, fontSize: 13.5, color: '#374151', textDecoration: 'none', padding: '7px 0', borderBottom: '1px solid #F8FAFC', fontWeight: 500 },

  moduleGrid: { display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 12, marginBottom: 22 },
  moduleCard: { background: 'white', border: '1px solid', borderRadius: 12, padding: '18px 16px', textDecoration: 'none', display: 'flex', flexDirection: 'column', gap: 6, position: 'relative', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', transition: 'box-shadow 0.15s' },
  moduleCardIcon: { width: 44, height: 44, borderRadius: 11, display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: 4 },
  moduleCardLabel: { fontSize: 13.5, fontWeight: 800, margin: 0, letterSpacing: '-0.2px' },
  moduleCardDesc: { fontSize: 11.5, color: '#9CA3AF', margin: 0, lineHeight: 1.45 },
  moduleCardArrow: { position: 'absolute', top: 16, right: 14 },
  moduleIconWrap: { width: 32, height: 32, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  moduleLabel: { fontSize: 13, fontWeight: 700, margin: '0 0 1px' },
  moduleDesc: { fontSize: 11.5, color: '#9CA3AF', margin: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },

  /* Modal */
  modalOverlay: { position: 'fixed', inset: 0, background: 'rgba(15,23,42,0.5)', backdropFilter: 'blur(2px)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20 },
  modal: { background: 'white', borderRadius: 16, border: '1px solid #E2E8F0', maxWidth: 860, width: '100%', maxHeight: '90vh', overflow: 'auto', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' },
  modalStripe: { height: 4, background: 'linear-gradient(90deg, #4F46E5, #2563EB, #60A5FA)', borderRadius: '16px 16px 0 0' },
  modalBody: { padding: '24px 28px 28px' },
  modalHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 },
  modalEyebrow: { fontSize: 11, fontWeight: 600, color: '#1B3676', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  modalTitle: { fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.4px' },
  modalClose: { background: '#F1F5F9', border: 'none', borderRadius: 8, width: 32, height: 32, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280', flexShrink: 0 },
  modalStats: { display: 'flex', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 20px', marginBottom: 18, alignItems: 'center' },
  modalStat: { flex: 1, textAlign: 'center' },
  modalStatVal: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: '0 0 2px', letterSpacing: '-0.5px' },
  modalStatLabel: { fontSize: 12, color: '#9CA3AF', margin: 0, fontWeight: 500 },
  modalStatDivider: { width: 1, height: 36, background: '#E2E8F0', flexShrink: 0 },
  modalFooter: { display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 20, paddingTop: 16, borderTop: '1px solid #F1F5F9' },

  input: { padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8, background: 'white', color: '#111827', fontSize: 14, outline: 'none', fontFamily: FONT, boxSizing: 'border-box' },
};