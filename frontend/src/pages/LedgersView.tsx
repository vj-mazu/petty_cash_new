import React, { useState, useEffect, useCallback } from 'react';
import { format } from 'date-fns';
import { FileText, FileDown, Building2, Filter, X } from 'lucide-react';
import { ledgerApi } from '../services/api';
import { formatIndianCurrency } from '../utils/indianNumberFormat';
import LoadingSpinner from '../components/LoadingSpinner';
import DateInput from '../components/DateInput';
import LedgerTransactionDetails from '../components/LedgerTransactionDetails';
import { toast } from 'react-toastify';

interface LedgerSummary {
  id: string;
  name: string;
  totalCredits: number;
  totalDebits: number;
  balance: number;
  transactionCount: number;
  lastTransactionDate?: string;
}

const LedgersView: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [ledgerSummaries, setLedgerSummaries] = useState<LedgerSummary[]>([]);
  const [filteredSummaries, setFilteredSummaries] = useState<LedgerSummary[]>([]);
  const [exportLoading, setExportLoading] = useState(false);

  // Modal states
  const [selectedLedger, setSelectedLedger] = useState<LedgerSummary | null>(null);
  const [showTransactionDetails, setShowTransactionDetails] = useState(false);

  // Filter states
  const [showFilters, setShowFilters] = useState(false);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [searchQuery, setSearchQuery] = useState('');

  const handleLedgerDoubleClick = (ledger: LedgerSummary) => {
    setSelectedLedger(ledger);
    setShowTransactionDetails(true);
  };

  const handleCloseModal = () => {
    setShowTransactionDetails(false);
    setSelectedLedger(null);
  };

  const fetchLedgerSummaries = useCallback(async () => {
    try {
      setLoading(true);
      const response = await ledgerApi.getLedgerSummaries({
        startDate: startDate || undefined,
        endDate: endDate || undefined
      });

      if (response.success) {
        const summaries = response.data || [];
        setLedgerSummaries(summaries);
        setFilteredSummaries(summaries);
      } else {
        toast.error(response.message || 'Failed to load ledger summaries');
      }
    } catch (error) {
      console.error('Failed to fetch ledger summaries:', error);
      toast.error('Failed to load ledger summaries');
    } finally {
      setLoading(false);
    }
  }, [startDate, endDate]);

  useEffect(() => {
    fetchLedgerSummaries();
  }, []); // Run only once on component mount

  // Apply search filter
  useEffect(() => {
    if (!searchQuery.trim()) {
      setFilteredSummaries(ledgerSummaries);
    } else {
      const filtered = ledgerSummaries.filter(ledger =>
        ledger.name.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredSummaries(filtered);
    }
  }, [searchQuery, ledgerSummaries]);

  const handleApplyFilters = () => {
    fetchLedgerSummaries();
  };

  const clearFilters = () => {
    setStartDate('');
    setEndDate('');
    setSearchQuery('');
    // Refetch data with cleared filters
    // Temporarily set dates to null to trigger refetch in useCallback
    fetchLedgerSummaries();
  };

  const exportToPDF = async () => {
    setExportLoading(true);
    try {
      const jsPDF = (await import('jspdf')).default;
      const autoTable = (await import('jspdf-autotable')).default;

      const doc = new jsPDF();
      const totalPagesExp = '{total_pages_count_string}'; // Placeholder for page number

      // --- 1. COMPACT HEADER ---
      doc.setFontSize(12);
      doc.setFont('helvetica', 'bold');
      doc.text('PETTY CASH', 105, 15, { align: 'center' });
      doc.setFontSize(9);
      doc.text('Ledgers Summary Report', 105, 20, { align: 'center' });

      const dateRange = startDate && endDate
        ? `Period: ${format(new Date(startDate), 'dd/MM/yyyy')} to ${format(new Date(endDate), 'dd/MM/yyyy')}`
        : `As of: ${format(new Date(), 'dd/MM/yyyy')}`;
      doc.setFontSize(7);
      doc.setFont('helvetica', 'normal');
      doc.text(dateRange, 105, 24, { align: 'center' });

      // Thin separator
      doc.setDrawColor(150, 150, 150);
      doc.setLineWidth(0.3);
      doc.line(15, 26, 195, 26);

      // --- 2. TABLE DATA ---
      const tableData = filteredSummaries.map(ledger => [
        ledger.name,
        ledger.totalCredits.toFixed(2),
        ledger.totalDebits.toFixed(2),
        ledger.balance.toFixed(2),
        ledger.transactionCount.toString(),
        ledger.lastTransactionDate ? format(new Date(ledger.lastTransactionDate), 'dd/MM/yyyy') : '-'
      ]);

      // --- 3. CALCULATE TOTALS ---
      const totalCredits = filteredSummaries.reduce((sum, l) => sum + l.totalCredits, 0);
      const totalDebits = filteredSummaries.reduce((sum, l) => sum + l.totalDebits, 0);
      const totalBalance = filteredSummaries.reduce((sum, l) => sum + l.balance, 0);

      // --- 4. AUTOTABLE ---
      autoTable(doc, {
        head: [['Ledger Name', 'Total Credits', 'Total Debits', 'Total', 'Transactions', 'Last Txn Date']],
        body: tableData,
        foot: [
          ['Total',
            totalCredits.toFixed(2),
            totalDebits.toFixed(2),
            totalBalance.toFixed(2),
            '', ''
          ]
        ],
        startY: 28,
        theme: 'grid', // 'striped' or 'grid'
        styles: {
          fontSize: 9,
          cellPadding: 3,
          overflow: 'linebreak'
        },
        headStyles: {
          fillColor: [41, 128, 185], // A more professional blue
          textColor: 255,
          fontStyle: 'bold',
          halign: 'center'
        },
        footStyles: {
          fillColor: [236, 240, 241],
          textColor: [44, 62, 80],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [245, 245, 245] // Zebra striping
        },
        columnStyles: {
          0: { cellWidth: 'auto' },
          1: { halign: 'right' }, // Credits
          2: { halign: 'right' }, // Debits
          3: { halign: 'right' }, // Balance
          4: { halign: 'center' }, // Transaction count
          5: { halign: 'center' }, // Last transaction date
        },
        // --- 5. PAGE FOOTER ---
        didDrawPage: (data) => {
          let str = 'Page ' + (doc as any).internal.getNumberOfPages();
          if (typeof (doc as any).putTotalPages === 'function') {
            str = str + ' of ' + totalPagesExp;
          }
          doc.setFontSize(10);
          doc.text(str, data.settings.margin.left, doc.internal.pageSize.height - 10);

          const generationDate = `Generated on: ${format(new Date(), 'dd/MM/yyyy HH:mm')}`;
          doc.text(generationDate, doc.internal.pageSize.width - data.settings.margin.right, doc.internal.pageSize.height - 10, { align: 'right' });
        }
      });

      // For page numbers - replace placeholder
      if (typeof (doc as any).putTotalPages === 'function') {
        (doc as any).putTotalPages(totalPagesExp);
      }

      // Add "Made with ❤ by VAJJRA" footer
      const ledgerPageCount = doc.getNumberOfPages();
      for (let i = 1; i <= ledgerPageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setFont('helvetica', 'italic');
        doc.setTextColor(120, 120, 120);
        doc.text('Made with \u2764 by VAJJRA', doc.internal.pageSize.width / 2, doc.internal.pageSize.height - 5, { align: 'center' });
      }

      doc.save(`Kushi_Agro_Ledger_Summary_${format(new Date(), 'yyyy-MM-dd')}.pdf`);
      toast.success('PDF exported successfully!');
    } catch (error) {
      console.error('PDF export failed:', error);
      toast.error('Failed to export PDF');
    } finally {
      setExportLoading(false);
    }
  };

  const exportToCSV = async () => {
    setExportLoading(true);
    try {
      const XLSX = await import('xlsx-js-style');

      // --- 1. METADATA & HEADERS ---
      const companyName = 'Kushi Agro Industries';
      const reportTitle = 'Ledgers Summary Report';
      const dateRange = startDate && endDate
        ? `Date: From ${format(new Date(startDate), 'dd/MM/yyyy')} to ${format(new Date(endDate), 'dd/MM/yyyy')}`
        : `As of: ${format(new Date(), 'dd/MM/yyyy')}`;
      const header = ['Ledger Name', 'Total Credits', 'Total Debits', 'Total', 'Transactions', 'Last Transaction Date'];

      // --- 2. DATA ROWS ---
      const mainData = filteredSummaries.map(ledger => [
        ledger.name,
        ledger.totalCredits,
        ledger.totalDebits,
        ledger.balance,
        ledger.transactionCount,
        ledger.lastTransactionDate ? format(new Date(ledger.lastTransactionDate), 'dd/MM/yyyy') : '-'
      ]);

      // --- 3. TOTALS ROW ---
      const totalCredits = filteredSummaries.reduce((sum, l) => sum + l.totalCredits, 0);
      const totalDebits = filteredSummaries.reduce((sum, l) => sum + l.totalDebits, 0);
      const totalBalance = filteredSummaries.reduce((sum, l) => sum + l.balance, 0);
      const totalsRow = ['Total', totalCredits, totalDebits, totalBalance, '', ''];

      // --- 4. COMBINE ALL DATA FOR THE SHEET ---
      const sheetData = [
        [companyName],
        [reportTitle],
        [dateRange],
        [], // Spacer row
        header,
        ...mainData,
        [], // Spacer row
        totalsRow
      ];

      // --- 5. CREATE WORKSHEET FROM ARRAY OF ARRAYS ---
      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // --- 6. STYLING & CONFIGURATION ---
      const centerBoldStyle = { font: { bold: true, sz: 16 }, alignment: { horizontal: 'center' } };
      const centerBoldStyle2 = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } };
      const centerStyle = { alignment: { horizontal: 'center' } };
      const headerStyle = { font: { bold: true }, fill: { fgColor: { rgb: "FFD3D3D3" } } };
      const currencyStyle = { numFmt: '#,##0.00' };
      const boldCurrencyStyle = { font: { bold: true }, numFmt: '#,##0.00' };
      const boldStyle = { font: { bold: true } };

      if (ws['A1']) ws['A1'].s = centerBoldStyle;
      if (ws['A2']) ws['A2'].s = centerBoldStyle2;
      if (ws['A3']) ws['A3'].s = centerStyle;

      header.forEach((_, colIndex) => {
        const cellRef = XLSX.utils.encode_cell({ r: 4, c: colIndex });
        if (ws[cellRef]) ws[cellRef].s = headerStyle;
      });

      mainData.forEach((_, rowIndex) => {
        const row = 5 + rowIndex;
        [1, 2, 3].forEach(colIndex => { // Columns B, C, D
          const cellRef = XLSX.utils.encode_cell({ r: row, c: colIndex });
          if (ws[cellRef]) ws[cellRef].s = currencyStyle;
        });
      });

      const totalRowIndex = 5 + mainData.length + 2;
      const totalCellRefA = `A${totalRowIndex}`;
      const totalCellRefB = `B${totalRowIndex}`;
      const totalCellRefC = `C${totalRowIndex}`;
      const totalCellRefD = `D${totalRowIndex}`;
      if (ws[totalCellRefA]) ws[totalCellRefA].s = boldStyle;
      if (ws[totalCellRefB]) ws[totalCellRefB].s = boldCurrencyStyle;
      if (ws[totalCellRefC]) ws[totalCellRefC].s = boldCurrencyStyle;
      if (ws[totalCellRefD]) ws[totalCellRefD].s = boldCurrencyStyle;

      ws['!merges'] = [
        { s: { r: 0, c: 0 }, e: { r: 0, c: 5 } },
        { s: { r: 1, c: 0 }, e: { r: 1, c: 5 } },
        { s: { r: 2, c: 0 }, e: { r: 2, c: 5 } }
      ];

      ws['!cols'] = [{ wch: 35 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 15 }, { wch: 20 }];

      // --- 7. EXPORT ---
      const wb = XLSX.utils.book_new();

      // Add "Made with ❤ by VAJJRA" footer
      const ledgerRange = XLSX.utils.decode_range(ws['!ref'] || 'A1');
      const footerRowIdx = ledgerRange.e.r + 2;
      const footerCell = XLSX.utils.encode_cell({ r: footerRowIdx, c: 0 });
      ws[footerCell] = { v: 'Made with \u2764 by VAJJRA', t: 's', s: { font: { bold: true, sz: 10 }, alignment: { horizontal: 'center' } } };
      ws['!ref'] = XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: footerRowIdx, c: ledgerRange.e.c } });

      XLSX.utils.book_append_sheet(wb, ws, 'Ledgers Summary');
      XLSX.writeFile(wb, `Kushi_Agro_Ledger_Summary_${format(new Date(), 'yyyy-MM-dd')}.xlsx`);

      toast.success('Excel file exported successfully!');
    } catch (error) {
      console.error('Excel export failed:', error);
      toast.error('Failed to export Excel file');
    } finally {
      setExportLoading(false);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading ledger summaries..." />;
  }

  return (
    <div className="space-y-3">
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-950 text-white p-4 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <Building2 className="w-5 h-5 mr-2" />
            <h1 className="text-xl font-bold">Ledgers Summary</h1>
            <span className="ml-3 text-xs text-blue-200">{filteredSummaries.length} ledgers</span>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center px-2 py-1 rounded text-xs font-medium transition-colors ${showFilters
                ? 'bg-white text-blue-600'
                : 'bg-blue-500 text-white hover:bg-blue-400'
                }`}
            >
              <Filter className="w-3 h-3 mr-1" />
              Filters
            </button>
            <button
              onClick={exportToPDF}
              disabled={exportLoading}
              className="flex items-center px-2 py-1 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700 disabled:opacity-50"
            >
              <FileText className="w-3 h-3 mr-1" />
              PDF
            </button>
            <button
              onClick={exportToCSV}
              disabled={exportLoading}
              className="flex items-center px-2 py-1 bg-green-600 text-white rounded text-xs font-medium hover:bg-green-700 disabled:opacity-50"
            >
              <FileDown className="w-3 h-3 mr-1" />
              Excel
            </button>
          </div>
        </div>
      </div>

      {/* Inline Search */}
      <div className="flex items-center gap-3">
        <div className="flex-1 relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search ledgers..."
            className="w-full px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-800 dark:text-gray-200 dark:placeholder-gray-400"
          />
        </div>
        {searchQuery && (
          <button onClick={() => setSearchQuery('')} className="px-2 py-1.5 text-gray-500 dark:text-gray-400 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 text-xs">
            <X className="w-3 h-3" />
          </button>
        )}
      </div>

      {/* Date Filters */}
      {showFilters && (
        <div className="flex items-end gap-3 bg-white dark:bg-gray-800 p-3 rounded-xl border border-gray-200 dark:border-gray-700">
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">From</label>
            <DateInput value={startDate} onChange={(val) => setStartDate(val)}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-gray-200" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 dark:text-gray-400 mb-0.5">To</label>
            <DateInput value={endDate} onChange={(val) => setEndDate(val)}
              className="px-2 py-1 border border-gray-300 dark:border-gray-600 rounded text-sm dark:bg-gray-700 dark:text-gray-200" />
          </div>
          <button onClick={handleApplyFilters}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs font-medium hover:bg-blue-700">Apply</button>
          <button onClick={clearFilters}
            className="px-3 py-1 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded text-xs hover:bg-gray-50 dark:hover:bg-gray-700">Clear</button>
        </div>
      )}

      <div className="overflow-x-auto shadow-xl rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-200 dark:bg-gray-700">
              <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center w-10 bg-gray-100 dark:bg-gray-700 font-bold text-xs dark:text-gray-200">SL</th>
              <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-blue-100 dark:bg-blue-900/30 font-bold text-xs dark:text-blue-300">LEDGER NAME</th>
              <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-green-100 dark:bg-green-900/30 font-bold text-xs dark:text-green-300">TOTAL CREDITS</th>
              <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-red-100 dark:bg-red-900/30 font-bold text-xs dark:text-red-300">TOTAL DEBITS</th>
              <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-yellow-100 dark:bg-yellow-900/30 font-bold text-xs dark:text-yellow-300">TOTAL</th>
              <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center w-20 bg-indigo-100 dark:bg-indigo-900/30 font-bold text-xs dark:text-indigo-300">TXN COUNT</th>
              <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center w-24 bg-orange-100 dark:bg-orange-900/30 font-bold text-xs dark:text-orange-300">LAST TXN</th>
            </tr>
          </thead>
          <tbody>
            {filteredSummaries.length > 0 ? (
              filteredSummaries.map((ledger, index) => (
                <tr
                  key={ledger.id}
                  className={`hover:bg-blue-50 dark:hover:bg-blue-900/20 cursor-pointer ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/60'}`}
                  onDoubleClick={() => handleLedgerDoubleClick(ledger)}
                  title="Double-click to view transaction details"
                >
                  <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs dark:text-gray-300">{index + 1}</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs font-medium dark:text-gray-200">{ledger.name}</td>
                  <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs font-medium text-green-700 dark:text-green-400">
                    {formatIndianCurrency(ledger.totalCredits)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs font-medium text-red-700 dark:text-red-400">
                    {formatIndianCurrency(ledger.totalDebits)}
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs font-medium">
                    <span className={ledger.balance >= 0 ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                      {formatIndianCurrency(ledger.balance)}
                    </span>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs">
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300">
                      {ledger.transactionCount}
                    </span>
                  </td>
                  <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs dark:text-gray-300">
                    {ledger.lastTransactionDate
                      ? format(new Date(ledger.lastTransactionDate), 'dd/MM/yyyy')
                      : '-'
                    }
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="border border-gray-300 dark:border-gray-600 px-4 py-8 text-center text-gray-500 dark:text-gray-400 text-sm">
                  No ledgers found matching your criteria
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Ledger Transaction Details Modal */}
      {selectedLedger && (
        <LedgerTransactionDetails
          isOpen={showTransactionDetails}
          onClose={handleCloseModal}
          ledgerId={selectedLedger.id}
          ledgerName={selectedLedger.name}
        />
      )}
    </div>
  );
};

export default LedgersView;
