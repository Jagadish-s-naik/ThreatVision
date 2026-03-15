import React, { useState, useMemo } from 'react';
import { ShieldAlert, Activity, DollarSign, Flag } from 'lucide-react';

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

export default function FraudRingTable({ fraudRings, suspiciousAccounts, flaggedAccounts, onSelectAccount, onToggleFlag }) {
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
        let arr = [...(fraudRings || [])].map(ring => {
            const members = ring.member_accounts || [];
            
            // Calculate best member for naming
            const accScores = members.map(id => accountMap[id] || { account_id: id, suspicion_score: 0 })
                                     .sort((a,b) => b.suspicion_score - a.suspicion_score);
            const topAccount = accScores.length > 0 ? accScores[0].account_id : 'Unknown';
            const shortAcc = topAccount.length > 8 ? topAccount.substring(0,8) + '...' : topAccount;
            const prefix = ring.pattern_type.substring(0, 3).toUpperCase();
            
            // Calculate volume and transaction counts
            let totalTx = 0;
            let totalVolume = 0;
            members.forEach(id => {
                const acc = accountMap[id];
                if (acc) {
                    totalTx += (acc.transaction_count || 0);
                    // Use the max of sent/received or sum depending on pattern, simplest is passing through volume
                    totalVolume += Math.max(acc.total_sent || 0, acc.total_received || 0);
                }
            });

            return {
                ...ring,
                displayName: `${prefix} : ${shortAcc}`,
                total_tx: totalTx,
                total_volume: totalVolume
            };
        });

        arr.sort((a, b) => {
            let av = sortKey === 'member_count' ? a.member_accounts.length : a[sortKey];
            let bv = sortKey === 'member_count' ? b.member_accounts.length : b[sortKey];
            if (typeof av === 'string') av = av.toLowerCase();
            if (typeof bv === 'string') bv = bv.toLowerCase();
            if (av < bv) return sortAsc ? -1 : 1;
            if (av > bv) return sortAsc ? 1 : -1;
            return 0;
        });
        return arr;
    }, [fraudRings, accountMap, sortKey, sortAsc]);

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

    const renderSortBtn = (col, label) => (
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
        <div className="bg-slate-900 rounded-none border-2 border-slate-700 flex flex-col overflow-hidden brutal-shadow">
            {/* Header Area */}
            <div className="p-6 border-b-2 border-slate-700 bg-slate-800/80 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded bg-rose-500/20 flex items-center justify-center border border-rose-500/50">
                            <ShieldAlert className="w-4 h-4 text-rose-400" />
                        </div>
                        <h3 className="text-xl font-bold tracking-tight text-white">Detected Fraud Rings</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">HIGH PRIORITY</span>
                    </div>
                    <p className="text-sm text-slate-400 pl-11">Review prioritized networks of suspicious accounts. Click any ring to analyze its primary suspect in detail.</p>
                </div>
                <div className="flex items-center gap-4 text-slate-400 text-sm font-mono bg-slate-900/50 px-4 py-2 rounded-lg border border-slate-700/50">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4 text-[#00e5ff]" />
                        <span>{fraudRings.length} Rings</span>
                    </div>
                </div>
            </div>

            <div className="overflow-x-auto">
                <table className="w-full text-sm text-slate-300" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    <thead>
                        <tr className="border-b-2 border-slate-700 bg-slate-800 text-slate-400 text-xs uppercase tracking-widest font-bold">
                            <th className="px-4 py-4 text-left border-r border-slate-700">{renderSortBtn("ring_id", "Ring Identity")}</th>
                            <th className="px-4 py-4 text-left border-r border-slate-700">{renderSortBtn("pattern_type", "Pattern")}</th>
                            <th className="px-4 py-4 text-right border-r border-slate-700">{renderSortBtn("member_count", "Nodes")}</th>
                            <th className="px-4 py-4 text-right border-r border-slate-700">{renderSortBtn("total_tx", "Total Tx")}</th>
                            <th className="px-4 py-4 text-right border-r border-slate-700">{renderSortBtn("total_volume", "Volume Est.")}</th>
                            <th className="px-4 py-4 text-right border-r border-slate-700">{renderSortBtn("risk_score", "Risk Score")}</th>
                            <th className="px-4 py-4 text-left">Primary Members</th>
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
                                    className={`border-b border-slate-700 hover:bg-slate-800/50 cursor-pointer transition-colors ${getRowStyle(ring.risk_score)} group`}
                                    onClick={() => handleRowClick(ring)}
                                >
                                    <td className="px-4 py-4 font-bold text-white border-r border-slate-700/50 group-hover:text-[#00e5ff] transition-colors relative">
                                        <div className="flex items-center gap-2">
                                            {ring.member_accounts.some(id => flaggedAccounts.has(id)) && (
                                                <Flag size={12} className="text-red-500 fill-red-500 animate-pulse shrink-0" />
                                            )}
                                            {ring.displayName || ring.ring_id}
                                        </div>
                                    </td>
                                    <td className="px-4 py-4 border-r border-slate-700/50">
                                        <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider border rounded ${getPatternBadgeColor(ring.pattern_type)}`}>
                                            {ring.pattern_type}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-right border-r border-slate-700/50 font-semibold">{members.length}</td>
                                    <td className="px-4 py-4 text-right border-r border-slate-700/50 text-slate-400">{ring.total_tx.toLocaleString()}</td>
                                    <td className="px-4 py-4 text-right border-r border-slate-700/50 text-emerald-400 bg-emerald-900/10">${(ring.total_volume).toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                                    <td className="px-4 py-4 text-right border-r border-slate-700/50">
                                        <span className={`font-bold text-base ${ring.risk_score >= 80 ? 'text-rose-500' : ring.risk_score >= 60 ? 'text-orange-500' : ring.risk_score >= 40 ? 'text-yellow-500' : 'text-slate-400'}`}>
                                            {ring.risk_score.toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="px-4 py-4 text-slate-400 text-xs font-mono">
                                        <div className="flex flex-wrap gap-1">
                                            {shown.map(m => (
                                                <span key={m} className={`px-1.5 py-0.5 rounded border truncate max-w-[120px] flex items-center gap-1 ${
                                                    flaggedAccounts.has(m) 
                                                    ? 'bg-red-900/30 border-red-500/50 text-red-200' 
                                                    : 'bg-slate-800/80 border-slate-700/50 text-slate-400'
                                                }`} title={m}>
                                                    {flaggedAccounts.has(m) && <Flag size={8} className="fill-red-500 text-red-500" />}
                                                    {m}
                                                </span>
                                            ))}
                                            {extra > 0 && <span className="bg-slate-800 text-amber-500 px-1.5 py-0.5 rounded border border-amber-500/30">+{extra}</span>}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>
            </div>

            {/* Pagination */}
            {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 bg-slate-800 border-t-2 border-slate-700">
                    <p className="text-slate-400 text-xs font-bold uppercase tracking-widest">
                        Page {page + 1} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                            className="neobutton text-xs py-1 px-3 bg-slate-900 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:shadow-none"
                        >
                            ← Prev
                        </button>
                        <button
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(page + 1)}
                            className="neobutton text-xs py-1 px-3 bg-slate-900 hover:bg-slate-700 text-slate-300 disabled:opacity-50 disabled:shadow-none"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
