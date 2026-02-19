# 💰 Financial Forensics Engine — Money Muling Detection

## Live Demo
[LIVE_URL_HERE]

## Problem Statement
Graph-based money muling detection engine for RIFT 2026 Hackathon — 
Graph Theory / Financial Crime Detection Track.

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | React 18 + Vite |
| Styling | Tailwind CSS |
| Graph Visualization | Cytoscape.js |
| CSV Parsing | PapaParse |
| Deployment | Vercel |

## System Architecture
```
CSV Upload → PapaParse → Graph Builder → [Cycle Detector + Smurfing Detector 
+ Shell Detector] → Suspicion Scorer → Ring ID Assigner → JSON Output 
+ Cytoscape Graph + Temporal Heatmap + Ring Overlap View + Risk Explanation Panel
```

## Algorithm Approach

### 1. Cycle Detection (Circular Fund Routing)
- Iterative DFS with depth limit (no recursion to avoid stack overflow)
- Detects cycles of length 3, 4, 5 only
- Canonical deduplication via lexicographic rotation
- Time Complexity: O(V × E × d), d=5
- Space Complexity: O(V + E)

### 2. Smurfing Detection (Fan-in / Fan-out)
- Two-pointer sliding window over timestamp-sorted transactions
- 72-hour window, threshold: ≥10 unique senders/receivers
- High-velocity bonus: >5 transactions in <6 hours
- Time Complexity: O(E log E) sort + O(E) window scan
- Space Complexity: O(E)

### 3. Shell Chain Detection
- BFS from shell nodes (txCount 2–3, pass-through only)
- Minimum 3-hop chains
- Time Complexity: O(V + E)
- Space Complexity: O(V)

## Suspicion Score Methodology
| Pattern | Score |
|---------|-------|
| cycle_length_3 | 40 |
| cycle_length_4 | 35 |
| cycle_length_5 | 30 |
| fan_in | 25 |
| fan_out | 25 |
| shell_chain | 20 |
| high_velocity | 15 |

Bonuses: multi-ring membership (+10), round amounts (+5), 24hr cluster (+8). Cap: 100.

## Innovation Features
1. **Temporal Heatmap** — day/hour grid showing when suspicious activity clusters
2. **Risk Explanation Panel** — plain English narrative explaining each flagged account
3. **72-hour sliding window** smurfing detection (two-pointer algorithm — key differentiator)
4. **Ring Overlap Visualization** — SVG diagram showing accounts spanning multiple rings

## False Positive Handling
- txCount > 200 AND counterparties > 80 → excluded (merchants)
- Payroll pattern (50+ receivers, consistent weekly amounts) → excluded
- txCount > 500 → excluded (system accounts)

## Installation & Setup
```bash
git clone [repo_url]
cd money-mule-detector
npm install
npm run dev
```

## Usage
1. Open the app, upload a CSV (columns: `transaction_id`, `sender_id`, `receiver_id`, `amount`, `timestamp`)
2. Analysis runs automatically (≤30 seconds for 10K transactions)
3. Explore **Graph View** — hover/click nodes for risk details
4. Check **Timeline Heatmap** to see when fraud clusters
5. Check **Ring Overlap** to find the most dangerous cross-ring accounts
6. Download JSON report with the Download button

## CSV Format
| Column | Type | Format |
|--------|------|--------|
| transaction_id | String | Unique ID |
| sender_id | String | Account ID |
| receiver_id | String | Account ID |
| amount | Float | Decimal number |
| timestamp | DateTime | `YYYY-MM-DD HH:MM:SS` |

## Known Limitations
- Cycles longer than 5 hops not detected (per spec)
- Graphs >2000 nodes switch to grid layout for performance
- Shell detection minimum 2 transactions per shell node
- Timestamps must be in `YYYY-MM-DD HH:MM:SS` format exactly

## Team Members
Jagadish S Naik
Ashwin Nethan
Prajna
Swara Hegde 
