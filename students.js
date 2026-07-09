/**
 * students.js
 * Jagobiao National High School Attendance System
 * ---------------------------------------------------
 * Student roster manager. Wraps DB student calls, provides
 * search/filter helpers used by both the scanner and the
 * admin dashboard.
 */

const Students = (() => {
  let cache = [];
  let loaded = false;

  async function init() {
    cache = await DB.loadStudents();
    loaded = true;
    return cache;
  }

  async function refresh() {
    cache = await DB.refreshStudents();
    loaded = true;
    return cache;
  }

  function all() {
    return cache;
  }

  function isLoaded() {
    return loaded;
  }

  function byLRN(lrn) {
    return DB.findByLRN(cache, lrn);
  }

  /**
   * Extracts a plausible LRN (12-digit PH Learner Reference Number)
   * from raw OCR text. Falls back to the longest digit run >= 10
   * if no exact 12-digit match is found.
   */
  function extractLRN(rawText) {
    if (!rawText) return null;
    const cleaned = rawText.replace(/[^0-9]/g, " ");
    const tokens = cleaned.split(/\s+/).filter(Boolean);

    // Prefer an exact 12-digit LRN
    const exact = tokens.find((t) => t.length === 12);
    if (exact) return exact;

    // Otherwise, try to stitch together digit fragments that appear
    // consecutively in the original text (OCR sometimes splits numbers).
    const allDigits = rawText.replace(/[^0-9]/g, "");
    const twelveDigitMatch = allDigits.match(/\d{12}/);
    if (twelveDigitMatch) return twelveDigitMatch[0];

    // Fallback: longest digit run of at least 10 digits
    const longest = tokens
      .filter((t) => t.length >= 10)
      .sort((a, b) => b.length - a.length)[0];
    return longest || null;
  }

  function search(query) {
    const q = query.trim().toLowerCase();
    if (!q) return cache;
    return cache.filter(
      (s) =>
        s.name.toLowerCase().includes(q) ||
        String(s.lrn).includes(q) ||
        (s.section && s.section.toLowerCase().includes(q)) ||
        (s.strand && s.strand.toLowerCase().includes(q))
    );
  }

  return { init, refresh, all, isLoaded, byLRN, extractLRN, search };
})();

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
}