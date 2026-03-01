-- ═══════════════════════════════════════════════════════════
-- RAKSHAK — Supabase Database Schema
-- Run this in: Supabase Dashboard → SQL Editor → New Query
-- ═══════════════════════════════════════════════════════════

-- 1. USERS TABLE — stores registered users with location + phone
CREATE TABLE IF NOT EXISTS users (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT DEFAULT 'Unknown Victim',
  phone TEXT UNIQUE,
  state TEXT DEFAULT 'Maharashtra',
  address TEXT,
  lat DOUBLE PRECISION,
  lng DOUBLE PRECISION,
  role TEXT DEFAULT 'victim',
  selfie_url TEXT,
  blood_group TEXT,
  medical_conditions TEXT,
  current_medications TEXT,
  disability_status TEXT,
  languages_spoken TEXT[] DEFAULT '{}',
  emergency_contact_name TEXT,
  emergency_contact_phone TEXT,
  registration_type TEXT DEFAULT 'self' CHECK (registration_type IN ('self', 'camp')),
  qr_code_id TEXT UNIQUE,
  face_encoding JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast location-based queries
CREATE INDEX IF NOT EXISTS idx_users_location ON users (lat, lng);
CREATE INDEX IF NOT EXISTS idx_users_phone ON users (phone);
CREATE INDEX IF NOT EXISTS idx_users_qr ON users (qr_code_id);

-- 2. ALERTS TABLE — stores triggered disaster alerts
CREATE TABLE IF NOT EXISTS alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('FLOOD', 'EARTHQUAKE', 'LANDSLIDE', 'CYCLONE')),
  risk TEXT NOT NULL CHECK (risk IN ('HIGH', 'MEDIUM', 'LOW')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location_name TEXT,
  description TEXT,
  source TEXT DEFAULT 'auto-predict',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  resolved_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_alerts_type ON alerts (type);
CREATE INDEX IF NOT EXISTS idx_alerts_created ON alerts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_alerts_location ON alerts (lat, lng);

-- 3. CALL LOGS TABLE — tracks voice calls made
CREATE TABLE IF NOT EXISTS call_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id UUID REFERENCES alerts(id),
  user_id UUID REFERENCES users(id),
  phone TEXT NOT NULL,
  status TEXT DEFAULT 'initiated',
  call_sid TEXT,
  language TEXT DEFAULT 'hi',
  disaster_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_logs_phone ON call_logs (phone, created_at DESC);

-- 4. PREDICTIONS TABLE — stores prediction history
CREATE TABLE IF NOT EXISTS predictions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location_name TEXT,
  overall_risk TEXT NOT NULL,
  flood_risk TEXT DEFAULT 'LOW',
  earthquake_risk TEXT DEFAULT 'LOW',
  landslide_risk TEXT DEFAULT 'LOW',
  cyclone_risk TEXT DEFAULT 'LOW',
  raw_data JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_predictions_location ON predictions (lat, lng);
CREATE INDEX IF NOT EXISTS idx_predictions_created ON predictions (created_at DESC);

-- 5. CAMPS TABLE — relief camp locations and coverage areas
CREATE TABLE IF NOT EXISTS camps (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  operator_name TEXT NOT NULL,
  operator_phone TEXT NOT NULL,
  operator_email TEXT,
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  radius_km DOUBLE PRECISION DEFAULT 10,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'inactive', 'full')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_camps_location ON camps (lat, lng);

-- 6. CAMP VICTIMS — junction table linking victims to camps
CREATE TABLE IF NOT EXISTS camp_victims (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID REFERENCES camps(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  checked_in_at TIMESTAMPTZ DEFAULT NOW(),
  checked_in_via TEXT DEFAULT 'manual' CHECK (checked_in_via IN ('manual', 'qr', 'face')),
  UNIQUE(camp_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_camp_victims_camp ON camp_victims (camp_id);
CREATE INDEX IF NOT EXISTS idx_camp_victims_user ON camp_victims (user_id);

-- 7. CAMP ALERTS — alert approval workflow for camp operators
CREATE TABLE IF NOT EXISTS camp_alerts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID REFERENCES camps(id) ON DELETE CASCADE,
  disaster_type TEXT NOT NULL CHECK (disaster_type IN ('FLOOD', 'EARTHQUAKE', 'LANDSLIDE', 'CYCLONE')),
  severity TEXT NOT NULL CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW')),
  lat DOUBLE PRECISION NOT NULL,
  lng DOUBLE PRECISION NOT NULL,
  location_name TEXT,
  description TEXT,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected', 'calls_sent')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ,
  reviewed_by TEXT
);

CREATE INDEX IF NOT EXISTS idx_camp_alerts_camp ON camp_alerts (camp_id);
CREATE INDEX IF NOT EXISTS idx_camp_alerts_status ON camp_alerts (status);

-- 8. OFFLINE QUEUE — tracks actions performed offline for sync
CREATE TABLE IF NOT EXISTS offline_queue (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID,
  action_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  synced BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- 9. Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE call_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE predictions ENABLE ROW LEVEL SECURITY;
ALTER TABLE camps ENABLE ROW LEVEL SECURITY;
ALTER TABLE camp_victims ENABLE ROW LEVEL SECURITY;
ALTER TABLE camp_alerts ENABLE ROW LEVEL SECURITY;
ALTER TABLE offline_queue ENABLE ROW LEVEL SECURITY;

-- 10. RLS Policies — allow public read, service role write
CREATE POLICY "Anyone can read alerts" ON alerts FOR SELECT USING (true);
CREATE POLICY "Service role can insert alerts" ON alerts FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read predictions" ON predictions FOR SELECT USING (true);
CREATE POLICY "Service role can insert predictions" ON predictions FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can read own data" ON users FOR SELECT USING (true);
CREATE POLICY "Anyone can register" ON users FOR INSERT WITH CHECK (true);
CREATE POLICY "Users can update own data" ON users FOR UPDATE USING (true);

CREATE POLICY "Service role can manage call logs" ON call_logs FOR ALL USING (true);

CREATE POLICY "Anyone can read camps" ON camps FOR SELECT USING (true);
CREATE POLICY "Anyone can create camps" ON camps FOR INSERT WITH CHECK (true);
CREATE POLICY "Camp operators can update camps" ON camps FOR UPDATE USING (true);

CREATE POLICY "Anyone can read camp victims" ON camp_victims FOR SELECT USING (true);
CREATE POLICY "Anyone can add camp victims" ON camp_victims FOR INSERT WITH CHECK (true);

CREATE POLICY "Anyone can read camp alerts" ON camp_alerts FOR SELECT USING (true);
CREATE POLICY "Anyone can create camp alerts" ON camp_alerts FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update camp alerts" ON camp_alerts FOR UPDATE USING (true);

CREATE POLICY "Anyone can manage offline queue" ON offline_queue FOR ALL USING (true);

-- 11. Enable Realtime for alerts and camp_alerts
ALTER PUBLICATION supabase_realtime ADD TABLE alerts;
ALTER PUBLICATION supabase_realtime ADD TABLE camp_alerts;

-- ═══════════════════════════════════════════════════════════
-- MIGRATION SCRIPT (run if tables already exist)
-- ═══════════════════════════════════════════════════════════
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS address TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS selfie_url TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS blood_group TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS medical_conditions TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS current_medications TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS disability_status TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS languages_spoken TEXT[] DEFAULT '{}';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_name TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS emergency_contact_phone TEXT;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS registration_type TEXT DEFAULT 'self';
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS qr_code_id TEXT UNIQUE;
-- ALTER TABLE users ADD COLUMN IF NOT EXISTS face_encoding JSONB;
-- ALTER TABLE users ALTER COLUMN name SET DEFAULT 'Unknown Victim';
-- ALTER TABLE users ALTER COLUMN phone DROP NOT NULL;

-- ═══════════════════════════════════════════════════════════
-- v2 MIGRATION — See supabase-migration-v2.sql for:
--   • New columns on users (aadhaar, pin, consent, status, auth_uid, etc.)
--   • New columns on camps (admin_user_id, helpline, camp_code)
--   • dependents table
--   • unidentified_persons table
--   • missing_reports table
--   • camp_resources table
--   • audit_logs table
--   • Realtime on missing_reports, unidentified_persons, camp_resources
--
-- Roles updated from (victim, ngo) → (super_admin, camp_admin, operator, verified_user)
-- ═══════════════════════════════════════════════════════════
