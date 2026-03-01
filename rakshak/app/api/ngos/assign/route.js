/**
 * FILE: route.js (NGO Assign)
 * PURPOSE: Divide total kits equally across registered NGOs and assign.
 */
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function POST(request) {
  try {
    const { total_kits_needed } = await request.json();

    if (!total_kits_needed || total_kits_needed <= 0) {
      return NextResponse.json({ error: 'total_kits_needed must be > 0' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();
    const { data: ngos, error } = await supabase
      .from('ngos')
      .select('*')
      .in('status', ['IDLE', 'FUNDRAISING']);

    if (error || !ngos?.length) {
      return NextResponse.json({ error: 'No available NGOs found' }, { status: 404 });
    }

    const kitsPerNgo = Math.ceil(total_kits_needed / ngos.length);

    const updates = await Promise.all(
      ngos.map(async (ngo) => {
        const amount_needed = kitsPerNgo * (ngo.cost_per_kit || 120);
        const { data, error: upErr } = await supabase
          .from('ngos')
          .update({
            kits_assigned: kitsPerNgo,
            amount_needed,
            status: 'FUNDRAISING',
            updated_at: new Date().toISOString(),
          })
          .eq('id', ngo.id)
          .select()
          .single();
        return { ngo_id: ngo.id, name: ngo.name, kits_assigned: kitsPerNgo, amount_needed, error: upErr };
      })
    );

    return NextResponse.json({
      success: true,
      total_kits_needed,
      ngos_count: ngos.length,
      kits_per_ngo: kitsPerNgo,
      assignments: updates,
    });
  } catch (err) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
