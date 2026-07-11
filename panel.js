/**
 * panel.js
 * Teacher Monitoring System Dashboard
 * Handles reactive reading from Firebase Database.
 */
(() => {
  "use strict";

  // Replace with your real Firebase Project configurations
  // Your exact Firebase Project configurations applied to the global instance
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

  firebase.initializeApp(firebaseConfig);
  const dbRef = firebase.database().ref("attendance");
  
  /* ---------- DOM refs ---------- */
  const loadingScreen = document.getElementById("loading-screen");
  const todayLabel = document.getElementById("today-label");
  const statPresent = document.getElementById("stat-present");
  const statTotal = document.getElementById("stat-total");
  const statLate = document.getElementById("stat-late");

  const searchInput = document.getElementById("search-input");
  const dateFilter = document.getElementById("date-filter");
  const clearFilterBtn = document.getElementById("clear-filter-btn");
  const exportCsvBtn = document.getElementById("export-csv-btn");
  const refreshBtn = document.getElementById("refresh-btn");

  const tbody = document.getElementById("attendance-tbody");
  const emptyState = document.getElementById("empty-state");
  const toast = document.getElementById("toast");

  /* ---------- State ---------- */
  let firebaseRecords = [];

  function boot() {
    initDateFilterDefault();
    updateTodayLabel();
    
    // Listen to database shifts live
    dbRef.on("value", (snapshot) => {
      const data = snapshot.val();
      // Parse object maps or arrays safely out of Firebase
      firebaseRecords = data ? Object.values(data) : [];
      renderAll();
      
      if(loadingScreen) {
        loadingScreen.classList.add("fade-out");
      }
    }, (error) => {
      console.error(error);
      showToast("Failed to fetch live database sync", "warn");
    });
  }

  function initDateFilterDefault() {
    const now = new Date();
    const yyyy = now.getFullYear();
    const mm = String(now.getMonth() + 1).padStart(2, '0');
    const dd = String(now.getDate()).padStart(2, '0');
    dateFilter.value = `${yyyy}-${mm}-${dd}`;
  }

  function updateTodayLabel() {
    todayLabel.textContent = new Date().toLocaleDateString("en-PH", {
      weekday: "long", year: "numeric", month: "long", day: "numeric"
    });
  }

  function renderAll() {
    renderStats();
    renderTable();
  }

  function renderStats() {
    const targetDate = dateFilter.value;
    const dayRecords = firebaseRecords.filter(r => r.date === targetDate);

    const presentCount = dayRecords.filter(r => r.status === "Present").length;
    const lateCount = dayRecords.filter(r => r.status === "Late").length;

    statPresent.textContent = presentCount;
    statTotal.textContent = firebaseRecords.length;
    statLate.textContent = lateCount;
  }

  function getFilteredRecords() {
    let records = [...firebaseRecords].sort((a, b) => (a.date + a.time < b.date + b.time ? 1 : -1));

    if (dateFilter.value) {
      records = records.filter((r) => r.date === dateFilter.value);
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

    records.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
        <td>${escapeHTML(r.name)}</td>
        <td>${escapeHTML(r.lrn)}</td>
        <td>${escapeHTML(r.grade || "—")}</td>
        <td>${escapeHTML(r.strand || "—")}</td>
        <td>${escapeHTML(r.section || "—")}</td>
        <td>${escapeHTML(r.date)}</td>
        <td>${escapeHTML(r.time)}</td>
        <td><span class="status-badge ${r.status}">${r.status}</span></td>
      `;
      tbody.appendChild(tr);
    });
  }

  function escapeHTML(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  // Action listeners
  searchInput.addEventListener("input", renderTable);
  dateFilter.addEventListener("change", renderAll);
  
  clearFilterBtn.addEventListener("click", () => {
    searchInput.value = "";
    initDateFilterDefault();
    renderAll();
  });

  refreshBtn.addEventListener("click", () => {
    showToast("Data view updated", "ok");
    renderAll();
  });

  exportCsvBtn.addEventListener("click", () => {
    const records = getFilteredRecords();
    if (records.length === 0) return showToast("No rows to export", "warn");
    
    const headers = ["Name", "LRN", "Grade", "Strand", "Section", "Date", "Time In", "Status"];
    const csvContent = [headers, ...records.map(r => [r.name, r.lrn, r.grade, r.strand, r.section, r.date, r.time, r.status])]
      .map(e => e.map(val => `"${String(val ?? '').replace(/"/g, '""')}"`).join(","))
      .join("\r\n");

    const blob = new Blob(["\ufeff" + csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `Teacher_Attendance_Export.csv`;
    link.click();
    showToast("CSV saved!", "ok");
  });

  function showToast(msg, type = "ok") {
    toast.textContent = msg;
    toast.className = `toast glass show ${type}`;
    setTimeout(() => toast.classList.remove("show"), 2000);
  }

  document.addEventListener("DOMContentLoaded", boot);
})();
