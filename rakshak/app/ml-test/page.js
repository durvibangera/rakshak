/**
 * FILE: page.js (/ml-test)
 * PURPOSE: Dev-only page to test ML predict + allocate APIs using the
 *          same 8 dummy Mumbai camps from test_run.py — no auth required.
 * VISIT: http://localhost:3000/ml-test
 */
'use client';

import { useState } from 'react';

// Same 8 dummy camps as test_run.py
const DUMMY_CAMPS = [
  {
    camp_id: 'camp-dharavi-001',   camp_name: 'Dharavi Relief Camp',
    current_headcount: 420, camp_capacity: 600, alert_risk: 'HIGH',   alert_type: 'FLOOD',
    arrivals_last_1h: 22, arrivals_last_3h: 55, arrivals_last_6h: 90,
    departures_last_1h: 3, departures_last_3h: 8, arrival_velocity: 0.4,
    remaining_pool_estimate: 3200, day_of_disaster: 1,
  },
  {
    camp_id: 'camp-kurla-002',     camp_name: 'Kurla West Relief Camp',
    current_headcount: 310, camp_capacity: 500, alert_risk: 'HIGH',   alert_type: 'FLOOD',
    arrivals_last_1h: 18, arrivals_last_3h: 40, arrivals_last_6h: 72,
    departures_last_1h: 2, departures_last_3h: 6, arrival_velocity: 0.35,
    remaining_pool_estimate: 1800, day_of_disaster: 1,
  },
  {
    camp_id: 'camp-andheri-003',   camp_name: 'Andheri East Relief Camp',
    current_headcount: 185, camp_capacity: 350, alert_risk: 'MEDIUM', alert_type: 'FLOOD',
    arrivals_last_1h:  7, arrivals_last_3h: 18, arrivals_last_6h: 29,
    departures_last_1h: 2, departures_last_3h: 5, arrival_velocity: 0.2,
    remaining_pool_estimate: 1120, day_of_disaster: 1,
  },
  {
    camp_id: 'camp-bandra-004',    camp_name: 'Bandra Reclamation Camp',
    current_headcount:  95, camp_capacity: 200, alert_risk: 'LOW',    alert_type: 'FLOOD',
    arrivals_last_1h:  4, arrivals_last_3h:  9, arrivals_last_6h: 15,
    departures_last_1h: 1, departures_last_3h: 3, arrival_velocity: 0.12,
    remaining_pool_estimate:  880, day_of_disaster: 1,
  },
  {
    camp_id: 'camp-sion-005',      camp_name: 'Sion Relief Camp',
    current_headcount: 270, camp_capacity: 400, alert_risk: 'MEDIUM', alert_type: 'FLOOD',
    arrivals_last_1h: 12, arrivals_last_3h: 30, arrivals_last_6h: 52,
    departures_last_1h: 2, departures_last_3h: 7, arrival_velocity: 0.25,
    remaining_pool_estimate: 1520, day_of_disaster: 1,
  },
  {
    camp_id: 'camp-malad-006',     camp_name: 'Malad West Relief Camp',
    current_headcount: 140, camp_capacity: 300, alert_risk: 'LOW',    alert_type: 'FLOOD',
    arrivals_last_1h:  5, arrivals_last_3h: 12, arrivals_last_6h: 20,
    departures_last_1h: 1, departures_last_3h: 4, arrival_velocity: 0.15,
    remaining_pool_estimate:  720, day_of_disaster: 1,
  },
  {
    camp_id: 'camp-chembur-007',   camp_name: 'Chembur Relief Camp',
    current_headcount: 230, camp_capacity: 450, alert_risk: 'MEDIUM', alert_type: 'FLOOD',
    arrivals_last_1h:  9, arrivals_last_3h: 22, arrivals_last_6h: 38,
    departures_last_1h: 2, departures_last_3h: 6, arrival_velocity: 0.2,
    remaining_pool_estimate: 1240, day_of_disaster: 1,
  },
  {
    camp_id: 'camp-govandi-008',   camp_name: 'Govandi Relief Camp',
    current_headcount: 380, camp_capacity: 550, alert_risk: 'HIGH',   alert_type: 'FLOOD',
    arrivals_last_1h: 20, arrivals_last_3h: 50, arrivals_last_6h: 88,
    departures_last_1h: 3, departures_last_3h: 9, arrival_velocity: 0.45,
    remaining_pool_estimate: 2080, day_of_disaster: 1,
  },
];

const RISK_COLOR = { HIGH: 'bg-red-100 text-red-700 border-red-200', MEDIUM: 'bg-yellow-100 text-yellow-700 border-yellow-200', LOW: 'bg-green-100 text-green-700 border-green-200' };
const URGENCY_COLOR = { CRITICAL: 'text-red-600 font-bold', LOW: 'text-yellow-600 font-semibold', OK: 'text-green-600 font-semibold' };
const PHASE_COLOR = { SURGE: 'text-red-500', PLATEAU: 'text-yellow-500', DEPLETION: 'text-blue-500' };

export default function MLTestPage() {
  const [predictions, setPredictions]         = useState([]);
  const [allocation, setAllocation]           = useState(null);
  const [loadingPred, setLoadingPred]         = useState(false);
  const [loadingAlloc, setLoadingAlloc]       = useState(false);
  const [totalKits, setTotalKits]             = useState(1624);
  const [error, setError]                     = useState(null);

  // ── Step 1: run /api/ml/predict for each camp ──────────────────
  async function runPredictions() {
    setLoadingPred(true);
    setError(null);
    setPredictions([]);
    setAllocation(null);

    try {
      const results = await Promise.all(
        DUMMY_CAMPS.map(async (c) => {
          const res = await fetch('/api/ml/predict', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              camp_id:               c.camp_id,
              current_headcount:     c.current_headcount,
              alert_risk:            c.alert_risk,
              alert_type:            c.alert_type,
              arrivals_last_1h:      c.arrivals_last_1h,
              arrivals_last_3h:      c.arrivals_last_3h,
              arrivals_last_6h:      c.arrivals_last_6h,
              departures_last_1h:    c.departures_last_1h,
              departures_last_3h:    c.departures_last_3h,
              arrival_velocity:      c.arrival_velocity,
              remaining_pool_estimate: c.remaining_pool_estimate,
              day_of_disaster:       c.day_of_disaster,
            }),
          });
          const data = await res.json();
          return { ...c, ...data };
        })
      );
      setPredictions(results);
    } catch (e) {
      setError(e.message);
    }
    setLoadingPred(false);
  }

  // Local fallback allocation (mirrors ngo_pipeline.py smart_allocate)
  function computeLocalAllocation(preds, kits, beta = 0.7, bufferPct = 0.15) {
    const reserve = Math.floor(kits * bufferPct);
    const distributable = kits - reserve;
    const PHASE_MAP = { SURGE: 0, PLATEAU: 1, DEPLETION: 2 };

    const rows = preds.map((p) => {
      const current = p.current_headcount;
      const pred24  = p.predicted_headcount_24h || current;
      const phase   = PHASE_MAP[p.phase_name] ?? 1;
      const phaseBeta = phase < 2 ? beta : beta * 0.3;
      const eff = Math.max(current + phaseBeta * (pred24 - current), 1);
      return { ...p, effective_demand: Math.round(eff * 10) / 10, pred24 };
    });

    const total = rows.reduce((s, r) => s + r.effective_demand, 0);
    return rows.map((r) => {
      const share = r.effective_demand / total;
      const kitsAllocated = Math.floor(distributable * share);
      const kppNow = r.current_headcount > 0 ? kitsAllocated / r.current_headcount : 0;
      const kppDel = r.pred24 > 0 ? kitsAllocated / r.pred24 : 0;
      const urgency = kppDel < 0.5 ? 'CRITICAL' : kppDel < 0.8 ? 'LOW' : 'OK';
      return {
        camp_id: r.camp_id,
        camp_name: r.camp_name,
        alert_risk: r.alert_risk,
        camp_phase: r.phase_name,
        current_headcount: r.current_headcount,
        predicted_headcount: r.pred24,
        effective_demand: r.effective_demand,
        kits_allocated: kitsAllocated,
        kits_per_person_now: Math.round(kppNow * 100) / 100,
        kits_per_person_at_delivery: Math.round(kppDel * 100) / 100,
        urgency,
      };
    }).reduce((acc, r) => {
      acc.allocations = acc.allocations || [];
      acc.allocations.push(r);
      acc.total_kits_dispatched = (acc.total_kits_dispatched || 0) + r.kits_allocated;
      return acc;
    }, {
      total_kits_available: kits,
      reserve_kits: reserve,
      round_number: '(local)',
      _source: 'local',
    });
  }

  // ── Step 2: run /api/ml/allocate with predictions ──────────────
  async function runAllocation() {
    if (!predictions.length) return;
    setLoadingAlloc(true);
    setError(null);

    try {
      const campsPayload = predictions.map((p) => ({
        camp_id:             p.camp_id,
        camp_name:           p.camp_name,
        current_headcount:   p.current_headcount,
        predicted_headcount: p.predicted_headcount_24h,
        phase_name:          p.phase_name,
        alert_risk:          p.alert_risk,
      }));

      const res = await fetch('/api/ml/allocate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          camps: campsPayload,
          total_kits_available: totalKits,
          beta: 0.7,
          buffer_pct: 0.15,
          triggered_by: 'ml_test_page',
        }),
      });
      const data = await res.json();
      // If DB write fails but we got allocations back, use them; else fallback locally
      if (data.allocations?.length) {
        setAllocation(data);
      } else {
        const local = computeLocalAllocation(predictions, totalKits);
        setAllocation({ ...local, _apiError: data.error || data.details || 'DB write skipped — showing local result' });
      }
    } catch (e) {
      // Network/parse error → compute fully locally
      const local = computeLocalAllocation(predictions, totalKits);
      setAllocation({ ...local, _apiError: e.message + ' — showing local result' });
    }
    setLoadingAlloc(false);
  }

  const totalPeople = DUMMY_CAMPS.reduce((s, c) => s + c.current_headcount, 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6">
      <div className="max-w-6xl mx-auto space-y-6">

        {/* Header */}
        <div className="border border-slate-700 rounded-xl p-5 bg-slate-900">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-white">ML Model Test Console</h1>
              <p className="text-slate-400 text-sm mt-1">
                Tests <code className="bg-slate-800 px-1 rounded">/api/ml/predict</code> &amp;{' '}
                <code className="bg-slate-800 px-1 rounded">/api/ml/allocate</code> with
                8 dummy Mumbai camps from <code className="bg-slate-800 px-1 rounded">test_run.py</code>
              </p>
            </div>
            <span className="text-xs bg-yellow-900 text-yellow-300 px-3 py-1 rounded-full border border-yellow-700">
              DEV ONLY
            </span>
          </div>
          <div className="mt-3 flex gap-4 text-sm text-slate-400">
            <span>8 camps</span>
            <span>·</span>
            <span>{totalPeople.toLocaleString()} total victims</span>
            <span>·</span>
            <span>FLOOD scenario</span>
            <span>·</span>
            <span>Mumbai</span>
          </div>
        </div>

        {error && (
          <div className="bg-red-950 border border-red-700 rounded-lg p-4 text-red-300 text-sm">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Step 1 */}
        <div className="border border-slate-700 rounded-xl bg-slate-900">
          <div className="flex items-center justify-between p-5 border-b border-slate-700">
            <div>
              <h2 className="text-lg font-semibold">Step 1 — Headcount Predictions</h2>
              <p className="text-slate-400 text-xs mt-0.5">POST /api/ml/predict × 8 camps → T+6h &amp; T+24h</p>
            </div>
            <button
              onClick={runPredictions}
              disabled={loadingPred}
              className="px-5 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
            >
              {loadingPred ? 'Running…' : 'Run Predictions'}
            </button>
          </div>

          {predictions.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-slate-400 border-b border-slate-700">
                    <th className="text-left p-3 pl-5">Camp</th>
                    <th className="p-3 text-center">Risk</th>
                    <th className="p-3 text-center">Phase</th>
                    <th className="p-3 text-right">Now</th>
                    <th className="p-3 text-right">T+6h</th>
                    <th className="p-3 text-right">T+24h</th>
                    <th className="p-3 text-right">Δ24h</th>
                    <th className="p-3 text-center">Conf.</th>
                  </tr>
                </thead>
                <tbody>
                  {predictions.map((p, i) => {
                    const delta24 = (p.predicted_headcount_24h || 0) - p.current_headcount;
                    const cap = DUMMY_CAMPS[i].camp_capacity;
                    const occ = Math.round(p.current_headcount / cap * 100);
                    return (
                      <tr key={p.camp_id} className="border-b border-slate-800 hover:bg-slate-800/40">
                        <td className="p-3 pl-5">
                          <div className="font-medium text-white">{p.camp_name}</div>
                          <div className="text-xs text-slate-500">{occ}% occupancy ({p.current_headcount}/{cap})</div>
                        </td>
                        <td className="p-3 text-center">
                          <span className={`text-xs px-2 py-0.5 rounded border ${RISK_COLOR[p.alert_risk] || ''}`}>
                            {p.alert_risk}
                          </span>
                        </td>
                        <td className={`p-3 text-center text-xs font-semibold ${PHASE_COLOR[p.phase_name] || ''}`}>
                          {p.phase_name || '—'}
                        </td>
                        <td className="p-3 text-right font-mono">{p.current_headcount}</td>
                        <td className="p-3 text-right font-mono text-blue-300">{p.predicted_headcount_6h ?? '—'}</td>
                        <td className="p-3 text-right font-mono text-purple-300">{p.predicted_headcount_24h ?? '—'}</td>
                        <td className={`p-3 text-right font-mono text-xs ${delta24 >= 0 ? 'text-red-400' : 'text-green-400'}`}>
                          {delta24 >= 0 ? '+' : ''}{delta24}
                        </td>
                        <td className="p-3 text-center text-xs text-slate-400">
                          {p.confidence ? `${Math.round(p.confidence * 100)}%` : '—'}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {predictions.length === 0 && !loadingPred && (
            <p className="p-5 text-slate-500 text-sm">Click &quot;Run Predictions&quot; to call the API.</p>
          )}
        </div>

        {/* Step 2 */}
        {predictions.length > 0 && (
          <div className="border border-slate-700 rounded-xl bg-slate-900">
            <div className="flex items-center justify-between p-5 border-b border-slate-700">
              <div>
                <h2 className="text-lg font-semibold">Step 2 — Smart Kit Allocation</h2>
                <p className="text-slate-400 text-xs mt-0.5">POST /api/ml/allocate — proportional dispatch with 15% buffer</p>
              </div>
              <div className="flex items-center gap-3">
                <label className="text-xs text-slate-400">Total kits:</label>
                <input
                  type="number"
                  value={totalKits}
                  onChange={(e) => setTotalKits(Number(e.target.value))}
                  className="w-24 px-2 py-1 bg-slate-800 border border-slate-600 rounded text-sm text-white text-center"
                />
                <button
                  onClick={runAllocation}
                  disabled={loadingAlloc}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded-lg text-sm font-medium transition-colors"
                >
                  {loadingAlloc ? 'Allocating…' : 'Run Allocation'}
                </button>
              </div>
            </div>

            {allocation && (
              <>
                {/* Summary bar */}
                <div className="flex gap-6 p-5 border-b border-slate-800 text-sm">
                  <div>
                    <div className="text-slate-400 text-xs">Available</div>
                    <div className="text-white font-semibold">{allocation.total_kits_available?.toLocaleString()} kits</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Dispatched</div>
                    <div className="text-emerald-400 font-semibold">{allocation.total_kits_dispatched?.toLocaleString()} kits</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Reserved (15%)</div>
                    <div className="text-yellow-400 font-semibold">{allocation.reserve_kits?.toLocaleString()} kits</div>
                  </div>
                  <div>
                    <div className="text-slate-400 text-xs">Round #</div>
                    <div className="text-slate-200 font-semibold">{allocation.round_number ?? '—'}</div>
                  </div>
                  {allocation._apiError && (
                    <div className="text-yellow-400 text-xs self-end">
                      ⚠ {allocation._apiError}
                    </div>
                  )}
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-xs text-slate-400 border-b border-slate-700">
                        <th className="text-left p-3 pl-5">Camp</th>
                        <th className="p-3 text-center">Risk</th>
                        <th className="p-3 text-center">Phase</th>
                        <th className="p-3 text-right">Now</th>
                        <th className="p-3 text-right">T+24h</th>
                        <th className="p-3 text-right">Kits</th>
                        <th className="p-3 text-right">K/Person</th>
                        <th className="p-3 text-center">Urgency</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(allocation.allocations || []).map((a) => (
                        <tr key={a.camp_id} className="border-b border-slate-800 hover:bg-slate-800/40">
                          <td className="p-3 pl-5 font-medium text-white">{a.camp_name}</td>
                          <td className="p-3 text-center">
                            <span className={`text-xs px-2 py-0.5 rounded border ${RISK_COLOR[a.alert_risk] || ''}`}>
                              {a.alert_risk}
                            </span>
                          </td>
                          <td className={`p-3 text-center text-xs font-semibold ${PHASE_COLOR[a.camp_phase] || ''}`}>
                            {a.camp_phase}
                          </td>
                          <td className="p-3 text-right font-mono">{a.current_headcount}</td>
                          <td className="p-3 text-right font-mono text-purple-300">{a.predicted_headcount}</td>
                          <td className="p-3 text-right font-mono text-emerald-300 font-semibold">{a.kits_allocated}</td>
                          <td className="p-3 text-right font-mono text-xs text-slate-300">{a.kits_per_person_at_delivery}</td>
                          <td className={`p-3 text-center text-xs ${URGENCY_COLOR[a.urgency] || ''}`}>
                            {a.urgency === 'CRITICAL' ? '🔴 CRITICAL' : a.urgency === 'LOW' ? '🟡 LOW' : '🟢 OK'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {!allocation && !loadingAlloc && (
              <p className="p-5 text-slate-500 text-sm">Click &quot;Run Allocation&quot; to distribute kits across camps.</p>
            )}
          </div>
        )}

        {/* Raw JSON toggle */}
        {(predictions.length > 0 || allocation) && (
          <details className="border border-slate-700 rounded-xl bg-slate-900">
            <summary className="p-4 cursor-pointer text-sm text-slate-400 hover:text-slate-200">
              Raw API responses (JSON)
            </summary>
            <pre className="p-4 text-xs text-slate-300 overflow-auto max-h-96 border-t border-slate-700">
              {JSON.stringify({ predictions, allocation }, null, 2)}
            </pre>
          </details>
        )}

      </div>
    </div>
  );
}
