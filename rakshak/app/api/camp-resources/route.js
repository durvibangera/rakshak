import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const STATUS_LEVELS = ['adequate', 'low', 'critical', 'out'];
const POWER_LEVELS = ['available', 'generator', 'none'];
const NET_LEVELS = ['available', 'intermittent', 'none'];

/**
 * GET /api/camp-resources?camp_id=uuid
 *   → single camp's resources
 * GET /api/camp-resources?all=true
 *   → all camps' resources (for super admin overview)
 */
export async function GET(request) {
  try {
    const supabase = getSupabaseAdmin();
    const { searchParams } = new URL(request.url);
    const campId = searchParams.get('camp_id');
    const all = searchParams.get('all');

    if (campId) {
      const { data, error } = await supabase
        .from('camp_resources')
        .select('*, camps(name, lat, lng, status, operator_name, operator_phone)')
        .eq('camp_id', campId)
        .single();

      if (error && error.code === 'PGRST116') {
        // No resource record yet — return defaults
        return NextResponse.json({
          resources: {
            camp_id: campId,
            total_capacity: 0, current_population: 0, available_beds: 0,
            food_status: 'adequate', water_status: 'adequate',
            medical_supplies: 'adequate', power_status: 'available',
            internet_status: 'available', special_needs_count: 0,
            critical_flag: null,
          },
          isNew: true,
        });
      }

      if (error) {
        return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 });
      }

      return NextResponse.json({ resources: data });
    }

    if (all) {
      const { data, error } = await supabase
        .from('camp_resources')
        .select('*, camps(name, lat, lng, status, operator_name)')
        .order('updated_at', { ascending: false });

      if (error) {
        return NextResponse.json({ error: 'Query failed', details: error.message }, { status: 500 });
      }

      // Also fetch camps that don't have resource records yet
      const { data: allCamps } = await supabase
        .from('camps')
        .select('id, name, status')
        .eq('status', 'active');

      const resourceCampIds = new Set((data || []).map(r => r.camp_id));
      const missingCamps = (allCamps || []).filter(c => !resourceCampIds.has(c.id));

      return NextResponse.json({
        resources: data || [],
        campsWithoutResources: missingCamps,
      });
    }

    return NextResponse.json({ error: 'Provide camp_id or all=true' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * POST /api/camp-resources — Create or upsert resource record for a camp
 */
export async function POST(request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (!body.camp_id) {
      return NextResponse.json({ error: 'camp_id is required' }, { status: 400 });
    }

    const record = {
      camp_id: body.camp_id,
      total_capacity: parseInt(body.total_capacity) || 0,
      current_population: parseInt(body.current_population) || 0,
      available_beds: parseInt(body.available_beds) || 0,
      food_status: STATUS_LEVELS.includes(body.food_status) ? body.food_status : 'adequate',
      water_status: STATUS_LEVELS.includes(body.water_status) ? body.water_status : 'adequate',
      medical_supplies: STATUS_LEVELS.includes(body.medical_supplies) ? body.medical_supplies : 'adequate',
      power_status: POWER_LEVELS.includes(body.power_status) ? body.power_status : 'available',
      internet_status: NET_LEVELS.includes(body.internet_status) ? body.internet_status : 'available',
      special_needs_count: parseInt(body.special_needs_count) || 0,
      critical_flag: body.critical_flag || null,
      updated_by: body.updated_by || null,
      updated_at: new Date().toISOString(),
    };

    const { data, error } = await supabase
      .from('camp_resources')
      .upsert(record, { onConflict: 'camp_id' })
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Save failed', details: error.message }, { status: 500 });
    }

    // Check if any status is critical — auto-generate alert
    const criticalItems = [];
    if (body.food_status === 'critical' || body.food_status === 'out') criticalItems.push('Food');
    if (body.water_status === 'critical' || body.water_status === 'out') criticalItems.push('Water');
    if (body.medical_supplies === 'critical' || body.medical_supplies === 'out') criticalItems.push('Medical');
    if (body.power_status === 'none') criticalItems.push('Power');

    if (criticalItems.length > 0 || body.critical_flag) {
      // Try to insert an alert (table may or may not exist)
      try {
        await supabase.from('alerts').insert({
          type: 'resource_critical',
          message: body.critical_flag
            ? `CRITICAL: ${body.critical_flag}`
            : `Resource alert: ${criticalItems.join(', ')} at critical levels`,
          severity: 'high',
          camp_id: body.camp_id,
          metadata: { criticalItems, resources: record },
        });
      } catch {}
    }

    return NextResponse.json({ success: true, resources: data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}

/**
 * PUT /api/camp-resources — Partial update (only changed fields)
 */
export async function PUT(request) {
  try {
    const body = await request.json();
    const supabase = getSupabaseAdmin();

    if (!body.camp_id) {
      return NextResponse.json({ error: 'camp_id is required' }, { status: 400 });
    }

    const updates = { updated_at: new Date().toISOString() };

    const numericFields = ['total_capacity', 'current_population', 'available_beds', 'special_needs_count'];
    const textFields = ['food_status', 'water_status', 'medical_supplies', 'power_status', 'internet_status', 'critical_flag'];

    for (const f of numericFields) {
      if (body[f] !== undefined) updates[f] = parseInt(body[f]) || 0;
    }
    for (const f of textFields) {
      if (body[f] !== undefined) updates[f] = body[f];
    }
    if (body.updated_by) updates.updated_by = body.updated_by;

    const { data, error } = await supabase
      .from('camp_resources')
      .update(updates)
      .eq('camp_id', body.camp_id)
      .select()
      .single();

    if (error) {
      return NextResponse.json({ error: 'Update failed', details: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, resources: data });
  } catch (err) {
    return NextResponse.json({ error: 'Server error', details: err.message }, { status: 500 });
  }
}
