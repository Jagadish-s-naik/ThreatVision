/**
 * analyzeApi.js
 * Frontend API client for communicating with the ThreatVision Node.js backend.
 */

// Normalise BACKEND_URL from env — handle missing protocol, trailing slash, http→https in prod
let _raw = import.meta.env.VITE_BACKEND_URL || '';
if (!_raw) _raw = 'http://localhost:3001';
if (!_raw.includes('://')) _raw = 'https://' + _raw;          // missing protocol
let BACKEND_URL = _raw.replace(/\/$/, '');                      // strip trailing slash
if (import.meta.env.PROD && BACKEND_URL.startsWith('http://')) {
    BACKEND_URL = BACKEND_URL.replace('http://', 'https://');   // force https in prod
}
console.info('[ThreatVision] Backend URL:', BACKEND_URL);       // visible in DevTools


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
        let errMsg = `HTTP ${response.status}`;
        try {
            const body = await response.text();
            const json = JSON.parse(body);
            errMsg = json.error || errMsg;
        } catch {
            // non-JSON body (HTML error page etc)
        }
        throw new Error(errMsg);
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
