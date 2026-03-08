/**
 * localAnalyzer.js
 * Runs the full fraud detection pipeline in the browser.
 * Returns data in the EXACT same shape as the Node.js backend.
 * Used as fallback when the backend is unavailable.
 *
 * Detection order (per spec):
 *   1. Build graph
 *   2. Detect cycles
 *   3. Detect smurfing  (with payroll / merchant / passthrough exemptions)
 *   4. Detect shell chains  (separate pass AFTER cycle detection)
 *   5. Score accounts  (with cross-ring multiplier)
 *   6. Filter by score thresholds (≥40 for rings, ≥50 for Top Risk)
 *   7. Return shaped result
 */
import { buildGraph } from './graphBuilder.js';
import { detectCycles } from './cycleDetector.js';
import { detectSmurfing, isPayrollPattern, isMerchantDisbursement, isPassthroughAgent } from './smurfingDetector.js';
import { detectShellChains } from './shellDetector.js';
import {
    calculateSuspicionScore,
    calculateRingRiskScore,
    SCORE_THRESHOLD_RING,
    SCORE_THRESHOLD_TOP_RISK,
} from './suspicionScorer.js';

// ─── CSV Parser ───────────────────────────────────────────────────────────────
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

// ─── Ring builder ─────────────────────────────────────────────────────────────
function buildFraudRing(ring, ringId, memberScores) {
    const members = ring.members || ring.member_accounts || [];
    const scores  = members.map(m => memberScores[m] ?? 0);
    return {
        ring_id:           ringId,
        pattern_type:      ring.pattern_type || 'cycle',
        member_accounts:   members,
        risk_score:        calculateRingRiskScore(scores),
        detected_patterns: ring.detected_patterns || [],
        ...(ring.chain_length !== undefined ? { chain_length: ring.chain_length } : {}),
    };
}

// ─── Main entry point ─────────────────────────────────────────────────────────
/**
 * @param {File} file - Raw CSV File object
 * @returns {Promise<Object>} Backend-shaped result object
 */
export async function analyzeLocally(file) {
    const startTimeMs = Date.now();

    const text = await file.text();
    const rows = parseCSV(text);

    if (!rows.length) throw new Error('CSV file is empty');

    const required = ['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'];
    const cols     = Object.keys(rows[0]);
    const missing  = required.filter(c => !cols.includes(c));
    if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}`);

    // ── 1. Build graph ───────────────────────────────────────────────────────
    const { graph, nodeStats, allNodes } = buildGraph(rows);
    const totalNodes = allNodes.size;

    // ── 2. Detect cycles ─────────────────────────────────────────────────────
    const cycleRings = detectCycles(graph, nodeStats);

    // ── 3. Detect smurfing (exemptions applied inside detector) ──────────────
    const smurfRings = detectSmurfing(rows, nodeStats);

    // ── 4. Detect shell chains (separate pass, takes raw transactions) ────────
    const shellRings = detectShellChains(rows, nodeStats);

    const allRings = [...cycleRings, ...smurfRings, ...shellRings];

    // ── 5. Build cross-ring membership map ───────────────────────────────────
    // ringMembership[accountId] = [pattern_type, ...] for all rings they appear in
    const ringMembership = {};
    for (const ring of allRings) {
        const members = ring.members || ring.member_accounts || [];
        for (const m of members) {
            if (!ringMembership[m]) ringMembership[m] = [];
            if (!ringMembership[m].includes(ring.pattern_type)) {
                ringMembership[m].push(ring.pattern_type);
            }
        }
    }

    // ── 6. Collect all flagged accounts and their pattern tags ────────────────
    const suspiciousSet    = new Set();
    const accountPatterns  = {};

    for (const ring of allRings) {
        const members = ring.members || ring.member_accounts || [];
        members.forEach(m => suspiciousSet.add(m));

        for (const m of members) {
            if (!accountPatterns[m]) accountPatterns[m] = [];
            for (const p of (ring.detected_patterns || [])) {
                if (!accountPatterns[m].includes(p)) accountPatterns[m].push(p);
            }
        }
    }

    // ── 7. Score every suspicious account ────────────────────────────────────
    const memberScores = {};
    for (const acc of suspiciousSet) {
        // Run exemption checks post-detection to zero out legitimate accounts
        // that somehow slipped through (e.g. from cycle detection picking them up)
        if (
            isPayrollPattern(acc, rows) ||
            isMerchantDisbursement(acc, rows) ||
            isPassthroughAgent(acc, rows)
        ) {
            memberScores[acc] = 0;
            continue;
        }

        memberScores[acc] = calculateSuspicionScore(
            acc,
            accountPatterns[acc] || [],
            nodeStats,
            rows,
            ringMembership
        );
    }

    // ── 8. Build suspicious_accounts (score ≥ threshold or shell intermediate) ─
    const suspicious_accounts = [...suspiciousSet]
        .filter(acc => {
            const score = memberScores[acc] ?? 0;
            // Always include shell chain intermediates with score ≥ 40
            // (they may not reach 50 but must still appear in ring tables)
            return score >= SCORE_THRESHOLD_RING;
        })
        .map(acc => {
            const stats = nodeStats[acc] || {};
            return {
                account_id:        acc,
                suspicion_score:   memberScores[acc] ?? 0,
                detected_patterns: accountPatterns[acc] || [],
                transaction_count: stats.txCount ?? 0,
                total_sent:        stats.totalSent ?? 0,
                total_received:    stats.totalReceived ?? 0,
                unique_senders:    stats.uniqueSenders?.size ?? 0,
                unique_receivers:  stats.uniqueReceivers?.size ?? 0,
                ring_ids:          [],
            };
        });

    // ── 9. Build fraud_rings (only rings where at least one member score ≥ threshold) ─
    let ringCounter = 1;
    const fraud_rings_all = allRings.map(ring => {
        return buildFraudRing(ring, `ring_${ringCounter++}`, memberScores);
    });

    // Filter rings: must have at least one member with score ≥ SCORE_THRESHOLD_RING
    const fraud_rings = fraud_rings_all.filter(fr => {
        // Also skip rings where ALL members were zeroed out as legitimate
        return fr.member_accounts.some(acc => (memberScores[acc] ?? 0) >= SCORE_THRESHOLD_RING);
    });

    // ── 10. Link ring_ids back to accounts ────────────────────────────────────
    for (const fr of fraud_rings) {
        for (const acc of fr.member_accounts) {
            const sa = suspicious_accounts.find(a => a.account_id === acc);
            if (sa && !sa.ring_ids.includes(fr.ring_id)) sa.ring_ids.push(fr.ring_id);
        }
    }

    // Remove accounts not linked to any ring after filtering
    const accountsInRings = new Set(fraud_rings.flatMap(r => r.member_accounts));
    const filteredAccounts = suspicious_accounts.filter(a => accountsInRings.has(a.account_id));

    // Separate Top Risk Accounts (score ≥ 50) from ring-only members
    // The UI already slices .slice(0, 4) so we just sort by score descending
    filteredAccounts.sort((a, b) => b.suspicion_score - a.suspicion_score);

    const processingMs = Date.now() - startTimeMs;

    return {
        suspicious_accounts: filteredAccounts,
        fraud_rings,
        summary: {
            total_accounts_analyzed:    totalNodes,
            suspicious_accounts_flagged: filteredAccounts.length,
            fraud_rings_detected:        fraud_rings.length,
            processing_time_seconds:     parseFloat(Math.max(0.1, processingMs / 1000).toFixed(1)),
            analysis_mode:               'local',
        },
        _transactions: rows,
        _mode: 'local',
    };
}
