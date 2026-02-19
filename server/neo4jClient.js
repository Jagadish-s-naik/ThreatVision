import neo4j from 'neo4j-driver';
import dotenv from 'dotenv';
dotenv.config();

const driver = neo4j.driver(
    process.env.NEO4J_URI || 'bolt://localhost:7687',
    neo4j.auth.basic(
        process.env.NEO4J_USER || 'neo4j',
        process.env.NEO4J_PASSWORD || 'password'
    )
);

export async function getSession() {
    return driver.session();
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

export default driver;
