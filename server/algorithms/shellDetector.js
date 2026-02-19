/**
 * shellDetector.js
 * Detects shell chain patterns of 3-5 hops using Cypher path queries.
 * Applies two guards: isLinear and source must branch.
 */

async function getNodeDegrees(session) {
    const result = await session.run(`
    MATCH (n:Account)
    OPTIONAL MATCH (n)-[:TRANSACTION]->(out:Account)
    OPTIONAL MATCH (inc:Account)-[:TRANSACTION]->(n)
    WITH n,
         count(DISTINCT out) AS uniqueReceivers,
         count(DISTINCT inc) AS uniqueSenders
    RETURN n.id AS id,
           uniqueReceivers,
           uniqueSenders,
           uniqueReceivers + uniqueSenders AS txCount
  `);

    const degrees = {};
    for (const rec of result.records) {
        degrees[rec.get('id')] = {
            uniqueReceivers: rec.get('uniqueReceivers').toNumber(),
            uniqueSenders: rec.get('uniqueSenders').toNumber(),
            txCount: rec.get('txCount').toNumber(),
        };
    }
    return degrees;
}

export async function detectShells(session) {
    const rings = [];
    const seen = new Set();

    const degrees = await getNodeDegrees(session);

    // Find chains of 3-5 hops with low-degree intermediaries
    const result = await session.run(`
    MATCH path = (src:Account)-[:TRANSACTION*3..5]->(dest:Account)
    WHERE src <> dest
    AND ALL(n IN nodes(path)[1..-1] WHERE
      size([(n)-[:TRANSACTION]->() | n]) +
      size([()-[:TRANSACTION]->(n) | n]) <= 3
    )
    RETURN [n IN nodes(path) | n.id] AS members
    LIMIT 500
  `);

    for (const record of result.records) {
        const chain = record.get('members');

        if (chain.length < 2) continue;

        // GUARD 1 — Skip pure linear chains
        const isLinear = chain.every((id) => {
            const s = degrees[id];
            return s && s.txCount <= 2 && s.uniqueReceivers <= 1;
        });
        if (isLinear) continue;

        // GUARD 2 — Source must branch (≥2 receivers)
        const srcStats = degrees[chain[0]];
        if (!srcStats || srcStats.uniqueReceivers < 2) continue;

        const key = [...chain].sort().join('|');
        if (!seen.has(key)) {
            seen.add(key);
            rings.push({ members: chain, pattern: 'shell', patterns: ['shell_chain'] });
        }
    }

    return rings;
}
