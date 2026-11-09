-- ==============================================================================
-- Haier Forklift Management System - Supabase PostgreSQL Database Schema
-- Run this script in the Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. Create forklifts table
CREATE TABLE IF NOT EXISTS forklifts (
  id TEXT PRIMARY KEY,
  plate_number TEXT NOT NULL UNIQUE,
  vehicle_type TEXT,
  energy_type TEXT,
  lifting_capacity TEXT,
  owner_company TEXT,
  subcontractor TEXT,
  is_subcontractor BOOLEAN DEFAULT false,
  registration_date DATE,
  last_inspection_date DATE,
  status TEXT DEFAULT 'พร้อมใช้งาน',
  photos JSONB DEFAULT '{}'::jsonb,        -- เก็บรูป 3 มุม { front, side, fullFront }
  checklist JSONB DEFAULT '{}'::jsonb,     -- เก็บผลตรวจ 7 รายการ
  driver JSONB DEFAULT '{}'::jsonb,        -- เก็บข้อมูลคนขับ + รูปคนขับ + ใบเซอร์ AI
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Create Index on plate_number and status for fast querying
CREATE INDEX IF NOT EXISTS idx_forklifts_plate ON forklifts(plate_number);
CREATE INDEX IF NOT EXISTS idx_forklifts_status ON forklifts(status);
CREATE INDEX IF NOT EXISTS idx_forklifts_energy ON forklifts(energy_type);

-- 3. Enable Row Level Security (RLS)
ALTER TABLE forklifts ENABLE ROW LEVEL SECURITY;

-- 4. Create Policy allowing public Read, Insert, Update, and Delete via anon key
-- Note: You can customize these policies later when introducing Supabase Auth
DROP POLICY IF EXISTS "Allow public read and write forklifts" ON forklifts;

CREATE POLICY "Allow public read and write forklifts" ON forklifts
FOR ALL
USING (true)
WITH CHECK (true);

-- 5. Enable Realtime Sync between multiple devices
-- This allows all devices to receive updates automatically when data changes
ALTER PUBLICATION supabase_realtime ADD TABLE forklifts;

-- 6. Optional: Storage Bucket for Forklift Photos & Certificates
-- You can create a public bucket named 'forklift-media' in the Supabase Storage dashboard
-- Insert into storage.buckets (id, name, public) VALUES ('forklift-media', 'forklift-media', true) ON CONFLICT DO NOTHING;

