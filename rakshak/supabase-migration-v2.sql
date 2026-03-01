-- ═══════════════════════════════════════════════════════════
-- RAKSHAK v2 — Schema Migration
-- Run this AFTER the original supabase-schema.sql
-- Supabase Dashboard → SQL Editor → New Query → Paste & Run
-- ═══════════════════════════════════════════════════════════

-- ───────────────────────────────────────────────────────────
-- 1. ALTER users TABLE — new columns for expanded roles & details
-- ───────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'safe';
ALTER TABLE users ADD COLUMN IF NOT EXISTS assigned_camp_id UUID REFERENCES camps(id);
ALTER TABLE users ADD COLUMN IF NOT EXISTS height_cm INTEGER;
ALTER TABLE users ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS identifying_marks TEXT;
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_uid UUID;          -- link to Supabase Auth UID

-- Update default role for new registrations
-- Existing 'victim' entries stay as-is; new entries default to 'verified_user'
-- Note: Run the role migration UPDATE below separately if needed

-- Index for auth UID lookups
CREATE INDEX IF NOT EXISTS idx_users_auth_uid ON users (auth_uid);
CREATE INDEX IF NOT EXISTS idx_users_status ON users (status);
CREATE INDEX IF NOT EXISTS idx_users_assigned_camp ON users (assigned_camp_id);

-- ───────────────────────────────────────────────────────────
-- 2. ALTER camps TABLE — link admin + helpline
-- ───────────────────────────────────────────────────────────

ALTER TABLE camps ADD COLUMN IF NOT EXISTS admin_user_id UUID REFERENCES users(id);
ALTER TABLE camps ADD COLUMN IF NOT EXISTS helpline_number TEXT;
ALTER TABLE camps ADD COLUMN IF NOT EXISTS camp_code TEXT UNIQUE;  -- short 4-char code for SMS check-in

CREATE INDEX IF NOT EXISTS idx_camps_admin ON camps (admin_user_id);
CREATE INDEX IF NOT EXISTS idx_camps_code ON camps (camp_code);

-- ───────────────────────────────────────────────────────────
-- 3. NEW TABLE: dependents — children, elderly, family members
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS dependents (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  parent_user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  photo_url TEXT,
  face_encoding JSONB,
  age INTEGER,
  gender TEXT,
  relationship TEXT NOT NULL,      -- 'child', 'spouse', 'parent', 'sibling', 'other'
  height_cm INTEGER,
  identifying_marks TEXT,          -- birthmarks, scars, tattoos
  blood_group TEXT,
  medical_conditions TEXT,
  disability_status TEXT,
  languages_spoken TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'safe',      -- 'safe', 'missing', 'found', 'injured'
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dependents_parent ON dependents (parent_user_id);
CREATE INDEX IF NOT EXISTS idx_dependents_status ON dependents (status);

ALTER TABLE dependents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read dependents" ON dependents FOR SELECT USING (true);
CREATE POLICY "Anyone can insert dependents" ON dependents FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update dependents" ON dependents FOR UPDATE USING (true);

-- ───────────────────────────────────────────────────────────
-- 4. NEW TABLE: unidentified_persons — unknown arrivals at camps
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS unidentified_persons (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID REFERENCES camps(id) ON DELETE CASCADE,
  photo_url TEXT,
  face_encoding JSONB,
  approximate_age INTEGER,
  gender TEXT,
  injuries TEXT,
  clothing_description TEXT,
  identifying_marks TEXT,
  temp_wristband_id TEXT UNIQUE,   -- camp-issued physical wristband number
  notes TEXT,
  status TEXT DEFAULT 'unidentified',  -- 'unidentified', 'matched', 'claimed', 'transferred'
  matched_user_id UUID REFERENCES users(id),
  matched_dependent_id UUID REFERENCES dependents(id),
  registered_by UUID REFERENCES users(id),  -- which operator added them
  created_at TIMESTAMPTZ DEFAULT NOW(),
  matched_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_unidentified_camp ON unidentified_persons (camp_id);
CREATE INDEX IF NOT EXISTS idx_unidentified_status ON unidentified_persons (status);
CREATE INDEX IF NOT EXISTS idx_unidentified_wristband ON unidentified_persons (temp_wristband_id);

ALTER TABLE unidentified_persons ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read unidentified" ON unidentified_persons FOR SELECT USING (true);
CREATE POLICY "Anyone can insert unidentified" ON unidentified_persons FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update unidentified" ON unidentified_persons FOR UPDATE USING (true);

-- ───────────────────────────────────────────────────────────
-- 5. NEW TABLE: missing_reports — filed by users seeking family
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS missing_reports (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  reported_by UUID REFERENCES users(id),            -- who filed it
  missing_user_id UUID REFERENCES users(id),        -- if a registered user is missing
  missing_dependent_id UUID REFERENCES dependents(id), -- if a dependent is missing

  -- For unregistered / unknown missing persons:
  name TEXT,
  photo_url TEXT,
  face_encoding JSONB,
  age INTEGER,
  gender TEXT,
  relationship TEXT,
  last_known_location TEXT,
  last_known_lat DOUBLE PRECISION,
  last_known_lng DOUBLE PRECISION,
  identifying_details TEXT,
  phone_of_missing TEXT,

  -- Status & matching workflow
  status TEXT DEFAULT 'active',
  -- 'active' → 'match_found' → 'under_review' → 'reunited' | 'closed'
  matched_camp_id UUID REFERENCES camps(id),
  matched_camp_name TEXT,
  matched_unidentified_id UUID REFERENCES unidentified_persons(id),
  matched_user_id UUID REFERENCES users(id),        -- if missing user found in camp_victims
  match_confidence DOUBLE PRECISION,
  reviewed_by UUID REFERENCES users(id),
  reviewed_at TIMESTAMPTZ,
  reviewer_notes TEXT,
  notified_at TIMESTAMPTZ,
  notification_method TEXT,  -- 'sms', 'push', 'in_app'

  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_missing_status ON missing_reports (status);
CREATE INDEX IF NOT EXISTS idx_missing_reporter ON missing_reports (reported_by);
CREATE INDEX IF NOT EXISTS idx_missing_user ON missing_reports (missing_user_id);
CREATE INDEX IF NOT EXISTS idx_missing_dependent ON missing_reports (missing_dependent_id);

ALTER TABLE missing_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read missing reports" ON missing_reports FOR SELECT USING (true);
CREATE POLICY "Anyone can file missing reports" ON missing_reports FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update missing reports" ON missing_reports FOR UPDATE USING (true);

-- ───────────────────────────────────────────────────────────
-- 6. NEW TABLE: camp_resources — real-time camp capacity & supplies
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS camp_resources (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  camp_id UUID REFERENCES camps(id) ON DELETE CASCADE UNIQUE,
  total_capacity INTEGER DEFAULT 0,
  current_population INTEGER DEFAULT 0,
  available_beds INTEGER DEFAULT 0,
  food_status TEXT DEFAULT 'adequate',       -- 'adequate', 'low', 'critical', 'out'
  water_status TEXT DEFAULT 'adequate',
  medical_supplies TEXT DEFAULT 'adequate',
  power_status TEXT DEFAULT 'available',     -- 'available', 'generator', 'none'
  internet_status TEXT DEFAULT 'available',  -- 'available', 'intermittent', 'none'
  special_needs_count INTEGER DEFAULT 0,
  critical_flag TEXT,                        -- free text for urgent issues
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  updated_by UUID REFERENCES users(id)
);

CREATE INDEX IF NOT EXISTS idx_camp_resources_camp ON camp_resources (camp_id);

ALTER TABLE camp_resources ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read camp resources" ON camp_resources FOR SELECT USING (true);
CREATE POLICY "Anyone can insert camp resources" ON camp_resources FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update camp resources" ON camp_resources FOR UPDATE USING (true);

-- ───────────────────────────────────────────────────────────
-- 7. NEW TABLE: audit_logs — track all sensitive operations
-- ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS audit_logs (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES users(id),
  user_role TEXT,
  action TEXT NOT NULL,           -- 'checkin', 'view_profile', 'approve_match', 'reject_match',
                                  -- 'file_missing_report', 'access_denied', 'sign_in', 'sign_out'
  target_type TEXT,               -- 'user', 'camp', 'missing_report', 'unidentified_person'
  target_id UUID,
  metadata JSONB DEFAULT '{}',
  ip_address TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_audit_user ON audit_logs (user_id);
CREATE INDEX IF NOT EXISTS idx_audit_action ON audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_created ON audit_logs (created_at DESC);

ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Service role manages audit logs" ON audit_logs FOR ALL USING (true);

-- ───────────────────────────────────────────────────────────
-- 8. ENABLE REALTIME on new tables
-- ───────────────────────────────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE missing_reports;
ALTER PUBLICATION supabase_realtime ADD TABLE unidentified_persons;
ALTER PUBLICATION supabase_realtime ADD TABLE camp_resources;

-- ───────────────────────────────────────────────────────────
-- 9. ROLE MIGRATION — update existing 'victim' → 'verified_user'
-- ───────────────────────────────────────────────────────────
-- Uncomment and run if you want to migrate existing data:
-- UPDATE users SET role = 'verified_user' WHERE role = 'victim';
-- UPDATE users SET role = 'super_admin' WHERE role = 'ngo';

-- ═══════════════════════════════════════════════════════════
-- END OF MIGRATION v2
-- ═══════════════════════════════════════════════════════════
