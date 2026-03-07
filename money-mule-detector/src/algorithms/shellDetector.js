/**
 * shellDetector.js
 * Detects layered shell-account chains using DFS.
 *
 * Criteria for a shell chain:
 *  - Chain length ≥ 4 nodes
 *  - All INTERMEDIATE nodes have ≤ 3 total transactions (low-activity shells)
 *  - Minimum amount flowing along the chain is > 5,000
 *  - Each hop reduces the amount by ≤ 15% (typical layering — minimal skimming)
 */
import { isLegitimateAccount } from './graphBuilder.js';

export function detectShellChains(transactions, nodeStats) {
    // Build transaction-count map (for shell identification)
    const txCount = {};
    for (const t of transactions) {
        txCount[t.sender_id]   = (txCount[t.sender_id]   || 0) + 1;
        txCount[t.receiver_id] = (txCount[t.receiver_id] || 0) + 1;
    }

    // Build directed graph: nodeId → [{ to, amount, time }]
    const graph = {};
    for (const t of transactions) {
        if (!graph[t.sender_id]) graph[t.sender_id] = [];
        graph[t.sender_id].push({
            to:     t.receiver_id,
            amount: parseFloat(t.amount) || 0,
            time:   t.timestamp,
        });
    }

    const rings   = [];
    const seenKey = new Set();

    /**
     * Iterative DFS. Each stack frame carries:
     *   path    – ordered list of account IDs visited so far
     *   amounts – list of edge amounts along the path (length = path.length - 1)
     */
    function dfs(startNode, firstEdge) {
        const stack = [{
            path:    [startNode, firstEdge.to],
            amounts: [firstEdge.amount],
        }];

        while (stack.length > 0) {
            const { path, amounts } = stack.pop();
            const current = path[path.length - 1];

            // ── Evaluate if this path qualifies as a shell chain ──
            if (path.length >= 4) {
                const intermediates = path.slice(1, -1);
                const allShell      = intermediates.every(acc => (txCount[acc] || 0) <= 3);
                const minAmount     = Math.min(...amounts);
                const isLargeAmount = minAmount > 5000;

                let isLayering = true;
                for (let i = 1; i < amounts.length; i++) {
                    const reduction = (amounts[i - 1] - amounts[i]) / amounts[i - 1];
                    if (reduction > 0.15) { isLayering = false; break; }
                }

                if (allShell && isLargeAmount && isLayering) {
                    const key = [...path].sort().join('|');
                    if (!seenKey.has(key)) {
                        seenKey.add(key);
                        rings.push({
                            members:           path,
                            pattern_type:      'layered_shell_network',
                            detected_patterns: ['shell_chain'],
                            chain_length:      path.length,
                            risk_score:        Math.min(100, 85 + Math.min(10, path.length * 2)),
                        });
                    }
                    continue; // Don't extend further — we found a valid chain head
                }
            }

            // ── Limit depth ──
            if (path.length > 6) continue;

            // ── Extend path ──
            const neighbors = graph[current] || [];
            for (const edge of neighbors) {
                if (!path.includes(edge.to)) {
                    stack.push({
                        path:    [...path, edge.to],
                        amounts: [...amounts, edge.amount],
                    });
                }
            }
        }
    }

    // Start DFS from every node with low total transaction count (potential shell origin)
    for (const account of Object.keys(graph)) {
        if (isLegitimateAccount(account, nodeStats)) continue;
        if ((txCount[account] || 0) <= 4) {
            for (const edge of graph[account]) {
                if (edge.amount > 5000) {
                    dfs(account, edge);
                }
            }
        }
    }

    return rings;
}
