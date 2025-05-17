// js/main.js
import { startTypingSequence, displayTypingImmediately, typingStartDelay } from './animations/typing.js';
import { init as initClustering } from './animations/clustering.js';
import { fetchGraphDataAndRender, destroyGraph } from './visualizations/knowledgeGraph.js';
import { initGradientScroll } from './gradientBackground.js';
import { initScrollObserver } from './scrollObserver.js';
import { initProjectCardsAnimation, handleProjectImageErrors } from './animations/projectCards.js';

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

    // --- Project Cards & Animations ---
    initProjectCardsAnimation();
    handleProjectImageErrors();

    // --- Scroll Observer ---
    initScrollObserver();

    // --- About Section Toggle & Knowledge Graph ---
    setupAboutToggle(); // Initialize the toggle switch logic    // Initialize the timeline toggle logic
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


// === Feature: About Section Knowledge Graph Loading ===
// (Handles loading the knowledge graph directly without toggle)
function setupAboutToggle() {
    const textContent = document.getElementById('about-text-content');
    const graphContainer = document.getElementById('knowledge-graph-enhanced-container');

    // Check if we have the necessary elements
    if (!textContent || !graphContainer) {
        console.warn("About section content elements not found.");
        return;
    }

    // Both text content and graph are visible (both have active class)
    console.log("Initializing knowledge graph display");
    
    // Ensure graph is rendered if container is visible
    if (graphContainer.classList.contains('active')) {
        // Trigger graph rendering (it checks internally if already rendered)
        setTimeout(() => {
            fetchGraphDataAndRender();
            console.log("Knowledge graph render triggered");
        }, 300); // Small delay to ensure DOM is ready
    }
    
    console.log("About section initialized with combined view.");
}