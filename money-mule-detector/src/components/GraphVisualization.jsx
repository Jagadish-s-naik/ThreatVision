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
            return {
                data: {
                    id,
                    label: truncate(id),
                    color: getNodeColor(acc),
                    size: getNodeSize(acc),
                    borderWidth: acc ? 3 : 0,
                    shape: isMultiRing ? 'diamond' : 'ellipse',
                    suspicion_score: acc?.suspicion_score ?? 0,
                    ring_id: acc?.ring_id ?? '',
                    detected_patterns: acc ? acc.detected_patterns.join(', ') : '',
                    txCount: stats?.txCount ?? 0,
                    ringCount: stats ? (stats.ringMemberships?.length || 0) : 0,
                },
                classes: isMultiRing ? 'multi-ring' : (acc ? 'suspicious' : 'normal'),
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
                        edgeColor: bothSuspect ? '#EF4444' : '#4B5563',
                        edgeWidth: bothSuspect ? 2 : 1,
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
                        'font-size': '10px',
                        'font-family': 'IBM Plex Mono, monospace',
                        'text-valign': 'bottom',
                        'text-halign': 'center',
                        'text-margin-y': 4,
                        'border-width': 'data(borderWidth)',
                        'border-color': '#FFFFFF',
                        'shape': 'data(shape)',
                    },
                },
                {
                    selector: 'node.multi-ring',
                    style: {
                        'border-color': '#F0ABFC',
                        'border-width': 3,
                    },
                },
                {
                    selector: 'node.faded',
                    style: { 'opacity': 0.2 },
                },
                {
                    selector: 'node.highlighted',
                    style: { 'opacity': 1, 'border-width': 4, 'border-color': '#F59E0B' },
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
                    },
                },
                {
                    selector: 'edge.faded',
                    style: { 'opacity': 0.1 },
                },
            ],
            layout: {
                name: useGrid ? 'grid' : 'cose',
                animate: false,
                randomize: false,
                nodeRepulsion: 400000,
                idealEdgeLength: 100,
            },
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
            const d = node.data();
            const pos = node.renderedPosition();
            setTooltip({
                x: pos.x + 10,
                y: pos.y - 10,
                accountId: d.id,
                score: d.suspicion_score,
                patterns: d.detected_patterns,
                ringId: d.ring_id,
                txCount: d.txCount,
                ringCount: d.ringCount,
            });
        });
        cy.on('mouseout', 'node', () => setTooltip(null));

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
            }

            if (acc) onSelectAccount(acc);
        });

        // Click background → reset
        cy.on('tap', (e) => {
            if (e.target === cy) {
                cy.elements().removeClass('faded highlighted');
            }
        });
    }, [edges, nodeStats, suspiciousAccounts, fraudRings, onSelectAccount]);

    useEffect(() => {
        buildAndMount();
        return () => { if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; } };
    }, [buildAndMount]);

    return (
        <div className="relative bg-slate-950 rounded-2xl border border-slate-700 overflow-hidden" style={{ height: 600 }}>
            <div ref={containerRef} style={{ width: '100%', height: '100%' }} />

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="absolute z-20 pointer-events-none bg-slate-800 border border-slate-600 rounded-xl p-3 text-xs text-slate-200 shadow-2xl"
                    style={{ left: tooltip.x, top: tooltip.y, maxWidth: 260, fontFamily: 'IBM Plex Mono, monospace' }}
                >
                    <div className="font-bold text-amber-400 mb-1">{tooltip.accountId}</div>
                    <div>Score: <span className="text-red-400">{tooltip.score}</span></div>
                    <div>Ring: <span className="text-orange-400">{tooltip.ringId || '—'}</span></div>
                    <div>Patterns: <span className="text-yellow-400">{tooltip.patterns || '—'}</span></div>
                    <div>Transactions: {tooltip.txCount}</div>
                    {tooltip.ringCount >= 2 && <div className="text-fuchsia-400 mt-1">⚠ {tooltip.ringCount} rings</div>}
                </div>
            )}

            {/* Legend */}
            <div className="absolute bottom-3 left-3 flex gap-3 text-xs text-slate-400">
                {[
                    { color: '#EF4444', label: 'Critical (≥75)' },
                    { color: '#F97316', label: 'High (≥50)' },
                    { color: '#EAB308', label: 'Medium (≥25)' },
                    { color: '#D946EF', label: 'Multi-ring' },
                    { color: '#6B7280', label: 'Normal' },
                ].map((item) => (
                    <div key={item.label} className="flex items-center gap-1">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: item.color }} />
                        <span>{item.label}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}
