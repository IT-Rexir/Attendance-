/**
 * admin.js
 * Jagobiao National High School Attendance System
 * ---------------------------------------------------
 * Handles: admin authentication, dashboard stats,
 * attendance table rendering, search/filter, CSV export,
 * Discord Webhook push, and record deletion / clearing.
 */

(() => {
  "use strict";

  /* ---------- Config ---------- */
  // NOTE: Password is stored client-side as requested. For a real
  // deployment this should be replaced with a proper backend/auth service.
  const ADMIN_PASSWORD = "jnhs2026";
  const SESSION_KEY = "jnhs_admin_session";

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

    setTimeout(() => loadingScreen.classList.add("fade-out"), 700);

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

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  /* ============================================================
     Search / Filter events
     ============================================================ */
  let searchDebounce = null;
  searchInput.addEventListener("input", () => {
    clearTimeout(searchDebounce);
    searchDebounce = setTimeout(renderTable, 180);
  });

  dateFilter.addEventListener("change", () => {
    renderTable();
    renderStats();
  });

  clearFilterBtn.addEventListener("click", () => {
    searchInput.value = "";
    dateFilter.value = "";
    renderAll();
  });

  refreshBtn.addEventListener("click", async () => {
    await Students.refresh();
    renderAll();
    showToast("Data refreshed", "ok");
  });

  /* ============================================================
     Delete single record
     ============================================================ */
  tbody.addEventListener("click", (e) => {
    const btn = e.target.closest(".row-delete-btn");
    if (!btn) return;
    const id = btn.dataset.id;
    openModal({
      title: "Delete this record?",
      message: "This attendance entry will be permanently removed. This action cannot be undone.",
      confirmLabel: "Delete",
      onConfirm: () => {
        DB.deleteAttendance(id);
        renderAll();
        showToast("Record deleted", "ok");
      },
    });
  });

  /* ============================================================
     Clear today's attendance
     ============================================================ */
  clearTodayBtn.addEventListener("click", () => {
    openModal({
      title: "Clear today's attendance?",
      message: "All attendance records for today will be permanently deleted. This action cannot be undone.",
      confirmLabel: "Clear Today",
      onConfirm: () => {
        DB.clearTodayAttendance();
        renderAll();
        showToast("Today's attendance cleared", "ok");
      },
    });
  });

  /* ============================================================
     Modal helper
     ============================================================ */
  function openModal({ title, message, confirmLabel, onConfirm }) {
    modalTitle.textContent = title;
    modalMessage.textContent = message;
    modalConfirmBtn.textContent = confirmLabel || "Confirm";
    pendingModalAction = onConfirm;
    modalScrim.classList.add("show");
  }

  function closeModal() {
    modalScrim.classList.remove("show");
    pendingModalAction = null;
  }

  modalCancelBtn.addEventListener("click", closeModal);
  modalScrim.addEventListener("click", (e) => {
    if (e.target === modalScrim) closeModal();
  });
  modalConfirmBtn.addEventListener("click", () => {
    if (typeof pendingModalAction === "function") pendingModalAction();
    closeModal();
  });

  /* ============================================================
     CSV Export
     ============================================================ */
  exportCsvBtn.addEventListener("click", () => {
    const records = getFilteredRecords();
    if (records.length === 0) {
      showToast("No records to export", "warn");
      return;
    }
    const headers = ["Name", "LRN", "Grade", "Strand", "Section", "Date", "Time In", "Status"];
    const rows = records.map((r) => [r.name, r.lrn, r.grade, r.strand, r.section, r.date, r.time, r.status]);

    const csvContent =
      [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(","))
        .join("\r\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    const stamp = new Date().toISOString().slice(0, 10);
    link.href = url;
    link.download = `JNHS_Attendance_${stamp}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showToast("CSV exported", "ok");
  });

  /* ============================================================
     Webhook Sending (Optimized for Discord with Cors Proxy)
     ============================================================ */
  sendWebhookBtn.addEventListener("click", async () => {
    const records = getFilteredRecords();
    
    if (records.length === 0) {
      showToast("No records to send", "warn");
      return;
    }

    // Direct requests from web browsers are blocked by Discord CORS. Adding a public proxy resolves this instantly.
    const PROXY_URL = "https://corsproxy.io/?";
    const TARGET_WEBHOOK = "https://discord.com/api/webhooks/1518966001885118625/rCb5480x4HeE23vE4fhXGF6I_osHZHfPdPHMbEM4TKd0eSsKDzAviSZYBtu088s0uN9G";
    const FINAL_URL = PROXY_URL + encodeURIComponent(TARGET_WEBHOOK);

    try {
      sendWebhookBtn.disabled = true;
      showToast("Sending data...", "ok");

      // Generate the presentation lines
      const recordLines = records.map(r => 
        `• **${r.name}** (\`${r.lrn}\`) — ${r.grade || ''} ${r.strand || ''} [${r.status}] at *${r.time}*`
      );

      // Group rows to ensure no single message string breaks Discord's 2,000-character cap
      const batches = [];
      let currentBatch = `📊 **New Attendance Report Exported**\n**Total Records:** ${records.length}\n**Timestamp:** ${new Date().toLocaleString("en-PH")}\n\n`;

      for (const line of recordLines) {
        if ((currentBatch + line).length > 1900) {
          batches.push(currentBatch);
          currentBatch = "";
        }
        currentBatch += line + "\n";
      }
      if (currentBatch.trim().length > 0) {
        batches.push(currentBatch);
      }

      // Fire off the separate network batches sequentially 
      for (let i = 0; i < batches.length; i++) {
        const payload = { content: batches[i] };
        
        const response = await fetch(FINAL_URL, {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify(payload)
        });

        if (!response.ok && response.status !== 204) {
          throw new Error(`Server responded with status: ${response.status}`);
        }
        
        // Minor delay to prevent triggering Discord rate limits
        if (batches.length > 1) {
          await new Promise(resolve => setTimeout(resolve, 350));
        }
      }

      showToast("Sent to Discord!", "ok");
    } catch (error) {
      console.error("Webhook Error:", error);
      showToast("Failed to send data", "warn");
    } finally {
      sendWebhookBtn.disabled = false;
    }
  });

  /* ============================================================
     Toast
     ============================================================ */
  let toastTimer = null;
  function showToast(message, type = "ok") {
    toast.textContent = message;
    toast.className = "toast glass show " + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2400);
  }

  /* ============================================================
     Ripple effect
     ============================================================ */
  function attachRipple() {
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".btn");
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const ripple = document.createElement("span");
      const size = Math.max(rect.width, rect.height);
      ripple.className = "ripple";
      ripple.style.width = ripple.style.height = size + "px";
      ripple.style.left = e.clientX - rect.left - size / 2 + "px";
      ripple.style.top = e.clientY - rect.top - size / 2 + "px";
      btn.appendChild(ripple);
      setTimeout(() => ripple.remove(), 620);
    });
  }

  /* ============================================================
     Auto-refresh stats/table every 20s while dashboard is open
     (keeps admin view live if attendance is being scanned elsewhere)
     ============================================================ */
  setInterval(() => {
    if (!dashboardPage.classList.contains("hidden")) {
      renderStats();
      renderTable();
    }
  }, 20000);

  document.addEventListener("DOMContentLoaded", boot);
})();

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
}