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

    const uniqueSenders = stats.uniqueSenders?.size ?? 0;
    const uniqueReceivers = stats.uniqueReceivers?.size ?? 0;
    const totalCounterparties = uniqueSenders + uniqueReceivers;

    // Rule 1: High-volume merchant — many DIFFERENT people send to it
    // e.g. MERCHANT_AMAZON: 50 customers → Rule 1 catches it, NOT flagged
    if (uniqueSenders >= 30) return true;

    // Rule 2: High-volume distributor — sends to many different people
    // e.g. BIG_MERCH with 60 unique receivers → NOT flagged
    if (uniqueReceivers >= 50) return true;

    // Rule 3: Total counterparty volume — high-traffic hub either direction
    if (totalCounterparties >= 50) return true;

    // Rule 4: System account — extremely high volume
    if (stats.txCount > 500) return true;

    // Rule 5: Payroll pattern — sends to 20+ receivers spread over 7+ days
    if (uniqueReceivers >= 20 && stats.txCount >= 20) {
        const timestamps = stats.timestamps || [];
        if (timestamps.length >= 2) {
            const sorted = [...timestamps].sort((a, b) => new Date(a) - new Date(b));
            const totalSpanDays =
                (new Date(sorted[sorted.length - 1]) - new Date(sorted[0])) /
                (1000 * 60 * 60 * 24);
            if (totalSpanDays >= 7) return true;
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
