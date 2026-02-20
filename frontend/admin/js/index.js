const menuToggle = document.getElementById("menuToggle");
const sidebar = document.querySelector(".sidebar");
const overlay = document.getElementById("overlay");

const themeToggle = document.getElementById("themeToggle");
const themeSlider = document.getElementById("themeSlider");
const lightTheme = document.getElementById("lightTheme");
const darkTheme = document.getElementById("darkTheme");
const body = document.body;

// Theme management
let currentTheme = localStorage.getItem("theme") || "light";

// Initialize the app
document.addEventListener("DOMContentLoaded", function () {
  // Set initial theme
  setTheme(currentTheme);

  // Mobile menu toggle
  menuToggle.addEventListener("click", toggleMenu);
  overlay.addEventListener("click", closeMenu);

  // Theme toggle functionality
  themeToggle.addEventListener("click", toggleTheme);
  lightTheme.addEventListener("click", () => setTheme("light"));
  darkTheme.addEventListener("click", () => setTheme("dark"));

  // Close menu when clicking on a nav link
  document.querySelectorAll(".nav-link").forEach((link) => {
    link.addEventListener("click", closeMenu);
  });
});

// Toggle mobile menu
function toggleMenu() {
  sidebar.classList.toggle("active");
  overlay.classList.toggle("active");
}

// Close mobile menu
function closeMenu() {
  sidebar.classList.remove("active");
  overlay.classList.remove("active");
}

// Toggle theme
function toggleTheme() {
  const newTheme = currentTheme === "light" ? "dark" : "light";
  setTheme(newTheme);
}

// Set theme with smooth transitions
function setTheme(theme) {
  // Add transition class for smooth theme change
  body.classList.add("dark-theme-transition");

  // Update theme variables
  if (theme === "dark") {
    body.setAttribute("data-theme", "dark");
    themeSlider.classList.add("dark");
    lightTheme.classList.remove("active");
    darkTheme.classList.add("active");
  } else {
    body.setAttribute("data-theme", "light");
    themeSlider.classList.remove("dark");
    lightTheme.classList.add("active");
    darkTheme.classList.remove("active");
  }

  // Add animation effect
  body.classList.add("theme-switch-animation");
  setTimeout(() => {
    body.classList.remove("theme-switch-animation");
  }, 400);

  // Store preference
  currentTheme = theme;
  localStorage.setItem("theme", theme);

  // Remove transition class after animation completes
  setTimeout(() => {
    body.classList.remove("dark-theme-transition");
  }, 600);
}
