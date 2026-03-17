import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { Maximize, ZoomIn, ZoomOut, RefreshCw, Layers, ShieldAlert, User, Network } from 'lucide-react';

const SVG_ICONS = {
    shield: 'data:image/svg+xml;utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>'),
    hub: 'data:image/svg+xml;utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"/></svg>'),
    user: 'data:image/svg+xml;utf-8,' + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>')
};

function truncate(str, n = 10) {
    return str && str.length > n ? str.slice(0, n) + '…' : str;
}

/** Node colour driven by Neo4j analytics */
function getNodeColor(node, accountMap) {
    if (!node) return '#6B7280';
    // Hub node: bright cyan
    if (node.isHub) return '#06B6D4';
    // Suspicious overlap
    const acc = accountMap?.[node.id];
    if (acc) {
        if (acc.suspicion_score >= 75) return '#EF4444';
        if (acc.suspicion_score >= 50) return '#F97316';
        if (acc.suspicion_score >= 25) return '#EAB308';
    }
    // Size by centrality
    if (node.centralityScore >= 70) return '#8B5CF6';
    if (node.centralityScore >= 40) return '#3B82F6';
    return '#475569';
}

/** Node radius: base 18, scaled by degree centrality (18–52px) */
function getNodeRadius(node) {
    if (!node) return 18;
    const base = 18;
    const max = 52;
    const ratio = Math.min(1, (node.centralityScore || 0) / 100);
    return Math.round(base + (max - base) * ratio);
}

/** Edge width scaled by transaction amount (1–6px) */
function getEdgeWidth(amount, maxAmount) {
    if (!amount || !maxAmount) return 1;
    return Math.max(1, Math.min(6, (amount / maxAmount) * 6));
}

export default function GraphVisualization({
    graphData,           // { nodes, edges, hubs, analytics } from Neo4j
    suspiciousAccounts,
    fraudRings,
    onSelectAccount,
    flaggedAccounts = new Set(), // Added support for flagged accounts
    isolatedNodeId = null,       // Added support for node isolation
    onResetIsolation = () => {}, // Callback to reset isolation
    showHeader = true,           // Toggle internal Neo4j header
}) {
    const containerRef = useRef(null);
    const cyRef = useRef(null);
    const rafRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);
    const [isFocusMode, setIsFocusMode] = useState(!!isolatedNodeId);
    const [selectedRingId, setSelectedRingId] = useState('all');

    const buildAndMount = useCallback(() => {
        const accountMap = {};
        for (const acc of suspiciousAccounts || []) accountMap[acc.account_id] = acc;

        if (!containerRef.current || !graphData?.nodes?.length) return;

        // Filter nodes/edges based on selected ring
        let activeNodes = graphData.nodes;
        let activeEdges = graphData.edges || [];

        if (selectedRingId !== 'all') {
            const ring = (fraudRings || []).find(r => r.ring_id === selectedRingId);
            if (ring) {
                const ringMembers = new Set(ring.member_accounts);
                activeNodes = graphData.nodes.filter(n => ringMembers.has(n.id));
                activeEdges = (graphData.edges || []).filter(e => 
                    ringMembers.has(e.source) && ringMembers.has(e.target)
                );
            }
        }

        // Cancel any running animation
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

        const { nodes, edges } = graphData;
        const maxAmount = Math.max(...activeEdges.map((e) => e.amount || 0), 1);

        const nodeMap = {};
        for (const n of activeNodes) nodeMap[n.id] = n;

        const suspiciousIds = new Set((suspiciousAccounts || []).map((a) => a.account_id));

        // ─── Build Cytoscape elements ─────────────────────────────────
        const cyNodes = activeNodes.map((n) => {
            const isFlagged = flaggedAccounts.has(n.id);
            const isSuspicious = suspiciousIds.has(n.id);
            
            // Determine shape and icon based on role
            let shape = 'rhombus';
            let icon = SVG_ICONS.user;
            
            if (isFlagged || isSuspicious) {
                shape = 'diamond';
                icon = SVG_ICONS.shield;
            } else if (n.isHub) {
                shape = 'rhombus';
                icon = SVG_ICONS.hub;
            }

            return {
                data: {
                    id: n.id,
                    label: truncate(n.id),
                    color: getNodeColor(n, accountMap),
                    size: getNodeRadius(n),
                    shape: shape,
                    backgroundImage: icon,
                    borderWidth: isFlagged ? 5 : (isSuspicious ? 3 : (n.isHub ? 4 : 2)),
                    borderColor: isFlagged ? '#EF4444' : '#FFFFFF',
                    // Analytics payload for tooltip
                    degree: n.degree,
                    inDegree: n.inDegree,
                    outDegree: n.outDegree,
                    centralityScore: n.centralityScore,
                    totalSent: n.totalSent,
                    totalReceived: n.totalReceived,
                    isHub: n.isHub,
                    suspicionScore: accountMap[n.id]?.suspicion_score ?? 0,
                    patterns: (accountMap[n.id]?.detected_patterns || []).join(', '),
                    isFlagged,
                },
                classes: [
                    isSuspicious ? 'suspicious' : 'normal',
                    n.isHub ? 'hub' : '',
                    isFlagged ? 'flagged' : '',
                ].filter(Boolean).join(' '),
            };
        });

        const cyEdges = activeEdges.map((e, i) => ({
            data: {
                id: `e_${i}_${e.txId || i}`,
                source: e.source,
                target: e.target,
                amount: e.amount,
                edgeWidth: getEdgeWidth(e.amount, maxAmount),
                edgeColor: suspiciousIds.has(e.source) || suspiciousIds.has(e.target)
                    ? '#EF444466'
                    : '#47556966',
            },
            classes: suspiciousIds.has(e.source) || suspiciousIds.has(e.target)
                ? 'suspicious-edge'
                : '',
        }));

        // ─── Cytoscape instance ───────────────────────────────────────
        const cy = cytoscape({
            container: containerRef.current,
            elements: { nodes: cyNodes, edges: cyEdges },
            style: [
                {
                    selector: 'node',
                    style: {
                        'shape': 'data(shape)',
                        'background-color': 'data(color)',
                        'background-image': 'data(backgroundImage)',
                        'background-fit': 'contain',
                        'background-width': '60%',
                        'background-height': '60%',
                        'background-opacity': 1,
                        'width': 'data(size)',
                        'height': 'data(size)',
                        'label': 'data(label)',
                        'color': '#F8FAFC',
                        'font-size': '10px',
                        'font-weight': '700',
                        'font-family': 'JetBrains Mono, monospace',
                        'text-valign': 'top',
                        'text-halign': 'center',
                        'text-margin-y': -8,
                        'text-outline-width': 2,
                        'text-outline-color': '#020617',
                        'border-width': 'data(borderWidth)',
                        'border-color': 'data(borderColor)',
                        'border-opacity': (ele) => ele.data('isFlagged') ? 1 : 0.4,
                        'background-opacity': 0.9,
                        'shadow-blur': 25,
                        'shadow-color': 'data(color)',
                        'shadow-opacity': 0.6,
                        'transition-property': 'background-color, width, height, border-color, shadow-blur, underlay-opacity',
                        'transition-duration': 300,
                    },
                },
                {
                    selector: 'node.suspicious',
                    style: {
                        'shadow-color': '#EF4444',
                        'shadow-blur': 40,
                    },
                },
                {
                    selector: 'node.flagged',
                    style: {
                        'shadow-color': '#EF4444',
                        'shadow-blur': 60,
                        'underlay-color': '#EF4444',
                        'underlay-padding': 6,
                        'underlay-opacity': 0.4,
                        'underlay-shape': 'diamond',
                    },
                },
                {
                    selector: 'node.hub',
                    style: {
                        'border-width': 4,
                        'border-opacity': 0.9,
                        'underlay-color': '#06B6D4',
                        'underlay-padding': 10,
                        'underlay-opacity': 0.5,
                        'underlay-shape': 'rhombus',
                        'shadow-color': '#22D3EE',
                        'shadow-blur': 50,
                    },
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'opacity': 1,
                        'underlay-color': '#F8FAFC',
                        'underlay-padding': 12,
                        'underlay-opacity': 0.7,
                        'border-color': '#FFFFFF',
                    },
                },
                {
                    selector: 'node.faded',
                    style: { 'opacity': 0.1 },
                },
                {
                    selector: 'node.hidden',
                    style: { 'display': 'none' },
                },
                {
                    selector: 'edge',
                    style: {
                        'line-color': 'data(edgeColor)',
                        'width': 'data(edgeWidth)',
                        'target-arrow-color': 'data(edgeColor)',
                        'target-arrow-shape': 'chevron',
                        'curve-style': 'taxi',
                        'taxi-direction': 'auto',
                        'taxi-turn': 20,
                        'arrow-scale': 1.2,
                        'opacity': 0.5,
                        'transition-property': 'opacity, line-color',
                        'transition-duration': 300,
                    },
                },
                {
                    selector: 'edge.suspicious-edge',
                    style: {
                        'line-style': 'solid',
                        'line-color': '#EF4444',
                        'width': (ele) => Math.max(ele.data('edgeWidth'), 2),
                        'opacity': 1,
                        'line-dash-pattern': [10, 5],
                        'line-dash-offset': 0,
                    },
                },
                {
                    selector: 'edge.faded',
                    style: { 'opacity': 0.05 },
                },
                {
                    selector: 'edge.hidden',
                    style: { 'display': 'none' },
                },
            ],
            layout: {
                name: 'cose',               // Force-directed physics layout
                animate: true,
                animationDuration: 800,
                randomize: true,
                idealEdgeLength: 120,
                edgeElasticity: 0.45,
                nodeRepulsion: 8000,
                gravity: 0.25,
                numIter: 1000,
                padding: 60,
                nodeDimensionsIncludeLabels: true,
            },
            minZoom: 0.05,
            maxZoom: 4,
            wheelSensitivity: 0.3,
        });

        cyRef.current = cy;

        // Marching ants on suspicious edges
        let offset = 0;
        function animateEdges() {
            offset -= 1;
            cy.edges('.suspicious-edge').style('line-dash-offset', offset);
            rafRef.current = requestAnimationFrame(animateEdges);
        }
        rafRef.current = requestAnimationFrame(animateEdges);

        // Ring member index
        const ringMemberIndex = {};
        for (const ring of fraudRings || []) {
            for (const member of ring.member_accounts || []) {
                if (!ringMemberIndex[member]) ringMemberIndex[member] = [];
                ringMemberIndex[member].push(ring.ring_id);
            }
        }

        // Hover tooltip
        cy.on('mouseover', 'node', (e) => {
            containerRef.current.style.cursor = 'pointer';
            const d = e.target.data();
            const pos = e.target.renderedPosition();
            setTooltip({ x: pos.x, y: pos.y, ...d });
        });
        cy.on('mouseout', 'node', () => {
            containerRef.current.style.cursor = 'default';
            setTooltip(null);
        });

        // Click node
        cy.on('tap', 'node', (e) => {
            const nodeId = e.target.data('id');
            const acc = accountMap[nodeId];
            cy.elements().removeClass('faded highlighted');

            const memberRings = ringMemberIndex[nodeId] || [];
            if (memberRings.length > 0) {
                const ringMembers = new Set();
                for (const ring of fraudRings || []) {
                    if (memberRings.includes(ring.ring_id)) {
                        for (const m of ring.member_accounts || []) ringMembers.add(m);
                    }
                }
                cy.nodes().each((n) => {
                    if (ringMembers.has(n.data('id'))) n.addClass('highlighted');
                    else n.addClass('faded');
                });
                cy.edges().each((edge) => {
                    const src = edge.data('source');
                    const tgt = edge.data('target');
                    if (ringMembers.has(src) && ringMembers.has(tgt)) edge.removeClass('faded');
                    else edge.addClass('faded');
                });
            } else {
                const neighborhood = e.target.neighborhood().add(e.target);
                cy.elements().addClass('faded');
                neighborhood.removeClass('faded').addClass('highlighted');
            }

            if (acc) onSelectAccount(acc);
        });

        // Double-click: focus mode
        cy.on('dblclick', 'node', (e) => {
            const neighborhood = e.target.neighborhood().add(e.target);
            cy.elements().addClass('hidden');
            neighborhood.removeClass('hidden').addClass('highlighted');
            cy.fit(neighborhood, 60);
            setIsFocusMode(true);
        });

        // Background click → reset
        cy.on('tap', (e) => {
            if (e.target === cy) {
                cy.elements().removeClass('faded highlighted');
                setTooltip(null);
            }
        });

        // Handle isolation if provided
        if (isolatedNodeId) {
            const node = cy.getElementById(isolatedNodeId);
            if (node.length > 0) {
                cy.animate({
                    center: { eles: node },
                    zoom: 2,
                    duration: 1000,
                    easing: 'ease-in-out-cubic'
                });
                node.select();
                setIsFocusMode(true);
            }
        }

        // Fit if filtering by ring
        if (selectedRingId !== 'all') {
            cy.fit(undefined, 80);
        }

    }, [graphData, suspiciousAccounts, fraudRings, onSelectAccount, flaggedAccounts, isolatedNodeId, selectedRingId]);

    useEffect(() => {
        buildAndMount();
        return () => {
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }
        };
    }, [buildAndMount]);

    const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() * 1.25);
    const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() * 0.8);
    const handleFit = () => cyRef.current?.fit(undefined, 50);
    const handleReset = () => {
        if (cyRef.current) {
            cyRef.current.elements().removeClass('faded highlighted hidden');
            cyRef.current.animate({
                fit: { padding: 50 },
                duration: 500
            });
            setIsFocusMode(false);
            setSelectedRingId('all');
            onResetIsolation();
        }
    };

    const noData = !graphData?.nodes?.length;

    return (
        <div className="relative bg-slate-950/50 rounded-none border-2 border-slate-800 brutal-shadow overflow-hidden" style={{ height: 750 }}>
            {/* Loading / empty state */}
            {noData && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 text-slate-500 font-mono z-20">
                    <span className="text-4xl">🕸</span>
                    <span className="text-sm uppercase tracking-widest">Awaiting graph data from Neo4j…</span>
                </div>
            )}

            {/* Cytoscape canvas */}
            <div
                ref={containerRef}
                style={{ width: '100%', height: '100%' }}
                className="bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]"
            />

            {/* Top banner: Neo4j powered */}
            {showHeader && !noData && (
                <div className="absolute top-4 left-4 flex items-center gap-3 backdrop-blur-md bg-cyan-950/20 border border-cyan-800/50 px-4 py-2.5 rounded-full shadow-[0_0_20px_rgba(6,182,212,0.15)] z-10">
                    <span className="w-2 h-2 rounded-full bg-cyan-400 shadow-[0_0_8px_rgba(34,211,238,0.8)] animate-pulse inline-block" />
                    <span className="text-[11px] font-bold font-mono text-cyan-300 uppercase tracking-[0.2em]">Neo4j Analytics</span>
                    {graphData?.analytics && (
                        <>
                            <div className="w-px h-3 bg-cyan-800/50 mx-1"></div>
                            <span className="text-cyan-100 text-[10px] uppercase font-bold tracking-wider opacity-80">
                                {graphData.analytics.totalNodes} Nodes <span className="text-cyan-800 mx-1">•</span> {graphData.analytics.totalEdges} Edges <span className="text-cyan-800 mx-1">•</span> {graphData.analytics.hubCount} Hubs
                            </span>
                        </>
                    )}
                </div>
            )}

            {/* Sub-selection / Focus Menu */}
            {!noData && (
                <div className="absolute top-16 left-4 z-10 flex flex-col gap-2">
                    <div className="backdrop-blur-md bg-slate-900/60 border border-slate-700/50 rounded-lg p-1 shadow-xl flex items-center gap-2 pr-3">
                         <div className="bg-brand-orange/20 p-2 rounded-md">
                            <Layers className="w-3.5 h-3.5 text-brand-orange" />
                         </div>
                         <div className="flex flex-col">
                            <span className="text-[9px] text-slate-500 uppercase font-black tracking-widest">Subgraph Scope</span>
                            <select 
                                value={selectedRingId}
                                onChange={(e) => setSelectedRingId(e.target.value)}
                                className="bg-transparent text-white text-[11px] font-bold outline-none cursor-pointer hover:text-cyan-400 transition-colors"
                            >
                                <option value="all">Full Network View</option>
                                {fraudRings?.map(ring => (
                                    <option key={ring.ring_id} value={ring.ring_id}>
                                        Focus: {ring.ring_id} ({ring.member_accounts?.length || 0} nodes)
                                    </option>
                                ))}
                            </select>
                         </div>
                    </div>
                </div>
            )}

            {/* Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <button
                    onClick={handleFit}
                    title="Fit Graph"
                    className="p-2 bg-[#1e2435] text-white hover:bg-brand-accent/20 border border-brand-border rounded-full shadow-lg transition-colors flex items-center justify-center cursor-pointer"
                >
                    <Maximize className="w-4 h-4" />
                </button>
                <button
                    onClick={handleZoomIn}
                    title="Zoom In"
                    className="p-2 bg-[#1e2435] text-white hover:bg-brand-accent/20 border border-brand-border rounded-full shadow-lg transition-colors flex items-center justify-center cursor-pointer"
                >
                    <ZoomIn className="w-4 h-4" />
                </button>
                <button
                    onClick={handleZoomOut}
                    title="Zoom Out"
                    className="p-2 bg-[#1e2435] text-white hover:bg-brand-accent/20 border border-brand-border rounded-full shadow-lg transition-colors flex items-center justify-center cursor-pointer"
                >
                    <ZoomOut className="w-4 h-4" />
                </button>
                <button
                    onClick={handleReset}
                    title="Reset Layout"
                    className="p-2 bg-[#1e2435] text-brand-orange hover:bg-brand-orange/20 border border-brand-border rounded-full shadow-lg transition-colors flex items-center justify-center mt-2 cursor-pointer"
                >
                    <RefreshCw className="w-4 h-4 text-[#f97316]" />
                </button>
                {(isFocusMode || selectedRingId !== 'all') && (
                    <div className="bg-red-900/80 text-red-100 text-[10px] px-2 py-1 border border-red-600 font-bold uppercase tracking-widest text-center animate-pulse rounded-full mt-2">
                        Focus Mode
                    </div>
                )}
            </div>

            {/* Network Legend */}
            <div className="absolute bottom-6 left-6 z-10 pointer-events-none">
                <div className="bg-slate-900/60 backdrop-blur-xl border border-white/10 rounded-2xl p-4 shadow-2xl flex flex-col gap-4">
                    <div className="flex items-center justify-between gap-8 pb-3 border-b border-white/5">
                        <div className="flex flex-col">
                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Network Status</span>
                            <span className="text-xl font-black text-white font-mono tracking-tighter tabular-nums text-cyan-400">SOC MONITOR</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="flex flex-col gap-1.5">
                            <div className="flex items-center gap-2 group">
                                <div className="w-4 h-4 rounded-sm rotate-45 bg-[#06B6D4] shadow-[0_0_12px_rgba(6,182,212,0.3)] border border-cyan-400/50 flex items-center justify-center">
                                    <Network className="-rotate-45 w-2 h-2 text-white opacity-80" />
                                </div>
                                <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors">CENTRAL HUB</span>
                            </div>
                            <div className="flex items-center gap-2 group">
                                <div className="w-4 h-4 rounded-sm rotate-45 bg-[#EF4444] shadow-[0_0_12px_rgba(239,68,68,0.3)] border border-red-400/50 flex items-center justify-center">
                                    <ShieldAlert className="-rotate-45 w-2 h-2 text-white opacity-80" />
                                </div>
                                <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors">FLAGGED ENTITY</span>
                            </div>
                            <div className="flex items-center gap-2 group">
                                <div className="w-4 h-4 rounded-sm rotate-45 bg-[#64748B] border border-white/10 flex items-center justify-center">
                                    <User className="-rotate-45 w-2 h-2 text-white opacity-60" />
                                </div>
                                <span className="text-[10px] font-bold text-slate-300 group-hover:text-white transition-colors">STANDARD NODE</span>
                            </div>
                        </div>

                        <div className="flex flex-col gap-2 pl-4 border-l border-white/5">
                            <div className="flex items-center justify-between group">
                                <span className="text-[9px] text-slate-500 font-mono">ENTITIES</span>
                                <span className="text-xs font-bold text-cyan-400 font-mono">{graphData?.analytics?.totalNodes || activeNodes.length}</span>
                            </div>
                            <div className="flex items-center justify-between group">
                                <span className="text-[9px] text-slate-500 font-mono">PATHS</span>
                                <span className="text-xs font-bold text-cyan-400 font-mono">{graphData?.analytics?.totalEdges || activeEdges.length}</span>
                            </div>
                            <div className="flex items-center justify-between group">
                                <span className="text-[9px] text-slate-500 font-mono">THREATS</span>
                                <span className="text-xs font-bold text-red-500 font-mono">{fraudRings?.length || 0}</span>
                            </div>
                        </div>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                        <div className="flex items-center gap-2">
                            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
                                <div className="h-full bg-cyan-500 w-[65%] animate-pulse" />
                            </div>
                            <span className="text-[8px] font-mono text-cyan-500/80 animate-pulse">SOC SYNC ACTIVE</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* Hover Tooltip */}
            {tooltip && (
                <div
                    className="absolute z-50 pointer-events-none backdrop-blur-2xl bg-slate-900/90 border border-white/10 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.8)] overflow-hidden transition-all duration-200 ease-out"
                    style={{
                        left: tooltip.x + 20,
                        top: tooltip.y - 20,
                        width: 260,
                    }}
                >
                    <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-4 py-3 border-b border-white/5 flex justify-between items-center relative overflow-hidden font-mono">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent opacity-60"></div>
                        <span className="font-black text-white text-[12px] tracking-tight truncate">{truncate(tooltip.id, 16)}</span>
                        <div className="flex gap-1.5">
                            {tooltip.isFlagged && <span className="px-1.5 py-0.5 rounded-[4px] text-[8px] font-black tracking-widest bg-red-500 text-white">FLAGGED</span>}
                            {tooltip.isHub && <span className="px-1.5 py-0.5 rounded-[4px] text-[8px] font-black tracking-widest bg-cyan-500 text-white">HUB</span>}
                        </div>
                    </div>
                    <div className="p-3 space-y-1.5 text-xs text-slate-300 font-mono">
                        {[
                            { label: 'Centrality Score', value: `${tooltip.centralityScore}/100`, color: tooltip.centralityScore >= 70 ? 'text-cyan-400' : 'text-slate-200' },
                            { label: 'Degree (in/out)',  value: `${tooltip.degree} (${tooltip.inDegree}↓ ${tooltip.outDegree}↑)` },
                            { label: 'Total Sent',      value: `$${(tooltip.totalSent || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                            { label: 'Total Received',  value: `$${(tooltip.totalReceived || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                            ...(tooltip.suspicionScore > 0 ? [{ label: 'Suspicion Score', value: `${tooltip.suspicionScore}/100`, color: 'text-red-400' }] : []),
                            ...(tooltip.patterns ? [{ label: 'Patterns', value: tooltip.patterns, color: 'text-brand-orange' }] : []),
                        ].map(({ label, value, color }) => (
                            <div key={label} className="flex justify-between border-b border-slate-800 pb-1">
                                <span className="text-slate-500 uppercase text-[9px] tracking-wider">{label}</span>
                                <span className={`font-bold ${color || 'text-slate-200'} text-right max-w-[140px] truncate`}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
