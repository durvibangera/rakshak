/**
 * FILE: page.js (Super Admin — NGO Management & Fundraising Tracker)
 * PURPOSE: Register NGOs, assign kits, track fundraising, manage production pipeline.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';
import Link from 'next/link';

const FONT = '"DM Sans", "Instrument Sans", -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';

export default function NGOsPage() {
  return <RoleGate allowedRole="super_admin"><NGOContent /></RoleGate>;
}

function NGOContent() {
  const [ngos, setNgos] = useState([]);
  const [donations, setDonations] = useState({});
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', contact_phone: '', contact_email: '', cost_per_kit: 120, campaign_url: '' });
  const [assigning, setAssigning] = useState(false);
  const [totalKitsInput, setTotalKitsInput] = useState('');
  const [selectedNgo, setSelectedNgo] = useState(null);
  const [donationForm, setDonationForm] = useState({ donor_name: '', amount: '' });

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/ngos');
      const data = await res.json();
      setNgos(data.ngos || []);
      const donMap = {};
      await Promise.all((data.ngos || []).map(async (ngo) => {
        const dRes = await fetch(`/api/donations?ngo_id=${ngo.id}`);
        const dData = await dRes.json();
        donMap[ngo.id] = dData.donations || [];
      }));
      setDonations(donMap);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  useEffect(() => {
    const channel = supabase.channel('ngos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ngos' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  const registerNGO = async () => {
    if (!form.name.trim()) return;
    await fetch('/api/ngos', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(form) });
    setForm({ name: '', contact_phone: '', contact_email: '', cost_per_kit: 120, campaign_url: '' });
    setShowForm(false);
    fetchData();
  };

  const assignToNGOs = async () => {
    const total = parseInt(totalKitsInput);
    if (!total || total <= 0) return;
    setAssigning(true);
    await fetch('/api/ngos/assign', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ total_kits_needed: total }) });
    setTotalKitsInput('');
    setAssigning(false);
    fetchData();
  };

  const addDonation = async () => {
    if (!selectedNgo || !donationForm.amount) return;
    await fetch('/api/donations', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ngo_id: selectedNgo, donor_name: donationForm.donor_name || 'Anonymous', amount: parseFloat(donationForm.amount) }) });
    setDonationForm({ donor_name: '', amount: '' });
    setSelectedNgo(null);
    fetchData();
  };

  const markShipped = async (ngo) => {
    await fetch('/api/ngos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: ngo.id, status: 'SHIPPED', kits_shipped: ngo.kits_assigned, shipped_at: new Date().toISOString() }) });
    await fetch('/api/kit-inventory', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ event_type: 'IN', kits: ngo.kits_assigned, source_ngo_id: ngo.id, notes: `Shipment from ${ngo.name}` }) });
    fetchData();
  };

  const STATUS = {
    IDLE:        { bg: '#F3F4F6', text: '#6B7280' },
    FUNDRAISING: { bg: '#FEF3C7', text: '#B45309' },
    PRODUCING:   { bg: '#EFF6FF', text: '#2563EB' },
    SHIPPED:     { bg: '#D1FAE5', text: '#065F46' },
  };

  const now = Date.now();
  const eligibleNGOs = ngos.filter(n => ['IDLE', 'FUNDRAISING'].includes(n.status)).length;

  return (
    <div style={s.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Nav */}
      <header style={s.nav}>
        <div style={s.navLogo}>
          <img src="/logo-light.png" alt="Sahaay" style={{ height: 46, width: 'auto', objectFit: 'contain' }} />
          <span style={s.navRoleBadge}>Super Admin</span>
        </div>
        <div style={s.navRight}>
          <Link href="/super-admin/dashboard" style={s.navBack}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
            Dashboard
          </Link>
          <button onClick={() => setShowForm(!showForm)} style={s.btnPrimary}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
            Register NGO
          </button>
        </div>
      </header>

      <div style={s.body}>
        <div style={s.pageHead}>
          <p style={s.eyebrow}>Super Admin</p>
          <h1 style={s.pageTitle}>NGO Management</h1>
          <p style={s.pageSubtitle}>Register NGOs, assign kits, track fundraising &amp; production pipelines</p>
        </div>

        {/* Stats */}
        <div style={s.statsRow}>
          <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>} value={ngos.length} label="Total NGOs" bg="#EFF6FF" />
          <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>} value={ngos.filter(n => n.status === 'SHIPPED').length} label="Shipped" bg="#ECFDF5" accent="#059669" />
          <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#D97706" strokeWidth="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>} value={ngos.filter(n => n.status === 'PRODUCING').length} label="Producing" bg="#FEF3C7" accent="#D97706" />
          <StatCard icon={<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#7C3AED" strokeWidth="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6"/></svg>} value={`₹${ngos.reduce((s, n) => s + parseFloat(n.total_raised || 0), 0).toLocaleString('en-IN')}`} label="Total Raised" bg="#F5F3FF" accent="#7C3AED" />
        </div>

        {/* Register form */}
        {showForm && (
          <div style={s.card}>
            <div style={s.cardHead}>
              <h2 style={s.cardTitle}>Register New NGO</h2>
              <button onClick={() => setShowForm(false)} style={s.closeBtn}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              </button>
            </div>
            <div style={s.formGrid}>
              <FieldBlock label="NGO Name *"><input value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} style={s.input} placeholder="Red Cross Mumbai" /></FieldBlock>
              <FieldBlock label="Contact Phone"><input value={form.contact_phone} onChange={e => setForm({ ...form, contact_phone: e.target.value })} style={s.input} placeholder="+91 9876543210" /></FieldBlock>
              <FieldBlock label="Contact Email"><input value={form.contact_email} onChange={e => setForm({ ...form, contact_email: e.target.value })} style={s.input} placeholder="ngo@example.com" /></FieldBlock>
              <FieldBlock label="Cost per Kit (₹)"><input type="number" value={form.cost_per_kit} onChange={e => setForm({ ...form, cost_per_kit: parseFloat(e.target.value) })} style={s.input} /></FieldBlock>
              <div style={{ gridColumn: '1/-1' }}>
                <FieldBlock label="Campaign URL"><input value={form.campaign_url} onChange={e => setForm({ ...form, campaign_url: e.target.value })} style={s.input} placeholder="https://fundraiser.example.com" /></FieldBlock>
              </div>
            </div>
            <div style={s.btnRow}>
              <button onClick={registerNGO} style={s.btnPrimary}>Register NGO</button>
              <button onClick={() => setShowForm(false)} style={s.btnSecondary}>Cancel</button>
            </div>
          </div>
        )}

        {/* Assign kits */}
        <div style={s.card}>
          <div style={s.cardHead}>
            <div>
              <h2 style={s.cardTitle}>Assign Kits to NGOs</h2>
              <p style={s.cardSubtitle}>Divide total kits equally across all available NGOs ({eligibleNGOs} eligible)</p>
            </div>
          </div>
          <div style={s.assignRow}>
            <div style={{ flex: 1 }}>
              <FieldBlock label="Total Kits Needed">
                <input type="number" value={totalKitsInput} onChange={e => setTotalKitsInput(e.target.value)} style={s.input} placeholder="e.g. 900" />
              </FieldBlock>
            </div>
            <button onClick={assignToNGOs} disabled={assigning || eligibleNGOs === 0} style={{ ...s.btnPrimary, alignSelf: 'flex-end', opacity: (assigning || eligibleNGOs === 0) ? 0.6 : 1 }}>
              {assigning ? 'Assigning…' : `Assign to ${eligibleNGOs} NGOs`}
            </button>
          </div>
        </div>

        {/* NGO cards */}
        {loading ? (
          <div style={s.loadingWrap}><div style={s.spinner} /><p style={s.loadingText}>Loading NGOs…</p></div>
        ) : ngos.length === 0 ? (
          <div style={s.emptyCard}><p style={s.emptyText}>No NGOs registered yet. Click "Register NGO" to add one.</p></div>
        ) : (
          <div style={s.ngoGrid}>
            {ngos.map(ngo => {
              const sc = STATUS[ngo.status] || STATUS.IDLE;
              const progress = ngo.amount_needed > 0 ? Math.min(100, (parseFloat(ngo.total_raised || 0) / parseFloat(ngo.amount_needed)) * 100) : 0;
              const isReady = ngo.status === 'PRODUCING' && ngo.production_ready_at && new Date(ngo.production_ready_at).getTime() <= now;
              const nDonations = donations[ngo.id] || [];
              let countdown = '';
              if (ngo.status === 'PRODUCING' && ngo.production_ready_at) {
                const diff = new Date(ngo.production_ready_at).getTime() - now;
                countdown = diff > 0 ? `${Math.floor(diff / 3600000)}h ${Math.floor((diff % 3600000) / 60000)}m remaining` : 'Ready for shipment!';
              }

              return (
                <div key={ngo.id} style={s.ngoCard}>
                  {/* Header */}
                  <div style={s.ngoCardHead}>
                    <div style={s.ngoIconWrap}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/></svg>
                    </div>
                    <div style={{ flex: 1 }}>
                      <p style={s.ngoName}>{ngo.name}</p>
                      <p style={s.ngoContact}>{ngo.contact_email}{ngo.contact_phone ? ` · ${ngo.contact_phone}` : ''}</p>
                    </div>
                    <span style={{ ...s.statusBadge, background: sc.bg, color: sc.text }}>{ngo.status}</span>
                    <Link href="/ngo/portal" style={s.portalLink} title="View NGO Portal">
                      <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      Portal
                    </Link>
                  </div>

                  {/* Fundraising progress */}
                  {ngo.kits_assigned > 0 && (
                    <div style={s.ngoProgress}>
                      <div style={s.progressLabelRow}>
                        <span style={s.progressLabel}>₹{parseFloat(ngo.total_raised || 0).toLocaleString('en-IN')} raised of ₹{parseFloat(ngo.amount_needed || 0).toLocaleString('en-IN')}</span>
                        <span style={s.progressPct}>{Math.round(progress)}%</span>
                      </div>
                      <div style={s.progressBar}><div style={{ ...s.progressFill, width: `${progress}%`, background: progress >= 100 ? '#059669' : '#2563EB' }} /></div>
                      <div style={s.miniStatsRow}>
                        <MiniStat label="Assigned" value={ngo.kits_assigned} />
                        <MiniStat label="Cost/Kit" value={`₹${ngo.cost_per_kit}`} />
                        <MiniStat label="Produced" value={ngo.kits_produced || 0} />
                        <MiniStat label="Shipped" value={ngo.kits_shipped || 0} />
                      </div>
                    </div>
                  )}

                  {/* Producing countdown */}
                  {ngo.status === 'PRODUCING' && (
                    <div style={s.infoPanel}>
                      <p style={s.infoPanelMeta}>Production started: {ngo.production_started_at ? new Date(ngo.production_started_at).toLocaleString('en-IN') : '—'}</p>
                      <p style={{ ...s.infoPanelStatus, color: isReady ? '#059669' : '#D97706' }}>{countdown}</p>
                      {isReady && (
                        <button onClick={() => markShipped(ngo)} style={{ ...s.btnPrimary, marginTop: 10, fontSize: 13 }}>
                          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><rect x="2" y="7" width="20" height="14" rx="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/></svg>
                          Mark as Shipped → Add to Inventory
                        </button>
                      )}
                    </div>
                  )}

                  {/* Shipped banner */}
                  {ngo.status === 'SHIPPED' && (
                    <div style={s.shippedBanner}>
                      <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#059669" strokeWidth="2.5"><polyline points="20 6 9 17 4 12"/></svg>
                      Shipped {ngo.kits_shipped} kits on {ngo.shipped_at ? new Date(ngo.shipped_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                    </div>
                  )}

                  {/* Add donation */}
                  {ngo.status === 'FUNDRAISING' && (
                    <div style={s.donationSection}>
                      {selectedNgo === ngo.id ? (
                        <div style={s.donationForm}>
                          <input value={donationForm.donor_name} onChange={e => setDonationForm({ ...donationForm, donor_name: e.target.value })} style={s.inputSm} placeholder="Donor name" />
                          <input type="number" value={donationForm.amount} onChange={e => setDonationForm({ ...donationForm, amount: e.target.value })} style={{ ...s.inputSm, maxWidth: 120 }} placeholder="Amount ₹" />
                          <button onClick={addDonation} style={s.btnPrimary}>Add</button>
                          <button onClick={() => setSelectedNgo(null)} style={s.btnSecondary}>Cancel</button>
                        </div>
                      ) : (
                        <button onClick={() => setSelectedNgo(ngo.id)} style={s.btnSecondary}>+ Record Donation</button>
                      )}
                    </div>
                  )}

                  {/* Donation log */}
                  {nDonations.length > 0 && (
                    <div style={s.donationLog}>
                      <p style={s.donationLogTitle}>Recent Donations</p>
                      <div style={s.donationLogList}>
                        {nDonations.slice(0, 8).map(d => (
                          <div key={d.id} style={s.donationRow}>
                            <span style={s.donorName}>{d.donor_name}</span>
                            <span style={s.donorAmount}>₹{parseFloat(d.amount).toLocaleString('en-IN')}</span>
                          </div>
                        ))}
                      </div>
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

function StatCard({ icon, value, label, bg, accent = '#2563EB' }) {
  return (
    <div style={{ background: bg, border: '1px solid #E2E8F0', borderRadius: 11, padding: '14px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ width: 38, height: 38, borderRadius: 8, background: 'white', border: '1px solid #E2E8F0', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div>
        <p style={{ fontSize: 20, fontWeight: 800, color: '#0F172A', margin: 0, letterSpacing: '-0.5px' }}>{value}</p>
        <p style={{ fontSize: 11.5, color: '#6B7280', margin: '1px 0 0' }}>{label}</p>
      </div>
    </div>
  );
}

function FieldBlock({ label, children }) {
  return (
    <div>
      <label style={{ display: 'block', fontSize: 12.5, fontWeight: 600, color: '#374151', marginBottom: 6 }}>{label}</label>
      {children}
    </div>
  );
}

function MiniStat({ label, value }) {
  return (
    <div style={{ textAlign: 'center' }}>
      <p style={{ fontSize: 10, color: '#9CA3AF', margin: '0 0 2px', textTransform: 'uppercase', fontWeight: 600, letterSpacing: '0.4px' }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: '#0F172A', margin: 0 }}>{value}</p>
    </div>
  );
}

const s = {
  page: { minHeight: '100vh', background: '#F1F5F9', fontFamily: FONT, color: '#111827' },
  nav: { background: 'white', borderBottom: '1px solid #E2E8F0', padding: '0 28px', height: 56, display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, zIndex: 100, boxShadow: '0 1px 3px rgba(0,0,0,0.06)' },
  navLogo: { display: 'flex', alignItems: 'center', gap: 9 },
  navLogoText: { fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.3px' },
  navRoleBadge: { fontSize: 11, fontWeight: 700, background: '#F5F3FF', color: '#7C3AED', border: '1px solid #DDD6FE', padding: '2px 8px', borderRadius: 20 },
  navRight: { display: 'flex', alignItems: 'center', gap: 12 },
  navBack: { display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#6B7280', textDecoration: 'none' },

  body: { maxWidth: 1100, margin: '0 auto', padding: '28px 28px 48px' },
  pageHead: { marginBottom: 22 },
  eyebrow: { fontSize: 11, fontWeight: 600, color: '#7C3AED', textTransform: 'uppercase', letterSpacing: '0.8px', margin: '0 0 4px' },
  pageTitle: { fontSize: 26, fontWeight: 800, color: '#0F172A', margin: '0 0 4px', letterSpacing: '-0.5px' },
  pageSubtitle: { fontSize: 14, color: '#6B7280', margin: 0 },

  statsRow: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginBottom: 20 },

  card: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '20px 22px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)', marginBottom: 18 },
  cardHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 14 },
  cardTitle: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 },
  cardSubtitle: { fontSize: 12.5, color: '#9CA3AF', margin: '3px 0 0' },
  closeBtn: { background: '#F1F5F9', border: 'none', borderRadius: 7, width: 28, height: 28, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', color: '#6B7280' },
  formGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 14 },
  assignRow: { display: 'flex', gap: 12, alignItems: 'flex-end' },
  btnRow: { display: 'flex', gap: 8 },

  input: { width: '100%', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, color: '#0F172A', fontSize: 14, fontFamily: FONT, boxSizing: 'border-box', outline: 'none' },
  inputSm: { padding: '8px 10px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, color: '#0F172A', fontSize: 13, fontFamily: FONT, outline: 'none' },

  btnPrimary: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: '#2563EB', color: 'white', border: 'none', borderRadius: 8, fontSize: 13.5, fontWeight: 700, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap', boxShadow: '0 2px 6px rgba(37,99,235,0.25)' },
  btnSecondary: { display: 'flex', alignItems: 'center', gap: 6, padding: '9px 16px', background: 'white', color: '#374151', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 13.5, fontWeight: 600, cursor: 'pointer', fontFamily: FONT, whiteSpace: 'nowrap' },

  ngoGrid: { display: 'grid', gap: 16 },
  ngoCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '18px 20px', boxShadow: '0 1px 4px rgba(0,0,0,0.04)' },
  ngoCardHead: { display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14 },
  ngoIconWrap: { width: 40, height: 40, borderRadius: 9, background: '#EFF6FF', border: '1px solid #BFDBFE', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  ngoName: { fontSize: 15, fontWeight: 700, color: '#0F172A', margin: 0 },
  ngoContact: { fontSize: 12, color: '#9CA3AF', margin: '2px 0 0' },
  statusBadge: { fontSize: 11.5, fontWeight: 700, padding: '3px 10px', borderRadius: 20, whiteSpace: 'nowrap' },

  ngoProgress: { marginBottom: 14 },
  progressLabelRow: { display: 'flex', justifyContent: 'space-between', marginBottom: 6 },
  progressLabel: { fontSize: 12.5, color: '#6B7280' },
  progressPct: { fontSize: 12.5, fontWeight: 700, color: '#374151' },
  progressBar: { height: 7, background: '#F1F5F9', borderRadius: 4, overflow: 'hidden', marginBottom: 12 },
  progressFill: { height: '100%', borderRadius: 4, transition: 'width 0.5s ease' },
  miniStatsRow: { display: 'flex', gap: 20 },

  infoPanel: { background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 9, padding: '12px 14px', marginBottom: 12 },
  infoPanelMeta: { fontSize: 12, color: '#6B7280', margin: '0 0 4px' },
  infoPanelStatus: { fontSize: 14, fontWeight: 700, margin: 0 },

  shippedBanner: { display: 'flex', alignItems: 'center', gap: 7, background: '#ECFDF5', border: '1px solid #A7F3D0', borderRadius: 9, padding: '10px 14px', marginBottom: 12, fontSize: 13.5, color: '#059669', fontWeight: 600 },

  donationSection: { marginBottom: 12 },
  donationForm: { display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' },

  donationLog: { borderTop: '1px solid #F1F5F9', paddingTop: 12 },
  donationLogTitle: { fontSize: 11, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', letterSpacing: '0.6px', margin: '0 0 8px' },
  donationLogList: { maxHeight: 140, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 2 },
  donationRow: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '6px 0', borderBottom: '1px solid #F8FAFC' },
  donorName: { fontSize: 13, color: '#374151' },
  donorAmount: { fontSize: 13, fontWeight: 700, color: '#059669' },

  loadingWrap: { display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '48px 0', gap: 12 },
  spinner: { width: 32, height: 32, border: '3px solid #E2E8F0', borderTopColor: '#2563EB', borderRadius: '50%', animation: 'spin 0.8s linear infinite' },
  loadingText: { fontSize: 13.5, color: '#9CA3AF', margin: 0 },
  emptyCard: { background: 'white', border: '1px solid #E2E8F0', borderRadius: 12, padding: '32px 24px', textAlign: 'center' },
  emptyText: { fontSize: 14, color: '#9CA3AF', margin: 0 },
  portalLink: { display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 12, fontWeight: 600, color: '#2563EB', textDecoration: 'none', background: '#EFF6FF', border: '1px solid #BFDBFE', padding: '4px 10px', borderRadius: 20, whiteSpace: 'nowrap', flexShrink: 0 },
};
