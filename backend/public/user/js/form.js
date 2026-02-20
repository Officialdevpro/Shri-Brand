// --- form.js ---

document.addEventListener("DOMContentLoaded", () => {
  const BASE_URL = "http://localhost:5000/api/v1";

  // ── DOM refs ──────────────────────────────────────────
  const form            = document.getElementById("inquiryForm");
  if (!form) return;

  const fullNameInput   = document.getElementById("fullName");
  const mobileInput     = document.getElementById("mobile");
  const emailInput      = document.getElementById("email");
  const cityInput       = document.getElementById("city");
  const purposeSelect   = document.getElementById("purpose");
  const messageInput    = document.getElementById("message");
  const submitBtn       = form.querySelector(".submit-btn");
  const responseMessage = document.getElementById("responseMessage");

  // ── Helpers ───────────────────────────────────────────
  const getErrorEl = (field) => field && document.getElementById(`${field.id}Error`);
  const show = (el) => { if (el) el.style.display = "block"; };
  const hide = (el) => { if (el) el.style.display = "none"; };

  // ── Validators ────────────────────────────────────────
  const validateName    = (f) => f && f.value.trim().length >= 2 && f.value.trim().length <= 100;
  const validateMobile  = (f) => f && /^\d{10}$/.test(f.value.trim());
  const validateEmail   = (f) => f && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.value.trim());
  const validatePurpose = (f) => f && f.value !== "";

  // ── Field UI update ───────────────────────────────────
  function validateField(field, validator) {
    if (!field) return false;
    const isValid = Boolean(validator(field));
    const errorEl = getErrorEl(field);
    field.classList.toggle("valid", isValid);
    field.classList.toggle("error", !isValid);
    isValid ? hide(errorEl) : show(errorEl);
    return isValid;
  }

  // ── Response banner ───────────────────────────────────
  function showResponseMessage(message, type) {
    if (!responseMessage) return;
    responseMessage.textContent = message;
    responseMessage.className = `response-message ${type}`;
    responseMessage.style.display = "block";
    responseMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // ── Submit button loading state ───────────────────────
  function setSubmitting(loading) {
    if (!submitBtn) return;
    submitBtn.disabled = loading;
    submitBtn.innerHTML = loading
      ? `<i class="fas fa-spinner fa-spin" aria-hidden="true"></i> Submitting...`
      : `<i class="fas fa-paper-plane" aria-hidden="true"></i> Submit Inquiry`;
  }

  // ── Reset form ────────────────────────────────────────
  function resetForm() {
    form.reset();
    if (responseMessage) responseMessage.style.display = "none";
    [fullNameInput, mobileInput, emailInput, purposeSelect].forEach((f) => {
      if (!f) return;
      f.classList.remove("valid", "error");
      hide(getErrorEl(f));
    });
  }

  // ── Realtime validation ───────────────────────────────
  if (fullNameInput)  fullNameInput.addEventListener("input",  () => validateField(fullNameInput, validateName));
  if (mobileInput)    mobileInput.addEventListener("input",    () => validateField(mobileInput, validateMobile));
  if (emailInput)     emailInput.addEventListener("input",     () => validateField(emailInput, validateEmail));
  if (purposeSelect)  purposeSelect.addEventListener("change", () => validateField(purposeSelect, validatePurpose));

  // ── Submit ────────────────────────────────────────────
  form.addEventListener("submit", async (e) => {
    e.preventDefault();

    // Validate all required fields
    const isNameValid    = validateField(fullNameInput, validateName);
    const isMobileValid  = validateField(mobileInput, validateMobile);
    const isEmailValid   = validateField(emailInput, validateEmail);
    const isPurposeValid = validateField(purposeSelect, validatePurpose);

    if (!isNameValid || !isMobileValid || !isEmailValid || !isPurposeValid) {
      showResponseMessage("Please correct the highlighted fields before submitting.", "error");
      return;
    }

    // Build payload — keys match backend inquiryModel exactly
    const payload = {
      fullName:         fullNameInput.value.trim(),
      mobileNumber:     mobileInput.value.trim(),
      email:            emailInput.value.trim().toLowerCase(),
      purposeOfInquiry: purposeSelect.value,
    };

    // Only include optional fields if they have a value
    const city = cityInput?.value.trim();
    const msg  = messageInput?.value.trim();
    if (city) payload.cityRegion = city;
    if (msg)  payload.message    = msg;

    // Send to backend
    setSubmitting(true);

    try {
      const res = await fetch(`${BASE_URL}/inquiries`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (res.ok) {
        // 201 success
        showResponseMessage(
          data.message || "Thank you for your inquiry! We will respond within 24–48 business hours.",
          "success"
        );
        // Reset form after 5 seconds
        setTimeout(resetForm, 5000);
      } else {
        // Backend returned a validation/operational error
        showResponseMessage(
          data.message || "Something went wrong. Please try again.",
          "error"
        );
      }
    } catch (err) {
      // Network error — server unreachable
      console.error("Inquiry submission error:", err);
      showResponseMessage(
        "Unable to reach the server. Please check your connection and try again.",
        "error"
      );
    } finally {
      setSubmitting(false);
    }
  });

  // Mark optional labels with tooltip
  document.querySelectorAll(".optional").forEach((label) => {
    if (label && !label.title) label.title = "This field is optional";
  });
});

// ── Scroll spy (unchanged) ────────────────────────────────
const sections   = document.querySelectorAll("main > section, #contact");
const navLinks   = document.querySelectorAll(".nav-link");
const mobileLinks = document.querySelectorAll(".mobile-link");

const sectionToNavMap = {
  home:           "home",
  products:       "products",
  "products-more":"products",
  about:          "about",
  ourstory:       "ourstory",
  contact:        "contact",
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const navId = sectionToNavMap[entry.target.id];
      if (!navId) return;
      navLinks.forEach((link) =>
        link.classList.toggle("active", link.getAttribute("href") === `#${navId}`)
      );
      mobileLinks.forEach((link) =>
        link.classList.toggle("active", link.getAttribute("href") === `#${navId}`)
      );
    });
  },
  { root: null, rootMargin: "-45% 0px -45% 0px", threshold: 0 }
);

sections.forEach((section) => observer.observe(section));