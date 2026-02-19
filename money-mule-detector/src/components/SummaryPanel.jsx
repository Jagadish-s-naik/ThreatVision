import React from 'react';
import { downloadJSON } from '../utils/jsonExporter.js';
import SpotlightCard from './ui/SpotlightCard.jsx';

// Updated StatCard to use SpotlightCard wrapper
function StatCard({ label, value, icon, accent }) {
    return (
        <SpotlightCard className="h-full neocard border-2 border-slate-800 p-0 overflow-visible group">
            {/* Inner content needs relative z-index to sit above spotlight */}
            <div className="relative z-10 p-5 flex flex-col gap-2 h-full bg-slate-900/50">
                <div className="flex items-center gap-2 text-slate-400 text-sm font-bold uppercase tracking-wider">
                    <span className="text-xl">{icon}</span>
                    <span>{label}</span>
                </div>
                <div className={`text-3xl font-bold ${accent || 'text-amber-400'}`} style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {value}
                </div>
            </div>
        </SpotlightCard>
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
        <div className="bg-slate-900 border-2 border-slate-800 rounded-none p-6 mb-8 brutal-shadow relative">
            <div className="absolute -top-3 left-4 bg-slate-950 px-2 text-xs font-bold text-slate-500 uppercase tracking-widest border border-slate-800">
                Analysis Summary
            </div>

            {/* Stat cards with Spotlight Effect */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <StatCard
                    icon="🌐" label="Total Accounts"
                    value={(summary.total_accounts_analyzed || 0).toLocaleString()}
                    accent="text-slate-200"
                />
                <StatCard
                    icon="⚠" label="Suspicious"
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
                <div className="bg-slate-900 border-2 border-slate-800 p-3 flex justify-between items-center brutal-shadow-sm hover:translate-x-1 transition-transform cursor-default">
                    <span className="text-slate-400 font-bold uppercase text-xs">Cycle Patterns</span>
                    <span className="font-mono text-amber-400 font-bold ml-2">{cycleCount}</span>
                </div>
                <div className="bg-slate-900 border-2 border-slate-800 p-3 flex justify-between items-center brutal-shadow-sm hover:translate-x-1 transition-transform cursor-default">
                    <span className="text-slate-400 font-bold uppercase text-xs">Smurfing Patterns</span>
                    <span className="font-mono text-amber-400 font-bold ml-2">{smurfingCount}</span>
                </div>
                <div className="bg-slate-900 border-2 border-slate-800 p-3 flex justify-between items-center brutal-shadow-sm hover:translate-x-1 transition-transform cursor-default">
                    <span className="text-slate-400 font-bold uppercase text-xs">Shell Chains</span>
                    <span className="font-mono text-amber-400 font-bold ml-2">{shellCount}</span>
                </div>
                <div className="bg-slate-900 border-2 border-slate-800 p-3 flex justify-between items-center brutal-shadow-sm hover:translate-x-1 transition-transform cursor-default">
                    <span className="text-slate-400 font-bold uppercase text-xs">Cross-Ring Nodes</span>
                    <span className="font-mono text-fuchsia-400 font-bold ml-2">{overlapCount}</span>
                </div>
                <div className="bg-slate-900 border-2 border-slate-800 p-3 flex justify-between items-center brutal-shadow-sm col-span-2 hover:translate-x-1 transition-transform cursor-default">
                    <span className="text-slate-400 font-bold uppercase text-xs">Smurfing 72hr Clusters</span>
                    <span className="font-mono text-orange-400 font-bold ml-2">{smurfingCount}</span>
                </div>
            </div>

            {/* Peak window */}
            {peakWindowText !== 'N/A' && peakWindowText !== '' && (
                <div className="bg-orange-950/30 border-2 border-orange-900/50 p-4 mb-5 text-sm text-orange-300 font-mono">
                    <span className="font-bold uppercase text-xs text-orange-500 block mb-1">🔥 Top Suspicious Windows</span>
                    {peakWindowText}
                </div>
            )}

            {/* Download button */}
            <button
                onClick={onDownload}
                className="neobutton w-full md:w-auto bg-amber-500 hover:bg-amber-400 text-slate-900 border-amber-600 brutal-shadow-sm flex items-center justify-center gap-2"
            >
                <span>⬇</span> Download JSON Report
            </button>
        </div>
    );
}
