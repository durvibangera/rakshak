/**
 * FILE: page.js (NGO Portal)
 * PURPOSE: NGO-facing portal — see assignment, track fundraising, manage production.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '@/context/AuthContext';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function NGOPortalPage() {
  return (
    <RoleGate allowedRole="ngo_admin">
      <PortalContent />
    </RoleGate>
  );
}

function PortalContent() {
  const { user, handleLogout } = useAuth();
  const [ngo, setNgo] = useState(null);
  const [donations, setDonations] = useState([]);
  const [kitRequests, setKitRequests] = useState([]);
  const [loading, setLoading] = useState(true);
  const [donateAmt, setDonateAmt] = useState('');
  const [donateDonor, setDonateDonor] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [responseForm, setResponseForm] = useState({ request_id: '', kits_offered: '', estimated_delivery_days: '', cost_per_kit: '', notes: '' });
  const [showResponseForm, setShowResponseForm] = useState(false);

  const fetchData = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const ngoRes = await fetch('/api/ngos');
      const ngoData = await ngoRes.json();
      const myNgo = ngoData.ngos?.find(n => n.contact_email === user.email) || ngoData.ngos?.[0];
      setNgo(myNgo || null);
      if (myNgo) {
        const donRes = await fetch(`/api/donations?ngo_id=${myNgo.id}`);
        const donData = await donRes.json();
        setDonations(donData.donations || []);
        
        // Fetch kit requests for this NGO
        const reqRes = await fetch(`/api/kit-requests?ngo_id=${myNgo.id}`);
        const reqData = await reqRes.json();
        setKitRequests(reqData.requests || []);
      }
    } catch (e) { console.error(e); }
    setLoading(false);
  }, [user]);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const ch = supabase
      .channel('ngo-portal-rt')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ngos' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kit_requests' }, () => fetchData())
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
    setDonateAmt(''); setDonateDonor('');
    setSubmitting(false);
    fetchData();
  };

  const markKitsReady = async () => {
    if (!ngo) return;
    await fetch('/api/ngos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: ngo.id, status: 'SHIPPED' }),
    });
    await fetch('/api/kit-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event_type: 'IN', kits: ngo.kits_to_produce || 0, source_ngo_id: ngo.id, notes: `Shipped by NGO: ${ngo.name}` }),
    });
    fetchData();
  };

  const respondToRequest = async () => {
    if (!responseForm.request_id || !ngo) return;
    await fetch('/api/kit-responses', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        request_id: responseForm.request_id,
        ngo_id: ngo.id,
        kits_offered: parseInt(responseForm.kits_offered) || 0,
        estimated_delivery_days: responseForm.estimated_delivery_days ? parseInt(responseForm.estimated_delivery_days) : null,
        cost_per_kit: responseForm.cost_per_kit ? parseFloat(responseForm.cost_per_kit) : null,
        notes: responseForm.notes || null
      })
    });
    setResponseForm({ request_id: '', kits_offered: '', estimated_delivery_days: '', cost_per_kit: '', notes: '' });
    setShowResponseForm(false);
    fetchData();
  };

  const openResponseForm = (requestId) => {
    setResponseForm({ ...responseForm, request_id: requestId });
    setShowResponseForm(true);
  };

  const totalRaised = donations.reduce((s, d) => s + (d.amount || 0), 0);
  const progressPct = ngo?.amount_needed > 0 ? Math.min(100, Math.round((totalRaised / ngo.amount_needed) * 100)) : 0;
  const productionReady = ngo?.production_ready_at ? new Date(ngo.production_ready_at) : null;
  const canShip = productionReady && new Date() >= productionReady && ngo?.status === 'PRODUCING';

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

  const STATUS_CONFIG = {
    IDLE:        { color: '#6B7280', bg: '#F3F4F6', border: '#E5E7EB', label: 'Idle — No Assignment' },
    FUNDRAISING: { color: '#B45309', bg: '#FEF3C7', border: '#FDE68A', label: 'Fundraising in Progress' },
    PRODUCING:   { color: '#C2410C', bg: '#FFF7ED', border: '#FED7AA', label: 'Producing Kits' },
    SHIPPED:     { color: '#065F46', bg: '#D1FAE5', border: '#A7F3D0', label: 'Kits Shipped' },
  };

  return (
    <div style={{ minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT, color: '#111827' }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <header style={S.nav}>
        <div style={S.navLeft}>
          <Link href="/" style={{ display: 'flex', alignItems: 'center' }}>
            <img src="/logo-light.png" alt="Sahaay" style={{ height: 52, width: 'auto', objectFit: 'contain' }} />
          </Link>
          <span style={S.navBadge}>NGO Portal</span>
        </div>
        <div style={S.navRight}>
          {ngo && <span style={S.navOrg}>{ngo.name}</span>}
          <div style={{ width: 1, height: 24, background: '#E2E8F0' }} />
          <Link href="/" style={S.navLink}>← Home</Link>
          <button onClick={handleLogout} style={S.logoutBtn}>Logout</button>
        </div>
      </header>

      {/* Body */}
      <div style={S.body}>

        {/* Page title */}
        <div style={S.pageHead}>
          <div>
            <p style={S.eyebrow}>NGO Admin · Operations</p>
            <h1 style={S.pageTitle}>NGO Portal</h1>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 80 }}>
            <div style={S.spinner} />
            <p style={{ color: '#9CA3AF', marginTop: 16, fontSize: 14 }}>Loading portal data…</p>
          </div>
        ) : !ngo ? (
          <div style={S.card}>
            <p style={{ color: '#DC2626', textAlign: 'center', margin: 0, fontSize: 14 }}>
              No NGO linked to your account. Contact the Super Admin.
            </p>
          </div>
        ) : (
          <>
            {/* Status header card */}
            <div style={S.card}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: ngo.status !== 'IDLE' ? 20 : 0 }}>
                <div>
                  <p style={S.cardEyebrow}>Your Organisation</p>
                  <h2 style={S.cardOrgName}>{ngo.name}</h2>
                  <p style={{ fontSize: 13, color: '#6B7280', margin: '2px 0 0' }}>{ngo.contact_email}</p>
                </div>
                {(() => {
                  const sc = STATUS_CONFIG[ngo.status] || STATUS_CONFIG.IDLE;
                  return (
                    <span style={{ fontSize: 12.5, fontWeight: 700, color: sc.color, background: sc.bg, border: `1px solid ${sc.border}`, padding: '5px 12px', borderRadius: 20 }}>
                      {sc.label}
                    </span>
                  );
                })()}
              </div>

              {ngo.status !== 'IDLE' && (
                <div style={S.statsRow}>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Kits to Produce</p>
                    <p style={{ ...S.statValue, color: '#1B3676' }}>{ngo.kits_to_produce || 0}</p>
                  </div>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Target Amount</p>
                    <p style={S.statValue}>₹{(ngo.amount_needed || 0).toLocaleString()}</p>
                  </div>
                  <div style={S.statBox}>
                    <p style={S.statLabel}>Raised</p>
                    <p style={{ ...S.statValue, color: progressPct >= 100 ? '#059669' : '#D97706' }}>
                      ₹{totalRaised.toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Kit Requests from Super Admin */}
            <div style={S.card}>
              <h3 style={S.cardTitle}>Kit Requests</h3>
              {kitRequests.length === 0 ? (
                <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>No kit requests received yet.</p>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {kitRequests.map(req => {
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
                    const myResponse = responses.find(r => r.ngo_id === ngo?.id);
                    
                    return (
                      <div key={req.id} style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 8 }}>
                          <div>
                            <p style={{ fontSize: 14, fontWeight: 700, color: '#0F172A', margin: '0 0 4px' }}>
                              {req.kits_requested} kits requested
                            </p>
                            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
                              {new Date(req.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
                              {req.deadline && ` • Deadline: ${new Date(req.deadline).toLocaleDateString('en-IN')}`}
                            </p>
                          </div>
                          <div style={{ display: 'flex', gap: 6 }}>
                            <span style={{ fontSize: 11, fontWeight: 700, background: uc.bg, color: uc.text, padding: '3px 8px', borderRadius: 12 }}>
                              {req.urgency}
                            </span>
                            <span style={{ fontSize: 11, fontWeight: 700, background: sc.bg, color: sc.text, padding: '3px 8px', borderRadius: 12 }}>
                              {req.status}
                            </span>
                          </div>
                        </div>
                        
                        {req.reason && (
                          <p style={{ fontSize: 13, color: '#374151', margin: '8px 0', fontStyle: 'italic' }}>
                            "{req.reason}"
                          </p>
                        )}
                        
                        {myResponse ? (
                          <div style={{ background: 'white', border: '1px solid #D1D5DB', borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
                            <p style={{ fontSize: 12, fontWeight: 600, color: '#059669', margin: '0 0 4px' }}>Your Response:</p>
                            <p style={{ fontSize: 13, color: '#374151', margin: 0 }}>
                              Offered {myResponse.kits_offered} kits
                              {myResponse.estimated_delivery_days && ` • ${myResponse.estimated_delivery_days} days delivery`}
                              {myResponse.cost_per_kit && ` • ₹${myResponse.cost_per_kit}/kit`}
                            </p>
                            {myResponse.notes && (
                              <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0', fontStyle: 'italic' }}>
                                "{myResponse.notes}"
                              </p>
                            )}
                            <p style={{ fontSize: 11, color: '#9CA3AF', margin: '4px 0 0' }}>
                              Status: <span style={{ fontWeight: 600, color: myResponse.status === 'APPROVED' ? '#059669' : myResponse.status === 'REJECTED' ? '#DC2626' : '#D97706' }}>
                                {myResponse.status}
                              </span>
                            </p>
                          </div>
                        ) : req.status === 'PENDING' && (
                          <button onClick={() => openResponseForm(req.id)} style={{ ...S.btnPrimary, marginTop: 8, padding: '8px 16px', fontSize: 13 }}>
                            Respond to Request
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Fundraising */}
            {(ngo.status === 'FUNDRAISING' || ngo.status === 'PRODUCING') && (
              <div style={S.card}>
                <h3 style={S.cardTitle}>Fundraising Progress</h3>
                <div style={{ background: '#F1F5F9', borderRadius: 8, height: 24, overflow: 'hidden', marginBottom: 8 }}>
                  <div style={{
                    width: `${progressPct}%`, height: '100%',
                    background: progressPct >= 100 ? '#059669' : '#D97706',
                    borderRadius: 8, transition: 'width 0.5s ease',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {progressPct > 10 && <span style={{ fontSize: 11, fontWeight: 700, color: 'white' }}>{progressPct}%</span>}
                  </div>
                </div>
                <p style={{ fontSize: 13, color: '#6B7280', margin: '0 0 4px' }}>
                  ₹{totalRaised.toLocaleString()} of ₹{(ngo.amount_needed || 0).toLocaleString()} raised
                </p>

                {ngo.status === 'FUNDRAISING' && (
                  <>
                    <div style={S.sectionDivider} />
                    <p style={S.subLabel}>Record Donation</p>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <input placeholder="Donor name" value={donateDonor} onChange={e => setDonateDonor(e.target.value)} style={{ ...S.input, flex: 1 }} />
                      <input placeholder="₹ Amount" type="number" value={donateAmt} onChange={e => setDonateAmt(e.target.value)} style={{ ...S.input, width: 120 }} />
                      <button onClick={recordDonation} disabled={submitting || !donateAmt} style={{ ...S.btnPrimary, width: 'auto', padding: '10px 20px', opacity: submitting || !donateAmt ? 0.5 : 1 }}>
                        {submitting ? '…' : 'Add'}
                      </button>
                    </div>
                    <div style={{ marginTop: 12, padding: '10px 14px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, color: '#6B7280' }}>
                      Campaign link: <span style={{ color: '#1B3676', fontWeight: 600 }}>{typeof window !== 'undefined' ? `${window.location.origin}/ngo/portal?donate=${ngo.id}` : ''}</span>
                    </div>
                  </>
                )}
              </div>
            )}

            {/* Production */}
            {ngo.status === 'PRODUCING' && (
              <div style={S.card}>
                <h3 style={S.cardTitle}>Production Pipeline</h3>
                <p style={{ fontSize: 14, color: '#374151', margin: '0 0 12px' }}>
                  Producing <strong>{ngo.kits_to_produce}</strong> kits
                </p>
                <div style={{ background: canShip ? '#ECFDF5' : '#FFF7ED', border: `1px solid ${canShip ? '#A7F3D0' : '#FED7AA'}`, borderRadius: 10, padding: '14px 16px', marginBottom: 14 }}>
                  <p style={{ fontSize: 14, fontWeight: 700, color: canShip ? '#059669' : '#C2410C', margin: 0 }}>
                    {canShip ? '✅ Production Complete!' : `⏳ ${countdown}`}
                  </p>
                  {productionReady && (
                    <p style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 0' }}>
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
              <div style={{ ...S.card, textAlign: 'center', padding: '32px 20px' }}>
                <div style={{ width: 68, height: 68, borderRadius: '50%', background: '#ECFDF5', border: '1px solid #A7F3D0', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px', fontSize: 32 }}>✅</div>
                <p style={{ fontSize: 18, fontWeight: 800, color: '#059669', margin: '0 0 6px' }}>Kits Shipped!</p>
                <p style={{ fontSize: 13, color: '#6B7280', margin: 0 }}>{ngo.kits_to_produce} kits have been added to inventory.</p>
              </div>
            )}

            {/* Donation log */}
            <div style={S.card}>
              <h3 style={S.cardTitle}>Donation Log</h3>
              {donations.length === 0 ? (
                <p style={{ color: '#9CA3AF', fontSize: 13, margin: 0 }}>No donations recorded yet.</p>
              ) : (
                <div style={{ overflowX: 'auto' }}>
                  <table style={S.table}>
                    <thead>
                      <tr>
                        {['Donor', 'Amount', 'Date'].map(h => <th key={h} style={S.th}>{h}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {donations.map(d => (
                        <tr key={d.id} style={S.tr}>
                          <td style={S.td}>{d.donor_name}</td>
                          <td style={{ ...S.td, fontWeight: 700, color: '#059669' }}>₹{d.amount?.toLocaleString()}</td>
                          <td style={S.td}>{new Date(d.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
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

      {/* Kit Response Modal */}
      {showResponseForm && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }} onClick={() => setShowResponseForm(false)}>
          <div style={{ background: 'white', borderRadius: 12, padding: '24px', maxWidth: 500, width: '90%', maxHeight: '80vh', overflowY: 'auto' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ fontSize: 18, fontWeight: 700, color: '#0F172A', margin: 0 }}>Respond to Kit Request</h3>
              <button onClick={() => setShowResponseForm(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#6B7280' }}>×</button>
            </div>
            
            <div style={{ display: 'grid', gap: 16 }}>
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Kits You Can Offer *</label>
                <input type="number" value={responseForm.kits_offered} onChange={e => setResponseForm({ ...responseForm, kits_offered: e.target.value })} style={S.input} placeholder="e.g. 300" />
              </div>
              
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Delivery Days</label>
                  <input type="number" value={responseForm.estimated_delivery_days} onChange={e => setResponseForm({ ...responseForm, estimated_delivery_days: e.target.value })} style={S.input} placeholder="e.g. 7" />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Cost per Kit (₹)</label>
                  <input type="number" value={responseForm.cost_per_kit} onChange={e => setResponseForm({ ...responseForm, cost_per_kit: e.target.value })} style={S.input} placeholder="e.g. 120" />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 6 }}>Additional Notes</label>
                <textarea value={responseForm.notes} onChange={e => setResponseForm({ ...responseForm, notes: e.target.value })} style={{ ...S.input, minHeight: 80, resize: 'vertical' }} placeholder="Any additional information..." />
              </div>
            </div>

            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 20 }}>
              <button onClick={() => setShowResponseForm(false)} style={{ padding: '10px 20px', background: 'white', border: '1px solid #D1D5DB', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer', color: '#374151' }}>
                Cancel
              </button>
              <button onClick={respondToRequest} disabled={!responseForm.kits_offered} style={{ ...S.btnPrimary, padding: '10px 20px', opacity: !responseForm.kits_offered ? 0.6 : 1 }}>
                Send Response
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const S = {
  nav: {
    background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 40px',
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    height: 72, position: 'sticky', top: 0, zIndex: 200,
    boxShadow: '0 2px 8px rgba(0,0,0,0.06)', fontFamily: FONT,
  },
  navLeft: { display: 'flex', alignItems: 'center', gap: 16 },
  navBadge: { fontSize: 12, fontWeight: 700, background: '#EEF2FF', color: '#1B3676', padding: '4px 10px', borderRadius: 20, letterSpacing: '0.3px' },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navOrg: { fontSize: 13.5, fontWeight: 600, color: '#374151' },
  navLink: { fontSize: 13.5, color: '#6B7280', textDecoration: 'none', fontWeight: 500 },
  logoutBtn: { fontSize: 13.5, fontWeight: 600, color: '#374151', background: 'white', border: '1px solid #D1D5DB', padding: '7px 16px', borderRadius: 7, cursor: 'pointer', fontFamily: FONT },

  body: { maxWidth: 760, margin: '0 auto', padding: '32px 28px 60px' },

  pageHead: { marginBottom: 24 },
  eyebrow: { fontSize: 11, fontWeight: 700, color: '#1B3676', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  pageTitle: { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' },

  card: {
    background: 'white', border: '1px solid #E2E8F0', borderRadius: 14,
    padding: '22px 24px', marginBottom: 16, boxShadow: '0 1px 4px rgba(0,0,0,0.05)',
  },
  cardEyebrow: { fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 4px' },
  cardOrgName: { fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.3px' },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: '0 0 14px' },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 },
  statBox: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', textAlign: 'center' },
  statLabel: { fontSize: 10.5, color: '#9CA3AF', margin: '0 0 4px', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px' },
  statValue: { fontSize: 22, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' },

  sectionDivider: { height: 1, background: '#F1F5F9', margin: '16px 0' },
  subLabel: { fontSize: 11.5, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.5px', margin: '0 0 8px' },

  input: {
    padding: '10px 12px', border: '1px solid #D1D5DB', borderRadius: 8,
    background: 'white', color: '#111827', fontSize: 13.5, outline: 'none',
    fontFamily: FONT, boxSizing: 'border-box',
  },
  btnPrimary: {
    width: '100%', padding: '12px', background: '#1B3676', color: 'white',
    border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700,
    cursor: 'pointer', fontFamily: FONT, boxShadow: '0 2px 8px rgba(27,54,118,0.2)',
  },

  table: { width: '100%', borderCollapse: 'collapse', fontSize: 13.5 },
  th: { textAlign: 'left', padding: '8px 12px', color: '#9CA3AF', fontSize: 11, textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.4px', borderBottom: '1px solid #F1F5F9' },
  tr: { borderBottom: '1px solid #F8FAFC' },
  td: { padding: '11px 12px', color: '#374151' },

  spinner: { width: 36, height: 36, border: '3px solid #E2E8F0', borderTopColor: '#1B3676', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
};
