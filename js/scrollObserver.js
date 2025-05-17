// js/scrollObserver.js

// --- Elements and Options ---
const animatedElementsSelector = '.timeline-state, .project-card, .section-heading:not(#home-heading), .section-paragraph:not(#home-paragraph), .project-placeholder, .update-placeholder, .contact-links';
const observerOptions = {
    root: null, // Use the viewport as the root
    rootMargin: '0px',
    threshold: 0.15 // Trigger when 15% of the element is visible
};

// --- Callback Function ---
const observerCallback = (entries, observer) => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target); // Stop observing once visible
        }
    });
};

// --- Exported Initialization Function ---
export function initScrollObserver() {
    const animatedElements = document.querySelectorAll(animatedElementsSelector);

    if (animatedElements.length === 0) {
        console.warn("No elements found for scroll observer animation.");
        return;
    }

    // Create and start the observer
    const intersectionObserver = new IntersectionObserver(observerCallback, observerOptions);
    animatedElements.forEach(el => {
        intersectionObserver.observe(el);
    });

    console.log(`Scroll observer initialized for ${animatedElements.length} elements.`);
}