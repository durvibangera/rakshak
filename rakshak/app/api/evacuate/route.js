import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { callUsers } from '@/lib/external/callService';
import { DISASTER_MESSAGES, PREPAREDNESS_MESSAGES, getLanguagesForUser } from '@/lib/utils/languageSelector';
import { haversineDistance } from '@/lib/utils/distanceCalculator';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { alert_id, camp_id, disaster_type, preparedness } = await request.json();

    if (!camp_id) {
      return NextResponse.json({ error: 'camp_id is required' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

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

    if (preparedness) {
      // Preparedness: everyone registered in this camp (camp_victims) — calls only after approval
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

      const userIds = campVictims.map((cv) => cv.user_id).filter(Boolean);
      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, phone, state, lat, lng')
        .in('id', userIds)
        .not('phone', 'is', null);

      if (usersError || !users?.length) {
        return NextResponse.json({
          success: true,
          message: 'No users with phone in this camp',
          usersFound: 0,
        });
      }

      nearbyUsers = users;
      messages = PREPAREDNESS_MESSAGES;
    } else {
      const radiusKm = camp.radius_km || 10;
      const degOffset = radiusKm / 111;

      const { data: users, error: usersError } = await supabase
        .from('users')
        .select('id, name, phone, state, lat, lng')
        .gte('lat', camp.lat - degOffset)
        .lte('lat', camp.lat + degOffset)
        .gte('lng', camp.lng - degOffset)
        .lte('lng', camp.lng + degOffset)
        .not('phone', 'is', null);

      if (usersError) {
        return NextResponse.json({ error: 'Failed to find users', details: usersError.message }, { status: 500 });
      }

      nearbyUsers = (users || []).filter(u => {
        if (!u.lat || !u.lng || !u.phone) return false;
        return haversineDistance(camp.lat, camp.lng, u.lat, u.lng) <= radiusKm;
      });

      if (nearbyUsers.length === 0) {
        return NextResponse.json({
          success: true,
          message: 'No users found within camp radius',
          usersFound: 0,
        });
      }

      messages = DISASTER_MESSAGES[type] || DISASTER_MESSAGES.FLOOD;
    }

    // Build voice messages for each user and log calls
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
          language: secondary || 'hi',
          disaster_type: type,
        });
      }

      return { user, voiceMessages };
    }));

    // Make voice calls via Twilio
    const primaryMessages = callData[0]?.voiceMessages || [
      { lang: 'Hindi', langCode: 'hi-IN', text: messages.hi },
    ];

    const callResult = await callUsers(
      callData.map(c => c.user),
      primaryMessages
    );

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
      callResult,
      message: `Evacuation calls sent to ${callResult.called} users`,
    });
  } catch (err) {
    console.error('[Evacuate] Error:', err);
    return NextResponse.json({ error: 'Evacuation failed', details: err.message }, { status: 500 });
  }
}
