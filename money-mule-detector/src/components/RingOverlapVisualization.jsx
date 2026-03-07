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
            <div style={{
                background: 'rgba(255, 255, 255, 0.02)',
                border: '1px border rgba(255, 255, 255, 0.05)',
                borderRadius: '16px'
            }} className="p-8 text-center text-slate-500 font-mono">
                NO_OVERLAP_DATA
            </div>
        );
    }

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05)'
        }} className="p-6 flex flex-col md:flex-row gap-6 w-full relative z-10">
            <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                    <h3 className="text-lg font-bold text-white tracking-wide">Ring Overlap</h3>
                    <div className="px-2 py-0.5 rounded text-[10px] font-bold tracking-wider bg-[#00e5ff]/10 text-[#00e5ff] border border-[#00e5ff]/20">
                        NETWORK ANALYSIS
                    </div>
                </div>
                <p className="text-slate-400 text-xs mb-6">Visualizing shared nodes and connections between fraud rings.</p>

                <svg
                    width="100%"
                    height="100%"
                    viewBox="0 0 600 450"
                    style={{ 
                        background: 'rgba(0, 0, 0, 0.2)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        borderRadius: '12px', 
                        display: 'block', 
                        maxWidth: '100%', 
                        maxHeight: '450px',
                        boxShadow: 'inset 0 0 20px rgba(0,0,0,0.5)' 
                    }}
                >
                    {/* Connection lines */}
                    {connections.map((c, idx) => {
                        const isHov = hoveredRing === c.ringA || hoveredRing === c.ringB;
                        return (
                            <g key={`conn-${idx}`}>
                                <line
                                    x1={c.x1} y1={c.y1}
                                    x2={c.x2} y2={c.y2}
                                    stroke={isHov ? '#00e5ff' : 'rgba(255, 255, 255, 0.15)'}
                                    strokeWidth={isHov ? 2 : 1}
                                    strokeDasharray={isHov ? "none" : "4,4"}
                                    opacity={isHov ? 1 : 0.5}
                                    style={isHov ? { filter: 'drop-shadow(0 0 6px rgba(0,229,255,0.8))' } : {}}
                                />
                                {/* Label for shared count */}
                                {isHov && (
                                    <rect x={(c.x1 + c.x2) / 2 - 12} y={(c.y1 + c.y2) / 2 - 10} width="24" height="20" rx="4" fill="rgba(0, 229, 255, 0.15)" stroke="#00e5ff" strokeWidth="1" />
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
                            : ring.pattern_type === 'smurfing' ? '#ff6b1a' // Orange
                                : '#a855f7'; // Purple

                        const isHov = hoveredRing === ring.ring_id;
                        const isSel = selectedRing?.ring_id === ring.ring_id;

                        // Create vivid glowing filter for hovered/selected nodes
                        const glowStyle = isHov || isSel ? { filter: `drop-shadow(0 0 10px ${typeColor}) drop-shadow(0 0 20px ${typeColor})` } : {};

                        return (
                            <g
                                key={ring.ring_id}
                                onMouseEnter={() => setHoveredRing(ring.ring_id)}
                                onMouseLeave={() => setHoveredRing(null)}
                                onClick={() => setSelectedRing(ring)}
                                style={{ cursor: 'pointer', transition: 'all 0.3s ease' }}
                            >
                                {/* Main Node Glow */}
                                <circle
                                    cx={x} cy={y} r={r}
                                    fill={isHov || isSel ? `${typeColor}40` : 'rgba(255, 255, 255, 0.03)'}
                                    stroke={isHov || isSel ? typeColor : 'rgba(255, 255, 255, 0.15)'}
                                    strokeWidth={isHov || isSel ? 2 : 1}
                                    style={glowStyle}
                                />

                                {/* Sub-ring (inner decorative circle) */}
                                {(isHov || isSel) && (
                                    <circle
                                        cx={x} cy={y} r={r - 6}
                                        fill="none"
                                        stroke={typeColor}
                                        strokeWidth="1"
                                        strokeDasharray="2,2"
                                        opacity="0.5"
                                    />
                                )}

                                {/* Ring ID Label */}
                                <text
                                    x={x} y={y - 4}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={isHov || isSel ? 11 : 10}
                                    fill={isHov || isSel ? '#fff' : 'rgba(255, 255, 255, 0.7)'}
                                    fontWeight="bold"
                                    fontFamily="monospace"
                                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                                >
                                    {ring.ring_id}
                                </text>
                                <text
                                    x={x} y={y + 10}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={isHov || isSel ? 9 : 8}
                                    fill={isHov || isSel ? typeColor : 'rgba(255, 255, 255, 0.4)'}
                                    fontWeight="600"
                                    fontFamily="monospace"
                                    style={{ userSelect: 'none', pointerEvents: 'none', letterSpacing: '0.05em' }}
                                >
                                    {ring.member_accounts.length} mbrs
                                </text>
                            </g>
                        );
                    })}
                </svg>
                <div className="text-center mt-3 text-[10px] text-slate-500 font-mono">
                    SHOWING TOP {show.length} RINGS BY RISK SCORE
                </div>
            </div>

            {/* Info Panel for Selected Ring */}
            {selectedRing && (
                <div style={{
                    background: 'rgba(10, 14, 26, 0.6)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)'
                }} className="w-full md:w-72 p-5 animate-fadeIn self-start">
                    <div className="flex justify-between items-center mb-4 border-b border-[rgba(255,255,255,0.05)] pb-3">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-[#00e5ff] shadow-[0_0_8px_#00e5ff]"></div>
                            <h4 className="text-white font-bold">{selectedRing.ring_id}</h4>
                        </div>
                        <button onClick={() => setSelectedRing(null)} className="text-slate-400 hover:text-white transition-colors">✕</button>
                    </div>
                    <div className="space-y-4 text-xs font-mono">
                        <div>
                            <span className="text-slate-500 block text-[10px] mb-1">RISK SCORE</span>
                            <span className="text-2xl font-bold bg-gradient-to-r from-rose-400 to-red-500 bg-clip-text text-transparent">
                                {selectedRing.risk_score}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 block text-[10px] mb-1">PATTERN TYPE</span>
                            <span className="text-slate-200 uppercase bg-[rgba(255,255,255,0.05)] px-2 py-1 rounded border border-[rgba(255,255,255,0.05)]">
                                {selectedRing.pattern_type}
                            </span>
                        </div>
                        <div>
                            <span className="text-slate-500 block mb-2 text-[10px]">MEMBERS ({selectedRing.member_accounts.length})</span>
                            <div className="flex flex-wrap gap-1.5">
                                {selectedRing.member_accounts.map(acc => (
                                    <span key={acc} className="bg-[rgba(255,255,255,0.03)] px-1.5 py-0.5 rounded border border-[rgba(255,255,255,0.08)] text-slate-300">
                                        {acc}
                                    </span>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
