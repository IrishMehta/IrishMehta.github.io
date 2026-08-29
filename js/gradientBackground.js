import { easeInOutQuad } from './utils.js';

const root = document.documentElement;
const body = document.body;
const homeSection = document.getElementById('home');
const timelineSection = document.getElementById('timeline');
const projectsSection = document.getElementById('projects');
const postProjectsOpacity = 0.18;

let lastKnownScrollPosition = 0;
let tickingGradient = false;

function handleGradientScroll(scrollPosition) {
    const windowHeight = window.innerHeight;
    const transitionStart = homeSection ? homeSection.offsetTop : 0;
    const transitionEndSection = timelineSection || body;
    const transitionEnd = Math.max(
        transitionStart + windowHeight * 0.5,
        transitionEndSection.offsetTop + windowHeight * 0.5
    );
    const transitionDuration = transitionEnd - transitionStart;

    let progress = 0;
    if (scrollPosition >= transitionEnd) progress = 1;
    else if (scrollPosition > transitionStart && transitionDuration > 0) {
        progress = (scrollPosition - transitionStart) / transitionDuration;
    }

    let opacity = easeInOutQuad(progress);

    // Return to a high-contrast dark background as Projects enters the viewport.
    // The light gradient otherwise remains fully opaque for every later section.
    if (projectsSection) {
        const darkeningStart = Math.max(transitionEnd, projectsSection.offsetTop - windowHeight * 0.7);
        const darkeningEnd = Math.max(darkeningStart + 1, projectsSection.offsetTop + windowHeight * 0.15);

        if (scrollPosition > darkeningStart) {
            const darkeningProgress = Math.min(1, (scrollPosition - darkeningStart) / (darkeningEnd - darkeningStart));
            opacity = 1 - (1 - postProjectsOpacity) * easeInOutQuad(darkeningProgress);
        }
    }

    root.style.setProperty('--gradient-progress', opacity.toFixed(4));
}

function onScrollGradient() {
    lastKnownScrollPosition = window.scrollY;
    if (tickingGradient) return;

    tickingGradient = true;
    window.requestAnimationFrame(() => {
        handleGradientScroll(lastKnownScrollPosition);
        tickingGradient = false;
    });
}

export function initGradientScroll() {
    handleGradientScroll(window.scrollY);
    window.addEventListener('scroll', onScrollGradient, { passive: true });
    window.addEventListener('resize', onScrollGradient);
}
