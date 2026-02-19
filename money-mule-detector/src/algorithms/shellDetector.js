/**
 * shellDetector.js
 * Detects shell account chains (pass-through nodes) using BFS.
 */
import { isLegitimateAccount } from './graphBuilder.js';

/**
 * Returns true if account is a shell node:
 * txCount >= 2 AND txCount <= 3, has both incoming AND outgoing edges,
 * does NOT pass isLegitimateAccount()
 */
function isShellNode(nodeId, nodeStats, graph, reverseGraph) {
    const stats = nodeStats[nodeId];
    if (!stats) return false;
    if (isLegitimateAccount(nodeId, nodeStats)) return false;
    if (stats.txCount < 2 || stats.txCount > 3) return false;
    const hasIncoming = reverseGraph[nodeId] && reverseGraph[nodeId].length > 0;
    const hasOutgoing = graph[nodeId] && graph[nodeId].length > 0;
    return hasIncoming && hasOutgoing;
}

/**
 * Detects chains of 3+ consecutive shell nodes using BFS.
 * Minimum: 3 hops (4 nodes: source → shell1 → shell2 → shell3 → destination)
 */
export function detectShellChains(graph, nodeStats) {
    // Build reverse graph from nodeStats keys
    const reverseGraph = {};
    for (const nodeId of Object.keys(graph)) {
        if (!reverseGraph[nodeId]) reverseGraph[nodeId] = [];
        for (const neighbor of graph[nodeId]) {
            if (!reverseGraph[neighbor]) reverseGraph[neighbor] = [];
            reverseGraph[neighbor].push(nodeId);
        }
    }

    const chains = [];
    const seenChainKeys = new Set();

    // For each node, do BFS to find chains of shell nodes
    for (const startNode of Object.keys(graph)) {
        // Start BFS if startNode has outgoing edges to shell nodes
        if (!graph[startNode]) continue;

        for (const firstNeighbor of graph[startNode]) {
            if (!isShellNode(firstNeighbor, nodeStats, graph, reverseGraph)) continue;

            // BFS queue entries: { chain: [startNode, shell1, ...], currentNode }
            const queue = [{ chain: [startNode, firstNeighbor], currentNode: firstNeighbor }];

            while (queue.length > 0) {
                const { chain, currentNode } = queue.shift();

                // Check outgoing edges of currentNode
                const outgoing = graph[currentNode] || [];
                for (const nextNode of outgoing) {
                    if (chain.includes(nextNode)) continue; // avoid cycles

                    if (isShellNode(nextNode, nodeStats, graph, reverseGraph)) {
                        // Continue chain
                        const newChain = [...chain, nextNode];
                        queue.push({ chain: newChain, currentNode: nextNode });
                    } else {
                        // nextNode is destination (not a shell)
                        const fullChain = [...chain, nextNode];
                        // Minimum: [source, shell1, shell2, shell3, destination] = 5 nodes (4 hops)
                        // Actually: source → shell1 → shell2 → shell3 → dest = 4 hops minimum
                        // chain.length before adding nextNode must be >= 4 (source + 3 shells)
                        const shellCount = chain.length - 1; // exclude start node
                        if (shellCount >= 3) {
                            const key = fullChain.join('|');
                            if (!seenChainKeys.has(key)) {
                                seenChainKeys.add(key);
                                chains.push({
                                    members: fullChain,
                                    pattern_type: 'shell',
                                    detected_patterns: ['shell_chain'],
                                });
                            }
                        }
                    }
                }
            }
        }
    }

    return chains;
}
