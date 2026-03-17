import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';
import { extractFaceEmbedding, cosineSimilarity, FACE_MATCH_THRESHOLD } from '@/lib/ai/faceRecognition';

export const maxDuration = 30;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      name, phone, address, state, lat, lng,
      blood_group, medical_conditions, current_medications,
      disability_status, languages_spoken,
      emergency_contact_name, emergency_contact_phone,
      selfie_base64, registration_type = 'camp', camp_id,
    } = body;

    const supabase = getSupabaseAdmin();
    const qr_code_id = nanoid(12);

    // Keep inline selfie for reliable UI display. Upload to storage best-effort.
    // This avoids broken image URLs when storage bucket/public access is misconfigured.
    let selfie_url = null;
    if (selfie_base64) {
      selfie_url = selfie_base64;
      const base64Data = selfie_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `selfies/${qr_code_id}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('rakshak')
        .upload(fileName, buffer, {
          contentType: 'image/jpeg',
          upsert: true,
        });

      if (!uploadError) {
        // Upload succeeded; keeping inline URL to ensure image always renders.
      } else {
        console.warn('[Victims API] Storage upload failed, inline selfie will be used:', uploadError.message);
      }
    }

    // Generate face embedding from selfie via Python face service
    let face_encoding = null;
    if (selfie_base64) {
      const embResult = await extractFaceEmbedding(selfie_base64);
      if (embResult.success) {
        face_encoding = embResult.embedding;
      }
    }

    // Build user record — only include non-empty fields
    const userRecord = {
      name: name?.trim() || 'Unknown Victim',
      state: state || 'Maharashtra',
      registration_type,
      qr_code_id,
      updated_at: new Date().toISOString(),
    };

    if (phone?.trim()) userRecord.phone = phone.startsWith('+91') ? phone : `+91${phone.replace(/\D/g, '')}`;
    if (address?.trim()) userRecord.address = address;
    if (lat != null) userRecord.lat = lat;
    if (lng != null) userRecord.lng = lng;
    if (selfie_url) userRecord.selfie_url = selfie_url;
    if (face_encoding) userRecord.face_encoding = face_encoding;
    if (blood_group?.trim()) userRecord.blood_group = blood_group;
    if (medical_conditions?.trim()) userRecord.medical_conditions = medical_conditions;
    if (current_medications?.trim()) userRecord.current_medications = current_medications;
    if (disability_status?.trim()) userRecord.disability_status = disability_status;
    if (languages_spoken?.length) userRecord.languages_spoken = languages_spoken;
    if (emergency_contact_name?.trim()) userRecord.emergency_contact_name = emergency_contact_name;
    if (emergency_contact_phone?.trim()) userRecord.emergency_contact_phone = emergency_contact_phone;

    // If phone is provided and already exists, update that user instead of failing
    let user, insertError;
    if (userRecord.phone) {
      const result = await supabase
        .from('users')
        .upsert(userRecord, { onConflict: 'phone' })
        .select()
        .single();
      user = result.data;
      insertError = result.error;
    } else {
      const result = await supabase
        .from('users')
        .insert(userRecord)
        .select()
        .single();
      user = result.data;
      insertError = result.error;
    }

    if (insertError) {
      console.error('[Victims API] Insert error:', JSON.stringify(insertError));
      return NextResponse.json({ error: 'Failed to register victim', details: insertError.message, code: insertError.code }, { status: 500 });
    }

    // Auto-add to camp if camp_id provided
    if (camp_id && user) {
      await supabase.from('camp_victims').insert({
        camp_id,
        user_id: user.id,
        checked_in_via: 'manual',
      });
    }

    // ── Reverse auto-match: check this person against active missing reports ──
    let autoMatch = null;
    if (user) {
      try {
        autoMatch = await reverseMatchMissingReports(supabase, user, camp_id);
      } catch (matchErr) {
        console.error('[Victims API] Reverse match error (non-fatal):', matchErr.message);
      }
    }

    return NextResponse.json({ success: true, user, qr_code_id, autoMatch });
  } catch (err) {
    console.error('[Victims API] Error:', err);
    return NextResponse.json({ error: 'Registration failed', details: err.message }, { status: 500 });
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const camp_id = searchParams.get('camp_id');
    const search = searchParams.get('search');

    const supabase = getSupabaseAdmin();

    if (camp_id) {
      // Get victims for a specific camp
      const { data: campVictims, error } = await supabase
        .from('camp_victims')
        .select(`
          id, checked_in_at, checked_in_via,
          users:user_id (
            id, name, phone, state, address, selfie_url, blood_group,
            medical_conditions, current_medications, disability_status,
            languages_spoken, emergency_contact_name, emergency_contact_phone,
            registration_type, qr_code_id, created_at
          )
        `)
        .eq('camp_id', camp_id)
        .order('checked_in_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: 'Failed to fetch victims', details: error.message }, { status: 500 });
      }

      const victims = (campVictims || []).map(cv => ({
        ...cv.users,
        checked_in_at: cv.checked_in_at,
        checked_in_via: cv.checked_in_via,
        camp_victim_id: cv.id,
      }));

      return NextResponse.json({ victims, count: victims.length });
    }

    // Search across all users
    let query = supabase
      .from('users')
      .select('id, name, phone, state, address, selfie_url, registration_type, qr_code_id, created_at')
      .order('created_at', { ascending: false })
      .limit(50);

    if (search) {
      query = query.or(`name.ilike.%${search}%,phone.ilike.%${search}%`);
    }

    const { data: users, error } = await query;
    if (error) {
      return NextResponse.json({ error: 'Search failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ victims: users || [], count: users?.length || 0 });
  } catch (err) {
    console.error('[Victims API] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch victims', details: err.message }, { status: 500 });
  }
}

// ═══════════════════════════════════════════════════════════
// REVERSE AUTO-MATCH: When a victim registers, check them against
// all active missing reports (by face, phone, and name).
// If found, update the missing report status to 'match_found'.
// ═══════════════════════════════════════════════════════════

async function reverseMatchMissingReports(supabase, registeredUser, campId) {
  // Fetch all active missing reports
  const { data: activeReports } = await supabase
    .from('missing_reports')
    .select('*')
    .eq('status', 'active');

  if (!activeReports || activeReports.length === 0) return null;

  // Resolve camp name once
  let campName = null;
  if (campId) {
    const { data: camp } = await supabase
      .from('camps')
      .select('name')
      .eq('id', campId)
      .single();
    campName = camp?.name || null;
  }

  const matches = [];

  for (const report of activeReports) {
    let confidence = 0;
    let matchMethod = null;

    // ── Priority 1: Face embedding match ──
    if (registeredUser.face_encoding && report.face_encoding) {
      const faceScore = cosineSimilarity(registeredUser.face_encoding, report.face_encoding);
      if (faceScore >= FACE_MATCH_THRESHOLD) {
        confidence = faceScore;
        matchMethod = 'face';
      }
    }

    // ── Priority 2: Phone number match ──
    if (!matchMethod && registeredUser.phone && report.phone_of_missing) {
      const normRegistered = registeredUser.phone.replace(/\D/g, '').slice(-10);
      const normMissing = report.phone_of_missing.replace(/\D/g, '').slice(-10);
      if (normRegistered && normMissing && normRegistered === normMissing) {
        confidence = 0.95; // Very high confidence for exact phone match
        matchMethod = 'phone';
      }
    }

    // ── Priority 3: Name similarity match ──
    if (!matchMethod && registeredUser.name && report.name) {
      const regName = registeredUser.name.toLowerCase().trim();
      const repName = report.name.toLowerCase().trim();
      if (regName && repName && regName === repName) {
        confidence = 0.70; // Moderate confidence for exact name match
        matchMethod = 'name';
      }
    }

    if (matchMethod) {
      matches.push({ report, confidence, matchMethod });
    }
  }

  if (matches.length === 0) return null;

  // Sort by confidence descending, process the best match
  matches.sort((a, b) => b.confidence - a.confidence);
  const best = matches[0];

  // Update the missing report with match info
  const matchUpdate = {
    status: 'match_found',
    matched_user_id: registeredUser.id,
    match_confidence: best.confidence,
    matched_camp_id: campId || null,
    matched_camp_name: campName || null,
    updated_at: new Date().toISOString(),
  };

  await supabase
    .from('missing_reports')
    .update(matchUpdate)
    .eq('id', best.report.id);

  console.log(`[Victims API] Auto-matched missing report "${best.report.name}" → victim "${registeredUser.name}" (${best.matchMethod}, confidence: ${best.confidence.toFixed(3)})`);

  // Update all other matches as well (less common, but handles cases where
  // one newly registered person matches multiple missing reports)
  for (let i = 1; i < matches.length; i++) {
    const m = matches[i];
    await supabase
      .from('missing_reports')
      .update({
        status: 'match_found',
        matched_user_id: registeredUser.id,
        match_confidence: m.confidence,
        matched_camp_id: campId || null,
        matched_camp_name: campName || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', m.report.id);
  }

  return {
    matchCount: matches.length,
    bestMatch: {
      reportId: best.report.id,
      reportName: best.report.name,
      confidence: best.confidence,
      method: best.matchMethod,
      campName,
    },
  };
}
