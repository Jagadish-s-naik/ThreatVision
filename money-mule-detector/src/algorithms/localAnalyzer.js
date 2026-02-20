/**
 * localAnalyzer.js
 * Runs the full fraud detection pipeline in the browser using the frontend
 * algorithm files. Returns data in the EXACT same shape as the Node.js backend.
 * Used as fallback when the backend is unavailable.
 */
import { buildGraph } from './graphBuilder.js';
import { detectCycles } from './cycleDetector.js';
import { detectSmurfing } from './smurfingDetector.js';
import { detectShellChains } from './shellDetector.js';
import { calculateSuspicionScore, calculateRingRiskScore } from './suspicionScorer.js';

/**
 * Parse CSV text into row objects.
 */
function parseCSV(text) {
    const lines = text.trim().split(/\r?\n/);
    if (lines.length < 2) return [];
    const headers = lines[0].split(',').map(h => h.trim());
    return lines.slice(1).map(line => {
        const vals = line.split(',');
        const row = {};
        headers.forEach((h, i) => { row[h] = (vals[i] || '').trim(); });
        return row;
    });
}

/**
 * Convert backend-style ring (from cycleDetector / smurfingDetector / shellDetector)
 * into the backend JSON spec format.
 */
function buildFraudRing(ring, ringId, memberScores) {
    const members = ring.members || ring.member_accounts || [];
    const scores = members.map(m => memberScores[m] ?? 0);
    return {
        ring_id: ringId,
        pattern_type: ring.pattern_type || 'cycle',
        member_accounts: members,
        risk_score: calculateRingRiskScore(scores),
        detected_patterns: ring.detected_patterns || [],
    };
}

/**
 * Main entry point — mirrors backend /api/analyze response.
 * @param {File} file - Raw CSV File object
 * @returns {Promise<Object>} Backend-shaped result object
 */
export async function analyzeLocally(file) {
    const startTimeMs = Date.now();

    const text = await file.text();
    const rows = parseCSV(text);

    if (!rows.length) throw new Error('CSV file is empty');

    const required = ['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'];
    const cols = Object.keys(rows[0]);
    const missing = required.filter(c => !cols.includes(c));
    if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);

    // Build in-memory graph
    const { graph, reverseGraph, nodeStats, allNodes, edges } = buildGraph(rows);
    const totalNodes = allNodes.size;

    // Run detectors
    const cycleRings = detectCycles(graph, nodeStats);
    const smurfRings = detectSmurfing(rows, nodeStats);
    const shellRings = detectShellChains(graph, nodeStats);

    const allRings = [...cycleRings, ...smurfRings, ...shellRings];

    // Collect all accounts involved in rings
    const suspiciousSet = new Set();
    for (const ring of allRings) {
        const members = ring.members || ring.member_accounts || [];
        members.forEach(m => suspiciousSet.add(m));
    }

    // Build pattern map per account
    const accountPatterns = {};
    for (const ring of allRings) {
        const members = ring.members || ring.member_accounts || [];
        for (const m of members) {
            if (!accountPatterns[m]) accountPatterns[m] = [];
            for (const p of (ring.detected_patterns || [])) {
                if (!accountPatterns[m].includes(p)) accountPatterns[m].push(p);
            }
        }
    }

    // Compute suspicion scores
    const memberScores = {};
    for (const acc of suspiciousSet) {
        memberScores[acc] = calculateSuspicionScore(
            acc,
            accountPatterns[acc] || [],
            nodeStats,
            rows
        );
    }

    // Build suspicious_accounts array
    const suspicious_accounts = [...suspiciousSet].map(acc => {
        const stats = nodeStats[acc] || {};
        return {
            account_id: acc,
            suspicion_score: memberScores[acc] ?? 0,
            detected_patterns: accountPatterns[acc] || [],
            transaction_count: stats.txCount ?? 0,
            total_sent: stats.totalSent ?? 0,
            total_received: stats.totalReceived ?? 0,
            // Provide numbers (not Sets) for compatibility with RiskExplanationPanel
            unique_senders: stats.uniqueSenders?.size ?? 0,
            unique_receivers: stats.uniqueReceivers?.size ?? 0,
            ring_ids: [],  // filled below
        };
    });

    // Build fraud_rings array
    let ringCounter = 1;
    const fraud_rings = allRings.map(ring => {
        const fr = buildFraudRing(ring, `ring_${ringCounter++}`, memberScores);
        return fr;
    });

    // Link ring_ids back to accounts
    for (const fr of fraud_rings) {
        for (const acc of fr.member_accounts) {
            const sa = suspicious_accounts.find(a => a.account_id === acc);
            if (sa && !sa.ring_ids.includes(fr.ring_id)) sa.ring_ids.push(fr.ring_id);
        }
    }

    // Remove rings not linked to any suspicious account (orphans)
    const linkedRingIds = new Set(suspicious_accounts.flatMap(a => a.ring_ids));
    const filteredRings = fraud_rings.filter(r => linkedRingIds.has(r.ring_id));

    const processingMs = Date.now() - startTimeMs;

    const result = {
        suspicious_accounts,
        fraud_rings: filteredRings,
        summary: {
            total_accounts_analyzed: totalNodes,
            suspicious_accounts_found: suspicious_accounts.length,
            fraud_rings_detected: filteredRings.length,
            processing_time_ms: processingMs,
            analysis_mode: 'local',   // indicates browser-side fallback
        },
        _transactions: rows,
        _mode: 'local',
    };

    return result;
}
