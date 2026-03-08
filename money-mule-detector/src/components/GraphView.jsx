import React, { useRef, useEffect, useState, useMemo, useCallback } from 'react';
import cytoscape from 'cytoscape';

export default function GraphView({ suspiciousAccounts = [], fraudRings = [], allTransactions = [] }) {
    const fraudRef = useRef(null);
    const cleanRef = useRef(null);
    const fraudCyRef = useRef(null);
    const cleanCyRef = useRef(null);
    const [tooltip, setTooltip] = useState({ visible: false, content: {} });

    // ─── Derived sets ────────────────────────────────────────────────────────
    const suspiciousIds = useMemo(
        () => new Set(suspiciousAccounts.map((a) => a.account_id)),
        [suspiciousAccounts]
    );

    // Cross-ring account detection
    const ringMembership = useMemo(() => {
        const rm = {};
        for (const ring of fraudRings) {
            for (const acc of ring.member_accounts) {
                rm[acc] = (rm[acc] || 0) + 1;
            }
        }
        return rm;
    }, [fraudRings]);

    // ─── Fraud Cytoscape ─────────────────────────────────────────────────────
    useEffect(() => {
        if (!fraudRef.current || suspiciousAccounts.length === 0) return;
        if (fraudCyRef.current) { fraudCyRef.current.destroy(); fraudCyRef.current = null; }

        const nodes = suspiciousAccounts.map((acc) => {
            const patterns = acc.detected_patterns || [];
            const isCycle = patterns.some((p) => p.startsWith('cycle_length'));
            const isSmurf = patterns.includes('fan_in') || patterns.includes('fan_out');
            const isShell = patterns.includes('shell_chain');
            const nodeColor = isCycle ? '#fbbf24' : isSmurf ? '#f97316' : isShell ? '#c084fc' : '#ef4444';
            const isCrossRing = (ringMembership[acc.account_id] || 0) > 1;
            return {
                data: {
                    id: acc.account_id,
                    label: acc.account_id.length > 8 ? acc.account_id.slice(0, 8) + '…' : acc.account_id,
                    suspicion_score: acc.suspicion_score,
                    detected_patterns: Array.isArray(acc.detected_patterns) ? acc.detected_patterns.join(', ') : '',
                    ring_id: acc.ring_id,
                    nodeColor,
                    nodeShape: isCrossRing ? 'diamond' : 'ellipse',
                },
            };
        });

        const validIds = new Set(nodes.map((n) => n.data.id));
        const edges = allTransactions
            .filter((tx) => suspiciousIds.has(tx.sender_id) && suspiciousIds.has(tx.receiver_id))
            .slice(0, 800)
            .map((tx, i) => ({
                data: { id: `fe-${i}`, source: tx.sender_id, target: tx.receiver_id },
            }))
            .filter((e) => validIds.has(e.data.source) && validIds.has(e.data.target));

        const cy = cytoscape({
            container: fraudRef.current,
            elements: [...nodes, ...edges],
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': 'data(nodeColor)',
                        label: 'data(label)',
                        color: '#ffffff',
                        'font-size': '7px',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        width: 28,
                        height: 28,
                        shape: 'data(nodeShape)',
                        'border-width': 2,
                        'border-color': '#ffffff40',
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        'line-color': '#ef444460',
                        'target-arrow-color': '#ef4444',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        width: 1.5,
                        'arrow-scale': 0.8,
                    },
                },
                {
                    selector: 'node:selected',
                    style: { 'border-width': 4, 'border-color': '#ffffff' },
                },
            ],
            layout: { name: 'cose', animate: false, nodeRepulsion: 8000, idealEdgeLength: 80 },
        });

        cy.on('tap', 'node', (event) => {
            const data = event.target.data();
            setTooltip({
                visible: true,
                content: {
                    id: data.id,
                    score: data.suspicion_score,
                    patterns: data.detected_patterns,
                    ring: data.ring_id,
                    type: 'fraud',
                },
            });
        });
        cy.on('tap', (e) => {
            if (e.target === cy) setTooltip({ visible: false, content: {} });
        });

        fraudCyRef.current = cy;
        return () => { if (fraudCyRef.current) { fraudCyRef.current.destroy(); fraudCyRef.current = null; } };
    }, [suspiciousAccounts, allTransactions, suspiciousIds, ringMembership]);

    // ─── Clean Cytoscape ──────────────────────────────────────────────────────
    useEffect(() => {
        if (!cleanRef.current) return;
        if (cleanCyRef.current) { cleanCyRef.current.destroy(); cleanCyRef.current = null; }

        const allAccountIds = new Set();
        for (const tx of allTransactions) {
            allAccountIds.add(tx.sender_id);
            allAccountIds.add(tx.receiver_id);
        }
        const cleanIds = [...allAccountIds].filter((id) => !suspiciousIds.has(id));

        if (cleanIds.length === 0) return;

        const cleanSet = new Set(cleanIds);
        const nodes = cleanIds.map((id) => ({
            data: {
                id,
                label: id.length > 8 ? id.slice(0, 8) + '…' : id,
            },
        }));
        const edges = allTransactions
            .filter((tx) => cleanSet.has(tx.sender_id) && cleanSet.has(tx.receiver_id))
            .slice(0, 800)
            .map((tx, i) => ({
                data: { id: `ce-${i}`, source: tx.sender_id, target: tx.receiver_id },
            }));

        const cy = cytoscape({
            container: cleanRef.current,
            elements: [...nodes, ...edges],
            style: [
                {
                    selector: 'node',
                    style: {
                        'background-color': '#22c55e',
                        label: 'data(label)',
                        color: '#ffffff',
                        'font-size': '7px',
                        'text-valign': 'center',
                        'text-halign': 'center',
                        width: 22,
                        height: 22,
                        'border-width': 1,
                        'border-color': '#ffffff20',
                    },
                },
                {
                    selector: 'edge',
                    style: {
                        'line-color': '#22c55e40',
                        'target-arrow-color': '#22c55e',
                        'target-arrow-shape': 'triangle',
                        'curve-style': 'bezier',
                        width: 1,
                        'arrow-scale': 0.7,
                    },
                },
            ],
            layout: { name: 'cose', animate: false, nodeRepulsion: 8000, idealEdgeLength: 80 },
        });

        cy.on('tap', 'node', (event) => {
            const data = event.target.data();
            setTooltip({
                visible: true,
                content: {
                    id: data.id,
                    type: 'clean',
                    status: 'Clean Account — No suspicious patterns detected',
                },
            });
        });
        cy.on('tap', (e) => {
            if (e.target === cy) setTooltip({ visible: false, content: {} });
        });

        cleanCyRef.current = cy;
        return () => { if (cleanCyRef.current) { cleanCyRef.current.destroy(); cleanCyRef.current = null; } };
    }, [allTransactions, suspiciousIds]);

    // ─── Zoom helpers ─────────────────────────────────────────────────────────
    const handleZoom = useCallback((action, panel) => {
        const cy = panel === 'fraud' ? fraudCyRef.current : cleanCyRef.current;
        if (!cy) return;
        if (action === 'Zoom In') cy.zoom(cy.zoom() * 1.3);
        else if (action === 'Zoom Out') cy.zoom(cy.zoom() * 0.7);
        else if (action === 'Fit') cy.fit(undefined, 20);
        else if (action === 'Reset') { cy.reset(); cy.fit(undefined, 20); }
    }, []);

    // Counts
    const allAccountIds = new Set();
    for (const tx of allTransactions) {
        allAccountIds.add(tx.sender_id);
        allAccountIds.add(tx.receiver_id);
    }
    const cleanIdCount = [...allAccountIds].filter((id) => !suspiciousIds.has(id)).length;
    const fraudEdgeCount = allTransactions.filter(
        (tx) => suspiciousIds.has(tx.sender_id) && suspiciousIds.has(tx.receiver_id)
    ).length;

    return (
        <div className="flex flex-col gap-3">
            {/* Header summary */}
            <div className="flex flex-wrap gap-4 justify-center text-sm font-mono py-2">
                <span className="text-red-400 font-bold">
                    🚨 {suspiciousAccounts.length} Suspicious Accounts · {Math.min(fraudEdgeCount, 800)} Fraud Edges
                </span>
                <span className="text-slate-600">|</span>
                <span className="text-green-400 font-bold">
                    ✅ {cleanIdCount} Clean Accounts
                </span>
            </div>

            {/* Two panels side-by-side */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* ── LEFT: Fraud Panel ── */}
                <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: '2px solid rgba(239,68,68,0.4)', background: '#1a0000' }}
                >
                    <div
                        className="flex justify-between items-center px-4 py-2"
                        style={{ background: 'rgba(239,68,68,0.15)', borderBottom: '1px solid rgba(239,68,68,0.3)' }}
                    >
                        <span className="text-red-400 font-bold text-sm">🚨 Fraud Network</span>
                        <span className="text-red-400/60 text-xs font-mono">
                            {suspiciousAccounts.length} nodes
                        </span>
                    </div>

                    {suspiciousAccounts.length === 0 ? (
                        <div className="h-[400px] flex items-center justify-center text-slate-600 font-mono text-sm">
                            No suspicious accounts detected
                        </div>
                    ) : (
                        <div ref={fraudRef} style={{ width: '100%', height: 400 }} />
                    )}

                    <div
                        className="flex gap-2 px-3 py-2"
                        style={{ borderTop: '1px solid rgba(239,68,68,0.2)' }}
                    >
                        {['Zoom In', 'Zoom Out', 'Fit', 'Reset'].map((action) => (
                            <button
                                key={action}
                                onClick={() => handleZoom(action, 'fraud')}
                                className="text-red-400 text-xs px-2 py-1 rounded cursor-pointer hover:bg-red-900/30 transition-colors"
                                style={{ border: '1px solid rgba(239,68,68,0.4)', background: 'rgba(239,68,68,0.1)' }}
                            >
                                {action}
                            </button>
                        ))}
                    </div>
                </div>

                {/* ── RIGHT: Non-Fraud Panel ── */}
                <div
                    className="rounded-xl overflow-hidden"
                    style={{ border: '2px solid rgba(34,197,94,0.4)', background: '#001a00' }}
                >
                    <div
                        className="flex justify-between items-center px-4 py-2"
                        style={{ background: 'rgba(34,197,94,0.1)', borderBottom: '1px solid rgba(34,197,94,0.3)' }}
                    >
                        <span className="text-green-400 font-bold text-sm">✅ Non-Fraud Network</span>
                        <span className="text-green-400/60 text-xs font-mono">
                            {cleanIdCount} nodes
                        </span>
                    </div>

                    {cleanIdCount === 0 ? (
                        <div className="h-[400px] flex items-center justify-center text-slate-600 font-mono text-sm">
                            No clean accounts in dataset
                        </div>
                    ) : (
                        <div ref={cleanRef} style={{ width: '100%', height: 400 }} />
                    )}

                    <div
                        className="flex gap-2 px-3 py-2"
                        style={{ borderTop: '1px solid rgba(34,197,94,0.2)' }}
                    >
                        {['Zoom In', 'Zoom Out', 'Fit', 'Reset'].map((action) => (
                            <button
                                key={action}
                                onClick={() => handleZoom(action, 'clean')}
                                className="text-green-400 text-xs px-2 py-1 rounded cursor-pointer hover:bg-green-900/30 transition-colors"
                                style={{ border: '1px solid rgba(34,197,94,0.4)', background: 'rgba(34,197,94,0.1)' }}
                            >
                                {action}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Tooltip Overlay */}
            {tooltip.visible && (
                <div
                    className="fixed bottom-24 right-6 z-50 rounded-xl p-4 max-w-xs shadow-2xl"
                    style={{ background: '#0f172a', border: '1px solid rgba(255,255,255,0.1)', fontFamily: 'IBM Plex Mono, monospace' }}
                >
                    <div className="flex justify-between items-center mb-3">
                        <p className="text-orange-400 font-bold text-sm truncate max-w-[190px]">
                            {tooltip.content.id}
                        </p>
                        <button
                            onClick={() => setTooltip({ visible: false, content: {} })}
                            className="text-slate-500 hover:text-white ml-2 text-xs shrink-0"
                        >
                            ✕
                        </button>
                    </div>

                    {tooltip.content.type === 'fraud' && (
                        <div className="space-y-1 text-xs">
                            {tooltip.content.score !== undefined && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500 uppercase">Score</span>
                                    <span className="text-red-400 font-bold">{tooltip.content.score}</span>
                                </div>
                            )}
                            {tooltip.content.patterns && (
                                <div className="flex justify-between gap-2">
                                    <span className="text-slate-500 uppercase shrink-0">Patterns</span>
                                    <span className="text-amber-400 text-right break-all">{tooltip.content.patterns}</span>
                                </div>
                            )}
                            {tooltip.content.ring && (
                                <div className="flex justify-between">
                                    <span className="text-slate-500 uppercase">Ring</span>
                                    <span className="text-purple-400 font-bold">{tooltip.content.ring}</span>
                                </div>
                            )}
                        </div>
                    )}

                    {tooltip.content.type === 'clean' && (
                        <p className="text-green-400 text-xs">{tooltip.content.status}</p>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="flex flex-wrap justify-center gap-5 text-xs text-slate-500 font-mono pt-1 pb-2">
                <span>🟡 Cycle fraud</span>
                <span>🟠 Smurfing</span>
                <span>🟣 Shell chain</span>
                <span>💠 Cross-ring account</span>
                <span className="text-green-500">🟢 Clean account</span>
            </div>
        </div>
    );
}
