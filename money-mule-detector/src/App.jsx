import React, { useState, useCallback, useEffect } from 'react';
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
  const [activeTab, setActiveTab] = useState('graph');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);
  const [showLanding, setShowLanding] = useState(true);

  // â”€â”€â”€ Persistence: restore results on refresh â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    try {
      const saved = localStorage.getItem('threat_vision_results');
      const savedTx = localStorage.getItem('threat_vision_transactions');
      const savedGraph = localStorage.getItem('threat_vision_graph');
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
      }
    } catch (e) {
      console.warn('Failed to restore session:', e);
      localStorage.removeItem('threat_vision_results');
      localStorage.removeItem('threat_vision_transactions');
      localStorage.removeItem('threat_vision_graph');
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
        localStorage.setItem('threat_vision_results', JSON.stringify(result));
        localStorage.setItem('threat_vision_transactions', JSON.stringify(txRows));
        if (neo4jGraph) {
          localStorage.setItem('threat_vision_graph', JSON.stringify(neo4jGraph));
        } else {
          localStorage.setItem('threat_vision_graph', JSON.stringify(buildLocalGraphData(txRows, result.suspicious_accounts || [])));
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
    localStorage.removeItem('threat_vision_results');
    localStorage.removeItem('threat_vision_transactions');
    localStorage.removeItem('threat_vision_graph');
    localStorage.removeItem('threat_vision_data');
    window.location.reload();
  };

  // â”€â”€â”€ Derived data â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  const suspiciousAccounts = analysisResults?.suspicious_accounts || [];
  const fraudRings = analysisResults?.fraud_rings || [];
  const summary = analysisResults?.summary || {};

  // suspiciousAccountIds Set for heatmap
  const suspiciousAccountIds = new Set(suspiciousAccounts.map((a) => a.account_id));

  // Build a nodeStats-compatible object for RiskExplanationPanel
  // (maps account_id â†’ basic stats derived from results)
  const nodeStats = {};
  for (const acc of suspiciousAccounts) {
    nodeStats[acc.account_id] = {
      suspicion_score: acc.suspicion_score,
      detected_patterns: acc.detected_patterns,
      ring_id: acc.ring_id,
      ringMemberships: fraudRings
        .filter((r) => r.member_accounts.includes(acc.account_id))
        .map((r) => r.ring_id),
      txCount: 0,
      uniqueSenders: 0,
      uniqueReceivers: 0,
    };
  }

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

  // â”€â”€â”€ Main Dashboard Layout â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <div
      className="h-screen w-full text-brand-text flex overflow-hidden"
      style={{
        background: 'radial-gradient(ellipse at 20% 20%, rgba(0,229,255,0.04) 0%, transparent 50%), radial-gradient(ellipse at 80% 80%, rgba(168,85,247,0.04) 0%, transparent 50%), #0a0e1a'
      }}
    >
      {/* dot-grid texture overlay */}
      <div className="dot-grid absolute inset-0 pointer-events-none z-0 opacity-[0.03]" />
      
      {/* â”€â”€â”€ Sidebar â”€â”€â”€ */}
      <aside className="w-[210px] glass-sidebar flex flex-col z-20 transition-all flex-shrink-0 relative">
        <div className="p-6 flex items-center gap-3" style={{ borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
          <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[#00e5ff] to-[#a855f7] flex items-center justify-center shadow-[0_0_16px_rgba(0,229,255,0.4)]">
            <ActivitySquare className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-[17px] font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            ThreatVision
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-1">
          <div style={{ fontSize: '10px', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', fontWeight: 600, textTransform: 'uppercase', marginBottom: '16px', paddingLeft: '12px' }}>
            Menu
          </div>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                style={isActive ? {
                  background: 'rgba(0,229,255,0.08)',
                  border: '1px solid rgba(0,229,255,0.25)',
                  borderLeft: '3px solid #00e5ff',
                  boxShadow: '0 0 16px rgba(0,229,255,0.1), inset 0 0 12px rgba(0,229,255,0.05)',
                  color: '#00e5ff',
                  borderRadius: '10px',
                } : {
                  background: 'transparent',
                  border: '1px solid transparent',
                  borderLeft: '3px solid transparent',
                  color: '#8892a4',
                  borderRadius: '10px',
                }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 font-medium text-sm transition-all duration-200
                  ${!isActive ? 'hover:text-white' : ''}`}
                onMouseEnter={e => { if (!isActive) { e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; e.currentTarget.style.border = '1px solid rgba(255,255,255,0.1)'; e.currentTarget.style.borderLeft = '3px solid transparent'; e.currentTarget.style.color = '#ffffff'; }}}
                onMouseLeave={e => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.border = '1px solid transparent'; e.currentTarget.style.borderLeft = '3px solid transparent'; e.currentTarget.style.color = '#8892a4'; }}}
              >
                <Icon style={{ width: 18, height: 18, color: isActive ? '#00e5ff' : 'currentColor', opacity: isActive ? 1 : 0.7 }} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4" style={{ borderTop: '1px solid rgba(255,255,255,0.06)' }}>
          <button
            onClick={handleReset}
            style={{
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)',
              borderRadius: '10px',
              backdropFilter: 'blur(10px)',
              color: 'white',
              transition: 'all 0.2s ease',
            }}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 text-sm font-medium"
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(0,229,255,0.4)'; e.currentTarget.style.boxShadow = '0 0 12px rgba(0,229,255,0.15)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; e.currentTarget.style.boxShadow = 'none'; }}
          >
            <Upload className="w-4 h-4" />
            Upload New Data
          </button>
        </div>
      </aside>

      {/* â”€â”€â”€ Main Content Area â”€â”€â”€ */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative z-10">
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full flex-1 flex flex-col gap-6 animate-fadeIn">
          
          {/* Top Header Row */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div className="flex flex-col md:flex-row md:items-center gap-6 lg:gap-10">
              <div>
                <h2 style={{ fontSize: '26px', fontWeight: 800, color: 'white', letterSpacing: '-0.02em', lineHeight: 1 }}>Threat Overview</h2>
                <p style={{ color: '#8892a4', fontSize: '13px', marginTop: 4 }}>Live Graph Analysis</p>
              </div>
              
              <div className="hidden md:flex items-center gap-4">
                {/* KPI: Total Accounts */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  backdropFilter: 'blur(10px)',
                }}>
                  <Users style={{ width: 18, height: 18, color: '#00e5ff' }} />
                  <div>
                    <p style={{ color: 'white', fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>{(summary.total_accounts_analyzed || 0).toLocaleString()}</p>
                    <p style={{ color: '#8892a4', fontSize: '11px', marginTop: 2 }}>Total Accounts</p>
                  </div>
                </div>
                {/* KPI: Flagged Entities */}
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '10px',
                  padding: '8px 16px',
                  backdropFilter: 'blur(10px)',
                }}>
                  <AlertTriangle style={{ width: 18, height: 18, color: '#ff4d6d' }} />
                  <div>
                    <p style={{ color: 'white', fontWeight: 700, fontSize: '18px', lineHeight: 1 }}>{(summary.suspicious_accounts_flagged || 0).toLocaleString()}</p>
                    <p style={{ color: '#8892a4', fontSize: '11px', marginTop: 2 }}>Flagged Entities</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search bar */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '999px',
              padding: '8px 16px',
              backdropFilter: 'blur(10px)',
            }} className="hidden lg:flex">
               <Search style={{ width: 15, height: 15, color: '#8892a4' }} />
               <input
                style={{ background: 'transparent', border: 'none', outline: 'none', fontSize: '13px', color: 'white', width: '180px' }}
                placeholder="Search..."
                onFocus={e => e.currentTarget.parentElement.style.cssText += 'border-color: rgba(0,229,255,0.4); box-shadow: 0 0 0 3px rgba(0,229,255,0.08);'}
                onBlur={e => e.currentTarget.parentElement.style.cssText += 'border-color: rgba(255,255,255,0.1); box-shadow: none;'}
               />
            </div>
          </div>

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
                      fraudRings={fraudRings}
                      onSelectAccount={handleSelectAccount}
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
                  onSelectAccount={handleSelectAccount}
                />
              )}

              {/* Timeline Heatmap */}
                            {activeTab === 'heatmap' && (
                <div className="flex flex-col min-h-[900px] w-full overflow-hidden bg-[#030303] relative border-2 border-slate-800 rounded-b-xl z-0">
                  <LampContainer className="w-full h-full min-h-[900px]">
                    <div style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      width: '100%',
                      padding: '0 40px 40px 40px',
                      zIndex: 50,
                      position: 'relative',
                      marginTop: '-24px'
                    }}>
                      <motion.h1
                        initial={{ opacity: 0.5, y: 100 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }}
                        style={{
                          fontSize: '32px',
                          fontWeight: 800,
                          color: '#ffffff',
                          letterSpacing: '-0.02em',
                          textAlign: 'center',
                          marginBottom: '8px',
                          marginTop: '24px'
                        }}
                      >
                        Temporal Heatmap
                      </motion.h1>
                      <motion.p
                        initial={{ opacity: 0.5, y: 100 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.4, duration: 0.8, ease: "easeInOut" }}
                        style={{
                          fontSize: '13px',
                          color: 'rgba(0, 229, 255, 0.7)',
                          textAlign: 'center',
                          letterSpacing: '0.08em',
                          textTransform: 'uppercase',
                          marginBottom: '32px'
                        }}
                      >
                        Suspicious Transaction Flow Over Time
                      </motion.p>
                      
                      <div style={{
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: '100%',
                        paddingLeft: '40px',
                        paddingRight: '40px'
                      }}>
                        <TemporalHeatmap transactions={transactions} suspiciousAccountIds={suspiciousAccountIds} />
                      </div>
                    </div>
                  </LampContainer>
                </div>
              )}

              {/* Ring Overlap */}
{activeTab === 'overlap' && (
                <div className="h-[800px] flex justify-center items-center bg-slate-950 border-2 border-slate-800">
                  <RingOverlapVisualization
                    fraudRings={fraudRings}
                    suspiciousAccounts={suspiciousAccounts}
                    nodeStats={nodeStats}
                  />
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
            onClose={handleClosePanel}
          />
        )}
      </main>
    </div>
  );
}
