import React, { useState, useRef, useCallback } from 'react';
import { parseCSV } from '../utils/csvParser.js';

export default function CSVUploader({ onAnalysisComplete, isProcessing }) {
    const [isDragging, setIsDragging] = useState(false);
    const [error, setError] = useState('');
    const [fileName, setFileName] = useState('');
    const [rowCount, setRowCount] = useState(null);
    const fileInputRef = useRef(null);

    const processFile = useCallback(async (file) => {
        setError('');
        if (!file) return;

        if (!file.name.toLowerCase().endsWith('.csv')) {
            setError('Invalid file type. Please upload a .csv file.');
            return;
        }

        setFileName(file.name);

        try {
            const result = await parseCSV(file);

            if (result.missingColumns.length > 0) {
                setError(`Missing required columns: ${result.missingColumns.join(', ')}`);
                setFileName('');
                return;
            }

            if (result.transactions.length === 0) {
                setError('The CSV file is empty or has no valid rows (all rows were skipped due to missing/invalid data).');
                setFileName('');
                return;
            }

            setRowCount(result.transactions.length);
            onAnalysisComplete(result.transactions);
        } catch (err) {
            setError(`Failed to parse CSV: ${err.message || err}`);
            setFileName('');
        }
    }, [onAnalysisComplete]);

    const handleDrop = useCallback((e) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        processFile(file);
    }, [processFile]);

    const handleDragOver = (e) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => setIsDragging(false);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        processFile(file);
    };

    return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center px-4">
            {/* Header */}
            <div className="text-center mb-10">
                <h1 className="text-4xl md:text-5xl font-bold text-slate-100 mb-3" style={{ fontFamily: 'Syne, sans-serif' }}>
                    💰 Financial Forensics Engine
                </h1>
                <p className="text-slate-400 text-lg" style={{ fontFamily: 'Inter, sans-serif' }}>
                    Money Muling Detection · Graph Theory Track · RIFT 2026
                </p>
            </div>

            {/* Upload zone */}
            <div
                className={`w-full max-w-2xl border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center cursor-pointer transition-all duration-300
          ${isDragging
                        ? 'border-amber-400 bg-amber-400/10 scale-105'
                        : 'border-slate-600 bg-slate-900 hover:border-amber-500 hover:bg-slate-800'
                    }`}
                onDrop={handleDrop}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onClick={() => !isProcessing && fileInputRef.current?.click()}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept=".csv"
                    className="hidden"
                    onChange={handleFileChange}
                    disabled={isProcessing}
                />

                {isProcessing ? (
                    <div className="flex flex-col items-center gap-4">
                        <div className="w-14 h-14 border-4 border-amber-400 border-t-transparent rounded-full animate-spin" />
                        <p className="text-amber-400 font-semibold text-lg animate-pulse" style={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                            Analyzing transactions...
                        </p>
                        <p className="text-slate-400 text-sm">Running graph algorithms & pattern detection</p>
                    </div>
                ) : (
                    <>
                        <div className="w-16 h-16 mb-5 text-amber-400">
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                <path strokeLinecap="round" strokeLinejoin="round"
                                    d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                            </svg>
                        </div>

                        {fileName && rowCount !== null ? (
                            <div className="text-center">
                                <p className="text-green-400 font-semibold text-lg mb-1">✓ {fileName}</p>
                                <p className="text-slate-300 text-sm">{rowCount.toLocaleString()} valid transactions loaded</p>
                                <p className="text-slate-500 text-xs mt-2">Click to upload a different file</p>
                            </div>
                        ) : (
                            <>
                                <p className="text-slate-200 font-semibold text-xl mb-2" style={{ fontFamily: 'Syne, sans-serif' }}>
                                    Drop your CSV file here
                                </p>
                                <p className="text-slate-400 text-sm mb-6">Accepts .csv files only</p>
                                <button
                                    className="px-6 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold rounded-lg transition-colors duration-200"
                                    onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                >
                                    Browse File
                                </button>
                            </>
                        )}
                    </>
                )}
            </div>

            {/* Error message */}
            {error && (
                <div className="mt-4 w-full max-w-2xl bg-red-900/40 border border-red-600 text-red-300 rounded-xl px-5 py-4 text-sm">
                    ⚠ {error}
                </div>
            )}

            {/* Required columns info */}
            <div className="mt-8 w-full max-w-2xl bg-slate-900 border border-slate-700 rounded-xl p-5">
                <p className="text-slate-400 text-xs font-semibold mb-3 uppercase tracking-widest">Required CSV Columns</p>
                <div className="flex flex-wrap gap-2">
                    {['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'].map((col) => (
                        <span
                            key={col}
                            className="px-3 py-1 bg-slate-800 border border-slate-600 text-amber-400 text-xs rounded-lg font-mono"
                        >
                            {col}
                        </span>
                    ))}
                </div>
                <p className="text-slate-500 text-xs mt-3">
                    Timestamp format: <span className="text-slate-300 font-mono">YYYY-MM-DD HH:MM:SS</span>
                </p>
            </div>
        </div>
    );
}
