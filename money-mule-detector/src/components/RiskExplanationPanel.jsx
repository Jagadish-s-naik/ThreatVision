import React, { useMemo } from 'react';

const VALID_PATTERNS = new Set([
    'cycle_length_3', 'cycle_length_4', 'cycle_length_5',
    'fan_in', 'fan_out', 'shell_chain', 'high_velocity',
]);

const PATTERN_WEIGHTS = {
    cycle_length_3: 40, cycle_length_4: 35, cycle_length_5: 30,
    fan_in: 25, fan_out: 25, shell_chain: 20, high_velocity: 15,
};

function fmtDate(date) {
    if (!date) return '—';
    const d = date instanceof Date ? date : new Date(date);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) +
        ' ' + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

function fmtCurrency(n) {
    return '$' + (n || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function generateNarrative(account, nodeStats, transactions, fraudRings) {
    if (!account) return [];
    const patterns = (account.detected_patterns || []).filter((p) => VALID_PATTERNS.has(p));
    const stats = nodeStats[account.account_id] || {};
    const paragraphs = [];

    for (const pattern of patterns) {
        if (pattern === 'cycle_length_3') {
            const ring = fraudRings?.find((r) => r.ring_id === account.ring_id);
            const members = ring?.member_accounts || [];
            const idx = members.indexOf(account.account_id);
            const next1 = members[(idx + 1) % members.length] || '?';
            const next2 = members[(idx + 2) % members.length] || '?';
            paragraphs.push(
                `This account is part of a 3-hop circular fund routing ring. Money flows from ${account.account_id} → ${next1} → ${next2} → back to ${account.account_id}, a classic layering technique used to obscure the origin of illicit funds. This is the highest-risk cycle pattern — money returns to its origin in just 3 hops.`
            );
        }
        if (pattern === 'cycle_length_4') {
            paragraphs.push(
                `This account participates in a 4-hop circular routing ring, adding an extra layer of obfuscation compared to a 3-hop cycle. The extra hop makes the laundering trail harder to follow.`
            );
        }
        if (pattern === 'cycle_length_5') {
            paragraphs.push(
                `This account is embedded in a 5-hop circular routing network — the most complex cycle pattern detected. Funds pass through 5 accounts before returning to origin, creating significant tracing difficulty.`
            );
        }
        if (pattern === 'fan_in') {
            const senders = (typeof stats.uniqueSenders === 'number') ? stats.uniqueSenders : (stats.uniqueSenders?.size || 0);
            const windowMs = 72 * 60 * 60 * 1000;
            paragraphs.push(
                `This account received funds from ${senders} unique senders within a 72-hour window totalling ${fmtCurrency(stats.totalReceived)} in suspicious inflows. This fan-in aggregation pattern is consistent with smurfing — breaking large sums into smaller deposits across many accounts to avoid reporting thresholds.`
            );
        }
        if (pattern === 'fan_out') {
            const receivers = (typeof stats.uniqueReceivers === 'number') ? stats.uniqueReceivers : (stats.uniqueReceivers?.size || 0);
            paragraphs.push(
                `This account rapidly dispersed funds to ${receivers} unique receivers within a 72-hour window. This fan-out dispersal pattern suggests this account acts as a distribution hub, a key role in money mule networks.`
            );
        }
        if (pattern === 'shell_chain') {
            paragraphs.push(
                `This account shows characteristics of a shell account — it has only ${stats.txCount || 0} total transactions and acts purely as a pass-through node. Shell accounts are used to add layers between the criminal source and the final destination, making fund tracing harder.`
            );
        }
        if (pattern === 'high_velocity') {
            const txCount = stats.txCount || 0;
            paragraphs.push(
                `The transaction velocity for this account is abnormally high — ${txCount} transactions occurred within a 6-hour window, suggesting automated or coordinated activity rather than normal human banking behavior.`
            );
        }
    }

    // Score breakdown
    let breakdown = 'Suspicion score breakdown: ';
    const parts = [];
    for (const p of patterns) {
        if (PATTERN_WEIGHTS[p]) parts.push(`${p} (+${PATTERN_WEIGHTS[p]})`);
    }
    const ringMemberships = stats.ringMemberships || [];
    if (ringMemberships.length >= 2) parts.push('multi-ring (+10)');
    const amounts = stats.amounts || [];
    if (amounts.length > 0) {
        const roundCount = amounts.filter((a) => a % 500 === 0 || a % 1000 === 0).length;
        if (roundCount / amounts.length > 0.5) parts.push('round amounts (+5)');
    }
    const timestamps = stats.timestamps || [];
    if (timestamps.length >= 2) {
        const minTs = Math.min(...timestamps.map((t) => t.getTime()));
        const maxTs = Math.max(...timestamps.map((t) => t.getTime()));
        if (maxTs - minTs <= 24 * 60 * 60 * 1000) parts.push('24hr cluster (+8)');
    }
    breakdown += parts.join(', ') + `. Final score: ${account.suspicion_score}/100.`;
    paragraphs.push(breakdown);

    if (ringMemberships.length > 1) {
        paragraphs.push(
            `⚠ This account appears in ${ringMemberships.length} different fraud rings (${ringMemberships.join(', ')}), indicating it may be a central node in multiple overlapping criminal networks.`
        );
    }

    return paragraphs;
}

function ScoreBadge({ score }) {
    let color = '#EAB308';
    let label = 'LOW';
    if (score >= 75) { color = '#EF4444'; label = 'CRITICAL'; }
    else if (score >= 50) { color = '#F97316'; label = 'HIGH'; }
    else if (score >= 25) { color = '#EAB308'; label = 'MEDIUM'; }
    return (
        <div className="flex items-center gap-4">
            <div
                className="w-20 h-20 rounded-full flex flex-col items-center justify-center border-4 shrink-0"
                style={{ borderColor: color, backgroundColor: color + '22' }}
            >
                <span className="text-2xl font-bold" style={{ color, fontFamily: 'IBM Plex Mono, monospace' }}>{score}</span>
                <span className="text-xs text-slate-400">/100</span>
            </div>
            <div>
                <div className="text-sm text-slate-400 mb-1">Risk Level</div>
                <div className="text-xl font-black" style={{ color, fontFamily: 'Syne, sans-serif' }}>{label}</div>
            </div>
        </div>
    );
}

export default function RiskExplanationPanel({ account, nodeStats, transactions, fraudRings, onClose }) {
    const stats = useMemo(() => (account ? nodeStats[account.account_id] : null), [account, nodeStats]);
    const paragraphs = useMemo(
        () => generateNarrative(account, nodeStats, transactions, fraudRings),
        [account, nodeStats, transactions, fraudRings]
    );

    if (!account) return null;

    const timestamps = stats?.timestamps || [];
    const sortedTs = [...timestamps].sort((a, b) => a - b);
    const firstSeen = sortedTs[0] ? fmtDate(sortedTs[0]) : '—';
    const lastSeen = sortedTs[sortedTs.length - 1] ? fmtDate(sortedTs[sortedTs.length - 1]) : '—';
    const activeDays = sortedTs.length >= 2
        ? Math.ceil((sortedTs[sortedTs.length - 1] - sortedTs[0]) / (1000 * 60 * 60 * 24))
        : 0;

    return (
        <>
            {/* Dim overlay */}
            <div
                className="fixed inset-0 bg-black/60 z-40 transition-opacity"
                onClick={onClose}
            />
            {/* Panel */}
            <div
                className="fixed top-0 right-0 h-full z-50 bg-slate-900 border-l border-slate-700 overflow-y-auto shadow-2xl"
                style={{ width: 'min(420px, 100vw)', animation: 'slideInRight 0.3s ease-out' }}
            >
                {/* Header */}
                <div className="sticky top-0 bg-slate-900 border-b border-slate-700 px-5 py-4 flex items-center justify-between z-10">
                    <div>
                        <div className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-1">Primary Suspect Analysis</div>
                        <h2 className="text-lg font-bold text-white flex items-center gap-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                            {account.account_id}
                        </h2>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-8 h-8 flex items-center justify-center rounded-full bg-slate-700 hover:bg-slate-600 text-slate-300 text-lg transition-colors"
                    >
                        ×
                    </button>
                </div>

                <div className="px-5 py-6 space-y-6">
                    {/* Score badge & Ring Context */}
                    <div className="flex flex-col gap-4">
                        <ScoreBadge score={account.suspicion_score} />
                        
                        {(() => {
                            const ring = fraudRings?.find((r) => r.ring_id === account.ring_id);
                            if (!ring) return null;
                            const prefix = ring.pattern_type.substring(0, 3).toUpperCase();
                            const topAccount = account.account_id;
                            const shortAcc = topAccount.length > 8 ? topAccount.substring(0,8) + '...' : topAccount;
                            
                            return (
                                <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-3 flex flex-col gap-1 mt-2">
                                    <div className="text-[10px] uppercase tracking-widest text-[#00e5ff] font-bold">Ring Context</div>
                                    <div className="text-sm text-slate-300">
                                        Primary suspect driving <span className="text-white font-bold">{prefix} : {shortAcc}</span>.
                                    </div>
                                    <div className="text-xs text-slate-400 mt-1">
                                        This is a <span className="text-amber-400">{ring.pattern_type}</span> network containing {ring.member_accounts?.length || 0} linked nodes with a collective risk score of {ring.risk_score.toFixed(1)}.
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Detected patterns */}
                    <div className="flex flex-wrap gap-2">
                        {(account.detected_patterns || []).map((p) => (
                            <span key={p} className="px-2 py-0.5 bg-amber-900/40 border border-amber-700 text-amber-300 text-xs rounded font-mono">
                                {p}
                            </span>
                        ))}
                    </div>

                    {/* Narrative */}
                    <div className="space-y-3">
                        {paragraphs.map((para, i) => (
                            <p
                                key={i}
                                className={`text-sm leading-relaxed ${para.startsWith('⚠') ? 'text-fuchsia-300 bg-fuchsia-950/30 border border-fuchsia-800 rounded-lg px-3 py-2' : para.startsWith('Suspicion') ? 'text-slate-400 text-xs font-mono bg-slate-800 rounded-lg px-3 py-2' : 'text-slate-300'}`}
                            >
                                {para}
                            </p>
                        ))}
                    </div>

                    {/* Stats grid */}
                    <div className="border-t border-slate-700 pt-4">
                        <h3 className="text-xs text-slate-500 uppercase tracking-widest mb-3">Account Statistics</h3>
                        <div className="grid grid-cols-2 gap-2 text-xs">
                            {[
                                { label: 'Total Transactions', value: stats?.txCount ?? '—' },
                                { label: 'Total Sent', value: fmtCurrency(stats?.totalSent) },
                                { label: 'Total Received', value: fmtCurrency(stats?.totalReceived) },
                                { label: 'Unique Counterparties', value: ((typeof stats?.uniqueSenders === 'number' ? stats.uniqueSenders : stats?.uniqueSenders?.size || 0) + (typeof stats?.uniqueReceivers === 'number' ? stats.uniqueReceivers : stats?.uniqueReceivers?.size || 0)) },
                                { label: 'First Seen', value: firstSeen },
                                { label: 'Last Seen', value: lastSeen },
                                { label: 'Active Period', value: `${activeDays} days` },
                                { label: 'Assigned Ring', value: account.ring_id || '—' },
                            ].map(({ label, value }) => (
                                <div key={label} className="bg-slate-950/50 border border-slate-800 rounded-lg px-3 py-2">
                                    <div className="text-[10px] uppercase font-bold tracking-wider text-slate-500 mb-0.5">{label}</div>
                                    <div className="text-[#00e5ff] font-mono text-sm truncate">{value}</div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
