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
let isMobileDevice = false; // Track if we're on a mobile device
let viewCheckInterval = null; // Interval for checking/correcting view
// Store initial state for proper reset
let initialNodePositions = {}; // Will store node positions after stabilization
let initialViewScale = null; // Will store initial scale after stabilization
let initialViewPosition = null; // Will store initial center position after stabilization

// --- Constants --------------------------------------------------------------
const MIN_ZOOM_LEVEL = 0.25;
const PREFERRED_MIN_ZOOM = 0.35;
const MAX_ZOOM_LEVEL = 3.5;
const MOBILE_MIN_ZOOM_LEVEL = 0.4; // Higher min zoom for mobile
const MOBILE_PREFERRED_MIN_ZOOM = 0.5; // Higher preferred min zoom for mobile
const MOBILE_MAX_ZOOM_LEVEL = 2.5; // Lower max zoom for mobile
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
                highlight: { background: "#f9f9f9", border: "#cccccc" }, // Light highlight on hover
                hover: { background: "#f0f0f0", border: "#dddddd" }
            },
            font: { color: `hsla(240, 5%, 55%, ${DIM_OPACITY})` }
        };
    }
    return {}; // Fallback
}

// --- Main render entry‑point -----------------------------------------------
function renderEnhancedKnowledgeGraph(graphData) {
    // Clear any existing view check interval at the beginning
    if (viewCheckInterval) {
        clearInterval(viewCheckInterval);
        viewCheckInterval = null;
    }

    container = document.getElementById("knowledge-graph-enhanced-container");
    resetButton = document.getElementById("reset-graph-view-button");
    if (!container || !resetButton) {
        console.error("Graph container or reset button not found!");
        return;
    }
    
    container.innerHTML = "";
    resetButton.style.display = "block"; // Always show reset button
    isFocused = false;

    // Check if we're on a mobile device
    isMobileDevice = window.matchMedia('(max-width: 768px)').matches || 
                     /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    // Add a class to container if on mobile
    if (isMobileDevice) {
        container.classList.add('mobile-view');
        console.log("Mobile device detected - applying optimized settings");
    }

    // Remove any existing event listeners to prevent duplicates
    document.removeEventListener('click', handleDocumentClick);
    
    // Add reset instruction element
    const resetInstruction = document.createElement('div');
    resetInstruction.className = 'graph-reset-instruction';
    resetInstruction.textContent = isMobileDevice ? 'Tap outside the graph to reset view' : 'Click outside the graph to reset view';
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
    if (!dynamicTypeColors.DEFAULT) dynamicTypeColors.DEFAULT = "hsla(0,0%,90%,0.85)";    
    const nodes = graphData.nodes.map(node => {
        const nodeType = node.type || "DEFAULT";
        const bg = dynamicTypeColors[nodeType];
        const border = "hsla(0,0%,95%,0.3)";
        const nodeColor = {
            background: bg,
            border,
            highlight: { background: null, border: null },            
            hover: { background: "#f0f0f0", border: "#dddddd" }
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
    });
    const edges = graphData.edges.map((edge, idx) => {
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
    graphDataGlobal.edges = new vis.DataSet(edges);
    
    // Base options with physics tailored for device type
    const options = {
        physics: {
            enabled: !prefersReducedMotion,
            solver: "forceAtlas2Based",
            forceAtlas2Based: {
                gravitationalConstant: isMobileDevice ? -80 : -100, // Less repulsion on mobile
                centralGravity: isMobileDevice ? 0.01 : 0.006,      // More central gravity on mobile
                springLength: isMobileDevice ? 200 : 250,           // Shorter springs on mobile
                springConstant: isMobileDevice ? 0.15 : 0.1,        // Stronger spring force on mobile
                damping: 0.25,
                avoidOverlap: 1.0
            },
            repulsion: {
                nodeDistance: isMobileDevice ? 80 : 100,            // Smaller node distance on mobile
                centralGravity: isMobileDevice ? 0.01 : 0.005,
                springLength: isMobileDevice ? 150 : 200,
                springConstant: 0.05
            },            
            stabilization: { 
                enabled: true, 
                iterations: isMobileDevice ? 1500 : 2000,          // Fewer iterations on mobile for performance
                updateInterval: isMobileDevice ? 50 : 25,          // Less frequent updates on mobile
                fit: true,
                onlyDynamicEdges: false
            }
        },        
        interaction: {
            hover: true,
            tooltipDelay: isMobileDevice ? 300 : 150,              // Longer delay on mobile for tap recognition
            navigationButtons: !isMobileDevice,                     // Hide navigation buttons on mobile
            keyboard: !isMobileDevice,                              // Disable keyboard on mobile
            zoomView: true,
            dragView: true,
            dragNodes: true,                                        // Ensure nodes can be dragged
            hoverConnectedEdges: true,
            selectConnectedEdges: true,
            zoomSpeed: isMobileDevice ? 0.6 : 0.8,                 // Slower zoom on mobile
            multiselect: false,                                     // Disable multiselect for better mobile experience
            // Mobile-specific touch options
            hideEdgesOnDrag: isMobileDevice,                        // Hide edges while dragging on mobile for better performance
            hideNodesOnDrag: false,
            selectable: true
        },
        nodes: {
            borderWidth: 1,
            size: isMobileDevice ? 20 : 24, // Slightly smaller on mobile
            margin: isMobileDevice ? 12 : 16, // Reduced margin on mobile
            font: {
                color: NODE_FONT_COLOR,
                size: isMobileDevice ? 10 : 12, // Smaller font on mobile
                face: "Inter, sans-serif",
                bold: { mod: "bold" }
            },
            shapeProperties: { interpolation: false, borderRadius: 4 },            
            color: {
                highlight: { background: "#f9f9f9", border: "#cccccc" },
                hover: { background: "#f0f0f0", border: "#dddddd" }
            },
            chosen: {
                node: function(values, id, selected, hovering) {
                    // Highlight node on hover/tap
                    if (hovering || selected) {
                        values.shadowSize = isMobileDevice ? 6 : 10;
                        values.shadowColor = 'rgba(0,0,0,0.2)';
                    }
                }
            }
        },
        edges: {
            selectionWidth: isMobileDevice ? 2 : 1.5, // Make selections more visible on mobile
            hoverWidth: isMobileDevice ? 2 : 1.5, // Make hover more visible on mobile
            color: { highlight: EDGE_HIGHLIGHT_COLOR, hover: EDGE_HOVER_COLOR },
            font: {
                color: EDGE_FONT_COLOR,
                size: isMobileDevice ? 8 : 9, // Smaller font on mobile
                face: "Inter, sans-serif",
                align: "top",
                vadjust: -8,
                strokeWidth: 0
            },
            smooth: { 
                enabled: true, 
                type: "curvedCW", 
                roundness: isMobileDevice ? 0.3 : 0.25, // Increase curve on mobile to avoid overlapping
                forceDirection: true 
            },
            arrows: { 
                to: { 
                    enabled: true, 
                    scaleFactor: isMobileDevice ? 0.5 : 0.6, // Smaller arrows on mobile
                    type: "arrow" 
                } 
            }
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
        graphRendered = true;

        networkInstance.on("stabilizationIterationsDone", () => {
            console.log("Graph stabilization complete. Physics will be turned off.");
            if (!networkInstance) return;

            networkInstance.setOptions({ physics: false });

            // Delay to allow graph to settle after physics off & initial fit
            setTimeout(() => {
                if (!networkInstance) return;

                const currentScale = networkInstance.getScale();
                let desiredScale = currentScale;
                let adjustZoom = false;

                if (isMobileDevice) {
                    if (currentScale < MOBILE_PREFERRED_MIN_ZOOM) {
                        desiredScale = MOBILE_PREFERRED_MIN_ZOOM;
                        adjustZoom = true;
                    } else if (currentScale > MOBILE_MAX_ZOOM_LEVEL) {
                        desiredScale = MOBILE_MAX_ZOOM_LEVEL;
                        adjustZoom = true;
                    }
                } else {
                    // Optional: Desktop initial zoom adjustment if needed
                    // if (currentScale < PREFERRED_MIN_ZOOM) {
                    //     desiredScale = PREFERRED_MIN_ZOOM;
                    //     adjustZoom = true;
                    // } else if (currentScale > MAX_ZOOM_LEVEL) {
                    //     desiredScale = MAX_ZOOM_LEVEL;
                    //     adjustZoom = true;
                    // }
                }

                const finalizeSetup = () => {
                    storeInitialGraphState(); // Store state *after* any adjustments

                    if (viewCheckInterval) { // Clear again just in case (e.g., rapid re-renders)
                        clearInterval(viewCheckInterval);
                    }
                    const intervalTime = isMobileDevice ? 10000 : 2000; // 10s mobile, 2s desktop
                    viewCheckInterval = setInterval(checkAndCorrectView, intervalTime);
                    console.log(`View check interval set to ${intervalTime}ms (Mobile: ${isMobileDevice}). Initial state stored.`);
                };

                if (adjustZoom) {
                    console.log(`Initial zoom adjustment: from ${currentScale.toFixed(3)} to ${desiredScale.toFixed(3)} on ${isMobileDevice ? 'mobile' : 'desktop'}`);
                    networkInstance.moveTo({
                        scale: desiredScale,
                        animation: prefersReducedMotion ? false : { duration: 300, easingFunction: "easeInOutQuad" }
                    });
                    // Wait for animation to complete
                    setTimeout(finalizeSetup, prefersReducedMotion ? 50 : 350);
                } else {
                    finalizeSetup(); // No zoom adjustment needed
                }
            }, 500); // 500ms delay after stabilization & physics off
        });

        networkInstance.on("click", handleGraphClick);
        networkInstance.on("release", checkAndCorrectView);
        networkInstance.on("dragEnd", checkAndCorrectView);
        
        // Add more specific handlers for mobile
        if (isMobileDevice) {
            networkInstance.on("afterDrawing", function() {
                // This can be used for mobile-specific rendering optimizations if needed
            });
            
            // Ensure tap events work well
            networkInstance.on("selectNode", function(params) {
                if (params.nodes.length && isMobileDevice) {
                    // Ensure the node is fully visible after selection on mobile
                    networkInstance.focus(params.nodes[0], {
                        scale: 1,
                        animation: { duration: 300, easingFunction: "easeOutQuad" }
                    });
                }
            });
        }
        
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

// Store initial graph state for proper reset functionality
function storeInitialGraphState() {
    if (!networkInstance || !graphDataGlobal.nodes) return;
    
    // Store initial node positions
    initialNodePositions = {};
    const nodeIds = graphDataGlobal.nodes.getIds();
    const positions = networkInstance.getPositions(nodeIds);
    
    nodeIds.forEach(id => {
        initialNodePositions[id] = { 
            x: positions[id].x, 
            y: positions[id].y 
        };
    });
    
    // Store initial scale and view position
    initialViewScale = networkInstance.getScale();
    initialViewPosition = networkInstance.getViewPosition();
    
    console.log("Initial graph state stored for reset functionality");
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
            font: clone(n.originalAppearance.font)
        }));
        graphDataGlobal.edges.forEach(e => edgeRestores.push({
            id: e.id,
            color: clone(e.originalAppearance.color),
            font: clone(e.originalAppearance.font),
            width: e.originalAppearance.width
        }));

        if (nodeRestores.length > 0) {
            graphDataGlobal.nodes.update(nodeRestores);
        }
        if (edgeRestores.length > 0) {
            graphDataGlobal.edges.update(edgeRestores);
        }
    }

    // Check if we have stored initial state
    if (initialViewPosition && initialViewScale && Object.keys(initialNodePositions).length > 0) {
        if (isMobileDevice) {
            console.log("Mobile reset: fitting all nodes and enforcing minimum zoom");
            const allNodeIds = Object.keys(initialNodePositions);
            networkInstance.fit({
                nodes: allNodeIds,
                animation: prefersReducedMotion ? false : { duration: 300, easingFunction: "easeOutQuad" }
            });
            setTimeout(() => {
                const scale = networkInstance.getScale();
                if (scale < MOBILE_PREFERRED_MIN_ZOOM) {
                    networkInstance.moveTo({
                        scale: MOBILE_PREFERRED_MIN_ZOOM,
                        animation: prefersReducedMotion ? false : { duration: 200, easingFunction: "easeOutQuad" }
                    });
                }
            }, prefersReducedMotion ? 50 : 350);
        } else {
            // Restore initial node positions and view for desktop
            const physics = networkInstance.physics && networkInstance.physics.options ? 
                networkInstance.physics.options.enabled : false;
            
            if (!physics) {
                const nodeUpdates = [];
                Object.keys(initialNodePositions).forEach(id => {
                    nodeUpdates.push({
                        id: id,
                        x: initialNodePositions[id].x,
                        y: initialNodePositions[id].y,
                        fixed: { x: true, y: true }
                    });
                });
                if (nodeUpdates.length > 0) {
                    graphDataGlobal.nodes.update(nodeUpdates);
                }
            }
            
            networkInstance.moveTo({
                position: initialViewPosition,
                scale: initialViewScale,
                animation: { 
                    duration: isMobileDevice ? 300 : 500, 
                    easingFunction: "easeOutQuad" 
                }
            });
            
            if (!physics) {
                setTimeout(() => {
                    const nodeUnfixes = [];
                    Object.keys(initialNodePositions).forEach(id => {
                        nodeUnfixes.push({
                            id: id,
                            fixed: { x: false, y: false }
                        });
                    });
                    if (nodeUnfixes.length > 0) {
                        graphDataGlobal.nodes.update(nodeUnfixes);
                    }
                }, isMobileDevice ? 350 : 550);
            }
        }
    } else {
        // Fallback if no initial state
        if (isMobileDevice) {
            console.log("Mobile fallback reset: fitting all nodes and enforcing minimum zoom");
            networkInstance.fit({
                animation: prefersReducedMotion ? false : { duration: 300, easingFunction: "easeOutQuad" }
            });
            setTimeout(() => {
                const scale2 = networkInstance.getScale();
                if (scale2 < MOBILE_PREFERRED_MIN_ZOOM) {
                    networkInstance.moveTo({
                        scale: MOBILE_PREFERRED_MIN_ZOOM,
                        animation: prefersReducedMotion ? false : { duration: 200, easingFunction: "easeOutQuad" }
                    });
                }
            }, prefersReducedMotion ? 50 : 350);
        } else {
            console.log("No initial state available, using fallback reset");
            networkInstance.fit({
                animation: { 
                    duration: isMobileDevice ? 300 : 500, 
                    easingFunction: "easeOutQuad" 
                }
            });
            const preferredMinZoom = isMobileDevice ? MOBILE_PREFERRED_MIN_ZOOM : PREFERRED_MIN_ZOOM;
            if (networkInstance.getScale() < preferredMinZoom) {
                networkInstance.moveTo({ 
                    scale: preferredMinZoom, 
                    animation: { 
                        duration: isMobileDevice ? 200 : 300, 
                        easingFunction: "easeOutQuad" 
                    } 
                });
            }
        }
    }
    console.log("Graph view reset.");
}

// Update the handleDocumentClick function to handle both mouse clicks and touch events
function handleDocumentClick(event) {
    // Only process if we have a valid network instance and container
    if (!networkInstance || !container) return;        
    // Ignore events that originated from drag operations
    if (event.type === 'touchend' && event._dragDistance > 10) {
        return;
    }
    
    // Check if the click/touch was outside the graph container and not on the reset button
    const clickedOnGraph = event.target.closest('#knowledge-graph-enhanced-container');
    const clickedOnResetButton = event.target.closest('.vis-reset-button, #reset-graph-view-button');
    
    if (!clickedOnGraph && !clickedOnResetButton) {
        console.log("Click outside graph - resetting to default view");
        
        // Use the reset function to restore the graph to its original state
        resetGraphFocus();
    }
}

// Handle touch start for stopping page scroll while interacting with graph
function handleTouchStart(event) {
    if (event.target.closest('#knowledge-graph-enhanced-container')) {
        // Add class to prevent body scroll during touch interaction
        document.body.classList.add('graph-interaction');
        
        // Handle pinch zoom better on mobile
        if (event.touches && event.touches.length === 2) {
            event.preventDefault(); // Prevent default browser pinch
            
            // Get the initial distance between two fingers
            const initialDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );
            
            // Store it for use in touch move
            container._initialPinchDistance = initialDistance;
            container._initialScale = networkInstance.getScale();
            
            console.log("Pinch zoom detected");
        }
    }
}

// Handle touch move for better pinch-zoom experience
function handleTouchMove(event) {
    if (event.target.closest('#knowledge-graph-enhanced-container')) {
        if (event.touches && event.touches.length === 2 && container._initialPinchDistance) {
            event.preventDefault();
            
            // Calculate new distance
            const currentDistance = Math.hypot(
                event.touches[0].clientX - event.touches[1].clientX,
                event.touches[0].clientY - event.touches[1].clientY
            );
            
            // Calculate zoom factor based on finger distance change
            const scaleFactor = currentDistance / container._initialPinchDistance;
            
            // Apply zoom around the center of the pinch
            const centerX = (event.touches[0].clientX + event.touches[1].clientX) / 2;
            const centerY = (event.touches[0].clientY + event.touches[1].clientY) / 2;
            
            // Calculate new scale (with constraints)
            const newScale = Math.min(
                Math.max(container._initialScale * scaleFactor, MOBILE_MIN_ZOOM_LEVEL),
                MOBILE_MAX_ZOOM_LEVEL
            );
            
            // Get container rect to map screen coordinates to canvas
            const rect = container.getBoundingClientRect();
            
            // Apply the new scale
            networkInstance.moveTo({
                position: {
                    x: centerX - rect.left,
                    y: centerY - rect.top
                },
                scale: newScale,
                animation: false // Disable animation for smoother pinch
            });
        }
    }
}

// Handle touch end for cleanup
function handleTouchEnd(event) {
    // Reset pinch zoom tracking
    if (container) {
        container._initialPinchDistance = null;
        container._initialScale = null;
    }
    
    // Remove body class to allow scrolling again
    document.body.classList.remove('graph-interaction');
    
    // Original click/tap handling
    if (!event.target.closest('#knowledge-graph-enhanced-container') || 
        event._dragDistance > 10) {
        return;
    }
    
    // If the touch didn't move much, treat it as a tap
    if (networkInstance && !networkInstance.interactionHandler.dragStart) {
        console.log("Touch registered as tap");
    }
}

// --- Keep graph visible & zoom sane ----------------------------------------
function checkAndCorrectView() {
    if (!networkInstance || isFocused) return;

    const zoom = networkInstance.getScale();
    const minZoom = isMobileDevice ? MOBILE_MIN_ZOOM_LEVEL : MIN_ZOOM_LEVEL;
    const preferredMinZoom = isMobileDevice ? MOBILE_PREFERRED_MIN_ZOOM : PREFERRED_MIN_ZOOM;
    const maxZoom = isMobileDevice ? MOBILE_MAX_ZOOM_LEVEL : MAX_ZOOM_LEVEL;
    
    if (zoom < minZoom) {
        networkInstance.moveTo({ 
            scale: preferredMinZoom, 
            animation: { 
                duration: 300, 
                easingFunction: "easeOutQuad" 
            } 
        });
    } else if (zoom > maxZoom) {
        networkInstance.moveTo({ 
            scale: maxZoom, 
            animation: { 
                duration: 300, 
                easingFunction: "easeOutQuad" 
            } 
        });
    }

    // Check if graph is centered properly
    const ids = graphDataGlobal.nodes.getIds();
    if (!ids.length) return;

    const pos = networkInstance.getPositions(ids);
    let cx = 0, cy = 0;
    ids.forEach(id => {
        cx += pos[id].x;
        cy += pos[id].y;
    });
    cx /= ids.length;
    cy /= ids.length;

    const view = networkInstance.getViewPosition();
    
    // Use a larger threshold on mobile to prevent too many recentering operations
    const thresholdMultiplier = isMobileDevice ? 2.5 : 2.0;
    const threshold = thresholdMultiplier * (1 / zoom) * Math.max(container.clientWidth, container.clientHeight);
    
    // If the center of the graph is too far from the center of the view, reset
    const dist = Math.hypot(view.x - cx, view.y - cy);
    if (dist > threshold) {        
        console.log("Graph went out of view - resetting position");
        
        // Use initial positions if available, otherwise fallback to fit
        if (initialViewPosition && initialViewScale) {
            networkInstance.moveTo({
                position: initialViewPosition,
                scale: initialViewScale,
                animation: { 
                    duration: 400, 
                    easingFunction: "easeOutQuad" 
                }
            });
        } else {
            networkInstance.fit({ 
                animation: { 
                    duration: 400, 
                    easingFunction: "easeOutQuad" 
                } 
            });
            
            // Apply preferred min zoom after fitting
            if (networkInstance.getScale() < preferredMinZoom) {
                networkInstance.moveTo({ 
                    scale: preferredMinZoom, 
                    animation: { 
                        duration: 300, 
                        easingFunction: "easeOutQuad" 
                    } 
                });
            }
        }
    }
}

// --- Public API -------------------------------------------------------------
export function fetchGraphDataAndRender() {
    // Check if we're on a mobile device - do this check here so it's available immediately
    isMobileDevice = window.matchMedia('(max-width: 768px)').matches || 
                   /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
    
    if (graphRendered && networkInstance) {
        try {
            if (isFocused) resetGraphFocus();
            
            // Use different animation durations for mobile vs desktop
            networkInstance.fit({ 
                animation: { 
                    duration: isMobileDevice ? 300 : 500, 
                    easingFunction: "easeOutQuad" 
                } 
            });
            
            // Apply device-specific preferred zoom
            const preferredMinZoom = isMobileDevice ? MOBILE_PREFERRED_MIN_ZOOM : PREFERRED_MIN_ZOOM;
            if (networkInstance.getScale() < preferredMinZoom) {
                networkInstance.moveTo({ 
                    scale: preferredMinZoom, 
                    animation: { 
                        duration: isMobileDevice ? 200 : 300, 
                        easingFunction: "easeOutQuad" 
                    } 
                });
            }
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

export function destroyGraph() {
    if (networkInstance) {
        networkInstance.destroy();
        networkInstance = null;
    }
    // Clear the view check interval
    if (viewCheckInterval) {
        clearInterval(viewCheckInterval);
        viewCheckInterval = null;
    }
    container && (container.innerHTML = "");
    resetButton && (resetButton.style.display = "none");
    graphRendered = false;
    isFocused = false;
    graphDataGlobal = { nodes: null, edges: null };    

    // Reset stored initial state variables
    initialNodePositions = {};
    initialViewScale = null;
    initialViewPosition = null;
    
    console.log("Knowledge graph destroyed.");
}