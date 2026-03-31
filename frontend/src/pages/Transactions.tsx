import React, { useState, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';
import { motion } from 'framer-motion';
import {
  FileText,
  FileDown,
  AlertCircle,
  Eye,
  Edit3,
  Trash2,
  CheckCircle,
  XCircle
} from 'lucide-react';
import { exportToCSV, type TransactionExportData } from '../utils/export';
import { logTransactionOperation } from '../utils/transactionTestUtils';
import { generateTransactionPDF, type Transaction as TransactionPDF } from '../utils/transactionPDFGenerator';
import { useNavigate, useSearchParams, useLocation } from 'react-router-dom';
import { transactionApi, ledgerApi, openingBalanceApi, type Transaction as ApiTransaction, type Ledger } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { canEdit, canDelete, isAdmin, isOwner, isManager, canApproveDebit, canApproveCredit } from '../utils/permissions';
import { format, parseISO } from 'date-fns';
import { toast } from 'react-toastify';
import LoadingSpinner from '../components/LoadingSpinner';
import DateInput from '../components/DateInput';
import { formatIndianCurrency, formatExportAmount, parseIndianNumber, formatIndianNumber } from '../utils/indianNumberFormat';

interface Transaction extends Omit<ApiTransaction, 'ledgerId' | 'balance'> {
  ledger?: Ledger;
  ledgerId?: string;
  type?: 'debit' | 'credit' | 'anamath';  // Make this optional to match API
  debitAmount: number;
  creditAmount: number;
  reference?: string;
  date: string;
  id: string;
  amount?: number;  // Make this optional since API doesn't always provide it
  createdAt: string;
  updatedAt: string;
  remarks?: string;
  isCombined?: boolean; // Added for anamath indicator
  transactionNumber?: number;
  displayTransactionNumber?: string;
  status: 'pending' | 'approved' | 'rejected';
  transactionType?: 'regular' | 'combined';
}

// interface Totals {
//   totalDebit: number;
//   totalCredit: number;
//   balance: number;
// }

const Transactions: React.FC = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const location = useLocation();
  const { user } = useAuth();

  // Role-based permissions using utility functions
  const canEditTransactions = canEdit(user?.role);
  const canDeleteTransactions = canDelete(user?.role);  // State management
  const [exportLoading, setExportLoading] = useState(false);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalRecords, setTotalRecords] = useState<number>(0);
  const [hasMorePages, setHasMorePages] = useState<boolean>(false);
  const [ledgers, setLedgers] = useState<Ledger[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [isApproving, setIsApproving] = useState<string | null>(null);
  const [isRejecting, setIsRejecting] = useState<string | null>(null);

  // Handle approval
  const handleApprove = async (id: string) => {
    if (!isAdmin(user?.role) && !isOwner(user?.role) && !isManager(user?.role)) {
      toast.error('Only administrators, owners, and managers can approve transactions');
      return;
    }

    try {
      setIsApproving(id);
      const response = await transactionApi.approve(id);
      if (response.success) {
        toast.success('Transaction approved successfully');
        // Optimistic update: update local state instead of full refetch
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'approved' as const } : t));
      } else {
        toast.error(response.message || 'Failed to approve transaction');
      }
    } catch (error: any) {
      console.error('Approval error:', error);
      toast.error(error.response?.data?.message || 'Error occurred during approval');
    } finally {
      setIsApproving(null);
    }
  };

  // Handle rejection
  const handleReject = async (id: string) => {
    if (!isAdmin(user?.role) && !isOwner(user?.role) && !isManager(user?.role)) {
      toast.error('Only administrators, owners, and managers can reject transactions');
      return;
    }

    try {
      setIsRejecting(id);
      const response = await transactionApi.reject(id);
      if (response.success) {
        toast.success('Transaction rejected');
        // Optimistic update: update local state instead of full refetch
        setTransactions(prev => prev.map(t => t.id === id ? { ...t, status: 'rejected' as const } : t));
      } else {
        toast.error(response.message || 'Failed to reject transaction');
      }
    } catch (error: any) {
      console.error('Rejection error:', error);
      toast.error(error.response?.data?.message || 'Error occurred during rejection');
    } finally {
      setIsRejecting(null);
    }
  };
  // Removed global search in favor of Filters page
  const [selectedLedger, setSelectedLedger] = useState<string>('all');
  const [selectedType, setSelectedType] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [currentPage, setCurrentPage] = useState<number>(1);
  // ✅ Date-based pagination: Each page shows ONE complete date
  const [currentDatePage, setCurrentDatePage] = useState<number>(1);
  const [datesPerPage] = useState<number>(1); // Show 1 date per page
  // const [transactionSummary, setTransactionSummary] = useState<any>(null);
  const [openingBalanceAmount, setOpeningBalanceAmount] = useState<number>(0);
  // const [totals, setTotals] = useState<Totals>({ 
  //   totalDebit: 0, 
  //   totalCredit: 0,
  //   balance: 0
  // });
  // const [selectedTransaction, setSelectedTransaction] = useState<string | null>(null);
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editFormData, setEditFormData] = useState<{
    remarks: string;
    amount: number;
    ledgerId: string;
    date: string;
    displayAmount: string; // For formatted display in input
  }>({
    remarks: '',
    amount: 0,
    ledgerId: '',
    date: '',
    displayAmount: '0'
  });

  const [editFormErrors, setEditFormErrors] = useState<{
    remarks?: string;
    amount?: string;
    ledgerId?: string;
    date?: string;
  }>({});

  const [isEditSaving, setIsEditSaving] = useState(false);



  useEffect(() => {
    setStartDate(searchParams.get('startDate') || '');
    setEndDate(searchParams.get('endDate') || '');
    setSelectedLedger(searchParams.get('ledgerId') || 'all');
    setSelectedType(searchParams.get('type') || 'all');
    setCurrentPage(1); // Reset to first page when filters are applied
  }, [searchParams]);
  const [expandedDates, setExpandedDates] = useState<Set<string>>(new Set());
  const [showAllTransactions, setShowAllTransactions] = useState<boolean>(
    location.state?.showAll === true
  );
  // Map of date (yyyy-MM-dd) -> opening balance fetched from backend continuity service
  const [openingByDate, setOpeningByDate] = useState<Record<string, number>>({});

  // Get TX number filter from URL parameters (now handled by txSearchInput state)
  const txNumberFilter = searchParams.get('txNumber') || '';

  // Calculate business date for display (6:30 AM cutoff)
  const getBusinessDate = useCallback(() => {
    const now = new Date();
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const businessDate = new Date(now);

    // If it's before 6:30 AM, we're still in the previous business day
    // Business day changes at 6:30 AM (06:30)
    if (currentHour < 6 || (currentHour === 6 && currentMinute < 30)) {
      businessDate.setDate(businessDate.getDate() - 1);
    }

    return businessDate;
  }, []);

  // Helper to format business date string
  const getBusinessDateString = useCallback(() => {
    return format(getBusinessDate(), 'yyyy-MM-dd');
  }, [getBusinessDate]);

  // Use Indian formatting - no decimals for display
  const formatCurrency = (amount: number) => {
    return formatIndianCurrency(amount, false);
  };

  // const formatAmount = (amount: number, isCredit: boolean = true) => {
  //   return formatDisplayAmount(amount, true);
  // };

  // Safely format arbitrary date inputs to avoid runtime crashes
  const safeFormatDate = (input: string | Date, fmt: string) => {
    try {
      // Try ISO parse first for string inputs like yyyy-MM-dd or ISO strings
      const d = typeof input === 'string'
        ? (/^\d{4}-\d{2}-\d{2}/.test(input) || input.includes('T')
          ? parseISO(input)
          : new Date(input))
        : new Date(input);
      if (isNaN(d.getTime())) throw new Error('Invalid date');
      return format(d, fmt);
    } catch {
      // Final fallback – return raw string
      return String(input);
    }
  };

  // Convert input to yyyy-MM-dd safely (for form inputs)
  const toISODateString = (input: string | Date | undefined | null): string => {
    try {
      // Handle undefined/null input
      if (!input) return format(new Date(), 'yyyy-MM-dd');

      // If it's already in yyyy-MM-dd format, return as is
      if (typeof input === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(input)) {
        return input;
      }

      let date: Date;
      if (typeof input === 'string') {
        // Try parsing with parseISO first
        try {
          date = parseISO(input);
          if (!isNaN(date.getTime())) {
            return format(date, 'yyyy-MM-dd');
          }
        } catch {
          // Fallback to new Date() if parseISO fails
        }

        // Try standard date parsing
        date = new Date(input);
      } else {
        date = input;
      }

      // Validate the date
      if (isNaN(date.getTime())) {
        return format(new Date(), 'yyyy-MM-dd');
      }

      return format(date, 'yyyy-MM-dd');
    } catch (error) {
      console.error('Error formatting date:', error);
      return format(new Date(), 'yyyy-MM-dd');
    }
  };

  // const getTransactionIcon = (transaction: Transaction) => {
  //   if (transaction.type === 'credit') {
  //     return <Plus className="w-4 h-4 text-green-600" />;
  //   } else if (transaction.type === 'debit') {
  //     return <Minus className="w-4 h-4 text-red-600" />;
  //   }
  //   // For anamath transactions (if they exist in this view)
  //   return <AlertCircle className="w-4 h-4 text-amber-600" />;
  // };

  // const getTransactionIndicator = (transaction: Transaction) => {
  //   if (transaction.type === 'credit') {
  //     return (
  //       <div className="flex items-center space-x-1 text-green-600">
  //         <div className="w-2 h-2 bg-green-500 rounded-full"></div>
  //         <TrendingUp className="w-3 h-3" />
  //       </div>
  //     );
  //   } else if (transaction.type === 'debit') {
  //     return (
  //       <div className="flex items-center space-x-1 text-red-600">
  //         <div className="w-2 h-2 bg-red-500 rounded-full"></div>
  //         <TrendingDown className="w-3 h-3" />
  //       </div>
  //     );
  //   }
  //   // For anamath transactions
  //   return (
  //     <div className="flex items-center space-x-1 text-amber-600">
  //       <div className="w-2 h-2 bg-amber-500 rounded-full"></div>
  //       <AlertCircle className="w-3 h-3" />
  //     </div>
  //   );
  // };



  // Fetch ledgers from API
  const fetchLedgers = useCallback(async () => {
    try {
      const response = await ledgerApi.getAll({ limit: 100 });
      if (response.success) {
        setLedgers(response.data.ledgers);
      }
    } catch (error) {
      toast.error('Failed to load ledgers');
    }
  }, []);

  // Fetch transactions from API
  const fetchTransactions = useCallback(async () => {
    try {
      setLoading(true);

      // ✅ SMART LOGIC: 
      // - When filters applied (date range, ledger, type): Show ALL results, NO pagination
      // - When no filters (default view): Use date-based pagination (one date per page)
      const hasFilters = startDate || endDate || selectedLedger !== 'all' || selectedType !== 'all' || txNumberFilter;

      const params = {
        page: currentPage,
        limit: hasFilters ? 500 : 200, // Reasonable limits for fast response
        ledgerId: selectedLedger === 'all' ? undefined : selectedLedger,
        type: selectedType === 'all' ? undefined : selectedType as 'debit' | 'credit',
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        txNumber: txNumberFilter || undefined,
        no_count: currentPage === 1 ? 'false' : 'true', // Get count on first page for total pages
        sort_by: 'transaction_date',
        sort_order: 'DESC'
      };

      // Date filters applied
      if (startDate || endDate) {
        // filters active
      }

      // Make business balances call optional - if it fails, continue with fallback
      // let businessBalances;
      // try {
      //   businessBalances = await transactionApi.getBusinessBalances();
      // } catch (businessBalanceError) {
      //   console.warn('Failed to get business balances, using fallback logic:', businessBalanceError);
      //   businessBalances = { success: false, data: {} };
      // }

      // Check if user has opening balance access (admin only)
      const hasOpeningBalanceAccess = user?.role === 'admin' || user?.role === 'owner';

      // Make API calls - opening balance API only for authorized users
      const promises: Promise<any>[] = [
        transactionApi.getAll(params),
        ledgerApi.getSummary()
      ];

      // Only add opening balance API call if user has access
      if (hasOpeningBalanceAccess) {
        promises.push(openingBalanceApi.getCurrent());
      }

      const responses = await Promise.all(promises);
      const [transactionsResponse, ledgerSummary, openingBalanceCurrent] = responses;

      const txSuccess = (transactionsResponse as any).success !== false; // treat absence as success
      const openingBalanceSuccess = !hasOpeningBalanceAccess || (openingBalanceCurrent as any)?.success !== false;
      // const ledgerSuccess = (ledgerSummary as any).success !== false;

      if (txSuccess && openingBalanceSuccess) {
        // const openingBalances = hasOpeningBalanceAccess ? (openingBalanceCurrent?.data as any[] || []) : [];
        const ledgerSum = ledgerSummary.data?.summary || {};
        // const dailyBalances = (businessBalances as any).data || {};

        // Determine the SYSTEM-WIDE opening balance (first date's opening, NOT today's)
        // This should always be the very first opening balance in the system
        let systemOpeningBalance: number | undefined = undefined;

        // Try to get the global/system opening balance (NOT business date specific)
        if (ledgerSum.openingBalance && typeof ledgerSum.openingBalance === 'number') {
          systemOpeningBalance = ledgerSum.openingBalance;
        } else {
          // Fallback: Try to get opening balance from the earliest date
          try {
            const businessDateStr = getBusinessDateString();
            const perDate = await transactionApi.getBalances(businessDateStr);
            if ((perDate as any).success && (perDate as any).data && typeof (perDate as any).data.openingBalance === 'number') {
              systemOpeningBalance = (perDate as any).data.openingBalance;
            }
          } catch (e) {
            systemOpeningBalance = 0;
          }
        }

        setOpeningBalanceAmount(systemOpeningBalance!);

        // Process transactions data - FIXED: Properly extract transactions array
        let transactionsData: any[] = [];

        // Handle different possible response structures
        if (transactionsResponse.data) {
          if (Array.isArray(transactionsResponse.data)) {
            // Direct array response
            transactionsData = transactionsResponse.data;
          } else if (typeof transactionsResponse.data === 'object' && 'data' in transactionsResponse.data) {
            // Check if it's the PaginatedResponse structure
            if (Array.isArray((transactionsResponse.data as any).data)) {
              // Nested data array
              transactionsData = (transactionsResponse.data as any).data;
            } else if (typeof (transactionsResponse.data as any).data === 'object' && (transactionsResponse.data as any).data !== null) {
              // Check for transactions property in nested data
              const nestedData = (transactionsResponse.data as any).data;
              if ('transactions' in nestedData && Array.isArray(nestedData.transactions)) {
                transactionsData = nestedData.transactions;
                // Extract transaction summary if available (commented out - not used)
                // if ('summary' in nestedData && nestedData.summary) {
                //   setTransactionSummary(nestedData.summary);
                // }
              }
            }
          } else if (typeof transactionsResponse.data === 'object' && 'transactions' in transactionsResponse.data && Array.isArray((transactionsResponse.data as any).transactions)) {
            // Direct transactions property
            transactionsData = (transactionsResponse.data as any).transactions;
          }
        }

        // Transform transactions to include proper type and amounts
        const transformedTransactions = transactionsData.map(transaction => {
          const creditAmount = parseFloat(transaction.creditAmount) || 0;
          const debitAmount = parseFloat(transaction.debitAmount) || 0;

          return {
            ...transaction,
            id: transaction.id || transaction._id,
            creditAmount,
            debitAmount,
            transactionNumber: transaction.transactionNumber,
            displayTransactionNumber: transaction.transactionNumber ? String(transaction.transactionNumber).padStart(2, '0') : undefined,
            date: toISODateString(transaction.date || transaction.createdAt || new Date()),
            type: debitAmount > 0 ? 'debit' : 'credit',
            transactionType: transaction.transactionType, // Preserve transactionType field
            referenceNumber: transaction.referenceNumber, // Preserve referenceNumber field
            reference: transaction.reference // Preserve reference field
          } as Transaction;
        });

        // Sort transactions by transaction number (ascending)
        const sortedTransactions = [...transformedTransactions].sort((a, b) =>
          (a.transactionNumber || 0) - (b.transactionNumber || 0)
        );

        setTransactions(sortedTransactions);

        // Fetch accurate opening balances for the ENTIRE date range in ONE bulk call
        try {
          if (sortedTransactions.length > 0) {
            const dateTimestamps = sortedTransactions.map(t => new Date(t.date).getTime());
            const minDate = new Date(Math.min.apply(null, dateTimestamps));
            const maxDate = new Date(Math.max.apply(null, dateTimestamps));

            const allDatesInRange: string[] = [];
            let currentDate = minDate;
            while (currentDate <= maxDate) {
              allDatesInRange.push(format(currentDate, 'yyyy-MM-dd'));
              currentDate.setDate(currentDate.getDate() + 1);
            }

            // Single bulk API call instead of one per date
            const bulkResponse = await transactionApi.getBulkBalances(allDatesInRange);
            const map: Record<string, number> = {};
            if ((bulkResponse as any).success && (bulkResponse as any).data?.balances) {
              Object.assign(map, (bulkResponse as any).data.balances);
            }
            setOpeningByDate(map);

            // If openingBalanceAmount is 0 (Staff users) and we have date-specific balances,
            // use the earliest date's opening balance as the baseline
            if (systemOpeningBalance === 0 && Object.keys(map).length > 0) {
              const earliestDate = allDatesInRange[0];
              if (map[earliestDate] !== undefined) {
                setOpeningBalanceAmount(map[earliestDate]);
              }
            }
          } else {
            setOpeningByDate({}); // Clear if no transactions
          }
        } catch (e) {
        }

        // Set total pages and hasMore from server response
        let pages = 1;
        let serverHasMore = false;
        let serverTotal = 0;
        const extractPagination = (obj: any) => {
          if (obj?.pagination) {
            if (typeof obj.pagination.pages === 'number') pages = obj.pagination.pages;
            if (typeof obj.pagination.hasMore === 'boolean') serverHasMore = obj.pagination.hasMore;
            if (typeof obj.pagination.total === 'number') serverTotal = obj.pagination.total;
          }
        };
        if (transactionsResponse.data && typeof transactionsResponse.data === 'object') {
          extractPagination(transactionsResponse.data);
          if (pages === 1 && (transactionsResponse.data as any).data) {
            extractPagination((transactionsResponse.data as any).data);
          }
        }
        setTotalPages(pages > 0 ? pages : 1);
        setHasMorePages(serverHasMore);
        setTotalRecords(serverTotal);

        // Update totals from summary (commented out - not used in UI)
        // Update totals from ledger summary (not using opening balance summary for totals)
        // setTotals({
        //   totalDebit: ledgerSum.totalDebits || 0,
        //   totalCredit: ledgerSum.totalCredits || 0,
        //   balance: ledgerSum.totalBalance || 0
        // });
      }
    } catch (error: any) {
      console.error('Error fetching transactions:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch transactions');
    } finally {
      setLoading(false);
    }
  }, [currentPage, selectedLedger, selectedType, startDate, endDate, txNumberFilter, user?.role, getBusinessDateString]);

  // Initialize data
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchLedgers(), fetchTransactions()]);
      } catch (error) {
        console.error('Error loading data:', error);
      }
    };

    loadData();
  }, [fetchLedgers, fetchTransactions]);

  // Refetch transactions when filters or pagination changes
  useEffect(() => {
    fetchTransactions();
  }, [currentPage, selectedLedger, selectedType, startDate, endDate, txNumberFilter, fetchTransactions]);

  // Auto-reset to today-only view at 6:30 AM daily
  useEffect(() => {
    const checkAndResetAt630AM = () => {
      const now = new Date();
      const hour = now.getHours();
      const minute = now.getMinutes();

      // If it's 6:30 AM exactly (within the first minute to avoid multiple resets)
      if (hour === 6 && minute === 30) {
        setShowAllTransactions(false); // Reset to show today only
        toast.info('Daily view reset to today\'s transactions only (6:30 AM business day start)');
      }
    };

    // Check immediately
    checkAndResetAt630AM();

    // Set up interval to check every minute
    const interval = setInterval(checkAndResetAt630AM, 60000);

    return () => clearInterval(interval);
  }, []);

  // Handle navigation state (refresh from anamath, showAll from TransactionTypeSelection)
  useEffect(() => {
    if (location.state?.refresh) {
      fetchTransactions();
    }
    if (location.state?.showAll) {
      setShowAllTransactions(true);
    }
    // Clear the state to prevent repeated triggers on re-renders
    if (location.state?.refresh || location.state?.showAll) {
      navigate(location.pathname, { state: {}, replace: true });
    }
  }, [location.state, fetchTransactions, navigate, location.pathname]);

  // Keyboard shortcut: Ctrl+R to update last transaction
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Check for Ctrl+R (or Cmd+R on Mac)
      if ((event.ctrlKey || event.metaKey) && event.key === 'r') {
        event.preventDefault(); // Prevent browser refresh

        // Find the most recent transaction
        if (transactions.length > 0) {
          const lastTransaction = transactions[0]; // Assuming sorted by date desc
          if (lastTransaction && canEditTransactions) {
            handleEditTransaction(lastTransaction);
          } else if (!canEditTransactions) {
            toast.warning('You do not have permission to edit transactions');
          }
        } else {
          toast.info('No transactions available to edit');
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [transactions, canEditTransactions]);

  const handlePageChange = (page: number) => {
    setCurrentPage(page);
  };

  // Handle export (CSV and PDF)
  const handleExport = async (
    type: 'csv' | 'pdf',
    selectedDate: string,
    dailyTransactions: Transaction[],
    dailyDebit: number,
    dailyCredit: number
  ) => {
    setExportLoading(true);
    try {

      if (!dailyTransactions.length) {
        toast.error('No transactions to export');
        return;
      }

      // Sort ascending by transaction number (as they occurred)
      const sortedTransactions = [...dailyTransactions].sort((a, b) => (
        (a.transactionNumber || 0) - (b.transactionNumber || 0)
      ));

      const exportData: TransactionExportData[] = sortedTransactions.map(t => {
        const isCredit = t.type === 'credit';
        const amount = isCredit ? t.creditAmount : t.debitAmount;
        return {
          date: t.date,
          particulars: t.remarks || t.ledger?.name || 'Unknown',
          reference: t.reference || '',
          debit: !isCredit ? formatExportAmount(amount) : '0',
          credit: isCredit ? formatExportAmount(amount) : '0',
          ledger: t.ledger?.name || '',
          txNumber: t.displayTransactionNumber || t.transactionNumber?.toString() || '-'
        } as TransactionExportData;
      });

      // ✅ FIX: Use ISO format (yyyy-MM-dd) for exports, but keep formattedDate for other potential uses
      const formattedDate = format(new Date(selectedDate), 'dd/MM/yyyy');

      // Pass the standard ISO date (yyyy-MM-dd) to export processing to avoid "05/03" vs "03/05" bugs
      const exportStartDate = selectedDate;
      const exportEndDate = selectedDate;

      // ✅ FIX: Use the SAME opening balance calculation as the UI display
      // Calculate opening balance for the selected date using the same logic as UI
      const allDates = Object.keys(transactionsByDate).sort();
      const currentDateIndex = allDates.indexOf(selectedDate);

      let openingBalance: number;

      if (currentDateIndex === -1 || currentDateIndex === 0) {
        // First date or date not found: use global opening balance
        openingBalance = openingByDate[selectedDate] !== undefined
          ? openingByDate[selectedDate]
          : openingBalanceAmount;
      } else {
        // Calculate from previous dates to ensure accuracy
        const firstDate = allDates[0];
        let runningBalance = openingByDate[firstDate] !== undefined
          ? openingByDate[firstDate]
          : openingBalanceAmount;

        // Accumulate through each previous date
        for (let i = 0; i < currentDateIndex; i++) {
          const prevDate = allDates[i];
          const prevTransactions = (transactionsByDate[prevDate] || []).filter(t => t.status !== 'pending');
          const prevCredit = prevTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + (t.creditAmount || 0), 0);
          const prevDebit = prevTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + (t.debitAmount || 0), 0);
          runningBalance = runningBalance + prevCredit - prevDebit;
        }

        openingBalance = runningBalance;
      }

      // Use todayOpeningBalance for today's date
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      if (selectedDate === todayStr) {
        openingBalance = todayOpeningBalance;
      }

      if (type === 'csv') {
        // CSV export
        await exportToCSV(
          exportData,
          exportStartDate,
          exportEndDate,
          openingBalance,
          dailyDebit,
          dailyCredit
        );
      } else if (type === 'pdf') {
        // PDF export
        const pdfTransactions: TransactionPDF[] = sortedTransactions.map(t => ({
          id: t.id.toString(),
          date: t.date,
          type: t.type as 'credit' | 'debit',
          creditAmount: t.creditAmount,
          debitAmount: t.debitAmount,
          remarks: t.remarks,
          reference: t.reference,
          ledger: t.ledger,
          transactionNumber: t.transactionNumber,
          displayTransactionNumber: t.displayTransactionNumber,
          createdBy: typeof t.createdBy === 'string'
            ? { username: t.createdBy }
            : t.createdBy
        }));

        const closingBalance = openingBalance + dailyCredit - dailyDebit;

        const pdfSuccess = generateTransactionPDF(pdfTransactions, {
          companyName: 'PETTY CASH',
          dateRange: {
            start: formattedDate,
            end: formattedDate
          },
          openingBalance: openingBalance,
          includeRunningBalance: true,
          includeCreatedBy: false,
          separateCreditDebit: false,
          dailyTotals: {
            credit: dailyCredit,
            debit: dailyDebit,
            closing: closingBalance
          }
        });

        if (!pdfSuccess) {
          throw new Error('Failed to generate PDF');
        }
      }

      toast.success(`Exported ${exportData.length} transactions to ${type.toUpperCase()}`);
    } catch (outerErr) {
      console.error('Export failed:', outerErr);
      let msg = 'Failed to export transactions';
      if (outerErr instanceof Error) msg = outerErr.message;
      toast.error(msg);
    } finally {
      setExportLoading(false);
    }
  };

  // Clear filters
  const clearFilters = () => {
    setSelectedLedger('all');
    setSelectedType('all');
    setStartDate('');
    setEndDate('');
    setCurrentPage(1);

    // Clear search params from URL
    const newSearchParams = new URLSearchParams(searchParams.toString());
    newSearchParams.delete('txNumber');
    navigate({ search: newSearchParams.toString() });
  };

  // Validate edit form
  const validateEditForm = () => {
    const errors: typeof editFormErrors = {};

    // Remarks validation (optional)
    if (editFormData.remarks && editFormData.remarks.trim().length > 500) {
      errors.remarks = 'Remarks cannot exceed 500 characters';
    }

    // Amount validation
    if (!editFormData.amount || editFormData.amount <= 0) {
      errors.amount = 'Amount must be greater than 0';
    } else if (editFormData.amount > 999999999.99) {
      errors.amount = 'Amount cannot exceed 999,999,999.99';
    }

    // Ledger validation
    if (!editFormData.ledgerId || editFormData.ledgerId.trim() === '') {
      errors.ledgerId = 'Please select a ledger';
    }

    // Date validation
    if (!editFormData.date || editFormData.date.trim() === '') {
      errors.date = 'Date is required';
    } else {
      try {
        const selectedDate = new Date(editFormData.date);
        if (isNaN(selectedDate.getTime())) {
          errors.date = 'Please enter a valid date';
        } else {
          const now = new Date();
          const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
          const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

          if (selectedDate < oneYearAgo || selectedDate > oneYearFromNow) {
            errors.date = 'Date must be within one year of current date';
          }
        }
      } catch (dateError) {
        errors.date = 'Please enter a valid date';
      }
    }

    setEditFormErrors(errors);
    const isValid = Object.keys(errors).length === 0;
    return isValid;
  };

  // Handle edit transaction
  const handleEditTransaction = (transaction: Transaction) => {

    // Block editing of pure Anamath records only (not combined transactions)
    // Combined transactions have transactionType === 'combined'
    const isPureAnamath = transaction.reference === 'A' && transaction.transactionType !== 'combined';
    if (isPureAnamath) {
      toast.info('Pure Anamath transactions cannot be edited directly. Please use the Anamath section to make changes.');
      return;
    }

    setEditingTransaction(transaction);
    const amount = transaction.type === 'credit' ? transaction.creditAmount : transaction.debitAmount;
    setEditFormData({
      remarks: transaction.remarks || '',
      amount: amount,
      ledgerId: transaction.ledger?.id || '',
      date: toISODateString(transaction.date || new Date()),
      displayAmount: formatIndianNumber(amount, false) // Format for display
    });
    setEditFormErrors({});
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!editingTransaction) {
      console.error('No transaction being edited');
      return;
    }

    // Double check that we're not editing a pure Anamath record
    // Combined transactions have transactionType === 'combined'
    const isPureAnamath = editingTransaction.reference === 'A' && editingTransaction.transactionType !== 'combined';
    if (isPureAnamath) {
      toast.error('Pure Anamath transactions cannot be edited directly. Please use the Anamath section to make changes.');
      return;
    }


    // Validate form before submission
    if (!validateEditForm()) {
      toast.error('Please fix the validation errors before saving');
      return;
    }

    // Prepare update data based on transaction type
    const updateData: any = {
      remarks: editFormData.remarks.trim(),
      ledgerId: editFormData.ledgerId,
      // Preserve the original transaction's reference field (important for combined transactions)
      reference: editingTransaction.reference,
      date: (() => {
        // Normalize date to yyyy-MM-dd to avoid locale issues
        try {
          const d = new Date(editFormData.date);
          if (!isNaN(d.getTime())) {
            const yyyy = d.getFullYear();
            const mm = String(d.getMonth() + 1).padStart(2, '0');
            const dd = String(d.getDate()).padStart(2, '0');
            return `${yyyy}-${mm}-${dd}`;
          }
        } catch { }
        return editFormData.date; // fallback
      })()
    };

    // Send both fields with the opposite side forced to 0 to avoid backend ambiguity
    if (editingTransaction.type === 'credit') {
      updateData.creditAmount = editFormData.amount;
      updateData.debitAmount = 0;
    } else {
      updateData.debitAmount = editFormData.amount;
      updateData.creditAmount = 0;
    }

    try {
      setIsEditSaving(true);

      logTransactionOperation('edit', editingTransaction.id, updateData);

      const response = await transactionApi.update(editingTransaction.id, updateData);

      if ((response as any).success && (response as any).data) {
        logTransactionOperation('edit', editingTransaction.id, updateData, response.data);
        const newBal = (response as any).data?.newLedgerBalance;
        toast.success(`Transaction updated successfully! New balance: ${formatCurrency(newBal !== undefined ? newBal : 0)}`);

        // Optimistic local state update so user sees change immediately
        setTransactions(prev => prev.map(t => {
          if (t.id !== editingTransaction.id) return t;
          const isCredit = editingTransaction.type === 'credit';
          return {
            ...t,
            remarks: updateData.remarks ?? t.remarks,
            ledgerId: updateData.ledgerId ?? t.ledgerId,
            ledger: updateData.ledgerId ? (ledgers.find(l => l.id === updateData.ledgerId) || t.ledger) : t.ledger,
            date: updateData.date || t.date,
            creditAmount: isCredit ? (updateData.creditAmount ?? t.creditAmount) : 0,
            debitAmount: !isCredit ? (updateData.debitAmount ?? t.debitAmount) : 0,
            type: isCredit ? 'credit' : 'debit',
            reference: t.reference, // Preserve the reference field
            isCombined: t.isCombined // Preserve the combined flag
          } as Transaction;
        }));

        // Reset form state
        setEditingTransaction(null);
        setEditFormData({
          remarks: '',
          amount: 0,
          ledgerId: '',
          date: '',
          displayAmount: '0'
        });
        setEditFormErrors({});

        // Refresh the list
        await fetchTransactions();
      } else {
        console.error('API response indicates failure:', response);
        const errMsg = (response as any).message || 'Update failed';
        logTransactionOperation('edit', editingTransaction.id, updateData, null, new Error(errMsg));
        toast.error(errMsg);
      }
    } catch (error: any) {
      console.error('Error updating transaction:', error);
      if (error?.response) {
        console.error('Server response status:', error.response.status);
        console.error('Server response data:', error.response.data);
      }
      logTransactionOperation('edit', editingTransaction.id, updateData, null, error);

      // Handle validation errors from server
      if (error.response?.data?.errors) {
        const serverErrors: typeof editFormErrors = {};
        error.response.data.errors.forEach((err: any) => {
          if (err.field && err.message) {
            serverErrors[err.field as keyof typeof editFormErrors] = err.message;
          }
        });
        setEditFormErrors(serverErrors);
        const combined = error.response.data.errors
          .map((e: any) => `${e.field || 'unknown'}: ${e.message || 'validation error'}`)
          .join(' | ');
        toast.error(`Validation: ${combined}`);
      } else {
        const serverMsg = error.response?.data?.message || 'Failed to update transaction';
        const extra = error.response?.data?.error ? ` (${error.response.data.error})` : '';
        toast.error(`${serverMsg}${extra}`);
      }
    } finally {
      setIsEditSaving(false);
    }
  };

  // Handle cancel edit
  const handleCancelEdit = () => {
    setEditingTransaction(null);
    setEditFormData({
      remarks: '',
      amount: 0,
      ledgerId: '',
      date: '',
      displayAmount: '0'
    });
  };

  // Handle delete transaction
  const handleDeleteTransaction = async (transactionId: string) => {
    try {
      setIsDeleting(true);

      logTransactionOperation('delete', transactionId);

      const response = await transactionApi.delete(transactionId);

      if ((response as any).success) {
        logTransactionOperation('delete', transactionId, null, response.data);

        const deletedInfo = response.data?.deletedTransaction;
        const newBalance = response.data?.newLedgerBalance;

        toast.success(
          `Transaction deleted successfully! ${deletedInfo ? `${deletedInfo.type.toUpperCase()}: ${formatCurrency(deletedInfo.amount)} from ${deletedInfo.ledgerName}` : ''} ${newBalance !== undefined ? `New balance: ${formatCurrency(newBalance)}` : ''}`
        );

        setShowDeleteDialog(null);
        await fetchTransactions(); // Refresh the list
      } else {
        const delMsg = (response as any).message || 'Delete failed';
        logTransactionOperation('delete', transactionId, null, null, new Error(delMsg));
        toast.error(delMsg);
      }
    } catch (error: any) {
      console.error('Error deleting transaction:', error);
      logTransactionOperation('delete', transactionId, null, null, error);

      // Handle specific error cases
      if (error.response?.status === 403) {
        toast.error('You do not have permission to delete transactions. Please contact an administrator.');
      } else if (error.response?.status === 401) {
        toast.error('Your session has expired. Please log in again.');
      } else if (error.response?.data?.errors) {
        const errorMessages = error.response.data.errors.map((err: any) => err.message).join(', ');
        toast.error(`Cannot delete transaction: ${errorMessages}`);
      } else if (error.response?.status === 400) {
        toast.error(error.response.data?.message || 'Cannot delete this transaction due to business rules');
      } else if (error.response?.status === 404) {
        toast.error('Transaction not found. It may have already been deleted.');
      } else {
        toast.error(error.response?.data?.message || 'Failed to delete transaction. Please try again.');
      }
    } finally {
      setIsDeleting(false);
    }
  };



  // Global search removed – users should use the Filters page instead

  // Show loading state
  if (loading) {
    return <LoadingSpinner message="Loading transactions..." />;
  }

  // Group transactions by date with TX# filter and show/hide logic
  // Use business date string for filtering (considers 6 AM cutoff for daily reset)
  const todayStr = getBusinessDateString();


  let filteredTransactions = txNumberFilter
    ? transactions.filter(t => {
      const num: any = (t as any).transactionNumber;
      if (num == null) return false;

      const transactionNumString = String(num);
      let searchFilterTrimmed = txNumberFilter.trim();

      // If search is purely numeric, try exact numeric match first
      if (/^[0-9]+$/.test(searchFilterTrimmed)) {
        const searchNumber = parseInt(searchFilterTrimmed, 10);
        const transactionNumber = parseInt(transactionNumString, 10);

        // Exact match for single or double digit searches (below 100)
        if (searchNumber < 100) {
          return transactionNumber === searchNumber;
        }

        // For larger numbers (100+), use starts-with logic for partial matching
        return transactionNumString.startsWith(String(searchNumber));
      }

      // For non-numeric searches (e.g., "T6", "TX5"), use includes
      return transactionNumString.includes(searchFilterTrimmed);
    })
    : transactions;


  // Apply UI Filters for Ledger, Type, Date
  filteredTransactions = filteredTransactions.filter(t => {
    // Ledger Filter
    if (selectedLedger !== 'all' && t.ledgerId !== selectedLedger) return false;

    // Type Filter (Debit/Credit)
    if (selectedType !== 'all' && t.type !== selectedType) return false;

    // Date Range Filter
    const transactionDate = new Date(t.date);
    transactionDate.setHours(0, 0, 0, 0); // Normalize time

    if (startDate) {
      const start = new Date(startDate);
      start.setHours(0, 0, 0, 0);
      if (transactionDate < start) return false;
    }

    if (endDate) {
      const end = new Date(endDate);
      end.setHours(0, 0, 0, 0);
      if (transactionDate > end) return false;
    }

    return true;
  });




  // Apply show/hide filter - if not showing all, only show today's transactions
  // BUT, bypass this filter when:
  //   - a transaction number search is active
  //   - date range filters (startDate/endDate) are applied from the Filters page
  //   - any other filter (ledger, type) is active
  const hasActiveFilterFromFiltersPage = startDate || endDate || selectedLedger !== 'all' || selectedType !== 'all';
  if (!showAllTransactions && !txNumberFilter && !hasActiveFilterFromFiltersPage) {
    filteredTransactions = filteredTransactions.filter(t => {
      const transactionDate = format(new Date(t.date), 'yyyy-MM-dd');
      return transactionDate === todayStr;
    });
  }

  const transactionsByDate = filteredTransactions.reduce<Record<string, Transaction[]>>((acc, transaction) => {
    const date = format(new Date(transaction.date), 'yyyy-MM-dd');
    if (!acc[date]) {
      acc[date] = [];
    }
    acc[date].push(transaction);
    return acc;
  }, {});

  // ============================================================================
  // SERIAL NUMBER LOGIC (IMPORTANT!)
  // ============================================================================
  // SL NO: Restarts at 1 for each date (daily basis)
  // TX #: Global transaction number (unique, continues across all dates)
  // ============================================================================
  // We don't need global serial numbers anymore - SL NO is per-date index
  // TX # comes from transaction.transactionNumber (from backend, globally unique)
  // ============================================================================

  // Check if we should show empty table for today
  const shouldShowEmptyTable = !showAllTransactions && Object.keys(transactionsByDate).length === 0;
  // const hasTransactionsForToday = !showAllTransactions && Object.keys(transactionsByDate).length > 0;

  // Calculate today's opening balance based on ALL previous days' transactions
  // This ensures the correct opening balance even when today has no transactions
  // Rule: Yesterday's closing balance = Today's opening balance
  let todayOpeningBalance = openingBalanceAmount;

  // Always calculate today's opening from previous days (whether today has transactions or not)
  // Get ALL transactions (not filtered by today)
  const allTransactionDates = Object.keys(
    transactions.reduce((acc, t) => {
      const d = format(new Date(t.date), 'yyyy-MM-dd');
      if (!acc[d]) acc[d] = [];
      acc[d].push(t);
      return acc;
    }, {} as Record<string, typeof transactions>)
  ).sort();

  if (allTransactionDates.length > 0) {
    // Start with the first date's opening balance
    const firstDate = allTransactionDates[0];
    let runningBalance = openingByDate[firstDate] !== undefined
      ? openingByDate[firstDate]
      : openingBalanceAmount;



    // Accumulate through ALL previous dates (before today)
    for (const date of allTransactionDates) {
      if (date >= todayStr) {
        break; // Stop when we reach today
      }

      // Get transactions for this date (only approved ones count toward balance)
      const dayTransactions = transactions.filter(t => format(new Date(t.date), 'yyyy-MM-dd') === date && t.status !== 'pending');
      const dayCredit = dayTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + (t.creditAmount || 0), 0);
      const dayDebit = dayTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + (t.debitAmount || 0), 0);



      // Calculate this date's closing (which becomes next day's opening)
      runningBalance = runningBalance + dayCredit - dayDebit;


    }

    // The accumulated balance is today's opening
    todayOpeningBalance = runningBalance;

  } else if (openingByDate[todayStr] !== undefined) {
    // If backend has today's opening balance, use it
    todayOpeningBalance = openingByDate[todayStr];
  } else {
    // No previous transactions, use system opening
    todayOpeningBalance = openingBalanceAmount;

  }

  // Determine if there are no transactions to display after all filters
  const noTransactionsToDisplay = filteredTransactions.length === 0;
  const hasActiveFilters = Boolean(startDate || endDate || selectedLedger !== 'all' || selectedType !== 'all' || txNumberFilter);

  // If no transactions are found after filtering, and not currently loading, show empty table
  if (noTransactionsToDisplay && !loading) {
    return (
      <div className="space-y-3">
        {/* Compact Header */}
        <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-950 text-white p-4 rounded-lg shadow-lg">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <h1 className="text-xl font-bold">Transactions</h1>
              <span className="ml-3 px-2 py-0.5 bg-white/20 rounded text-xs font-medium">Opening: {formatCurrency(todayOpeningBalance)}</span>
            </div>
            <button
              onClick={() => navigate('/transactions')}
              className="px-3 py-1.5 bg-red-600 text-white rounded text-xs font-medium hover:bg-red-700"
            >
              + Add Transaction
            </button>
          </div>
        </div>

        {/* Empty Transaction Table */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg overflow-hidden">
          <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                <span className="text-blue-600 dark:text-blue-400 mr-2">NO TRANSACTIONS FOUND</span>
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
                {hasActiveFilters ? "No results found for active filters." : `Opening Balance: ${formatCurrency(todayOpeningBalance)}`}
              </p>
            </div>
          </div>

          <div className="overflow-x-auto shadow-xl rounded-lg border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
            <table className="w-full border-collapse">
              <thead>
                <tr className="bg-gray-200 dark:bg-gray-700">
                  <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center w-10 bg-gray-100 dark:bg-gray-700 font-bold text-xs dark:text-gray-200">SL</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center w-20 bg-blue-100 dark:bg-blue-900/30 font-bold text-xs dark:text-blue-300">DATE</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center w-14 bg-indigo-100 dark:bg-indigo-900/30 font-bold text-xs dark:text-indigo-300">TX #</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center w-16 bg-blue-100 dark:bg-blue-900/30 font-bold text-xs dark:text-blue-300">TYPE</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-green-100 dark:bg-green-900/30 font-bold text-xs dark:text-green-300">AMOUNT</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-yellow-100 dark:bg-yellow-900/30 font-bold text-xs dark:text-yellow-300">LEDGER</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-blue-50 dark:bg-blue-900/20 font-bold text-xs dark:text-blue-300">REMARKS</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center w-20 bg-orange-100 dark:bg-orange-900/30 font-bold text-xs dark:text-orange-300">STATUS</th>
                  <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center w-20 bg-gray-200 dark:bg-gray-700 font-bold text-xs dark:text-gray-200">ACTIONS</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-gray-500 dark:text-gray-400">
                    <div className="flex flex-col items-center space-y-4">
                      <div className="text-4xl text-gray-300 dark:text-gray-500 mb-2">📋</div>
                      <p className="text-lg font-medium dark:text-gray-300">No transactions to display</p>
                      <p className="text-sm dark:text-gray-400">
                        {hasActiveFilters ? 'Try adjusting or clearing your filters' : 'Start by creating your first transaction'}
                      </p>

                      {/* Show helpful action buttons */}
                      <div className="flex flex-col sm:flex-row gap-3 mt-4">
                        <button
                          onClick={() => navigate('/transactions')}
                          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-medium"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          Add New Transaction
                        </button>

                        {transactions.length > 0 && !showAllTransactions && !hasActiveFilters && (
                          <button
                            onClick={() => setShowAllTransactions(true)}
                            className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors flex items-center justify-center font-medium"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                            Show All Transactions
                          </button>
                        )}

                        {hasActiveFilters && (
                          <button
                            onClick={clearFilters}
                            className="px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors flex items-center justify-center font-medium"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                            Clear Filters
                          </button>
                        )}
                      </div>
                    </div>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          {/* Daily Summary for empty state */}
          <div className="px-6 py-4 bg-gray-800 text-white">
            <div className="flex justify-between items-center">
              <span className="text-lg font-semibold">DAILY TOTALS:</span>
              <div className="flex space-x-4">
                <span className="bg-green-600 px-4 py-2 rounded-md font-medium">
                  CREDIT: {formatCurrency(0)}
                </span>
                <span className="bg-red-600 px-4 py-2 rounded-md font-medium">
                  DEBIT: {formatCurrency(0)}
                </span>
                <span className="bg-gray-600 px-4 py-2 rounded-md font-medium">
                  CLOSING: {formatCurrency(todayOpeningBalance)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Clear Search Button */}
        {txNumberFilter && (
          <div className="text-center">
            <button
              onClick={clearFilters}
              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
            >
              Clear Search & Show All Transactions
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Compact Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-800 dark:from-blue-800 dark:to-blue-950 text-white p-4 rounded-xl shadow-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center">
            <h1 className="text-xl font-bold">Transaction Records</h1>
            {(() => {
              const hasFilters = startDate || endDate || selectedLedger !== 'all' || selectedType !== 'all' || txNumberFilter;
              if (!hasFilters) return null;
              const totalTx = transactions.length;
              return (
                <span className="ml-2 px-2 py-0.5 bg-white/20 rounded text-xs">
                  ✓ {totalTx} filtered
                </span>
              );
            })()}
          </div>
          <div className="flex items-center space-x-2">
            <span className="px-2 py-0.5 bg-white/20 rounded text-xs font-medium">
              Opening: {formatCurrency(todayOpeningBalance)}
            </span>

            {/* Global Search removed – use Advanced Filters instead */}

            <button
              onClick={() => navigate('/transactions/filters')}
              className="p-1 text-white hover:bg-white hover:bg-opacity-10 rounded transition-colors border border-white border-opacity-30"
              title="Advanced Filters"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 7.707A1 1 0 013 7V3z" clipRule="evenodd" />
              </svg>
            </button>

            {transactions.length > 0 && (
              <button
                onClick={() => setShowAllTransactions(!showAllTransactions)}
                className={`px-2 py-1 rounded text-xs transition-colors flex items-center border border-white border-opacity-30 ${showAllTransactions
                  ? 'bg-white text-blue-600 hover:bg-blue-50'
                  : 'bg-white bg-opacity-20 text-white hover:bg-white hover:bg-opacity-30'
                  }`}
                title={showAllTransactions ? "Hide old transactions" : "Show all transactions"}
              >
                <Eye className="w-3 h-3 mr-1" />
                <span className="font-medium">
                  {showAllTransactions ? 'Hide' : 'Show'}
                </span>
              </button>
            )}

            <button
              onClick={() => navigate('/transactions')}
              className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-all flex items-center text-sm font-semibold shadow-sm hover:shadow-md active:scale-[0.98]"
            >
              <span>+ Add Transaction</span>
            </button>
          </div>
        </div>
      </div>

      {/* Active Filters Indicator */}
      {(selectedLedger !== 'all' || selectedType !== 'all' || startDate || endDate || txNumberFilter) && (
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4 transition-colors">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M3 3a1 1 0 011-1h12a1 1 0 011 1v3a1 1 0 01-.293.707L12 11.414V15a1 1 0 01-.293.707l-2 2A1 1 0 018 17v-5.586L3.293 7.707A1 1 0 013 7V3z" clipRule="evenodd" />
              </svg>
              <span className="text-sm font-medium text-blue-900 dark:text-blue-200">Active Filters:</span>
              <div className="flex flex-wrap gap-2">
                {selectedLedger !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    Ledger: {ledgers.find(l => l.id === selectedLedger)?.name || 'Selected'}
                  </span>
                )}
                {selectedType !== 'all' && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    Type: {selectedType}
                  </span>
                )}
                {startDate && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    From: {startDate}
                  </span>
                )}
                {endDate && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    To: {endDate}
                  </span>
                )}
                {txNumberFilter && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded text-xs">
                    TX#: {txNumberFilter}
                  </span>
                )}
              </div>
            </div>
            <button
              onClick={clearFilters}
              className="px-3 py-1.5 bg-white dark:bg-gray-800 border border-blue-300 dark:border-blue-700 text-blue-700 dark:text-blue-300 rounded-lg hover:bg-blue-50 dark:hover:bg-gray-700 transition-colors text-sm font-semibold"
            >
              Clear Filters
            </button>
          </div>
        </div>
      )}

      {/* Transaction List */}
      <div className="space-y-6">
        {shouldShowEmptyTable ? (
          // Show empty table for today when no transactions exist
          <div key={todayStr} className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700 transition-colors">
            <div className="px-6 py-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-700 flex justify-between items-center">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 flex items-center">
                  <span className="text-blue-600 mr-2">{safeFormatDate(todayStr, 'MMM dd yyyy').toUpperCase()}</span>
                  {(new Date().getHours() < 6 || (new Date().getHours() === 6 && new Date().getMinutes() < 30)) && (
                    <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded ml-2">
                      Business Day (Before 6:30 AM)
                    </span>
                  )}
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">Opening: {formatCurrency(todayOpeningBalance)}</p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full">
                <thead>
                  <tr className="border-b border-gray-200 dark:border-gray-600">
                    <th className="text-left py-1 px-1.5 bg-blue-50 dark:bg-blue-900/20 font-medium text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider border-r border-gray-200 dark:border-gray-600" style={{ width: '60px' }}>
                      SL. NO
                    </th>
                    <th className="text-left py-1 px-1.5 bg-blue-50 dark:bg-blue-900/20 font-medium text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider border-r border-gray-200 dark:border-gray-600" style={{ width: '100px' }}>
                      DATE
                    </th>
                    <th className="text-center py-1 px-1.5 bg-green-50 dark:bg-green-900/20 font-medium text-gray-700 dark:text-green-300 text-xs uppercase tracking-wider border-r border-gray-200 dark:border-gray-600" style={{ width: '180px' }}>
                      CREDIT
                    </th>
                    <th className="text-center py-1 px-1.5 bg-red-50 dark:bg-red-900/20 font-medium text-gray-700 dark:text-red-300 text-xs uppercase tracking-wider border-r border-gray-200 dark:border-gray-600" style={{ width: '180px' }}>
                      DEBIT
                    </th>
                    <th className="text-center py-1 px-1.5 bg-blue-50 dark:bg-blue-900/20 font-medium text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider border-r border-gray-200 dark:border-gray-600" style={{ width: '100px' }}>
                      STATUS
                    </th>
                    <th className="text-center py-1 px-1.5 bg-blue-50 dark:bg-blue-900/20 font-medium text-gray-700 dark:text-gray-300 text-xs uppercase tracking-wider" style={{ width: '100px' }}>
                      ACTIONS
                    </th>
                  </tr>
                  <tr className="border-b border-gray-300 dark:border-gray-600">
                    <th className="text-center py-1 px-1.5 bg-gray-100 dark:bg-gray-700 font-medium text-gray-600 dark:text-gray-300 text-xs border-r border-gray-200 dark:border-gray-600">#</th>
                    <th className="text-center py-1 px-1.5 bg-gray-100 dark:bg-gray-700 font-medium text-gray-600 dark:text-gray-300 text-xs border-r border-gray-200 dark:border-gray-600">DATE</th>
                    <th className="text-center py-1 px-1.5 bg-green-100 dark:bg-green-900/30 font-medium text-gray-600 dark:text-green-300 text-xs border-r border-gray-200 dark:border-gray-600" colSpan={3}>
                      <div className="grid grid-cols-3 gap-1">
                        <span>TX #</span>
                        <span>AMOUNT</span>
                        <span>LEDGER</span>
                      </div>
                    </th>
                    <th className="text-center py-1 px-1.5 bg-red-100 dark:bg-red-900/30 font-medium text-gray-600 dark:text-red-300 text-xs border-r border-gray-200 dark:border-gray-600" colSpan={3}>
                      <div className="grid grid-cols-3 gap-1">
                        <span>TX #</span>
                        <span>AMOUNT</span>
                        <span>LEDGER</span>
                      </div>
                    </th>
                    <th className="text-center py-1 px-1.5 bg-gray-100 dark:bg-gray-700 font-medium text-gray-600 dark:text-gray-300 text-xs border-r border-gray-200 dark:border-gray-600">STATUS</th>
                    <th className="text-center py-1 px-1.5 bg-gray-100 dark:bg-gray-700 font-medium text-gray-600 dark:text-gray-300 text-xs">EDIT/DELETE</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td colSpan={9} className="px-6 py-8 text-center text-gray-500 dark:text-gray-400">
                      <div className="flex flex-col items-center space-y-4">
                        <div className="text-3xl text-blue-300 dark:text-blue-500 mb-2">🌅</div>
                        <p className="text-lg font-medium dark:text-gray-300">Fresh Day - No Transactions Yet</p>
                        <p className="text-sm dark:text-gray-400">Opening balance: {formatCurrency(todayOpeningBalance)}</p>
                        {(new Date().getHours() < 6 || (new Date().getHours() === 6 && new Date().getMinutes() < 30)) && (
                          <p className="text-xs text-yellow-600 bg-yellow-100 px-3 py-1 rounded-full">
                            Business Day (Before 6:30 AM)
                          </p>
                        )}

                        {/* Show helpful action buttons for fresh day */}
                        <div className="flex flex-col sm:flex-row gap-3 mt-4">
                          <button
                            onClick={() => navigate('/transactions')}
                            className="px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center font-medium"
                          >
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                            </svg>
                            Start First Transaction
                          </button>

                          {transactions.length > 0 && (
                            <button
                              onClick={() => setShowAllTransactions(true)}
                              className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center justify-center font-medium"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                              </svg>
                              View Previous Days
                            </button>
                          )}
                        </div>
                      </div>
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            {/* Daily Summary for empty day */}
            <div className="px-6 py-4 bg-gray-800 text-white">
              <div className="flex justify-between items-center">
                <span className="text-lg font-semibold">DAILY TOTALS:</span>
                <div className="flex space-x-4">
                  <span className="bg-green-600 px-4 py-2 rounded-md font-medium">
                    CREDIT: {formatCurrency(0)}
                  </span>
                  <span className="bg-red-600 px-4 py-2 rounded-md font-medium">
                    DEBIT: {formatCurrency(0)}
                  </span>
                  <span className="bg-gray-600 px-4 py-2 rounded-md font-medium">
                    CLOSING: {formatCurrency(todayOpeningBalance)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          // ✅ SMART DISPLAY LOGIC:
          // - NO FILTERS: Show one date per page (date-based pagination)
          // - WITH FILTERS: Show ALL matching dates/transactions at once
          <>
            {(() => {
              const sortedDates = Object.entries(transactionsByDate)
                .sort(([dateA], [dateB]) => new Date(dateB).getTime() - new Date(dateA).getTime());

              // ✅ FIX: When filters are active, show ALL dates on one page
              // When no filters, paginate 1 date per page to prevent DOM freezing
              const hasActiveFiltersForPagination = startDate || endDate || selectedLedger !== 'all' || selectedType !== 'all' || txNumberFilter;
              const datesToShow = hasActiveFiltersForPagination
                ? sortedDates  // Show ALL dates when filters active
                : sortedDates.slice((currentDatePage - 1) * datesPerPage, currentDatePage * datesPerPage);

              return datesToShow.map(([date, dailyTransactions]) => {
                // Sort transactions by transaction number
                const sortedTransactions = [...dailyTransactions].sort((a, b) =>
                  (a.transactionNumber || 0) - (b.transactionNumber || 0)
                );

                // ✅ Warning if date has more than 120 transactions
                const hasMany = sortedTransactions.length > 120;
                if (hasMany) {
                }

                const dailyCredit = sortedTransactions
                  .filter(t => t.type === 'credit' && t.status !== 'pending')
                  .reduce((sum, t) => sum + (t.creditAmount || 0), 0);

                const dailyDebit = sortedTransactions
                  .filter(t => t.type === 'debit' && t.status !== 'pending')
                  .reduce((sum, t) => sum + (t.debitAmount || 0), 0);

                // Calculate opening balance specific to this date
                // ALWAYS calculate from previous day's closing to ensure accuracy after edits
                const allDates = Object.keys(transactionsByDate).sort();
                const currentDateIndex = allDates.indexOf(date);

                let openingBalanceForDay: number;

                if (currentDateIndex === 0) {
                  // First date: Try backend, then global opening balance
                  if (openingByDate[date] !== undefined) {
                    openingBalanceForDay = openingByDate[date];
                  } else {
                    openingBalanceForDay = openingBalanceAmount;
                  }
                } else {
                  // For any date after the first: Calculate from ALL previous dates
                  // This ensures continuity even after edits/deletes

                  // Start with the first date's opening balance
                  const firstDate = allDates[0];
                  let runningBalance = openingByDate[firstDate] !== undefined
                    ? openingByDate[firstDate]
                    : openingBalanceAmount;

                  // Accumulate through each previous date to get current date's opening
                  for (let i = 0; i < currentDateIndex; i++) {
                    const prevDate = allDates[i];

                    // Calculate that date's closing balance (which becomes next day's opening)
                    const prevTransactions = (transactionsByDate[prevDate] || []).filter(t => t.status !== 'pending');
                    const prevCredit = prevTransactions.filter(t => t.type === 'credit').reduce((sum, t) => sum + (t.creditAmount || 0), 0);
                    const prevDebit = prevTransactions.filter(t => t.type === 'debit').reduce((sum, t) => sum + (t.debitAmount || 0), 0);

                    // Closing balance = Opening + Credit - Debit
                    runningBalance = runningBalance + prevCredit - prevDebit;
                  }

                  openingBalanceForDay = runningBalance;
                }

                // Use todayOpeningBalance for today, calculated value for other dates
                const finalOpeningBalance = date === todayStr ? todayOpeningBalance : openingBalanceForDay;

                // Calculate closing balance: Opening + Credit - Debit
                const closingBalance = finalOpeningBalance + dailyCredit - dailyDebit;

                return (
                  <motion.div
                    key={date}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden mb-6 border border-gray-200 dark:border-gray-700 transition-colors"
                  >
                    {/* Header with Date */}
                    <div className="flex flex-col md:flex-row md:items-center md:justify-between bg-blue-50 dark:bg-gray-700/50 p-3 border-b border-gray-200 dark:border-gray-700 space-y-2 md:space-y-0">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-blue-800 dark:text-blue-300 font-medium">
                            {safeFormatDate(date, 'MMM dd yyyy').toUpperCase()}
                          </span>
                          {hasMany && (
                            <span className="px-2 py-1 text-xs bg-yellow-100 text-yellow-800 rounded font-medium">
                              ⚠️ {sortedTransactions.length} records (max recommended: 120)
                            </span>
                          )}
                        </div>
                        <div className="mt-1">
                          <span className="px-3 py-1.5 rounded bg-blue-600 text-white font-bold">OPENING: {formatCurrency(finalOpeningBalance)}</span>
                        </div>
                      </div>
                      <div className="flex items-end space-x-2">
                        {date !== todayStr && (
                          <button
                            onClick={() => {
                              setExpandedDates(prev => {
                                const copy = new Set(prev);
                                if (copy.has(date)) copy.delete(date); else copy.add(date);
                                return copy;
                              });
                            }}
                            className="px-2 py-1 text-xs rounded border border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-300 hover:bg-blue-100 dark:hover:bg-blue-900/30"
                          >
                            {expandedDates.has(date) ? 'Hide' : 'Show'}
                          </button>
                        )}
                        <div className="flex flex-col items-end space-y-1">
                          <div className="flex space-x-2">
                            <button
                              onClick={() => handleExport('pdf', date, dailyTransactions, dailyDebit, dailyCredit)}
                              disabled={exportLoading}
                              className={`flex items-center px-2 py-1 text-xs rounded border transition-colors ${exportLoading
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                                : 'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 border-red-200 dark:border-red-700'
                                }`}
                              title="Export as PDF"
                            >
                              {exportLoading ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-red-600 mr-1"></div>
                                  <span>Exporting...</span>
                                </div>
                              ) : (
                                <>
                                  <FileText className="h-3.5 w-3.5 mr-1" />
                                  <span>PDF</span>
                                </>
                              )}
                            </button>
                            <button
                              onClick={() => handleExport('csv', date, dailyTransactions, dailyDebit, dailyCredit)}
                              disabled={exportLoading}
                              className={`flex items-center px-2 py-1 text-xs rounded border transition-colors ${exportLoading
                                ? 'bg-gray-100 dark:bg-gray-700 text-gray-400 border-gray-200 dark:border-gray-600 cursor-not-allowed'
                                : 'text-green-600 dark:text-green-400 hover:bg-green-50 dark:hover:bg-green-900/20 border-green-200 dark:border-green-700'
                                }`}
                              title="Export as Excel"
                            >
                              {exportLoading ? (
                                <div className="flex items-center">
                                  <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-green-600 mr-1"></div>
                                  <span>Exporting...</span>
                                </div>
                              ) : (
                                <>
                                  <FileDown className="h-3.5 w-3.5 mr-1" />
                                  <span>Excel</span>
                                </>
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Transaction Table - Inline Format */}
                    <div className="overflow-x-auto shadow-xl rounded-xl border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800">
                      <table className="w-full border-collapse" style={{ tableLayout: 'fixed' }}>
                        <colgroup>
                          <col style={{ width: '4%' }} />   {/* SL */}
                          <col style={{ width: '10%' }} />  {/* DATE */}
                          <col style={{ width: '5%' }} />   {/* TX # */}
                          <col style={{ width: '7%' }} />   {/* TYPE */}
                          <col style={{ width: '12%' }} />  {/* AMOUNT */}
                          <col style={{ width: '15%' }} />  {/* LEDGER */}
                          <col style={{ width: '30%' }} />  {/* REMARKS */}
                          <col style={{ width: '9%' }} />   {/* STATUS */}
                          <col style={{ width: '8%' }} />   {/* ACTIONS */}
                        </colgroup>
                        <thead>
                          <tr className="bg-gray-200 dark:bg-gray-700">
                            <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-gray-100 dark:bg-gray-700 font-bold text-xs dark:text-gray-200">SL</th>
                            <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-blue-100 dark:bg-blue-900/30 font-bold text-xs dark:text-blue-300">DATE</th>
                            <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-indigo-100 dark:bg-indigo-900/30 font-bold text-xs dark:text-indigo-300">TX #</th>
                            <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-blue-100 dark:bg-blue-900/30 font-bold text-xs dark:text-blue-300">TYPE</th>
                            <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-left bg-green-100 dark:bg-green-900/30 font-bold text-xs dark:text-green-300">AMOUNT</th>
                            <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-left bg-yellow-100 dark:bg-yellow-900/30 font-bold text-xs dark:text-yellow-300">LEDGER</th>
                            <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-left bg-blue-50 dark:bg-blue-900/20 font-bold text-xs dark:text-blue-300">REMARKS</th>
                            <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-orange-100 dark:bg-orange-900/30 font-bold text-xs dark:text-orange-300">STATUS</th>
                            <th className="border border-gray-400 dark:border-gray-600 px-1.5 py-1 text-center bg-gray-200 dark:bg-gray-700 font-bold text-xs dark:text-gray-200">ACTIONS</th>
                          </tr>
                        </thead>
                        <tbody>
                          {sortedTransactions.map((transaction, index) => {
                            const isCredit = transaction.type === 'credit';
                            const amount = isCredit ? transaction.creditAmount : transaction.debitAmount;

                            // SL NO: Per-date serial number (starts at 1 for each date)
                            const dailySerialNumber = index + 1;

                            // const isSelected = selectedTransaction === transaction.id;


                            return (
                              <tr key={transaction.id} className={`hover:bg-gray-50 dark:hover:bg-gray-700/50 ${index % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-800/60'}`}>
                                <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs dark:text-gray-300">
                                  {dailySerialNumber}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs dark:text-gray-300">
                                  {safeFormatDate(transaction.date, 'dd/MM/yyyy')}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs font-medium dark:text-gray-300">
                                  {transaction.transactionNumber ? String(transaction.transactionNumber).padStart(2, '0') : '-'}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs font-medium">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-xs font-medium ${isCredit
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300'
                                    : 'bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300'
                                    }`}>
                                    {isCredit ? 'Credit' : 'Debit'}
                                  </span>
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-left text-xs font-medium">
                                  <span className={isCredit ? 'text-green-700 dark:text-green-400' : 'text-red-700 dark:text-red-400'}>
                                    {formatCurrency(amount)}
                                    {transaction.reference === 'A' && (
                                      <span className="ml-1 text-xs font-bold text-blue-500" title="Combined with Anamath">A</span>
                                    )}
                                  </span>
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-left text-xs dark:text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap" title={transaction.ledger?.name || '-'}>
                                  {transaction.ledger?.name || '-'}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-left text-xs dark:text-gray-300 overflow-hidden text-ellipsis whitespace-nowrap" title={transaction.remarks || ''}>
                                  {transaction.remarks || ''}
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-center text-xs">
                                  <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-bold uppercase ${(transaction.status || 'approved') === 'approved'
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : (transaction.status || 'approved') === 'pending'
                                      ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400 animate-pulse'
                                      : 'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                                    }`}>
                                    {transaction.status || 'approved'}
                                  </span>
                                </td>
                                <td className="border border-gray-300 dark:border-gray-600 px-1.5 py-1 text-right">
                                  <div className="flex justify-end items-center space-x-1">
                                    {transaction.status === 'pending' && (() => {
                                      const isCreditTx = transaction.type === 'credit';
                                      const isCombinedTx = transaction.transactionType === 'combined';
                                      // Combined/anamath requires Admin or Owner
                                      const canApprove = isCombinedTx
                                        ? canApproveCredit(user?.role) // Admin + Owner only
                                        : isCreditTx ? canApproveCredit(user?.role) : canApproveDebit(user?.role);
                                      return canApprove ? (
                                        <>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleApprove(transaction.id);
                                          }}
                                          disabled={isApproving === transaction.id}
                                          className="p-1 rounded text-emerald-600 hover:text-emerald-800 hover:bg-emerald-50 dark:hover:bg-emerald-900/30 transition-colors"
                                          title={isCombinedTx ? 'Approve Combined (Admin/Owner)' : isCreditTx ? 'Approve Credit (Admin/Owner)' : 'Approve Debit'}
                                        >
                                          {isApproving === transaction.id ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-emerald-600"></div>
                                          ) : (
                                            <CheckCircle size={16} />
                                          )}
                                        </button>
                                        <button
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            handleReject(transaction.id);
                                          }}
                                          disabled={isRejecting === transaction.id}
                                          className="p-1 rounded text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                                          title="Reject"
                                        >
                                          {isRejecting === transaction.id ? (
                                            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-500"></div>
                                          ) : (
                                            <XCircle size={16} />
                                          )}
                                        </button>
                                        </>
                                      ) : null;
                                    })()}

                                    {canEditTransactions && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          // Block editing of pure Anamath records only (not combined transactions)
                                          // Combined transactions have transactionType === 'combined'
                                          const isPureAnamath = transaction.reference === 'A' && transaction.transactionType !== 'combined';
                                          if (isPureAnamath) {
                                            toast.info('Pure Anamath transactions cannot be edited directly. Please use the Anamath section to make changes.');
                                            return;
                                          }
                                          handleEditTransaction(transaction);
                                        }}
                                        className={`p-1 rounded ${
                                          // Only gray out pure Anamath records, not combined transactions
                                          (transaction.reference === 'A' && transaction.transactionType !== 'combined')
                                            ? 'text-gray-400 cursor-not-allowed'
                                            : 'text-blue-600 hover:text-blue-800 hover:bg-blue-50'
                                          }`}
                                        title={
                                          (transaction.reference === 'A' && transaction.transactionType !== 'combined')
                                            ? 'Pure Anamath transactions cannot be edited directly'
                                            : 'Edit transaction'
                                        }
                                      >
                                        <Edit3 size={16} />
                                      </button>
                                    )}

                                    {canDeleteTransactions && (
                                      <button
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setShowDeleteDialog(transaction.id);
                                        }}
                                        className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-50"
                                        title="Delete transaction"
                                      >
                                        <Trash2 size={16} />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr className="bg-gray-800">
                            <td colSpan={10} className="px-4 py-2 text-right text-sm font-semibold text-white">
                              <div className="flex justify-between items-center">
                                <span>DAILY TOTALS:</span>
                                <div className="flex space-x-4">
                                  <span className="bg-green-600 text-white px-3 py-1 rounded">
                                    CREDIT: {formatCurrency(dailyCredit)}
                                  </span>
                                  <span className="bg-red-600 text-white px-3 py-1 rounded">
                                    DEBIT: {formatCurrency(dailyDebit)}
                                  </span>
                                  <span className="bg-gray-700 text-white px-3 py-1 rounded">
                                    CLOSING: {formatCurrency(closingBalance)}
                                  </span>
                                </div>
                              </div>
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </motion.div>
                );
              });
            })()}

            {/* ✅ Date-Based Pagination Controls */}
            {(() => {
              const totalDates = Object.keys(transactionsByDate).length;

              // Hide date pagination when filters are active (all dates shown on one page)
              const hasActiveFiltersForPagination = startDate || endDate || selectedLedger !== 'all' || selectedType !== 'all' || txNumberFilter;
              if (totalDates <= 1 || hasActiveFiltersForPagination) return null;

              return (
                <div className="mt-6 flex flex-col items-center space-y-3">
                  <div className="flex items-center space-x-4">
                    <button
                      onClick={() => setCurrentDatePage(prev => Math.max(1, prev - 1))}
                      disabled={currentDatePage === 1}
                      className={`px-4 py-2 rounded-lg font-medium ${currentDatePage === 1
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                      ← Previous Date
                    </button>

                    <span className="text-gray-700 dark:text-gray-300 font-medium">
                      Date {currentDatePage} of {totalDates}
                    </span>

                    <button
                      onClick={() => setCurrentDatePage(prev => Math.min(totalDates, prev + 1))}
                      disabled={currentDatePage >= totalDates}
                      className={`px-4 py-2 rounded-lg font-medium ${currentDatePage >= totalDates
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-blue-600 text-white hover:bg-blue-700'
                        }`}
                    >
                      Next Date →
                    </button>
                  </div>

                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    💡 Viewing one date at a time • Apply filters to see all matching records
                  </div>
                </div>
              );
            })()}
          </>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editingTransaction && ReactDOM.createPortal(
        <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
          <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold dark:text-white">Edit Transaction</h3>
              <div className={`px-3 py-1 rounded-full text-xs font-medium ${editingTransaction.type === 'credit'
                ? 'bg-green-100 text-green-800'
                : 'bg-red-100 text-red-800'
                }`}>
                {(editingTransaction.type || 'debit').toUpperCase()}
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Remarks
                </label>
                <input
                  type="text"
                  value={editFormData.remarks}
                  onChange={(e) => {
                    setEditFormData(prev => ({ ...prev, remarks: e.target.value }));
                    if (editFormErrors.remarks) {
                      setEditFormErrors(prev => ({ ...prev, remarks: undefined }));
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200 ${editFormErrors.remarks ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                  placeholder="Enter remarks (optional)"
                  maxLength={500}
                />
                {editFormErrors.remarks && (
                  <p className="mt-1 text-sm text-red-600">{editFormErrors.remarks}</p>
                )}
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
                  {editFormData.remarks.length}/500 characters
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Amount *
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-2 text-gray-500 dark:text-gray-400">₹</span>
                  <input
                    type="text"
                    value={editFormData.displayAmount}
                    onChange={(e) => {
                      const inputValue = e.target.value;
                      // Remove non-numeric characters except commas and dots
                      const cleanValue = inputValue.replace(/[^0-9.,]/g, '');

                      // Parse the cleaned value to get actual number
                      const numericValue = parseIndianNumber(cleanValue);

                      // Format for display (without decimals for whole numbers)
                      const hasDecimal = cleanValue.includes('.');
                      const formattedValue = hasDecimal
                        ? cleanValue // Keep user's decimal input as-is while typing
                        : formatIndianNumber(numericValue, false);

                      setEditFormData(prev => ({
                        ...prev,
                        amount: numericValue,
                        displayAmount: formattedValue
                      }));

                      if (editFormErrors.amount) {
                        setEditFormErrors(prev => ({ ...prev, amount: undefined }));
                      }
                    }}
                    onBlur={() => {
                      // On blur, ensure proper formatting
                      const formatted = formatIndianNumber(editFormData.amount, false);
                      setEditFormData(prev => ({ ...prev, displayAmount: formatted }));
                    }}
                    className={`w-full pl-8 pr-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200 ${editFormErrors.amount ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                      }`}
                    placeholder="1,00,000"
                  />
                </div>
                {editFormErrors.amount && (
                  <p className="mt-1 text-sm text-red-600">{editFormErrors.amount}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Ledger *
                </label>
                <select
                  value={editFormData.ledgerId}
                  onChange={(e) => {
                    setEditFormData(prev => ({ ...prev, ledgerId: e.target.value }));
                    if (editFormErrors.ledgerId) {
                      setEditFormErrors(prev => ({ ...prev, ledgerId: undefined }));
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-700 dark:text-gray-200 ${editFormErrors.ledgerId ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                >
                  <option value="">Select Ledger</option>
                  {ledgers.map(ledger => (
                    <option key={ledger.id} value={ledger.id}>
                      {ledger.name}
                    </option>
                  ))}
                </select>
                {editFormErrors.ledgerId && (
                  <p className="mt-1 text-sm text-red-600">{editFormErrors.ledgerId}</p>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Date *
                </label>
                <DateInput
                  value={editFormData.date}
                  onChange={(val) => {
                    setEditFormData(prev => ({ ...prev, date: val }));
                    if (editFormErrors.date) {
                      setEditFormErrors(prev => ({ ...prev, date: undefined }));
                    }
                  }}
                  className={`w-full px-3 py-2 border rounded-md dark:bg-gray-700 dark:text-gray-200 ${editFormErrors.date ? 'border-red-500' : 'border-gray-300 dark:border-gray-600'
                    }`}
                />
                {editFormErrors.date && (
                  <p className="mt-1 text-sm text-red-600">{editFormErrors.date}</p>
                )}
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <button
                onClick={handleCancelEdit}
                disabled={isEditSaving}
                className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveEdit}
                disabled={isEditSaving || editFormData.amount <= 0 || !editFormData.ledgerId || !editFormData.date}
                className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 dark:disabled:bg-gray-600 disabled:cursor-not-allowed flex items-center space-x-2"
              >
                {isEditSaving && (
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                )}
                <span>{isEditSaving ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Dialog */}
      {showDeleteDialog && ReactDOM.createPortal((() => {
        const transactionToDelete = transactions.find(t => t.id === showDeleteDialog);
        if (!transactionToDelete) return null;

        const amount = transactionToDelete.type === 'credit' ? transactionToDelete.creditAmount : transactionToDelete.debitAmount;

        return (
          <div className="fixed inset-0 bg-black bg-opacity-50 dark:bg-opacity-70 flex items-center justify-center z-50">
            <div className="bg-white dark:bg-gray-800 rounded-lg p-6 w-full max-w-md mx-4 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center mb-4">
                <div className="flex-shrink-0 w-12 h-12 bg-red-100 dark:bg-red-900/30 rounded-full flex items-center justify-center">
                  <Trash2 className="w-6 h-6 text-red-600 dark:text-red-400" />
                </div>
                <div className="ml-4">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Delete Transaction</h3>
                  <p className="text-sm text-gray-500 dark:text-gray-400">This action cannot be undone</p>
                </div>
              </div>

              {/* Transaction Details */}
              <div className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 mb-4">
                <h4 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Transaction Details:</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Type:</span>
                    <span className={`font-medium ${transactionToDelete.type === 'credit' ? 'text-green-600' : 'text-red-600'
                      }`}>
                      {(transactionToDelete.type || 'debit').toUpperCase()}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Amount:</span>
                    <span className="font-medium dark:text-gray-200">{formatCurrency(amount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Ledger:</span>
                    <span className="font-medium dark:text-gray-200">{transactionToDelete.ledger?.name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600 dark:text-gray-400">Date:</span>
                    <span className="font-medium dark:text-gray-200">{safeFormatDate(transactionToDelete.date, 'dd MMM yyyy')}</span>
                  </div>
                  {transactionToDelete.remarks && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Remarks:</span>
                      <span className="font-medium text-right max-w-48 truncate" title={transactionToDelete.remarks}>
                        {transactionToDelete.remarks}
                      </span>
                    </div>
                  )}
                  {transactionToDelete.reference && (
                    <div className="flex justify-between">
                      <span className="text-gray-600 dark:text-gray-400">Reference:</span>
                      <span className="font-medium dark:text-gray-200">{transactionToDelete.reference}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Warning Message */}
              <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3 mb-4">
                <div className="flex">
                  <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mt-0.5" />
                  <div className="ml-3">
                    <p className="text-sm text-red-800 dark:text-red-300">
                      <strong>Warning:</strong> Deleting this transaction will:
                    </p>
                    <ul className="mt-1 text-sm text-red-700 dark:text-red-400 list-disc list-inside">
                      <li>Permanently remove it from your records</li>
                      <li>Adjust the ledger balance by reversing this transaction</li>
                      <li>Cannot be undone once confirmed</li>
                    </ul>
                  </div>
                </div>
              </div>

              <div className="flex justify-end space-x-3">
                <button
                  onClick={() => setShowDeleteDialog(null)}
                  disabled={isDeleting}
                  className="px-4 py-2 text-gray-600 dark:text-gray-300 border border-gray-300 dark:border-gray-600 rounded-md hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleDeleteTransaction(showDeleteDialog)}
                  disabled={isDeleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 transition-colors disabled:bg-red-400 dark:disabled:bg-red-800 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {isDeleting && (
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  )}
                  <span>{isDeleting ? 'Deleting...' : 'Delete Transaction'}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })(), document.body)}



      {/* Server-side Pagination */}
      {(totalPages > 1 || hasMorePages) && (
        <div className="mt-6 flex flex-col items-center space-y-3">
          <div className="flex items-center space-x-4">
            <button
              onClick={() => { setCurrentPage(prev => Math.max(1, prev - 1)); setCurrentDatePage(1); }}
              disabled={currentPage === 1}
              className={`px-4 py-2 rounded-lg font-medium ${currentPage === 1
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              ← Previous Page
            </button>

            <span className="text-gray-700 dark:text-gray-300 font-medium">
              Page {currentPage} of {totalPages}{totalRecords > 0 ? ` (${totalRecords.toLocaleString('en-IN')} records)` : ''}
            </span>

            <button
              onClick={() => { setCurrentPage(prev => Math.min(totalPages, prev + 1)); setCurrentDatePage(1); }}
              disabled={currentPage >= totalPages && !hasMorePages}
              className={`px-4 py-2 rounded-lg font-medium ${currentPage >= totalPages && !hasMorePages
                ? 'bg-gray-300 dark:bg-gray-600 text-gray-500 dark:text-gray-400 cursor-not-allowed'
                : 'bg-blue-600 text-white hover:bg-blue-700'
                }`}
            >
              Next Page →
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default Transactions;