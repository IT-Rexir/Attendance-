/**
 * database.js
 * Jagobiao National High School Attendance System
 * ---------------------------------------------------
 * Thin persistence layer on top of window.localStorage.
 * Handles: student roster caching + attendance records.
 */

const DB = (() => {
  const KEYS = {
    STUDENTS: "jnhs_students",
    ATTENDANCE: "jnhs_attendance",
  };

  /* ---------------- Students ---------------- */

  async function loadStudents() {
    const cached = localStorage.getItem(KEYS.STUDENTS);
    if (cached) {
      try {
        return JSON.parse(cached);
      } catch (e) {
        /* fall through to re-fetch */
      }
    }
    const students = await fetchStudentsJSON();
    localStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
    return students;
  }

  async function fetchStudentsJSON() {
    const res = await fetch("students.json", { cache: "no-store" });
    if (!res.ok) throw new Error("Unable to load students.json");
    return await res.json();
  }

  async function refreshStudents() {
    const students = await fetchStudentsJSON();
    localStorage.setItem(KEYS.STUDENTS, JSON.stringify(students));
    return students;
  }

  function findByLRN(students, lrn) {
    const clean = String(lrn).replace(/\D/g, "");
    return students.find((s) => String(s.lrn).replace(/\D/g, "") === clean) || null;
  }

  /* ---------------- Attendance ---------------- */

  function getAttendance() {
    const raw = localStorage.getItem(KEYS.ATTENDANCE);
    if (!raw) return [];
    try {
      return JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }

  function saveAttendanceList(list) {
    localStorage.setItem(KEYS.ATTENDANCE, JSON.stringify(list));
  }

  function todayStr(date = new Date()) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }

  function hasAttendanceToday(lrn, date = new Date()) {
    const list = getAttendance();
    const today = todayStr(date);
    return list.some((r) => r.lrn === lrn && r.date === today);
  }

  function computeStatus(date = new Date()) {
    const h = date.getHours();
    const m = date.getMinutes();
    const minutes = h * 60 + m;
    const present_cutoff = 7 * 60 + 30; // 7:30 AM
    const late_cutoff = 8 * 60 + 0; // 8:00 AM
    if (minutes <= present_cutoff) return "Present";
    if (minutes <= late_cutoff) return "Late";
    return "Absent";
  }

  function recordAttendance(student, date = new Date()) {
    if (hasAttendanceToday(student.lrn, date)) {
      return { ok: false, reason: "duplicate" };
    }
    const list = getAttendance();
    const status = computeStatus(date);
    const entry = {
      id: `${student.lrn}_${date.getTime()}`,
      lrn: student.lrn,
      name: student.name,
      grade: student.grade,
      strand: student.strand,
      section: student.section,
      date: todayStr(date),
      time: date.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      }),
      status,
    };
    list.push(entry);
    saveAttendanceList(list);
    return { ok: true, entry };
  }

  function deleteAttendance(id) {
    const list = getAttendance().filter((r) => r.id !== id);
    saveAttendanceList(list);
  }

  function clearTodayAttendance(date = new Date()) {
    const today = todayStr(date);
    const list = getAttendance().filter((r) => r.date !== today);
    saveAttendanceList(list);
  }

  function clearAllAttendance() {
    saveAttendanceList([]);
  }

  return {
    KEYS,
    loadStudents,
    refreshStudents,
    findByLRN,
    getAttendance,
    saveAttendanceList,
    todayStr,
    hasAttendanceToday,
    computeStatus,
    recordAttendance,
    deleteAttendance,
    clearTodayAttendance,
    clearAllAttendance,
  };
})();

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
}