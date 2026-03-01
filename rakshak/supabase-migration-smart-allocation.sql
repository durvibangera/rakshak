-- ═══════════════════════════════════════════════════════════
-- RAKSHAK — Smart Kit Allocation System — Supabase Migration
-- Run in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- NGOs registered for a disaster
CREATE TABLE IF NOT EXISTS ngos (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  contact_phone TEXT,
  contact_email TEXT,
  cost_per_kit DECIMAL(10,2) DEFAULT 120.0,
  campaign_url TEXT,
  status TEXT DEFAULT 'IDLE' CHECK (status IN ('IDLE','FUNDRAISING','PRODUCING','SHIPPED')),
  kits_assigned INTEGER DEFAULT 0,
  amount_needed DECIMAL(12,2) DEFAULT 0,
  total_raised DECIMAL(12,2) DEFAULT 0,
  kits_produced INTEGER DEFAULT 0,
  kits_shipped INTEGER DEFAULT 0,
  production_started_at TIMESTAMPTZ,
  production_ready_at TIMESTAMPTZ,
  shipped_at TIMESTAMPTZ,
  disaster_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Individual donations to an NGO
CREATE TABLE IF NOT EXISTS donations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ngo_id UUID REFERENCES ngos(id) ON DELETE CASCADE,
  donor_name TEXT DEFAULT 'Anonymous',
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'INR',
  payment_reference TEXT,
  donated_at TIMESTAMPTZ DEFAULT NOW(),
  running_total DECIMAL(12,2)
);

-- Central kit inventory — every IN and OUT logged
CREATE TABLE IF NOT EXISTS kit_inventory (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  event_type TEXT NOT NULL CHECK (event_type IN ('IN','OUT')),
  kits INTEGER NOT NULL,
  source_ngo_id UUID REFERENCES ngos(id),
  destination_camp_id UUID REFERENCES camps(id),
  allocation_round_id UUID,
  balance_after INTEGER NOT NULL,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Each time the ML allocation engine runs
CREATE TABLE IF NOT EXISTS kit_allocation_rounds (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_number INTEGER NOT NULL,
  disaster_id TEXT,
  total_kits_available INTEGER NOT NULL,
  total_kits_dispatched INTEGER NOT NULL,
  reserve_kits INTEGER NOT NULL,
  buffer_pct DECIMAL(4,3) DEFAULT 0.15,
  beta_weight DECIMAL(4,3) DEFAULT 0.7,
  triggered_by TEXT DEFAULT 'manual',
  run_at TIMESTAMPTZ DEFAULT NOW()
);

-- Per-camp dispatch per allocation round
CREATE TABLE IF NOT EXISTS kit_dispatch_orders (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  round_id UUID REFERENCES kit_allocation_rounds(id),
  camp_id UUID REFERENCES camps(id),
  current_headcount INTEGER NOT NULL,
  predicted_headcount INTEGER NOT NULL,
  effective_demand DECIMAL(8,1),
  camp_phase TEXT,
  alert_risk TEXT,
  kits_allocated INTEGER NOT NULL,
  kits_per_person_now DECIMAL(5,2),
  kits_per_person_at_delivery DECIMAL(5,2),
  urgency TEXT CHECK (urgency IN ('CRITICAL','LOW','OK')),
  dispatched_at TIMESTAMPTZ DEFAULT NOW(),
  received_at TIMESTAMPTZ
);

-- Camp resource requests sent to Super Admin
CREATE TABLE IF NOT EXISTS resource_requests (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID REFERENCES camps(id) ON DELETE CASCADE,
  requested_by UUID REFERENCES users(id),
  min_kits_needed INTEGER NOT NULL,
  current_headcount INTEGER NOT NULL,
  notes TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending','acknowledged','fulfilled','rejected')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by UUID REFERENCES users(id)
);

-- Safe zones (schools, hospitals etc. for camp migration)
CREATE TABLE IF NOT EXISTS safe_zones (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  zone_type TEXT NOT NULL CHECK (zone_type IN ('hospital','school','college','community_hall','stadium')),
  area TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  capacity INTEGER NOT NULL,
  current_occupancy INTEGER DEFAULT 0,
  is_safe BOOLEAN DEFAULT TRUE,
  facilities TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Realtime
ALTER PUBLICATION supabase_realtime ADD TABLE resource_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE kit_inventory;
ALTER PUBLICATION supabase_realtime ADD TABLE kit_dispatch_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE ngos;
ALTER PUBLICATION supabase_realtime ADD TABLE donations;

-- RLS
ALTER TABLE ngos ENABLE ROW LEVEL SECURITY;
ALTER TABLE donations ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_allocation_rounds ENABLE ROW LEVEL SECURITY;
ALTER TABLE kit_dispatch_orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE resource_requests ENABLE ROW LEVEL SECURITY;
ALTER TABLE safe_zones ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read ngos" ON ngos FOR SELECT USING (true);
CREATE POLICY "Service can manage ngos" ON ngos FOR ALL USING (true);
CREATE POLICY "Anyone can read donations" ON donations FOR SELECT USING (true);
CREATE POLICY "Anyone can add donations" ON donations FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can read inventory" ON kit_inventory FOR SELECT USING (true);
CREATE POLICY "Service can manage inventory" ON kit_inventory FOR ALL USING (true);
CREATE POLICY "Anyone can read allocation rounds" ON kit_allocation_rounds FOR SELECT USING (true);
CREATE POLICY "Service can manage allocation rounds" ON kit_allocation_rounds FOR ALL USING (true);
CREATE POLICY "Anyone can read dispatch orders" ON kit_dispatch_orders FOR SELECT USING (true);
CREATE POLICY "Service can manage dispatch orders" ON kit_dispatch_orders FOR ALL USING (true);
CREATE POLICY "Anyone can read resource requests" ON resource_requests FOR SELECT USING (true);
CREATE POLICY "Camp admins can create requests" ON resource_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "Super admin can update requests" ON resource_requests FOR UPDATE USING (true);
CREATE POLICY "Anyone can read safe zones" ON safe_zones FOR SELECT USING (true);
CREATE POLICY "Service can manage safe zones" ON safe_zones FOR ALL USING (true);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_ngos_status ON ngos (status);
CREATE INDEX IF NOT EXISTS idx_donations_ngo ON donations (ngo_id);
CREATE INDEX IF NOT EXISTS idx_kit_inventory_type ON kit_inventory (event_type);
CREATE INDEX IF NOT EXISTS idx_kit_dispatch_round ON kit_dispatch_orders (round_id);
CREATE INDEX IF NOT EXISTS idx_kit_dispatch_camp ON kit_dispatch_orders (camp_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_camp ON resource_requests (camp_id);
CREATE INDEX IF NOT EXISTS idx_resource_requests_status ON resource_requests (status);
CREATE INDEX IF NOT EXISTS idx_safe_zones_type ON safe_zones (zone_type);
CREATE INDEX IF NOT EXISTS idx_safe_zones_location ON safe_zones (lat, lng);
