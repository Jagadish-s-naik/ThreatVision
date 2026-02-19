import React, { useMemo, useState } from 'react';

export default function RingOverlapVisualization({ fraudRings = [], suspiciousAccounts = [] }) {
    const [hoveredRing, setHoveredRing] = useState(null);

    // Step 1: limit to top 15 by risk_score
    const displayRings = useMemo(
        () =>
            [...fraudRings]
                .sort((a, b) => b.risk_score - a.risk_score)
                .slice(0, 15),
        [fraudRings]
    );

    // Step 2: find accounts that appear in 2+ of the displayRings
    const membershipCount = useMemo(() => {
        const mc = {};
        for (const ring of displayRings) {
            for (const acc of ring.member_accounts) {
                mc[acc] = (mc[acc] || 0) + 1;
            }
        }
        return mc;
    }, [displayRings]);

    const crossRingAccounts = useMemo(
        () => Object.keys(membershipCount).filter(acc => membershipCount[acc] >= 2),
        [membershipCount]
    );

    // Step 3: SVG orbital layout
    const SVG_W = 600, SVG_H = 450;
    const CX = SVG_W / 2, CY = SVG_H / 2;
    const ORBIT_R = 160;

    const ringPositions = useMemo(
        () =>
            displayRings.map((ring, i) => {
                const angle =
                    (2 * Math.PI * i) / displayRings.length - Math.PI / 2;
                return {
                    ring,
                    x: CX + ORBIT_R * Math.cos(angle),
                    y: CY + ORBIT_R * Math.sin(angle),
                    r: Math.max(16, Math.min(48, 10 + ring.member_accounts.length * 2)),
                };
            }),
        [displayRings]
    );

    if (displayRings.length === 0) {
        return (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-8 text-center text-slate-500">
                No fraud rings to visualize.
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
            <h3 className="text-lg font-bold text-slate-100 mb-1">
                🔗 Ring Overlap Visualization
            </h3>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                Bubble overlap showing fraud rings and shared accounts. Diamonds = cross-ring nodes.
            </p>

            {/* Step 4: render SVG */}
            <svg
                width={SVG_W}
                height={SVG_H}
                style={{ background: '#0a0a1a', borderRadius: 10, display: 'block', maxWidth: '100%' }}
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            >
                {/* Connection lines between rings that share members */}
                {ringPositions.map((posA, i) =>
                    ringPositions.slice(i + 1).map((posB, j) => {
                        const shared = posA.ring.member_accounts.filter(acc =>
                            posB.ring.member_accounts.includes(acc)
                        );
                        if (shared.length === 0) return null;
                        const isHov =
                            hoveredRing === posA.ring.ring_id ||
                            hoveredRing === posB.ring.ring_id;
                        return (
                            <line
                                key={`line-${i}-${j}`}
                                x1={posA.x} y1={posA.y}
                                x2={posB.x} y2={posB.y}
                                stroke={isHov ? '#ff9a44' : '#ff6b00'}
                                strokeWidth={isHov ? 2 : 1.5}
                                strokeDasharray="5,4"
                                opacity={isHov ? 0.8 : 0.5}
                            />
                        );
                    })
                )}

                {/* Ring circles */}
                {ringPositions.map(({ ring, x, y, r }) => {
                    const color =
                        ring.pattern_type === 'cycle' ? '#fbbf24'
                            : ring.pattern_type === 'smurfing' ? '#f97316'
                                : '#c084fc'; // shell
                    const isHov = hoveredRing === ring.ring_id;
                    return (
                        <g
                            key={ring.ring_id}
                            onMouseEnter={() => setHoveredRing(ring.ring_id)}
                            onMouseLeave={() => setHoveredRing(null)}
                            style={{ cursor: 'pointer' }}
                        >
                            <circle
                                cx={x} cy={y} r={r}
                                fill={color}
                                fillOpacity={isHov ? 0.3 : 0.15}
                                stroke={color}
                                strokeWidth={isHov ? 2.5 : 2}
                            />
                            <text
                                x={x} y={y}
                                textAnchor="middle"
                                dominantBaseline="middle"
                                fontSize={9}
                                fill={color}
                                fontWeight="bold"
                                style={{ userSelect: 'none' }}
                            >
                                {ring.ring_id}
                            </text>
                            <text
                                x={x} y={y + r + 10}
                                textAnchor="middle"
                                fontSize={8}
                                fill="#888"
                                style={{ userSelect: 'none' }}
                            >
                                {ring.pattern_type}
                            </text>
                        </g>
                    );
                })}

                {/* Diamond markers at midpoints for cross-ring accounts */}
                {crossRingAccounts.slice(0, 20).map(acc => {
                    const ringsWithAcc = ringPositions.filter(p =>
                        p.ring.member_accounts.includes(acc)
                    );
                    if (ringsWithAcc.length < 2) return null;
                    const midX = (ringsWithAcc[0].x + ringsWithAcc[1].x) / 2;
                    const midY = (ringsWithAcc[0].y + ringsWithAcc[1].y) / 2;
                    const s = 7;
                    return (
                        <polygon
                            key={`diamond-${acc}`}
                            points={`${midX},${midY - s} ${midX + s},${midY} ${midX},${midY + s} ${midX - s},${midY}`}
                            fill="#ff4dc4"
                            stroke="#fff"
                            strokeWidth={1}
                        >
                            <title>{acc}</title>
                        </polygon>
                    );
                })}
            </svg>

            {/* Note below SVG */}
            <p style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 8 }}>
                Showing top {displayRings.length} rings by risk score
                &nbsp;·&nbsp;{fraudRings.length} total rings detected
                &nbsp;·&nbsp;{crossRingAccounts.length} cross-ring accounts
            </p>

            {/* Legend */}
            <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                {[
                    { label: 'cycle', color: '#fbbf24' },
                    { label: 'smurfing', color: '#f97316' },
                    { label: 'shell', color: '#c084fc' },
                ].map(({ label, color }) => (
                    <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#aaa' }}>
                        <div style={{ width: 12, height: 12, borderRadius: '50%', border: `2px solid ${color}`, background: color + '33' }} />
                        {label}
                    </div>
                ))}
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#aaa' }}>
                    <svg width={12} height={12}>
                        <polygon points="6,0 12,6 6,12 0,6" fill="#ff4dc4" />
                    </svg>
                    cross-ring account
                </div>
            </div>

            {/* Cross-ring account list */}
            {crossRingAccounts.length > 0 && (
                <div style={{
                    marginTop: 12,
                    padding: '8px 12px',
                    background: '#1a1a2e',
                    borderRadius: 6,
                }}>
                    <p style={{ color: '#ff4dc4', fontSize: 12, fontWeight: 'bold', margin: 0 }}>
                        Cross-Ring Accounts ({crossRingAccounts.length})
                    </p>
                    <p style={{ color: '#aaa', fontSize: 11, marginTop: 4, marginBottom: 0, wordBreak: 'break-all' }}>
                        {crossRingAccounts.join(', ')}
                    </p>
                </div>
            )}
        </div>
    );
}
