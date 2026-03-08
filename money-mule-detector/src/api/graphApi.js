/**
 * graphApi.js
 * Fetches graph analytics data from the Neo4j backend /api/graph endpoint.
 * Falls back to building graph data from local transaction rows when the
 * backend is unavailable (local analysis mode).
 */

let _raw = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';
if (!_raw.includes('://')) _raw = 'https://' + _raw;
const BACKEND_URL = _raw.replace(/\/$/, '');

/**
 * Fetch Neo4j-computed graph analytics.
 * @returns {{ nodes, edges, hubs, analytics } | null}
 */
export async function fetchGraphData() {
    try {
        const res = await fetch(`${BACKEND_URL}/api/graph`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (!data.nodes || data.nodes.length === 0) return null;
        return data;
    } catch (err) {
        console.warn('[graphApi] Backend unavailable, graph data will be built locally:', err.message);
        return null;
    }
}

/**
 * Build graph data from local transaction rows (used in fallback/local mode).
 * Computes degree centrality in the browser.
 * @param {Array} transactions - raw CSV row objects
 * @param {Array} suspiciousAccounts - from analysis result
 * @returns {{ nodes, edges, hubs, analytics }}
 */
export function buildLocalGraphData(transactions) {
    const nodeMap = {};
    const edgeList = [];

    for (const tx of transactions) {
        const src = String(tx.sender_id).trim();
        const tgt = String(tx.receiver_id).trim();
        const amt = parseFloat(tx.amount) || 0;

        if (!nodeMap[src]) nodeMap[src] = { id: src, outDegree: 0, inDegree: 0, totalSent: 0, totalReceived: 0, txCount: 0 };
        if (!nodeMap[tgt]) nodeMap[tgt] = { id: tgt, outDegree: 0, inDegree: 0, totalSent: 0, totalReceived: 0, txCount: 0 };

        nodeMap[src].outDegree++;
        nodeMap[src].totalSent += amt;
        nodeMap[src].txCount++;
        nodeMap[tgt].inDegree++;
        nodeMap[tgt].totalReceived += amt;
        nodeMap[tgt].txCount++;

        edgeList.push({
            source: src,
            target: tgt,
            txId: tx.transaction_id,
            amount: amt,
            timestamp: tx.timestamp,
        });
    }

    const nodes = Object.values(nodeMap).map((n) => ({
        ...n,
        degree: n.outDegree + n.inDegree,
        totalVolume: n.totalSent + n.totalReceived,
        isHub: false,
        centralityScore: 0,
    }));

    const maxDegree = Math.max(...nodes.map((n) => n.degree), 1);
    const maxVolume = Math.max(...nodes.map((n) => n.totalVolume), 1);

    for (const n of nodes) {
        n.centralityScore = parseFloat(
            (((n.degree / maxDegree) * 0.5 + (n.totalVolume / maxVolume) * 0.5) * 100).toFixed(1)
        );
    }

    // Hub detection: degree >= mean + 1.5*stddev
    const mean = nodes.reduce((s, n) => s + n.degree, 0) / nodes.length;
    const variance = nodes.reduce((s, n) => s + (n.degree - mean) ** 2, 0) / nodes.length;
    const stddev = Math.sqrt(variance);
    const hubThreshold = mean + 1.5 * stddev;

    const hubs = [];
    for (const n of nodes) {
        if (n.degree >= hubThreshold) {
            n.isHub = true;
            hubs.push(n.id);
        }
    }

    return {
        nodes,
        edges: edgeList,
        hubs,
        analytics: {
            totalNodes: nodes.length,
            totalEdges: edgeList.length,
            hubCount: hubs.length,
            maxDegree,
            maxVolume,
        },
    };
}
