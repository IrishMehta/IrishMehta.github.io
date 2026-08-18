// js/animations/projectCards.js

const STAGGER_DELAY = 110;

const PROJECT_GROUPS = {
    "SudoHint": "ai-engineering",
    "AutoFrame": "ai-engineering",
    "DishCovery": "ai-engineering",
    "Earnings Call RAG": "ai-engineering",
    "CounterEcho AI": "ai-engineering",
    "EdgeVision": "ai-engineering",
    "Prompt Engineering": "ai-engineering",
    "Silkot Silicones": "ai-engineering",
    "MOMO": "machine-learning",
    "Mars-Bench": "machine-learning",
    "Adaptive Learning Platform": "machine-learning",
    "Candidate Recommendation System": "machine-learning",
    "Machine Learning from Scratch": "machine-learning",
    "Multi-ATS Job Intelligence Platform": "data-science",
    "Auto Storage Categorization": "data-science",
    "Movie Recommendation System": "data-science",
    "Predictive Modelling for Composites": "data-science",
    "Auto Email Classification": "data-science",
    "Uncertainty Quantification": "machine-learning"
};

const PROJECT_GROUP_LABELS = {
    "ai-engineering": "AI Engineering",
    "machine-learning": "Machine Learning",
    "data-science": "Data Science"
};

/** Move the existing cards into their three curated gallery groups. */
export function initProjectGroups() {
    const source = document.getElementById('project-source');
    const groups = document.getElementById('project-groups');

    if (!source || !groups) return;

    const cards = [...source.querySelectorAll('.project-card-wrapper')];

    cards.forEach(card => {
        const title = card.querySelector('.project-title')?.textContent.trim();
        const group = PROJECT_GROUPS[title] || 'machine-learning';
        const target = groups.querySelector(`[data-project-group="${group}"] .project-group-grid`);

        if (target) {
            card.dataset.projectCategory = group;
            card.dataset.projectTitle = title || 'Project';
            target.appendChild(card);
        }
    });

    source.remove();
    groups.hidden = false;
}

/** Handles the entrance animations for cards after they have been grouped. */
export function initProjectCardsAnimation() {
    const projectCards = document.querySelectorAll('.project-card');

    projectCards.forEach((card, index) => {
        card.style.transitionDelay = `${index * STAGGER_DELAY}ms`;
    });
}

function openProjectDialog(card, dialog) {
    const title = card.querySelector('.project-title')?.textContent.trim() || 'Project';
    const image = card.querySelector('.project-image');
    const tech = card.querySelector('.project-tech');
    const description = card.querySelector('.project-description');
    const details = card.querySelector('.project-details');
    const links = card.querySelector('.project-links');
    const category = PROJECT_GROUP_LABELS[card.dataset.projectCategory] || 'Project';

    document.getElementById('project-dialog-title').textContent = title;
    document.getElementById('project-dialog-category').textContent = category;
    document.getElementById('project-dialog-tech').textContent = tech?.textContent.trim() || '';
    const dialogDetails = document.getElementById('project-dialog-description');
    dialogDetails.innerHTML = details?.innerHTML || `<section class="project-detail-section"><h3>Summary</h3><p>${description?.textContent.trim() || ''}</p></section>`;

    const dialogImage = document.getElementById('project-dialog-image');
    const imagePlaceholder = card.querySelector('.project-image-placeholder');
    const dialogMedia = dialogImage.closest('.project-dialog-media');
    const dialogPlaceholder = document.getElementById('project-dialog-placeholder');
    const imageSource = image?.dataset.fullSrc || image?.src || '';

    if (imageSource) {
        dialogImage.src = imageSource;
        dialogImage.alt = image?.alt || title;
        dialogImage.hidden = false;
        dialogPlaceholder.hidden = true;
        dialogMedia.classList.remove('project-dialog-media--placeholder');
    } else {
        dialogImage.removeAttribute('src');
        dialogImage.alt = '';
        dialogImage.hidden = true;
        dialogPlaceholder.textContent = imagePlaceholder?.textContent.trim() || title;
        dialogPlaceholder.hidden = false;
        dialogMedia.classList.add('project-dialog-media--placeholder');
    }

    const dialogLinks = document.getElementById('project-dialog-links');
    dialogLinks.innerHTML = links?.innerHTML || '';
    dialogLinks.querySelectorAll('a').forEach(link => {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
    });

    dialog.showModal();
}

/** Adds keyboard and pointer access to every compact project card. */
export function initProjectDialog() {
    const dialog = document.getElementById('project-dialog');
    const closeButton = dialog?.querySelector('.project-dialog-close');
    const projectCards = document.querySelectorAll('.project-card-wrapper');

    if (!dialog || projectCards.length === 0) return;

    let lastFocusedCard = null;

    projectCards.forEach(card => {
        const title = card.querySelector('.project-title')?.textContent.trim() || 'project';
        card.setAttribute('role', 'button');
        card.setAttribute('tabindex', '0');
        card.setAttribute('aria-haspopup', 'dialog');
        card.setAttribute('aria-label', `View details for ${title}`);

        card.addEventListener('click', event => {
            if (event.target.closest('a')) return;
            lastFocusedCard = card;
            openProjectDialog(card, dialog);
        });

        card.addEventListener('keydown', event => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                lastFocusedCard = card;
                openProjectDialog(card, dialog);
            }
        });
    });

    closeButton?.addEventListener('click', () => dialog.close());

    dialog.addEventListener('click', event => {
        if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener('close', () => {
        lastFocusedCard?.focus();
    });
}

// --- Project Image Fallback ---
export function handleProjectImageErrors() {
    const projectImages = document.querySelectorAll('.project-image');

    projectImages.forEach(img => {
        img.addEventListener('error', function() {
            this.style.display = 'none';
            const container = this.parentElement;
            container.style.background = 'linear-gradient(135deg, rgba(75, 30, 110, 0.9), rgba(120, 50, 160, 0.9))';
            container.style.backgroundImage = `
                radial-gradient(circle at 10% 20%, rgba(255, 255, 255, 0.05) 0%, transparent 20%),
                radial-gradient(circle at 80% 70%, rgba(255, 255, 255, 0.05) 0%, transparent 20%)`;
        });
    });
}
