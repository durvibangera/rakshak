-- Kit Request System Migration
-- Creates tables for demand-driven NGO kit requests

-- Kit requests from Super Admin to NGOs
CREATE TABLE IF NOT EXISTS kit_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ngo_id UUID REFERENCES ngos(id) ON DELETE CASCADE,
  requested_by TEXT DEFAULT 'super_admin',
  kits_requested INTEGER NOT NULL CHECK (kits_requested > 0),
  urgency TEXT DEFAULT 'NORMAL' CHECK (urgency IN ('LOW', 'NORMAL', 'HIGH', 'CRITICAL')),
  reason TEXT,
  deadline TIMESTAMPTZ,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'ACCEPTED', 'REJECTED', 'FULFILLED', 'CANCELLED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- NGO responses to kit requests
CREATE TABLE IF NOT EXISTS kit_responses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id UUID REFERENCES kit_requests(id) ON DELETE CASCADE,
  ngo_id UUID REFERENCES ngos(id) ON DELETE CASCADE,
  kits_offered INTEGER NOT NULL CHECK (kits_offered >= 0),
  estimated_delivery_days INTEGER,
  cost_per_kit DECIMAL(10,2),
  notes TEXT,
  status TEXT DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Kit shipments from NGOs (when they fulfill requests)
CREATE TABLE IF NOT EXISTS kit_shipments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id UUID REFERENCES kit_responses(id) ON DELETE CASCADE,
  ngo_id UUID REFERENCES ngos(id) ON DELETE CASCADE,
  kits_shipped INTEGER NOT NULL CHECK (kits_shipped > 0),
  tracking_number TEXT,
  shipped_at TIMESTAMPTZ DEFAULT NOW(),
  delivered_at TIMESTAMPTZ,
  status TEXT DEFAULT 'SHIPPED' CHECK (status IN ('SHIPPED', 'IN_TRANSIT', 'DELIVERED')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_kit_requests_ngo_status ON kit_requests(ngo_id, status);
CREATE INDEX IF NOT EXISTS idx_kit_requests_status_created ON kit_requests(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_kit_responses_request_status ON kit_responses(request_id, status);
CREATE INDEX IF NOT EXISTS idx_kit_shipments_ngo_status ON kit_shipments(ngo_id, status);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_kit_requests_updated_at BEFORE UPDATE ON kit_requests FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_kit_responses_updated_at BEFORE UPDATE ON kit_responses FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();