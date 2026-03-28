import React, { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
    X, 
    ShieldAlert, 
    TrendingUp, 
    Users, 
    Clock, 
    Calendar, 
    Activity, 
    Download, 
    Eye, 
    Flag,
    AlertCircle,
    ArrowUpRight,
    ArrowDownLeft,
    ShieldCheck
} from 'lucide-react';
import { HyperText } from './ui/hyper-text.jsx';

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
    if (n === undefined || n === null) return '$0.00';
    return '$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// PREMIUM COMPONENTS
const RiskGauge = ({ score }) => {
    let color = '#EAB308'; // Medium
    if (score >= 75) color = '#EF4444'; // Critical
    else if (score >= 50) color = '#F97316'; // High
    else if (score < 25) color = '#10B981'; // Low

    return (
        <div className="relative w-32 h-20 flex items-center justify-center overflow-hidden">
            <svg className="w-full h-full" viewBox="0 0 100 60">
                <path 
                    d="M 10 50 A 40 40 0 0 1 90 50" 
                    fill="none" 
                    stroke="#1e293b" 
                    strokeWidth="8" 
                    strokeLinecap="round" 
                />
                <motion.path 
                    d="M 10 50 A 40 40 0 0 1 90 50" 
                    fill="none" 
                    stroke={color} 
                    strokeWidth="8" 
                    strokeLinecap="round"
                    initial={{ pathLength: 0 }}
                    animate={{ pathLength: score / 100 }}
                    transition={{ duration: 1.5, ease: "easeOut" }}
                />
            </svg>
            <div className="absolute top-8 flex flex-col items-center">
                <motion.span 
                    className="text-2xl font-black text-white leading-none"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{ opacity: 1, scale: 1 }}
                >
                    {score}
                </motion.span>
                <span className="text-[8px] text-slate-500 uppercase font-bold tracking-tighter">PHREAT_INDEX</span>
            </div>
        </div>
    );
};

const ActivitySparkline = ({ timestamps }) => {
    if (!timestamps || timestamps.length < 2) return null;
    
    const sorted = [...timestamps].filter(t => t instanceof Date && !isNaN(t.getTime())).sort((a,b) => a.getTime() - b.getTime());
    if (sorted.length < 2) return null;
    
    const min = sorted[0].getTime();
    const max = sorted[sorted.length-1].getTime();
    const range = max - min || 1;
    
    // Simple binning by hour
    const bins = 20;
    const data = new Array(bins).fill(0);
    sorted.forEach(ts => {
        const val = ts.getTime();
        const idx = Math.min(bins - 1, Math.floor(((val - min) / range) * bins));
        if (!isNaN(idx) && idx >= 0) data[idx]++;
    });
    
    const maxBin = Math.max(...data) || 1;
    const points = data.map((val, i) => {
        const x = (i / (bins - 1)) * 100;
        const y = 40 - (val / maxBin) * 35;
        return `${isNaN(x) ? 0 : x},${isNaN(y) ? 40 : y}`;
    }).join(' ');

    return (
        <div className="bg-slate-950/40 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                    <Activity size={14} className="text-[#00e5ff]" />
                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Velocity_Pulse</span>
                </div>
                <div className="text-[10px] text-slate-500 font-mono italic">REAL_TIME_BEHAVIOR</div>
            </div>
            <svg className="w-full h-10 overflow-visible" viewBox="0 0 100 40" preserveAspectRatio="none">
                <motion.polyline
                    fill="none"
                    stroke="#00e5ff"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={points}
                    initial={{ pathLength: 0, opacity: 0 }}
                    animate={{ pathLength: 1, opacity: 1 }}
                    transition={{ duration: 1.2, ease: "easeInOut" }}
                />
            </svg>
        </div>
    );
};

function generateNarrative(account, nodeStats, transactions, fraudRings) {
    if (!account) return [];
    const stats = nodeStats[account.account_id] || {};
    
    if (stats.isVerified) {
        return [
            `EXEMPTION LOGIC ACTIVATED: This entity has been classified as "${stats.classification}" by the intelligent monitoring engine.`,
            `Visual inspection confirms this account exhibits high-volume, low-variance transaction patterns typical of legitimate commercial entities. Our real-time filters have cleared this node from the active fraud investigation.`,
            `System Status: "Verified Legitimate". This entity is monitored as part of the background fee and micro-spend baseline.`
        ];
    }

    const patterns = (account.detected_patterns || []).filter((p) => VALID_PATTERNS.has(p));
    const paragraphs = [];

    for (const pattern of patterns) {
        if (pattern === 'cycle_length_3') {
            const ring = fraudRings?.find((r) => r.ring_id === account.ring_id);
            const members = ring?.member_accounts || [];
            if (members.length > 0) {
                const idx = members.indexOf(account.account_id);
                const next1 = members[(idx + 1) % members.length] || '?';
                const next2 = members[(idx + 2) % members.length] || '?';
                paragraphs.push(
                    `This account is part of a 3-hop circular fund routing ring. Money flows from ${account.account_id} → ${next1} → ${next2} → back to ${account.account_id}, a classic layering technique used to obscure the origin of illicit funds. This is the highest-risk cycle pattern — money returns to its origin in just 3 hops.`
                );
            } else {
                paragraphs.push(`This account is implicated in a 3-hop circular fund routing ring, facilitating rapid fund rotation.`);
            }
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

const CounterpartyList = ({ accountId, transactions }) => {
    const counterparties = useMemo(() => {
        if (!transactions) return [];
        const map = new Map();
        transactions.forEach(tx => {
            if (!tx || !tx.amount) return;
            if (tx.sender_id === accountId || tx.receiver_id === accountId) {
                const other = tx.sender_id === accountId ? tx.receiver_id : tx.sender_id;
                if (!other) return;
                if (!map.has(other)) map.set(other, { id: other, count: 0, volume: 0 });
                const entry = map.get(other);
                entry.count++;
                entry.volume += parseFloat(tx.amount) || 0;
            }
        });
        return Array.from(map.values())
            .sort((a, b) => b.volume - a.volume)
            .slice(0, 3);
    }, [accountId, transactions]);

    if (counterparties.length === 0) return null;

    return (
        <div className="bg-slate-950/40 border border-slate-700/50 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-3">
                <Users size={14} className="text-[#00e5ff]" />
                <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Top_Counterparties</span>
            </div>
            <div className="space-y-2">
                {counterparties.map((cp, idx) => (
                    <div key={cp.id} className="flex items-center justify-between p-2 bg-white/5 rounded-lg border border-white/5 group hover:border-[#00e5ff]/30 transition-all">
                        <div className="flex items-center gap-3">
                            <div className="w-6 h-6 rounded bg-[#00e5ff]/10 flex items-center justify-center text-[10px] font-bold text-[#00e5ff]">
                                {idx + 1}
                            </div>
                            <span className="text-xs font-mono text-slate-300 group-hover:text-white transition-colors">{cp.id}</span>
                        </div>
                        <div className="text-right">
                            <div className="text-[10px] font-bold text-white">{fmtCurrency(cp.volume)}</div>
                            <div className="text-[9px] text-slate-500">{cp.count} txns</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
};

const ActionToolbar = ({ isFlagged, onToggleFlag, onExport, onIsolate, account, stats }) => (
    <div className="grid grid-cols-3 gap-2 py-4 border-y border-slate-800">
        <button 
            onClick={onToggleFlag}
            className={`flex flex-col items-center gap-2 p-2 rounded-lg border transition-all group ${
                isFlagged 
                ? 'bg-red-500/30 border-red-500/60 shadow-[0_0_15px_rgba(239,68,68,0.3)]' 
                : 'bg-red-500/10 border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40'
            }`}>
            <Flag size={16} className={`${isFlagged ? 'text-red-500 fill-red-500' : 'text-red-400'} group-hover:scale-110 transition-transform`} />
            <span className={`text-[9px] font-bold uppercase tracking-tighter ${isFlagged ? 'text-red-400' : 'text-slate-400'}`}>
                {isFlagged ? 'UNFLAG_SUSPECT' : (stats?.isVerified ? 'RECLASSIFY_THREAT' : 'FLAG_SUSPECT')}
            </span>
        </button>
        <button 
            onClick={onExport}
            className="flex flex-col items-center gap-2 p-2 rounded-lg bg-[#00e5ff]/10 border border-[#00e5ff]/20 hover:bg-[#00e5ff]/20 hover:border-[#00e5ff]/40 transition-all group">
            <Download size={16} className="text-[#00e5ff] group-hover:translate-y-0.5 transition-transform" />
            <span className="text-[9px] font-bold text-[#00e5ff] uppercase tracking-tighter">Export_Dossier</span>
        </button>
        <button 
            onClick={onIsolate}
            className="flex flex-col items-center gap-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all group">
            <Eye size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-tighter">Isolate_Node</span>
        </button>
    </div>
);

export default function RiskExplanationPanel({ 
    account, 
    nodeStats, 
    transactions, 
    fraudRings, 
    isFlagged,
    onToggleFlag,
    onIsolate,
    onClose 
}) {

    // Defend against missing stats
    const stats = useMemo(() => {
        if (!account || !nodeStats) return null;
        return nodeStats[account.account_id] || {
            isVerified: false,
            suspicion_score: account.suspicion_score || 0,
            detected_patterns: account.detected_patterns || [],
            txCount: 0,
            timestamps: [],
            amounts: []
        };
    }, [account, nodeStats]);

    const paragraphs = useMemo(() => {
        try {
            return generateNarrative(account, nodeStats, transactions, fraudRings);
        } catch (e) {
            console.error('Narrative generation failed:', e);
            return ['Error generating forensic narrative.'];
        }
    }, [account, nodeStats, transactions, fraudRings]);

    if (!account) return null;

    try {
        const timestamps = stats?.timestamps || [];
        const sortedTs = [...timestamps].filter(t => t instanceof Date && !isNaN(t.getTime())).sort((a, b) => a.getTime() - b.getTime());
        const firstSeen = sortedTs[0] ? fmtDate(sortedTs[0]) : '—';
        const lastSeen = sortedTs[sortedTs.length - 1] ? fmtDate(sortedTs[sortedTs.length - 1]) : '—';
        const activeDays = sortedTs.length >= 2
            ? Math.ceil((sortedTs[sortedTs.length - 1] - sortedTs[0]) / (1000 * 60 * 60 * 24))
            : 0;

        const handleExport = () => {
            try {
                const data = {
                    metadata: {
                        report_type: 'FORENSIC_DOSSIER',
                        generated_at: new Date().toISOString(),
                        investigator_mode: 'THREAT_VISION_INTERNAL',
                    },
                    suspect: {
                        account_id: account.account_id,
                        suspicion_score: account.suspicion_score,
                        risk_level: account.suspicion_score >= 75 ? 'CRITICAL' : (account.suspicion_score >= 50 ? 'ELEVATED' : 'MODERATE'),
                        detected_patterns: account.detected_patterns,
                    },
                    activity_metrics: {
                        transaction_count: stats?.txCount,
                        total_sent: stats?.totalSent,
                        total_received: stats?.totalReceived,
                        first_seen: firstSeen,
                        last_seen: lastSeen,
                        active_days: activeDays,
                    },
                    narrative: paragraphs,
                    context: {
                        fraud_rings: stats?.ringMemberships || [],
                        top_counterparties: transactions
                            ? Array.from(transactions.reduce((acc, tx) => {
                                if (tx.sender_id === account.account_id || tx.receiver_id === account.account_id) {
                                    const other = tx.sender_id === account.account_id ? tx.receiver_id : tx.sender_id;
                                    const current = acc.get(other) || { count: 0, volume: 0 };
                                    acc.set(other, { count: current.count + 1, volume: current.volume + (parseFloat(tx.amount) || 0) });
                                }
                                return acc;
                            }, new Map())).map(([id, stats]) => ({ id, ...stats })).sort((a,b) => b.volume - a.volume).slice(0, 5)
                            : []
                    }
                };

                const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = `DOSSIER_${account.account_id}.json`;
                link.click();
                URL.revokeObjectURL(url);
            } catch (e) {
                console.error('Export failed:', e);
            }
        };

        return (
            <AnimatePresence>
                {account && (
                    <>
                        {/* Dim overlay */}
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
                            onClick={onClose}
                        />

                        {/* Panel Wrapper - Centered */}
                        <div className="fixed inset-0 flex items-center justify-center z-50 p-4 pointer-events-none">
                            <motion.div
                                initial={{ scale: 0.95, opacity: 0, y: 20 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.95, opacity: 0, y: 20 }}
                                transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                className="pointer-events-auto w-full max-w-2xl bg-[#0a0e1a]/95 backdrop-blur-xl border border-white/10 rounded-3xl overflow-hidden shadow-[0_0_100px_rgba(0,0,0,0.9)] max-h-[90vh] flex flex-col"
                            >
                                {/* Header */}
                                <div className="shrink-0 bg-[#0a0e1a]/80 backdrop-blur-md border-b border-white/5 px-8 py-6 flex items-center justify-between z-10">
                                    <div>
                                        <div className={`text-[10px] ${stats?.isVerified ? 'text-emerald-400' : 'text-[#00e5ff]'} font-black uppercase tracking-[0.2em] mb-1 opacity-70`}>
                                            {stats?.isVerified ? 'Forensic_Clearance_ID' : 'Forensic_Dossier_ID'}
                                        </div>
                                        <HyperText className="text-2xl font-black text-white p-0 h-auto leading-none" duration={1000}>
                                            {account.account_id || 'UNKNOWN'}
                                        </HyperText>
                                    </div>
                                    <button
                                        onClick={onClose}
                                        className="w-12 h-12 flex items-center justify-center rounded-2xl bg-white/5 hover:bg-white/10 text-white transition-all border border-white/5 hover:scale-110 active:scale-95 group"
                                    >
                                        <X size={24} className="group-hover:rotate-90 transition-transform duration-300" />
                                    </button>
                                </div>

                                {/* Scrollable Content */}
                                <div className="flex-1 overflow-y-auto px-8 py-8 space-y-10 custom-scrollbar pb-12">
                                    {/* Performance Tier: Risk Gauge */}
                                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 items-center p-6 bg-gradient-to-br ${stats?.isVerified ? 'from-emerald-500/10' : 'from-white/5'} to-transparent rounded-3xl border ${stats?.isVerified ? 'border-emerald-500/20' : 'border-white/5'}`}>
                                        <div className="flex justify-center md:justify-start scale-110">
                                            <RiskGauge score={account.suspicion_score || 0} />
                                        </div>
                                        <div className="text-center md:text-right">
                                            <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">{stats?.isVerified ? 'Verification_Status' : 'Risk_Level'}</div>
                                            <div className={`text-4xl font-black italic tracking-tighter ${
                                                stats?.isVerified ? 'text-emerald-400' :
                                                ((account.suspicion_score || 0) >= 75 ? 'text-red-500' : 
                                                (account.suspicion_score || 0) >= 50 ? 'text-orange-500' : 'text-amber-400')
                                            }`}>
                                                {stats?.isVerified ? 'SAFE/CLEARED' :
                                                 ((account.suspicion_score || 0) >= 75 ? 'CRITICAL' : 
                                                  (account.suspicion_score || 0) >= 50 ? 'ELEVATED' : 'MODERATE')}
                                            </div>
                                            <div className="text-[9px] text-slate-400 mt-1 font-mono uppercase">
                                                {stats?.isVerified ? 'MATCH: LEGITIMATE PATTERN' : 'HEURISTIC_SCORE_MATCH'}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Behavioral Pulse & Relationship Intelligence */}
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <ActivitySparkline timestamps={sortedTs} />
                                        <CounterpartyList accountId={account.account_id} transactions={transactions} />
                                    </div>

                                    {/* Patterns Tier */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            {stats?.isVerified ? <ShieldCheck size={14} className="text-emerald-400" /> : <ShieldAlert size={14} className="text-amber-400" />}
                                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">
                                                {stats?.isVerified ? 'Verified_Classification' : 'Detected_Anomalies'}
                                            </span>
                                        </div>
                                        <div className="flex flex-wrap gap-2">
                                            {stats?.isVerified ? (
                                                <motion.span 
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className="px-3 py-1 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-[10px] rounded-full font-black uppercase tracking-tighter"
                                                >
                                                    {stats.classification}
                                                </motion.span>
                                            ) : (account.detected_patterns || []).map((p) => (
                                                <motion.span 
                                                    key={p} 
                                                    initial={{ scale: 0.8, opacity: 0 }}
                                                    animate={{ scale: 1, opacity: 1 }}
                                                    className="px-3 py-1 bg-amber-500/10 border border-amber-500/30 text-amber-400 text-[10px] rounded-full font-black uppercase tracking-tighter"
                                                >
                                                    {p.replace(/_/g, ' ')}
                                                </motion.span>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-1 gap-3">
                                            {(paragraphs || []).map((para, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ x: 20, opacity: 0 }}
                                                    animate={{ x: 0, opacity: 1 }}
                                                    transition={{ delay: 0.1 * i }}
                                                    className={`text-xs leading-relaxed p-5 rounded-2xl border ${
                                                        stats?.isVerified
                                                            ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-100/80 shadow-[inset_0_0_20px_rgba(16,185,129,0.05)]'
                                                            : para.startsWith('⚠') 
                                                                ? 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300' 
                                                                : para.startsWith('Suspicion') 
                                                                    ? 'bg-slate-950/20 border-white/5 text-slate-400 font-mono italic text-[10px]' 
                                                                    : 'bg-white/5 border-white/5 text-slate-300'
                                                    }`}
                                                >
                                                    {para}
                                                </motion.div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Forensic Dashboard Tier */}
                                    <div className="space-y-4">
                                        <div className="flex items-center gap-2">
                                            <Activity size={14} className="text-[#00e5ff]" />
                                            <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Account_Vital_Stats</span>
                                        </div>
                                        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                                            {[
                                                { label: 'Transactions', value: stats?.txCount ?? '0', icon: Activity },
                                                { label: 'Outflow', value: fmtCurrency(stats?.totalSent), icon: ArrowUpRight },
                                                { label: 'Inflow', value: fmtCurrency(stats?.totalReceived), icon: ArrowDownLeft },
                                                { label: 'First Contact', value: firstSeen, icon: Clock },
                                                { label: 'Active Period', value: `${activeDays} Days`, icon: Calendar },
                                                { label: stats?.isVerified ? 'Monitoring Zone' : 'Network Ring', value: account.ring_id || (stats?.isVerified ? 'Monitored Segment' : 'Isolated Node'), icon: stats?.isVerified ? ShieldCheck : ShieldAlert },
                                            ].map(({ label, value, icon: Icon }) => (
                                                <div key={label} className="bg-slate-950/40 border border-slate-800 p-4 rounded-2xl hover:border-white/10 transition-colors">
                                                    <div className="flex items-center gap-2 mb-1.5 opacity-50">
                                                        <Icon size={12} className="text-[#00e5ff]" />
                                                        <div className="text-[9px] uppercase font-black tracking-widest text-[#00e5ff]">{label}</div>
                                                    </div>
                                                    <div className="text-white font-mono text-xs font-bold truncate">{value}</div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Action Control */}
                                    <ActionToolbar 
                                        isFlagged={isFlagged}
                                        onToggleFlag={onToggleFlag}
                                        onExport={handleExport}
                                        onIsolate={onIsolate}
                                        account={account}
                                        stats={stats}
                                    />
                                </div>
                            </motion.div>
                        </div>
                    </>
                )}
            </AnimatePresence>
        );
    } catch (err) {
        console.error('RiskExplanationPanel render crash:', err);
        return (
            <div className="fixed inset-0 flex items-center justify-center z-[100] bg-slate-900/90 backdrop-blur-md">
                <div className="bg-red-950/50 border border-red-500/50 p-8 rounded-3xl max-w-lg text-center shadow-2xl">
                    <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
                    <h2 className="text-2xl font-black text-white mb-2 uppercase italic tracking-tighter">Forensic Panel Crash</h2>
                    <p className="text-slate-300 mb-6 text-sm">The research module encountered a critical data anomaly and was unable to render this dossier.</p>
                    <button onClick={onClose} className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white font-bold rounded-xl transition-all">Dismiss Dossier</button>
                    <div className="mt-4 p-3 bg-black/40 rounded-lg text-left overflow-auto max-h-32">
                        <code className="text-[10px] text-red-400 leading-tight block">{err.message}</code>
                        <code className="text-[8px] text-red-700 block mt-2">{err.stack?.split('\n').slice(0, 3).join('\n')}</code>
                    </div>
                </div>
            </div>
        );
    }
}

// REMOVE ScoreBadge as it's replaced by RiskGauge in the main layout
