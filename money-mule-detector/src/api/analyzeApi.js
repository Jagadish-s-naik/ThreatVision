/**
 * analyzeApi.js
 * Frontend API client for communicating with the ThreatVision Node.js backend.
 */

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

/**
 * Sends a CSV file to the backend for analysis.
 * @param {File} file - The CSV file object from the file input.
 * @param {Function} onProgress - Optional callback for progress messages.
 * @returns {Promise<Object>} Full analysis result matching problem statement spec.
 */
export async function analyzeCSV(file, onProgress) {
    const formData = new FormData();
    formData.append('file', file);

    onProgress?.('Uploading CSV to Neo4j backend...');

    const response = await fetch(`${BACKEND_URL}/api/analyze`, {
        method: 'POST',
        body: formData,
    });

    if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Server error' }));
        throw new Error(err.error || `Server returned ${response.status}`);
    }

    onProgress?.('Processing complete');
    return response.json();
}

/**
 * Checks the health of the backend and Neo4j connection.
 */
export async function checkHealth() {
    const response = await fetch(`${BACKEND_URL}/api/health`);
    return response.json();
}
