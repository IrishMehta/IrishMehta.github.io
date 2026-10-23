// js/animations/projectCards.js

const STAGGER_DELAY = 110;

const PROJECT_GROUPS = {
    "Multi-ATS Job Intelligence Platform": "highlights",
    "AutoFrame": "highlights",
    "Mars-Bench": "highlights",
    "MOMO": "highlights",
    "Nursery Realtime": "highlights",
    "DishCovery": "prototypes",
    "CounterEcho AI": "prototypes",
    "Earnings Call RAG": "prototypes",
    "Adaptive Learning Platform": "prototypes",
    "Auto Storage Categorization": "prototypes",
    "SudoHint": "prototypes",
    "Silkot Silicones": "in-production",
    "Auto Email Classification": "in-production",
    "Movie Recommendation System": "research-academia",
    "Uncertainty Quantification": "research-academia",
    "EdgeVision": "research-academia"
};

const PROJECT_GROUP_LABELS = {
    "highlights": "Highlights",
    "prototypes": "Prototypes",
    "in-production": "In Production",
    "research-academia": "Research / Academia"
};

const PROJECT_ORDER = Object.keys(PROJECT_GROUPS);

/** Move the existing cards into their four curated gallery groups. */
export function initProjectGroups() {
    const source = document.getElementById('project-source');
    const groups = document.getElementById('project-groups');

    if (!source || !groups) return;

    const cards = [...source.querySelectorAll('.project-card-wrapper')].sort((firstCard, secondCard) => {
        const firstTitle = firstCard.querySelector('.project-title')?.textContent.trim();
        const secondTitle = secondCard.querySelector('.project-title')?.textContent.trim();
        return PROJECT_ORDER.indexOf(firstTitle) - PROJECT_ORDER.indexOf(secondTitle);
    });

    cards.forEach(card => {
        const title = card.querySelector('.project-title')?.textContent.trim();
        const group = PROJECT_GROUPS[title] || 'prototypes';
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
    const galleryNav = document.getElementById('project-dialog-gallery-nav');
    const galleryCaption = document.getElementById('project-dialog-image-caption');
    const galleryThumbnails = document.getElementById('project-dialog-thumbnails');
    const zoomButton = document.getElementById('project-dialog-zoom');
    const galleryImages = image ? [image, ...card.querySelectorAll('.project-gallery-image')].map(galleryImage => ({
        src: galleryImage.dataset.fullSrc || galleryImage.src || '',
        thumbnail: galleryImage.src || galleryImage.dataset.fullSrc || '',
        alt: galleryImage.alt || title,
        caption: galleryImage.dataset.caption || title
    })).filter(galleryImage => galleryImage.src) : [];

    galleryThumbnails.replaceChildren();

    const selectGalleryImage = (galleryImage, activeIndex) => {
        dialogImage.src = galleryImage.src;
        dialogImage.alt = galleryImage.alt;
        galleryCaption.textContent = galleryImage.caption;
        galleryThumbnails.querySelectorAll('button').forEach((button, index) => {
            const isActive = index === activeIndex;
            button.classList.toggle('is-active', isActive);
            button.setAttribute('aria-pressed', String(isActive));
        });
    };

    if (galleryImages.length > 0) {
        galleryImages.forEach((galleryImage, index) => {
            const button = document.createElement('button');
            const thumbnail = document.createElement('img');

            button.type = 'button';
            button.className = 'project-dialog-thumbnail';
            button.setAttribute('aria-label', `View ${galleryImage.caption}`);
            button.setAttribute('aria-pressed', String(index === 0));
            thumbnail.src = galleryImage.thumbnail;
            thumbnail.alt = '';
            thumbnail.loading = 'lazy';
            button.appendChild(thumbnail);
            button.addEventListener('click', () => selectGalleryImage(galleryImage, index));
            galleryThumbnails.appendChild(button);
        });

        selectGalleryImage(galleryImages[0], 0);
        dialogImage.hidden = false;
        dialogPlaceholder.hidden = true;
        zoomButton.hidden = false;
        galleryNav.hidden = galleryImages.length < 2;
        dialogMedia.classList.toggle('project-dialog-media--gallery', galleryImages.length > 1);
        dialogMedia.classList.remove('project-dialog-media--placeholder');
    } else {
        dialogImage.removeAttribute('src');
        dialogImage.alt = '';
        dialogImage.hidden = true;
        zoomButton.hidden = true;
        dialogPlaceholder.textContent = imagePlaceholder?.textContent.trim() || title;
        dialogPlaceholder.hidden = false;
        galleryNav.hidden = true;
        dialogMedia.classList.remove('project-dialog-media--gallery');
        dialogMedia.classList.add('project-dialog-media--placeholder');
    }

    const dialogLinks = document.getElementById('project-dialog-links');
    dialogLinks.innerHTML = links?.innerHTML || '';
    dialogLinks.querySelectorAll('a').forEach(link => {
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
    });

    dialog.showModal();
    dialog.querySelector('.project-dialog-layout').scrollTop = 0;
}

function initProjectImageZoom() {
    const sourceImage = document.getElementById('project-dialog-image');
    const openButton = document.getElementById('project-dialog-zoom');
    const zoomDialog = document.getElementById('project-image-dialog');
    const zoomedImage = document.getElementById('project-image-zoomed');
    const stage = document.getElementById('project-image-stage');
    const closeButton = zoomDialog?.querySelector('.project-image-dialog-close');
    const zoomOutButton = document.getElementById('project-image-zoom-out');
    const resetButton = document.getElementById('project-image-zoom-reset');
    const zoomInButton = document.getElementById('project-image-zoom-in');
    const zoomLevel = document.getElementById('project-image-zoom-level');

    if (!sourceImage || !openButton || !zoomDialog || !zoomedImage || !stage) return;

    const zoomSteps = [1, 1.5, 2, 3, 4];
    let zoomIndex = 0;

    const applyZoom = (nextIndex) => {
        zoomIndex = Math.max(0, Math.min(nextIndex, zoomSteps.length - 1));
        const scale = zoomSteps[zoomIndex];
        const isZoomed = scale > 1;

        zoomedImage.classList.toggle('is-zoomed', isZoomed);
        zoomedImage.style.setProperty('--image-zoom', `${scale * 100}%`);
        zoomLevel.textContent = isZoomed ? `${Math.round(scale * 100)}%` : 'Fit';
        zoomOutButton.disabled = zoomIndex === 0;
        zoomInButton.disabled = zoomIndex === zoomSteps.length - 1;

        if (!isZoomed) {
            stage.scrollTo({ top: 0, left: 0 });
        }
    };

    openButton.addEventListener('click', () => {
        zoomedImage.src = sourceImage.currentSrc || sourceImage.src;
        zoomedImage.alt = sourceImage.alt;
        applyZoom(0);
        zoomDialog.showModal();
    });

    closeButton?.addEventListener('click', () => zoomDialog.close());
    zoomOutButton?.addEventListener('click', () => applyZoom(zoomIndex - 1));
    zoomInButton?.addEventListener('click', () => applyZoom(zoomIndex + 1));
    resetButton?.addEventListener('click', () => applyZoom(0));

    stage.addEventListener('dblclick', () => {
        applyZoom(zoomIndex === 0 ? 2 : 0);
    });

    zoomDialog.addEventListener('click', event => {
        if (event.target === zoomDialog) zoomDialog.close();
    });

    zoomDialog.addEventListener('keydown', event => {
        if (event.key === '+' || event.key === '=') {
            event.preventDefault();
            applyZoom(zoomIndex + 1);
        } else if (event.key === '-') {
            event.preventDefault();
            applyZoom(zoomIndex - 1);
        } else if (event.key === '0') {
            event.preventDefault();
            applyZoom(0);
        }
    });
}

/** Adds keyboard and pointer access to every compact project card. */
export function initProjectDialog() {
    const dialog = document.getElementById('project-dialog');
    const closeButton = dialog?.querySelector('.project-dialog-close');
    const projectCards = document.querySelectorAll('.project-card-wrapper');

    if (!dialog || projectCards.length === 0) return;

    initProjectImageZoom();

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
        lastFocusedCard?.focus({ preventScroll: true });
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
