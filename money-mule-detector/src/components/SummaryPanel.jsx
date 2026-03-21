import React from 'react';
import { Users, AlertTriangle, Layers, Clock, ShieldCheck } from 'lucide-react';

// eslint-disable-next-line no-unused-vars
function StatCard({ label, value, icon: Icon, accentClass, trend }) {
    return (
        <div className="bg-brand-card border border-brand-border rounded-2xl p-5 flex items-start gap-4 hover:border-brand-border/80 transition-colors relative overflow-hidden group">
            {/* Subtle glow effect on hover */}
            <div className={`absolute -right-10 -top-10 w-32 h-32 rounded-full blur-3xl opacity-0 group-hover:opacity-10 transition-opacity ${accentClass.replace('text-', 'bg-')}`} />
            
            <div className={`p-3 rounded-xl bg-white/5 border border-white/5 ${accentClass}`}>
                <Icon className="w-6 h-6" />
            </div>
            <div>
                <p className="text-brand-muted text-sm font-medium mb-1">{label}</p>
                <div className="flex items-baseline gap-2">
                    <h4 className="text-2xl font-bold text-white tracking-tight">{value}</h4>
                    {trend && (
                        <span className="text-xs font-semibold text-brand-emerald bg-brand-emerald/10 px-2 py-0.5 rounded-full">
                            {trend}
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
}

export default function SummaryPanel({ analysisResults }) {
    if (!analysisResults) return null;

    const { summary = {} } = analysisResults;

    return (
        <div className="mb-2">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        Dashboard Overview
                        <span className="text-sm font-normal text-brand-muted bg-brand-border/50 px-3 py-1 rounded-full">
                            Live Analysis
                        </span>
                    </h2>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                <StatCard
                    icon={Users} 
                    label="Total Accounts"
                    value={(summary.total_accounts_analyzed || 0).toLocaleString()}
                    accentClass="text-brand-accent"
                />
                <StatCard
                    icon={ShieldCheck} 
                    label="Verified Legitimate"
                    value={(summary.verified_entities_count || 0).toLocaleString()}
                    accentClass="text-emerald-400"
                />
                <StatCard
                    icon={AlertTriangle} 
                    label="Suspicious Entities"
                    value={(summary.suspicious_accounts_flagged || 0).toLocaleString()}
                    accentClass="text-brand-red"
                />
                <StatCard
                    icon={Layers} 
                    label="Fraud Rings Detected"
                    value={(summary.fraud_rings_detected || 0).toLocaleString()}
                    accentClass="text-brand-purple"
                />
                <StatCard
                    icon={Clock} 
                    label="Analysis Time"
                    value={`${summary.processing_time_seconds ?? '—'}s`}
                    accentClass="text-brand-muted"
                />
            </div>
        </div>
    );
}
