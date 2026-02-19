/**
 * shellDetector.js
 * Detects shell account chains (pass-through nodes) using BFS.
 *
 * Guard A: Skip pure linear chains (txCount===2 and <=1 unique receiver per node)
 * Guard B: Require active source injection (sourceOutDegree >= 2)
 * Dedup:   Canonical member-set key
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
                        const shellCount = chain.length - 1; // shells = all nodes minus startNode
                        if (shellCount < 3) continue; // need at least 3 consecutive shell hops

                        // Build chain object (members array)
                        const chainObj = {
                            members: fullChain,
                            pattern_type: 'shell',
                            detected_patterns: ['shell_chain'],
                        };

                        // ── GUARD A: Skip pure linear chains ──
                        // A pure linear chain = every node has txCount===2 AND sends to only 1 receiver
                        // This is normal A→B→C payment flow, NOT a shell network
                        const isPureLinear = chainObj.members.every(memberId => {
                            const st = nodeStats[memberId];
                            if (!st) return false;
                            const txCount = st.txCount ?? 0;
                            const uniqueRecv = st.uniqueReceivers?.size ?? 0;
                            return txCount === 2 && uniqueRecv <= 1;
                        });
                        if (isPureLinear) continue; // skip this chain, do NOT push it

                        // ── GUARD B: Require active source injection ──
                        // The first node (source) must send to 2+ different accounts,
                        // proving it's injecting funds into multiple shell paths
                        const sourceId = chainObj.members[0];
                        const sourceSt = nodeStats[sourceId];
                        const sourceOutDegree = sourceSt?.uniqueReceivers?.size ?? 0;
                        if (sourceOutDegree < 2) continue; // single-path source, skip

                        // ── NOW push the chain (passes both guards) ──
                        chains.push(chainObj);
                    }
                }
            }
        }
    }

    // ── DEDUPLICATION: remove chains with identical member sets ──
    const seenShellKeys = new Set();
    const deduplicatedChains = [];
    for (const chain of chains) {
        const key = [...chain.members].sort().join('|');
        if (!seenShellKeys.has(key)) {
            seenShellKeys.add(key);
            deduplicatedChains.push(chain);
        }
    }
    return deduplicatedChains;
}
