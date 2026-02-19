import { isLegitimateAccount } from './graphBuilder.js';

export function detectSmurfing(transactions, nodeStats) {
    const rings = [];
    const WINDOW_MS = 72 * 60 * 60 * 1000;
    const HV_MS = 6 * 60 * 60 * 1000;

    // ── FAN-IN: group transactions by receiver ──
    const byReceiver = {};
    for (const tx of transactions) {
        if (!byReceiver[tx.receiver_id]) byReceiver[tx.receiver_id] = [];
        byReceiver[tx.receiver_id].push(tx);
    }

    for (const [receiverId, txList] of Object.entries(byReceiver)) {
        if (isLegitimateAccount(receiverId, nodeStats)) continue;

        txList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        // Track BEST window (most unique senders) across all positions
        let bestSenders = new Set();
        let bestStartMs = 0;
        let bestEndMs = 0;
        let left = 0;

        for (let right = 0; right < txList.length; right++) {
            const rightMs = new Date(txList[right].timestamp).getTime();

            // Shrink from left if outside 72h window
            while (new Date(txList[left].timestamp).getTime() < rightMs - WINDOW_MS) {
                left++;
            }

            // Count unique senders in current window
            const sendersNow = new Set(
                txList.slice(left, right + 1).map(t => t.sender_id)
            );

            // Update best if this window is larger
            if (sendersNow.size > bestSenders.size) {
                bestSenders = sendersNow;
                bestStartMs = new Date(txList[left].timestamp).getTime();
                bestEndMs = rightMs;
            }
            // ← NO rings.push() here. Loop just tracks the best window.
        }

        // ← ONE push AFTER the loop:
        if (bestSenders.size >= 10) {
            const patterns = ['fan_in'];
            if (bestEndMs - bestStartMs < HV_MS) {
                patterns.push('high_velocity');
            }
            rings.push({
                members: [receiverId, ...bestSenders],
                pattern_type: 'smurfing',
                detected_patterns: patterns,
                subtype: 'fan_in',
            });
        }
    }

    // ── FAN-OUT: group transactions by sender ──
    const bySender = {};
    for (const tx of transactions) {
        if (!bySender[tx.sender_id]) bySender[tx.sender_id] = [];
        bySender[tx.sender_id].push(tx);
    }

    for (const [senderId, txList] of Object.entries(bySender)) {
        if (isLegitimateAccount(senderId, nodeStats)) continue;

        txList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        let bestReceivers = new Set();
        let bestStartMs = 0;
        let bestEndMs = 0;
        let left = 0;

        for (let right = 0; right < txList.length; right++) {
            const rightMs = new Date(txList[right].timestamp).getTime();

            while (new Date(txList[left].timestamp).getTime() < rightMs - WINDOW_MS) {
                left++;
            }

            const receiversNow = new Set(
                txList.slice(left, right + 1).map(t => t.receiver_id)
            );

            if (receiversNow.size > bestReceivers.size) {
                bestReceivers = receiversNow;
                bestStartMs = new Date(txList[left].timestamp).getTime();
                bestEndMs = rightMs;
            }
        }

        if (bestReceivers.size >= 10) {
            const patterns = ['fan_out'];
            if (bestEndMs - bestStartMs < HV_MS) {
                patterns.push('high_velocity');
            }
            rings.push({
                members: [senderId, ...bestReceivers],
                pattern_type: 'smurfing',
                detected_patterns: patterns,
                subtype: 'fan_out',
            });
        }
    }

    // Add deduplication
    const seen = new Set();
    return rings.filter(r => {
        const k = [...r.members].sort().join('|');
        return seen.has(k) ? false : (seen.add(k), true);
    });
}
