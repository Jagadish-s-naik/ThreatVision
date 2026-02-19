import React from 'react';
import './MatrixLoader.css';

export default function MatrixLoader() {
    return (
        <div className="ai-matrix-loader">
            <div className="glow"></div>
            {/* 8 digits as per CSS nth-child rules, plus a few extras for grid filling if needed */}
            <div className="digit">1</div>
            <div className="digit">0</div>
            <div className="digit">1</div>
            <div className="digit">0</div>
            <div className="digit">1</div>
            <div className="digit">1</div>
            <div className="digit">0</div>
            <div className="digit">1</div>
            <div className="digit">0</div>
        </div>
    );
}
