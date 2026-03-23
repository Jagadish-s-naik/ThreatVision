import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// Visual Helper: Risk Meter
const drawRiskMeter = (doc, x, y, score) => {
  const width = 40;
  const height = 4;
  doc.setDrawColor(200, 200, 200);
  doc.setFillColor(240, 240, 240);
  doc.rect(x, y, width, height, 'FD');
  
  // Fill color based on score severity
  let r = 0, g = 229, b = 255; // Cyan (Low Risk)
  if (score >= 80) { r = 255; g = 50; b = 50; } // Red (Critical)
  else if (score >= 50) { r = 255; g = 165; b = 0; } // Orange (Medium)
  
  const fillWidth = (Math.min(score, 100) / 100) * width;
  doc.setFillColor(r, g, b);
  doc.rect(x, y, fillWidth, height, 'F');
};

// Visual Helper: Pattern Icons
const drawPatternIcon = (doc, pattern, x, y) => {
  doc.setLineWidth(0.5);
  doc.setFillColor(15, 21, 32); 
  
  if (pattern.includes('cycle')) {
    doc.setDrawColor(0, 229, 255); // Cyan outline
    doc.circle(x, y - 3, 1.5, 'FD');
    doc.circle(x - 3, y + 2, 1.5, 'FD');
    doc.circle(x + 3, y + 2, 1.5, 'FD');
    doc.setDrawColor(150);
    doc.line(x - 1, y - 1, x - 2, y);
    doc.line(x + 1, y - 1, x + 2, y);
    doc.line(x - 2, y + 2, x + 2, y + 2);
  } else if (pattern.includes('smurfing')) {
    doc.setDrawColor(255, 50, 50); // Red outline
    doc.circle(x, y, 2, 'FD'); // Hub
    doc.circle(x - 4, y - 3, 1, 'FD');
    doc.circle(x + 4, y - 3, 1, 'FD');
    doc.circle(x - 4, y + 3, 1, 'FD');
    doc.circle(x + 4, y + 3, 1, 'FD');
    doc.setDrawColor(150);
    doc.line(x - 2, y - 1.5, x - 1, y - 0.5);
    doc.line(x + 2, y - 1.5, x + 1, y - 0.5);
    doc.line(x - 2, y + 1.5, x - 1, y + 0.5);
    doc.line(x + 2, y + 1.5, x + 1, y + 0.5);
  } else {
    // Shells
    doc.setDrawColor(168, 85, 247); // Purple outline
    doc.circle(x - 5, y, 1, 'FD'); 
    doc.circle(x, y, 2, 'FD'); // Shell Core
    doc.circle(x + 5, y, 1, 'FD');
    doc.setDrawColor(150);
    doc.line(x - 3, y, x - 2, y);
    doc.line(x + 2, y, x + 3, y);
  }
};

export const generateForensicReport = (analysisResults, selectedRing = null) => {
  const doc = new jsPDF();
  const summary = analysisResults.summary || {};
  const allRings = analysisResults.fraud_rings || [];
  const suspiciousAccounts = analysisResults.suspicious_accounts || [];
  
  const ringsToReport = selectedRing ? [selectedRing] : allRings;

  // -- Report Header
  doc.setFontSize(22);
  doc.setTextColor(10, 20, 40);
  doc.text('ThreatVision Forensic Report', 14, 20);
  
  doc.setFontSize(10);
  doc.setTextColor(100, 100, 100);
  doc.text(`Generated on: ${new Date().toLocaleString()}`, 14, 28);
  doc.text(`Scope: ${selectedRing ? 'Selected Fraud Ring' : 'Complete Platform Analysis'}`, 14, 33);

  // -- Introductory Explanatory Text
  doc.setFontSize(10);
  doc.setTextColor(60, 60, 60);
  const introText = selectedRing 
    ? "This report isolates a single detected fraud ring. The analysis highlights specific transaction behaviors exhibiting high suspicion. The risk metrics and pattern classifications below were algorithmically determined by ThreatVision's forensic engine. Diagrams are provided next to pattern classifications to illustrate the structural topology of the detected network flow."
    : "This comprehensive report outlines all detected illicit financial flows within the dataset. ThreatVision utilizes multi-layered heuristic algorithms to identify patterns such as Smurfing (fan-in/fan-out), Circular Trading (cycles), and Shell Company Layering. The severity of each ring is calculated based on transaction velocity, network structure, and obfuscation attempts.";
  
  const introLines = doc.splitTextToSize(introText, 180);
  doc.text(introLines, 14, 45);
  
  let currentY = 45 + (introLines.length * 5) + 5;

  // -- Executive Summary
  doc.setFontSize(14);
  doc.setTextColor(10, 20, 40);
  doc.text('Executive Summary', 14, currentY);

  autoTable(doc, {
    startY: currentY + 5,
    head: [['Metric', 'Value']],
    body: [
      ['Total Accounts Analyzed', (summary.total_accounts_analyzed || 0).toLocaleString()],
      ['Verified Legitimate Accounts', ((analysisResults?.verified_entities || []).length).toLocaleString()],
      ['Suspicious Entities Flagged', (summary.suspicious_accounts_flagged || 0).toLocaleString()],
      ['Total Fraud Rings Detected', (summary.fraud_rings_detected || 0).toLocaleString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: [0, 229, 255], textColor: [10, 14, 26] },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { top: 10, left: 14, right: 14 }
  });

  currentY = doc.lastAutoTable.finalY + 15;
  
  // -- Fraud Rings Breakdown
  doc.setFontSize(14);
  doc.setTextColor(10, 20, 40);
  doc.text('Fraud Rings Analysis Details', 14, currentY);
  currentY += 10;

  if (ringsToReport.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('No fraud rings detected in this analysis payload.', 14, currentY);
  } else {
    ringsToReport.forEach((ring, index) => {
      // Check page break
      if (currentY > 240) {
        doc.addPage();
        currentY = 20;
      }

      // Ring Header Background
      doc.setFillColor(245, 247, 250);
      doc.rect(14, currentY - 5, 182, 22, 'F');

      // Ring ID and Diagram
      doc.setFontSize(12);
      doc.setTextColor(10, 20, 40);
      doc.text(`Ring ID: ${ring.ring_id}`, 18, currentY + 1);
      
      // Draw Pattern Icon & Risk Meter
      drawPatternIcon(doc, ring.pattern_type, 180, currentY);
      drawRiskMeter(doc, 70, currentY - 2, ring.risk_score);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 100, 100);
      doc.text(`Risk Score: ${ring.risk_score.toFixed(1)}/100`, 115, currentY + 1);
      
      currentY += 8;
      
      doc.setFontSize(10);
      doc.setTextColor(60, 60, 60);
      
      let patternDesc = "Unknown Pattern Topology.";
      if (ring.pattern_type.includes('smurfing')) patternDesc = "Smurfing (Hub & Spoke): Rapid fan-in/fan-out transactions to avoid limits.";
      if (ring.pattern_type.includes('layered')) patternDesc = "Layered Shells: Funds moving linearly to obfuscate origin.";
      if (ring.pattern_type.includes('cycle')) patternDesc = "Circular Trading: Funds looping back to originating accounts.";
      
      doc.text(`Primary Topology: ${patternDesc}`, 18, currentY);
      currentY += 12;

      // Extract specific member details
      const tableData = ring.member_accounts.map(accId => {
        const fullAcc = suspiciousAccounts.find(a => a.account_id === accId);
        return [
          accId,
          fullAcc ? fullAcc.suspicion_score.toFixed(1) : 'N/A',
          fullAcc ? fullAcc.detected_patterns.join(', ') : 'N/A'
        ];
      });

      autoTable(doc, {
        startY: currentY,
        head: [['Account ID', 'Suspicion Score', 'Detected Sub-Patterns']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [15, 21, 32] },
        styles: { fontSize: 9 },
        margin: { left: 14, right: 14 }
      });

      currentY = doc.lastAutoTable.finalY + 15;
    });
  }

  // Handle footer
  const pageCount = doc.internal.getNumberOfPages();
  for(let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(150);
    doc.text(`Page ${i} of ${pageCount}`, doc.internal.pageSize.width - 20, doc.internal.pageSize.height - 10, { align: 'right' });
    doc.text('ThreatVision Intelligence Terminal - Confidential Forensic Data', 14, doc.internal.pageSize.height - 10);
  }

  // Trigger download
  const filename = selectedRing 
    ? `ThreatVision_Ring_${selectedRing.ring_id}_Report.pdf` 
    : 'ThreatVision_Comprehensive_Report.pdf';
    
  doc.save(filename);
};
