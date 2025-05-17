// js/gradientBackground.js
import { getCssVariable, parseColorToRgb, interpolateRgbColor, rgbToString, easeInOutQuad } from './utils.js';

// --- Elements and State ---
const body = document.body;
const homeSectionGrad = document.getElementById('home');
const timelineSectionGrad = document.getElementById('timeline'); // Section to end transition

let color1_start_grad, color1_end_grad, color2_fixed_grad;
let lastKnownScrollPosition = 0;
let tickingGradient = false;

// --- Scroll Handler ---
function handleGradientScroll(scrollPos) {
    // Ensure colors are initialized
    if (!color1_start_grad) return;

    const windowHeight = window.innerHeight;
    const transitionStart = homeSectionGrad ? homeSectionGrad.offsetTop : 0;
    const transitionEndSection = timelineSectionGrad || body;
    // Ensure transitionEnd is always greater than transitionStart
    const transitionEnd = Math.max(transitionStart + windowHeight * 0.5, transitionEndSection.offsetTop + windowHeight * 0.5);

    let rawProgress = 0;
    const transitionDuration = transitionEnd - transitionStart;

    if (scrollPos <= transitionStart) {
        rawProgress = 0;
    } else if (scrollPos >= transitionEnd) {
        rawProgress = 1;
    } else if (transitionDuration > 0) { // Avoid division by zero
        rawProgress = (scrollPos - transitionStart) / transitionDuration;
    }

    const easedProgress = easeInOutQuad(rawProgress);
    const currentRgbColor1 = interpolateRgbColor(color1_start_grad, color1_end_grad, easedProgress);
    body.style.background = `linear-gradient(to top right, ${rgbToString(currentRgbColor1)}, ${rgbToString(color2_fixed_grad)})`;
}

// --- Debounced Scroll Listener ---
function onScrollGradient() {
    lastKnownScrollPosition = window.scrollY;
    if (!tickingGradient) {
        window.requestAnimationFrame(() => {
            handleGradientScroll(lastKnownScrollPosition);
            tickingGradient = false;
        });
        tickingGradient = true;
    }
}

// --- Exported Initialization Function ---
export function initGradientScroll() {
    // Parse colors safely from CSS vars or use fallbacks
    // Moved initialization here so it runs when the module is loaded/called
    color1_start_grad = parseColorToRgb(getCssVariable('--color-dark-purple') || '#20002c');
    color1_end_grad = parseColorToRgb(getCssVariable('--color-light-lilac') || '#cbb4d4');
    color2_fixed_grad = parseColorToRgb(getCssVariable('--color-anchor-dark') || '#100016');

    // Check if colors parsed correctly
    if (!color1_start_grad || !color1_end_grad || !color2_fixed_grad) {
        console.error("Failed to initialize gradient colors from CSS variables.");
        return;
    }

    // Set initial gradient and attach listener
    handleGradientScroll(window.scrollY);
    window.addEventListener('scroll', onScrollGradient, { passive: true }); // Use passive listener
    console.log("Gradient scroll effect initialized.");
}