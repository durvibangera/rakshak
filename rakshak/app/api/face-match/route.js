import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractFaceEmbedding, findBestMatch, FACE_MATCH_THRESHOLD } from '@/lib/ai/faceRecognition';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { photo, camp_id, mode } = await request.json();
    // mode: 'checkin' (default) — match against registered users
    //        'missing' — match against missing_reports + unidentified_persons
    //        'all' — match against everything

    if (!photo) {
      return NextResponse.json({ error: 'Photo is required' }, { status: 400 });
    }

    // ── Extract 512-dim ArcFace embedding via Python service ──
    const embeddingResult = await extractFaceEmbedding(photo);
    if (!embeddingResult.success) {
      return NextResponse.json({
        match: false,
        bestScore: 0,
        message: embeddingResult.error || 'Could not extract face embedding',
        results: { registeredUser: null, missingReport: null, unidentifiedPerson: null },
      });
    }

    const capturedEmbedding = embeddingResult.embedding;
    const supabase = getSupabaseAdmin();
    const searchMode = mode || 'checkin';

    const results = {
      registeredUser: null,
      missingReport: null,
      unidentifiedPerson: null,
    };

    // ── 1. Match against registered users ──
    if (searchMode === 'checkin' || searchMode === 'all') {
      const { data: users } = await supabase
        .from('users')
        .select('id, name, phone, state, address, selfie_url, registration_type, qr_code_id, face_encoding, blood_group, medical_conditions, disability_status')
        .not('face_encoding', 'is', null);

      const { match: bestUser, score: bestUserScore } = findBestMatch(capturedEmbedding, users || []);

      if (bestUser) {
        if (camp_id) {
          await supabase.from('camp_victims').upsert({
            camp_id,
            user_id: bestUser.id,
            checked_in_via: 'face',
          }, { onConflict: 'camp_id,user_id' });
        }
        const { face_encoding, ...safeUser } = bestUser;
        results.registeredUser = { user: safeUser, score: bestUserScore };
      }
    }

    // ── 2. Match against missing reports ──
    if (searchMode === 'missing' || searchMode === 'all') {
      const { data: reports } = await supabase
        .from('missing_reports')
        .select('id, name, photo_url, face_encoding, age, gender, relationship, last_known_location, phone_of_missing, status, reported_by')
        .not('face_encoding', 'is', null)
        .in('status', ['active', 'match_found']);

      const { match: bestReport, score: bestReportScore } = findBestMatch(capturedEmbedding, (reports || []).map(r => ({ ...r, id: r.id })));

      if (bestReport) {
        const { face_encoding, ...safeReport } = bestReport;
        results.missingReport = { report: safeReport, score: bestReportScore };
      }
    }

    // ── 3. Match against unidentified persons ──
    if (searchMode === 'missing' || searchMode === 'all') {
      const { data: unidentified } = await supabase
        .from('unidentified_persons')
        .select('id, camp_id, photo_url, face_encoding, approximate_age, gender, injuries, clothing_description, identifying_marks, status, temp_wristband_id')
        .not('face_encoding', 'is', null)
        .eq('status', 'unidentified');

      const { match: bestUnidentified, score: bestUnidentifiedScore } = findBestMatch(capturedEmbedding, unidentified || []);

      if (bestUnidentified) {
        const { face_encoding, ...safePerson } = bestUnidentified;
        results.unidentifiedPerson = { person: safePerson, score: bestUnidentifiedScore };
      }
    }

    // Determine primary match for backward compatibility
    const hasAnyMatch = results.registeredUser || results.missingReport || results.unidentifiedPerson;

    if (hasAnyMatch) {
      const scores = [
        results.registeredUser ? results.registeredUser.score : 0,
        results.missingReport ? results.missingReport.score : 0,
        results.unidentifiedPerson ? results.unidentifiedPerson.score : 0,
      ];
      const bestOverall = Math.max(...scores);

      return NextResponse.json({
        match: true,
        score: Math.round(bestOverall * 100),
        user: results.registeredUser?.user || null,
        results,
      });
    }

    return NextResponse.json({
      match: false,
      bestScore: 0,
      message: 'No matching face found in database',
      results,
    });
  } catch (err) {
    console.error('[FaceMatch] Error:', err);
    return NextResponse.json({ error: 'Face matching failed', details: err.message }, { status: 500 });
  }
}
