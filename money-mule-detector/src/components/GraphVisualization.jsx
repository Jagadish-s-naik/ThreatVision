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
    const [tooltip, setTooltip] = useState(null);

    const accountMap = {};
    for (const acc of suspiciousAccounts || []) accountMap[acc.account_id] = acc;

    const buildAndMount = useCallback(() => {
        if (!containerRef.current || !edges || edges.length === 0) return;
        if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }

        // Collect all nodes
        const nodeIds = new Set();
        for (const e of edges) {
            nodeIds.add(e.sender_id);
            nodeIds.add(e.receiver_id);
        }

        const useGrid = nodeIds.size > 2000;

        const cyNodes = [...nodeIds].map((id) => {
            const acc = accountMap[id];
            const stats = nodeStats[id];
            const isMultiRing = stats && stats.ringMemberships && stats.ringMemberships.length >= 2;
            const isSuspicious = !!acc;

            // Neo-Brutalism Shapes: Rectangle for normal, Diamond for risky
            return {
                data: {
                    id,
                    label: truncate(id),
                    color: getNodeColor(acc),
                    // Make nodes larger for better visibility
                    size: getNodeSize(acc) * 1.2,
                    borderWidth: isSuspicious ? 3 : 2,
                    shape: isMultiRing ? 'diamond' : (isSuspicious ? 'round-rectangle' : 'rectangle'),
                    suspicion_score: acc?.suspicion_score ?? 0,
                    ring_id: acc?.ring_id ?? '',
                    detected_patterns: acc ? acc.detected_patterns.join(', ') : '',
                    txCount: stats?.txCount ?? 0,
                    ringCount: stats ? (stats.ringMemberships?.length || 0) : 0,
                },
                classes: isMultiRing ? 'multi-ring' : (isSuspicious ? 'suspicious' : 'normal'),
            };
        });

        // Deduplicate edges by pair
        const edgeSet = new Set();
        const cyEdges = [];
        for (const e of edges) {
            const key = `${e.sender_id}__${e.receiver_id}`;
            if (!edgeSet.has(key)) {
                edgeSet.add(key);
                const bothSuspect = accountMap[e.sender_id] && accountMap[e.receiver_id];
                cyEdges.push({
                    data: {
                        id: key,
                        source: e.sender_id,
                        target: e.receiver_id,
                        edgeColor: bothSuspect ? '#EF4444' : '#64748B', // Red or Slate-500
                        edgeWidth: bothSuspect ? 3 : 1.5,
                    },
                });
            }
        }

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
                        'font-size': '11px',
                        'font-weight': 'bold',
                        'font-family': 'IBM Plex Mono, monospace',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        'text-background-opacity': 0.7,
                        'text-background-color': '#020617',
                        'text-background-shape': 'round-rectangle',
                        'text-background-padding': 2,
                        'border-width': 'data(borderWidth)',
                        'border-color': '#000000', // Hard black border
                        'shape': 'data(shape)',
                        'ghost': 'yes',
                        'ghost-offset-x': 4,
                        'ghost-offset-y': 4,
                        'ghost-opacity': 0.5,
                    },
                },
                {
                    selector: 'node.multi-ring',
                    style: {
                        'border-color': '#F0ABFC',
                        'border-width': 4,
                        'ghost-offset-x': 6,
                        'ghost-offset-y': 6,
                        'ghost-opacity': 0.8,
                    },
                },
                {
                    selector: 'node.suspicious',
                    style: {
                        'border-color': '#000000',
                    }
                },
                {
                    selector: 'node.faded',
                    style: { 'opacity': 0.1, 'ghost': 'no' },
                },
                {
                    selector: 'node.highlighted',
                    style: {
                        'opacity': 1,
                        'border-width': 4,
                        'border-color': '#22D3EE', // Cyan highlight
                        'ghost-offset-x': 6,
                        'ghost-offset-y': 6,
                        'width': (n) => n.data('size') * 1.3,
                        'height': (n) => n.data('size') * 1.3,
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
                        'arrow-scale': 1.2,
                    },
                },
                {
                    selector: 'edge.faded',
                    style: { 'opacity': 0.05 },
                },
            ],
            layout: {
                name: useGrid ? 'grid' : 'cose',
                animate: true,
                animationDuration: 500,
                randomize: false,
                componentSpacing: 120,    // Spread out clusters
                nodeRepulsion: 800000,    // Push nodes apart (stronger)
                idealEdgeLength: 150,     // Longer edges
                edgeElasticity: 50,
                nestingFactor: 5,
                gravity: 0.1,             // Lower gravity to spread out
                numIter: 1000,
                initialTemp: 200,
                coolingFactor: 0.95,
                minTemp: 1.0,
            },
            minZoom: 0.2,
            maxZoom: 3,
            wheelSensitivity: 0.3, // Smoother zoom
        });

        cyRef.current = cy;

        // Ring member index for click highlight
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
            containerRef.current.style.cursor = 'pointer';
            const d = node.data();
            // Use rendered position but clamp to container bounds
            const pos = node.renderedPosition();
            const containerRect = containerRef.current.getBoundingClientRect();

            // Adjust coordinates to be relative to the container
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

        // Click node → highlight ring, open panel
        cy.on('tap', 'node', (e) => {
            const nodeId = e.target.data('id');
            const acc = accountMap[nodeId];

            // Reset
            cy.elements().removeClass('faded highlighted');

            // Highlight ring members
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
                // For non-ring nodes, just highlight connections
                const neighborhood = e.target.neighborhood().add(e.target);
                cy.elements().addClass('faded');
                neighborhood.removeClass('faded').addClass('highlighted');
            }

            if (acc) onSelectAccount(acc);
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
        return () => { if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; } };
    }, [buildAndMount]);

    // Graph Controls
    const handleZoomIn = () => cyRef.current && cyRef.current.zoom(cyRef.current.zoom() + 0.2);
    const handleZoomOut = () => cyRef.current && cyRef.current.zoom(cyRef.current.zoom() - 0.2);
    const handleFit = () => cyRef.current && cyRef.current.fit(undefined, 50);
    const handleReset = () => {
        if (cyRef.current) {
            cyRef.current.fit(undefined, 50);
            cyRef.current.elements().removeClass('faded highlighted');
        }
    };

    return (
        <div className="relative bg-slate-950/50 rounded-none border-2 border-slate-800 brutal-shadow overflow-hidden group" style={{ height: 750 }}>
            {/* Graph Container */}
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} className="bg-[radial-gradient(#1e293b_1px,transparent_1px)] [background-size:20px_20px]" />

            {/* Controls Toolbar */}
            <div className="absolute top-4 right-4 flex flex-col gap-2 z-10">
                <button onClick={handleFit} className="neobutton bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 p-2 text-xs" title="Fit to View">
                    ⤢ FIT
                </button>
                <button onClick={handleZoomIn} className="neobutton bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 p-2 text-xs" title="Zoom In">
                    + IN
                </button>
                <button onClick={handleZoomOut} className="neobutton bg-slate-800 text-slate-200 border-slate-600 hover:bg-slate-700 p-2 text-xs" title="Zoom Out">
                    - OUT
                </button>
                <button onClick={handleReset} className="neobutton bg-amber-900/50 text-amber-200 border-amber-800 hover:bg-amber-900 p-2 text-xs" title="Reset">
                    ↺ RST
                </button>
            </div>

            {/* Tooltip Overlay */}
            {tooltip && (
                <div
                    className="absolute z-20 pointer-events-none bg-slate-900/95 border-2 border-slate-700 p-4 text-xs text-slate-200 shadow-2xl backdrop-blur-md"
                    style={{ left: tooltip.x + 20, top: tooltip.y - 20, minWidth: 200, fontFamily: 'IBM Plex Mono, monospace' }}
                >
                    <div className="font-bold text-amber-400 mb-2 text-sm border-b border-slate-700 pb-1">{tooltip.accountId}</div>
                    <div className="space-y-1">
                        <div className="flex justify-between"><span>Score:</span> <span className={`${tooltip.score >= 50 ? 'text-red-400' : 'text-slate-400'}`}>{tooltip.score}</span></div>
                        {tooltip.ringId && <div className="flex justify-between"><span>Ring:</span> <span className="text-orange-400">{tooltip.ringId}</span></div>}
                        {tooltip.txCount > 0 && <div className="flex justify-between"><span>Tx Count:</span> <span>{tooltip.txCount}</span></div>}
                        {tooltip.patterns && <div className="mt-2 text-yellow-500/80 italic">{tooltip.patterns}</div>}
                    </div>
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-4 left-4 bg-slate-900/90 border-2 border-slate-800 p-3 z-10">
                <div className="text-slate-500 text-[10px] uppercase font-bold mb-2 tracking-widest">Node Risk Levels</div>
                <div className="flex flex-col gap-2 text-xs text-slate-300 font-mono">
                    {[
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
