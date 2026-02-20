// Our Story Section Scripts

// Tab Navigation Function
function openTab(evt, tabName) {
    // Hide all tab contents
    var tabContents = document.getElementsByClassName("tab-content");
    for (var i = 0; i < tabContents.length; i++) {
        tabContents[i].classList.remove("active");
    }

    // Remove active class from all tab buttons
    var tabBtns = document.getElementsByClassName("tab-btn");
    for (var i = 0; i < tabBtns.length; i++) {
        tabBtns[i].classList.remove("active");
    }

    // Show the selected tab and mark button as active
    const selectedTab = document.getElementById(tabName);
    if (selectedTab) {
        selectedTab.classList.add("active");

        // Re-trigger timeline animations if opening tab
        const timelineItems = selectedTab.querySelectorAll('.timeline-item');
        if (timelineItems.length > 0) {
            // Force reflow to restart animation
            timelineItems.forEach(item => {
                item.style.animation = 'none';
                item.offsetHeight; /* trigger reflow */
                item.style.animation = null;
            });
        }
    }

    if (evt && evt.currentTarget) {
        evt.currentTarget.classList.add("active");
    }
}

// Intersection Observer for fade-up animations
document.addEventListener("DOMContentLoaded", function () {
    const observerOptions = {
        root: null,
        rootMargin: '0px',
        threshold: 0.1
    };

    const observer = new IntersectionObserver((entries, observer) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target);
            }
        });
    }, observerOptions);

    const elements = document.querySelectorAll('.image-card, .impact-card, .content-block, .highlight-box, .featured-image, .os-section-title');
    elements.forEach(el => {
        el.classList.add('fade-up');
        observer.observe(el);
    });

    // Handle image load errors with gradient placeholder
    const images = document.querySelectorAll(".ourstory-container img");
    images.forEach((img) => {
        img.addEventListener("error", function () {
            this.style.background = "linear-gradient(135deg, #667eea 0%, #764ba2 50%, #f093fb 100%)";
            // Optionally hide the broken image icon if possible, or leave as is
        });
    });
});
