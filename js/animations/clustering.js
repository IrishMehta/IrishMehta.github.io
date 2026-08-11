// js/animations/clustering.js
import { parseColor, blendParsedColors, easing } from '../utils.js'; // Import needed utilities

// --- Constants, Globals, Helpers ---
const canvas = document.getElementById('cluster-canvas');
if (!canvas) console.error("Canvas element #cluster-canvas not found!");
const ctx = canvas ? canvas.getContext('2d') : null;

let POINT_COUNT = window.innerWidth < 768 ? 105 : 140;
const MAX_POINTS = 220;
const INITIAL_CLUSTER_COUNT = 6;
const NORMAL_FPS = 36;
const SCROLLING_FPS = 26;
const CENTROID_INTERVAL = 100;
const SPRITE_CACHE_LIMIT = 256;

const CLUSTERING_DURATION = 8000;
const CLUSTER_MOVE_DURATION = 2000;
const SETTLING_DURATION = 700;
const SCATTERING_DURATION = 2000;
const CLUSTER_TRANSITION_DURATION = 1500;

const SCROLL_COLOR_STOPS = [
    { at: 0, color: { r: 255, g: 175, b: 220 } },
    { at: 0.2, color: { r: 170, g: 205, b: 255 } },
    { at: 0.42, color: { r: 140, g: 225, b: 205 } },
    { at: 0.64, color: { r: 255, g: 190, b: 145 } },
    { at: 0.82, color: { r: 220, g: 165, b: 255 } },
    { at: 1, color: { r: 255, g: 165, b: 198 } }
];

const STATE = { CLUSTERING: 'clustering', CLUSTER_MOVING: 'cluster_moving', SETTLING: 'settling', SCATTERING: 'scattering', CLUSTER_TRANSITIONING: 'cluster_transitioning' };

let points = [];
let clusters = [];
let currentState = STATE.CLUSTERING;
let stateStartTime = Date.now();
let clusteringProgress = 0, clusterMoveProgress = 0, settlingProgress = 0, scatteringProgress = 0, clusterTransitionProgress = 0;
let animationFrameId = null;
let scrollColorFrameId = null;
let lastRenderTime = 0;
let lastCentroidCalculation = 0;
let currentClusterCount = INITIAL_CLUSTER_COUNT;
let isInitialized = false; // Module-specific flag
let isScrolling = false;
let scrollColor = { ...SCROLL_COLOR_STOPS[0].color };
const glowSpriteCache = new Map();

function quantizeChannel(value) {
    return Math.max(0, Math.min(255, Math.round(value / 64) * 64));
}

function createGlowSprite(r, g, b, type) {
    const size = type === 'cluster' ? 128 : 48;
    const surface = typeof OffscreenCanvas === 'function'
        ? new OffscreenCanvas(size, size)
        : document.createElement('canvas');

    surface.width = size;
    surface.height = size;

    const spriteContext = surface.getContext('2d');
    const center = size / 2;
    const gradient = spriteContext.createRadialGradient(center, center, 0, center, center, center);

    if (type === 'cluster') {
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
        gradient.addColorStop(0.13, `rgba(${r}, ${g}, ${b}, 0.94)`);
        gradient.addColorStop(0.4, `rgba(${r}, ${g}, ${b}, 0.26)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    } else {
        gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 1)`);
        gradient.addColorStop(0.18, `rgba(${r}, ${g}, ${b}, 0.92)`);
        gradient.addColorStop(0.44, `rgba(${r}, ${g}, ${b}, 0.3)`);
        gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0)`);
    }

    spriteContext.fillStyle = gradient;
    spriteContext.fillRect(0, 0, size, size);
    return surface;
}

function getGlowSprite(r, g, b, type) {
    const red = quantizeChannel(r);
    const green = quantizeChannel(g);
    const blue = quantizeChannel(b);
    const key = `${type}-${red}-${green}-${blue}`;

    if (!glowSpriteCache.has(key)) {
        if (glowSpriteCache.size >= SPRITE_CACHE_LIMIT) glowSpriteCache.clear();
        glowSpriteCache.set(key, createGlowSprite(red, green, blue, type));
    }

    return glowSpriteCache.get(key);
}

export function setScrollingState(active) {
    isScrolling = Boolean(active);
}

function interpolateScrollColor(progress) {
    const boundedProgress = Math.max(0, Math.min(1, progress));
    let start = SCROLL_COLOR_STOPS[0];
    let end = SCROLL_COLOR_STOPS[SCROLL_COLOR_STOPS.length - 1];

    for (let i = 0; i < SCROLL_COLOR_STOPS.length - 1; i++) {
        const next = SCROLL_COLOR_STOPS[i + 1];
        if (boundedProgress <= next.at) {
            start = SCROLL_COLOR_STOPS[i];
            end = next;
            break;
        }
    }

    const span = end.at - start.at || 1;
    const localProgress = (boundedProgress - start.at) / span;

    return {
        r: Math.round(start.color.r + (end.color.r - start.color.r) * localProgress),
        g: Math.round(start.color.g + (end.color.g - start.color.g) * localProgress),
        b: Math.round(start.color.b + (end.color.b - start.color.b) * localProgress)
    };
}

function updateScrollColor() {
    const scrollableHeight = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
    scrollColor = interpolateScrollColor(window.scrollY / scrollableHeight);
}

function scheduleScrollColorUpdate() {
    if (scrollColorFrameId !== null) return;

    scrollColorFrameId = window.requestAnimationFrame(() => {
        updateScrollColor();
        scrollColorFrameId = null;
    });
}

function getScrollTintedColor(color, strength = 0.38) {
    return {
        r: Math.round(color.r + (scrollColor.r - color.r) * strength),
        g: Math.round(color.g + (scrollColor.g - color.g) * strength),
        b: Math.round(color.b + (scrollColor.b - color.b) * strength),
        a: color.a
    };
}

// --- Canvas Resize ---
function resizeCanvas() {
    if (!canvas) return;
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

// --- Point Class ---
class Point {
    constructor(x, y) {
        this.x = x; this.y = y; this.initialX = x; this.initialY = y;
        this.clusterTargetX = x; this.clusterTargetY = y;
        this.settleTargetX = x; this.settleTargetY = y;
        this.scatterStartX = x; this.scatterStartY = y;
        this.scatterTargetX = x; this.scatterTargetY = y;
        this.clusterId = null;
        this.defaultColorString = 'rgba(255, 255, 255, 0.7)';
        this.defaultColorRGBA = parseColor(this.defaultColorString) || { r: 255, g: 255, b: 255, a: 0.7 };
        this.displayColorRGBA = { ...this.defaultColorRGBA };
        this.preScatterColorRGBA = { ...this.defaultColorRGBA };
        this.size = Math.random() * 2.6 + 2.1;
        this.speedFactor = Math.random() * 0.4 + 0.8;
        this.settleMagnitude = Math.random() * 0.3 + 0.1;
        this.phase = Math.random() * Math.PI * 2;
        this.oscillationSpeed = Math.random() * 0.002 + 0.001;
    }

    setScatterTarget(cx, cy) {
        if (!canvas) return;
        const angle = Math.random() * Math.PI * 2;
        const baseDistance = Math.min(canvas.width, canvas.height) / 2.8;
        const distance = baseDistance * (0.6 + Math.random() * 0.8);
        this.scatterTargetX = cx + Math.cos(angle) * distance;
        this.scatterTargetY = cy + Math.sin(angle) * distance;
    }

    update(time) {
        let easedProgress; let targetProg; let blendRatio;
        let cluster = (this.clusterId !== null && this.clusterId >= 0 && this.clusterId < clusters.length) ? clusters[this.clusterId] : null;

        switch (currentState) {
             case STATE.CLUSTERING:
                if (cluster && cluster.colorRGBA) {
                    this.clusterTargetX = cluster.initialX; this.clusterTargetY = cluster.initialY;
                    this.displayColorRGBA = cluster.colorRGBA;
                    easedProgress = easing.easeInOutQuad(clusteringProgress);
                    targetProg = easedProgress;
                    this.x = this.initialX + (this.clusterTargetX - this.initialX) * targetProg;
                    this.y = this.initialY + (this.clusterTargetY - this.initialY) * targetProg;
                } else { this.displayColorRGBA = { ...this.defaultColorRGBA }; }
                break;
            case STATE.CLUSTER_MOVING:
                if (cluster && cluster.colorRGBA) {
                    this.displayColorRGBA = cluster.colorRGBA;
                    this.x += (cluster.x - this.x) * 0.1 * this.speedFactor;
                    this.y += (cluster.y - this.y) * 0.1 * this.speedFactor;
                } else { this.displayColorRGBA = { ...this.defaultColorRGBA }; }
                break;
            case STATE.SETTLING:
                if (cluster && cluster.colorRGBA) {
                    this.displayColorRGBA = cluster.colorRGBA;
                    this.settleTargetX = cluster.x; this.settleTargetY = cluster.y;
                    const lerpFactor = 0.1 + settlingProgress * 0.2;
                    this.x = this.x + (this.settleTargetX - this.x) * lerpFactor;
                    this.y = this.y + (this.settleTargetY - this.y) * lerpFactor;
                    const oscillation = (1 - settlingProgress) * 5 * this.settleMagnitude;
                    const wobbleX = Math.sin(time * this.oscillationSpeed + this.phase) * oscillation;
                    const wobbleY = Math.cos(time * this.oscillationSpeed + this.phase + 1) * oscillation;
                    // this.x += wobbleX; this.y += wobbleY;
                } else { this.displayColorRGBA = { ...this.defaultColorRGBA }; }
                break;
            case STATE.SCATTERING:
                easedProgress = easing.easeOutCubic(scatteringProgress);
                targetProg = Math.min(easedProgress * this.speedFactor * 1.1, 1.0);
                this.x = this.scatterStartX + (this.scatterTargetX - this.scatterStartX) * targetProg;
                this.y = this.scatterStartY + (this.scatterTargetY - this.scatterStartY) * targetProg;
                blendRatio = Math.min(scatteringProgress * 1.2, 1.0);
                this.displayColorRGBA = blendParsedColors(this.preScatterColorRGBA, this.defaultColorRGBA, blendRatio);
                break;
            case STATE.CLUSTER_TRANSITIONING:
                this.displayColorRGBA = { ...this.defaultColorRGBA };
                break;
        }
    }

    draw() {


         if (!ctx || !this.displayColorRGBA) return;
        const { r, g, b, a } = getScrollTintedColor(this.displayColorRGBA);
        const sprite = getGlowSprite(r, g, b, 'point');
        const spriteSize = this.size * 8;

        ctx.globalAlpha = a;
        ctx.drawImage(sprite, this.x - spriteSize / 2, this.y - spriteSize / 2, spriteSize, spriteSize);
        ctx.globalAlpha = 1;

        // Draw Lines
        if ((currentState === STATE.CLUSTERING || currentState === STATE.CLUSTER_MOVING || currentState === STATE.SETTLING) && this.clusterId !== null && this.clusterId < clusters.length) {
            const cluster = clusters[this.clusterId]; if (!cluster) return;
            const dx = this.x - cluster.x; const dy = this.y - cluster.y; const dist = Math.sqrt(dx * dx + dy * dy);
            const maxLineDist = (canvas ? Math.min(canvas.width, canvas.height) / 2.0 : 350);

            if (dist > 1 && dist < maxLineDist) {
                let stateBasedOpacityFactor = 0;
                const baseLineOpacity = 0.08 + (0.20 * (1 - dist / maxLineDist));
                const lineWidth = 0.8;

                if (currentState === STATE.CLUSTERING) { stateBasedOpacityFactor = Math.min(clusteringProgress / 0.5, 1.0); }
                else if (currentState === STATE.CLUSTER_MOVING) { stateBasedOpacityFactor = 1.0 - Math.max(0, (clusterMoveProgress - 0.5)) / 0.5; }
                else if (currentState === STATE.SETTLING) { stateBasedOpacityFactor = 1.0 - settlingProgress * 0.8; }

                if (stateBasedOpacityFactor > 0) {
                    const finalOpacity = baseLineOpacity * stateBasedOpacityFactor * a;
                    const strokeAlpha = Math.max(0.01, Math.min(finalOpacity, 0.7));
                    ctx.beginPath(); ctx.moveTo(this.x, this.y); ctx.lineTo(cluster.x, cluster.y);
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${strokeAlpha})`;
                    ctx.lineWidth = lineWidth;
                    ctx.stroke();
                }
            }
        }
    }
}

// --- Cluster Class ---
class Cluster {
     constructor(x, y) { this.x = x; this.y = y; this.initialX = x; this.initialY = y; this.targetX = x; this.targetY = y; this.transitionStartX = x; this.transitionStartY = y; this.nextInitialX = x; this.nextInitialY = y; this.colorString = this.generateColor(); this.colorRGBA = parseColor(this.colorString) || { r: 255, g: 0, b: 255, a: 0.9 }; this.nextColorString = this.colorString; this.nextColorRGBA = { ...this.colorRGBA }; this.transitionStartColorString = this.colorString; this.transitionStartColorRGBA = { ...this.colorRGBA }; this.size = 8; this.opacity = 1; this.pulse = 1; }
     generateColor() { const complementaryColors = ['rgba(205, 165, 255, 0.9)', 'rgba(255, 145, 215, 0.9)', 'rgba(105, 235, 205, 0.9)', 'rgba(255, 165, 105, 0.9)', 'rgba(125, 205, 255, 0.9)', 'rgba(245, 225, 105, 0.9)', 'rgba(115, 235, 145, 0.9)']; let newColor = this.colorString; while(newColor === this.colorString) { newColor = complementaryColors[Math.floor(Math.random() * complementaryColors.length)]; } return newColor; }
     setNextColor() { this.nextColorString = this.generateColor(); this.nextColorRGBA = parseColor(this.nextColorString) || { r: 0, g: 255, b: 255, a: 0.9 }; }
     update(time) { let easedProgress; switch (currentState) { case STATE.CLUSTERING: this.x = this.initialX; this.y = this.initialY; this.opacity = 1; this.pulse = 1 + Math.sin(time * 0.0015 + this.initialX) * 0.08; break; case STATE.CLUSTER_MOVING: easedProgress = easing.easeInOutQuad(clusterMoveProgress); this.x = this.initialX + (this.targetX - this.initialX) * easedProgress; this.y = this.initialY + (this.targetY - this.initialY) * easedProgress; this.opacity = 1; this.pulse = 1 + Math.sin(time * 0.002 + this.initialY) * 0.1 * (1 - clusterMoveProgress); break; case STATE.SETTLING: this.x = this.targetX; this.y = this.targetY; this.opacity = 1; this.pulse = 1 + Math.sin(time * 0.0025 + this.x) * 0.15 * (1 - settlingProgress); break; case STATE.SCATTERING: this.x = this.targetX; this.y = this.targetY; this.opacity = 1; this.pulse = 1; break; case STATE.CLUSTER_TRANSITIONING: easedProgress = easing.easeInOutCubic(clusterTransitionProgress); this.x = this.transitionStartX + (this.nextInitialX - this.transitionStartX) * easedProgress; this.y = this.transitionStartY + (this.nextInitialY - this.transitionStartY) * easedProgress; this.colorRGBA = blendParsedColors(this.transitionStartColorRGBA, this.nextColorRGBA, easedProgress); this.opacity = 1; this.pulse = 1; break; } }
     draw() { if (!ctx || this.opacity <= 0 || !this.colorRGBA) return; const currentSize = this.size * this.pulse; const { r, g, b, a } = getScrollTintedColor(this.colorRGBA); const sprite = getGlowSprite(r, g, b, 'cluster'); const spriteSize = currentSize * 10; ctx.globalAlpha = a * this.opacity; ctx.drawImage(sprite, this.x - spriteSize / 2, this.y - spriteSize / 2, spriteSize, spriteSize); ctx.globalAlpha = 1; ctx.beginPath(); ctx.arc(this.x, this.y, currentSize, 0, Math.PI * 2); ctx.strokeStyle = `rgba(255,255,255,${0.36*this.opacity})`; ctx.lineWidth = 1; ctx.stroke(); }
}

// --- Simulation Logic ---
function assignSinglePointToCluster(point) {
    if (!clusters.length || !point) return;
    let minDist = Infinity;
    let bestClusterId = null;
    for (let i = 0; i < clusters.length; i++) {
        const cluster = clusters[i];
        const dx = point.x - cluster.x;
        const dy = point.y - cluster.y;
        const dist = dx * dx + dy * dy;
        if (dist < minDist) {
            minDist = dist;
            bestClusterId = i;
        }
    }
    point.clusterId = bestClusterId;
    if (bestClusterId !== null && clusters[bestClusterId]?.colorRGBA) {
        point.displayColorRGBA = { ...clusters[bestClusterId].colorRGBA };
    } else {
        point.displayColorRGBA = { ...point.defaultColorRGBA };
    }
    point.initialX = point.x;
    point.initialY = point.y;
}

function initPoints() {
    if (!canvas) return; points = [];
    const clusterCenters = [];
    for (let i = 0; i < 3 + Math.floor(Math.random() * 3); i++) {
        clusterCenters.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, spread: Math.min(canvas.width, canvas.height) * (0.1 + Math.random() * 0.1) });
    }
    for (let i = 0; i < POINT_COUNT; i++) {
        let x, y;
        if (Math.random() < 0.85) {
            const center = clusterCenters[Math.floor(Math.random() * clusterCenters.length)];
            x = center.x + (Math.random() - 0.5) * 2 * center.spread;
            y = center.y + (Math.random() - 0.5) * 2 * center.spread;
        } else {
            x = Math.random() * canvas.width; y = Math.random() * canvas.height;
        }
        x = Math.max(20, Math.min(canvas.width - 20, x));
        y = Math.max(20, Math.min(canvas.height - 20, y));
        points.push(new Point(x, y));
    }
}
function initClusters() {
    if (!canvas) return; clusters = [];
    for (let i = 0; i < currentClusterCount; i++) {
        clusters.push(new Cluster(Math.random() * canvas.width, Math.random() * canvas.height));
    }
}
function assignPointsToClusters() {
    if (!clusters.length) return;
    for (const point of points) {
        let minDist = Infinity; let bestClusterId = null;
        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i]; const dx = point.x - cluster.x; const dy = point.y - cluster.y; const dist = dx * dx + dy * dy;
            if (dist < minDist) { minDist = dist; bestClusterId = i; }
        }
        point.clusterId = bestClusterId;
        if(bestClusterId !== null && clusters[bestClusterId]?.colorRGBA) {
            point.displayColorRGBA = {...clusters[bestClusterId].colorRGBA};
        } else { point.displayColorRGBA = {...point.defaultColorRGBA}; }
    }
}
function calculateClusterCentroids() {
    if (!clusters.length) return;
    for (let i = 0; i < clusters.length; i++) {
        let sumX = 0, sumY = 0, count = 0;
        for (const point of points) { if (point.clusterId === i) { sumX += point.x; sumY += point.y; count++; } }
        if (count > 0) { clusters[i].targetX = sumX / count; clusters[i].targetY = sumY / count; }
        else { clusters[i].targetX = clusters[i].x; clusters[i].targetY = clusters[i].y; }
    }
}
function prepareScatteringAndTransition() {
    if (!canvas || !clusters.length) return;
    for (const point of points) {
        point.scatterStartX = point.x; point.scatterStartY = point.y;
        point.preScatterColorRGBA = point.displayColorRGBA ? { ...point.displayColorRGBA } : { ...point.defaultColorRGBA };
        if (point.clusterId !== null && point.clusterId < clusters.length) {
            point.setScatterTarget(clusters[point.clusterId].x, clusters[point.clusterId].y);
        } else { point.setScatterTarget(point.x, point.y); }
    }
    for (const cluster of clusters) {
        cluster.transitionStartX = cluster.x; cluster.transitionStartY = cluster.y;
        cluster.transitionStartColorRGBA = cluster.colorRGBA ? { ...cluster.colorRGBA } : parseColor(cluster.generateColor());
        cluster.nextInitialX = Math.random() * canvas.width * 0.8 + canvas.width * 0.1;
        cluster.nextInitialY = Math.random() * canvas.height * 0.8 + canvas.height * 0.1;
        cluster.setNextColor();
    }
}

// --- State Transition Functions ---
function startClusterMoving() { currentState = STATE.CLUSTER_MOVING; stateStartTime = Date.now(); clusterMoveProgress = 0; clusters.forEach(c => { c.initialX = c.x; c.initialY = c.y; }); }
function startSettling() { currentState = STATE.SETTLING; stateStartTime = Date.now(); settlingProgress = 0; clusters.forEach(c => { c.x = c.targetX; c.y = c.targetY; }); }
function startScattering() { currentState = STATE.SCATTERING; stateStartTime = Date.now(); scatteringProgress = 0; prepareScatteringAndTransition(); }
function startClusterTransitioning() { currentState = STATE.CLUSTER_TRANSITIONING; stateStartTime = Date.now(); clusterTransitionProgress = 0; }
function collapsePointsToClusterCenters() {
    for (const point of points) {
        const cluster = point.clusterId !== null ? clusters[point.clusterId] : null;
        if (!cluster) continue;

        point.x = cluster.x;
        point.y = cluster.y;
        point.displayColorRGBA = { ...cluster.colorRGBA };
    }
}
function startInitialScattering() {
    calculateClusterCentroids();
    clusters.forEach(cluster => {
        cluster.x = cluster.targetX;
        cluster.y = cluster.targetY;
        cluster.initialX = cluster.x;
        cluster.initialY = cluster.y;
    });

    for (const point of points) {
        const cluster = point.clusterId !== null ? clusters[point.clusterId] : null;
        if (!cluster) continue;

        // Start from a compact grouped state so the first visible motion is the scatter phase.
        point.x = cluster.x + (Math.random() - 0.5) * 10;
        point.y = cluster.y + (Math.random() - 0.5) * 10;
        point.initialX = point.x;
        point.initialY = point.y;
        point.displayColorRGBA = { ...cluster.colorRGBA };
    }

    startScattering();
}
function startNextSimulation() {
    currentState = STATE.CLUSTERING; stateStartTime = Date.now(); clusteringProgress = 0;
    lastCentroidCalculation = 0;
    for (const cluster of clusters) {
        cluster.x = cluster.nextInitialX; cluster.y = cluster.nextInitialY; cluster.initialX = cluster.x; cluster.initialY = cluster.y; cluster.targetX = cluster.x; cluster.targetY = cluster.y; cluster.colorRGBA = cluster.nextColorRGBA || parseColor(cluster.generateColor()); cluster.colorString = cluster.nextColorString; cluster.opacity = 1; cluster.pulse = 1;
    }
    for (const point of points) {
        point.initialX = point.x; point.initialY = point.y; point.clusterId = null; point.displayColorRGBA = { ...point.defaultColorRGBA };
    }
    assignPointsToClusters();
}

// --- Draw/Update/Loop ---
function drawBackground() {
    if (!ctx || !canvas) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (Math.random() < 0.005) {
        ctx.fillStyle = `rgba(255, 255, 255, ${Math.random() * 0.2 + 0.1})`;
        ctx.beginPath();
        ctx.arc(Math.random() * canvas.width, Math.random() * canvas.height, Math.random() * 0.8, 0, Math.PI * 2);
        ctx.fill();
    }
}
function updateSimulation(currentTime) {
    const elapsed = currentTime - stateStartTime;
    switch (currentState) {
        case STATE.CLUSTERING: clusteringProgress = Math.min(elapsed / CLUSTERING_DURATION, 1); if (currentTime - lastCentroidCalculation >= CENTROID_INTERVAL) { calculateClusterCentroids(); lastCentroidCalculation = currentTime; } if (clusteringProgress >= 1) { collapsePointsToClusterCenters(); startScattering(); } break;
        case STATE.CLUSTER_MOVING: clusterMoveProgress = Math.min(elapsed / CLUSTER_MOVE_DURATION, 1); if (clusterMoveProgress >= 1) { startSettling(); } break;
        case STATE.SETTLING: settlingProgress = Math.min(elapsed / SETTLING_DURATION, 1); if (settlingProgress >= 1) { startScattering(); } break;
        case STATE.SCATTERING: scatteringProgress = Math.min(elapsed / SCATTERING_DURATION, 1); if (scatteringProgress >= 1) { startClusterTransitioning(); } break;
        case STATE.CLUSTER_TRANSITIONING: clusterTransitionProgress = Math.min(elapsed / CLUSTER_TRANSITION_DURATION, 1); if (clusterTransitionProgress >= 1) { startNextSimulation(); } break;
    }
}
function updateObjects() { const time = Date.now(); clusters.forEach(cluster => cluster.update(time)); points.forEach(point => point.update(time)); }
function draw() { if (!ctx) return; drawBackground(); points.forEach(point => point.draw()); clusters.forEach(cluster => cluster.draw()); }
function animate(timestamp = performance.now()) {
    if (!canvas || !ctx) { console.warn("Clustering canvas/context lost."); if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null; return; }

    animationFrameId = requestAnimationFrame(animate);
    const targetFps = isScrolling ? SCROLLING_FPS : NORMAL_FPS;
    const frameInterval = 1000 / targetFps;
    const elapsedSinceRender = timestamp - lastRenderTime;
    if (elapsedSinceRender < frameInterval) return;

    lastRenderTime = timestamp - (elapsedSinceRender % frameInterval);
    updateSimulation(Date.now());
    updateObjects();
    draw();
}

// --- Interaction ---
function handleCanvasClick(event) {
    if (!canvas || points.length >= MAX_POINTS) {
        if (points.length >= MAX_POINTS) console.log("Max points reached.");
        return;
    }
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;
    const newPoint = new Point(clickX, clickY);
    assignSinglePointToCluster(newPoint);
    points.push(newPoint);
    POINT_COUNT = points.length;
    console.log(`Added point ${points.length}/${MAX_POINTS} at ${clickX.toFixed(0)}, ${clickY.toFixed(0)}, assigned to cluster ${newPoint.clusterId}`);
}

// --- Exported Initialization Function ---
export function init() {
    // Prevent multiple initializations
    if (isInitialized || !canvas || !ctx) {
        if (!canvas || !ctx) console.error("Clustering canvas not ready for init.");
        return;
    }
    isInitialized = true;
    console.log("Initializing K-Means Clustering Animation...");

    if (animationFrameId) { cancelAnimationFrame(animationFrameId); animationFrameId = null; }
    updateScrollColor();
    window.addEventListener('scroll', scheduleScrollColorUpdate, { passive: true });
    window.addEventListener('resize', scheduleScrollColorUpdate);

    const homeSection = document.getElementById('home');
    if (!homeSection) {
        console.error("#home section not found! Cannot attach clustering click listener.");
        return;
    }

    const pageSections = document.querySelectorAll('main > section');
    if (pageSections.length > 0 && !canvas.dataset.sectionObserverAttached) {
        const sectionObserver = new IntersectionObserver(entries => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    canvas.dataset.clusterSection = entry.target.id;
                }
            });
        }, {
            rootMargin: '-42% 0px -42% 0px',
            threshold: 0
        });

        pageSections.forEach(section => sectionObserver.observe(section));
        canvas.dataset.sectionObserverAttached = 'true';
    }

    // Setup canvas size and initial state
    resizeCanvas(); // Initial size
    window.addEventListener('resize', resizeCanvas); // Handle resize

    currentClusterCount = INITIAL_CLUSTER_COUNT;
    lastRenderTime = 0;
    lastCentroidCalculation = 0;
    clusteringProgress = 0; clusterMoveProgress = 0; settlingProgress = 0; scatteringProgress = 0; clusterTransitionProgress = 0;
    initPoints();
    initClusters();
    assignPointsToClusters();
    startInitialScattering();

    // Attach click listener if not already attached
    if (!homeSection.dataset.clusteringListenerAttached) {
        homeSection.addEventListener('click', handleCanvasClick);
        homeSection.dataset.clusteringListenerAttached = 'true';
        console.log("Clustering click listener attached to #home section.");
    }

    animate(); // Start the animation loop
}

// Function to stop the animation (optional export)
export function stop() {
    if (animationFrameId) {
        cancelAnimationFrame(animationFrameId);
        animationFrameId = null;
    }
    // Remove listeners if needed
    window.removeEventListener('resize', resizeCanvas);
    window.removeEventListener('resize', scheduleScrollColorUpdate);
    window.removeEventListener('scroll', scheduleScrollColorUpdate);
    if (scrollColorFrameId !== null) {
        cancelAnimationFrame(scrollColorFrameId);
        scrollColorFrameId = null;
    }
    const homeSection = document.getElementById('home');
     if (homeSection && homeSection.dataset.clusteringListenerAttached) {
        homeSection.removeEventListener('click', handleCanvasClick);
        delete homeSection.dataset.clusteringListenerAttached; // Use delete for dataset properties
    }
    // Reset state
    points = [];
    clusters = [];
    glowSpriteCache.clear();
    isScrolling = false;
    isInitialized = false;
    console.log("Clustering animation stopped.");
}
