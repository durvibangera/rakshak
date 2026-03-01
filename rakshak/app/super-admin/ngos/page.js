/**
 * FILE: page.js (Super Admin — NGO Management & Fundraising Tracker)
 * PURPOSE: Register NGOs, assign kits, track fundraising, manage production pipeline.
 */
'use client';

import { useState, useEffect, useCallback } from 'react';
import RoleGate from '@/components/common/RoleGate';
import { supabase } from '@/lib/supabase/client';

export default function NGOsPage() {
  return (
    <RoleGate allowedRole="super_admin">
      <NGOContent />
    </RoleGate>
  );
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

      // Fetch donations per NGO
      const donMap = {};
      await Promise.all(
        (data.ngos || []).map(async (ngo) => {
          const dRes = await fetch(`/api/donations?ngo_id=${ngo.id}`);
          const dData = await dRes.json();
          donMap[ngo.id] = dData.donations || [];
        })
      );
      setDonations(donMap);
    } catch (e) { console.error(e); }
    setLoading(false);
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel('ngos-realtime')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ngos' }, () => fetchData())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'donations' }, () => fetchData())
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, [fetchData]);

  const registerNGO = async () => {
    if (!form.name.trim()) return;
    await fetch('/api/ngos', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });
    setForm({ name: '', contact_phone: '', contact_email: '', cost_per_kit: 120, campaign_url: '' });
    setShowForm(false);
    fetchData();
  };

  const assignToNGOs = async () => {
    const total = parseInt(totalKitsInput);
    if (!total || total <= 0) return;
    setAssigning(true);
    await fetch('/api/ngos/assign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ total_kits_needed: total }),
    });
    setTotalKitsInput('');
    setAssigning(false);
    fetchData();
  };

  const addDonation = async () => {
    if (!selectedNgo || !donationForm.amount) return;
    await fetch('/api/donations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ngo_id: selectedNgo,
        donor_name: donationForm.donor_name || 'Anonymous',
        amount: parseFloat(donationForm.amount),
      }),
    });
    setDonationForm({ donor_name: '', amount: '' });
    setSelectedNgo(null);
    fetchData();
  };

  const markShipped = async (ngo) => {
    // Set NGO to SHIPPED
    await fetch('/api/ngos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: ngo.id,
        status: 'SHIPPED',
        kits_shipped: ngo.kits_assigned,
        shipped_at: new Date().toISOString(),
      }),
    });
    // Write inventory IN event
    await fetch('/api/kit-inventory', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'IN',
        kits: ngo.kits_assigned,
        source_ngo_id: ngo.id,
        notes: `Shipment from ${ngo.name}`,
      }),
    });
    fetchData();
  };

  const STATUS_COLORS = {
    IDLE: { bg: '#334155', color: '#94A3B8' },
    FUNDRAISING: { bg: '#FEF3C7', color: '#92400E' },
    PRODUCING: { bg: '#DBEAFE', color: '#1E40AF' },
    SHIPPED: { bg: '#D1FAE5', color: '#065F46' },
  };

  const now = Date.now();

  return (
    <div style={S.page}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      <div style={S.container}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <a href="/super-admin/dashboard" style={{ color: '#3B82F6', fontSize: 13, textDecoration: 'none' }}>← Dashboard</a>
            <h1 style={S.title}>🏢 NGO Management</h1>
            <p style={S.subtitle}>Register NGOs, assign kits, track fundraising &amp; production</p>
          </div>
          <button onClick={() => setShowForm(!showForm)} style={S.btnPrimary}>+ Register NGO</button>
        </div>

        {/* Register Form */}
        {showForm && (
          <div style={S.card}>
            <h2 style={S.cardTitle}>Register New NGO</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div>
                <label style={S.label}>NGO Name*</label>
                <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} style={S.input} placeholder="Red Cross Mumbai" />
              </div>
              <div>
                <label style={S.label}>Contact Phone</label>
                <input value={form.contact_phone} onChange={(e) => setForm({ ...form, contact_phone: e.target.value })} style={S.input} placeholder="+91 9876543210" />
              </div>
              <div>
                <label style={S.label}>Contact Email</label>
                <input value={form.contact_email} onChange={(e) => setForm({ ...form, contact_email: e.target.value })} style={S.input} placeholder="ngo@example.com" />
              </div>
              <div>
                <label style={S.label}>Cost per Kit (₹)</label>
                <input type="number" value={form.cost_per_kit} onChange={(e) => setForm({ ...form, cost_per_kit: parseFloat(e.target.value) })} style={S.input} />
              </div>
              <div style={{ gridColumn: '1 / -1' }}>
                <label style={S.label}>Campaign URL</label>
                <input value={form.campaign_url} onChange={(e) => setForm({ ...form, campaign_url: e.target.value })} style={S.input} placeholder="https://fundraiser.example.com" />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
              <button onClick={registerNGO} style={S.btnPrimary}>Register</button>
              <button onClick={() => setShowForm(false)} style={S.btnSecondary}>Cancel</button>
            </div>
          </div>
        )}

        {/* Assign to NGOs */}
        <div style={S.card}>
          <h2 style={S.cardTitle}>📦 Assign Kits to NGOs</h2>
          <p style={{ fontSize: 13, color: '#94A3B8', margin: '0 0 12px' }}>
            Enter total kits needed — divided equally across all available NGOs.
          </p>
          <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={S.label}>Total Kits Needed</label>
              <input type="number" value={totalKitsInput} onChange={(e) => setTotalKitsInput(e.target.value)} style={S.input} placeholder="900" />
            </div>
            <button onClick={assignToNGOs} disabled={assigning} style={{ ...S.btnPrimary, whiteSpace: 'nowrap' }}>
              {assigning ? 'Assigning...' : `Assign to ${ngos.filter(n => ['IDLE', 'FUNDRAISING'].includes(n.status)).length} NGOs`}
            </button>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign: 'center', padding: 40 }}><div style={S.spinner} /></div>
        ) : ngos.length === 0 ? (
          <div style={S.card}><p style={{ color: '#64748B', fontSize: 13 }}>No NGOs registered yet.</p></div>
        ) : (
          /* NGO Cards */
          <div style={{ display: 'grid', gap: 16 }}>
            {ngos.map((ngo) => {
              const sc = STATUS_COLORS[ngo.status] || STATUS_COLORS.IDLE;
              const progress = ngo.amount_needed > 0 ? Math.min(100, (parseFloat(ngo.total_raised || 0) / parseFloat(ngo.amount_needed)) * 100) : 0;
              const isReady = ngo.status === 'PRODUCING' && ngo.production_ready_at && new Date(ngo.production_ready_at).getTime() <= now;
              const nDonations = donations[ngo.id] || [];

              let countdown = '';
              if (ngo.status === 'PRODUCING' && ngo.production_ready_at) {
                const diff = new Date(ngo.production_ready_at).getTime() - now;
                if (diff > 0) {
                  const hrs = Math.floor(diff / 3600000);
                  const mins = Math.floor((diff % 3600000) / 60000);
                  countdown = `${hrs}h ${mins}m remaining`;
                } else {
                  countdown = 'Ready for shipment!';
                }
              }

              return (
                <div key={ngo.id} style={S.card}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
                    <div>
                      <h3 style={{ fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 2px' }}>{ngo.name}</h3>
                      <p style={{ fontSize: 12, color: '#64748B', margin: 0 }}>
                        {ngo.contact_email} {ngo.contact_phone ? `• ${ngo.contact_phone}` : ''}
                      </p>
                    </div>
                    <span style={{ ...S.badge, background: sc.bg, color: sc.color }}>{ngo.status}</span>
                  </div>

                  {/* Assignment info */}
                  {ngo.kits_assigned > 0 && (
                    <div style={{ marginBottom: 12 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94A3B8', marginBottom: 4 }}>
                        <span>₹{parseFloat(ngo.total_raised || 0).toLocaleString()} / ₹{parseFloat(ngo.amount_needed || 0).toLocaleString()}</span>
                        <span>{Math.round(progress)}%</span>
                      </div>
                      <div style={{ background: '#0F172A', borderRadius: 6, height: 8, overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${progress}%`, background: progress >= 100 ? '#22C55E' : 'linear-gradient(90deg, #3B82F6, #8B5CF6)', borderRadius: 6, transition: 'width 0.5s' }} />
                      </div>
                      <div style={{ display: 'flex', gap: 16, marginTop: 8 }}>
                        <MiniStat label="Kits Assigned" value={ngo.kits_assigned} />
                        <MiniStat label="Cost/Kit" value={`₹${ngo.cost_per_kit}`} />
                        <MiniStat label="Kits Produced" value={ngo.kits_produced || 0} />
                        <MiniStat label="Kits Shipped" value={ngo.kits_shipped || 0} />
                      </div>
                    </div>
                  )}

                  {/* Production timeline */}
                  {ngo.status === 'PRODUCING' && (
                    <div style={{ padding: 10, background: '#0F172A', borderRadius: 8, marginBottom: 12 }}>
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                        🏭 Production started: {ngo.production_started_at ? new Date(ngo.production_started_at).toLocaleString() : '—'}
                      </p>
                      <p style={{ fontSize: 13, fontWeight: 700, color: isReady ? '#22C55E' : '#F59E0B', margin: '4px 0 0' }}>
                        {countdown}
                      </p>
                      {isReady && (
                        <button onClick={() => markShipped(ngo)} style={{ ...S.btnPrimary, marginTop: 8, fontSize: 12 }}>
                          📦 Mark as Shipped → Add to Inventory
                        </button>
                      )}
                    </div>
                  )}

                  {ngo.status === 'SHIPPED' && (
                    <div style={{ padding: 10, background: 'rgba(34,197,94,0.1)', borderRadius: 8, marginBottom: 12, border: '1px solid rgba(34,197,94,0.2)' }}>
                      <p style={{ fontSize: 13, color: '#22C55E', margin: 0 }}>
                        ✅ Shipped {ngo.kits_shipped} kits on {ngo.shipped_at ? new Date(ngo.shipped_at).toLocaleDateString() : '—'}
                      </p>
                    </div>
                  )}

                  {/* Add donation */}
                  {['FUNDRAISING'].includes(ngo.status) && (
                    <div style={{ marginBottom: 12 }}>
                      {selectedNgo === ngo.id ? (
                        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
                          <div style={{ flex: 1 }}>
                            <label style={S.label}>Donor Name</label>
                            <input value={donationForm.donor_name} onChange={(e) => setDonationForm({ ...donationForm, donor_name: e.target.value })} style={S.input} placeholder="Anonymous" />
                          </div>
                          <div style={{ flex: 1 }}>
                            <label style={S.label}>Amount (₹)</label>
                            <input type="number" value={donationForm.amount} onChange={(e) => setDonationForm({ ...donationForm, amount: e.target.value })} style={S.input} placeholder="5000" />
                          </div>
                          <button onClick={addDonation} style={S.btnPrimary}>Add</button>
                          <button onClick={() => setSelectedNgo(null)} style={S.btnSecondary}>✕</button>
                        </div>
                      ) : (
                        <button onClick={() => setSelectedNgo(ngo.id)} style={S.btnSecondary}>+ Record Donation</button>
                      )}
                    </div>
                  )}

                  {/* Donation log */}
                  {nDonations.length > 0 && (
                    <div>
                      <p style={{ fontSize: 11, color: '#64748B', fontWeight: 700, textTransform: 'uppercase', marginBottom: 6 }}>Recent Donations</p>
                      <div style={{ maxHeight: 150, overflowY: 'auto' }}>
                        {nDonations.slice(0, 10).map((d) => (
                          <div key={d.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px solid #334155', fontSize: 12 }}>
                            <span style={{ color: '#CBD5E1' }}>{d.donor_name}</span>
                            <span style={{ color: '#34D399', fontWeight: 700 }}>₹{parseFloat(d.amount).toLocaleString()}</span>
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

function MiniStat({ label, value }) {
  return (
    <div>
      <p style={{ fontSize: 10, color: '#64748B', margin: 0, textTransform: 'uppercase', fontWeight: 700 }}>{label}</p>
      <p style={{ fontSize: 16, fontWeight: 800, color: '#F1F5F9', margin: 0 }}>{value}</p>
    </div>
  );
}

const S = {
  page: { minHeight: '100vh', background: '#0F172A', fontFamily: 'system-ui, sans-serif', padding: '20px' },
  container: { maxWidth: 900, margin: '0 auto' },
  title: { fontSize: 26, fontWeight: 800, color: '#F1F5F9', margin: '8px 0 4px', letterSpacing: '-0.5px' },
  subtitle: { fontSize: 14, color: '#64748B', margin: 0 },
  card: { background: '#1E293B', borderRadius: 14, padding: 20, border: '1px solid #334155', marginBottom: 16 },
  cardTitle: { fontSize: 16, fontWeight: 700, color: '#F1F5F9', margin: '0 0 8px' },
  btnPrimary: { background: 'linear-gradient(135deg, #3B82F6, #2563EB)', color: 'white', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  btnSecondary: { background: '#334155', color: '#94A3B8', border: 'none', borderRadius: 10, padding: '8px 18px', fontWeight: 700, fontSize: 13, cursor: 'pointer' },
  label: { display: 'block', fontSize: 12, fontWeight: 600, color: '#94A3B8', marginBottom: 4 },
  input: { width: '100%', padding: '8px 12px', background: '#0F172A', border: '1px solid #334155', borderRadius: 8, color: '#F1F5F9', fontSize: 14, fontFamily: 'inherit', boxSizing: 'border-box' },
  badge: { padding: '4px 12px', borderRadius: 6, fontSize: 11, fontWeight: 700 },
  spinner: { width: 36, height: 36, border: '3px solid #334155', borderTopColor: '#3B82F6', borderRadius: '50%', animation: 'spin 0.8s linear infinite', margin: '0 auto' },
};
