import React, { useState, useCallback, useEffect } from 'react';
import CSVUploader from './components/CSVUploader.jsx';
import GraphVisualization from './components/GraphVisualization.jsx';
import FraudRingTable from './components/FraudRingTable.jsx';
import SummaryPanel from './components/SummaryPanel.jsx';
import TemporalHeatmap from './components/TemporalHeatmap.jsx';
import RiskExplanationPanel from './components/RiskExplanationPanel.jsx';
import RingOverlapVisualization from './components/RingOverlapVisualization.jsx';
import { buildGraph, isLegitimateAccount } from './algorithms/graphBuilder.js';
import { detectCycles } from './algorithms/cycleDetector.js';
import { detectSmurfing } from './algorithms/smurfingDetector.js';
import { detectShellChains } from './algorithms/shellDetector.js';
import { calculateSuspicionScore, calculateRingRiskScore } from './algorithms/suspicionScorer.js';
import { generateJSON, downloadJSON, formatJSONString } from './utils/jsonExporter.js';

const TABS = [
  { id: 'graph', label: '🕸 Graph View' },
  { id: 'table', label: '💍 Fraud Rings' },
  { id: 'heatmap', label: '🔥 Timeline Heatmap' },
  { id: 'overlap', label: '🔗 Ring Overlap' },
  { id: 'json', label: '📄 JSON Export' },
];

function zeroPad(n, len = 3) {
  return 'RING_' + String(n).padStart(len, '0');
}

function runAnalysis(transactions) {
  // FIX B: First line of analysis function
  const startTimeMs = Date.now();

  // 1. Build graph
  const { graph, reverseGraph, nodeStats, allNodes, edges } = buildGraph(transactions);

  // 2. Run detectors
  const cycles = detectCycles(graph, nodeStats);
  const smurfingRings = detectSmurfing(transactions, nodeStats);
  const shellChains = detectShellChains(graph, nodeStats);

  // 3. Collect all rings
  const allRings = [...cycles, ...smurfingRings, ...shellChains];

  // 4. Deduplicate rings using canonical key
  const canonicalMap = new Map();
  const deduped = [];
  for (const ring of allRings) {
    const key = [...ring.members].sort().join('|');
    if (!canonicalMap.has(key)) {
      canonicalMap.set(key, deduped.length);
      deduped.push({ ...ring });
    }
  }

  // 5. Assign Ring IDs
  const ringIdAssigned = deduped.map((ring, i) => ({
    ...ring,
    ring_id: zeroPad(i + 1),
    member_accounts: ring.members,
    risk_score: 0,
  }));

  // 6. Collect suspicious account IDs
  const suspiciousAccountIds = new Set();
  for (const ring of ringIdAssigned) {
    for (const member of ring.member_accounts) {
      if (!isLegitimateAccount(member, nodeStats)) suspiciousAccountIds.add(member);
    }
  }

  // 7. Build per-account pattern set
  const accountPatterns = {};
  for (const ring of ringIdAssigned) {
    for (const member of ring.member_accounts) {
      if (!accountPatterns[member]) accountPatterns[member] = new Set();
      for (const p of ring.detected_patterns) accountPatterns[member].add(p);
    }
  }

  // 8. Populate ringMemberships
  for (const ring of ringIdAssigned) {
    for (const member of ring.member_accounts) {
      if (!nodeStats[member]) continue;
      if (!nodeStats[member].ringMemberships.includes(ring.ring_id)) {
        nodeStats[member].ringMemberships.push(ring.ring_id);
      }
    }
  }

  // 9. Calculate suspicion scores
  const suspiciousAccounts = [];
  for (const accountId of suspiciousAccountIds) {
    const patterns = accountPatterns[accountId] ? [...accountPatterns[accountId]] : [];
    const score = calculateSuspicionScore(accountId, patterns, nodeStats, transactions);

    suspiciousAccounts.push({
      account_id: accountId,
      suspicion_score: score,
      detected_patterns: patterns,
      ring_id: '',
      ringMemberships: nodeStats[accountId]?.ringMemberships || [],
    });
  }

  // 10. Calculate ring risk scores
  for (const ring of ringIdAssigned) {
    const memberScores = ring.member_accounts
      .map((id) => suspiciousAccounts.find((a) => a.account_id === id)?.suspicion_score ?? 0);
    ring.risk_score = calculateRingRiskScore(memberScores);
  }

  // 11. Assign ring_id with highest risk score
  for (const acc of suspiciousAccounts) {
    const memberships = nodeStats[acc.account_id]?.ringMemberships || [];
    let bestRing = null;
    let bestScore = -1;
    for (const rid of memberships) {
      const ring = ringIdAssigned.find((r) => r.ring_id === rid);
      if (ring && ring.risk_score > bestScore) {
        bestScore = ring.risk_score;
        bestRing = rid;
      }
    }
    acc.ring_id = bestRing || '';
  }

  // 12. Sort fraud rings
  ringIdAssigned.sort((a, b) => b.risk_score - a.risk_score);

  // 13. Final safety-net
  const finalSuspicious = suspiciousAccounts.filter(
    (acc) => !isLegitimateAccount(acc.account_id, nodeStats)
  );

  // FIX 3A: ORPHAN RING CLEANUP
  const refRingIds = new Set(finalSuspicious.map(a => a.ring_id));
  const flaggedIds = new Set(finalSuspicious.map(a => a.account_id));

  const cleanRings = ringIdAssigned
    .filter(r => refRingIds.has(r.ring_id))
    .map(r => ({
      ...r,
      member_accounts: r.member_accounts.filter(id => flaggedIds.has(id))
    }))
    .filter(r => r.member_accounts.length >= 2);

  // 14. Generate JSON output (Use cleanRings)
  const jsonOutput = generateJSON(
    finalSuspicious,
    cleanRings,
    allNodes.size,
    startTimeMs
  );

  return {
    transactions,
    edges,
    nodeStats,
    allNodes,
    suspiciousAccounts: finalSuspicious,
    fraudRings: cleanRings,
    cycles,
    smurfingRings,
    shellChains,
    jsonOutput,
    suspiciousAccountIds,
  };
}

export default function App() {
  const [csvData, setCsvData] = useState(null);
  const [analysisResults, setAnalysisResults] = useState(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('graph');
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [isPanelOpen, setIsPanelOpen] = useState(false);

  const handleCSVUpload = useCallback((transactions) => {
    setCsvData(transactions);
    setIsProcessing(true);
    setError('');

    setTimeout(() => {
      try {
        const results = runAnalysis(transactions);
        setAnalysisResults(results);
      } catch (err) {
        console.error('Analysis error:', err);
        setError(`Analysis failed: ${err.message}`);
      } finally {
        setIsProcessing(false);
      }
    }, 0);
  }, []);

  const handleSelectAccount = useCallback((acc) => {
    setSelectedAccount(acc);
    setIsPanelOpen(true);
  }, []);

  const handleClosePanel = useCallback(() => {
    setIsPanelOpen(false);
    setSelectedAccount(null);
  }, []);

  const handleDownload = useCallback(() => {
    if (analysisResults?.jsonOutput) {
      downloadJSON(analysisResults.jsonOutput);
    }
  }, [analysisResults]);

  const handleReset = () => {
    setCsvData(null);
    setAnalysisResults(null);
    setIsProcessing(false);
    setError('');
    setSelectedAccount(null);
    setIsPanelOpen(false);
  };

  // Show uploader
  if (!csvData || (!analysisResults && !isProcessing)) {
    return (
      <>
        <CSVUploader onAnalysisComplete={handleCSVUpload} isProcessing={isProcessing} />
        {error && (
          <div className="fixed bottom-4 left-1/2 -translate-x-1/2 bg-red-900/80 border border-red-600 text-red-200 rounded-xl px-5 py-3 text-sm shadow-xl max-w-lg text-center z-50">
            {error}
          </div>
        )}
      </>
    );
  }

  // Processing skeleton
  if (isProcessing) {
    return <CSVUploader onAnalysisComplete={handleCSVUpload} isProcessing={true} />;
  }

  const { edges, nodeStats, suspiciousAccounts, fraudRings, smurfingRings, jsonOutput, suspiciousAccountIds } = analysisResults;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 md:p-6" style={{ fontFamily: 'Inter, sans-serif' }}>

      {/* Neo-Brutal Header */}
      <header className="mb-8 bg-slate-900 border-2 border-slate-800 p-6 rounded-none brutal-shadow flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-extrabold text-amber-400 tracking-tight uppercase" style={{ fontFamily: 'Syne, sans-serif' }}>
            ThreatVision
          </h1>
          <p className="text-slate-400 text-sm font-mono mt-1 tracking-wider">
            // RIFT_2026 // GRAPH_THEORY_TRACK
          </p>
        </div>
        <button
          onClick={handleReset}
          className="neobutton bg-slate-800 text-slate-200 hover:bg-slate-700 hover:text-white"
        >
          ↑ Upload New File
        </button>
      </header>

      <div className="max-w-screen-2xl mx-auto animate-fadeIn">
        {/* Summary Panel */}
        <SummaryPanel analysisResults={analysisResults} onDownload={handleDownload} />

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
          {activeTab === 'graph' && (
            <div className="h-[800px] border-2 border-slate-800 bg-slate-950">
              <GraphVisualization
                edges={edges}
                nodeStats={nodeStats}
                suspiciousAccounts={suspiciousAccounts}
                fraudRings={fraudRings}
                onSelectAccount={handleSelectAccount}
              />
            </div>
          )}

          {activeTab === 'table' && (
            <FraudRingTable
              fraudRings={fraudRings}
              suspiciousAccounts={suspiciousAccounts}
              onSelectAccount={handleSelectAccount}
            />
          )}

          {activeTab === 'heatmap' && (
            <div className="p-6">
              <TemporalHeatmap
                transactions={analysisResults.transactions}
                suspiciousAccountIds={suspiciousAccountIds}
              />
            </div>
          )}

          {activeTab === 'overlap' && (
            <div className="h-[800px] flex justify-center items-center bg-slate-950 border-2 border-slate-800">
              <RingOverlapVisualization
                fraudRings={fraudRings}
                suspiciousAccounts={suspiciousAccounts}
                nodeStats={nodeStats}
              />
            </div>
          )}

          {activeTab === 'json' && (
            <div className="p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-bold text-slate-100 uppercase tracking-widest" style={{ fontFamily: 'Syne, sans-serif' }}>
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
                {formatJSONString(jsonOutput)}
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
          transactions={analysisResults.transactions}
          fraudRings={fraudRings}
          onClose={handleClosePanel}
        />
      )}
    </div>
  );
}
