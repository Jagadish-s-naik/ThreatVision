import React, { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';

function truncate(str, n = 10) {
    return str && str.length > n ? str.slice(0, n) + '…' : str;
}

function getNodeColor(acc) {
    if (!acc) return '#6B7280';
    if (acc.ringMemberships && acc.ringMemberships.length >= 2) return '#D946EF';
    if (acc.suspicion_score >= 75) return '#EF4444';
    if (acc.suspicion_score >= 50) return '#F97316';
    if (acc.suspicion_score >= 25) return '#EAB308';
    return '#6B7280';
}

function getNodeSize(acc) {
    if (!acc) return 30;
    if (acc.ringMemberships && acc.ringMemberships.length >= 2) return 42;
    if (acc.suspicion_score >= 75) return 40;
    if (acc.suspicion_score >= 50) return 38;
    if (acc.suspicion_score >= 25) return 35;
    return 30;
}

export default function GraphVisualization({ edges, nodeStats, suspiciousAccounts, fraudRings, onSelectAccount }) {
    const containerRef = useRef(null);
    const cyRef = useRef(null);
    const rafRef = useRef(null);   // ← track animation frame for cleanup
    const [tooltip, setTooltip] = useState(null);
    const [isFocusMode, setIsFocusMode] = useState(false);

    const accountMap = {};
    for (const acc of suspiciousAccounts || []) accountMap[acc.account_id] = acc;

    const buildAndMount = useCallback(() => {
        if (!containerRef.current || !edges) return;

        // Cancel any running animation frame before rebuilding
        if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
        if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

        // ─── Collect all unique node IDs from edges ───────────────────
        const nodeIds = new Set();
        for (const e of edges || []) {
            nodeIds.add(String(e.sender_id));
            nodeIds.add(String(e.receiver_id));
        }

        // ─── Also include suspicious accounts not in edges ─────────────
        for (const acc of suspiciousAccounts || []) {
            nodeIds.add(String(acc.account_id));
        }

        const suspiciousIds = new Set(Object.keys(accountMap));
        const normalIds = [...nodeIds].filter(id => !suspiciousIds.has(id));
        const fraudIds = [...suspiciousIds].filter(id => nodeIds.has(id));

        // ─── Virtual root + branch nodes ──────────────────────────────
        const ROOT_ID = '__ROOT__';
        const FRAUD_ID = '__FRAUD__';
        const NORMAL_ID = '__NORMAL__';

        const cyNodes = [];
        const cyEdges = [];

        // Root node
        cyNodes.push({
            data: {
                id: ROOT_ID,
                label: 'THREAT\nVISION',
                color: '#F59E0B',
                size: 58,
                borderWidth: 4,
                shape: 'ellipse',
                suspicion_score: 0,
                ring_id: '',
                detected_patterns: '',
                txCount: nodeIds.size,
                ringCount: 0,
            },
            classes: 'root-node',
        });

        // Fraud branch hub
        if (fraudIds.length > 0) {
            cyNodes.push({
                data: {
                    id: FRAUD_ID,
                    label: '⚠ FRAUD\n' + fraudIds.length + ' accounts',
                    color: '#DC2626',
                    size: 52,
                    borderWidth: 4,
                    shape: 'round-rectangle',
                    suspicion_score: 100,
                    ring_id: '',
                    detected_patterns: '',
                    txCount: fraudIds.length,
                    ringCount: 0,
                },
                classes: 'branch-fraud',
            });
            cyEdges.push({
                data: { id: `${ROOT_ID}__${FRAUD_ID}`, source: ROOT_ID, target: FRAUD_ID, edgeColor: '#DC2626', edgeWidth: 3, lineStyle: 'solid' },
            });
        }

        // Non-fraud branch hub
        if (normalIds.length > 0) {
            cyNodes.push({
                data: {
                    id: NORMAL_ID,
                    label: '✓ CLEAN\n' + normalIds.length + ' accounts',
                    color: '#16A34A',
                    size: 52,
                    borderWidth: 4,
                    shape: 'round-rectangle',
                    suspicion_score: 0,
                    ring_id: '',
                    detected_patterns: '',
                    txCount: normalIds.length,
                    ringCount: 0,
                },
                classes: 'branch-normal',
            });
            cyEdges.push({
                data: { id: `${ROOT_ID}__${NORMAL_ID}`, source: ROOT_ID, target: NORMAL_ID, edgeColor: '#16A34A', edgeWidth: 3, lineStyle: 'solid' },
            });
        }

        // ─── Fraud account leaf nodes ──────────────────────────────────
        for (const id of fraudIds) {
            const acc = accountMap[id];
            const stats = nodeStats?.[id];
            const isMultiRing = acc?.ring_ids?.length >= 2;
            cyNodes.push({
                data: {
                    id,
                    label: truncate(id),
                    color: getNodeColor(acc),
                    size: getNodeSize(acc) * 1.2,
                    borderWidth: 3,
                    shape: isMultiRing ? 'diamond' : 'round-rectangle',
                    suspicion_score: acc?.suspicion_score ?? 0,
                    ring_id: acc?.ring_ids?.[0] ?? '',
                    detected_patterns: acc ? (acc.detected_patterns || []).join(', ') : '',
                    txCount: stats?.txCount ?? acc?.transaction_count ?? 0,
                    ringCount: acc?.ring_ids?.length ?? 0,
                },
                classes: isMultiRing ? 'multi-ring' : 'suspicious',
            });
            cyEdges.push({
                data: { id: `${FRAUD_ID}__${id}`, source: FRAUD_ID, target: id, edgeColor: '#EF4444', edgeWidth: 2, lineStyle: 'dashed' },
                classes: 'suspicious-edge',
            });
        }

        // ─── Normal account leaf nodes (cap at 300 to keep tree readable) ─
        const normalToShow = normalIds.slice(0, 300);
        for (const id of normalToShow) {
            const stats = nodeStats?.[id];
            cyNodes.push({
                data: {
                    id,
                    label: truncate(id),
                    color: '#6B7280',
                    size: 30,
                    borderWidth: 2,
                    shape: 'rectangle',
                    suspicion_score: 0,
                    ring_id: '',
                    detected_patterns: '',
                    txCount: stats?.txCount ?? 0,
                    ringCount: 0,
                },
                classes: 'normal',
            });
            cyEdges.push({
                data: { id: `${NORMAL_ID}__${id}`, source: NORMAL_ID, target: id, edgeColor: '#475569', edgeWidth: 1, lineStyle: 'solid' },
            });
        }

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
                        'font-size': '10px',
                        'font-weight': 'bold',
                        'font-family': 'IBM Plex Mono, monospace',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-wrap': 'wrap',
                        'text-background-opacity': 0.7,
                        'text-background-color': '#020617',
                        'text-background-shape': 'round-rectangle',
                        'text-background-padding': 2,
                        'border-width': 'data(borderWidth)',
                        'border-color': '#000000',
                        'shape': 'data(shape)',
                    },
                },
                {
                    selector: 'node.root-node',
                    style: {
                        'background-color': '#F59E0B',
                        'color': '#000',
                        'font-size': '12px',
                        'border-color': '#FCD34D',
                        'border-width': 4,
                    },
                },
                {
                    selector: 'node.branch-fraud',
                    style: {
                        'background-color': '#991B1B',
                        'font-size': '11px',
                        'border-color': '#EF4444',
                    },
                },
                {
                    selector: 'node.branch-normal',
                    style: {
                        'background-color': '#14532D',
                        'font-size': '11px',
                        'border-color': '#22C55E',
                    },
                },
                {
                    selector: 'node.multi-ring',
                    style: {
                        'border-color': '#F0ABFC',
                        'border-width': 4,
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
                    selector: 'node.highlighted',
                    style: {
                        'opacity': 1,
                        'border-width': 4,
                        'border-color': '#22D3EE',
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        'line-color': 'data(edgeColor)',
                        'width': 'data(edgeWidth)',
                        'target-arrow-color': 'data(edgeColor)',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        'arrow-scale': 1.0,
                        'line-style': 'data(lineStyle)',
                    },
                },
                {
                    selector: 'edge.suspicious-edge',
                    style: {
                        'line-dash-pattern': [6, 3],
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
                name: 'breadthfirst',
                directed: true,
                roots: `#${ROOT_ID}`,
                padding: 60,
                spacingFactor: 1.6,
                animate: true,
                animationDuration: 600,
                avoidOverlap: true,
            },
            minZoom: 0.1,
            maxZoom: 3,
            wheelSensitivity: 0.3,
        });

        cyRef.current = cy;

        // Marching ants animation on suspicious edges
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
            const node = e.target;
            const id = node.data('id');
            if (id === ROOT_ID || id === FRAUD_ID || id === NORMAL_ID) return;
            containerRef.current.style.cursor = 'pointer';
            const d = node.data();
            const pos = node.renderedPosition();
            setTooltip({
                x: pos.x,
                y: pos.y,
                accountId: d.id,
                score: d.suspicion_score,
                patterns: d.detected_patterns,
                ringId: d.ring_id,
                txCount: d.txCount,
                ringCount: d.ringCount,
            });
        });

        cy.on('mouseout', 'node', () => {
            containerRef.current.style.cursor = 'default';
            setTooltip(null);
        });

        // Click node
        cy.on('tap', 'node', (e) => {
            const nodeId = e.target.data('id');
            if (nodeId === ROOT_ID || nodeId === FRAUD_ID || nodeId === NORMAL_ID) return;
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

        // Double click focus mode
        cy.on('dblclick', 'node', (e) => {
            const nodeId = e.target.data('id');
            if (nodeId === ROOT_ID || nodeId === FRAUD_ID || nodeId === NORMAL_ID) return;
            const neighborhood = e.target.neighborhood().add(e.target);
            cy.elements().addClass('hidden');
            neighborhood.removeClass('hidden').addClass('highlighted');
            cy.fit(neighborhood, 50);
            setIsFocusMode(true);
        });

        // Click background → reset
        cy.on('tap', (e) => {
            if (e.target === cy) {
                cy.elements().removeClass('faded highlighted');
                setTooltip(null);
            }
        });

    }, [edges, nodeStats, suspiciousAccounts, fraudRings, onSelectAccount]);

    useEffect(() => {
        buildAndMount();
        return () => {
            if (rafRef.current) { cancelAnimationFrame(rafRef.current); rafRef.current = null; }
            if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }
        };
    }, [buildAndMount]);

    const handleZoomIn = () => cyRef.current && cyRef.current.zoom(cyRef.current.zoom() + 0.2);
    const handleZoomOut = () => cyRef.current && cyRef.current.zoom(cyRef.current.zoom() - 0.2);
    const handleFit = () => cyRef.current && cyRef.current.fit(undefined, 50);
    const handleReset = () => {
        if (cyRef.current) {
            cyRef.current.elements().removeClass('faded highlighted hidden');
            cyRef.current.fit(undefined, 50);
            setIsFocusMode(false);
        }
    };

    return (
        <div className="relative bg-slate-950/50 rounded-none border-2 border-slate-800 brutal-shadow overflow-hidden group" style={{ height: 750 }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} className="bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]" />

            {/* Controls */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <button onClick={handleFit} className="neobutton bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 p-2 text-xs" title="Fit to View">⤢ FIT</button>
                <button onClick={handleZoomIn} className="neobutton bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 p-2 text-xs" title="Zoom In">+ IN</button>
                <button onClick={handleZoomOut} className="neobutton bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 p-2 text-xs" title="Zoom Out">- OUT</button>
                <button onClick={handleReset} className="neobutton bg-amber-900/50 text-amber-200 border-amber-800 hover:bg-amber-900 p-2 text-xs" title="Reset">↺ RST</button>
                {isFocusMode && (
                    <div className="bg-red-900/80 text-red-100 text-[10px] px-2 py-1 border border-red-600 font-bold uppercase tracking-widest text-center animate-pulse">
                        Focus Mode
                    </div>
                )}
            </div>

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="absolute z-20 pointer-events-none bg-slate-950 border-2 border-slate-100 p-0 shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]"
                    style={{
                        left: Math.min(tooltip.x + 20, (containerRef.current?.offsetWidth ?? 0) - 240),
                        top: Math.min(tooltip.y - 20, (containerRef.current?.offsetHeight ?? 0) - 200),
                        width: 240,
                        fontFamily: 'IBM Plex Mono, monospace',
                    }}
                >
                    <div className="bg-slate-100 text-slate-950 px-3 py-2 font-bold text-sm border-b-2 border-slate-100 flex justify-between items-center">
                        <span className="truncate">{truncate(tooltip.accountId, 15)}</span>
                        {tooltip.score >= 50 && <span className="text-red-600">⚠</span>}
                    </div>
                    <div className="p-3 space-y-2 text-xs text-slate-300">
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className="text-slate-500 uppercase font-bold tracking-wider">Score</span>
                            <span className={`font-bold ${tooltip.score >= 75 ? 'text-red-500' : (tooltip.score >= 50 ? 'text-orange-500' : 'text-slate-200')}`}>{tooltip.score}/100</span>
                        </div>
                        {tooltip.ringId && (
                            <div className="flex justify-between border-b border-slate-800 pb-1">
                                <span className="text-slate-500 uppercase font-bold tracking-wider">Ring ID</span>
                                <span className="text-amber-400 font-bold">{tooltip.ringId}</span>
                            </div>
                        )}
                        <div className="flex justify-between border-b border-slate-800 pb-1">
                            <span className="text-slate-500 uppercase font-bold tracking-wider">Tx Count</span>
                            <span className="font-bold">{tooltip.txCount}</span>
                        </div>
                        {tooltip.patterns && (
                            <div className="pt-1">
                                <span className="text-slate-500 uppercase font-bold tracking-wider block mb-1">Patterns</span>
                                <span className="text-cyan-400 bg-cyan-950/30 px-1 py-0.5 border border-cyan-900/50 block w-full text-center">{tooltip.patterns}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-slate-900/90 border-2 border-slate-800 p-3 z-10">
                <div className="text-slate-500 text-[10px] uppercase font-bold mb-2 tracking-widest">Tree Legend</div>
                <div className="flex flex-col gap-2 text-xs text-slate-300 font-mono">
                    {[
                        { color: '#F59E0B', label: 'Root (ThreatVision)', shape: '●' },
                        { color: '#DC2626', label: 'Fraud Branch', shape: '■' },
                        { color: '#16A34A', label: 'Non-Fraud Branch', shape: '■' },
                        { color: '#EF4444', label: 'Critical (≥75)', shape: '■' },
                        { color: '#F97316', label: 'High (≥50)', shape: '■' },
                        { color: '#EAB308', label: 'Medium (≥25)', shape: '■' },
                        { color: '#D946EF', label: 'Multi-ring', shape: '◆' },
                        { color: '#6B7280', label: 'Normal', shape: '▬' },
                    ].map((item) => (
                        <div key={item.label} className="flex items-center gap-2">
                            <span style={{ color: item.color, fontSize: '14px' }}>{item.shape}</span>
                            <span>{item.label}</span>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
