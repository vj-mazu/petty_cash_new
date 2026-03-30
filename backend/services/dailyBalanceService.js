const { Transaction, Ledger, OpeningBalance, SystemSettings } = require('../models');
const openingBalanceService = require('./openingBalanceService');
const { Op } = require('sequelize');
const { format, startOfDay, endOfDay, addDays, parseISO } = require('date-fns');

/**
 * Daily Balance Service
 * Handles automatic balance rollover at 6 AM and recalculation when past transactions change
 * This service is a simplified wrapper around the existing openingBalanceService
 */
class DailyBalanceService {
  /**
   * Calculate closing balance for a specific date with improved algorithm
   * Uses proper balance continuity and handles date gaps
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {Promise<number>} Closing balance for the date
   */
  async calculateClosingBalanceForDate(dateStr) {
    try {
      // First check if we have opening balance records for this date
      const { OpeningBalance } = require('../models');
      const openingBalanceRecords = await OpeningBalance.findAll({
        where: { date: dateStr }
      });
      
      if (openingBalanceRecords.length > 0) {
        const closingBalance = openingBalanceRecords.reduce((sum, balance) => {
          return sum + parseFloat(balance.closingAmount || 0);
        }, 0);
        return closingBalance;
      }
      
      // No opening balance records, calculate manually
      const openingBalance = await this.getOpeningBalanceForDate(dateStr);
      
      // Get all transactions for the specific date using a single SUM query
      const [result] = await Transaction.findAll({
        where: {
          date: dateStr,
          status: 'approved'
        },
        attributes: [
          [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('creditAmount')), 0), 'totalCredits'],
          [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('debitAmount')), 0), 'totalDebits']
        ],
        raw: true
      });

      const totalCredits = parseFloat(result?.totalCredits) || 0;
      const totalDebits = parseFloat(result?.totalDebits) || 0;
      const closingBalance = openingBalance + totalCredits - totalDebits;
      
      return closingBalance;
    } catch (error) {
      console.error('Error calculating closing balance for date:', dateStr, error);
      throw error;
    }
  }

  /**
   * Calculate balance for a date range with proper continuity
   */
  async calculateBalanceForDateRange(startDate, endDate) {
    try {
      console.log(`Calculating balance for date range: ${startDate} to ${endDate}`);
      
      const startDateObj = parseISO(startDate);
      const endDateObj = parseISO(endDate);
      
      // Get opening balance for start date
      const periodOpeningBalance = await this.getOpeningBalanceForDate(startDate);
      
      // Get all transactions in the date range (only approved)
      const transactions = await Transaction.findAll({
        where: {
          date: {
            [Op.between]: [
              startOfDay(startDateObj),
              endOfDay(endDateObj)
            ]
          },
          status: 'approved'
        },
        attributes: ['creditAmount', 'debitAmount', 'date'],
        order: [['date', 'ASC']]
      });

      // Calculate totals for the period
      let totalCredits = 0;
      let totalDebits = 0;
      
      transactions.forEach(transaction => {
        totalCredits += parseFloat(transaction.creditAmount) || 0;
        totalDebits += parseFloat(transaction.debitAmount) || 0;
      });

      const periodClosingBalance = periodOpeningBalance + totalCredits - totalDebits;
      
      return {
        startDate,
        endDate,
        openingBalance: periodOpeningBalance,
        closingBalance: periodClosingBalance,
        totalCredits,
        totalDebits,
        netChange: totalCredits - totalDebits,
        transactionCount: transactions.length
      };
      
    } catch (error) {
      console.error('Error calculating balance for date range:', error);
      throw error;
    }
  }

  /**
   * Handle date gaps in balance calculations
   */
  async handleDateGaps(startDate, endDate) {
    try {
      const dates = this.getDateRange(startDate, endDate);
      const gaps = [];
      
      for (let i = 0; i < dates.length; i++) {
        const currentDate = dates[i];
        
        // Check if this date has any transactions
        const hasTransactions = await Transaction.findOne({
          where: {
            date: {
              [Op.between]: [
                startOfDay(parseISO(currentDate)),
                endOfDay(parseISO(currentDate))
              ]
            }
          }
        });
        
        if (!hasTransactions) {
          // This is a gap date - opening balance should equal closing balance
          const openingBalance = await this.getOpeningBalanceForDate(currentDate);
          
          gaps.push({
            date: currentDate,
            openingBalance,
            closingBalance: openingBalance, // No transactions = no change
            hasTransactions: false
          });
        }
      }
      
      return gaps;
      
    } catch (error) {
      console.error('Error handling date gaps:', error);
      throw error;
    }
  }

  /**
   * Get date range array
   */
  getDateRange(startDate, endDate) {
    const dates = [];
    let currentDate = new Date(startDate);
    const endDateObj = new Date(endDate);
    
    while (currentDate <= endDateObj) {
      dates.push(format(currentDate, 'yyyy-MM-dd'));
      currentDate = addDays(currentDate, 1);
    }
    
    return dates;
  }

  /**
   * Get system opening balance from settings or default
   */
  async getSystemOpeningBalance() {
    try {
      const { SystemSettings } = require('../models');
      const globalOpeningBalanceSetting = await SystemSettings.findOne({
        where: { 
          settingKey: 'global_opening_balance', 
          isActive: true 
        }
      });
      
      const balance = globalOpeningBalanceSetting ? 
        parseFloat(globalOpeningBalanceSetting.settingValue) : 500000; // Default ₹5,00,000
      
      console.log(`System opening balance: ${balance}`);
      return balance;
    } catch (error) {
      console.error('Error getting system opening balance:', error);
      return 500000; // Fallback to ₹5,00,000
    }
  }

  /**
   * Get opening balance for a specific date with improved algorithm
   * Uses proper balance continuity logic
   * @param {string} dateStr - Date in YYYY-MM-DD format
   * @returns {Promise<number>} Opening balance for the date
   */
  async getOpeningBalanceForDate(dateStr) {
    try {
      const currentDate = parseISO(dateStr);
      
      // Check if there are any transactions before this date (system-wide)
      const previousTransactions = await Transaction.findOne({
        where: {
          date: { [Op.lt]: startOfDay(currentDate) }
        },
        order: [['date', 'DESC'], ['createdAt', 'DESC']]
      });
      
      if (!previousTransactions) {
        // No transactions exist before this date, use system opening balance
        return await this.getSystemOpeningBalance();
      }
      
      // ITERATIVE approach (max 30 days back) to avoid recursive stack overflow
      // Walk backwards day-by-day until we find an OpeningBalance record
      const { OpeningBalance } = require('../models');
      const MAX_LOOKBACK_DAYS = 30;
      
      for (let dayOffset = 1; dayOffset <= MAX_LOOKBACK_DAYS; dayOffset++) {
        const lookbackDate = addDays(currentDate, -dayOffset);
        const lookbackDateStr = format(lookbackDate, 'yyyy-MM-dd');
        
        const previousDayBalances = await OpeningBalance.findAll({
          where: { date: lookbackDateStr }
        });
        
        if (previousDayBalances.length > 0) {
          // Found an OpeningBalance record — use its closing as our opening
          const previousDayClosing = previousDayBalances.reduce((sum, balance) => {
            return sum + parseFloat(balance.closingAmount || 0);
          }, 0);
          
          // Now calculate forward from that date to our target date
          // using a single bulk query for all days in between
          const gapStartStr = format(addDays(lookbackDate, 1), 'yyyy-MM-dd');
          const gapEndStr = format(addDays(currentDate, -1), 'yyyy-MM-dd');
          
          if (gapStartStr <= gapEndStr) {
            // Get aggregate transactions for the gap period
            const [gapResult] = await Transaction.findAll({
              where: {
                date: { [Op.between]: [gapStartStr, gapEndStr] },
                status: 'approved'
              },
              attributes: [
                [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('creditAmount')), 0), 'totalCredits'],
                [require('sequelize').fn('COALESCE', require('sequelize').fn('SUM', require('sequelize').col('debitAmount')), 0), 'totalDebits']
              ],
              raw: true
            });
            const gapCredits = parseFloat(gapResult?.totalCredits) || 0;
            const gapDebits = parseFloat(gapResult?.totalDebits) || 0;
            return previousDayClosing + gapCredits - gapDebits;
          }
          
          return previousDayClosing;
        }
      }
      
      // Fallback: no OpeningBalance records found within 30 days — use system opening balance
      return await this.getSystemOpeningBalance();
      
    } catch (error) {
      console.error('Error getting opening balance for date:', dateStr, error);
      
      // Fallback: Use the system opening balance
      try {
        return await this.getSystemOpeningBalance();
      } catch (fallbackError) {
        console.error('Final fallback also failed:', fallbackError);
        return 500000; // Hard-coded fallback
      }
    }
  }

  /**
   * Recalculate balances from a specific date onwards
   * @param {string} fromDateStr - Start date for recalculation in YYYY-MM-DD format
   * @returns {Promise<void>}
   */
  async recalculateBalancesFromDate(fromDateStr) {
    try {
      console.log('🔄 Starting complete daily balance recalculation from date:', fromDateStr);
      
      // Get all unique dates from the specified date onwards
      const transactions = await Transaction.findAll({
        where: {
          date: {
            [Op.gte]: startOfDay(parseISO(fromDateStr))
          }
        },
        attributes: ['date'],
        group: ['date'],
        order: [['date', 'ASC']]
      });

      const uniqueDates = transactions.map(t => format(parseISO(t.date), 'yyyy-MM-dd'));
      
      // Get all active ledgers (system-wide)
      const allActiveLedgers = await Ledger.findAll({ where: { isActive: true } });

      // Ensure all dates in the range are processed, even if no transactions
      const fullDateRange = this.getDateRange(fromDateStr, format(new Date(), 'yyyy-MM-dd'));

      for (let i = 0; i < fullDateRange.length; i++) { // Iterate through all dates
        const currentDate = fullDateRange[i];
        console.log(`
📊 Processing date for continuity: ${currentDate}`);
        
        // For each ledger, ensure an OpeningBalance record exists for currentDate
        for (const ledger of allActiveLedgers) {
          let currentBalanceRecord = await OpeningBalance.findOne({
            where: { date: currentDate, ledgerId: ledger.id }
          });

          if (!currentBalanceRecord) {
            // If no record exists, create one based on previous day's closing or ledger's initial balance
            const previousDate = format(subDays(parseISO(currentDate), 1), 'yyyy-MM-dd');
            const previousDayBalance = await OpeningBalance.findOne({
              where: { date: previousDate, ledgerId: ledger.id }
            });

            let openingAmountForNewRecord = 0;
            if (previousDayBalance) {
              openingAmountForNewRecord = parseFloat(previousDayBalance.closingAmount || 0);
            } else {
              // If no previous day record, use ledger's initial opening balance
              // This will be corrected by balanceRecalculationService.recalculateBalanceForDate later
              openingAmountForNewRecord = parseFloat(ledger.openingBalance) || 0;
            }

            currentBalanceRecord = await OpeningBalance.create({
              date: currentDate,
              ledgerId: ledger.id,
              openingAmount: openingAmountForNewRecord,
              closingAmount: openingAmountForNewRecord, // Initial closing is same as opening
              totalCredits: 0,
              totalDebits: 0,
              createdBy: '00000000-0000-0000-0000-000000000001' // Placeholder for system user ID - REPLACE WITH ACTUAL SYSTEM USER ID
            });
            console.log(`  Created placeholder OpeningBalance for ledger ${ledger.name} on ${currentDate}`);
          }
        }

        // Now that all records for currentDate are guaranteed to exist, ensure continuity
        if (i > 0) {
          const previousDate = fullDateRange[i - 1];
          console.log(`🔗 Ensuring continuity between ${previousDate} and ${currentDate}`);
          
          for (const ledger of allActiveLedgers) { // Iterate through all ledgers again
            const prevBalance = await OpeningBalance.findOne({ where: { date: previousDate, ledgerId: ledger.id } });
            const currentBalance = await OpeningBalance.findOne({ where: { date: currentDate, ledgerId: ledger.id } });

            if (prevBalance && currentBalance) {
              const previousClosing = parseFloat(prevBalance.closingAmount || 0);
              const currentOpening = parseFloat(currentBalance.openingAmount || 0);

              if (Math.abs(previousClosing - currentOpening) > 0.01) {
                console.log(`🔧 Fixing continuity for ledger ${ledger.name}: ${previousDate} closing (${previousClosing}) -> ${currentDate} opening (${currentOpening})`);
                
                // Recalculate daily credits/debits for current day for this ledger
                const dayTransactions = await Transaction.findAll({
                  where: { ledgerId: ledger.id, date: currentDate, status: 'approved' }
                });
                let dailyCredits = 0;
                let dailyDebits = 0;
                dayTransactions.forEach(tx => {
                  dailyCredits += parseFloat(tx.creditAmount) || 0;
                  dailyDebits += parseFloat(tx.debitAmount) || 0;
                });
                const newClosing = previousClosing + dailyCredits - dailyDebits;

                await OpeningBalance.setSystemCalculatedAmount(
                  currentBalance.id,
                  previousClosing,
                  newClosing,
                  dailyCredits,
                  dailyDebits,
                  null // Pass null for transaction if not within a larger transaction
                );
                console.log(`✅ Updated ${currentDate} for ledger ${ledger.name}: Opening=${previousClosing}, Closing=${newClosing}`);
              }
            }
          }
        }
      }
      
      console.log('✅ Complete daily balance recalculation completed');
    } catch (error) {
      console.error('Error recalculating balances from date:', fromDateStr, error);
      throw error;
    }
  }

  /**
   * Handle daily rollover at 6 AM
   * Ensures yesterday's closing balance becomes today's opening balance
   * @returns {Promise<void>}
   */
  async handleDailyRollover() {
    try {
      console.log('🕕 Executing daily balance rollover...');
      
      const now = new Date();
      const yesterday = addDays(now, -1);
      const today = now;
      
      const yesterdayStr = format(yesterday, 'yyyy-MM-dd');
      const todayStr = format(today, 'yyyy-MM-dd');
      
      console.log(`Processing rollover: ${yesterdayStr} → ${todayStr}`);
      
      // Get all active ledgers
      const ledgers = await Ledger.findAll({
        where: { isActive: true }
      });
      
      console.log(`Found ${ledgers.length} active ledgers for rollover`);
      
      // Process rollover for each ledger
      for (const ledger of ledgers) {
        try {
          // Get yesterday's closing balance for this ledger
          const yesterdayClosing = await openingBalanceService.calculateClosingBalance(
            ledger.id, 
            yesterdayStr
          );
          
          // Check if opening balance already exists for today
          const existingTodayOpening = await OpeningBalance.findOne({
            where: {
              ledgerId: ledger.id,
              date: todayStr
            }
          });
          
          if (!existingTodayOpening) {
            // Get system user (admin1) for automated operations
            const { User } = require('../models');
            const systemUser = await User.findOne({
              where: { role: 'admin1' },
              order: [['createdAt', 'ASC']]
            });
            
            // Create today's opening balance = yesterday's closing balance
            await OpeningBalance.create({
              date: todayStr,
              ledgerId: ledger.id,
              openingAmount: yesterdayClosing,
              closingAmount: yesterdayClosing, // Will be updated as transactions are added
              createdBy: systemUser?.id || ledger.createdBy, // Use system user or ledger creator
              notes: `Auto-generated from ${yesterdayStr} closing balance: ₹${yesterdayClosing.toLocaleString('en-IN')}`
            });
            
            console.log(`✅ Created opening balance for ${ledger.name}: ₹${yesterdayClosing.toLocaleString('en-IN')}`);
          } else {
            // Update existing opening balance if needed
            if (parseFloat(existingTodayOpening.openingAmount) !== yesterdayClosing) {
              await existingTodayOpening.update({
                openingAmount: yesterdayClosing,
                notes: `Updated from ${yesterdayStr} closing balance: ₹${yesterdayClosing.toLocaleString('en-IN')} (Previous: ₹${parseFloat(existingTodayOpening.openingAmount).toLocaleString('en-IN')})`
              });
              
              console.log(`📝 Updated opening balance for ${ledger.name}: ₹${parseFloat(existingTodayOpening.openingAmount).toLocaleString('en-IN')} → ₹${yesterdayClosing.toLocaleString('en-IN')}`);
            } else {
              console.log(`✓ Opening balance for ${ledger.name} already correct: ₹${yesterdayClosing.toLocaleString('en-IN')}`);
            }
          }
          
        } catch (ledgerError) {
          console.error(`❌ Error processing rollover for ledger ${ledger.name}:`, ledgerError.message);
          // Continue with other ledgers
        }
      }
      
      // Update system settings to record last rollover
      try {
        const { SystemSettings, User } = require('../models');
        // Get system user for automated operations
        const systemUser = await User.findOne({
          where: { role: 'admin' },
          order: [['createdAt', 'ASC']]
        });
        
        // Check if setting already exists
        const existingSetting = await SystemSettings.findOne({
          where: { settingKey: 'last_daily_rollover' }
        });
        
        if (existingSetting) {
          // Update existing setting
          await existingSetting.update({
            settingValue: todayStr,
            updatedBy: systemUser?.id || null
          });
        } else {
          // Create new setting
          await SystemSettings.create({
            settingKey: 'last_daily_rollover',
            settingValue: todayStr,
            description: 'Date of last successful daily balance rollover',
            isActive: true,
            createdBy: systemUser?.id || systemUser?.id, // Required field
            updatedBy: systemUser?.id || null
          });
        }
      } catch (settingsError) {
        console.error('Warning: Could not update rollover settings:', settingsError.message);
      }
      
      console.log('🎉 Daily balance rollover completed successfully');
      
    } catch (error) {
      console.error('❌ Error in daily rollover:', error);
      throw error;
    }
  }

  /**
   * Get current business date based on 6 AM cutoff
   * @returns {string} Business date in YYYY-MM-DD format
   */
  getCurrentBusinessDate() {
    const now = new Date();
    const currentHour = now.getHours();
    
    // Before 6 AM = previous day
    const businessDate = currentHour < 6 ? addDays(now, -1) : now;
    
    return format(businessDate, 'yyyy-MM-dd');
  }

  /**
   * Get opening balance for current business date
   * @returns {Promise<number>} Opening balance
   */
  async getCurrentOpeningBalance() {
    const businessDate = this.getCurrentBusinessDate();
    return await this.getOpeningBalanceForDate(businessDate);
  }

  /**
   * Get closing balance for current business date
   * @returns {Promise<number>} Closing balance
   */
  async getCurrentClosingBalance() {
    const businessDate = this.getCurrentBusinessDate();
    return await this.calculateClosingBalanceForDate(businessDate);
  }
}

module.exports = new DailyBalanceService();