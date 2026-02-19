import React, { useMemo, useState } from 'react';

export default function RingOverlapVisualization({ fraudRings = [], suspiciousAccounts = [] }) {
    const [hoveredRing, setHoveredRing] = useState(null);

    // Limit to top 15 rings by risk_score
    const displayRings = useMemo(
        () => [...fraudRings]
            .sort((a, b) => b.risk_score - a.risk_score)
            .slice(0, 15),
        [fraudRings]
    );

    // Calculate orbital positions — spread evenly around center
    const SVG_W = 600, SVG_H = 450;
    const CX = 300, CY = 225, ORBIT = 155;

    const ringPositions = useMemo(
        () => displayRings.map((ring, i) => {
            const angle = (2 * Math.PI * i / displayRings.length) - Math.PI / 2;
            return {
                ring,
                x: CX + ORBIT * Math.cos(angle),
                y: CY + ORBIT * Math.sin(angle),
                r: Math.max(18, Math.min(50, 10 + ring.member_accounts.length * 2)),
            };
        }),
        [displayRings]
    );

    // Draw connecting lines only between rings sharing ≥1 member
    const connections = useMemo(() => {
        const conns = [];
        for (let i = 0; i < ringPositions.length; i++) {
            for (let j = i + 1; j < ringPositions.length; j++) {
                const shared = ringPositions[i].ring.member_accounts.filter(
                    id => ringPositions[j].ring.member_accounts.includes(id)
                );
                if (shared.length > 0) {
                    conns.push({
                        x1: ringPositions[i].x, y1: ringPositions[i].y,
                        x2: ringPositions[j].x, y2: ringPositions[j].y,
                        count: shared.length,
                        ringA: ringPositions[i].ring.ring_id,
                        ringB: ringPositions[j].ring.ring_id
                    });
                }
            }
        }
        return conns;
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
            <h3 className="text-lg font-bold text-slate-100 mb-1">
                🔗 Ring Overlap Visualization
            </h3>
            <p style={{ fontSize: 12, color: '#888', marginBottom: 12 }}>
                Top 15 rings shown in orbit. Dashed lines = shared accounts.
            </p>

            <svg
                width={SVG_W}
                height={SVG_H}
                style={{ background: '#0a0a1a', borderRadius: 10, display: 'block', maxWidth: '100%' }}
                viewBox={`0 0 ${SVG_W} ${SVG_H}`}
            >
                {/* Connection lines */}
                {connections.map((c, idx) => {
                    const isHov = hoveredRing === c.ringA || hoveredRing === c.ringB;
                    return (
                        <g key={`conn-${idx}`}>
                            <line
                                x1={c.x1} y1={c.y1}
                                x2={c.x2} y2={c.y2}
                                stroke={isHov ? '#ff9a44' : '#ff6b00'}
                                strokeWidth={isHov ? 2 : 1.5}
                                strokeDasharray="5,4"
                                opacity={isHov ? 0.8 : 0.4}
                            />
                            {/* Diamond at midpoint */}
                            <polygon
                                points={`${(c.x1 + c.x2) / 2},${(c.y1 + c.y2) / 2 - 5} ${(c.x1 + c.x2) / 2 + 5},${(c.y1 + c.y2) / 2} ${(c.x1 + c.x2) / 2},${(c.y1 + c.y2) / 2 + 5} ${(c.x1 + c.x2) / 2 - 5},${(c.y1 + c.y2) / 2}`}
                                fill="#ff4dc4"
                            />
                        </g>
                    );
                })}

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
                                fontSize={10}
                                fill={color}
                                fontWeight="bold"
                                style={{ userSelect: 'none', pointerEvents: 'none' }}
                            >
                                {ring.ring_id}
                            </text>
                        </g>
                    );
                })}
            </svg>

            <p style={{ textAlign: 'center', fontSize: 11, color: '#666', marginTop: 8 }}>
                Showing top {displayRings.length} of {fraudRings.length} rings
            </p>
        </div>
    );
}
