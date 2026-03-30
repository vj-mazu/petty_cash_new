import { openingBalanceApi, transactionApi, OpeningBalance, OpeningBalanceSummary, Transaction } from './api';
import { format, subDays, startOfDay, endOfDay } from 'date-fns';

/**
 * Frontend service for opening balance calculations and management
 * Handles daily balance tracking, automatic updates, and manual adjustments
 */
export class OpeningBalanceService {
  private static instance: OpeningBalanceService;
  private balanceCache: Map<string, OpeningBalance> = new Map();
  private summaryCache: OpeningBalanceSummary | null = null;
  private lastCacheUpdate: Date | null = null;
  private readonly CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

  private constructor() {}

  public static getInstance(): OpeningBalanceService {
    if (!OpeningBalanceService.instance) {
      OpeningBalanceService.instance = new OpeningBalanceService();
    }
    return OpeningBalanceService.instance;
  }

  /**
   * Calculate daily opening balance for a specific ledger and date
   */
  public async calculateDailyOpeningBalance(ledgerId: string, date: string): Promise<OpeningBalance | null> {
    try {
      const cacheKey = `${ledgerId}-${date}`;
      
      // Check cache first
      if (this.isCacheValid() && this.balanceCache.has(cacheKey)) {
        return this.balanceCache.get(cacheKey) || null;
      }

      // Calculate opening balance by getting previous day's closing balance
      const targetDate = new Date(date);
      const previousDay = format(subDays(targetDate, 1), 'yyyy-MM-dd');
      
      // Get transactions for the target date
      const transactionsResponse = await transactionApi.getAll({
        ledgerId,
        startDate: date,
        endDate: date,
        limit: 1000 // Get all transactions for the day
      });

      if (!transactionsResponse.success) {
        throw new Error('Failed to fetch transactions for balance calculation');
      }

      const transactions = transactionsResponse.data.transactions || [];
      
      // Calculate totals for the day
      let totalCredits = 0;
      let totalDebits = 0;
      
      transactions.forEach((transaction: Transaction) => {
        totalCredits += transaction.creditAmount || 0;
        totalDebits += transaction.debitAmount || 0;
      });

      // Get previous day's closing balance (which becomes today's opening balance)
      let openingAmount = 0;
      try {
        const previousBalanceResponse = await openingBalanceApi.getCurrent();
        if (previousBalanceResponse.success && previousBalanceResponse.data) {
          const previousBalance = previousBalanceResponse.data.find(
            (balance: OpeningBalance) => balance.ledgerId === ledgerId
          );
          if (previousBalance) {
            openingAmount = previousBalance.closingAmount;
          }
        }
      } catch (error) {
      }

      // Calculate closing balance
      const closingAmount = openingAmount + totalCredits - totalDebits;

      const calculatedBalance: OpeningBalance = {
        id: `calculated-${ledgerId}-${date}`,
        date,
        ledgerId,
        openingAmount,
        closingAmount,
        totalCredits,
        totalDebits,
        createdBy: 'system',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      // Cache the result
      this.balanceCache.set(cacheKey, calculatedBalance);
      
      return calculatedBalance;
    } catch (error) {
      console.error('Error calculating daily opening balance:', error);
      return null;
    }
  }

  /**
   * Update opening balance when a transaction is created
   */
  public async updateOpeningBalanceOnTransaction(
    ledgerId: string, 
    transactionDate: string, 
    creditAmount: number = 0, 
    debitAmount: number = 0,
    isAnamath: boolean = false
  ): Promise<void> {
    try {
      // Anamath transactions don't affect balance calculations
      if (isAnamath) {
        return;
      }

      const dateKey = format(new Date(transactionDate), 'yyyy-MM-dd');
      const cacheKey = `${ledgerId}-${dateKey}`;
      
      // Update cached balance if it exists
      if (this.balanceCache.has(cacheKey)) {
        const cachedBalance = this.balanceCache.get(cacheKey);
        if (cachedBalance) {
          cachedBalance.totalCredits += creditAmount;
          cachedBalance.totalDebits += debitAmount;
          cachedBalance.closingAmount = cachedBalance.openingAmount + cachedBalance.totalCredits - cachedBalance.totalDebits;
          cachedBalance.updatedAt = new Date().toISOString();
        }
      }

      // Clear summary cache to force refresh
      this.summaryCache = null;
      
      // Trigger recalculation for the affected date
      await this.calculateDailyOpeningBalance(ledgerId, dateKey);
      
    } catch (error) {
      console.error('Error updating opening balance on transaction:', error);
    }
  }

  /**
   * Get opening balance history for a ledger
   */
  public async getOpeningBalanceHistory(ledgerId: string, days: number = 7): Promise<OpeningBalance[]> {
    try {
      const response = await openingBalanceApi.getHistory(ledgerId, days);
      
      if (response.success && response.data) {
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching opening balance history:', error);
      return [];
    }
  }

  /**
   * Set manual opening balance for a specific ledger and date
   */
  public async setManualOpeningBalance(
    ledgerId: string, 
    date: string, 
    amount: number,
    reason?: string
  ): Promise<boolean> {
    try {
      const response = await openingBalanceApi.setManual(ledgerId, date, amount);
      
      if (response.success) {
        // Clear cache for this ledger and date
        const cacheKey = `${ledgerId}-${date}`;
        this.balanceCache.delete(cacheKey);
        this.summaryCache = null;
        
        // Create audit trail entry
        
        return true;
      }
      
      return false;
    } catch (error) {
      console.error('Error setting manual opening balance:', error);
      return false;
    }
  }

  /**
   * Get current opening balance summary
   */
  public async getOpeningBalanceSummary(): Promise<OpeningBalanceSummary | null> {
    try {
      // Check cache first
      if (this.isCacheValid() && this.summaryCache) {
        return this.summaryCache;
      }

      const response = await openingBalanceApi.getSummary();
      
      if (response.success && response.data) {
        this.summaryCache = response.data;
        this.lastCacheUpdate = new Date();
        return response.data;
      }
      
      return null;
    } catch (error) {
      console.error('Error fetching opening balance summary:', error);
      return null;
    }
  }

  /**
   * Get current opening balances for all ledgers
   */
  public async getCurrentOpeningBalances(): Promise<OpeningBalance[]> {
    try {
      const response = await openingBalanceApi.getCurrent();
      
      if (response.success && response.data) {
        // Cache individual balances
        const today = format(new Date(), 'yyyy-MM-dd');
        response.data.forEach((balance: OpeningBalance) => {
          const cacheKey = `${balance.ledgerId}-${today}`;
          this.balanceCache.set(cacheKey, balance);
        });
        
        this.lastCacheUpdate = new Date();
        return response.data;
      }
      
      return [];
    } catch (error) {
      console.error('Error fetching current opening balances:', error);
      return [];
    }
  }

  /**
   * Calculate running balance for a list of transactions
   */
  public calculateRunningBalance(
    transactions: Transaction[], 
    initialBalance: number = 0
  ): Transaction[] {
    let runningBalance = initialBalance;
    
    return transactions.map((transaction) => {
      // Update running balance (credits increase, debits decrease)
      runningBalance += (transaction.creditAmount || 0) - (transaction.debitAmount || 0);
      
      return {
        ...transaction,
        runningBalance
      };
    });
  }

  /**
   * Validate opening balance consistency
   */
  public async validateBalanceConsistency(ledgerId: string, date: string): Promise<{
    isConsistent: boolean;
    expectedBalance: number;
    actualBalance: number;
    difference: number;
  }> {
    try {
      const calculatedBalance = await this.calculateDailyOpeningBalance(ledgerId, date);
      const currentBalances = await this.getCurrentOpeningBalances();
      
      const actualBalance = currentBalances.find(b => b.ledgerId === ledgerId);
      
      if (!calculatedBalance || !actualBalance) {
        return {
          isConsistent: false,
          expectedBalance: 0,
          actualBalance: 0,
          difference: 0
        };
      }

      const difference = Math.abs(calculatedBalance.closingAmount - actualBalance.closingAmount);
      const isConsistent = difference < 0.01; // Allow for small rounding differences

      return {
        isConsistent,
        expectedBalance: calculatedBalance.closingAmount,
        actualBalance: actualBalance.closingAmount,
        difference
      };
    } catch (error) {
      console.error('Error validating balance consistency:', error);
      return {
        isConsistent: false,
        expectedBalance: 0,
        actualBalance: 0,
        difference: 0
      };
    }
  }

  /**
   * Clear all cached data
   */
  public clearCache(): void {
    this.balanceCache.clear();
    this.summaryCache = null;
    this.lastCacheUpdate = null;
  }

  /**
   * Check if cache is still valid
   */
  private isCacheValid(): boolean {
    if (!this.lastCacheUpdate) {
      return false;
    }
    
    const now = new Date();
    const timeDiff = now.getTime() - this.lastCacheUpdate.getTime();
    
    return timeDiff < this.CACHE_DURATION;
  }

  /**
   * Get balance trend for a ledger over a period
   */
  public async getBalanceTrend(
    ledgerId: string, 
    days: number = 30
  ): Promise<{
    date: string;
    openingBalance: number;
    closingBalance: number;
    netChange: number;
  }[]> {
    try {
      const history = await this.getOpeningBalanceHistory(ledgerId, days);
      
      return history.map((balance, index) => {
        const netChange = balance.closingAmount - balance.openingAmount;
        
        return {
          date: balance.date,
          openingBalance: balance.openingAmount,
          closingBalance: balance.closingAmount,
          netChange
        };
      }).sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
    } catch (error) {
      console.error('Error getting balance trend:', error);
      return [];
    }
  }

  /**
   * Recalculate all opening balances for a date range
   */
  public async recalculateBalances(
    startDate: string, 
    endDate: string, 
    ledgerIds?: string[]
  ): Promise<void> {
    try {
      
      // Clear relevant cache entries
      this.clearCache();
      
      const start = new Date(startDate);
      const end = new Date(endDate);
      const currentDate = new Date(start);
      
      // Get all ledgers if not specified
      let targetLedgers = ledgerIds;
      if (!targetLedgers) {
        const currentBalances = await this.getCurrentOpeningBalances();
        targetLedgers = currentBalances.map(b => b.ledgerId);
      }
      
      // Recalculate for each date and ledger
      while (currentDate <= end) {
        const dateStr = format(currentDate, 'yyyy-MM-dd');
        
        for (const ledgerId of targetLedgers) {
          await this.calculateDailyOpeningBalance(ledgerId, dateStr);
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
    } catch (error) {
      console.error('Error recalculating balances:', error);
    }
  }
}

// Export singleton instance
export const openingBalanceService = OpeningBalanceService.getInstance();

// Export types for convenience
export type { OpeningBalance, OpeningBalanceSummary } from './api';