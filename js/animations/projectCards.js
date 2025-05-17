// js/animations/projectCards.js

/**
 * Handles the staggered entrance animations for project cards
 */

// --- Configuration ---
const STAGGER_DELAY = 150; // milliseconds between each card animation

// --- Animation Functions ---
export function initProjectCardsAnimation() {
    const projectCards = document.querySelectorAll('.project-card');
    
    if (projectCards.length === 0) {
        console.warn("No project cards found for animation.");
        return;
    }
    
    // Add staggered delay to each card
    projectCards.forEach((card, index) => {
        card.style.transitionDelay = `${index * STAGGER_DELAY}ms`;
    });
    
    console.log(`Project cards animation initialized for ${projectCards.length} cards.`);
}

// --- Project Image Fallback ---
export function handleProjectImageErrors() {
    const projectImages = document.querySelectorAll('.project-image');
    
    projectImages.forEach(img => {
        img.addEventListener('error', function() {
            // If image fails to load, set a gradient background as fallback
            this.style.display = 'none';
            const container = this.parentElement;
            container.style.background = `linear-gradient(135deg, 
                rgba(75, 30, 110, 0.9) 0%, 
                rgba(120, 50, 160, 0.9) 100%)`;
                
            // Add a nice pattern to the background
            container.style.backgroundImage = `
                radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 20%),
                radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.05) 0%, transparent 20%)
            `;
        });
    });
}
