import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';

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
                        'color': '#F1F5F9',
                        'font-size': '9px',
                        'font-weight': 'bold',
                        'font-family': 'IBM Plex Mono, monospace',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'wrap',
                        'text-background-opacity': 0.8,
                        'text-background-color': '#020617',
                        'text-background-shape': 'round-rectangle',
                        'text-background-padding': 2,
                        'border-width': 'data(borderWidth)',
                        'border-color': '#1E293B',
                    },
                },
                {
                    selector: 'node.suspicious',
                    style: {
                        'border-color': '#EF4444',
                        'border-style': 'solid',
                    },
                },
                {
                    selector: 'node.hub',
                    style: {
                        'border-color': '#06B6D4',
                        'border-width': 4,
                        'border-style': 'double',
                    },
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'opacity': 1,
                        'border-width': 4,
                        'border-color': '#22D3EE',
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
                        'curve-style': 'bezier',
                        'arrow-scale': 0.8,
                        'opacity': 0.7,
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
                padding: 50,
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
                <div className="absolute top-3 left-3 flex items-center gap-2 bg-cyan-950/80 border border-cyan-700 px-3 py-1.5 text-[10px] font-bold font-mono text-cyan-300 uppercase tracking-widest z-10 backdrop-blur-sm">
                    <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse inline-block" />
                    Neo4j Graph Analytics
                    {graphData?.analytics && (
                        <span className="text-cyan-500 normal-case ml-1">
                            {graphData.analytics.totalNodes}N · {graphData.analytics.totalEdges}E · {graphData.analytics.hubCount} hubs
                        </span>
                    )}
                </div>
            )}

            {/* Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <button onClick={handleFit}    className="neobutton bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 p-2 text-xs" title="Fit">⤢ FIT</button>
                <button onClick={handleZoomIn} className="neobutton bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 p-2 text-xs" title="Zoom In">+ IN</button>
                <button onClick={handleZoomOut}className="neobutton bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 p-2 text-xs" title="Zoom Out">- OUT</button>
                <button onClick={handleReset}  className="neobutton bg-amber-900/50 text-amber-200 border-amber-800 hover:bg-amber-900 p-2 text-xs" title="Reset">↺ RST</button>
                {isFocusMode && (
                    <div className="bg-red-900/80 text-red-100 text-[10px] px-2 py-1 border border-red-600 font-bold uppercase tracking-widest text-center animate-pulse">
                        Focus Mode
                    </div>
                )}
            </div>

            {/* Hover tooltip */}
            {tooltip && (
                <div
                    className="absolute z-20 pointer-events-none bg-slate-950 border-2 border-slate-100 p-0 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                    style={{
                        left: Math.min(tooltip.x + 20, (containerRef.current?.offsetWidth ?? 0) - 260),
                        top:  Math.min(tooltip.y - 20, (containerRef.current?.offsetHeight ?? 0) - 220),
                        width: 260,
                        fontFamily: 'IBM Plex Mono, monospace',
                    }}
                >
                    <div className="bg-slate-100 text-slate-950 px-3 py-2 font-bold text-sm border-b-2 border-slate-100 flex justify-between items-center">
                        <span className="truncate">{truncate(tooltip.id, 18)}</span>
                        {tooltip.suspicionScore >= 50 && <span className="text-red-600 ml-1">⚠</span>}
                        {tooltip.isHub          && <span className="text-cyan-600 ml-1">⬡HUB</span>}
                    </div>
                    <div className="p-3 space-y-1.5 text-xs text-slate-300">
                        {[
                            { label: 'Centrality Score', value: `${tooltip.centralityScore}/100`, color: tooltip.centralityScore >= 70 ? 'text-cyan-400' : 'text-slate-200' },
                            { label: 'Degree (in/out)',  value: `${tooltip.degree} (${tooltip.inDegree}↓ ${tooltip.outDegree}↑)` },
                            { label: 'Total Sent',      value: `$${(tooltip.totalSent || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                            { label: 'Total Received',  value: `$${(tooltip.totalReceived || 0).toLocaleString('en-US', { maximumFractionDigits: 0 })}` },
                            ...(tooltip.suspicionScore > 0 ? [{ label: 'Suspicion Score', value: `${tooltip.suspicionScore}/100`, color: 'text-red-400' }] : []),
                            ...(tooltip.patterns ? [{ label: 'Patterns', value: tooltip.patterns, color: 'text-amber-400' }] : []),
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
            <div className="absolute bottom-4 left-4 bg-slate-900/90 border-2 border-slate-800 p-3 z-10">
                <div className="text-slate-500 text-[10px] uppercase font-bold mb-2 tracking-widest">Legend</div>
                <div className="flex flex-col gap-1.5 text-xs text-slate-300 font-mono">
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
