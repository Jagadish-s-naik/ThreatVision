/**
 * smurfingDetector.js
 * Detects smurfing patterns (fan-in / fan-out) using a 72-hour sliding window.
 * Innovation Feature 3: Two-pointer sliding window algorithm.
 */
import { isLegitimateAccount } from './graphBuilder.js';

const WINDOW_72H = 72 * 60 * 60 * 1000; // 72 hours in ms
const WINDOW_6H = 6 * 60 * 60 * 1000;   // 6 hours in ms
const MIN_UNIQUE = 10;                    // minimum unique senders/receivers to flag

/**
 * Detects smurfing (fan-in and fan-out) using 72-hour sliding window.
 * @param {Array} transactions - Array of parsed transaction objects
 * @param {Object} nodeStats - Per-node stats
 * @returns {Array} Array of smurfing ring objects
 */
export function detectSmurfing(transactions, nodeStats) {
    // STEP 1: Sort all transactions by timestamp ascending
    const sorted = [...transactions].sort((a, b) => a.timestamp - b.timestamp);

    const fanInRings = [];
    const fanOutRings = [];

    // STEP 2: FAN-IN detection — many senders → one receiver
    const byReceiver = {};
    for (const tx of sorted) {
        const r = String(tx.receiver_id).trim();
        if (!byReceiver[r]) byReceiver[r] = [];
        byReceiver[r].push(tx);
    }

    for (const [receiver, txList] of Object.entries(byReceiver)) {
        if (isLegitimateAccount(receiver, nodeStats)) continue;
        // txList already sorted (inherited from global sort)
        let left = 0;
        let right = 0;

        while (right < txList.length) {
            const windowDuration = txList[right].timestamp - txList[left].timestamp;

            if (windowDuration > WINDOW_72H) {
                left++;
            } else {
                const windowSlice = txList.slice(left, right + 1);
                const uniqueSenders = new Set(windowSlice.map((t) => String(t.sender_id).trim()));

                if (uniqueSenders.size >= MIN_UNIQUE) {
                    const patterns = ['fan_in'];
                    const txCount = windowSlice.length;
                    if (windowDuration < WINDOW_6H && txCount > 5) {
                        patterns.push('high_velocity');
                    }

                    const members = [receiver, ...uniqueSenders];
                    fanInRings.push({
                        members,
                        pattern_type: 'smurfing',
                        detected_patterns: patterns,
                        subtype: 'fan_in',
                        windowStartTime: txList[left].timestamp,
                        windowEndTime: txList[right].timestamp,
                    });
                }
                right++;
            }
        }
    }

    // STEP 3: FAN-OUT detection — one sender → many receivers
    const bySender = {};
    for (const tx of sorted) {
        const s = String(tx.sender_id).trim();
        if (!bySender[s]) bySender[s] = [];
        bySender[s].push(tx);
    }

    for (const [sender, txList] of Object.entries(bySender)) {
        if (isLegitimateAccount(sender, nodeStats)) continue;
        let left = 0;
        let right = 0;

        while (right < txList.length) {
            const windowDuration = txList[right].timestamp - txList[left].timestamp;

            if (windowDuration > WINDOW_72H) {
                left++;
            } else {
                const windowSlice = txList.slice(left, right + 1);
                const uniqueReceivers = new Set(windowSlice.map((t) => String(t.receiver_id).trim()));

                if (uniqueReceivers.size >= MIN_UNIQUE) {
                    const patterns = ['fan_out'];
                    const txCount = windowSlice.length;
                    if (windowDuration < WINDOW_6H && txCount > 5) {
                        patterns.push('high_velocity');
                    }

                    const members = [sender, ...uniqueReceivers];
                    fanOutRings.push({
                        members,
                        pattern_type: 'smurfing',
                        detected_patterns: patterns,
                        subtype: 'fan_out',
                        windowStartTime: txList[left].timestamp,
                        windowEndTime: txList[right].timestamp,
                    });
                }
                right++;
            }
        }
    }

    // STEP 4: Deduplication — merge fan_in + fan_out rings sharing >50% members
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

            // Count shared members
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
            const combinedMembers = [
                ...new Set([...fanIn.members, ...bestMatch.ring.members]),
            ];
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

    // Add remaining fan-out rings
    for (let i = 0; i < fanOutRings.length; i++) {
        if (!usedFanOut.has(i)) {
            merged.push(fanOutRings[i]);
        }
    }

    return merged;
}
