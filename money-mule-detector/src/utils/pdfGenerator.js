import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

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

  // -- Executive Summary
  doc.setFontSize(14);
  doc.setTextColor(10, 20, 40);
  doc.text('Executive Summary', 14, 45);

  autoTable(doc, {
    startY: 50,
    head: [['Metric', 'Value']],
    body: [
      ['Total Accounts Analyzed', (summary.total_accounts_analyzed || 0).toLocaleString()],
      ['Verified Legitimate', ((analysisResults?.verified_entities || []).length).toLocaleString()],
      ['Suspicious Entities Flagged', (summary.suspicious_accounts_flagged || 0).toLocaleString()],
      ['Fraud Rings Detected', (summary.fraud_rings_detected || 0).toLocaleString()],
    ],
    theme: 'grid',
    headStyles: { fillColor: [0, 229, 255], textColor: [10, 14, 26] },
    columnStyles: { 0: { fontStyle: 'bold' } },
    margin: { top: 10, left: 14, right: 14 }
  });

  // -- Fraud Rings Breakdown
  let currentY = doc.lastAutoTable.finalY + 15;
  
  doc.setFontSize(14);
  doc.setTextColor(10, 20, 40);
  doc.text('Fraud Rings Analysis', 14, currentY);
  currentY += 8;

  if (ringsToReport.length === 0) {
    doc.setFontSize(10);
    doc.setTextColor(100, 100, 100);
    doc.text('No fraud rings detected in this analysis payload.', 14, currentY);
  } else {
    ringsToReport.forEach((ring, index) => {
      // Check page break
      if (currentY > 250) {
        doc.addPage();
        currentY = 20;
      }

      // Ring Header
      doc.setFontSize(12);
      doc.setTextColor(10, 20, 40);
      doc.text(`Ring ID: ${ring.ring_id}`, 14, currentY);
      currentY += 5;
      
      doc.setFontSize(10);
      doc.setTextColor(80, 80, 80);
      doc.text(`Pattern: ${ring.pattern_type.toUpperCase()} | Risk Score: ${ring.risk_score.toFixed(1)} | Members: ${ring.member_accounts.length}`, 14, currentY);
      currentY += 5;

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
        head: [['Account ID', 'Suspicion Score', 'Detected Patterns']],
        body: tableData,
        theme: 'striped',
        headStyles: { fillColor: [15, 21, 32] },
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
    doc.text('ThreatVision Intelligence Terminal - Confidential', 14, doc.internal.pageSize.height - 10);
  }

  // Trigger download
  const filename = selectedRing 
    ? `ThreatVision_Ring_${selectedRing.ring_id}_Report.pdf` 
    : 'ThreatVision_Comprehensive_Report.pdf';
    
  doc.save(filename);
};
