import { openingBalanceService } from '../services/openingBalanceService';
import { Transaction, CreateTransactionData } from '../services/api';
import { format } from 'date-fns';

/**
 * Utility functions for balance calculations and updates
 */

/**
 * Update opening balance after a transaction is created
 */
export const updateBalanceAfterTransaction = async (
  transaction: Transaction | CreateTransactionData,
  ledgerId?: string
): Promise<void> => {
  try {
    const targetLedgerId = ledgerId || transaction.ledgerId;
    if (!targetLedgerId) {
      return;
    }

    const transactionDate = transaction.date || format(new Date(), 'yyyy-MM-dd');
    const creditAmount = transaction.creditAmount || 0;
    const debitAmount = transaction.debitAmount || 0;
    
    // Check if it's an anamath transaction
    const isAnamath = 'type' in transaction && transaction.type === 'anamath';

    await openingBalanceService.updateOpeningBalanceOnTransaction(
      targetLedgerId,
      transactionDate,
      creditAmount,
      debitAmount,
      isAnamath
    );
  } catch (error) {
    console.error('Error updating balance after transaction:', error);
  }
};

/**
 * Calculate running balance for a list of transactions
 */
export const calculateRunningBalance = (
  transactions: Transaction[],
  initialBalance: number = 0
): Transaction[] => {
  return openingBalanceService.calculateRunningBalance(transactions, initialBalance);
};

/**
 * Format currency amount for display
 */
export const formatCurrency = (amount: number): string => {
  return `₹${amount.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
};

/**
 * Get balance change color class based on amount
 */
export const getBalanceChangeColor = (amount: number): string => {
  if (amount > 0) return 'text-green-600';
  if (amount < 0) return 'text-red-600';
  return 'text-gray-600';
};

/**
 * Get balance change indicator (up/down arrow) based on amount
 */
export const getBalanceChangeIndicator = (amount: number): '↑' | '↓' | '→' => {
  if (amount > 0) return '↑';
  if (amount < 0) return '↓';
  return '→';
};

/**
 * Calculate percentage change between two amounts
 */
export const calculatePercentageChange = (oldAmount: number, newAmount: number): number => {
  if (oldAmount === 0) return newAmount === 0 ? 0 : 100;
  return ((newAmount - oldAmount) / Math.abs(oldAmount)) * 100;
};

/**
 * Validate if a balance amount is reasonable
 */
export const validateBalanceAmount = (amount: number): {
  isValid: boolean;
  error?: string;
} => {
  if (isNaN(amount)) {
    return { isValid: false, error: 'Amount must be a valid number' };
  }
  
  if (!isFinite(amount)) {
    return { isValid: false, error: 'Amount must be finite' };
  }
  
  if (Math.abs(amount) > 999999999.99) {
    return { isValid: false, error: 'Amount is too large' };
  }
  
  return { isValid: true };
};

/**
 * Round amount to 2 decimal places for currency calculations
 */
export const roundCurrency = (amount: number): number => {
  return Math.round(amount * 100) / 100;
};

/**
 * Check if two amounts are equal within a small tolerance (for floating point comparison)
 */
export const amountsEqual = (amount1: number, amount2: number, tolerance: number = 0.01): boolean => {
  return Math.abs(amount1 - amount2) < tolerance;
};

/**
 * Get balance status based on amount
 */
export const getBalanceStatus = (amount: number): {
  status: 'positive' | 'negative' | 'zero';
  color: string;
  icon: string;
} => {
  if (amount > 0) {
    return {
      status: 'positive',
      color: 'text-green-600',
      icon: '💰'
    };
  } else if (amount < 0) {
    return {
      status: 'negative',
      color: 'text-red-600',
      icon: '⚠️'
    };
  } else {
    return {
      status: 'zero',
      color: 'text-gray-600',
      icon: '⚖️'
    };
  }
};

/**
 * Calculate daily balance change
 */
export const calculateDailyChange = (
  openingBalance: number,
  closingBalance: number
): {
  amount: number;
  percentage: number;
  isPositive: boolean;
} => {
  const amount = closingBalance - openingBalance;
  const percentage = calculatePercentageChange(openingBalance, closingBalance);
  
  return {
    amount: roundCurrency(amount),
    percentage: roundCurrency(percentage),
    isPositive: amount >= 0
  };
};

/**
 * Group transactions by date for balance calculations
 */
export const groupTransactionsByDate = (transactions: Transaction[]): Record<string, Transaction[]> => {
  return transactions.reduce((groups, transaction) => {
    const date = format(new Date(transaction.date), 'yyyy-MM-dd');
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {} as Record<string, Transaction[]>);
};

/**
 * Calculate balance summary for a list of transactions
 */
export const calculateBalanceSummary = (transactions: Transaction[]): {
  totalCredits: number;
  totalDebits: number;
  netAmount: number;
  transactionCount: number;
} => {
  const summary = transactions.reduce(
    (acc, transaction) => {
      acc.totalCredits += transaction.creditAmount || 0;
      acc.totalDebits += transaction.debitAmount || 0;
      acc.transactionCount += 1;
      return acc;
    },
    {
      totalCredits: 0,
      totalDebits: 0,
      netAmount: 0,
      transactionCount: 0
    }
  );

  summary.netAmount = summary.totalCredits - summary.totalDebits;
  
  return {
    ...summary,
    totalCredits: roundCurrency(summary.totalCredits),
    totalDebits: roundCurrency(summary.totalDebits),
    netAmount: roundCurrency(summary.netAmount)
  };
};