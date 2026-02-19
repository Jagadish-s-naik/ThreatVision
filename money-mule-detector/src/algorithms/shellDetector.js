/**
 * shellDetector.js
 * Detects shell account chains (pass-through nodes) using BFS.
 *
 * KEY FIX: Added 3 guards to eliminate LN_ false positives:
 *   GUARD 1 — Pure linear chain detection (all txCount===2, ≤1 unique receiver → skip)
 *   GUARD 2 — Source validation (must actively distribute: uniqueReceivers≥2 OR txCount≥4)
 *   GUARD 3 — Canonical dedup (sort members, join with '|')
 */
import { isLegitimateAccount } from './graphBuilder.js';

function isShellNode(nodeId, nodeStats, graph, reverseGraph) {
    const stats = nodeStats[nodeId];
    if (!stats) return false;
    if (isLegitimateAccount(nodeId, nodeStats)) return false;
    if (stats.txCount < 2 || stats.txCount > 3) return false;
    const hasIncoming = reverseGraph[nodeId] && reverseGraph[nodeId].length > 0;
    const hasOutgoing = graph[nodeId] && graph[nodeId].length > 0;
    return hasIncoming && hasOutgoing;
}

export function detectShellChains(graph, nodeStats) {
    // Build reverse graph
    const reverseGraph = {};
    for (const nodeId of Object.keys(graph)) {
        if (!reverseGraph[nodeId]) reverseGraph[nodeId] = [];
        for (const neighbor of graph[nodeId]) {
            if (!reverseGraph[neighbor]) reverseGraph[neighbor] = [];
            reverseGraph[neighbor].push(nodeId);
        }
    }

    const allChains = [];

    for (const startNode of Object.keys(graph)) {
        if (!graph[startNode]) continue;

        for (const firstNeighbor of graph[startNode]) {
            if (!isShellNode(firstNeighbor, nodeStats, graph, reverseGraph)) continue;

            const queue = [{ chain: [startNode, firstNeighbor], currentNode: firstNeighbor }];

            while (queue.length > 0) {
                const { chain, currentNode } = queue.shift();
                const outgoing = graph[currentNode] || [];

                for (const nextNode of outgoing) {
                    if (chain.includes(nextNode)) continue;

                    if (isShellNode(nextNode, nodeStats, graph, reverseGraph)) {
                        queue.push({ chain: [...chain, nextNode], currentNode: nextNode });
                    } else {
                        const fullChain = [...chain, nextNode];
                        const shellCount = chain.length - 1;
                        if (shellCount < 3) continue;

                        // GUARD 1: Pure linear chain — all nodes have txCount===2
                        // and ≤1 unique receiver (LN_ pattern). Skip.
                        const isPureLinear = fullChain.every((nodeId) => {
                            const s = nodeStats[nodeId];
                            return s && s.txCount === 2 && s.uniqueReceivers.size <= 1;
                        });
                        if (isPureLinear) continue;

                        // GUARD 2: Source must actively distribute funds
                        const sourceId = fullChain[0];
                        const sourceStats = nodeStats[sourceId];
                        if (!sourceStats) continue;
                        if (sourceStats.uniqueReceivers.size < 2 && sourceStats.txCount < 4) continue;

                        allChains.push(fullChain);
                    }
                }
            }
        }
    }

    // GUARD 3: Canonical dedup — sort member IDs alphabetically, join with '|'
    const seen = new Set();
    const finalChains = [];
    for (const chain of allChains) {
        const key = [...chain].sort().join('|');
        if (!seen.has(key)) {
            seen.add(key);
            finalChains.push({
                members: chain,
                pattern_type: 'shell',
                detected_patterns: ['shell_chain'],
            });
        }
    }

    return finalChains;
}
