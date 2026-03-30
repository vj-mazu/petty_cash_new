import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { toTitleCase } from './textUtils';

// Extend jsPDF type
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface AnamathEntry {
  id: string;
  date: string;
  amount: number;
  remarks: string;
  ledger?: {
    name: string;
  };
  referenceNumber?: string;
  createdBy?: {
    username: string;
  };
  transactionNumber?: number;
  displayTransactionNumber?: string;
  closedAt?: string;
  isClosed?: boolean;
}

export interface AnamathPDFOptions {
  companyName?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  includeCreatedBy?: boolean;
  includeReference?: boolean;
}

/**
 * Format amount as plain number (no ₹, no spacing issues in PDF)
 */
const fmtAmt = (amount: number): string => {
  if (typeof amount !== 'number' || isNaN(amount)) return '0';
  const num = Math.abs(amount);
  const str = Math.round(num).toString();
  const len = str.length;
  if (len <= 3) return str;
  let result = str.substring(len - 3);
  let remaining = str.substring(0, len - 3);
  while (remaining.length > 2) {
    result = remaining.substring(remaining.length - 2) + ',' + result;
    remaining = remaining.substring(0, remaining.length - 2);
  }
  if (remaining.length > 0) result = remaining + ',' + result;
  return result;
};

/**
 * Format date as DD/MM/YYYY
 */
const fmtDate = (dateString: string): string => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString || '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear());
    return `${day}/${month}/${year}`;
  } catch { return dateString || '-'; }
};

/**
 * Generate Anamath PDF — matches frontend exactly
 * Minimal header: PETTY CASH + date
 * No summary section
 * Columns: SL, DATE, ID, LEDGER, AMOUNT, REMARKS
 */
export const generateAnamathPDF = (
  entries: AnamathEntry[],
  options: AnamathPDFOptions = {}
): boolean => {
  try {
    if (!entries || entries.length === 0) return false;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.width;

    // === MINIMAL HEADER ===
    let y = 12;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PETTY CASH', pw / 2, y, { align: 'center' });
    y += 5;

    const dateText = options.dateRange
      ? `${options.dateRange.start} to ${options.dateRange.end}`
      : new Date().toLocaleDateString('en-IN');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(dateText, pw / 2, y, { align: 'center' });
    y += 3;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(10, y, pw - 10, y);
    y += 2;

    // === TABLE — SL, DATE, ID, LEDGER, AMOUNT, REMARKS ===
    const body = entries.map((entry, i) => {
      // Safely get amount as number
      let amt = 0;
      if (typeof entry.amount === 'number') {
        amt = entry.amount;
      } else if (typeof entry.amount === 'string') {
        amt = parseFloat(entry.amount) || 0;
      }

      return [
        String(i + 1),
        fmtDate(entry.date),
        entry.transactionNumber ? `A${String(entry.transactionNumber).padStart(3, '0')}` : '-',
        toTitleCase(entry.ledger?.name || '-'),
        fmtAmt(amt),
        entry.remarks || '-'
      ];
    });

    autoTable(doc, {
      head: [['SL', 'DATE', 'ID', 'LEDGER', 'AMOUNT', 'REMARKS']],
      body: body,
      startY: y,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 1.5,
        lineColor: [180, 180, 180],
        lineWidth: 0.3,
        overflow: 'linebreak',
        valign: 'middle',
        font: 'helvetica'
      },
      headStyles: {
        fillColor: [230, 236, 245],
        textColor: [30, 30, 30],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 2
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 14 },
        3: { halign: 'left', cellWidth: 38 },
        4: { halign: 'left', cellWidth: 26 },
        5: { halign: 'left' }
      },
      alternateRowStyles: { fillColor: [250, 250, 255] },
      didParseCell: (data: any) => {
        if (data.section === 'body' && data.column.index === 4) {
          data.cell.styles.textColor = [22, 163, 74];
          data.cell.styles.fontStyle = 'bold';
        }
      },
      margin: { left: 10, right: 10 }
    });

    // NO SUMMARY — clean PDF

    // Add "Made with ❤ by VAJJRA" footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text('Made with \u2764 by VAJJRA', doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' });
    }

    const ts = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
    doc.save(`Anamath_Records_${ts}.pdf`);
    return true;

  } catch (error) {
    console.error('Anamath PDF error:', error);
    return false;
  }
};

/**
 * Generate Closed Anamath PDF
 */
export const generateClosedAnamathPDF = async (
  entries: AnamathEntry[],
  options: AnamathPDFOptions = {}
): Promise<boolean> => {
  try {
    if (!entries || entries.length === 0) return false;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.width;

    let y = 12;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PETTY CASH', pw / 2, y, { align: 'center' });
    y += 5;

    const dateText = options.dateRange
      ? `${options.dateRange.start} to ${options.dateRange.end}`
      : new Date().toLocaleDateString('en-IN');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(`Closed Records - ${dateText}`, pw / 2, y, { align: 'center' });
    y += 3;

    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(10, y, pw - 10, y);
    y += 2;

    const body = entries.map((entry, i) => {
      let amt = 0;
      if (typeof entry.amount === 'number') amt = entry.amount;
      else if (typeof entry.amount === 'string') amt = parseFloat(entry.amount) || 0;

      return [
        String(i + 1),
        fmtDate(entry.date),
        entry.closedAt ? fmtDate(entry.closedAt) : '-',
        entry.transactionNumber ? `A${String(entry.transactionNumber).padStart(3, '0')}` : '-',
        toTitleCase(entry.ledger?.name || '-'),
        fmtAmt(amt),
        toTitleCase(entry.remarks || '-')
      ];
    });

    autoTable(doc, {
      head: [['SL', 'ENTRY DATE', 'CLOSED DATE', 'ID', 'LEDGER', 'AMOUNT', 'REMARKS']],
      body: body,
      startY: y,
      theme: 'grid',
      styles: {
        fontSize: 7,
        cellPadding: 2,
        lineColor: [180, 180, 180],
        lineWidth: 0.3,
        overflow: 'linebreak',
        valign: 'middle',
        font: 'helvetica'
      },
      headStyles: {
        fillColor: [230, 236, 245],
        textColor: [30, 30, 30],
        fontStyle: 'bold',
        fontSize: 7,
        cellPadding: 2.5
      },
      columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 22 },
        2: { halign: 'center', cellWidth: 22 },
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'left', cellWidth: 35 },
        5: { halign: 'left', cellWidth: 25 },
        6: { halign: 'left' }
      },
      alternateRowStyles: { fillColor: [250, 250, 255] },
      margin: { left: 10, right: 10 }
    });

    // Add "Made with ❤ by VAJJRA" footer
    const closedPageCount = doc.getNumberOfPages();
    for (let i = 1; i <= closedPageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text('Made with \u2764 by VAJJRA', doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 8, { align: 'center' });
    }

    const ts = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
    doc.save(`Closed_Anamath_${ts}.pdf`);
    return true;

  } catch (error) {
    console.error('Closed Anamath PDF error:', error);
    return false;
  }
};

export default generateAnamathPDF;