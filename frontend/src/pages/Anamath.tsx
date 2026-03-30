import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Download, Plus, BookOpen, Trash2, Archive, Edit, Check, X, Search, Filter, RefreshCw, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import { ledgerApi, anamathApi, Ledger, AnamathEntry } from '../services/api';
import DateInput from '../components/DateInput';
import { useAuth } from '../contexts/AuthContext';
import ConfirmModal from '../components/ConfirmModal';
import { exportToXlsx } from '../utils/export';
import { generateAnamathPDF, type AnamathEntry as AnamathPDFEntry } from '../utils/anamathPDFGenerator';
import { toTitleCase } from '../utils/textUtils';
import { formatIndianCurrency } from '../utils/indianNumberFormat';

const Anamath: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [loading, setLoading] = useState<boolean>(true);
  const [records, setRecords] = useState<AnamathEntry[]>([]);
  const [filteredRecords, setFilteredRecords] = useState<AnamathEntry[]>([]);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [recordToDelete, setRecordToDelete] = useState<string | null>(null);
  const [isCloseModalOpen, setIsCloseModalOpen] = useState<boolean>(false);
  const [recordToClose, setRecordToClose] = useState<string | null>(null);

  // Search and filter states
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [debouncedSearch, setDebouncedSearch] = useState<string>('');
  const [selectedLedger, setSelectedLedger] = useState<string>('');
  const [dateFilter, setDateFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [isApproving, setIsApproving] = useState<string | null>(null);

  // Debounce search input (300ms)
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1); // Reset to page 1 on search change
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Reset page when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [selectedLedger, dateFilter]);

  // Sorting state
  const [sortField, setSortField] = useState<string>('date');
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('desc');

  // Role-based permissions
  const isAdmin = user?.role && ['admin', 'owner', 'manager'].includes(user.role);
  const canDelete = user?.role && ['admin', 'owner'].includes(user.role);
  const canApproveAnamathEntry = user?.role && ['admin', 'owner'].includes(user.role);

  // Fetch ledgers
  const fetchLedgers = useCallback(async () => {
    try {
      const response = await ledgerApi.getAll({ limit: 100 });
      if (response.success) {
        setLedgers(response.data.ledgers);
      }
    } catch (error) {
      console.error('Failed to fetch ledgers:', error);
      toast.error('Failed to load ledgers');
    }
  }, []);

  // Fetch Anamath records (exclude closed records)
  const fetchRecords = useCallback(async () => {
    try {
      setLoading(true);
      const params: any = {
        page: currentPage,
        limit: 20
      };

      // Send filters to server for proper server-side pagination
      if (debouncedSearch.trim()) {
        params.search = debouncedSearch.trim();
      }
      if (selectedLedger) {
        params.ledgerId = selectedLedger;
      }
      if (dateFilter) {
        params.startDate = dateFilter;
        params.endDate = dateFilter;
      }

      const response = await anamathApi.getAll(params);

      if (response.success) {
        const recordsData = response.data.anamathEntries || [];

        // Filter out closed records - only show open records
        const openRecords = recordsData.filter(record => !record.isClosed);
        setRecords(openRecords);
        setFilteredRecords(openRecords); // Initialize filtered records

        if (response.data.pagination) {
          setTotalPages((response.data.pagination as any).totalPages || response.data.pagination.pages || 1);
        } else {
          setTotalPages(1);
        }
      } else {
        setRecords([]);
        setFilteredRecords([]);
        toast.error('Failed to load Anamath records');
      }
    } catch (error) {
      console.error('Error fetching Anamath records:', error);
      toast.error('Failed to load Anamath records. Please try again.');
      setRecords([]);
      setFilteredRecords([]);
    } finally {
      setLoading(false);
    }
  }, [currentPage, debouncedSearch, selectedLedger, dateFilter]);

  // Filter records based on search criteria
  const filterRecords = useCallback(() => {
    let filtered = [...records];

    // Search term filter (search in remarks, ledger name, amount, and Anamath ID)
    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(record => {
        // Generate Anamath ID for search
        const anamathId = record.transactionNumber ? `A${String(record.transactionNumber).padStart(3, '0')}` : '';

        return (
          // Search in remarks
          (record.remarks && record.remarks.toLowerCase().includes(term)) ||
          // Search in ledger name
          (record.ledger?.name && record.ledger.name.toLowerCase().includes(term)) ||
          // Search in amount
          (record.amount && record.amount.toString().includes(term)) ||
          // Search in Anamath ID (A001, A002, etc.)
          (anamathId && anamathId.toLowerCase().includes(term)) ||
          // Search in transaction number (1, 2, 3, etc.)
          (record.transactionNumber && record.transactionNumber.toString().includes(term))
        );
      });
    }

    // Ledger filter
    if (selectedLedger) {
      filtered = filtered.filter(record => record.ledgerId === selectedLedger);
    }

    // Date filter
    if (dateFilter) {
      filtered = filtered.filter(record => {
        const recordDate = format(parseISO(record.date), 'yyyy-MM-dd');
        return recordDate === dateFilter;
      });
    }

    setFilteredRecords(filtered);
  }, [records, searchTerm, selectedLedger, dateFilter]);

  // Sort records
  const sortedRecords = [...filteredRecords].sort((a, b) => {
    let cmp = 0;
    switch (sortField) {
      case 'date':
        cmp = new Date(a.date).getTime() - new Date(b.date).getTime();
        break;
      case 'id':
        cmp = (a.transactionNumber || 0) - (b.transactionNumber || 0);
        break;
      case 'ledger':
        cmp = (a.ledger?.name || '').localeCompare(b.ledger?.name || '');
        break;
      case 'amount':
        cmp = Number(a.amount || 0) - Number(b.amount || 0);
        break;
      case 'status':
        cmp = (a.status || 'approved').localeCompare(b.status || 'approved');
        break;
      default:
        cmp = 0;
    }
    return sortDirection === 'asc' ? cmp : -cmp;
  });

  const toggleSort = (field: string) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const SortIcon: React.FC<{ field: string }> = ({ field }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />;
    return sortDirection === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1 text-blue-600" />
      : <ArrowDown className="w-3 h-3 ml-1 text-blue-600" />;
  };

  // Apply filters when search criteria change
  useEffect(() => {
    filterRecords();
  }, [filterRecords]);

  // Clear all filters
  const clearFilters = () => {
    setSearchTerm('');
    setSelectedLedger('');
    setDateFilter('');
    setShowFilters(false);
    setCurrentPage(1);
  };

  useEffect(() => {
    fetchLedgers();
  }, [fetchLedgers]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords, currentPage]);

  // Handle refresh when coming back from CreateAnamath
  useEffect(() => {
    if (location.state?.refresh) {
      fetchRecords();
      // Clear the state to prevent unnecessary refreshes
      window.history.replaceState({}, document.title);
    }
  }, [location.state, fetchRecords]);

  const handleExport = async (type: 'pdf' | 'csv') => {
    if (type === 'pdf') {

      // Validate records before processing
      if (!records || records.length === 0) {
        toast.error('No Anamath records available to export');
        return;
      }

      // Convert Anamath entries to PDF format with debugging
      const pdfEntries: AnamathPDFEntry[] = records.map((record) => ({
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
          displayTransactionNumber: record.displayTransactionNumber
      }));

      // Calculate date range
      const dateRange = records.length > 0 ? {
        start: format(parseISO(records[records.length - 1].date), 'dd/MM/yyyy'),
        end: format(parseISO(records[0].date), 'dd/MM/yyyy')
      } : undefined;


      try {
        const success = generateAnamathPDF(pdfEntries, {
          companyName: 'MRN INDUSTRIES',
          dateRange,
          includeCreatedBy: true,
          includeReference: true
        });

        if (success) {
          toast.success('Anamath PDF exported successfully!');
        } else {
          console.error('❌ Anamath.tsx: PDF generation returned false');
          toast.error('Failed to generate Anamath PDF');
        }
      } catch (error) {
        console.error('❌ Anamath.tsx: PDF export error:', error);
        toast.error('Failed to export PDF: ' + (error instanceof Error ? error.message : 'Unknown error'));
      }
    } else if (type === 'csv') {
      exportToXlsx(records, 'Anamath Records');
    }
  };

  const handleExportPDF = () => handleExport('pdf');
  const handleExportExcel = () => handleExport('csv');

  const handleDelete = (id: string) => {
    setRecordToDelete(id);
    setIsModalOpen(true);
  };

  const onConfirmDelete = async () => {
    if (recordToDelete) {
      try {
        const response = await anamathApi.delete(recordToDelete);
        if (response.success) {
          toast.success('Record deleted successfully');
          fetchRecords();
        } else {
          toast.error('Failed to delete record');
        }
      } catch (error) {
        console.error('Error deleting record:', error);
        toast.error('Failed to delete record. Please try again.');
      }
    }
    setIsModalOpen(false);
    setRecordToDelete(null);
  };

  const handleClose = (id: string) => {
    setRecordToClose(id);
    setIsCloseModalOpen(true);
  };

  const onConfirmClose = async () => {
    if (recordToClose) {
      // Optimistically remove from UI immediately to avoid caching delay
      setRecords(prev => prev.filter(r => r.id !== recordToClose));
      setFilteredRecords(prev => prev.filter(r => r.id !== recordToClose));

      try {
        const response = await anamathApi.close(recordToClose);
        if (response.success) {
          toast.success('Record closed successfully');
          // No need to fetchRecords here since we optimistically updated and this endpoint may be cached
        } else {
          console.error('Failed to close record:', response);
          toast.error('Failed to close record');
        }
      } catch (error) {
        console.error('Error closing record:', error);
        toast.error('Failed to close record. Please try again.');
      }
    }
    setIsCloseModalOpen(false);
    setRecordToClose(null);
  };

  const handleApproveAnamath = async (id: string) => {
    try {
      setIsApproving(id);
      const response = await anamathApi.approve(id);
      if (response.success) {
        toast.success('Anamath entry approved successfully');
        // Optimistic update instead of full refetch
        setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r));
        setFilteredRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'approved' as const } : r));
      } else {
        toast.error(response.message || 'Failed to approve anamath entry');
      }
    } catch (error: any) {
      console.error('Anamath approval error:', error);
      toast.error(error.response?.data?.message || 'Error occurred during approval');
    } finally {
      setIsApproving(null);
    }
  };

  const [isRejecting, setIsRejecting] = useState<string | null>(null);

  const handleRejectAnamath = async (id: string) => {
    try {
      setIsRejecting(id);
      const response = await anamathApi.reject(id);
      if (response.success) {
        toast.success('Anamath entry rejected');
        // Optimistic update instead of full refetch
        setRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r));
        setFilteredRecords(prev => prev.map(r => r.id === id ? { ...r, status: 'rejected' as const } : r));
      } else {
        toast.error(response.message || 'Failed to reject anamath entry');
      }
    } catch (error: any) {
      console.error('Anamath rejection error:', error);
      toast.error(error.response?.data?.message || 'Error occurred during rejection');
    } finally {
      setIsRejecting(null);
    }
  };

  if (loading) {
    return <LoadingSpinner message="Loading Anamath records..." />;
  }

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-950 text-white p-4 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">Anamath Records</h1>
            {records.length > 0 && (
              <span className="ml-3 px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
                Total: {formatIndianCurrency(records.reduce((total, record) => total + Number(record.amount || 0), 0))}
              </span>
            )}
          </div>
          <div className="flex items-center space-x-1.5">
            <button
              onClick={() => navigate('/anamath/closed')}
              className="flex items-center px-3 py-1.5 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
            >
              <Archive className="w-3 h-3 mr-1" />
              Closed
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
            >
              <Download className="w-3 h-3 mr-1" />
              PDF
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center px-3 py-1.5 bg-green-600 hover:bg-green-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
            >
              <Download className="w-3 h-3 mr-1" />
              Excel
            </button>
            <button
              onClick={() => navigate('/transactions/create/anamath')}
              className="flex items-center px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-xs font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.97]"
            >
              <Plus className="w-3 h-3 mr-1" />
              Add
            </button>
          </div>
        </div>
      </div>

      {/* Search and Filter Section */}
      <div className="bg-white dark:bg-gray-800 rounded-xl border border-gray-200 dark:border-gray-700 p-4 transition-colors">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Search Input */}
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 dark:text-gray-500 w-4 h-4" />
            <input
              type="text"
              placeholder="Search by Anamath ID (A001), ledger name, remarks, or amount..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-colors"
            />
          </div>

          {/* Filter Toggle */}
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="px-4 py-2.5 border border-gray-300 dark:border-gray-600 rounded-lg hover:bg-gray-50 dark:hover:bg-gray-700 dark:text-gray-300 flex items-center font-medium transition-colors"
          >
            <Filter className="w-4 h-4 mr-2" />
            Filters
          </button>

          {/* Refresh Button */}
          <button
            onClick={fetchRecords}
            disabled={loading}
            className="px-4 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center font-semibold shadow-sm hover:shadow-md transition-all active:scale-[0.98]"
          >
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>

          {/* Clear Filters */}
          {(searchTerm || selectedLedger || dateFilter) && (
            <button
              onClick={clearFilters}
              className="px-4 py-2.5 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg font-medium transition-colors"
            >
              Clear
            </button>
          )}
        </div>

        {/* Advanced Filters */}
        {showFilters && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter by Ledger
              </label>
              <select
                value={selectedLedger}
                onChange={(e) => setSelectedLedger(e.target.value)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700 dark:text-gray-100 transition-colors"
              >
                <option value="">All Ledgers</option>
                {ledgers.map(ledger => (
                  <option key={ledger.id} value={ledger.id}>
                    {ledger.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Filter by Date
              </label>
              <DateInput
                value={dateFilter}
                onChange={(val) => setDateFilter(val)}
                className="w-full border border-gray-300 dark:border-gray-600 rounded-lg px-3 py-2.5 bg-white dark:bg-gray-700 dark:text-gray-100 transition-colors"
              />
            </div>
          </div>
        )}

        {/* Results Count */}
        <div className="mt-3 text-sm text-gray-600 dark:text-gray-400">
          Showing {filteredRecords.length} of {records.length} records
          {(searchTerm || selectedLedger || dateFilter) && (
            <span className="text-blue-600 dark:text-blue-400 ml-2">(filtered)</span>
          )}
        </div>
      </div>

      {/* Records Table - Excel Style */}
      <div className="overflow-x-auto shadow-xl rounded-xl border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 transition-colors">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-100 dark:bg-gray-700">
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-10 bg-gray-100 dark:bg-gray-700 font-bold text-xs text-gray-700 dark:text-gray-300">SL</th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-24 bg-blue-50 dark:bg-blue-900/30 font-bold text-xs text-blue-800 dark:text-blue-300 cursor-pointer select-none hover:bg-blue-100 dark:hover:bg-blue-900/50" onClick={() => toggleSort('date')}>
                <span className="inline-flex items-center">DATE<SortIcon field="date" /></span>
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-16 bg-indigo-50 dark:bg-indigo-900/30 font-bold text-xs text-indigo-800 dark:text-indigo-300 cursor-pointer select-none hover:bg-indigo-100 dark:hover:bg-indigo-900/50" onClick={() => toggleSort('id')}>
                <span className="inline-flex items-center">ID<SortIcon field="id" /></span>
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left bg-yellow-50 dark:bg-yellow-900/20 font-bold text-xs text-yellow-800 dark:text-yellow-300 cursor-pointer select-none hover:bg-yellow-100 dark:hover:bg-yellow-900/40" onClick={() => toggleSort('ledger')}>
                <span className="inline-flex items-center">LEDGER<SortIcon field="ledger" /></span>
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left bg-green-50 dark:bg-green-900/30 font-bold text-xs text-green-800 dark:text-green-300 cursor-pointer select-none hover:bg-green-100 dark:hover:bg-green-900/50" onClick={() => toggleSort('amount')}>
                <span className="inline-flex items-center">AMOUNT<SortIcon field="amount" /></span>
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-left bg-blue-50/50 dark:bg-blue-900/15 font-bold text-xs text-gray-700 dark:text-gray-300">REMARKS</th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-20 bg-orange-50 dark:bg-orange-900/20 font-bold text-xs text-orange-800 dark:text-orange-300 cursor-pointer select-none hover:bg-orange-100 dark:hover:bg-orange-900/40" onClick={() => toggleSort('status')}>
                <span className="inline-flex items-center">STATUS<SortIcon field="status" /></span>
              </th>
              <th className="border border-gray-300 dark:border-gray-600 px-2 py-2 text-center w-28 bg-gray-100 dark:bg-gray-700 font-bold text-xs text-gray-700 dark:text-gray-300">ACTIONS</th>
            </tr>
          </thead>
          <tbody>
            {sortedRecords.length > 0 ? (
              sortedRecords.map((record, index) => {
                const ledger = record.ledger || (record.ledgerId ? ledgers.find(l => l.id === record.ledgerId) : null);
                return (
                  <tr
                    key={record.id}
                    className={`hover:bg-gray-100 dark:hover:bg-gray-600/50 ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/60'} ${record.status === 'pending' ? 'bg-yellow-50/50 dark:bg-yellow-900/10' : ''}`}
                  >
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center text-xs dark:text-gray-300">{index + 1}</td>
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center text-xs dark:text-gray-300">
                      {format(parseISO(record.date), 'dd/MM/yyyy')}
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center text-xs font-mono font-medium dark:text-gray-200">
                      {record.transactionNumber ? `A${String(record.transactionNumber).padStart(3, '0')}` : '—'}
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
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center text-xs">
                      <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${(record.status || 'approved') === 'approved'
                        ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-400'
                        : (record.status || 'approved') === 'pending'
                          ? 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/40 dark:text-yellow-400 animate-pulse'
                          : 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-400'
                        }`}>
                        {record.status || 'approved'}
                      </span>
                    </td>
                    <td className="border border-gray-300 dark:border-gray-600 px-2 py-1.5 text-center">
                      <div className="flex justify-center items-center space-x-1">
                        {record.status === 'pending' && canApproveAnamathEntry && (
                          <>
                          <button
                            onClick={() => handleApproveAnamath(record.id)}
                            disabled={isApproving === record.id}
                            className="p-1.5 rounded-md text-emerald-600 dark:text-emerald-400 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                            title="Approve"
                          >
                            {isApproving === record.id ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-emerald-600"></div>
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                          </button>
                          <button
                            onClick={() => handleRejectAnamath(record.id)}
                            disabled={isRejecting === record.id}
                            className="p-1.5 rounded-md text-red-500 dark:text-red-400 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            title="Reject"
                          >
                            {isRejecting === record.id ? (
                              <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-500"></div>
                            ) : (
                              <X className="w-3 h-3" />
                            )}
                          </button>
                          </>
                        )}
                        <button
                          onClick={() => navigate(`/anamath/${record.id}/edit`)}
                          className="p-1.5 rounded-md text-blue-600 dark:text-blue-400 hover:text-blue-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors"
                          title="Edit"
                        >
                          <Edit className="w-3 h-3" />
                        </button>
                        <button
                          onClick={() => handleClose(record.id)}
                          className="p-1.5 rounded-md text-green-600 dark:text-green-400 hover:text-green-800 hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors"
                          title="Close Record"
                        >
                          <Archive className="w-3 h-3" />
                        </button>
                        {canDelete && (
                          <button
                            onClick={() => handleDelete(record.id)}
                            className="p-1.5 rounded-md text-red-600 dark:text-red-400 hover:text-red-800 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="border border-gray-300 dark:border-gray-600 px-4 py-8 text-center">
                  <div className="text-gray-400 dark:text-gray-500">
                    <BookOpen className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-600" />
                    <h3 className="mt-2 text-sm font-medium text-gray-900 dark:text-gray-200">No records found</h3>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                      {(searchTerm || selectedLedger || dateFilter) ? 'No records found matching your filters.' : 'Create a new Anamath entry to get started.'}
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

      <ConfirmModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        onConfirm={onConfirmDelete}
        title="Delete Record"
        message="Are you sure you want to delete this record? This action cannot be undone."
      />

      <ConfirmModal
        isOpen={isCloseModalOpen}
        onClose={() => setIsCloseModalOpen(false)}
        onConfirm={onConfirmClose}
        title="Accept Record"
        message="Are you sure you want to accept this record? You can reopen it later from the closed records view."
        confirmButtonText="Accept"
        confirmButtonColor="green"
      />
    </div >
  );
};

export default Anamath;