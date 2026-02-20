// --- form.js (cleaned, behavior preserved) ---
document.addEventListener("DOMContentLoaded", () => {
  // Cache DOM references and guard existence
  const form = document.getElementById("inquiryForm");
  if (!form) return;

  const fullNameInput = document.getElementById("fullName");
  const mobileInput = document.getElementById("mobile");
  const emailInput = document.getElementById("email");
  const purposeSelect = document.getElementById("purpose");
  const responseMessage = document.getElementById("responseMessage");
  const cityInput = document.getElementById("city");
  const messageInput = document.getElementById("message");

  // Small safety helpers
  const getErrorEl = (field) => document.getElementById(`${field?.id}Error`);
  const show = (el) => {
    if (el) el.style.display = "block";
  };
  const hide = (el) => {
    if (el) el.style.display = "none";
  };

  // Validation functions (kept same logic)
  const validateName = (field) => field && field.value.trim().length >= 2;
  const validateMobile = (field) => {
    if (!field) return false;
    const mobileRegex = /^\d{10}$/;
    return mobileRegex.test(field.value.trim());
  };
  const validateEmail = (field) => {
    if (!field) return false;
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(field.value.trim());
  };
  const validatePurpose = (field) => field && field.value !== "";

  // Unified field validator & UI update
  function validateField(field, validator) {
    if (!field) return false;
    const isValid = Boolean(validator(field));
    const errorEl = getErrorEl(field);

    field.classList.toggle("valid", isValid);
    field.classList.toggle("error", !isValid);

    if (isValid) hide(errorEl);
    else show(errorEl);

    return isValid;
  }

  // Show response message (success/error)
  function showResponseMessage(message, type) {
    if (!responseMessage) return;
    responseMessage.textContent = message;
    responseMessage.className = `response-message ${type}`;
    responseMessage.style.display = "block";
    responseMessage.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  // Attach realtime validation if inputs exist
  if (fullNameInput)
    fullNameInput.addEventListener("input", () =>
      validateField(fullNameInput, validateName)
    );
  if (mobileInput)
    mobileInput.addEventListener("input", () =>
      validateField(mobileInput, validateMobile)
    );
  if (emailInput)
    emailInput.addEventListener("input", () =>
      validateField(emailInput, validateEmail)
    );
  if (purposeSelect)
    purposeSelect.addEventListener("change", () =>
      validateField(purposeSelect, validatePurpose)
    );

  // Submit handler
  form.addEventListener("submit", (e) => {
    e.preventDefault();

    const isNameValid = validateField(fullNameInput, validateName);
    const isMobileValid = validateField(mobileInput, validateMobile);
    const isEmailValid = validateField(emailInput, validateEmail);
    const isPurposeValid = validateField(purposeSelect, validatePurpose);

    if (isNameValid && isMobileValid && isEmailValid && isPurposeValid) {
      showResponseMessage(
        "Thank you for your inquiry! We will respond within 24 business hours.",
        "success"
      );

      // Log form data (unchanged)
      console.log("Form submitted with data:", {
        fullName: fullNameInput?.value || "",
        mobile: mobileInput?.value || "",
        email: emailInput?.value || "",
        city: cityInput?.value || "",
        purpose: purposeSelect?.value || "",
        message: messageInput?.value || "",
      });

      // Reset after delay (kept 5s visible then hidden)
      setTimeout(() => {
        form.reset();
        if (responseMessage) responseMessage.style.display = "none";

        // remove validation classes
        [fullNameInput, mobileInput, emailInput, purposeSelect].forEach((f) => {
          if (!f) return;
          f.classList.remove("valid", "error");
          const err = getErrorEl(f);
          if (err) hide(err);
        });
      }, 5000);
    } else {
      showResponseMessage(
        "Please correct the errors in the form before submitting.",
        "error"
      );
    }
  });

  // Mark optional labels with tooltip (kept)
  document.querySelectorAll(".optional").forEach((label) => {
    if (label && !label.title) label.title = "This field is optional";
  });
});


const sections = document.querySelectorAll("main > section, #contact");
const navLinks = document.querySelectorAll(".nav-link");
const mobileLinks = document.querySelectorAll(".mobile-link");

// map section id → nav href
const sectionToNavMap = {
  home: "home",
  products: "products",
  "products-more": "products", // page 3 also highlights Products
  about: "about",
  ourstory: "ourstory",
  contact: "contact",
};

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;

      const sectionId = entry.target.id;
      const navId = sectionToNavMap[sectionId];
      if (!navId) return;

      // desktop
      navLinks.forEach((link) => {
        link.classList.toggle(
          "active",
          link.getAttribute("href") === `#${navId}`
        );
      });

      // mobile
      mobileLinks.forEach((link) => {
        link.classList.toggle(
          "active",
          link.getAttribute("href") === `#${navId}`
        );
      });
    });
  },
  {
    root: null,
    rootMargin: "-45% 0px -45% 0px",
    threshold: 0,
  }
);

// observe
sections.forEach((section) => observer.observe(section));
