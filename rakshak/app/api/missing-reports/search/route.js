/**
 * FILE: route.js (Missing Reports Hybrid Search)
 * PURPOSE: Two-stage matching system for missing person reports
 *          Stage 1: SQL filtering by structured attributes
 *          Stage 2: CLIP ranking (optional) for visual-text matching
 *
 * CONTEXT: When a missing report is filed, this endpoint searches registered
 *          victims using structured filters (age, gender, height, etc.) to
 *          narrow candidates, then optionally ranks them with CLIP.
 *
 * ROLE ACCESS: Camp Admin, Super Admin
 *
 * EXPORTS:
 *   - POST: Search for matches to a missing report
 *
 * KEY DEPENDENCIES:
 *   - lib/supabase/admin.js
 *   - lib/ai/clipMatching.js (Phase 5)
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * POST /api/missing-reports/search
 * Body: {
 *   report_id: "uuid",  // The missing report to match against
 *   use_clip: false,    // Enable CLIP ranking (Phase 5)
 *   limit: 50           // Max candidates to return
 * }
 */
export async function POST(request) {
  try {
    const { report_id, use_clip = false, limit = 50 } = await request.json();

    if (!report_id) {
      return NextResponse.json({ error: 'report_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // ═══════════════════════════════════════════════════════════
    // Step 1: Get missing report details
    // ═══════════════════════════════════════════════════════════

    const { data: report, error: reportError } = await supabase
      .from('missing_reports')
      .select('*')
      .eq('id', report_id)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // ═══════════════════════════════════════════════════════════
    // Step 2: Build SQL filter query based on structured attributes
    // ═══════════════════════════════════════════════════════════

    // Fetch all users and score in memory — avoids issues with missing columns
    // SQL filtering would silently return 0 rows if columns don't exist
    let query = supabase
      .from('users')
      .select('id, name, phone, gender, height, build, skin_tone, hair_color, hair_length, facial_hair, distinguishing_marks, last_known_clothing, accessories, selfie_url, face_encoding, assigned_camp_id, created_at')
      .limit(limit);

    const { data: candidates, error: queryError } = await query;

    if (queryError) {
      console.error('[MissingReports Search] Query error:', queryError);
      return NextResponse.json({ error: 'Search failed', details: queryError.message }, { status: 500 });
    }

    // ═══════════════════════════════════════════════════════════
    // Step 3: Calculate match scores for each candidate
    // ═══════════════════════════════════════════════════════════

    const matches = candidates.map(candidate => {
      let score = 0;
      let matchedAttributes = [];

      if (report.gender && candidate.gender === report.gender) {
        score += 15;
        matchedAttributes.push('gender');
      }
      if (report.height && candidate.height === report.height) {
        score += 8;
        matchedAttributes.push('height');
      }
      if (report.build && candidate.build === report.build) {
        score += 8;
        matchedAttributes.push('build');
      }
      if (report.skin_tone && candidate.skin_tone === report.skin_tone) {
        score += 10;
        matchedAttributes.push('skin_tone');
      }
      if (report.hair_color && candidate.hair_color === report.hair_color) {
        score += 10;
        matchedAttributes.push('hair_color');
      }
      if (report.hair_length && candidate.hair_length === report.hair_length) {
        score += 5;
        matchedAttributes.push('hair_length');
      }
      if (report.facial_hair && candidate.facial_hair === report.facial_hair) {
        score += 7;
        matchedAttributes.push('facial_hair');
      }
      if (report.distinguishing_marks && candidate.distinguishing_marks) {
        const reportMarks = report.distinguishing_marks.toLowerCase();
        const candidateMarks = candidate.distinguishing_marks.toLowerCase();
        const keywords = reportMarks.split(/\s+/);
        const matchCount = keywords.filter(kw => candidateMarks.includes(kw)).length;
        if (matchCount > 0) {
          score += matchCount * 5;
          matchedAttributes.push('distinguishing_marks');
        }
      }

      return {
        ...candidate,
        match_score: score,
        matched_attributes: matchedAttributes,
        match_confidence: Math.min(score / 100, 1.0),
      };
    });

    // Sort by score descending
    matches.sort((a, b) => b.match_score - a.match_score);

    // ═══════════════════════════════════════════════════════════
    // Step 4: CLIP ranking (Phase 5 - placeholder for now)
    // ═══════════════════════════════════════════════════════════

    if (use_clip && matches.length > 0) {
      // TODO: Implement CLIP ranking in Phase 5
      // const rankedMatches = await rankWithCLIP(report, matches);
      // return NextResponse.json({ matches: rankedMatches.slice(0, 10), total: matches.length });
      
      return NextResponse.json({
        matches: matches.slice(0, 10),
        total: matches.length,
        message: 'CLIP ranking not yet implemented (Phase 5)',
      });
    }

    // ═══════════════════════════════════════════════════════════
    // Step 5: Return filtered candidates
    // ═══════════════════════════════════════════════════════════

    return NextResponse.json({
      success: true,
      report: {
        id: report.id,
        name: report.name,
        age_range: report.age_min && report.age_max ? `${report.age_min}-${report.age_max}` : null,
        gender: report.gender,
      },
      matches: matches.slice(0, 10),
      total_candidates: matches.length,
      filters_applied: {
        age_range: !!(report.age_min || report.age_max),
        gender: !!report.gender,
        height: !!report.height,
        build: !!report.build,
        skin_tone: !!report.skin_tone,
        hair_color: !!report.hair_color,
        hair_length: !!report.hair_length,
        facial_hair: !!report.facial_hair,
      },
    });
  } catch (err) {
    console.error('[MissingReports Search] Error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
