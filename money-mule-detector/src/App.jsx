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
import { analyzeCSV } from './api/analyzeApi.js';
import { fetchGraphData, buildLocalGraphData } from './api/graphApi.js';
import { downloadJSON } from './utils/jsonExporter.js';

const TABS = [
  { id: 'graph', label: 'Graph View', icon: Network },
  { id: 'table', label: 'Fraud Rings', icon: ShieldAlert },
  { id: 'heatmap', label: 'Timeline Heatmap', icon: Activity },
  { id: 'overlap', label: 'Ring Overlap', icon: Layers },
  { id: 'json', label: 'JSON Export', icon: FileJson },
];

export default function App() {
  // ─── State ───────────────────────────────────────────────────────────────
  const [analysisResults, setAnalysisResults] = useState(null);
  const [transactions, setTransactions] = useState([]);
  const [graphData, setGraphData] = useState(null);   // Neo4j graph analytics
  const [rawFile, setRawFile] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [loadingMessage, setLoadingMessage] = useState('');
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('graph');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  // ─── Persistence: restore results on refresh ──────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem('threat_vision_results');
      const savedTx = localStorage.getItem('threat_vision_transactions');
      const savedGraph = localStorage.getItem('threat_vision_graph');
      if (saved && savedTx) {
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

  // ─── Upload handler (uses backend API) ───────────────────────────────────
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

      // ── Fetch Neo4j graph analytics ──────────────────────────────────────
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

  // ─── Account selection ────────────────────────────────────────────────────
  const handleSelectAccount = useCallback((acc) => {
    setSelectedAccount(acc);
    setIsPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedAccount(null);
  }, []);

  // ─── JSON download ────────────────────────────────────────────────────────
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

  // ─── Reset ────────────────────────────────────────────────────────────────
  const handleReset = () => {
    localStorage.removeItem('threat_vision_results');
    localStorage.removeItem('threat_vision_transactions');
    localStorage.removeItem('threat_vision_graph');
    localStorage.removeItem('threat_vision_data');
    window.location.reload();
  };

  // ─── Derived data ─────────────────────────────────────────────────────────
  const suspiciousAccounts = analysisResults?.suspicious_accounts || [];
  const fraudRings = analysisResults?.fraud_rings || [];
  const summary = analysisResults?.summary || {};

  // suspiciousAccountIds Set for heatmap
  const suspiciousAccountIds = new Set(suspiciousAccounts.map((a) => a.account_id));

  // Build a nodeStats-compatible object for RiskExplanationPanel
  // (maps account_id → basic stats derived from results)
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

  // Build analysisResults-compatible shape for SummaryPanel
  const summaryPanelResults = analysisResults
    ? {
      suspiciousAccounts,
      fraudRings,
      transactions,
      summary,
      nodeStats,
    }
    : null;

  // ─── Show CSV uploader if no results ─────────────────────────────────────
  if (!analysisResults && !isProcessing) {
    return (
      <>
        <CSVUploader onFileSelected={handleFileUpload} isProcessing={false} />
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-600 text-red-200 rounded-xl px-5 py-3 text-sm shadow-xl max-w-lg text-center z-50">
            {error}
          </div>
        )}
      </>
    );
  }

  // ─── Show loading state ───────────────────────────────────────────────────
  if (isProcessing) {
    return (
      <div className="min-h-screen bg-brand-bg flex flex-col items-center justify-center gap-6">
        <div className="w-20 h-20 rounded-full border-4 border-brand-accent border-t-transparent animate-spin" />
        <div className="text-center">
          <p className="text-brand-accent font-bold text-xl font-mono tracking-wider animate-pulse">
            ⚡ Processing via Neo4j Graph Database...
          </p>
          <p className="text-brand-muted text-sm mt-2 font-mono">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard Layout ──────────────────────────────────────────────────
  return (
    <div className="h-screen w-full bg-brand-bg text-brand-text flex overflow-hidden">
      
      {/* ─── Sidebar ─── */}
      <aside className="w-[210px] bg-brand-sidebar flex flex-col border-r border-brand-border z-20 transition-all flex-shrink-0">
        <div className="p-6 flex items-center gap-3 border-b border-brand-border">
          <div className="w-8 h-8 rounded bg-gradient-to-br from-brand-accent to-brand-purple flex items-center justify-center shadow-lg">
            <ActivitySquare className="w-5 h-5 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400">
            ThreatVision
          </h1>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-6 space-y-2">
          <div className="text-xs font-semibold text-brand-muted uppercase tracking-wider mb-4 px-3">
            Menu
          </div>
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 transition-all font-medium text-sm
                  ${isActive 
                    ? 'border-l-[3px] border-brand-accent bg-brand-accent/10 text-white' 
                    : 'text-brand-muted hover:text-white hover:bg-white/5 border-l-[3px] border-transparent'
                  }`}
              >
                <Icon className={`w-5 h-5 ${isActive ? 'text-brand-accent' : 'opacity-70'}`} />
                {tab.label}
              </button>
            );
          })}
        </nav>

        <div className="p-4 border-t border-brand-border">
          <button
            onClick={handleReset}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-transparent hover:bg-brand-accent/10 text-white border border-white/15 rounded-full hover:border-brand-accent/50 hover:shadow-[0_0_15px_rgba(0,229,255,0.3)] transition-all text-sm font-medium"
          >
            <Upload className="w-4 h-4" />
            Upload New Data
          </button>
        </div>
      </aside>

      {/* ─── Main Content Area ─── */}
      <main className="flex-1 flex flex-col h-screen overflow-y-auto relative bg-[#13151A]">
        <div className="p-6 md:p-8 max-w-[1600px] mx-auto w-full flex-1 flex flex-col gap-6 animate-fadeIn">
          
          {/* Top Header Row matching dashboard reference */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-2">
            <div className="flex flex-col md:flex-row md:items-center gap-6 lg:gap-12">
              <div>
                <h2 className="text-3xl font-bold text-white tracking-tight">Threat Overview</h2>
                <p className="text-brand-muted text-sm mt-1">Live Graph Analysis</p>
              </div>
              
              <div className="hidden md:flex items-center gap-8">
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-brand-accent">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                     <p className="text-white font-bold text-xl leading-none">{(summary.total_accounts_analyzed || 0).toLocaleString()}</p>
                     <p className="text-brand-muted text-xs mt-1">Total Accounts</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="p-3 bg-white/5 border border-white/5 rounded-xl text-brand-red">
                    <AlertTriangle className="w-5 h-5" />
                  </div>
                  <div>
                     <p className="text-white font-bold text-xl leading-none">{(summary.suspicious_accounts_flagged || 0).toLocaleString()}</p>
                     <p className="text-brand-muted text-xs mt-1">Flagged Entities</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex bg-brand-card border border-brand-border rounded-full px-4 py-2 items-center gap-3 shadow-inner hidden lg:flex">
               <Search className="w-4 h-4 text-brand-muted" />
               <input className="bg-transparent border-none outline-none text-sm text-white placeholder-brand-muted w-48" placeholder="Search..." />
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
                  {/* Risk Score Trend */}
                  <div className="bg-brand-card rounded-[14px] border border-brand-border p-5 flex flex-col relative overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-brand-accent/20 transition-colors">
                    <div className="flex justify-between items-center mb-4 z-10">
                      <h3 className="text-sm font-semibold text-white">Risk Score Trend</h3>
                      <button className="text-brand-muted hover:text-white">...</button>
                    </div>
                    <div className="flex-1 -mx-5 -mb-5 relative z-0">
                      <RiskScoreTrendChart data={suspiciousAccounts} />
                    </div>
                  </div>

                  {/* Flagged Entities */}
                  <div className="bg-brand-card rounded-[14px] border border-brand-border p-5 flex flex-col relative overflow-hidden shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-brand-accent/20 transition-colors">
                    <div className="flex justify-between items-start mb-2 z-10">
                      <div>
                        <h3 className="text-3xl font-bold text-white leading-none">{(summary.suspicious_accounts_flagged || 0)}</h3>
                        <p className="text-xs text-brand-muted mt-1">Flagged Today</p>
                      </div>
                      <button className="text-brand-muted hover:text-white">...</button>
                    </div>
                    <div className="flex-1 -mx-5 -mb-5 relative z-0">
                      <FlaggedEntitiesChart fraudRings={fraudRings} />
                    </div>
                  </div>
                </div>

                {/* ROW 2: Main Graph Card (Hero) */}
                <div className="bg-brand-card rounded-[14px] border border-brand-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex flex-col relative overflow-hidden min-h-[420px] flex-shrink-0 hover:border-brand-accent/20 transition-colors">
                  <div className="absolute top-5 left-5 z-10 flex gap-4 items-baseline pointer-events-none">
                     <h3 className="text-lg font-bold text-white">Network Visualization</h3>
                     <span className="text-[10px] font-bold text-brand-accent tracking-widest">{graphData?.nodes?.length || 0} NODES · {graphData?.links?.length || 0} EDGES</span>
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
                  {/* Account Risk Donut */}
                  <div className="bg-brand-card rounded-[14px] border border-brand-border p-5 flex flex-col relative shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-brand-accent/20 transition-colors">
                    <h3 className="text-sm font-semibold text-white mb-2">Account Risk Distribution</h3>
                    <div className="flex-1 relative flex items-center justify-center">
                       <span className="absolute text-center flex flex-col items-center justify-center pointer-events-none z-10">
                          <span className="text-2xl font-bold text-white leading-none">{(summary.total_accounts_analyzed || 0)}</span>
                          <span className="text-[10px] text-brand-muted uppercase">Total</span>
                       </span>
                       <RiskDistributionDonut suspiciousAccounts={suspiciousAccounts} />
                    </div>
                  </div>

                  {/* Ring Activity Bar */}
                  <div className="bg-brand-card rounded-[14px] border border-brand-border p-5 flex flex-col relative shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-brand-accent/20 transition-colors">
                    <div className="flex justify-between items-center mb-2">
                       <h3 className="text-sm font-semibold text-white">Ring Activity Timeline</h3>
                       <span className="text-[10px] bg-brand-accent/20 text-brand-accent px-2 py-0.5 rounded-full font-bold">+{fraudRings.length} rings</span>
                    </div>
                    <div className="flex-1 -mx-5 relative w-[calc(100%+40px)]">
                       <RingActivityBar fraudRings={fraudRings} />
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Sidebar Columns matching reference */}
              <div className="lg:col-span-1 flex flex-col gap-6 overflow-y-auto custom-scrollbar h-full w-[300px] flex-shrink-0 relative">
                 
                 {/* Top Featured Alert (like Threat Intelligence) */}
                 <div className="bg-brand-card rounded-[14px] border border-brand-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] overflow-hidden">
                    <div className="h-32 bg-gradient-to-br from-brand-sidebar via-brand-purple/20 to-brand-accent/20 relative flex items-center justify-center border-b border-brand-border/50 p-4 overflow-hidden">
                       <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(0,229,255,0.1)_0%,transparent_70%)]" />
                       <Network className="w-16 h-16 text-brand-accent opacity-20" />
                       <span className="absolute top-4 left-4 bg-brand-accent/20 border border-brand-accent text-brand-accent text-[10px] font-bold px-2 py-0.5 rounded-sm tracking-wider">NEW ALERT</span>
                    </div>
                    <div className="p-5">
                       <p className="font-bold text-white text-sm leading-snug">Critical fraud rings detected — smurfing pattern active.</p>
                       <p className="text-xs text-brand-muted mt-2">Immediate review recommended.</p>
                    </div>
                 </div>

                 {/* Top Risk Accounts (like Referrals) */}
                 <div className="bg-brand-card rounded-[14px] p-5 border border-brand-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] hover:border-brand-accent/20 transition-colors">
                    <div className="flex items-center justify-between mb-4">
                       <h3 className="text-sm font-semibold text-white">Top Risk Accounts</h3>
                       <button className="text-brand-muted hover:text-white"><Layers className="w-4 h-4" /></button>
                    </div>
                    <div className="space-y-4">
                       {(suspiciousAccounts || []).slice(0, 4).map((acc, i) => (
                         <div key={acc.account_id}>
                            <div className="flex justify-between text-xs mb-1.5">
                               <span className="text-white font-medium">{acc.account_id}</span>
                               <span className="text-brand-muted">{acc.suspicion_score.toFixed(0)} score</span>
                            </div>
                            <div className="w-full bg-[#13151A] rounded-full h-1.5 overflow-hidden border border-brand-border/50">
                               <div 
                                  className={`h-full rounded-full ${i === 0 ? 'bg-brand-red' : i === 1 ? 'bg-orange-500' : i === 2 ? 'bg-brand-accent' : 'bg-brand-purple'}`} 
                                  style={{ width: `${Math.min(100, acc.suspicion_score)}%` }} 
                               />
                            </div>
                         </div>
                       ))}
                       {(!suspiciousAccounts || suspiciousAccounts.length === 0) && <p className="text-xs text-brand-muted">No risky accounts detected.</p>}
                    </div>
                 </div>

                 {/* Recent Alerts (like Your Heystack) */}
                 <div className="bg-brand-card rounded-[14px] p-5 border border-brand-border shadow-[0_4px_24px_rgba(0,0,0,0.3)] flex-1 hover:border-brand-accent/20 transition-colors">
                    <h3 className="text-sm font-semibold text-white mb-4">Recent Alerts</h3>
                    <div className="space-y-0">
                       {(fraudRings || []).slice(0, 4).map((ring, idx) => (
                         <div key={ring.ring_id} className={`py-3 flex gap-3 items-start ${idx !== 0 ? 'border-t border-brand-border/50' : ''}`}>
                            <div className="mt-1 flex-shrink-0">
                               <div className="w-3 h-3 rounded-full border-2 border-brand-muted/50 flex items-center justify-center">
                                  <div className="w-1 h-1 bg-brand-muted rounded-full"></div>
                               </div>
                            </div>
                            <div>
                               <p className="text-sm font-medium text-white mb-0.5">Ring: {ring.ring_id}</p>
                               <p className="text-xs text-brand-muted leading-snug">Detected {ring.member_accounts.length} linked accounts forming a {ring.pattern_type} pattern.</p>
                            </div>
                         </div>
                       ))}
                       {(!fraudRings || fraudRings.length === 0) && (
                          <p className="text-xs text-brand-muted">No recent alerts found.</p>
                       )}
                    </div>
                 </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 bg-brand-card rounded-2xl border border-brand-border shadow-2xl overflow-hidden flex flex-col relative min-h-[600px]">
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
              <div className="p-6">
                <TemporalHeatmap
                  transactions={transactions}
                  suspiciousAccountIds={suspiciousAccountIds}
                />
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
                <div className="p-8 h-full flex flex-col">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-lg font-bold">JSON Data Export</h3>
                    <button
                      onClick={handleDownload}
                      className="flex items-center gap-2 px-4 py-2 bg-brand-accent/20 text-brand-accent hover:bg-brand-accent hover:text-brand-bg rounded-lg transition-colors text-sm font-semibold"
                    >
                      <Upload className="w-4 h-4 rotate-180" />
                      Download JSON
                    </button>
                  </div>
                  <pre
                    className="bg-[#13151A] p-6 rounded-xl border border-brand-border text-brand-accent/80 font-mono text-sm overflow-auto flex-1 custom-scrollbar"
                  >
                    {JSON.stringify(analysisResults, null, 2)}
                  </pre>
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
