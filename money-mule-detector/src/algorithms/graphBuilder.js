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

    const numSenders = stats.uniqueSenders?.size ?? 0;
    const numReceivers = stats.uniqueReceivers?.size ?? 0;
    const totalCounterparties = numSenders + numReceivers;

    // Rule 1: Merchant pattern
    // Many DIFFERENT people send money TO this account (e.g. e-commerce store)
    // MERCHANT_AMAZON has uniqueSenders=50 → caught here
    if (numSenders >= 30) return true;

    // Rule 2: Mass distributor
    // This account sends to very many unique receivers
    // BIG_MERCH has uniqueReceivers=60 → caught here
    if (numReceivers >= 50) return true;

    // Rule 3: High-traffic hub (either direction combined)
    if (totalCounterparties >= 50) return true;

    // Rule 4: Extremely high transaction volume system account
    if (stats.txCount > 500) return true;

    // Rule 5: Payroll pattern
    // Sends to 20+ unique receivers BUT transactions are spread across 7+ days
    // (smurfing happens in tight windows; payroll is periodic)
    // PAYROLL_SYS: 30 receivers, spans 14 days → caught here
    if (numReceivers >= 20 && stats.txCount >= 20) {
        const timestamps = (stats.timestamps || [])
            .map(t => typeof t === 'number' ? t : new Date(t).getTime())
            .sort((a, b) => a - b);
        if (timestamps.length >= 2) {
            const spanDays = (timestamps[timestamps.length - 1] - timestamps[0])
                / (1000 * 60 * 60 * 24);
            if (spanDays >= 7) return true;
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
