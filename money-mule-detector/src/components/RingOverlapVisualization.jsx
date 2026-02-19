import React, { useMemo, useState } from 'react';

export default function RingOverlapVisualization({ fraudRings = [], suspiciousAccounts = [] }) {
    const [hoveredRing, setHoveredRing] = useState(null);
    const [selectedRing, setSelectedRing] = useState(null); // Track selected ring for details

    // Limit to top 15 rings by risk_score
    const show = useMemo(
        () => [...fraudRings]
            .sort((a, b) => b.risk_score - a.risk_score)
            .slice(0, 15),
        [fraudRings]
    );

    // Calculate orbital positions — spread evenly around center
    const CX = 300, CY = 225, OR = 160; // Slightly larger orbit

    const pos = useMemo(
        () => show.map((ring, i) => {
            const a = (2 * Math.PI * i / show.length) - Math.PI / 2;
            return {
                ring,
                x: CX + OR * Math.cos(a),
                y: CY + OR * Math.sin(a),
                r: Math.max(22, Math.min(55, 12 + ring.member_accounts.length * 2)), // Larger nodes
            };
        }),
        [show]
    );

    // Draw connecting lines only between rings sharing ≥1 member
    const connections = useMemo(() => {
        const conns = [];
        for (let i = 0; i < pos.length; i++) {
            for (let j = i + 1; j < pos.length; j++) {
                const shared = pos[i].ring.member_accounts.filter(
                    id => pos[j].ring.member_accounts.includes(id)
                );
                if (shared.length > 0) {
                    conns.push({
                        x1: pos[i].x, y1: pos[i].y,
                        x2: pos[j].x, y2: pos[j].y,
                        count: shared.length,
                        ringA: pos[i].ring.ring_id,
                        ringB: pos[j].ring.ring_id
                    });
                }
            }
        }
        return conns;
    }, [pos]);

    if (show.length === 0) {
        return (
            <div className="bg-slate-900 border-2 border-slate-800 p-8 text-center text-slate-500 font-mono">
                NO_OVERLAP_DATA
            </div>
        );
    }

    return (
        <div className="bg-slate-900 border-2 border-slate-800 p-6 brutal-shadow flex flex-col md:flex-row gap-6">
            <div className="flex-1">
                <h3 className="text-xl font-extrabold text-slate-100 mb-1 uppercase tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                    Ring Overlap
                </h3>
                <p className="text-slate-500 text-xs font-mono mb-6">
                    // ANALYZING_SHARED_ACCOUNTS_BETWEEN_RINGS
                </p>

                <svg
                    width={600}
                    height={450}
                    style={{ background: '#020617', border: '2px solid #1e293b', display: 'block', maxWidth: '100%', boxShadow: '4px 4px 0px 0px #000' }}
                    viewBox="0 0 600 450"
                >
                    {/* Connection lines */}
                    {connections.map((c, idx) => {
                        const isHov = hoveredRing === c.ringA || hoveredRing === c.ringB;
                        return (
                            <g key={`conn-${idx}`}>
                                <line
                                    x1={c.x1} y1={c.y1}
                                    x2={c.x2} y2={c.y2}
                                    stroke={isHov ? '#ef4444' : '#475569'}
                                    strokeWidth={isHov ? 3 : 1.5}
                                    strokeDasharray="4,4"
                                    opacity={isHov ? 1 : 0.3}
                                />
                                {/* Label for shared count */}
                                {isHov && (
                                    <rect x={(c.x1 + c.x2) / 2 - 10} y={(c.y1 + c.y2) / 2 - 8} width="20" height="16" fill="#000" />
                                )}
                                {isHov && (
                                    <text x={(c.x1 + c.x2) / 2} y={(c.y1 + c.y2) / 2 + 4} textAnchor="middle" fill="#fff" fontSize="10" fontWeight="bold">
                                        {c.count}
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* Ring circles */}
                    {pos.map(({ ring, x, y, r }) => {
                        const typeColor = ring.pattern_type === 'cycle' ? '#fbbf24' // Amber
                            : ring.pattern_type === 'smurfing' ? '#f97316' // Orange
                                : '#c084fc'; // Purple

                        const isHov = hoveredRing === ring.ring_id;
                        const isSel = selectedRing?.ring_id === ring.ring_id;

                        return (
                            <g
                                key={ring.ring_id}
                                onMouseEnter={() => setHoveredRing(ring.ring_id)}
                                onMouseLeave={() => setHoveredRing(null)}
                                onClick={() => setSelectedRing(ring)}
                                style={{ cursor: 'pointer' }}
                            >
                                {/* Hard Shadow (Ghost Node) */}
                                <circle
                                    cx={x + 4} cy={y + 4} r={r}
                                    fill="#000"
                                    opacity="0.5"
                                />

                                {/* Main Node */}
                                <circle
                                    cx={x} cy={y} r={r}
                                    fill={isHov || isSel ? typeColor : '#1e293b'}
                                    stroke={typeColor}
                                    strokeWidth={isHov || isSel ? 4 : 2}
                                />

                                {/* Ring ID Label */}
                                <text
                                    x={x} y={y - 4}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={10}
                                    fill={isHov || isSel ? '#000' : '#fff'}
                                    fontWeight="bold"
                                    fontFamily="IBM Plex Mono, monospace"
                                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                                >
                                    {ring.ring_id}
                                </text>
                                <text
                                    x={x} y={y + 8}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={8}
                                    fill={isHov || isSel ? '#000' : '#94a3b8'}
                                    fontWeight="bold"
                                    fontFamily="IBM Plex Mono, monospace"
                                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                                >
                                    {ring.member_accounts.length} mbrs
                                </text>
                            </g>
                        );
                    })}
                </svg>
                <p style={{ textAlign: 'center', fontSize: 10, color: '#64748b', marginTop: 12, fontFamily: 'IBM Plex Mono' }}>
                    // SHOWING TOP {show.length} RINGS BY RISK SCORE
                </p>
            </div>

            {/* Info Panel for Selected Ring */}
            {selectedRing && (
                <div className="w-full md:w-64 bg-slate-950 border-2 border-slate-700 p-4 brutal-shadow-sm animate-fadeIn">
                    <div className="flex justify-between items-center mb-4 border-b border-slate-800 pb-2">
                        <h4 className="text-amber-400 font-bold">{selectedRing.ring_id}</h4>
                        <button onClick={() => setSelectedRing(null)} className="text-slate-500 hover:text-white">✕</button>
                    </div>
                    <div className="space-y-3 text-xs font-mono">
                        <div>
                            <span className="text-slate-500 block">RISK SCORE</span>
                            <span className="text-xl font-bold text-white">{selectedRing.risk_score}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block">TYPE</span>
                            <span className="text-slate-300 uppercase">{selectedRing.pattern_type}</span>
                        </div>
                        <div>
                            <span className="text-slate-500 block mb-1">MEMBERS ({selectedRing.member_accounts.length})</span>
                            <div className="flex flex-wrap gap-1">
                                {selectedRing.member_accounts.map(acc => (
                                    <span key={acc} className="bg-slate-800 px-1 py-0.5 border border-slate-700 text-slate-300">{acc}</span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
