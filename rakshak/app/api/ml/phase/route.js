/**
 * FILE: route.js (ML Phase Detection)
 * PURPOSE: Detect current disaster phase (SURGE/PLATEAU/DEPLETION) from arrival history.
 * Uses rolling velocity check on arrival data.
 */
import { NextResponse } from 'next/server';

const PHASES = { 0: 'SURGE', 1: 'PLATEAU', 2: 'DEPLETION' };

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      arrival_history = [],
      headcount_history = [],
      remaining_pool = 500,
    } = body;

    if (!arrival_history.length && !headcount_history.length) {
      return NextResponse.json(
        { error: 'arrival_history or headcount_history required' },
        { status: 400 }
      );
    }

    // Analyze arrival velocity trend
    const recentArrivals = arrival_history.slice(-6); // last 6 data points (hourly)
    const olderArrivals = arrival_history.slice(-12, -6);

    const recentAvg = recentArrivals.length > 0
      ? recentArrivals.reduce((s, v) => s + v, 0) / recentArrivals.length
      : 0;
    const olderAvg = olderArrivals.length > 0
      ? olderArrivals.reduce((s, v) => s + v, 0) / olderArrivals.length
      : recentAvg;

    // Velocity change
    const velocityDelta = recentAvg - olderAvg;

    // Check for sustained decline
    let consecutiveDeclines = 0;
    for (let i = recentArrivals.length - 1; i > 0; i--) {
      if (recentArrivals[i] < recentArrivals[i - 1]) {
        consecutiveDeclines++;
      } else {
        break;
      }
    }

    // Headcount trend
    const recentHC = headcount_history.slice(-3);
    const hcGrowing = recentHC.length >= 2 && recentHC[recentHC.length - 1] > recentHC[0];
    const hcShrinking = recentHC.length >= 2 && recentHC[recentHC.length - 1] < recentHC[0] * 0.95;

    // Phase detection logic
    let phase, confidence, reason, transition_recommended;

    if (recentAvg > olderAvg * 1.2 && hcGrowing && remaining_pool > 100) {
      // Arrivals accelerating + headcount growing + people still in pool
      phase = 0; // SURGE
      confidence = Math.min(0.95, 0.7 + (velocityDelta / Math.max(olderAvg, 1)) * 0.2);
      reason = `Arrival velocity increasing (${recentAvg.toFixed(1)}/h vs ${olderAvg.toFixed(1)}/h), headcount growing, pool has ~${remaining_pool} people`;
      transition_recommended = false;
    } else if (consecutiveDeclines >= 4 && remaining_pool < 50 && hcShrinking) {
      // Sustained declining arrivals + pool depleted + headcount shrinking
      phase = 2; // DEPLETION
      confidence = Math.min(0.95, 0.6 + consecutiveDeclines * 0.05);
      reason = `${consecutiveDeclines} consecutive hourly declines, remaining pool ~${remaining_pool}, headcount declining`;
      transition_recommended = true;
    } else {
      // Default to PLATEAU
      phase = 1;
      confidence = 0.7;
      reason = `Arrivals stabilizing (${recentAvg.toFixed(1)}/h), headcount ${hcGrowing ? 'growing slowly' : hcShrinking ? 'modestly declining' : 'stable'}`;
      transition_recommended = false;
    }

    return NextResponse.json({
      phase,
      phase_name: PHASES[phase],
      confidence: Math.round(confidence * 100) / 100,
      reason,
      transition_recommended,
      metrics: {
        recent_avg_arrivals: Math.round(recentAvg * 10) / 10,
        older_avg_arrivals: Math.round(olderAvg * 10) / 10,
        velocity_delta: Math.round(velocityDelta * 10) / 10,
        consecutive_declines: consecutiveDeclines,
        remaining_pool,
      },
    });
  } catch (err) {
    console.error('[ML Phase] Error:', err);
    return NextResponse.json({ error: 'Phase detection failed', details: err.message }, { status: 500 });
  }
}
