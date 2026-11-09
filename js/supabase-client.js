/**
 * Haier Forklift Management System - Supabase Client & Sync Controller
 * Manages Supabase configuration, connection testing, and real-time data sync.
 */

(function (window) {
  'use strict';

  // LocalStorage keys for Supabase config
  const SB_STORAGE_URL_KEY = 'HAIER_SUPABASE_URL';
  const SB_STORAGE_KEY_KEY = 'HAIER_SUPABASE_ANON_KEY';

  // ─────────────────────────────────────────────────────────────────────────────
  // การตั้งค่า Supabase (Backend Configuration — จัดการระบบหลังบ้าน)
  // ─────────────────────────────────────────────────────────────────────────────
  const DEFAULT_SUPABASE_URL = 'https://hibrisgxtxwlirutlkuw.supabase.co';
  const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImhpYnJpc2d4dHh3bGlydXRsa3V3Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTM5NDEwNzYsImV4cCI6MjEwOTUxNzA3Nn0.2qm-WxP-SPSuNxH-y7PIvMy-STfay44WuKx8cjhBa_U';

  class SupabaseService {
    constructor() {
      this.client = null;
      this.isOnline = false;
      this.init();
    }

    /**
     * Get stored or default credentials
     */
    getConfig() {
      const storedUrl = localStorage.getItem(SB_STORAGE_URL_KEY);
      const storedKey = localStorage.getItem(SB_STORAGE_KEY_KEY);

      return {
        url: (DEFAULT_SUPABASE_URL || storedUrl || '').trim(),
        anonKey: (DEFAULT_SUPABASE_ANON_KEY || storedKey || '').trim()
      };
    }

    /**
     * Save new credentials and re-initialize client
     */
    saveConfig(url, anonKey) {
      if (url) {
        localStorage.setItem(SB_STORAGE_URL_KEY, url.trim());
      } else {
        localStorage.removeItem(SB_STORAGE_URL_KEY);
      }

      if (anonKey) {
        localStorage.setItem(SB_STORAGE_KEY_KEY, anonKey.trim());
      } else {
        localStorage.removeItem(SB_STORAGE_KEY_KEY);
      }

      this.init();
    }

    /**
     * Clear Supabase config to revert to LocalStorage mode
     */
    clearConfig() {
      localStorage.removeItem(SB_STORAGE_URL_KEY);
      localStorage.removeItem(SB_STORAGE_KEY_KEY);
      this.client = null;
      this.isOnline = false;
    }

    /**
     * Check if valid Supabase credentials exist
     */
    isConfigured() {
      const cfg = this.getConfig();
      return Boolean(
        cfg.url &&
        cfg.anonKey &&
        cfg.url.startsWith('https://') &&
        !cfg.url.includes('YOUR_PROJECT_ID') &&
        !cfg.anonKey.includes('YOUR_ANON_KEY')
      );
    }

    /**
     * Initialize Supabase client
     */
    init() {
      const cfg = this.getConfig();
      if (this.isConfigured() && window.supabase && typeof window.supabase.createClient === 'function') {
        try {
          this.client = window.supabase.createClient(cfg.url, cfg.anonKey);
          this.isOnline = true;
          console.log('✅ Supabase Client initialized successfully:', cfg.url);
        } catch (e) {
          console.warn('⚠️ Failed to initialize Supabase client:', e);
          this.client = null;
          this.isOnline = false;
        }
      } else {
        this.client = null;
        this.isOnline = false;
      }
    }

    /**
     * Test connection to Supabase database
     */
    async testConnection(urlOverride = null, keyOverride = null) {
      const url = urlOverride || this.getConfig().url;
      const key = keyOverride || this.getConfig().anonKey;

      if (!url || !key || !url.startsWith('https://')) {
        return { success: false, message: 'URL หรือ Anon Key ไม่ถูกต้อง (URL ต้องขึ้นต้นด้วย https://)' };
      }

      if (!window.supabase) {
        return { success: false, message: 'ไม่พบไลบรารี Supabase JS SDK กรุณาตรวจสอบการเชื่อมต่ออินเทอร์เน็ต' };
      }

      try {
        const testClient = window.supabase.createClient(url, key);
        // Quick ping query to forklifts table
        const { data, error } = await testClient
          .from('forklifts')
          .select('id')
          .limit(1);

        if (error) {
          if (error.code === '42P01' || error.message.includes('relation "forklifts" does not exist')) {
            return {
              success: false,
              message: 'เชื่อมต่อ Supabase ได้แล้ว แต่ยังไม่พบตาราง "forklifts" กรุณาสร้างตารางใน SQL Editor ตามคำแนะนำ'
            };
          }
          return { success: false, message: `ข้อผิดพลาดจาก Supabase: ${error.message} (Code: ${error.code || '-'})` };
        }

        return {
          success: true,
          message: 'เชื่อมต่อฐานข้อมูล Supabase สำเร็จเรียบร้อยแล้ว!'
        };
      } catch (err) {
        return { success: false, message: `ไม่สามารถเชื่อมต่อได้: ${err.message}` };
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Data Mapping Helpers (Frontend App Model <-> Supabase DB Row)
    // ──────────────────────────────────────────────────────────────────────────

    toDbRow(item) {
      return {
        id: item.id,
        plate_number: item.plateNumber || '',
        vehicle_type: item.vehicleType || '',
        energy_type: item.energyType || '',
        lifting_capacity: item.liftingCapacity || '',
        owner_company: item.ownerCompany || '',
        subcontractor: item.subcontractor || '',
        is_subcontractor: Boolean(item.isSubcontractor),
        registration_date: item.registrationDate || null,
        last_inspection_date: item.lastInspectionDate || null,
        status: item.status || 'พร้อมใช้งาน',
        photos: item.photos || {},
        checklist: item.checklist || {},
        driver: item.driver || {},
        notes: item.notes || '',
        created_at: item.createdAt || new Date().toISOString()
      };
    }

    fromDbRow(row) {
      return {
        id: row.id,
        plateNumber: row.plate_number || '',
        vehicleType: row.vehicle_type || '',
        energyType: row.energy_type || '',
        liftingCapacity: row.lifting_capacity || '',
        ownerCompany: row.owner_company || '',
        subcontractor: row.subcontractor || '',
        isSubcontractor: Boolean(row.is_subcontractor),
        registrationDate: row.registration_date || '',
        lastInspectionDate: row.last_inspection_date || '',
        status: row.status || 'พร้อมใช้งาน',
        photos: row.photos || {},
        checklist: row.checklist || {},
        driver: row.driver || {},
        notes: row.notes || '',
        createdAt: row.created_at
      };
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Supabase CRUD Operations
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Fetch all forklifts from Supabase
     */
    async fetchAll() {
      if (!this.isConfigured() || !this.client) return null;

      try {
        const { data, error } = await this.client
          .from('forklifts')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.error('❌ Supabase fetchAll error:', error);
          return null;
        }

        return (data || []).map(row => this.fromDbRow(row));
      } catch (err) {
        console.error('❌ Supabase fetchAll exception:', err);
        return null;
      }
    }

    /**
     * Insert a new forklift into Supabase
     */
    async insert(item) {
      if (!this.isConfigured() || !this.client) return null;

      const row = this.toDbRow(item);
      const { data, error } = await this.client
        .from('forklifts')
        .insert([row])
        .select();

      if (error) {
        console.error('❌ Supabase insert error:', error);
        throw new Error(`บันทึกลง Supabase ล้มเหลว: ${error.message}`);
      }

      return data && data[0] ? this.fromDbRow(data[0]) : item;
    }

    /**
     * Update an existing forklift in Supabase
     */
    async update(id, updatedItem) {
      if (!this.isConfigured() || !this.client) return null;

      const row = this.toDbRow(updatedItem);
      // Remove id from update payload
      delete row.id;

      const { data, error } = await this.client
        .from('forklifts')
        .update(row)
        .eq('id', id)
        .select();

      if (error) {
        console.error('❌ Supabase update error:', error);
        throw new Error(`อัปเดตข้อมูลบน Supabase ล้มเหลว: ${error.message}`);
      }

      return data && data[0] ? this.fromDbRow(data[0]) : updatedItem;
    }

    /**
     * Delete a forklift from Supabase
     */
    async delete(id) {
      if (!this.isConfigured() || !this.client) return null;

      const { error } = await this.client
        .from('forklifts')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Supabase delete error:', error);
        throw new Error(`ลบข้อมูลจาก Supabase ล้มเหลว: ${error.message}`);
      }

      return true;
    }

    /**
     * Clear all forklifts from Supabase
     */
    async clearAll() {
      if (!this.isConfigured() || !this.client) return null;

      // Delete where id is not null (all rows)
      const { error } = await this.client
        .from('forklifts')
        .delete()
        .neq('id', '___NEVER_MATCH___');

      if (error) {
        console.error('❌ Supabase clearAll error:', error);
        throw new Error(`ล้างข้อมูลบน Supabase ล้มเหลว: ${error.message}`);
      }

      return true;
    }

    /**
     * Subscribe to real-time changes across all devices (forklifts & drivers)
     */
    subscribeToChanges(callback) {
      if (!this.isConfigured() || !this.client) return null;
      try {
        const channel = this.client
          .channel('public:fleet_and_drivers')
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'forklifts' },
            (payload) => {
              console.log('🔄 Supabase Realtime forklifts change:', payload);
              if (typeof callback === 'function') {
                callback('forklifts', payload);
              }
            }
          )
          .on(
            'postgres_changes',
            { event: '*', schema: 'public', table: 'drivers' },
            (payload) => {
              console.log('🔄 Supabase Realtime drivers change:', payload);
              if (typeof callback === 'function') {
                callback('drivers', payload);
              }
            }
          )
          .subscribe();
        return channel;
      } catch (err) {
        console.warn('Realtime subscription error:', err);
        return null;
      }
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Drivers Data Mapping & CRUD Operations
    // ──────────────────────────────────────────────────────────────────────────

    driverToDbRow(item) {
      return {
        id: item.id,
        emp_id: item.empId || '',
        name: item.name || '',
        company: item.company || '',
        department: item.department || '',
        photo: item.photo || '',
        cert_image: item.certImage || '',
        cert_status: item.certStatus || 'รอดำเนินการ',
        has_trained: Boolean(item.hasTrained),
        assigned_plate: item.assignedPlate || '',
        notes: item.notes || '',
        created_at: item.createdAt || new Date().toISOString()
      };
    }

    driverFromDbRow(row) {
      return {
        id: row.id,
        empId: row.emp_id || '',
        name: row.name || '',
        company: row.company || '',
        department: row.department || '',
        photo: row.photo || '',
        certImage: row.cert_image || '',
        certStatus: row.cert_status || 'รอดำเนินการ',
        hasTrained: Boolean(row.has_trained),
        assignedPlate: row.assigned_plate || '',
        notes: row.notes || '',
        createdAt: row.created_at
      };
    }

    async fetchDrivers() {
      if (!this.isConfigured() || !this.client) return null;
      try {
        const { data, error } = await this.client
          .from('drivers')
          .select('*')
          .order('created_at', { ascending: false });

        if (error) {
          console.warn('⚠️ Supabase fetchDrivers error:', error);
          return null;
        }
        return (data || []).map(row => this.driverFromDbRow(row));
      } catch (err) {
        console.error('❌ Supabase fetchDrivers exception:', err);
        return null;
      }
    }

    async insertDriver(driver) {
      if (!this.isConfigured() || !this.client) return null;
      const row = this.driverToDbRow(driver);
      const { data, error } = await this.client
        .from('drivers')
        .insert([row])
        .select();

      if (error) {
        console.error('❌ Supabase insertDriver error:', error);
        throw new Error(`บันทึกข้อมูลผู้ขับขี่ลง Supabase ล้มเหลว: ${error.message}`);
      }
      return data && data[0] ? this.driverFromDbRow(data[0]) : driver;
    }

    async updateDriverRow(id, updatedDriver) {
      if (!this.isConfigured() || !this.client) return null;
      const row = this.driverToDbRow(updatedDriver);
      delete row.id;
      const { data, error } = await this.client
        .from('drivers')
        .update(row)
        .eq('id', id)
        .select();

      if (error) {
        console.error('❌ Supabase updateDriverRow error:', error);
        throw new Error(`อัปเดตข้อมูลผู้ขับขี่บน Supabase ล้มเหลว: ${error.message}`);
      }
      return data && data[0] ? this.driverFromDbRow(data[0]) : updatedDriver;
    }

    async deleteDriverRow(id) {
      if (!this.isConfigured() || !this.client) return null;
      const { error } = await this.client
        .from('drivers')
        .delete()
        .eq('id', id);

      if (error) {
        console.error('❌ Supabase deleteDriverRow error:', error);
        throw new Error(`ลบข้อมูลผู้ขับขี่จาก Supabase ล้มเหลว: ${error.message}`);
      }
      return true;
    }

    async uploadLocalDrivers(localDrivers) {
      if (!this.isConfigured() || !this.client) return;
      if (!localDrivers || localDrivers.length === 0) return;
      try {
        const rows = localDrivers.map(d => this.driverToDbRow(d));
        await this.client
          .from('drivers')
          .upsert(rows, { onConflict: 'id' });
      } catch (e) {
        console.warn('⚠️ Supabase uploadLocalDrivers error:', e);
      }
    }

    /**
     * Verify Admin Login credentials via Supabase admin_users table
     */
    async verifyAdminLogin(username, password) {
      const cleanUser = (username || '').trim();
      const cleanPass = (password || '').trim();

      if (!cleanUser || !cleanPass) {
        return { success: false, message: 'กรุณากรอกทั้งชื่อผู้ใช้และรหัสผ่าน' };
      }

      if (!this.isConfigured() || !this.client) {
        // Fallback for offline default admin if Supabase is not reachable
        if (cleanUser === 'admin' && (cleanPass === 'admin1234' || cleanPass === 'haier1234')) {
          return { success: true, user: { username: 'admin', full_name: 'ผู้ดูแลระบบ (โหมดออฟไลน์)' } };
        }
        return { success: false, message: 'ระบบฐานข้อมูลยังไม่พร้อมใช้งาน' };
      }

      try {
        const { data, error } = await this.client
          .from('admin_users')
          .select('id, username, full_name, role, is_active')
          .eq('username', cleanUser)
          .eq('password', cleanPass)
          .maybeSingle();

        if (error) {
          console.warn('⚠️ Supabase admin authentication check error:', error);
          // If table admin_users hasn't been created yet, allow default admin credentials
          if (error.code === '42P01' || error.message.includes('admin_users')) {
            if (cleanUser === 'admin' && (cleanPass === 'admin1234' || cleanPass === 'haier1234')) {
              return { success: true, user: { username: 'admin', full_name: 'ผู้ดูแลระบบหลัก (Default)' } };
            }
            return {
              success: false,
              message: 'ยังไม่พบตาราง "admin_users" ใน Supabase กรุณารัน SQL Script ใน Supabase SQL Editor'
            };
          }
          return { success: false, message: `ข้อผิดพลาดฐานข้อมูล: ${error.message}` };
        }

        if (!data) {
          // Check fallback for default admin
          if (cleanUser === 'admin' && (cleanPass === 'admin1234' || cleanPass === 'haier1234')) {
            return { success: true, user: { username: 'admin', full_name: 'ผู้ดูแลระบบหลัก (Default)' } };
          }
          return { success: false, message: 'ชื่อผู้ใช้งาน (User) หรือรหัสผ่าน (Password) ไม่ถูกต้อง' };
        }

        if (data.is_active === false) {
          return { success: false, message: 'บัญชีผู้ดูแลระบบนี้ถูกปิดการใช้งานชั่วคราว' };
        }

        return {
          success: true,
          user: data
        };
      } catch (err) {
        console.error('❌ Supabase verifyAdminLogin exception:', err);
        if (cleanUser === 'admin' && (cleanPass === 'admin1234' || cleanPass === 'haier1234')) {
          return { success: true, user: { username: 'admin', full_name: 'ผู้ดูแลระบบหลัก' } };
        }
        return { success: false, message: `เชื่อมต่อ Supabase ไม่สำเร็จ: ${err.message}` };
      }
    }

    /**
     * Upload local data to Supabase (Sync/Migration helper)
     */
    async uploadLocalData(localItems) {
      if (!this.isConfigured() || !this.client) {
        throw new Error('กรุณาตั้งค่าเชื่อมต่อ Supabase ก่อนอัปโหลดข้อมูล');
      }

      if (!localItems || localItems.length === 0) {
        return { count: 0, message: 'ไม่มีข้อมูลในเครื่องที่จะอัปโหลด' };
      }

      const rows = localItems.map(item => this.toDbRow(item));
      const { data, error } = await this.client
        .from('forklifts')
        .upsert(rows, { onConflict: 'id' });

      if (error) {
        throw new Error(`อัปโหลดข้อมูลขึ้น Supabase ล้มเหลว: ${error.message}`);
      }

      return { count: rows.length, message: `อัปโหลดข้อมูลสำเร็จ ${rows.length} รายการ` };
    }
  }

  // Export globally
  window.supabaseService = new SupabaseService();

})(window);

