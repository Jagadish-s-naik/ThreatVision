import React from 'react';
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

    const {
        suspiciousAccounts = [],
        fraudRings = [],
        summary = {},
        nodeStats = {},
    } = analysisResults;

    // Derive pattern counts from fraud rings
    const cycleCount = fraudRings.filter((r) => r.pattern_type === 'cycle').length;
    const smurfingCount = fraudRings.filter((r) => r.pattern_type === 'smurfing').length;
    const shellCount = fraudRings.filter((r) => r.pattern_type === 'shell').length;

    // Cross-ring overlap accounts — accounts belonging to 2+ rings
    const ringMembership = {};
    for (const ring of fraudRings) {
        for (const acc of ring.member_accounts) {
            ringMembership[acc] = (ringMembership[acc] || 0) + 1;
        }
    }
    const overlapCount = Object.values(ringMembership).filter((c) => c >= 2).length;

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
