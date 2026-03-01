import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { extractFaceEmbedding } from '@/lib/ai/faceRecognition';

export const maxDuration = 30;

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

/**
 * POST /api/dependents — Register a dependent under a parent user.
 * Body: { parent_user_id, name, relationship, age, gender, photo_base64,
 *         height_cm, identifying_marks, blood_group, medical_conditions,
 *         disability_status, languages_spoken }
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const {
      parent_user_id, parent_phone, name, relationship, age, gender,
      photo_base64, height_cm, identifying_marks, blood_group,
      medical_conditions, disability_status, languages_spoken,
    } = body;

    if (!name?.trim()) {
      return NextResponse.json({ error: 'Dependent name is required' }, { status: 400 });
    }
    if (!relationship?.trim()) {
      return NextResponse.json({ error: 'Relationship is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    // Resolve parent user ID from phone if not provided directly
    let resolvedParentId = parent_user_id;
    if (!resolvedParentId && parent_phone) {
      const formattedPhone = parent_phone.startsWith('+91')
        ? parent_phone
        : `+91${parent_phone.replace(/\D/g, '')}`;
      const { data: parent } = await supabase
        .from('users')
        .select('id')
        .eq('phone', formattedPhone)
        .single();
      if (parent) resolvedParentId = parent.id;
    }

    if (!resolvedParentId) {
      return NextResponse.json({ error: 'Parent user not found' }, { status: 400 });
    }

    // Upload dependent photo if provided
    let photo_url = null;
    let face_encoding = null;
    if (photo_base64) {
      const base64Data = photo_base64.replace(/^data:image\/\w+;base64,/, '');
      const buffer = Buffer.from(base64Data, 'base64');
      const fileName = `dependents/${resolvedParentId}_${Date.now()}.jpg`;

      const { error: uploadError } = await supabase.storage
        .from('rakshak')
        .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage.from('rakshak').getPublicUrl(fileName);
        photo_url = urlData?.publicUrl;
      }

      // Extract real 512-dim ArcFace embedding via Python face service
      face_encoding = null;
      const embResult = await extractFaceEmbedding(photo_base64);
      if (embResult.success) {
        face_encoding = embResult.embedding;
      }
    }

    // Build dependent record
    const depRecord = {
      parent_user_id: resolvedParentId,
      name: name.trim(),
      relationship: relationship.trim(),
    };

    if (age != null) depRecord.age = age;
    if (gender?.trim()) depRecord.gender = gender.trim();
    if (photo_url) depRecord.photo_url = photo_url;
    if (face_encoding) depRecord.face_encoding = face_encoding;
    if (height_cm != null) depRecord.height_cm = height_cm;
    if (identifying_marks?.trim()) depRecord.identifying_marks = identifying_marks.trim();
    if (blood_group?.trim()) depRecord.blood_group = blood_group;
    if (medical_conditions?.trim()) depRecord.medical_conditions = medical_conditions;
    if (disability_status?.trim()) depRecord.disability_status = disability_status;
    if (languages_spoken?.length) depRecord.languages_spoken = languages_spoken;

    const { data: dependent, error: insertError } = await supabase
      .from('dependents')
      .insert(depRecord)
      .select()
      .single();

    if (insertError) {
      console.error('[Dependents API] Insert error:', insertError);
      return NextResponse.json(
        { error: 'Failed to register dependent', details: insertError.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, dependent });
  } catch (err) {
    console.error('[Dependents API] Error:', err);
    return NextResponse.json({ error: 'Registration failed', details: err.message }, { status: 500 });
  }
}

/**
 * GET /api/dependents?parent_id=UUID  or  ?parent_phone=+91XXXXXXXXXX
 * Returns all dependents for a parent user.
 */
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const parent_id = searchParams.get('parent_id');
    const parent_phone = searchParams.get('parent_phone');

    const supabase = getSupabaseAdmin();

    let resolvedParentId = parent_id;
    if (!resolvedParentId && parent_phone) {
      const formattedPhone = parent_phone.startsWith('+91')
        ? parent_phone
        : `+91${parent_phone.replace(/\D/g, '')}`;
      const { data: parent } = await supabase
        .from('users')
        .select('id')
        .eq('phone', formattedPhone)
        .single();
      if (parent) resolvedParentId = parent.id;
    }

    if (!resolvedParentId) {
      return NextResponse.json({ error: 'parent_id or parent_phone is required' }, { status: 400 });
    }

    const { data: dependents, error } = await supabase
      .from('dependents')
      .select('*')
      .eq('parent_user_id', resolvedParentId)
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch dependents', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ dependents: dependents || [], count: dependents?.length || 0 });
  } catch (err) {
    console.error('[Dependents API] Error:', err);
    return NextResponse.json({ error: 'Failed to fetch dependents', details: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/dependents — Update a dependent.
 * Body: { id, ...fields_to_update }
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Dependent id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    updates.updated_at = new Date().toISOString();

    const { data, error } = await supabase
      .from('dependents')
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Failed to update dependent', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, dependent: data });
  } catch (err) {
    console.error('[Dependents API] Error:', err);
    return NextResponse.json({ error: 'Update failed', details: err.message }, { status: 500 });
  }
}
