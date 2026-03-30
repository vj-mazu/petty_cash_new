import { useState, useEffect, useCallback } from 'react';
import { openingBalanceService } from '../services/openingBalanceService';
import { OpeningBalance, OpeningBalanceSummary } from '../services/api';
import { toast } from 'react-toastify';

/**
 * Custom hook for managing opening balance data and operations
 */
export const useOpeningBalance = () => {
  const [summary, setSummary] = useState<OpeningBalanceSummary | null>(null);
  const [currentBalances, setCurrentBalances] = useState<OpeningBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * Fetch opening balance summary
   */
  const fetchSummary = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const summaryData = await openingBalanceService.getOpeningBalanceSummary();
      setSummary(summaryData);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch opening balance summary';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch current opening balances
   */
  const fetchCurrentBalances = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const balances = await openingBalanceService.getCurrentOpeningBalances();
      setCurrentBalances(balances);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch current opening balances';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Fetch both summary and current balances
   */
  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      
      const [summaryData, balances] = await Promise.all([
        openingBalanceService.getOpeningBalanceSummary(),
        openingBalanceService.getCurrentOpeningBalances()
      ]);
      
      setSummary(summaryData);
      setCurrentBalances(balances);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch opening balance data';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Set manual opening balance
   */
  const setManualBalance = useCallback(async (
    ledgerId: string, 
    date: string, 
    amount: number,
    reason?: string
  ) => {
    try {
      setLoading(true);
      setError(null);
      
      const success = await openingBalanceService.setManualOpeningBalance(
        ledgerId, 
        date, 
        amount, 
        reason
      );
      
      if (success) {
        toast.success('Manual opening balance set successfully');
        // Refresh data
        await fetchAll();
        return true;
      } else {
        throw new Error('Failed to set manual opening balance');
      }
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to set manual opening balance';
      setError(errorMessage);
      toast.error(errorMessage);
      return false;
    } finally {
      setLoading(false);
    }
  }, [fetchAll]);

  /**
   * Update balance when a transaction is created
   */
  const updateBalanceOnTransaction = useCallback(async (
    ledgerId: string,
    transactionDate: string,
    creditAmount: number = 0,
    debitAmount: number = 0,
    isAnamath: boolean = false
  ) => {
    try {
      await openingBalanceService.updateOpeningBalanceOnTransaction(
        ledgerId,
        transactionDate,
        creditAmount,
        debitAmount,
        isAnamath
      );
      
      // Refresh data after update
      await fetchAll();
    } catch (err: any) {
      console.error('Error updating balance on transaction:', err);
      // Don't show error toast for this as it's a background operation
    }
  }, [fetchAll]);

  /**
   * Validate balance consistency
   */
  const validateConsistency = useCallback(async (ledgerId: string, date: string) => {
    try {
      return await openingBalanceService.validateBalanceConsistency(ledgerId, date);
    } catch (err: any) {
      console.error('Error validating balance consistency:', err);
      return {
        isConsistent: false,
        expectedBalance: 0,
        actualBalance: 0,
        difference: 0
      };
    }
  }, []);

  /**
   * Clear cache and refresh data
   */
  const refreshData = useCallback(async () => {
    openingBalanceService.clearCache();
    await fetchAll();
    toast.success('Opening balance data refreshed');
  }, [fetchAll]);

  /**
   * Get balance history for a ledger
   */
  const getBalanceHistory = useCallback(async (ledgerId: string, days: number = 7) => {
    try {
      return await openingBalanceService.getOpeningBalanceHistory(ledgerId, days);
    } catch (err: any) {
      console.error('Error fetching balance history:', err);
      return [];
    }
  }, []);

  /**
   * Get balance trend for a ledger
   */
  const getBalanceTrend = useCallback(async (ledgerId: string, days: number = 30) => {
    try {
      return await openingBalanceService.getBalanceTrend(ledgerId, days);
    } catch (err: any) {
      console.error('Error fetching balance trend:', err);
      return [];
    }
  }, []);

  // Auto-fetch data on mount
  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    // State
    summary,
    currentBalances,
    loading,
    error,
    
    // Actions
    fetchSummary,
    fetchCurrentBalances,
    fetchAll,
    setManualBalance,
    updateBalanceOnTransaction,
    validateConsistency,
    refreshData,
    getBalanceHistory,
    getBalanceTrend,
    
    // Computed values
    hasData: summary !== null || currentBalances.length > 0,
    totalOpeningBalance: summary?.totalOpeningBalance || 0,
    totalClosingBalance: summary?.totalClosingBalance || 0,
    netChange: summary?.netChange || 0,
    ledgerCount: currentBalances.length
  };
};

/**
 * Hook for managing balance history
 */
export const useBalanceHistory = (ledgerId?: string, days: number = 7) => {
  const [history, setHistory] = useState<OpeningBalance[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchHistory = useCallback(async () => {
    if (!ledgerId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const historyData = await openingBalanceService.getOpeningBalanceHistory(ledgerId, days);
      setHistory(historyData);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch balance history';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ledgerId, days]);

  useEffect(() => {
    fetchHistory();
  }, [fetchHistory]);

  return {
    history,
    loading,
    error,
    refetch: fetchHistory
  };
};

/**
 * Hook for balance trend analysis
 */
export const useBalanceTrend = (ledgerId?: string, days: number = 30) => {
  const [trend, setTrend] = useState<{
    date: string;
    openingBalance: number;
    closingBalance: number;
    netChange: number;
  }[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchTrend = useCallback(async () => {
    if (!ledgerId) return;
    
    try {
      setLoading(true);
      setError(null);
      
      const trendData = await openingBalanceService.getBalanceTrend(ledgerId, days);
      setTrend(trendData);
    } catch (err: any) {
      const errorMessage = err.message || 'Failed to fetch balance trend';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  }, [ledgerId, days]);

  useEffect(() => {
    fetchTrend();
  }, [fetchTrend]);

  return {
    trend,
    loading,
    error,
    refetch: fetchTrend,
    
    // Computed values
    totalChange: trend.length > 0 ? trend[trend.length - 1].closingBalance - trend[0].openingBalance : 0,
    averageChange: trend.length > 0 ? trend.reduce((sum, item) => sum + item.netChange, 0) / trend.length : 0,
    maxBalance: Math.max(...trend.map(item => item.closingBalance), 0),
    minBalance: Math.min(...trend.map(item => item.closingBalance), 0)
  };
};