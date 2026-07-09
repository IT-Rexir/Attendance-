/**
 * scanner.js
 * Jagobiao National High School Attendance System
 * ---------------------------------------------------
 * Handles: loading screen, camera access, continuous OCR
 * scanning (Tesseract.js), LRN matching, confirmation sheet,
 * attendance recording, and success feedback.
 */

(() => {
  "use strict";

  /* ---------- DOM refs ---------- */
  const loadingScreen = document.getElementById("loading-screen");
  const video = document.getElementById("camera-feed");
  const canvas = document.getElementById("capture-canvas");
  const cameraBlocker = document.getElementById("camera-blocker");
  const blockerTitle = document.getElementById("blocker-title");
  const blockerMessage = document.getElementById("blocker-message");
  const retryCameraBtn = document.getElementById("retry-camera-btn");

  const scanStatus = document.getElementById("scan-status");
  const scanStatusText = document.getElementById("scan-status-text");
  const clockDisplay = document.getElementById("clock-display");

  const sheetScrim = document.getElementById("sheet-scrim");
  const confirmSheet = document.getElementById("confirm-sheet");
  const confirmPhoto = document.getElementById("confirm-photo");
  const confirmName = document.getElementById("confirm-name");
  const confirmLRN = document.getElementById("confirm-lrn");
  const confirmGrade = document.getElementById("confirm-grade");
  const confirmStrand = document.getElementById("confirm-strand");
  const confirmSection = document.getElementById("confirm-section");
  const confirmDate = document.getElementById("confirm-date");
  const confirmTime = document.getElementById("confirm-time");
  const confirmBtn = document.getElementById("confirm-btn");
  const cancelBtn = document.getElementById("cancel-btn");
  const duplicateBanner = document.getElementById("duplicate-banner");

  const successOverlay = document.getElementById("success-overlay");
  const successName = document.getElementById("success-name");
  const successStatusTag = document.getElementById("success-status-tag");
  const countdownNum = document.getElementById("countdown-num");
  const successSound = document.getElementById("success-sound");

  const toast = document.getElementById("toast");

  /* ---------- State ---------- */
  let stream = null;
  let scanning = false;
  let ocrBusy = false;
  let scanLoopHandle = null;
  let pendingStudent = null;
  let pendingDuplicate = false;
  let tesseractWorker = null;

  /* ============================================================
     Loading screen
     ============================================================ */
  async function boot() {
    attachRippleToButtons();
    startClock();
    try {
      await Students.init();
    } catch (e) {
      console.error(e);
      showToast("Failed to load student database.", "error");
    }

    await initOCRWorker();
    await startCamera();

    // minimum splash duration for a polished feel
    setTimeout(() => {
      loadingScreen.classList.add("fade-out");
    }, 900);
  }

  function startClock() {
    const tick = () => {
      const now = new Date();
      clockDisplay.textContent = now.toLocaleTimeString("en-PH", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
    };
    tick();
    setInterval(tick, 1000 * 15);
  }

  /* ============================================================
     OCR worker (Tesseract.js)
     ============================================================ */
  async function initOCRWorker() {
    try {
      tesseractWorker = await Tesseract.createWorker("eng", 1, {
        logger: () => {},
      });
      await tesseractWorker.setParameters({
        tessedit_char_whitelist: "0123456789LRNlrn: ",
      });
    } catch (e) {
      console.error("OCR init failed", e);
    }
  }

  /* ============================================================
     Camera
     ============================================================ */
  async function startCamera() {
    setScanStatus("Requesting camera permission…");
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
      video.srcObject = stream;
      await video.play();

      // Attempt continuous autofocus if supported
      const [track] = stream.getVideoTracks();
      const capabilities = track.getCapabilities ? track.getCapabilities() : {};
      if (capabilities.focusMode && capabilities.focusMode.includes("continuous")) {
        try {
          await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
        } catch (e) {
          /* not fatal */
        }
      }

      cameraBlocker.classList.add("hidden");
      setScanStatus("Scanning for Student ID…");
      scanning = true;
      scheduleNextScan();
    } catch (err) {
      console.error(err);
      handleCameraError(err);
    }
  }

  function handleCameraError(err) {
    scanning = false;
    let msg =
      "This scanner needs access to your rear camera to read student IDs. Please allow camera permission and reload the page.";
    if (err && err.name === "NotAllowedError") {
      blockerTitle.textContent = "Camera Permission Denied";
      msg = "You blocked camera access. Enable it in your browser settings, then try again.";
    } else if (err && err.name === "NotFoundError") {
      blockerTitle.textContent = "No Camera Found";
      msg = "We couldn't detect a camera on this device.";
    } else {
      blockerTitle.textContent = "Camera Access Needed";
    }
    blockerMessage.textContent = msg;
    cameraBlocker.classList.remove("hidden");
    setScanStatus("Camera unavailable");
  }

  retryCameraBtn.addEventListener("click", () => {
    cameraBlocker.classList.add("hidden");
    startCamera();
  });

  /* ============================================================
     Continuous scan loop
     ============================================================ */
  function scheduleNextScan() {
    if (scanLoopHandle) clearTimeout(scanLoopHandle);
    scanLoopHandle = setTimeout(runScanCycle, 1600);
  }

  async function runScanCycle() {
    if (confirmSheet.classList.contains("show")) {
      // pause scanning while the confirmation sheet is open
      scheduleNextScan();
      return;
    }
    if (!scanning || ocrBusy || !tesseractWorker) {
      scheduleNextScan();
      return;
    }

    ocrBusy = true;
    setScanStatus("Reading ID…");

    try {
      const frame = captureFrame();
      if (frame) {
        const {
          data: { text },
        } = await tesseractWorker.recognize(frame);
        const lrn = Students.extractLRN(text);
        if (lrn) {
          const student = Students.byLRN(lrn);
          if (student) {
            handleStudentFound(student);
            ocrBusy = false;
            return; // don't reschedule until sheet is dismissed
          } else {
            setScanStatus("ID not recognized. Adjust and hold steady…");
          }
        } else {
          setScanStatus("Scanning for Student ID…");
        }
      }
    } catch (e) {
      console.error("OCR error", e);
      setScanStatus("Scanning for Student ID…");
    }

    ocrBusy = false;
    scheduleNextScan();
  }

  function captureFrame() {
    if (!video.videoWidth) return null;
    // Crop to the visible scan-frame region (center card area) for higher OCR accuracy
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    const cropWidthRatio = 0.82;
    const cropHeightRatio = 0.82 / 1.586; // matches .scan-frame aspect ratio

    const cw = Math.min(vw * cropWidthRatio, vw);
    const ch = Math.min(vh * cropHeightRatio * 1.3, vh);
    const cx = (vw - cw) / 2;
    const cy = (vh - ch) / 2;

    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, cx, cy, cw, ch, 0, 0, cw, ch);
    return canvas;
  }

  function setScanStatus(text) {
    scanStatusText.textContent = text;
  }

  /* ============================================================
     Student found -> show confirmation sheet
     ============================================================ */
  function handleStudentFound(student) {
    scanning = false; // pause scanning while user confirms
    pendingStudent = student;

    const now = new Date();
    pendingDuplicate = DB.hasAttendanceToday(student.lrn, now);

    confirmPhoto.src = student.photo || "assets/default-avatar.png";
    confirmPhoto.onerror = () => (confirmPhoto.src = "assets/default-avatar.png");
    confirmName.textContent = student.name;
    confirmLRN.textContent = student.lrn;
    confirmGrade.textContent = student.grade || "—";
    confirmStrand.textContent = student.strand || "—";
    confirmSection.textContent = student.section || "—";
    confirmDate.textContent = now.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
    confirmTime.textContent = now.toLocaleTimeString("en-PH", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: true,
    });

    duplicateBanner.classList.toggle("hidden", !pendingDuplicate);
    confirmBtn.textContent = pendingDuplicate ? "Already Recorded" : "Confirm";
    confirmBtn.disabled = pendingDuplicate;

    openSheet();
  }

  function openSheet() {
    sheetScrim.classList.add("show");
    confirmSheet.classList.add("show");
  }

  function closeSheet() {
    sheetScrim.classList.remove("show");
    confirmSheet.classList.remove("show");
  }

  cancelBtn.addEventListener("click", () => {
    closeSheet();
    resumeScanning();
  });

  sheetScrim.addEventListener("click", () => {
    closeSheet();
    resumeScanning();
  });

  confirmBtn.addEventListener("click", () => {
    if (!pendingStudent || pendingDuplicate) return;
    const result = DB.recordAttendance(pendingStudent, new Date());
    if (!result.ok) {
      showToast("Already Recorded Today", "warn");
      closeSheet();
      resumeScanning();
      return;
    }
    closeSheet();
    showSuccess(result.entry);
  });

  function resumeScanning() {
    pendingStudent = null;
    setTimeout(() => {
      scanning = true;
      setScanStatus("Scanning for Student ID…");
      scheduleNextScan();
    }, 300);
  }

  /* ============================================================
     Success popup
     ============================================================ */
  function showSuccess(entry) {
    successName.textContent = `${entry.name} • ${entry.lrn}`;
    successStatusTag.textContent = entry.status;
    successStatusTag.className = "success-status-tag tag-" + entry.status.toLowerCase();

    try {
      successSound.currentTime = 0;
      successSound.play().catch(() => {});
    } catch (e) {
      /* audio may be blocked until user gesture; non-fatal */
    }

    successOverlay.classList.add("show");

    let count = 3;
    countdownNum.textContent = count;
    const countdownTimer = setInterval(() => {
      count -= 1;
      countdownNum.textContent = Math.max(count, 0);
      if (count <= 0) clearInterval(countdownTimer);
    }, 1000);

    setTimeout(() => {
      successOverlay.classList.remove("show");
      resumeScanning();
    }, 3000);
  }

  /* ============================================================
     Toast
     ============================================================ */
  let toastTimer = null;
  function showToast(message, type = "ok") {
    toast.textContent = message;
    toast.className = "toast glass show " + type;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 2600);
  }

  /* ============================================================
     Ripple effect for buttons
     ============================================================ */
  function attachRippleToButtons() {
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
     Init
     ============================================================ */
  document.addEventListener("DOMContentLoaded", boot);
})();

if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js");
}