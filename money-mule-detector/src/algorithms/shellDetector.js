/**
 * shellDetector.js
 * Detects shell account chains (pass-through nodes) using BFS.
 *
 * FIX: The old BFS started from every node in a linear chain, producing N-2
 * overlapping sub-chains (LN_002→LN_030, LN_003→LN_030, LN_004→LN_030...)
 * from the same underlying structure. The fix post-processes candidates and
 * keeps only the LONGEST chain per unique destination node, discarding all
 * sub-chains that are proper subsets of a longer discovered chain.
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
 * Minimum: 3 hops (source → shell1 → shell2 → shell3 → destination)
 * Deduplication: for each destination node, only the LONGEST chain is kept.
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

    // Collect all candidate chains (before dedup)
    // key: "source|destination" → longest chain seen for that pair
    const bestChainBySourceDest = new Map();

    for (const startNode of Object.keys(graph)) {
        if (!graph[startNode]) continue;

        for (const firstNeighbor of graph[startNode]) {
            if (!isShellNode(firstNeighbor, nodeStats, graph, reverseGraph)) continue;

            // BFS: grow chain through consecutive shell nodes
            const queue = [{ chain: [startNode, firstNeighbor], currentNode: firstNeighbor }];

            while (queue.length > 0) {
                const { chain, currentNode } = queue.shift();

                const outgoing = graph[currentNode] || [];
                for (const nextNode of outgoing) {
                    if (chain.includes(nextNode)) continue; // no cycles

                    if (isShellNode(nextNode, nodeStats, graph, reverseGraph)) {
                        // Continue building chain through shell
                        queue.push({ chain: [...chain, nextNode], currentNode: nextNode });
                    } else {
                        // nextNode is destination (non-shell end)
                        const fullChain = [...chain, nextNode];
                        const shellCount = chain.length - 1; // shells = chain nodes minus startNode
                        if (shellCount < 3) continue; // need at least 3 consecutive shell hops

                        // Dedup key: first node (source) + last node (destination)
                        // For the same source→destination, keep the longest chain
                        const source = fullChain[0];
                        const dest = fullChain[fullChain.length - 1];
                        const dedupKey = `${source}|${dest}`;

                        const existing = bestChainBySourceDest.get(dedupKey);
                        if (!existing || fullChain.length > existing.length) {
                            bestChainBySourceDest.set(dedupKey, fullChain);
                        }
                    }
                }
            }
        }
    }

    // Step 2: among surviving chains, discard any chain whose members are a
    // strict subset of a longer chain's members (catches overlapping chains
    // with different sources but same shell segment and destination).
    const candidates = [...bestChainBySourceDest.values()];
    const memberSets = candidates.map((chain) => new Set(chain));

    const chains = [];
    for (let i = 0; i < candidates.length; i++) {
        const setI = memberSets[i];
        let isSubset = false;
        for (let j = 0; j < candidates.length; j++) {
            if (i === j) continue;
            if (candidates[j].length <= candidates[i].length) continue;
            // Check if all members of chain[i] appear in chain[j]
            let allIn = true;
            for (const m of setI) {
                if (!memberSets[j].has(m)) { allIn = false; break; }
            }
            if (allIn) { isSubset = true; break; }
        }
        if (!isSubset) {
            chains.push({
                members: candidates[i],
                pattern_type: 'shell',
                detected_patterns: ['shell_chain'],
            });
        }
    }

    return chains;
}
