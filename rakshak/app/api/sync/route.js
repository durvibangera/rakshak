import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { nanoid } from 'nanoid';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const action = await request.json();
    const { action_type, payload, camp_id } = action;

    if (!action_type || !payload) {
      return NextResponse.json({ error: 'action_type and payload are required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    let result = null;

    switch (action_type) {
      case 'register_victim': {
        const qr_code_id = payload.qr_code_id || nanoid(12);
        const userRecord = {
          ...payload,
          qr_code_id,
          registration_type: 'camp',
          updated_at: new Date().toISOString(),
        };
        delete userRecord.selfie_base64;
        delete userRecord.camp_id;

        // Upload selfie if included
        if (payload.selfie_base64) {
          // Keep inline selfie for reliable rendering in camp/user dashboards.
          userRecord.selfie_url = payload.selfie_base64;
          const base64Data = payload.selfie_base64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const fileName = `selfies/${qr_code_id}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('rakshak')
            .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
          if (!uploadError) {
            // Upload succeeded; keep inline URL to prevent broken image links in demos.
          }
        }

        if (!userRecord.name) userRecord.name = 'Unknown Victim';

        const { data: user, error } = await supabase
          .from('users')
          .insert(userRecord)
          .select()
          .single();

        if (error) throw error;

        if (camp_id && user) {
          await supabase.from('camp_victims').insert({
            camp_id,
            user_id: user.id,
            checked_in_via: 'manual',
          });
        }

        result = { user_id: user.id, qr_code_id };
        break;
      }

      case 'checkin_victim': {
        const { user_id, checked_in_via } = payload;
        if (!camp_id || !user_id) throw new Error('camp_id and user_id required');

        await supabase.from('camp_victims').upsert({
          camp_id,
          user_id,
          checked_in_via: checked_in_via || 'manual',
        }, { onConflict: 'camp_id,user_id' });

        result = { checked_in: true };
        break;
      }

      case 'approve_alert': {
        const { alert_id, action: alertAction } = payload;
        if (!alert_id) throw new Error('alert_id required');

        await supabase.from('camp_alerts').update({
          status: alertAction === 'approve' ? 'approved' : 'rejected',
          reviewed_at: new Date().toISOString(),
        }).eq('id', alert_id);

        result = { updated: true };
        break;
      }

      case 'report_missing': {
        // Offline-filed missing person report
        const reportRecord = {
          reporter_name: payload.reporter_name || 'Anonymous',
          reporter_phone: payload.reporter_phone || '',
          missing_name: payload.missing_name,
          missing_age: parseInt(payload.missing_age) || null,
          missing_gender: payload.missing_gender || null,
          last_seen_location: payload.last_seen_location || '',
          description: payload.description || '',
          status: 'active',
          created_at: payload.created_at || new Date().toISOString(),
        };

        // Upload photo if included
        if (payload.photo_base64) {
          const base64Data = payload.photo_base64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const fileName = `missing/${nanoid(12)}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('rakshak')
            .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('rakshak').getPublicUrl(fileName);
            reportRecord.photo_url = urlData?.publicUrl;
          }
        }

        const { data: report, error: reportError } = await supabase
          .from('missing_reports')
          .insert(reportRecord)
          .select()
          .single();

        if (reportError) throw reportError;
        result = { report_id: report.id };
        break;
      }

      case 'update_resources': {
        // Offline camp resource update
        if (!camp_id) throw new Error('camp_id required');

        const updates = {
          updated_at: new Date().toISOString(),
        };
        const fields = ['total_capacity', 'current_population', 'available_beds',
          'food_status', 'water_status', 'medical_supplies',
          'power_status', 'internet_status', 'special_needs_count', 'critical_flag'];
        for (const f of fields) {
          if (payload[f] !== undefined) updates[f] = payload[f];
        }

        const { error: resError } = await supabase
          .from('camp_resources')
          .upsert({ ...updates, camp_id }, { onConflict: 'camp_id' })
          .select()
          .single();

        if (resError) throw resError;
        result = { updated: true };
        break;
      }

      case 'register_unidentified': {
        // Offline unidentified person registration
        if (!camp_id) throw new Error('camp_id required');

        const unidRecord = {
          camp_id,
          estimated_age: payload.estimated_age || null,
          gender: payload.gender || 'unknown',
          physical_description: payload.physical_description || '',
          injuries: payload.injuries || '',
          clothing_description: payload.clothing_description || '',
          distinguishing_marks: payload.distinguishing_marks || '',
          wristband_id: payload.wristband_id || null,
          status: 'unidentified',
          created_at: payload.created_at || new Date().toISOString(),
        };

        if (payload.photo_base64) {
          const base64Data = payload.photo_base64.replace(/^data:image\/\w+;base64,/, '');
          const buffer = Buffer.from(base64Data, 'base64');
          const fileName = `unidentified/${nanoid(12)}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('rakshak')
            .upload(fileName, buffer, { contentType: 'image/jpeg', upsert: true });
          if (!uploadError) {
            const { data: urlData } = supabase.storage.from('rakshak').getPublicUrl(fileName);
            unidRecord.photo_url = urlData?.publicUrl;
          }
        }

        const { data: unidPerson, error: unidError } = await supabase
          .from('unidentified_persons')
          .insert(unidRecord)
          .select()
          .single();

        if (unidError) throw unidError;
        result = { person_id: unidPerson.id };
        break;
      }

      default:
        return NextResponse.json({ error: `Unknown action_type: ${action_type}` }, { status: 400 });
    }

    // Log to offline_queue for audit
    await supabase.from('offline_queue').insert({
      camp_id,
      action_type,
      payload,
      synced: true,
      synced_at: new Date().toISOString(),
    });

    return NextResponse.json({ success: true, result });
  } catch (err) {
    console.error('[Sync API] Error:', err);
    return NextResponse.json({ error: 'Sync failed', details: err.message }, { status: 500 });
  }
}
