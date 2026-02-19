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

    const { suspGrid, normGrid, dates, peakCell, peakDay } = useMemo(() => {
        if (!transactions || transactions.length === 0) return { suspGrid: {}, normGrid: {}, dates: [], peakCell: null, peakDay: null };

        const suspGrid = {};
        const normGrid = {};
        const dateSet = new Set();

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

        return { suspGrid, normGrid, dates, peakCell, peakDay };
    }, [transactions, suspiciousAccountIds]);

    const hours = Array.from({ length: 24 }, (_, i) => i);

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
            <div className="flex items-start justify-between mb-4 flex-wrap gap-3">
                <div>
                    <h3 className="text-lg font-bold text-slate-100 mb-1" style={{ fontFamily: 'Syne, sans-serif' }}>
                        Suspicious Transaction Temporal Heatmap
                    </h3>
                    <p className="text-slate-400 text-xs">
                        Each cell = transaction count for that day + hour. Darker red = more suspicious activity.
                    </p>
                </div>
                <button
                    onClick={() => setShowNormal(!showNormal)}
                    className={`px-4 py-2 rounded-lg text-xs font-semibold border transition-all ${showNormal ? 'bg-blue-600 border-blue-500 text-white' : 'bg-slate-800 border-slate-600 text-slate-300 hover:border-blue-500'}`}
                >
                    {showNormal ? '🔵 Showing Normal Traffic' : '⬜ Show Normal Traffic'}
                </button>
            </div>

            {dates.length === 0 ? (
                <div className="text-slate-400 text-center py-12">No transaction data to display.</div>
            ) : (
                <>
                    {/* Heatmap grid */}
                    <div className="overflow-x-auto">
                        <div style={{ minWidth: 24 * CELL_W + 80 }}>
                            {/* X-axis */}
                            <div className="flex mb-1" style={{ marginLeft: 72 }}>
                                {hours.map((h) => (
                                    <div
                                        key={h}
                                        className="text-center text-slate-500 text-xs"
                                        style={{ width: CELL_W, fontSize: 9, lineHeight: '14px' }}
                                    >
                                        {formatHourLabel(h)}
                                    </div>
                                ))}
                            </div>

                            {/* Rows */}
                            {dates.map((date) => (
                                <div key={date} className="flex items-center mb-0.5">
                                    {/* Y-axis label */}
                                    <div
                                        className="text-slate-400 text-right pr-2 shrink-0"
                                        style={{ width: 70, fontSize: 10, fontFamily: 'IBM Plex Mono, monospace' }}
                                    >
                                        {formatDateLabel(date)}
                                    </div>
                                    {/* Cells */}
                                    {hours.map((h) => {
                                        const suspCount = (suspGrid[date] && suspGrid[date][h]) || 0;
                                        const normCount = (normGrid[date] && normGrid[date][h]) || 0;
                                        const displayCount = showNormal ? normCount : suspCount;
                                        const scale = showNormal ? BLUE_SCALE : RED_SCALE;
                                        const bg = getColor(displayCount, scale);
                                        return (
                                            <div
                                                key={h}
                                                style={{ width: CELL_W, height: CELL_H, backgroundColor: bg, cursor: 'crosshair' }}
                                                className="border border-slate-900/30 transition-opacity hover:opacity-75"
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
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="flex items-center gap-2 mt-4 text-xs text-slate-400">
                        <span>Less</span>
                        {RED_SCALE.map((s) => (
                            <div key={s.bg} className="w-4 h-4 rounded-sm" style={{ backgroundColor: s.bg }} title={s.min === 21 ? '21+' : `${s.min}–${s.max}`} />
                        ))}
                        <span>More suspicious</span>
                    </div>

                    {/* Peak summary */}
                    <div className="mt-4 space-y-1 text-sm text-slate-300" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                        {peakCell && (
                            <p>🔥 Peak suspicious activity: <span className="text-red-400">{formatDateLabel(peakCell.date)}</span> at <span className="text-red-400">{peakCell.hour}:00</span> with <span className="font-bold text-amber-400">{peakCell.count}</span> transactions</p>
                        )}
                        {peakDay && (
                            <p>📅 Most active day: <span className="text-orange-400">{formatDateLabel(peakDay.date)}</span> with <span className="font-bold text-amber-400">{peakDay.count}</span> total suspicious transactions</p>
                        )}
                    </div>
                </>
            )}

            {/* Tooltip */}
            {tooltip && (
                <div
                    className="fixed z-50 pointer-events-none bg-slate-800 border border-slate-600 rounded-lg px-3 py-2 text-xs text-slate-200 shadow-xl"
                    style={{ left: tooltip.x + 12, top: tooltip.y - 10, fontFamily: 'IBM Plex Mono, monospace' }}
                >
                    <div>Date: <span className="text-amber-400">{tooltip.date}</span></div>
                    <div>Hour: <span className="text-amber-400">{tooltip.hour}:00</span></div>
                    <div>Suspicious Txs: <span className="text-red-400 font-bold">{tooltip.count}</span></div>
                    {tooltip.normCount > 0 && <div>Normal Txs: <span className="text-blue-400">{tooltip.normCount}</span></div>}
                </div>
            )}
        </div>
    );
}
