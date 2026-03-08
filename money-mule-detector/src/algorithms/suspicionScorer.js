/**
 * suspicionScorer.js
 * Calculates suspicion scores for accounts and risk scores for rings.
 *
 * Scoring matrix (Problem 5):
 *   Pattern bonuses:
 *     cycle_member:         +40
 *     cycle_repeated:       +20  (account in 2+ cycles)
 *     smurfing_aggregator:  +45  (fan-in central node)
 *     smurfing_disperser:   +45  (fan-out central node)
 *     shell_intermediate:   +35  (low txn count in a chain)
 *     shell_origin:         +30  (starts a shell chain)
 *
 *   Penalty deductions (reduce score for legitimate signals):
 *     has_retail_inflow:    -30  (many small consumer payments in)
 *     uniform_payroll_out:  -40  (identical-ish amounts sent in batch)
 *     balanced_passthrough: -25  (in ≈ out, no sender/receiver overlap)
 *     high_txn_volume:      -15  (>50 total transactions — active account)
 *
 *   Multipliers:
 *     temporal_72hr_window: ×1.3  (smurfing within 72hr window)
 *     cross_ring_member:    ×1.2  (appears in multiple rings)
 *
 *   Final score clamped 0–100.
 *   Only appear in Top Risk Accounts if score ≥ 50.
 *   Only included in fraud_rings if score ≥ 40.
 */

import {
    isPayrollPattern,
    isPassthroughAgent,
} from './smurfingDetector.js';

/**
 * Calculate the suspicion score for a single account.
 *
 * @param {string}   accountId
 * @param {string[]} detectedPatterns  - Pattern keys from ring membership
 * @param {Object}   nodeStats         - Per-node stats map (from graphBuilder)
 * @param {Array}    transactions      - All raw transaction rows
 * @param {Object}   ringMembership    - { accountId: string[] } → ring pattern_types the account belongs to
 * @returns {number} Float 0.0 – 100.0
 */
export function calculateSuspicionScore(accountId, detectedPatterns, nodeStats, transactions, ringMembership) {
    let score = 0;

    const stats      = nodeStats[accountId] || {};
    const txCount    = stats.txCount ?? 0;
    const patternSet = new Set(detectedPatterns);

    // ── Pattern bonuses ──────────────────────────────────────────────────────
    // Cycle membership
    const cyclePatterns = detectedPatterns.filter(p => p.startsWith('cycle_length_'));
    if (cyclePatterns.length > 0) {
        score += 40; // cycle_member base bonus
    }

    // Part of cycles more than once (cross-ring cycle)
    if (cyclePatterns.length >= 2) {
        score += 20; // cycle_repeated
    }

    // Fan-in (smurfing aggregator) — fan_in tag attached by smurfingDetector
    if (patternSet.has('fan_in')) {
        score += 45; // smurfing_aggregator
    }

    // Fan-out (smurfing disperser)
    if (patternSet.has('fan_out')) {
        score += 45; // smurfing_disperser
    }

    // Shell chain intermediate node
    if (patternSet.has('shell_chain')) {
        // Determine role: if low txCount → intermediate, else origin
        if (txCount <= 3) {
            score += 35; // shell_intermediate
        } else {
            score += 30; // shell_origin
        }
    }

    // ── Penalty deductions ───────────────────────────────────────────────────

    // has_retail_inflow: receives many small consumer payments
    if (txCount > 0) {
        const incoming = transactions.filter(t => t.receiver_id === accountId);
        if (incoming.length >= 5) {
            const incomingAmounts = incoming.map(t => parseFloat(t.amount) || 0);
            const avgIn = incomingAmounts.reduce((a, b) => a + b, 0) / incomingAmounts.length;
            if (avgIn <= 1000) {
                score -= 30; // has_retail_inflow
            }
        }
    }

    // uniform_payroll_out: sends identical-ish amounts in batch
    if (isPayrollPattern(accountId, transactions)) {
        score -= 40; // uniform_payroll_out
    }

    // balanced_passthrough: in ≈ out, no sender/receiver overlap
    if (isPassthroughAgent(accountId, transactions)) {
        score -= 25; // balanced_passthrough
    }

    // high_txn_volume: account is very active (> 50 txns)
    if (txCount > 50) {
        score -= 15; // high_txn_volume
    }

    // ── Multipliers ──────────────────────────────────────────────────────────

    // temporal_72hr_window: smurfing detected within 72-hr window
    if (patternSet.has('temporal_72hr_window')) {
        score *= 1.3;
    }

    // cross_ring_member: account appears in multiple distinct rings
    const memberRings = ringMembership?.[accountId] || [];
    if (memberRings.length >= 2) {
        score *= 1.2;
    }

    // also give bonus for round-amount transactions (existing heuristic)
    const amounts = stats.amounts || [];
    if (amounts.length > 0) {
        const roundCount = amounts.filter(amt => amt % 500 === 0 || amt % 1000 === 0).length;
        if (roundCount / amounts.length > 0.5) score += 5;
    }

    // 24-hour clustering bonus (existing heuristic)
    const timestamps = stats.timestamps || [];
    if (timestamps.length >= 2) {
        const minTs  = Math.min(...timestamps.map(t => (t instanceof Date ? t.getTime() : new Date(t).getTime())));
        const maxTs  = Math.max(...timestamps.map(t => (t instanceof Date ? t.getTime() : new Date(t).getTime())));
        if (maxTs - minTs <= 24 * 60 * 60 * 1000) score += 8;
    }

    // ── Clamp ────────────────────────────────────────────────────────────────
    return parseFloat(Math.min(100, Math.max(0, score)).toFixed(1));
}

/**
 * Calculate ring risk score as average of member suspicion scores (clamped).
 * @param {number[]} memberScores
 * @returns {number} Float 0.0 – 100.0
 */
export function calculateRingRiskScore(memberScores) {
    if (!memberScores || memberScores.length === 0) return 0.0;
    const avg = memberScores.reduce((a, b) => a + b, 0) / memberScores.length;
    return parseFloat(Math.min(100, avg).toFixed(1));
}

// Score thresholds (exported for use in localAnalyzer filtering)
export const SCORE_THRESHOLD_RING        = 40;   // min score to include in fraud_rings
export const SCORE_THRESHOLD_TOP_RISK    = 50;   // min score for Top Risk Accounts
