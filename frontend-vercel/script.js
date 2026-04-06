// ============================================================
//  script.js — Public Lead Form Logic
//  Replace BACKEND_URL with your live Railway URL before deploy
// ============================================================

const BACKEND_URL = "https://researchpaperservice-production.up.railway.app";

// ---- DOM refs ----
const form       = document.getElementById("order-form");
const submitBtn  = document.getElementById("submit-btn");
const btnText    = document.getElementById("btn-text");
const successBlock = document.getElementById("success-block");
const fileInput  = document.getElementById("draftFile");
const fileLabel  = document.getElementById("file-label");
const fileZone   = document.getElementById("file-zone");

// Toggle refs
const toggleBtn = document.getElementById("toggle-details-btn");
const optionalSection = document.getElementById("optional-section");
const toggleIcon = document.getElementById("toggle-icon");

// ---- Toggle Optional Details Logic ----
if (toggleBtn && optionalSection && toggleIcon) {
  toggleBtn.addEventListener('click', () => {
    // Toggle visibility
    optionalSection.classList.toggle('hidden');
    
    // Change the + to a — when open
    if (optionalSection.classList.contains('hidden')) {
      toggleIcon.textContent = '+';
    } else {
      toggleIcon.textContent = '—';
    }
  });
}

// ---- File drag-over visual ----
if (fileZone) {
  fileZone.addEventListener("dragover", (e) => {
    e.preventDefault();
    fileZone.classList.add("drag-over");
  });
  fileZone.addEventListener("dragleave", () => {
    fileZone.classList.remove("drag-over");
  });
  fileZone.addEventListener("drop", () => {
    fileZone.classList.remove("drag-over");
  });
}

// ---- File name display ----
if (fileInput) {
  fileInput.addEventListener("change", () => {
    const file = fileInput.files[0];
    if (file) {
      fileLabel.textContent = file.name;
      fileLabel.style.color = "#0A0A0A";
    } else {
      fileLabel.textContent = "Drop file here or click to browse";
      fileLabel.style.color = "";
    }
  });
}

// ---- Validation helpers ----
function clearErrors() {
  document.querySelectorAll(".error-msg").forEach(el => el.textContent = "");
  document.querySelectorAll(".field-error").forEach(el => el.classList.remove("field-error"));
}

function showError(fieldId, message) {
  const input = document.getElementById(fieldId);
  const errorEl = document.getElementById("err-" + fieldId);
  if (input) input.classList.add("field-error");
  if (errorEl) errorEl.textContent = message;
}

function validateForm(data) {
  let valid = true;

  if (!data.fullName.trim()) {
    showError("fullName", "Full name is required.");
    valid = false;
  }

  const phone = data.phone.trim();
  if (!phone) {
    showError("phone", "Phone / WhatsApp number is required.");
    valid = false;
  } else if (!/^\+?[\d\s\-().]{7,20}$/.test(phone)) {
    showError("phone", "Enter a valid phone number.");
    valid = false;
  }

  if (!data.topic.trim()) {
    showError("topic", "Paper topic is required.");
    valid = false;
  }

  return valid;
}

// ---- Loading state ----
function setLoading(loading) {
  if (loading) {
    submitBtn.disabled = true;
    btnText.innerHTML = '<span class="spinner"></span>Submitting...';
  } else {
    submitBtn.disabled = false;
    btnText.textContent = "Submit Formatting Request";
  }
}

// ---- Form submit ----
if (form) {
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    clearErrors();

    const rawData = {
      fullName:      document.getElementById("fullName").value,
      phone:         document.getElementById("phone").value,
      topic:         document.getElementById("topic").value,
    };

    if (!validateForm(rawData)) return;

    setLoading(true);

    try {
      const formData = new FormData();
      formData.append("full_name",        rawData.fullName.trim());
      formData.append("phone",            rawData.phone.trim());
      formData.append("topic",            rawData.topic.trim());

      // Optional fields — only append if non-empty
      const formattingType = document.getElementById("formattingType").value;
      if (formattingType) formData.append("formatting_type", formattingType);

      const instructions = document.getElementById("instructions").value.trim();
      if (instructions) formData.append("instructions", instructions);

      const file = fileInput?.files[0];
      if (file) formData.append("draft_file", file);

      const response = await fetch(`${BACKEND_URL}/orders`, {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(errData.detail || `Server error: ${response.status}`);
      }

      // Success — hide form, show success message
      form.style.display = "none";
      successBlock.style.display = "block";
      window.scrollTo({ top: successBlock.offsetTop - 80, behavior: "smooth" });

    } catch (err) {
      console.error("Submission error:", err);
      // Show a generic top-level error on the button area
      btnText.textContent = "Submission Failed — Try Again";
      submitBtn.style.borderColor = "#CC2200";
      submitBtn.style.background = "#CC2200";
      setTimeout(() => {
        submitBtn.style.borderColor = "";
        submitBtn.style.background = "";
        btnText.textContent = "Submit Formatting Request";
      }, 3000);
    } finally {
      setLoading(false);
    }
  });
}
