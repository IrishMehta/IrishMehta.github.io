// js/utils.js

// ===== Utility: Get CSS Variable Value =====
export function getCssVariable(varName) {
    // Ensure CSS is loaded and variable exists
    const value = getComputedStyle(document.documentElement).getPropertyValue(varName);
    return value ? value.trim() : null; // Return null if variable not found
}

// ===== Utility: Convert Hex/RGB String to RGB Array =====
export function parseColorToRgb(colorString) {
    if (!colorString) return [0, 0, 0]; // Default to black if color is null/undefined

    if (colorString.startsWith('rgb')) {
        const parts = colorString.match(/(\d+)/g);
        if (parts && parts.length >= 3) {
            return [parseInt(parts[0]), parseInt(parts[1]), parseInt(parts[2])];
        }
    } else if (colorString.startsWith('#')) {
        let hex = colorString;
        let r = 0, g = 0, b = 0;
        if (hex.length == 4) { // Expand short hex
            r = parseInt(hex[1] + hex[1], 16);
            g = parseInt(hex[2] + hex[2], 16);
            b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length == 7) {
            r = parseInt(hex[1] + hex[2], 16);
            g = parseInt(hex[3] + hex[4], 16);
            b = parseInt(hex[5] + hex[6], 16);
        }
        return [r, g, b];
    }
    console.warn("Could not parse color:", colorString);
    return [0, 0, 0]; // Fallback
}

// ===== Utility: Convert RGB array to CSS string ---
export function rgbToString(rgb) {
    const r = Math.round(rgb[0]);
    const g = Math.round(rgb[1]);
    const b = Math.round(rgb[2]);
    return `rgb(${r}, ${g}, ${b})`;
}

// ===== Utility: Linear Interpolation (Lerp) =====
export function lerp(start, end, progress) {
    const clampedProgress = Math.max(0, Math.min(1, progress));
    return start + (end - start) * clampedProgress;
}

// ===== Utility: RGB Color Interpolation =====
export function interpolateRgbColor(rgb1, rgb2, progress) {
    const r = lerp(rgb1[0], rgb2[0], progress);
    const g = lerp(rgb1[1], rgb2[1], progress);
    const b = lerp(rgb1[2], rgb2[2], progress);
    return [r, g, b];
}

// ===== Utility: Easing Function (EaseInOutQuad) =====
export function easeInOutQuad(t) {
    const clampedT = Math.max(0, Math.min(1, t));
    return clampedT < 0.5 ? 2 * clampedT * clampedT : -1 + (4 - 2 * clampedT) * clampedT;
}

// ===== Utility: Parse RGBA Color String (Used in Clustering) =====
// NOTE: Moved from clustering animation helpers
export function parseColor(colorString){
    if(!colorString) return null;
    const match=colorString.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
    if(!match) return null;
    return {
        r:parseInt(match[1]),
        g:parseInt(match[2]),
        b:parseInt(match[3]),
        a:match[4]===undefined?1:parseFloat(match[4])
    };
}

// ===== Utility: Blend Parsed RGBA Colors (Used in Clustering) =====
// NOTE: Moved from clustering animation helpers
export function blendParsedColors(rgba1,rgba2,ratio){
    if(!rgba1||!rgba2) return rgba1||rgba2||{r:255,g:255,b:255,a:0.1};
    const r=Math.round(rgba1.r+(rgba2.r-rgba1.r)*ratio);
    const g=Math.round(rgba1.g+(rgba2.g-rgba1.g)*ratio);
    const b=Math.round(rgba1.b+(rgba2.b-rgba1.b)*ratio);
    const a=rgba1.a+(rgba2.a-rgba1.a)*ratio;
    return{r,g,b,a};
}

// ===== Utility: Easing Functions Object (Used in Clustering) =====
// NOTE: Moved from clustering animation helpers
export const easing = {
    easeInOutCubic: t => t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2,
    easeOutQuad: t => 1 - (1 - t) * (1 - t),
    easeInOutQuad: t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2,
    easeInOutBack: t => { const c1 = 1.70158, c2 = c1 * 1.525; return t < .5 ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2 : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2 },
    easeOutElastic: t => { const c4 = (2 * Math.PI) / 3; return t === 0 ? 0 : t === 1 ? 1 : Math.pow(2, -10 * t) * Math.sin((t * 10 - .75) * c4) + 1 },
    easeOutCubic: t => 1 - Math.pow(1 - t, 3)
};