/**
 * suspicionScorer.js
 * Calculates suspicion scores for accounts and risk scores for rings.
 */

const PATTERN_WEIGHTS = {
    cycle_length_3: 40,
    cycle_length_4: 35,
    cycle_length_5: 30,
    fan_in: 25,
    fan_out: 25,
    shell_chain: 20,
    high_velocity: 15,
};

/**
 * Calculates the suspicion score for an account.
 * @param {string} accountId
 * @param {string[]} detectedPatterns - Array of pattern strings
 * @param {Object} nodeStats - Per-node stats map
 * @param {Array} transactions - All transactions
 * @returns {number} Float 0.0 – 100.0
 */
export function calculateSuspicionScore(accountId, detectedPatterns, nodeStats, transactions) {
    let score = 0;

    // Base pattern scores
    for (const pattern of detectedPatterns) {
        if (PATTERN_WEIGHTS[pattern] !== undefined) {
            score += PATTERN_WEIGHTS[pattern];
        }
    }

    const stats = nodeStats[accountId];
    if (!stats) return parseFloat(Math.min(score, 100).toFixed(1));

    // Bonus: Account appears in 2+ different rings
    if (stats.ringMemberships && stats.ringMemberships.length >= 2) {
        score += 10;
    }

    // Bonus: >50% of transactions are round amounts (amount % 500 === 0 OR amount % 1000 === 0)
    const amounts = stats.amounts || [];
    if (amounts.length > 0) {
        const roundCount = amounts.filter(
            (amt) => amt % 500 === 0 || amt % 1000 === 0
        ).length;
        if (roundCount / amounts.length > 0.5) {
            score += 5;
        }
    }

    // Bonus: All transactions clustered within a 24-hour window
    const timestamps = stats.timestamps || [];
    if (timestamps.length >= 2) {
        const minTs = Math.min(...timestamps.map((t) => t.getTime()));
        const maxTs = Math.max(...timestamps.map((t) => t.getTime()));
        const spanMs = maxTs - minTs;
        if (spanMs <= 24 * 60 * 60 * 1000) {
            score += 8;
        }
    }

    return parseFloat(Math.min(score, 100).toFixed(1));
}

/**
 * Calculates ring risk score as average of member suspicion scores.
 * @param {number[]} memberScores - Array of suspicion scores
 * @returns {number} Float 0.0 – 100.0
 */
export function calculateRingRiskScore(memberScores) {
    if (!memberScores || memberScores.length === 0) return 0.0;
    const avg = memberScores.reduce((a, b) => a + b, 0) / memberScores.length;
    return parseFloat(Math.min(avg, 100).toFixed(1));
}
