/**
 * smurfingDetector.js
 * Detects smurfing (fan-in / fan-out) patterns with exemption checks for:
 *   - Payroll accounts (Problem 1)
 *   - Marketplace / merchant accounts (Problem 2)
 *   - Passthrough / escrow agents (Problem 3)
 */
import { isLegitimateAccount } from './graphBuilder.js';

// ─── EXEMPTION 1: Payroll ───────────────────────────────────────────────────
/**
 * Returns true if the account looks like a legitimate payroll sender:
 *  - Sends uniform-ish amounts (variance < 50%)
 *  - All payments within a single 24-hour window
 *  - Receivers do NOT re-route money back into the same group
 */
export function isPayrollPattern(account, transactions) {
    const outgoing = transactions.filter(t => t.sender_id === account);
    if (outgoing.length < 3) return false;

    const amounts = outgoing.map(t => parseFloat(t.amount) || 0);
    const avgAmount = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    if (avgAmount === 0) return false;

    // Check 1: amounts are uniform (payroll salaries are similar)
    const maxVar = Math.max(...amounts) - Math.min(...amounts);
    const variancePct = maxVar / avgAmount;
    if (variancePct > 0.5) return false;

    // Check 2: all transactions happen within same 24-hour window
    const timestamps = outgoing.map(t => new Date(t.timestamp).getTime());
    const timeSpread = Math.max(...timestamps) - Math.min(...timestamps);
    if (timeSpread > 24 * 60 * 60 * 1000) return false;

    // Check 3: receivers do NOT re-route funds back into the network
    const receivers = new Set(outgoing.map(t => t.receiver_id));
    for (const receiver of receivers) {
        const rerouteTo = transactions.filter(
            t => t.sender_id === receiver && receivers.has(t.receiver_id)
        );
        if (rerouteTo.length > 0) return false;
    }

    return true;
}

// ─── EXEMPTION 2: Merchant / Marketplace ────────────────────────────────────
/**
 * Returns true if the account looks like a legitimate merchant/marketplace:
 *  - Receives from many (≥5) unique small senders
 *  - Average incoming amount is small (retail)
 *  - Total outgoing ≤ total incoming × 1.1
 *  - Average outgoing is LARGER than average incoming (aggregation before payout)
 */
export function isMerchantDisbursement(account, transactions) {
    const outgoing = transactions.filter(t => t.sender_id === account);
    const incoming = transactions.filter(t => t.receiver_id === account);
    if (incoming.length === 0 || outgoing.length === 0) return false;

    // Check 1: receives from many distinct senders
    const uniqueIncomingSenders = new Set(incoming.map(t => t.sender_id)).size;
    if (uniqueIncomingSenders < 5) return false;

    // Check 2: incoming amounts are small (retail)
    const incomingAmounts = incoming.map(t => parseFloat(t.amount) || 0);
    const avgIncoming = incomingAmounts.reduce((a, b) => a + b, 0) / incomingAmounts.length;
    if (avgIncoming > 5000) return false;

    // Check 3: not creating money (outgoing ≤ incoming × 1.1)
    const totalIn  = incoming.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const totalOut = outgoing.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    if (totalOut > totalIn * 1.1) return false;

    // Check 4: aggregation pattern (avg outgoing > avg incoming)
    const avgOutgoing = outgoing.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0) / outgoing.length;
    if (avgOutgoing < avgIncoming) return false;

    return true;
}

// ─── EXEMPTION 3: Passthrough Agent (Rent / Escrow) ─────────────────────────
/**
 * Returns true if the account is a balanced passthrough agent:
 *  - Total in ≈ total out (within 5%)
 *  - Zero overlap between incoming sender set and outgoing receiver set
 */
export function isPassthroughAgent(account, transactions) {
    const outgoing = transactions.filter(t => t.sender_id === account);
    const incoming = transactions.filter(t => t.receiver_id === account);
    if (incoming.length === 0 || outgoing.length === 0) return false;

    const totalIn  = incoming.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    const totalOut = outgoing.reduce((a, t) => a + (parseFloat(t.amount) || 0), 0);
    if (totalIn === 0) return false;

    const balanceRatio = Math.abs(totalIn - totalOut) / totalIn;
    if (balanceRatio >= 0.05) return false;

    const senderSet   = new Set(incoming.map(t => t.sender_id));
    const receiverSet = new Set(outgoing.map(t => t.receiver_id));
    const overlap     = [...senderSet].filter(x => receiverSet.has(x)).length;

    return overlap === 0;
}

// ─── SMURFING DETECTOR ───────────────────────────────────────────────────────
export function detectSmurfing(transactions, nodeStats) {
    const rings = [];
    const WINDOW_MS = 72 * 60 * 60 * 1000;
    const HV_MS     =  6 * 60 * 60 * 1000;

    // ── FAN-IN: group transactions by receiver ──
    const byReceiver = {};
    for (const tx of transactions) {
        if (!byReceiver[tx.receiver_id]) byReceiver[tx.receiver_id] = [];
        byReceiver[tx.receiver_id].push(tx);
    }

    for (const [receiverId, txList] of Object.entries(byReceiver)) {
        if (isLegitimateAccount(receiverId, nodeStats)) continue;

        // Exemption checks — skip flagging if any pass
        if (isPayrollPattern(receiverId, transactions))        continue;
        if (isMerchantDisbursement(receiverId, transactions))  continue;
        if (isPassthroughAgent(receiverId, transactions))      continue;

        txList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        let bestSenders  = new Set();
        let bestStartMs  = 0;
        let bestEndMs    = 0;
        let left         = 0;

        for (let right = 0; right < txList.length; right++) {
            const rightMs = new Date(txList[right].timestamp).getTime();
            while (new Date(txList[left].timestamp).getTime() < rightMs - WINDOW_MS) left++;
            const sendersNow = new Set(txList.slice(left, right + 1).map(t => t.sender_id));
            if (sendersNow.size > bestSenders.size) {
                bestSenders = sendersNow;
                bestStartMs = new Date(txList[left].timestamp).getTime();
                bestEndMs   = rightMs;
            }
        }

        if (bestSenders.size >= 10) {
            const patterns = ['fan_in'];
            if (bestEndMs - bestStartMs < HV_MS) patterns.push('high_velocity');
            if (bestEndMs - bestStartMs <= WINDOW_MS) patterns.push('temporal_72hr_window');
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

        // Exemption checks — skip flagging if any pass
        if (isPayrollPattern(senderId, transactions))        continue;
        if (isMerchantDisbursement(senderId, transactions))  continue;
        if (isPassthroughAgent(senderId, transactions))      continue;

        txList.sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));

        let bestReceivers = new Set();
        let bestStartMs   = 0;
        let bestEndMs     = 0;
        let left          = 0;

        for (let right = 0; right < txList.length; right++) {
            const rightMs = new Date(txList[right].timestamp).getTime();
            while (new Date(txList[left].timestamp).getTime() < rightMs - WINDOW_MS) left++;
            const receiversNow = new Set(txList.slice(left, right + 1).map(t => t.receiver_id));
            if (receiversNow.size > bestReceivers.size) {
                bestReceivers = receiversNow;
                bestStartMs   = new Date(txList[left].timestamp).getTime();
                bestEndMs     = rightMs;
            }
        }

        if (bestReceivers.size >= 10) {
            const patterns = ['fan_out'];
            if (bestEndMs - bestStartMs < HV_MS)     patterns.push('high_velocity');
            if (bestEndMs - bestStartMs <= WINDOW_MS) patterns.push('temporal_72hr_window');
            rings.push({
                members: [senderId, ...bestReceivers],
                pattern_type: 'smurfing',
                detected_patterns: patterns,
                subtype: 'fan_out',
            });
        }
    }

    // Deduplication
    const seen = new Set();
    return rings.filter(r => {
        const k = [...r.members].sort().join('|');
        return seen.has(k) ? false : (seen.add(k), true);
    });
}
