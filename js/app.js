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
    adminFilter: 'all',
    adminSearchQuery: '',
    // Registration Form Temp State
    regPhotos: {
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
    let lpgAlertCount = 0;
    let incompleteCount = 0;
    let pendingCertCount = 0;
    let companyCount = 0;
    let rentalCount = 0;
    const lpgAlertItems = [];

    forklifts.forEach(item => {
      if (item.isSubcontractor) {
        rentalCount++;
      } else {
        companyCount++;
      }

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
    if (kpiCompany) kpiCompany.textContent = companyCount;
    if (kpiRental) kpiRental.textContent = rentalCount;
    kpiReady.textContent = readyCount;
    kpiRepair.textContent = repairCount;
    kpiLpgAlert.textContent = lpgAlertCount;
    kpiIncomplete.textContent = incompleteCount;
    kpiPendingCert.textContent = pendingCertCount;

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
    if (ownerTotal) ownerTotal.textContent = forklifts.length;
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
    // ────────────────────────────────────────────────────────────────

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
          <div class="driver-info-cell" style="display:flex; align-items:center; gap:0.65rem;">
            ${driver.photo
              ? `<img src="${driver.photo}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:2px solid var(--haier-cyan); flex-shrink:0;">`
              : `<div style="width:38px; height:38px; border-radius:50%; background:rgba(0,160,233,0.15); display:flex; align-items:center; justify-content:center; color:var(--haier-cyan); font-size:1rem; flex-shrink:0;"><i class="fa-solid fa-user"></i></div>`
            }
            <div>
              <div class="driver-name">${driver.name || 'ยังไม่ระบุ'}</div>
              <div class="driver-sub">รหัส: ${driver.empId || '-'} | ${driver.department || '-'}</div>
              <div style="margin-top:0.2rem;">${certBadge}</div>
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

  // Driver Photo Upload Handler (ส่วนที่ 3 ข้อมูลผู้ขับขี่)
  const driverPhotoBox = document.getElementById('box-photo-driver');
  const driverPhotoInput = document.getElementById('input-photo-driver');
  const driverPhotoPreview = document.getElementById('preview-photo-driver');
  const driverPhotoContent = driverPhotoBox ? driverPhotoBox.querySelector('.photo-box-content') : null;
  const btnRemoveDriverPhoto = document.getElementById('btn-remove-photo-driver');

  if (driverPhotoBox && driverPhotoInput) {
    driverPhotoBox.addEventListener('click', (e) => {
      if (e.target.closest('.photo-overlay-actions')) return;
      driverPhotoInput.click();
    });

    driverPhotoInput.addEventListener('change', () => {
      const file = driverPhotoInput.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          state.regDriverPhoto = e.target.result;
          if (driverPhotoPreview) {
            driverPhotoPreview.src = e.target.result;
            driverPhotoPreview.style.display = 'block';
          }
          if (driverPhotoContent) driverPhotoContent.style.display = 'none';
          driverPhotoBox.classList.add('has-image');
        };
        reader.readAsDataURL(file);
      }
    });

    if (btnRemoveDriverPhoto) {
      btnRemoveDriverPhoto.addEventListener('click', (e) => {
        e.stopPropagation();
        state.regDriverPhoto = '';
        driverPhotoInput.value = '';
        if (driverPhotoPreview) {
          driverPhotoPreview.src = '';
          driverPhotoPreview.style.display = 'none';
        }
        if (driverPhotoContent) driverPhotoContent.style.display = 'flex';
        driverPhotoBox.classList.remove('has-image');
      });
    }
  }

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

    const ownerTypeEl = document.getElementById('reg-owner-type');
    const isSub = ownerTypeEl ? ownerTypeEl.value === 'subcontractor' : false;

    const ownerCompany = isSub
      ? (ownerCompanyVal || 'บริษัทรถเช่า / ซัพพลายเออร์')
      : 'Haier Electric (Thailand) Company Limited';

    const subcontractor = isSub
      ? (ownerCompanyVal || 'ผู้รับเหมาช่วง / รถเช่า')
      : 'Haier Owned';

    const inspectDateEl = document.getElementById('reg-inspect-date');
    const inspectionDate = (inspectDateEl && inspectDateEl.value) 
      ? inspectDateEl.value 
      : new Date().toISOString().split('T')[0];

    const statusRadio = document.querySelector('input[name="reg-status"]:checked');
    const status = statusRadio ? statusRadio.value : 'พร้อมใช้งาน';

    const driverNameEl = document.getElementById('reg-driver-name');
    const driverName = driverNameEl ? driverNameEl.value.trim() : '';

    const driverEmpIdEl = document.getElementById('reg-driver-empid');
    const driverEmpId = driverEmpIdEl ? driverEmpIdEl.value.trim() : '';

    const driverCompanyEl = document.getElementById('reg-driver-company');
    const driverCompany = driverCompanyEl ? driverCompanyEl.value.trim() : '';

    const driverDeptEl = document.getElementById('reg-driver-dept');
    const driverDept = driverDeptEl ? driverDeptEl.value.trim() : '';

    const notesEl = document.getElementById('reg-notes');
    const notes = notesEl ? notesEl.value.trim() : '';

    const newForklift = {
      plateNumber,
      vehicleType,
      energyType,
      liftingCapacity,
      ownerCompany,
      subcontractor,
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
        photo: state.regDriverPhoto || '',
        hasTrained: false,
        certImage: '',
        certStatus: 'รอดำเนินการ'
      },
      notes
    };

    try {
      window.forkliftStore.addForklift(newForklift);
      showToast(`ขึ้นทะเบียนรถโฟล์คลิฟท์ "${plateNumber}" สำเร็จเรียบร้อย!`, 'success');
      
      // Reset Form
      regForm.reset();
      regPlateInput.classList.remove('is-valid', 'is-invalid');
      duplicateAlert.classList.remove('show');
      const inspectDateElPost = document.getElementById('reg-inspect-date');
      if (inspectDateElPost) {
        inspectDateElPost.value = new Date().toISOString().split('T')[0];
      }
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

      // Reset driver photo upload
      state.regDriverPhoto = '';
      if (driverPhotoInput) driverPhotoInput.value = '';
      if (driverPhotoPreview) {
        driverPhotoPreview.src = '';
        driverPhotoPreview.style.display = 'none';
      }
      if (driverPhotoContent) driverPhotoContent.style.display = 'flex';
      if (driverPhotoBox) driverPhotoBox.classList.remove('has-image');

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
            ? `<img src="${driver.certImage}" style="width:100%; max-height:160px; object-fit:contain; border-radius:6px; border:1px solid var(--surface-border);">`
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

  // Edit Driver: Handle driver photo upload & removal
  const editDriverPhotoUpload = document.getElementById('edit-driver-photo-upload');
  if (editDriverPhotoUpload) {
    editDriverPhotoUpload.addEventListener('change', () => {
      const file = editDriverPhotoUpload.files[0];
      const preview = document.getElementById('edit-driver-photo-preview');
      const placeholder = document.getElementById('edit-driver-photo-placeholder');
      const btnRemove = document.getElementById('btn-remove-edit-driver-photo');
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          state.editDriverPhoto = e.target.result;
          if (preview) {
            preview.src = e.target.result;
            preview.style.display = 'block';
          }
          if (placeholder) placeholder.style.display = 'none';
          if (btnRemove) btnRemove.style.display = 'inline-block';
        };
        reader.readAsDataURL(file);
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
      statusText.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> กำลังตรวจสอบภาพ...`;
      const reader = new FileReader();
      reader.onload = async (ev) => {
        preview.src = ev.target.result;
        preview.style.display = 'block';
        if (window.aiVerifier && typeof window.aiVerifier.verify === 'function') {
          const result = await window.aiVerifier.verify(ev.target.result, { driverName });
          state.editDriverCert.image = ev.target.result;
          state.editDriverCert.status = result.status;
          const color = result.status === 'ผ่านการรับรอง' ? '#34d399' : '#f87171';
          statusText.innerHTML = `ผลตรวจ: <strong style="color:${color};">${result.status}</strong> (${result.confidence}%)<br><span style="font-size:0.75rem; color:var(--text-secondary);">${result.details}</span>`;
        } else {
          state.editDriverCert.image = ev.target.result;
          state.editDriverCert.status = 'ผ่านการรับรอง';
          statusText.innerHTML = `<span style="color:#34d399;"><i class="fa-solid fa-check"></i> แนบภาพใบรับรองเรียบร้อยแล้ว</span>`;
        }
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
        photo: state.editDriverPhoto,
        certImage: state.editDriverCert.image,
        certStatus: state.editDriverCert.status,
        hasTrained: state.editDriverCert.status === 'ผ่านการรับรอง'
      });

      showToast('อัปเดตข้อมูลผู้ขับขี่สำเร็จแล้ว', 'success');
      closeModal(modalEditDriver);
      renderDashboard();
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
      if (state.currentTab === 'admin-tab') renderAdminPanel();
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
      renderAdminTable();
    } else {
      loginView.style.display = 'flex';
      panelView.style.display = 'none';
      const pwInput = document.getElementById('admin-password');
      if (pwInput) pwInput.value = '';
      const errEl = document.getElementById('admin-login-error');
      if (errEl) errEl.style.display = 'none';
    }
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
      if (state.adminFilter === 'all') return true;
      if (state.adminFilter === 'ready') return item.status === 'พร้อมใช้งาน';
      if (state.adminFilter === 'repair') return item.status === 'ส่งซ่อม';
      if (state.adminFilter === 'electric') return item.energyType === 'ไฟฟ้า';
      if (state.adminFilter === 'lpg') return item.energyType === 'LPG';
      if (state.adminFilter === 'diesel') return item.energyType === 'ดีเซล';
      if (state.adminFilter === 'haier') return !item.isSubcontractor;
      if (state.adminFilter === 'subcontractor') return item.isSubcontractor;
      if (state.adminFilter === 'incomplete') {
        return window.forkliftStore.getIncompleteIssues(item).length > 0;
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

      const statusBadge = item.status === 'พร้อมใช้งาน'
        ? `<span class="status-badge badge-ready"><i class="fa-solid fa-circle-check"></i> พร้อมใช้งาน</span>`
        : `<span class="status-badge badge-repair"><i class="fa-solid fa-triangle-exclamation"></i> ส่งซ่อม</span>`;

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
          <div class="driver-info-cell" style="display:flex; align-items:center; gap:0.65rem;">
            ${driver.photo
              ? `<img src="${driver.photo}" style="width:38px; height:38px; border-radius:50%; object-fit:cover; border:2px solid var(--haier-cyan); flex-shrink:0;">`
              : `<div style="width:38px; height:38px; border-radius:50%; background:rgba(0,160,233,0.15); display:flex; align-items:center; justify-content:center; color:var(--haier-cyan); font-size:1rem; flex-shrink:0;"><i class="fa-solid fa-user"></i></div>`
            }
            <div>
              <div class="driver-name">${driver.name || 'ยังไม่ระบุ'}</div>
              <div class="driver-sub">รหัส: ${driver.empId || '-'} | ${driver.department || '-'}</div>
              <div style="margin-top:0.2rem;">${certBadge}</div>
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

  // Admin Login Event Handler
  const formAdminLogin = document.getElementById('form-admin-login');
  const adminPasswordInput = document.getElementById('admin-password');
  const btnToggleAdminPw = document.getElementById('btn-toggle-admin-pw');
  const iconTogglePw = document.getElementById('icon-toggle-pw');
  const adminLoginError = document.getElementById('admin-login-error');
  const btnAdminLogout = document.getElementById('btn-admin-logout');

  if (formAdminLogin) {
    formAdminLogin.addEventListener('submit', (e) => {
      e.preventDefault();
      const enteredPw = adminPasswordInput ? adminPasswordInput.value.trim() : '';
      if (enteredPw === 'admin1234' || enteredPw === 'haier1234' || enteredPw === 'admin') {
        state.isAdmin = true;
        sessionStorage.setItem('haier_forklift_admin', 'true');
        if (adminLoginError) adminLoginError.style.display = 'none';
        if (adminPasswordInput) adminPasswordInput.value = '';
        showToast('เข้าสู่ระบบ Admin สำเร็จ ยินดีต้อนรับสู่โหมดจัดการข้อมูล', 'success');
        renderAdminPanel();
      } else {
        if (adminLoginError) {
          adminLoginError.style.display = 'block';
          adminLoginError.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> รหัสผ่านไม่ถูกต้อง กรุณาลองใหม่อีกครั้ง (รหัสผ่านเริ่มต้น: admin1234)';
        }
        if (adminPasswordInput) {
          adminPasswordInput.select();
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
        sessionStorage.removeItem('haier_forklift_admin');
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

  // --------------------------------------------------------------------------
  // Supabase Database Connection UI & Sync Handler
  // --------------------------------------------------------------------------
  const sbStatusBadge = document.getElementById('sb-status-badge');
  const sbStatusDesc = document.getElementById('sb-status-desc');
  const btnToggleSbSettings = document.getElementById('btn-toggle-sb-settings');
  const sbSettingsPanel = document.getElementById('sb-settings-panel');
  const sbCfgUrl = document.getElementById('sb-cfg-url');
  const sbCfgKey = document.getElementById('sb-cfg-key');
  const btnSaveSbConfig = document.getElementById('btn-save-sb-config');
  const btnTestSbConnection = document.getElementById('btn-test-sb-connection');
  const btnUploadLocalToSb = document.getElementById('btn-upload-local-to-sb');
  const btnDisconnectSb = document.getElementById('btn-disconnect-sb');
  const btnSbSyncNow = document.getElementById('btn-sb-sync-now');
  const sbTestResult = document.getElementById('sb-test-result');

  function updateSupabaseStatusUI() {
    if (!sbStatusBadge) return;
    const isConfigured = window.supabaseService && window.supabaseService.isConfigured();
    const cfg = window.supabaseService ? window.supabaseService.getConfig() : { url: '', anonKey: '' };

    if (sbCfgUrl && !sbCfgUrl.value) sbCfgUrl.value = cfg.url || '';
    if (sbCfgKey && !sbCfgKey.value) sbCfgKey.value = cfg.anonKey || '';

    if (isConfigured) {
      sbStatusBadge.className = 'badge-status-cloud';
      sbStatusBadge.innerHTML = `<i class="fa-solid fa-cloud"></i> Supabase Cloud (เชื่อมต่อแล้ว)`;
      if (sbStatusDesc) {
        sbStatusDesc.innerHTML = `เชื่อมต่อกับ <strong style="color:#3ecf8e;">${cfg.url.replace(/^https?:\/\//, '').split('.')[0]}</strong> บน Supabase เรียบร้อยแล้ว (ซิงค์ข้อมูลผ่านคลาวด์)`;
      }
      if (btnDisconnectSb) btnDisconnectSb.style.display = 'inline-flex';
    } else {
      sbStatusBadge.className = 'badge-status-local';
      sbStatusBadge.innerHTML = `<i class="fa-solid fa-hard-drive"></i> LocalStorage (ในเครื่อง)`;
      if (sbStatusDesc) {
        sbStatusDesc.textContent = 'เชื่อมต่อ Supabase เพื่อบันทึกและแชร์ข้อมูลรถโฟล์คลิฟท์แบบเรียลไทม์บนคลาวด์';
      }
      if (btnDisconnectSb) btnDisconnectSb.style.display = 'none';
    }
  }

  // Toggle settings panel
  if (btnToggleSbSettings && sbSettingsPanel) {
    btnToggleSbSettings.addEventListener('click', () => {
      const isHidden = sbSettingsPanel.style.display === 'none';
      sbSettingsPanel.style.display = isHidden ? 'block' : 'none';
      if (isHidden) {
        updateSupabaseStatusUI();
      }
    });
  }

  // Test Connection
  if (btnTestSbConnection) {
    btnTestSbConnection.addEventListener('click', async () => {
      const url = sbCfgUrl ? sbCfgUrl.value.trim() : '';
      const key = sbCfgKey ? sbCfgKey.value.trim() : '';
      if (!url || !key) {
        showToast('กรุณากรอกทั้ง Supabase URL และ Anon Key ให้ครบถ้วน', 'warn');
        return;
      }

      if (sbTestResult) {
        sbTestResult.style.display = 'block';
        sbTestResult.style.background = 'rgba(0, 160, 233, 0.15)';
        sbTestResult.style.color = '#38bdf8';
        sbTestResult.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังทดสอบการเชื่อมต่อไปยัง Supabase...';
      }

      const res = await window.supabaseService.testConnection(url, key);
      if (sbTestResult) {
        if (res.success) {
          sbTestResult.style.background = 'rgba(16, 185, 129, 0.15)';
          sbTestResult.style.color = '#34d399';
          sbTestResult.innerHTML = `<i class="fa-solid fa-circle-check"></i> ${res.message}`;
          showToast('ทดสอบการเชื่อมต่อ Supabase สำเร็จ!', 'success');
        } else {
          sbTestResult.style.background = 'rgba(239, 68, 68, 0.15)';
          sbTestResult.style.color = '#f87171';
          sbTestResult.innerHTML = `<i class="fa-solid fa-circle-xmark"></i> ${res.message}`;
          showToast('การเชื่อมต่อล้มเหลว กรุณาตรวจสอบข้อมูล', 'error');
        }
      }
    });
  }

  // Save and Connect
  if (btnSaveSbConfig) {
    btnSaveSbConfig.addEventListener('click', async () => {
      const url = sbCfgUrl ? sbCfgUrl.value.trim() : '';
      const key = sbCfgKey ? sbCfgKey.value.trim() : '';
      if (!url || !key) {
        showToast('กรุณากรอกทั้ง Supabase URL และ Anon Key ให้ครบถ้วน', 'warn');
        return;
      }

      window.supabaseService.saveConfig(url, key);
      const res = await window.supabaseService.testConnection(url, key);
      updateSupabaseStatusUI();

      if (res.success) {
        showToast('บันทึกและเชื่อมต่อฐานข้อมูล Supabase สำเร็จแล้ว!', 'success');
        // Fetch fresh data from Supabase
        await window.forkliftStore.syncFromRemote();
        renderDashboard();
        renderAdminPanel();
      } else {
        showToast(`บันทึกแล้ว แต่ตรวจพบปัญหา: ${res.message}`, 'warn');
      }
    });
  }

  // Upload Local Data to Supabase
  if (btnUploadLocalToSb) {
    btnUploadLocalToSb.addEventListener('click', async () => {
      if (!window.supabaseService || !window.supabaseService.isConfigured()) {
        showToast('กรุณาบันทึกและเชื่อมต่อ Supabase ก่อนอัปโหลดข้อมูล', 'warn');
        return;
      }

      const all = window.forkliftStore.getAll();
      if (all.length === 0) {
        showToast('ไม่มีข้อมูลในเครื่องที่จะอัปโหลด', 'info');
        return;
      }

      if (confirm(`คุณต้องการอัปโหลดข้อมูลรถโฟล์คลิฟท์ทั้งหมดในเครื่อง (${all.length} คัน) ขึ้นไปยังฐานข้อมูล Supabase หรือไม่?`)) {
        try {
          btnUploadLocalToSb.disabled = true;
          btnUploadLocalToSb.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังอัปโหลด...';
          const res = await window.supabaseService.uploadLocalData(all);
          showToast(`อัปโหลดขึ้น Supabase เรียบร้อยแล้ว (${res.count} คัน)`, 'success');
        } catch (err) {
          showToast(err.message, 'error');
        } finally {
          btnUploadLocalToSb.disabled = false;
          btnUploadLocalToSb.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> อัปโหลดข้อมูลในเครื่องขึ้น Supabase';
        }
      }
    });
  }

  // Disconnect from Supabase
  if (btnDisconnectSb) {
    btnDisconnectSb.addEventListener('click', () => {
      if (confirm('คุณต้องการยกเลิกการเชื่อมต่อกับ Supabase และสลับกลับไปใช้ LocalStorage ในเครื่องใช่หรือไม่?')) {
        window.supabaseService.clearConfig();
        updateSupabaseStatusUI();
        showToast('สลับกลับมาใช้ LocalStorage ในเครื่องเรียบร้อยแล้ว', 'info');
      }
    });
  }

  // Sync Cloud Data Now button
  if (btnSbSyncNow) {
    btnSbSyncNow.addEventListener('click', async () => {
      if (!window.supabaseService || !window.supabaseService.isConfigured()) {
        showToast('ยังไม่ได้เชื่อมต่อ Supabase กรุณาตั้งค่า URL และ Key ก่อน', 'warn');
        if (sbSettingsPanel) sbSettingsPanel.style.display = 'block';
        return;
      }

      btnSbSyncNow.disabled = true;
      btnSbSyncNow.innerHTML = '<i class="fa-solid fa-rotate fa-spin"></i> กำลังซิงค์...';
      const synced = await window.forkliftStore.syncFromRemote();
      btnSbSyncNow.disabled = false;
      btnSbSyncNow.innerHTML = '<i class="fa-solid fa-rotate"></i> ซิงค์ข้อมูลคลาวด์';

      if (synced) {
        renderDashboard();
        renderAdminPanel();
        showToast('ซิงค์ข้อมูลล่าสุดจาก Supabase Cloud เรียบร้อยแล้ว', 'success');
      } else {
        showToast('ไม่สามารถซิงค์ข้อมูลจาก Supabase ได้ กรุณาตรวจสอบการเชื่อมต่อ', 'error');
      }
    });
  }

  // Listen to remote sync event from ForkliftDataStore
  window.addEventListener('forklift-data-synced', (e) => {
    renderDashboard();
    renderAdminPanel();
    if (state.currentTab === 'alerts-tab') {
      renderAlertsCenter();
    }
    updateSupabaseStatusUI();
  });

  // Update Supabase UI on initial load
  updateSupabaseStatusUI();

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

  // Initialize energy-specific checklist row based on default dropdown value
  updateChecklistForEnergy(regEnergySelect.value);

  // Set today's date as default for inspection date field
  const inspectDateInput = document.getElementById('reg-inspect-date');
  if (inspectDateInput && !inspectDateInput.value) {
    inspectDateInput.value = new Date().toISOString().split('T')[0];
  }
});
