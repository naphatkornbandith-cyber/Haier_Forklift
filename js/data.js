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
      // 1. Sync Forklifts
      const remoteData = await window.supabaseService.fetchAll();
      if (Array.isArray(remoteData)) {
        const localItems = this.getAll();

        if (remoteData.length === 0 && localItems.length > 0) {
          console.log(`📤 ตรวจพบข้อมูลรถในเครื่อง ${localItems.length} รายการ กำลังนำขึ้น Supabase...`);
          try {
            await window.supabaseService.uploadLocalData(localItems);
            console.log('✅ อัปโหลดข้อมูลรถขึ้น Supabase Cloud สำเร็จเรียบร้อย');
          } catch (upErr) {
            console.warn('⚠️ ไม่สามารถอัปโหลดข้อมูลรถขึ้น Supabase ได้:', upErr);
          }
        } else {
          this.saveAll(remoteData);
          window.dispatchEvent(new CustomEvent('forklift-data-synced', {
            detail: { source: 'supabase', count: remoteData.length }
          }));
          console.log(`☁️ Supabase Cloud Synced: ${remoteData.length} forklifts loaded.`);
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
          } else {
            this.saveAllDrivers(remoteDrivers);
            window.dispatchEvent(new CustomEvent('driver-data-synced', {
              detail: { source: 'supabase', count: remoteDrivers.length }
            }));
            console.log(`☁️ Supabase Cloud Synced: ${remoteDrivers.length} drivers loaded.`);
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

  addDriver(newDriver) {
    if (this.isDriverEmpIdDuplicate(newDriver.empId)) {
      throw new Error(`รหัสพนักงาน "${newDriver.empId}" มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้`);
    }
    const drivers = this.getAllDrivers();
    const id = 'DRV-' + Date.now().toString().slice(-4);
    const completeDriver = {
      id,
      ...newDriver,
      createdAt: new Date().toISOString()
    };
    drivers.unshift(completeDriver);
    this.saveAllDrivers(drivers);

    if (window.supabaseService && window.supabaseService.isConfigured()) {
      window.supabaseService.insertDriver(completeDriver).catch(e => {
        console.warn('Supabase insertDriver warning:', e);
      });
    }

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
        this.saveAll(forklifts);
      }
    }

    window.dispatchEvent(new CustomEvent('driver-data-synced', {
      detail: { count: drivers.length }
    }));

    return completeDriver;
  }

  updateDriverData(id, driverData) {
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
      window.supabaseService.updateDriverRow(id, drivers[idx]).catch(e => {
        console.warn('Supabase updateDriverRow warning:', e);
      });
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
        this.saveAll(forklifts);
      }
    }

    window.dispatchEvent(new CustomEvent('driver-data-synced', {
      detail: { count: drivers.length }
    }));

    return drivers[idx];
  }

  deleteDriver(id) {
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
          changed = true;
          if (window.supabaseService && window.supabaseService.isConfigured()) {
            window.supabaseService.update(fl.id, fl).catch(e => console.warn(e));
          }
        }
      });
      if (changed) this.saveAll(forklifts);
    }

    if (window.supabaseService && window.supabaseService.isConfigured()) {
      window.supabaseService.deleteDriverRow(id).catch(e => {
        console.warn('Supabase deleteDriverRow warning:', e);
      });
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

  addForklift(newItem) {
    if (this.isPlateDuplicate(newItem.plateNumber)) {
      throw new Error(`เลขทะเบียน "${newItem.plateNumber}" มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้`);
    }
    if (newItem.frameNo && this.isFrameNoDuplicate(newItem.frameNo)) {
      throw new Error(`หมายเลขตัวถัง (Frame No.) "${newItem.frameNo}" มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้`);
    }
    const all = this.getAll();
    const id = 'FL-' + Date.now().toString().slice(-4);
    const completeItem = {
      id,
      ...newItem,
      createdAt: new Date().toISOString()
    };
    all.unshift(completeItem);
    this.saveAll(all);

    // Asynchronously push to Supabase
    if (window.supabaseService && window.supabaseService.isConfigured()) {
      window.supabaseService.insert(completeItem).catch(e => {
        console.warn('Supabase insert warning:', e);
      });
    }

    return completeItem;
  }

  // Condition requirement: แก้ไขข้อมูลผู้ขับ ได้จากหน้า Dash Board
  updateDriver(id, driverData) {
    const all = this.getAll();
    const index = all.findIndex(item => item.id === id);
    if (index === -1) throw new Error('ไม่พบข้อมูลรถโฟล์คลิฟท์ที่ต้องการแก้ไข');

    all[index].driver = {
      ...all[index].driver,
      ...driverData
    };
    all[index].updatedAt = new Date().toISOString();
    this.saveAll(all);

    // Asynchronously update to Supabase
    if (window.supabaseService && window.supabaseService.isConfigured()) {
      window.supabaseService.update(id, all[index]).catch(e => {
        console.warn('Supabase update warning:', e);
      });
    }

    return all[index];
  }

  // Condition requirement: แก้ไขสถานะ และ บันทึกการตรวจเช็คล่าสุด ได้จากหน้า Dash Board
  updateStatusAndInspection(id, { status, inspectionDate, notes, checklist }) {
    const all = this.getAll();
    const index = all.findIndex(item => item.id === id);
    if (index === -1) throw new Error('ไม่พบข้อมูลรถโฟล์คลิฟท์ที่ต้องการแก้ไข');

    if (status) all[index].status = status;
    if (inspectionDate) all[index].lastInspectionDate = inspectionDate;
    if (notes !== undefined) all[index].notes = notes;
    if (checklist) all[index].checklist = { ...all[index].checklist, ...checklist };
    
    all[index].updatedAt = new Date().toISOString();
    this.saveAll(all);

    // Asynchronously update to Supabase
    if (window.supabaseService && window.supabaseService.isConfigured()) {
      window.supabaseService.update(id, all[index]).catch(e => {
        console.warn('Supabase update warning:', e);
      });
    }

    return all[index];
  }

  deleteForklift(id) {
    const all = this.getAll().filter(item => item.id !== id);
    this.saveAll(all);

    // Asynchronously delete from Supabase
    if (window.supabaseService && window.supabaseService.isConfigured()) {
      window.supabaseService.delete(id).catch(e => {
        console.warn('Supabase delete warning:', e);
      });
    }

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
   * Incomplete Data Check:
   * "แจ้งเตือนในกรณีที่กรอกข้อมูลยังไม่ครบ"
   * e.g. missing 3 photos, missing driver name, missing capacity, or cert pending
   */
  getIncompleteIssues(forklift) {
    const issues = [];
    if (!forklift.plateNumber) issues.push('ยังไม่ระบุเลขทะเบียนรถ');
    if (!forklift.vehicleType) issues.push('ยังไม่ระบุประเภทรถ');
    if (!forklift.energyType) issues.push('ยังไม่ระบุประเภทพลังงาน');
    if (!forklift.liftingCapacity) issues.push('ยังไม่ระบุความสามารถยกน้ำหนัก');
    if (!forklift.ownerCompany) issues.push('ยังไม่ระบุเจ้าของรถ');

    // Photo checks: 3 photos required
    const p = forklift.photos || {};
    if (!p.front) issues.push('ขาดภาพถ่ายด้านหน้ารถ');
    if (!p.side) issues.push('ขาดภาพถ่ายด้านข้างรถ');
    if (!p.fullFront) issues.push('ขาดภาพถ่ายด้านหน้าที่เห็นทั้งคัน');

    // Driver checks
    const d = forklift.driver || {};
    if (!d.name) issues.push('ยังไม่ได้ระบุชื่อผู้ขับขี่');
    if (!d.empId) issues.push('ยังไม่ได้ระบุรหัสพนักงาน');
    if (!d.certImage || d.certStatus === 'รอดำเนินการ') {
      issues.push('ใบรับรองการอบรมรถยก: รอดำเนินการ (ยังไม่แนบภาพ)');
    }

    return issues;
  }
}

// Global instance
window.forkliftStore = new ForkliftDataStore();
window.SVG_ASSETS = SVG_ASSETS;
