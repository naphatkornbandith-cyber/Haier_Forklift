/**
 * Haier Forklift Management System - Main Application Controller
 * Handles Dashboard rendering, tab navigation, search & filters,
 * form submission, photo uploads, AI verification, and modals.
 */

document.addEventListener('DOMContentLoaded', () => {
  // ─────────────────────────────────────────────────────────────
  // Pie/Donut Chart instances (Chart.js) — kept outside state
  // so they can be destroyed & re-created on each renderDashboard call
  // ─────────────────────────────────────────────────────────────
  let chartOwnership = null;
  let chartStatus    = null;
  let chartRentalContract = null;

  /**
   * Draw (or update) a doughnut chart on a given canvas.
   * @param {string}   canvasId   - id of <canvas> element
   * @param {string[]} labels     - legend labels
   * @param {number[]} data       - numeric values
   * @param {string[]} colors     - hex/rgb fill colours
   * @param {Chart|null} existing - previous Chart instance to destroy first
   * @returns {Chart} new Chart instance
   */
  function drawDonut(canvasId, labels, data, colors, existing) {
    const canvas = document.getElementById(canvasId);
    if (!canvas || typeof Chart === 'undefined' || !Chart) return existing;
    if (existing) { existing.destroy(); }

    const total = data.reduce((s, v) => s + v, 0);
    const isEmpty = total === 0;

    return new Chart(canvas, {
      type: 'doughnut',
      data: {
        labels,
        datasets: [{
          data: isEmpty ? [1] : data,
          backgroundColor: isEmpty ? ['#2a3042'] : colors,
          borderColor:     isEmpty ? ['#3a4155'] : colors.map(() => 'transparent'),
          borderWidth: isEmpty ? 1 : 0,
          hoverOffset: isEmpty ? 0 : 8
        }]
      },
      options: {
        cutout: '68%',
        animation: { duration: 500 },
        plugins: {
          legend: { display: false },
          tooltip: {
            enabled: !isEmpty,
            callbacks: {
              label: ctx => ` ${ctx.label}: ${ctx.parsed} คัน (${total > 0 ? Math.round(ctx.parsed / total * 100) : 0}%)`
            }
          }
        }
      }
    });
  }

  /**
   * Render the HTML legend items below a chart.
   * @param {string}   legendId - id of legend container
   * @param {Array<{label, value, color}>} items
   */
  function renderLegend(legendId, items) {
    const el = document.getElementById(legendId);
    if (!el) return;
    const total = items.reduce((s, i) => s + i.value, 0);
    if (total === 0) {
      el.innerHTML = `<span class="chart-empty-msg">ยังไม่มีข้อมูลรถในระบบ</span>`;
      return;
    }
    el.innerHTML = items.map(it => {
      const pct = total > 0 ? Math.round(it.value / total * 100) : 0;
      return `
        <div class="chart-legend-item">
          <span class="legend-dot" style="background:${it.color};"></span>
          <span class="legend-label">${it.label}</span>
          <span class="legend-value">${it.value} <small style="font-weight:400;color:var(--text-muted);">(${pct}%)</small></span>
        </div>`;
    }).join('');
  }
  // Application State
  const state = {
    currentTab: 'dashboard-tab',
    activeFilter: 'all',
    searchQuery: '',
    selectedForklift: null,
    // Admin Authentication & Filter State
    isAdmin: sessionStorage.getItem('haier_forklift_admin') === 'true',
    adminUser: JSON.parse(sessionStorage.getItem('haier_forklift_admin_user') || 'null'),
    adminSubView: 'fleet', // 'fleet' หรือ 'drivers'
    adminFilter: 'all',
    adminSearchQuery: '',
    adminDriverFilter: 'all',
    adminDriverSearchQuery: '',
    // Dashboard View: 'fleet' หรือ 'drivers'
    dashView: 'fleet',
    driverFilter: 'all',
    driverSearchQuery: '',
    // New Driver Registration Form Temp State
    newDriverPhoto: '',
    newDriverCert: {
      image: '',
      status: 'รอดำเนินการ'
    },
    // Registration Form Temp State
    regPhotos: {
      vehicle: '',
      front: '',
      side: '',
      fullFront: ''
    },
    regDriverPhoto: '',
    regChecklist: {
      forks: true,
      brakes: true,
      hydraulics: true,
      tires: true,
      lightsHorn: true,
      seatbeltGuard: true,
      batterySystem: true  // Default: ไฟฟ้า (will be updated by updateChecklistForEnergy)
    },
    // Edit Driver Temp State
    editDriverCert: {
      image: '',
      status: 'รอดำเนินการ'
    },
    editDriverPhoto: ''
  };

  // DOM Elements
  const tabButtons = document.querySelectorAll('.tab-btn');
  const tabContents = document.querySelectorAll('.tab-content');
  const searchInput = document.getElementById('search-input');
  const filterPills = document.querySelectorAll('.filter-pill');
  const fleetTableBody = document.getElementById('fleet-table-body');
  
  // KPI Count Elements
  const kpiTotal = document.getElementById('kpi-total');
  const kpiCompany = document.getElementById('kpi-company');
  const kpiRental = document.getElementById('kpi-rental');
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

  // Ownership Type & Vehicle Specs (Section 1)
  const btnOwnerCompany = document.getElementById('btn-owner-company');
  const btnOwnerRental = document.getElementById('btn-owner-rental');
  const regOwnerType = document.getElementById('reg-owner-type');
  const regFrameNoInput = document.getElementById('reg-frame-no');
  const duplicateFrameAlert = document.getElementById('duplicate-frame-alert');
  const duplicateFrameMsg = document.getElementById('duplicate-frame-msg');
  const rentalPlateBadge = document.getElementById('rental-plate-badge');
  const regPlateHint = document.getElementById('reg-plate-hint');
  const regOwnerCompany = document.getElementById('reg-owner-company');
  const labelRegCompany = document.getElementById('label-reg-company');
  const hintRegCompany = document.getElementById('hint-reg-company');
  const regContractExpiryGroup = document.getElementById('reg-contract-expiry-group');
  const regContractExpiry = document.getElementById('reg-contract-expiry');

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
    } else if (tabId === 'admin-tab') {
      renderAdminPanel();
    } else if (tabId === 'register-tab') {
      populateDriverSelectOptions();
      if (regOwnerType && regOwnerType.value === 'rental') {
        regPlateInput.value = window.forkliftStore.getNextRentalPlateNumber();
      }
    } else if (tabId === 'driver-reg-tab') {
      populateForkliftSelectOptions();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
  });

  // Shortcut link in banner or duplicate alert or quick filter trigger
  document.addEventListener('click', (e) => {
    if (e.target.closest('[data-switch-tab]')) {
      const targetTab = e.target.closest('[data-switch-tab]').dataset.switchTab;
      switchTab(targetTab);
    }
    const filterTrigger = e.target.closest('[data-filter-trigger]');
    if (filterTrigger) {
      const filterValue = filterTrigger.dataset.filterTrigger;
      const targetPill = Array.from(filterPills).find(pill => pill.dataset.filter === filterValue);
      if (targetPill) {
        targetPill.click();
      }
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
    let expiredStatusCount = 0;
    let lpgAlertCount = 0;
    let incompleteCount = 0;
    let pendingCertCount = 0;
    let companyCount = 0;
    let rentalCount = 0;
    let rentalAlertCount = 0;
    let vehicleAlertCount = 0;
    let driverAlertCount = 0;
    let activeRentalValidCount = 0;
    let warningRentalCount = 0;
    let expiredRentalCount = 0;
    const lpgAlertItems = [];

    forklifts.forEach(item => {
      // ตรวจสอบสถานะสัญญาเช่าของรถ (เช็คทั้ง status และวันหมดสัญญาจริง)
      const rentalStatus = window.forkliftStore.getRentalContractStatus(item);
      const isContractExpired = item.status === 'หมดสัญญาเช่า' || (item.isSubcontractor && rentalStatus.alertLevel === 'expired');

      if (isContractExpired) {
        expiredStatusCount++;
        // รถที่หมดสัญญาเช่าแล้ว จะถูกหักลบออกจากจำนวนรถทั้งหมดในโรงงาน (Active Fleet) ทั้งใน KPI และกราฟสัดส่วนรถ
      } else {
        if (item.isSubcontractor) {
          rentalCount++;
        } else {
          companyCount++;
        }

        if (item.status === 'พร้อมใช้งาน') readyCount++;
        else if (item.status === 'ส่งซ่อม') repairCount++;
      }

      // Check Rental Contract Expiry Status for Chart 3 & Alerts
      if (item.isSubcontractor) {
        if (isContractExpired) {
          expiredRentalCount++;
        } else if (rentalStatus.alertLevel === 'warning') {
          warningRentalCount++;
        } else {
          activeRentalValidCount++;
        }

        if (rentalStatus.alertLevel === 'warning' || rentalStatus.alertLevel === 'expired' || item.status === 'หมดสัญญาเช่า') {
          rentalAlertCount++;
        }
      }

      const lpgStatus = window.forkliftStore.getLpgStatus(item);
      if (lpgStatus.isLpg && (lpgStatus.alertLevel === 'warning' || lpgStatus.alertLevel === 'overdue')) {
        lpgAlertCount++;
        lpgAlertItems.push({ item, lpgStatus });
      }

      const vehicleIssues = window.forkliftStore.getVehicleIssues(item);
      if ((lpgStatus.isLpg && (lpgStatus.alertLevel === 'warning' || lpgStatus.alertLevel === 'overdue')) || vehicleIssues.length > 0) {
        vehicleAlertCount++;
      }

      const driverIssues = window.forkliftStore.getDriverIssues(item);
      if (driverIssues.length > 0) {
        driverAlertCount++;
      }

      const issues = window.forkliftStore.getIncompleteIssues(item);
      if (issues.length > 0) incompleteCount++;

      if (!item.driver || item.driver.certStatus === 'รอดำเนินการ') {
        pendingCertCount++;
      }
    });

    // คำนวณจำนวนรถทั้งหมดที่ใช้งานจริงในโรงงาน (หักลบรถที่หมดสัญญาเช่า/ส่งคืนแล้วออก)
    const activeTotalCount = companyCount + rentalCount;

    // Update KPI UI
    kpiTotal.textContent = activeTotalCount;
    if (kpiCompany) kpiCompany.textContent = companyCount;
    if (kpiRental) kpiRental.textContent = rentalCount;
    kpiReady.textContent = readyCount;
    kpiRepair.textContent = repairCount;
    kpiLpgAlert.textContent = lpgAlertCount;
    kpiIncomplete.textContent = incompleteCount;
    kpiPendingCert.textContent = pendingCertCount;

    // Update Drivers KPI Metrics
    const allDrivers = (window.forkliftStore && typeof window.forkliftStore.getAllDrivers === 'function')
      ? window.forkliftStore.getAllDrivers()
      : [];
    const kpiDrivers = document.getElementById('kpi-drivers');
    if (kpiDrivers) kpiDrivers.textContent = allDrivers.length;
    const kpiDriversCert = document.getElementById('kpi-drivers-certified');
    if (kpiDriversCert) {
      kpiDriversCert.textContent = allDrivers.filter(d => d.certStatus === 'ผ่านการรับรอง').length;
    }
    const kpiDriversPend = document.getElementById('kpi-drivers-pending');
    if (kpiDriversPend) {
      kpiDriversPend.textContent = allDrivers.filter(d => d.certStatus !== 'ผ่านการรับรอง').length;
    }

    // Update Dashboard View Tab Counts (แสดงจำนวนรถที่ใช้งานจริงในระบบ)
    const dashFleetCount = document.getElementById('dash-fleet-count');
    if (dashFleetCount) dashFleetCount.textContent = activeTotalCount;
    const dashDriversCount = document.getElementById('dash-drivers-count');
    if (dashDriversCount) {
      dashDriversCount.textContent = allDrivers.length;
    }

    // Render Driver Table in Dashboard
    renderDriverTable();

    // Ensure current active dashboard view (fleet vs drivers) is displayed
    if (typeof setDashView === 'function') {
      setDashView(state.dashView || 'fleet', true);
    }

    // ── Pie/Donut Charts ──────────────────────────────────────────────
    // Chart 1: Ownership (รถบริษัท vs รถเช่า)
    const ownershipColors  = ['#06b6d4', '#a78bfa'];   // cyan, purple
    chartOwnership = drawDonut(
      'chart-ownership',
      ['รถบริษัท Haier', 'รถเช่า / ซัพพลายเออร์'],
      [companyCount, rentalCount],
      ownershipColors,
      chartOwnership
    );
    // Update center label
    const ownerTotal = document.getElementById('chart-ownership-total');
    if (ownerTotal) ownerTotal.textContent = activeTotalCount;
    // Legend
    renderLegend('chart-ownership-legend', [
      { label: 'รถบริษัท',  value: companyCount, color: ownershipColors[0] },
      { label: 'รถเช่า',    value: rentalCount,  color: ownershipColors[1] }
    ]);

    // Chart 2: Status (พร้อมใช้งาน vs ส่งซ่อม)
    const statusColors = ['#4ade80', '#f87171'];   // green, red
    chartStatus = drawDonut(
      'chart-status',
      ['พร้อมใช้งาน', 'ส่งซ่อม / ปรับปรุง'],
      [readyCount, repairCount],
      statusColors,
      chartStatus
    );
    // Update center label (show ready count)
    const statusReady = document.getElementById('chart-status-ready');
    if (statusReady) statusReady.textContent = readyCount;
    // Legend
    renderLegend('chart-status-legend', [
      { label: 'พร้อมใช้งาน',      value: readyCount,  color: statusColors[0] },
      { label: 'ส่งซ่อม / ปรับปรุง', value: repairCount, color: statusColors[1] }
    ]);

    // Chart 3: สัดส่วนสัญญาเช่ารถ Forklift (ข้อมูลรถเช่าที่หมดสัญญา)
    const rentalContractColors = ['#06b6d4', '#fbbf24', '#f87171']; // cyan, yellow, red
    chartRentalContract = drawDonut(
      'chart-rental-contract',
      ['มีสัญญาใช้งานปกติ', 'ใกล้ครบกำหนด (เตือน 1 ด.)', 'หมดสัญญาเช่าแล้ว'],
      [activeRentalValidCount, warningRentalCount, expiredRentalCount],
      rentalContractColors,
      chartRentalContract
    );
    // Update center label
    const rentalExpiredNum = document.getElementById('chart-rental-expired-num');
    if (rentalExpiredNum) rentalExpiredNum.textContent = expiredRentalCount;
    const rentalCenterUnit = document.getElementById('chart-rental-center-unit');
    if (rentalCenterUnit) {
      rentalCenterUnit.textContent = (activeRentalValidCount + warningRentalCount + expiredRentalCount === 0) ? 'ไม่มีรถเช่า' : 'หมดสัญญา';
    }
    // Legend
    renderLegend('chart-rental-contract-legend', [
      { label: 'มีสัญญาปกติ',   value: activeRentalValidCount, color: rentalContractColors[0] },
      { label: 'ใกล้หมดสัญญา',  value: warningRentalCount,     color: rentalContractColors[1] },
      { label: 'หมดสัญญาแล้ว',  value: expiredRentalCount,     color: rentalContractColors[2] }
    ]);
    // ────────────────────────────────────────────────────────────────

    // Total Alerts on tab badge (แยก 3 หมวด: รถ + คนขับ + สัญญารถ)
    const totalAlerts = vehicleAlertCount + driverAlertCount + rentalAlertCount;
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
      const rentalStatus = window.forkliftStore.getRentalContractStatus(item);
      const isContractExpired = item.status === 'หมดสัญญาเช่า' || (item.isSubcontractor && rentalStatus.alertLevel === 'expired');

      if (state.activeFilter === 'all') return !isContractExpired;
      if (state.activeFilter === 'ready') return item.status === 'พร้อมใช้งาน' && !isContractExpired;
      if (state.activeFilter === 'repair') return item.status === 'ส่งซ่อม' && !isContractExpired;
      if (state.activeFilter === 'electric') return item.energyType === 'ไฟฟ้า' && !isContractExpired;
      if (state.activeFilter === 'lpg') return item.energyType === 'LPG' && !isContractExpired;
      if (state.activeFilter === 'diesel') return item.energyType === 'ดีเซล' && !isContractExpired;
      if (state.activeFilter === 'haier') return !item.isSubcontractor && !isContractExpired;
      if (state.activeFilter === 'subcontractor') return item.isSubcontractor && !isContractExpired;
      if (state.activeFilter === 'lpg-alert') {
        const s = window.forkliftStore.getLpgStatus(item);
        return s.isLpg && (s.alertLevel === 'warning' || s.alertLevel === 'overdue');
      }
      if (state.activeFilter === 'incomplete') {
        return window.forkliftStore.getIncompleteIssues(item).length > 0;
      }
      if (state.activeFilter === 'contract-expired') {
        return isContractExpired || (item.isSubcontractor && rentalStatus.alertLevel === 'warning');
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
      const itemRentalStatus = window.forkliftStore.getRentalContractStatus(item);
      const isItemExpired = item.status === 'หมดสัญญาเช่า' || (item.isSubcontractor && itemRentalStatus.alertLevel === 'expired');

      let statusBadge = '';
      if (isItemExpired) {
        statusBadge = `<span class="status-badge badge-expired"><i class="fa-solid fa-truck-arrow-right"></i> หมดสัญญา / ส่งคืนแล้ว</span>`;
      } else if (item.status === 'พร้อมใช้งาน') {
        statusBadge = `<span class="status-badge badge-ready"><i class="fa-solid fa-circle-check"></i> พร้อมใช้งาน</span>`;
      } else if (item.status === 'ส่งซ่อม') {
        statusBadge = `<span class="status-badge badge-repair"><i class="fa-solid fa-triangle-exclamation"></i> ส่งซ่อม</span>`;
      } else {
        statusBadge = `<span class="status-badge badge-expired">${item.status}</span>`;
      }

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
          ${item.frameNo ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Frame: <code>${item.frameNo}</code></div>` : ''}
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
            <i class="fa-solid fa-building"></i> ${item.subcontractor || (item.isSubcontractor ? 'รถเช่า' : 'Haier Owned')}
          </div>
          ${item.isSubcontractor && item.contractExpiryDate ? `
            <div style="font-size:0.72rem; color:#38bdf8; margin-top:2px;">
              <i class="fa-solid fa-calendar-xmark"></i> หมดสัญญา: ${item.contractExpiryDate}
            </div>
          ` : ''}
        </td>
        <td>
          <div class="driver-info-cell" style="display:flex; align-items:center; gap:0.65rem;">
            ${driver.photo
              ? `<img src="${driver.photo}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:2px solid var(--haier-cyan); flex-shrink:0;">`
              : `<div style="width:38px; height:38px; border-radius:50%; background:rgba(0,160,233,0.15); display:flex; align-items:center; justify-content:center; color:var(--haier-cyan); font-size:1rem; flex-shrink:0;"><i class="fa-solid fa-user"></i></div>`
            }
            <div>
              <div class="driver-name">${driver.name || 'ยังไม่ระบุ'}</div>
              <div class="driver-sub">รหัส: ${driver.empId || '-'} | ${driver.department || '-'}</div>
              <div style="margin-top:0.25rem; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                ${certBadge}
                ${driver.certImage ? `<img src="${driver.certImage}" alt="ใบรับรอง" style="width:28px; height:20px; object-fit:cover; border-radius:3px; border:1px solid rgba(255,255,255,0.3); cursor:pointer;" onclick="event.stopPropagation(); window.viewForkliftDetails('${item.id}')" title="คลิกดูใบรับรองในรายละเอียดรถ">` : ''}
              </div>
            </div>
          </div>
        </td>
        <td>
          ${statusBadge}
        </td>
        <td style="text-align: center;">
          <button class="btn btn-secondary btn-sm" onclick="window.viewForkliftDetails('${item.id}')" title="ดูรายละเอียดฉบับเต็ม">
            <i class="fa-regular fa-eye"></i> ดูข้อมูล
          </button>
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
  // Dashboard View Switcher (Fleet Table vs Driver Registry)
  // --------------------------------------------------------------------------
  const btnViewFleet = document.getElementById('btn-view-fleet');
  const btnViewDrivers = document.getElementById('btn-view-drivers');
  const dashFleetViewContainer = document.getElementById('dash-fleet-view-container');
  const dashDriverViewContainer = document.getElementById('dash-driver-view-container');

  function setDashView(view, skipRender = false) {
    state.dashView = view;
    if (view === 'fleet') {
      if (btnViewFleet) {
        btnViewFleet.classList.add('active', 'btn-primary');
        btnViewFleet.classList.remove('btn-secondary');
      }
      if (btnViewDrivers) {
        btnViewDrivers.classList.remove('active', 'btn-primary');
        btnViewDrivers.classList.add('btn-secondary');
      }
      if (dashFleetViewContainer) dashFleetViewContainer.style.display = 'block';
      if (dashDriverViewContainer) dashDriverViewContainer.style.display = 'none';
      if (!skipRender) renderDashboard();
    } else {
      if (btnViewDrivers) {
        btnViewDrivers.classList.add('active', 'btn-primary');
        btnViewDrivers.classList.remove('btn-secondary');
      }
      if (btnViewFleet) {
        btnViewFleet.classList.remove('active', 'btn-primary');
        btnViewFleet.classList.add('btn-secondary');
      }
      if (dashFleetViewContainer) dashFleetViewContainer.style.display = 'none';
      if (dashDriverViewContainer) dashDriverViewContainer.style.display = 'block';
      renderDriverTable();
    }
  }
  window.setDashView = setDashView;

  if (btnViewFleet) {
    btnViewFleet.addEventListener('click', () => setDashView('fleet'));
  }
  if (btnViewDrivers) {
    btnViewDrivers.addEventListener('click', () => setDashView('drivers'));
  }

  // Driver Search Input
  const driverSearchInput = document.getElementById('driver-search-input');
  if (driverSearchInput) {
    driverSearchInput.addEventListener('input', (e) => {
      state.driverSearchQuery = e.target.value.trim();
      renderDriverTable();
    });
  }

  // Driver Filter Pills
  const driverFilterPills = document.querySelectorAll('[data-driver-filter]');
  driverFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      driverFilterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.driverFilter = pill.dataset.driverFilter;
      renderDriverTable();
    });
  });

  // --------------------------------------------------------------------------
  // Driver Registry Table Rendering (ตารางข้อมูลผู้ขับขี่ใน Dashboard)
  // --------------------------------------------------------------------------
  function renderDriverTable() {
    const driverTableBody = document.getElementById('driver-table-body');
    if (!driverTableBody) return;
    if (!window.forkliftStore || typeof window.forkliftStore.getAllDrivers !== 'function') return;

    let drivers = window.forkliftStore.getAllDrivers();

    const dashDriversCount = document.getElementById('dash-drivers-count');
    if (dashDriversCount) dashDriversCount.textContent = drivers.length;

    // Apply Driver Filter
    if (state.driverFilter === 'certified') {
      drivers = drivers.filter(d => d.certStatus === 'ผ่านการรับรอง');
    } else if (state.driverFilter === 'pending') {
      drivers = drivers.filter(d => d.certStatus !== 'ผ่านการรับรอง');
    } else if (state.driverFilter === 'assigned') {
      drivers = drivers.filter(d => d.assignedPlate && d.assignedPlate.trim() !== '');
    } else if (state.driverFilter === 'unassigned') {
      drivers = drivers.filter(d => !d.assignedPlate || d.assignedPlate.trim() === '');
    }

    // Apply Driver Search
    if (state.driverSearchQuery) {
      const q = state.driverSearchQuery.toLowerCase();
      drivers = drivers.filter(d => {
        return (d.name && d.name.toLowerCase().includes(q)) ||
               (d.empId && d.empId.toLowerCase().includes(q)) ||
               (d.company && d.company.toLowerCase().includes(q)) ||
               (d.department && d.department.toLowerCase().includes(q)) ||
               (d.assignedPlate && d.assignedPlate.toLowerCase().includes(q));
      });
    }

    driverTableBody.innerHTML = '';

    if (drivers.length === 0) {
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td colspan="8" style="text-align:center; padding:3rem 1rem; color:var(--text-muted);">
          <i class="fa-solid fa-id-card" style="font-size:2.5rem; color:#475569; margin-bottom:0.75rem; display:block;"></i>
          <span style="font-size:1rem; font-weight:500;">ไม่พบข้อมูลทะเบียนผู้ขับขี่ตามเงื่อนไขที่เลือก</span>
          <br>
          <button class="btn btn-primary btn-sm" style="margin-top:1rem;" data-switch-tab="driver-reg-tab">
            <i class="fa-solid fa-user-plus"></i> ลงทะเบียนผู้ขับขี่ใหม่
          </button>
        </td>
      `;
      driverTableBody.appendChild(tr);
      return;
    }

    drivers.forEach(driver => {
      const tr = document.createElement('tr');

      const photoHtml = driver.photo
        ? `<img src="${driver.photo}" alt="${driver.name}" style="width:44px; height:44px; border-radius:50%; object-fit:cover; border:2px solid var(--haier-cyan); cursor:pointer;" onclick="window.viewDriverDetails('${driver.id}')" title="คลิกเพื่อดูรายละเอียดผู้ขับ">`
        : `<div style="width:44px; height:44px; border-radius:50%; background:rgba(0,160,233,0.1); border:1px dashed var(--haier-cyan); display:flex; align-items:center; justify-content:center; color:var(--haier-cyan); font-size:1.1rem; margin:0 auto; cursor:pointer;" onclick="window.viewDriverDetails('${driver.id}')" title="ดูรายละเอียดผู้ขับ"><i class="fa-solid fa-user-tie"></i></div>`;

      const isCert = driver.certStatus === 'ผ่านการรับรอง';
      const certBadge = isCert
        ? `<span class="status-badge badge-ready" title="ผ่านการอบรมความปลอดภัย"><i class="fa-solid fa-certificate"></i> ผ่านการรับรอง</span>`
        : `<span class="status-badge badge-repair" title="รอดำเนินการ / ยังไม่มีใบรับรอง"><i class="fa-solid fa-hourglass-half"></i> รอดำเนินการ</span>`;

      const certThumb = driver.certImage
        ? `<div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.35rem;">
             <img src="${driver.certImage}" alt="ใบรับรอง" style="width:44px; height:32px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.25); cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.3);" onclick="window.viewDriverDetails('${driver.id}')" title="คลิกเพื่อดูใบเซอร์ขนาดเต็ม">
             <span style="font-size:0.75rem; color:var(--haier-cyan); cursor:pointer; text-decoration:underline;" onclick="window.viewDriverDetails('${driver.id}')">ดูใบเซอร์</span>
           </div>`
        : `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;"><i class="fa-solid fa-file-circle-xmark"></i> ยังไม่แนบภาพ</div>`;

      const assignedBadge = driver.assignedPlate && driver.assignedPlate.trim() !== ''
        ? `<span class="plate-tag" style="cursor:pointer;" onclick="window.viewAssignedForklift('${driver.assignedPlate}')" title="คลิกเพื่อดูข้อมูลรถประจำ"><i class="fa-solid fa-truck-ramp-box"></i> ${driver.assignedPlate}</span>`
        : `<span style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-minus"></i> ยังไม่ระบุ</span>`;

      tr.innerHTML = `
        <td style="text-align:center;">${photoHtml}</td>
        <td><span class="plate-tag" style="font-size:0.8rem;">${driver.empId || '-'}</span></td>
        <td>
          <div style="font-weight:600; color:var(--text-primary); cursor:pointer;" onclick="window.viewDriverDetails('${driver.id}')">${driver.name}</div>
          ${driver.notes ? `<div style="font-size:0.75rem; color:var(--text-muted);"><i class="fa-regular fa-comment-dots"></i> ${driver.notes}</div>` : ''}
        </td>
        <td><span style="font-size:0.85rem;">${driver.company || '-'}</span></td>
        <td><span style="font-size:0.85rem;">${driver.department || '-'}</span></td>
        <td>${assignedBadge}</td>
        <td>
          ${certBadge}
          ${certThumb}
        </td>
        <td style="text-align:center;">
          <div style="display:flex; gap:0.35rem; justify-content:center;">
            <button class="btn btn-secondary btn-sm" onclick="window.viewDriverDetails('${driver.id}')" title="ดูรายละเอียดผู้ขับ">
              <i class="fa-regular fa-eye"></i>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.openEditDriverDirect('${driver.id}')" title="แก้ไขข้อมูลผู้ขับ">
              <i class="fa-solid fa-user-pen"></i>
            </button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteDriverItem('${driver.id}', '${driver.name}')" title="ลบผู้ขับขี่">
              <i class="fa-solid fa-trash"></i>
            </button>
          </div>
        </td>
      `;

      driverTableBody.appendChild(tr);
    });
  }

  // --------------------------------------------------------------------------
  // Populate Driver & Forklift Dropdown Selectors
  // --------------------------------------------------------------------------
  function populateDriverSelectOptions() {
    const sel = document.getElementById('reg-select-driver');
    if (!sel || !window.forkliftStore || typeof window.forkliftStore.getAllDrivers !== 'function') return;

    const drivers = window.forkliftStore.getAllDrivers();
    const currVal = sel.value;

    sel.innerHTML = '<option value="">-- ไม่ระบุผู้ขับ / กำหนดภายหลัง --</option>';
    drivers.forEach(d => {
      const opt = document.createElement('option');
      opt.value = d.id;
      const assignedText = d.assignedPlate ? ` [ขับรถ: ${d.assignedPlate}]` : '';
      opt.textContent = `${d.name} (${d.empId}) - ${d.company}${assignedText}`;
      sel.appendChild(opt);
    });

    if (currVal) sel.value = currVal;
    updateDriverPreviewCard();
  }

  function updateDriverPreviewCard() {
    const sel = document.getElementById('reg-select-driver');
    const card = document.getElementById('reg-driver-preview-card');
    if (!sel || !card) return;

    const driverId = sel.value;
    if (!driverId) {
      card.style.display = 'none';
      return;
    }

    const driver = window.forkliftStore.getDriverById(driverId);
    if (!driver) {
      card.style.display = 'none';
      return;
    }

    card.style.display = 'block';
    const photoEl = document.getElementById('reg-driver-prev-photo');
    const nameEl = document.getElementById('reg-driver-prev-name');
    const empidEl = document.getElementById('reg-driver-prev-empid');
    const compEl = document.getElementById('reg-driver-prev-company');
    const deptEl = document.getElementById('reg-driver-prev-dept');
    const certEl = document.getElementById('reg-driver-prev-cert');

    if (photoEl) {
      if (driver.photo) {
        photoEl.src = driver.photo;
        photoEl.style.display = 'block';
        if (photoEl.nextElementSibling) photoEl.nextElementSibling.style.display = 'none';
      } else {
        photoEl.style.display = 'none';
        if (photoEl.nextElementSibling) photoEl.nextElementSibling.style.display = 'block';
      }
    }
    if (nameEl) nameEl.textContent = driver.name;
    if (empidEl) empidEl.textContent = driver.empId || '-';
    if (compEl) compEl.textContent = driver.company || '-';
    if (deptEl) deptEl.textContent = driver.department || '-';
    if (certEl) {
      const isCert = driver.certStatus === 'ผ่านการรับรอง';
      certEl.className = `status-badge ${isCert ? 'badge-ready' : 'badge-repair'}`;
      certEl.innerHTML = `<i class="fa-solid ${isCert ? 'fa-certificate' : 'fa-hourglass-half'}"></i> ${driver.certStatus || 'รอดำเนินการ'}`;
    }
  }

  const regSelectDriverEl = document.getElementById('reg-select-driver');
  if (regSelectDriverEl) {
    regSelectDriverEl.addEventListener('change', updateDriverPreviewCard);
  }

  function populateForkliftSelectOptions() {
    const selNew = document.getElementById('new-driver-assigned-plate');
    const selEdit = document.getElementById('edit-driver-assigned-plate');
    if (!window.forkliftStore || typeof window.forkliftStore.getAll !== 'function') return;

    const forklifts = window.forkliftStore.getAll();
    const buildOptions = (targetSel) => {
      if (!targetSel) return;
      const curr = targetSel.value;
      targetSel.innerHTML = '<option value="">-- ยังไม่มอบหมายรถประจำ (Unassigned) --</option>';
      forklifts.forEach(fl => {
        const opt = document.createElement('option');
        opt.value = fl.plateNumber;
        opt.textContent = `${fl.plateNumber} (${fl.vehicleType} - ${fl.ownerCompany})`;
        targetSel.appendChild(opt);
      });
      if (curr) targetSel.value = curr;
    };

    buildOptions(selNew);
    buildOptions(selEdit);
  }

  // --------------------------------------------------------------------------
  // --------------------------------------------------------------------------
  // Alerts Center Rendering (แท็บ แจ้งเตือน: แยก 3 ส่วน รถ / คนขับ / สัญญารถ)
  // --------------------------------------------------------------------------
  function renderAlertsCenter() {
    const forklifts = window.forkliftStore.getAll();
    const vehicleAlertsContainer = document.getElementById('vehicle-alerts-list');
    const driverAlertsContainer = document.getElementById('driver-alerts-list');
    const rentalAlertsContainer = document.getElementById('rental-alerts-list');

    if (vehicleAlertsContainer) vehicleAlertsContainer.innerHTML = '';
    if (driverAlertsContainer) driverAlertsContainer.innerHTML = '';
    if (rentalAlertsContainer) rentalAlertsContainer.innerHTML = '';

    let vehicleAlertCount = 0;
    let driverAlertCount = 0;
    let rentalAlertCount = 0;

    forklifts.forEach(item => {
      // ======================================================================
      // 1. หมวดรถ (Vehicle Alerts): LPG 1 ปี + ภาพถ่าย/ข้อมูลสภาพรถไม่ครบ
      // ======================================================================
      const lpgStatus = window.forkliftStore.getLpgStatus(item);
      const vehicleIssues = window.forkliftStore.getVehicleIssues(item);
      const hasLpgAlert = lpgStatus.isLpg && (lpgStatus.alertLevel === 'warning' || lpgStatus.alertLevel === 'overdue');
      const hasVehicleIssues = vehicleIssues.length > 0;

      if (hasLpgAlert || hasVehicleIssues) {
        vehicleAlertCount++;
        if (vehicleAlertsContainer) {
          const isOverdue = lpgStatus.isLpg && lpgStatus.alertLevel === 'overdue';
          const alertBox = document.createElement('div');
          alertBox.className = `alert-item-box ${isOverdue ? 'alert-lpg-urgent' : (hasLpgAlert ? 'alert-lpg-warning' : 'alert-incomplete')}`;

          let alertTopBadge = '';
          if (isOverdue) {
            alertTopBadge = `<span class="status-badge badge-lpg-overdue"><i class="fa-solid fa-triangle-exclamation"></i> เลยกำหนดตรวจ 1 ปี (${lpgStatus.overdueDays} วัน)</span>`;
          } else if (hasLpgAlert) {
            alertTopBadge = `<span class="status-badge badge-lpg-warn"><i class="fa-solid fa-clock"></i> ครบกำหนดตรวจใน ${lpgStatus.daysRemaining} วัน</span>`;
          } else {
            alertTopBadge = `<span class="status-badge badge-repair"><i class="fa-solid fa-circle-exclamation"></i> ข้อมูลรถไม่สมบูรณ์</span>`;
          }

          let issueBadges = '';
          if (hasVehicleIssues) {
            issueBadges = vehicleIssues.map(iss => `<span class="status-badge badge-repair" style="font-size:0.72rem; margin:2px;"><i class="fa-solid fa-triangle-exclamation"></i> ${iss}</span>`).join(' ');
          }

          alertBox.innerHTML = `
            <div class="alert-box-top">
              <span class="plate-tag"><i class="fa-solid fa-truck-ramp-box"></i> ${item.plateNumber}</span>
              ${alertTopBadge}
            </div>
            <div class="alert-desc-text">
              <strong>${item.vehicleType}</strong> | สังกัด: ${item.ownerCompany} (${item.subcontractor || (item.isSubcontractor ? 'รถเช่า' : 'Haier Owned')})
              ${hasLpgAlert ? `
                <div style="margin-top:0.35rem; color: ${isOverdue ? '#fca5a5' : '#fbbf24'}; font-size:0.82rem;">
                  <i class="fa-solid fa-fire"></i> ${lpgStatus.text}
                </div>
              ` : ''}
              ${hasVehicleIssues ? `
                <div style="margin-top:0.4rem;">${issueBadges}</div>
              ` : ''}
            </div>
            <div class="alert-meta-tags">
              <span class="badge-energy energy-${item.energyType === 'LPG' ? 'lpg' : (item.energyType === 'ดีเซล' ? 'diesel' : 'electric')}">
                <i class="fa-solid ${item.energyType === 'LPG' ? 'fa-fire' : (item.energyType === 'ดีเซล' ? 'fa-gas-pump' : 'fa-bolt')}"></i> ${item.energyType}
              </span>
              ${item.lastInspectionDate ? `<span class="filter-pill" style="font-size:0.72rem;"><i class="fa-solid fa-calendar-check"></i> ตรวจล่าสุด: ${item.lastInspectionDate}</span>` : ''}
              ${lpgStatus.isLpg ? `<span class="filter-pill" style="font-size:0.72rem;"><i class="fa-solid fa-calendar-xmark"></i> ครบรอบ 1 ปี: ${lpgStatus.dueDateStr || '-'}</span>` : ''}
              ${item.frameNo ? `<span class="filter-pill" style="font-size:0.72rem;"><i class="fa-solid fa-fingerprint"></i> Frame: ${item.frameNo}</span>` : ''}
            </div>
            <div class="alert-action-footer">
              <button class="btn btn-secondary btn-sm" onclick="window.viewForkliftDetails('${item.id}')">
                <i class="fa-regular fa-eye"></i> ดูข้อมูล
              </button>
              <button class="btn btn-primary btn-sm" onclick="window.openUpdateStatusModal('${item.id}', ${hasLpgAlert})">
                <i class="fa-solid fa-clipboard-check"></i> ${hasLpgAlert ? 'บันทึกตรวจเช็คทันที' : 'อัปเดตข้อมูลรถ/ภาพ'}
              </button>
            </div>
          `;
          vehicleAlertsContainer.appendChild(alertBox);
        }
      }

      // ======================================================================
      // 2. หมวดคนขับ (Driver Alerts): ผู้ขับขี่ + ใบเซอร์ (Cert)
      // ======================================================================
      const driver = item.driver;
      const driverIssues = window.forkliftStore.getDriverIssues(item);
      const isMissingDriver = !driver || !driver.name || driver.name === 'ยังไม่ระบุ';
      const isPendingCert = driver && (!driver.certImage || driver.certStatus === 'รอดำเนินการ');
      const isInvalidCert = driver && driver.certStatus === 'ไม่ถูกต้อง';

      if (isMissingDriver || isPendingCert || isInvalidCert || driverIssues.length > 0) {
        driverAlertCount++;
        if (driverAlertsContainer) {
          const alertBox = document.createElement('div');
          alertBox.className = `alert-item-box ${isInvalidCert ? 'alert-lpg-urgent' : 'alert-incomplete'}`;

          let driverBadge = '';
          if (isMissingDriver) {
            driverBadge = `<span class="status-badge badge-repair"><i class="fa-solid fa-user-xmark"></i> ยังไม่ได้ระบุผู้ขับ</span>`;
          } else if (isInvalidCert) {
            driverBadge = `<span class="status-badge badge-repair"><i class="fa-solid fa-circle-xmark"></i> ใบเซอร์ไม่ถูกต้อง</span>`;
          } else {
            driverBadge = `<span class="status-badge badge-cert-pending"><i class="fa-solid fa-hourglass-half"></i> ใบเซอร์: รอดำเนินการ</span>`;
          }

          const issueBadges = driverIssues.map(iss => `<span class="status-badge ${isInvalidCert ? 'badge-repair' : 'badge-cert-pending'}" style="font-size:0.72rem; margin:2px;"><i class="fa-solid fa-circle-info"></i> ${iss}</span>`).join(' ');

          alertBox.innerHTML = `
            <div class="alert-box-top">
              <span class="plate-tag"><i class="fa-solid fa-truck-ramp-box"></i> ${item.plateNumber}</span>
              ${driverBadge}
            </div>
            <div class="alert-desc-text">
              <div style="font-weight:600; color:var(--text-primary); margin-bottom:0.25rem;">
                <i class="fa-solid fa-user"></i> ${driver?.name && driver.name !== 'ยังไม่ระบุ' ? driver.name : '<span style="color:#f87171;">ยังไม่มีผู้ขับประจำรถ</span>'}
              </div>
              <div style="font-size:0.8rem; color:var(--text-muted);">
                รหัสพนักงาน: ${driver?.empId || '-'} | แผนก: ${driver?.department || item.ownerCompany || '-'}
              </div>
              <div style="margin-top:0.4rem;">${issueBadges}</div>
            </div>
            <div class="alert-action-footer">
              <button class="btn btn-secondary btn-sm" onclick="window.viewForkliftDetails('${item.id}')">
                <i class="fa-regular fa-eye"></i> ดูข้อมูล
              </button>
              <button class="btn btn-primary btn-sm" onclick="window.openEditDriverModal('${item.id}')" style="background:#8b5cf6; border-color:#8b5cf6;">
                <i class="fa-solid fa-id-card"></i> ${isMissingDriver ? 'ระบุผู้ขับขี่' : 'จัดการใบเซอร์คนขับ'}
              </button>
            </div>
          `;
          driverAlertsContainer.appendChild(alertBox);
        }
      }

      // ======================================================================
      // 3. หมวดสัญญารถ (Rental Contract Alerts): สัญญาเช่า 30 วัน / หมดสัญญา
      // ======================================================================
      if (item.isSubcontractor) {
        const rentalStatus = window.forkliftStore.getRentalContractStatus(item);
        const isContractExpired = item.status === 'หมดสัญญาเช่า' || rentalStatus.alertLevel === 'expired';
        const isWarning = rentalStatus.alertLevel === 'warning';

        if (isContractExpired || isWarning) {
          rentalAlertCount++;
          if (rentalAlertsContainer) {
            const alertBox = document.createElement('div');
            alertBox.className = `alert-item-box ${isContractExpired ? 'alert-lpg-urgent' : 'alert-lpg-warning'}`;
            alertBox.innerHTML = `
              <div class="alert-box-top">
                <span class="plate-tag"><i class="fa-solid fa-truck-ramp-box"></i> ${item.plateNumber}</span>
                <span class="status-badge ${isContractExpired ? 'badge-lpg-overdue' : 'badge-lpg-warn'}">
                  <i class="fa-solid ${isContractExpired ? 'fa-triangle-exclamation' : 'fa-clock'}"></i>
                  ${isContractExpired ? `หมดสัญญาแล้ว (${rentalStatus.overdueDays || 0} วัน)` : `เหลือสัญญาอีก ${rentalStatus.daysRemaining} วัน`}
                </span>
              </div>
              <div class="alert-desc-text">
                <strong>${item.vehicleType}</strong> | บริษัทผู้ให้เช่า: <strong>${item.ownerCompany || item.subcontractor || 'ผู้ให้บริการภายนอก'}</strong>
                <br>
                <span style="color: ${isContractExpired ? '#fca5a5' : '#38bdf8'}; font-size:0.82rem;">
                  <i class="fa-solid fa-file-contract"></i> ${rentalStatus.text} (วันหมดสัญญา: ${rentalStatus.expiryDateStr || item.contractExpiryDate || '-'})
                </span>
                ${item.frameNo ? `<div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">Frame No.: <code>${item.frameNo}</code></div>` : ''}
              </div>
              <div class="alert-action-footer">
                <button class="btn btn-secondary btn-sm" onclick="window.viewForkliftDetails('${item.id}')">
                  <i class="fa-regular fa-eye"></i> ดูข้อมูล
                </button>
                <button class="btn btn-primary btn-sm" onclick="window.openUpdateStatusModal('${item.id}')">
                  <i class="fa-solid fa-file-contract"></i> จัดการ/ต่อสัญญา
                </button>
                ${isContractExpired && item.status !== 'หมดสัญญาเช่า' ? `
                  <button class="btn btn-secondary btn-sm" onclick="window.setForkliftExpiredStatus('${item.id}')" style="color:#fda4af; border-color:rgba(244,63,94,0.4);" title="ปรับสถานะเป็นหมดสัญญาเช่า/ส่งคืนแล้ว เพื่อแยกออกจากรถพร้อมใช้งาน">
                    <i class="fa-solid fa-truck-arrow-right"></i> ปรับเป็นหมดสัญญา/ส่งคืน
                  </button>
                ` : ''}
              </div>
            `;
            rentalAlertsContainer.appendChild(alertBox);
          }
        }
      }
    });

    // Empty States
    if (vehicleAlertsContainer && vehicleAlertCount === 0) {
      vehicleAlertsContainer.innerHTML = `
        <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size:2.2rem; color:var(--status-ready); margin-bottom:0.75rem;"></i>
          <p>${forklifts.length === 0 ? 'ยังไม่มีข้อมูลรถในระบบ' : 'ไม่มีการแจ้งเตือนเกี่ยวกับตัวรถ รถทุกคันตรวจสภาพตรงกำหนดและแนบภาพถ่ายครบถ้วน'}</p>
        </div>
      `;
    }

    if (driverAlertsContainer && driverAlertCount === 0) {
      driverAlertsContainer.innerHTML = `
        <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size:2.2rem; color:var(--status-ready); margin-bottom:0.75rem;"></i>
          <p>${forklifts.length === 0 ? 'ยังไม่มีข้อมูลรถในระบบ' : 'ไม่มีการแจ้งเตือนเกี่ยวกับคนขับ ผู้ขับขี่ทุกคนมีข้อมูลครบถ้วนและผ่านการรับรอง'}</p>
        </div>
      `;
    }

    if (rentalAlertsContainer && rentalAlertCount === 0) {
      rentalAlertsContainer.innerHTML = `
        <div style="text-align:center; padding:2.5rem 1rem; color:var(--text-muted);">
          <i class="fa-solid fa-circle-check" style="font-size:2.2rem; color:var(--status-ready); margin-bottom:0.75rem;"></i>
          <p>${forklifts.filter(f => f.isSubcontractor).length === 0 ? 'ยังไม่มีข้อมูลรถเช่าในระบบ' : 'ไม่มีการแจ้งเตือนสัญญาเช่า รถเช่าทุกคันมีสัญญาใช้งานปกติ'}</p>
        </div>
      `;
    }

    // Update Section Summary Cards & Badges
    const sumVehicle = document.getElementById('sum-vehicle-alerts');
    const badgeVehicle = document.getElementById('alert-badge-vehicle');
    if (sumVehicle) sumVehicle.textContent = `${vehicleAlertCount} คัน`;
    if (badgeVehicle) badgeVehicle.textContent = `${vehicleAlertCount} รายการ`;

    const sumDriver = document.getElementById('sum-driver-alerts');
    const badgeDriver = document.getElementById('alert-badge-driver');
    if (sumDriver) sumDriver.textContent = `${driverAlertCount} รายการ`;
    if (badgeDriver) badgeDriver.textContent = `${driverAlertCount} รายการ`;

    const sumRental = document.getElementById('sum-rental-alerts');
    const badgeRental = document.getElementById('alert-badge-rental');
    if (sumRental) sumRental.textContent = `${rentalAlertCount} คัน`;
    if (badgeRental) badgeRental.textContent = `${rentalAlertCount} รายการ`;

    // Update Tab Badge Counter
    const totalAlerts = vehicleAlertCount + driverAlertCount + rentalAlertCount;
    if (alertTabBadge) {
      if (totalAlerts > 0) {
        alertTabBadge.style.display = 'inline-flex';
        alertTabBadge.textContent = totalAlerts;
      } else {
        alertTabBadge.style.display = 'none';
      }
    }
  }

  // --------------------------------------------------------------------------
  // Registration Form Logic
  // --------------------------------------------------------------------------

  // Ownership Type Switcher: รถของบริษัท vs รถเช่า
  function setOwnershipType(type) {
    if (!regOwnerType) return;
    const isRental = type === 'rental';
    regOwnerType.value = isRental ? 'rental' : 'company';

    if (btnOwnerCompany && btnOwnerRental) {
      if (isRental) {
        btnOwnerRental.classList.add('active', 'btn-primary');
        btnOwnerRental.classList.remove('btn-secondary');
        btnOwnerCompany.classList.remove('active', 'btn-primary');
        btnOwnerCompany.classList.add('btn-secondary');
      } else {
        btnOwnerCompany.classList.add('active', 'btn-primary');
        btnOwnerCompany.classList.remove('btn-secondary');
        btnOwnerRental.classList.remove('active', 'btn-primary');
        btnOwnerRental.classList.add('btn-secondary');
      }
    }

    if (isRental) {
      // รถเช่า:
      // - เลขทะเบียนระบบรันให้เอง เซ็ตการรันเลขคือ "SP-{000}"
      const nextRentalPlate = window.forkliftStore.getNextRentalPlateNumber();
      regPlateInput.value = nextRentalPlate;
      regPlateInput.readOnly = true;
      regPlateInput.classList.remove('is-invalid');
      regPlateInput.classList.add('is-valid');
      if (duplicateAlert) duplicateAlert.classList.remove('show');
      if (rentalPlateBadge) rentalPlateBadge.style.display = 'inline-block';
      if (regPlateHint) regPlateHint.textContent = 'ระบบรันเลขทะเบียนอัตโนมัติตามรูปแบบ SP-{000} (ล็อกไม่ให้แก้ไข)';

      // - ชื่อบริษัทที่เช่า (กรอกเอง)
      if (regOwnerCompany) {
        if (regOwnerCompany.value === 'Haier Electric (Thailand) Company Limited') {
          regOwnerCompany.value = '';
        }
        regOwnerCompany.readOnly = false;
        regOwnerCompany.placeholder = 'เช่น บจก. สยาม โฟล์คลิฟท์ หรือ บจก. ไทย โลจิสติกส์';
      }
      if (labelRegCompany) {
        labelRegCompany.innerHTML = 'ชื่อบริษัทที่เช่า (Rental Supplier) <span class="required">*</span>';
      }
      if (hintRegCompany) {
        hintRegCompany.textContent = 'ระบุชื่อบริษัทผู้ให้เช่ารถ Forklift';
      }

      // - วันหมดสัญญาเช่า พร้อมลิงก์เข้าศูนย์แจ้งเตือนล่วงหน้า 1 เดือน
      if (regContractExpiryGroup) regContractExpiryGroup.style.display = 'block';
      if (regContractExpiry) regContractExpiry.required = true;
    } else {
      // รถของบริษัท:
      // - เลขทะเบียนกรอกเอง
      if (regPlateInput.value.startsWith('SP-')) {
        regPlateInput.value = '';
        regPlateInput.classList.remove('is-valid');
      }
      regPlateInput.readOnly = false;
      if (rentalPlateBadge) rentalPlateBadge.style.display = 'none';
      if (regPlateHint) regPlateHint.textContent = 'ระบุเลขทะเบียนรถบริษัท (ห้ามซ้ำ)';

      // - บริษัท Haier Electric (Thailand) Company Limited ล็อกชื่อบริษัท
      if (regOwnerCompany) {
        regOwnerCompany.value = 'Haier Electric (Thailand) Company Limited';
        regOwnerCompany.readOnly = true;
      }
      if (labelRegCompany) {
        labelRegCompany.innerHTML = 'ชื่อบริษัท (Company Name) <span class="required">*</span>';
      }
      if (hintRegCompany) {
        hintRegCompany.textContent = 'ล็อกชื่อบริษัทสำหรับรถของบริษัท';
      }

      // - ซ่อนวันหมดสัญญาเช่า
      if (regContractExpiryGroup) regContractExpiryGroup.style.display = 'none';
      if (regContractExpiry) {
        regContractExpiry.required = false;
        regContractExpiry.value = '';
      }
    }
  }

  if (btnOwnerCompany) {
    btnOwnerCompany.addEventListener('click', () => setOwnershipType('company'));
  }
  if (btnOwnerRental) {
    btnOwnerRental.addEventListener('click', () => setOwnershipType('rental'));
  }

  // Real-time Frame No. (หมายเลขตัวถัง) validation - ห้ามซ้ำกัน
  if (regFrameNoInput) {
    regFrameNoInput.addEventListener('input', () => {
      const val = regFrameNoInput.value.trim();
      if (!val) {
        regFrameNoInput.classList.remove('is-invalid', 'is-valid');
        if (duplicateFrameAlert) duplicateFrameAlert.classList.remove('show');
        return;
      }

      const isDuplicate = window.forkliftStore.isFrameNoDuplicate(val);
      if (isDuplicate) {
        regFrameNoInput.classList.add('is-invalid');
        regFrameNoInput.classList.remove('is-valid');
        if (duplicateFrameAlert) {
          duplicateFrameAlert.classList.add('show');
          if (duplicateFrameMsg) {
            duplicateFrameMsg.innerHTML = `หมายเลขตัวถัง <strong>"${val}"</strong> เคยลงทะเบียนแล้วในระบบ จะไม่สามารถลงซ้ำได้`;
          }
        }
      } else {
        regFrameNoInput.classList.remove('is-invalid');
        regFrameNoInput.classList.add('is-valid');
        if (duplicateFrameAlert) duplicateFrameAlert.classList.remove('show');
      }
    });
  }

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

  // Energy source change: Display LPG inspection guidance + update dynamic checklist
  // =====================================================================
  // Energy-type checklist definitions
  // =====================================================================
  const ENERGY_CHECKLIST_KEYS = ['batterySystem', 'lpgSystem', 'engineSystem', 'gasolineSystem'];

  const ENERGY_CHECKLIST_DEFINITIONS = {
    'ไฟฟ้า': {
      key: 'batterySystem',
      name: 'แบตเตอรี่และชุดชาร์จ (Battery Pack & Charger)',
      desc: 'ระดับแบตเตอรี่เพียงพอ ขั้วต่อสะอาดไม่มีคราบขี้เกลือ สายไฟไม่ชำรุด ตู้ชาร์จและสายชาร์จสมบูรณ์'
    },
    'LPG': {
      key: 'lpgSystem',
      name: 'ถังแก๊ส LPG สายแก๊ส และวาล์วควบคุม (LPG Tank, Hose & Regulator)',
      desc: 'สายรัดถังแน่นหนา สายแก๊สไม่ปริแตกหรือหักงอ วาล์วปิดสนิท ไม่พบกลิ่นแก๊สรั่ว'
    },
    'ดีเซล': {
      key: 'engineSystem',
      name: 'น้ำมันเครื่อง น้ำหล่อเย็น และกรองอากาศ (Engine Oil, Coolant & Air Filter)',
      desc: 'ระดับน้ำมันเครื่องและน้ำหล่อเย็นอยู่ในเกณฑ์ ไม่พบรอยรั่ว กรองอากาศสะอาด ควันไอเสียปกติ'
    },
    'เบนซิน': {
      key: 'gasolineSystem',
      name: 'หัวเทียน คาร์บูเรเตอร์ และถังน้ำมันเบนซิน (Spark Plugs, Carburettor & Fuel Tank)',
      desc: 'หัวเทียนสะอาดไม่สึกกร่อน คาร์บูเรเตอร์ไม่อุดตัน ถังน้ำมันไม่รั่วซึม ระดับน้ำมันเพียงพอ'
    }
  };

  /**
   * Render the energy-specific checklist row (item 7) and update state.regChecklist
   * to remove old energy key and add the new one (defaulting to true / ปกติ).
   * Re-attaches toggle event listeners for the newly rendered row.
   * @param {string} energyType - One of 'ไฟฟ้า', 'LPG', 'ดีเซล', 'เบนซิน'
   */
  function updateChecklistForEnergy(energyType) {
    const container = document.getElementById('energy-specific-check-row');
    if (!container) return;

    const def = ENERGY_CHECKLIST_DEFINITIONS[energyType];
    if (!def) return;

    // Remove all old energy-specific keys from state
    ENERGY_CHECKLIST_KEYS.forEach(k => { delete state.regChecklist[k]; });
    // Add new key (preserve existing value if already set, else default true)
    if (!(def.key in state.regChecklist)) {
      state.regChecklist[def.key] = true;
    }

    const isPass = state.regChecklist[def.key] !== false;

    container.innerHTML = `
      <div class="check-item-row" data-check-key="${def.key}">
        <div class="check-item-info">
          <span class="check-item-num">7</span>
          <div>
            <div class="check-item-name">${def.name}</div>
            <div class="check-item-desc">${def.desc}</div>
          </div>
        </div>
        <div class="check-item-options">
          <button type="button" class="status-toggle-btn btn-pass${isPass ? ' active' : ''}">ปกติ</button>
          <button type="button" class="status-toggle-btn btn-fail${!isPass ? ' active' : ''}">ชำรุด</button>
        </div>
      </div>`;

    // Re-attach toggle listeners for the new row
    container.querySelectorAll('.status-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const row = btn.closest('.check-item-row');
        const key = row.dataset.checkKey;
        const isPassClick = btn.classList.contains('btn-pass');
        row.querySelector('.btn-pass').classList.toggle('active', isPassClick);
        row.querySelector('.btn-fail').classList.toggle('active', !isPassClick);
        state.regChecklist[key] = isPassClick;
        const hasFail = Object.values(state.regChecklist).some(val => val === false);
        if (hasFail) {
          document.getElementById('status-repair').checked = true;
        }
      });
    });
  }

  regEnergySelect.addEventListener('change', () => {
    if (regEnergySelect.value === 'LPG') {
      regLpgNote.style.display = 'block';
    } else {
      regLpgNote.style.display = 'none';
    }
    updateChecklistForEnergy(regEnergySelect.value);
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

  /**
   * Helper: Compress image before storing to prevent localStorage QuotaExceededError
   */
  function compressImage(fileOrDataUrl, maxDimension = 800, quality = 0.75) {
    return new Promise((resolve) => {
      if (!fileOrDataUrl) return resolve('');

      const processImg = (src) => {
        const img = new Image();
        img.onload = () => {
          let { width, height } = img;
          if (width > maxDimension || height > maxDimension) {
            const scale = Math.min(maxDimension / width, maxDimension / height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          // Fill white background for transparent PNG/SVG images so they don't turn black in jpeg
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, width, height);
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = () => resolve(src);
        img.src = src;
      };

      if (typeof fileOrDataUrl === 'string') {
        if (fileOrDataUrl.startsWith('http://') || fileOrDataUrl.startsWith('https://')) {
          return resolve(fileOrDataUrl);
        }
        processImg(fileOrDataUrl);
      } else if (fileOrDataUrl instanceof File || fileOrDataUrl instanceof Blob) {
        const reader = new FileReader();
        reader.onload = (e) => processImg(e.target.result);
        reader.onerror = () => resolve('');
        reader.readAsDataURL(fileOrDataUrl);
      } else {
        resolve('');
      }
    });
  }

  // Vehicle Photo Upload Handler (แนบ 1 รูป ไม่ต้องระบุว่ามุมไหน)
  const boxVehiclePhoto = document.getElementById('box-photo-vehicle');
  const inputVehiclePhoto = document.getElementById('input-photo-vehicle');
  const previewVehiclePhoto = document.getElementById('preview-photo-vehicle');
  const btnRemoveVehiclePhoto = document.getElementById('btn-remove-vehicle-photo');

  if (boxVehiclePhoto && inputVehiclePhoto) {
    boxVehiclePhoto.addEventListener('click', (e) => {
      if (e.target.closest('.photo-overlay-actions')) return;
      inputVehiclePhoto.click();
    });

    inputVehiclePhoto.addEventListener('change', async () => {
      const file = inputVehiclePhoto.files[0];
      if (file) {
        const compressed = await compressImage(file, 900, 0.75);
        setVehiclePhoto(compressed);
      }
    });

    if (btnRemoveVehiclePhoto) {
      btnRemoveVehiclePhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        resetVehiclePhoto();
      });
    }
  }

  function setVehiclePhoto(src) {
    state.regPhotos.vehicle = src;
    state.regPhotos.front = src; // for backward compatibility
    if (previewVehiclePhoto) {
      previewVehiclePhoto.src = src;
      previewVehiclePhoto.style.display = 'block';
    }
    const content = boxVehiclePhoto?.querySelector('.photo-box-content');
    if (content) content.style.display = 'none';
    boxVehiclePhoto?.classList.add('has-image');
  }

  function resetVehiclePhoto() {
    state.regPhotos = { vehicle: '', front: '', side: '', fullFront: '' };
    if (inputVehiclePhoto) inputVehiclePhoto.value = '';
    if (previewVehiclePhoto) {
      previewVehiclePhoto.src = '';
      previewVehiclePhoto.style.display = 'none';
    }
    const content = boxVehiclePhoto?.querySelector('.photo-box-content');
    if (content) content.style.display = 'flex';
    boxVehiclePhoto?.classList.remove('has-image');
  }

  // Quick fill sample vehicle photo for testing
  const btnSamplePhoto = document.getElementById('btn-sample-photos');
  if (btnSamplePhoto) {
    btnSamplePhoto.addEventListener('click', () => {
      setVehiclePhoto(window.SVG_ASSETS.forkliftFront);
      showToast('โหลดภาพถ่ายตัวอย่างสภาพรถ Forklift แล้ว', 'success');
    });
  }

  // --------------------------------------------------------------------------
  // Dedicated Driver Registration Form Handlers (ลงทะเบียนผู้ขับขี่ใหม่)
  // --------------------------------------------------------------------------
  
  // 1. Driver Photo Upload & Preview
  const boxNewDriverPhoto = document.getElementById('box-new-driver-photo');
  const inputNewDriverPhoto = document.getElementById('input-new-driver-photo');
  const previewNewDriverPhoto = document.getElementById('preview-new-driver-photo');
  const btnRemoveNewDriverPhoto = document.getElementById('btn-remove-new-driver-photo');

  if (boxNewDriverPhoto && inputNewDriverPhoto) {
    boxNewDriverPhoto.addEventListener('click', (e) => {
      if (e.target.closest('.photo-overlay-actions')) return;
      inputNewDriverPhoto.click();
    });

    inputNewDriverPhoto.addEventListener('change', async () => {
      const file = inputNewDriverPhoto.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          if (previewNewDriverPhoto) {
            previewNewDriverPhoto.src = e.target.result;
            previewNewDriverPhoto.style.display = 'block';
          }
          const content = boxNewDriverPhoto.querySelector('.photo-box-content');
          if (content) content.style.display = 'none';
          boxNewDriverPhoto.classList.add('has-image');
        };
        reader.readAsDataURL(file);

        const compressed = await compressImage(file, 600, 0.75);
        state.newDriverPhoto = compressed;
        if (previewNewDriverPhoto) {
          previewNewDriverPhoto.src = compressed;
        }
      }
    });

    if (btnRemoveNewDriverPhoto) {
      btnRemoveNewDriverPhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        state.newDriverPhoto = '';
        inputNewDriverPhoto.value = '';
        if (previewNewDriverPhoto) {
          previewNewDriverPhoto.src = '';
          previewNewDriverPhoto.style.display = 'none';
        }
        const content = boxNewDriverPhoto.querySelector('.photo-box-content');
        if (content) content.style.display = 'flex';
        boxNewDriverPhoto.classList.remove('has-image');
      });
    }
  }

  // 2. Real-time Employee ID Duplicate Check
  const newDriverEmpIdInput = document.getElementById('new-driver-empid');
  const newDriverEmpIdAlert = document.getElementById('new-driver-empid-alert');
  if (newDriverEmpIdInput) {
    newDriverEmpIdInput.addEventListener('input', (e) => {
      const val = e.target.value.trim();
      if (!val) {
        if (newDriverEmpIdAlert) newDriverEmpIdAlert.style.display = 'none';
        newDriverEmpIdInput.classList.remove('is-invalid');
        return;
      }
      const isDup = window.forkliftStore.isDriverEmpIdDuplicate(val);
      if (isDup) {
        if (newDriverEmpIdAlert) newDriverEmpIdAlert.style.display = 'block';
        newDriverEmpIdInput.classList.add('is-invalid');
      } else {
        if (newDriverEmpIdAlert) newDriverEmpIdAlert.style.display = 'none';
        newDriverEmpIdInput.classList.remove('is-invalid');
      }
    });
  }

  // 3. Safety Certificate Upload & AI Engine Check for New Driver
  const inputNewDriverCert = document.getElementById('input-new-driver-cert');
  const previewNewDriverCert = document.getElementById('preview-new-driver-cert');
  const newDriverCertStatus = document.getElementById('new-driver-cert-status');

  if (inputNewDriverCert) {
    inputNewDriverCert.addEventListener('change', async (e) => {
      const file = e.target.files[0];
      const driverName = (document.getElementById('new-driver-name')?.value || '').trim();

      if (file) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          if (previewNewDriverCert) {
            previewNewDriverCert.src = ev.target.result;
            previewNewDriverCert.style.display = 'block';
          }
        };
        reader.readAsDataURL(file);

        if (newDriverCertStatus) {
          newDriverCertStatus.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> ระบบ AI กำลังตรวจสอบความถูกต้องของใบรับรอง...`;
        }
        const compressed = await compressImage(file, 900, 0.75);
        if (previewNewDriverCert) {
          previewNewDriverCert.src = compressed;
        }
        if (window.aiVerifier && typeof window.aiVerifier.verify === 'function') {
          const result = await window.aiVerifier.verify(compressed, { driverName });
          state.newDriverCert.image = compressed;
          state.newDriverCert.status = result.status;
          const color = result.status === 'ผ่านการรับรอง' ? '#34d399' : '#f87171';
          if (newDriverCertStatus) {
            newDriverCertStatus.innerHTML = `ผลตรวจ AI: <strong style="color:${color};">${result.status}</strong> (${result.confidence}%)<br><span style="font-size:0.75rem; color:var(--text-secondary);">${result.details}</span>`;
          }
        } else {
          state.newDriverCert.image = compressed;
          state.newDriverCert.status = 'ผ่านการรับรอง';
          if (newDriverCertStatus) {
            newDriverCertStatus.innerHTML = `<span style="color:#34d399;"><i class="fa-solid fa-check"></i> แนบภาพใบรับรองเรียบร้อยแล้ว (ผ่านการรับรอง)</span>`;
          }
        }
      } else {
        state.newDriverCert.image = '';
        state.newDriverCert.status = 'รอดำเนินการ';
        if (previewNewDriverCert) previewNewDriverCert.style.display = 'none';
        if (newDriverCertStatus) newDriverCertStatus.textContent = 'สถานะ: ยังไม่ได้แนบภาพใบรับรอง (รอดำเนินการ)';
      }
    });
  }

  // 4. Submit Driver Registration Form
  const driverRegForm = document.getElementById('driver-reg-form');
  if (driverRegForm) {
    driverRegForm.addEventListener('submit', (e) => {
      e.preventDefault();

      const name = (document.getElementById('new-driver-name')?.value || '').trim();
      const empId = (document.getElementById('new-driver-empid')?.value || '').trim();
      const company = (document.getElementById('new-driver-company')?.value || '').trim();
      const department = (document.getElementById('new-driver-dept')?.value || '').trim();
      const assignedPlate = (document.getElementById('new-driver-assigned-plate')?.value || '').trim();
      const notes = (document.getElementById('new-driver-notes')?.value || '').trim();

      if (!name) {
        showToast('กรุณาระบุชื่อ-นามสกุล ผู้ขับขี่', 'error');
        document.getElementById('new-driver-name')?.focus();
        return;
      }
      if (!empId) {
        showToast('กรุณาระบุรหัสพนักงาน', 'error');
        document.getElementById('new-driver-empid')?.focus();
        return;
      }
      if (!company) {
        showToast('กรุณาระบุสังกัด (บริษัท/ซัพพลายเออร์)', 'error');
        document.getElementById('new-driver-company')?.focus();
        return;
      }
      if (!department || department === '---กรุณาระบุ---') {
        showToast('กรุณาระบุแผนกที่ปฏิบัติงาน', 'error');
        document.getElementById('new-driver-dept')?.focus();
        return;
      }

      if (window.forkliftStore.isDriverEmpIdDuplicate(empId)) {
        showToast(`รหัสพนักงาน "${empId}" มีอยู่ในระบบแล้ว กรุณาตรวจสอบ`, 'error');
        if (newDriverEmpIdAlert) newDriverEmpIdAlert.style.display = 'block';
        document.getElementById('new-driver-empid')?.focus();
        return;
      }

      const newDriver = {
        name,
        empId,
        company,
        department,
        assignedPlate,
        notes,
        photo: state.newDriverPhoto,
        certImage: state.newDriverCert.image,
        certStatus: state.newDriverCert.status || 'รอดำเนินการ',
        hasTrained: state.newDriverCert.status === 'ผ่านการรับรอง'
      };

      try {
        window.forkliftStore.addDriver(newDriver);
        showToast(`ลงทะเบียนผู้ขับขี่ "${name}" (${empId}) สำเร็จเรียบร้อย!`, 'success');

        // Reset form
        driverRegForm.reset();
        state.newDriverPhoto = '';
        state.newDriverCert = { image: '', status: 'รอดำเนินการ' };
        if (inputNewDriverPhoto) inputNewDriverPhoto.value = '';
        if (previewNewDriverPhoto) {
          previewNewDriverPhoto.src = '';
          previewNewDriverPhoto.style.display = 'none';
        }
        if (boxNewDriverPhoto) {
          const content = boxNewDriverPhoto.querySelector('.photo-box-content');
          if (content) content.style.display = 'flex';
          boxNewDriverPhoto.classList.remove('has-image');
        }
        if (inputNewDriverCert) inputNewDriverCert.value = '';
        if (previewNewDriverCert) {
          previewNewDriverCert.src = '';
          previewNewDriverCert.style.display = 'none';
        }
        if (newDriverCertStatus) {
          newDriverCertStatus.textContent = 'สถานะ: ยังไม่ได้แนบภาพใบรับรอง (รอดำเนินการ)';
        }
        if (newDriverEmpIdAlert) newDriverEmpIdAlert.style.display = 'none';

        // Refresh select options across app
        populateDriverSelectOptions();
        populateForkliftSelectOptions();

        // Switch to Dashboard and show Drivers view immediately
        state.dashView = 'drivers';
        switchTab('dashboard-tab');
        setDashView('drivers');
      } catch (err) {
        showToast(err.message, 'error');
      }
    });
  }

  // --------------------------------------------------------------------------
  // Submit Registration Form
  // --------------------------------------------------------------------------
  regForm.addEventListener('submit', (e) => {
    e.preventDefault();

    // 1. Validate Frame No. (หมายเลขตัวถัง - เงื่อนไขห้ามซ้ำกัน)
    const frameNo = regFrameNoInput ? regFrameNoInput.value.trim().toUpperCase() : '';
    if (!frameNo) {
      showToast('กรุณาระบุหมายเลขตัวถัง (Frame No. / Chassis No.)', 'error');
      regFrameNoInput?.focus();
      return;
    }
    if (window.forkliftStore.isFrameNoDuplicate(frameNo)) {
      showToast(`หมายเลขตัวถัง (Frame No.) "${frameNo}" มีอยู่ในระบบแล้ว ไม่สามารถลงทะเบียนซ้ำได้`, 'error');
      if (duplicateFrameAlert) {
        duplicateFrameAlert.classList.add('show');
        if (duplicateFrameMsg) {
          duplicateFrameMsg.innerHTML = `หมายเลขตัวถัง <strong>"${frameNo}"</strong> เคยลงทะเบียนแล้วในระบบ จะไม่สามารถลงซ้ำได้`;
        }
      }
      regFrameNoInput?.focus();
      return;
    }

    // 2. Determine Ownership Type & Validate Plate No.
    const isSub = regOwnerType ? (regOwnerType.value === 'rental') : false;
    let plateNumber = regPlateInput.value.trim().toUpperCase();
    if (isSub && !plateNumber) {
      plateNumber = window.forkliftStore.getNextRentalPlateNumber();
      regPlateInput.value = plateNumber;
    }

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

    const vehicleTypeEl = document.getElementById('reg-type');
    const vehicleType = vehicleTypeEl ? vehicleTypeEl.value : 'Warehouse Forklift';

    const energyTypeEl = document.getElementById('reg-energy');
    const energyType = energyTypeEl ? energyTypeEl.value : 'ไฟฟ้า';

    const capacityEl = document.getElementById('reg-capacity');
    const liftingCapacity = (capacityEl && capacityEl.value && capacityEl.value !== 'กรุณาระบุ') 
      ? capacityEl.value 
      : '1.5 ตัน';

    const ownerCompanyEl = document.getElementById('reg-owner-company');
    const ownerCompanyVal = ownerCompanyEl ? ownerCompanyEl.value.trim() : '';

    // Validate rental specific fields
    let contractExpiryDate = null;
    if (isSub) {
      if (!ownerCompanyVal) {
        showToast('กรุณาระบุชื่อบริษัทที่เช่า (Rental Supplier)', 'error');
        ownerCompanyEl?.focus();
        return;
      }
      contractExpiryDate = regContractExpiry ? regContractExpiry.value : '';
      if (!contractExpiryDate) {
        showToast('กรุณาระบุวันหมดสัญญาเช่าสำหรับรถเช่า', 'error');
        regContractExpiry?.focus();
        return;
      }
    }

    const ownerCompany = isSub
      ? ownerCompanyVal
      : 'Haier Electric (Thailand) Company Limited';

    const subcontractor = isSub
      ? ownerCompanyVal
      : 'Haier Owned';

    const inspectDateEl = document.getElementById('reg-inspect-date');
    const inspectionDate = (inspectDateEl && inspectDateEl.value) 
      ? inspectDateEl.value 
      : new Date().toISOString().split('T')[0];

    const statusRadio = document.querySelector('input[name="reg-status"]:checked');
    const status = statusRadio ? statusRadio.value : 'พร้อมใช้งาน';

    // ดึงข้อมูลผู้ขับขี่จาก "ทะเบียนผู้ขับขี่" ที่เลือกไว้
    const driverSelectEl = document.getElementById('reg-select-driver');
    const selectedDriverId = driverSelectEl ? driverSelectEl.value : '';
    let driverObj = {
      name: 'ยังไม่ระบุ',
      empId: '-',
      company: ownerCompany,
      department: '-',
      photo: '',
      hasTrained: false,
      certImage: '',
      certStatus: 'รอดำเนินการ'
    };

    if (selectedDriverId) {
      const foundDriver = window.forkliftStore.getDriverById(selectedDriverId);
      if (foundDriver) {
        driverObj = {
          driverId: foundDriver.id,
          name: foundDriver.name,
          empId: foundDriver.empId,
          company: foundDriver.company || ownerCompany,
          department: foundDriver.department || '-',
          photo: foundDriver.photo || '',
          hasTrained: Boolean(foundDriver.hasTrained),
          certImage: foundDriver.certImage || '',
          certStatus: foundDriver.certStatus || 'รอดำเนินการ'
        };
        // ผูกทะเบียนรถเข้ากับข้อมูลผู้ขับขี่ในทะเบียนผู้ขับ
        window.forkliftStore.updateDriverData(foundDriver.id, { assignedPlate: plateNumber });
      }
    }

    const notesEl = document.getElementById('reg-notes');
    const notes = notesEl ? notesEl.value.trim() : '';

    const newForklift = {
      plateNumber,
      frameNo,
      vehicleType,
      energyType,
      liftingCapacity,
      ownerCompany,
      subcontractor,
      isSubcontractor: isSub,
      contractExpiryDate: isSub ? contractExpiryDate : null,
      registrationDate: new Date().toISOString().split('T')[0],
      lastInspectionDate: inspectionDate,
      status,
      photos: { ...state.regPhotos },
      checklist: { ...state.regChecklist },
      driver: driverObj,
      notes
    };

    try {
      window.forkliftStore.addForklift(newForklift);
      showToast(`ขึ้นทะเบียนรถโฟล์คลิฟท์ "${plateNumber}" (${isSub ? 'รถเช่า' : 'รถบริษัท'}) สำเร็จเรียบร้อย!`, 'success');
      
      // Reset Form
      regForm.reset();
      regPlateInput.classList.remove('is-valid', 'is-invalid');
      duplicateAlert.classList.remove('show');
      if (regFrameNoInput) {
        regFrameNoInput.classList.remove('is-valid', 'is-invalid');
      }
      if (duplicateFrameAlert) {
        duplicateFrameAlert.classList.remove('show');
      }
      setOwnershipType('company');
      const inspectDateElPost = document.getElementById('reg-inspect-date');
      if (inspectDateElPost) {
        inspectDateElPost.value = new Date().toISOString().split('T')[0];
      }
      resetVehiclePhoto();

      // Reset selected driver & preview
      const selectDriverPost = document.getElementById('reg-select-driver');
      if (selectDriverPost) selectDriverPost.value = '';
      const driverPrevCard = document.getElementById('reg-driver-preview-card');
      if (driverPrevCard) driverPrevCard.style.display = 'none';

      // Reset checklist state to defaults, then re-init energy-specific row
      state.regChecklist = {
        forks: true,
        brakes: true,
        hydraulics: true,
        tires: true,
        lightsHorn: true,
        seatbeltGuard: true
      };
      // Re-render item 7 and restore common rows to ปกติ visually
      updateChecklistForEnergy(regEnergySelect.value);
      document.querySelectorAll('.check-item-row').forEach(row => {
        const passBtn = row.querySelector('.btn-pass');
        const failBtn = row.querySelector('.btn-fail');
        if (passBtn) passBtn.classList.add('active');
        if (failBtn) failBtn.classList.remove('active');
      });


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
            : (item.status === 'ส่งซ่อม'
                ? '<span class="status-badge badge-repair" style="font-size:0.9rem;"><i class="fa-solid fa-triangle-exclamation"></i> ส่งซ่อม</span>'
                : '<span class="status-badge badge-expired" style="font-size:0.9rem;"><i class="fa-solid fa-truck-arrow-right"></i> หมดสัญญาเช่า / ส่งคืนแล้ว</span>')
          }
        </div>
      </div>

      <!-- Specs Card -->
      <div class="stat-card" style="margin-bottom:1.5rem;">
        <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--haier-cyan);"><i class="fa-solid fa-circle-info"></i> ข้อมูลจำเพาะของรถ</h4>
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:0.75rem; font-size:0.85rem;">
          <div><span style="color:var(--text-muted);">Frame No.:</span> <strong>${item.frameNo || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">ประเภทรถ:</span> <strong>${item.vehicleType}</strong></div>
          <div><span style="color:var(--text-muted);">ระบบพลังงาน:</span> <strong>${item.energyType}</strong></div>
          <div><span style="color:var(--text-muted);">ความสามารถยก:</span> <strong>${item.liftingCapacity || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">เจ้าของรถ:</span> <strong>${item.ownerCompany}</strong></div>
          <div><span style="color:var(--text-muted);">ซัพพลายเออร์:</span> <strong>${item.subcontractor || (item.isSubcontractor ? 'รถเช่า' : 'Haier Owned')}</strong></div>
          ${item.isSubcontractor ? `<div><span style="color:var(--text-muted);">วันหมดสัญญาเช่า:</span> <strong>${item.contractExpiryDate || '-'}</strong></div>` : ''}
          <div><span style="color:var(--text-muted);">วันที่ขึ้นทะเบียน:</span> <strong>${item.registrationDate || '-'}</strong></div>
          <div><span style="color:var(--text-muted);">ตรวจสภาพล่าสุด:</span> <strong>${item.lastInspectionDate || '-'}</strong></div>
        </div>

        ${lpgStatus.isLpg ? `
          <div style="margin-top:1rem; padding:0.75rem; background:rgba(245, 158, 11, 0.1); border-left:3px solid #fbbf24; border-radius:4px;">
            <strong><i class="fa-solid fa-fire"></i> ข้อมูลตรวจเช็คก๊าซ LPG ประจำปี:</strong>
            <div style="font-size:0.82rem; margin-top:2px;">${lpgStatus.text} (ครบกำหนดรอบถัดไป: ${lpgStatus.dueDateStr || '-'})</div>
          </div>
        ` : ''}

        ${item.isSubcontractor && item.contractExpiryDate ? `
          <div style="margin-top:1rem; padding:0.75rem; background:rgba(56, 189, 248, 0.1); border-left:3px solid #38bdf8; border-radius:4px;">
            <strong><i class="fa-solid fa-file-contract"></i> สัญญาเช่ารถ (Rental Contract):</strong>
            <div style="font-size:0.82rem; margin-top:2px;">
              วันหมดสัญญา: <strong>${item.contractExpiryDate}</strong>
              ${(() => {
                const cs = window.forkliftStore.getRentalContractStatus(item);
                if (cs.alertLevel === 'expired') {
                  return ` &nbsp;<span class="status-badge badge-repair" style="font-size:0.75rem;"><i class="fa-solid fa-triangle-exclamation"></i> หมดสัญญาแล้ว (${cs.overdueDays} วัน)</span>`;
                } else if (cs.alertLevel === 'warning') {
                  return ` &nbsp;<span class="status-badge badge-lpg-warn" style="font-size:0.75rem;"><i class="fa-solid fa-clock"></i> เหลือสัญญาอีก ${cs.daysRemaining} วัน (แจ้งเตือนล่วงหน้า 1 เดือน)</span>`;
                }
                return ` &nbsp;<span class="status-badge badge-ready" style="font-size:0.75rem;"><i class="fa-solid fa-check"></i> ปกติ (เหลืออีก ${cs.daysRemaining} วัน)</span>`;
              })()}
            </div>
          </div>
        ` : ''}
      </div>

      <!-- Vehicle Photo (1 รูป) -->
      <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--haier-cyan);"><i class="fa-solid fa-camera"></i> ภาพถ่ายสภาพรถ Forklift</h4>
      <div style="background:var(--haier-navy-darker); border-radius:8px; overflow:hidden; border:1px solid var(--surface-border); text-align:center; max-width:440px; margin-bottom:1.5rem;">
        <img src="${photos.vehicle || photos.front || photos.side || photos.fullFront || window.SVG_ASSETS.forkliftFront}" style="width:100%; max-height:240px; object-fit:cover;">
        <div style="padding:0.45rem; font-size:0.8rem; font-weight:600; color:var(--text-secondary);">ภาพถ่ายสภาพตัวรถ Forklift</div>
      </div>

      <!-- Driver & Certificate -->
      <h4 style="font-size:0.95rem; margin-bottom:0.75rem; color:var(--haier-cyan);"><i class="fa-solid fa-user-shield"></i> ข้อมูลผู้ขับขี่และใบรับรองความปลอดภัย</h4>
      <div style="background:var(--haier-navy-darker); border:1px solid var(--surface-border); border-radius:8px; padding:1.25rem; display:grid; grid-template-columns:1fr 1fr; gap:1.25rem;">
        <div>
          <div style="display:flex; align-items:center; gap:0.75rem; margin-bottom:0.6rem;">
            ${driver.photo
              ? `<img src="${driver.photo}" style="width:50px; height:50px; border-radius:50%; object-fit:cover; border:2px solid var(--haier-cyan); flex-shrink:0;">`
              : `<div style="width:50px; height:50px; border-radius:50%; background:rgba(0,160,233,0.15); display:flex; align-items:center; justify-content:center; color:var(--haier-cyan); font-size:1.4rem; flex-shrink:0;"><i class="fa-solid fa-user"></i></div>`
            }
            <div>
              <div style="font-size:1.05rem; font-weight:700; color:#fff;"><i class="fa-solid fa-id-card"></i> ${driver.name || 'ยังไม่ระบุ'}</div>
              <div style="font-size:0.8rem; color:var(--text-secondary); margin-top:0.15rem;">รหัสพนักงาน: <strong>${driver.empId || '-'}</strong></div>
            </div>
          </div>
          <div style="font-size:0.85rem; color:var(--text-secondary);">สังกัด: <strong>${driver.company || '-'}</strong></div>
          <div style="font-size:0.85rem; color:var(--text-secondary);">แผนก: <strong>${driver.department || '-'}</strong></div>
          
          <div style="margin-top:0.85rem;">
            <div style="font-size:0.8rem; color:var(--text-muted); margin-bottom:0.25rem;">สถานะใบรับรองการอบรม:</div>
            ${driver.certStatus === 'ผ่านการรับรอง'
              ? '<span class="status-badge badge-cert-valid"><i class="fa-solid fa-award"></i> ผ่านการอบรม</span>'
              : (driver.certStatus === 'ไม่ถูกต้อง'
                  ? '<span class="status-badge badge-repair"><i class="fa-solid fa-xmark"></i> ไม่ถูกต้อง</span>'
                  : '<span class="status-badge badge-cert-pending"><i class="fa-solid fa-hourglass-half"></i> รอดำเนินการ (ไม่มีภาพแนบ)</span>')
            }
          </div>
        </div>

        <div style="text-align:center;">
          ${driver.certImage
            ? `<a href="${driver.certImage}" target="_blank" title="คลิกเพื่อดูภาพขยายเต็มจอ">
                 <img src="${driver.certImage}" style="width:100%; max-height:160px; object-fit:contain; border-radius:6px; border:1px solid var(--surface-border); transition:transform 0.2s ease;">
               </a>
               <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> คลิกดูภาพขยาย</div>`
            : `<div style="height:140px; display:flex; align-items:center; justify-content:center; background:rgba(0,0,0,0.2); border:1px dashed var(--surface-border); border-radius:6px; color:var(--text-muted); font-size:0.82rem;">ไม่มีภาพแนบใบรับรอง (รอดำเนินการ)</div>`
          }
        </div>
      </div>
    `;

    const deleteBtn = document.getElementById('btn-view-modal-delete');
    if (deleteBtn) {
      deleteBtn.style.display = state.isAdmin ? 'inline-flex' : 'none';
      deleteBtn.onclick = function() {
        window.deleteForkliftItem(item.id, item.plateNumber, true);
      };
    }

    openModal(modalView);
  };

  // --------------------------------------------------------------------------
  // Driver Details & Management Modals
  // --------------------------------------------------------------------------
  const modalViewDriverDetails = document.getElementById('modal-view-driver-details');
  const viewDriverModalBody = document.getElementById('view-driver-modal-body');
  const btnViewDriverDelete = document.getElementById('btn-view-driver-delete');
  const btnViewDriverEdit = document.getElementById('btn-view-driver-edit');
  let selectedDriverIdForView = null;

  // View Driver Details Modal
  window.viewDriverDetails = function(driverId) {
    const driver = window.forkliftStore.getDriverById(driverId);
    if (!driver || !modalViewDriverDetails || !viewDriverModalBody) return;

    selectedDriverIdForView = driverId;

    const photoHtml = driver.photo
      ? `<img src="${driver.photo}" alt="${driver.name}" style="width:100px; height:100px; border-radius:50%; object-fit:cover; border:3px solid var(--haier-cyan); box-shadow:0 4px 14px rgba(0,0,0,0.4); margin:0 auto; display:block;">`
      : `<div style="width:100px; height:100px; border-radius:50%; background:rgba(0,160,233,0.1); border:2px dashed var(--haier-cyan); display:flex; align-items:center; justify-content:center; color:var(--haier-cyan); font-size:2.5rem; margin:0 auto;"><i class="fa-solid fa-user-tie"></i></div>`;

    const isCert = driver.certStatus === 'ผ่านการรับรอง';
    const certBadge = isCert
      ? `<span class="status-badge badge-ready"><i class="fa-solid fa-certificate"></i> ผ่านการรับรองความปลอดภัย</span>`
      : `<span class="status-badge badge-repair"><i class="fa-solid fa-hourglass-half"></i> รอดำเนินการ (รอใบเซอร์)</span>`;

    const certImageHtml = driver.certImage
      ? `<div style="margin-top:0.75rem; text-align:center;">
           <a href="${driver.certImage}" target="_blank" title="คลิกเพื่อดูภาพขยายเต็มจอ">
             <img src="${driver.certImage}" alt="Certificate" style="max-height:220px; max-width:100%; object-fit:contain; border-radius:6px; border:1px solid var(--surface-border); box-shadow:0 4px 10px rgba(0,0,0,0.3); transition:transform 0.2s ease;">
           </a>
           <div style="font-size:0.75rem; color:var(--text-muted); margin-top:0.35rem;"><i class="fa-solid fa-arrow-up-right-from-square"></i> คลิกที่รูปเพื่อดูภาพขนาดเต็ม</div>
         </div>`
      : `<div style="margin-top:0.5rem; font-size:0.8rem; color:var(--text-muted); text-align:center;"><i class="fa-solid fa-circle-info"></i> ยังไม่ได้แนบภาพถ่ายใบรับรอง</div>`;

    const assignedPlateHtml = driver.assignedPlate && driver.assignedPlate.trim() !== ''
      ? `<span class="plate-tag" style="cursor:pointer;" onclick="closeModal(modalViewDriverDetails); window.viewAssignedForklift('${driver.assignedPlate}');"><i class="fa-solid fa-truck-ramp-box"></i> ${driver.assignedPlate} (คลิกเพื่อดูรถ)</span>`
      : `<span style="color:var(--text-muted); font-size:0.85rem;">ยังไม่มอบหมายรถประจำ</span>`;

    viewDriverModalBody.innerHTML = `
      <div style="text-align:center; margin-bottom:1.25rem;">
        ${photoHtml}
        <h3 style="margin-top:0.75rem; font-size:1.2rem; color:var(--text-primary); font-weight:700;">${driver.name}</h3>
        <div style="display:inline-block; margin-top:0.25rem;"><span class="plate-tag">${driver.empId || '-'}</span></div>
      </div>

      <div class="stat-card" style="margin-bottom:1rem; padding:1rem;">
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; font-size:0.88rem;">
          <div><strong><i class="fa-solid fa-building" style="color:var(--haier-cyan);"></i> สังกัดบริษัท:</strong><br>${driver.company || '-'}</div>
          <div><strong><i class="fa-solid fa-sitemap" style="color:var(--haier-cyan);"></i> แผนก:</strong><br>${driver.department || '-'}</div>
          <div><strong><i class="fa-solid fa-truck-ramp-box" style="color:var(--haier-cyan);"></i> รถที่ขับประจำ:</strong><br>${assignedPlateHtml}</div>
          <div><strong><i class="fa-regular fa-calendar-check" style="color:var(--haier-cyan);"></i> วันที่ขึ้นทะเบียน:</strong><br>${driver.registrationDate ? new Date(driver.registrationDate).toLocaleDateString('th-TH') : '-'}</div>
        </div>
        ${driver.notes ? `<div style="margin-top:0.75rem; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.08); font-size:0.85rem; color:var(--text-secondary);"><strong>หมายเหตุ:</strong> ${driver.notes}</div>` : ''}
      </div>

      <div class="stat-card" style="padding:1rem;">
        <div style="display:flex; justify-content:space-between; align-items:center;">
          <div style="font-weight:600; font-size:0.9rem;"><i class="fa-solid fa-award" style="color:#fbbf24;"></i> ใบรับรองการฝึกอบรม (Safety Certificate)</div>
          ${certBadge}
        </div>
        ${certImageHtml}
      </div>
    `;

    openModal(modalViewDriverDetails);
  };

  if (btnViewDriverEdit) {
    btnViewDriverEdit.addEventListener('click', () => {
      if (selectedDriverIdForView) {
        closeModal(modalViewDriverDetails);
        window.openEditDriverDirect(selectedDriverIdForView);
      }
    });
  }

  if (btnViewDriverDelete) {
    btnViewDriverDelete.addEventListener('click', () => {
      if (selectedDriverIdForView) {
        const driver = window.forkliftStore.getDriverById(selectedDriverIdForView);
        const name = driver ? driver.name : 'ผู้ขับขี่';
        closeModal(modalViewDriverDetails);
        window.deleteDriverItem(selectedDriverIdForView, name);
      }
    });
  }

  // Quick navigation from driver table/modal to assigned forklift details
  window.viewAssignedForklift = function(plateNumber) {
    const forklifts = window.forkliftStore.getAll();
    const fl = forklifts.find(f => f.plateNumber === plateNumber);
    if (fl) {
      setDashView('fleet');
      window.viewForkliftDetails(fl.id);
    } else {
      showToast(`ไม่พบข้อมูลรถทะเบียน ${plateNumber} ในระบบ`, 'info');
    }
  };

  // Delete Driver action
  window.deleteDriverItem = function(driverId, driverName) {
    if (confirm(`คุณต้องการลบข้อมูลผู้ขับขี่ "${driverName}" ออกจากระบบทะเบียนผู้ขับหรือไม่?`)) {
      try {
        window.forkliftStore.deleteDriver(driverId);
        showToast(`ลบข้อมูลผู้ขับขี่ "${driverName}" เรียบร้อยแล้ว`, 'success');
        renderDashboard();
        renderDriverTable();
        populateDriverSelectOptions();
        populateForkliftSelectOptions();
        if (state.isAdmin) renderAdminPanel();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

  // Open Edit Driver modal directly from Driver Registry table
  window.openEditDriverDirect = function(driverId) {
    const driver = window.forkliftStore.getDriverById(driverId);
    if (!driver) return;

    populateForkliftSelectOptions();

    const titleEl = document.getElementById('modal-edit-driver-title');
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-user-pen"></i> แก้ไขข้อมูลผู้ขับขี่';

    document.getElementById('edit-driver-id').value = driver.id;
    const modeEl = document.getElementById('edit-driver-mode');
    if (modeEl) modeEl.value = 'registry';

    const plateBox = document.getElementById('edit-driver-forklift-box');
    if (plateBox) plateBox.style.display = 'none';

    // ซ่อนช่องเลือกดึงผู้ขับ (เพราะกำลังแก้ไขข้อมูลผู้ขับคนนี้โดยตรง)
    const driverSelectGroup = document.getElementById('edit-forklift-driver-select-group');
    if (driverSelectGroup) driverSelectGroup.style.display = 'none';

    const assignedGroup = document.getElementById('edit-driver-assigned-group');
    if (assignedGroup) assignedGroup.style.display = 'block';

    const assignedPlateSelect = document.getElementById('edit-driver-assigned-plate');
    if (assignedPlateSelect) assignedPlateSelect.value = driver.assignedPlate || '';

    document.getElementById('edit-driver-name').value = driver.name || '';
    document.getElementById('edit-driver-empid').value = driver.empId || '';
    document.getElementById('edit-driver-company').value = driver.company || '';
    document.getElementById('edit-driver-dept').value = driver.department || '';

    state.editDriverCert = {
      image: driver.certImage || '',
      status: driver.certStatus || 'รอดำเนินการ'
    };

    state.editDriverPhoto = driver.photo || '';
    const driverPhotoPrev = document.getElementById('edit-driver-photo-preview');
    const driverPhotoPh = document.getElementById('edit-driver-photo-placeholder');
    const btnRemoveEditPhoto = document.getElementById('btn-remove-edit-driver-photo');
    const inputEditPhoto = document.getElementById('edit-driver-photo-upload');
    if (inputEditPhoto) inputEditPhoto.value = '';

    if (driver.photo) {
      if (driverPhotoPrev) {
        driverPhotoPrev.src = driver.photo;
        driverPhotoPrev.style.display = 'block';
      }
      if (driverPhotoPh) driverPhotoPh.style.display = 'none';
      if (btnRemoveEditPhoto) btnRemoveEditPhoto.style.display = 'inline-block';
    } else {
      if (driverPhotoPrev) {
        driverPhotoPrev.src = '';
        driverPhotoPrev.style.display = 'none';
      }
      if (driverPhotoPh) driverPhotoPh.style.display = 'block';
      if (btnRemoveEditPhoto) btnRemoveEditPhoto.style.display = 'none';
    }

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

  // 2. Edit Driver Modal from Forklift Table (เลือกดึงข้อมูลผู้ขับจากทะเบียนผู้ขับขี่)
  window.openEditDriverModal = function(id) {
    const item = window.forkliftStore.getById(id);
    if (!item) return;

    state.selectedForklift = item;
    const driver = item.driver || {};

    const titleEl = document.getElementById('modal-edit-driver-title');
    if (titleEl) titleEl.innerHTML = '<i class="fa-solid fa-user-pen"></i> แก้ไขผู้ขับขี่ประจำรถ Forklift';

    const modeEl = document.getElementById('edit-driver-mode');
    if (modeEl) modeEl.value = 'forklift';

    const plateBox = document.getElementById('edit-driver-forklift-box');
    if (plateBox) plateBox.style.display = 'block';

    // แสดงช่องเลือกดึงข้อมูลผู้ขับขี่จากทะเบียน
    const driverSelectGroup = document.getElementById('edit-forklift-driver-select-group');
    if (driverSelectGroup) driverSelectGroup.style.display = 'block';

    const assignedGroup = document.getElementById('edit-driver-assigned-group');
    if (assignedGroup) assignedGroup.style.display = 'none';

    document.getElementById('edit-driver-forklift-plate').textContent = item.plateNumber;
    document.getElementById('edit-driver-id').value = item.id;
    document.getElementById('edit-driver-name').value = driver.name || '';
    document.getElementById('edit-driver-empid').value = driver.empId || '';
    document.getElementById('edit-driver-company').value = driver.company || item.ownerCompany;
    document.getElementById('edit-driver-dept').value = driver.department || '';

    // โหลดรายชื่อผู้ขับขี่จากทะเบียนลงใน Dropdown
    const driverSelect = document.getElementById('edit-forklift-driver-select');
    if (driverSelect && window.forkliftStore.getAllDrivers) {
      driverSelect.innerHTML = '<option value="">-- ไม่ระบุผู้ขับ (ยังไม่มีคนขับประจำ) --</option>';
      const allDrivers = window.forkliftStore.getAllDrivers();
      allDrivers.forEach(d => {
        const opt = document.createElement('option');
        opt.value = d.id;
        const currentPlate = d.assignedPlate ? ` [รถประจำ: ${d.assignedPlate}]` : '';
        opt.textContent = `${d.name} (${d.empId}) - ${d.company}${currentPlate}`;
        driverSelect.appendChild(opt);
      });

      // ค้นหาว่ารถคันนี้มีผู้ขับขี่ที่ตรงกับคนใดในทะเบียนหรือไม่
      const matched = allDrivers.find(d => 
        (driver.driverId && d.id === driver.driverId) ||
        (driver.empId && d.empId === driver.empId && driver.empId !== '-') ||
        (d.assignedPlate && d.assignedPlate === item.plateNumber)
      );

      if (matched) {
        driverSelect.value = matched.id;
      } else {
        driverSelect.value = '';
      }
    }

    state.editDriverCert = {
      image: driver.certImage || '',
      status: driver.certStatus || 'รอดำเนินการ'
    };

    state.editDriverPhoto = driver.photo || '';
    const driverPhotoPrev = document.getElementById('edit-driver-photo-preview');
    const driverPhotoPh = document.getElementById('edit-driver-photo-placeholder');
    const btnRemoveEditPhoto = document.getElementById('btn-remove-edit-driver-photo');
    const inputEditPhoto = document.getElementById('edit-driver-photo-upload');
    if (inputEditPhoto) inputEditPhoto.value = '';

    if (driver.photo) {
      if (driverPhotoPrev) {
        driverPhotoPrev.src = driver.photo;
        driverPhotoPrev.style.display = 'block';
      }
      if (driverPhotoPh) driverPhotoPh.style.display = 'none';
      if (btnRemoveEditPhoto) btnRemoveEditPhoto.style.display = 'inline-block';
    } else {
      if (driverPhotoPrev) {
        driverPhotoPrev.src = '';
        driverPhotoPrev.style.display = 'none';
      }
      if (driverPhotoPh) driverPhotoPh.style.display = 'block';
      if (btnRemoveEditPhoto) btnRemoveEditPhoto.style.display = 'none';
    }

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

  // Event Listener: เมื่อเลือกผู้ขับขี่จากทะเบียน ให้ดึงข้อมูลมาแสดงและอัปเดตฟอร์มอัตโนมัติ
  const editForkliftDriverSelect = document.getElementById('edit-forklift-driver-select');
  if (editForkliftDriverSelect) {
    editForkliftDriverSelect.addEventListener('change', () => {
      const selectedDriverId = editForkliftDriverSelect.value;
      const nameInput = document.getElementById('edit-driver-name');
      const empidInput = document.getElementById('edit-driver-empid');
      const compInput = document.getElementById('edit-driver-company');
      const deptInput = document.getElementById('edit-driver-dept');
      const driverPhotoPrev = document.getElementById('edit-driver-photo-preview');
      const driverPhotoPh = document.getElementById('edit-driver-photo-placeholder');
      const btnRemoveEditPhoto = document.getElementById('btn-remove-edit-driver-photo');
      const certPrev = document.getElementById('edit-cert-preview');
      const certStatusText = document.getElementById('edit-cert-status-text');

      if (selectedDriverId) {
        const d = window.forkliftStore.getDriverById(selectedDriverId);
        if (d) {
          if (nameInput) nameInput.value = d.name || '';
          if (empidInput) empidInput.value = d.empId || '';
          if (compInput) compInput.value = d.company || (state.selectedForklift?.ownerCompany || '');
          if (deptInput) deptInput.value = d.department || '';

          state.editDriverPhoto = d.photo || '';
          if (d.photo) {
            if (driverPhotoPrev) { driverPhotoPrev.src = d.photo; driverPhotoPrev.style.display = 'block'; }
            if (driverPhotoPh) driverPhotoPh.style.display = 'none';
            if (btnRemoveEditPhoto) btnRemoveEditPhoto.style.display = 'inline-block';
          } else {
            if (driverPhotoPrev) { driverPhotoPrev.src = ''; driverPhotoPrev.style.display = 'none'; }
            if (driverPhotoPh) driverPhotoPh.style.display = 'block';
            if (btnRemoveEditPhoto) btnRemoveEditPhoto.style.display = 'none';
          }

          state.editDriverCert = {
            image: d.certImage || '',
            status: d.certStatus || 'รอดำเนินการ'
          };
          if (d.certImage) {
            if (certPrev) { certPrev.src = d.certImage; certPrev.style.display = 'block'; }
          } else {
            if (certPrev) { certPrev.src = ''; certPrev.style.display = 'none'; }
          }
          if (certStatusText) certStatusText.textContent = `สถานะปัจจุบัน: ${state.editDriverCert.status}`;
        }
      } else {
        // Unassigned
        if (nameInput) nameInput.value = 'ยังไม่ระบุ';
        if (empidInput) empidInput.value = '-';
        if (compInput) compInput.value = state.selectedForklift ? state.selectedForklift.ownerCompany : '';
        if (deptInput) deptInput.value = '-';

        state.editDriverPhoto = '';
        if (driverPhotoPrev) { driverPhotoPrev.src = ''; driverPhotoPrev.style.display = 'none'; }
        if (driverPhotoPh) driverPhotoPh.style.display = 'block';
        if (btnRemoveEditPhoto) btnRemoveEditPhoto.style.display = 'none';

        state.editDriverCert = { image: '', status: 'รอดำเนินการ' };
        if (certPrev) { certPrev.src = ''; certPrev.style.display = 'none'; }
        if (certStatusText) certStatusText.textContent = 'สถานะ: ยังไม่ได้แนบภาพใบรับรอง (รอดำเนินการ)';
      }
    });
  }

  // Edit Driver: Handle driver photo upload & removal
  const editDriverPhotoUpload = document.getElementById('edit-driver-photo-upload');
  if (editDriverPhotoUpload) {
    editDriverPhotoUpload.addEventListener('change', async () => {
      const file = editDriverPhotoUpload.files[0];
      const preview = document.getElementById('edit-driver-photo-preview');
      const placeholder = document.getElementById('edit-driver-photo-placeholder');
      const btnRemove = document.getElementById('btn-remove-edit-driver-photo');
      if (file) {
        if (preview) {
          const reader = new FileReader();
          reader.onload = (e) => {
            preview.src = e.target.result;
            preview.style.display = 'block';
            if (placeholder) placeholder.style.display = 'none';
            if (btnRemove) btnRemove.style.display = 'inline-block';
          };
          reader.readAsDataURL(file);
        }
        const compressed = await compressImage(file, 600, 0.75);
        state.editDriverPhoto = compressed;
        if (preview) preview.src = compressed;
      }
    });
  }

  const btnRemoveEditPhoto = document.getElementById('btn-remove-edit-driver-photo');
  if (btnRemoveEditPhoto) {
    btnRemoveEditPhoto.addEventListener('click', () => {
      state.editDriverPhoto = '';
      const input = document.getElementById('edit-driver-photo-upload');
      if (input) input.value = '';
      const preview = document.getElementById('edit-driver-photo-preview');
      if (preview) {
        preview.src = '';
        preview.style.display = 'none';
      }
      const placeholder = document.getElementById('edit-driver-photo-placeholder');
      if (placeholder) placeholder.style.display = 'block';
      btnRemoveEditPhoto.style.display = 'none';
    });
  }

  // Edit Driver: Handle new certificate upload & AI verification
  document.getElementById('edit-cert-upload').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    const preview = document.getElementById('edit-cert-preview');
    const statusText = document.getElementById('edit-cert-status-text');
    const driverName = document.getElementById('edit-driver-name').value.trim();

    if (file) {
      if (statusText) statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบภาพ...`;
      if (preview) {
        const reader = new FileReader();
        reader.onload = (ev) => {
          preview.src = ev.target.result;
          preview.style.display = 'block';
        };
        reader.readAsDataURL(file);
      }
      const compressed = await compressImage(file, 900, 0.75);
      if (preview) {
        preview.src = compressed;
      }
      if (window.aiVerifier && typeof window.aiVerifier.verify === 'function') {
        const result = await window.aiVerifier.verify(compressed, { driverName });
        state.editDriverCert.image = compressed;
        state.editDriverCert.status = result.status;
        const color = result.status === 'ผ่านการรับรอง' ? '#34d399' : '#f87171';
        if (statusText) statusText.innerHTML = `ผลตรวจ: <strong style="color:${color};">${result.status}</strong> (${result.confidence}%)<br><span style="font-size:0.75rem; color:var(--text-secondary);">${result.details}</span>`;
      } else {
        state.editDriverCert.image = compressed;
        state.editDriverCert.status = 'ผ่านการรับรอง';
        if (statusText) statusText.innerHTML = `<span style="color:#34d399;"><i class="fa-solid fa-check"></i> แนบภาพใบรับรองเรียบร้อยแล้ว</span>`;
      }
    } else {
      state.editDriverCert.image = '';
      state.editDriverCert.status = 'รอดำเนินการ';
      if (preview) preview.style.display = 'none';
      if (statusText) statusText.textContent = 'สถานะ: รอดำเนินการ (ไม่มีภาพแนบ)';
    }
  });

  // Save Edit Driver Form
  document.getElementById('form-edit-driver').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = document.getElementById('edit-driver-id').value;
    const mode = (document.getElementById('edit-driver-mode')?.value || 'forklift');
    const name = document.getElementById('edit-driver-name').value.trim();
    const empId = document.getElementById('edit-driver-empid').value.trim();
    const company = document.getElementById('edit-driver-company').value.trim();
    const department = document.getElementById('edit-driver-dept').value.trim();
    const assignedPlate = (document.getElementById('edit-driver-assigned-plate')?.value || '').trim();

    try {
      if (mode === 'registry') {
        window.forkliftStore.updateDriverData(id, {
          name,
          empId,
          company,
          department,
          assignedPlate,
          photo: state.editDriverPhoto,
          certImage: state.editDriverCert.image,
          certStatus: state.editDriverCert.status,
          hasTrained: state.editDriverCert.status === 'ผ่านการรับรอง'
        });
        showToast('อัปเดตข้อมูลผู้ขับขี่ในทะเบียนสำเร็จแล้ว', 'success');
      } else {
        // Forklift driver assignment mode
        const forkliftItem = window.forkliftStore.getById(id);
        const plateNumber = forkliftItem ? forkliftItem.plateNumber : '';
        const selectedDriverId = document.getElementById('edit-forklift-driver-select')?.value;

        let driverData = {
          driverId: selectedDriverId || null,
          name,
          empId,
          company,
          department,
          photo: state.editDriverPhoto,
          certImage: state.editDriverCert.image,
          certStatus: state.editDriverCert.status,
          hasTrained: state.editDriverCert.status === 'ผ่านการรับรอง'
        };

        window.forkliftStore.updateDriver(id, driverData);

        // ปลดล็อครถคันนี้จากผู้ขับขี่คนเดิมในทะเบียน (ถ้ามี)
        const allDrivers = window.forkliftStore.getAllDrivers();
        allDrivers.forEach(d => {
          if (d.assignedPlate === plateNumber && d.id !== selectedDriverId) {
            window.forkliftStore.updateDriverData(d.id, { assignedPlate: '' });
          }
        });

        // หากเลือกผู้ขับจากทะเบียน ให้ผูกเลขทะเบียนรถนี้เข้ากับทะเบียนผู้ขับขี่ด้วย
        if (selectedDriverId) {
          window.forkliftStore.updateDriverData(selectedDriverId, { assignedPlate: plateNumber });
        }

        showToast(`อัปเดตผู้ขับขี่ประจำรถ "${plateNumber}" เรียบร้อยแล้ว`, 'success');
      }

      closeModal(modalEditDriver);
      renderDashboard();
      renderDriverTable();
      populateDriverSelectOptions();
      populateForkliftSelectOptions();
      if (state.currentTab === 'admin-tab') renderAdminPanel();
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
    if (lpgSection) {
      if (lpgStatus.isLpg) {
        lpgSection.style.display = 'block';
        document.getElementById('update-lpg-text').textContent = lpgStatus.text;
      } else {
        lpgSection.style.display = 'none';
      }
    }

    // Rental Contract Section & Expiry Date
    const rentalSection = document.getElementById('update-rental-alert-section');
    const rentalGroup = document.getElementById('update-rental-expiry-group');
    const rentalExpiryInput = document.getElementById('update-contract-expiry');
    const rentalText = document.getElementById('update-rental-text');

    if (item.isSubcontractor) {
      if (rentalGroup) rentalGroup.style.display = 'block';
      if (rentalExpiryInput) rentalExpiryInput.value = item.contractExpiryDate || '';
      const rentalStatus = window.forkliftStore.getRentalContractStatus(item);
      if (rentalSection && rentalText) {
        rentalSection.style.display = 'block';
        rentalText.innerHTML = `บริษัทผู้ให้เช่า: <strong>${item.ownerCompany || item.subcontractor}</strong> | ${rentalStatus.text}${rentalStatus.alertLevel === 'expired' && item.status !== 'หมดสัญญาเช่า' ? '<br><span style="color:#fca5a5; font-size:0.75rem;"><i class="fa-solid fa-circle-info"></i> สัญญาเช่าสิ้นสุดแล้ว สามารถเปลี่ยนสถานะด้านล่างเป็น "หมดสัญญาเช่า / ส่งคืนแล้ว" เพื่อแยกออกจากยอดรถพร้อมใช้งานในโรงงาน</span>' : ''}`;
      }
    } else {
      if (rentalGroup) rentalGroup.style.display = 'none';
      if (rentalSection) rentalSection.style.display = 'none';
      if (rentalExpiryInput) rentalExpiryInput.value = '';
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

    const item = window.forkliftStore.getById(id);
    let contractExpiryDate = undefined;
    if (item && item.isSubcontractor) {
      const expiryInput = document.getElementById('update-contract-expiry');
      if (expiryInput) {
        contractExpiryDate = expiryInput.value || null;
      }
    }

    try {
      window.forkliftStore.updateStatusAndInspection(id, {
        status,
        inspectionDate,
        notes,
        contractExpiryDate
      });

      showToast(`บันทึกการตรวจเช็คและอัปเดตข้อมูลรถเรียบร้อยแล้ว`, 'success');
      closeModal(modalUpdateStatus);
      renderDashboard();
      if (state.currentTab === 'admin-tab') renderAdminPanel();
      if (state.currentTab === 'alerts-tab') renderAlertsCenter();
    } catch (err) {
      showToast(err.message, 'error');
    }
  });

  // Quick Action: Set rental forklift to 'หมดสัญญาเช่า / ส่งคืนแล้ว'
  window.setForkliftExpiredStatus = function(id) {
    const item = window.forkliftStore.getById(id);
    if (!item) return;

    if (confirm(`คุณต้องการปรับสถานะรถโฟล์คลิฟท์ "${item.plateNumber}" เป็น "หมดสัญญาเช่า / ส่งคืนแล้ว" ใช่หรือไม่?\n\n* รถคันนี้จะถูกแยกออกจากยอดรถที่พร้อมใช้งานในโรงงานทันที`)) {
      try {
        window.forkliftStore.updateStatusAndInspection(id, {
          status: 'หมดสัญญาเช่า'
        });
        showToast(`ปรับสถานะรถ "${item.plateNumber}" เป็น "หมดสัญญาเช่า / ส่งคืนแล้ว" เรียบร้อย`, 'success');
        renderDashboard();
        if (state.currentTab === 'admin-tab') renderAdminPanel();
        if (state.currentTab === 'alerts-tab') renderAlertsCenter();
      } catch (err) {
        showToast(err.message, 'error');
      }
    }
  };

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

  // Close modals on Escape key
  window.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      document.querySelectorAll('.modal-backdrop').forEach(closeModal);
    }
  });

  // --------------------------------------------------------------------------
  // Delete Forklift Operations
  // --------------------------------------------------------------------------
  window.deleteForkliftItem = function(id, plateNumber, closeViewModal = false) {
    const item = window.forkliftStore.getById(id);
    const displayName = (item && item.plateNumber) ? item.plateNumber : (plateNumber || id);

    const msg = `คุณแน่ใจหรือไม่ว่าต้องการลบข้อมูลรถโฟล์คลิฟท์ทะเบียน "${displayName}" ออกจากระบบ?\n\n* ข้อมูลรถ, ภาพถ่าย 3 มุมมอง และประวัติการตรวจสภาพจะถูกลบอย่างถาวร`;
    if (confirm(msg)) {
      window.forkliftStore.deleteForklift(id);
      showToast(`ลบข้อมูลรถทะเบียน "${displayName}" เรียบร้อยแล้ว`, 'success');

      if (closeViewModal) {
        document.querySelectorAll('.modal-backdrop').forEach(closeModal);
      }

      renderDashboard();
      if (state.currentTab === 'admin-tab') {
        renderAdminPanel();
      }
      if (state.currentTab === 'alerts-tab') {
        renderAlertsCenter();
      }
    }
  };

  // Clear all fleet data button handler
  const btnClearAll = document.getElementById('btn-clear-all-data');
  if (btnClearAll) {
    btnClearAll.addEventListener('click', () => {
      const all = window.forkliftStore.getAll();
      if (all.length === 0) {
        showToast('ขณะนี้ไม่มีข้อมูลรถโฟล์คลิฟท์ในระบบ', 'info');
        return;
      }
      if (confirm(`คุณต้องการล้างข้อมูลรถโฟล์คลิฟท์ทั้งหมด (${all.length} คัน) ออกจากระบบหรือไม่?\n\n* ข้อมูลรถและประวัติทั้งหมดจะถูกลบถาวร ไม่สามารถย้อนกลับได้`)) {
        window.forkliftStore.clearAll();
        showToast('ล้างข้อมูลรถทั้งหมดในระบบเรียบร้อยแล้ว', 'success');
        renderDashboard();
        renderAdminPanel();
        if (state.currentTab === 'alerts-tab') {
          renderAlertsCenter();
        }
      }
    });
  }

  // Reset / Clear data button handler (backward compatibility)
  const btnResetData = document.getElementById('btn-reset-data');
  if (btnResetData) {
    btnResetData.addEventListener('click', () => {
      if (confirm('คุณต้องการล้างข้อมูลรถทั้งหมดในระบบหรือไม่?')) {
        window.forkliftStore.clearAll();
        showToast('ล้างข้อมูลระบบเรียบร้อยแล้ว', 'success');
        renderDashboard();
        renderAdminPanel();
        if (state.currentTab === 'alerts-tab') renderAlertsCenter();
      }
    });
  }

  // --------------------------------------------------------------------------
  // Admin Management Panel Controller
  // --------------------------------------------------------------------------
  function renderAdminPanel() {
    const loginView = document.getElementById('admin-login-view');
    const panelView = document.getElementById('admin-panel-view');
    if (!loginView || !panelView) return;

    if (state.isAdmin) {
      loginView.style.display = 'none';
      panelView.style.display = 'block';
      const adminUserNameEl = document.getElementById('admin-current-user-name');
      if (adminUserNameEl) {
        const u = state.adminUser;
        adminUserNameEl.textContent = u ? (u.full_name || u.username) : 'Admin';
      }

      // Update Counts
      const adminFleetCountEl = document.getElementById('admin-fleet-count');
      if (adminFleetCountEl) adminFleetCountEl.textContent = window.forkliftStore.getAll().length;
      const adminDriversCountEl = document.getElementById('admin-drivers-count');
      if (adminDriversCountEl && window.forkliftStore.getAllDrivers) {
        adminDriversCountEl.textContent = window.forkliftStore.getAllDrivers().length;
      }

      // Set current subview
      setAdminSubView(state.adminSubView || 'fleet');
      renderAdminTable();
      renderAdminDriverTable();
    } else {
      loginView.style.display = 'flex';
      panelView.style.display = 'none';
      const userInput = document.getElementById('admin-username');
      if (userInput) userInput.value = '';
      const pwInput = document.getElementById('admin-password');
      if (pwInput) pwInput.value = '';
      const errEl = document.getElementById('admin-login-error');
      if (errEl) errEl.style.display = 'none';
    }
  }

  // Admin Sub-view Switcher (จัดการรถ Forklift vs จัดการข้อมูลผู้ขับ)
  const btnAdminViewFleet = document.getElementById('btn-admin-view-fleet');
  const btnAdminViewDrivers = document.getElementById('btn-admin-view-drivers');
  const adminFleetContainer = document.getElementById('admin-fleet-view-container');
  const adminDriverContainer = document.getElementById('admin-driver-view-container');

  function setAdminSubView(subview) {
    state.adminSubView = subview;
    if (subview === 'fleet') {
      if (btnAdminViewFleet) {
        btnAdminViewFleet.classList.add('active', 'btn-primary');
        btnAdminViewFleet.classList.remove('btn-secondary');
      }
      if (btnAdminViewDrivers) {
        btnAdminViewDrivers.classList.remove('active', 'btn-primary');
        btnAdminViewDrivers.classList.add('btn-secondary');
      }
      if (adminFleetContainer) adminFleetContainer.style.display = 'block';
      if (adminDriverContainer) adminDriverContainer.style.display = 'none';
      renderAdminTable();
    } else {
      if (btnAdminViewDrivers) {
        btnAdminViewDrivers.classList.add('active', 'btn-primary');
        btnAdminViewDrivers.classList.remove('btn-secondary');
      }
      if (btnAdminViewFleet) {
        btnAdminViewFleet.classList.remove('active', 'btn-primary');
        btnAdminViewFleet.classList.add('btn-secondary');
      }
      if (adminFleetContainer) adminFleetContainer.style.display = 'none';
      if (adminDriverContainer) adminDriverContainer.style.display = 'block';
      renderAdminDriverTable();
    }
  }

  if (btnAdminViewFleet) {
    btnAdminViewFleet.addEventListener('click', () => setAdminSubView('fleet'));
  }
  if (btnAdminViewDrivers) {
    btnAdminViewDrivers.addEventListener('click', () => setAdminSubView('drivers'));
  }

  function renderAdminTable() {
    const adminTableBody = document.getElementById('admin-table-body');
    if (!adminTableBody) return;

    const forklifts = window.forkliftStore.getAll();

    let filtered = forklifts.filter(item => {
      // Search matching across: plate, vehicleType, energyType, ownerCompany, subcontractor, driver
      if (state.adminSearchQuery) {
        const q = state.adminSearchQuery.toLowerCase();
        const matchPlate = (item.plateNumber || '').toLowerCase().includes(q);
        const matchType = (item.vehicleType || '').toLowerCase().includes(q);
        const matchEnergy = (item.energyType || '').toLowerCase().includes(q);
        const matchOwner = (item.ownerCompany || '').toLowerCase().includes(q) || (item.subcontractor || '').toLowerCase().includes(q);
        const matchDriver = (item.driver?.name || '').toLowerCase().includes(q);
        if (!matchPlate && !matchType && !matchEnergy && !matchOwner && !matchDriver) return false;
      }

      // Filter pills
      const adminRentalStatus = window.forkliftStore.getRentalContractStatus(item);
      const isAdminContractExpired = item.status === 'หมดสัญญาเช่า' || (item.isSubcontractor && adminRentalStatus.alertLevel === 'expired');

      if (state.adminFilter === 'all') return true;
      if (state.adminFilter === 'ready') return item.status === 'พร้อมใช้งาน' && !isAdminContractExpired;
      if (state.adminFilter === 'repair') return item.status === 'ส่งซ่อม' && !isAdminContractExpired;
      if (state.adminFilter === 'electric') return item.energyType === 'ไฟฟ้า' && !isAdminContractExpired;
      if (state.adminFilter === 'lpg') return item.energyType === 'LPG' && !isAdminContractExpired;
      if (state.adminFilter === 'diesel') return item.energyType === 'ดีเซล' && !isAdminContractExpired;
      if (state.adminFilter === 'haier') return !item.isSubcontractor && !isAdminContractExpired;
      if (state.adminFilter === 'subcontractor') return item.isSubcontractor && !isAdminContractExpired;
      if (state.adminFilter === 'incomplete') {
        return window.forkliftStore.getIncompleteIssues(item).length > 0;
      }
      if (state.adminFilter === 'contract-expired') {
        return isAdminContractExpired || (item.isSubcontractor && adminRentalStatus.alertLevel === 'warning');
      }
      return true;
    });

    adminTableBody.innerHTML = '';
    if (filtered.length === 0) {
      if (forklifts.length === 0) {
        adminTableBody.innerHTML = `
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
        adminTableBody.innerHTML = `
          <tr>
            <td colspan="7" style="text-align:center; padding: 3rem 1rem; color: var(--text-muted);">
              <i class="fa-solid fa-magnifying-glass" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--surface-border);"></i>
              <p>ไม่พบข้อมูลรถโฟล์คลิฟท์ที่ตรงตามเงื่อนไขการค้นหาของ Admin</p>
            </td>
          </tr>
        `;
      }
      return;
    }

    filtered.forEach(item => {
      const tr = document.createElement('tr');

      const itemRentalStatus = window.forkliftStore.getRentalContractStatus(item);
      const isItemExpired = item.status === 'หมดสัญญาเช่า' || (item.isSubcontractor && itemRentalStatus.alertLevel === 'expired');

      let statusBadge = '';
      if (isItemExpired) {
        statusBadge = `<span class="status-badge badge-expired"><i class="fa-solid fa-truck-arrow-right"></i> หมดสัญญา / ส่งคืนแล้ว</span>`;
      } else if (item.status === 'พร้อมใช้งาน') {
        statusBadge = `<span class="status-badge badge-ready"><i class="fa-solid fa-circle-check"></i> พร้อมใช้งาน</span>`;
      } else if (item.status === 'ส่งซ่อม') {
        statusBadge = `<span class="status-badge badge-repair"><i class="fa-solid fa-triangle-exclamation"></i> ส่งซ่อม</span>`;
      } else {
        statusBadge = `<span class="status-badge badge-expired">${item.status}</span>`;
      }

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

      const driver = item.driver || { name: 'ยังไม่ระบุ', empId: '-', certStatus: 'รอดำเนินการ' };
      let certBadge = '';
      if (driver.certStatus === 'ผ่านการรับรอง') {
        certBadge = `<span class="status-badge badge-cert-valid"><i class="fa-solid fa-award"></i> ผ่านการรับรอง (AI Verified)</span>`;
      } else if (driver.certStatus === 'ไม่ถูกต้อง') {
        certBadge = `<span class="status-badge badge-repair"><i class="fa-solid fa-circle-xmark"></i> ใบเซอร์ไม่ถูกต้อง</span>`;
      } else {
        certBadge = `<span class="status-badge badge-cert-pending"><i class="fa-solid fa-hourglass-half"></i> รอดำเนินการ</span>`;
      }

      const issues = window.forkliftStore.getIncompleteIssues(item);
      const incompleteBadge = issues.length > 0
        ? `<div style="margin-top:0.25rem;"><span class="status-badge badge-repair" style="font-size:0.7rem;"><i class="fa-solid fa-circle-dot"></i> ข้อมูลไม่ครบ (${issues.length})</span></div>`
        : '';

      tr.innerHTML = `
        <td>
          <span class="plate-tag"><i class="fa-solid fa-truck-ramp-box"></i> ${item.plateNumber}</span>
          ${item.frameNo ? `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:2px;">Frame: <code>${item.frameNo}</code></div>` : ''}
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
            <i class="fa-solid fa-building"></i> ${item.subcontractor || (item.isSubcontractor ? 'รถเช่า' : 'Haier Owned')}
          </div>
          ${item.isSubcontractor && item.contractExpiryDate ? `
            <div style="font-size:0.72rem; color:#38bdf8; margin-top:2px;">
              <i class="fa-solid fa-calendar-xmark"></i> หมดสัญญา: ${item.contractExpiryDate}
            </div>
          ` : ''}
        </td>
        <td>
          <div class="driver-info-cell" style="display:flex; align-items:center; gap:0.65rem;">
            ${driver.photo
              ? `<img src="${driver.photo}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:2px solid var(--haier-cyan); flex-shrink:0;">`
              : `<div style="width:38px; height:38px; border-radius:50%; background:rgba(0,160,233,0.15); display:flex; align-items:center; justify-content:center; color:var(--haier-cyan); font-size:1rem; flex-shrink:0;"><i class="fa-solid fa-user"></i></div>`
            }
            <div>
              <div class="driver-name">${driver.name || 'ยังไม่ระบุ'}</div>
              <div class="driver-sub">รหัส: ${driver.empId || '-'} | ${driver.department || '-'}</div>
              <div style="margin-top:0.25rem; display:flex; align-items:center; gap:0.4rem; flex-wrap:wrap;">
                ${certBadge}
                ${driver.certImage ? `<img src="${driver.certImage}" alt="ใบรับรอง" style="width:28px; height:20px; object-fit:cover; border-radius:3px; border:1px solid rgba(255,255,255,0.3); cursor:pointer;" onclick="event.stopPropagation(); window.viewForkliftDetails('${item.id}')" title="คลิกดูใบรับรองในรายละเอียดรถ">` : ''}
              </div>
            </div>
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
            <button class="btn btn-danger btn-sm" onclick="window.deleteForkliftItem('${item.id}', '${item.plateNumber}')" title="ลบข้อมูลรถคันนี้">
              <i class="fa-solid fa-trash-can"></i> ลบ
            </button>
          </div>
        </td>
      `;

      adminTableBody.appendChild(tr);
    });
  }

  // Admin Login Event Handler (ตรวจสอบ User & Password ผ่าน Supabase admin_users)
  const formAdminLogin = document.getElementById('form-admin-login');
  const adminUsernameInput = document.getElementById('admin-username');
  const adminPasswordInput = document.getElementById('admin-password');
  const btnToggleAdminPw = document.getElementById('btn-toggle-admin-pw');
  const iconTogglePw = document.getElementById('icon-toggle-pw');
  const adminLoginError = document.getElementById('admin-login-error');
  const btnAdminLogout = document.getElementById('btn-admin-logout');
  const btnAdminLoginSubmit = document.getElementById('btn-admin-login-submit');

  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = adminUsernameInput ? adminUsernameInput.value.trim() : '';
      const password = adminPasswordInput ? adminPasswordInput.value.trim() : '';

      if (!username || !password) {
        if (adminLoginError) {
          adminLoginError.style.display = 'block';
          adminLoginError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> กรุณากรอกทั้งชื่อผู้ใช้และรหัสผ่านให้ครบถ้วน';
        }
        return;
      }

      if (btnAdminLoginSubmit) {
        btnAdminLoginSubmit.disabled = true;
        btnAdminLoginSubmit.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบสิทธิ์...';
      }

      try {
        let authResult = null;
        if (window.supabaseService && typeof window.supabaseService.verifyAdminLogin === 'function') {
          authResult = await window.supabaseService.verifyAdminLogin(username, password);
        } else {
          // Fallback
          const isOk = username === 'admin' && (password === 'admin1234' || password === 'haier1234');
          authResult = isOk
            ? { success: true, user: { username: 'admin', full_name: 'ผู้ดูแลระบบหลัก' } }
            : { success: false, message: 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง' };
        }

        if (authResult && authResult.success) {
          state.isAdmin = true;
          state.adminUser = authResult.user;
          sessionStorage.setItem('haier_forklift_admin', 'true');
          sessionStorage.setItem('haier_forklift_admin_user', JSON.stringify(authResult.user));

          if (adminLoginError) adminLoginError.style.display = 'none';
          if (adminPasswordInput) adminPasswordInput.value = '';
          if (adminUsernameInput) adminUsernameInput.value = '';

          const displayName = authResult.user?.full_name || authResult.user?.username || 'Admin';
          showToast(`เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ${displayName}`, 'success');
          renderAdminPanel();
        } else {
          if (adminLoginError) {
            adminLoginError.style.display = 'block';
            adminLoginError.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> ${authResult?.message || 'ชื่อผู้ใช้งานหรือรหัสผ่านไม่ถูกต้อง'}`;
          }
          if (adminPasswordInput) {
            adminPasswordInput.select();
          }
        }
      } catch (err) {
        if (adminLoginError) {
          adminLoginError.style.display = 'block';
          adminLoginError.innerHTML = `<i class="fa-solid fa-circle-exclamation"></i> การเข้าสู่ระบบผิดพลาด: ${err.message}`;
        }
      } finally {
        if (btnAdminLoginSubmit) {
          btnAdminLoginSubmit.disabled = false;
          btnAdminLoginSubmit.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> เข้าสู่ระบบ Admin';
        }
      }
    });
  }

  // Password Visibility Toggle
  if (btnToggleAdminPw && adminPasswordInput && iconTogglePw) {
    btnToggleAdminPw.addEventListener('click', () => {
      const isPw = adminPasswordInput.type === 'password';
      adminPasswordInput.type = isPw ? 'text' : 'password';
      iconTogglePw.classList.toggle('fa-eye', !isPw);
      iconTogglePw.classList.toggle('fa-eye-slash', isPw);
    });
  }

  // Admin Logout Event Handler
  if (btnAdminLogout) {
    btnAdminLogout.addEventListener('click', () => {
      if (confirm('คุณต้องการออกจากระบบโหมดผู้ดูแลระบบ (Admin) หรือไม่?')) {
        state.isAdmin = false;
        state.adminUser = null;
        sessionStorage.removeItem('haier_forklift_admin');
        sessionStorage.removeItem('haier_forklift_admin_user');
        showToast('ออกจากระบบ Admin เรียบร้อยแล้ว', 'info');
        renderAdminPanel();
      }
    });
  }

  // Admin Clear All Data Handler
  const btnAdminClearData = document.getElementById('btn-admin-clear-data');
  if (btnAdminClearData) {
    btnAdminClearData.addEventListener('click', () => {
      const all = window.forkliftStore.getAll();
      if (all.length === 0) {
        showToast('ขณะนี้ไม่มีข้อมูลรถโฟล์คลิฟท์ในระบบ', 'info');
        return;
      }
      if (confirm(`คุณต้องการล้างข้อมูลรถโฟล์คลิฟท์ทั้งหมด (${all.length} คัน) ออกจากระบบหรือไม่?\n\n* ข้อมูลรถและประวัติทั้งหมดจะถูกลบถาวร ไม่สามารถย้อนกลับได้`)) {
        window.forkliftStore.clearAll();
        showToast('ล้างข้อมูลรถทั้งหมดในระบบเรียบร้อยแล้ว', 'success');
        renderDashboard();
        renderAdminPanel();
        if (state.currentTab === 'alerts-tab') {
          renderAlertsCenter();
        }
      }
    });
  }

  // Admin Search Input Event
  const adminSearchInput = document.getElementById('admin-search-input');
  if (adminSearchInput) {
    adminSearchInput.addEventListener('input', (e) => {
      state.adminSearchQuery = e.target.value.trim();
      renderAdminTable();
    });
  }

  // Admin Filter Pills Event
  const adminFilterPills = document.querySelectorAll('[data-admin-filter]');
  adminFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      adminFilterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.adminFilter = pill.dataset.adminFilter;
      renderAdminTable();
    });
  });

  // Admin Driver Search Input Event
  const adminDriverSearchInput = document.getElementById('admin-driver-search-input');
  if (adminDriverSearchInput) {
    adminDriverSearchInput.addEventListener('input', (e) => {
      state.adminDriverSearchQuery = e.target.value.trim();
      renderAdminDriverTable();
    });
  }

  // Admin Driver Filter Pills Event
  const adminDriverFilterPills = document.querySelectorAll('[data-admin-driver-filter]');
  adminDriverFilterPills.forEach(pill => {
    pill.addEventListener('click', () => {
      adminDriverFilterPills.forEach(p => p.classList.remove('active'));
      pill.classList.add('active');
      state.adminDriverFilter = pill.dataset.adminDriverFilter;
      renderAdminDriverTable();
    });
  });

  // --------------------------------------------------------------------------
  // Admin Driver Management Table Rendering
  // --------------------------------------------------------------------------
  function renderAdminDriverTable() {
    const adminDriverTableBody = document.getElementById('admin-driver-table-body');
    if (!adminDriverTableBody) return;
    if (!window.forkliftStore || typeof window.forkliftStore.getAllDrivers !== 'function') return;

    let drivers = window.forkliftStore.getAllDrivers();

    const adminDriversCount = document.getElementById('admin-drivers-count');
    if (adminDriversCount) adminDriversCount.textContent = drivers.length;

    // Filter pills
    if (state.adminDriverFilter === 'certified') {
      drivers = drivers.filter(d => d.certStatus === 'ผ่านการรับรอง');
    } else if (state.adminDriverFilter === 'pending') {
      drivers = drivers.filter(d => d.certStatus !== 'ผ่านการรับรอง');
    } else if (state.adminDriverFilter === 'assigned') {
      drivers = drivers.filter(d => d.assignedPlate && d.assignedPlate.trim() !== '');
    } else if (state.adminDriverFilter === 'unassigned') {
      drivers = drivers.filter(d => !d.assignedPlate || d.assignedPlate.trim() === '');
    }

    // Search query
    if (state.adminDriverSearchQuery) {
      const q = state.adminDriverSearchQuery.toLowerCase();
      drivers = drivers.filter(d => {
        return (d.name && d.name.toLowerCase().includes(q)) ||
               (d.empId && d.empId.toLowerCase().includes(q)) ||
               (d.company && d.company.toLowerCase().includes(q)) ||
               (d.department && d.department.toLowerCase().includes(q)) ||
               (d.assignedPlate && d.assignedPlate.toLowerCase().includes(q));
      });
    }

    adminDriverTableBody.innerHTML = '';
    if (drivers.length === 0) {
      adminDriverTableBody.innerHTML = `
        <tr>
          <td colspan="8" style="text-align:center; padding: 3rem 1rem; color: var(--text-muted);">
            <i class="fa-solid fa-id-card" style="font-size: 2.5rem; margin-bottom: 0.75rem; color: var(--surface-border);"></i>
            <p style="font-size: 1rem; font-weight: 500; color: #fff;">ไม่พบข้อมูลผู้ขับขี่ตามเงื่อนไขที่เลือกในหน้า Admin</p>
            <button type="button" class="btn btn-primary btn-sm" style="margin-top: 0.75rem;" data-switch-tab="driver-reg-tab">
              <i class="fa-solid fa-user-plus"></i> ลงทะเบียนผู้ขับขี่ใหม่
            </button>
          </td>
        </tr>
      `;
      return;
    }

    drivers.forEach(driver => {
      const tr = document.createElement('tr');

      const photoHtml = driver.photo
        ? `<img src="${driver.photo}" alt="${driver.name}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; border:2px solid var(--haier-cyan); cursor:pointer;" onclick="window.viewDriverDetails('${driver.id}')" title="คลิกเพื่อดูรายละเอียดผู้ขับ">`
        : `<div style="width:40px; height:40px; border-radius:50%; background:rgba(0,160,233,0.1); border:1px dashed var(--haier-cyan); display:flex; align-items:center; justify-content:center; color:var(--haier-cyan); font-size:1.1rem; margin:0 auto; cursor:pointer;" onclick="window.viewDriverDetails('${driver.id}')" title="ดูรายละเอียดผู้ขับ"><i class="fa-solid fa-user-tie"></i></div>`;

      const isCert = driver.certStatus === 'ผ่านการรับรอง';
      const certBadge = isCert
        ? `<span class="status-badge badge-ready" title="ผ่านการอบรมความปลอดภัย"><i class="fa-solid fa-certificate"></i> ผ่านการรับรอง</span>`
        : `<span class="status-badge badge-repair" title="รอดำเนินการ / ยังไม่มีใบรับรอง"><i class="fa-solid fa-hourglass-half"></i> รอดำเนินการ</span>`;

      const certThumb = driver.certImage
        ? `<div style="display:flex; align-items:center; gap:0.4rem; margin-top:0.35rem;">
             <img src="${driver.certImage}" alt="ใบรับรอง" style="width:44px; height:32px; object-fit:cover; border-radius:4px; border:1px solid rgba(255,255,255,0.25); cursor:pointer; box-shadow:0 2px 5px rgba(0,0,0,0.3);" onclick="window.viewDriverDetails('${driver.id}')" title="คลิกเพื่อดูใบเซอร์ขนาดเต็ม">
             <span style="font-size:0.75rem; color:var(--haier-cyan); cursor:pointer; text-decoration:underline;" onclick="window.viewDriverDetails('${driver.id}')">ดูใบเซอร์</span>
           </div>`
        : `<div style="font-size:0.72rem; color:var(--text-muted); margin-top:0.25rem;"><i class="fa-solid fa-file-circle-xmark"></i> ยังไม่แนบภาพ</div>`;

      const assignedBadge = driver.assignedPlate && driver.assignedPlate.trim() !== ''
        ? `<span class="plate-tag" style="cursor:pointer;" onclick="window.viewAssignedForklift('${driver.assignedPlate}')" title="คลิกเพื่อดูข้อมูลรถประจำ"><i class="fa-solid fa-truck-ramp-box"></i> ${driver.assignedPlate}</span>`
        : `<span style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-minus"></i> ยังไม่ระบุ</span>`;

      tr.innerHTML = `
        <td style="text-align:center;">${photoHtml}</td>
        <td><span class="plate-tag" style="font-size:0.8rem;">${driver.empId || '-'}</span></td>
        <td>
          <div style="font-weight:600; color:var(--text-primary); cursor:pointer;" onclick="window.viewDriverDetails('${driver.id}')">${driver.name}</div>
          ${driver.notes ? `<div style="font-size:0.75rem; color:var(--text-muted);"><i class="fa-regular fa-comment-dots"></i> ${driver.notes}</div>` : ''}
        </td>
        <td><span style="font-size:0.85rem;">${driver.company || '-'}</span></td>
        <td><span style="font-size:0.85rem;">${driver.department || '-'}</span></td>
        <td>${assignedBadge}</td>
        <td>
          ${certBadge}
          ${certThumb}
        </td>
        <td style="text-align:center;">
          <div class="action-btn-group" style="justify-content:center;">
            <button class="btn btn-secondary btn-sm" onclick="window.viewDriverDetails('${driver.id}')" title="ดูรายละเอียดผู้ขับ">
              <i class="fa-regular fa-eye"></i> ดู
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.openEditDriverDirect('${driver.id}')" title="แก้ไขข้อมูลผู้ขับ">
              <i class="fa-solid fa-user-pen"></i> แก้ไขผู้ขับ
            </button>
            <button class="btn btn-danger btn-sm" onclick="window.deleteDriverItem('${driver.id}', '${driver.name}')" title="ลบข้อมูลผู้ขับ">
              <i class="fa-solid fa-trash-can"></i> ลบ
            </button>
          </div>
        </td>
      `;

      adminDriverTableBody.appendChild(tr);
    });
  }

  // --------------------------------------------------------------------------
  // Supabase Background Sync Handler (ไม่มี UI ในหน้า Admin — จัดการโดยระบบหลังบ้านอัตโนมัติ)
  // --------------------------------------------------------------------------

  // Listen to remote sync event from ForkliftDataStore — อัปเดต Dashboard เมื่อ sync สำเร็จ
  window.addEventListener('forklift-data-synced', (e) => {
    renderDashboard();
    renderAdminPanel();
    populateForkliftSelectOptions();
    populateDriverSelectOptions();
    if (state.currentTab === 'alerts-tab') {
      renderAlertsCenter();
    }
  });

  // Listen to remote driver sync event — อัปเดต Driver Table และ Dropdowns เมื่อ sync สำเร็จ
  window.addEventListener('driver-data-synced', (e) => {
    renderDashboard();
    renderDriverTable();
    populateDriverSelectOptions();
    populateForkliftSelectOptions();
    if (state.isAdmin) renderAdminPanel();
    const dashDriversCount = document.getElementById('dash-drivers-count');
    if (dashDriversCount && window.forkliftStore.getAllDrivers) {
      dashDriversCount.textContent = window.forkliftStore.getAllDrivers().length;
    }
  });

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

  // Initial render from local cache
  renderDashboard();
  renderDriverTable();
  populateDriverSelectOptions();
  populateForkliftSelectOptions();

  // Immediately sync latest data from Supabase Cloud on load
  if (window.forkliftStore && typeof window.forkliftStore.syncFromRemote === 'function') {
    window.forkliftStore.syncFromRemote().then((synced) => {
      if (synced) {
        renderDashboard();
        renderDriverTable();
        populateDriverSelectOptions();
        populateForkliftSelectOptions();
        if (state.currentTab === 'admin-tab') renderAdminPanel();
      }
    });
  }

  // Initialize ownership type (defaults to 'company' owned)
  setOwnershipType('company');

  // Initialize energy-specific checklist row based on default dropdown value
  updateChecklistForEnergy(regEnergySelect.value);

  // Set today's date as default for inspection date field
  const inspectDateInput = document.getElementById('reg-inspect-date');
  if (inspectDateInput && !inspectDateInput.value) {
    inspectDateInput.value = new Date().toISOString().split('T')[0];
  }
});
