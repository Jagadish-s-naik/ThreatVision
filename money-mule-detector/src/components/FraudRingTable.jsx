import React, { useState, useMemo } from 'react';

const PAGE_SIZE = 10;

function getRowStyle(riskScore) {
    if (riskScore >= 80) return 'bg-red-950/40 border-red-900/50';
    if (riskScore >= 60) return 'bg-orange-950/40 border-orange-900/50';
    if (riskScore >= 40) return 'bg-yellow-950/40 border-yellow-900/50';
    return 'bg-slate-800/40 border-slate-700/50';
}

function getPatternBadgeColor(type) {
    if (type === 'cycle') return 'bg-red-900/60 text-red-300 border-red-800';
    if (type === 'smurfing') return 'bg-orange-900/60 text-orange-300 border-orange-800';
    if (type === 'shell') return 'bg-yellow-900/60 text-yellow-300 border-yellow-800';
    return 'bg-slate-700 text-slate-300 border-slate-600';
}

export default function FraudRingTable({ fraudRings, suspiciousAccounts, onSelectAccount }) {
    const [sortKey, setSortKey] = useState('risk_score');
    const [sortAsc, setSortAsc] = useState(false);
    const [page, setPage] = useState(0);

    const accountMap = useMemo(() => {
        const m = {};
        for (const acc of suspiciousAccounts || []) {
            m[acc.account_id] = acc;
        }
        return m;
    }, [suspiciousAccounts]);

    const sorted = useMemo(() => {
        const arr = [...(fraudRings || [])];
        arr.sort((a, b) => {
            let av = a[sortKey], bv = b[sortKey];
            if (typeof av === 'string') av = av.toLowerCase();
            if (typeof bv === 'string') bv = bv.toLowerCase();
            if (av < bv) return sortAsc ? -1 : 1;
            if (av > bv) return sortAsc ? 1 : -1;
            return 0;
        });
        return arr;
    }, [fraudRings, sortKey, sortAsc]);

    const totalPages = Math.ceil(sorted.length / PAGE_SIZE);
    const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

    const handleSort = (key) => {
        if (sortKey === key) setSortAsc(!sortAsc);
        else { setSortKey(key); setSortAsc(key !== 'risk_score'); }
        setPage(0);
    };

    const handleRowClick = (ring) => {
        const members = ring.member_accounts || [];
        // Find highest-score member
        let best = null;
        let bestScore = -1;
        for (const id of members) {
            const acc = accountMap[id];
            if (acc && acc.suspicion_score > bestScore) {
                bestScore = acc.suspicion_score;
                best = acc;
            }
        }
        if (best) onSelectAccount(best);
    };

    const SortBtn = ({ col, label }) => (
        <button
            className="flex items-center gap-1 hover:text-amber-400 transition-colors"
            onClick={() => handleSort(col)}
        >
            {label}
            {sortKey === col ? (sortAsc ? ' ↑' : ' ↓') : ' ↕'}
        </button>
    );

    if (!fraudRings || fraudRings.length === 0) {
        return (
            <div className="text-center text-slate-400 py-12">
                No fraud rings detected in this dataset.
            </div>
        );
    }

    return (
        <div className="bg-slate-900 rounded-2xl border border-slate-700 overflow-hidden">
            <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-300" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    <thead>
                        <tr className="border-b border-slate-700 bg-slate-800 text-slate-400 text-xs uppercase tracking-widest">
                            <th className="px-4 py-3 text-left"><SortBtn col="ring_id" label="Ring ID" /></th>
                            <th className="px-4 py-3 text-left"><SortBtn col="pattern_type" label="Pattern" /></th>
                            <th className="px-4 py-3 text-right"><SortBtn col="member_count" label="Members" /></th>
                            <th className="px-4 py-3 text-right"><SortBtn col="risk_score" label="Risk Score" /></th>
                            <th className="px-4 py-3 text-left">Member Accounts</th>
                        </tr>
                    </thead>
                    <tbody>
                        {pageData.map((ring) => {
                            const members = ring.member_accounts || [];
                            const shown = members.slice(0, 5);
                            const extra = members.length - shown.length;
                            return (
                                <tr
                                    key={ring.ring_id}
                                    className={`border-b border-slate-700/50 cursor-pointer hover:brightness-125 transition-all ${getRowStyle(ring.risk_score)}`}
                                    onClick={() => handleRowClick(ring)}
                                >
                                    <td className="px-4 py-3 font-bold text-amber-400">{ring.ring_id}</td>
                                    <td className="px-4 py-3">
                                        <span className={`px-2 py-0.5 rounded text-xs border ${getPatternBadgeColor(ring.pattern_type)}`}>
                                            {ring.pattern_type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-right">{members.length}</td>
                                    <td className="px-4 py-3 text-right">
                                        <span className={`font-bold text-base ${ring.risk_score >= 80 ? 'text-red-400' : ring.risk_score >= 60 ? 'text-orange-400' : ring.risk_score >= 40 ? 'text-yellow-400' : 'text-slate-300'}`}>
                                            {ring.risk_score.toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-3 text-slate-400 text-xs">
                                        {shown.join(', ')}
                                        {extra > 0 && <span className="text-amber-500 ml-1">+{extra} more</span>}
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-t border-slate-700">
                    <p className="text-slate-400 text-xs">
                        Page {page + 1} of {totalPages} · {sorted.length} rings total
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-slate-300 text-xs transition-colors"
                        >
                            ← Previous
                        </button>
                        <button
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(page + 1)}
                            className="px-3 py-1 bg-slate-700 hover:bg-slate-600 disabled:opacity-30 rounded text-slate-300 text-xs transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
