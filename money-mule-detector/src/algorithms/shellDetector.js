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

                        // GUARD 1: Skip pure linear chains
                        // A pure linear chain has every node with txCount=2 AND
                        // only 1 unique receiver — normal A→B→C payments, not shells
                        const isPureLinear = chainObj.members.every(id => {
                            const st = nodeStats[id];
                            return st &&
                                (st.txCount ?? 0) === 2 &&
                                (st.uniqueReceivers?.size ?? 0) <= 1;
                        });
                        if (isPureLinear) continue;  // skip — do NOT push

                        // GUARD 2: Require branching source
                        // Source node must send to 2+ receivers (proves active injection)
                        const srcStats = nodeStats[chainObj.members[0]];
                        if (!srcStats || (srcStats.uniqueReceivers?.size ?? 0) < 2) continue;

                        // Only now push — passed both guards
                        chains.push(chainObj);
                    }
                }
            }
        }
    }

    // Deduplication
    const shellSeen = new Set();
    const dedupedShells = chains.filter(chain => {
        const key = [...chain.members].sort().join('|');
        if (shellSeen.has(key)) return false;
        shellSeen.add(key);
        return true;
    });
    return dedupedShells;
}
