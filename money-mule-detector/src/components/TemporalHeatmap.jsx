import React, { useState, useMemo } from 'react';

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

function getColor(count, scale) {
    for (const s of [...scale].reverse()) {
        if (count >= s.min) return s.bg;
    }
    return scale[0].bg;
}

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

    const { suspGrid, normGrid, dates, peakCell, peakDay, maxCount } = useMemo(() => {
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
        let peakDay = null, peakDayCount = 0;

        for (const [date, hours] of Object.entries(suspGrid)) {
            let dayTotal = 0;
            for (const [hour, count] of Object.entries(hours)) {
                dayTotal += count;
                if (count > peakCellCount) {
                    peakCellCount = count;
                    peakCell = { date, hour: parseInt(hour), count };
                }
            }
            if (dayTotal > peakDayCount) {
                peakDayCount = dayTotal;
                peakDay = { date, count: dayTotal };
            }
        }

        return { suspGrid, normGrid, dates, peakCell, peakDay, maxCount: maxVal };
    }, [transactions, suspiciousAccountIds]);

    const hours = Array.from({ length: 24 }, (_, i) => i);

    // Neo-Brutal Styling & Gradient Logic
    const getIntensityColor = (count, isNormal) => {
        if (count === 0) return '#1e293b'; // Slate-800

        // Simple linear interpolation for opacity/brightness
        // Suspicious: Amber (low) -> Red (high)
        // Normal: Cyan (low) -> Blue (high)

        const intensity = Math.min(1, Math.max(0.2, count / (maxCount || 10))); // Cap at maxCount or 10 for baseline

        if (isNormal) {
            // Cyan to Blue: #22d3ee -> #2563eb
            return `rgba(37, 99, 235, ${intensity})`;
        } else {
            // Orange to Red: #f97316 -> #ef4444
            // Using HSL for better gradient: Start 30 (orange), End 0 (red)
            const hue = 30 - (intensity * 30);
            const light = 60 - (intensity * 20); // Darker as it gets more intense
            return `hsl(${hue}, 100%, ${light}%)`;
        }
    };

    return (
        <div className="bg-slate-900 rounded-none border-2 border-slate-700 p-6 brutal-shadow">
            <div className="flex items-start justify-between mb-6 flex-wrap gap-3">
                <div>
                    <h3 className="text-xl font-extrabold text-slate-100 mb-1 uppercase tracking-tight" style={{ fontFamily: 'Syne, sans-serif' }}>
                        Temporal Heatmap
                    </h3>
                    <p className="text-slate-400 text-xs font-mono">
                        // TRACKING_SUSPICIOUS_FLOWS_OVER_TIME
                    </p>
                </div>
                <button
                    onClick={() => setShowNormal(!showNormal)}
                    className={`neobutton text-xs font-bold uppercase tracking-wider px-4 py-2 border-2 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${showNormal
                        ? 'bg-blue-600 border-blue-800 text-white brutal-shadow-sm'
                        : 'bg-slate-800 border-slate-950 text-slate-300 hover:bg-slate-700 brutal-shadow'}`}
                >
                    {showNormal ? '🔵 Showing All Traffic' : '⬜ Show Suspicious Only'}
                </button>
            </div>

            {dates.length === 0 ? (
                <div className="text-slate-400 text-center py-12 font-mono border-2 border-dashed border-slate-800">NO_DATA_DETECTED</div>
            ) : (
                <>
                    {/* Heatmap grid */}
                    <div className="overflow-x-auto pb-4">
                        <div style={{ minWidth: 24 * (CELL_W + 2) + 80 }}>
                            {/* X-axis */}
                            <div className="flex mb-2" style={{ marginLeft: 80 }}>
                                {hours.map((h) => (
                                    <div
                                        key={h}
                                        className="text-center text-slate-500 font-bold font-mono"
                                        style={{ width: CELL_W + 2, fontSize: 9 }}
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
                                            className="text-slate-500 font-bold text-right pr-3 shrink-0 uppercase tracking-tight"
                                            style={{ width: 80, fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}
                                        >
                                            {formatDateLabel(date)}
                                        </div>
                                        {/* Cells */}
                                        <div className="flex gap-[1px]">
                                            {hours.map((h) => {
                                                const suspCount = (suspGrid[date] && suspGrid[date][h]) || 0;
                                                const normCount = (normGrid[date] && normGrid[date][h]) || 0;
                                                const displayCount = showNormal ? normCount : suspCount;
                                                const bg = getIntensityColor(displayCount, showNormal);

                                                return (
                                                    <div
                                                        key={h}
                                                        style={{ width: CELL_W, height: CELL_H, backgroundColor: bg }}
                                                        className={`transition-all hover:scale-125 hover:z-10 hover:border hover:border-white relative ${displayCount > 0 ? 'cursor-pointer' : 'cursor-default'}`}
                                                        onMouseEnter={(e) => {
                                                            const rect = e.currentTarget.getBoundingClientRect();
                                                            setTooltip({
                                                                x: rect.left,
                                                                y: rect.top,
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
                    <div className="mt-6 p-4 bg-slate-950 border-2 border-slate-800 brutal-shadow-sm">
                        <div className="flex items-center gap-4 text-xs font-mono text-slate-300">
                            {peakCell && (
                                <div className="flex items-center gap-2">
                                    <span className="text-red-500 text-lg">🔥</span>
                                    <span>PEAK_ACTIVITY: <span className="text-white font-bold">{peakCell.count} txns</span> at {formatDateLabel(peakCell.date)} @ {peakCell.hour}:00</span>
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}

            {/* Neo-Brutal Tooltip */}
            {tooltip && (
                <div
                    className="fixed z-50 pointer-events-none bg-slate-950 border-2 border-white p-0 shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] text-xs text-slate-200"
                    style={{ left: tooltip.x + 15, top: tooltip.y - 15, fontFamily: 'IBM Plex Mono, monospace', minWidth: 140 }}
                >
                    <div className="bg-white text-black font-bold px-2 py-1 border-b-2 border-slate-200">
                        {tooltip.date} <span className="text-slate-500">@ {tooltip.hour}:00</span>
                    </div>
                    <div className="p-2 space-y-1">
                        <div className="flex justify-between">
                            <span className="text-red-400 font-bold">Suspicious</span>
                            <span className="font-bold">{tooltip.count}</span>
                        </div>
                        {showNormal && (
                            <div className="flex justify-between">
                                <span className="text-blue-400 font-bold">Normal</span>
                                <span className="font-bold">{tooltip.normCount}</span>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
