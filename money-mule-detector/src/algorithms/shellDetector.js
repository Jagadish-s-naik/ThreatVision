/**
 * shellDetector.js
 * Detects shell account chains (pass-through nodes) using BFS.
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

    const chains = [];

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

                        const chainObj = {
                            members: fullChain,
                            pattern_type: 'shell',
                            detected_patterns: ['shell_chain'],
                        };

                        // Guard 1: skip pure linear chains
                        const isLinear = chainObj.members.every(id => {
                            const st = nodeStats[id];
                            return st && st.txCount === 2 &&
                                (st.uniqueReceivers?.size ?? 0) <= 1;
                        });
                        if (isLinear) continue;

                        // Guard 2: source must branch (send to 2+ receivers)
                        const src = nodeStats[chainObj.members[0]];
                        if (!src || (src.uniqueReceivers?.size ?? 0) < 2) continue;

                        chains.push(chainObj); // ← only reaches here if both guards pass
                    }
                }
            }
        }
    }

    // Deduplication
    const seen = new Set();
    return chains.filter(c => {
        const k = [...c.members].sort().join('|');
        return seen.has(k) ? false : (seen.add(k), true);
    });
}
