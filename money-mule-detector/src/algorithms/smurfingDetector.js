import { isLegitimateAccount } from './graphBuilder.js';

export function detectSmurfing(transactions, nodeStats) {
    const WINDOW_MS = 72 * 60 * 60 * 1000;  // 72 hours in ms
    const HV_MS = 6 * 60 * 60 * 1000;  // 6 hours in ms
    const THRESHOLD = 10; // minimum unique counterparts

    const rings = [];
    const seenKeys = new Set();

    // ── Helper: find best 72-hour window for a list of {timeMs, id} ──
    function bestWindow(entries) {
        if (entries.length === 0) return { ids: new Set(), startMs: 0, endMs: 0 };
        entries.sort((a, b) => a.timeMs - b.timeMs);

        let best = { ids: new Set(), startMs: 0, endMs: 0 };
        let left = 0;

        for (let right = 0; right < entries.length; right++) {
            // shrink window from left if outside 72h
            while (entries[right].timeMs - entries[left].timeMs > WINDOW_MS) {
                left++;
            }
            // unique IDs in window [left..right]
            const ids = new Set(entries.slice(left, right + 1).map(e => e.id));
            if (ids.size > best.ids.size) {
                best = {
                    ids,
                    startMs: entries[left].timeMs,
                    endMs: entries[right].timeMs,
                };
            }
        }
        return best;
    }

    // ── FAN-IN: many senders → one receiver ──
    const byReceiver = {};
    for (const tx of transactions) {
        if (!byReceiver[tx.receiver_id]) byReceiver[tx.receiver_id] = [];
        byReceiver[tx.receiver_id].push({
            timeMs: new Date(tx.timestamp).getTime(),
            id: tx.sender_id,
        });
    }

    for (const [receiverId, entries] of Object.entries(byReceiver)) {
        if (isLegitimateAccount(receiverId, nodeStats)) continue;

        const { ids: bestSenders, startMs, endMs } = bestWindow(entries);
        if (bestSenders.size < THRESHOLD) continue;

        // Filter out legitimate senders
        const fraudSenders = [...bestSenders].filter(
            s => !isLegitimateAccount(s, nodeStats)
        );
        if (fraudSenders.length < THRESHOLD && bestSenders.size < THRESHOLD) continue;

        const members = [receiverId, ...bestSenders];
        const key = [...members].sort().join('|');
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const patterns = ['fan_in'];
        if (endMs - startMs < HV_MS) patterns.push('high_velocity');

        rings.push({
            members,
            pattern_type: 'smurfing',
            detected_patterns: patterns,
            subtype: 'fan_in',
            windowStartMs: startMs,
            windowEndMs: endMs,
        });
    }

    // ── FAN-OUT: one sender → many receivers ──
    const bySender = {};
    for (const tx of transactions) {
        if (!bySender[tx.sender_id]) bySender[tx.sender_id] = [];
        bySender[tx.sender_id].push({
            timeMs: new Date(tx.timestamp).getTime(),
            id: tx.receiver_id,
        });
    }

    for (const [senderId, entries] of Object.entries(bySender)) {
        if (isLegitimateAccount(senderId, nodeStats)) continue;

        const { ids: bestReceivers, startMs, endMs } = bestWindow(entries);
        if (bestReceivers.size < THRESHOLD) continue;

        const members = [senderId, ...bestReceivers];
        const key = [...members].sort().join('|');
        if (seenKeys.has(key)) continue;
        seenKeys.add(key);

        const patterns = ['fan_out'];
        if (endMs - startMs < HV_MS) patterns.push('high_velocity');

        rings.push({
            members,
            pattern_type: 'smurfing',
            detected_patterns: patterns,
            subtype: 'fan_out',
            windowStartMs: startMs,
            windowEndMs: endMs,
        });
    }

    return rings;
}
