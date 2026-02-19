/**
 * graphBuilder.js
 * Builds graph structures from transaction data.
 */

/**
 * Returns true if the account should be treated as legitimate (not flagged).
 * @param {string} accountId
 * @param {Object} nodeStats
 */
export function isLegitimateAccount(accountId, nodeStats) {
    const stats = nodeStats[accountId];
    if (!stats) return false;

    // High-volume merchant / system account
    if (stats.txCount > 500) return true;

    // Large merchant with many unique counterparties
    if (
        stats.txCount > 200 &&
        stats.uniqueSenders.size + stats.uniqueReceivers.size > 80
    ) {
        return true;
    }

    // Payroll pattern: sends to 50+ unique receivers with nearly identical amounts
    // and transactions spaced ~7 days apart
    if (stats.uniqueReceivers.size >= 50) {
        const sentAmounts = stats.amounts.filter((_, i) => i < stats.sentTimestamps.length);
        if (sentAmounts.length >= 50) {
            const avgAmount = sentAmounts.reduce((a, b) => a + b, 0) / sentAmounts.length;
            const allNearlyIdentical = sentAmounts.every(
                (amt) => Math.abs(amt - avgAmount) / avgAmount < 0.05
            );

            if (allNearlyIdentical) {
                // Check if timestamps are ~7 days apart
                const sorted = [...stats.sentTimestamps].sort((a, b) => a - b);
                if (sorted.length >= 2) {
                    const gaps = [];
                    for (let i = 1; i < sorted.length; i++) {
                        gaps.push(sorted[i] - sorted[i - 1]);
                    }
                    const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
                    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
                    if (Math.abs(avgGap - sevenDaysMs) / sevenDaysMs < 0.2) {
                        return true;
                    }
                }
            }
        }
    }

    return false;
}

/**
 * Builds graph and reverse-graph adjacency lists from transactions.
 * @param {Array} transactions - Parsed transaction objects
 * @returns {{ graph, reverseGraph, nodeStats, allNodes, edges }}
 */
export function buildGraph(transactions) {
    const graph = {}; // adjacency list: nodeId -> [neighbor1, ...]
    const reverseGraph = {}; // reverse: nodeId -> [predecessor1, ...]
    const nodeStats = {};
    const allNodes = new Set();
    const edges = [];

    function ensureNode(id) {
        if (!nodeStats[id]) {
            nodeStats[id] = {
                txCount: 0,
                totalSent: 0,
                totalReceived: 0,
                uniqueSenders: new Set(),
                uniqueReceivers: new Set(),
                timestamps: [],
                sentTimestamps: [],
                receivedTimestamps: [],
                amounts: [],
                hourlyBuckets: {},
                ringMemberships: [],
            };
        }
        if (!graph[id]) graph[id] = [];
        if (!reverseGraph[id]) reverseGraph[id] = [];
        allNodes.add(id);
    }

    for (const tx of transactions) {
        const sender = String(tx.sender_id).trim();
        const receiver = String(tx.receiver_id).trim();
        const amount = parseFloat(tx.amount);
        const ts = tx.timestamp instanceof Date ? tx.timestamp : new Date(tx.timestamp);
        const txId = String(tx.transaction_id).trim();

        // Skip invalid rows
        if (!sender || !receiver || isNaN(amount) || isNaN(ts.getTime())) continue;

        ensureNode(sender);
        ensureNode(receiver);

        // Build adjacency list (avoid duplicate edges but allow multiple transactions)
        if (!graph[sender].includes(receiver)) {
            graph[sender].push(receiver);
        }
        if (!reverseGraph[receiver].includes(sender)) {
            reverseGraph[receiver].push(sender);
        }

        // Sender stats
        nodeStats[sender].txCount++;
        nodeStats[sender].totalSent += amount;
        nodeStats[sender].uniqueReceivers.add(receiver);
        nodeStats[sender].timestamps.push(ts);
        nodeStats[sender].sentTimestamps.push(ts);
        nodeStats[sender].amounts.push(amount);

        // Receiver stats
        nodeStats[receiver].txCount++;
        nodeStats[receiver].totalReceived += amount;
        nodeStats[receiver].uniqueSenders.add(sender);
        nodeStats[receiver].timestamps.push(ts);
        nodeStats[receiver].receivedTimestamps.push(ts);
        nodeStats[receiver].amounts.push(amount);

        // Hourly buckets — for both sender and receiver
        const year = ts.getFullYear();
        const month = String(ts.getMonth() + 1).padStart(2, '0');
        const day = String(ts.getDate()).padStart(2, '0');
        const hour = String(ts.getHours()).padStart(2, '0');
        const bucketKey = `${year}-${month}-${day}-${hour}`;

        nodeStats[sender].hourlyBuckets[bucketKey] =
            (nodeStats[sender].hourlyBuckets[bucketKey] || 0) + 1;
        nodeStats[receiver].hourlyBuckets[bucketKey] =
            (nodeStats[receiver].hourlyBuckets[bucketKey] || 0) + 1;

        edges.push({ sender_id: sender, receiver_id: receiver, amount, timestamp: ts, transaction_id: txId });
    }

    return { graph, reverseGraph, nodeStats, allNodes, edges };
}
