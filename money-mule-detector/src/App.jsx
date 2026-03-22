import React, { useState, useCallback, useEffect, useMemo } from 'react';
import { 
  Network, 
  ShieldAlert, 
  Activity, 
  Layers, 
  FileJson, 
  Upload,
  ActivitySquare,
  Search,
  Users,
  AlertTriangle
} from 'lucide-react';
import CSVUploader from './components/CSVUploader.jsx';
import GraphVisualization from './components/GraphVisualization.jsx';
import { RiskScoreTrendChart, FlaggedEntitiesChart, RiskDistributionDonut, RingActivityBar } from './components/DashboardCharts.jsx';
import FraudRingTable from './components/FraudRingTable.jsx';
import TemporalHeatmap from './components/TemporalHeatmap.jsx';
import RiskExplanationPanel from './components/RiskExplanationPanel.jsx';
import RingOverlapVisualization from './components/RingOverlapVisualization.jsx';
import { EncryptedText } from './components/ui/encrypted-text.jsx';
import { LampContainer } from './components/ui/lamp.jsx';
import { analyzeCSV } from './api/analyzeApi.js';
import { fetchGraphData, buildLocalGraphData } from './api/graphApi.js';
// eslint-disable-next-line no-unused-vars
import { motion, AnimatePresence } from 'framer-motion';
import LandingPage from './components/LandingPage.jsx';

const TABS = [
  { id: 'graph', label: 'Graph View', icon: Network },
  { id: 'table', label: 'Fraud Rings', icon: ShieldAlert },
  { id: 'heatmap', label: 'Timeline Heatmap', icon: Activity },
  { id: 'overlap', label: 'Ring Overlap', icon: Layers },
  { id: 'json', label: 'JSON Export', icon: FileJson },
];

export default function App() {
  // â”€â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const [analysisResults, setAnalysisResults] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [graphData, setGraphData] = useState(null);   // Neo4j graph analytics
  const [, setRawFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [isolatedNodeId, setIsolatedNodeId] = useState(null);
  const [activeTab, setActiveTab] = useState('graph');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);
  const [flaggedAccounts, setFlaggedAccounts] = useState(new Set());

  // â”€â”€â”€ Persistence: restore results on refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem('threat_vision_results');
      const savedTx = sessionStorage.getItem('threat_vision_transactions');
      const savedGraph = sessionStorage.getItem('threat_vision_graph');
      if (saved && savedTx) {
        setShowLanding(false);
        const parsedResults = JSON.parse(saved);
        const parsedTx = JSON.parse(savedTx);
        setAnalysisResults(parsedResults);
        setTransactions(parsedTx);
        if (savedGraph) {
          setGraphData(JSON.parse(savedGraph));
        } else {
           // Fallback if graph data wasn't saved but we have txs
           setGraphData(buildLocalGraphData(parsedTx, parsedResults.suspicious_accounts || []));
        }
        
        const savedFlags = sessionStorage.getItem('threat_vision_flags');
        if (savedFlags) {
          setFlaggedAccounts(new Set(JSON.parse(savedFlags)));
        }
      }
    } catch (e) {
      console.warn('Failed to restore session:', e);
      sessionStorage.removeItem('threat_vision_results');
      sessionStorage.removeItem('threat_vision_transactions');
      sessionStorage.removeItem('threat_vision_graph');
    }
  }, []);

  // â”€â”€â”€ Upload handler (uses backend API) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleFileUpload = useCallback(async (file) => {
    setRawFile(file);
    setIsProcessing(true);
    setError('');
    setLoadingMessage('Sending to Neo4j backend...');

    try {
      const result = await analyzeCSV(file, setLoadingMessage);

      // Extract embedded transaction rows returned from backend
      const txRows = result._transactions || [];
      delete result._transactions;

      // Normalize ring_ids: ensure every suspicious account has a ring_ids array
      for (const acc of result.suspicious_accounts || []) {
        if (!acc.ring_ids) {
          acc.ring_ids = acc.ring_id ? [acc.ring_id] : [];
        }
      }

      setAnalysisResults(result);
      setTransactions(txRows);

      // â”€â”€ Fetch Neo4j graph analytics â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      setLoadingMessage('Fetching Neo4j graph analytics...');
      const neo4jGraph = await fetchGraphData();
      if (neo4jGraph) {
        // Enrich nodes with suspicion scores from analysis result
        const accMap = {};
        for (const acc of result.suspicious_accounts || []) accMap[acc.account_id] = acc;
        for (const n of neo4jGraph.nodes) {
          if (accMap[n.id]) n.suspicionScore = accMap[n.id].suspicion_score;
        }
        setGraphData(neo4jGraph);
      } else {
        // Fallback: build graph from local transactions
        setGraphData(buildLocalGraphData(txRows, result.suspicious_accounts || []));
      }

      // Persist results
      try {
        sessionStorage.setItem('threat_vision_results', JSON.stringify(result));
        sessionStorage.setItem('threat_vision_transactions', JSON.stringify(txRows));
        if (neo4jGraph) {
          sessionStorage.setItem('threat_vision_graph', JSON.stringify(neo4jGraph));
        } else {
          sessionStorage.setItem('threat_vision_graph', JSON.stringify(buildLocalGraphData(txRows, result.suspicious_accounts || [])));
        }
      } catch (e) {
        console.warn('Storage quota exceeded, skipping persistence:', e);
      }
    } catch (err) {
      console.error('Analysis error:', err);
      setError(`Analysis failed: ${err.message}`);
    } finally {
      setIsProcessing(false);
      setLoadingMessage('');
    }
  }, []);

  // â”€â”€â”€ Account selection â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleSelectAccount = useCallback((acc) => {
    setSelectedAccount(acc);
    setIsPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedAccount(null);
  }, []);

  const handleToggleFlag = useCallback((accountId) => {
    setFlaggedAccounts(prev => {
      const next = new Set(prev);
      if (next.has(accountId)) next.delete(accountId);
      else next.add(accountId);
      
      // Persist to sessionStorage
      try {
        sessionStorage.setItem('threat_vision_flags', JSON.stringify([...next]));
      } catch (e) {
        console.warn('Failed to save flags:', e);
      }

      return next;
    });
  }, []);

  const handleIsolateNode = useCallback((accountId) => {
    setActiveTab('graph');
    setIsolatedNodeId(accountId);
    setIsPanelOpen(false); // Close panel to see the graph clearly
  }, []);

  // â”€â”€â”€ JSON download â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleDownload = useCallback(() => {
    if (analysisResults) {
      const jsonStr = JSON.stringify(analysisResults, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = 'threat_vision_report.json';
      a.click();
      URL.revokeObjectURL(url);
    }
  }, [analysisResults]);

  // â”€â”€â”€ Reset â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const handleReset = () => {
    sessionStorage.removeItem('threat_vision_results');
    sessionStorage.removeItem('threat_vision_transactions');
    sessionStorage.removeItem('threat_vision_graph');
    sessionStorage.removeItem('threat_vision_data');
    window.location.reload();
  };

  // â”€â”€â”€ Derived data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const suspiciousAccounts = analysisResults?.suspicious_accounts || [];
  const fraudRings = analysisResults?.fraud_rings || [];
  const summary = analysisResults?.summary || {};

  // suspiciousAccountIds Set for heatmap
  const suspiciousAccountIds = useMemo(() => 
    new Set(suspiciousAccounts.map((a) => String(a.account_id).trim())),
  [suspiciousAccounts]);

  // Build a nodeStats-compatible object for RiskExplanationPanel
  const nodeStats = useMemo(() => {
    const stats = {};
    for (const acc of suspiciousAccounts) {
      const accountTx = transactions.filter(tx => tx.sender_id === acc.account_id || tx.receiver_id === acc.account_id);
      const uniqueSenders = new Set(accountTx.map(t => t.sender_id).filter(id => id !== acc.account_id));
      const uniqueReceivers = new Set(accountTx.map(t => t.receiver_id).filter(id => id !== acc.account_id));

      stats[acc.account_id] = {
        suspicion_score: acc.suspicion_score,
        detected_patterns: acc.detected_patterns,
        ring_id: acc.ring_id,
        ringMemberships: fraudRings
          .filter((r) => r.member_accounts && Array.isArray(r.member_accounts) && r.member_accounts.includes(acc.account_id))
          .map((r) => r.ring_id),
        txCount: accountTx.length,
        totalSent: accountTx.filter(t => t.sender_id === acc.account_id).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
        totalReceived: accountTx.filter(t => t.receiver_id === acc.account_id).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
        uniqueSenders: uniqueSenders,
        uniqueReceivers: uniqueReceivers,
        timestamps: accountTx.map(t => new Date(t.timestamp)),
        amounts: accountTx.map(t => parseFloat(t.amount) || 0)
      };
    }

    // Add verified entities to nodeStats so the research panel can display forensic clearance
    for (const ent of analysisResults?.verified_entities || []) {
      const accountTx = (transactions || []).filter(tx => tx.sender_id === ent.account_id || tx.receiver_id === ent.account_id);
      stats[ent.account_id] = {
        isVerified: true,
        classification: ent.classification,
        suspicion_score: 0,
        detected_patterns: [],
        ring_id: 'Monitored Segment',
        ringMemberships: [],
        txCount: accountTx.length,
        totalSent: accountTx.filter(t => t.sender_id === ent.account_id).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
        totalReceived: accountTx.filter(t => t.receiver_id === ent.account_id).reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
        uniqueSenders: new Set(accountTx.map(t => t.sender_id).filter(id => id !== ent.account_id)),
        uniqueReceivers: new Set(accountTx.map(t => t.receiver_id).filter(id => id !== ent.account_id)),
        timestamps: accountTx.map(t => new Date(t.timestamp)),
        amounts: accountTx.map(t => parseFloat(t.amount) || 0)
      };
    }
    return stats;
  }, [suspiciousAccounts, transactions, fraudRings, analysisResults]);

  // Build analysisResults-compatible shape for SummaryPanel (can be used later)

  // â”€â”€â”€ Show CSV uploader if no results â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (!analysisResults && !isProcessing) {
    if (showLanding) {
      return <LandingPage onGetStarted={() => setShowLanding(false)} />;
    }

    return (
      <>
        <CSVUploader onFileSelected={handleFileUpload} isProcessing={false} onBack={() => setShowLanding(true)} />
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-600 text-red-200 rounded-xl px-5 py-3 text-sm shadow-xl max-w-lg text-center z-50">
            {error}
          </div>
        )}
      </>
    );
  }

  // â”€â”€â”€ Show loading state â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-8"
           style={{ background: 'radial-gradient(ellipse at 50% 40%, rgba(0,229,255,0.06) 0%, transparent 60%), #0a0e1a' }}>
        {/* Spinner */}
        <div style={{
          width: 72, height: 72, borderRadius: '50%',
          border: '3px solid rgba(0,229,255,0.15)',
          borderTopColor: '#00e5ff',
          animation: 'spin 1s linear infinite',
          boxShadow: '0 0 20px rgba(0,229,255,0.25)',
        }} />

        {/* Tagline with EncryptedText */}
        <div className="text-center px-8 max-w-xl">
          <p style={{ fontSize: '22px', fontWeight: 700, color: 'white', letterSpacing: '0.01em', lineHeight: 1.4, marginBottom: 12 }}>
            <EncryptedText
              text="Every suspicious pattern has a story. We find it."
              speed={35}
              revealDelay={300}
            />
          </p>
          <p style={{ fontSize: '13px', color: '#8892a4', fontFamily: 'monospace', letterSpacing: '0.06em' }}>
            {loadingMessage}
          </p>
        </div>

        {/* Subtle pulsing dots */}
        <div style={{ display: 'flex', gap: 8, marginTop: -8 }}>
          {[0, 1, 2].map(i => (
            <span key={i} style={{
              width: 6, height: 6, borderRadius: '50%',
              background: '#00e5ff',
              opacity: 0.5,
              animation: `glowPulse 1.4s ease-in-out ${i * 0.2}s infinite`,
            }} />
          ))}
        </div>
      </div>
    );
  }

  // ─── Main Dashboard Layout ──────────────────────────────────────────
  return (
    <div className="flex min-h-screen bg-surface font-body text-on-surface overflow-hidden">
      
      {/* ─── Sidebar ─── */}
      <aside className="fixed left-0 top-0 h-full z-50 flex flex-col w-72 border-r border-slate-800/50 bg-slate-950/60 backdrop-blur-xl shadow-2xl shadow-black/50 overflow-hidden">
        {/* Brand Header */}
        <div className="p-8 pb-4">
          <div className="text-2xl font-black tracking-tighter text-cyan-400 drop-shadow-[0_0_8px_rgba(6,182,212,0.5)] font-headline">
            ThreatVision
          </div>
          <div className="font-headline tracking-wider uppercase text-[11px] font-bold text-slate-400 mt-1">
            Intelligence Terminal
          </div>
        </div>
        
        {/* CTA Zone */}
        <div className="px-6 py-4 border-b border-slate-800/50 mb-4 pb-6">
          <button
            onClick={handleReset}
            className="w-full bg-gradient-to-br from-primary to-primary-container text-on-primary-container py-3 px-4 rounded-xl font-headline font-bold text-sm tracking-wide active:scale-[0.98] transition-transform flex items-center justify-center gap-2 hover:shadow-[0_0_15px_rgba(83,221,252,0.4)]"
          >
            <Upload className="w-4 h-4" />
            Upload New Data
          </button>
        </div>

        {/* Navigation Mock (For aesthetic consistency with Stitch UI mockup) */}
        <nav className="flex-1 overflow-y-auto space-y-1">
          <a href="#" className="relative flex items-center gap-3 px-8 py-4 text-cyan-400 before:absolute before:left-0 before:h-8 before:w-1 before:bg-cyan-400 before:shadow-[0_0_12px_rgba(6,182,212,1)] bg-cyan-400/5 font-headline tracking-wider uppercase text-[11px] font-bold transition-all duration-300">
            <ActivitySquare className="w-4 h-4" /> Overview
          </a>
          <a href="#" className="flex items-center gap-3 px-8 py-4 text-slate-400 hover:text-slate-200 transition-colors hover:bg-slate-800/40 font-headline tracking-wider uppercase text-[11px] font-bold">
            <Activity className="w-4 h-4" /> Analytics
          </a>
          <a href="#" className="flex items-center gap-3 px-8 py-4 text-slate-400 hover:text-slate-200 transition-colors hover:bg-slate-800/40 font-headline tracking-wider uppercase text-[11px] font-bold">
            <Search className="w-4 h-4" /> Investigations
          </a>
          <a href="#" className="flex items-center gap-3 px-8 py-4 text-slate-400 hover:text-slate-200 transition-colors hover:bg-slate-800/40 font-headline tracking-wider uppercase text-[11px] font-bold">
            <ShieldAlert className="w-4 h-4" /> Threat Hunt
          </a>
        </nav>
      </aside>

      {/* ─── Main Content Canvas ─── */}
      <main className="flex-1 ml-72 bg-surface min-h-screen relative overflow-x-hidden overflow-y-auto flex flex-col">
        {/* Decorative Background Gradient Bleed */}
        <div className="absolute top-[-10%] right-[-5%] w-[600px] h-[600px] bg-primary/5 blur-[120px] rounded-full pointer-events-none z-0"></div>
        <div className="absolute bottom-[-10%] left-[-5%] w-[400px] h-[400px] bg-secondary/5 blur-[100px] rounded-full pointer-events-none z-0"></div>
        
        {/* TopNavBar with Tabs */}
        <header className="sticky top-0 right-0 w-full flex justify-between items-center px-8 z-40 bg-slate-950/40 backdrop-blur-md h-16 border-b border-slate-800/30 flex-shrink-0">
          <div className="flex items-center gap-8 h-full">
            <div className="font-headline text-sm font-medium flex gap-8 h-full">
              {TABS.map((tab) => {
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`relative h-full flex items-center gap-2 cursor-pointer transition-all ${isActive ? 'text-cyan-400 font-bold' : 'text-slate-400 hover:text-slate-100'}`}
                  >
                    <tab.icon className="w-4 h-4 hidden md:block" />
                    {tab.label}
                    {isActive && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 h-1 w-12 rounded-t-lg bg-cyan-400 shadow-[0_0_8px_rgba(6,182,212,0.8)]"></span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative group hidden lg:block">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 w-4 h-4 group-focus-within:text-primary transition-colors" />
              <input
                type="text"
                placeholder="Scan identifiers..."
                className="bg-surface-container-highest/50 border border-outline-variant/20 rounded-xl pl-10 pr-4 py-1.5 text-xs focus:ring-1 focus:ring-primary focus:border-primary outline-none transition-all w-64 placeholder:text-slate-600 text-on-surface"
              />
            </div>
          </div>
        </header>

        {/* Dashboard Content Area */}
        <div className="p-8 lg:p-12 z-10 flex-col flex gap-8 flex-1">
          {/* Page Header */}
          <section className="flex flex-col gap-1">
            <h1 className="font-headline text-4xl lg:text-5xl font-black tracking-tight text-on-surface">Dashboard Overview</h1>
            <p className="text-on-surface-variant font-body text-sm max-w-2xl mt-2 leading-relaxed">
              Real-time monitoring of global actor identities. Systems are currently operational with <span className="text-primary font-bold">99.98% accuracy</span> in heuristic detection patterns.
            </p>
          </section>
          {/* Grid of Glassmorphism Statistic Cards */}
          <section className="py-2">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              
              {/* Card 1: Total Accounts */}
              <div className="glass-card p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Users className="w-16 h-16 text-primary" />
                </div>
                <div className="flex flex-col gap-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <Users className="w-5 h-5 text-primary" />
                    <span className="font-headline font-bold text-[11px] tracking-widest uppercase text-slate-400">Total Accounts</span>
                  </div>
                  <div>
                    <span className="font-headline text-3xl font-black text-on-surface drop-shadow-[0_0_12px_rgba(83,221,252,0.4)]">{(summary.total_accounts_analyzed || 0).toLocaleString()}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary bg-primary/10 w-fit px-2 py-0.5 rounded-full">
                    <Activity className="w-3 h-3" />
                    LIVE SYNC
                  </div>
                </div>
              </div>

              {/* Card 2: Verified Legitimate */}
              <div className="glass-card p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <ShieldAlert className="w-16 h-16 text-emerald-400" />
                </div>
                <div className="flex flex-col gap-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <ShieldAlert className="w-5 h-5 text-emerald-400" />
                    <span className="font-headline font-bold text-[11px] tracking-widest uppercase text-slate-400">Verified Legitimate</span>
                  </div>
                  <div>
                    <span className="font-headline text-3xl font-black text-on-surface drop-shadow-[0_0_12px_rgba(52,211,153,0.4)]">
                      {((analysisResults?.verified_entities || []).length).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-emerald-400 bg-emerald-400/10 w-fit px-2 py-0.5 rounded-full">
                    <ActivitySquare className="w-3 h-3" />
                    TRUSTED
                  </div>
                </div>
              </div>

              {/* Card 3: Suspicious Entities */}
              <div className="glass-card p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <AlertTriangle className="w-16 h-16 text-secondary" />
                </div>
                <div className="flex flex-col gap-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <AlertTriangle className="w-5 h-5 text-secondary" />
                    <span className="font-headline font-bold text-[11px] tracking-widest uppercase text-slate-400">Suspicious Entities</span>
                  </div>
                  <div>
                    <span className="font-headline text-3xl font-black text-on-surface drop-shadow-[0_0_12px_rgba(172,138,255,0.4)]">
                      {(summary.suspicious_accounts_flagged || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-secondary bg-secondary/10 w-fit px-2 py-0.5 rounded-full">
                    <Search className="w-3 h-3" />
                    HIGH WATCH
                  </div>
                </div>
              </div>

              {/* Card 4: Fraud Rings */}
              <div className="glass-card p-6 relative overflow-hidden group">
                <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Network className="w-16 h-16 text-tertiary" />
                </div>
                <div className="flex flex-col gap-4 relative z-10">
                  <div className="flex items-center gap-2">
                    <Network className="w-5 h-5 text-tertiary" />
                    <span className="font-headline font-bold text-[11px] tracking-widest uppercase text-slate-400">Fraud Rings</span>
                  </div>
                  <div>
                    <span className="font-headline text-3xl font-black text-on-surface drop-shadow-[0_0_12px_rgba(255,113,106,0.4)]">
                      {(summary.fraud_rings_detected || 0).toLocaleString()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[10px] font-bold text-tertiary bg-tertiary/10 w-fit px-2 py-0.5 rounded-full">
                    <Layers className="w-3 h-3" />
                    ACTION REQ.
                  </div>
                </div>
              </div>

            </div>
          </section>

          {/* Error banner */}
          {error && (
            <div className="bg-brand-red/10 border border-brand-red/30 text-brand-red px-5 py-4 text-sm rounded-xl font-medium flex items-center gap-3">
              <ShieldAlert className="w-5 h-5" />
              {error}
            </div>
          )}

          {/* Dynamic Board Area */}
          {activeTab === 'graph' ? (
            <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-6 overflow-hidden">
              
              {/* CENTER COLUMN (spanning 2 columns) */}
              <div className="lg:col-span-2 flex flex-col gap-6 overflow-y-auto custom-scrollbar h-full pr-2">
                
                {/* ROW 1: Trend Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[220px] flex-shrink-0">
                  <div className="glass-card p-5 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-center mb-4 z-10">
                      <h3 style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>Risk Score Trend</h3>
                      <button style={{ color: 'rgba(255,255,255,0.4)' }}>&#8942;</button>
                    </div>
                    <div className="flex-1 -mx-5 -mb-5 relative z-0">
                      <RiskScoreTrendChart data={suspiciousAccounts} />
                    </div>
                  </div>
                  <div className="glass-card p-5 flex flex-col relative overflow-hidden">
                    <div className="flex justify-between items-start mb-2 z-10">
                      <div>
                        <h3 style={{ fontSize: '42px', fontWeight: 700, color: 'white', lineHeight: 1 }}>{(summary.suspicious_accounts_flagged || 0)}</h3>
                        <p style={{ fontSize: '12px', color: '#8892a4', marginTop: 4 }}>Flagged Today</p>
                      </div>
                      <button style={{ color: 'rgba(255,255,255,0.4)' }}>&#8942;</button>
                    </div>
                    <div className="flex-1 -mx-5 -mb-5 relative z-0">
                      <FlaggedEntitiesChart fraudRings={fraudRings} />
                    </div>
                  </div>
                </div>

                {/* ROW 2: Main Graph Card (Hero) */}
                <div className="glass-card glass-card-hero flex flex-col relative overflow-hidden min-h-[420px] flex-shrink-0" style={{ borderRadius: '16px' }}>
                  <div className="absolute top-5 left-5 z-10 flex gap-3 items-center pointer-events-none">
                     <h3 style={{ fontSize: '16px', fontWeight: 700, color: 'white' }}>Network Visualization</h3>
                     <span style={{ background: 'rgba(0,229,255,0.08)', border: '1px solid rgba(0,229,255,0.2)', borderRadius: '20px', padding: '3px 10px', color: '#00e5ff', fontSize: '11px', fontWeight: 500 }}>
                       {graphData?.nodes?.length || 0} NODES &middot; {graphData?.edges?.length || 0} EDGES
                     </span>
                  </div>
                  <div className="flex-1 h-full w-full">
                    <GraphVisualization
                      graphData={graphData}
                      suspiciousAccounts={suspiciousAccounts}
                      verifiedEntities={analysisResults?.verified_entities || []}
                      flaggedAccounts={flaggedAccounts}
                      fraudRings={fraudRings}
                      onSelectAccount={handleSelectAccount}
                      showHeader={false}
                    />
                  </div>
                </div>

                {/* ROW 3: Secondary Charts */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 h-[260px] flex-shrink-0 mb-6">
                  <div className="glass-card p-5 flex flex-col relative">
                    <h3 style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff', marginBottom: 8 }}>Account Risk Distribution</h3>
                    <div className="flex-1 relative flex items-center justify-center">
                       <span className="absolute text-center flex flex-col items-center justify-center pointer-events-none z-10">
                          <span style={{ fontSize: '28px', fontWeight: 800, color: 'white', lineHeight: 1 }}>{(summary.total_accounts_analyzed || 0)}</span>
                          <span style={{ fontSize: '10px', color: '#8892a4', textTransform: 'uppercase', marginTop: 4 }}>Total</span>
                       </span>
                       <RiskDistributionDonut suspiciousAccounts={suspiciousAccounts} />
                    </div>
                  </div>
                  <div className="glass-card p-5 flex flex-col relative">
                    <div className="flex justify-between items-center mb-2">
                       <h3 style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>Ring Activity Timeline</h3>
                       <span style={{ fontSize: '10px', background: 'rgba(0,229,255,0.15)', border: '1px solid rgba(0,229,255,0.35)', borderRadius: '6px', padding: '2px 8px', color: '#00e5ff', fontWeight: 600 }}>+{fraudRings.length} rings</span>
                    </div>
                    <div className="flex-1 -mx-5 relative w-[calc(100%+40px)]">
                       <RingActivityBar fraudRings={fraudRings} />
                    </div>
                  </div>
                </div>
              </div>

              {/* RIGHT SIDEBAR */}
              <div className="lg:col-span-1 flex flex-col gap-5 overflow-y-auto h-full w-[300px] flex-shrink-0">
                 
                 {/* TOP ALERT */}
                 <div className="glass-card overflow-hidden">
                    <div style={{ height: '120px', background: 'linear-gradient(135deg, rgba(0,229,255,0.1), rgba(168,85,247,0.1))', borderRadius: '10px 10px 0 0', position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', padding: '16px', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.08)_0%,transparent_70%)]" />
                       <Network style={{ width: 60, height: 60, color: '#00e5ff', opacity: 0.15 }} />
                       <span style={{ position: 'absolute', top: 12, left: 12, background: 'rgba(0,229,255,0.12)', border: '1px solid rgba(0,229,255,0.3)', borderRadius: '4px', color: '#00e5ff', fontSize: '10px', fontWeight: 700, letterSpacing: '0.1em', padding: '2px 8px' }}>NEW ALERT</span>
                    </div>
                    <div className="p-5">
                       <p style={{ fontWeight: 600, color: 'white', fontSize: '13px', lineHeight: 1.5 }}>Critical fraud rings detected &mdash; smurfing pattern active.</p>
                       <p style={{ fontSize: '12px', color: '#8892a4', marginTop: 8 }}>Immediate review recommended.</p>
                    </div>
                 </div>

                 {/* TOP RISK ACCOUNTS */}
                 <div className="glass-card p-5">
                    <div className="flex items-center justify-between mb-4">
                       <h3 style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff' }}>Top Risk Accounts</h3>
                       <button style={{ color: 'rgba(255,255,255,0.4)' }}>
                         <Layers style={{ width: 15, height: 15 }} />
                       </button>
                    </div>
                    <div>
                       {(suspiciousAccounts || []).slice(0, 4).map((acc, i) => {
                         const barClasses = ['bar-cyan','bar-orange','bar-cyan','bar-purple'];
                         return (
                           <div key={acc.account_id} style={{ padding: '10px 0', borderBottom: i < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none' }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                                 <span style={{ fontSize: '13px', color: 'white', fontWeight: 600 }}>{acc.account_id}</span>
                                 <span style={{ fontSize: '12px', color: '#8892a4' }}>{acc.suspicion_score.toFixed(0)}</span>
                              </div>
                              <div style={{ width: '100%', background: 'rgba(255,255,255,0.06)', borderRadius: '999px', height: '3px' }}>
                                 <div className={`h-full rounded-full ${barClasses[i] || 'bar-cyan'}`} style={{ width: `${Math.min(100, acc.suspicion_score)}%`, transition: 'width 0.6s ease-out' }} />
                              </div>
                           </div>
                         );
                       })}
                       {(!suspiciousAccounts || suspiciousAccounts.length === 0) && <p style={{ fontSize: '12px', color: '#8892a4' }}>No risky accounts detected.</p>}
                    </div>
                 </div>

                 {/* RECENT ALERTS */}
                 <div className="glass-card p-5 flex-1">
                    <h3 style={{ fontWeight: 600, fontSize: '14px', color: '#ffffff', marginBottom: 16 }}>Recent Alerts</h3>
                    <div>
                       {(fraudRings || []).slice(0, 4).map((ring, idx) => {
                         const isSmurfing = ring.pattern_type === 'smurfing';
                         const iconBorder = isSmurfing ? 'rgba(255,77,109,0.4)' : 'rgba(0,229,255,0.3)';
                         return (
                           <div key={ring.ring_id} style={{ padding: '12px 0', borderBottom: idx < 3 ? '1px solid rgba(255,255,255,0.05)' : 'none', display: 'flex', gap: 12, alignItems: 'flex-start' }}>
                              <div style={{ width: 28, height: 28, borderRadius: '50%', background: 'rgba(255,255,255,0.04)', border: `1px solid ${iconBorder}`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>&#9679;</div>
                              <div>
                                 <p style={{ fontSize: '13px', fontWeight: 600, color: isSmurfing ? '#ff4d6d' : 'white', marginBottom: 4 }}>{ring.ring_id}</p>
                                 <p style={{ fontSize: '11px', color: '#8892a4', lineHeight: 1.4 }}>Detected {ring.member_accounts.length} linked accounts forming a {ring.pattern_type} pattern.</p>
                              </div>
                           </div>
                         );
                       })}
                       {(!fraudRings || fraudRings.length === 0) && (
                          <p style={{ fontSize: '12px', color: '#8892a4' }}>No recent alerts found.</p>
                       )}
                    </div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="glass-card flex-1 overflow-hidden flex flex-col relative min-h-[600px]" style={{ borderRadius: '16px' }}>
              {/* Fraud Rings Table */}
              {activeTab === 'table' && (
                <FraudRingTable
                  fraudRings={fraudRings}
                  suspiciousAccounts={suspiciousAccounts}
                  flaggedAccounts={flaggedAccounts}
                  onSelectAccount={handleSelectAccount}
                  onToggleFlag={handleToggleFlag}
                />
              )}

              {/* Network Graph */}
              {activeTab === 'graph' && (
                <GraphVisualization 
                  graphData={graphData}
                  suspiciousAccounts={suspiciousAccounts}
                  verifiedEntities={analysisResults?.verified_entities || []}
                  fraudRings={fraudRings}
                  onSelectAccount={handleSelectAccount}
                  flaggedAccounts={flaggedAccounts}
                  isolatedNodeId={isolatedNodeId}
                  onResetIsolation={() => setIsolatedNodeId(null)}
                />
              )}

              {/* Timeline Heatmap */}
              {activeTab === 'heatmap' && (
                <div className="flex flex-col h-full w-full overflow-hidden bg-transparent">
                  <div className="p-6 border-b border-white/5 flex flex-col justify-center items-center shrink-0">
                    <h1 className="text-2xl font-black tracking-tight text-white font-headline mb-2">Temporal Heatmap</h1>
                    <p className="text-sm text-cyan-400 font-headline uppercase tracking-widest font-bold">Suspicious Transaction Flow Over Time</p>
                  </div>
                  <div className="flex-1 overflow-auto custom-scrollbar flex flex-col items-center justify-center p-8">
                    <TemporalHeatmap transactions={transactions} suspiciousAccountIds={suspiciousAccountIds} />
                  </div>
                </div>
              )}

              {/* Ring Overlap */}
              {activeTab === 'overlap' && (
                <div className="flex flex-col h-full w-full overflow-hidden bg-transparent">
                  <div className="p-6 border-b border-white/5 flex flex-col justify-center items-center shrink-0">
                    <h1 className="text-2xl font-black tracking-tight text-white font-headline mb-2">Ring Overlap Intelligence</h1>
                    <p className="text-sm text-cyan-400 font-headline uppercase tracking-widest font-bold">Cross-Network Entity Relationships</p>
                  </div>
                  <div className="flex-1 overflow-hidden flex justify-center items-center relative">
                    <RingOverlapVisualization
                      fraudRings={fraudRings}
                      suspiciousAccounts={suspiciousAccounts}
                      nodeStats={nodeStats}
                    />
                  </div>
                </div>
              )}

              {/* JSON Export */}
              {activeTab === 'json' && (
                <div className="h-full flex flex-col p-6 overflow-hidden">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6 bg-slate-900 border border-slate-700/50 p-6 rounded-2xl shadow-xl">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center border border-purple-500/20 shadow-inner">
                        <FileJson className="w-6 h-6 text-purple-400" />
                      </div>
                      <div>
                        <h3 className="text-xl font-bold text-white tracking-tight">Raw Data Export</h3>
                        <p className="text-sm text-slate-400 mt-0.5">View and download the complete analysis results in JSON format.</p>
                      </div>
                    </div>
                    <button
                      onClick={handleDownload}
                      className="group flex items-center justify-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 text-white rounded-xl transition-all shadow-lg hover:shadow-purple-500/25 border border-purple-400/20 font-semibold w-full md:w-auto"
                    >
                      <Upload className="w-5 h-5 group-hover:-translate-y-1 transition-transform rotate-180" />
                      Download JSON
                    </button>
                  </div>
                  
                  <div className="flex-1 relative bg-[#0a0f18] rounded-2xl border border-slate-800 shadow-inner overflow-hidden flex flex-col">
                    <div className="flex items-center gap-2 px-4 py-3 bg-slate-900/80 border-b border-slate-800 backdrop-blur-md">
                      <div className="flex gap-2">
                        <div className="w-3 h-3 rounded-full bg-rose-500/20 border border-rose-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                        <div className="w-3 h-3 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                      </div>
                      <span className="text-xs text-slate-500 ml-3 font-mono">analysis_results.json</span>
                    </div>
                    <pre
                      className="p-6 text-emerald-400/90 font-mono text-sm overflow-auto flex-1 custom-scrollbar leading-relaxed"
                    >
                      {JSON.stringify(analysisResults, null, 2)}
                    </pre>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Risk Explanation Panel */}
        {isPanelOpen && selectedAccount && (
          <RiskExplanationPanel
            account={selectedAccount}
            nodeStats={nodeStats}
            transactions={transactions}
            fraudRings={fraudRings}
            isFlagged={flaggedAccounts.has(selectedAccount.account_id)}
            onToggleFlag={() => handleToggleFlag(selectedAccount.account_id)}
            onIsolate={() => handleIsolateNode(selectedAccount.account_id)}
            onClose={handleClosePanel}
          />
        )}
      </main>
    </div>
  );
}
