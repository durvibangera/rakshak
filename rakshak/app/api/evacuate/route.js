import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callUsers } from '@/lib/external/callService';
import { DISASTER_MESSAGES, PREPAREDNESS_MESSAGES, getLanguagesForUser } from '@/lib/utils/languageSelector';

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
      alert_id,
      camp_id,
      disaster_type,
      preparedness,
      source_camp_id,
      target_camp_id,
      reason,
    } = body;

    const supabase = getSupabaseAdmin();

    // Mode A: Camp shift / evacuation transfer (used by Evacuate tab)
    if (source_camp_id && target_camp_id) {
      if (source_camp_id === target_camp_id) {
        return NextResponse.json({ error: 'Source and target camp cannot be same' }, { status: 400 });
      }

      const { data: sourceCamp, error: srcErr } = await supabase
        .from('camps')
        .select('id, name')
        .eq('id', source_camp_id)
        .single();
      const { data: targetCamp, error: tgtErr } = await supabase
        .from('camps')
        .select('id, name')
        .eq('id', target_camp_id)
        .single();

      if (srcErr || !sourceCamp) {
        return NextResponse.json({ error: 'Source camp not found' }, { status: 404 });
      }
      if (tgtErr || !targetCamp) {
        return NextResponse.json({ error: 'Target camp not found' }, { status: 404 });
      }

      const { data: sourceRows, error: sourceRowsErr } = await supabase
        .from('camp_victims')
        .select('id, user_id')
        .eq('camp_id', source_camp_id);

      if (sourceRowsErr) {
        return NextResponse.json({ error: 'Failed to load source camp victims', details: sourceRowsErr.message }, { status: 500 });
      }

      if (!sourceRows?.length) {
        return NextResponse.json({ success: true, moved: 0, message: 'No victims to transfer' });
      }

      const sourceUserIds = sourceRows.map((r) => r.user_id).filter(Boolean);
      const { data: targetRows } = await supabase
        .from('camp_victims')
        .select('user_id')
        .eq('camp_id', target_camp_id)
        .in('user_id', sourceUserIds);
      const alreadyInTarget = new Set((targetRows || []).map((r) => r.user_id));

      const moveIds = sourceRows.filter((r) => !alreadyInTarget.has(r.user_id)).map((r) => r.id);
      const duplicateIds = sourceRows.filter((r) => alreadyInTarget.has(r.user_id)).map((r) => r.id);

      if (moveIds.length > 0) {
        const { error: moveErr } = await supabase
          .from('camp_victims')
          .update({ camp_id: target_camp_id, checked_in_via: 'evacuated' })
          .in('id', moveIds);
        if (moveErr) {
          return NextResponse.json({ error: 'Failed to move victims', details: moveErr.message }, { status: 500 });
        }
      }

      // Remove duplicates from source when user already exists in target.
      if (duplicateIds.length > 0) {
        await supabase.from('camp_victims').delete().in('id', duplicateIds);
      }

      // Mark source camp status as evacuated (best-effort).
      await supabase
        .from('camps')
        .update({ status: 'evacuated' })
        .eq('id', source_camp_id);

      return NextResponse.json({
        success: true,
        moved: moveIds.length + duplicateIds.length,
        movedDirectly: moveIds.length,
        skippedAlreadyInTarget: duplicateIds.length,
        sourceCamp: sourceCamp.name,
        targetCamp: targetCamp.name,
        reason: reason || 'Location no longer safe',
      });
    }

    // Mode B: Alert-driven voice calls for a camp (used by Alerts approval)
    if (!camp_id) {
      return NextResponse.json({ error: 'camp_id is required' }, { status: 400 });
    }

    // Get camp details
    const { data: camp, error: campError } = await supabase
      .from('camps')
      .select('*')
      .eq('id', camp_id)
      .single();

    if (campError || !camp) {
      return NextResponse.json({ error: 'Camp not found' }, { status: 404 });
    }

    let nearbyUsers;
    let messages;
    const type = disaster_type || 'FLOOD';
    // Always call only users registered in this camp.
    const { data: campVictims, error: cvError } = await supabase
      .from('camp_victims')
      .select('user_id')
      .eq('camp_id', camp_id);

    if (cvError || !campVictims?.length) {
      return NextResponse.json({
        success: true,
        message: 'No registered users in this camp',
        usersFound: 0,
      });
    }

    const userIds = [...new Set(campVictims.map((cv) => cv.user_id).filter(Boolean))];
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('id, name, phone, state, lat, lng')
      .in('id', userIds)
      .not('phone', 'is', null);

    if (usersError) {
      return NextResponse.json({ error: 'Failed to load camp users', details: usersError.message }, { status: 500 });
    }

    const normalizePhone = (p) => {
      const digits = String(p || '').replace(/\D/g, '');
      if (!digits) return '';
      if (digits.length === 10) return `+91${digits}`;
      if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
      if (String(p).startsWith('+')) return String(p);
      return `+${digits}`;
    };

    // Optional: when using Twilio trial, only call verified numbers listed in env.
    const verifiedList = (process.env.TWILIO_VERIFIED_TO_NUMBERS || process.env.TWILIO_ALLOWED_TO_NUMBERS || '')
      .split(',')
      .map((n) => normalizePhone(n))
      .filter(Boolean);
    const verifiedSet = new Set(verifiedList);

    const dedupByPhone = new Map();
    for (const u of users || []) {
      const np = normalizePhone(u.phone);
      if (!np) continue;
      if (verifiedSet.size > 0 && !verifiedSet.has(np)) continue;
      if (!dedupByPhone.has(np)) dedupByPhone.set(np, { ...u, phone: np });
    }
    nearbyUsers = Array.from(dedupByPhone.values());

    if (nearbyUsers.length === 0) {
      return NextResponse.json({
        success: true,
        message: verifiedSet.size > 0
          ? 'No camp users match your Twilio verified numbers list'
          : 'No users with callable phone numbers in this camp',
        usersFound: 0,
      });
    }

    // For camp evacuation alerts, always use "danger zone / be ready to evacuate" script.
    // This keeps the call wording consistent across alert types.
    messages = PREPAREDNESS_MESSAGES;

    // Build per-user voice messages and logs
    const callData = await Promise.all(nearbyUsers.map(async (user) => {
      const { primary, secondary } = getLanguagesForUser(user.state);
      const voiceMessages = [
        { lang: 'Hindi', langCode: 'hi-IN', text: messages.hi },
      ];
      if (secondary && messages[secondary]) {
        voiceMessages.push({
          lang: secondary,
          langCode: `${secondary}-IN`,
          text: messages[secondary],
        });
      }

      // Log call
      if (alert_id) {
        await supabase.from('call_logs').insert({
          alert_id,
          user_id: user.id,
          phone: user.phone,
          language: secondary ? `hi+${secondary}` : 'hi',
          disaster_type: type,
        });
      }

      return { user, voiceMessages };
    }));

    // Make calls per user so each gets their own native language + Hindi.
    const callResult = { called: 0, skipped: 0, failed: 0, smsFallback: 0 };
    for (const row of callData) {
      const one = await callUsers([row.user], row.voiceMessages);
      callResult.called += one.called || 0;
      callResult.skipped += one.skipped || 0;
      callResult.failed += one.failed || 0;
      callResult.smsFallback += one.smsFallback || 0;
    }

    // Update alert status to calls_sent
    if (alert_id) {
      await supabase.from('camp_alerts').update({
        status: 'calls_sent',
      }).eq('id', alert_id);
    }

    return NextResponse.json({
      success: true,
      campName: camp.name,
      usersFound: nearbyUsers.length,
      targetPhones: nearbyUsers.map((u) => u.phone),
      twilioFilterActive: verifiedSet.size > 0,
      callResult,
      message: `Evacuation calls sent to ${callResult.called} users`,
    });
  } catch (err) {
    console.error('[Evacuate] Error:', err);
    return NextResponse.json({ error: 'Evacuation failed', details: err.message }, { status: 500 });
  }
}
