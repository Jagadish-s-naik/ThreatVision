/**
 * smurfingDetector.js
 * Detects smurfing patterns (fan-in / fan-out) using a 72-hour sliding window.
 * Innovation Feature 3: Two-pointer sliding window algorithm.
 *
 * KEY FIX: Each hub produces EXACTLY ONE ring — the maximum-window ring.
 * Old code emitted a ring on every right-pointer step, producing N rings per hub.
 */
import { isLegitimateAccount } from './graphBuilder.js';

const WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours
const HIGH_VEL_MS = 6 * 60 * 60 * 1000; // 6 hours
const MIN_UNIQUE = 10;                    // minimum unique counterparties to flag

export function detectSmurfing(transactions, nodeStats) {
    const fanInRings = [];
    const fanOutRings = [];

    // ── FAN-IN: many senders → one receiver ──────────────────────────────────
    const byReceiver = {};
    for (const tx of transactions) {
        const r = String(tx.receiver_id).trim();
        if (!byReceiver[r]) byReceiver[r] = [];
        byReceiver[r].push(tx);
    }

    for (const [receiverId, txList] of Object.entries(byReceiver)) {
        if (isLegitimateAccount(receiverId, nodeStats)) continue;

        // Sort ascending by timestamp
        txList.sort((a, b) => a.timestamp - b.timestamp);

        let left = 0;
        let bestUniqueSenders = new Set();
        let bestWindowStart = null;
        let bestWindowEnd = null;

        for (let right = 0; right < txList.length; right++) {
            const rightTime = txList[right].timestamp;

            // Shrink left while window exceeds 72 h
            while (left < right && rightTime - txList[left].timestamp > WINDOW_MS) {
                left++;
            }

            // Count unique senders in current window [left..right]
            const sendersInWindow = new Set(
                txList.slice(left, right + 1).map((t) => String(t.sender_id).trim())
            );

            // Keep only the BEST (largest) window
            if (sendersInWindow.size > bestUniqueSenders.size) {
                bestUniqueSenders = sendersInWindow;
                bestWindowStart = txList[left].timestamp;
                bestWindowEnd = rightTime;
            }
        }

        // Emit EXACTLY ONE ring per hub if threshold met
        if (bestUniqueSenders.size >= MIN_UNIQUE) {
            const patterns = ['fan_in'];
            const duration = bestWindowEnd - bestWindowStart;
            if (duration < HIGH_VEL_MS && bestUniqueSenders.size > 5) {
                patterns.push('high_velocity');
            }
            fanInRings.push({
                members: [receiverId, ...bestUniqueSenders],
                pattern_type: 'smurfing',
                detected_patterns: patterns,
                subtype: 'fan_in',
                windowStartTime: bestWindowStart,
                windowEndTime: bestWindowEnd,
            });
        }
    }

    // ── FAN-OUT: one sender → many receivers ──────────────────────────────────
    const bySender = {};
    for (const tx of transactions) {
        const s = String(tx.sender_id).trim();
        if (!bySender[s]) bySender[s] = [];
        bySender[s].push(tx);
    }

    for (const [senderId, txList] of Object.entries(bySender)) {
        if (isLegitimateAccount(senderId, nodeStats)) continue;

        txList.sort((a, b) => a.timestamp - b.timestamp);

        let left = 0;
        let bestUniqueReceivers = new Set();
        let bestWindowStart = null;
        let bestWindowEnd = null;

        for (let right = 0; right < txList.length; right++) {
            const rightTime = txList[right].timestamp;

            while (left < right && rightTime - txList[left].timestamp > WINDOW_MS) {
                left++;
            }

            const receiversInWindow = new Set(
                txList.slice(left, right + 1).map((t) => String(t.receiver_id).trim())
            );

            if (receiversInWindow.size > bestUniqueReceivers.size) {
                bestUniqueReceivers = receiversInWindow;
                bestWindowStart = txList[left].timestamp;
                bestWindowEnd = rightTime;
            }
        }

        if (bestUniqueReceivers.size >= MIN_UNIQUE) {
            const patterns = ['fan_out'];
            const duration = bestWindowEnd - bestWindowStart;
            if (duration < HIGH_VEL_MS && bestUniqueReceivers.size > 5) {
                patterns.push('high_velocity');
            }
            fanOutRings.push({
                members: [senderId, ...bestUniqueReceivers],
                pattern_type: 'smurfing',
                detected_patterns: patterns,
                subtype: 'fan_out',
                windowStartTime: bestWindowStart,
                windowEndTime: bestWindowEnd,
            });
        }
    }

    // ── Merge fan_in + fan_out rings sharing >50% members ────────────────────
    const merged = [];
    const usedFanOut = new Set();

    for (const fanIn of fanInRings) {
        const fanInSet = new Set(fanIn.members);
        let bestMatch = null;
        let bestOverlap = 0;

        for (let i = 0; i < fanOutRings.length; i++) {
            if (usedFanOut.has(i)) continue;
            const fanOutSet = new Set(fanOutRings[i].members);
            let shared = 0;
            for (const m of fanInSet) if (fanOutSet.has(m)) shared++;
            const ratio = Math.min(fanInSet.size, fanOutSet.size) > 0
                ? shared / Math.min(fanInSet.size, fanOutSet.size) : 0;
            if (ratio > 0.5 && ratio > bestOverlap) {
                bestOverlap = ratio;
                bestMatch = { idx: i, ring: fanOutRings[i] };
            }
        }

        if (bestMatch) {
            usedFanOut.add(bestMatch.idx);
            merged.push({
                members: [...new Set([...fanIn.members, ...bestMatch.ring.members])],
                pattern_type: 'smurfing',
                detected_patterns: [...new Set([...fanIn.detected_patterns, ...bestMatch.ring.detected_patterns])],
                subtype: 'both',
                windowStartTime: Math.min(fanIn.windowStartTime, bestMatch.ring.windowStartTime),
                windowEndTime: Math.max(fanIn.windowEndTime, bestMatch.ring.windowEndTime),
            });
        } else {
            merged.push(fanIn);
        }
    }
    for (let i = 0; i < fanOutRings.length; i++) {
        if (!usedFanOut.has(i)) merged.push(fanOutRings[i]);
    }

    // ── Final canonical dedup ─────────────────────────────────────────────────
    const seenKeys = new Set();
    const deduped = [];
    for (const ring of merged) {
        const key = [...ring.members].sort().join('|');
        if (!seenKeys.has(key)) {
            seenKeys.add(key);
            deduped.push(ring);
        }
    }

    return deduped;
}
