import React, { useState, useMemo } from 'react';

const SVG_W = 600;
const SVG_H = 450;
const CX = SVG_W / 2;
const CY = SVG_H / 2 - 10;
const ORBIT_R = 170;
const MAX_DISPLAY = 15;

const RING_COLORS = {
    cycle: '#EF4444',
    smurfing: '#F97316',
    shell: '#EAB308',
};

function ringColor(type) {
    return RING_COLORS[type] || '#6366F1';
}

export default function RingOverlapVisualization({ fraudRings = [], suspiciousAccounts = [], nodeStats = {} }) {
    const [hoveredRing, setHoveredRing] = useState(null);
    const [hoveredAccount, setHoveredAccount] = useState(null);

    // Top 15 rings by risk_score
    const displayRings = useMemo(
        () =>
            [...fraudRings]
                .sort((a, b) => b.risk_score - a.risk_score)
                .slice(0, MAX_DISPLAY),
        [fraudRings]
    );

    // Position each ring on an orbit circle
    const ringPositions = useMemo(() => {
        return displayRings.map((ring, i) => {
            const angle = (2 * Math.PI * i) / displayRings.length - Math.PI / 2;
            const x = CX + ORBIT_R * Math.cos(angle);
            const y = CY + ORBIT_R * Math.sin(angle);
            const r = Math.max(18, Math.min(50, 12 + ring.member_accounts.length * 2));
            return { ring, x, y, r };
        });
    }, [displayRings]);

    // Find cross-ring accounts (in ≥2 display rings)
    const crossRingAccounts = useMemo(() => {
        const membership = {};
        for (const { ring } of ringPositions) {
            for (const id of ring.member_accounts) {
                if (!membership[id]) membership[id] = [];
                membership[id].push(ring.ring_id);
            }
        }
        return Object.entries(membership)
            .filter(([, rids]) => rids.length >= 2)
            .map(([id, rids]) => ({ id, rids }));
    }, [ringPositions]);

    // Connections between rings that share at least 1 member
    const connections = useMemo(() => {
        const lines = [];
        for (let i = 0; i < ringPositions.length; i++) {
            for (let j = i + 1; j < ringPositions.length; j++) {
                const setA = new Set(ringPositions[i].ring.member_accounts);
                const shared = ringPositions[j].ring.member_accounts.filter((id) => setA.has(id));
                if (shared.length > 0) {
                    lines.push({ i, j, sharedCount: shared.length });
                }
            }
        }
        return lines;
    }, [ringPositions]);

    // Diamond marker position: midpoint between the two ring centers
    const diamondMarkers = useMemo(() => {
        const markers = [];
        for (const acc of crossRingAccounts) {
            // Use the first two rings this account belongs to
            const posA = ringPositions.find((rp) => rp.ring.ring_id === acc.rids[0]);
            const posB = ringPositions.find((rp) => rp.ring.ring_id === acc.rids[1]);
            if (!posA || !posB) continue;
            markers.push({
                id: acc.id,
                x: (posA.x + posB.x) / 2,
                y: (posA.y + posB.y) / 2,
                rids: acc.rids,
            });
        }
        return markers;
    }, [crossRingAccounts, ringPositions]);

    // Ranked cross-ring list
    const rankedCrossRing = useMemo(() => {
        const membership = {};
        for (const { ring } of ringPositions) {
            for (const id of ring.member_accounts) {
                if (!membership[id]) membership[id] = 0;
                membership[id]++;
            }
        }
        return Object.entries(membership)
            .filter(([, cnt]) => cnt >= 2)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 10);
    }, [ringPositions]);

    if (displayRings.length === 0) {
        return (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-8 text-center text-slate-500">
                No fraud rings to visualize.
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                🔗 Ring Overlap Visualization
            </h3>
            <p className="text-xs text-slate-500 mb-4">
                Showing top {displayRings.length} rings by risk score · {fraudRings.length} total rings detected
            </p>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* SVG */}
                <div className="flex-1 min-w-0">
                    <svg
                        viewBox={`0 0 ${SVG_W} ${SVG_H}`}
                        className="w-full rounded-xl bg-slate-950 border border-slate-800"
                        style={{ maxHeight: 460 }}
                    >
                        {/* Connection lines between rings sharing members */}
                        {connections.map(({ i, j, sharedCount }) => {
                            const a = ringPositions[i];
                            const b = ringPositions[j];
                            const isHovered = hoveredRing &&
                                (hoveredRing.ring_id === a.ring.ring_id || hoveredRing.ring_id === b.ring.ring_id);
                            return (
                                <line
                                    key={`${i}-${j}`}
                                    x1={a.x} y1={a.y} x2={b.x} y2={b.y}
                                    stroke={isHovered ? '#94A3B8' : '#334155'}
                                    strokeWidth={isHovered ? 1.5 : 1}
                                    strokeDasharray="4 3"
                                    opacity={isHovered ? 0.9 : 0.5}
                                />
                            );
                        })}

                        {/* Ring circles */}
                        {ringPositions.map(({ ring, x, y, r }) => {
                            const isHov = hoveredRing?.ring_id === ring.ring_id;
                            const color = ringColor(ring.pattern_type);
                            return (
                                <g
                                    key={ring.ring_id}
                                    onMouseEnter={() => setHoveredRing(ring)}
                                    onMouseLeave={() => setHoveredRing(null)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <circle
                                        cx={x} cy={y} r={r}
                                        fill={color}
                                        fillOpacity={isHov ? 0.35 : 0.18}
                                        stroke={color}
                                        strokeWidth={isHov ? 2.5 : 1.5}
                                    />
                                    <text
                                        x={x} y={y - 2}
                                        textAnchor="middle"
                                        fill={isHov ? '#F1F5F9' : '#94A3B8'}
                                        fontSize={isHov ? 9 : 8}
                                        fontWeight={isHov ? 'bold' : 'normal'}
                                        style={{ userSelect: 'none' }}
                                    >
                                        {ring.ring_id}
                                    </text>
                                    <text
                                        x={x} y={y + 9}
                                        textAnchor="middle"
                                        fill={color}
                                        fontSize={7}
                                        style={{ userSelect: 'none' }}
                                    >
                                        {ring.risk_score.toFixed(1)}
                                    </text>
                                </g>
                            );
                        })}

                        {/* Diamond markers for cross-ring accounts */}
                        {diamondMarkers.map((marker) => {
                            const isHov = hoveredAccount === marker.id;
                            return (
                                <g
                                    key={marker.id}
                                    transform={`translate(${marker.x},${marker.y})`}
                                    onMouseEnter={() => setHoveredAccount(marker.id)}
                                    onMouseLeave={() => setHoveredAccount(null)}
                                    style={{ cursor: 'pointer' }}
                                >
                                    <polygon
                                        points="0,-6 5,0 0,6 -5,0"
                                        fill={isHov ? '#A855F7' : '#7C3AED'}
                                        stroke="#C084FC"
                                        strokeWidth={isHov ? 1.5 : 1}
                                        opacity={isHov ? 1 : 0.75}
                                    />
                                    {isHov && (
                                        <text
                                            y={-10}
                                            textAnchor="middle"
                                            fill="#E2E8F0"
                                            fontSize={8}
                                            style={{ userSelect: 'none' }}
                                        >
                                            {marker.id}
                                        </text>
                                    )}
                                </g>
                            );
                        })}

                        {/* Hover tooltip for ring */}
                        {hoveredRing && (() => {
                            const pos = ringPositions.find((rp) => rp.ring.ring_id === hoveredRing.ring_id);
                            if (!pos) return null;
                            const tx = pos.x + (pos.x > CX ? -120 : 10);
                            const ty = Math.min(pos.y - 30, SVG_H - 80);
                            return (
                                <g>
                                    <rect x={tx} y={ty} width={120} height={60} rx={6}
                                        fill="#1E293B" stroke="#475569" strokeWidth={1} opacity={0.97} />
                                    <text x={tx + 6} y={ty + 14} fill="#F1F5F9" fontSize={9} fontWeight="bold">
                                        {hoveredRing.ring_id}
                                    </text>
                                    <text x={tx + 6} y={ty + 26} fill="#94A3B8" fontSize={8}>
                                        {hoveredRing.pattern_type} · {hoveredRing.risk_score.toFixed(1)} risk
                                    </text>
                                    <text x={tx + 6} y={ty + 38} fill="#94A3B8" fontSize={8}>
                                        {hoveredRing.member_accounts.length} accounts
                                    </text>
                                    <text x={tx + 6} y={ty + 50} fill="#94A3B8" fontSize={7.5}>
                                        {hoveredRing.detected_patterns.join(', ')}
                                    </text>
                                </g>
                            );
                        })()}
                    </svg>

                    {/* Legend */}
                    <div className="flex gap-4 mt-3 flex-wrap">
                        {Object.entries(RING_COLORS).map(([type, color]) => (
                            <div key={type} className="flex items-center gap-1.5 text-xs text-slate-400">
                                <div className="w-3 h-3 rounded-full border-2" style={{ borderColor: color, background: color + '33' }} />
                                {type}
                            </div>
                        ))}
                        <div className="flex items-center gap-1.5 text-xs text-slate-400">
                            <svg width="12" height="12"><polygon points="6,0 12,6 6,12 0,6" fill="#7C3AED" /></svg>
                            cross-ring account
                        </div>
                    </div>
                </div>

                {/* Ranked list */}
                {rankedCrossRing.length > 0 && (
                    <div className="w-full lg:w-56 flex-shrink-0">
                        <h4 className="text-sm font-bold text-slate-300 mb-3">Top Cross-Ring Accounts</h4>
                        <div className="space-y-1.5">
                            {rankedCrossRing.map(([id, count], idx) => (
                                <div
                                    key={id}
                                    className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors
                    ${hoveredAccount === id ? 'bg-purple-900/50 border border-purple-700' : 'bg-slate-800 border border-slate-700 hover:border-purple-700'}`}
                                    onMouseEnter={() => setHoveredAccount(id)}
                                    onMouseLeave={() => setHoveredAccount(null)}
                                >
                                    <span className="flex items-center gap-2">
                                        <span className="text-slate-500 font-mono w-4">{idx + 1}</span>
                                        <span className="text-slate-200 font-mono truncate max-w-[90px]">{id}</span>
                                    </span>
                                    <span className="text-purple-400 font-bold">{count} rings</span>
                                </div>
                            ))}
                        </div>
                        {crossRingAccounts.length === 0 && (
                            <p className="text-xs text-slate-600 italic">No cross-ring accounts in top {MAX_DISPLAY}</p>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}
