import React, { useState, useCallback, useEffect } from 'react';
import CSVUploader from './components/CSVUploader.jsx';
import GraphVisualization from './components/GraphVisualization.jsx';
import FraudRingTable from './components/FraudRingTable.jsx';
import SummaryPanel from './components/SummaryPanel.jsx';
import TemporalHeatmap from './components/TemporalHeatmap.jsx';
import RiskExplanationPanel from './components/RiskExplanationPanel.jsx';
import RingOverlapVisualization from './components/RingOverlapVisualization.jsx';
import { analyzeCSV } from './api/analyzeApi.js';
import { downloadJSON } from './utils/jsonExporter.js';

const TABS = [
  { id: 'graph', label: '🕸 Graph View' },
  { id: 'table', label: 'Fraud Rings' },
  { id: 'heatmap', label: '🔥 Timeline Heatmap' },
  { id: 'overlap', label: '🔗 Ring Overlap' },
  { id: 'json', label: '📄 JSON Export' },
];

export default function App() {
  // ─── State ───────────────────────────────────────────────────────────────
  const [analysisResults, setAnalysisResults] = useState(null);
  const [transactions, setTransactions] = useState([]); // raw transaction rows for graph/heatmap
  const [rawFile, setRawFile] = useState(null);         // original File object for re-upload after refresh
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
      if (saved && savedTx) {
        const parsedResults = JSON.parse(saved);
        const parsedTx = JSON.parse(savedTx);
        setAnalysisResults(parsedResults);
        setTransactions(parsedTx);
      }
    } catch (e) {
      console.warn('Failed to restore session:', e);
      localStorage.removeItem('threat_vision_results');
      localStorage.removeItem('threat_vision_transactions');
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

      setAnalysisResults(result);
      setTransactions(txRows);

      // Persist to localStorage for refresh survival
      try {
        localStorage.setItem('threat_vision_results', JSON.stringify(result));
        localStorage.setItem('threat_vision_transactions', JSON.stringify(txRows));
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
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center gap-6">
        {/* Pulsing Neo4j icon */}
        <div className="w-20 h-20 rounded-full border-4 border-amber-500 border-t-transparent animate-spin" />
        <div className="text-center">
          <p className="text-amber-400 font-bold text-xl font-mono tracking-wider animate-pulse">
            ⚡ Processing via Neo4j Graph Database...
          </p>
          <p className="text-slate-500 text-sm mt-2 font-mono">{loadingMessage}</p>
        </div>
      </div>
    );
  }

  // ─── Main Dashboard ───────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" style={{ fontFamily: 'Inter, sans-serif' }}>
      <div className="relative z-10 max-w-screen-2xl mx-auto">

        {/* Neo-Brutal Header */}
        <header className="mb-8 bg-slate-900 border-2 border-slate-800 p-6 rounded-none brutal-shadow flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1
              className="text-3xl md:text-4xl font-extrabold text-amber-400 tracking-tight uppercase"
              style={{ fontFamily: 'Syne, sans-serif' }}
            >
              Threat Vision
            </h1>
            <p className="text-slate-400 text-sm font-mono mt-1 tracking-wider">
              Graph-Based Financial Crime Detection Engine
            </p>
          </div>
          <div className="flex items-center gap-3">
            {/* Neo4j badge */}
            <span className="hidden sm:flex items-center gap-2 px-3 py-1.5 rounded-none border border-slate-700 bg-slate-800 text-xs font-mono text-slate-400">
              <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              Neo4j Backend
            </span>
            <button
              onClick={handleReset}
              className="neobutton bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
            >
              ↑ Upload New File
            </button>
          </div>
        </header>

        <div className="animate-fadeIn">
          {/* Summary Panel */}
          <SummaryPanel analysisResults={summaryPanelResults} onDownload={handleDownload} />

          {/* Error banner */}
          {error && (
            <div className="mb-4 bg-red-950/80 border-2 border-red-600 text-red-300 px-5 py-4 text-sm brutal-shadow-rose font-bold font-mono">
              ⚠ {error}
            </div>
          )}

          {/* Neo-Tabs */}
          <div className="flex flex-wrap gap-3 mb-6">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-5 py-3 font-bold uppercase tracking-wider border-2 transition-all active:translate-x-[2px] active:translate-y-[2px] active:shadow-none ${activeTab === tab.id
                  ? 'bg-amber-500 text-slate-950 border-amber-600 brutal-shadow-amber'
                  : 'bg-slate-900 text-slate-400 border-slate-800 hover:border-slate-600 hover:text-slate-200 brutal-shadow'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab content area */}
          <div className="bg-slate-900 border-2 border-slate-800 p-1 brutal-shadow min-h-[600px] animate-fadeIn">

            {/* Graph View — single tree: root → Fraud / Non-Fraud branches */}
            {activeTab === 'graph' && (
              <div className="p-2">
                <GraphVisualization
                  edges={transactions.map(tx => ({ sender_id: tx.sender_id, receiver_id: tx.receiver_id, amount: tx.amount, timestamp: tx.timestamp, transaction_id: tx.transaction_id }))}
                  nodeStats={{}}
                  suspiciousAccounts={suspiciousAccounts}
                  fraudRings={fraudRings}
                  onSelectAccount={handleSelectAccount}
                />
              </div>
            )}

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
              <div className="p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3
                    className="text-xl font-bold text-slate-100 uppercase tracking-widest"
                    style={{ fontFamily: 'Syne, sans-serif' }}
                  >
                    JSON Export Preview
                  </h3>
                  <button
                    onClick={handleDownload}
                    className="neobutton bg-amber-500 text-slate-900 hover:bg-amber-400 border-amber-600 brutal-shadow-sm"
                  >
                    ⬇ Download JSON
                  </button>
                </div>
                <pre
                  className="bg-slate-950 p-6 text-xs text-green-400 border-2 border-slate-800 font-mono overflow-auto max-h-[600px] shadow-inner"
                  style={{ fontFamily: 'IBM Plex Mono, monospace' }}
                >
                  {JSON.stringify(analysisResults, null, 2)}
                </pre>
              </div>
            )}
          </div>
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
      </div>
    </div>
  );
}
