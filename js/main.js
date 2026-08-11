// js/main.js
import { startTypingSequence, displayTypingImmediately, typingStartDelay } from './animations/typing.js';
import { init as initClustering, setScrollingState } from './animations/clustering.js';
import { initGradientScroll } from './gradientBackground.js';
import { initScrollObserver } from './scrollObserver.js';
import { initProjectGroups, initProjectCardsAnimation, initProjectDialog, handleProjectImageErrors } from './animations/projectCards.js';

function initScrollPerformanceState() {
    let scrollEndTimer = null;

    window.addEventListener('scroll', () => {
        document.body.classList.add('is-scrolling');
        setScrollingState(true);

        if (scrollEndTimer !== null) clearTimeout(scrollEndTimer);
        scrollEndTimer = window.setTimeout(() => {
            document.body.classList.remove('is-scrolling');
            setScrollingState(false);
            scrollEndTimer = null;
        }, 140);
    }, { passive: true });
}

function initFastAnchorNavigation(prefersReducedMotion) {
    const anchorLinks = document.querySelectorAll('nav a[href^="#"]');
    let animationFrameId = null;

    anchorLinks.forEach(link => {
        link.addEventListener('click', event => {
            const targetId = link.getAttribute('href')?.slice(1);
            const target = targetId ? document.getElementById(targetId) : null;
            if (!target) return;

            event.preventDefault();

            if (animationFrameId !== null) {
                cancelAnimationFrame(animationFrameId);
                animationFrameId = null;
            }

            const startY = window.scrollY;
            const targetY = Math.max(0, target.getBoundingClientRect().top + startY - 60);
            const distance = Math.abs(targetY - startY);

            history.pushState(null, '', link.getAttribute('href'));

            if (prefersReducedMotion || distance < 4) {
                window.scrollTo(0, targetY);
                return;
            }

            const duration = Math.min(360, Math.max(140, distance / 3));
            const animationStart = performance.now();

            const step = now => {
                const progress = Math.min(1, (now - animationStart) / duration);
                const easedProgress = 1 - Math.pow(1 - progress, 3);
                window.scrollTo(0, startY + (targetY - startY) * easedProgress);

                if (progress < 1) {
                    animationFrameId = requestAnimationFrame(step);
                } else {
                    animationFrameId = null;
                }
            };

            animationFrameId = requestAnimationFrame(step);
        });
    });
}

// Main Initialization on DOMContentLoaded
document.addEventListener('DOMContentLoaded', () => {
    console.log("DOM Ready - Initializing App Modules");

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // === Initialize Features ===

    // --- Typing Animation ---
    if (!prefersReducedMotion) {
        // Use the exported delay constant
        setTimeout(startTypingSequence, typingStartDelay);
    } else {
        displayTypingImmediately(); // Show text instantly if reduced motion
    }

    // --- Clustering Animation ---
    if (!prefersReducedMotion && document.getElementById('cluster-canvas')) {
         // Check if canvas exists before initializing
         initClustering();
    } else {
         // Handle reduced motion for clustering if needed (e.g., hide canvas)
         const clusterCanvas = document.getElementById('cluster-canvas');
         if (clusterCanvas) clusterCanvas.style.display = 'none'; // Hide canvas
    }    // --- Gradient Background ---
    initGradientScroll();
    initScrollPerformanceState();
    initFastAnchorNavigation(prefersReducedMotion);

    // --- Project Cards & Animations ---
    initProjectGroups();
    initProjectCardsAnimation();
    initProjectDialog();
    handleProjectImageErrors();

    // --- Scroll Observer ---
    initScrollObserver();

    // --- Timeline toggle logic ---
    document.querySelectorAll('.timeline-accomplish-toggle').forEach(btn => {
        btn.addEventListener('click', function() {
            const panel = this.parentElement.querySelector('.timeline-accomplish-panel');
            const expanded = this.getAttribute('aria-expanded') === 'true';
            
            // Close any other open panels first
            document.querySelectorAll('.timeline-accomplish-panel:not([hidden])').forEach(openPanel => {
                if (openPanel !== panel) {
                    openPanel.hidden = true;
                    openPanel.setAttribute('aria-hidden', 'true');
                    const associatedButton = openPanel.parentElement.querySelector('.timeline-accomplish-toggle');
                    associatedButton.setAttribute('aria-expanded', 'false');
                }
            });
            
            // Toggle current panel
            this.setAttribute('aria-expanded', !expanded);
            if (expanded) {
                panel.hidden = true;
                panel.setAttribute('aria-hidden', 'true');
            } else {
                panel.hidden = false;
                panel.setAttribute('aria-hidden', 'false');
                
                // Ensure the panel is visible in the viewport
                setTimeout(() => {
                    const rect = panel.getBoundingClientRect();
                    if (rect.top < 0 || rect.bottom > window.innerHeight) {
                        panel.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 100);
            }
        });
    });

    // Add keyboard support for accomplishment toggles
    document.querySelectorAll('.timeline-accomplish-toggle').forEach(btn => {
        btn.addEventListener('keydown', function(e) {
            // Toggle on Enter or Space
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                this.click();
            }
            // Close on Escape
            if (e.key === 'Escape') {
                const expanded = this.getAttribute('aria-expanded') === 'true';
                if (expanded) {
                    this.click();
                }
            }
        });
    });
    
    // Close accomplishment panels when clicking outside
    document.addEventListener('click', function(e) {
        if (!e.target.closest('.timeline-accomplish-toggle') && 
            !e.target.closest('.timeline-accomplish-panel')) {
            document.querySelectorAll('.timeline-accomplish-panel:not([hidden])').forEach(panel => {
                const toggle = panel.parentElement.querySelector('.timeline-accomplish-toggle');
                if (toggle && toggle.getAttribute('aria-expanded') === 'true') {
                    toggle.click();
                }
            });
        }
    });

    document.querySelectorAll('.accomplishments-toggle').forEach(button => {
        button.addEventListener('click', () => {
            const accomplishments = button.previousElementSibling; // Get the accomplishments div
            if (accomplishments.style.maxHeight) {
                accomplishments.style.maxHeight = null; // Collapse
            } else {
                accomplishments.style.maxHeight = accomplishments.scrollHeight + "px"; // Expand
            }
        });
    });

    console.log("App Initialization Complete.");
});
