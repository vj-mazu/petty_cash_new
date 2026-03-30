import jsPDF from 'jspdf';
import { formatIndianCurrency } from './indianNumberFormat';

/**
 * Professional PDF Generator Service
 * - Portrait orientation only
 * - Clean, professional formatting
 * - Consistent styling across all PDF types
 */

export interface PDFConfig {
  title: string;
  companyName?: string;
  dateRange?: {
    start: string;
    end: string;
  };
  generatedDate?: string;
  openingBalance?: number;
}

export interface TableColumn {
  header: string;
  width: number;
  align?: 'left' | 'center' | 'right';
}

export interface TableRow {
  [key: string]: string | number;
  _rowStyle?: 'credit' | 'debit' | 'combined'; // Special field for row styling
}

class PDFGenerator {
  private doc: jsPDF;
  private currentY: number;
  private pageHeight: number;
  private pageWidth: number;
  private margins = {
    top: 20,
    left: 15,
    right: 15,
    bottom: 20
  };

  constructor() {
    // Always use A4 portrait
    this.doc = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4'
    });

    this.pageWidth = this.doc.internal.pageSize.width;
    this.pageHeight = this.doc.internal.pageSize.height;
    this.currentY = this.margins.top;
  }

  /**
   * Normalize header string to key format
   */
  static normalizeHeaderToKey(header: string): string {
    return header.toLowerCase().replace(/[^a-z0-9]/g, '');
  }

  /**
   * Normalize all row keys to match header format
   */
  static normalizeRowKeys(row: TableRow): TableRow {
    const normalizedRow: TableRow = {};
    Object.entries(row).forEach(([key, value]) => {
      const normalizedKey = PDFGenerator.normalizeHeaderToKey(key);
      normalizedRow[normalizedKey] = value;
      // Keep original key as well for backward compatibility
      normalizedRow[key] = value;
    });
    return normalizedRow;
  }

  /**
   * Add header with company info and title
   */
  public addHeader(config: PDFConfig) {
    // Company name - compact
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text('PETTY CASH', this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 5;

    // Title - compact
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');
    this.doc.text(config.title, this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 4;

    // Date range - compact single line
    if (config.dateRange) {
      this.doc.setFontSize(7);
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`Period: ${config.dateRange.start} to ${config.dateRange.end}`, this.pageWidth / 2, this.currentY, { align: 'center' });
      this.currentY += 3;
    }

    // Generated date - compact
    this.doc.setFontSize(7);
    this.doc.setFont('helvetica', 'normal');
    this.doc.text(`Generated: ${config.generatedDate || new Date().toLocaleString()}`, this.pageWidth / 2, this.currentY, { align: 'center' });
    this.currentY += 4;

    // Opening balance - compact inline
    if (config.openingBalance !== undefined) {
      this.doc.setFontSize(11);
      this.doc.setFont('helvetica', 'bold');
      const formattedBalance = formatIndianCurrency(config.openingBalance).replace('₹', '').trim();
      this.doc.text(`Opening Balance: ${formattedBalance}`, this.pageWidth / 2, this.currentY, { align: 'center' });
      this.currentY += 5;
    }

    // Thin separator line
    this.doc.setDrawColor(150, 150, 150);
    this.doc.setLineWidth(0.3);
    this.doc.line(this.margins.left, this.currentY, this.pageWidth - this.margins.right, this.currentY);
    this.currentY += 3;
  }

  /**
   * Check if we need a new page
   */
  private checkPageBreak(requiredHeight: number = 10) {
    if (this.currentY + requiredHeight > this.pageHeight - this.margins.bottom) {
      this.doc.addPage();
      this.currentY = this.margins.top + 10; // Skip header on new pages
      return true;
    }
    return false;
  }

  /**
   * Add a table with balance tracking for multi-page PDFs
   * This ensures each page shows correct opening/closing balance
   */
  addTableWithBalanceTracking(
    columns: TableColumn[],
    rows: TableRow[],
    transactions: any[],
    options: any
  ) {
    try {

      const rowHeight = 10;

      // Calculate which rows fit on which page
      const maxRowsPerPage = Math.floor((this.pageHeight - this.currentY - this.margins.bottom - 60) / rowHeight);

      // Split transactions into pages
      const pages: { rows: TableRow[], transactions: any[], startIndex: number }[] = [];
      for (let i = 0; i < rows.length; i += maxRowsPerPage) {
        pages.push({
          rows: rows.slice(i, i + maxRowsPerPage),
          transactions: transactions.slice(i, i + maxRowsPerPage),
          startIndex: i
        });
      }


      // Track running balance across pages
      let runningBalance = options.openingBalance || 0;

      // Generate each page
      pages.forEach((page, pageIndex) => {
        const isFirstPage = pageIndex === 0;
        const isLastPage = pageIndex === pages.length - 1;

        // Page opening balance
        const pageOpeningBalance = runningBalance;

        // Calculate page totals
        let pageCredit = 0;
        let pageDebit = 0;

        page.transactions.forEach(t => {
          if (t.type === 'credit') {
            pageCredit += t.creditAmount || 0;
          } else {
            pageDebit += t.debitAmount || 0;
          }
        });

        // Page closing balance
        const pageClosingBalance = pageOpeningBalance + pageCredit - pageDebit;


        // Add page header if not first page
        if (!isFirstPage) {
          this.doc.addPage();
          this.currentY = this.margins.top + 10;

          // Show "Continued from previous page" WITHOUT opening balance
          this.doc.setFontSize(10);
          this.doc.setFont('helvetica', 'italic');
          this.doc.setTextColor(100, 100, 100);
          const continuedText = `(Continued from previous page)`;
          this.doc.text(continuedText, this.pageWidth / 2, this.currentY, { align: 'center' });
          this.doc.setTextColor(0, 0, 0); // Reset to black
          this.currentY += 10;
        }

        // Add table for this page
        this.addTablePage(columns, page.rows, pageOpeningBalance, pageClosingBalance, isLastPage);

        // Update running balance for next page
        runningBalance = pageClosingBalance;
      });


    } catch (error) {
      console.error(`❌ PDFGenerator: Multi-page table generation failed:`, error);
      throw error;
    }
  }

  /**
   * Add a single page of the table
   */
  private addTablePage(
    columns: TableColumn[],
    rows: TableRow[],
    pageOpeningBalance: number,
    pageClosingBalance: number,
    isLastPage: boolean
  ) {
    const tableWidth = this.pageWidth - this.margins.left - this.margins.right;
    const scaledColumns = columns.map(col => ({
      ...col,
      scaledWidth: (col.width / columns.reduce((sum, c) => sum + c.width, 0)) * tableWidth
    }));

    const rowHeight = 7;
    const headerHeight = 9;

    // Helper function to calculate required row height
    const calculateRowHeight = (row: TableRow): number => {
      let maxLines = 1;
      scaledColumns.forEach(col => {
        const normalizedKey = col.header.toLowerCase().replace(/[^a-z0-9]/g, '');
        let cellValue = '';
        if (row[normalizedKey] !== undefined && row[normalizedKey] !== null) {
          cellValue = String(row[normalizedKey]);
        }
        if (cellValue) {
          const maxWidth = col.scaledWidth - 6;
          const lines = this.doc.splitTextToSize(cellValue, maxWidth);
          const lineCount = Array.isArray(lines) ? lines.length : 1;
          maxLines = Math.max(maxLines, lineCount);
        }
      });
      return Math.max(rowHeight, maxLines * 4 + 1.5);
    };

    // Draw table header
    this.doc.setFillColor(220, 220, 220);
    this.doc.rect(this.margins.left, this.currentY - 2, tableWidth, headerHeight, 'F');
    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.8);
    this.doc.rect(this.margins.left, this.currentY - 2, tableWidth, headerHeight);

    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'bold');

    let currentX = this.margins.left;
    scaledColumns.forEach((col, index) => {
      if (index > 0) {
        this.doc.line(currentX, this.currentY - 2, currentX, this.currentY + headerHeight - 2);
      }
      const textX = currentX + col.scaledWidth / 2;
      this.doc.text(col.header, textX, this.currentY + 4, { align: 'center' });
      currentX += col.scaledWidth;
    });

    this.currentY += headerHeight;

    // Draw table rows
    this.doc.setFont('helvetica', 'normal');
    this.doc.setFontSize(8);
    this.doc.setLineWidth(0.3);

    rows.forEach((row, rowIndex) => {
      const dynamicRowHeight = calculateRowHeight(row);

      // Alternate row background
      if (rowIndex % 2 === 0) {
        this.doc.setFillColor(248, 248, 248);
        this.doc.rect(this.margins.left, this.currentY, tableWidth, dynamicRowHeight, 'F');
      }

      // Row border
      this.doc.setDrawColor(180, 180, 180);
      this.doc.rect(this.margins.left, this.currentY, tableWidth, dynamicRowHeight);

      // Set font style based on row type
      const rowStyle = row._rowStyle;
      if (rowStyle === 'credit') {
        this.doc.setFont('helvetica', 'italic');
      } else if (rowStyle === 'debit') {
        this.doc.setFont('helvetica', 'bold');
        this.doc.setFontSize(8.5);
      } else if (rowStyle === 'combined') {
        this.doc.setFont('helvetica', 'bolditalic');
      } else {
        this.doc.setFont('helvetica', 'normal');
      }

      currentX = this.margins.left;
      scaledColumns.forEach((col, colIndex) => {
        if (colIndex > 0) {
          this.doc.line(currentX, this.currentY, currentX, this.currentY + dynamicRowHeight);
        }

        const normalizedKey = col.header.toLowerCase().replace(/[^a-z0-9]/g, '');
        let cellValue = '';
        if (row[normalizedKey] !== undefined && row[normalizedKey] !== null) {
          cellValue = String(row[normalizedKey]);
        }

        let textX: number;
        let textAlign: 'left' | 'center' | 'right';

        if (col.align === 'right') {
          textX = currentX + col.scaledWidth - 6;
          textAlign = 'right';
        } else if (col.align === 'center') {
          textX = currentX + col.scaledWidth / 2;
          textAlign = 'center';
        } else {
          textX = currentX + 3;
          textAlign = 'left';
        }

        const maxWidth = col.scaledWidth - 6;
        const lines = this.doc.splitTextToSize(cellValue, maxWidth);

        if (Array.isArray(lines)) {
          const totalTextHeight = lines.length * 3;
          const startY = this.currentY + (dynamicRowHeight - totalTextHeight) / 2 + 3;
          lines.forEach((line: string, lineIndex: number) => {
            this.doc.text(line, textX, startY + (lineIndex * 3), { align: textAlign });
          });
        } else {
          const singleLineY = this.currentY + dynamicRowHeight / 2 + 1;
          this.doc.text(lines, textX, singleLineY, { align: textAlign });
        }

        currentX += col.scaledWidth;
      });

      // Reset font
      this.doc.setFont('helvetica', 'normal');
      this.doc.setTextColor(0, 0, 0);
      this.doc.setFontSize(8);

      this.currentY += dynamicRowHeight;
    });

    // Final bottom border
    this.doc.setDrawColor(0, 0, 0);
    this.doc.setLineWidth(0.8);
    this.doc.line(this.margins.left, this.currentY, this.pageWidth - this.margins.right, this.currentY);

    // No page closing balance shown - only opening balance at the very top
    this.currentY += 5;
  }

  /**
   * Add a simple table with automatic page breaks (original method, kept for backward compatibility)
   */
  addTable(columns: TableColumn[], rows: TableRow[]) {
    try {
      const tableWidth = this.pageWidth - this.margins.left - this.margins.right;

      // Calculate column widths
      const totalWidth = columns.reduce((sum, col) => sum + col.width, 0);
      const scaledColumns = columns.map(col => ({
        ...col,
        scaledWidth: (col.width / totalWidth) * tableWidth
      }));

      const rowHeight = 7;  // Base row height - reduced from 10 to 7
      const headerHeight = 9; // Reduced from 12 to 9 for compact header display

      // Helper function to calculate required row height based on text content
      const calculateRowHeight = (row: TableRow, columns: typeof scaledColumns): number => {
        let maxLines = 1;

        columns.forEach(col => {
          const normalizedKey = col.header.toLowerCase().replace(/[^a-z0-9]/g, '');
          let cellValue = '';

          if (row[normalizedKey] !== undefined && row[normalizedKey] !== null) {
            cellValue = String(row[normalizedKey]);
          } else if (row[col.header] !== undefined && row[col.header] !== null) {
            cellValue = String(row[col.header]);
          }

          if (cellValue) {
            const maxWidth = col.scaledWidth - 6;
            const lines = this.doc.splitTextToSize(cellValue, maxWidth);
            const lineCount = Array.isArray(lines) ? lines.length : 1;
            maxLines = Math.max(maxLines, lineCount);
          }
        });

        return Math.max(rowHeight, maxLines * 4 + 1.5); // 4mm per line + 1.5mm padding
      };

      // Table header
      this.checkPageBreak(headerHeight + 15);

      // Draw header background
      this.doc.setFillColor(220, 220, 220);
      this.doc.rect(this.margins.left, this.currentY - 2, tableWidth, headerHeight, 'F');

      // Draw header borders
      this.doc.setDrawColor(0, 0, 0);
      this.doc.setLineWidth(0.8);

      // Header border
      this.doc.rect(this.margins.left, this.currentY - 2, tableWidth, headerHeight);

      // Header text
      this.doc.setFontSize(10);
      this.doc.setFont('helvetica', 'bold');

      let currentX = this.margins.left;
      scaledColumns.forEach((col, index) => {
        // Vertical lines for header
        if (index > 0) {
          this.doc.line(currentX, this.currentY - 2, currentX, this.currentY + headerHeight - 2);
        }

        // Header text - always center aligned for headers
        const textX = currentX + col.scaledWidth / 2;
        this.doc.text(col.header, textX, this.currentY + 4, { align: 'center' });
        currentX += col.scaledWidth;
      });

      this.currentY += headerHeight;

      // Table rows
      this.doc.setFont('helvetica', 'normal');
      this.doc.setFontSize(8);  // Reduced slightly to fit more text in cells
      this.doc.setLineWidth(0.3);

      rows.forEach((row, rowIndex) => {
        try {
          // Calculate dynamic row height based on text content
          const dynamicRowHeight = calculateRowHeight(row, scaledColumns);

          this.checkPageBreak(dynamicRowHeight + 2);

          // Alternate row background
          if (rowIndex % 2 === 0) {
            this.doc.setFillColor(248, 248, 248);
            this.doc.rect(this.margins.left, this.currentY, tableWidth, dynamicRowHeight, 'F');
          }

          // Row border
          this.doc.setDrawColor(180, 180, 180);
          this.doc.rect(this.margins.left, this.currentY, tableWidth, dynamicRowHeight);

          // Set font style based on row type (for transaction PDFs)
          const rowStyle = row._rowStyle;
          if (rowStyle === 'credit') {
            this.doc.setFont('helvetica', 'italic'); // Credit = Italic
          } else if (rowStyle === 'debit') {
            this.doc.setFont('helvetica', 'bold'); // Debit = Bold
            this.doc.setTextColor(0, 0, 0); // Darker black for debit rows
            this.doc.setFontSize(8.5); // Slightly larger for more prominence
          } else if (rowStyle === 'combined') {
            this.doc.setFont('helvetica', 'bolditalic'); // Credit+Anamath = Bold+Italic
          } else {
            this.doc.setFont('helvetica', 'normal'); // Default
          }

          currentX = this.margins.left;
          scaledColumns.forEach((col, colIndex) => {
            // Vertical lines for data rows
            if (colIndex > 0) {
              this.doc.line(currentX, this.currentY, currentX, this.currentY + dynamicRowHeight);
            }

            // Enhanced cell value resolution with multiple key attempts
            const normalizedKey = col.header.toLowerCase().replace(/[^a-z0-9]/g, '');
            let cellValue = '';

            // Try multiple key resolution strategies
            if (row[normalizedKey] !== undefined && row[normalizedKey] !== null) {
              cellValue = String(row[normalizedKey]);
            } else if (row[col.header] !== undefined && row[col.header] !== null) {
              cellValue = String(row[col.header]);
            } else if (row[col.header.trim()] !== undefined && row[col.header.trim()] !== null) {
              cellValue = String(row[col.header.trim()]);
            } else {
              // Scan row keys for normalized matches
              const rowKeys = Object.keys(row);
              const matchingKey = rowKeys.find(key =>
                key.toLowerCase().replace(/[^a-z0-9]/g, '') === normalizedKey
              );
              if (matchingKey && row[matchingKey] !== undefined && row[matchingKey] !== null) {
                cellValue = String(row[matchingKey]);
              } else {
                cellValue = '';
                if (rowIndex < 3) { // Only log first few rows to avoid spam
                }
              }
            }

            let textX: number;
            let textAlign: 'left' | 'center' | 'right';

            if (col.align === 'right') {
              textX = currentX + col.scaledWidth - 6;  // Increased right padding from 3 to 6
              textAlign = 'right';
            } else if (col.align === 'center') {
              textX = currentX + col.scaledWidth / 2;
              textAlign = 'center';
            } else {
              textX = currentX + 3;
              textAlign = 'left';
            }

            // Wrap text if too long
            const maxWidth = col.scaledWidth - 6;
            const lines = this.doc.splitTextToSize(cellValue, maxWidth);

            if (Array.isArray(lines)) {
              // Calculate vertical centering for multi-line text
              const totalTextHeight = lines.length * 3;
              const startY = this.currentY + (dynamicRowHeight - totalTextHeight) / 2 + 3;

              lines.forEach((line: string, lineIndex: number) => {
                this.doc.text(line, textX, startY + (lineIndex * 3), { align: textAlign });
              });
            } else {
              // Single line - center vertically in the row
              const singleLineY = this.currentY + dynamicRowHeight / 2 + 1;
              this.doc.text(lines, textX, singleLineY, { align: textAlign });
            }

            currentX += col.scaledWidth;
          });

          // Reset font and text properties to normal after row
          this.doc.setFont('helvetica', 'normal');
          this.doc.setTextColor(0, 0, 0); // Reset to black
          this.doc.setFontSize(8); // Reset to default size

          this.currentY += dynamicRowHeight;
        } catch (rowError) {
          console.error(`❌ PDFGenerator: Failed to process row ${rowIndex}:`, rowError);
          // Continue with next row instead of failing entire table
        }
      });

      // Final bottom border
      this.doc.setDrawColor(0, 0, 0);
      this.doc.setLineWidth(0.8);
      this.doc.line(this.margins.left, this.currentY, this.pageWidth - this.margins.right, this.currentY);

    } catch (error) {
      console.error(`❌ PDFGenerator: Table generation failed:`, error);
      // Add fallback empty table or rethrow based on requirements
      throw error;
    }
  }

  /**
   * Add summary section
   */
  addSummary(summaryData: { [key: string]: string | number }) {
    this.currentY += 15;
    this.checkPageBreak(50);

    // Summary title - center aligned
    this.doc.setFontSize(12);
    this.doc.setFont('helvetica', 'bold');
    const titleWidth = this.doc.getTextWidth('Summary');
    const titleX = (this.pageWidth - titleWidth) / 2;
    this.doc.text('Summary', titleX, this.currentY);
    this.currentY += 10;

    // Summary box (without border)
    const boxWidth = 120;
    const boxHeight = Object.keys(summaryData).length * 6 + 8;
    const boxX = (this.pageWidth - boxWidth) / 2;

    // Summary items (no border box)
    this.doc.setFontSize(10);
    this.doc.setFont('helvetica', 'normal');

    let itemY = this.currentY + 4;
    Object.entries(summaryData).forEach(([key, value]) => {
      const label = key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());

      // Label on the left
      this.doc.setFont('helvetica', 'normal');
      this.doc.text(`${label}:`, boxX + 4, itemY);

      // Value on the right (right-aligned)
      this.doc.setFont('helvetica', 'bold');
      const valueStr = String(value);
      const valueWidth = this.doc.getTextWidth(valueStr);
      this.doc.text(valueStr, boxX + boxWidth - 4 - valueWidth, itemY);

      itemY += 6;
    });

    this.currentY += boxHeight + 5;
  }

  /**
   * Add footer with page numbers
   */
  private addFooter() {
    const pageCount = this.doc.getNumberOfPages();

    for (let i = 1; i <= pageCount; i++) {
      this.doc.setPage(i);
      this.doc.setFontSize(8);
      this.doc.setFont('helvetica', 'normal');

      // Page number
      const pageText = `Page ${i} of ${pageCount}`;
      const textWidth = this.doc.getTextWidth(pageText);
      this.doc.text(pageText, this.pageWidth - this.margins.right - textWidth, this.pageHeight - 10);

      // Generated timestamp
      const timestamp = new Date().toLocaleString();
      this.doc.text(`Generated: ${timestamp}`, this.margins.left, this.pageHeight - 10);

      // "Made with ❤ by VAJJRA" branding
      this.doc.setFont('helvetica', 'italic');
      this.doc.setTextColor(120, 120, 120);
      this.doc.text('Made with \u2764 by VAJJRA', this.pageWidth / 2, this.pageHeight - 5, { align: 'center' });
      this.doc.setTextColor(0, 0, 0);
    }
  }

  /**
   * Generate and download the PDF
   */
  generate(config: PDFConfig, filename: string) {
    try {

      // Note: Header should already be added by calling code before generate()
      // Only add footer and save
      this.addFooter();

      // Save the PDF
      this.doc.save(filename);

      return true;
    } catch (error) {
      console.error(`❌ PDFGenerator: PDF generation failed for "${filename}":`, error);
      return false;
    }
  }

  /**
   * Get the current PDF instance for advanced operations
   */
  getDocument(): jsPDF {
    return this.doc;
  }

  /**
   * Add custom content
   */
  addContent(callback: (doc: jsPDF, currentY: number) => number) {
    this.currentY = callback(this.doc, this.currentY);
  }
}

export default PDFGenerator;