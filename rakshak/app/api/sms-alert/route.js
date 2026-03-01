/**
 * FILE: api/sms-alert/route.js
 * PURPOSE: SMS fallback alert API for users without internet.
 *
 * CONTEXT: During disasters, internet is unreliable. This API sends
 *          SMS alerts to affected users as a fallback when push
 *          notifications and voice calls can't reach them.
 *
 * ENDPOINTS:
 *   POST /api/sms-alert — Send SMS to specific users or by area
 *
 * ROLE ACCESS: super_admin, camp_admin
 */

import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

function getTwilioClient() {
  const twilio = require('twilio');
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) throw new Error('Twilio credentials not configured');
  return twilio(sid, token);
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { mode, message, camp_id, phones, alert_type } = body;

    if (!message) {
      return NextResponse.json(
        { error: 'message is required' },
        { status: 400 }
      );
    }

    const supabase = getSupabaseAdmin();
    const fromPhone = process.env.TWILIO_PHONE_NUMBER;

    if (!fromPhone) {
      return NextResponse.json(
        { error: 'TWILIO_PHONE_NUMBER not configured' },
        { status: 500 }
      );
    }

    let targetPhones = [];

    // ─── Determine recipients ───────────────────────────
    if (mode === 'phones' && Array.isArray(phones)) {
      // Direct phone list
      targetPhones = phones.filter(Boolean);
    } else if (mode === 'camp' && camp_id) {
      // All users checked into a specific camp
      const { data: victims } = await supabase
        .from('camp_victims')
        .select('user_id')
        .eq('camp_id', camp_id);

      if (victims?.length > 0) {
        const userIds = victims.map((v) => v.user_id);
        const { data: users } = await supabase
          .from('users')
          .select('phone')
          .in('id', userIds)
          .not('phone', 'is', null);

        targetPhones = (users || []).map((u) => u.phone).filter(Boolean);
      }
    } else if (mode === 'all_registered') {
      // All registered users with phones
      const { data: users } = await supabase
        .from('users')
        .select('phone')
        .not('phone', 'is', null);

      targetPhones = (users || []).map((u) => u.phone).filter(Boolean);
    } else if (mode === 'nearby' && body.lat && body.lng && body.radius_km) {
      // Users near a location (approximate)
      const { data: users } = await supabase
        .from('users')
        .select('phone, lat, lng')
        .not('phone', 'is', null)
        .not('lat', 'is', null);

      const R = 6371; // Earth radius km
      targetPhones = (users || [])
        .filter((u) => {
          if (!u.lat || !u.lng) return false;
          const dLat = ((u.lat - body.lat) * Math.PI) / 180;
          const dLng = ((u.lng - body.lng) * Math.PI) / 180;
          const a =
            Math.sin(dLat / 2) ** 2 +
            Math.cos((body.lat * Math.PI) / 180) *
              Math.cos((u.lat * Math.PI) / 180) *
              Math.sin(dLng / 2) ** 2;
          const dist = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          return dist <= body.radius_km;
        })
        .map((u) => u.phone)
        .filter(Boolean);
    } else {
      return NextResponse.json(
        { error: 'Invalid mode. Use: phones, camp, all_registered, or nearby' },
        { status: 400 }
      );
    }

    // Deduplicate
    targetPhones = [...new Set(targetPhones)];

    if (targetPhones.length === 0) {
      return NextResponse.json({ sent: 0, failed: 0, message: 'No recipients found' });
    }

    // ─── Send SMS via Twilio ────────────────────────────
    let sent = 0;
    let failed = 0;
    const errors = [];

    let client;
    try {
      client = getTwilioClient();
    } catch (err) {
      // Twilio not configured — log the intent and return
      console.log(`[SMS Alert] Would send to ${targetPhones.length} phones: ${message}`);

      // Still log the alert to DB
      await supabase.from('alerts').insert({
        type: alert_type || 'sms_alert',
        message: `[SMS Queued] ${message}`,
        severity: 'medium',
        camp_id: camp_id || null,
        metadata: { target_count: targetPhones.length, mode },
      }).catch(() => {});

      return NextResponse.json({
        sent: 0,
        failed: 0,
        queued: targetPhones.length,
        message: 'Twilio not configured — SMS queued for manual delivery',
      });
    }

    const smsBody = `🚨 RAKSHAK: ${message}`;

    for (const phone of targetPhones) {
      try {
        await client.messages.create({
          body: smsBody,
          to: phone,
          from: fromPhone,
        });
        sent++;
      } catch (err) {
        failed++;
        errors.push({ phone, error: err.message });
      }
    }

    // Log to alerts table
    await supabase.from('alerts').insert({
      type: alert_type || 'sms_alert',
      message: `SMS sent: ${message}`,
      severity: 'medium',
      camp_id: camp_id || null,
      metadata: { sent, failed, target_count: targetPhones.length, mode },
    }).catch(() => {});

    return NextResponse.json({
      sent,
      failed,
      total: targetPhones.length,
      errors: errors.length > 0 ? errors.slice(0, 5) : undefined,
    });
  } catch (err) {
    console.error('[SMS Alert] Error:', err);
    return NextResponse.json(
      { error: 'Server error', details: err.message },
      { status: 500 }
    );
  }
}
