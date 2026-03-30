import * as XLSX from 'xlsx-js-style';
import { format } from 'date-fns';

export interface TransactionData {
  date: string;
  type: 'credit' | 'debit';
  amount: number;
  ledger: string;
  description: string;
  reference?: string;
}

const formatIndianCurrency = (num: number): string => {
  return `₹${num.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  })}`;
};

export const exportToFormattedExcel = (
  transactions: TransactionData[],
  reportDate: Date = new Date(),
  openingBalance: number = 0
) => {
  // Create a new workbook
  const wb = XLSX.utils.book_new();
  
  // Create a worksheet
  const ws = XLSX.utils.aoa_to_sheet([]);

  // Helper function to create a styled cell
  const createCell = (value: any, style: any = {}) => {
    return { v: value, s: style };
  };

  // Common styles
  const headerStyle = {
    font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: '000080' } },
    alignment: { horizontal: 'center', vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: '000000' } },
      bottom: { style: 'thin', color: { rgb: '000000' } },
      left: { style: 'thin', color: { rgb: '000000' } },
      right: { style: 'thin', color: { rgb: '000000' } }
    }
  };

  const dataStyle = {
    font: { name: 'Calibri', sz: 11 },
    alignment: { vertical: 'center' },
    border: {
      top: { style: 'thin', color: { rgb: 'D3D3D3' } },
      bottom: { style: 'thin', color: { rgb: 'D3D3D3' } },
      left: { style: 'thin', color: { rgb: 'D3D3D3' } },
      right: { style: 'thin', color: { rgb: 'D3D3D3' } }
    }
  };

  // Prepare data rows
  const worksheetData: any[][] = [];
  
  // Add report date at the top with colored background
  worksheetData.push([
    createCell(format(reportDate, 'MMM dd yyyy').toUpperCase(), {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '3498DB' } }, // Blue background
      alignment: { horizontal: 'center', vertical: 'center' }
    })
  ]);
  worksheetData.push([]); // Empty row
  
  // Add opening balance with colored background
  worksheetData.push([
    createCell('Opening Balance:', {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '2ECC71' } }, // Green background
      alignment: { horizontal: 'center', vertical: 'center' }
    }),
    createCell(formatIndianCurrency(openingBalance), {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '2ECC71' } }, // Green background
      alignment: { horizontal: 'center', vertical: 'center' }
    })
  ]);
  worksheetData.push([]); // Empty row
  
  // Add headers with enhanced styling and colors
  worksheetData.push([
    createCell('SL NO', { 
      ...headerStyle, 
      fill: { fgColor: { rgb: '34495E' } }, // Dark blue-gray
      font: { ...headerStyle.font, color: { rgb: 'FFFFFF' } } // White text
    }),
    createCell('DATE', { 
      ...headerStyle, 
      fill: { fgColor: { rgb: '34495E' } }, // Dark blue-gray
      font: { ...headerStyle.font, color: { rgb: 'FFFFFF' } } // White text
    }),
    createCell('CREDIT', { 
      ...headerStyle, 
      fill: { fgColor: { rgb: '27AE60' } }, // Green
      font: { ...headerStyle.font, color: { rgb: 'FFFFFF' } } // White text
    }),
    createCell('CREDIT DESCRIPTION', { 
      ...headerStyle, 
      fill: { fgColor: { rgb: '27AE60' } }, // Green
      font: { ...headerStyle.font, color: { rgb: 'FFFFFF' } } // White text
    }),
    createCell('DEBIT', { 
      ...headerStyle, 
      fill: { fgColor: { rgb: 'E74C3C' } }, // Red
      font: { ...headerStyle.font, color: { rgb: 'FFFFFF' } } // White text
    }),
    createCell('DEBIT DESCRIPTION', { 
      ...headerStyle, 
      fill: { fgColor: { rgb: 'E74C3C' } }, // Red
      font: { ...headerStyle.font, color: { rgb: 'FFFFFF' } } // White text
    })
  ]);
  
  // Process transactions into credits and debits
  const credits = transactions.filter(txn => txn.type === 'credit');
  const debits = transactions.filter(txn => txn.type === 'debit');
  const maxRows = Math.max(credits.length, debits.length);
  
  // Add transaction rows with styling
  for (let i = 0; i < maxRows; i++) {
    const credit = credits[i];
    const debit = debits[i];
    
    worksheetData.push([
      createCell(i + 1, { 
        ...dataStyle, 
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'ECF0F1' } } // Light gray background for SL NO
      }), // SL NO
      createCell(credit ? format(new Date(credit.date), 'dd-MM-yyyy') : '', { 
        ...dataStyle, 
        alignment: { horizontal: 'center', vertical: 'center' } 
      }), // DATE
      credit ? createCell(formatIndianCurrency(credit.amount), { 
        ...dataStyle, 
        font: { ...dataStyle.font, bold: true, color: { rgb: '27AE60' } }, // Green
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'E8F5E8' } } // Light green background
      }) : createCell('', dataStyle), // CREDIT
      createCell(credit ? credit.description : '', { 
        ...dataStyle, 
        alignment: { horizontal: 'center', vertical: 'center' } 
      }), // CREDIT DESCRIPTION - centered
      debit ? createCell(formatIndianCurrency(debit.amount), { 
        ...dataStyle, 
        font: { ...dataStyle.font, bold: true, color: { rgb: 'E74C3C' } }, // Red
        alignment: { horizontal: 'center', vertical: 'center' },
        fill: { fgColor: { rgb: 'FDEBEB' } } // Light red background
      }) : createCell('', dataStyle), // DEBIT
      createCell(debit ? debit.description : '', { 
        ...dataStyle, 
        alignment: { horizontal: 'center', vertical: 'center' } 
      }) // DEBIT DESCRIPTION - centered
    ]);
  }
  
  // Calculate totals
  const creditTotal = credits.reduce((sum, txn) => sum + txn.amount, 0);
  const debitTotal = debits.reduce((sum, txn) => sum + txn.amount, 0);
  const netTotal = creditTotal - debitTotal;
  const closingBalance = openingBalance + netTotal;
  
  // Add empty row before totals
  worksheetData.push([]);
  
  // Add daily totals with styling
  worksheetData.push([
    createCell('DAILY TOTALS:', {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '111827' } },
      alignment: { horizontal: 'right' }
    }),
    createCell('', { fill: { fgColor: { rgb: '111827' } } }),
    createCell(formatIndianCurrency(creditTotal), {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '16A34A' } },
      alignment: { horizontal: 'right' }
    }),
    createCell('', { fill: { fgColor: { rgb: '111827' } } }),
    createCell(formatIndianCurrency(debitTotal), {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: 'DC2626' } },
      alignment: { horizontal: 'right' }
    }),
    createCell(`TOTAL: ${formatIndianCurrency(netTotal)}`, {
      font: { name: 'Calibri', sz: 11, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '2563EB' } },
      alignment: { horizontal: 'right' }
    })
  ]);
  
  worksheetData.push([]);
  worksheetData.push([
    createCell('Closing Balance:', {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '9B59B6' } }, // Purple background
      alignment: { horizontal: 'center', vertical: 'center' }
    }),
    createCell(formatIndianCurrency(closingBalance), {
      font: { name: 'Calibri', sz: 12, bold: true, color: { rgb: 'FFFFFF' } },
      fill: { fgColor: { rgb: '9B59B6' } }, // Purple background
      alignment: { horizontal: 'center', vertical: 'center' }
    })
  ]);

  // Add data to worksheet
  XLSX.utils.sheet_add_aoa(ws, worksheetData);

  // Set column widths
  const colWidths = [
    { wch: 8 },  // SL NO
    { wch: 15 }, // DATE
    { wch: 20 }, // CREDIT
    { wch: 35 }, // CREDIT DESCRIPTION
    { wch: 20 }, // DEBIT
    { wch: 35 }  // DEBIT DESCRIPTION
  ];
  ws['!cols'] = colWidths;

  // Add "Made with ❤ by VAJJRA" footer
  const excelRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  const footerRowIdx = excelRange.e.r + 2;
  const footerCell = XLSX.utils.encode_cell({ r: footerRowIdx, c: 0 });
  ws[footerCell] = { v: 'Made with \u2764 by VAJJRA', t: 's', s: { font: { bold: true, sz: 10 }, alignment: { horizontal: 'center' } } };
  ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: footerRowIdx, c: excelRange.e.c } });

  // Add worksheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, 'Transactions');

  // Generate file name
  const formattedDate = format(reportDate, 'ddMMyyyy');
  const fileName = `Transactions_${formattedDate}.xlsx`;

  // Save the file
  XLSX.writeFile(wb, fileName);

  return true;
};
