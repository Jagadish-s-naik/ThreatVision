import React, { useState, useRef, useCallback } from 'react';
import { ArrowLeft } from 'lucide-react';
import { parseCSV } from '../utils/csvParser.js';
import MatrixLoader from './MatrixLoader.jsx';
import { HeroGeometric } from './ui/shape-landing-hero.jsx';
import { ImagesBadge } from './ui/images-badge.jsx';
import { Sparkles } from './ui/sparkles.jsx';
import './CSVUploader.css';

// onFileSelected(file) — passes the raw File object to App.jsx for backend upload
// onAnalysisComplete retained for backward compat (legacy frontend mode)
export default function CSVUploader({ onFileSelected, onAnalysisComplete, isProcessing, onBack }) {
    // Use onFileSelected if available, fallback to legacy onAnalysisComplete
    const handleFile = onFileSelected || onAnalysisComplete;
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
            // Quick local validation: check required columns exist
            const result = await parseCSV(file);

            if (result.missingColumns.length > 0) {
                setError(`Missing required columns: ${result.missingColumns.join(', ')}`);
                setFileName('');
                return;
            }

            if (result.transactions.length === 0) {
                setError('The CSV file is empty or has no valid rows.');
                setFileName('');
                return;
            }

            setRowCount(result.transactions.length);

            // Pass the raw File object — backend handles full parsing
            handleFile(file);
        } catch (err) {
            setError(`Failed to validate CSV: ${err.message || err}`);
            setFileName('');
        }
    }, [handleFile]);

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
        <div className="relative min-h-screen w-full flex items-center justify-center overflow-hidden bg-[#030303]">
            {/* Background Hero Geometric Component */}
            <div className="absolute inset-0 z-0">
                <HeroGeometric
                    badge="Threat Vision"
                    title1="Detect Money Mules"
                    title2="With Graph Theory"
                />
            </div>

            {/* Global Background Elements for consistency */}
            <div className="absolute inset-0 z-0 pointer-events-none">
                <Sparkles
                    id="uploader-sparkles"
                    background="transparent"
                    minSize={0.4}
                    maxSize={1}
                    density={800}
                    className="w-full h-full opacity-40"
                    color="#FFFFFF"
                    speed={0.3}
                />
                <div className="absolute inset-0 opacity-[0.03] bg-[linear-gradient(to_right,#ffffff2c_1px,transparent_1px),linear-gradient(to_bottom,#ffffff2c_1px,transparent_1px)] bg-[size:70px_80px]" />
            </div>

            {onBack && (
                <button
                    onClick={onBack}
                    className="absolute top-6 left-6 z-50 flex items-center gap-2 px-4 py-2 bg-[#0a0c10]/80 hover:bg-[#1f2937]/80 border border-white/10 rounded-full text-white/70 hover:text-white transition-all backdrop-blur-md hover:scale-105"
                >
                    <ArrowLeft className="w-4 h-4" />
                    <span className="text-sm font-medium">Back to Home</span>
                </button>
            )}

            {/* Foreground Content (Uploader) */}
            <div className="relative z-10 w-full max-w-2xl px-4 flex flex-col items-center">

                {/* Header Section */}
                <div className="text-center mb-8 md:mb-12">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/[0.03] border border-white/[0.08] mb-6">
                        <div className="w-2 h-2 rounded-full bg-teal-500/80" />
                        <span className="text-sm text-white/60 tracking-wide">
                            Threat Vision
                        </span>
                    </div>

                    <h1 className="text-4xl md:text-6xl font-bold mb-6 tracking-tight">
                        <span className="bg-clip-text text-transparent bg-gradient-to-b from-white to-white/80">
                            Detect Money Mules
                        </span>
                        <br />
                        <span className="bg-clip-text text-transparent bg-gradient-to-r from-teal-300 via-white/90 to-indigo-300">
                            With Graph Theory
                        </span>
                    </h1>

                    <p className="text-base md:text-xl text-white/40 mb-8 leading-relaxed font-light tracking-wide max-w-xl mx-auto">
                        Analyze transaction networks to identify shell chains and smurfing patterns in real-time.
                    </p>
                </div>                {/* Upload zone container */}
                <div className="relative w-full group premium-border-host">
                    {/* Pulsing Aura */}
                    <div className="uploader-glow" />
                    
                    <div
                        className={`premium-border-container ${isDragging ? 'is-dragging' : ''} ${fileName ? 'active-border' : ''}`}
                        onDrop={handleDrop}
                        onDragOver={handleDragOver}
                        onDragLeave={handleDragLeave}
                        onClick={() => !isProcessing && fileInputRef.current?.click()}
                    >
                        <div className="premium-inner-content p-12 cursor-pointer relative overflow-hidden">
                            {/* Corner accents - kept for extra detail but made more subtle */}
                            <div className="absolute top-0 left-0 w-6 h-6 border-l-2 border-t-2 border-teal-500/20 group-hover:border-teal-400 transitions-colors"></div>
                            <div className="absolute top-0 right-0 w-6 h-6 border-r-2 border-t-2 border-teal-500/20 group-hover:border-teal-400 transitions-colors"></div>
                            <div className="absolute bottom-0 left-0 w-6 h-6 border-l-2 border-b-2 border-teal-500/20 group-hover:border-teal-400 transitions-colors"></div>
                            <div className="absolute bottom-0 right-0 w-6 h-6 border-r-2 border-b-2 border-teal-500/20 group-hover:border-teal-400 transitions-colors"></div>

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
                                    <MatrixLoader />
                                    <p className="text-emerald-400 font-semibold text-lg animate-pulse mt-4 font-mono tracking-wide">
                                        :: DECRYPTING_MATRIX ::
                                    </p>
                                    <p className="text-slate-400 text-xs uppercase tracking-widest">Running graph algorithms...</p>
                                </div>
                            ) : (
                                <>
                                    {fileName && rowCount !== null ? (
                                        <div className="text-center animate-fadeIn">
                                            <p className="text-teal-400 font-bold text-lg mb-1 font-mono">✓ {fileName}</p>
                                            <p className="text-slate-300 text-sm">{rowCount.toLocaleString()} VALID TRANSACTIONS</p>
                                            <p className="text-slate-500 text-xs mt-4 uppercase tracking-widest hover:text-teal-400 transition-colors">Click to replace file</p>
                                        </div>
                                    ) : (
                                        <>
                                            <ImagesBadge
                                                text="DROP CSV FILE"
                                                images={[
                                                    "https://assets.aceternity.com/pro/agenforce-1.webp",
                                                    "https://assets.aceternity.com/pro/agenforce-2.webp",
                                                    "https://assets.aceternity.com/pro/agenforce-3.webp",
                                                ]}
                                            />
                                            <p className="text-slate-400 text-sm font-mono tracking-widest mt-2 mb-8">
                                                [ .csv files only ]
                                            </p>
                                            <button
                                                className="px-10 py-4 bg-gradient-to-r from-teal-500 to-indigo-600 rounded-full text-white font-bold text-sm shadow-[0_0_20px_rgba(20,184,166,0.2)] hover:shadow-[0_0_35px_rgba(20,184,166,0.4)] transition-all hover:scale-105 active:scale-95 border border-white/10"
                                                onClick={(e) => { e.stopPropagation(); fileInputRef.current?.click(); }}
                                            >
                                                BROWSE SYSTEM
                                            </button>
                                        </>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                </div>

                {/* Error message */}
                {error && (
                    <div className="mt-4 w-full bg-red-950/80 border-2 border-red-600 text-red-300 px-5 py-4 text-sm backdrop-blur-sm brutal-shadow-teal font-bold">
                        ⚠ ERROR: {error}
                    </div>
                )}


                {/* Required columns info */}
                <div className="mt-8 w-full bg-slate-900/80 border border-slate-700/50 rounded-xl p-5 backdrop-blur-sm">
                    <p className="text-slate-400 text-xs font-semibold mb-3 uppercase tracking-widest">Required CSV Columns</p>
                    <div className="flex flex-wrap gap-2">
                        {['transaction_id', 'sender_id', 'receiver_id', 'amount', 'timestamp'].map((col) => (
                            <span
                                key={col}
                                className="px-3 py-1 bg-slate-800/50 border border-slate-600/50 text-teal-400 text-xs rounded-lg font-mono"
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
        </div>
    );
}
