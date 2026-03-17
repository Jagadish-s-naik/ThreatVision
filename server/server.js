import express from 'express';
import helmet from 'helmet';
import multer from 'multer';
import cors from 'cors';
import { parse } from 'csv-parse/sync';
import dotenv from 'dotenv';
import { getSession, clearGraph, loadTransactions } from './neo4jClient.js';
import { detectCycles } from './algorithms/cycleDetector.js';
import { detectSmurfing } from './algorithms/smurfingDetector.js';
import { detectShells } from './algorithms/shellDetector.js';
import { buildResult } from './algorithms/resultBuilder.js';
import { computeNodeAnalytics, fetchGraphEdges, detectHubs, detectBridges } from './algorithms/graphAnalytics.js';
import rateLimit from 'express-rate-limit';

dotenv.config();

const app = express();
app.use(helmet()); // Basic security headers
const upload = multer({ storage: multer.memoryStorage() });

// Rate Limiting: 100 requests per 15 minutes
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 100,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests from this IP, please try again later.' }
});

app.use(limiter);

// Secure CORS: Restrict to allowed origins
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:3000', 'http://localhost:5173'];

app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    methods: ['GET', 'POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type'],
    optionsSuccessStatus: 204,
}));

app.use(express.json({ limit: '2mb' }));
app.use(express.urlencoded({ extended: true, limit: '2mb' }));


// ─── Railway healthcheck (must always return 200) ──────────
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', service: 'ThreatVision backend' });
});

// ─── Neo4j connectivity check ────────────────────────────────
app.get('/api/status', async (req, res) => {
    try {
        const session = await getSession();
        await session.run('RETURN 1');
        await session.close();
        res.json({ status: 'ok', neo4j: 'connected' });
    } catch (e) {
        res.status(500).json({ status: 'error', neo4j: e.message });
    }
});

// ─── Main analysis endpoint ──────────────────────────────────
app.post('/api/analyze', upload.single('file'), async (req, res) => {
    const startTimeMs = Date.now(); // MUST be first line

    if (!req.file) {
        return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    let session;
    try {
        // Parse CSV
        const rows = parse(req.file.buffer.toString(), {
            columns: true,
            skip_empty_lines: true,
            trim: true,
        });

        if (!rows.length) {
            return res.status(400).json({ error: 'CSV file is empty' });
        }

        // Validate required columns
        const required = ['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'];
        const cols = Object.keys(rows[0]);
        const missing = required.filter((c) => !cols.includes(c));
        if (missing.length) {
            return res.status(400).json({
                error: `Missing required columns: ${missing.join(', ')}`,
            });
        }

        // ─── Sanitization & Validation ─────────────────────────
        const sanitizedRows = rows.map(row => ({
            transaction_id: String(row.transaction_id || '').replace(/[^\w-]/g, ''),
            sender_id: String(row.sender_id || '').replace(/[^\w-]/g, ''),
            receiver_id: String(row.receiver_id || '').replace(/[^\w-]/g, ''),
            amount: parseFloat(row.amount) || 0,
            timestamp: new Date(row.timestamp).toISOString()
        }));

        // Load into Neo4j (using sanitized rows)
        session = await getSession();
        await clearGraph(session);
        await loadTransactions(session, sanitizedRows);

        // Count total unique account nodes
        const nodeCountResult = await session.run(
            'MATCH (n:Account) RETURN count(n) AS total'
        );
        const totalNodes = nodeCountResult.records[0].get('total').toNumber();

        // Run all three detectors
        const cycleRings = await detectCycles(session);
        const smurfingRings = await detectSmurfing(session);
        const shellRings = await detectShells(session);

        await session.close();
        session = null;

        // Build final result matching problem statement JSON spec
        const result = buildResult(cycleRings, smurfingRings, shellRings, totalNodes, startTimeMs);

        // Also return rows for client-side graph rendering
        result._transactions = rows;

        res.json(result);
    } catch (error) {
        if (session) await session.close().catch(() => { });
        console.error('Analysis error:', error);
        
        // Security: Mask internal error details in production
        const status = error.message.includes('Missing required') ? 400 : 500;
        const message = process.env.NODE_ENV === 'production' && status === 500
            ? 'An internal server error occurred during analysis.'
            : error.message;
            
        res.status(status).json({ error: message });
    }
});

// ─── Neo4j Graph Analytics endpoint ──────────────────────────
// Returns node analytics + edges computed entirely in Neo4j Cypher.
// Frontend uses this to power the Graph View with real graph data.
app.get('/api/graph', async (req, res) => {
    let session;
    try {
        session = await getSession();

        // 1. Compute per-node degree centrality and volume analytics
        const nodes = await computeNodeAnalytics(session);

        if (nodes.length === 0) {
            // No data loaded yet
            return res.json({ nodes: [], edges: [], hubs: [], bridges: [] });
        }

        // 2. Fetch transaction edges (capped at 2000 to keep graph renderable)
        const edges = await fetchGraphEdges(session, 2000);

        // 3. Detect hub accounts (high-degree nodes)
        const hubSet = await detectHubs(session);

        // 4. Tag each node with hub flag and compute a composite centrality score
        //    score = normalized degree * 0.5 + normalized volume * 0.5 (0–100)
        const maxDegree = Math.max(...nodes.map((n) => n.degree), 1);
        const maxVolume = Math.max(...nodes.map((n) => n.totalVolume), 1);

        const enrichedNodes = nodes.map((n) => ({
            ...n,
            isHub: hubSet.has(n.id),
            centralityScore: parseFloat(
                (((n.degree / maxDegree) * 0.5 + (n.totalVolume / maxVolume) * 0.5) * 100).toFixed(1)
            ),
        }));

        await session.close();
        session = null;

        res.json({
            nodes: enrichedNodes,
            edges,
            hubs: [...hubSet],
            analytics: {
                totalNodes: nodes.length,
                totalEdges: edges.length,
                hubCount: hubSet.size,
                maxDegree,
                maxVolume,
            },
        });
    } catch (error) {
        if (session) await session.close().catch(() => { });
        console.error('[/api/graph] Error:', error.message);
        res.status(500).json({ error: error.message });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log(`ThreatVision backend running on port ${PORT}`);
});

