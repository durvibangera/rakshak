/**
 * Seed Script: Smart Allocation Demo
 * 
 * Creates a realistic disaster scenario with:
 * - 8 camps with varying conditions (surge, plateau, depletion phases)
 * - Different headcounts and predicted growth rates
 * - Varied risk levels (HIGH, MEDIUM, LOW)
 * - 1000 kits in inventory
 * 
 * This demonstrates how the ML allocation model prioritizes:
 * - Camps in SURGE phase (rapid growth)
 * - HIGH risk areas
 * - Predicted headcount vs current headcount
 */

const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log('🌊 Starting Smart Allocation Demo Seed...\n');

  // Step 1: Clear existing demo data (only seeded camps by camp_code prefix)
  console.log('🧹 Cleaning up existing demo data...');
  const demoCodes = ['RRC-01','CCH-02','HSS-03','CEC-04','IAW-05','USC-06','TRP-07','AEH-08'];
  const { data: existingCamps } = await supabase.from('camps').select('id').in('camp_code', demoCodes);
  if (existingCamps?.length) {
    const ids = existingCamps.map(c => c.id);
    await supabase.from('kit_dispatch_orders').delete().in('camp_id', ids);
    await supabase.from('camps').delete().in('id', ids);
  }
  await supabase.from('kit_inventory').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  await supabase.from('kit_allocation_rounds').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  // Delete demo alert only
  await supabase.from('alerts').delete().eq('location_name', 'Coastal Districts');

  // Step 2: Create disaster alert
  console.log('🚨 Creating disaster alert...');
  const { data: alert } = await supabase.from('alerts').insert({
    type: 'FLOOD',
    risk: 'HIGH',
    lat: 19.0760,
    lng: 72.8777,
    location_name: 'Coastal Districts',
    description: 'Heavy rainfall causing widespread flooding. Multiple evacuation centers activated.',
    source: 'manual',
  }).select().single();
  console.log(`   ✓ Alert created: ${alert.location_name}\n`);

  // Step 3: Create 8 camps with realistic scenarios
  console.log('🏕️  Creating camps with varied conditions...\n');

  const campScenarios = [
    {
      name: 'Riverside Relief Camp',
      operator_name: 'Red Cross',
      operator_phone: '+919876543201',
      lat: 19.0760, lng: 72.8777,
      camp_code: 'RRC-01',
      status: 'active',
      radius_km: 5,
      scenario: {
        current_headcount: 450,
        predicted_headcount: 850, // SURGE - rapid growth expected
        phase: 'SURGE',
        risk: 'HIGH',
        description: '🔴 CRITICAL: Near flooded river, rapid influx expected'
      }
    },
    {
      name: 'Central Community Hall',
      operator_name: 'Local Government',
      operator_phone: '+919876543202',
      lat: 19.1136, lng: 72.8697,
      camp_code: 'CCH-02',
      status: 'active',
      radius_km: 3,
      scenario: {
        current_headcount: 320,
        predicted_headcount: 380, // Moderate growth
        phase: 'PLATEAU',
        risk: 'MEDIUM',
        description: '🟡 STABLE: Steady arrivals, manageable situation'
      }
    },
    {
      name: 'Hilltop School Shelter',
      operator_name: 'NGO Alliance',
      operator_phone: '+919876543203',
      lat: 19.2183, lng: 72.9781,
      camp_code: 'HSS-03',
      status: 'active',
      radius_km: 4,
      scenario: {
        current_headcount: 180,
        predicted_headcount: 120, // DEPLETION - people leaving
        phase: 'DEPLETION',
        risk: 'LOW',
        description: '🟢 DECLINING: Safe zone, people returning home'
      }
    },
    {
      name: 'Coastal Emergency Center',
      operator_name: 'Disaster Response Team',
      operator_phone: '+919876543204',
      lat: 18.9388, lng: 72.8354,
      camp_code: 'CEC-04',
      status: 'active',
      radius_km: 6,
      scenario: {
        current_headcount: 580,
        predicted_headcount: 920, // SURGE - high risk area
        phase: 'SURGE',
        risk: 'HIGH',
        description: '🔴 CRITICAL: Coastal flooding, mass evacuation ongoing'
      }
    },
    {
      name: 'Industrial Area Warehouse',
      operator_name: 'Corporate CSR',
      operator_phone: '+919876543205',
      lat: 19.0825, lng: 72.7411,
      camp_code: 'IAW-05',
      status: 'active',
      radius_km: 3,
      scenario: {
        current_headcount: 95,
        predicted_headcount: 110, // Slight growth
        phase: 'PLATEAU',
        risk: 'MEDIUM',
        description: '🟡 STABLE: Small camp, steady state'
      }
    },
    {
      name: 'University Sports Complex',
      operator_name: 'University Admin',
      operator_phone: '+919876543206',
      lat: 19.1197, lng: 72.9081,
      camp_code: 'USC-06',
      status: 'active',
      radius_km: 5,
      scenario: {
        current_headcount: 410,
        predicted_headcount: 520, // Moderate surge
        phase: 'SURGE',
        risk: 'MEDIUM',
        description: '🟠 GROWING: Large capacity, increasing arrivals'
      }
    },
    {
      name: 'Temple Relief Point',
      operator_name: 'Religious Trust',
      operator_phone: '+919876543207',
      lat: 19.0330, lng: 73.0297,
      camp_code: 'TRP-07',
      status: 'active',
      radius_km: 2,
      scenario: {
        current_headcount: 240,
        predicted_headcount: 200, // Declining
        phase: 'DEPLETION',
        risk: 'LOW',
        description: '🟢 DECLINING: Safe area, people departing'
      }
    },
    {
      name: 'Airport Evacuation Hub',
      operator_name: 'Airport Authority',
      operator_phone: '+919876543208',
      lat: 19.0896, lng: 72.8656,
      camp_code: 'AEH-08',
      status: 'active',
      radius_km: 4,
      scenario: {
        current_headcount: 650,
        predicted_headcount: 1100, // Massive surge
        phase: 'SURGE',
        risk: 'HIGH',
        description: '🔴 CRITICAL: Major transit point, huge influx expected'
      }
    }
  ];

  const createdCamps = [];
  for (const camp of campScenarios) {
    const { scenario, ...campData } = camp;
    // Insert camp without demo fields first
    const { data: createdCamp, error: campErr } = await supabase
      .from('camps')
      .insert(campData)
      .select()
      .single();

    if (campErr || !createdCamp) {
      console.error(`   ❌ Failed to insert ${camp.name}:`, campErr?.message);
      continue;
    }

    // Update demo fields separately (works around PostgREST schema cache)
    await supabase
      .from('camps')
      .update({
        demo_headcount: scenario.current_headcount,
        demo_predicted: scenario.predicted_headcount,
        demo_phase: scenario.phase,
        demo_risk: scenario.risk,
      })
      .eq('id', createdCamp.id);

    createdCamps.push({ ...createdCamp, scenario });
    
    console.log(`   ✓ ${camp.name}`);
    console.log(`     ${scenario.description}`);
    console.log(`     Current: ${scenario.current_headcount} → Predicted: ${scenario.predicted_headcount} (${scenario.phase})`);
    console.log('');
  }

  // Step 4: Add 1000 kits to inventory
  console.log('📦 Adding 1000 kits to inventory...');
  await supabase.from('kit_inventory').insert({
    event_type: 'IN',
    kits: 1000,
    balance_after: 1000,
    notes: 'Initial inventory for allocation demo',
  });
  console.log('   ✓ 1000 kits added\n');

  // Step 6: Display summary
  console.log('═══════════════════════════════════════════════════════════');
  console.log('📊 ALLOCATION DEMO SCENARIO SUMMARY');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('Total Camps: 8');
  console.log('Total Current Population:', createdCamps.reduce((s, c) => s + c.scenario.current_headcount, 0));
  console.log('Total Predicted Population:', createdCamps.reduce((s, c) => s + c.scenario.predicted_headcount, 0));
  console.log('Available Kits: 1000\n');

  console.log('CAMP BREAKDOWN:\n');
  
  const surgeCount = createdCamps.filter(c => c.scenario.phase === 'SURGE').length;
  const plateauCount = createdCamps.filter(c => c.scenario.phase === 'PLATEAU').length;
  const depletionCount = createdCamps.filter(c => c.scenario.phase === 'DEPLETION').length;
  
  console.log(`🔴 SURGE Phase: ${surgeCount} camps (rapid growth expected)`);
  createdCamps.filter(c => c.scenario.phase === 'SURGE').forEach(c => {
    const growth = ((c.scenario.predicted_headcount - c.scenario.current_headcount) / c.scenario.current_headcount * 100).toFixed(0);
    console.log(`   • ${c.name}: ${c.scenario.current_headcount} → ${c.scenario.predicted_headcount} (+${growth}%)`);
  });
  console.log('');

  console.log(`🟡 PLATEAU Phase: ${plateauCount} camps (stable)`);
  createdCamps.filter(c => c.scenario.phase === 'PLATEAU').forEach(c => {
    const growth = ((c.scenario.predicted_headcount - c.scenario.current_headcount) / c.scenario.current_headcount * 100).toFixed(0);
    console.log(`   • ${c.name}: ${c.scenario.current_headcount} → ${c.scenario.predicted_headcount} (${growth > 0 ? '+' : ''}${growth}%)`);
  });
  console.log('');

  console.log(`🟢 DEPLETION Phase: ${depletionCount} camps (declining)`);
  createdCamps.filter(c => c.scenario.phase === 'DEPLETION').forEach(c => {
    const growth = ((c.scenario.predicted_headcount - c.scenario.current_headcount) / c.scenario.current_headcount * 100).toFixed(0);
    console.log(`   • ${c.name}: ${c.scenario.current_headcount} → ${c.scenario.predicted_headcount} (${growth}%)`);
  });
  console.log('');

  console.log('═══════════════════════════════════════════════════════════');
  console.log('✅ SEED COMPLETE!');
  console.log('═══════════════════════════════════════════════════════════\n');
  
  console.log('NEXT STEPS:');
  console.log('1. Open Super Admin Dashboard: http://localhost:3000/super-admin/dashboard');
  console.log('2. Click "Run Predictions" to generate 24h forecasts');
  console.log('3. Click "Run Smart Allocation" to see ML-powered distribution');
  console.log('4. Observe how the model prioritizes:');
  console.log('   • SURGE camps get more kits (rapid growth)');
  console.log('   • HIGH risk areas get priority');
  console.log('   • DEPLETION camps get fewer kits (people leaving)');
  console.log('   • Effective demand = current + 0.7 * (predicted - current)');
  console.log('');
}

main()
  .then(() => {
    console.log('Script completed successfully');
    process.exit(0);
  })
  .catch((err) => {
    console.error('❌ Error:', err);
    process.exit(1);
  });
