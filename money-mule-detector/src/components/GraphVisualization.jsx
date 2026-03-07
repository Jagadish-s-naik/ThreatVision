import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import { Maximize, ZoomIn, ZoomOut, RefreshCw, Layers } from 'lucide-react';

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
}) {
    const containerRef = useRef(null);
    const cyRef = useRef(null);
    const rafRef = useRef(null);
    const [tooltip, setTooltip] = useState(null);
    const [isFocusMode, setIsFocusMode] = useState(false);
    const [viewMode, setViewMode] = useState('network'); // 'network' | 'tree'

    const accountMap = {};
    for (const acc of suspiciousAccounts || []) accountMap[acc.account_id] = acc;

    const buildAndMount = useCallback(() => {
        if (!containerRef.current || !graphData?.nodes?.length) return;

        // Cancel any running animation
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

        const { nodes, edges, analytics } = graphData;
        const maxAmount = Math.max(...(edges || []).map((e) => e.amount || 0), 1);

        const nodeMap = {};
        for (const n of nodes) nodeMap[n.id] = n;

        const suspiciousIds = new Set((suspiciousAccounts || []).map((a) => a.account_id));

        // ─── Build Cytoscape elements ─────────────────────────────────
        const cyNodes = nodes.map((n) => ({
            data: {
                id: n.id,
                label: truncate(n.id),
                color: getNodeColor(n, accountMap),
                size: getNodeRadius(n),
                borderWidth: suspiciousIds.has(n.id) ? 3 : (n.isHub ? 4 : 2),
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
            },
            classes: [
                suspiciousIds.has(n.id) ? 'suspicious' : 'normal',
                n.isHub ? 'hub' : '',
            ].filter(Boolean).join(' '),
        }));

        const cyEdges = (edges || []).map((e, i) => ({
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
                        'background-color': 'data(color)',
                        'width': 'data(size)',
                        'height': 'data(size)',
                        'label': 'data(label)',
                        'color': '#F8FAFC',
                        'font-size': '10px',
                        'font-weight': '700',
                        'font-family': 'Syne, sans-serif',
                        'text-valign': 'top',
                        'text-halign': 'center',
                        'text-margin-y': -6,
                        'text-outline-width': 2,
                        'text-outline-color': '#020617',
                        'border-width': 2,
                        'border-color': '#FFFFFF',
                        'border-opacity': 0.2, // Acts like an inner glow/highlight
                        'shadow-blur': 15,
                        'shadow-color': 'data(color)',
                        'shadow-opacity': 0.8,
                        'transition-property': 'background-color, width, height, border-color, shadow-blur, underlay-opacity',
                        'transition-duration': 300,
                    },
                },
                {
                    selector: 'node.suspicious',
                    style: {
                        'border-color': '#FFFFFF', // keep highlight ring
                        'border-opacity': 0.5,
                        'shadow-color': '#EF4444',
                        'shadow-blur': 30,
                    },
                },
                {
                    selector: 'node.hub',
                    style: {
                        'border-color': '#FFFFFF', // keep highlight ring
                        'border-width': 3,
                        'border-opacity': 0.8,
                        // Use a solid underlay for hubs to create a rich halo effect
                        'underlay-color': '#06B6D4',
                        'underlay-padding': 6,
                        'underlay-opacity': 0.6,
                        'underlay-shape': 'ellipse', // ensures the halo is circular
                        'shadow-color': '#22D3EE',
                        'shadow-blur': 40,
                    },
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'opacity': 1,
                        'underlay-color': '#F8FAFC',
                        'underlay-padding': 8,
                        'underlay-opacity': 0.8,
                        'border-color': '#FFFFFF',
                    },
                },
                {
                    selector: 'node.faded',
                    style: { 'opacity': 0.08 },
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
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'unbundled-bezier',
                        'control-point-distances': 30,
                        'control-point-weights': 0.5,
                        'arrow-scale': 0.9,
                        'opacity': 0.6,
                        'transition-property': 'opacity, line-color',
                        'transition-duration': 300,
                    },
                },
                {
                    selector: 'edge.suspicious-edge',
                    style: {
                        'line-style': 'dashed',
                        'line-dash-pattern': [6, 3],
                        'line-dash-offset': 0,
                        'opacity': 1,
                    },
                },
                {
                    selector: 'edge.faded',
                    style: { 'opacity': 0.03 },
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

    }, [graphData, suspiciousAccounts, fraudRings, onSelectAccount]);

    useEffect(() => {
        buildAndMount();
        return () => {
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }
        };
    }, [buildAndMount]);

    const handleZoomIn = () => cyRef.current?.zoom(cyRef.current.zoom() + 0.25);
    const handleZoomOut = () => cyRef.current?.zoom(cyRef.current.zoom() - 0.25);
    const handleFit = () => cyRef.current?.fit(undefined, 50);
    const handleReset = () => {
        if (cyRef.current) {
            cyRef.current.elements().removeClass('faded highlighted hidden');
            cyRef.current.fit(undefined, 50);
            setIsFocusMode(false);
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
            {!noData && (
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
                {isFocusMode && (
                    <div className="bg-red-900/80 text-red-100 text-[10px] px-2 py-1 border border-red-600 font-bold uppercase tracking-widest text-center animate-pulse rounded-full mt-2">
                        Focus Mode
                    </div>
                )}
            </div>

            {/* Neo4j Style Legend */}
            <div className="absolute bottom-4 left-4 z-10 bg-[#1a2035] border border-brand-border rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] backdrop-blur-md pointer-events-none min-w-[160px]">
                <div className="text-xs font-bold text-white mb-3 tracking-wider flex items-center gap-2 border-b border-brand-border/50 pb-2">
                   <Layers className="w-3 h-3 text-brand-muted" />
                   NETWORK LEGEND
                </div>
                <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border-2 border-white bg-[#06B6D4] shadow-[0_0_8px_#22D3EE]" />
                        <span className="text-[10px] text-white font-medium uppercase">Hub Node</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-white/50 bg-[#EF4444] shadow-[0_0_8px_#EF4444]" />
                        <span className="text-[10px] text-white font-medium uppercase">Critical Suspect</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-white/50 bg-[#F59E0B]" />
                        <span className="text-[10px] text-slate-300 font-medium uppercase">High Risk</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full border border-white/20 bg-[#64748B]" />
                        <span className="text-[10px] text-slate-400 font-medium uppercase">Normal Node</span>
                    </div>
                </div>
            </div>

            {/* Hover tooltip */}
            {tooltip && (
                <div
                    className="absolute z-20 pointer-events-none backdrop-blur-xl bg-slate-900/80 border border-slate-700/50 rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.5)] overflow-hidden transition-all duration-200 ease-out"
                    style={{
                        left: Math.min(tooltip.x + 20, (containerRef.current?.offsetWidth ?? 0) - 280),
                        top:  Math.min(tooltip.y - 20, (containerRef.current?.offsetHeight ?? 0) - 240),
                        width: 280,
                    }}
                >
                    <div className="bg-gradient-to-r from-slate-800/80 to-slate-900/80 px-4 py-3 border-b border-slate-700/50 flex justify-between items-center relative overflow-hidden">
                        <div className="absolute top-0 left-0 w-full h-0.5 bg-gradient-to-r from-transparent via-cyan-500 to-transparent opacity-50"></div>
                        <span className="font-bold text-slate-100 font-mono text-[13px] tracking-wide truncate">{truncate(tooltip.id, 18)}</span>
                        <div className="flex gap-2">
                            {tooltip.suspicionScore >= 50 && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest bg-red-500/20 text-red-400 border border-red-500/30">RISK</span>}
                            {tooltip.isHub && <span className="px-1.5 py-0.5 rounded text-[9px] font-bold tracking-widest bg-cyan-500/20 text-cyan-400 border border-cyan-500/30">HUB</span>}
                        </div>
                    </div>
                    <div className="p-3 space-y-1.5 text-xs text-slate-300">
                        {[
                            { label: 'Centrality Score', value: `${tooltip.centralityScore}/100`, color: tooltip.centralityScore >= 70 ? 'text-cyan-400' : 'text-slate-200' },
                            { label: 'Degree (in/out)',  value: `${tooltip.degree} (${tooltip.inDegree}↓ ${tooltip.outDegree}↑)` },
                            { label: 'Total Sent',      value: `$${(tooltip.totalSent || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                            { label: 'Total Received',  value: `$${(tooltip.totalReceived || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                            ...(tooltip.suspicionScore > 0 ? [{ label: 'Suspicion Score', value: `${tooltip.suspicionScore}/100`, color: 'text-red-400' }] : []),
                            ...(tooltip.patterns ? [{ label: 'Patterns', value: tooltip.patterns, color: 'text-brand-orange' }] : []),
                        ].map(({ label, value, color }) => (
                            <div key={label} className="flex justify-between border-b border-slate-800 pb-1">
                                <span className="text-slate-500 uppercase text-[10px] tracking-wider">{label}</span>
                                <span className={`font-bold ${color || 'text-slate-200'} text-right max-w-[140px] truncate`}>{value}</span>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 backdrop-blur-md bg-slate-950/60 border border-slate-800/80 rounded-xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.5)] z-10 w-48">
                <div className="text-slate-400 text-[9px] uppercase font-bold mb-3 tracking-[0.2em] relative">
                    Network Legend
                    <div className="absolute -bottom-1 left-0 w-8 h-px bg-slate-600"></div>
                </div>
                <div className="flex flex-col gap-2.5 text-[11px] text-slate-300 font-mono">
                    {[
                        { color: '#06B6D4', label: 'Hub (high centrality)', shape: '⬡' },
                        { color: '#8B5CF6', label: 'High centrality ≥70', shape: '●' },
                        { color: '#3B82F6', label: 'Med centrality ≥40',  shape: '●' },
                        { color: '#EF4444', label: 'Critical suspect ≥75', shape: '■' },
                        { color: '#F97316', label: 'High suspect ≥50',     shape: '■' },
                        { color: '#EAB308', label: 'Med suspect ≥25',      shape: '■' },
                        { color: '#475569', label: 'Normal account',        shape: '●' },
                    ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                            <span style={{ color: item.color, fontSize: '13px' }}>{item.shape}</span>
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
