/**
 * jsonExporter.js
 * Generates and downloads the fraud analysis JSON report.
 */

/**
 * Custom JSON replacer that ensures score fields always have a decimal point.
 * JavaScript's JSON.stringify converts 83.0 → "83" (no decimal).
 * We use a toFixed(1) string then parse back, but to force the decimal in output
 * we must store scores as strings like "83.0" — but spec requires numbers.
 * 
 * Solution: We format the entire JSON manually for score fields using toFixed(1),
 * which guarantees decimal points in the raw JSON string.
 */
export function formatJSONString(obj) {
    return JSON.stringify(obj, (key, value) => {
        // Force float representation for score fields
        if (
            (key === 'suspicion_score' || key === 'risk_score' || key === 'processing_time_seconds') &&
            typeof value === 'number'
        ) {
            // Return as a specially tagged object; handled in the stringify post-pass
            return value;
        }
        return value;
    }, 2).replace(
        // Post-process: find all score values that are bare integers (e.g. "83") and add .0
        /"(suspicion_score|risk_score|processing_time_seconds)":\s*(\d+)(?![\d.])/g,
        '"$1": $2.0'
    );
}

/**
 * Generates the fraud analysis JSON output.
 * @param {Array} suspiciousAccounts - Array of suspicious account objects
 * @param {Array} fraudRings - Array of fraud ring objects
 * @param {number} totalAccounts - Total unique account count
 * @param {number} startTimeMs - Date.now() at analysis start
 * @returns {Object} The complete JSON output object
 */
export function generateJSON(suspiciousAccounts, fraudRings, totalAccounts, startTimeMs) {
    const processingTimeSec = parseFloat(Math.max(0.1, (Date.now() - startTimeMs) / 1000).toFixed(1));

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
    const outputRings = fraudRings
        .map((ring) => ({
            ring_id: ring.ring_id,
            member_accounts: ring.member_accounts.filter((id) => suspiciousSet.has(id)),
            pattern_type: ring.pattern_type,
            risk_score: parseFloat(ring.risk_score.toFixed(1)),
        }))
        .filter((ring) => ring.member_accounts.length > 0);

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
 * Downloads the JSON object as a file, ensuring float scores have decimal points.
 * @param {Object} output - The JSON output object
 */
export function downloadJSON(output) {
    // Use custom formatter to guarantee float representation in the raw JSON text
    const jsonString = formatJSONString(output);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'fraud_analysis.json';
    a.click();
    URL.revokeObjectURL(url);
}
