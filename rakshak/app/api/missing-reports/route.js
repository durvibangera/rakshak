import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractFaceEmbedding, findBestMatch, cosineSimilarity, FACE_MATCH_THRESHOLD } from '@/lib/ai/faceRecognition';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * POST /api/missing-reports — File a missing person report
 * Body: { reported_by, name, photo, age, gender, relationship,
 *         last_known_location, last_known_lat, last_known_lng,
 *         identifying_details, phone_of_missing,
 *         missing_user_id?, missing_dependent_id? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const {
      reported_by,
      name,
      photo,
      age,
      gender,
      relationship,
      last_known_location,
      last_known_lat,
      last_known_lng,
      identifying_details,
      phone_of_missing,
      missing_user_id,
      missing_dependent_id,
      // Structured attributes
      age_min,
      age_max,
      height,
      build,
      skin_tone,
      hair_color,
      hair_length,
      facial_hair,
      distinguishing_marks,
      clothing_description,
      accessories,
    } = body;

    // Validate at least one identifying field is provided
    if (!name && !photo && !phone_of_missing && !identifying_details) {
      return NextResponse.json({ 
        error: 'Provide at least one identifying field: name, photo, phone, or description' 
      }, { status: 400 });
    }

    // Upload photo if provided
    let photo_url = null;
    let face_encoding = null;

    if (photo) {
      // Extract real 512-dim ArcFace embedding via Python face service
      const embResult = await extractFaceEmbedding(photo);
      if (embResult.success) {
        face_encoding = embResult.embedding;
      }

      const base64Body = photo.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Body, 'base64');
      const fileName = `missing/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('photos')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
    }

    const report = {
      reported_by: reported_by || null,
      missing_user_id: missing_user_id || null,
      missing_dependent_id: missing_dependent_id || null,
      name: name || null,
      photo_url,
      face_encoding,
      age: age ? parseInt(age) : null,
      gender: gender || null,
      relationship: relationship || null,
      last_known_location: last_known_location || null,
      last_known_lat: last_known_lat || null,
      last_known_lng: last_known_lng || null,
      identifying_details: identifying_details || null,
      phone_of_missing: phone_of_missing || null,
      status: 'active',
      // Structured attributes
      age_min: age_min ? parseInt(age_min) : null,
      age_max: age_max ? parseInt(age_max) : null,
      height: height || null,
      build: build || null,
      skin_tone: skin_tone || null,
      hair_color: hair_color || null,
      hair_length: hair_length || null,
      facial_hair: facial_hair || null,
      distinguishing_marks: distinguishing_marks || null,
      clothing_description: clothing_description || null,
      accessories: accessories || null,
    };

    const { data, error: dbErr } = await supabase
      .from('missing_reports')
      .insert(report)
      .select()
      .single();

    if (dbErr) {
      console.error('[MissingReports] Insert error:', dbErr);
      return NextResponse.json({ error: 'Failed to file report', details: dbErr.message }, { status: 500 });
    }

    // ── Auto-match: cross-check against camp users + unidentified persons ──
    let autoMatch = null;
    if (face_encoding || phone_of_missing || name) {
      autoMatch = await attemptAutoMatch(supabase, face_encoding, data.id, { phone_of_missing, name });
    }

    return NextResponse.json({
      success: true,
      report: data,
      autoMatch,
    });
  } catch (err) {
    console.error('[MissingReports] Error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * GET /api/missing-reports?status=active&reported_by=uuid&reporter_phone=+91...&phone_of_missing=+91...&limit=50
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const status = searchParams.get('status');
    const reported_by = searchParams.get('reported_by');
    const reporter_phone = searchParams.get('reporter_phone');
    const phone_of_missing = searchParams.get('phone_of_missing');
    const limit = parseInt(searchParams.get('limit') || '50');

    // If searching by reporter phone, first resolve the user ID
    if (reporter_phone) {
      const { data: reporter } = await supabase
        .from('users')
        .select('id')
        .eq('phone', reporter_phone)
        .single();

      if (!reporter) {
        return NextResponse.json({ reports: [] });
      }

      let query = supabase
        .from('missing_reports')
        .select('*')
        .eq('reported_by', reporter.id)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 });
      }
      return NextResponse.json({ reports: data || [] });
    }

    // Search by phone of the missing person
    if (phone_of_missing) {
      let query = supabase
        .from('missing_reports')
        .select('*')
        .eq('phone_of_missing', phone_of_missing)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (status) query = query.eq('status', status);

      const { data, error } = await query;
      if (error) {
        return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 });
      }
      return NextResponse.json({ reports: data || [] });
    }

    let query = supabase
      .from('missing_reports')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (status) query = query.eq('status', status);
    if (reported_by) query = query.eq('reported_by', reported_by);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ reports: data || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/missing-reports — Update status / matching info
 * Body: { id, status?, matched_camp_id?, matched_camp_name?,
 *         matched_unidentified_id?, matched_user_id?, match_confidence?,
 *         reviewer_notes?, reviewed_by? }
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (!body.id) {
      return NextResponse.json({ error: 'Report ID required' }, { status: 400 });
    }

    const updates = { updated_at: new Date().toISOString() };

    const allowedFields = [
      'status', 'matched_camp_id', 'matched_camp_name',
      'matched_unidentified_id', 'matched_user_id', 'match_confidence',
      'reviewer_notes', 'reviewed_by', 'notified_at', 'notification_method',
    ];

    for (const field of allowedFields) {
      if (body[field] !== undefined) updates[field] = body[field];
    }

    if (body.status === 'under_review' || body.status === 'reunited') {
      updates.reviewed_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('missing_reports')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Update failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, report: data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════
// AUTO-MATCH: Compare face against checked-in users + unidentified persons
// ═══════════════════════════════════════════════════════════

// Use cosineSimilarity from shared faceRecognition lib

async function attemptAutoMatch(supabase, faceEncoding, reportId, { phone_of_missing, name } = {}) {
  const THRESHOLD = FACE_MATCH_THRESHOLD;

  // 1. Check against all users (face + phone + name)
  const { data: users } = await supabase
    .from('users')
    .select('id, name, phone, face_encoding, assigned_camp_id');

  let bestUserMatch = null;
  let bestUserScore = 0;
  let bestUserMethod = null;

  for (const user of (users || [])) {
    let score = 0;
    let method = null;

    // Face match (highest priority)
    if (faceEncoding && user.face_encoding) {
      const faceScore = cosineSimilarity(faceEncoding, user.face_encoding);
      if (faceScore >= THRESHOLD && faceScore > score) {
        score = faceScore;
        method = 'face';
      }
    }

    // Phone match (second priority - very reliable)
    if (!method && phone_of_missing && user.phone) {
      const normMissing = phone_of_missing.replace(/\D/g, '').slice(-10);
      const normUser = user.phone.replace(/\D/g, '').slice(-10);
      if (normMissing && normUser && normMissing === normUser) {
        score = 0.95;
        method = 'phone';
      }
    }

    // Name match (lowest priority - only used as weak signal for manual review)
    // Only consider if name is provided and no better match exists
    if (!method && name && user.name) {
      if (name.toLowerCase().trim() === user.name.toLowerCase().trim()) {
        score = 0.60; // Reduced from 0.70 - name alone is unreliable
        method = 'name';
      }
    }

    if (score > bestUserScore && method) {
      bestUserScore = score;
      bestUserMatch = user;
      bestUserMethod = method;
    }
  }

  // 2. Check against unidentified persons (face only — they don't have phone/name)
  const { data: unidentified } = await supabase
    .from('unidentified_persons')
    .select('id, camp_id, face_encoding, approximate_age, gender, identifying_marks, status')
    .eq('status', 'unidentified');

  let bestUnidentifiedMatch = null;
  let bestUnidentifiedScore = 0;

  if (faceEncoding) {
    for (const person of (unidentified || [])) {
      if (!person.face_encoding) continue;
      const score = cosineSimilarity(faceEncoding, person.face_encoding);
      if (score > bestUnidentifiedScore) {
        bestUnidentifiedScore = score;
        bestUnidentifiedMatch = person;
      }
    }
  }

  // 3. Determine best overall match
  const bestScore = Math.max(bestUserScore, bestUnidentifiedScore);
  // For face matching use THRESHOLD, for phone/name matching they already have built-in thresholds
  if (bestScore < 0.5) return null;

  const matchUpdate = {
    status: 'match_found',
    match_confidence: bestScore,
    updated_at: new Date().toISOString(),
  };

  if (bestUserScore >= bestUnidentifiedScore && bestUserMatch) {
    matchUpdate.matched_user_id = bestUserMatch.id;

    // Try to find which camp they're checked into
    if (bestUserMatch.assigned_camp_id) {
      matchUpdate.matched_camp_id = bestUserMatch.assigned_camp_id;
      const { data: camp } = await supabase
        .from('camps')
        .select('name')
        .eq('id', bestUserMatch.assigned_camp_id)
        .single();
      if (camp) matchUpdate.matched_camp_name = camp.name;
    } else {
      // Check camp_victims for latest camp
      const { data: cv } = await supabase
        .from('camp_victims')
        .select('camp_id, camps(name)')
        .eq('user_id', bestUserMatch.id)
        .order('checked_in_at', { ascending: false })
        .limit(1)
        .single();
      if (cv) {
        matchUpdate.matched_camp_id = cv.camp_id;
        matchUpdate.matched_camp_name = cv.camps?.name;
      }
    }
  } else if (bestUnidentifiedMatch) {
    matchUpdate.matched_unidentified_id = bestUnidentifiedMatch.id;
    if (bestUnidentifiedMatch.camp_id) {
      matchUpdate.matched_camp_id = bestUnidentifiedMatch.camp_id;
      const { data: camp } = await supabase
        .from('camps')
        .select('name')
        .eq('id', bestUnidentifiedMatch.camp_id)
        .single();
      if (camp) matchUpdate.matched_camp_name = camp.name;
    }

    // Update unidentified person's status
    await supabase
      .from('unidentified_persons')
      .update({ status: 'matched', matched_at: new Date().toISOString() })
      .eq('id', bestUnidentifiedMatch.id);
  }

  // Update the missing report with match info
  await supabase
    .from('missing_reports')
    .update(matchUpdate)
    .eq('id', reportId);

  return {
    type: bestUserScore >= bestUnidentifiedScore ? 'registered_user' : 'unidentified_person',
    confidence: bestScore,
    matched_camp_name: matchUpdate.matched_camp_name || null,
    matched_user: bestUserScore >= bestUnidentifiedScore ? { id: bestUserMatch.id, name: bestUserMatch.name } : null,
  };
}
