/**
 * Haier Forklift Management System - Main Application Controller
 * Handles Dashboard rendering, tab navigation, search & filters,
 * form submission, photo uploads, AI verification, and modals.
 */

document.addEventListener('DOMContentLoaded', () => {
  // Application State
  const state = {
    currentTab: 'dashboard-tab',
    activeFilter: 'all',
    searchQuery: '',
    selectedForklift: null,
    // Registration Form Temp State
    regPhotos: {
      front: '',
      side: '',
      fullFront: ''
    },
    regChecklist: {
      forks: true,
      brakes: true,
      hydraulics: true,
      tires: true,
      lightsHorn: true,
      seatbeltGuard: true,
      energySystem: true
    },
    regCert: {
      image: '',
      status: 'รอดำเนินการ', // Default as per requirement
      confidence: 0,
      isCertified: false
    },
    // Edit Driver Temp State
    editDriverCert: {
      image: '',
      status: 'รอดำเนินการ'
    }
  };

  // DOM Elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const searchInput = document.getElementById('search-input');
  const filterPills = document.querySelectorAll('.filter-pill');
  const fleetTableBody = document.getElementById('fleet-table-body');
  
  // KPI Count Elements
  const kpiTotal = document.getElementById('kpi-total');
  const kpiReady = document.getElementById('kpi-ready');
  const kpiRepair = document.getElementById('kpi-repair');
  const kpiLpgAlert = document.getElementById('kpi-lpg-alert');
  const kpiIncomplete = document.getElementById('kpi-incomplete');
  const kpiPendingCert = document.getElementById('kpi-pending-cert');
  const alertTabBadge = document.getElementById('alert-tab-badge');
  const lpgAlertBanner = document.getElementById('lpg-alert-banner');
  const lpgBannerText = document.getElementById('lpg-banner-text');

  // Registration Form Elements
  const regForm = document.getElementById('forklift-reg-form');
  const regPlateInput = document.getElementById('reg-plate');
  const duplicateAlert = document.getElementById('duplicate-plate-alert');
  const duplicateAlertMsg = document.getElementById('duplicate-alert-msg');
  const regEnergySelect = document.getElementById('reg-energy');
  const regLpgNote = document.getElementById('reg-lpg-note');
  const btnPassAllChecklist = document.getElementById('btn-pass-all-checklist');
  const regCertUpload = document.getElementById('reg-cert-upload');
  const regCertPreview = document.getElementById('reg-cert-preview');
  const regCertLaser = document.getElementById('reg-cert-laser');
  const regAiStatus = document.getElementById('reg-ai-status');
  const regAiConfidenceFill = document.getElementById('reg-ai-confidence-fill');
  const regAiConfidenceText = document.getElementById('reg-ai-confidence-text');
  const regAiDetails = document.getElementById('reg-ai-details');
  const regAiTags = document.getElementById('reg-ai-tags');

  // Modals
  const modalView = document.getElementById('modal-view-details');
  const modalEditDriver = document.getElementById('modal-edit-driver');
  const modalUpdateStatus = document.getElementById('modal-update-status');

  // Initialize Clock
  function updateClock() {
    const clockEl = document.getElementById('current-time-display');
    if (clockEl) {
      const now = new Date();
      clockEl.textContent = now.toLocaleDateString('th-TH', {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    }
  }
  setInterval(updateClock, 1000);
  updateClock();

  // --------------------------------------------------------------------------
  // Tab Switching
  // --------------------------------------------------------------------------
  function switchTab(tabId) {
    state.currentTab = tabId;
    tabButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.tab === tabId);
    });
    tabContents.forEach(content => {
      content.classList.toggle('active', content.id === tabId);
    });

    if (tabId === 'dashboard-tab') {
      renderDashboard();
    } else if (tabId === 'alerts-tab') {
      renderAlertsCenter();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Shortcut link in banner or duplicate alert
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-switch-tab]')) {
      const targetTab = e.target.closest('[data-switch-tab]').dataset.switchTab;
      switchTab(targetTab);
    }
  });

  // --------------------------------------------------------------------------
  // Dashboard & Fleet Table Rendering
  // --------------------------------------------------------------------------
  function renderDashboard() {
    const forklifts = window.forkliftStore.getAll();

    // 1. Calculate KPI Metrics
    let readyCount = 0;
    let repairCount = 0;
    let lpgAlertCount = 0;
    let incompleteCount = 0;
    let pendingCertCount = 0;
    const lpgAlertItems = [];

    forklifts.forEach(item => {
      if (item.status === 'พร้อมใช้งาน') readyCount++;
      if (item.status === 'ส่งซ่อม') repairCount++;

      const lpgStatus = window.forkliftStore.getLpgStatus(item);
      if (lpgStatus.isLpg && (lpgStatus.alertLevel === 'warning' || lpgStatus.alertLevel === 'overdue')) {
        lpgAlertCount++;
        lpgAlertItems.push({ item, lpgStatus });
      }

      const issues = window.forkliftStore.getIncompleteIssues(item);
      if (issues.length > 0) incompleteCount++;

      if (!item.driver || item.driver.certStatus === 'รอดำเนินการ') {
        pendingCertCount++;
      }
    });

    // Update KPI UI
    kpiTotal.textContent = forklifts.length;
    kpiReady.textContent = readyCount;
    kpiRepair.textContent = repairCount;
    kpiLpgAlert.textContent = lpgAlertCount;
    kpiIncomplete.textContent = incompleteCount;
    kpiPendingCert.textContent = pendingCertCount;

    // Total Alerts on tab badge
    const totalAlerts = lpgAlertCount + incompleteCount;
    if (totalAlerts > 0) {
      alertTabBadge.style.display = 'inline-flex';
      alertTabBadge.textContent = totalAlerts;
    } else {
      alertTabBadge.style.display = 'none';
    }

    // Top LPG Banner
    if (lpgAlertCount > 0) {
      lpgAlertBanner.style.display = 'flex';
      const overdueList = lpgAlertItems.filter(x => x.lpgStatus.alertLevel === 'overdue');
      if (overdueList.length > 0) {
        lpgBannerText.innerHTML = `พบรถพลังงาน LPG <strong>เลยกำหนดตรวจเช็คประจำปีแล้ว ${overdueList.length} คัน</strong> (และการแจ้งเตือนจะคงอยู่จนกว่าจะมีการตรวจเช็คล่าสุด)`;
      } else {
        lpgBannerText.innerHTML = `พบรถพลังงาน LPG <strong>ใกล้ครบกำหนดตรวจเช็คในรอบ 1 ปี จำนวน ${lpgAlertCount} คัน</strong> (แจ้งเตือนล่วงหน้า 1 เดือน)`;
      }
    } else {
      lpgAlertBanner.style.display = 'none';
    }

    // 2. Filter & Search List
    let filtered = forklifts.filter(item => {
      // Search matching across: plate, vehicleType, energyType, ownerCompany, subcontractor
      if (state.searchQuery) {
        const q = state.searchQuery.toLowerCase();
        const matchPlate = (item.plateNumber || '').toLowerCase().includes(q);
        const matchType = (item.vehicleType || '').toLowerCase().includes(q);
        const matchEnergy = (item.energyType || '').toLowerCase().includes(q);
        const matchOwner = (item.ownerCompany || '').toLowerCase().includes(q) || (item.subcontractor || '').toLowerCase().includes(q);
        const matchDriver = (item.driver?.name || '').toLowerCase().includes(q);
        if (!matchPlate && !matchType && !matchEnergy && !matchOwner && !matchDriver) return false;
      }

      // Filter pills
      if (state.activeFilter === 'all') return true;
      if (state.activeFilter === 'ready') return item.status === 'พร้อมใช้งาน';
      if (state.activeFilter === 'repair') return item.status === 'ส่งซ่อม';
      if (state.activeFilter === 'electric') return item.energyType === 'ไฟฟ้า';
      if (state.activeFilter === 'lpg') return item.energyType === 'LPG';
      if (state.activeFilter === 'diesel') return item.energyType === 'ดีเซล';
      if (state.activeFilter === 'haier') return !item.isSubcontractor;
      if (state.activeFilter === 'subcontractor') return item.isSubcontractor;
      if (state.activeFilter === 'lpg-alert') {
        const s = window.forkliftStore.getLpgStatus(item);
        return s.isLpg && (s.alertLevel === 'warning' || s.alertLevel === 'overdue');
      }
      if (state.activeFilter === 'incomplete') {
        return window.forkliftStore.getIncompleteIssues(item).length > 0;
      }
      return true;
    });

    // 3. Render Table Rows
    fleetTableBody.innerHTML = '';
    if (filtered.length === 0) {
      if (forklifts.length === 0) {
        fleetTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding: 3.5rem 1rem; color: var(--text-muted);">
              <i class="fa-solid fa-truck-ramp-box" style="font-size: 2.8rem; margin-bottom: 0.85rem; color: var(--haier-cyan); opacity: 0.7;"></i>
              <p style="font-size: 1.05rem; font-weight: 600; color: #fff; margin-bottom: 0.35rem;">ยังไม่มีข้อมูลรถโฟล์คลิฟท์ในระบบ</p>
              <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 1.25rem;">เริ่มต้นบันทึกข้อมูลโดยการขึ้นทะเบียนรถคันแรกเข้าสู่ระบบสำรวจ</p>
              <button type="button" class="btn btn-primary btn-sm" data-switch-tab="register-tab">
                <i class="fa-solid fa-square-plus"></i> ลงทะเบียนรถโฟล์คลิฟท์ใหม่
              </button>
            </td>
          </tr>
        `;
      } else {
        fleetTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding: 3rem 1rem; color: var(--text-muted);">
              <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--surface-border);"></i>
              <p>ไม่พบข้อมูลรถโฟล์คลิฟท์ที่ตรงตามเงื่อนไขการค้นหา</p>
            </td>
          </tr>
        `;
      }
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');

      // Status Badge
      const statusBadge = item.status === 'พร้อมใช้งาน'
        ? `<span class="status-badge badge-ready"><i class="fa-solid fa-circle-check"></i> พร้อมใช้งาน</span>`
        : `<span class="status-badge badge-repair"><i class="fa-solid fa-triangle-exclamation"></i> ส่งซ่อม</span>`;

      // Energy Badge
      let energyClass = 'energy-electric';
      let energyIcon = 'fa-bolt';
      if (item.energyType === 'LPG') {
        energyClass = 'energy-lpg';
        energyIcon = 'fa-fire-flame-simple';
      } else if (item.energyType === 'ดีเซล') {
        energyClass = 'energy-diesel';
        energyIcon = 'fa-gas-pump';
      }
      const energyBadge = `<span class="badge-energy ${energyClass}"><i class="fa-solid ${energyIcon}"></i> ${item.energyType}</span>`;

      // LPG Alert Tag
      const lpgStatus = window.forkliftStore.getLpgStatus(item);
      let lpgTag = '';
      if (lpgStatus.isLpg) {
        if (lpgStatus.alertLevel === 'overdue') {
          lpgTag = `<div style="margin-top:0.35rem;"><span class="status-badge badge-lpg-overdue"><i class="fa-solid fa-circle-exclamation"></i> เกินกำหนดตรวจ 1 ปี (${lpgStatus.overdueDays} วัน)</span></div>`;
        } else if (lpgStatus.alertLevel === 'warning') {
          lpgTag = `<div style="margin-top:0.35rem;"><span class="status-badge badge-lpg-warn"><i class="fa-solid fa-clock"></i> ครบกำหนดตรวจใน ${lpgStatus.daysRemaining} วัน</span></div>`;
        } else {
          lpgTag = `<div style="margin-top:0.25rem; font-size:0.75rem; color:var(--text-muted);"><i class="fa-solid fa-calendar-check"></i> ตรวจล่าสุด: ${item.lastInspectionDate || '-'}</div>`;
        }
      }

      // Driver Info & Cert Badge
      const driver = item.driver || { name: 'ยังไม่ระบุ', empId: '-', certStatus: 'รอดำเนินการ' };
      let certBadge = '';
      if (driver.certStatus === 'ผ่านการรับรอง') {
        certBadge = `<span class="status-badge badge-cert-valid"><i class="fa-solid fa-award"></i> ผ่านการรับรอง (AI Verified)</span>`;
      } else if (driver.certStatus === 'ไม่ถูกต้อง') {
        certBadge = `<span class="status-badge badge-repair"><i class="fa-solid fa-circle-xmark"></i> ใบเซอร์ไม่ถูกต้อง</span>`;
      } else {
        // Pending as required
        certBadge = `<span class="status-badge badge-cert-pending"><i class="fa-solid fa-hourglass-half"></i> รอดำเนินการ</span>`;
      }

      // Incomplete Badge if any
      const issues = window.forkliftStore.getIncompleteIssues(item);
      const incompleteBadge = issues.length > 0
        ? `<div style="margin-top:0.25rem;"><span class="status-badge badge-repair" style="font-size:0.7rem;"><i class="fa-solid fa-circle-dot"></i> ข้อมูลไม่ครบ (${issues.length})</span></div>`
        : '';

      tr.innerHTML = `
        <td>
          <span class="plate-tag"><i class="fa-solid fa-truck-ramp-box"></i> ${item.plateNumber}</span>
          ${incompleteBadge}
        </td>
        <td>
          <div style="font-weight:600; color:var(--text-primary);">${item.vehicleType}</div>
          <div style="font-size:0.78rem; color:var(--text-muted); margin-top:2px;">
            ${item.liftingCapacity ? `พิกัดยก: ${item.liftingCapacity}` : 'ไม่ระบุน้ำหนัก'}
          </div>
        </td>
        <td>
          ${energyBadge}
          ${lpgTag}
        </td>
        <td>
          <div style="font-weight:500; font-size:0.85rem; color:var(--text-primary);">${item.ownerCompany}</div>
          <div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">
            <i class="fa-solid fa-building"></i> ${item.subcontractor || 'Haier Owned'}
          </div>
        </td>
        <td>
          <div class="driver-info-cell">
            <div class="driver-name">
              <i class="fa-solid fa-id-card-clip" style="color:var(--haier-cyan); font-size:0.85rem;"></i>
              ${driver.name || 'ยังไม่ระบุ'}
            </div>
            <div class="driver-sub">รหัส: ${driver.empId || '-'} | ${driver.department || '-'}</div>
            <div style="margin-top:0.2rem;">${certBadge}</div>
          </div>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td>
          <div class="action-btn-group">
            <button class="btn btn-secondary btn-sm" onclick="window.viewForkliftDetails('${item.id}')" title="ดูรายละเอียดฉบับเต็ม">
              <i class="fa-regular fa-eye"></i> ดู
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.openEditDriverModal('${item.id}')" title="แก้ไขข้อมูลผู้ขับขี่">
              <i class="fa-solid fa-user-pen"></i> แก้ไขผู้ขับ
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.openUpdateStatusModal('${item.id}')" title="แก้ไขสถานะรถและบันทึกการตรวจเช็ค">
              <i class="fa-solid fa-screwdriver-wrench"></i> สถานะ/ตรวจเช็ค
            </button>
          </div>
        </td>
      `;

      fleetTableBody.appendChild(tr);
    });
  }

  // Search Input Event
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.trim();
    renderDashboard();
  });

  // Filter Pills Event
  filterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      filterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.activeFilter = pill.dataset.filter;
      renderDashboard();
    });
  });

  // --------------------------------------------------------------------------
  // Alerts Center Rendering (แท็บ แจ้งเตือน)
  // --------------------------------------------------------------------------
  function renderAlertsCenter() {
    const forklifts = window.forkliftStore.getAll();
    const lpgAlertsContainer = document.getElementById('lpg-alerts-list');
    const incompleteAlertsContainer = document.getElementById('incomplete-alerts-list');

    lpgAlertsContainer.innerHTML = '';
    incompleteAlertsContainer.innerHTML = '';

    let lpgCount = 0;
    let incompleteCount = 0;

    forklifts.forEach(item => {
      // 1. Check LPG Alert
      const lpgStatus = window.forkliftStore.getLpgStatus(item);
      if (lpgStatus.isLpg && (lpgStatus.alertLevel === 'warning' || lpgStatus.alertLevel === 'overdue')) {
        lpgCount++;
        const isOverdue = lpgStatus.alertLevel === 'overdue';
        const alertBox = document.createElement('div');
        alertBox.className = `alert-item-box ${isOverdue ? 'alert-lpg-urgent' : 'alert-lpg-warning'}`;
        
        alertBox.innerHTML = `
          <div class="alert-box-top">
            <span class="plate-tag"><i class="fa-solid fa-truck-ramp-box"></i> ${item.plateNumber}</span>
            <span class="status-badge ${isOverdue ? 'badge-lpg-overdue' : 'badge-lpg-warn'}">
              <i class="fa-solid ${isOverdue ? 'fa-triangle-exclamation' : 'fa-clock'}"></i>
              ${isOverdue ? `เกินกำหนด ${lpgStatus.overdueDays} วัน` : `เหลืออีก ${lpgStatus.daysRemaining} วัน`}
            </span>
          </div>
          <div class="alert-desc-text">
            <strong>${item.vehicleType}</strong> | สังกัด: ${item.ownerCompany} (${item.subcontractor || 'Haier'})
            <br>
            <span style="color: ${isOverdue ? '#fca5a5' : '#fbbf24'}; font-size:0.82rem;">
              <i class="fa-solid fa-bell"></i> ${lpgStatus.text}
            </span>
          </div>
          <div class="alert-meta-tags">
            <span class="badge-energy energy-lpg"><i class="fa-solid fa-fire"></i> ระบบก๊าซ LPG</span>
            <span class="filter-pill" style="font-size:0.72rem;"><i class="fa-solid fa-calendar"></i> ตรวจล่าสุด: ${item.lastInspectionDate || 'ยังไม่มีข้อมูล'}</span>
            <span class="filter-pill" style="font-size:0.72rem;"><i class="fa-solid fa-calendar-xmark"></i> ครบรอบ 1 ปี: ${lpgStatus.dueDateStr || '-'}</span>
          </div>
          <div class="alert-action-footer">
            <button class="btn btn-secondary btn-sm" onclick="window.viewForkliftDetails('${item.id}')">
              <i class="fa-regular fa-eye"></i> ดูข้อมูล
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.openUpdateStatusModal('${item.id}', true)">
              <i class="fa-solid fa-clipboard-check"></i> บันทึกการตรวจเช็คล่าสุดทันที
            </button>
          </div>
        `;
        lpgAlertsContainer.appendChild(alertBox);
      }

      // 2. Check Incomplete Data Alert
      const issues = window.forkliftStore.getIncompleteIssues(item);
      if (issues.length > 0) {
        incompleteCount++;
        const alertBox = document.createElement('div');
        alertBox.className = 'alert-item-box alert-incomplete';

        const issueBadges = issues.map(iss => `<span class="status-badge badge-repair" style="font-size:0.72rem; margin:2px;"><i class="fa-solid fa-circle-exclamation"></i> ${iss}</span>`).join(' ');

        alertBox.innerHTML = `
          <div class="alert-box-top">
            <span class="plate-tag"><i class="fa-solid fa-truck-ramp-box"></i> ${item.plateNumber}</span>
            <span class="status-badge badge-repair">ข้อมูลไม่สมบูรณ์ (${issues.length} รายการ)</span>
          </div>
          <div class="alert-desc-text">
            <strong>${item.vehicleType}</strong> | เจ้าของ: ${item.ownerCompany}
            <div style="margin-top:0.4rem;">${issueBadges}</div>
          </div>
          <div class="alert-action-footer">
            <button class="btn btn-secondary btn-sm" onclick="window.viewForkliftDetails('${item.id}')">
              <i class="fa-regular fa-eye"></i> ดูข้อมูล
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.openEditDriverModal('${item.id}')">
              <i class="fa-solid fa-file-pen"></i> แก้ไข/แนบเอกสารเพิ่ม
            </button>
          </div>
        `;
        incompleteAlertsContainer.appendChild(alertBox);
      }
    });

    if (lpgCount === 0) {
      lpgAlertsContainer.innerHTML = `
        <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size:2.2rem; color:var(--status-ready); margin-bottom:0.75rem;"></i>
          <p>${forklifts.length === 0 ? 'ยังไม่มีข้อมูลรถในระบบ' : 'ไม่มีรถพลังงาน LPG ที่ครบหรือใกล้ครบกำหนดตรวจเช็ค 1 ปีในขณะนี้'}</p>
        </div>
      `;
    }

    if (incompleteCount === 0) {
      incompleteAlertsContainer.innerHTML = `
        <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size:2.2rem; color:var(--status-ready); margin-bottom:0.75rem;"></i>
          <p>${forklifts.length === 0 ? 'ยังไม่มีข้อมูลรถในระบบ' : 'รถทุกคันในระบบมีข้อมูลการสำรวจและเอกสารครบถ้วนสมบูรณ์ 100%'}</p>
        </div>
      `;
    }
  }

  // --------------------------------------------------------------------------
  // Registration Form Logic
  // --------------------------------------------------------------------------
  
  // Real-time duplicate plate number validation
  regPlateInput.addEventListener('input', () => {
    const val = regPlateInput.value.trim();
    if (!val) {
      regPlateInput.classList.remove('is-invalid', 'is-valid');
      duplicateAlert.classList.remove('show');
      return;
    }

    const isDuplicate = window.forkliftStore.isPlateDuplicate(val);
    if (isDuplicate) {
      regPlateInput.classList.add('is-invalid');
      regPlateInput.classList.remove('is-valid');
      duplicateAlert.classList.add('show');
      duplicateAlertMsg.innerHTML = `เลขทะเบียน <strong>"${val}"</strong> เคยมีการบันทึกข้อมูลในระบบแล้ว จะไม่สามารถลงทะเบียนซ้ำได้อีก แต่สามารถแก้ไขข้อมูลผู้ขับและสถานะได้ในหน้า Dash Board`;
    } else {
      regPlateInput.classList.remove('is-invalid');
      regPlateInput.classList.add('is-valid');
      duplicateAlert.classList.remove('show');
    }
  });

  // Energy source change: Display LPG inspection guidance
  regEnergySelect.addEventListener('change', () => {
    if (regEnergySelect.value === 'LPG') {
      regLpgNote.style.display = 'block';
    } else {
      regLpgNote.style.display = 'none';
    }
  });

  // Checklist: Pass All shortcut
  btnPassAllChecklist.addEventListener('click', () => {
    document.querySelectorAll('.check-item-row').forEach(row => {
      const passBtn = row.querySelector('.btn-pass');
      const failBtn = row.querySelector('.btn-fail');
      passBtn.classList.add('active');
      failBtn.classList.remove('active');
      const checkKey = row.dataset.checkKey;
      if (checkKey) state.regChecklist[checkKey] = true;
    });
    showToast('เลือกผ่านเกณฑ์ทุกรายการแล้ว', 'success');
  });

  // Checklist toggle click
  document.querySelectorAll('.status-toggle-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const row = btn.closest('.check-item-row');
      const key = row.dataset.checkKey;
      const isPass = btn.classList.contains('btn-pass');

      row.querySelector('.btn-pass').classList.toggle('active', isPass);
      row.querySelector('.btn-fail').classList.toggle('active', !isPass);

      state.regChecklist[key] = isPass;

      // Suggest repair status if any failed
      const hasFail = Object.values(state.regChecklist).some(val => val === false);
      if (hasFail) {
        document.getElementById('status-repair').checked = true;
      }
    });
  });

  // 3 Vehicle Photo Upload Handlers
  const photoBoxes = [
    { boxId: 'box-photo-front', fileInputId: 'input-photo-front', key: 'front', defaultSvg: window.SVG_ASSETS.forkliftFront },
    { boxId: 'box-photo-side', fileInputId: 'input-photo-side', key: 'side', defaultSvg: window.SVG_ASSETS.forkliftSide },
    { boxId: 'box-photo-full', fileInputId: 'input-photo-full', key: 'fullFront', defaultSvg: window.SVG_ASSETS.forkliftFull }
  ];

  photoBoxes.forEach(cfg => {
    const box = document.getElementById(cfg.boxId);
    const input = document.getElementById(cfg.fileInputId);
    const preview = box.querySelector('.photo-box-preview');
    const content = box.querySelector('.photo-box-content');
    const removeBtn = box.querySelector('.btn-remove-photo');

    // Click to upload
    box.addEventListener('click', (e) => {
      if (e.target.closest('.photo-overlay-actions')) return;
      input.click();
    });

    // File selected
    input.addEventListener('change', () => {
      const file = input.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          setPhoto(cfg.key, e.target.result, box, preview, content);
        };
        reader.readAsDataURL(file);
      }
    });

    // Remove photo
    if (removeBtn) {
      removeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        state.regPhotos[cfg.key] = '';
        input.value = '';
        preview.src = '';
        preview.style.display = 'none';
        content.style.display = 'flex';
        box.classList.remove('has-image');
      });
    }
  });

  function setPhoto(key, src, box, preview, content) {
    state.regPhotos[key] = src;
    preview.src = src;
    preview.style.display = 'block';
    content.style.display = 'none';
    box.classList.add('has-image');
  }

  // Quick fill sample vehicle photos for testing
  document.getElementById('btn-sample-photos').addEventListener('click', () => {
    photoBoxes.forEach(cfg => {
      const box = document.getElementById(cfg.boxId);
      const preview = box.querySelector('.photo-box-preview');
      const content = box.querySelector('.photo-box-content');
      setPhoto(cfg.key, cfg.defaultSvg, box, preview, content);
    });
    showToast('โหลดภาพถ่ายตัวอย่างครบทั้ง 3 มุมแล้ว', 'success');
  });

  // --------------------------------------------------------------------------
  // AI Verification Section Logic
  // --------------------------------------------------------------------------
  async function runAiVerification(imageSrc) {
    regCertLaser.classList.add('scanning');
    regAiStatus.className = 'ai-status-output status-pending';
    regAiStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังวิเคราะห์ภาพถ่ายด้วย AI...`;
    regAiConfidenceFill.style.width = '10%';
    regAiConfidenceText.textContent = 'วิเคราะห์ความสมบูรณ์...';
    regAiTags.innerHTML = '';

    const result = await window.aiVerifier.verify(imageSrc, (progress) => {
      regAiConfidenceFill.style.width = `${progress.percent}%`;
      regAiConfidenceText.textContent = progress.message;
    });

    regCertLaser.classList.remove('scanning');

    state.regCert = {
      image: imageSrc,
      status: result.status,
      confidence: result.confidence,
      isCertified: result.isCertified
    };

    if (result.status === 'ผ่านการรับรอง') {
      regAiStatus.className = 'ai-status-output status-verified';
      regAiStatus.innerHTML = `<i class="fa-solid fa-circle-check"></i> ผ่านการตรวจสอบ: ใบรับรองถูกต้อง (${result.confidence}%)`;
    } else if (result.status === 'ไม่ถูกต้อง') {
      regAiStatus.className = 'ai-status-output status-rejected';
      regAiStatus.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i> แจ้งเตือน: ไม่ใช่ใบรับรองรถยกที่ถูกต้อง`;
    } else {
      regAiStatus.className = 'ai-status-output status-pending';
      regAiStatus.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> รอดำเนินการ (ยังไม่แนบภาพใบรับรอง)`;
    }

    regAiDetails.textContent = result.details;

    if (result.detectedKeywords && result.detectedKeywords.length > 0) {
      regAiTags.innerHTML = result.detectedKeywords
        .map(tag => `<span class="ai-tag"><i class="fa-solid fa-check"></i> ${tag}</span>`)
        .join('');
    }
  }

  // Upload cert input
  regCertUpload.addEventListener('change', () => {
    const file = regCertUpload.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        regCertPreview.src = e.target.result;
        regCertPreview.style.display = 'block';
        document.getElementById('cert-upload-placeholder').style.display = 'none';
        runAiVerification(e.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      // No file attached -> Condition requirement: "ถ้าหากว่าพนักงานไม่มีภาพแนบใบรับรองให้บันทึกในระบบว่ารอดำเนินการ"
      runAiVerification('');
    }
  });

  // Sample cert buttons for quick evaluation
  document.getElementById('btn-sample-valid-cert').addEventListener('click', () => {
    regCertPreview.src = window.SVG_ASSETS.validCert;
    regCertPreview.style.display = 'block';
    document.getElementById('cert-upload-placeholder').style.display = 'none';
    runAiVerification(window.SVG_ASSETS.validCert);
  });

  document.getElementById('btn-sample-invalid-cert').addEventListener('click', () => {
    regCertPreview.src = window.SVG_ASSETS.invalidCert;
    regCertPreview.style.display = 'block';
    document.getElementById('cert-upload-placeholder').style.display = 'none';
    runAiVerification(window.SVG_ASSETS.invalidCert);
  });

  document.getElementById('btn-sample-no-cert').addEventListener('click', () => {
    regCertPreview.src = '';
    regCertPreview.style.display = 'none';
    regCertUpload.value = '';
    document.getElementById('cert-upload-placeholder').style.display = 'flex';
    runAiVerification('');
  });

  // --------------------------------------------------------------------------
  // Submit Registration Form
  // --------------------------------------------------------------------------
  regForm.addEventListener('submit', (e) => {
    e.preventDefault();

    const plateNumber = regPlateInput.value.trim().toUpperCase();
    if (!plateNumber) {
      showToast('กรุณาระบุเลขทะเบียนรถ', 'error');
      regPlateInput.focus();
      return;
    }

    // Condition Check: Duplicate plate prevention
    if (window.forkliftStore.isPlateDuplicate(plateNumber)) {
      showToast(`เลขทะเบียน "${plateNumber}" มีอยู่ในระบบแล้ว ไม่สามารถลงซ้ำได้`, 'error');
      duplicateAlert.classList.add('show');
      regPlateInput.focus();
      return;
    }

    const vehicleType = document.getElementById('reg-type').value;
    const energyType = document.getElementById('reg-energy').value;
    const liftingCapacity = document.getElementById('reg-capacity').value;
    const ownerCompany = document.getElementById('reg-owner-company').value.trim();
    const subcontractor = document.getElementById('reg-subcontractor').value.trim();
    const isSub = document.getElementById('reg-owner-type').value === 'subcontractor';

    const inspectionDate = document.getElementById('reg-inspect-date').value || new Date().toISOString().split('T')[0];
    const status = document.querySelector('input[name="reg-status"]:checked').value;

    const driverName = document.getElementById('reg-driver-name').value.trim();
    const driverEmpId = document.getElementById('reg-driver-empid').value.trim();
    const driverCompany = document.getElementById('reg-driver-company').value.trim();
    const driverDept = document.getElementById('reg-driver-dept').value.trim();

    // Check if certificate image is present
    let finalCertStatus = state.regCert.status;
    let finalCertImg = state.regCert.image;

    // Condition: If employee has no certificate photo attached, record as 'รอดำเนินการ'
    if (!finalCertImg || finalCertImg.trim() === '') {
      finalCertStatus = 'รอดำเนินการ';
      finalCertImg = '';
    }

    const newForklift = {
      plateNumber,
      vehicleType,
      energyType,
      liftingCapacity,
      ownerCompany: ownerCompany || 'Haier Electric Appliances (Thailand) Co., Ltd.',
      subcontractor: subcontractor || (isSub ? 'ผู้รับเหมาช่วง' : 'Haier Owned'),
      isSubcontractor: isSub,
      registrationDate: new Date().toISOString().split('T')[0],
      lastInspectionDate: inspectionDate,
      status,
      photos: { ...state.regPhotos },
      checklist: { ...state.regChecklist },
      driver: {
        name: driverName || 'ยังไม่ระบุ',
        empId: driverEmpId || '-',
        company: driverCompany || ownerCompany,
        department: driverDept || '-',
        hasTrained: finalCertStatus === 'ผ่านการรับรอง',
        certImage: finalCertImg,
        certStatus: finalCertStatus
      },
      notes: document.getElementById('reg-notes').value.trim()
    };

    try {
      window.forkliftStore.addForklift(newForklift);
      showToast(`ขึ้นทะเบียนรถโฟล์คลิฟท์ "${plateNumber}" สำเร็จเรียบร้อย!`, 'success');
      
      // Reset Form
      regForm.reset();
      regPlateInput.classList.remove('is-valid', 'is-invalid');
      duplicateAlert.classList.remove('show');
      photoBoxes.forEach(cfg => {
        const box = document.getElementById(cfg.boxId);
        const preview = box.querySelector('.photo-box-preview');
        const content = box.querySelector('.photo-box-content');
        preview.src = '';
        preview.style.display = 'none';
        content.style.display = 'flex';
        box.classList.remove('has-image');
      });
      state.regPhotos = { front: '', side: '', fullFront: '' };
      regCertPreview.src = '';
      regCertPreview.style.display = 'none';
      document.getElementById('cert-upload-placeholder').style.display = 'flex';
      runAiVerification('');

      // Switch back to Dashboard to see newly registered forklift
      switchTab('dashboard-tab');
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // --------------------------------------------------------------------------
  // Modals Controller
  // --------------------------------------------------------------------------
  
  // 1. View Vehicle Details Modal
  window.viewForkliftDetails = function(id) {
    const item = window.forkliftStore.getById(id);
    if (!item) return;

    state.selectedForklift = item;
    const modalBody = document.getElementById('view-modal-body');

    const lpgStatus = window.forkliftStore.getLpgStatus(item);
    const issues = window.forkliftStore.getIncompleteIssues(item);

    const photos = item.photos || {};
    const driver = item.driver || {};

    modalBody.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:1.25rem; flex-wrap:wrap; gap:0.5rem;">
        <span class="plate-tag" style="font-size:1.15rem;"><i class="fa-solid fa-truck-ramp-box"></i> ${item.plateNumber}</span>
        <div>
          ${item.status === 'พร้อมใช้งาน'
            ? '<span class="status-badge badge-ready" style="font-size:0.9rem;"><i class="fa-solid fa-circle-check"></i> พร้อมใช้งาน</span>'
            : '<span class="status-badge badge-repair" style="font-size:0.9rem;"><i class="fa-solid fa-triangle-exclamation"></i> ส่งซ่อม</span>'
          }
        </div>
      </div>

      <!-- Specs Card -->
      <div class="stat-card" style="margin-bottom:1.5rem;">
        <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--haier-cyan);"><i class="fa-solid fa-circle-info"></i> ข้อมูลจำเพาะของรถ</h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; font-size:0.85rem;">
          <div><span style="color:var(--text-muted);">ประเภทรถ:</span> <strong>${item.vehicleType}</strong></div>
          <div><span style="color:var(--text-muted);">ระบบพลังงาน:</span> <strong>${item.energyType}</strong></div>
          <div><span style="color:var(--text-muted);">ความสามารถยก:</span> <strong>${item.liftingCapacity || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">เจ้าของรถ:</span> <strong>${item.ownerCompany}</strong></div>
          <div><span style="color:var(--text-muted);">ซัพพลายเออร์:</span> <strong>${item.subcontractor || 'Haier Owned'}</strong></div>
          <div><span style="color:var(--text-muted);">วันที่ขึ้นทะเบียน:</span> <strong>${item.registrationDate || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">ตรวจสภาพล่าสุด:</span> <strong>${item.lastInspectionDate || '-'}</strong></div>
        </div>

        ${lpgStatus.isLpg ? `
          <div style="margin-top:1rem; padding:0.75rem; background:rgba(245, 158, 11, 0.1); border-left:3px solid #fbbf24; border-radius:4px;">
            <strong><i class="fa-solid fa-fire"></i> ข้อมูลตรวจเช็คก๊าซ LPG ประจำปี:</strong>
            <div style="font-size:0.82rem; margin-top:2px;">${lpgStatus.text} (ครบกำหนดรอบถัดไป: ${lpgStatus.dueDateStr || '-'})</div>
          </div>
        ` : ''}
      </div>

      <!-- 3 Vehicle Photos -->
      <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--haier-cyan);"><i class="fa-solid fa-camera"></i> ภาพถ่ายรถ 3 มุม</h4>
      <div class="photos-upload-grid" style="margin-bottom:1.5rem;">
        <div style="background:var(--haier-navy-darker); border-radius:8px; overflow:hidden; border:1px solid var(--surface-border); text-align:center;">
          <img src="${photos.front || window.SVG_ASSETS.forkliftFront}" style="width:100%; height:160px; object-fit:cover;">
          <div style="padding:0.4rem; font-size:0.78rem; font-weight:600;">1. ภาพด้านหน้ารถ</div>
        </div>
        <div style="background:var(--haier-navy-darker); border-radius:8px; overflow:hidden; border:1px solid var(--surface-border); text-align:center;">
          <img src="${photos.side || window.SVG_ASSETS.forkliftSide}" style="width:100%; height:160px; object-fit:cover;">
          <div style="padding:0.4rem; font-size:0.78rem; font-weight:600;">2. ภาพด้านข้างรถ</div>
        </div>
        <div style="background:var(--haier-navy-darker); border-radius:8px; overflow:hidden; border:1px solid var(--surface-border); text-align:center;">
          <img src="${photos.fullFront || window.SVG_ASSETS.forkliftFull}" style="width:100%; height:160px; object-fit:cover;">
          <div style="padding:0.4rem; font-size:0.78rem; font-weight:600;">3. ภาพด้านหน้าที่เห็นทั้งคัน</div>
        </div>
      </div>

      <!-- Driver & Certificate -->
      <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--haier-cyan);"><i class="fa-solid fa-user-shield"></i> ข้อมูลผู้ขับขี่และใบรับรองความปลอดภัย</h4>
      <div style="background:var(--haier-navy-darker); border:1px solid var(--surface-border); border-radius:8px; padding:1.25rem; display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
        <div>
          <div style="font-size:1.05rem; font-weight:700; color:#fff;"><i class="fa-solid fa-id-card"></i> ${driver.name || 'ยังไม่ระบุ'}</div>
          <div style="font-size:0.85rem; color:var(--text-secondary); margin-top:0.25rem;">รหัสพนักงาน: <strong>${driver.empId || '-'}</strong></div>
          <div style="font-size:0.85rem; color:var(--text-secondary);">สังกัด: <strong>${driver.company || '-'}</strong></div>
          <div style="font-size:0.85rem; color:var(--text-secondary);">แผนก: <strong>${driver.department || '-'}</strong></div>
          
          <div style="margin-top:0.85rem;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.25rem;">สถานะใบรับรองการอบรม (AI Checked):</div>
            ${driver.certStatus === 'ผ่านการรับรอง'
              ? '<span class="status-badge badge-cert-valid"><i class="fa-solid fa-award"></i> ผ่านการรับรอง (AI Verified)</span>'
              : (driver.certStatus === 'ไม่ถูกต้อง'
                  ? '<span class="status-badge badge-repair"><i class="fa-solid fa-xmark"></i> ไม่ถูกต้อง</span>'
                  : '<span class="status-badge badge-cert-pending"><i class="fa-solid fa-hourglass-half"></i> รอดำเนินการ (ไม่มีภาพแนบ)</span>')
            }
          </div>
        </div>

        <div style="text-align:center;">
          ${driver.certImage
            ? `<img src="${driver.certImage}" style="width:100%; max-height:160px; object-fit:contain; border-radius:6px; border:1px solid var(--surface-border);">`
            : `<div style="height:140px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.2); border:1px dashed var(--surface-border); border-radius:6px; color:var(--text-muted); font-size:0.82rem;">ไม่มีภาพแนบใบรับรอง (รอดำเนินการ)</div>`
          }
        </div>
      </div>
    `;

    openModal(modalView);
  };

  // 2. Edit Driver Modal
  window.openEditDriverModal = function(id) {
    const item = window.forkliftStore.getById(id);
    if (!item) return;

    state.selectedForklift = item;
    const driver = item.driver || {};

    document.getElementById('edit-driver-forklift-plate').textContent = item.plateNumber;
    document.getElementById('edit-driver-id').value = item.id;
    document.getElementById('edit-driver-name').value = driver.name || '';
    document.getElementById('edit-driver-empid').value = driver.empId || '';
    document.getElementById('edit-driver-company').value = driver.company || item.ownerCompany;
    document.getElementById('edit-driver-dept').value = driver.department || '';

    state.editDriverCert = {
      image: driver.certImage || '',
      status: driver.certStatus || 'รอดำเนินการ'
    };

    const preview = document.getElementById('edit-cert-preview');
    const statusText = document.getElementById('edit-cert-status-text');

    if (driver.certImage) {
      preview.src = driver.certImage;
      preview.style.display = 'block';
    } else {
      preview.src = '';
      preview.style.display = 'none';
    }
    statusText.textContent = `สถานะปัจจุบัน: ${state.editDriverCert.status}`;

    openModal(modalEditDriver);
  };

  // Edit Driver: Handle new certificate upload & AI verification
  document.getElementById('edit-cert-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById('edit-cert-preview');
    const statusText = document.getElementById('edit-cert-status-text');

    if (file) {
      statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> AI กำลังตรวจสอบภาพ...`;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        preview.src = ev.target.result;
        preview.style.display = 'block';
        const result = await window.aiVerifier.verify(ev.target.result);
        state.editDriverCert.image = ev.target.result;
        state.editDriverCert.status = result.status;
        statusText.innerHTML = `ผลตรวจ AI: <strong>${result.status}</strong> (${result.confidence}%)`;
      };
      reader.readAsDataURL(file);
    } else {
      state.editDriverCert.image = '';
      state.editDriverCert.status = 'รอดำเนินการ';
      preview.style.display = 'none';
      statusText.textContent = 'สถานะ: รอดำเนินการ (ไม่มีภาพแนบ)';
    }
  });

  // Save Edit Driver Form
  document.getElementById('form-edit-driver').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-driver-id').value;
    const name = document.getElementById('edit-driver-name').value.trim();
    const empId = document.getElementById('edit-driver-empid').value.trim();
    const company = document.getElementById('edit-driver-company').value.trim();
    const department = document.getElementById('edit-driver-dept').value.trim();

    try {
      window.forkliftStore.updateDriver(id, {
        name,
        empId,
        company,
        department,
        certImage: state.editDriverCert.image,
        certStatus: state.editDriverCert.status,
        hasTrained: state.editDriverCert.status === 'ผ่านการรับรอง'
      });

      showToast('อัปเดตข้อมูลผู้ขับขี่สำเร็จแล้ว', 'success');
      closeModal(modalEditDriver);
      renderDashboard();
      if (state.currentTab === 'alerts-tab') renderAlertsCenter();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // 3. Update Status & LPG Inspection Modal
  window.openUpdateStatusModal = function(id, isLpgQuickAction = false) {
    const item = window.forkliftStore.getById(id);
    if (!item) return;

    state.selectedForklift = item;
    document.getElementById('update-status-plate').textContent = item.plateNumber;
    document.getElementById('update-status-id').value = item.id;
    document.getElementById('update-status-select').value = item.status;
    document.getElementById('update-inspection-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('update-notes').value = item.notes || '';

    const lpgSection = document.getElementById('update-lpg-alert-section');
    const lpgStatus = window.forkliftStore.getLpgStatus(item);
    if (lpgStatus.isLpg) {
      lpgSection.style.display = 'block';
      document.getElementById('update-lpg-text').textContent = lpgStatus.text;
    } else {
      lpgSection.style.display = 'none';
    }

    openModal(modalUpdateStatus);
  };

  // Save Status & Inspection Form
  document.getElementById('form-update-status').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('update-status-id').value;
    const status = document.getElementById('update-status-select').value;
    const inspectionDate = document.getElementById('update-inspection-date').value;
    const notes = document.getElementById('update-notes').value.trim();

    try {
      window.forkliftStore.updateStatusAndInspection(id, {
        status,
        inspectionDate,
        notes
      });

      showToast(`บันทึกการตรวจเช็คและอัปเดตสถานะรถเรียบร้อยแล้ว`, 'success');
      closeModal(modalUpdateStatus);
      renderDashboard();
      if (state.currentTab === 'alerts-tab') renderAlertsCenter();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Modal helpers
  function openModal(modal) {
    modal.classList.add('show');
  }

  function closeModal(modal) {
    modal.classList.remove('show');
  }

  document.querySelectorAll('.modal-close-btn, .btn-modal-close').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.modal-backdrop').forEach(closeModal);
    });
  });

  window.addEventListener('click', (e) => {
    if (e.target.classList.contains('modal-backdrop')) {
      closeModal(e.target);
    }
  });

  // Reset / Clear data button handler (if present)
  const btnResetData = document.getElementById('btn-reset-data');
  if (btnResetData) {
    btnResetData.addEventListener('click', () => {
      if (confirm('คุณต้องการล้างข้อมูลรถทั้งหมดในระบบหรือไม่?')) {
        window.forkliftStore.clearAll();
        showToast('ล้างข้อมูลระบบเรียบร้อยแล้ว', 'success');
        renderDashboard();
        if (state.currentTab === 'alerts-tab') renderAlertsCenter();
      }
    });
  }

  // Toast Notification helper
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    let icon = 'fa-circle-info';
    if (type === 'success') icon = 'fa-circle-check';
    if (type === 'error') icon = 'fa-circle-exclamation';
    if (type === 'warn') icon = 'fa-triangle-exclamation';

    toast.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease-out';
      setTimeout(() => toast.remove(), 300);
    }, 3800);
  }

  // Initial render
  renderDashboard();
});
