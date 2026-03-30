import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Archive, RefreshCw } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import { ledgerApi, anamathApi, Ledger, AnamathEntry } from '../services/api';

import { exportClosedRecordsToXlsx } from '../utils/export';
import { generateClosedAnamathPDF, type AnamathEntry as AnamathPDFEntry } from '../utils/anamathPDFGenerator';
import { toTitleCase } from '../utils/textUtils';

import { formatIndianCurrency } from '../utils/indianNumberFormat';

const ClosedAnamathRecords: React.FC = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState<boolean>(true);
  const [closedRecords, setClosedRecords] = useState<AnamathEntry[]>([]);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [loadingLedgers, setLoadingLedgers] = useState<boolean>(true);

  // Fetch ledgers
  const fetchLedgers = useCallback(async () => {
    try {
      setLoadingLedgers(true);
      const response = await ledgerApi.getAll({ limit: 100 });
      if (response.success) {
        setLedgers(response.data.ledgers);
      }
    } catch (error) {
      console.error('Failed to fetch ledgers:', error);
      toast.error('Failed to load ledgers');
    } finally {
      setLoadingLedgers(false);
    }
  }, []);

  // Fetch Closed Anamath records
  const fetchClosedRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: 20
      };

      const response = await anamathApi.getClosed(params);

      if (response.success) {
        const recordsData = response.data.anamathEntries || [];

        setClosedRecords(recordsData);
        if (response.data.pagination) {
          setTotalPages(response.data.pagination.pages || 1);
        } else {
          setTotalPages(1);
        }
      } else {
        console.error('Failed to load closed Anamath records');
        setClosedRecords([]);
        setTotalPages(1);
        toast.error('Failed to load closed Anamath records');
      }
    } catch (error) {
      console.error('Error fetching closed Anamath records:', error);
      toast.error('Failed to load closed Anamath records. Please try again.');
      setClosedRecords([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage]);

  useEffect(() => {
    fetchLedgers();
  }, [fetchLedgers]);

  useEffect(() => {
    fetchClosedRecords();
  }, [fetchClosedRecords, currentPage]);

  const handleExport = async (type: 'pdf' | 'csv') => {
    if (type === 'pdf') {

      // Check if there are any closed records
      if (closedRecords.length === 0) {
        toast.error('No closed anamath records found to export');
        return;
      }

      try {
        // Convert closed records to PDF format
        const pdfEntries: AnamathPDFEntry[] = closedRecords.map(record => ({
          id: record.id,
          date: record.date,
          amount: record.amount,
          remarks: record.remarks,
          ledger: record.ledger,
          referenceNumber: record.referenceNumber,
          createdBy: typeof record.createdBy === 'string'
            ? { username: record.createdBy }
            : record.createdBy,
          transactionNumber: record.transactionNumber,
          displayTransactionNumber: record.displayTransactionNumber,
          closedAt: record.closedAt,
          isClosed: true
        }));

        // Calculate date range
        const dateRange = closedRecords.length > 0 ? {
          start: format(parseISO(closedRecords[closedRecords.length - 1].date), 'dd/MM/yyyy'),
          end: format(parseISO(closedRecords[0].date), 'dd/MM/yyyy')
        } : undefined;


        const success = await generateClosedAnamathPDF(pdfEntries, {
          companyName: 'MRN INDUSTRIES',
          dateRange,
          includeCreatedBy: true,
          includeReference: true
        });

        if (success) {
          toast.success('Closed Anamath records PDF exported successfully!');
        } else {
          console.error('❌ ClosedAnamathRecords.tsx: PDF generation returned false');
          toast.error('Failed to generate PDF');
        }
      } catch (error) {
        console.error('❌ ClosedAnamathRecords.tsx: PDF export error:', error);
        toast.error('Failed to export PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } else {
      // CSV/Excel export - create simple object array for XLSX
      const csvData = closedRecords.map((record, index) => ({
        'S.No': index + 1,
        'Entry Date': format(parseISO(record.date), 'dd/MM/yyyy'),
        'Closed Date': record.closedAt ? format(parseISO(record.closedAt), 'dd/MM/yyyy') : format(parseISO(record.date), 'dd/MM/yyyy'),
        'Anamath ID': record.referenceNumber || '-',
        'Ledger Name': toTitleCase(record.ledger?.name || 'General Entry'),
        'Amount': formatIndianCurrency(record.amount), // Use formatIndianCurrency for proper Indian format
        'Remarks': toTitleCase(record.remarks || '-')
      }));

      try {
        // Use the new export function for closed records
        await exportClosedRecordsToXlsx(csvData, 'Closed_Anamath_Records');
        toast.success('Excel file exported successfully!');
      } catch (error) {
        console.error('Excel export failed:', error);
        toast.error('Failed to export Excel file');
      }
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading closed Anamath records..." />;
  }

  return (
    <div className="space-y-3">
      {/* Header - matching Anamath page style */}
      <div className="bg-gradient-to-r from-purple-600 to-purple-800 dark:from-purple-800 dark:to-purple-950 text-white p-4 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <button
              onClick={() => navigate('/anamath')}
              className="mr-3 p-1.5 rounded-full hover:bg-white/20 transition-colors"
            >
              <ArrowLeft className="w-4 h-4" />
            </button>
            <h1 className="text-xl font-bold">Closed Anamath Records</h1>
            {closedRecords.length > 0 && (
              <span className="ml-3 px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                Total: {formatIndianCurrency(closedRecords.reduce((sum, record) => sum + (parseFloat(record.amount?.toString() || '0') || 0), 0))}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => handleExport('pdf')}
              className="flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
            >
              <Archive className="w-3 h-3 mr-1" />
              PDF
            </button>
            <button
              onClick={() => handleExport('csv')}
              className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
            >
              <Archive className="w-3 h-3 mr-1" />
              Excel
            </button>
            <button
              onClick={fetchClosedRecords}
              className="flex items-center px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
            >
              <RefreshCw className="w-3 h-3 mr-1" />
              Refresh
            </button>
          </div>
        </div>
      </div>

      {/* Closed Records Table - Excel Style matching Anamath page */}
      <div className="overflow-x-auto shadow-xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-10 bg-gray-100 dark:bg-gray-700 font-bold text-xs text-gray-700 dark:text-gray-300">SL</th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-24 bg-blue-50 dark:bg-blue-900/30 font-bold text-xs text-blue-800 dark:text-blue-300">ENTRY DATE</th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-24 bg-purple-50 dark:bg-purple-900/30 font-bold text-xs text-purple-800 dark:text-purple-300">CLOSED DATE</th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-16 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-xs text-indigo-800 dark:text-indigo-300">ID</th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left bg-yellow-50 dark:bg-yellow-900/20 font-bold text-xs text-yellow-800 dark:text-yellow-300">LEDGER</th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left bg-green-50 dark:bg-green-900/30 font-bold text-xs text-green-800 dark:text-green-300">AMOUNT</th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left bg-blue-50/50 dark:bg-blue-900/15 font-bold text-xs text-gray-700 dark:text-gray-300">REMARKS</th>
            </tr>
          </thead>
          <tbody>
            {closedRecords.length > 0 ? (
              closedRecords.map((record, index) => {
                const ledger = record.ledger || (record.ledgerId ? ledgers.find(l => l.id === record.ledgerId) : null);
                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-gray-100 dark:hover:bg-gray-600/50 ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/60'}`}
                  >
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center text-xs dark:text-gray-300">{index + 1}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center text-xs dark:text-gray-300">
                      {format(parseISO(record.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center text-xs dark:text-gray-300">
                      <div>
                        <span className="font-medium">
                          {record.closedAt ? format(parseISO(record.closedAt), 'dd/MM/yyyy') : '—'}
                        </span>
                        {record.closedAt && (
                          <span className="text-gray-400 dark:text-gray-500 text-[10px] ml-1">
                            {format(parseISO(record.closedAt), 'HH:mm')}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center text-xs font-mono font-medium dark:text-gray-200">
                      {record.transactionNumber ? `A${String(record.transactionNumber).padStart(3, '0')}` : (record.referenceNumber || '—')}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-left text-xs dark:text-gray-300">
                      {toTitleCase(ledger?.name || 'General Entry')}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-left text-xs font-medium text-amber-700 dark:text-amber-400">
                      {formatIndianCurrency(record.amount)}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-left text-xs min-w-[80px] dark:text-gray-300">
                      {toTitleCase(record.remarks || '-')}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={7} className="border border-gray-300 dark:border-gray-600 px-4 py-8 text-center">
                  <div className="text-gray-400 dark:text-gray-500">
                    <Archive className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">No closed records</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      Closed anamath records will appear here.
                    </p>
                  </div>
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination View */}
      {totalPages > 1 && (
        <div className="flex justify-center items-center space-x-2 mt-4">
          <button
            onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 font-medium transition-colors"
          >
            Previous
          </button>
          <span className="text-sm text-gray-600 dark:text-gray-400 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-4 py-2 text-sm bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg disabled:opacity-50 hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 font-medium transition-colors"
          >
            Next
          </button>
        </div>
      )}

      {/* Bottom summary removed - Total amount now shown only in blue box at top */}
    </div>
  );
};

export default ClosedAnamathRecords;