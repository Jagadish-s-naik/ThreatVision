import React from 'react';
import { downloadJSON } from '../utils/jsonExporter.js';

function StatCard({ label, value, icon, accent }) {
    return (
        <div className="bg-slate-800 border border-slate-700 rounded-xl p-5 flex flex-col gap-2">
            <div className="flex items-center gap-2 text-slate-400 text-sm">
                <span className="text-xl">{icon}</span>
                <span>{label}</span>
            </div>
            <div className={`text-3xl font-bold ${accent || 'text-amber-400'}`} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                {value}
            </div>
        </div>
    );
}

export default function SummaryPanel({ analysisResults, onDownload }) {
    if (!analysisResults) return null;
    const { suspiciousAccounts, fraudRings, jsonOutput, cycles, smurfingRings, shellChains, nodeStats, transactions } = analysisResults;

    const cycleCount = (cycles || []).length;
    const smurfingCount = (smurfingRings || []).length;
    const shellCount = (shellChains || []).length;

    // Cross-ring overlap accounts — accounts belonging to 2+ rings
    const overlapCount = Object.values(nodeStats || {}).filter(
        (s) => s.ringMemberships && s.ringMemberships.length >= 2
    ).length;

    // Peak suspicious window from smurfing
    let peakWindowText = 'N/A';
    if (smurfingRings && smurfingRings.length > 0) {
        const sorted = [...smurfingRings].sort((a, b) => {
            const aMembers = a.members.length;
            const bMembers = b.members.length;
            return bMembers - aMembers;
        });
        const top3 = sorted.slice(0, 3);
        peakWindowText = top3.map((ring, i) => {
            const start = ring.windowStartTime ? new Date(ring.windowStartTime) : null;
            const end = ring.windowEndTime ? new Date(ring.windowEndTime) : null;
            if (!start || !end) return '';
            const fmt = (d) => d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
            const hours = Math.round((end - start) / (1000 * 60 * 60));
            return `${fmt(start)}–${fmt(end)}: ${ring.members.length} accounts in ${hours}hr window`;
        }).filter(Boolean).join(' | ');
    }

    const summary = jsonOutput?.summary || {};

    return (
        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 mb-6">
            {/* Stat cards */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                    icon="🌐" label="Total Accounts"
                    value={(summary.total_accounts_analyzed || 0).toLocaleString()}
                    accent="text-slate-200"
                />
                <StatCard
                    icon="⚠" label="Suspicious Accounts"
                    value={(summary.suspicious_accounts_flagged || 0).toLocaleString()}
                    accent="text-red-400"
                />
                <StatCard
                    icon="💍" label="Fraud Rings"
                    value={(summary.fraud_rings_detected || 0).toLocaleString()}
                    accent="text-orange-400"
                />
                <StatCard
                    icon="⏱" label="Processing Time"
                    value={`${summary.processing_time_seconds ?? '—'}s`}
                    accent="text-green-400"
                />
            </div>

            {/* Breakdown */}
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 mb-5 text-sm text-slate-300">
                <div className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between items-center">
                    <span className="text-slate-400">🔄 Cycles detected</span>
                    <span className="font-mono text-amber-400 font-semibold">{cycleCount}</span>
                </div>
                <div className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between items-center">
                    <span className="text-slate-400">🌊 Smurfing patterns</span>
                    <span className="font-mono text-amber-400 font-semibold">{smurfingCount}</span>
                </div>
                <div className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between items-center">
                    <span className="text-slate-400">🐚 Shell chains</span>
                    <span className="font-mono text-amber-400 font-semibold">{shellCount}</span>
                </div>
                <div className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between items-center">
                    <span className="text-slate-400">🔗 Cross-ring accounts</span>
                    <span className="font-mono text-fuchsia-400 font-semibold">{overlapCount}</span>
                </div>
                <div className="bg-slate-800 rounded-lg px-4 py-3 flex justify-between items-center col-span-2">
                    <span className="text-slate-400">🕵 Smurfing 72hr clusters</span>
                    <span className="font-mono text-orange-400 font-semibold">{smurfingCount}</span>
                </div>
            </div>

            {/* Peak window */}
            {peakWindowText !== 'N/A' && peakWindowText !== '' && (
                <div className="bg-orange-900/20 border border-orange-800 rounded-xl px-4 py-3 mb-5 text-sm text-orange-300">
                    <span className="font-semibold">🔥 Top suspicious windows: </span>
                    <span className="font-mono">{peakWindowText}</span>
                </div>
            )}

            {/* Download button */}
            <button
                onClick={onDownload}
                className="w-full md:w-auto px-8 py-3 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-900 font-bold rounded-xl transition-all duration-200 text-base shadow-lg shadow-amber-900/40 flex items-center gap-2"
            >
                <span>⬇</span> Download JSON Report
            </button>
        </div>
    );
}
