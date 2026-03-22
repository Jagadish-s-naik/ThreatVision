import React, { useState, useMemo } from 'react';
import { ShieldAlert, Activity, DollarSign, Flag } from 'lucide-react';

const PAGE_SIZE = 10;

function getRowStyle(riskScore) {
    if (riskScore >= 80) return 'bg-rose-500/10 hover:bg-rose-500/20';
    if (riskScore >= 60) return 'bg-orange-500/10 hover:bg-orange-500/20';
    if (riskScore >= 40) return 'bg-yellow-500/10 hover:bg-yellow-500/20';
    return 'hover:bg-white/5';
}

function getPatternBadgeColor(type) {
    if (type === 'cycle') return 'bg-rose-500/10 text-rose-400 border-rose-500/20';
    if (type === 'smurfing') return 'bg-orange-500/10 text-orange-400 border-orange-500/20';
    if (type === 'shell') return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/20';
    return 'bg-slate-800 text-slate-300 border-slate-700/50';
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
        <div className="flex flex-col h-full w-full overflow-hidden bg-transparent">
            {/* Header Area */}
            <div className="p-6 border-b border-white/5 flex flex-col md:flex-row md:items-center justify-between gap-4 shrink-0">
                <div>
                    <div className="flex items-center gap-3 mb-1">
                        <div className="w-8 h-8 rounded bg-rose-500/10 flex items-center justify-center border border-rose-500/30">
                            <ShieldAlert className="w-4 h-4 text-rose-400" />
                        </div>
                        <h3 className="text-xl font-black tracking-tight text-white font-headline">Detected Fraud Rings</h3>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold tracking-widest bg-rose-500/10 text-rose-400 border border-rose-500/20">HIGH PRIORITY</span>
                    </div>
                    <p className="text-sm text-slate-400 pl-11 font-body">Review prioritized networks of suspicious accounts. Click any ring to analyze its primary suspect in detail.</p>
                </div>
                <div className="flex items-center gap-4 text-cyan-400 text-sm font-headline font-bold bg-cyan-400/10 px-4 py-2 rounded-lg border border-cyan-400/20 shadow-[0_0_15px_rgba(6,182,212,0.15)]">
                    <div className="flex items-center gap-2">
                        <Activity className="w-4 h-4" />
                        <span>{fraudRings.length} RINGS DETECTED</span>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-auto custom-scrollbar">
                <table className="w-full text-sm text-slate-300 font-body">
                    <thead className="sticky top-0 bg-slate-950/80 backdrop-blur-md z-10">
                        <tr className="border-b border-white/5 text-slate-400 text-[10px] uppercase tracking-widest font-headline font-bold">
                            <th className="px-6 py-4 text-left font-headline">{renderSortBtn("ring_id", "Ring Identity")}</th>
                            <th className="px-6 py-4 text-left font-headline">{renderSortBtn("pattern_type", "Pattern")}</th>
                            <th className="px-6 py-4 text-right font-headline">{renderSortBtn("member_count", "Nodes")}</th>
                            <th className="px-6 py-4 text-right font-headline">{renderSortBtn("total_tx", "Total Tx")}</th>
                            <th className="px-6 py-4 text-right font-headline">{renderSortBtn("total_volume", "Volume Est.")}</th>
                            <th className="px-6 py-4 text-right font-headline">{renderSortBtn("risk_score", "Risk Score")}</th>
                            <th className="px-6 py-4 text-left font-headline">Primary Members</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {pageData.map((ring) => {
                            const members = ring.member_accounts || [];
                            const shown = members.slice(0, 5);
                            const extra = members.length - shown.length;
                            return (
                                <tr
                                    key={ring.ring_id}
                                    className={`cursor-pointer transition-colors ${getRowStyle(ring.risk_score)} group`}
                                    onClick={() => handleRowClick(ring)}
                                >
                                    <td className="px-6 py-4 font-bold text-white group-hover:text-cyan-400 transition-colors relative font-headline">
                                        <div className="flex items-center gap-2">
                                            {ring.member_accounts.some(id => flaggedAccounts.has(id)) && (
                                                <Flag size={12} className="text-rose-500 fill-rose-500 animate-pulse shrink-0" />
                                            )}
                                            {ring.displayName || ring.ring_id}
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`px-2 py-1 text-[10px] font-bold uppercase tracking-wider border rounded font-headline ${getPatternBadgeColor(ring.pattern_type)}`}>
                                            {ring.pattern_type}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right font-semibold">{members.length}</td>
                                    <td className="px-6 py-4 text-right text-slate-400">{ring.total_tx.toLocaleString()}</td>
                                    <td className="px-6 py-4 text-right text-emerald-400 font-medium">${(ring.total_volume).toLocaleString('en-US', {maximumFractionDigits:0})}</td>
                                    <td className="px-6 py-4 text-right">
                                        <span className={`font-black font-headline text-lg ${ring.risk_score >= 80 ? 'text-rose-500 drop-shadow-[0_0_8px_rgba(244,63,94,0.5)]' : ring.risk_score >= 60 ? 'text-orange-500' : ring.risk_score >= 40 ? 'text-yellow-500' : 'text-slate-400'}`}>
                                            {ring.risk_score.toFixed(1)}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-slate-400 text-xs">
                                        <div className="flex flex-wrap gap-1.5">
                                            {shown.map(m => (
                                                <span key={m} className={`px-2 py-0.5 rounded border truncate max-w-[120px] flex items-center gap-1 ${
                                                    flaggedAccounts.has(m) 
                                                    ? 'bg-rose-500/20 border-rose-500/40 text-rose-200' 
                                                    : 'bg-white/5 border-white/10 text-slate-300'
                                                }`} title={m}>
                                                    {flaggedAccounts.has(m) && <Flag size={8} className="fill-rose-500 text-rose-500" />}
                                                    {m}
                                                </span>
                                            ))}
                                            {extra > 0 && <span className="bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded border border-amber-500/20">+{extra}</span>}
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
                <div className="flex items-center justify-between px-6 py-4 border-t border-white/5 bg-slate-950/40 shrink-0">
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest font-headline">
                        Page {page + 1} of {totalPages}
                    </p>
                    <div className="flex gap-2">
                        <button
                            disabled={page === 0}
                            onClick={() => setPage(page - 1)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-headline text-xs font-bold uppercase tracking-wider rounded border border-white/10 disabled:opacity-30 transition-colors"
                        >
                            ← Prev
                        </button>
                        <button
                            disabled={page >= totalPages - 1}
                            onClick={() => setPage(page + 1)}
                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white font-headline text-xs font-bold uppercase tracking-wider rounded border border-white/10 disabled:opacity-30 transition-colors"
                        >
                            Next →
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
