/**
 * knowledgeGraph.js
 * Handles rendering and interaction for the Vis.js knowledge graph.
 */

// --- Module‑scope variables -------------------------------------------------
let networkInstance = null;
let graphDataGlobal = { nodes: null, edges: null }; // Vis.js DataSets
let isFocused = false;
let resetButton = null;
let container = null;
let prefersReducedMotion = false;
let graphRendered = false;

// --- Constants --------------------------------------------------------------
const MIN_ZOOM_LEVEL = 0.25;
const PREFERRED_MIN_ZOOM = 0.35;
const MAX_ZOOM_LEVEL = 3.5;
const NODE_FONT_COLOR = "hsla(260,20%,18%,0.95)";
const EDGE_COLOR = "hsla(250,45%,82%,0.65)";
const EDGE_HIGHLIGHT_COLOR = "hsla(280,70%,88%,0.85)";
const EDGE_HOVER_COLOR = "hsla(250,60%,88%,0.75)";
const EDGE_FONT_COLOR = "hsla(0,0%,90%,0.85)";
const DIM_OPACITY = 0.35;

// --- Helpers ----------------------------------------------------------------
/** Deep‑clone a serialisable object.  */
const clone = obj => JSON.parse(JSON.stringify(obj));

/** Build a dimmed appearance for nodes / edges. */
function getDimmedAppearance(item) {
    if (item.originalAppearance?.edgeColor) { // It's an edge
        return {
            color: { color: `hsla(240, 10%, 50%, ${DIM_OPACITY})` },
            font: { color: `hsla(240, 10%, 50%, ${DIM_OPACITY})` },
            width: 1
        };
    } else if (item.originalAppearance?.nodeColor) { // It's a node
        return {
            color: {
                background: `hsla(240, 5%, 55%, ${DIM_OPACITY})`,
                border: `hsla(0, 0%, 60%, ${DIM_OPACITY / 2})`,
                highlight: { background: null, border: null }, // Keep original hue on hover
                hover: { background: null, border: null }
            },
            font: { color: `hsla(240, 5%, 55%, ${DIM_OPACITY})` }
        };
    }
    return {}; // Fallback
}

// --- Main render entry‑point -----------------------------------------------
function renderEnhancedKnowledgeGraph(graphData) {
    container = document.getElementById("knowledge-graph-enhanced-container");
    resetButton = document.getElementById("reset-graph-view-button");
    if (!container || !resetButton) {
        console.error("Graph container or reset button not found!");
        return;
    }    container.innerHTML = "";
    resetButton.style.display = "block"; // Always show reset button
    isFocused = false;

    // Remove any existing event listeners to prevent duplicates
    document.removeEventListener('click', handleDocumentClick);
    
    // Add reset instruction element
    const resetInstruction = document.createElement('div');
    resetInstruction.className = 'graph-reset-instruction';
    resetInstruction.textContent = 'Click outside the graph to reset view';
    container.appendChild(resetInstruction);

    if (typeof vis === "undefined" || !vis.Network) {
        console.error("Vis Network library not loaded!");
        container.innerHTML =
            '<p style="color:#ffaaaa;text-align:center;padding:40px;">Graph library failed to load.</p>';
        return;
    }

    prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const uniqueNodeTypes = [...new Set(graphData.nodes.map(n => n.type || "DEFAULT"))];
    const dynamicTypeColors = {};
    const baseHue = 280,
        sat = 85,
        light = 88,
        alpha = 0.9,
        hueStep = uniqueNodeTypes.length > 1 ? 360 / uniqueNodeTypes.length : 0;
    uniqueNodeTypes.forEach((t, i) => {
        dynamicTypeColors[t] =
            t === "DEFAULT"
                ? "hsla(0,0%,90%,0.85)"
                : `hsla(${Math.round((baseHue + i * hueStep) % 360)},${sat}%,${light}%,${alpha})`;
    });
    if (!dynamicTypeColors.DEFAULT) dynamicTypeColors.DEFAULT = "hsla(0,0%,90%,0.85)";    const nodes = graphData.nodes.map(node => {
        const nodeType = node.type || "DEFAULT";
        const bg = dynamicTypeColors[nodeType];
        const border = "hsla(0,0%,95%,0.3)";
        const nodeColor = {
            background: bg,
            border,
            highlight: { background: null, border: null },
            hover: { background: null, border: null }
        };
        return {
            id: node.id,
            label: node.label,
            title: `${node.label} (${nodeType})`,
            color: nodeColor,
            font: { color: NODE_FONT_COLOR, size: 13, face: "Inter, sans-serif" },
            shape: "box",
            shapeProperties: { borderRadius: 5 },
            margin: 16,  // Increased margin around nodes
            widthConstraint: {
                minimum: 120 // Ensure minimum width for all nodes
            },
            fixed: false, // Allow nodes to move during physics simulation
            mass: nodeType === "Person" ? 3 : 1.5, // Make central nodes heavier
            originalAppearance: {
                nodeColor: true,
                color: clone(nodeColor),
                font: clone({ color: NODE_FONT_COLOR }) // Clone font object too
            }
        };
    });const edges = graphData.edges.map((edge, idx) => {
        const edgeColor = {
            color: EDGE_COLOR,
            opacity: 0.75,
            highlight: EDGE_HIGHLIGHT_COLOR,
            hover: EDGE_HOVER_COLOR
        };
        return {
            id: `e${idx}`,
            from: edge.from,
            to: edge.to,
            label: edge.label,
            arrows: { to: { enabled: true, scaleFactor: 0.7, type: "arrow" } },
            color: edgeColor,
            font: {
                color: EDGE_FONT_COLOR,
                size: 10,
                face: "Inter, sans-serif",
                align: "top",
                vadjust: -10
            },
            length: prefersReducedMotion ? 190 : 160, // Increased edge length
            width: 1.8,
            // Customize smooth curve behavior to avoid overlaps
            smooth: { 
                enabled: true, 
                type: "curvedCW", // Changed to curved clockwise for better separation
                roundness: 0.25,  // Lower roundness for more direct curves
                forceDirection: true // Enforce direction to separate parallel edges
            },
            originalAppearance: {
                edgeColor: true,
                color: clone(edgeColor),
                font: clone({ color: EDGE_FONT_COLOR }), // Clone font object too
                width: 1.8
            }
        };
    });

    graphDataGlobal.nodes = new vis.DataSet(nodes);
    graphDataGlobal.edges = new vis.DataSet(edges);    const options = {
        physics: {
            enabled: !prefersReducedMotion,
            solver: "forceAtlas2Based",  // Using forceAtlas2Based for better edge distribution
            forceAtlas2Based: {
                gravitationalConstant: -100,  // Stronger repulsion
                centralGravity: 0.006,        // Further reduced central gravity
                springLength: 250,            // Further increased spring length
                springConstant: 0.1,          // Stronger spring force
                damping: 0.25,                // Less damping for more movement
                avoidOverlap: 1.0             // Maximum overlap avoidance
            },
            repulsion: {
                nodeDistance: 100,            // Minimum distance between nodes
                centralGravity: 0.005,
                springLength: 200,
                springConstant: 0.05
            },
            stabilization: { 
                enabled: true, 
                iterations: 2000,             // More iterations for better stabilization
                updateInterval: 25, 
                fit: true,
                onlyDynamicEdges: false,
                animationEnabled: true
            }
        },
        interaction: {
            hover: true,
            tooltipDelay: 150,
            navigationButtons: true,
            keyboard: true,
            zoomView: true,
            dragView: true,
            hoverConnectedEdges: true,
            selectConnectedEdges: true,
            zoomSpeed: 0.8,
            dragSpeed: 0.8
        },        nodes: {
            borderWidth: 1,
            size: 24, // Increased size
            margin: 16, // Increased margin globally
            font: {
                color: NODE_FONT_COLOR,
                size: 12,
                face: "Inter, sans-serif",
                bold: { mod: "bold" }
            },
            shapeProperties: { interpolation: false, borderRadius: 4 },
            color: {
                highlight: { background: null, border: null },
                hover: { background: null, border: null }
            },
            chosen: {
                node: function(values, id, selected, hovering) {
                    // Highlight node on hover
                    if (hovering) {
                        values.shadowSize = 10;
                        values.shadowColor = 'rgba(0,0,0,0.2)';
                    }
                }
            }
        },edges: {
            selectionWidth: 1.5,
            hoverWidth: 1.5,
            color: { highlight: EDGE_HIGHLIGHT_COLOR, hover: EDGE_HOVER_COLOR },
            font: {
                color: EDGE_FONT_COLOR,
                size: 9,
                face: "Inter, sans-serif",
                align: "top",
                vadjust: -8,
                strokeWidth: 0
            },
            smooth: { 
                enabled: true, 
                type: "curvedCW", 
                roundness: 0.25,
                forceDirection: true 
            },
            arrows: { to: { enabled: true, scaleFactor: 0.6, type: "arrow" } }
        },
        layout: { 
            improvedLayout: true, 
            randomSeed: 42,
            hierarchical: {
                enabled: false,         // Not using hierarchical layout but keeping options for future
                direction: "UD",
                sortMethod: "directed",
                nodeSpacing: 200,
                levelSeparation: 250
            }
        }
    };

    try {
        networkInstance?.destroy();
        networkInstance = new vis.Network(container, graphDataGlobal, options);

        // Set up interval to periodically check if graph is visible
        const viewCheckInterval = setInterval(() => {
            if (networkInstance && !isFocused) {
                checkAndCorrectView();
            }
        }, 2000); // Check every 2 seconds

        // Store interval ID for cleanup
        networkInstance.viewCheckInterval = viewCheckInterval;        networkInstance.once("stabilizationIterationsDone", () => {
            console.log("Graph stabilization complete.");
            if (!prefersReducedMotion) {
                // Apply one final physics simulation with stronger parameters to push nodes away from edges
                networkInstance.setOptions({
                    physics: {
                        enabled: true,
                        solver: "forceAtlas2Based",
                        forceAtlas2Based: {
                            gravitationalConstant: -120,
                            centralGravity: 0,
                            springLength: 300,
                            springConstant: 0.15,
                            avoidOverlap: 1.0
                        },
                        stabilization: { iterations: 50 }
                    }
                });
                
                // Then disable physics after final adjustments
                setTimeout(() => {
                    networkInstance.setOptions({ physics: false });
                }, 1500);
            }

            document.addEventListener('click', handleDocumentClick);
        });

        networkInstance.on("click", handleGraphClick);
        networkInstance.on("release", checkAndCorrectView);
        networkInstance.on("dragEnd", checkAndCorrectView);
        resetButton.addEventListener("click", resetGraphFocus);
    } catch (err) {
        console.error("Error creating Vis Network:", err);
        container.innerHTML =
            '<p style="color:#ffaaaa;text-align:center;padding:40px;">Error displaying knowledge graph.</p>';
    }
}

// --- Click handler ----------------------------------------------------------
function restoreAllAppearance() {
    const nodeUpdates = [];
    const edgeUpdates = [];

    graphDataGlobal.nodes.forEach(n => nodeUpdates.push({
        id: n.id,
        color: clone(n.originalAppearance.color), // MODIFIED: Use deep clone
        font:  clone(n.originalAppearance.font)   // MODIFIED: Use deep clone
    }));
    graphDataGlobal.edges.forEach(e => edgeUpdates.push({
        id: e.id,
        color: clone(e.originalAppearance.color), // MODIFIED: Use deep clone
        font:  clone(e.originalAppearance.font),  // MODIFIED: Use deep clone
        width: e.originalAppearance.width         // width is a primitive, direct assignment is fine
    }));

    // Check if there are updates to prevent empty update calls
    if (nodeUpdates.length > 0) {
        graphDataGlobal.nodes.update(nodeUpdates);
    }
    if (edgeUpdates.length > 0) {
        graphDataGlobal.edges.update(edgeUpdates);
    }
}


function handleGraphClick(params) {
    if (!networkInstance) return;

    // Always restore all nodes/edges to original appearance before applying new highlight/dim
    restoreAllAppearance();

    if (params.nodes.length) {
        isFocused = true;
        // Add visual indicator class to container
        container.classList.add('has-focus');
        
        const selectedId = params.nodes[0];
        const neighbours = networkInstance.getConnectedNodes(selectedId);
        const inFocus = new Set([selectedId, ...neighbours]);

        const nodeUpdates = [];
        const edgeUpdates = [];

        graphDataGlobal.nodes.forEach(n => {
            if (inFocus.has(n.id)) {
                nodeUpdates.push({ id: n.id, color: clone(n.originalAppearance.color), font: clone(n.originalAppearance.font) });
            } else {
                const dim = getDimmedAppearance(n);
                nodeUpdates.push({ id: n.id, color: clone(dim.color), font: clone(dim.font) });
            }
        });

        graphDataGlobal.edges.forEach(e => {
            const highlight = inFocus.has(e.from) && inFocus.has(e.to);
            if (highlight) {
                edgeUpdates.push({ id: e.id, color: clone(e.originalAppearance.color), font: clone(e.originalAppearance.font), width: e.originalAppearance.width });
            } else {
                const dim = getDimmedAppearance(e);
                edgeUpdates.push({ id: e.id, color: clone(dim.color), font: clone(dim.font), width: dim.width });
            }
        });

        graphDataGlobal.nodes.update(nodeUpdates);
        graphDataGlobal.edges.update(edgeUpdates);

        networkInstance.fit({ nodes: [...inFocus], animation: { duration: 500, easingFunction: "easeOutQuad" } });
        resetButton.style.display = "block";
    } else if (isFocused) {
        resetGraphFocus();
    }
}

// --- Reset focus & view -----------------------------------------------------
function resetGraphFocus() {
    if (!networkInstance) return; // Return only if there's no network instance
    
    // If graph is focused, restore node and edge appearance
    if (isFocused) {
        isFocused = false;
        // Remove visual indicator class from container
        container.classList.remove('has-focus');

        const nodeRestores = [];
        const edgeRestores = [];

        graphDataGlobal.nodes.forEach(n => nodeRestores.push({
            id: n.id,
            color: clone(n.originalAppearance.color),
            font: clone(n.originalAppearance.font) // MODIFIED: Use clone
        }));
        graphDataGlobal.edges.forEach(e => edgeRestores.push({
            id: e.id,
            color: clone(e.originalAppearance.color),
            font: clone(e.originalAppearance.font), // MODIFIED: Use clone
            width: e.originalAppearance.width
        }));

        if (nodeRestores.length > 0) {
            graphDataGlobal.nodes.update(nodeRestores);
        }
        if (edgeRestores.length > 0) {
            graphDataGlobal.edges.update(edgeRestores);
        }
    }

    // Always fit the graph to view and reset the zoom
    networkInstance.fit({
        animation: { 
            duration: 500, 
            easingFunction: "easeOutQuad" 
        }
    });
    
    // After fitting, ensure zoom is at preferred level
    if (networkInstance.getScale() < PREFERRED_MIN_ZOOM) {
        networkInstance.moveTo({ 
            scale: PREFERRED_MIN_ZOOM, 
            animation: { 
                duration: 300, 
                easingFunction: "easeOutQuad" 
            } 
        });
    }
    
    console.log("Graph view reset.");
}

// --- Keep graph visible & zoom sane ----------------------------------------
function checkAndCorrectView() {
    if (!networkInstance || isFocused) return;

    const zoom = networkInstance.getScale();
    if (zoom < MIN_ZOOM_LEVEL) {
        networkInstance.moveTo({ scale: PREFERRED_MIN_ZOOM, animation: { duration: 300, easingFunction: "easeOutQuad" } });
    } else if (zoom > MAX_ZOOM_LEVEL) {
        networkInstance.moveTo({ scale: MAX_ZOOM_LEVEL, animation: { duration: 300, easingFunction: "easeOutQuad" } });
    }

    const ids = graphDataGlobal.nodes.getIds();
    if (!ids.length) return;

    const pos = networkInstance.getPositions(ids);
    let cx = 0,
        cy = 0;
    ids.forEach(id => {
        cx += pos[id].x;
        cy += pos[id].y;
    });
    cx /= ids.length;
    cy /= ids.length;

    const view = networkInstance.getViewPosition();
    const dist = Math.hypot(view.x - cx, view.y - cy);
    const threshold = 2 * (1 / zoom) * Math.max(container.clientWidth, container.clientHeight);
    
    // If the center of the graph is too far from the center of the view, reset
    if (dist > threshold) {
        console.log("Graph went out of view - resetting position");
        networkInstance.fit({ animation: { duration: 400, easingFunction: "easeOutQuad" } });
    }
}

// --- Public API -------------------------------------------------------------
export function fetchGraphDataAndRender() {
    if (graphRendered && networkInstance) {
        try {
            if (isFocused) resetGraphFocus();
            networkInstance.fit({ animation: { duration: 500, easingFunction: "easeOutQuad" } });
        } catch (e) {
            console.warn("Couldn't refit network view on re-toggle:", e);
        }
        return;
    }

    fetch("./js/visualizations/graph.json") // Ensure this path is correct
        .then(res => {
            if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
            return res.json();
        })
        .then(data => {
            if (!data || !Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
                throw new Error("Graph data is not in the expected format.");
            }
            renderEnhancedKnowledgeGraph(data);
            graphRendered = true;
            
            // Add click handler to document to reset focus when clicking outside
            document.addEventListener('click', handleDocumentClick);
        })
        .catch(err => {
            console.error("Could not fetch or render knowledge graph:", err);
            if (container) { // Ensure container exists before trying to set its innerHTML
                container.innerHTML =
                    '<p style="color:#ffaaaa;text-align:center;padding:40px;">Could not load knowledge graph data.</p>';
            }
            graphRendered = false;
        });
}

// Update the handleDocumentClick function to always reset to default zoom when clicking outside
function handleDocumentClick(event) {
    // Only process if we have a valid network instance and container
    if (!networkInstance || !container) return;
    
    // Check if the click was outside the graph container and not on the reset button
    const clickedOnGraph = event.target.closest('#knowledge-graph-enhanced-container');
    const clickedOnResetButton = event.target.closest('.vis-reset-button, #reset-graph-view-button');
    
    if (!clickedOnGraph && !clickedOnResetButton) {
        console.log("Click outside graph - resetting to default view");
        
        // Reset focus if focused
        if (isFocused) {
            resetGraphFocus();
        } 
        // Even if not focused, reset to default zoom and center
        else {
            // Fit to view with animation
            networkInstance.fit({
                animation: { 
                    duration: 500, 
                    easingFunction: "easeOutQuad" 
                }
            });
            
            // Additionally, ensure zoom is at preferred level
            if (networkInstance.getScale() < PREFERRED_MIN_ZOOM) {
                networkInstance.moveTo({ 
                    scale: PREFERRED_MIN_ZOOM, 
                    animation: { 
                        duration: 300, 
                        easingFunction: "easeOutQuad" 
                    } 
                });
            }
        }
    }
}

export function destroyGraph() {
    if (networkInstance) {
        // Clear the view check interval
        if (networkInstance.viewCheckInterval) {
            clearInterval(networkInstance.viewCheckInterval);
            networkInstance.viewCheckInterval = null;
        }
        
        resetButton?.removeEventListener("click", resetGraphFocus);
        networkInstance.destroy();
        networkInstance = null;
        
        // Remove document click handler when destroying the graph
        document.removeEventListener('click', handleDocumentClick);
    }
    container && (container.innerHTML = "");
    resetButton && (resetButton.style.display = "none");
    graphRendered = false;
    isFocused = false;
    graphDataGlobal = { nodes: null, edges: null }; // Reset DataSets
    console.log("Knowledge graph destroyed.");
}