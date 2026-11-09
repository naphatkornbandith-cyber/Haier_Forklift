-- ==============================================================================
-- Haier Forklift Management System - Supabase PostgreSQL Database Schema
-- Run this script in the Supabase SQL Editor (SQL Editor -> New Query -> Run)
-- ==============================================================================

-- 1. Create forklifts table
CREATE TABLE IF NOT EXISTS forklifts (
  id TEXT PRIMARY KEY,
  plate_number TEXT NOT NULL UNIQUE,
  frame_no TEXT,                           -- หมายเลขตัวถัง (Frame No. / Chassis No. ห้ามซ้ำ)
  vehicle_type TEXT,
  energy_type TEXT,
  lifting_capacity TEXT,
  owner_company TEXT,
  subcontractor TEXT,
  is_subcontractor BOOLEAN DEFAULT false,
  registration_date DATE,
  last_inspection_date DATE,
  contract_expiry_date DATE,               -- วันหมดสัญญาเช่า (สำหรับรถเช่า แจ้งเตือนล่วงหน้า 1 เดือน)
  status TEXT DEFAULT 'พร้อมใช้งาน',
  photos JSONB DEFAULT '{}'::jsonb,        -- เก็บรูป 3 มุม { front, side, fullFront }
  checklist JSONB DEFAULT '{}'::jsonb,     -- เก็บผลตรวจ 7 รายการ
  driver JSONB DEFAULT '{}'::jsonb,        -- เก็บข้อมูลคนขับ + รูปคนขับ + ใบเซอร์ AI
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- เพิ่มคอลัมน์ในกรณีตารางเดิมมีอยู่แล้ว (Migration)
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS frame_no TEXT;
ALTER TABLE forklifts ADD COLUMN IF NOT EXISTS contract_expiry_date DATE;

-- 2. Create Index on plate_number and status for fast querying
CREATE INDEX IF NOT EXISTS idx_forklifts_plate ON forklifts(plate_number);
CREATE INDEX IF NOT EXISTS idx_forklifts_frame ON forklifts(frame_no);
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

-- ==============================================================================
-- 6. Create admin_users table (ตารางจัดการผู้ดูแลระบบ Admin)
-- คุณสามารถเพิ่ม/ลบ/แก้ไข User และ Password ผู้ดูแลระบบใน Supabase Table Editor ได้โดยตรง
-- ==============================================================================
CREATE TABLE IF NOT EXISTS admin_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  username TEXT NOT NULL UNIQUE,          -- ชื่อผู้ใช้งาน (User)
  password TEXT NOT NULL,                 -- รหัสผ่าน (Password)
  full_name TEXT,                         -- ชื่อ-นามสกุล / แผนก
  role TEXT DEFAULT 'admin',              -- ระดับสิทธิ์ (เช่น admin, supervisor, manager)
  is_active BOOLEAN DEFAULT true,         -- สถานะเปิดใช้งาน (true = ใช้งานได้, false = ระงับ)
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast username lookup
CREATE INDEX IF NOT EXISTS idx_admin_users_username ON admin_users(username);

-- Enable RLS for admin_users
ALTER TABLE admin_users ENABLE ROW LEVEL SECURITY;

-- Allow public verification for admin login via API
DROP POLICY IF EXISTS "Allow select for admin authentication" ON admin_users;
CREATE POLICY "Allow select for admin authentication" ON admin_users
FOR SELECT
USING (true);

-- เพิ่ม User และ Password ของ Admin เริ่มต้น (สามารถเปลี่ยนรหัสหรือเพิ่มคนใหม่ได้ใน Supabase)
INSERT INTO admin_users (username, password, full_name, role)
VALUES 
  ('admin', 'admin1234', 'ผู้ดูแลระบบหลัก (Super Admin)', 'admin'),
  ('haier_admin', 'haier1234', 'ผู้ดูแลระบบ Haier Logistics', 'admin')
ON CONFLICT (username) DO NOTHING;

-- 7. Create drivers table (ตารางทะเบียนผู้ขับขี่รถ Forklift)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS drivers (
  id TEXT PRIMARY KEY,
  emp_id TEXT NOT NULL UNIQUE,             -- รหัสพนักงาน
  name TEXT NOT NULL,                      -- ชื่อ-นามสกุล ผู้ขับขี่
  company TEXT,                            -- สังกัด (บริษัท/ซัพพลายเออร์)
  department TEXT,                         -- แผนกที่ปฏิบัติงาน
  photo TEXT,                              -- ภาพถ่ายผู้ขับขี่
  cert_image TEXT,                         -- ภาพใบรับรองการอบรม
  cert_status TEXT DEFAULT 'รอดำเนินการ', -- ผ่านการรับรอง / ไม่ถูกต้อง / รอดำเนินการ
  has_trained BOOLEAN DEFAULT false,
  assigned_plate TEXT,                     -- เลขทะเบียนรถ Forklift ที่ขับประจำ
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_drivers_emp_id ON drivers(emp_id);
CREATE INDEX IF NOT EXISTS idx_drivers_cert_status ON drivers(cert_status);

ALTER TABLE drivers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow public read and write drivers" ON drivers;
CREATE POLICY "Allow public read and write drivers" ON drivers
FOR ALL
USING (true)
WITH CHECK (true);

ALTER PUBLICATION supabase_realtime ADD TABLE drivers;

-- 8. Optional: Storage Bucket for Forklift Photos & Certificates
-- You can create a public bucket named 'forklift-media' in the Supabase Storage dashboard
-- Insert into storage.buckets (id, name, public) VALUES ('forklift-media', 'forklift-media', true) ON CONFLICT DO NOTHING;

