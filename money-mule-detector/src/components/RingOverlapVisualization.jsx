import React, { useState, useMemo } from 'react';

const RING_COLORS = { cycle: '#EF4444', smurfing: '#F97316', shell: '#EAB308' };
const SVG_W = 600;
const SVG_H = 400;
const CX = SVG_W / 2;
const CY = SVG_H / 2;

function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

function ringRadius(memberCount) {
    return clamp(20 + memberCount * 3, 24, 80);
}

function getRingPositions(rings) {
    const n = rings.length;
    if (n === 0) return [];
    const positions = [];
    const baseRadius = Math.min(SVG_W, SVG_H) * 0.28;
    for (let i = 0; i < n; i++) {
        const angle = (2 * Math.PI * i) / n - Math.PI / 2;
        positions.push({
            x: CX + baseRadius * Math.cos(angle),
            y: CY + baseRadius * Math.sin(angle),
        });
    }
    return positions;
}

export default function RingOverlapVisualization({ fraudRings, suspiciousAccounts, nodeStats }) {
    const [hoveredRing, setHoveredRing] = useState(null);
    const [hoveredAccount, setHoveredAccount] = useState(null);
    const [tooltip, setTooltip] = useState(null);

    const accountMap = useMemo(() => {
        const m = {};
        for (const acc of suspiciousAccounts || []) m[acc.account_id] = acc;
        return m;
    }, [suspiciousAccounts]);

    // Find overlap accounts
    const overlapAccounts = useMemo(() => {
        return Object.entries(nodeStats || {})
            .filter(([, stats]) => stats.ringMemberships && stats.ringMemberships.length >= 2)
            .map(([id, stats]) => ({ id, ringMemberships: stats.ringMemberships, score: accountMap[id]?.suspicion_score ?? 0 }))
            .sort((a, b) => b.ringMemberships.length - a.ringMemberships.length || b.score - a.score);
    }, [nodeStats, accountMap]);

    // Rings that share accounts (connections)
    const ringConnections = useMemo(() => {
        const connections = [];
        const rings = fraudRings || [];
        for (let i = 0; i < rings.length; i++) {
            for (let j = i + 1; j < rings.length; j++) {
                const setA = new Set(rings[i].member_accounts || []);
                const shared = (rings[j].member_accounts || []).filter((m) => setA.has(m));
                if (shared.length >= 1) {
                    connections.push({ ringA: rings[i].ring_id, ringB: rings[j].ring_id, shared: shared.length });
                }
            }
        }
        return connections;
    }, [fraudRings]);

    const rings = fraudRings || [];
    const positions = getRingPositions(rings);

    // Index ring positions by ring_id
    const ringPosMap = {};
    rings.forEach((r, i) => { ringPosMap[r.ring_id] = positions[i]; });
    const ringMap = {};
    rings.forEach((r) => { ringMap[r.ring_id] = r; });

    // Overlap account diamond positions: midpoint of two ring circles
    const overlapAccountPositions = useMemo(() => {
        return overlapAccounts.map((acc) => {
            const memberships = acc.ringMemberships;
            // Average position of all ring centers this account belongs to
            let sumX = 0, sumY = 0, count = 0;
            for (const rid of memberships) {
                const pos = ringPosMap[rid];
                if (pos) { sumX += pos.x; sumY += pos.y; count++; }
            }
            return count > 0 ? { id: acc.id, x: sumX / count, y: sumY / count } : null;
        }).filter(Boolean);
    }, [overlapAccounts, ringPosMap]);

    if (rings.length === 0) {
        return <div className="text-slate-400 text-center py-12">No fraud rings to visualize.</div>;
    }

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                🔗 Ring Overlap Visualization
            </h3>
            <p className="text-slate-400 text-xs mb-5">Bubble overlap showing fraud rings and their shared accounts. Diamonds = cross-ring nodes.</p>

            {/* SVG */}
            <div className="relative bg-slate-950 rounded-xl overflow-hidden border border-slate-800">
                <svg
                    viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                    width="100%"
                    style={{ maxHeight: 400, display: 'block' }}
                >
                    {/* Connecting lines between rings sharing accounts */}
                    {ringConnections.map((conn) => {
                        const posA = ringPosMap[conn.ringA];
                        const posB = ringPosMap[conn.ringB];
                        if (!posA || !posB) return null;
                        const mx = (posA.x + posB.x) / 2;
                        const my = (posA.y + posB.y) / 2;
                        return (
                            <g key={`${conn.ringA}-${conn.ringB}`}>
                                <line
                                    x1={posA.x} y1={posA.y}
                                    x2={posB.x} y2={posB.y}
                                    stroke="#9333EA"
                                    strokeWidth={2}
                                    strokeDasharray="6 4"
                                    opacity={0.6}
                                />
                                <text x={mx} y={my - 4} textAnchor="middle" fill="#C084FC" fontSize={9} fontFamily="IBM Plex Mono, monospace">
                                    {conn.shared} shared
                                </text>
                            </g>
                        );
                    })}

                    {/* Ring circles */}
                    {rings.map((ring, i) => {
                        const pos = positions[i];
                        if (!pos) return null;
                        const r = ringRadius((ring.member_accounts || []).length);
                        const color = RING_COLORS[ring.pattern_type] || '#6B7280';
                        const isHovered = hoveredRing === ring.ring_id;
                        return (
                            <g key={ring.ring_id}>
                                <circle
                                    cx={pos.x} cy={pos.y} r={r}
                                    fill={color + '33'}
                                    stroke={color}
                                    strokeWidth={isHovered ? 3 : 2}
                                    opacity={isHovered ? 1 : 0.8}
                                    style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                                    onMouseEnter={(e) => {
                                        setHoveredRing(ring.ring_id);
                                        const overlappingWith = ringConnections
                                            .filter((c) => c.ringA === ring.ring_id || c.ringB === ring.ring_id)
                                            .map((c) => c.ringA === ring.ring_id ? c.ringB : c.ringA);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setTooltip({
                                            type: 'ring',
                                            x: rect.left + rect.width / 2,
                                            y: rect.top,
                                            ring_id: ring.ring_id,
                                            pattern_type: ring.pattern_type,
                                            memberCount: (ring.member_accounts || []).length,
                                            risk_score: ring.risk_score,
                                            sharedWith: overlappingWith,
                                        });
                                    }}
                                    onMouseLeave={() => { setHoveredRing(null); setTooltip(null); }}
                                />
                                {/* Ring labels */}
                                <text x={pos.x} y={pos.y - 4} textAnchor="middle" fill={color} fontSize={11} fontWeight="bold" fontFamily="IBM Plex Mono, monospace" pointerEvents="none">
                                    {ring.ring_id}
                                </text>
                                <text x={pos.x} y={pos.y + 9} textAnchor="middle" fill="#94A3B8" fontSize={9} fontFamily="Inter, sans-serif" pointerEvents="none">
                                    {(ring.member_accounts || []).length} accts
                                </text>
                            </g>
                        );
                    })}

                    {/* Overlap account diamonds */}
                    {overlapAccountPositions.map(({ id, x, y }) => {
                        const acc = overlapAccounts.find((a) => a.id === id);
                        const isHov = hoveredAccount === id;
                        const ds = 12;
                        const points = `${x},${y - ds} ${x + ds},${y} ${x},${y + ds} ${x - ds},${y}`;
                        return (
                            <g key={id}>
                                <polygon
                                    points={points}
                                    fill={isHov ? '#FFFFFF' : '#F0ABFC'}
                                    stroke="#EF4444"
                                    strokeWidth={2}
                                    style={{ cursor: 'pointer', transition: 'all 0.15s' }}
                                    onMouseEnter={(e) => {
                                        setHoveredAccount(id);
                                        const rect = e.currentTarget.getBoundingClientRect();
                                        setTooltip({
                                            type: 'account',
                                            x: rect.left + rect.width / 2,
                                            y: rect.top,
                                            id,
                                            score: acc?.score ?? 0,
                                            rings: acc?.ringMemberships || [],
                                        });
                                    }}
                                    onMouseLeave={() => { setHoveredAccount(null); setTooltip(null); }}
                                />
                            </g>
                        );
                    })}
                </svg>

                {/* SVG Tooltip */}
                {tooltip && (
                    <div
                        className="fixed z-50 pointer-events-none bg-slate-800 border border-slate-600 rounded-xl px-3 py-2 text-xs shadow-xl"
                        style={{ left: tooltip.x + 8, top: tooltip.y - 80, fontFamily: 'IBM Plex Mono, monospace' }}
                    >
                        {tooltip.type === 'ring' ? (
                            <>
                                <div className="font-bold text-amber-400 mb-1">Ring: {tooltip.ring_id}</div>
                                <div>Type: <span className="text-orange-400">{tooltip.pattern_type}</span></div>
                                <div>Members: {tooltip.memberCount}</div>
                                <div>Risk Score: <span className="text-red-400">{tooltip.risk_score}</span></div>
                                {tooltip.sharedWith.length > 0 && (
                                    <div>Shared with: <span className="text-purple-400">{tooltip.sharedWith.join(', ')}</span></div>
                                )}
                            </>
                        ) : (
                            <>
                                <div className="font-bold text-fuchsia-400 mb-1">Account: {tooltip.id}</div>
                                <div>Score: <span className="text-red-400">{tooltip.score}</span></div>
                                <div>Rings: <span className="text-purple-400">{tooltip.rings.join(', ')}</span></div>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Legend */}
            <div className="flex gap-4 mt-3 text-xs text-slate-400">
                {Object.entries(RING_COLORS).map(([type, color]) => (
                    <div key={type} className="flex items-center gap-1.5">
                        <div className="w-3 h-3 rounded-full" style={{ backgroundColor: color }} />
                        <span>{type}</span>
                    </div>
                ))}
                <div className="flex items-center gap-1.5">
                    <div className="w-3 h-3 rotate-45 bg-fuchsia-300" />
                    <span>cross-ring account</span>
                </div>
            </div>

            {/* Cross-ring ranked list */}
            <div className="mt-6">
                <h4 className="text-sm font-bold text-slate-200 mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
                    🔗 Cross-Ring Accounts (Most Dangerous Nodes)
                </h4>
                {overlapAccounts.length === 0 ? (
                    <p className="text-slate-400 text-sm">No cross-ring account overlap detected in this dataset.</p>
                ) : (
                    <div className="space-y-2">
                        {overlapAccounts.map((acc, i) => (
                            <div
                                key={acc.id}
                                className={`flex items-center gap-3 px-4 py-2 rounded-xl text-sm ${i === 0 ? 'bg-fuchsia-950/40 border border-fuchsia-800' : 'bg-slate-800 border border-slate-700'}`}
                                style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                            >
                                <span className="text-slate-400 w-5 text-xs">{i + 1}.</span>
                                <span className="text-fuchsia-300 font-bold flex-1">{acc.id}</span>
                                <span className="text-slate-400 text-xs">member of {acc.ringMemberships.length} rings</span>
                                <span className="text-amber-400 font-bold">score: {acc.score}</span>
                                <span className="text-purple-400 text-xs">{acc.ringMemberships.join(', ')}</span>
                                {i === 0 && (
                                    <span className="ml-1 px-2 py-0.5 bg-red-900/60 border border-red-700 text-red-300 text-xs rounded font-bold">
                                        ⚠ HIGHEST RISK NODE
                                    </span>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
