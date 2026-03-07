import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

function createDriver() {
    return neo4j.driver(
        process.env.NEO4J_URI || 'bolt://localhost:7687',
        neo4j.auth.basic(
            process.env.NEO4J_USER || 'neo4j',
            process.env.NEO4J_PASSWORD || 'password'
        ),
        {
            maxConnectionLifetime: 3 * 60 * 1000, // 3 min
            connectionAcquisitionTimeout: 30000,
        }
    );
}

let _driver = null;

export async function getSession() {
    if (!_driver) {
        _driver = createDriver();
    }
    try {
        const session = _driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
        // Quick verify the driver is alive
        return session;
    } catch (err) {
        // Driver is stale — recreate it
        await _driver.close().catch(() => {});
        _driver = createDriver();
        return _driver.session({ database: process.env.NEO4J_DATABASE || 'neo4j' });
    }
}

export async function clearGraph(session) {
    await session.run('MATCH (n) DETACH DELETE n');
}

export async function loadTransactions(session, rows) {
    // Use UNWIND for bulk insert — much faster than row-by-row
    await session.run(
        `UNWIND $rows AS row
     MERGE (s:Account {id: row.sender_id})
     MERGE (r:Account {id: row.receiver_id})
     CREATE (s)-[:TRANSACTION {
       transaction_id: row.transaction_id,
       amount: toFloat(row.amount),
       timestamp: row.timestamp
     }]->(r)`,
        { rows }
    );
}

export default { getSession, createDriver };
