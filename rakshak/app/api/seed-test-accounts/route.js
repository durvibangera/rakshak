import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * ONE-TIME SEED: Creates test accounts for all 3 admin roles.
 * Hit GET /api/seed-test-accounts once, then delete this file.
 */

function getSupabaseAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );
}

const TEST_ACCOUNTS = [
  {
    email: 'superadmin@rakshak.dev',
    password: 'Super@123',
    role: 'super_admin',
    name: 'Super Admin',
    phone: '+919999000001',
  },
  {
    email: 'campadmin@rakshak.dev',
    password: 'Camp@123',
    role: 'camp_admin',
    name: 'Camp Admin',
    phone: '+919999000002',
  },
  {
    email: 'operator@rakshak.dev',
    password: 'Ops@1234',
    role: 'operator',
    name: 'Field Operator',
    phone: '+919999000003',
  },
  {
    email: 'ngoadmin@rakshak.dev',
    password: 'Ngo@1234',
    role: 'ngo_admin',
    name: 'NGO Admin (Test)',
    phone: '+919999000004',
  },
];

export async function GET() {
  const supabase = getSupabaseAdmin();
  const results = [];

  for (const acc of TEST_ACCOUNTS) {
    try {
      // Create Supabase Auth user
      const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: acc.email,
        password: acc.password,
        email_confirm: true,
      });

      if (authError && !authError.message.includes('already been registered')) {
        results.push({ email: acc.email, status: 'auth_error', error: authError.message });
        continue;
      }

      const authUid = authData?.user?.id;

      // If user already existed, fetch their auth UID
      let finalAuthUid = authUid;
      if (!finalAuthUid) {
        const { data: existingUsers } = await supabase.auth.admin.listUsers();
        const existing = existingUsers?.users?.find(u => u.email === acc.email);
        finalAuthUid = existing?.id;
      }

      // Create or update profile in users table
      const { data: profile, error: profileError } = await supabase.from('users').upsert({
        name: acc.name,
        phone: acc.phone,
        role: acc.role,
        auth_uid: finalAuthUid,
        consent_given: true,
        consent_timestamp: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }, { onConflict: 'phone' }).select().single();

      if (profileError) {
        results.push({ email: acc.email, status: 'profile_error', error: profileError.message });
        continue;
      }

      // If camp_admin, create a test camp and link it
      if (acc.role === 'camp_admin' && profile) {
        const { data: camp } = await supabase.from('camps').upsert({
          name: 'Test Relief Camp',
          operator_name: acc.name,
          operator_phone: acc.phone,
          lat: 19.076,
          lng: 72.8777,
          radius_km: 10,
          camp_code: 'TEST01',
          admin_user_id: profile.id,
          status: 'active',
        }, { onConflict: 'camp_code' }).select().single();

        if (camp) {
          await supabase.from('users').update({ assigned_camp_id: camp.id }).eq('id', profile.id);
          results.push({ email: acc.email, role: acc.role, status: 'ok', camp_id: camp.id, camp_code: 'TEST01' });
        } else {
          results.push({ email: acc.email, role: acc.role, status: 'ok (camp may already exist)' });
        }
      }
      // If operator, link to the test camp
      else if (acc.role === 'operator') {
        const { data: camp } = await supabase.from('camps')
          .select('id')
          .eq('camp_code', 'TEST01')
          .single();

        if (camp) {
          await supabase.from('users').update({ assigned_camp_id: camp.id }).eq('id', profile.id);
        }
        results.push({ email: acc.email, role: acc.role, status: 'ok', camp_code: 'TEST01' });
      }
      else {
        results.push({ email: acc.email, role: acc.role, status: 'ok' });
      }

    } catch (err) {
      results.push({ email: acc.email, status: 'exception', error: err.message });
    }
  }

  return NextResponse.json({
    message: 'Test accounts seeded. DELETE this file after use!',
    credentials: [
      { role: 'Super Admin', login: '/admin-login → Super Admin', email: 'superadmin@rakshak.dev', password: 'Super@123' },
      { role: 'Camp Admin', login: '/admin-login → Camp Admin', email: 'campadmin@rakshak.dev', password: 'Camp@123' },
      { role: 'Operator', login: '/admin-login → Operator', campCode: 'TEST01', phone: '9999000003' },
      { role: 'NGO Admin', login: '/ngo/login', email: 'ngoadmin@rakshak.dev', password: 'Ngo@1234' },
    ],
    results,
  });
}
