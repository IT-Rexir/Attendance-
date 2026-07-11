/**
 * admin.js
 * Jagobiao National High School Attendance System
 * ---------------------------------------------------
 * Handles: admin authentication, dashboard stats,
 * attendance table rendering, search/filter, CSV export,
 * Discord Webhook push, record deletion, and Firebase Teacher Panel synchronization.
 */

(() => {
  "use strict";

  /* ---------- Config ---------- */
  const ADMIN_PASSWORD = "jnhs2026";
  const SESSION_KEY = "jnhs_admin_session";

  // Your exact Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCmhmx-xWEvKDIjtt43IsqZduRP-EyTjIU",
    authDomain: "attendance-f61dc.firebaseapp.com",
    databaseURL: "https://attendance-f61dc-default-rtdb.asia-southeast1.firebasedatabase.app",
    projectId: "attendance-f61dc",
    storageBucket: "attendance-f61dc.firebasestorage.app",
    messagingSenderId: "441272090418",
    appId: "1:441272090418:web:862fe4b4a38ba92838212b",
    measurementId: "G-QEN8WHNQHP"
  };

  // Initialize Firebase globally via SDK script tags
  if (typeof firebase !== 'undefined') {
    firebase.initializeApp(firebaseConfig);
  }

  /* ---------- DOM refs ---------- */
  const loadingScreen = document.getElementById("loading-screen");
  const loginPage = document.getElementById("login-page");
  const dashboardPage = document.getElementById("dashboard-page");

  const loginForm = document.getElementById("login-form");
  const passwordInput = document.getElementById("password-input");
  const togglePwBtn = document.getElementById("toggle-pw");
  const loginError = document.getElementById("login-error");
  const loginErrorText = document.getElementById("login-error-text");

  const logoutBtn = document.getElementById("logout-btn");
  const refreshBtn = document.getElementById("refresh-btn");

  const todayLabel = document.getElementById("today-label");
  const statPresent = document.getElementById("stat-present");
  const statTotal = document.getElementById("stat-total");
  const statLate = document.getElementById("stat-late");
  const statAbsent = document.getElementById("stat-absent");

  const searchInput = document.getElementById("search-input");
  const dateFilter = document.getElementById("date-filter");
  const clearFilterBtn = document.getElementById("clear-filter-btn");
  const exportCsvBtn = document.getElementById("export-csv-btn");
  const sendWebhookBtn = document.getElementById("send-webhook-btn");
  const sendPanelBtn = document.getElementById("send-panel-btn");
  const clearTodayBtn = document.getElementById("clear-today-btn");

  const tbody = document.getElementById("attendance-tbody");
  const emptyState = document.getElementById("empty-state");

  const modalScrim = document.getElementById("modal-scrim");
  const modalTitle = document.getElementById("modal-title");
  const modalMessage = document.getElementById("modal-message");
  const modalCancelBtn = document.getElementById("modal-cancel-btn");
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");

  const toast = document.getElementById("toast");

  /* ---------- State ---------- */
  let pendingModalAction = null;

  /* ============================================================
     Boot
     ============================================================ */
  async function boot() {
    attachRipple();
    try {
      await Students.init();
    } catch (e) {
      console.error(e);
    }

    setTimeout(() => {
      if (loadingScreen) loadingScreen.classList.add("fade-out");
    }, 700);

    if (sessionStorage.getItem(SESSION_KEY) === "true") {
      showDashboard();
    } else {
      showLogin();
    }
  }

  /* ============================================================
     Auth
     ============================================================ */
  function showLogin() {
    loginPage.classList.remove("hidden");
    dashboardPage.classList.add("hidden");
    setTimeout(() => passwordInput.focus(), 400);
  }

  function showDashboard() {
    loginPage.classList.add("hidden");
    dashboardPage.classList.remove("hidden");
    initDateFilterDefault();
    renderAll();
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();
    const entered = passwordInput.value;
    if (entered === ADMIN_PASSWORD) {
      sessionStorage.setItem(SESSION_KEY, "true");
      loginError.classList.add("hidden");
      passwordInput.value = "";
      showDashboard();
    } else {
      loginErrorText.textContent = "Incorrect password. Please try again.";
      loginError.classList.remove("hidden");
      passwordInput.value = "";
      passwordInput.focus();
    }
  });

  togglePwBtn.addEventListener("click", () => {
    const isPw = passwordInput.type === "password";
    passwordInput.type = isPw ? "text" : "password";
    togglePwBtn.textContent = isPw ? "🙈" : "👁";
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);
    showLogin();
  });

  /* ============================================================
     Date filter default = today
     ============================================================ */
  function initDateFilterDefault() {
    if (!dateFilter.value) {
      dateFilter.value = DB.todayStr();
    }
  }

  /* ============================================================
     Rendering
     ============================================================ */
  function renderAll() {
    renderStats();
    renderTable();
    updateTodayLabel();
  }

  function updateTodayLabel() {
    const now = new Date();
    todayLabel.textContent = now.toLocaleDateString("en-PH", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function renderStats() {
    const today = DB.todayStr();
    const records = DB.getAttendance().filter((r) => r.date === today);
    const totalStudents = Students.all().length;

    const presentCount = records.filter((r) => r.status === "Present").length;
    const lateCount = records.filter((r) => r.status === "Late").length;
    const accountedFor = presentCount + lateCount;
    const absentCount = Math.max(totalStudents - accountedFor, 0);

    animateNumber(statPresent, presentCount);
    animateNumber(statTotal, totalStudents);
    animateNumber(statLate, lateCount);
    animateNumber(statAbsent, absentCount);
  }

  function animateNumber(el, target) {
    if (!el) return;
    const start = parseInt(el.textContent, 10) || 0;
    if (start === target) {
      el.textContent = target;
      return;
    }
    const duration = 400;
    const startTime = performance.now();
    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);
      const value = Math.round(start + (target - start) * progress);
      el.textContent = value;
      if (progress < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  }

  function getFilteredRecords() {
    let records = [...DB.getAttendance()].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));

    const dateVal = dateFilter.value;
    if (dateVal) {
      records = records.filter((r) => r.date === dateVal);
    }

    const q = searchInput.value.trim().toLowerCase();
    if (q) {
      records = records.filter(
        (r) =>
          r.name.toLowerCase().includes(q) ||
          String(r.lrn).includes(q) ||
          (r.section && r.section.toLowerCase().includes(q)) ||
          (r.strand && r.strand.toLowerCase().includes(q))
      );
    }

    return records;
  }

  function renderTable() {
    const records = getFilteredRecords();
    tbody.innerHTML = "";

    if (records.length === 0) {
      emptyState.classList.remove("hidden");
      return;
    }
    emptyState.classList.add("hidden");

    const frag = document.createDocumentFragment();
    records.forEach((r) => {
      const tr = document.createElement("tr");
      tr.className = "fade-in";
      tr.innerHTML = `
        <td>${escapeHTML(r.name)}</td>
        <td class="lrn-cell">${escapeHTML(r.lrn)}</td>
        <td>${escapeHTML(r.grade || "—")}</td>
        <td>${escapeHTML(r.strand || "—")}</td>
        <td>${escapeHTML(r.section || "—")}</td>
        <td>${escapeHTML(r.date)}</td>
        <td>${escapeHTML(r.time)}</td>
        <td><span class="status-badge ${r.status}">${r.status}</span></td>
        <td><button class="row-delete-btn" data-id="${escapeHTML(r.id)}" title="Delete record">🗑</button></td>
      `;
      frag.appendChild(tr);
    });
    tbody.appendChild(frag);
  }

  ...