/**
 * analyzeApi.js
 * Frontend API client for the ThreatVision backend.
 * Automatically falls back to browser-side analysis if backend is unavailable.
 */
import { analyzeLocally } from '../algorithms/localAnalyzer.js';

// Normalise BACKEND_URL — handle missing protocol, trailing slash, http→https in prod
let _raw = import.meta.env.VITE_BACKEND_URL || '';
if (!_raw) _raw = 'http://localhost:3001';
if (!_raw.includes('://')) _raw = 'https://' + _raw;
let BACKEND_URL = _raw.replace(/\/$/, '');
if (import.meta.env.PROD && BACKEND_URL.startsWith('http://')) {
    BACKEND_URL = BACKEND_URL.replace('http://', 'https://');
}
// console.info('[ThreatVision] Backend URL:', BACKEND_URL);

/**
 * Sends a CSV file to the backend for analysis.
 * Falls back to browser-side analysis if the backend is unreachable / returns error.
 */
export async function analyzeCSV(file, onProgress) {
    // ── Try backend first ──────────────────────────────────────
    try {
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
            } catch { /* non-JSON body */ }
            throw new Error(errMsg);
        }

        onProgress?.('Processing complete');
        return response.json();

    } catch (backendErr) {
        // ── Fallback: run full analysis in the browser ─────────
        console.warn('[ThreatVision] Backend error, switching to local mode:', backendErr.message);
        onProgress?.('⚠️ Backend unavailable — running local analysis...');
        const result = await analyzeLocally(file);
        onProgress?.('Local analysis complete');
        return result;
    }
}

/**
 * Health check — returns backend status or local fallback indicator.
 */
export async function checkHealth() {
    try {
        const response = await fetch(`${BACKEND_URL}/api/health`);
        return response.json();
    } catch {
        return { status: 'local', neo4j: 'N/A' };
    }
}
