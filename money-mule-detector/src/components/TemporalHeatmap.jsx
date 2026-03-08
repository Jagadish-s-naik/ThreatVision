import React, { useState, useMemo } from 'react';
import ReactDOM from 'react-dom';

const CELL_W = 20;
const CELL_H = 18;

const RED_SCALE = [
    { min: 0, max: 0, bg: '#1E293B' },
    { min: 1, max: 2, bg: '#FEF3C7' },
    { min: 3, max: 5, bg: '#FCD34D' },
    { min: 6, max: 10, bg: '#F97316' },
    { min: 11, max: 20, bg: '#EF4444' },
    { min: 21, max: Infinity, bg: '#991B1B' },
];

const BLUE_SCALE = [
    { min: 0, max: 0, bg: '#1E293B' },
    { min: 1, max: 2, bg: '#DBEAFE' },
    { min: 3, max: 5, bg: '#93C5FD' },
    { min: 6, max: 10, bg: '#3B82F6' },
    { min: 11, max: 20, bg: '#1D4ED8' },
    { min: 21, max: Infinity, bg: '#1E3A8A' },
];

function formatDateLabel(dateStr) {
    const [year, month, day] = dateStr.split('-').map(Number);
    const d = new Date(year, month - 1, day);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function formatHourLabel(h) {
    if (h === 0) return '12AM';
    if (h === 6) return '6AM';
    if (h === 12) return '12PM';
    if (h === 18) return '6PM';
    return '';
}

export default function TemporalHeatmap({ transactions, suspiciousAccountIds }) {
    const [showNormal, setShowNormal] = useState(false);
    const [tooltip, setTooltip] = useState(null);

    const { suspGrid, normGrid, dates, peakCell, maxCount } = useMemo(() => {
        if (!transactions || transactions.length === 0) return { suspGrid: {}, normGrid: {}, dates: [], peakCell: null, peakDay: null, maxCount: 0 };

        const suspGrid = {};
        const normGrid = {};
        const dateSet = new Set();
        let maxVal = 0;

        for (const tx of transactions) {
            const ts = tx.timestamp instanceof Date ? tx.timestamp : new Date(tx.timestamp);
            if (isNaN(ts.getTime())) continue;

            const year = ts.getFullYear();
            const month = String(ts.getMonth() + 1).padStart(2, '0');
            const day = String(ts.getDate()).padStart(2, '0');
            const hour = ts.getHours();
            const dateKey = `${year}-${month}-${day}`;
            dateSet.add(dateKey);

            const isSusp =
                suspiciousAccountIds && (
                    suspiciousAccountIds.has(String(tx.sender_id).trim()) ||
                    suspiciousAccountIds.has(String(tx.receiver_id).trim())
                );

            const grid = isSusp ? suspGrid : normGrid;
            if (!grid[dateKey]) grid[dateKey] = {};
            grid[dateKey][hour] = (grid[dateKey][hour] || 0) + 1;

            if (isSusp && grid[dateKey][hour] > maxVal) maxVal = grid[dateKey][hour];
        }

        const dates = [...dateSet].sort();

        // Peak cell: highest count in suspGrid
        let peakCell = null, peakCellCount = 0;

        for (const [date, hours] of Object.entries(suspGrid)) {
            let dayTotal = 0;
            for (const [hour, count] of Object.entries(hours)) {
                dayTotal += count;
                if (count > peakCellCount) {
                    peakCellCount = count;
                    peakCell = { date, hour: parseInt(hour), count };
                }
            }
        }

        return { suspGrid, normGrid, dates, peakCell, maxCount: maxVal };
    }, [transactions, suspiciousAccountIds]);

    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Neo-Brutal Styling & Gradient Logic -> Now Glow Styling
    const getIntensityStyle = (count, isNormal) => {
        if (count === 0) {
            return {
                background: 'rgba(255, 255, 255, 0.04)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '3px'
            };
        }

        const intensity = Math.min(1, Math.max(0.2, count / (maxCount || 10)));

        if (isNormal) {
            return {
                background: `rgba(37, 99, 235, ${intensity})`,
                borderRadius: '3px'
            };
        } else {
            if (intensity > 0.8 || count >= maxCount * 0.8) {
                return {
                    background: '#ff3d00',
                    boxShadow: '0 0 6px rgba(255, 61, 0, 1), 0 0 14px rgba(255, 61, 0, 0.7), 0 0 28px rgba(255, 61, 0, 0.35)',
                    borderRadius: '3px'
                };
            } else if (intensity > 0.4 || count > 1) {
                return {
                    background: '#ff6b1a',
                    boxShadow: '0 0 6px rgba(255, 107, 26, 0.9), 0 0 12px rgba(255, 107, 26, 0.5)',
                    borderRadius: '3px'
                };
            } else {
                return {
                    background: 'rgba(255, 107, 26, 0.5)',
                    boxShadow: '0 0 4px rgba(255, 107, 26, 0.4)',
                    borderRadius: '3px'
                };
            }
        }
    };

    function handleCellMouseMove(event, cellData) {
        if (typeof window === 'undefined') return;
        const MARGIN = 12;
        const OFFSET = 14;
        const W = 180; // Tooltip width estimate
        const H = 80;  // Tooltip height estimate
        const vw = window.innerWidth;
        const vh = window.innerHeight;
        const cx = event.clientX;
        const cy = event.clientY;

        let x = cx - W - OFFSET;
        if (x < MARGIN) x = cx + OFFSET;
        if (x + W > vw - MARGIN) x = vw - W - MARGIN;
        x = Math.max(MARGIN, x);

        let y = cy - H - OFFSET;
        if (y < MARGIN) y = cy + OFFSET;
        if (y + H > vh - MARGIN) y = vh - H - MARGIN;
        y = Math.max(MARGIN, y);

        setTooltip({ x, y, ...cellData });
    }

    return (
        <div style={{
            background: 'rgba(255, 255, 255, 0.025)',
            backdropFilter: 'blur(16px)',
            WebkitBackdropFilter: 'blur(16px)',
            border: '1px solid rgba(0, 229, 255, 0.25)',
            borderTop: '1px solid rgba(0, 229, 255, 0.5)',
            borderRadius: '16px',
            padding: '24px 28px',
            width: 'fit-content',
            minWidth: '600px',
            maxWidth: '900px',
            marginLeft: 'auto',
            marginRight: 'auto',
            boxShadow: '0 0 20px rgba(0, 229, 255, 0.12), 0 0 60px rgba(0, 229, 255, 0.06), 0 0 120px rgba(0, 229, 255, 0.03), inset 0 0 30px rgba(0, 229, 255, 0.02), 0 8px 40px rgba(0, 0, 0, 0.5)',
            position: 'relative'
        }} className="z-50">
            {/* Inner glow to reinforce the lamp-to-card light flow */}
            <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '60px',
                background: 'linear-gradient(to bottom, rgba(0, 229, 255, 0.06) 0%, transparent 60px)',
                borderRadius: '16px 16px 0 0',
                pointerEvents: 'none'
            }}></div>

            <style>
                {`
                    @keyframes pulseBlueDot {
                        0%, 100% { opacity: 1; transform: scale(1); }
                        50% { opacity: 0.6; transform: scale(0.85); }
                    }
                `}
            </style>

            <div className="flex items-start justify-end mb-6 relative z-10">
                <button
                    onClick={() => setShowNormal(!showNormal)}
                    className="flex items-center gap-[6px] rounded-[20px] border border-[rgba(0,229,255,0.3)] bg-[rgba(0,229,255,0.1)] px-[14px] py-[6px] text-[11px] font-semibold text-[#00e5ff] transition-all hover:bg-[rgba(0,229,255,0.18)] hover:shadow-[0_0_12px_rgba(0,229,255,0.2)]"
                >
                    <div style={{ 
                        width: '8px', 
                        height: '8px', 
                        background: '#00e5ff', 
                        borderRadius: '50%', 
                        boxShadow: '0 0 8px rgba(0,229,255,1), 0 0 16px rgba(0,229,255,0.5)',
                        animation: 'pulseBlueDot 2s ease-in-out infinite' 
                    }}></div>
                    {showNormal ? 'SHOW SUSPICIOUS ONLY' : 'SHOW ALL TRAFFIC'}
                </button>
            </div>

            {dates.length === 0 ? (
                <div className="text-slate-400 text-center py-12 font-mono border-2 border-dashed border-slate-800">NO_DATA_DETECTED</div>
            ) : (
                <>
                    {/* Heatmap grid */}
                    <div className="overflow-x-auto pb-4" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: '100%' }}>
                        <div style={{ minWidth: 24 * (CELL_W + 2) + 80, marginLeft: 'auto', marginRight: 'auto' }}>
                            {/* X-axis */}
                            <div className="flex mb-2" style={{ marginLeft: 80 }}>
                                {hours.map((h) => (
                                    <div
                                        key={h}
                                        style={{ width: CELL_W + 2, color: 'rgba(0, 229, 255, 0.6)', fontSize: '10px', fontFamily: 'monospace', letterSpacing: '0.05em', textAlign: 'center' }}
                                    >
                                        {formatHourLabel(h)}
                                    </div>
                                ))}
                            </div>

                            {/* Rows */}
                            <div className="flex flex-col gap-1">
                                {dates.map((date) => (
                                    <div key={date} className="flex items-center">
                                        {/* Y-axis label */}
                                        <div
                                            style={{ width: 80, color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', fontFamily: 'monospace', minWidth: '44px', textAlign: 'right', paddingRight: '12px', flexShrink: 0 }}
                                        >
                                            {formatDateLabel(date)}
                                        </div>
                                        {/* Cells */}
                                        <div className="flex gap-[1px]">
                                            {hours.map((h) => {
                                                const suspCount = (suspGrid[date] && suspGrid[date][h]) || 0;
                                                const normCount = (normGrid[date] && normGrid[date][h]) || 0;
                                                const displayCount = showNormal ? normCount : suspCount;
                                                const cellStyle = getIntensityStyle(displayCount, showNormal);

                                                return (
                                                    <div
                                                        key={h}
                                                        style={{ width: CELL_W, height: CELL_H, boxSizing: 'border-box', ...cellStyle }}
                                                        className={`transition-all hover:scale-125 hover:z-10 hover:border hover:border-white relative ${displayCount > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                                                        onMouseEnter={(e) => {
                                                            handleCellMouseMove(e, {
                                                                date: formatDateLabel(date),
                                                                hour: h,
                                                                count: suspCount,
                                                                normCount,
                                                            });
                                                        }}
                                                        onMouseMove={(e) => {
                                                            handleCellMouseMove(e, {
                                                                date: formatDateLabel(date),
                                                                hour: h,
                                                                count: suspCount,
                                                                normCount,
                                                            });
                                                        }}
                                                        onMouseLeave={() => setTooltip(null)}
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Peak summary */}
                    <div style={{
                        background: 'rgba(255, 107, 26, 0.08)',
                        border: '1px solid rgba(255, 107, 26, 0.25)',
                        borderRadius: '10px',
                        padding: '12px 20px',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '10px',
                        width: '100%',
                        marginTop: '24px'
                    }}>
                        {peakCell && (
                            <>
                                <div style={{ color: '#ff6b1a', fontSize: '16px', filter: 'drop-shadow(0 0 6px rgba(255,107,26,0.8))' }}>🔥</div>
                                <div style={{ color: 'rgba(255, 107, 26, 0.7)', fontSize: '11px', fontWeight: 700, fontFamily: 'monospace', letterSpacing: '0.1em' }}>PEAK_ACTIVITY:</div>
                                <div style={{ color: '#ffffff', fontSize: '13px', fontWeight: 600, fontFamily: 'monospace' }}>{peakCell.count} txns at {formatDateLabel(peakCell.date)} @ {peakCell.hour}:00</div>
                            </>
                        )}
                    </div>
                </>
            )}

            {/* Glass Tooltip via Portal */}
            {tooltip && typeof document !== 'undefined' && ReactDOM.createPortal(
                <div
                    style={{ 
                        left: tooltip.x, 
                        top: tooltip.y, 
                        background: 'rgba(10, 14, 26, 0.75)',
                        backdropFilter: 'blur(20px)',
                        WebkitBackdropFilter: 'blur(20px)',
                        border: '1px solid rgba(255, 255, 255, 0.12)',
                        borderRadius: '10px',
                        padding: '10px 14px',
                        boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(255, 255, 255, 0.04), inset 0 1px 0 rgba(255, 255, 255, 0.08)',
                        minWidth: '160px',
                        maxWidth: '200px',
                        width: 'max-content',
                        boxSizing: 'border-box',
                        zIndex: 999999,
                        pointerEvents: 'none',
                        position: 'fixed'
                    }}
                >
                    <div style={{ color: 'rgba(255, 255, 255, 0.5)', fontSize: '11px', fontFamily: 'monospace', letterSpacing: '0.05em', marginBottom: '6px', borderBottom: '1px solid rgba(255, 255, 255, 0.07)', paddingBottom: '6px' }}>
                        {tooltip.date} <span style={{ opacity: 0.7 }}>@ {tooltip.hour}:00</span>
                    </div>
                    {showNormal && (
                        <div style={{ marginBottom: '6px' }}>
                            <div style={{ color: '#00e5ff', fontSize: '13px', fontWeight: 700, letterSpacing: '0.03em', textShadow: '0 0 8px rgba(0, 229, 255, 0.6)' }}>Normal</div>
                            <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: 800, lineHeight: 1, marginTop: '4px' }}>{tooltip.normCount}</div>
                        </div>
                    )}
                    <div>
                        <div style={{ color: '#ff6b1a', fontSize: '13px', fontWeight: 700, letterSpacing: '0.03em', textShadow: '0 0 8px rgba(255, 107, 26, 0.6)' }}>Suspicious</div>
                        <div style={{ color: '#ffffff', fontSize: '20px', fontWeight: 800, lineHeight: 1, marginTop: '4px' }}>{tooltip.count}</div>
                    </div>
                </div>,
                document.body
            )}
        </div>
    );
}
