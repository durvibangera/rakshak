/**
 * /ngo-pipeline-test    — DEV ONLY
 * End-to-end NGO pipeline test console using real Supabase data.
 *
 * Flow:
 *  Step 1  Camp Admin      → POST /api/resource-requests  (real camp UUID)
 *  Step 2  Super Admin     → POST /api/ngos (register seed NGOs if none exist)
 *  Step 3  Super Admin     → POST /api/ngos/assign
 *  Step 4  NGO             → POST /api/donations
 *  Step 5  NGO             → PATCH /api/ngos (SHIPPED) + POST /api/kit-inventory (IN)
 *  Step 6  Super Admin     → POST /api/ml/predict + POST /api/ml/allocate
 */
'use client';

import { useState, useEffect, useCallback } from 'react';

// ── seed NGOs to register if none exist in DB ─────────────────────
const SEED_NGOS = [
  { name: 'NSS Mumbai Chapter',    contact_email: 'nss@sahaay.in',      contact_phone: '+912200001111', cost_per_kit: 120 },
  { name: 'Red Cross Maharashtra', contact_email: 'redcross@sahaay.in', contact_phone: '+912200002222', cost_per_kit: 120 },
  { name: 'HelpNow Foundation',    contact_email: 'helpnow@sahaay.in',  contact_phone: '+912200003333', cost_per_kit: 120 },
];

const RISK_BADGE = {
  HIGH:   'bg-red-900/60 text-red-300 border border-red-700',
  MEDIUM: 'bg-yellow-900/60 text-yellow-300 border border-yellow-700',
  LOW:    'bg-green-900/60 text-green-300 border border-green-700',
};
const STATUS_BADGE = { IDLE: 'bg-slate-700 text-slate-300', FUNDRAISING: 'bg-blue-900/60 text-blue-300', PRODUCING: 'bg-yellow-900/60 text-yellow-300', SHIPPED: 'bg-green-900/60 text-green-300' };
const URGENCY_COLOR = { CRITICAL: 'text-red-400 font-bold', LOW: 'text-yellow-400 font-semibold', OK: 'text-green-400 font-semibold' };

// ── step header ───────────────────────────────────────────────────
function StepHeader({ num, title, subtitle, actor, done, active }) {
  return (
    <div className={`flex items-start gap-4 p-4 rounded-t-xl border-b ${active ? 'border-slate-600' : 'border-slate-700'}`}>
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 mt-0.5
        ${done ? 'bg-emerald-600 text-white' : active ? 'bg-blue-600 text-white' : 'bg-slate-700 text-slate-400'}`}>
        {done ? '✓' : num}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-semibold text-white">{title}</span>
          <span className={`text-xs px-2 py-0.5 rounded-full border ${
            actor === 'Camp Admin'    ? 'bg-orange-900/50 border-orange-700 text-orange-300' :
            actor === 'Super Admin'   ? 'bg-purple-900/50 border-purple-700 text-purple-300' :
            actor === 'NGO'           ? 'bg-blue-900/50 border-blue-700 text-blue-300' :
            'bg-slate-700 text-slate-400'
          }`}>{actor}</span>
        </div>
        <p className="text-slate-400 text-xs mt-0.5">{subtitle}</p>
      </div>
    </div>
  );
}

// ── log box ───────────────────────────────────────────────────────
function Log({ lines }) {
  if (!lines?.length) return null;
  return (
    <div className="mt-3 bg-slate-950 rounded-lg p-3 text-xs font-mono space-y-0.5 max-h-48 overflow-y-auto border border-slate-800">
      {lines.map((l, i) => (
        <div key={i} className={
          l.startsWith('✅') ? 'text-emerald-400' :
          l.startsWith('❌') ? 'text-red-400' :
          l.startsWith('⚠')  ? 'text-yellow-400' :
          l.startsWith('→')  ? 'text-blue-300' :
          l.startsWith(' ')  ? 'text-slate-500' :
          'text-slate-400'
        }>{l}</div>
      ))}
    </div>
  );
}

// ── local fallback allocation ─────────────────────────────────────
function localAllocate(preds, kits, beta = 0.7, bufferPct = 0.15) {
  const reserve = Math.floor(kits * bufferPct);
  const dist = kits - reserve;
  const PHASE = { SURGE: 0, PLATEAU: 1, DEPLETION: 2 };
  const rows = preds.map((p) => {
    const ph = PHASE[p.phase_name] ?? 1;
    const pb = ph < 2 ? beta : beta * 0.3;
    const pred24 = p.predicted_headcount_24h || p.current_headcount;
    const eff = Math.max(p.current_headcount + pb * (pred24 - p.current_headcount), 1);
    return { ...p, eff, pred24 };
  });
  const total = rows.reduce((s, r) => s + r.eff, 0);
  const allocs = rows.map((r) => {
    const k = Math.floor(dist * r.eff / total);
    const kpp = r.pred24 > 0 ? k / r.pred24 : 0;
    return {
      camp_id: r.camp_id, camp_name: r.camp_name,
      alert_risk: r.alert_risk, camp_phase: r.phase_name,
      current_headcount: r.current_headcount, predicted_headcount: r.pred24,
      kits_allocated: k,
      kits_per_person_at_delivery: Math.round(kpp * 100) / 100,
      urgency: kpp < 0.5 ? 'CRITICAL' : kpp < 0.8 ? 'LOW' : 'OK',
    };
  });
  return { allocations: allocs, total_kits_available: kits, reserve_kits: reserve, total_kits_dispatched: allocs.reduce((s, a) => s + a.kits_allocated, 0), round_number: '(local)' };
}

// ─────────────────────────────────────────────────────────────────
export default function NGOPipelineTestPage() {
  // ── live camps from Supabase ──────────────────────────────────
  const [camps, setCamps]               = useState([]);
  const [campsLoading, setCampsLoading] = useState(true);
  const [campsError, setCampsError]     = useState(null);

  // ── step progress ─────────────────────────────────────────────
  const [step, setStep]             = useState(0);

  // Step 1 — resource request
  const [reqCampId, setReqCampId]   = useState('');
  const [reqNotes, setReqNotes]     = useState('Flood surge — urgent resupply needed');
  const [reqResult, setReqResult]   = useState(null);
  const [reqLog, setReqLog]         = useState([]);

  // Step 2 — register NGOs
  const [ngoResults, setNgoResults] = useState([]);
  const [ngoLog, setNgoLog]         = useState([]);

  // Step 3 — assign kits
  const [totalKitsNeeded, setTotalKitsNeeded] = useState(0);
  const [assignResult, setAssignResult]       = useState(null);
  const [assignLog, setAssignLog]             = useState([]);

  // Step 4 — donations
  const [donationLog, setDonationLog] = useState([]);

  // Step 5 — ship kits
  const [shipLog, setShipLog]             = useState([]);
  const [inventoryBalance, setInventoryBalance] = useState(0);

  // Step 6 — ML allocation
  const [allocation, setAllocation] = useState(null);
  const [mlLog, setMlLog]           = useState([]);

  const [loading, setLoading] = useState(false);

  // ── fetch real camps on mount ─────────────────────────────────
  useEffect(() => {
    fetch('/api/camps')
      .then(r => r.json())
      .then(d => {
        if (d.error) { setCampsError(d.error); return; }
        const list = d.camps || [];
        setCamps(list);
        if (list.length) {
          setReqCampId(list[0].id);
          setTotalKitsNeeded(Math.ceil(list.reduce((s, c) => s + (c.current_headcount || 50), 0) * 0.8));
        }
      })
      .catch(e => setCampsError(e.message))
      .finally(() => setCampsLoading(false));
  }, []);

  // ── api helper: throws on non-ok so errors surface in logs ────
  const api = useCallback(async (url, opts) => {
    const res = await fetch(url, opts);
    const data = await res.json();
    if (!res.ok) throw Object.assign(new Error(data.error || data.details || `HTTP ${res.status}`), { data });
    return data;
  }, []);

  // ─────────────────────────────────────────────────────────────
  // STEP 1 — Camp Admin submits resource request (real camp UUID)
  // ─────────────────────────────────────────────────────────────
  async function doStep1() {
    setLoading(true);
    const log = [];
    const camp = camps.find(c => c.id === reqCampId);
    const headcount = camp?.current_headcount || camp?.capacity || 100;
    const minKits = Math.ceil(headcount * 0.8);

    log.push(`→ POST /api/resource-requests`);
    log.push(`  camp: ${camp?.name ?? reqCampId}  |  headcount: ${headcount}  |  min_kits: ${minKits}`);

    try {
      const data = await api('/api/resource-requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ camp_id: reqCampId, current_headcount: headcount, min_kits_needed: minKits, notes: reqNotes }),
      });
      setReqResult(data.request);
      log.push(`✅ Created — id: ${data.request.id}`);
      log.push(`✅ status: ${data.request.status}  |  min_kits: ${data.request.min_kits_needed}`);
      setStep(s => Math.max(s, 1));
    } catch (err) {
      log.push(`❌ ${err.message}`);
    }
    setReqLog(log);
    setLoading(false);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 2 — Register seed NGOs if fewer than 3 exist
  // ─────────────────────────────────────────────────────────────
  async function doStep2() {
    setLoading(true);
    const log = [];

    try {
      log.push(`→ GET /api/ngos`);
      const gData = await api('/api/ngos');
      let existing = gData.ngos || [];
      log.push(`  Found ${existing.length} existing NGO(s)`);

      if (existing.length >= SEED_NGOS.length) {
        existing.forEach(n => log.push(`✅ ${n.name}  [${n.status}]`));
        setNgoResults(existing);
        setStep(s => Math.max(s, 2));
        setNgoLog(log);
        setLoading(false);
        return;
      }

      for (const ngo of SEED_NGOS) {
        if (existing.find(e => e.contact_email === ngo.contact_email)) {
          log.push(`  • ${ngo.name} already exists`);
          continue;
        }
        log.push(`→ POST /api/ngos — ${ngo.name}`);
        try {
          const d = await api('/api/ngos', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(ngo),
          });
          existing = [...existing, d.ngo];
          log.push(`✅ Registered: ${d.ngo.name}  (${d.ngo.id.slice(0, 8)}…)`);
        } catch (e) {
          log.push(`❌ ${ngo.name}: ${e.message}`);
        }
      }

      setNgoResults(existing);
      setStep(s => Math.max(s, 2));
    } catch (err) {
      log.push(`❌ ${err.message}`);
    }
    setNgoLog(log);
    setLoading(false);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 3 — Assign kits equally across all IDLE/FUNDRAISING NGOs
  // ─────────────────────────────────────────────────────────────
  async function doStep3() {
    setLoading(true);
    const log = [];
    log.push(`→ POST /api/ngos/assign  { total_kits_needed: ${totalKitsNeeded} }`);

    try {
      const data = await api('/api/ngos/assign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ total_kits_needed: totalKitsNeeded }),
      });
      setAssignResult(data);
      log.push(`✅ ${data.kits_per_ngo} kits × ${data.ngos_count} NGOs`);
      (data.assignments || []).forEach(a =>
        log.push(`   • ${a.name}: ${a.kits_assigned} kits  →  raise ₹${a.amount_needed?.toLocaleString()}`)
      );
      // Refresh NGO list to get updated amounts
      const nd = await api('/api/ngos');
      setNgoResults(nd.ngos || []);
      setStep(s => Math.max(s, 3));
    } catch (err) {
      log.push(`❌ ${err.message}`);
    }
    setAssignLog(log);
    setLoading(false);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 4 — Simulate donations (2 per NGO, auto-triggers PRODUCING)
  // ─────────────────────────────────────────────────────────────
  async function doStep4() {
    setLoading(true);
    const log = [];
    const donors = [
      [45000, 'Tata Trust'], [55000, 'Reliance Foundation'],
      [35000, 'Public Crowdfund'], [40000, 'HDFC CSR'],
      [30000, 'Govt Match'], [35000, 'Anonymous'],
    ];

    for (let i = 0; i < ngoResults.length; i++) {
      const ngo = ngoResults[i];
      const pair = donors.slice(i * 2, i * 2 + 2);
      for (const [amount, donor] of pair) {
        log.push(`→ POST /api/donations  ₹${amount.toLocaleString()} from ${donor}  →  ${ngo.name}`);
        try {
          const d = await api('/api/donations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ngo_id: ngo.id, donor_name: donor, amount }),
          });
          log.push(`✅ Recorded  |  running total: ₹${d.ngo?.total_raised?.toLocaleString() ?? '?'}`);
          if (d.ngo?.status === 'PRODUCING') log.push(`✅ ${ngo.name} → PRODUCING`);
          setNgoResults(prev => prev.map(n => n.id === ngo.id ? { ...n, ...d.ngo } : n));
        } catch (e) {
          log.push(`❌ ${e.message}`);
        }
      }
    }

    setDonationLog(log);
    setStep(s => Math.max(s, 4));
    setLoading(false);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 5 — NGOs mark kits SHIPPED + add inventory IN event
  // ─────────────────────────────────────────────────────────────
  async function doStep5() {
    setLoading(true);
    const log = [];
    let runningBalance = 0;

    for (const ngo of ngoResults) {
      const kits = ngo.kits_assigned || Math.ceil(totalKitsNeeded / ngoResults.length);

      log.push(`→ PATCH /api/ngos  ${ngo.name}  →  SHIPPED`);
      try {
        await api('/api/ngos', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: ngo.id, status: 'SHIPPED', kits_shipped: kits, shipped_at: new Date().toISOString() }),
        });
        log.push(`✅ ${ngo.name} status → SHIPPED`);
        setNgoResults(prev => prev.map(n => n.id === ngo.id ? { ...n, status: 'SHIPPED' } : n));
      } catch (e) {
        log.push(`❌ PATCH ngos: ${e.message}`);
      }

      log.push(`→ POST /api/kit-inventory  +${kits} kits IN  source: ${ngo.name}`);
      try {
        const d = await api('/api/kit-inventory', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ event_type: 'IN', kits, source_ngo_id: ngo.id, notes: `Shipped by ${ngo.name}` }),
        });
        runningBalance = d.event?.balance_after ?? (runningBalance + kits);
        log.push(`✅ Inventory +${kits}  |  balance: ${runningBalance}`);
      } catch (e) {
        runningBalance += kits;
        log.push(`❌ kit-inventory: ${e.message}`);
      }
    }

    // Confirm balance from DB
    try {
      const inv = await api('/api/kit-inventory');
      setInventoryBalance(inv.balance ?? runningBalance);
      log.push(`✅ Confirmed inventory balance: ${inv.balance ?? runningBalance}`);
    } catch {
      setInventoryBalance(runningBalance);
      log.push(`⚠ Could not re-read balance — using tally: ${runningBalance}`);
    }

    setShipLog(log);
    setStep(s => Math.max(s, 5));
    setLoading(false);
  }

  // ─────────────────────────────────────────────────────────────
  // STEP 6 — ML predict for all real camps, then allocate
  // ─────────────────────────────────────────────────────────────
  async function doStep6() {
    setLoading(true);
    const log = [];

    log.push(`→ POST /api/ml/predict  ×${camps.length} camps`);
    const preds = await Promise.all(
      camps.map(async (c) => {
        const hc = c.current_headcount || 50;
        try {
          const d = await api('/api/ml/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              camp_id: c.id, camp_name: c.name,
              current_headcount: hc,
              alert_risk: c.risk_level || 'MEDIUM',
              alert_type: 'FLOOD',
              arrivals_last_1h:   Math.round(hc * 0.04),
              arrivals_last_3h:   Math.round(hc * 0.10),
              arrivals_last_6h:   Math.round(hc * 0.18),
              departures_last_1h: Math.round(hc * 0.007),
              departures_last_3h: Math.round(hc * 0.02),
              remaining_pool_estimate: hc * 8,
              day_of_disaster: 1,
            }),
          });
          return { ...c, ...d, camp_id: c.id, camp_name: c.name, current_headcount: hc, alert_risk: c.risk_level || 'MEDIUM' };
        } catch {
          const risk = c.risk_level || 'MEDIUM';
          return {
            ...c, camp_id: c.id, camp_name: c.name, current_headcount: hc, alert_risk: risk,
            predicted_headcount_6h:  Math.round(hc * 1.12),
            predicted_headcount_24h: Math.round(hc * 1.30),
            phase_name: risk === 'HIGH' ? 'SURGE' : 'PLATEAU',
          };
        }
      })
    );
    preds.forEach(p => log.push(`✅ ${p.camp_name || p.name}: now=${p.current_headcount} → T+24h=${p.predicted_headcount_24h} [${p.phase_name}]`));

    const kitBalance = inventoryBalance || totalKitsNeeded;
    log.push(`\n→ POST /api/ml/allocate  ${kitBalance} kits  ×${camps.length} camps`);

    try {
      const aData = await api('/api/ml/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camps: preds.map(p => ({
            camp_id: p.camp_id, camp_name: p.camp_name || p.name,
            current_headcount: p.current_headcount,
            predicted_headcount: p.predicted_headcount_24h,
            phase_name: p.phase_name, alert_risk: p.alert_risk,
          })),
          total_kits_available: kitBalance,
          beta: 0.7, buffer_pct: 0.15, triggered_by: 'ngo_pipeline_test',
        }),
      });
      setAllocation(aData);
      log.push(`✅ Allocation round #${aData.round_number} saved to DB`);
      aData.allocations.forEach(a => log.push(`   → ${a.camp_name}: ${a.kits_allocated} kits [${a.urgency}]`));
      log.push(`✅ Dispatched: ${aData.total_kits_dispatched}  reserved: ${aData.reserve_kits}`);
    } catch (err) {
      log.push(`⚠ allocate API: ${err.message} — using local computation`);
      const local = localAllocate(preds, kitBalance);
      setAllocation(local);
      local.allocations.forEach(a => log.push(`   → ${a.camp_name}: ${a.kits_allocated} kits [${a.urgency}]`));
    }

    setMlLog(log);
    setStep(s => Math.max(s, 6));
    setLoading(false);
  }

  const selectedCamp = camps.find(c => c.id === reqCampId);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6">
      <div className="max-w-5xl mx-auto space-y-4">

        {/* ── Header ── */}
        <div className="bg-slate-900 border border-slate-700 rounded-xl p-5">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <h1 className="text-2xl font-bold text-white">NGO Pipeline Test Console</h1>
              <p className="text-slate-400 text-sm mt-1">
                Full end-to-end flow using live Supabase data — Camp Admin → Super Admin → NGO → Inventory → ML Dispatch
              </p>
            </div>
            <span className="text-xs bg-yellow-900 text-yellow-300 px-3 py-1 rounded-full border border-yellow-700 font-medium">DEV ONLY</span>
          </div>
          <div className="mt-3 text-sm">
            {campsLoading && <span className="text-slate-500">Loading camps from Supabase…</span>}
            {campsError   && <span className="text-red-400">⚠ Camps error: {campsError}</span>}
            {!campsLoading && !campsError && (
              <span className="text-slate-400">
                {camps.length} live camp(s) loaded · Steps completed: <strong className="text-white">{step}/6</strong>
              </span>
            )}
          </div>
          <div className="flex gap-1 mt-3">
            {[1,2,3,4,5,6].map(n => (
              <div key={n} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= n ? 'bg-blue-500' : 'bg-slate-700'}`} />
            ))}
          </div>
        </div>

        {/* ── No camps warning ── */}
        {!campsLoading && camps.length === 0 && (
          <div className="bg-yellow-950 border border-yellow-700 rounded-xl p-4 text-yellow-300 text-sm">
            <strong>No active camps found in Supabase.</strong>{' '}
            Create at least one camp first via the camp register page, then reload.
          </div>
        )}

        {/* ── STEP 1: Camp Admin Request ── */}
        <div className={`bg-slate-900 border rounded-xl transition-opacity ${camps.length === 0 ? 'opacity-40 pointer-events-none' : 'border-slate-700'}`}>
          <StepHeader num={1} title="Camp Admin — Request Resources" actor="Camp Admin"
            subtitle="POST /api/resource-requests — uses real camp UUID from Supabase"
            done={step >= 1} active />
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-400 block mb-1">Select Camp (live DB row)</label>
                <select value={reqCampId} onChange={e => setReqCampId(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white">
                  {camps.map(c => (
                    <option key={c.id} value={c.id}>
                      {c.name} (hc: {c.current_headcount ?? '?'})
                    </option>
                  ))}
                </select>
                {selectedCamp && (
                  <p className="text-xs text-slate-500 mt-0.5 font-mono">{selectedCamp.id}</p>
                )}
              </div>
              <div>
                <label className="text-xs text-slate-400 block mb-1">Notes</label>
                <input value={reqNotes} onChange={e => setReqNotes(e.target.value)}
                  className="w-full bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-sm text-white" />
              </div>
            </div>
            <div className="flex items-center gap-3 flex-wrap">
              <button onClick={doStep1} disabled={loading || !reqCampId}
                className="px-5 py-2 bg-orange-600 hover:bg-orange-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors">
                {loading ? 'Submitting…' : '📋 Submit Request'}
              </button>
              {reqResult && (
                <div className="flex gap-3 text-sm flex-wrap items-center">
                  <span className="text-emerald-400">✓ <code className="bg-slate-800 px-1 rounded text-xs">{reqResult.id?.slice(0, 12)}…</code></span>
                  <span className="text-slate-400">kits: <strong className="text-white">{reqResult.min_kits_needed}</strong></span>
                  <span className="px-2 py-0.5 rounded text-xs bg-yellow-900 text-yellow-300">{reqResult.status}</span>
                </div>
              )}
            </div>
            <Log lines={reqLog} />
          </div>
        </div>

        {/* ── STEP 2: Register NGOs ── */}
        <div className={`bg-slate-900 border rounded-xl transition-colors ${step >= 1 ? 'border-slate-700' : 'border-slate-800 opacity-50 pointer-events-none'}`}>
          <StepHeader num={2} title="Super Admin — Register NGOs" actor="Super Admin"
            subtitle="GET /api/ngos — if fewer than 3 exist, POST to register seed NGOs"
            done={step >= 2} active={step >= 1} />
          <div className="p-5 space-y-3">
            <button onClick={doStep2} disabled={loading || step < 1}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors">
              🏢 Check / Register NGOs
            </button>
            {ngoResults.length > 0 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2 mt-1">
                {ngoResults.map(n => (
                  <div key={n.id} className="bg-slate-800 rounded-lg p-3 text-xs">
                    <div className="font-medium text-white truncate">{n.name}</div>
                    <div className="text-slate-500 mt-0.5 font-mono truncate">{n.id?.slice(0,10)}…</div>
                    <span className={`inline-block mt-1 px-2 py-0.5 rounded text-xs ${STATUS_BADGE[n.status] ?? STATUS_BADGE.IDLE}`}>{n.status ?? 'IDLE'}</span>
                  </div>
                ))}
              </div>
            )}
            <Log lines={ngoLog} />
          </div>
        </div>

        {/* ── STEP 3: Assign Kits ── */}
        <div className={`bg-slate-900 border rounded-xl transition-colors ${step >= 2 ? 'border-slate-700' : 'border-slate-800 opacity-50 pointer-events-none'}`}>
          <StepHeader num={3} title="Super Admin — Assign Kits to NGOs" actor="Super Admin"
            subtitle="POST /api/ngos/assign — divides total equally across all IDLE/FUNDRAISING NGOs"
            done={step >= 3} active={step >= 2} />
          <div className="p-5 space-y-3">
            <div className="flex items-center gap-3 flex-wrap">
              <label className="text-xs text-slate-400">Total kits needed:</label>
              <input type="number" value={totalKitsNeeded} onChange={e => setTotalKitsNeeded(Number(e.target.value))}
                className="w-28 bg-slate-800 border border-slate-600 rounded px-2 py-1 text-sm text-white text-center" />
              <span className="text-xs text-slate-500">≈ live headcount × 0.8</span>
            </div>
            <button onClick={doStep3} disabled={loading || step < 2}
              className="px-5 py-2 bg-purple-600 hover:bg-purple-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors">
              {loading && step === 2 ? 'Assigning…' : '📦 Assign to NGOs'}
            </button>
            {assignResult && (
              <div className="bg-slate-800 rounded-lg p-3 text-xs text-slate-300">
                <strong className="text-white">{assignResult.kits_per_ngo}</strong> kits
                {' × '}<strong className="text-white">{assignResult.ngos_count}</strong> NGOs
                {' = '}<strong className="text-white">{assignResult.total_kits_needed}</strong> total
                {assignResult.kits_per_ngo > 0 && (
                  <span className="text-slate-500 ml-2">· ₹{((assignResult.kits_per_ngo) * 120).toLocaleString()} to raise per NGO</span>
                )}
              </div>
            )}
            <Log lines={assignLog} />
          </div>
        </div>

        {/* ── STEP 4: Donations ── */}
        <div className={`bg-slate-900 border rounded-xl transition-colors ${step >= 3 ? 'border-slate-700' : 'border-slate-800 opacity-50 pointer-events-none'}`}>
          <StepHeader num={4} title="NGO — Fundraising (Donations)" actor="NGO"
            subtitle="POST /api/donations × 6 — auto-triggers PRODUCING when total_raised ≥ amount_needed"
            done={step >= 4} active={step >= 3} />
          <div className="p-5 space-y-3">
            <p className="text-xs text-slate-400">2 donations per NGO using real donor names and NGO IDs.</p>
            <button onClick={doStep4} disabled={loading || step < 3}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors">
              💰 Simulate Donations
            </button>
            {ngoResults.length > 0 && step >= 4 && (
              <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
                {ngoResults.map(n => {
                  const pct = n.amount_needed > 0 ? Math.min(Math.round((n.total_raised || 0) / n.amount_needed * 100), 100) : 0;
                  return (
                    <div key={n.id} className="bg-slate-800 rounded-lg p-3 text-xs">
                      <div className="font-medium text-white mb-1 truncate">{n.name}</div>
                      <div className="flex justify-between text-slate-400 mb-1">
                        <span>₹{(n.total_raised || 0).toLocaleString()}</span>
                        <span>₹{(n.amount_needed || 0).toLocaleString()}</span>
                      </div>
                      <div className="w-full bg-slate-700 rounded-full h-1.5">
                        <div className="bg-blue-500 h-1.5 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                      <div className="flex justify-between mt-1">
                        <span className="text-slate-500">{pct}% funded</span>
                        <span className={`px-1.5 py-0.5 rounded ${STATUS_BADGE[n.status] || STATUS_BADGE.IDLE}`}>{n.status}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
            <Log lines={donationLog} />
          </div>
        </div>

        {/* ── STEP 5: NGO Ships Kits ── */}
        <div className={`bg-slate-900 border rounded-xl transition-colors ${step >= 4 ? 'border-slate-700' : 'border-slate-800 opacity-50 pointer-events-none'}`}>
          <StepHeader num={5} title="NGO — Ship Kits to Inventory" actor="NGO"
            subtitle="PATCH /api/ngos (SHIPPED) + POST /api/kit-inventory (event_type=IN) per NGO"
            done={step >= 5} active={step >= 4} />
          <div className="p-5 space-y-3">
            <p className="text-xs text-slate-400">Each NGO gets a PATCH to SHIPPED and a separate inventory IN event with their real ID.</p>
            <button onClick={doStep5} disabled={loading || step < 4}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors">
              🚚 Ship Kits to Inventory
            </button>
            {step >= 5 && (
              <div className="bg-slate-800 rounded-lg p-3 text-sm">
                <span className="text-slate-400">Central inventory balance: </span>
                <strong className="text-emerald-400 text-lg">{inventoryBalance.toLocaleString()} kits</strong>
              </div>
            )}
            <Log lines={shipLog} />
          </div>
        </div>

        {/* ── STEP 6: ML Allocation ── */}
        <div className={`bg-slate-900 border rounded-xl transition-colors ${step >= 5 ? 'border-slate-700' : 'border-slate-800 opacity-50 pointer-events-none'}`}>
          <StepHeader num={6} title="Super Admin — ML Predict + Dispatch" actor="Super Admin"
            subtitle="POST /api/ml/predict × live camps + POST /api/ml/allocate → dispatch orders in DB"
            done={step >= 6} active={step >= 5} />
          <div className="p-5 space-y-3">
            <button onClick={doStep6} disabled={loading || step < 5}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 rounded-lg text-sm font-medium transition-colors">
              🤖 Run ML Allocation
            </button>
            {allocation && (
              <>
                <div className="flex gap-4 text-sm flex-wrap">
                  <div><span className="text-slate-400">Dispatched: </span><strong className="text-emerald-400">{allocation.total_kits_dispatched} kits</strong></div>
                  <div><span className="text-slate-400">Reserved: </span><strong className="text-yellow-400">{allocation.reserve_kits} kits</strong></div>
                  <div><span className="text-slate-400">Round: </span><strong className="text-white">#{allocation.round_number}</strong></div>
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 border-b border-slate-700">
                        <th className="text-left pb-2">Camp</th>
                        <th className="text-center pb-2">Risk</th>
                        <th className="text-center pb-2">Phase</th>
                        <th className="text-right pb-2">Now</th>
                        <th className="text-right pb-2">T+24h</th>
                        <th className="text-right pb-2">Kits</th>
                        <th className="text-center pb-2">Urgency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {allocation.allocations.map(a => (
                        <tr key={a.camp_id} className="border-b border-slate-800">
                          <td className="py-2 text-white font-medium">{a.camp_name}</td>
                          <td className="py-2 text-center"><span className={`px-1.5 py-0.5 rounded border text-xs ${RISK_BADGE[a.alert_risk] || ''}`}>{a.alert_risk}</span></td>
                          <td className="py-2 text-center text-slate-400">{a.camp_phase}</td>
                          <td className="py-2 text-right font-mono">{a.current_headcount}</td>
                          <td className="py-2 text-right font-mono text-purple-300">{a.predicted_headcount}</td>
                          <td className="py-2 text-right font-mono text-emerald-300 font-bold">{a.kits_allocated}</td>
                          <td className={`py-2 text-center ${URGENCY_COLOR[a.urgency]}`}>
                            {a.urgency === 'CRITICAL' ? '🔴 CRITICAL' : a.urgency === 'LOW' ? '🟡 LOW' : '🟢 OK'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            <Log lines={mlLog} />
          </div>
        </div>

        {/* ── Final Summary ── */}
        {step >= 6 && (
          <div className="bg-emerald-950 border border-emerald-700 rounded-xl p-5 text-center">
            <div className="text-2xl mb-2">✅</div>
            <h2 className="text-lg font-bold text-emerald-300">Pipeline Complete</h2>
            <p className="text-emerald-400/70 text-sm mt-1">
              All steps ran against live Supabase. Check kit_allocation_rounds, kit_dispatch_orders, and kit_inventory tables.
            </p>
            <button
              onClick={() => {
                setStep(0); setReqResult(null); setNgoResults([]); setAssignResult(null);
                setDonationLog([]); setShipLog([]); setAllocation(null);
                setReqLog([]); setNgoLog([]); setAssignLog([]); setMlLog([]);
                setInventoryBalance(0);
              }}
              className="mt-3 px-4 py-2 bg-emerald-800 hover:bg-emerald-700 rounded-lg text-sm text-emerald-200 transition-colors">
              Reset &amp; Run Again
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
