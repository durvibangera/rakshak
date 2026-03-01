/**
 * FILE: page.js (Camp Admin — Request Resources)
 * PURPOSE: Camp admin page to request kits from Super Admin with ML predictions.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';

export default function RequestResourcesPage() {
  return (
    <RoleGate minRole="camp_admin">
      <RequestResourcesContent />
    </RoleGate>
  );
}

function RequestResourcesContent() {
  const { profile, campId } = useAuth();
  const [headcount, setHeadcount] = useState(0);
  const [prediction, setPrediction] = useState(null);
  const [predLoading, setPredLoading] = useState(false);
  const [notes, setNotes] = useState('');
  const [customKits, setCustomKits] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [pastRequests, setPastRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [campInfo, setCampInfo] = useState(null);

  const effectiveCampId = campId || profile?.camp_id;

  const fetchData = useCallback(async () => {
    if (!effectiveCampId) return;
    setLoading(true);
    try {
      // Get camp info
      const { data: camp } = await supabase.from('camps').select('*').eq('id', effectiveCampId).single();
      setCampInfo(camp);

      // Get headcount
      const { count } = await supabase
        .from('camp_victims')
        .select('*', { count: 'exact', head: true })
        .eq('camp_id', effectiveCampId);
      setHeadcount(count || 0);

      // Get past requests
      const res = await fetch(`/api/resource-requests?camp_id=${effectiveCampId}`);
      const data = await res.json();
      setPastRequests(data.requests || []);
    } catch (e) {
      console.error(e);
    }
    setLoading(false);
  }, [effectiveCampId]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const runPrediction = async () => {
    if (!effectiveCampId) return;
    setPredLoading(true);
    try {
      // Get arrival data
      const now = new Date();
      const { data: victims } = await supabase
        .from('camp_victims')
        .select('checked_in_at')
        .eq('camp_id', effectiveCampId);

      const arr1h = (victims || []).filter(v => new Date(v.checked_in_at) >= new Date(now - 3600000)).length;
      const arr3h = (victims || []).filter(v => new Date(v.checked_in_at) >= new Date(now - 10800000)).length;
      const arr6h = (victims || []).filter(v => new Date(v.checked_in_at) >= new Date(now - 21600000)).length;

      // Get alert risk
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
          camp_id: effectiveCampId,
          current_headcount: headcount,
          alert_risk: alert?.risk || 'MEDIUM',
          alert_type: alert?.type || 'FLOOD',
          arrivals_last_1h: arr1h,
          arrivals_last_3h: arr3h,
          arrivals_last_6h: arr6h,
        }),
      });
      const data = await res.json();
      setPrediction(data);
    } catch (e) {
      console.error(e);
    }
    setPredLoading(false);
  };

  const submitRequest = async () => {
    if (!effectiveCampId) return;
    setSubmitting(true);
    try {
      const kits = parseInt(customKits) || Math.ceil(headcount * 0.8);
      await fetch('/api/resource-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camp_id: effectiveCampId,
          requested_by: profile?.id,
          min_kits_needed: kits,
          current_headcount: headcount,
          notes: notes || null,
        }),
      });
      setSubmitted(true);
      setNotes('');
      setCustomKits('');
      fetchData();
    } catch (e) {
      console.error(e);
    }
    setSubmitting(false);
  };

  const minKits = Math.ceil(headcount * 0.8);
  const recommendedKits = prediction ? Math.ceil(prediction.predicted_headcount_24h * 0.8) : minKits;

  const STATUS_BADGE = {
    pending: { bg: '#FEF3C7', color: '#92400E', label: 'Pending' },
    acknowledged: { bg: '#DBEAFE', color: '#1E40AF', label: 'Acknowledged' },
    fulfilled: { bg: '#D1FAE5', color: '#065F46', label: 'Fulfilled' },
    rejected: { bg: '#FEE2E2', color: '#991B1B', label: 'Rejected' },
  };

  return (
    <div style={S.page}>
      <div style={S.container}>
        {/* Header */}
        <div style={S.header}>
          <a href="/camp/dashboard" style={S.backLink}>← Back to Dashboard</a>
          <h1 style={S.title}>Request Resources</h1>
          <p style={S.subtitle}>{campInfo?.name || 'Your Camp'}</p>
        </div>

        {loading ? (
          <div style={S.loadingBox}><div style={S.spinner} /><p style={{ color: '#94A3B8' }}>Loading camp data...</p></div>
        ) : !effectiveCampId ? (
          <div style={S.card}><p style={{ color: '#F87171' }}>No camp assigned. Please log in as a camp admin.</p></div>
        ) : (
          <>
            {/* Current Stats */}
            <div style={S.statsRow}>
              <div style={S.statCard}>
                <p style={S.statLabel}>Current Headcount</p>
                <p style={S.statValue}>{headcount}</p>
              </div>
              <div style={S.statCard}>
                <p style={S.statLabel}>Min Kits Needed</p>
                <p style={S.statValue}>{minKits}</p>
              </div>
              <div style={S.statCard}>
                <p style={S.statLabel}>ML Recommended</p>
                <p style={{ ...S.statValue, color: prediction ? '#34D399' : '#64748B' }}>
                  {prediction ? recommendedKits : '—'}
                </p>
              </div>
            </div>

            {/* ML Prediction Widget */}
            <div style={S.card}>
              <h2 style={S.cardTitle}>🤖 ML Prediction</h2>
              <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 12px' }}>
                Run the prediction model to see estimated headcount at delivery time (24h).
              </p>
              <button onClick={runPrediction} disabled={predLoading} style={S.btnPrimary}>
                {predLoading ? 'Running Model...' : 'Run Prediction'}
              </button>
              {prediction && (
                <div style={{ marginTop: 16, padding: 16, background: '#1E293B', borderRadius: 10 }}>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                    <div>
                      <p style={S.predLabel}>Predicted (6h)</p>
                      <p style={S.predVal}>{prediction.predicted_headcount_6h}</p>
                    </div>
                    <div>
                      <p style={S.predLabel}>Predicted (24h at delivery)</p>
                      <p style={{ ...S.predVal, color: '#34D399' }}>{prediction.predicted_headcount_24h}</p>
                    </div>
                    <div>
                      <p style={S.predLabel}>Phase</p>
                      <p style={S.predVal}>{prediction.phase_name}</p>
                    </div>
                    <div>
                      <p style={S.predLabel}>Confidence</p>
                      <p style={S.predVal}>{Math.round(prediction.confidence * 100)}%</p>
                    </div>
                  </div>
                  <p style={{ fontSize: 12, color: '#64748B', marginTop: 8 }}>
                    Recommended kits to request: <strong style={{ color: '#34D399' }}>{recommendedKits}</strong>
                  </p>
                </div>
              )}
            </div>

            {/* Submit Request */}
            <div style={S.card}>
              <h2 style={S.cardTitle}>📦 Submit Kit Request</h2>
              {submitted && (
                <div style={{ padding: 12, background: 'rgba(34,197,94,0.15)', borderRadius: 8, marginBottom: 12, border: '1px solid rgba(34,197,94,0.3)' }}>
                  <p style={{ color: '#34D399', fontSize: 13, margin: 0 }}>✅ Request submitted successfully!</p>
                </div>
              )}
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Kits to Request</label>
                <input
                  type="number"
                  value={customKits}
                  onChange={(e) => setCustomKits(e.target.value)}
                  placeholder={`${recommendedKits} (recommended)`}
                  style={S.input}
                />
              </div>
              <div style={{ marginBottom: 12 }}>
                <label style={S.label}>Notes (optional)</label>
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Urgent medical supplies needed, etc."
                  rows={3}
                  style={{ ...S.input, resize: 'vertical' }}
                />
              </div>
              <button onClick={submitRequest} disabled={submitting} style={S.btnPrimary}>
                {submitting ? 'Submitting...' : 'Submit Request to Super Admin'}
              </button>
            </div>

            {/* Past Requests */}
            <div style={S.card}>
              <h2 style={S.cardTitle}>📋 Request History</h2>
              {pastRequests.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 13 }}>No past requests.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Date</th>
                        <th style={S.th}>Headcount</th>
                        <th style={S.th}>Kits Requested</th>
                        <th style={S.th}>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pastRequests.map((r) => {
                        const badge = STATUS_BADGE[r.status] || STATUS_BADGE.pending;
                        return (
                          <tr key={r.id}>
                            <td style={S.td}>{new Date(r.created_at).toLocaleDateString()}</td>
                            <td style={S.td}>{r.current_headcount}</td>
                            <td style={S.td}>{r.min_kits_needed}</td>
                            <td style={S.td}>
                              <span style={{ ...S.badge, background: badge.bg, color: badge.color }}>{badge.label}</span>
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
  container: { maxWidth: 700, margin: '0 auto' },
  header: { marginBottom: 24 },
  backLink: { color: '#3B82F6', fontSize: 13, textDecoration: 'none' },
  title: { fontSize: 26, fontWeight: 800, color: '#F1F5F9', margin: '8px 0 4px', letterSpacing: '-0.5px' },
  subtitle: { fontSize: 14, color: '#64748B', margin: 0 },
  loadingBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: 60 },
  spinner: { width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', marginBottom: 12 },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 },
  statCard: { background: '#1E293B', borderRadius: 12, padding: 16, border: '1px solid #334155', textAlign: 'center' },
  statLabel: { fontSize: 11, color: '#64748B', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: 0.5 },
  statValue: { fontSize: 28, fontWeight: 800, color: '#F1F5F9', margin: 0 },
  card: { background: '#1E293B', borderRadius: 14, padding: 20, border: '1px solid #334155', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 12px' },
  btnPrimary: { background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 6 },
  input: { width: '100%', padding: '10px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: 8, color: '#F1F5F9', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' },
  predLabel: { fontSize: 11, color: '#64748B', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 700 },
  predVal: { fontSize: 22, fontWeight: 800, color: '#F1F5F9', margin: 0 },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', color: '#64748B', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', color: '#CBD5E1', borderBottom: '1px solid #1E293B' },
  badge: { padding: '3px 10px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
};
