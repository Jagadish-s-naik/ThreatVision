import React, { useMemo, useState } from 'react';
import { Layers, Activity, Users, Link } from 'lucide-react';

export default function RingOverlapVisualization({ fraudRings = [], suspiciousAccounts = [] }) {
    const [hoveredRing, setHoveredRing] = useState(null);
    const [selectedRing, setSelectedRing] = useState(null); // Track selected ring for details

    const show = useMemo(
        () => [...fraudRings]
            .sort((a, b) => b.risk_score - a.risk_score)
            .slice(0, 15)
            .map(ring => {
                const members = ring.member_accounts.map(accId => 
                    suspiciousAccounts.find(sa => sa.account_id === accId) || { account_id: accId, suspicion_score: 0 }
                ).sort((a,b) => b.suspicion_score - a.suspicion_score);

                const topAccount = members.length > 0 ? members[0].account_id : 'Unknown';
                const shortAcc = topAccount.length > 8 ? topAccount.substring(0,8) + '...' : topAccount;
                const prefix = ring.pattern_type.substring(0, 3).toUpperCase();
                
                return {
                    ...ring,
                    displayName: `${prefix} : ${shortAcc}`
                };
            }),
        [fraudRings, suspiciousAccounts]
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
                r: Math.max(32, Math.min(75, 18 + ring.member_accounts.length * 3.5)), // Larger nodes
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
                        ringB: pos[j].ring.ring_id,
                        ringAName: pos[i].ring.displayName,
                        ringBName: pos[j].ring.displayName
                    });
                }
            }
        }
        return conns;
    }, [pos]);

    const overlapStats = useMemo(() => {
        let maxShared = 0;
        let maxPair = null;

        connections.forEach(c => {
            if (c.count > maxShared) {
                maxShared = c.count;
                maxPair = [c.ringAName, c.ringBName];
            }
        });

        const accountRingMap = {};
        show.forEach(ring => {
            ring.member_accounts.forEach(acc => {
                if (!accountRingMap[acc]) accountRingMap[acc] = 0;
                accountRingMap[acc]++;
            });
        });
        
        const superConnectors = Object.entries(accountRingMap)
            .filter(([accountId, count]) => count > 1 && accountId)
            .sort((a, b) => b[1] - a[1]);

        return {
            totalConnections: connections.length,
            totalSharedAccounts: superConnectors.length,
            maxShared,
            maxPair,
            topConnector: superConnectors.length > 0 ? superConnectors[0] : null
        };
    }, [connections, show]);

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
            background: 'linear-gradient(180deg, rgba(15, 21, 32, 0.8) 0%, rgba(10, 14, 26, 0.9) 100%)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderTop: '1px solid rgba(0, 229, 255, 0.3)',
            borderRadius: '16px',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4), inset 0 1px 0 rgba(255, 255, 255, 0.05), 0 0 20px rgba(0, 229, 255, 0.05)'
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
                        background: 'radial-gradient(circle at 50% 50%, rgba(0, 229, 255, 0.03) 0%, transparent 70%), rgba(10, 14, 26, 0.4)', 
                        border: '1px solid rgba(255, 255, 255, 0.05)', 
                        borderRadius: '12px', 
                        display: 'block', 
                        maxWidth: '100%', 
                        maxHeight: '450px',
                        boxShadow: 'inset 0 0 30px rgba(0,0,0,0.6)' 
                    }}
                >
                    <style>
                        {`
                            @keyframes dataFlow {
                                from { stroke-dashoffset: 16; }
                                to { stroke-dashoffset: 0; }
                            }
                            @keyframes slowSpin {
                                from { transform: rotate(0deg); transform-origin: 300px 225px; }
                                to { transform: rotate(360deg); transform-origin: 300px 225px; }
                            }
                            @keyframes pulseNode {
                                0% { transform: scale(1); opacity: 0.4; }
                                50% { transform: scale(1.2); opacity: 0.8; }
                                100% { transform: scale(1); opacity: 0.4; }
                            }
                        `}
                    </style>

                    {/* Orbital Background Grid */}
                    <g className="opacity-20 pointer-events-none" style={{ animation: 'slowSpin 60s linear infinite' }}>
                        {[80, 160, 240].map(radius => (
                            <circle key={radius} cx={CX} cy={CY} r={radius} fill="none" stroke="#00e5ff" strokeWidth="1" strokeDasharray="4 8" />
                        ))}
                    </g>
                    {/* Crosshairs */}
                    <path d={`M ${CX} 0 L ${CX} 450 M 0 ${CY} L 600 ${CY}`} stroke="rgba(0, 229, 255, 0.05)" strokeWidth="1" className="pointer-events-none" />

                    {/* Connection lines */}
                    {connections.map((c, idx) => {
                        const isHov = hoveredRing === c.ringA || hoveredRing === c.ringB;
                        return (
                            <g key={`conn-${idx}`}>
                                <line
                                    x1={c.x1} y1={c.y1}
                                    x2={c.x2} y2={c.y2}
                                    stroke={isHov ? '#00e5ff' : 'rgba(255, 255, 255, 0.15)'}
                                    strokeWidth={isHov ? 2 : Math.max(1, c.count * 0.5)}
                                    strokeDasharray={isHov ? "none" : "8,8"}
                                    opacity={isHov ? 1 : 0.6}
                                    style={{
                                        filter: isHov ? 'drop-shadow(0 0 6px rgba(0,229,255,0.8))' : 'none',
                                        animation: isHov ? 'none' : 'dataFlow 1s linear infinite'
                                    }}
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

                                {/* Danger Pulse for High Risk Nodes */}
                                {ring.risk_score >= 80 && !isHov && !isSel && (
                                    <circle
                                        cx={x} cy={y} r={r + 4}
                                        fill="none"
                                        stroke={typeColor}
                                        strokeWidth="2"
                                        style={{ transformOrigin: `${x}px ${y}px`, animation: 'pulseNode 2s ease-in-out infinite' }}
                                    />
                                )}

                                {/* Sub-ring (inner decorative circle) */}
                                {(isHov || isSel) && (
                                    <circle
                                        cx={x} cy={y} r={r - 6}
                                        fill="none"
                                        stroke={typeColor}
                                        strokeWidth="1.5"
                                        strokeDasharray="2,2"
                                        opacity="0.8"
                                    />
                                )}

                                {/* Ring ID Label */}
                                <text
                                    x={x} y={y - 10}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={isHov || isSel ? 11 : 10}
                                    fill={isHov || isSel ? '#fff' : 'rgba(255, 255, 255, 0.8)'}
                                    fontWeight="bold"
                                    fontFamily="monospace"
                                    style={{ userSelect: 'none', pointerEvents: 'none' }}
                                >
                                    {ring.displayName}
                                </text>
                                <text
                                    x={x} y={y + 6}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={isHov || isSel ? 11 : 10}
                                    fill={isHov || isSel ? typeColor : 'rgba(255, 255, 255, 0.6)'}
                                    fontWeight="600"
                                    fontFamily="monospace"
                                    style={{ userSelect: 'none', pointerEvents: 'none', letterSpacing: '0.05em' }}
                                >
                                    Risk: {ring.risk_score}
                                </text>
                                <text
                                    x={x} y={y + 20}
                                    textAnchor="middle"
                                    dominantBaseline="middle"
                                    fontSize={isHov || isSel ? 10 : 9}
                                    fill={isHov || isSel ? 'rgba(255, 255, 255, 0.7)' : 'rgba(255, 255, 255, 0.3)'}
                                    fontWeight="500"
                                    fontFamily="monospace"
                                    style={{ userSelect: 'none', pointerEvents: 'none', letterSpacing: '0.02em' }}
                                >
                                    ({ring.member_accounts.length} mbrs)
                                </text>
                            </g>
                        );
                    })}
                </svg>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6">
                    <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Layers className="w-4 h-4 text-[#00e5ff]" />
                            <span className="text-[10px] font-bold tracking-wider uppercase">Active Overlaps</span>
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{overlapStats.totalConnections} <span className="text-sm font-normal text-slate-500">Pairs</span></div>
                    </div>
                    
                    <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Users className="w-4 h-4 text-[#a855f7]" />
                            <span className="text-[10px] font-bold tracking-wider uppercase">Shared Entities</span>
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{overlapStats.totalSharedAccounts} <span className="text-sm font-normal text-slate-500">Accounts</span></div>
                    </div>

                    <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Link className="w-4 h-4 text-[#ff4d6d]" />
                            <span className="text-[10px] font-bold tracking-wider uppercase">Deepest Overlap</span>
                        </div>
                        <div className="text-2xl font-bold text-white tracking-tight">{overlapStats.maxShared} <span className="text-sm font-normal text-slate-500">Nodes</span></div>
                        <div className="text-[9px] text-slate-500 mt-1">{overlapStats.maxPair ? `${overlapStats.maxPair[0]} & ${overlapStats.maxPair[1]}` : 'N/A'}</div>
                    </div>

                    <div className="bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.05)] rounded-xl p-4 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-2 text-slate-400">
                            <Activity className="w-4 h-4 text-[#f97316]" />
                            <span className="text-[10px] font-bold tracking-wider uppercase">Top Connector</span>
                        </div>
                        <div className="text-sm font-bold text-white tracking-tight truncate" title={overlapStats.topConnector ? overlapStats.topConnector[0] : 'N/A'}>
                            {overlapStats.topConnector ? overlapStats.topConnector[0] : 'None'}
                        </div>
                        <div className="text-[9px] text-slate-500 mt-1">{overlapStats.topConnector ? `Associated with ${overlapStats.topConnector[1]} rings` : 'N/A'}</div>
                    </div>
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
                            <h4 className="text-white font-bold">{selectedRing.displayName}</h4>
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
