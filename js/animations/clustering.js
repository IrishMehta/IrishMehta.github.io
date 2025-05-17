// js/animations/clustering.js
import { parseColor, blendParsedColors, easing } from '../utils.js'; // Import needed utilities

// --- Constants, Globals, Helpers ---
const canvas = document.getElementById('cluster-canvas');
if (!canvas) console.error("Canvas element #cluster-canvas not found!");
const ctx = canvas ? canvas.getContext('2d') : null;

let POINT_COUNT = 200;
const MAX_POINTS = 500;
const INITIAL_CLUSTER_COUNT = 6;

const CLUSTERING_DURATION = 8000;
const CLUSTER_MOVE_DURATION = 2000;
const SETTLING_DURATION = 700;
const SCATTERING_DURATION = 2000;
const CLUSTER_TRANSITION_DURATION = 1500;

const STATE = { CLUSTERING: 'clustering', CLUSTER_MOVING: 'cluster_moving', SETTLING: 'settling', SCATTERING: 'scattering', CLUSTER_TRANSITIONING: 'cluster_transitioning' };

let points = [];
let clusters = [];
let currentState = STATE.CLUSTERING;
let stateStartTime = Date.now();
let clusteringProgress = 0, clusterMoveProgress = 0, settlingProgress = 0, scatteringProgress = 0, clusterTransitionProgress = 0;
let animationFrameId = null;
let currentClusterCount = INITIAL_CLUSTER_COUNT;
let isInitialized = false; // Module-specific flag

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
        this.defaultColorString = 'rgba(255, 255, 255, 0.5)';
        this.defaultColorRGBA = parseColor(this.defaultColorString) || { r: 255, g: 255, b: 255, a: 0.5 };
        this.displayColorRGBA = { ...this.defaultColorRGBA };
        this.preScatterColorRGBA = { ...this.defaultColorRGBA };
        this.size = Math.random() * 2.5 + 1.5;
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
                    targetProg = Math.min(easedProgress * this.speedFactor, 1.0);
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
        const { r, g, b, a } = this.displayColorRGBA;
        const displayColorString = `rgba(${r}, ${g}, ${b}, ${a})`;
        const glowColorString = `rgba(${r}, ${g}, ${b}, ${a * 0.20})`;
        const glow = this.size * 3.0;

        // Draw Glow & Point
        ctx.beginPath(); ctx.arc(this.x, this.y, glow, 0, Math.PI * 2); ctx.fillStyle = glowColorString; ctx.fill();
        ctx.beginPath(); ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2); ctx.fillStyle = displayColorString; ctx.fill();

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
     constructor(x, y) { this.x = x; this.y = y; this.initialX = x; this.initialY = y; this.targetX = x; this.targetY = y; this.transitionStartX = x; this.transitionStartY = y; this.nextInitialX = x; this.nextInitialY = y; this.colorString = this.generateColor(); this.colorRGBA = parseColor(this.colorString) || { r: 255, g: 0, b: 255, a: 0.7 }; this.nextColorString = this.colorString; this.nextColorRGBA = { ...this.colorRGBA }; this.transitionStartColorString = this.colorString; this.transitionStartColorRGBA = { ...this.colorRGBA }; this.size = 8; this.opacity = 1; this.pulse = 1; }
     generateColor() { const complementaryColors = ['rgba(190, 160, 240, 0.75)', 'rgba(255, 180, 220, 0.75)', 'rgba(140, 230, 210, 0.75)', 'rgba(255, 190, 150, 0.75)', 'rgba(170, 215, 255, 0.75)', 'rgba(240, 240, 160, 0.75)', 'rgba(160, 240, 160, 0.75)']; let newColor = this.colorString; while(newColor === this.colorString) { newColor = complementaryColors[Math.floor(Math.random() * complementaryColors.length)]; } return newColor; }
     setNextColor() { this.nextColorString = this.generateColor(); this.nextColorRGBA = parseColor(this.nextColorString) || { r: 0, g: 255, b: 255, a: 0.7 }; }
     update(time) { let easedProgress; switch (currentState) { case STATE.CLUSTERING: this.x = this.initialX; this.y = this.initialY; this.opacity = 1; this.pulse = 1 + Math.sin(time * 0.0015 + this.initialX) * 0.08; break; case STATE.CLUSTER_MOVING: easedProgress = easing.easeInOutQuad(clusterMoveProgress); this.x = this.initialX + (this.targetX - this.initialX) * easedProgress; this.y = this.initialY + (this.targetY - this.initialY) * easedProgress; this.opacity = 1; this.pulse = 1 + Math.sin(time * 0.002 + this.initialY) * 0.1 * (1 - clusterMoveProgress); break; case STATE.SETTLING: this.x = this.targetX; this.y = this.targetY; this.opacity = 1; this.pulse = 1 + Math.sin(time * 0.0025 + this.x) * 0.15 * (1 - settlingProgress); break; case STATE.SCATTERING: this.x = this.targetX; this.y = this.targetY; this.opacity = 1; this.pulse = 1; break; case STATE.CLUSTER_TRANSITIONING: easedProgress = easing.easeInOutCubic(clusterTransitionProgress); this.x = this.transitionStartX + (this.nextInitialX - this.transitionStartX) * easedProgress; this.y = this.transitionStartY + (this.nextInitialY - this.transitionStartY) * easedProgress; this.colorRGBA = blendParsedColors(this.transitionStartColorRGBA, this.nextColorRGBA, easedProgress); this.opacity = 1; this.pulse = 1; break; } }
     draw() { if (!ctx || this.opacity <= 0 || !this.colorRGBA) return; const currentSize = this.size * this.pulse; const { r, g, b, a } = this.colorRGBA; const baseAlpha = a; const gradient = ctx.createRadialGradient(this.x, this.y, currentSize*0.2, this.x, this.y, currentSize*5); gradient.addColorStop(0, `rgba(${r},${g},${b},${baseAlpha*0.5*this.opacity})`); gradient.addColorStop(0.5, `rgba(${r},${g},${b},${baseAlpha*0.2*this.opacity})`); gradient.addColorStop(1,`rgba(${r},${g},${b},0)`); ctx.beginPath(); ctx.arc(this.x, this.y, currentSize*5, 0, Math.PI*2); ctx.fillStyle = gradient; ctx.fill(); ctx.beginPath(); ctx.arc(this.x, this.y, currentSize, 0, Math.PI*2); ctx.fillStyle = `rgba(${r},${g},${b},${baseAlpha*this.opacity})`; ctx.fill(); ctx.strokeStyle = `rgba(255,255,255,${0.3*this.opacity})`; ctx.lineWidth = 1; ctx.stroke(); }
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
function startNextSimulation() {
    currentState = STATE.CLUSTERING; stateStartTime = Date.now(); clusteringProgress = 0;
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
function updateSimulation() {
    const currentTime = Date.now(); const elapsed = currentTime - stateStartTime;
    switch (currentState) {
        case STATE.CLUSTERING: clusteringProgress = Math.min(elapsed / CLUSTERING_DURATION, 1); calculateClusterCentroids(); if (clusteringProgress >= 1) { startClusterMoving(); } break;
        case STATE.CLUSTER_MOVING: clusterMoveProgress = Math.min(elapsed / CLUSTER_MOVE_DURATION, 1); if (clusterMoveProgress >= 1) { startSettling(); } break;
        case STATE.SETTLING: settlingProgress = Math.min(elapsed / SETTLING_DURATION, 1); if (settlingProgress >= 1) { startScattering(); } break;
        case STATE.SCATTERING: scatteringProgress = Math.min(elapsed / SCATTERING_DURATION, 1); if (scatteringProgress >= 1) { startClusterTransitioning(); } break;
        case STATE.CLUSTER_TRANSITIONING: clusterTransitionProgress = Math.min(elapsed / CLUSTER_TRANSITION_DURATION, 1); if (clusterTransitionProgress >= 1) { startNextSimulation(); } break;
    }
}
function updateObjects() { const time = Date.now(); clusters.forEach(cluster => cluster.update(time)); points.forEach(point => point.update(time)); }
function draw() { if (!ctx) return; drawBackground(); points.forEach(point => point.draw()); clusters.forEach(cluster => cluster.draw()); }
function animate() {
    if (!canvas || !ctx) { console.warn("Clustering canvas/context lost."); if (animationFrameId) cancelAnimationFrame(animationFrameId); animationFrameId = null; return; }
    updateSimulation();
    updateObjects();
    draw();
    animationFrameId = requestAnimationFrame(animate);
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

    const homeSection = document.getElementById('home');
    if (!homeSection) {
        console.error("#home section not found! Cannot attach clustering click listener.");
        return;
    }

    // Setup canvas size and initial state
    resizeCanvas(); // Initial size
    window.addEventListener('resize', resizeCanvas); // Handle resize

    currentClusterCount = INITIAL_CLUSTER_COUNT;
    clusteringProgress = 0; clusterMoveProgress = 0; settlingProgress = 0; scatteringProgress = 0; clusterTransitionProgress = 0;
    initPoints();
    initClusters();
    assignPointsToClusters();
    currentState = STATE.CLUSTERING;
    stateStartTime = Date.now();

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
    const homeSection = document.getElementById('home');
     if (homeSection && homeSection.dataset.clusteringListenerAttached) {
        homeSection.removeEventListener('click', handleCanvasClick);
        delete homeSection.dataset.clusteringListenerAttached; // Use delete for dataset properties
    }
    // Reset state
    points = [];
    clusters = [];
    isInitialized = false;
    console.log("Clustering animation stopped.");
}