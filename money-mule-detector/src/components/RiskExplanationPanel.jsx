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
    ArrowDownLeft
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
    const angle = (score / 100) * 180 - 180;
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
    
    const sorted = [...timestamps].sort((a,b) => a-b);
    const min = sorted[0].getTime();
    const max = sorted[sorted.length-1].getTime();
    const range = max - min || 1;
    
    // Simple binning by hour
    const bins = 20;
    const data = new Array(bins).fill(0);
    sorted.forEach(ts => {
        const idx = Math.min(bins - 1, Math.floor(((ts.getTime() - min) / range) * bins));
        data[idx]++;
    });
    
    const maxBin = Math.max(...data) || 1;
    const points = data.map((val, i) => `${(i / (bins - 1)) * 100},${40 - (val / maxBin) * 35}`).join(' ');

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
            if (tx.sender_id === accountId || tx.receiver_id === accountId) {
                const other = tx.sender_id === accountId ? tx.receiver_id : tx.sender_id;
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

const ActionToolbar = () => (
    <div className="grid grid-cols-3 gap-2 py-4 border-y border-slate-800">
        <button className="flex flex-col items-center gap-2 p-2 rounded-lg bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-all group">
            <Flag size={16} className="text-red-400 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold text-red-300 uppercase tracking-tighter">Flag_Suspect</span>
        </button>
        <button className="flex flex-col items-center gap-2 p-2 rounded-lg bg-[#00e5ff]/10 border border-[#00e5ff]/20 hover:bg-[#00e5ff]/20 hover:border-[#00e5ff]/40 transition-all group">
            <Download size={16} className="text-[#00e5ff] group-hover:translate-y-0.5 transition-transform" />
            <span className="text-[9px] font-bold text-[#00e5ff] uppercase tracking-tighter">Export_Dossier</span>
        </button>
        <button className="flex flex-col items-center gap-2 p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/20 hover:bg-indigo-500/20 hover:border-indigo-500/40 transition-all group">
            <Eye size={16} className="text-indigo-400 group-hover:scale-110 transition-transform" />
            <span className="text-[9px] font-bold text-indigo-300 uppercase tracking-tighter">Isolate_Node</span>
        </button>
    </div>
);

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

                    {/* Panel */}
                    <motion.div
                        initial={{ x: '100%', opacity: 0 }}
                        animate={{ x: 0, opacity: 1 }}
                        exit={{ x: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed top-0 right-0 h-full z-50 bg-[#0a0e1a]/95 backdrop-blur-xl border-l border-white/10 overflow-y-auto shadow-[0_0_50px_rgba(0,0,0,0.8)]"
                        style={{ width: 'min(420px, 100vw)' }}
                    >
                        {/* Header */}
                        <div className="sticky top-0 bg-[#0a0e1a]/80 backdrop-blur-md border-b border-white/5 px-6 py-5 flex items-center justify-between z-10">
                            <div>
                                <div className="text-[10px] text-[#00e5ff] font-black uppercase tracking-[0.2em] mb-1 opacity-70">
                                    Forensic_Dossier_ID
                                </div>
                                <HyperText className="text-xl font-black text-white p-0 h-auto leading-none" duration={1000}>
                                    {account.account_id}
                                </HyperText>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-white/5 hover:bg-white/10 text-white transition-all border border-white/5 hover:scale-105 active:scale-95"
                            >
                                <X size={20} />
                            </button>
                        </div>

                        <div className="px-6 py-8 space-y-8 pb-12">
                            {/* Performance Tier: Risk Gauge */}
                            <div className="flex items-center justify-between p-4 bg-gradient-to-br from-white/5 to-transparent rounded-2xl border border-white/5">
                                <RiskGauge score={account.suspicion_score} />
                                <div className="text-right">
                                    <div className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-1">Risk_Level</div>
                                    <div className={`text-2xl font-black italic tracking-tighter ${
                                        account.suspicion_score >= 75 ? 'text-red-500' : 
                                        account.suspicion_score >= 50 ? 'text-orange-500' : 'text-amber-400'
                                    }`}>
                                        {account.suspicion_score >= 75 ? 'CRITICAL' : 
                                         account.suspicion_score >= 50 ? 'ELEVATED' : 'MODERATE'}
                                    </div>
                                    <div className="text-[9px] text-slate-400 mt-1 font-mono uppercase">HEURISTIC_SCORE_MATCH</div>
                                </div>
                            </div>

                            {/* Behavioral Pulse Tier */}
                            <ActivitySparkline timestamps={sortedTs} />

                            {/* Relationship Intelligence Tier */}
                            <CounterpartyList accountId={account.account_id} transactions={transactions} />

                            {/* Patterns Tier */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-2">
                                    <ShieldAlert size={14} className="text-amber-400" />
                                    <span className="text-[10px] uppercase tracking-widest text-slate-400 font-bold">Detected_Anomalies</span>
                                </div>
                                <div className="flex flex-wrap gap-2">
                                    {(account.detected_patterns || []).map((p) => (
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
                                <div className="space-y-3">
                                    {paragraphs.map((para, i) => (
                                        <motion.div
                                            key={i}
                                            initial={{ x: 20, opacity: 0 }}
                                            animate={{ x: 0, opacity: 1 }}
                                            transition={{ delay: 0.1 * i }}
                                            className={`text-xs leading-relaxed p-4 rounded-xl border ${
                                                para.startsWith('⚠') 
                                                    ? 'bg-fuchsia-500/10 border-fuchsia-500/20 text-fuchsia-300' 
                                                    : para.startsWith('Suspicion') 
                                                        ? 'bg-slate-950/20 border-white/5 text-slate-400 font-mono italic' 
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
                                <div className="grid grid-cols-2 gap-3">
                                    {[
                                        { label: 'Transactions', value: stats?.txCount ?? '0', icon: Activity },
                                        { label: 'Outflow', value: fmtCurrency(stats?.totalSent), icon: ArrowUpRight },
                                        { label: 'Inflow', value: fmtCurrency(stats?.totalReceived), icon: ArrowDownLeft },
                                        { label: 'First Contact', value: firstSeen, icon: Clock },
                                        { label: 'Active Period', value: `${activeDays} Days`, icon: Calendar },
                                        { label: 'Network Ring', value: account.ring_id || 'Isolated', icon: ShieldAlert },
                                    ].map(({ label, value, icon: Icon }) => (
                                        <div key={label} className="bg-slate-950/40 border border-slate-800 p-3 rounded-xl hover:border-white/10 transition-colors">
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
                            <ActionToolbar />
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

// REMOVE ScoreBadge as it's replaced by RiskGauge in the main layout
