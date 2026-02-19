/**
 * cycleDetector.js
 * Detects circular money routing cycles of length 3, 4, or 5
 * using iterative DFS (no recursion to avoid stack overflow).
 */
import { isLegitimateAccount } from './graphBuilder.js';

/**
 * Rotate array so that the lexicographically smallest element is first.
 * Returns a canonical string key.
 */
function canonicalizeCycle(members) {
    let minIdx = 0;
    for (let i = 1; i < members.length; i++) {
        if (members[i] < members[minIdx]) minIdx = i;
    }
    const rotated = [...members.slice(minIdx), ...members.slice(0, minIdx)];
    return rotated.join('|');
}

/**
 * Detects cycles of length 3, 4, or 5 using iterative DFS.
 * @param {Object} graph - Adjacency list { nodeId: [neighbor, ...] }
 * @param {Object} nodeStats - Per-node stats
 * @returns {Array} Array of cycle objects
 */
export function detectCycles(graph, nodeStats) {
    const seenKeys = new Set();
    const cycles = [];
    const allNodes = Object.keys(graph);

    for (const startNode of allNodes) {
        // Skip legitimate accounts as start nodes
        if (isLegitimateAccount(startNode, nodeStats)) continue;

        // Iterative DFS stack entries: { path: [...nodes], current: node }
        const stack = [{ path: [startNode], current: startNode }];

        while (stack.length > 0) {
            const { path, current } = stack.pop();

            const depth = path.length;
            // Max path depth before we check for cycle is 5
            if (depth > 5) continue;

            const neighbors = graph[current] || [];

            for (const neighbor of neighbors) {
                // Found a cycle back to start
                if (neighbor === startNode && depth >= 3) {
                    const cycleMembers = [...path];
                    const key = canonicalizeCycle(cycleMembers);

                    if (!seenKeys.has(key)) {
                        // Exclude cycle if ALL members are legitimate
                        const allLegit = cycleMembers.every((m) =>
                            isLegitimateAccount(m, nodeStats)
                        );
                        if (!allLegit) {
                            seenKeys.add(key);
                            const len = cycleMembers.length;
                            cycles.push({
                                members: cycleMembers,
                                length: len,
                                pattern_type: 'cycle',
                                detected_patterns: [`cycle_length_${len}`],
                            });
                        }
                    }
                    continue;
                }

                // Don't revisit nodes already in path (except start, checked above)
                if (path.includes(neighbor)) continue;

                // Only continue if depth allows (max 5 nodes in cycle)
                if (depth < 5) {
                    stack.push({ path: [...path, neighbor], current: neighbor });
                }
            }
        }
    }

    return cycles;
}
