# 🔍 ThreatVision — Money Mule Detection System

[![Live Demo](https://img.shields.io/badge/Live%20Demo-Vercel-black?logo=vercel)](https://threat-vision.vercel.app)
[![Backend](https://img.shields.io/badge/Backend-Railway-blueviolet?logo=railway)](https://railway.app)
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

> **ThreatVision** is a graph-based financial fraud detection system that ingests raw transaction CSVs, applies multi-pattern detection algorithms, and visualises the resulting fraud network as an interactive tree graph.

---

## 📸 Screenshot

![ThreatVision Dashboard](https://threat-vision.vercel.app)

---

## ✨ Features

| Feature | Description |
|---|---|
| 🕸 **Tree Graph View** | Single Cytoscape.js tree: Root → Fraud branch / Non-Fraud branch → account leaves |
| 🔥 **Temporal Heatmap** | Hour-of-day × day-of-week heat map of suspicious vs. clean transactions |
| 📋 **Fraud Rings Table** | Sortable table of detected fraud rings with member accounts and risk scores |
| 🔗 **Ring Overlap View** | Chord/overlap diagram showing accounts shared across multiple rings |
| 📄 **JSON Export** | One-click download of the full analysis result as structured JSON |
| ⚡ **Local Fallback** | If the backend is unavailable, the full detection pipeline runs in-browser |

---

## 🏗 Architecture

```
ThreatVision/
├── money-mule-detector/          # React + Vite frontend (deployed to Vercel)
│   ├── src/
│   │   ├── algorithms/           # Detection engine (runs client-side too)
│   │   │   ├── graphBuilder.js       — Builds adjacency lists + node stats
│   │   │   ├── cycleDetector.js      — Detects circular transaction rings (len 3-5)
│   │   │   ├── smurfingDetector.js   — Detects fan-in smurfing patterns
│   │   │   ├── shellDetector.js      — Detects shell/pass-through chains
│   │   │   ├── suspicionScorer.js    — Calculates per-account suspicion scores
│   │   │   └── localAnalyzer.js      — Orchestrates full pipeline in the browser
│   │   ├── api/
│   │   │   └── analyzeApi.js         — Sends CSV to backend; falls back to local
│   │   ├── components/
│   │   │   ├── GraphVisualization.jsx — Tree graph (Cytoscape.js)
│   │   │   ├── TemporalHeatmap.jsx    — Hour × day heatmap
│   │   │   ├── FraudRingTable.jsx     — Ring details table
│   │   │   ├── RingOverlapVisualization.jsx
│   │   │   ├── SummaryPanel.jsx
│   │   │   ├── CSVUploader.jsx
│   │   │   └── RiskExplanationPanel.jsx
│   │   ├── utils/
│   │   │   └── jsonExporter.js
│   │   └── App.jsx
│   ├── package.json
│   └── vite.config.js
│
└── server/                       # Express + Neo4j backend (deployed to Railway)
    ├── algorithms/               — Server-side versions of detection modules
    ├── index.js                  — REST API: POST /api/analyze
    ├── neo4jClient.js            — Neo4j AuraDB connection
    ├── .env.example
    └── package.json
```

---

## 🧠 Suspicion Score Methodology

Every account flagged by at least one detector is assigned a **Suspicion Score** from **0 to 100**.

### Step 1 — Pattern Weights (base score)

Each detected pattern adds a fixed number of points:

| Pattern | Points | Description |
|---|---|---|
| `cycle_length_3` | **+40** | Participates in a 3-node circular payment ring |
| `cycle_length_4` | **+35** | Participates in a 4-node circular payment ring |
| `cycle_length_5` | **+30** | Participates in a 5-node circular payment ring |
| `fan_in` | **+25** | Receives money from ≥5 unique senders within 72 hours (smurfing) |
| `fan_out` | **+25** | Sends money to ≥5 unique receivers within 72 hours |
| `shell_chain` | **+20** | Acts as a pass-through node (exactly 2-3 transactions, 1 in / 1 out) |
| `high_velocity` | **+15** | Unusually high transaction rate |

An account can accumulate points from **multiple patterns** (e.g., a cycle + shell account scores 40 + 20 = 60).

### Step 2 — Behavioural Bonus Points

After summing pattern weights, up to **+23 bonus points** are added for behavioural signals:

| Signal | Bonus | Condition |
|---|---|---|
| Multi-ring membership | **+10** | Account appears in 2 or more distinct fraud rings |
| Round-amount bias | **+5** | >50% of transaction amounts are multiples of ₹500 or ₹1000 |
| Time clustering | **+8** | All transactions are clustered within a 24-hour window |

### Step 3 — Cap & Format

The final score is **capped at 100** and rounded to 1 decimal place.

```
final_score = min(pattern_score + bonuses, 100.0)
```

### Score Banding

| Score Range | Risk Level | Graph Colour |
|---|---|---|
| 75 – 100 | 🔴 Critical | Red (`#EF4444`) |
| 50 – 74 | 🟠 High | Orange (`#F97316`) |
| 25 – 49 | 🟡 Medium | Yellow (`#EAB308`) |
| 0 – 24 | ⚪ Low / Clean | Grey (`#6B7280`) |

### Ring Risk Score

The risk score of a **fraud ring** is calculated as the **simple average** of the suspicion scores of all member accounts:

```
ring_risk_score = average(member_suspicion_scores)
```

---

## 🔍 Detection Algorithms

### 1. Cycle Detection (`cycleDetector.js`)
Finds circular transaction chains of length 3, 4, and 5 using iterative DFS on the directed transaction graph. Cycles formed exclusively by legitimate accounts (merchants, payroll systems) are excluded.

### 2. Smurfing Detection (`smurfingDetector.js`)
Identifies "fan-in" aggregation: a single receiver accepting funds from 5 or more unique senders within a 72-hour sliding window. This pattern is characteristic of money mule aggregators.

### 3. Shell Chain Detection (`shellDetector.js`)
Uses BFS to find pass-through nodes — accounts with exactly 2-3 total transactions (at least one inbound, one outbound) that are not identified as legitimate accounts. These indicate shell companies or mule intermediaries.

### 4. Graph Builder (`graphBuilder.js`)
Constructs directed adjacency lists and per-node statistics (transaction count, amounts, timestamps, counterparties). Implements `isLegitimateAccount()` heuristics to exclude merchants, payroll systems, and high-volume known-clean accounts from suspicion.

---

## ⚠️ Known Limitations

| # | Limitation | Impact |
|---|---|---|
| 1 | **No ML model** — Detection is fully rule-based. | May miss novel fraud patterns not matching the four pattern types. |
| 2 | **Cycle length capped at 5** — Chains longer than 5 hops are not detected. | Sophisticated rings using 6+ nodes evade detection. |
| 3 | **72-hour smurfing window is fixed** — Not configurable. | Slow smurfing spread over weeks is missed. |
| 4 | **Legitimate account heuristics may over-exclude** — Accounts matching merchant patterns but acting as mules are filtered out. | False negatives for legitimate-looking mule accounts. |
| 5 | **No temporal graph analysis** — All transactions are treated as a static graph snapshot. | Dormant-then-active mule accounts may be under-scored. |
| 6 | **Graph capped at 300 normal nodes** — The tree view limits non-fraud leaf nodes for browser performance. | Very large datasets (>10k accounts) may show partial non-fraud tree. |
| 7 | **CSV format assumed** — Expects columns: `transaction_id`, `sender_id`, `receiver_id`, `amount`, `timestamp`. | Non-standard column names will cause parsing failure. |
| 8 | **Neo4j backend optional** — If Railway is unavailable, local browser analysis runs without persisting results to a graph database. | Historical query / graph traversal features unavailable in local mode. |
| 9 | **No authentication** — The API endpoint is public. | Should not be used to process real PII/financial data in production without auth. |

---

## 🚀 Getting Started

### Prerequisites
- Node.js ≥ 18
- npm ≥ 9
- (Optional) Neo4j AuraDB account for backend persistence

### 1. Clone the repository

```bash
git clone https://github.com/Jagadish-s-naik/ThreatVision.git
cd ThreatVision
```

### 2. Frontend (React + Vite)

```bash
cd money-mule-detector
npm install
cp .env.example .env          # set VITE_BACKEND_URL if using the backend
npm run dev
```

Open [http://localhost:5173](http://localhost:5173)

### 3. Backend (Express + Neo4j) — Optional

```bash
cd server
npm install
cp .env.example .env          # fill in NEO4J_URI, NEO4J_USERNAME, NEO4J_PASSWORD
node index.js
```

The server runs on port `3001` by default.

### 4. Environment Variables

**Frontend** (`money-mule-detector/.env`):

```env
VITE_BACKEND_URL=https://your-railway-url.up.railway.app
```

> If omitted or the backend is unreachable, the app automatically falls back to local (in-browser) analysis.

**Backend** (`server/.env`):

```env
NEO4J_URI=neo4j+s://xxxxxxxx.databases.neo4j.io
NEO4J_USERNAME=neo4j
NEO4J_PASSWORD=your_password_here
PORT=3001
```

---

## 📄 CSV Input Format

The uploaded file must be a UTF-8 CSV with the following columns (order does not matter):

| Column | Type | Example |
|---|---|---|
| `transaction_id` | string | `TXN_001` |
| `sender_id` | string | `ACC_101` |
| `receiver_id` | string | `ACC_202` |
| `amount` | number | `5000` |
| `timestamp` | ISO 8601 / parseable date | `2024-01-15T10:30:00` |

---

## 🛠 Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 18, Vite, Tailwind CSS |
| Graph Viz | Cytoscape.js (`breadthfirst` tree layout) |
| Backend | Node.js, Express 4 |
| Graph DB | Neo4j AuraDB |
| Deployment | Vercel (frontend), Railway (backend) |

---

## 📁 .gitignore

Both `node_modules/` and `.env` files are excluded from the repository. See [`.gitignore`](.gitignore) and [`server/.gitignore`](server/.gitignore).

---

## 📜 License

This project is released under the [MIT License](LICENSE).

---

## 👨‍💻 Author

**Jagadish S Naik** — Built for Hackathon 2026 · [GitHub](https://github.com/Jagadish-s-naik)
