/**
 * smurfingDetector.js
 * Detects fan-in and fan-out smurfing patterns using Neo4j + JS sliding window.
 */

const WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours
const MIN_COUNTERPARTS = 10;

// Query Neo4j stats for isLegitimateAccount check
async function getAccountStats(session) {
    const result = await session.run(`
    MATCH (hub:Account)
    OPTIONAL MATCH (s:Account)-[:TRANSACTION]->(hub)
    OPTIONAL MATCH (hub)-[:TRANSACTION]->(r:Account)
    WITH hub,
         count(DISTINCT s) AS uniqueSenders,
         count(DISTINCT r) AS uniqueReceivers
    RETURN hub.id AS id,
           uniqueSenders,
           uniqueReceivers,
           uniqueSenders + uniqueReceivers AS totalUnique
  `);

    const stats = {};
    for (const rec of result.records) {
        stats[rec.get('id')] = {
            uniqueSenders: rec.get('uniqueSenders').toNumber(),
            uniqueReceivers: rec.get('uniqueReceivers').toNumber(),
            totalUnique: rec.get('totalUnique').toNumber(),
        };
    }
    return stats;
}

function isLegitimateAccount(stat) {
    if (!stat) return false;
    if (stat.uniqueSenders >= 30) return true;
    if (stat.uniqueReceivers >= 50) return true;
    if (stat.totalUnique >= 50) return true;
    return false;
}

function applyBestWindow(txList, hubId, subtype, rings) {
    if (txList.length === 0) return;

    // Sort by timestamp
    txList.sort((a, b) => new Date(a.ts).getTime() - new Date(b.ts).getTime());

    let bestCounterparts = new Set();
    let bestStartMs = 0;
    let bestEndMs = 0;
    let left = 0;

    for (let right = 0; right < txList.length; right++) {
        const rMs = new Date(txList[right].ts).getTime();
        while (new Date(txList[left].ts).getTime() < rMs - WINDOW_MS) left++;

        const counterparts = new Set(
            txList.slice(left, right + 1).map((t) => t.counterpartId)
        );

        if (counterparts.size > bestCounterparts.size) {
            bestCounterparts = counterparts;
            bestStartMs = new Date(txList[left].ts).getTime();
            bestEndMs = rMs;
        }
        // NO push inside loop — track only
    }

    // ONE push AFTER the loop
    if (bestCounterparts.size >= MIN_COUNTERPARTS) {
        const patterns = [subtype];
        if (bestEndMs - bestStartMs < 6 * 60 * 60 * 1000) {
            patterns.push('high_velocity');
        }
        rings.push({
            hub: hubId,
            members: [hubId, ...bestCounterparts],
            patterns,
            pattern: 'smurfing',
        });
    }
}

export async function detectSmurfing(session) {
    const rings = [];
    const seen = new Set();

    const stats = await getAccountStats(session);

    // ─── Fan-In ───
    const fanInResult = await session.run(`
    MATCH (sender:Account)-[tx:TRANSACTION]->(hub:Account)
    RETURN hub.id AS hubId,
           sender.id AS counterpartId,
           tx.timestamp AS ts
    ORDER BY hub.id, tx.timestamp
  `);

    const fanInMap = new Map();
    for (const rec of fanInResult.records) {
        const hubId = rec.get('hubId');
        if (!fanInMap.has(hubId)) fanInMap.set(hubId, []);
        fanInMap.get(hubId).push({
            counterpartId: rec.get('counterpartId'),
            ts: rec.get('ts'),
        });
    }

    for (const [hubId, txList] of fanInMap) {
        if (isLegitimateAccount(stats[hubId])) continue;
        applyBestWindow(txList, hubId, 'fan_in', rings);
    }

    // ─── Fan-Out ───
    const fanOutResult = await session.run(`
    MATCH (hub:Account)-[tx:TRANSACTION]->(receiver:Account)
    RETURN hub.id AS hubId,
           receiver.id AS counterpartId,
           tx.timestamp AS ts
    ORDER BY hub.id, tx.timestamp
  `);

    const fanOutMap = new Map();
    for (const rec of fanOutResult.records) {
        const hubId = rec.get('hubId');
        if (!fanOutMap.has(hubId)) fanOutMap.set(hubId, []);
        fanOutMap.get(hubId).push({
            counterpartId: rec.get('counterpartId'),
            ts: rec.get('ts'),
        });
    }

    for (const [hubId, txList] of fanOutMap) {
        if (isLegitimateAccount(stats[hubId])) continue;
        // Avoid emitting if fan-in already covered this hub
        const existing = rings.find((r) => r.hub === hubId);
        if (existing) {
            if (!existing.patterns.includes('fan_out')) existing.patterns.push('fan_out');
            continue;
        }
        applyBestWindow(txList, hubId, 'fan_out', rings);
    }

    // Deduplicate by sorted member key
    const deduped = [];
    for (const ring of rings) {
        const key = [...ring.members].sort().join('|');
        if (!seen.has(key)) {
            seen.add(key);
            deduped.push(ring);
        }
    }

    return deduped;
}
