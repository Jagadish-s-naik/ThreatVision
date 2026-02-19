/**
 * resultBuilder.js
 * Assembles suspicious_accounts, fraud_rings, and summary
 * matching the exact problem statement JSON spec.
 */

export function buildResult(cycleRings, smurfingRings, shellRings, allNodes, startTimeMs) {
    const suspicious_accounts = [];
    const fraud_rings = [];
    let ringCounter = 1;

    const allRings = [...cycleRings, ...smurfingRings, ...shellRings];

    for (const ring of allRings) {
        const ringId = `RING_${String(ringCounter).padStart(3, '0')}`;
        ringCounter++;

        // Build detected_patterns array
        const detectedPatterns = [];
        if (ring.pattern === 'cycle') {
            detectedPatterns.push(`cycle_length_${ring.members.length}`);
        }
        if (ring.patterns) {
            for (const p of ring.patterns) {
                if (!detectedPatterns.includes(p)) detectedPatterns.push(p);
            }
        }

        // Suspicion score by pattern type
        let score;
        if (ring.pattern === 'cycle') {
            score =
                ring.members.length === 3 ? 83.0 :
                    ring.members.length === 4 ? 75.0 : 68.0;
        } else if (ring.pattern === 'smurfing') {
            score = ring.patterns?.includes('high_velocity') ? 92.0 : 78.0;
        } else {
            // shell
            score = 65.0;
        }

        // Risk score (float)
        const riskScore = parseFloat(
            (score * 0.9 + ring.members.length * 0.5).toFixed(1)
        );

        // Add to fraud_rings
        fraud_rings.push({
            ring_id: ringId,
            member_accounts: ring.members,
            pattern_type: ring.pattern,
            risk_score: riskScore,
        });

        // Add each member to suspicious_accounts (keep highest score per account)
        for (const accountId of ring.members) {
            const existing = suspicious_accounts.find((a) => a.account_id === accountId);
            if (!existing) {
                suspicious_accounts.push({
                    account_id: accountId,
                    suspicion_score: parseFloat(score.toFixed(1)),
                    detected_patterns: [...new Set(detectedPatterns)],
                    ring_id: ringId,
                });
            } else if (score > existing.suspicion_score) {
                existing.suspicion_score = parseFloat(score.toFixed(1));
                existing.ring_id = ringId;
                for (const p of detectedPatterns) {
                    if (!existing.detected_patterns.includes(p)) {
                        existing.detected_patterns.push(p);
                    }
                }
            }
        }
    }

    // Sort descending by suspicion_score
    suspicious_accounts.sort((a, b) => b.suspicion_score - a.suspicion_score);

    // Remove orphan rings — only keep rings referenced by a suspicious account
    const refRingIds = new Set(suspicious_accounts.map((a) => a.ring_id));
    const cleanRings = fraud_rings.filter((r) => refRingIds.has(r.ring_id));

    return {
        suspicious_accounts,
        fraud_rings: cleanRings,
        summary: {
            total_accounts_analyzed: allNodes,
            suspicious_accounts_flagged: suspicious_accounts.length,
            fraud_rings_detected: cleanRings.length,
            processing_time_seconds: parseFloat(
                Math.max(0.1, (Date.now() - startTimeMs) / 1000).toFixed(1)
            ),
        },
    };
}
