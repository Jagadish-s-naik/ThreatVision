/**
 * cycleDetector.js
 * Runs Cypher queries to detect fraud cycles of length 3, 4, and 5.
 */

export async function detectCycles(session) {
    const rings = [];
    const seen = new Set();

    // Cycle length 3
    const r3 = await session.run(`
    MATCH (a:Account)-[:TRANSACTION]->(b:Account)
          -[:TRANSACTION]->(c:Account)
          -[:TRANSACTION]->(a)
    WHERE a.id < b.id AND a.id < c.id
    RETURN DISTINCT [a.id, b.id, c.id] AS members
  `);

    for (const record of r3.records) {
        const members = record.get('members');
        const key = [...members].sort().join('|');
        if (!seen.has(key)) {
            seen.add(key);
            rings.push({ members, pattern: 'cycle' });
        }
    }

    // Cycle length 4
    const r4 = await session.run(`
    MATCH (a:Account)-[:TRANSACTION]->(b:Account)
          -[:TRANSACTION]->(c:Account)
          -[:TRANSACTION]->(d:Account)
          -[:TRANSACTION]->(a)
    WHERE a.id < b.id AND a.id < c.id AND a.id < d.id
    RETURN DISTINCT [a.id, b.id, c.id, d.id] AS members
  `);

    for (const record of r4.records) {
        const members = record.get('members');
        const key = [...members].sort().join('|');
        if (!seen.has(key)) {
            seen.add(key);
            rings.push({ members, pattern: 'cycle' });
        }
    }

    // Cycle length 5
    const r5 = await session.run(`
    MATCH (a:Account)-[:TRANSACTION]->(b:Account)
          -[:TRANSACTION]->(c:Account)
          -[:TRANSACTION]->(d:Account)
          -[:TRANSACTION]->(e:Account)
          -[:TRANSACTION]->(a)
    WHERE a.id < b.id AND a.id < c.id AND a.id < d.id AND a.id < e.id
    RETURN DISTINCT [a.id, b.id, c.id, d.id, e.id] AS members
  `);

    for (const record of r5.records) {
        const members = record.get('members');
        const key = [...members].sort().join('|');
        if (!seen.has(key)) {
            seen.add(key);
            rings.push({ members, pattern: 'cycle' });
        }
    }

    return rings;
}
