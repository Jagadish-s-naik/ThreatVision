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
  // FIX: Start time MUST be the very first line
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

  // FIX: ORPHAN RING CLEANUP
  // Remove rings that no suspicious_account references
  const referencedRingIds = new Set(
    finalSuspicious.map(a => a.ring_id)
  );
  const flaggedIds = new Set(
    finalSuspicious.map(a => a.account_id)
  );

  // Clean rings = only referenced rings, only suspicious members
  const finalRings = ringIdAssigned
    .filter(ring => referencedRingIds.has(ring.ring_id))
    .map(ring => ({
      ...ring,
      member_accounts: ring.member_accounts.filter(
        id => flaggedIds.has(id)
      ),
    }))
    .filter(ring => ring.member_accounts.length >= 2);

  // 14. Generate JSON output
  const jsonOutput = generateJSON(
    finalSuspicious,
    finalRings,
    allNodes.size,
    startTimeMs // Pass correct start time
  );

  return {
    transactions,
    edges,
    nodeStats,
    allNodes,
    suspiciousAccounts: finalSuspicious,
    fraudRings: finalRings,
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
    <div className="min-h-screen bg-slate-950 text-slate-100" style={{ fontFamily: 'Inter, sans-serif' }}>
      {/* Top bar */}
      <div className="bg-slate-900 border-b border-slate-800 px-6 py-4 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-amber-400" style={{ fontFamily: 'Syne, sans-serif' }}>
            💰 Financial Forensics Engine
          </h1>
          <p className="text-slate-400 text-sm">Money Muling Detection · Graph Theory Track · RIFT 2026</p>
        </div>
        <button
          onClick={handleReset}
          className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-slate-300 rounded-lg text-sm font-semibold transition-colors border border-slate-600"
        >
          ↑ Upload New File
        </button>
      </div>

      <div className="px-4 md:px-6 py-6 max-w-screen-2xl mx-auto animate-fadeIn">
        {/* Summary Panel always visible */}
        <SummaryPanel analysisResults={analysisResults} onDownload={handleDownload} />

        {/* Tabs */}
        <div className="flex gap-1 bg-slate-900 border border-slate-700 rounded-xl p-1 mb-5 overflow-x-auto">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === tab.id
                ? 'bg-amber-500 text-slate-900'
                : 'text-slate-400 hover:text-slate-200 hover:bg-slate-800'
                }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="animate-fadeIn">
          {activeTab === 'graph' && (
            <GraphVisualization
              edges={edges}
              nodeStats={nodeStats}
              suspiciousAccounts={suspiciousAccounts}
              fraudRings={fraudRings}
              onSelectAccount={handleSelectAccount}
            />
          )}

          {activeTab === 'table' && (
            <FraudRingTable
              fraudRings={fraudRings}
              suspiciousAccounts={suspiciousAccounts}
              onSelectAccount={handleSelectAccount}
            />
          )}

          {activeTab === 'heatmap' && (
            <TemporalHeatmap
              transactions={analysisResults.transactions}
              suspiciousAccountIds={suspiciousAccountIds}
            />
          )}

          {activeTab === 'overlap' && (
            <RingOverlapVisualization
              fraudRings={fraudRings}
              suspiciousAccounts={suspiciousAccounts}
              nodeStats={nodeStats}
            />
          )}

          {activeTab === 'json' && (
            <div className="bg-slate-900 rounded-2xl border border-slate-700 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-bold text-slate-100" style={{ fontFamily: 'Syne, sans-serif' }}>
                  📄 JSON Export Preview
                </h3>
                <button
                  onClick={handleDownload}
                  className="px-5 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-bold rounded-lg text-sm transition-colors"
                >
                  ⬇ Download fraud_analysis.json
                </button>
              </div>
              <pre
                className="bg-slate-950 rounded-xl p-4 text-xs text-slate-300 overflow-auto max-h-[600px] border border-slate-800"
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
