/**
 * Haier Forklift Management System - Data Store & Helper Utilities
 * Handles LocalStorage persistence, LPG 1-Year inspection logic, and Incomplete data checks.
 */

const STORAGE_KEY = 'HAIER_FORKLIFT_FLEET_DATA_V1';
const DRIVERS_STORAGE_KEY = 'HAIER_FORKLIFT_DRIVERS_DATA_V1';

// Default SVG Mock Images for clean display
const SVG_ASSETS = {
  forkliftFront: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="%230f274a"/><rect x="80" y="40" width="20" height="200" fill="%2338bdf8"/><rect x="300" y="40" width="20" height="200" fill="%2338bdf8"/><rect x="100" y="70" width="200" height="15" fill="%2300c2ff"/><rect x="100" y="150" width="200" height="15" fill="%2300c2ff"/><rect x="140" y="210" width="12" height="70" fill="%2394a3b8"/><rect x="248" y="210" width="12" height="70" fill="%2394a3b8"/><rect x="100" y="110" width="200" height="100" rx="12" fill="%23005a9e"/><circle cx="130" cy="140" r="14" fill="%23f8fafc"/><circle cx="270" cy="140" r="14" fill="%23f8fafc"/><text x="200" y="175" fill="%23ffffff" font-family="sans-serif" font-size="16" font-weight="bold" text-anchor="middle">Haier Forklift</text><text x="200" y="280" fill="%2338bdf8" font-family="sans-serif" font-size="14" text-anchor="middle">ภาพด้านหน้ารถ (Front View)</text></svg>`,
  
  forkliftSide: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="%230f274a"/><rect x="290" y="30" width="15" height="220" fill="%2338bdf8"/><rect x="280" y="235" width="90" height="15" fill="%2394a3b8"/><path d="M70,220 L70,120 L160,120 L210,80 L280,80 L280,220 Z" fill="%23005a9e"/><rect x="180" y="90" width="75" height="45" rx="4" fill="%231e293b"/><circle cx="110" cy="235" r="32" fill="%23020617" stroke="%2364748b" stroke-width="8"/><circle cx="255" cy="235" r="32" fill="%23020617" stroke="%2364748b" stroke-width="8"/><text x="175" y="180" fill="%23ffffff" font-family="sans-serif" font-size="14" font-weight="bold">HAIER</text><text x="200" y="285" fill="%2338bdf8" font-family="sans-serif" font-size="14" text-anchor="middle">ภาพด้านข้างรถ (Side View)</text></svg>`,
  
  forkliftFull: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="400" height="300" viewBox="0 0 400 300"><rect width="100%" height="100%" fill="%230a192f"/><rect x="20" y="240" width="360" height="8" fill="%23334155"/><rect x="240" y="40" width="16" height="210" fill="%2300c2ff"/><rect x="256" y="40" width="16" height="210" fill="%2300c2ff"/><rect x="240" y="230" width="110" height="15" fill="%2394a3b8"/><path d="M50,220 L50,110 L150,110 L190,60 L240,60 L240,220 Z" fill="%23005a9e"/><circle cx="90" cy="230" r="30" fill="%230f172a" stroke="%2364748b" stroke-width="6"/><circle cx="215" cy="230" r="30" fill="%230f172a" stroke="%2364748b" stroke-width="6"/><text x="140" y="165" fill="%23ffffff" font-family="sans-serif" font-size="13" font-weight="bold">Haier Smart Fleet</text><text x="200" y="280" fill="%2338bdf8" font-family="sans-serif" font-size="14" text-anchor="middle">ภาพด้านหน้าที่เห็นทั้งคัน (Full Front)</text></svg>`,

  validCert: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350" viewBox="0 0 500 350"><rect width="100%" height="100%" fill="%23fdfbf7"/><rect x="15" y="15" width="470" height="320" fill="none" stroke="%23005a9e" stroke-width="6"/><rect x="22" y="22" width="456" height="306" fill="none" stroke="%23eab308" stroke-width="2"/><text x="250" y="65" fill="%23005a9e" font-family="sans-serif" font-size="18" font-weight="bold" text-anchor="middle">หนังสือรับรองการฝึกอบรม</text><text x="250" y="90" fill="%23334155" font-family="sans-serif" font-size="14" font-weight="bold" text-anchor="middle">หลักสูตร การทำงานเกี่ยวกับรถยกอย่างปลอดภัย (Forklift Safety Operator)</text><text x="250" y="115" fill="%2364748b" font-family="sans-serif" font-size="11" text-anchor="middle">ตามมาตรฐานกรมสวัสดิการและคุ้มครองแรงงาน กระทรวงแรงงาน</text><line x1="80" y1="130" x2="420" y2="130" stroke="%23cbd5e1" stroke-width="1"/><text x="250" y="165" fill="%230f172a" font-family="sans-serif" font-size="14" text-anchor="middle">เอกสารรับรองว่าผู้ถือบัตรนี้ได้ผ่านการอบรมภาคทฤษฎีและปฏิบัติแล้ว</text><circle cx="390" cy="265" r="35" fill="none" stroke="%23dc2626" stroke-width="3"/><text x="390" y="260" fill="%23dc2626" font-family="sans-serif" font-size="10" font-weight="bold" text-anchor="middle">CERTIFIED</text><text x="390" y="275" fill="%23dc2626" font-family="sans-serif" font-size="9" text-anchor="middle">PASS 100%</text><line x1="80" y1="280" x2="220" y2="280" stroke="%230f172a" stroke-width="1.5"/><text x="150" y="298" fill="%23475569" font-family="sans-serif" font-size="11" text-anchor="middle">ผู้มีอำนาจลงนาม / วิทยากร</text><text x="250" y="325" fill="%2394a3b8" font-family="sans-serif" font-size="9" text-anchor="middle">DOC REF: HR-SAFETY-FL-2025/CERT-891</text></svg>`,

  invalidCert: `data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="500" height="350" viewBox="0 0 500 350"><rect width="100%" height="100%" fill="%23e2e8f0"/><text x="250" y="160" fill="%2364748b" font-family="sans-serif" font-size="20" font-weight="bold" text-anchor="middle">ภาพถ่ายทั่วไป / ใบเสร็จรับเงิน</text><text x="250" y="190" fill="%2394a3b8" font-family="sans-serif" font-size="13" text-anchor="middle">(ไม่พบข้อมูลหรือตราสัญลักษณ์การอบรมรถยก)</text></svg>`
};

// Initial Seed Data (Empty by default)
const INITIAL_FORKLIFTS = [];

// Deleted tracking keys in localStorage for offline action sync
const DELETED_FORKLIFTS_KEY = 'haier_deleted_forklifts_queue';
const DELETED_DRIVERS_KEY = 'haier_deleted_drivers_queue';

/**
 * Collision-free unique ID generator across multiple devices and concurrent app sessions
 */
function generateUniqueId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substring(2, 7).toUpperCase()}`;
}

class ForkliftDataStore {
  constructor() {
    this.isSyncing = false;
    this.init();
    // Auto-sync from remote if Supabase is available
    setTimeout(() => {
      this.syncFromRemote();
      this.setupRealtimeSync();
    }, 200);

    // Auto-sync whenever user switches back to this browser tab or unlocks device
    window.addEventListener('focus', () => {
      this.syncFromRemote();
    });
  }

  getDeletedQueue(type) {
    const key = type === 'forklift' ? DELETED_FORKLIFTS_KEY : DELETED_DRIVERS_KEY;
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  addToDeletedQueue(type, id) {
    const queue = this.getDeletedQueue(type);
    if (!queue.includes(id)) {
      queue.push(id);
      const key = type === 'forklift' ? DELETED_FORKLIFTS_KEY : DELETED_DRIVERS_KEY;
      localStorage.setItem(key, JSON.stringify(queue));
    }
  }

  removeFromDeletedQueue(type, id) {
    const queue = this.getDeletedQueue(type).filter(item => item !== id);
    const key = type === 'forklift' ? DELETED_FORKLIFTS_KEY : DELETED_DRIVERS_KEY;
    localStorage.setItem(key, JSON.stringify(queue));
  }

  async processPendingDeletions() {
    if (!window.supabaseService || !window.supabaseService.isConfigured() || !navigator.onLine) return;

    const deletedForklifts = this.getDeletedQueue('forklift');
    for (const id of deletedForklifts) {
      try {
        await window.supabaseService.delete(id);
        this.removeFromDeletedQueue('forklift', id);
      } catch (e) {
        console.warn('Pending forklift deletion retry failed:', id, e);
      }
    }

    const deletedDrivers = this.getDeletedQueue('driver');
    for (const id of deletedDrivers) {
      try {
        await window.supabaseService.deleteDriverRow(id);
        this.removeFromDeletedQueue('driver', id);
      } catch (e) {
        console.warn('Pending driver deletion retry failed:', id, e);
      }
    }
  }

  setupRealtimeSync() {
    if (window.supabaseService && typeof window.supabaseService.subscribeToChanges === 'function') {
      window.supabaseService.subscribeToChanges((payload) => {
        this.syncFromRemote();
      });
    }
  }

  init() {
    this.initForklifts();
    this.initDrivers();
  }

  initForklifts() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      this.saveAll(INITIAL_FORKLIFTS);
      return;
    }

    try {
      const items = JSON.parse(raw);
      // Remove mock sample data items (FL-001 through FL-005) if they exist in localStorage
      const sampleIds = ['FL-001', 'FL-002', 'FL-003', 'FL-004', 'FL-005'];
      const filtered = items.filter(item => !sampleIds.includes(item.id));
      if (filtered.length !== items.length) {
        this.saveAll(filtered);
      }
    } catch (e) {
      this.saveAll(INITIAL_FORKLIFTS);
    }
  }

  initDrivers() {
    const raw = localStorage.getItem(DRIVERS_STORAGE_KEY);
    if (!raw) {
      // Auto-extract drivers from existing forklifts if any
      const forklifts = this.getAll();
      const extracted = [];
      forklifts.forEach(fl => {
        if (fl.driver && fl.driver.name && fl.driver.name !== 'ยังไม่ระบุ') {
          if (!extracted.some(d => d.empId === fl.driver.empId && d.empId !== '-')) {
            extracted.push({
              id: 'DRV-' + Date.now().toString().slice(-4) + Math.floor(Math.random() * 100),
              empId: fl.driver.empId || ('EMP-' + Math.floor(Math.random() * 1000)),
              name: fl.driver.name,
              company: fl.driver.company || fl.ownerCompany,
              department: fl.driver.department || '-',
              photo: fl.driver.photo || '',
              certImage: fl.driver.certImage || '',
              certStatus: fl.driver.certStatus || 'รอดำเนินการ',
              hasTrained: Boolean(fl.driver.hasTrained),
              assignedPlate: fl.plateNumber || '',
              notes: '',
              createdAt: new Date().toISOString()
            });
          }
        }
      });
      this.saveAllDrivers(extracted);
    }
  }

  /**
   * Sync data from Supabase Cloud to local cache (forklifts & drivers)
   */
  async syncFromRemote() {
    if (!window.supabaseService || !window.supabaseService.isConfigured()) {
      return false;
    }

    try {
      this.isSyncing = true;
      // 0. ดำเนินการลบข้อมูลที่ค้างอยู่ในคิวออฟไลน์ของเครื่องนี้ก่อน
      await this.processPendingDeletions();

      // 1. Sync Forklifts
      const remoteData = await window.supabaseService.fetchAll();
      if (Array.isArray(remoteData)) {
        const localItems = this.getAll();

        if (remoteData.length === 0 && localItems.length > 0) {
          console.log(`📤 ตรวจพบข้อมูลรถในเครื่อง ${localItems.length} รายการ กำลังนำขึ้น Supabase...`);
          try {
            await window.supabaseService.uploadLocalData(localItems);
            localItems.forEach(item => { item._isPendingUpload = false; });
            this.saveAll(localItems);
            console.log('✅ อัปโหลดข้อมูลรถขึ้น Supabase Cloud สำเร็จเรียบร้อย');
          } catch (upErr) {
            console.warn('⚠️ ไม่สามารถอัปโหลดข้อมูลรถขึ้น Supabase ได้:', upErr);
          }
        } else {
          // Merge remote with local so locally stored photos/certs are preserved and not wiped out by empty cloud fields
          const mergedForklifts = remoteData.map(remoteFl => {
            const localMatch = localItems.find(l => l.id === remoteFl.id || l.plateNumber === remoteFl.plateNumber);
            return {
              ...remoteFl,
              photos: {
                ...(localMatch?.photos || {}),
                ...(remoteFl.photos || {})
              },
              driver: {
                ...(localMatch?.driver || {}),
                ...(remoteFl.driver || {}),
                photo: remoteFl.driver?.photo || localMatch?.driver?.photo || '',
                certImage: remoteFl.driver?.certImage || localMatch?.driver?.certImage || ''
              },
              _isPendingUpload: false
            };
          });

          // ดึงเฉพาะรถที่สร้างบนเครื่องนี้ขณะออฟไลน์ (_isPendingUpload === true) เพื่ออัปโหลดขึ้น Supabase
          // ป้องกันการ Resurrect รถที่ถูกลบไปแล้วจากอุปกรณ์อื่น
          const pendingForklifts = localItems.filter(localFl =>
            localFl._isPendingUpload === true &&
            !remoteData.some(r => r.id === localFl.id || r.plateNumber === localFl.plateNumber)
          );

          if (pendingForklifts.length > 0) {
            console.log(`📤 ตรวจพบรถที่บันทึกค้างจากเครื่องนี้ ${pendingForklifts.length} คัน กำลังอัปโหลดขึ้นคลาวด์...`);
            try {
              await window.supabaseService.uploadLocalData(pendingForklifts);
              pendingForklifts.forEach(fl => {
                fl._isPendingUpload = false;
                mergedForklifts.unshift(fl);
              });
              console.log('✅ อัปโหลดรถที่บันทึกค้างขึ้น Supabase สำเร็จ');
            } catch (upErr) {
              console.warn('⚠️ ไม่สามารถอัปโหลดรถที่ค้างในแอพขึ้นคลาวด์ได้:', upErr);
              pendingForklifts.forEach(fl => mergedForklifts.unshift(fl));
            }
          }

          this.saveAll(mergedForklifts);
          window.dispatchEvent(new CustomEvent('forklift-data-synced', {
            detail: { source: 'supabase', count: mergedForklifts.length }
          }));
          console.log(`☁️ Supabase Cloud Synced: ${mergedForklifts.length} forklifts loaded.`);
        }
      }

      // 2. Sync Drivers
      if (typeof window.supabaseService.fetchDrivers === 'function') {
        const remoteDrivers = await window.supabaseService.fetchDrivers();
        if (Array.isArray(remoteDrivers)) {
          const localDrivers = this.getAllDrivers();
          if (remoteDrivers.length === 0 && localDrivers.length > 0) {
            console.log(`📤 ตรวจพบข้อมูลผู้ขับในเครื่อง ${localDrivers.length} รายการ กำลังนำขึ้น Supabase...`);
            await window.supabaseService.uploadLocalDrivers(localDrivers);
            localDrivers.forEach(d => { d._isPendingUpload = false; });
            this.saveAllDrivers(localDrivers);
          } else {
            // Merge remote with local so locally stored driver photos/certs are preserved and not wiped out by empty cloud fields
            const mergedDrivers = remoteDrivers.map(remoteD => {
              const localMatch = localDrivers.find(l => l.id === remoteD.id || (l.empId && l.empId === remoteD.empId));
              return {
                ...remoteD,
                photo: remoteD.photo || localMatch?.photo || '',
                certImage: remoteD.certImage || localMatch?.certImage || '',
                _isPendingUpload: false
              };
            });

            // ดึงเฉพาะผู้ขับที่สร้างบนเครื่องนี้ขณะออฟไลน์ (_isPendingUpload === true) เพื่ออัปโหลดขึ้น Supabase
            // ป้องกันการ Resurrect ผู้ขับที่ถูกลบไปแล้วจากอุปกรณ์อื่น
            const pendingDrivers = localDrivers.filter(localD =>
              localD._isPendingUpload === true &&
              !remoteDrivers.some(m => m.id === localD.id || (m.empId && m.empId === localD.empId))
            );

            if (pendingDrivers.length > 0) {
              console.log(`📤 ตรวจพบข้อมูลผู้ขับที่บันทึกค้างจากเครื่องนี้ ${pendingDrivers.length} คน กำลังอัปโหลดขึ้นคลาวด์...`);
              try {
                await window.supabaseService.uploadLocalDrivers(pendingDrivers);
                pendingDrivers.forEach(d => {
                  d._isPendingUpload = false;
                  mergedDrivers.unshift(d);
                });
                console.log('✅ อัปโหลดข้อมูลผู้ขับค้างขึ้น Supabase สำเร็จ');
              } catch (upErr) {
                console.warn('⚠️ ไม่สามารถอัปโหลดผู้ขับที่ค้างในแอพขึ้นคลาวด์ได้:', upErr);
                pendingDrivers.forEach(d => mergedDrivers.unshift(d));
              }
            }

            this.saveAllDrivers(mergedDrivers);
            window.dispatchEvent(new CustomEvent('driver-data-synced', {
              detail: { source: 'supabase', count: mergedDrivers.length }
            }));
            console.log(`☁️ Supabase Cloud Synced: ${mergedDrivers.length} drivers loaded.`);
          }
        }
      }
      return true;
    } catch (err) {
      console.warn('⚠️ Supabase syncFromRemote warning:', err);
    } finally {
      this.isSyncing = false;
    }
    return false;
  }

  // ──────────────────────────────────────────────────────────────────────────
  // Driver Registry Methods
  // ──────────────────────────────────────────────────────────────────────────

  getAllDrivers() {
    try {
      const raw = localStorage.getItem(DRIVERS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  }

  saveAllDrivers(drivers) {
    try {
      localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(drivers));
    } catch (e) {
      console.error('Failed to save drivers data:', e);
      // Fallback for QuotaExceededError: only strip excessively huge uncompressed strings (>300KB)
      try {
        const lightweight = drivers.map(d => ({
          ...d,
          photo: d.photo && d.photo.length > 300000 ? '' : d.photo,
          certImage: d.certImage && d.certImage.length > 300000 ? '' : d.certImage
        }));
        localStorage.setItem(DRIVERS_STORAGE_KEY, JSON.stringify(lightweight));
        console.warn('⚠️ Saved lightweight driver records due to storage quota');
      } catch (err2) {
        console.error('Critical: unable to save even lightweight drivers data', err2);
      }
    }
  }

  getDriverById(id) {
    return this.getAllDrivers().find(d => d.id === id || d.empId === id);
  }

  isDriverEmpIdDuplicate(empId, excludeId = null) {
    if (!empId || empId === '-') return false;
    const clean = empId.trim().toUpperCase();
    return this.getAllDrivers().some(d => {
      if (excludeId && d.id === excludeId) return false;
      return (d.empId || '').trim().toUpperCase() === clean;
    });
  }

  async addDriver(newDriver) {
    if (this.isDriverEmpIdDuplicate(newDriver.empId)) {
      throw new Error(`รหัสพนักงาน "${newDriver.empId}" มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้`);
    }
    const drivers = this.getAllDrivers();
    const id = generateUniqueId('DRV');
    const completeDriver = {
      id,
      ...newDriver,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isPendingUpload: true
    };

    // Push to Supabase if configured & online
    if (window.supabaseService && window.supabaseService.isConfigured() && navigator.onLine) {
      try {
        await window.supabaseService.insertDriver(completeDriver);
        completeDriver._isPendingUpload = false;
      } catch (e) {
        if (e.code === '23505' || (e.message && (e.message.includes('รหัสพนักงาน') || e.message.includes('ซ้ำ')))) {
          throw e;
        }
        console.warn('Supabase insertDriver background warning (will retry on sync):', e);
      }
    }

    drivers.unshift(completeDriver);
    this.saveAllDrivers(drivers);

    // If assigned to a forklift, update forklift's driver as well
    if (completeDriver.assignedPlate) {
      const forklifts = this.getAll();
      const flIdx = forklifts.findIndex(f => f.plateNumber === completeDriver.assignedPlate);
      if (flIdx !== -1) {
        forklifts[flIdx].driver = {
          name: completeDriver.name,
          empId: completeDriver.empId,
          company: completeDriver.company,
          department: completeDriver.department,
          photo: completeDriver.photo,
          certImage: completeDriver.certImage,
          certStatus: completeDriver.certStatus,
          hasTrained: completeDriver.hasTrained
        };
        forklifts[flIdx].updatedAt = new Date().toISOString();
        this.saveAll(forklifts);
        if (window.supabaseService && window.supabaseService.isConfigured()) {
          window.supabaseService.update(forklifts[flIdx].id, forklifts[flIdx]).catch(e => {
            console.warn('Supabase update forklift warning:', e);
          });
        }
      }
    }

    window.dispatchEvent(new CustomEvent('driver-data-synced', {
      detail: { count: drivers.length }
    }));

    return completeDriver;
  }

  async updateDriverData(id, driverData) {
    const drivers = this.getAllDrivers();
    const idx = drivers.findIndex(d => d.id === id);
    if (idx === -1) throw new Error('ไม่พบข้อมูลผู้ขับขี่ที่ต้องการแก้ไข');

    drivers[idx] = {
      ...drivers[idx],
      ...driverData,
      updatedAt: new Date().toISOString()
    };
    this.saveAllDrivers(drivers);

    if (window.supabaseService && window.supabaseService.isConfigured()) {
      try {
        await window.supabaseService.updateDriverRow(id, drivers[idx]);
      } catch (e) {
        console.warn('Supabase updateDriverRow warning:', e);
      }
    }

    // Also update driver in assigned forklift if applicable
    if (drivers[idx].assignedPlate) {
      const forklifts = this.getAll();
      const flIdx = forklifts.findIndex(f => f.plateNumber === drivers[idx].assignedPlate);
      if (flIdx !== -1) {
        forklifts[flIdx].driver = {
          name: drivers[idx].name,
          empId: drivers[idx].empId,
          company: drivers[idx].company,
          department: drivers[idx].department,
          photo: drivers[idx].photo,
          certImage: drivers[idx].certImage,
          certStatus: drivers[idx].certStatus,
          hasTrained: drivers[idx].hasTrained
        };
        forklifts[flIdx].updatedAt = new Date().toISOString();
        this.saveAll(forklifts);
        if (window.supabaseService && window.supabaseService.isConfigured()) {
          window.supabaseService.update(forklifts[flIdx].id, forklifts[flIdx]).catch(e => {
            console.warn('Supabase update forklift warning:', e);
          });
        }
      }
    }

    window.dispatchEvent(new CustomEvent('driver-data-synced', {
      detail: { count: drivers.length }
    }));

    return drivers[idx];
  }

  async deleteDriver(id) {
    this.addToDeletedQueue('driver', id);
    const targetDriver = this.getDriverById(id);
    const drivers = this.getAllDrivers().filter(d => d.id !== id);
    this.saveAllDrivers(drivers);

    // Unassign driver from any assigned forklift
    if (targetDriver) {
      const forklifts = this.getAll();
      let changed = false;
      forklifts.forEach(fl => {
        if (fl.driver?.driverId === id || (targetDriver.assignedPlate && fl.plateNumber === targetDriver.assignedPlate)) {
          fl.driver = {
            name: 'ยังไม่ระบุ',
            empId: '-',
            company: fl.ownerCompany,
            department: '-',
            photo: '',
            hasTrained: false,
            certImage: '',
            certStatus: 'รอดำเนินการ'
          };
          fl.updatedAt = new Date().toISOString();
          changed = true;
          if (window.supabaseService && window.supabaseService.isConfigured()) {
            window.supabaseService.update(fl.id, fl).catch(e => console.warn(e));
          }
        }
      });
      if (changed) this.saveAll(forklifts);
    }

    if (window.supabaseService && window.supabaseService.isConfigured()) {
      try {
        await window.supabaseService.deleteDriverRow(id);
        this.removeFromDeletedQueue('driver', id);
      } catch (e) {
        console.warn('Supabase deleteDriverRow warning (retained in offline queue):', e);
      }
    }

    window.dispatchEvent(new CustomEvent('driver-data-synced', {
      detail: { count: drivers.length }
    }));

    return true;
  }

  getAll() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : INITIAL_FORKLIFTS;
    } catch (e) {
      console.error('Failed to load fleet data:', e);
      return INITIAL_FORKLIFTS;
    }
  }

  saveAll(data) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    } catch (e) {
      console.error('Failed to save fleet data:', e);
      try {
        const lightweight = data.map(item => ({
          ...item,
          driver: item.driver ? {
            ...item.driver,
            photo: item.driver.photo && item.driver.photo.length > 300000 ? '' : item.driver.photo,
            certImage: item.driver.certImage && item.driver.certImage.length > 300000 ? '' : item.driver.certImage
          } : item.driver
        }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(lightweight));
        console.warn('⚠️ Saved lightweight fleet records due to storage quota');
      } catch (err2) {
        console.error('Critical: unable to save even lightweight fleet data', err2);
      }
    }
  }

  clearAll() {
    this.saveAll([]);
    if (window.supabaseService && window.supabaseService.isConfigured()) {
      window.supabaseService.clearAll().catch(e => {
        console.warn('Supabase clearAll warning:', e);
      });
    }
    return [];
  }

  getById(id) {
    const all = this.getAll();
    return all.find(item => item.id === id || item.plateNumber.toLowerCase() === id.toLowerCase());
  }

  // Duplicate Check: ทะเบียนรถที่เคยมีในระบบแล้วจะไม่สามารถลงทะเบียนซ้ำได้
  isPlateDuplicate(plateNumber, excludeId = null) {
    if (!plateNumber) return false;
    const cleanPlate = plateNumber.trim().toUpperCase().replace(/\s+/g, '');
    const all = this.getAll();
    return all.some(item => {
      if (excludeId && item.id === excludeId) return false;
      const existingClean = item.plateNumber.trim().toUpperCase().replace(/\s+/g, '');
      return existingClean === cleanPlate;
    });
  }

  // Duplicate Check: Frame No. (หมายเลขตัวถัง) ห้ามซ้ำกันในระบบ
  isFrameNoDuplicate(frameNo, excludeId = null) {
    if (!frameNo) return false;
    const cleanFrame = frameNo.trim().toUpperCase().replace(/\s+/g, '');
    const all = this.getAll();
    return all.some(item => {
      if (excludeId && item.id === excludeId) return false;
      if (!item.frameNo) return false;
      const existingClean = item.frameNo.trim().toUpperCase().replace(/\s+/g, '');
      return existingClean === cleanFrame;
    });
  }

  // เซ็ตการรันเลขทะเบียนสำหรับรถเช่า: "SP-{000}" เช่น SP-001, SP-002, ...
  getNextRentalPlateNumber() {
    const all = this.getAll();
    let maxNum = 0;
    const regex = /^SP-(\d+)$/i;
    all.forEach(item => {
      if (item.plateNumber) {
        const match = item.plateNumber.trim().match(regex);
        if (match) {
          const num = parseInt(match[1], 10);
          if (!isNaN(num) && num > maxNum) {
            maxNum = num;
          }
        }
      }
    });
    const nextNum = maxNum + 1;
    return `SP-${String(nextNum).padStart(3, '0')}`;
  }

  async addForklift(newItem) {
    if (this.isPlateDuplicate(newItem.plateNumber)) {
      throw new Error(`เลขทะเบียน "${newItem.plateNumber}" มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้`);
    }
    if (newItem.frameNo && this.isFrameNoDuplicate(newItem.frameNo)) {
      throw new Error(`หมายเลขตัวถัง (Frame No.) "${newItem.frameNo}" มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้`);
    }
    const all = this.getAll();
    const id = generateUniqueId('FL');
    const completeItem = {
      id,
      ...newItem,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      _isPendingUpload: true
    };

    // Push to Supabase if configured & online
    if (window.supabaseService && window.supabaseService.isConfigured() && navigator.onLine) {
      try {
        await window.supabaseService.insert(completeItem);
        completeItem._isPendingUpload = false;
      } catch (e) {
        if (e.code === '23505' || (e.message && (e.message.includes('ทะเบียน') || e.message.includes('หมายเลขตัวถัง') || e.message.includes('ซ้ำ')))) {
          throw e;
        }
        console.warn('Supabase insert warning (will retry on sync):', e);
      }
    }

    all.unshift(completeItem);
    this.saveAll(all);

    window.dispatchEvent(new CustomEvent('forklift-data-synced', {
      detail: { count: all.length }
    }));

    return completeItem;
  }

  // Condition requirement: แก้ไขข้อมูลผู้ขับ ได้จากหน้า Dash Board
  async updateDriver(id, driverData) {
    const all = this.getAll();
    const index = all.findIndex(item => item.id === id);
    if (index === -1) throw new Error('ไม่พบข้อมูลรถโฟล์คลิฟท์ที่ต้องการแก้ไข');

    all[index].driver = {
      ...all[index].driver,
      ...driverData
    };
    all[index].updatedAt = new Date().toISOString();
    this.saveAll(all);

    // Update to Supabase
    if (window.supabaseService && window.supabaseService.isConfigured()) {
      try {
        await window.supabaseService.update(id, all[index]);
      } catch (e) {
        console.warn('Supabase update warning:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('forklift-data-synced', {
      detail: { count: all.length }
    }));

    return all[index];
  }

  // Condition requirement: แก้ไขสถานะ และ บันทึกการตรวจเช็คล่าสุด ได้จากหน้า Dash Board
  async updateStatusAndInspection(id, { status, inspectionDate, notes, checklist, contractExpiryDate }) {
    const all = this.getAll();
    const index = all.findIndex(item => item.id === id);
    if (index === -1) throw new Error('ไม่พบข้อมูลรถโฟล์คลิฟท์ที่ต้องการแก้ไข');

    if (status) all[index].status = status;
    if (inspectionDate) all[index].lastInspectionDate = inspectionDate;
    if (contractExpiryDate !== undefined) all[index].contractExpiryDate = contractExpiryDate;
    if (notes !== undefined) all[index].notes = notes;
    if (checklist) all[index].checklist = { ...all[index].checklist, ...checklist };
    
    all[index].updatedAt = new Date().toISOString();
    this.saveAll(all);

    // Update to Supabase
    if (window.supabaseService && window.supabaseService.isConfigured()) {
      try {
        await window.supabaseService.update(id, all[index]);
      } catch (e) {
        console.warn('Supabase update warning:', e);
      }
    }

    window.dispatchEvent(new CustomEvent('forklift-data-synced', {
      detail: { count: all.length }
    }));

    return all[index];
  }

  async deleteForklift(id) {
    this.addToDeletedQueue('forklift', id);
    const all = this.getAll().filter(item => item.id !== id);
    this.saveAll(all);

    // Delete from Supabase
    if (window.supabaseService && window.supabaseService.isConfigured()) {
      try {
        await window.supabaseService.delete(id);
        this.removeFromDeletedQueue('forklift', id);
      } catch (e) {
        console.warn('Supabase delete warning (retained in offline queue):', e);
      }
    }

    window.dispatchEvent(new CustomEvent('forklift-data-synced', {
      detail: { count: all.length }
    }));

    return true;
  }

  resetToDefault() {
    this.saveAll(INITIAL_FORKLIFTS);
    return INITIAL_FORKLIFTS;
  }

  /**
   * LPG 1-Year Inspection Check:
   * "รถประเภทพลังงาน LPG ใกล้ครบกำหนดตรวจเช็คในรอบ 1 ปีที่ผ่านมา 
   * โดยมีการแจ้งเตือนล่วงหน้า 1 เดือนและจะคงอยู่จนกว่าจะมีการกรอกข้อมูลตรวจเช็คล่าสุด 
   * ถึงแม้ว่าจะผ่านกำหนดเวลามาแล้วก็ตาม"
   */
  getLpgStatus(forklift, referenceDate = new Date()) {
    if (!forklift || forklift.energyType !== 'LPG') {
      return { isLpg: false, alertLevel: 'none', daysRemaining: null, text: 'ไม่ใช่ระบบ LPG' };
    }

    const checkDateStr = forklift.lastInspectionDate || forklift.registrationDate;
    if (!checkDateStr) {
      return {
        isLpg: true,
        alertLevel: 'overdue',
        daysRemaining: -999,
        text: 'ยังไม่เคยบันทึกวันตรวจเช็ค (ต้องตรวจทันที)'
      };
    }

    const lastDate = new Date(checkDateStr);
    // Due date is exactly 1 year (365 days) from last inspection
    const dueDate = new Date(lastDate);
    dueDate.setFullYear(dueDate.getFullYear() + 1);

    const ref = new Date(referenceDate);
    const diffTime = dueDate.getTime() - ref.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    // Overdue condition: Over 1 year passed, alert stays until latest inspection is submitted
    if (diffDays < 0) {
      return {
        isLpg: true,
        alertLevel: 'overdue',
        daysRemaining: diffDays,
        overdueDays: Math.abs(diffDays),
        dueDateStr: dueDate.toISOString().split('T')[0],
        text: `เลยกำหนดตรวจรอบ 1 ปี มาแล้ว ${Math.abs(diffDays)} วัน! (รอการตรวจเช็คล่าสุด)`
      };
    }

    // Advance 1 month warning (<= 30 days remaining)
    if (diffDays <= 30) {
      return {
        isLpg: true,
        alertLevel: 'warning',
        daysRemaining: diffDays,
        dueDateStr: dueDate.toISOString().split('T')[0],
        text: `ใกล้ครบกำหนดในอีก ${diffDays} วัน (แจ้งเตือนล่วงหน้า 1 เดือน)`
      };
    }

    // Normal / Safe
    return {
      isLpg: true,
      alertLevel: 'ok',
      daysRemaining: diffDays,
      dueDateStr: dueDate.toISOString().split('T')[0],
      text: `ตรวจเช็คปกติ (ครบกำหนดถัดไปในอีก ${diffDays} วัน)`
    };
  }

  /**
   * Rental Contract Expiry Check:
   * "วันหมดสัญญาเช่า พร้อมลิงก์เข้าศูนย์แจ้งเตือนล่วงหน้า 1 เดือน"
   */
  getRentalContractStatus(forklift, referenceDate = new Date()) {
    if (!forklift || !forklift.isSubcontractor || !forklift.contractExpiryDate) {
      return { isRental: Boolean(forklift?.isSubcontractor), alertLevel: 'none', daysRemaining: null, text: 'ไม่ใช่รถเช่าหรือยังไม่ระบุวันหมดสัญญา' };
    }

    const expiryDate = new Date(forklift.contractExpiryDate);
    if (isNaN(expiryDate.getTime())) {
      return { isRental: true, alertLevel: 'none', daysRemaining: null, text: 'วันที่หมดสัญญาไม่ถูกต้อง' };
    }

    const ref = new Date(referenceDate);
    const diffTime = expiryDate.getTime() - ref.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      return {
        isRental: true,
        alertLevel: 'expired',
        daysRemaining: diffDays,
        overdueDays: Math.abs(diffDays),
        expiryDateStr: forklift.contractExpiryDate,
        text: `หมดสัญญาเช่าแล้ว (${Math.abs(diffDays)} วันที่ผ่านมา)`
      };
    }

    if (diffDays <= 30) {
      return {
        isRental: true,
        alertLevel: 'warning',
        daysRemaining: diffDays,
        expiryDateStr: forklift.contractExpiryDate,
        text: `สัญญาเช่าจะหมดอายุในอีก ${diffDays} วัน (แจ้งเตือนล่วงหน้า 1 เดือน)`
      };
    }

    return {
      isRental: true,
      alertLevel: 'ok',
      daysRemaining: diffDays,
      expiryDateStr: forklift.contractExpiryDate,
      text: `สัญญาเช่ามีอายุเหลืออีก ${diffDays} วัน`
    };
  }

  /**
   * Vehicle Data Issues Check:
   * แจ้งเตือนข้อบกพร่องเกี่ยวกับตัวรถ เช่น ยังไม่แนบภาพถ่ายสภาพรถ หรือข้อมูลสเปกไม่ครบ
   */
  getVehicleIssues(forklift) {
    const issues = [];
    if (!forklift.plateNumber) issues.push('ยังไม่ระบุเลขทะเบียนรถ');
    if (!forklift.vehicleType) issues.push('ยังไม่ระบุประเภทรถ');
    if (!forklift.energyType) issues.push('ยังไม่ระบุประเภทพลังงาน');
    if (!forklift.liftingCapacity) issues.push('ยังไม่ระบุความสามารถยกน้ำหนัก');
    if (!forklift.ownerCompany) issues.push('ยังไม่ระบุเจ้าของรถ');

    // Photo check: 1 vehicle photo required (แนบ 1 รูป ไม่ต้องระบุว่ามุมไหน)
    const p = forklift.photos || {};
    const hasPhoto = Boolean(p.vehicle || p.front || p.side || p.fullFront || forklift.photo);
    if (!hasPhoto) {
      issues.push('ยังไม่ได้แนบภาพถ่ายสภาพรถ Forklift');
    }

    return issues;
  }

  /**
   * Driver Data & Certification Issues Check:
   * แจ้งเตือนข้อบกพร่องเกี่ยวกับคนขับ เช่น ยังไม่ระบุผู้ขับ หรือใบเซอร์รอดำเนินการ/ไม่ถูกต้อง
   */
  getDriverIssues(forklift) {
    const issues = [];
    const d = forklift.driver || {};
    if (!d.name || d.name === 'ยังไม่ระบุ') {
      issues.push('ยังไม่ได้ระบุผู้ขับประจำรถ');
    } else {
      if (!d.empId || d.empId === '-') issues.push('ยังไม่ระบุรหัสพนักงาน');
      if (!d.certImage && (!d.certStatus || d.certStatus === 'รอดำเนินการ')) {
        issues.push('ใบรับรองการอบรมรถยก: รอดำเนินการ (ยังไม่แนบภาพ)');
      } else if (d.certStatus === 'รอดำเนินการ') {
        issues.push('ใบรับรองการอบรมรถยก: รอดำเนินการ (รอตรวจสอบ AI)');
      } else if (d.certStatus === 'ไม่ถูกต้อง') {
        issues.push('ใบรับรองการอบรมไม่ถูกต้อง / ไม่ผ่านเกณฑ์');
      }
    }
    return issues;
  }

  /**
   * Incomplete Data Check (Combined for backward compatibility)
   */
  getIncompleteIssues(forklift) {
    return [...this.getVehicleIssues(forklift), ...this.getDriverIssues(forklift)];
  }
}

// Global instance
window.forkliftStore = new ForkliftDataStore();
window.SVG_ASSETS = SVG_ASSETS;
