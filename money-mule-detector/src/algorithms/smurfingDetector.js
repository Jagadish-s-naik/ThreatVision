/**
 * smurfingDetector.js
 * Detects smurfing patterns (fan-in / fan-out) using a 72-hour sliding window.
 * Innovation Feature 3: Two-pointer sliding window algorithm.
 *
 * FIX: Each hub emits exactly ONE ring — the one covering the maximum unique
 * member set within any valid 72-hour window. The old implementation emitted
 * a new ring on every right-pointer increment (producing N rings per hub).
 */
import { isLegitimateAccount } from './graphBuilder.js';

const WINDOW_72H = 72 * 60 * 60 * 1000; // 72 hours in ms
const WINDOW_6H = 6 * 60 * 60 * 1000; // 6 hours in ms
const MIN_UNIQUE = 10;                    // minimum unique senders/receivers to flag

/**
 * Detects smurfing (fan-in and fan-out) using 72-hour sliding window.
 * Each hub (receiver for fan-in, sender for fan-out) produces AT MOST ONE ring —
 * the window with the largest unique member count.
 *
 * @param {Array} transactions - Array of parsed transaction objects
 * @param {Object} nodeStats - Per-node stats
 * @returns {Array} Array of smurfing ring objects
 */
export function detectSmurfing(transactions, nodeStats) {
    // Sort all transactions by timestamp ascending
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

    const fanInRings = [];
    const fanOutRings = [];

    // ─── FAN-IN: many senders → one receiver ─────────────────────────────────
    const byReceiver = {};
    for (const tx of sorted) {
        const r = String(tx.receiver_id).trim();
        if (!byReceiver[r]) byReceiver[r] = [];
        byReceiver[r].push(tx);
    }

    for (const [receiver, txList] of Object.entries(byReceiver)) {
        if (isLegitimateAccount(receiver, nodeStats)) continue;

        // Two-pointer scan — track BEST window only (max unique senders)
        let left = 0;
        let bestUnique = new Set();
        let bestWindow = { left: 0, right: 0, duration: 0 };

        for (let right = 0; right < txList.length; right++) {
            // Shrink window if it exceeds 72 hours
            while (txList[right].timestamp - txList[left].timestamp > WINDOW_72H) {
                left++;
            }

            // Measure this window
            const windowSlice = txList.slice(left, right + 1);
            const uniqueSenders = new Set(windowSlice.map((t) => String(t.sender_id).trim()));

            // Keep only the window with the most unique senders
            if (uniqueSenders.size > bestUnique.size) {
                bestUnique = uniqueSenders;
                bestWindow = {
                    left,
                    right,
                    duration: txList[right].timestamp - txList[left].timestamp,
                };
            }
        }

        // Emit at most ONE ring per hub
        if (bestUnique.size >= MIN_UNIQUE) {
            const patterns = ['fan_in'];
            if (bestWindow.duration < WINDOW_6H && (bestWindow.right - bestWindow.left + 1) > 5) {
                patterns.push('high_velocity');
            }
            fanInRings.push({
                members: [receiver, ...bestUnique],
                pattern_type: 'smurfing',
                detected_patterns: patterns,
                subtype: 'fan_in',
                windowStartTime: txList[bestWindow.left].timestamp,
                windowEndTime: txList[bestWindow.right].timestamp,
            });
        }
    }

    // ─── FAN-OUT: one sender → many receivers ────────────────────────────────
    const bySender = {};
    for (const tx of sorted) {
        const s = String(tx.sender_id).trim();
        if (!bySender[s]) bySender[s] = [];
        bySender[s].push(tx);
    }

    for (const [sender, txList] of Object.entries(bySender)) {
        if (isLegitimateAccount(sender, nodeStats)) continue;

        let left = 0;
        let bestUnique = new Set();
        let bestWindow = { left: 0, right: 0, duration: 0 };

        for (let right = 0; right < txList.length; right++) {
            while (txList[right].timestamp - txList[left].timestamp > WINDOW_72H) {
                left++;
            }

            const windowSlice = txList.slice(left, right + 1);
            const uniqueReceivers = new Set(windowSlice.map((t) => String(t.receiver_id).trim()));

            if (uniqueReceivers.size > bestUnique.size) {
                bestUnique = uniqueReceivers;
                bestWindow = {
                    left,
                    right,
                    duration: txList[right].timestamp - txList[left].timestamp,
                };
            }
        }

        if (bestUnique.size >= MIN_UNIQUE) {
            const patterns = ['fan_out'];
            if (bestWindow.duration < WINDOW_6H && (bestWindow.right - bestWindow.left + 1) > 5) {
                patterns.push('high_velocity');
            }
            fanOutRings.push({
                members: [sender, ...bestUnique],
                pattern_type: 'smurfing',
                detected_patterns: patterns,
                subtype: 'fan_out',
                windowStartTime: txList[bestWindow.left].timestamp,
                windowEndTime: txList[bestWindow.right].timestamp,
            });
        }
    }

    // ─── Merge fan_in + fan_out rings sharing >50% members ───────────────────
    const merged = [];
    const usedFanOut = new Set();

    for (const fanIn of fanInRings) {
        const fanInSet = new Set(fanIn.members);
        let bestMatch = null;
        let bestOverlap = 0;

        for (let i = 0; i < fanOutRings.length; i++) {
            if (usedFanOut.has(i)) continue;
            const fanOut = fanOutRings[i];
            const fanOutSet = new Set(fanOut.members);

            let shared = 0;
            for (const m of fanInSet) {
                if (fanOutSet.has(m)) shared++;
            }

            const minSize = Math.min(fanInSet.size, fanOutSet.size);
            const overlapRatio = minSize > 0 ? shared / minSize : 0;

            if (overlapRatio > 0.5 && overlapRatio > bestOverlap) {
                bestOverlap = overlapRatio;
                bestMatch = { idx: i, ring: fanOut };
            }
        }

        if (bestMatch) {
            usedFanOut.add(bestMatch.idx);
            const combinedMembers = [...new Set([...fanIn.members, ...bestMatch.ring.members])];
            const combinedPatterns = [...new Set([...fanIn.detected_patterns, ...bestMatch.ring.detected_patterns])];
            merged.push({
                members: combinedMembers,
                pattern_type: 'smurfing',
                detected_patterns: combinedPatterns,
                subtype: 'both',
                windowStartTime: fanIn.windowStartTime < bestMatch.ring.windowStartTime
                    ? fanIn.windowStartTime
                    : bestMatch.ring.windowStartTime,
                windowEndTime: fanIn.windowEndTime > bestMatch.ring.windowEndTime
                    ? fanIn.windowEndTime
                    : bestMatch.ring.windowEndTime,
            });
        } else {
            merged.push(fanIn);
        }
    }

    // Add remaining unmatched fan-out rings
    for (let i = 0; i < fanOutRings.length; i++) {
        if (!usedFanOut.has(i)) merged.push(fanOutRings[i]);
    }

    return merged;
}
