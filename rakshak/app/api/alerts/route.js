/**
 * FILE: route.js (Alerts)
 * PURPOSE: Manage disaster alerts — create, list, deactivate.
 *
 * CONTEXT:
 *   GET /api/alerts — List active alerts (available to all authenticated users).
 *   POST /api/alerts — Create a new alert (NGO only).
 *   PUT /api/alerts — Update/deactivate an alert (NGO only).
 *   Alerts are broadcast in real-time via Supabase Realtime.
 *
 * ROLE ACCESS: GET = All authenticated | POST/PUT = NGO only
 *
 * EXPORTS:
 *   - GET: List active alerts
 *   - POST: Create new alert
 *   - PUT: Update/deactivate alert
 *
 * KEY DEPENDENCIES:
 *   - lib/supabase/admin.js
 *   - lib/ai/sarvamService.js (auto-translate alerts)
 *   - constants/disasterTypes.js
 *
 * TODO:
 *   [ ] GET — fetch active alerts ordered by severity then created_at
 *   [ ] POST — validate type, severity, message, affected_area
 *   [ ] POST — auto-translate alert to all 13 languages via SarvamAI
 *   [ ] PUT — deactivate alert (set is_active = false)
 *   [ ] Role guard for POST/PUT
 */

import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('alerts')
      .select('*')
      .eq('is_active', true)
      .order('severity', { ascending: false })
      .order('created_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ alerts: data });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, severity, message, affected_area, instructions, source, translations } = body;

    // Auto-predict alerts bypass role guard
    const isAutoPredict = source === 'auto-predict';

    // TODO: Role guard — NGO only (skip for auto-predict)
    if (!isAutoPredict) {
      // Manual role guard check would go here
    }

    if (!type || !severity || !message || !affected_area) {
      return NextResponse.json(
        { error: 'type, severity, message, and affected_area are required' },
        { status: 400 }
      );
    }

    // TODO: Auto-translate message using SarvamAI

    const { data, error } = await supabaseAdmin
      .from('alerts')
      .insert({
        type,
        severity,
        message,
        affected_area,
        instructions: instructions || '',
        is_active: true,
        translations: translations || {},
        source: source || 'manual',
      })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ alert: data }, { status: 201 });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    // TODO: Role guard — NGO only
    const { id, is_active, ...updates } = await request.json();

    if (!id) {
      return NextResponse.json({ error: 'Alert id is required' }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from('alerts')
      .update({ is_active, ...updates })
      .eq('id', id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ alert: data });
  } catch (err) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
