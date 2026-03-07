/**
 * graphAnalytics.js
 * Runs Neo4j Cypher-native graph analytics on the loaded transaction graph.
 * Computes: degree centrality, in/out flow, velocity, hub scores.
 * Does NOT require GDS — works on AuraDB Free with pure Cypher.
 */

/**
 * Fetch every Account node with analytics computed in Cypher.
 */
export async function computeNodeAnalytics(session) {
    const result = await session.run(`
        MATCH (n:Account)
        OPTIONAL MATCH (n)-[out:TRANSACTION]->()
        OPTIONAL MATCH ()-[in:TRANSACTION]->(n)
        WITH n.id AS id,
             count(DISTINCT out)          AS outDegree,
             count(DISTINCT in)           AS inDegree,
             coalesce(sum(out.amount), 0) AS totalSent,
             coalesce(sum(in.amount), 0)  AS totalReceived,
             collect(DISTINCT in.timestamp)  AS inTimestamps,
             collect(DISTINCT out.timestamp) AS outTimestamps
        RETURN
            id,
            outDegree,
            inDegree,
            (outDegree + inDegree)  AS degree,
            totalSent,
            totalReceived,
            (totalSent + totalReceived) AS totalVolume,
            size(inTimestamps)           AS txCount
    `);

    return result.records.map((r) => ({
        id:            r.get('id'),
        outDegree:     r.get('outDegree').toNumber(),
        inDegree:      r.get('inDegree').toNumber(),
        degree:        r.get('degree').toNumber(),
        totalSent:     parseFloat(r.get('totalSent')),
        totalReceived: parseFloat(r.get('totalReceived')),
        totalVolume:   parseFloat(r.get('totalVolume')),
        txCount:       r.get('txCount').toNumber(),
    }));
}

/**
 * Fetch every TRANSACTION relationship for the graph edges.
 * Returns up to maxEdges (capped to keep the graph renderable).
 */
export async function fetchGraphEdges(session, maxEdges = 2000) {
    const result = await session.run(`
        MATCH (s:Account)-[t:TRANSACTION]->(r:Account)
        RETURN
            s.id           AS source,
            r.id           AS target,
            t.transaction_id AS txId,
            t.amount         AS amount,
            t.timestamp      AS timestamp
        LIMIT $maxEdges
    `, { maxEdges });

    return result.records.map((r) => ({
        source:    r.get('source'),
        target:    r.get('target'),
        txId:      r.get('txId'),
        amount:    parseFloat(r.get('amount')),
        timestamp: r.get('timestamp'),
    }));
}

/**
 * Detect hub accounts (high-degree nodes) using a pure Cypher heuristic.
 * A hub is any account whose degree >= mean + 1.5 * stddev of all degrees.
 */
export async function detectHubs(session) {
    const result = await session.run(`
        MATCH (n:Account)
        OPTIONAL MATCH (n)-[r:TRANSACTION]-()
        WITH n.id AS id, count(r) AS degree
        WITH
            collect({id: id, degree: degree}) AS nodes,
            avg(degree)                         AS meanDeg,
            stdev(degree)                       AS stdDeg
        UNWIND nodes AS node
        WHERE node.degree >= meanDeg + 1.5 * stdDeg
        RETURN node.id AS id, node.degree AS degree
        ORDER BY degree DESC
    `);

    return new Set(result.records.map((r) => r.get('id')));
}

/**
 * Detect bridge accounts — nodes that connect otherwise-separate components.
 * Approximated as: both inDegree > 0 AND outDegree > 0 AND
 * have neighbours in >1 "direction cluster".
 * (Full bridge/articulation-point detection requires GDS.)
 */
export async function detectBridges(session, suspiciousIds) {
    if (!suspiciousIds || suspiciousIds.size === 0) return new Set();

    const result = await session.run(`
        MATCH (n:Account)
        WHERE n.id IN $ids
        OPTIONAL MATCH (n)-[:TRANSACTION]->(out:Account)
        OPTIONAL MATCH (inn:Account)-[:TRANSACTION]->(n)
        WITH n.id AS id,
             count(DISTINCT out) AS outCnt,
             count(DISTINCT inn) AS inCnt
        WHERE outCnt > 0 AND inCnt > 0
        RETURN id
    `, { ids: [...suspiciousIds] });

    return new Set(result.records.map((r) => r.get('id')));
}
