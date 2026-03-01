import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractFaceEmbedding, cosineSimilarity, FACE_MATCH_THRESHOLD } from '@/lib/ai/faceRecognition';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * POST /api/unidentified-persons — Register an unknown person at a camp
 * Body: { camp_id, photo, approximate_age, gender, injuries,
 *         clothing_description, identifying_marks, notes,
 *         temp_wristband_id?, registered_by? }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    const {
      camp_id,
      photo,
      approximate_age,
      gender,
      injuries,
      clothing_description,
      identifying_marks,
      notes,
      temp_wristband_id,
      registered_by,
    } = body;

    if (!camp_id) {
      return NextResponse.json({ error: 'Camp ID is required' }, { status: 400 });
    }

    // Upload photo & extract face encoding
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
      const fileName = `unidentified/${Date.now()}_${Math.random().toString(36).slice(2, 8)}.jpg`;

      const { error: uploadErr } = await supabase.storage
        .from('photos')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

      if (!uploadErr) {
        const { data: urlData } = supabase.storage.from('photos').getPublicUrl(fileName);
        photo_url = urlData.publicUrl;
      }
    }

    const record = {
      camp_id,
      photo_url,
      face_encoding,
      approximate_age: approximate_age ? parseInt(approximate_age) : null,
      gender: gender || null,
      injuries: injuries || null,
      clothing_description: clothing_description || null,
      identifying_marks: identifying_marks || null,
      notes: notes || null,
      temp_wristband_id: temp_wristband_id || null,
      registered_by: registered_by || null,
      status: 'unidentified',
    };

    const { data, error: dbErr } = await supabase
      .from('unidentified_persons')
      .insert(record)
      .select()
      .single();

    if (dbErr) {
      console.error('[Unidentified] Insert error:', dbErr);
      return NextResponse.json({ error: 'Failed to register', details: dbErr.message }, { status: 500 });
    }

    // ── Auto-match against missing reports ──
    let autoMatch = null;
    if (face_encoding) {
      autoMatch = await matchAgainstMissingReports(supabase, face_encoding, data.id, camp_id);
    }

    return NextResponse.json({
      success: true,
      person: data,
      autoMatch,
    });
  } catch (err) {
    console.error('[Unidentified] Error:', err);
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * GET /api/unidentified-persons?camp_id=uuid&status=unidentified&limit=50
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const camp_id = searchParams.get('camp_id');
    const status = searchParams.get('status');
    const limit = parseInt(searchParams.get('limit') || '50');

    let query = supabase
      .from('unidentified_persons')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (camp_id) query = query.eq('camp_id', camp_id);
    if (status) query = query.eq('status', status);

    const { data, error } = await query;

    if (error) {
      return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ persons: data || [] });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/unidentified-persons — Update status, match info
 * Body: { id, status?, matched_user_id?, matched_dependent_id?, notes? }
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (!body.id) {
      return NextResponse.json({ error: 'Person ID required' }, { status: 400 });
    }

    const updates = { updated_at: new Date().toISOString() };
    const allowedFields = ['status', 'matched_user_id', 'matched_dependent_id', 'notes', 'temp_wristband_id'];

    for (const f of allowedFields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }

    if (body.status === 'matched' || body.status === 'claimed') {
      updates.matched_at = new Date().toISOString();
    }

    const { data, error } = await supabase
      .from('unidentified_persons')
      .update(updates)
      .eq('id', body.id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Update failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, person: data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════
// AUTO-MATCH: When a new unidentified person is registered,
// compare against active missing reports
// ═══════════════════════════════════════════════════════════

async function matchAgainstMissingReports(supabase, faceEncoding, personId, campId) {
  const THRESHOLD = FACE_MATCH_THRESHOLD;

  const { data: reports } = await supabase
    .from('missing_reports')
    .select('id, name, face_encoding, reported_by, phone_of_missing')
    .eq('status', 'active')
    .not('face_encoding', 'is', null);

  let bestMatch = null;
  let bestScore = 0;

  for (const report of (reports || [])) {
    const score = cosineSimilarity(faceEncoding, report.face_encoding);
    if (score > bestScore) {
      bestScore = score;
      bestMatch = report;
    }
  }

  if (!bestMatch || bestScore < THRESHOLD) return null;

  // Get camp name
  let camp_name = null;
  if (campId) {
    const { data: camp } = await supabase
      .from('camps')
      .select('name')
      .eq('id', campId)
      .single();
    camp_name = camp?.name;
  }

  // Update the missing report with match info
  await supabase
    .from('missing_reports')
    .update({
      status: 'match_found',
      matched_unidentified_id: personId,
      matched_camp_id: campId,
      matched_camp_name: camp_name,
      match_confidence: bestScore,
      updated_at: new Date().toISOString(),
    })
    .eq('id', bestMatch.id);

  // Update unidentified person status
  await supabase
    .from('unidentified_persons')
    .update({
      status: 'matched',
      matched_at: new Date().toISOString(),
    })
    .eq('id', personId);

  return {
    report_id: bestMatch.id,
    missing_name: bestMatch.name,
    confidence: bestScore,
    camp_name,
  };
}
