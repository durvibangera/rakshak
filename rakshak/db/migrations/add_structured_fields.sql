-- Migration: Add structured fields for hybrid missing person search
-- Run this in Supabase SQL Editor

-- ═══════════════════════════════════════════════════════════
-- 1. Add structured fields to missing_reports table
-- ═══════════════════════════════════════════════════════════

ALTER TABLE missing_reports 
ADD COLUMN IF NOT EXISTS age_min INTEGER,
ADD COLUMN IF NOT EXISTS age_max INTEGER,
ADD COLUMN IF NOT EXISTS height VARCHAR(20), -- 'short', 'average', 'tall'
ADD COLUMN IF NOT EXISTS build VARCHAR(20), -- 'slim', 'average', 'heavy', 'athletic'
ADD COLUMN IF NOT EXISTS skin_tone VARCHAR(20), -- 'fair', 'medium', 'dark'
ADD COLUMN IF NOT EXISTS hair_color VARCHAR(50),
ADD COLUMN IF NOT EXISTS hair_length VARCHAR(20), -- 'bald', 'short', 'medium', 'long'
ADD COLUMN IF NOT EXISTS facial_hair VARCHAR(50), -- 'clean_shaven', 'beard', 'mustache', 'goatee', 'stubble'
ADD COLUMN IF NOT EXISTS distinguishing_marks TEXT, -- scars, tattoos, birthmarks
ADD COLUMN IF NOT EXISTS clothing_description TEXT,
ADD COLUMN IF NOT EXISTS accessories TEXT; -- glasses, jewelry, etc.

-- ═══════════════════════════════════════════════════════════
-- 2. Add same fields to users table
-- ═══════════════════════════════════════════════════════════

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS gender TEXT,
ADD COLUMN IF NOT EXISTS assigned_camp_id UUID REFERENCES camps(id),
ADD COLUMN IF NOT EXISTS auth_uid UUID,
ADD COLUMN IF NOT EXISTS consent_given BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS consent_timestamp TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS height VARCHAR(20),
ADD COLUMN IF NOT EXISTS build VARCHAR(20),
ADD COLUMN IF NOT EXISTS skin_tone VARCHAR(20),
ADD COLUMN IF NOT EXISTS hair_color VARCHAR(50),
ADD COLUMN IF NOT EXISTS hair_length VARCHAR(20),
ADD COLUMN IF NOT EXISTS facial_hair VARCHAR(50),
ADD COLUMN IF NOT EXISTS distinguishing_marks TEXT,
ADD COLUMN IF NOT EXISTS last_known_clothing TEXT,
ADD COLUMN IF NOT EXISTS accessories TEXT;

-- ═══════════════════════════════════════════════════════════
-- 3. Create indexes for faster filtering
-- ═══════════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_users_gender ON users(gender);
CREATE INDEX IF NOT EXISTS idx_users_height ON users(height);
CREATE INDEX IF NOT EXISTS idx_users_build ON users(build);
CREATE INDEX IF NOT EXISTS idx_users_skin_tone ON users(skin_tone);
CREATE INDEX IF NOT EXISTS idx_users_hair_color ON users(hair_color);

CREATE INDEX IF NOT EXISTS idx_missing_reports_gender ON missing_reports(gender);

-- ═══════════════════════════════════════════════════════════
-- 4. Add comments for documentation
-- ═══════════════════════════════════════════════════════════

COMMENT ON COLUMN missing_reports.age_min IS 'Minimum age of missing person (for range search)';
COMMENT ON COLUMN missing_reports.age_max IS 'Maximum age of missing person (for range search)';
COMMENT ON COLUMN missing_reports.height IS 'Height category: short, average, tall';
COMMENT ON COLUMN missing_reports.build IS 'Body build: slim, average, heavy, athletic';
COMMENT ON COLUMN missing_reports.skin_tone IS 'Skin tone: fair, medium, dark';
COMMENT ON COLUMN missing_reports.distinguishing_marks IS 'Scars, tattoos, birthmarks, visible injuries';
COMMENT ON COLUMN missing_reports.clothing_description IS 'Last known clothing worn';
COMMENT ON COLUMN missing_reports.accessories IS 'Glasses, jewelry, watches, etc.';

COMMENT ON COLUMN users.height IS 'Height category: short, average, tall';
COMMENT ON COLUMN users.build IS 'Body build: slim, average, heavy, athletic';
COMMENT ON COLUMN users.skin_tone IS 'Skin tone: fair, medium, dark';
COMMENT ON COLUMN users.distinguishing_marks IS 'Scars, tattoos, birthmarks, visible injuries';
COMMENT ON COLUMN users.last_known_clothing IS 'Clothing worn during registration/check-in';
COMMENT ON COLUMN users.accessories IS 'Glasses, jewelry, watches, etc.';
