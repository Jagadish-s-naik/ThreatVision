/**
 * resultBuilder.js
 * Assembles suspicious_accounts, fraud_rings, and summary
 * matching the exact problem statement JSON spec.
 *
 * Scoring matrix applied (Problem 5):
 *   cycle_member:        +40
 *   smurfing fan-in/out: +45
 *   shell chain:         +35 (intermediate) / +30 (origin)
 *   high_velocity mult:  ×1.3
 *   multi-ring mult:     ×1.2
 *   Clamp 0–100.
 *   Thresholds:
 *     ring inclusion:    score ≥ 40
 *     top risk display:  score ≥ 50
 */

const SCORE_THRESHOLD_RING     = 40;
const SCORE_THRESHOLD_TOP_RISK = 50;

/**
 * Calculate a score for a single account based on which patterns it's been
 * tagged with across all rings, and how many rings it appears in.
 *
 * @param {string[]} detectedPatterns  - Merged pattern list for this account
 * @param {number}   ringCount         - How many distinct rings this account appears in
 * @returns {number} Float 0–100
 */
function scoreAccount(detectedPatterns, ringCount) {
    let score = 0;
    const patSet = new Set(detectedPatterns);

    // Pattern bonuses
    if (detectedPatterns.some(p => p.startsWith('cycle_length_'))) score += 40;
    if (patSet.has('fan_in'))    score += 45;
    if (patSet.has('fan_out'))   score += 45;
    if (patSet.has('shell_chain')) score += 35;

    // High-velocity multiplier
    if (patSet.has('high_velocity')) score *= 1.3;

    // Cross-ring multiplier
    if (ringCount >= 2) score *= 1.2;

    return parseFloat(Math.min(100, Math.max(0, score)).toFixed(1));
}

export function buildResult(cycleRings, smurfingRings, shellRings, allNodes, startTimeMs) {
    const suspicious_accounts = [];
    const fraud_rings         = [];
    let ringCounter = 1;

    const allRings = [...cycleRings, ...smurfingRings, ...shellRings];

    // ── First pass: build ring membership count per account ──────────────────
    const accountRingCount    = {};
    const accountPatternsMap  = {};

    for (const ring of allRings) {
        const members         = ring.members || [];
        const detectedPatterns = buildDetectedPatterns(ring);

        for (const accountId of members) {
            accountRingCount[accountId]   = (accountRingCount[accountId] || 0) + 1;
            if (!accountPatternsMap[accountId]) accountPatternsMap[accountId] = new Set();
            for (const p of detectedPatterns) accountPatternsMap[accountId].add(p);
        }
    }

    // ── Second pass: assign scores and build output arrays ────────────────────
    for (const ring of allRings) {
        const members          = ring.members || [];
        const detectedPatterns = buildDetectedPatterns(ring);

        // Determine pattern_type for output (use layered_shell_network for shell chains)
        const outputPatternType =
            ring.pattern === 'shell'  ? 'layered_shell_network' :
            ring.pattern === 'smurfing' ? 'smurfing' :
            'cycle';

        // Calculate per-member scores to derive ring risk score
        const memberScores = members.map(accountId => {
            const patterns  = [...(accountPatternsMap[accountId] || new Set())];
            const ringCount = accountRingCount[accountId] || 1;
            return scoreAccount(patterns, ringCount);
        });

        // Filter: skip rings where NO member has a qualifying score
        const qualifyingMembers = memberScores.filter(s => s >= SCORE_THRESHOLD_RING);
        if (qualifyingMembers.length === 0) continue;

        const riskScore = parseFloat(
            (memberScores.reduce((a, b) => a + b, 0) / memberScores.length).toFixed(1)
        );

        const ringId = `RING_${String(ringCounter).padStart(3, '0')}`;
        ringCounter++;

        fraud_rings.push({
            ring_id:           ringId,
            member_accounts:   members,
            pattern_type:      outputPatternType,
            risk_score:        riskScore,
            detected_patterns: detectedPatterns,
            ...(ring.chain_length !== undefined ? { chain_length: ring.chain_length } : {}),
        });

        // Add each member to suspicious_accounts
        members.forEach((accountId, idx) => {
            const score       = memberScores[idx];
            const patterns    = [...(accountPatternsMap[accountId] || new Set())];
            const existing    = suspicious_accounts.find(a => a.account_id === accountId);

            if (!existing) {
                suspicious_accounts.push({
                    account_id:        accountId,
                    suspicion_score:   score,
                    detected_patterns: patterns,
                    ring_id:           ringId,
                    ring_ids:          [ringId],
                });
            } else {
                if (score > existing.suspicion_score) {
                    existing.suspicion_score = score;
                    existing.ring_id         = ringId;
                }
                if (!existing.ring_ids.includes(ringId)) existing.ring_ids.push(ringId);
                for (const p of patterns) {
                    if (!existing.detected_patterns.includes(p)) existing.detected_patterns.push(p);
                }
            }
        });
    }

    // Sort by suspicion score descending
    suspicious_accounts.sort((a, b) => b.suspicion_score - a.suspicion_score);

    // Remove orphan rings
    const refRingIds = new Set(suspicious_accounts.flatMap(a => a.ring_ids || [a.ring_id]));
    const cleanRings = fraud_rings.filter(r => refRingIds.has(r.ring_id));

    return {
        suspicious_accounts,
        fraud_rings: cleanRings,
        summary: {
            total_accounts_analyzed:     allNodes,
            suspicious_accounts_flagged: suspicious_accounts.length,
            fraud_rings_detected:        cleanRings.length,
            processing_time_seconds:     parseFloat(
                Math.max(0.1, (Date.now() - startTimeMs) / 1000).toFixed(1)
            ),
        },
    };
}

/**
 * Build the detected_patterns array for a ring.
 */
function buildDetectedPatterns(ring) {
    const patterns = [];
    if (ring.pattern === 'cycle') {
        patterns.push(`cycle_length_${(ring.members || []).length}`);
    }
    if (ring.patterns) {
        for (const p of ring.patterns) {
            if (!patterns.includes(p)) patterns.push(p);
        }
    }
    if (ring.detected_patterns) {
        for (const p of ring.detected_patterns) {
            if (!patterns.includes(p)) patterns.push(p);
        }
    }
    return patterns;
}
