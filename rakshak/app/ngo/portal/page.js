/**
 * FILE: page.js (NGO Portal)
 * PURPOSE: NGO-facing portal — see assignment, track fundraising, manage production.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';

export default function NGOPortalPage() {
  return (
    <RoleGate allowedRole="ngo_admin">
      <PortalContent />
    </RoleGate>
  );
}

function PortalContent() {
  const { user } = useAuth();
  const [ngo, setNgo] = useState(null);
  const [donations, setDonations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [donateAmt, setDonateAmt] = useState('');
  const [donateDonor, setDonateDonor] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      // fetch NGO linked to this user
      const ngoRes = await fetch('/api/ngos');
      const ngoData = await ngoRes.json();
      const myNgo = ngoData.ngos?.find(n => n.contact_email === user.email) || ngoData.ngos?.[0];
      setNgo(myNgo || null);

      if (myNgo) {
        const donRes = await fetch(`/api/donations?ngo_id=${myNgo.id}`);
        const donData = await donRes.json();
        setDonations(donData.donations || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime
  useEffect(() => {
    const ch = supabase
      .channel('ngo-portal-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ngos' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(ch);
  }, [fetchData]);

  const recordDonation = async () => {
    if (!ngo || !donateAmt) return;
    setSubmitting(true);
    await fetch('/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ngo_id: ngo.id, donor_name: donateDonor || 'Anonymous', amount: parseFloat(donateAmt) }),
    });
    setDonateAmt('');
    setDonateDonor('');
    setSubmitting(false);
    fetchData();
  };

  const markKitsReady = async () => {
    if (!ngo) return;
    // Update NGO status to SHIPPED by calling ngos PATCH
    await fetch('/api/ngos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ngo.id, status: 'SHIPPED' }),
    });
    // Record inventory IN event
    await fetch('/api/kit-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ direction: 'IN', quantity: ngo.kits_to_produce || 0, source: `NGO: ${ngo.name}`, round_id: null }),
    });
    fetchData();
  };

  const totalRaised = donations.reduce((s, d) => s + (d.amount || 0), 0);
  const progressPct = ngo?.amount_needed > 0 ? Math.min(100, Math.round((totalRaised / ngo.amount_needed) * 100)) : 0;
  const productionReady = ngo?.production_ready_at ? new Date(ngo.production_ready_at) : null;
  const canShip = productionReady && new Date() >= productionReady && ngo?.status === 'PRODUCING';

  // 24h countdown
  const [countdown, setCountdown] = useState('');
  useEffect(() => {
    if (!productionReady || ngo?.status !== 'PRODUCING') { setCountdown(''); return; }
    const tick = () => {
      const diff = productionReady.getTime() - Date.now();
      if (diff <= 0) { setCountdown('Ready!'); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setCountdown(`${h}h ${m}m remaining`);
    };
    tick();
    const iv = setInterval(tick, 60000);
    return () => clearInterval(iv);
  }, [productionReady, ngo?.status]);

  const STATUS_STYLE = {
    IDLE: { color: '#64748B', label: 'Idle — No Assignment' },
    FUNDRAISING: { color: '#EAB308', label: '💰 Fundraising in Progress' },
    PRODUCING: { color: '#F97316', label: '🏭 Producing Kits' },
    SHIPPED: { color: '#22C55E', label: '✅ Kits Shipped' },
  };

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.container}>
        <h1 style={S.title}>🏥 NGO Portal</h1>
        <p style={S.subtitle}>Manage your kit assignment, fundraising, and production</p>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 60 }}><div style={S.spinner} /></div>
        ) : !ngo ? (
          <div style={S.card}>
            <p style={{ color: '#F87171', textAlign: 'center', margin: 0 }}>
              No NGO linked to your account. Contact the Super Admin.
            </p>
          </div>
        ) : (
          <>
            {/* Status Header */}
            <div style={{ ...S.card, background: 'rgba(30,41,59,0.95)', border: '1px solid rgba(59,130,246,0.3)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div>
                  <h2 style={{ fontSize: 20, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>{ngo.name}</h2>
                  <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>{ngo.contact_email}</p>
                </div>
                <span style={{ fontSize: 13, fontWeight: 700, color: STATUS_STYLE[ngo.status]?.color || '#64748B' }}>
                  {STATUS_STYLE[ngo.status]?.label || ngo.status}
                </span>
              </div>

              {ngo.status !== 'IDLE' && (
                <div style={S.statsRow}>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Kits to Produce</p>
                    <p style={{ ...S.statValue, color: '#3B82F6' }}>{ngo.kits_to_produce || 0}</p>
                  </div>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Target Amount</p>
                    <p style={S.statValue}>₹{(ngo.amount_needed || 0).toLocaleString()}</p>
                  </div>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Raised</p>
                    <p style={{ ...S.statValue, color: progressPct >= 100 ? '#22C55E' : '#EAB308' }}>₹{totalRaised.toLocaleString()}</p>
                  </div>
                </div>
              )}
            </div>

            {/* Fundraising Section */}
            {(ngo.status === 'FUNDRAISING' || ngo.status === 'PRODUCING') && (
              <div style={S.card}>
                <h3 style={S.cardTitle}>💰 Fundraising Progress</h3>
                <div style={{ background: '#0F172A', borderRadius: 8, height: 28, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{ width: `${progressPct}%`, height: '100%', background: progressPct >= 100 ? 'linear-gradient(135deg, #22C55E, #16A34A)' : 'linear-gradient(135deg, #EAB308, #F59E0B)', borderRadius: 8, transition: 'width 0.5s ease', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: '#0F172A' }}>{progressPct}%</span>
                  </div>
                </div>
                <p style={{ fontSize: 12, color: '#64748B', margin: '0 0 12px' }}>
                  ₹{totalRaised.toLocaleString()} of ₹{(ngo.amount_needed || 0).toLocaleString()}
                </p>

                {ngo.status === 'FUNDRAISING' && (
                  <>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#94A3B8', margin: '12px 0 8px', textTransform: 'uppercase' }}>Record Donation</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input placeholder="Donor name" value={donateDonor} onChange={e => setDonateDonor(e.target.value)} style={S.input} />
                      <input placeholder="₹ Amount" type="number" value={donateAmt} onChange={e => setDonateAmt(e.target.value)} style={{ ...S.input, width: 120 }} />
                      <button onClick={recordDonation} disabled={submitting || !donateAmt} style={{ ...S.btnPrimary, opacity: submitting || !donateAmt ? 0.5 : 1 }}>
                        {submitting ? '...' : 'Add'}
                      </button>
                    </div>

                    {/* Share link for campaigns */}
                    <div style={{ marginTop: 12, padding: 10, background: '#0F172A', borderRadius: 8, fontSize: 12, color: '#64748B' }}>
                      📋 Campaign link: <span style={{ color: '#3B82F6' }}>{typeof window !== 'undefined' ? `${window.location.origin}/ngo/portal?donate=${ngo.id}` : ''}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Production Section */}
            {ngo.status === 'PRODUCING' && (
              <div style={S.card}>
                <h3 style={S.cardTitle}>🏭 Production Pipeline</h3>
                <p style={{ fontSize: 13, color: '#F1F5F9', margin: '0 0 8px' }}>
                  Producing <strong>{ngo.kits_to_produce}</strong> kits
                </p>
                <div style={{ background: '#0F172A', borderRadius: 8, padding: 14, marginBottom: 12 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: canShip ? '#22C55E' : '#F97316', margin: 0 }}>
                    {canShip ? '✅ Production Complete!' : `⏳ ${countdown}`}
                  </p>
                  {productionReady && (
                    <p style={{ fontSize: 12, color: '#64748B', margin: '4px 0 0' }}>
                      Ready at: {productionReady.toLocaleString()}
                    </p>
                  )}
                </div>
                {canShip && (
                  <button onClick={markKitsReady} style={S.btnPrimary}>
                    📦 Mark Kits Ready & Ship
                  </button>
                )}
              </div>
            )}

            {/* Shipped */}
            {ngo.status === 'SHIPPED' && (
              <div style={S.card}>
                <div style={{ textAlign: 'center', padding: 20 }}>
                  <span style={{ fontSize: 48 }}>✅</span>
                  <p style={{ fontSize: 18, fontWeight: 700, color: '#22C55E', margin: '12px 0 4px' }}>Kits Shipped!</p>
                  <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>{ngo.kits_to_produce} kits have been added to inventory.</p>
                </div>
              </div>
            )}

            {/* Donation Log */}
            <div style={S.card}>
              <h3 style={S.cardTitle}>📋 Donation Log</h3>
              {donations.length === 0 ? (
                <p style={{ color: '#64748B', fontSize: 13 }}>No donations yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        <th style={S.th}>Donor</th>
                        <th style={S.th}>Amount</th>
                        <th style={S.th}>Date</th>
                      </tr>
                    </thead>
                    <tbody>
                      {donations.map(d => (
                        <tr key={d.id}>
                          <td style={S.td}>{d.donor_name}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#22C55E' }}>₹{d.amount?.toLocaleString()}</td>
                          <td style={S.td}>{new Date(d.created_at).toLocaleDateString()}</td>
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
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'system-ui, sans-serif', padding: '20px' },
  container: { maxWidth: 700, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 800, color: '#F1F5F9', margin: '0 0 4px', letterSpacing: '-0.5px' },
  subtitle: { fontSize: 14, color: '#64748B', margin: '0 0 20px' },
  card: { background: '#1E293B', borderRadius: 14, padding: 20, border: '1px solid #334155', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 12px' },
  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  statBox: { background: '#0F172A', borderRadius: 8, padding: 12, textAlign: 'center' },
  statLabel: { fontSize: 10, color: '#64748B', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 700 },
  statValue: { fontSize: 20, fontWeight: 800, color: '#F1F5F9', margin: 0 },
  btnPrimary: { background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', border: 'none', borderRadius: 10, padding: '10px 24px', fontWeight: 700, fontSize: 14, cursor: 'pointer', width: '100%' },
  input: { flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid #334155', background: '#0F172A', color: '#F1F5F9', fontSize: 13, outline: 'none' },
  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13 },
  th: { textAlign: 'left', padding: '8px 12px', color: '#64748B', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, borderBottom: '1px solid #334155' },
  td: { padding: '10px 12px', color: '#CBD5E1', borderBottom: '1px solid #1E293B' },
  spinner: { width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
};
