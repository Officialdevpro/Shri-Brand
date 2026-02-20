// --- app.js (cleaned & optimized) ---
/* eslint-disable no-unused-vars */
document.addEventListener("DOMContentLoaded", () => {
  // ---------- Cached selectors ----------
  const log = (...args) => console.log(...args);
  log("Project Loaded Successfully!");



  const clickBtn = document.getElementById("clickBtn");
  if (clickBtn) {
    clickBtn.addEventListener("click", () => alert("Button Clicked!"));
  }

  const menuToggle = document.getElementById("menu-toggle");
  const menuLabel = document.querySelector(".menu-label");
  const mobileMenu = document.getElementById("mobile-menu");
  const mobileLinks = mobileMenu ? mobileMenu.querySelectorAll("a") : [];

  // ---------- Utility: animate counter ----------
  function animateCount(el, target, duration = 1400) {
    const start = 0;
    const end = parseFloat(target);
    const startTime = performance.now();

    function tick(now) {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3); // easeOutCubic
      const current = Math.floor(start + (end - start) * eased);

      // keep decimal if target has fraction
      el.textContent = end % 1 !== 0 ? (end * progress).toFixed(1) : current;

      if (progress < 1) requestAnimationFrame(tick);
      else el.textContent = target; // ensure exact final value
    }
    requestAnimationFrame(tick);
  }

  // ---------- Counters observer ----------
  (function initCounters() {
    const counters = document.querySelectorAll(".counter .num");
    if (!counters.length || typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries, observer) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          const numEl = entry.target;
          const parent = numEl.closest(".counter");
          if (parent) parent.classList.add("float");

          if (!numEl.dataset.animated) {
            const target = numEl.dataset.target || numEl.textContent;
            animateCount(numEl, target);
            numEl.dataset.animated = "true";
          }
          observer.unobserve(numEl);
        });
      },
      { threshold: 0.5 }
    );

    counters.forEach((c) => obs.observe(c));
  })();

  // ---------- Mobile Sidebar Logic ----------
  const mobileToggleBtn = document.getElementById("menu-toggle");
  const sidebar = document.getElementById("sidebar");
  const overlay = document.getElementById("mobile-overlay");
  const navLinks = sidebar ? sidebar.querySelectorAll(".nav-item") : [];

  function toggleSidebar(show) {
    if (!sidebar || !overlay) return;
    const icon = mobileToggleBtn.querySelector("i");

    if (show) {
      sidebar.classList.add("active");
      overlay.classList.add("active");
      document.body.classList.add("no-scroll");
      if (icon) {
        icon.classList.remove("fa-bars");
        icon.classList.add("fa-times");
      }
    } else {
      sidebar.classList.remove("active");
      overlay.classList.remove("active");
      document.body.classList.remove("no-scroll");
      if (icon) {
        icon.classList.remove("fa-times");
        icon.classList.add("fa-bars");
      }
    }
  }

  // Expose to window for inline onclicks if any
  window.closeSidebar = () => toggleSidebar(false);

  if (mobileToggleBtn && sidebar && overlay) {
    // Toggle button click
    mobileToggleBtn.addEventListener("click", (e) => {
      e.stopPropagation(); // prevent immediate close if bubbling
      const isActive = sidebar.classList.contains("active");
      toggleSidebar(!isActive);
    });

    // Close on overlay click
    overlay.addEventListener("click", () => toggleSidebar(false));

    // Close on link click with smooth navigation delay
    navLinks.forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault(); // Stop immediate jump
        const href = link.getAttribute("href");

        // 1. Close Sidebar first
        toggleSidebar(false);

        // 2. Wait for sidebar transition (350ms) before navigating
        setTimeout(() => {
          if (!href) return;

          if (href.startsWith("#")) {
            // Smooth scroll to section
            const targetId = href.substring(1);
            const targetSection = document.getElementById(targetId);
            if (targetSection) {
              targetSection.scrollIntoView({ behavior: "smooth", block: "start" });
              // Optional: update URL hash without jump
              history.pushState(null, null, href);
            }
          } else {
            // Navigate to new page
            window.location.href = href;
          }
        }, 350); // Matches CSS transition duration
      });
    });

    // Close when clicking anywhere outside (backup for overlay)
    document.addEventListener("click", (e) => {
      if (
        sidebar.classList.contains("active") &&
        !sidebar.contains(e.target) &&
        !mobileToggleBtn.contains(e.target)
      ) {
        toggleSidebar(false);
      }
    });
  }

  // ---------- Story cards & summary ----------
  const storyData = [
    {
      number: "01",
      title: "Offered at South Indian Temples",
      text: "Devotees and priests offer fresh flowers—rose, jasmine, champa, sambrani—during archana and festivals. These sacred blooms fill temples with divine fragrance and devotion.",
    },
    {
      number: "02",
      title: "Respectfully Collected",
      text: "Before flowers are discarded, our team collects them from partnered temples with reverence, ensuring spiritual sanctity is preserved while preventing floral waste.",
    },
    {
      number: "03",
      title: "Gently Dried & Hand-Processed",
      text: "Flowers are dried under controlled conditions and blended with sandalwood, rose, jasmine, and natural aromatics. No synthetic chemicals. No charcoal binding.",
    },
    {
      number: "04",
      title: "Rolled into 'Shri' Agarbathi",
      text: "Skilled artisans hand-roll each 9-inch stick. The final agarbathi retains temple purity and gives 45 minutes of continuous divine fragrance.",
    },
  ];

  const summaryText =
    "Carbon-free, temple-flower based, and crafted for daily puja, meditation, celebrations, and spiritual gatherings.";

  const container = document.getElementById("storyContainer");
  const summaryBox = document.getElementById("summaryBox");
  if (container) {
    // create all cards in a document fragment
    const frag = document.createDocumentFragment();
    storyData.forEach((item) => {
      const card = document.createElement("div");
      card.className = "story-card fade-up";
      card.innerHTML = `
        <div class="story-number">${item.number}</div>
        <div class="story-title">${item.title}</div>
        <div class="story-line"></div>
        <p class="story-text">${item.text}</p>
      `;
      frag.appendChild(card);
    });
    container.appendChild(frag);
  }
  if (summaryBox) summaryBox.innerText = summaryText;

  // ---------- Reveal / fade-up observer ----------
  (function initReveal() {
    const revealElements = document.querySelectorAll(".fade-up");
    if (!revealElements.length || typeof IntersectionObserver === "undefined")
      return;

    const revealObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("visible");
        });
      },
      { threshold: 0.2 }
    );
    revealElements.forEach((el) => revealObserver.observe(el));
  })();

  // ---------- Header visibility based on hero ----------
  (function initHeaderObserver() {
    const header = document.querySelector(".site-header");
    const firstSection = document.querySelector(
      "main > section:nth-of-type(1)"
    );
    if (!header || !firstSection || typeof IntersectionObserver === "undefined")
      return;

    const headerObs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            header.style.opacity = "1";
            header.style.pointerEvents = "auto";
          } else {
            header.style.opacity = "1";
            // header.style.pointerEvents = "none";
          }
        });
      },
      { threshold: 0.12 }
    );
    headerObs.observe(firstSection);
  })();




  // ---------- About section animations & stagger ----------
  (function initAboutAnimations() {
    const aboutSection = document.querySelector(".about-section");
    if (!aboutSection || typeof IntersectionObserver === "undefined") return;

    const obs = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) entry.target.classList.add("animated");
        });
      },
      { threshold: 0.1 }
    );
    obs.observe(aboutSection);

    // stagger delays
    const pointCards = document.querySelectorAll(".point-card");
    pointCards.forEach(
      (card, i) => (card.style.animationDelay = `${0.3 + i * 0.1}s`)
    );

    const highlightCards = document.querySelectorAll(".highlight-card");
    highlightCards.forEach(
      (card, i) => (card.style.animationDelay = `${0.5 + i * 0.1}s`)
    );
  })();

  // ---------- scrollToContact helper ----------
  window.scrollToContact = function scrollToContact() {
    const contactSection =
      document.getElementById("contact") || document.querySelector("footer");
    if (contactSection) {
      contactSection.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    // fallback toast
    const alertDiv = document.createElement("div");
    alertDiv.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: linear-gradient(135deg,#7c3aed 0%, #06b6d4 100%);
      color: white;
      padding: 16px 24px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0,0,0,0.15);
      z-index: 1000;
      animation: slideIn 0.3s ease-out;
    `;
    alertDiv.innerHTML = "Contact section coming soon!";
    document.body.appendChild(alertDiv);

    setTimeout(() => {
      alertDiv.style.animation = "slideOut 0.3s ease-out forwards";
      setTimeout(() => alertDiv.remove(), 300);
    }, 3000);
  };

  // ---------- Inject slideIn/slideOut styles (kept) ----------
  (function injectStyles() {
    const style = document.createElement("style");
    style.textContent = `
      @keyframes slideIn { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
      @keyframes slideOut { from { transform: translateX(0); opacity: 1 } to { transform: translateX(100%); opacity: 0 } }
      .about-section .point-card, .about-section .highlight-card { opacity: 0; animation: fadeInUp 0.6s ease-out forwards; }
      @keyframes fadeInUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
    `;
    document.head.appendChild(style);
  })();
  // ---------- Sidebar ScrollSpy ----------
  (function initSidebarSpy() {
    const sidebarLinks = document.querySelectorAll('.sidebar .nav-item');
    if (!sidebarLinks.length) return;

    // specific check for current page URL (e.g. profile.html)
    const currentPath = window.location.pathname;
    const pageName = currentPath.split("/").pop(); // e.g., "profile.html"

    // 1. Highlight based on Page URL (for non-hash links)
    sidebarLinks.forEach(link => {
      const href = link.getAttribute('href');
      if (href && !href.startsWith('#') && href.includes(pageName) && pageName !== "" && pageName !== "index.html") {
        link.classList.add('active');
      }
    });

    // 2. ScrollSpy for index.html sections
    // Only run if we are on the main page (index.html or root)
    if (pageName === "" || pageName === "index.html") {
      const sections = document.querySelectorAll("section"); // Assuming sections have IDs matching hashes
      if (!sections.length || typeof IntersectionObserver === "undefined") return;

      const observerOptions = {
        root: null,
        rootMargin: "-20% 0px -60% 0px", // Active when section is near top/center
        threshold: 0
      };

      const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const id = entry.target.getAttribute("id");
            if (id) {
              sidebarLinks.forEach((link) => {
                link.classList.remove("active");
                if (link.getAttribute("href") === `#${id}`) {
                  link.classList.add("active");
                }
              });
            }
          }
        });
      }, observerOptions);

      sections.forEach((section) => {
        observer.observe(section);
      });

      // Also highlight "Home" if near top
      window.addEventListener('scroll', () => {
        if (window.scrollY < 100) {
          sidebarLinks.forEach(l => l.classList.remove('active'));
          const homeLink = document.querySelector('.sidebar .nav-item[href="#home"]');
          if (homeLink) homeLink.classList.add('active');
        }
      });
    }
  })();
}); // end DOMContentLoaded
