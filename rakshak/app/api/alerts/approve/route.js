import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

export async function PUT(request) {
  try {
    const { alert_id, action, reviewed_by } = await request.json();

    if (!alert_id || !action) {
      return NextResponse.json({ error: 'alert_id and action are required' }, { status: 400 });
    }

    if (!['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'action must be "approve" or "reject"' }, { status: 400 });
    }

    const supabase = getSupabaseAdmin();

    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    const { data: alert, error } = await supabase
      .from('camp_alerts')
      .update({
        status: newStatus,
        reviewed_at: new Date().toISOString(),
        reviewed_by: reviewed_by || 'camp_operator',
      })
      .eq('id', alert_id)
      .eq('status', 'pending')
      .select()
      .single();

    if (error || !alert) {
      return NextResponse.json(
        { error: 'Alert not found or already reviewed', details: error?.message },
        { status: 404 }
      );
    }

    let evacuationResult = null;
    // If approved, trigger evacuation calls (only after approval)
    if (action === 'approve') {
      try {
        const appBaseUrl = process.env.APP_BASE_URL || 'http://localhost:3000';
        const isPreparedness = (alert.description || '').startsWith('PREPAREDNESS:');
        const evacRes = await fetch(`${appBaseUrl}/api/evacuate`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            alert_id: alert.id,
            camp_id: alert.camp_id,
            disaster_type: alert.disaster_type,
            preparedness: isPreparedness,
          }),
        });
        evacuationResult = await evacRes.json().catch(() => null);
      } catch (callErr) {
        console.error('[AlertApprove] Failed to trigger evacuation:', callErr.message);
      }
    }

    return NextResponse.json({
      success: true,
      alert,
      evacuation: evacuationResult,
      message: action === 'approve'
        ? 'Alert approved — evacuation calls initiated'
        : 'Alert rejected',
    });
  } catch (err) {
    console.error('[AlertApprove] Error:', err);
    return NextResponse.json({ error: 'Failed to process alert', details: err.message }, { status: 500 });
  }
}
