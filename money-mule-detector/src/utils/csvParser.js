/**
 * csvParser.js
 * PapaParse wrapper for parsing transaction CSVs.
 */
import Papa from 'papaparse';

const REQUIRED_COLUMNS = ['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'];

/**
 * Parses CSV file and returns validated transactions.
 * @param {File} file - The CSV File object
 * @returns {Promise<{ transactions, totalRows, skippedRows, missingColumns }>}
 */
export function parseCSV(file) {
    return new Promise((resolve, reject) => {
        Papa.parse(file, {
            header: true,
            dynamicTyping: true,
            skipEmptyLines: true,
            complete: (results) => {
                const { data, meta } = results;

                // Check for missing required columns
                const headers = meta.fields || [];
                const missingColumns = REQUIRED_COLUMNS.filter(
                    (col) => !headers.map((h) => h.trim().toLowerCase()).includes(col.toLowerCase())
                );

                if (missingColumns.length > 0) {
                    resolve({ transactions: [], totalRows: 0, skippedRows: 0, missingColumns });
                    return;
                }

                const transactions = [];
                let skippedRows = 0;

                for (const row of data) {
                    const txId = row.transaction_id != null ? String(row.transaction_id).trim() : '';
                    const senderId = row.sender_id != null ? String(row.sender_id).trim() : '';
                    const receiverId = row.receiver_id != null ? String(row.receiver_id).trim() : '';
                    const amount = parseFloat(row.amount);
                    const tsRaw = row.timestamp != null ? String(row.timestamp).trim() : '';
                    const timestamp = new Date(tsRaw);

                    // Skip rows missing any required field
                    if (
                        !txId ||
                        !senderId ||
                        !receiverId ||
                        isNaN(amount) ||
                        !tsRaw ||
                        isNaN(timestamp.getTime())
                    ) {
                        skippedRows++;
                        continue;
                    }

                    transactions.push({
                        transaction_id: txId,
                        sender_id: senderId,
                        receiver_id: receiverId,
                        amount,
                        timestamp,
                    });
                }

                resolve({
                    transactions,
                    totalRows: data.length,
                    skippedRows,
                    missingColumns: [],
                });
            },
            error: (err) => reject(err),
        });
    });
}
