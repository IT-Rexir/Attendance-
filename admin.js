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
  const ADMIN_PASSWORD = "jnhs2026";[cite: 2]
  const SESSION_KEY = "jnhs_admin_session";[cite: 2]

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
  const loadingScreen = document.getElementById("loading-screen");[cite: 2]
  const loginPage = document.getElementById("login-page");[cite: 2]
  const dashboardPage = document.getElementById("dashboard-page");[cite: 2]

  const loginForm = document.getElementById("login-form");[cite: 2]
  const passwordInput = document.getElementById("password-input");[cite: 2]
  const togglePwBtn = document.getElementById("toggle-pw");[cite: 2]
  const loginError = document.getElementById("login-error");[cite: 2]
  const loginErrorText = document.getElementById("login-error-text");[cite: 2]

  const logoutBtn = document.getElementById("logout-btn");[cite: 2]
  const refreshBtn = document.getElementById("refresh-btn");[cite: 2]

  const todayLabel = document.getElementById("today-label");[cite: 2]
  const statPresent = document.getElementById("stat-present");[cite: 2]
  const statTotal = document.getElementById("stat-total");[cite: 2]
  const statLate = document.getElementById("stat-late");[cite: 2]
  const statAbsent = document.getElementById("stat-absent");[cite: 2]

  const searchInput = document.getElementById("search-input");[cite: 2]
  const dateFilter = document.getElementById("date-filter");[cite: 2]
  const clearFilterBtn = document.getElementById("clear-filter-btn");[cite: 2]
  const exportCsvBtn = document.getElementById("export-csv-btn");[cite: 2]
  const sendWebhookBtn = document.getElementById("send-webhook-btn");[cite: 2]
  const sendPanelBtn = document.getElementById("send-panel-btn");
  const clearTodayBtn = document.getElementById("clear-today-btn");[cite: 2]

  const tbody = document.getElementById("attendance-tbody");[cite: 2]
  const emptyState = document.getElementById("empty-state");[cite: 2]

  const modalScrim = document.getElementById("modal-scrim");[cite: 2]
  const modalTitle = document.getElementById("modal-title");[cite: 2]
  const modalMessage = document.getElementById("modal-message");[cite: 2]
  const modalCancelBtn = document.getElementById("modal-cancel-btn");[cite: 2]
  const modalConfirmBtn = document.getElementById("modal-confirm-btn");[cite: 2]

  const toast = document.getElementById("toast");[cite: 2]

  /* ---------- State ---------- */
  let pendingModalAction = null;[cite: 2]

  /* ============================================================
     Boot
     ============================================================ */
  async function boot() {
    attachRipple();[cite: 2]
    try {
      await Students.init();[cite: 2]
    } catch (e) {
      console.error(e);[cite: 2]
    }

    setTimeout(() => loadingScreen.classList.add("fade-out"), 700);[cite: 2]

    if (sessionStorage.getItem(SESSION_KEY) === "true") {[cite: 2]
      showDashboard();[cite: 2]
    } else {
      showLogin();[cite: 2]
    }
  }

  /* ============================================================
     Auth
     ============================================================ */
  function showLogin() {
    loginPage.classList.remove("hidden");[cite: 2]
    dashboardPage.classList.add("hidden");[cite: 2]
    setTimeout(() => passwordInput.focus(), 400);[cite: 2]
  }

  function showDashboard() {
    loginPage.classList.add("hidden");[cite: 2]
    dashboardPage.classList.remove("hidden");[cite: 2]
    initDateFilterDefault();[cite: 2]
    renderAll();[cite: 2]
  }

  loginForm.addEventListener("submit", (e) => {
    e.preventDefault();[cite: 2]
    const entered = passwordInput.value;[cite: 2]
    if (entered === ADMIN_PASSWORD) {[cite: 2]
      sessionStorage.setItem(SESSION_KEY, "true");[cite: 2]
      loginError.classList.add("hidden");[cite: 2]
      passwordInput.value = "";[cite: 2]
      showDashboard();[cite: 2]
    } else {
      loginErrorText.textContent = "Incorrect password. Please try again.";[cite: 2]
      loginError.classList.remove("hidden");[cite: 2]
      passwordInput.value = "";[cite: 2]
      passwordInput.focus();[cite: 2]
    }
  });

  togglePwBtn.addEventListener("click", () => {
    const isPw = passwordInput.type === "password";[cite: 2]
    passwordInput.type = isPw ? "text" : "password";[cite: 2]
    togglePwBtn.textContent = isPw ? "🙈" : "👁";[cite: 2]
  });

  logoutBtn.addEventListener("click", () => {
    sessionStorage.removeItem(SESSION_KEY);[cite: 2]
    showLogin();[cite: 2]
  });

  /* ============================================================
     Date filter default = today
     ============================================================ */
  function initDateFilterDefault() {
    if (!dateFilter.value) {[cite: 2]
      dateFilter.value = DB.todayStr();[cite: 2]
    }
  }

  /* ============================================================
     Rendering
     ============================================================ */
  function renderAll() {
    renderStats();[cite: 2]
    renderTable();[cite: 2]
    updateTodayLabel();[cite: 2]
  }

  function updateTodayLabel() {
    const now = new Date();[cite: 2]
    todayLabel.textContent = now.toLocaleDateString("en-PH", {[cite: 2]
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  }

  function renderStats() {
    const today = DB.todayStr();[cite: 2]
    const records = DB.getAttendance().filter((r) => r.date === today);[cite: 2]
    const totalStudents = Students.all().length;[cite: 2]

    const presentCount = records.filter((r) => r.status === "Present").length;[cite: 2]
    const lateCount = records.filter((r) => r.status === "Late").length;[cite: 2]
    const accountedFor = presentCount + lateCount;[cite: 2]
    const absentCount = Math.max(totalStudents - accountedFor, 0);[cite: 2]

    animateNumber(statPresent, presentCount);[cite: 2]
    animateNumber(statTotal, totalStudents);[cite: 2]
    animateNumber(statLate, lateCount);[cite: 2]
    animateNumber(statAbsent, absentCount);[cite: 2]
  }

  function animateNumber(el, target) {
    const start = parseInt(el.textContent, 10) || 0;[cite: 2]
    if (start === target) {[cite: 2]
      el.textContent = target;[cite: 2]
      return;
    }
    const duration = 400;[cite: 2]
    const startTime = performance.now();[cite: 2]
    function step(now) {
      const progress = Math.min((now - startTime) / duration, 1);[cite: 2]
      const value = Math.round(start + (target - start) * progress);[cite: 2]
      el.textContent = value;[cite: 2]
      if (progress < 1) requestAnimationFrame(step);[cite: 2]
    }
    requestAnimationFrame(step);[cite: 2]
  }

  function getFilteredRecords() {
    let records = [...DB.getAttendance()].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));[cite: 2]

    const dateVal = dateFilter.value;[cite: 2]
    if (dateVal) {[cite: 2]
      records = records.filter((r) => r.date === dateVal);[cite: 2]
    }

    const q = searchInput.value.trim().toLowerCase();[cite: 2]
    if (q) {[cite: 2]
      records = records.filter([cite: 2]
        (r) =>
          r.name.toLowerCase().includes(q) ||[cite: 2]
          String(r.lrn).includes(q) ||[cite: 2]
          (r.section && r.section.toLowerCase().includes(q)) ||[cite: 2]
          (r.strand && r.strand.toLowerCase().includes(q))[cite: 2]
      );
    }

    return records;[cite: 2]
  }

  function renderTable() {
    const records = getFilteredRecords();[cite: 2]
    tbody.innerHTML = "";[cite: 2]

    if (records.length === 0) {[cite: 2]
      emptyState.classList.remove("hidden");[cite: 2]
      return;
    }
    emptyState.classList.add("hidden");[cite: 2]

    const frag = document.createDocumentFragment();[cite: 2]
    records.forEach((r) => {[cite: 2]
      const tr = document.createElement("tr");[cite: 2]
      tr.className = "fade-in";[cite: 2]
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
      `;[cite: 2]
      frag.appendChild(tr);[cite: 2]
    });
    tbody.appendChild(frag);[cite: 2]
  }

  function escapeHTML(str) {
    return String(str)[cite: 2]
      .replace(/&/g, "&amp;")[cite: 2]
      .replace(/</g, "&lt;")[cite: 2]
      .replace(/>/g, "&gt;")[cite: 2]
      .replace(/"/g, "&quot;");[cite: 2]
  }

  /* ============================================================
     Search / Filter events
     ============================================================ */
  let searchDebounce = null;[cite: 2]
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);[cite: 2]
    searchDebounce = setTimeout(renderTable, 180);[cite: 2]
  });

  dateFilter.addEventListener("change", () => {
    renderTable();[cite: 2]
    renderStats();[cite: 2]
  });

  clearFilterBtn.addEventListener("click", () => {
    searchInput.value = "";[cite: 2]
    dateFilter.value = "";[cite: 2]
    renderAll();[cite: 2]
  });

  refreshBtn.addEventListener("click", async () => {
    await Students.refresh();[cite: 2]
    renderAll();[cite: 2]
    showToast("Data refreshed", "ok");[cite: 2]
  });

  /* ============================================================
     Delete single record
     ============================================================ */
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest(".row-delete-btn");[cite: 2]
    if (!btn) return;[cite: 2]
    const id = btn.dataset.id;[cite: 2]
    openModal({[cite: 2]
      title: "Delete this record?",[cite: 2]
      message: "This attendance entry will be permanently removed. This action cannot be undone.",[cite: 2]
      confirmLabel: "Delete",[cite: 2]
      onConfirm: () => {
        DB.deleteAttendance(id);[cite: 2]
        renderAll();[cite: 2]
        showToast("Record deleted", "ok");[cite: 2]
      },
    });
  });

  /* ============================================================
     Clear today's attendance
     ============================================================ */
  clearTodayBtn.addEventListener("click", () => {
    openModal({[cite: 2]
      title: "Clear today's attendance?",[cite: 2]
      message: "All attendance records for today will be permanently deleted. This action cannot be undone.",[cite: 2]
      confirmLabel: "Clear Today",[cite: 2]
      onConfirm: () => {
        DB.clearTodayAttendance();[cite: 2]
        renderAll();[cite: 2]
        showToast("Today's attendance cleared", "ok");[cite: 2]
      },
    });
  });

  /* ============================================================
     Modal helper
     ============================================================ */
  function openModal({ title, message, confirmLabel, onConfirm }) {
    modalTitle.textContent = title;[cite: 2]
    modalMessage.textContent = message;[cite: 2]
    modalConfirmBtn.textContent = confirmLabel || "Confirm";[cite: 2]
    pendingModalAction = onConfirm;[cite: 2]
    modalScrim.classList.add("show");[cite: 2]
  }

  function closeModal() {
    modalScrim.classList.remove("show");[cite: 2]
    pendingModalAction = null;[cite: 2]
  }

  modalCancelBtn.addEventListener("click", closeModal);[cite: 2]
  modalScrim.addEventListener("click", (e) => {
    if (e.target === modalScrim) closeModal();[cite: 2]
  });
  modalConfirmBtn.addEventListener("click", () => {
    if (typeof pendingModalAction === "function") pendingModalAction();[cite: 2]
    closeModal();[cite: 2]
  });

  /* ============================================================
     CSV Export
     ============================================================ */
  exportCsvBtn.addEventListener("click", () => {
    const records = getFilteredRecords();[cite: 2]
    if (records.length === 0) {[cite: 2]
      showToast("No records to export", "warn");[cite: 2]
      return;
    }
    const headers = ["Name", "LRN", "Grade", "Strand", "Section", "Date", "Time In", "Status"];[cite: 2]
    const rows = records.map((r) => [r.name, r.lrn, r.grade, r.strand, r.section, r.date, r.time, r.status]);[cite: 2]

    const csvContent =
      [headers, ...rows][cite: 2]
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))[cite: 2]
        .join("\r\n");[cite: 2]

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });[cite: 2]
    const url = URL.createObjectURL(blob);[cite: 2]
    const link = document.createElement("a");[cite: 2]
    const stamp = new Date().toISOString().slice(0, 10);[cite: 2]
    link.href = url;[cite: 2]
    link.download = `JNHS_Attendance_${stamp}.csv`;[cite: 2]
    document.body.appendChild(link);[cite: 2]
    link.click();[cite: 2]
    document.body.removeChild(link);[cite: 2]
    URL.revokeObjectURL(url);[cite: 2]
    showToast("CSV exported", "ok");[cite: 2]
  });

  /* ============================================================
     Webhook Sending (Direct to Discord via native bypass)
     ============================================================ */
  sendWebhookBtn.addEventListener("click", async () => {
    const records = getFilteredRecords();[cite: 2]
    
    if (records.length === 0) {[cite: 2]
      showToast("No records to send", "warn");[cite: 2]
      return;
    }

    const WEBHOOK_URL = "https://discordapp.com/api/webhooks/1518966001885118625/rCb5480x4HeE23vE4fhXGF6I_osHZHfPdPHMbEM4TKd0eSsKDzAviSZYBtu088s0uN9G";[cite: 2]

    try {
      sendWebhookBtn.disabled = true;[cite: 2]
      showToast("Sending data...", "ok");[cite: 2]

      const recordLines = records.map(r =>[cite: 2]
        `• **${r.name}** (\`${r.lrn}\`) — ${r.grade || ''} ${r.strand || ''} [${r.status}] at *${r.time}*`[cite: 2]
      );

      const batches = [];[cite: 2]
      let currentBatch = `📊 **New Attendance Report Exported**\n**Total Records:** ${records.length}\n**Timestamp:** ${new Date().toLocaleString("en-PH")}\n\n`;[cite: 2]

      for (const line of recordLines) {[cite: 2]
        if ((currentBatch + line).length > 1900) {[cite: 2]
          batches.push(currentBatch);[cite: 2]
          currentBatch = "";[cite: 2]
        }
        currentBatch += line + "\n";[cite: 2]
      }
      if (currentBatch.trim().length > 0) {[cite: 2]
        batches.push(currentBatch);[cite: 2]
      }

      for (let i = 0; i < batches.length; i++) {[cite: 2]
        const payload = { content: batches[i] };[cite: 2]
        
        const response = await fetch(WEBHOOK_URL, {[cite: 2]
          method: "POST",[cite: 2]
          headers: {[cite: 2]
            "Content-Type": "application/json"[cite: 2]
          },
          body: JSON.stringify(payload)[cite: 2]
        });

        if (!response.ok && response.status !== 204) {[cite: 2]
          throw new Error(`Server responded with status: ${response.status}`);[cite: 2]
        }

        if (batches.length > 1) {[cite: 2]
          await new Promise(resolve => setTimeout(resolve, 300));[cite: 2]
        }
      }

      showToast("Sent to Discord!", "ok");[cite: 2]
    } catch (error) {
      console.error("Webhook Error:", error);[cite: 2]
      showToast("Failed to send data", "warn");[cite: 2]
    } finally {
      sendWebhookBtn.disabled = false;[cite: 2]
    }
  });

  /* ============================================================
     Send Panel Data (Firebase Database Push)
     ============================================================ */
  sendPanelBtn.addEventListener("click", async () => {
    const records = DB.getAttendance(); 
    
    if (records.length === 0) {
      showToast("No records to sync to panel", "warn");
      return;
    }

    if (typeof firebase === 'undefined') {
      showToast("Firebase SDK missing", "warn");
      return;
    }

    try {
      sendPanelBtn.disabled = true;
      showToast("Syncing to Teacher Panel...", "ok");

      const dbRef = firebase.database().ref("attendance");
      await dbRef.set(records);

      showToast("Teacher Panel Updated!", "ok");
    } catch (error) {
      console.error("Firebase Sync Error:", error);
      showToast("Failed to sync to panel", "warn");
    } finally {
      sendPanelBtn.disabled = false;
    }
  });

  /* ============================================================
     Toast
     ============================================================ */
  let toastTimer = null;[cite: 2]
  function showToast(message, type = "ok") {
    toast.textContent = message;[cite: 2]
    toast.className = "toast glass show " + type;[cite: 2]
    clearTimeout(toastTimer);[cite: 2]
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);[cite: 2]
  }

  /* ============================================================
     Ripple effect
     ============================================================ */
  function attachRipple() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn");[cite: 2]
      if (!btn) return;[cite: 2]
      const rect = btn.getBoundingClientRect();[cite: 2]
      const ripple = document.createElement("span");[cite: 2]
      const size = Math.max(rect.width, rect.height);[cite: 2]
      ripple.className = "ripple";[cite: 2]
      ripple.style.width = ripple.style.height = size + "px";[cite: 2]
      ripple.style.left = e.clientX - rect.left - size / 2 + "px";[cite: 2]
      ripple.style.top = e.clientY - rect.top - size / 2 + "px";[cite: 2]
      btn.appendChild(ripple);[cite: 2]
      setTimeout(() => ripple.remove(), 620);[cite: 2]
    });
  }

  /* ============================================================
     Auto-refresh stats/table every 20s while dashboard is open
     ============================================================ */
  setInterval(() => {
    if (!dashboardPage.classList.contains("hidden")) {[cite: 2]
      renderStats();[cite: 2]
      renderTable();[cite: 2]
    }
  }, 20000);

  document.addEventListener("DOMContentLoaded", boot);[cite: 2]
})();

if ("serviceWorker" in navigator) {[cite: 2]
    navigator.serviceWorker.register("service-worker.js");[cite: 2]
}