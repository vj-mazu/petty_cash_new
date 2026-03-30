import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

// Extend jsPDF type
declare module 'jspdf' {
  interface jsPDF {
    autoTable: (options: any) => jsPDF;
    lastAutoTable: { finalY: number };
  }
}

export interface Transaction {
  id: string;
  date: string;
  type: 'credit' | 'debit';
  creditAmount?: number;
  debitAmount?: number;
  remarks?: string;
  reference?: string;
  ledger?: {
    name: string;
  };
  transactionNumber?: number;
  displayTransactionNumber?: string;
  transactionType?: string;
  createdBy?: {
    username: string;
  };
}

export interface TransactionPDFOptions {
  companyName?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  openingBalance?: number;
  includeRunningBalance?: boolean;
  includeCreatedBy?: boolean;
  separateCreditDebit?: boolean;
  dailyTotals?: {
    credit: number;
    debit: number;
    closing: number;
  };
}

/**
 * Format amount as plain number string (no ₹ symbol, no spacing issues)
 */
const fmtAmt = (amount: number): string => {
  if (typeof amount !== 'number' || isNaN(amount)) return '0';
  // Use Indian number format manually to avoid ₹ symbol issues
  const str = Math.abs(amount).toFixed(0);
  let result = '';
  const len = str.length;
  if (len <= 3) return str;
  result = str.substring(len - 3);
  let remaining = str.substring(0, len - 3);
  while (remaining.length > 2) {
    result = remaining.substring(remaining.length - 2) + ',' + result;
    remaining = remaining.substring(0, remaining.length - 2);
  }
  if (remaining.length > 0) result = remaining + ',' + result;
  return result;
};

/**
 * Format date as DD/MM/YY
 */
const fmtDate = (dateString: string): string => {
  try {
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return dateString || '-';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = String(d.getFullYear()).slice(-2);
    return `${day}/${month}/${year}`;
  } catch { return dateString || '-'; }
};

/**
 * Generate Transaction PDF — matches frontend exactly
 * Minimal header: just PETTY CASH + date
 * No summary section
 * Portrait, full-width table
 */
export const generateTransactionPDF = (
  transactions: Transaction[],
  options: TransactionPDFOptions = {}
): boolean => {
  try {
    if (!transactions || transactions.length === 0) return false;

    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });
    const pw = doc.internal.pageSize.width;

    // === MINIMAL HEADER: just PETTY CASH + date ===
    let y = 12;
    doc.setFontSize(14);
    doc.setFont('helvetica', 'bold');
    doc.text('PETTY CASH', pw / 2, y, { align: 'center' });
    y += 5;

    // Date line
    const dateText = options.dateRange
      ? `${options.dateRange.start} to ${options.dateRange.end}`
      : new Date().toLocaleDateString('en-IN');
    doc.setFontSize(8);
    doc.setFont('helvetica', 'normal');
    doc.text(dateText, pw / 2, y, { align: 'center' });
    y += 3;

    // Opening balance if provided
    if (options.openingBalance !== undefined) {
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(`Opening: ${fmtAmt(options.openingBalance)}`, pw / 2, y, { align: 'center' });
      y += 3;
    }

    // Thin line
    doc.setDrawColor(200, 200, 200);
    doc.setLineWidth(0.2);
    doc.line(10, y, pw - 10, y);
    y += 2;

    // === SORT: Credit > Combined > Debit ===
    const sorted = [...transactions].sort((a, b) => {
      const p = (t: Transaction) => {
        if (t.reference === 'A' || t.transactionType === 'combined') return 2;
        return t.type === 'credit' ? 1 : 3;
      };
      const diff = p(a) - p(b);
      if (diff !== 0) return diff;
      return (a.transactionNumber || 0) - (b.transactionNumber || 0);
    });

    // === TABLE — SL, DATE, TX#, TYPE, AMOUNT, LEDGER, REMARKS ===
    const body = sorted.map((t, i) => {
      const isCredit = t.type === 'credit';
      const amount = isCredit ? (t.creditAmount || 0) : (t.debitAmount || 0);
      const isCombined = t.reference === 'A' || t.transactionType === 'combined';
      const amtStr = isCombined ? `A ${fmtAmt(amount)}` : fmtAmt(amount);

      return [
        String(i + 1),
        fmtDate(t.date),
        t.displayTransactionNumber || (t.transactionNumber ? String(t.transactionNumber).padStart(2, '0') : '-'),
        isCredit ? 'Credit' : 'Debit',
        amtStr,
        t.ledger?.name || '',
        t.remarks || '-'
      ];
    });

    autoTable(doc, {
      head: [['SL', 'DATE', 'TX #', 'TYPE', 'AMOUNT', 'LEDGER', 'REMARKS']],
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
        3: { halign: 'center', cellWidth: 14 },
        4: { halign: 'left', cellWidth: 26 },
        5: { halign: 'left', cellWidth: 36 },
        6: { halign: 'left' }
      },
      alternateRowStyles: { fillColor: [250, 250, 255] },
      didParseCell: (data: any) => {
        if (data.section === 'body') {
          // CR green, DR red
          if (data.column.index === 3) {
            if (data.cell.raw === 'Credit') {
              data.cell.styles.textColor = [22, 163, 74];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.raw === 'Debit') {
              data.cell.styles.textColor = [220, 38, 38];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Amount colors
          if (data.column.index === 4) {
            const rowType = body[data.row.index]?.[3];
            data.cell.styles.textColor = rowType === 'Credit' ? [22, 163, 74] : [220, 38, 38];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
      margin: { left: 10, right: 10 }
    });

    // === DAILY TOTALS FOOTER (matches frontend DAILY TOTALS bar) ===
    if (options.dailyTotals) {
      const finalY = (doc as any).lastAutoTable?.finalY || y + 20;
      const totals = options.dailyTotals;
      const footerY = finalY + 2;

      // Dark background bar
      doc.setFillColor(31, 41, 55); // gray-800
      doc.rect(10, footerY, pw - 20, 8, 'F');

      // DAILY TOTALS label
      doc.setFontSize(8);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(255, 255, 255);
      doc.text('DAILY TOTALS:', 14, footerY + 5.5);

      // CREDIT badge (green)
      const creditText = `CREDIT: ${fmtAmt(totals.credit)}`;
      doc.setFillColor(22, 163, 74); // green-600
      doc.roundedRect(70, footerY + 1, 42, 6, 1, 1, 'F');
      doc.setFontSize(7);
      doc.text(creditText, 91, footerY + 5, { align: 'center' });

      // DEBIT badge (red)
      const debitText = `DEBIT: ${fmtAmt(totals.debit)}`;
      doc.setFillColor(220, 38, 38); // red-600
      doc.roundedRect(115, footerY + 1, 38, 6, 1, 1, 'F');
      doc.text(debitText, 134, footerY + 5, { align: 'center' });

      // CLOSING badge (gray)
      const closingText = `CLOSING: ${fmtAmt(totals.closing)}`;
      doc.setFillColor(75, 85, 99); // gray-600
      doc.roundedRect(156, footerY + 1, 42, 6, 1, 1, 'F');
      doc.text(closingText, 177, footerY + 5, { align: 'center' });
    }

    // Add "Made with ❤ by VAJJRA" footer
    const pw2 = doc.internal.pageSize.width;
    const ph = doc.internal.pageSize.height;
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(120, 120, 120);
      doc.text('Made with \u2764 by VAJJRA', pw2 / 2, ph - 8, { align: 'center' });
    }

    const ts = new Date().toISOString().slice(0, 16).replace(/:/g, '-');
    doc.save(`Transactions_${ts}.pdf`);
    return true;

  } catch (error) {
    console.error('PDF error:', error);
    return false;
  }
};

export default generateTransactionPDF;