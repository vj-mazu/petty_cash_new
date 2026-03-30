import React, { createContext, useContext, useCallback, ReactNode } from 'react';
import { openingBalanceService } from '../services/openingBalanceService';
import { OpeningBalance, OpeningBalanceSummary } from '../services/api';
import { updateBalanceAfterTransaction } from '../utils/balanceUtils';

interface OpeningBalanceContextType {
  // Service methods
  calculateDailyBalance: (ledgerId: string, date: string) => Promise<OpeningBalance | null>;
  updateBalanceOnTransaction: (
    ledgerId: string,
    transactionDate: string,
    creditAmount?: number,
    debitAmount?: number,
    isAnamath?: boolean
  ) => Promise<void>;
  setManualBalance: (
    ledgerId: string,
    date: string,
    amount: number,
    reason?: string
  ) => Promise<boolean>;
  getSummary: () => Promise<OpeningBalanceSummary | null>;
  getCurrentBalances: () => Promise<OpeningBalance[]>;
  getBalanceHistory: (ledgerId: string, days?: number) => Promise<OpeningBalance[]>;
  validateConsistency: (ledgerId: string, date: string) => Promise<{
    isConsistent: boolean;
    expectedBalance: number;
    actualBalance: number;
    difference: number;
  }>;
  clearCache: () => void;
  refreshData: () => void;
  
  // Utility methods
  updateAfterTransaction: (transaction: any, ledgerId?: string) => Promise<void>;
}

const OpeningBalanceContext = createContext<OpeningBalanceContextType | undefined>(undefined);

interface OpeningBalanceProviderProps {
  children: ReactNode;
}

export const OpeningBalanceProvider: React.FC<OpeningBalanceProviderProps> = ({ children }) => {
  // Wrap service methods for context
  const calculateDailyBalance = useCallback(async (ledgerId: string, date: string) => {
    return await openingBalanceService.calculateDailyOpeningBalance(ledgerId, date);
  }, []);

  const updateBalanceOnTransaction = useCallback(async (
    ledgerId: string,
    transactionDate: string,
    creditAmount: number = 0,
    debitAmount: number = 0,
    isAnamath: boolean = false
  ) => {
    await openingBalanceService.updateOpeningBalanceOnTransaction(
      ledgerId,
      transactionDate,
      creditAmount,
      debitAmount,
      isAnamath
    );
  }, []);

  const setManualBalance = useCallback(async (
    ledgerId: string,
    date: string,
    amount: number,
    reason?: string
  ) => {
    return await openingBalanceService.setManualOpeningBalance(ledgerId, date, amount, reason);
  }, []);

  const getSummary = useCallback(async () => {
    return await openingBalanceService.getOpeningBalanceSummary();
  }, []);

  const getCurrentBalances = useCallback(async () => {
    return await openingBalanceService.getCurrentOpeningBalances();
  }, []);

  const getBalanceHistory = useCallback(async (ledgerId: string, days: number = 7) => {
    return await openingBalanceService.getOpeningBalanceHistory(ledgerId, days);
  }, []);

  const validateConsistency = useCallback(async (ledgerId: string, date: string) => {
    return await openingBalanceService.validateBalanceConsistency(ledgerId, date);
  }, []);

  const clearCache = useCallback(() => {
    openingBalanceService.clearCache();
  }, []);

  const refreshData = useCallback(() => {
    openingBalanceService.clearCache();
  }, []);

  const updateAfterTransaction = useCallback(async (transaction: any, ledgerId?: string) => {
    await updateBalanceAfterTransaction(transaction, ledgerId);
  }, []);

  const contextValue: OpeningBalanceContextType = {
    calculateDailyBalance,
    updateBalanceOnTransaction,
    setManualBalance,
    getSummary,
    getCurrentBalances,
    getBalanceHistory,
    validateConsistency,
    clearCache,
    refreshData,
    updateAfterTransaction
  };

  return (
    <OpeningBalanceContext.Provider value={contextValue}>
      {children}
    </OpeningBalanceContext.Provider>
  );
};

export const useOpeningBalanceContext = (): OpeningBalanceContextType => {
  const context = useContext(OpeningBalanceContext);
  if (context === undefined) {
    throw new Error('useOpeningBalanceContext must be used within an OpeningBalanceProvider');
  }
  return context;
};

export default OpeningBalanceContext;