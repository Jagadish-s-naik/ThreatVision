/**
 * jsonExporter.js
 * Generates and downloads the fraud analysis JSON report.
 */

/**
 * Generates the fraud analysis JSON output.
 * @param {Array} suspiciousAccounts - Array of suspicious account objects
 * @param {Array} fraudRings - Array of fraud ring objects
 * @param {number} totalAccounts - Total unique account count
 * @param {number} startTimeMs - Date.now() at analysis start
 * @returns {Object} The complete JSON output object
 */
export function generateJSON(suspiciousAccounts, fraudRings, totalAccounts, startTimeMs) {
    const processingTimeSec = parseFloat(((Date.now() - startTimeMs) / 1000).toFixed(1));

    // Sort suspicious accounts by suspicion_score descending
    const sortedAccounts = [...suspiciousAccounts].sort(
        (a, b) => b.suspicion_score - a.suspicion_score
    );

    // Ensure scores are floats
    const outputAccounts = sortedAccounts.map((acc) => ({
        account_id: acc.account_id,
        suspicion_score: parseFloat(acc.suspicion_score.toFixed(1)),
        detected_patterns: acc.detected_patterns,
        ring_id: acc.ring_id,
    }));

    // Build member_accounts for fraud rings — only include accounts in suspicious list
    const suspiciousSet = new Set(sortedAccounts.map((a) => a.account_id));
    const outputRings = fraudRings.map((ring) => ({
        ring_id: ring.ring_id,
        member_accounts: ring.member_accounts.filter((id) => suspiciousSet.has(id)),
        pattern_type: ring.pattern_type,
        risk_score: parseFloat(ring.risk_score.toFixed(1)),
    }));

    return {
        suspicious_accounts: outputAccounts,
        fraud_rings: outputRings,
        summary: {
            total_accounts_analyzed: totalAccounts,
            suspicious_accounts_flagged: outputAccounts.length,
            fraud_rings_detected: outputRings.length,
            processing_time_seconds: processingTimeSec,
        },
    };
}

/**
 * Downloads the JSON object as a file.
 * @param {Object} output - The JSON output object
 */
export function downloadJSON(output) {
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fraud_analysis.json';
    a.click();
    URL.revokeObjectURL(url);
}
