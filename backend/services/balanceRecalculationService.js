// services/balanceRecalculationService.js
const { OpeningBalance, Transaction, Ledger, SystemSettings, sequelize } = require('../models');
const { Op } = require('sequelize');
const { format, parseISO, addDays, subDays } = require('date-fns');

class BalanceRecalculationService {
  /**
   * Get system opening balance from settings or default
   */
  async getSystemOpeningBalance(transaction = null) {
    try {
      const globalOpeningBalanceSetting = await SystemSettings.findOne({
        where: { 
          settingKey: 'global_opening_balance', 
          isActive: true 
        },
        transaction
      });
      
      const balance = globalOpeningBalanceSetting ? 
        parseFloat(globalOpeningBalanceSetting.settingValue) : 500000; // Default ₹5,00,000
      
      return balance;
    } catch (error) {
      console.error('Error getting system opening balance:', error);
      return 500000; // Fallback to ₹5,00,000
    }
  }

  /**
   * Recalculate opening balances from a specific date forward
   * This should be called when a past transaction is edited
   * Enhanced to ensure proper balance continuity with chain reaction updates
   */
  async recalculateFromDate(startDate, ledgerId = null, userId = null) {
    const transaction = await sequelize.transaction({ isolationLevel: 'SERIALIZABLE' });
    
    try {
      // Get system opening balance
      const systemOpeningBalance = await this.getSystemOpeningBalance(transaction);
      
      // Get all active ledgers
      let ledgerWhereClause = { isActive: true };
      if (userId) {
        ledgerWhereClause.createdBy = userId;
      }
      
      let ledgers;
      if (ledgerId) {
        ledgers = await Ledger.findAll({
          where: { ...ledgerWhereClause, id: ledgerId },
          transaction
        });
      } else {
        ledgers = await Ledger.findAll({
          where: ledgerWhereClause,
          transaction
        });
      }
      
      // Calculate date range - from startDate to today
      const today = new Date();
      const endDate = format(today, 'yyyy-MM-dd');
      
      const datesToProcess = this.getDateRange(startDate, endDate);
      
      // Process each date in chronological order with complete chain reaction
      for (let i = 0; i < datesToProcess.length; i++) {
        const currentDate = datesToProcess[i];
        
        // Recalculate balances for the current date
        await this.recalculateBalanceForDate(
          currentDate, 
          ledgers, 
          systemOpeningBalance, 
          transaction
        );
      }
      
      // Now ensure continuity between all consecutive dates
      await this.ensureCompleteContinuity(datesToProcess, ledgers, transaction);
      
      // Final validation of balance continuity
      const continuityIssues = await this.validateBalanceContinuity(startDate, endDate, transaction);
      
      if (continuityIssues.length > 0) {
        console.warn(`⚠️ Found ${continuityIssues.length} balance continuity issues after recalculation`);
        // Try to fix minor discrepancies automatically
        await this.fixBalanceContinuityIssues(startDate, endDate, userId, transaction);
      }

      // After recalculating daily balances, update the final currentBalance on the ledger
      if (ledgerId) {
        await this.updateLedgerCurrentBalance(ledgerId, transaction);
      } else {
        for (const ledger of ledgers) {
          await this.updateLedgerCurrentBalance(ledger.id, transaction);
        }
      }
      
      await transaction.commit();
      
      return {
        success: true,
        message: 'Balances recalculated successfully',
        recalculatedDates: datesToProcess,
        startDate,
        endDate,
        hasContinuityIssues: continuityIssues.length > 0
      };
      
    } catch (error) {
      await transaction.rollback();
      console.error('❌ Balance recalculation failed:', error);
      throw new Error(`Failed to recalculate balances: ${error.message}`);
    }
  }
  
  /**
   * Get all dates that have transactions within a date range
   */
  async getDatesWithTransactions(startDate, endDate, transaction = null) {
    const transactions = await Transaction.findAll({
      where: {
        date: {
          [Op.between]: [startDate, endDate]
        }
      },
      attributes: ['date'],
      group: ['date'],
      order: [['date', 'ASC']],
      transaction
    });
    
    return transactions.map(t => format(parseISO(t.date), 'yyyy-MM-dd'));
  }

  /**
   * Recalculate balance for a specific date with proper continuity
   */
  async recalculateBalanceForDate(date, ledgers, systemOpeningBalance, transaction) {
    // Process each ledger
    for (const ledger of ledgers) {
      // Get transactions for this specific date and ledger (only approved)
      const transactionsForDate = await Transaction.findAll({
        where: {
          ledgerId: ledger.id,
          date: date,
          status: 'approved'
        },
        order: [['createdAt', 'ASC']],
        transaction
      });
      // Calculate totals for this date and ledger
      let dailyCredits = 0;
      let dailyDebits = 0;
      
      for (const tx of transactionsForDate) {
        dailyCredits += parseFloat(tx.creditAmount) || 0;
        dailyDebits += parseFloat(tx.debitAmount) || 0;
      }
      // Calculate ledger's opening balance based on previous day
      const previousDate = format(subDays(parseISO(date), 1), 'yyyy-MM-dd');
      let ledgerOpeningAmount = 0;
      
      // Get existing opening balance record for the current date
      let existingOpeningBalanceRecord = await OpeningBalance.findOne({
        where: {
          date: date,
          ledgerId: ledger.id
        },
        transaction
      });

      if (existingOpeningBalanceRecord && existingOpeningBalanceRecord.isManuallySet) {
        // If manually set, use its opening amount and do not change it
        ledgerOpeningAmount = parseFloat(existingOpeningBalanceRecord.openingAmount || 0);
      } else {
        // Get previous day's closing balance for this ledger
        const previousDayBalance = await OpeningBalance.findOne({
          where: {
            date: previousDate,
            ledgerId: ledger.id
          },
          transaction
        });
      if (previousDayBalance) {
        ledgerOpeningAmount = parseFloat(previousDayBalance.closingAmount || 0);
      } else {
        ledgerOpeningAmount = await this.calculateLedgerOpeningBalance(
          ledger.id, 
          date, 
          systemOpeningBalance, 
          ledger, 
          transaction
        );
      }
      }
      
      // Closing balance = opening balance + daily credits - daily debits
      const closingAmount = ledgerOpeningAmount + dailyCredits - dailyDebits;
      
      // Update or create opening balance record
      if (existingOpeningBalanceRecord) {
        // Use the new system-driven update method
        await OpeningBalance.setSystemCalculatedAmount(
          existingOpeningBalanceRecord.id,
          ledgerOpeningAmount, // This is the newly calculated opening
          closingAmount,
          dailyCredits,
          dailyDebits,
          transaction
        );
      } else {
        // Create new record
        await OpeningBalance.create({
          date: date,
          ledgerId: ledger.id,
          openingAmount: ledgerOpeningAmount,
          closingAmount: closingAmount,
          totalCredits: dailyCredits,
          totalDebits: dailyDebits,
          createdBy: ledger.createdBy
        }, { transaction });
      }
    }
  }

  /**
   * Calculate opening balance for a specific ledger on a specific date
   */
  async calculateLedgerOpeningBalance(ledgerId, date, systemOpeningBalance, ledger, transaction) {
    // Get the previous date
    const previousDate = format(subDays(parseISO(date), 1), 'yyyy-MM-dd');
    
    // Check if there are any transactions for this ledger before this date
    const hasTransactionsBefore = await Transaction.findOne({
      where: {
        ledgerId: ledgerId,
        date: {
          [Op.lt]: date
        }
      },
      transaction
    });
    if (!hasTransactionsBefore) {
      return systemOpeningBalance;
    }
    
    // Get previous day's closing balance for this ledger
    const previousDayBalance = await OpeningBalance.findOne({
      where: {
        date: previousDate,
        ledgerId: ledgerId
      },
      transaction
    });
    if (previousDayBalance) {
      const previousClosing = parseFloat(previousDayBalance.closingAmount || 0);
      return previousClosing;
    }
    
    // Fallback: calculate from all transactions up to previous day
    
    // Find the latest OpeningBalance record before the current date
    const latestPriorOpeningBalance = await OpeningBalance.findOne({
      where: {
        ledgerId: ledgerId,
        date: {
          [Op.lt]: date
        }
      },
      order: [['date', 'DESC']],
      transaction
    });

    let cumulativeBalance = 0;
    let calculationStartDate = null;

    if (latestPriorOpeningBalance) {
      cumulativeBalance = parseFloat(latestPriorOpeningBalance.closingAmount || 0);
      calculationStartDate = format(addDays(parseISO(latestPriorOpeningBalance.date), 1), 'yyyy-MM-dd');
    } else {
      // If no prior OpeningBalance record, start from the ledger's initial opening balance
      const ledger = await Ledger.findByPk(ledgerId, { transaction });
      cumulativeBalance = parseFloat(ledger.openingBalance) || 0;
      calculationStartDate = '1900-01-01';
    }

    const transactionsToSum = await Transaction.findAll({
      where: {
        ledgerId: ledgerId,
        date: {
          [Op.gte]: calculationStartDate,
          [Op.lt]: date
        }
      },
      order: [['date', 'ASC'], ['createdAt', 'ASC']],
      transaction
    });
    
    for (const tx of transactionsToSum) {
      const credit = parseFloat(tx.creditAmount) || 0;
      const debit = parseFloat(tx.debitAmount) || 0;
      cumulativeBalance += (credit - debit);
    }
    
    return cumulativeBalance;
  }

  /**
   * Ensure complete continuity between all consecutive dates
   */
  async ensureCompleteContinuity(dates, ledgers, transaction) {
    for (let i = 1; i < dates.length; i++) {
      const previousDate = dates[i - 1];
      const currentDate = dates[i];
      
      // For each ledger, ensure continuity
      for (const ledger of ledgers) {
        // Get previous day's closing balance
        const previousBalance = await OpeningBalance.findOne({
          where: {
            date: previousDate,
            ledgerId: ledger.id
          },
          transaction
        });
        
        if (previousBalance) {
          const previousClosing = parseFloat(previousBalance.closingAmount || 0);
          
          // Get current day's opening balance
          const currentBalance = await OpeningBalance.findOne({
            where: {
              date: currentDate,
              ledgerId: ledger.id
            },
            transaction
          });
          
          if (currentBalance) {
            const currentOpening = parseFloat(currentBalance.openingAmount || 0);
            
            // If they don't match, update current day's opening balance
            // ONLY update if currentBalance is NOT manually set
            // Always update if there's a discrepancy AND it's not manually set
            // OR if it's a system-driven recalculation, we force the update
            // --- NEW CODE START ---
            // Calculate daily credits and debits for the currentDate and ledger
            const transactionsForCurrentDate = await Transaction.findAll({
              where: {
                ledgerId: ledger.id,
                date: currentDate,
                status: 'approved'
              },
              order: [['createdAt', 'ASC']],
              transaction
            });

            let dailyCredits = 0;
            let dailyDebits = 0;
            for (const tx of transactionsForCurrentDate) {
              dailyCredits += parseFloat(tx.creditAmount) || 0;
              dailyDebits += parseFloat(tx.debitAmount) || 0;
            }
            // --- NEW CODE END ---

            if (Math.abs(previousClosing - currentOpening) > 0.01 || !currentBalance.isManuallySet) {

              // Use the new system-driven update method
              await OpeningBalance.setSystemCalculatedAmount(
                currentBalance.id,
                previousClosing, // This is the new opening amount from previous day's closing
                previousClosing + dailyCredits - dailyDebits, // Recalculate closing using calculated dailyCredits/Debits
                dailyCredits,
                dailyDebits,
                transaction
              );
            } else if (currentBalance.isManuallySet && Math.abs(previousClosing - currentOpening) > 0.01) {
              // Manually set balance with discrepancy - skip automatic adjustment
            }
          }
        }
      }
    }
  }

  /**
   * Validate balance continuity across dates
   */
  async validateBalanceContinuity(startDate, endDate, transaction) {
    
    const dates = this.getDateRange(startDate, endDate);
    let continuityIssues = [];
    
    for (let i = 1; i < dates.length; i++) {
      const previousDate = dates[i - 1];
      const currentDate = dates[i];
      
      // Get all ledgers' closing balance for previous date
      const previousDayBalances = await OpeningBalance.findAll({
        where: { date: previousDate },
        transaction
      });
      
      // Get all ledgers' opening balance for current date
      const currentDayBalances = await OpeningBalance.findAll({
        where: { date: currentDate },
        transaction
      });
      
      // Check each ledger for continuity
      for (const prevBalance of previousDayBalances) {
        const currentBalance = currentDayBalances.find(b => b.ledgerId === prevBalance.ledgerId);
        
        if (currentBalance) {
          const previousClosing = parseFloat(prevBalance.closingAmount || 0);
          const currentOpening = parseFloat(currentBalance.openingAmount || 0);
          
          // Check if they match (with small tolerance for floating point precision)
          const difference = Math.abs(previousClosing - currentOpening);
          if (difference > 0.01) {
            continuityIssues.push({
              ledgerId: prevBalance.ledgerId,
              previousDate,
              currentDate,
              previousClosing: previousClosing,
              currentOpening: currentOpening,
              difference
            });
          }
        }
      }
    }
    

    
    return continuityIssues;
  }

  /**
   * Detect balance continuity issues without fixing them
   */
  async detectBalanceContinuityIssues(startDate, endDate) {
    const transaction = await sequelize.transaction();
    
    try {
      const issues = await this.validateBalanceContinuity(startDate, endDate, transaction);
      await transaction.commit();
      
      return {
        success: true,
        hasIssues: issues.length > 0,
        issues,
        message: issues.length > 0 ? 
          `Found ${issues.length} balance continuity issues` : 
          'No balance continuity issues found'
      };
    } catch (error) {
      await transaction.rollback();
      console.error('Error detecting balance continuity issues:', error);
      throw new Error(`Failed to detect balance continuity issues: ${error.message}`);
    }
  }

  /**
   * Fix minor balance continuity discrepancies automatically
   */
  async fixBalanceContinuityIssues(startDate, endDate, userId = null, existingTransaction = null) {
    const transaction = existingTransaction || await sequelize.transaction();
    let shouldCommit = !existingTransaction; // Only commit if we created the transaction
    
    try {

      
      const issues = await this.validateBalanceContinuity(startDate, endDate, transaction);
      
      if (issues.length === 0) {
        if (shouldCommit) await transaction.commit();
        return {
          success: true,
          message: 'No balance continuity issues found to fix',
          fixedIssues: 0
        };
      }
      
      let fixedCount = 0;
      
      for (const issue of issues) {
        // Only fix small discrepancies (less than ₹100)
        if (issue.difference < 100) {

          
          // Get the current balance record
          const currentBalance = await OpeningBalance.findOne({
            where: {
              date: issue.currentDate,
              ledgerId: issue.ledgerId
            },
            transaction
          });
          
          if (currentBalance) {
            // Update opening amount to match previous day's closing
            await currentBalance.update({
              openingAmount: issue.previousClosing,
              updatedAt: new Date()
            }, { transaction });
            
            // Recalculate closing balance
            const transactions = await Transaction.findAll({
              where: {
                ledgerId: issue.ledgerId,
                date: issue.currentDate,
                status: 'approved'
              },
              transaction
            });
            
            let dailyCredits = 0;
            let dailyDebits = 0;
            
            for (const tx of transactions) {
              dailyCredits += parseFloat(tx.creditAmount) || 0;
              dailyDebits += parseFloat(tx.debitAmount) || 0;
            }
            
            const newClosing = issue.previousClosing + dailyCredits - dailyDebits;
            
            await currentBalance.update({
              closingAmount: newClosing,
              totalCredits: dailyCredits,
              totalDebits: dailyDebits,
              updatedAt: new Date()
            }, { transaction });
            
            fixedCount++;
          }
        } else {
          console.warn(`Balance discrepancy of ₹${issue.difference} for ledger ${issue.ledgerId} requires manual review`);
        }
      }
      
      if (shouldCommit) await transaction.commit();
      
      return {
        success: true,
        message: `Fixed ${fixedCount} out of ${issues.length} balance continuity issues`,
        fixedIssues: fixedCount,
        totalIssues: issues.length,
        unfixedIssues: issues.length - fixedCount
      };
      
    } catch (error) {
      if (shouldCommit) await transaction.rollback();
      console.error('Error fixing balance continuity issues:', error);
      throw new Error(`Failed to fix balance continuity issues: ${error.message}`);
    }
  }

  /**
   * Validate that opening balance of day N+1 equals closing balance of day N
   */
  async validateDailyBalanceChain(date1, date2) {
    try {
      // Get all ledgers' closing balance for date1
      const date1Balances = await OpeningBalance.findAll({
        where: { date: date1 }
      });
      
      // Get all ledgers' opening balance for date2
      const date2Balances = await OpeningBalance.findAll({
        where: { date: date2 }
      });
      
      let isValid = true;
      let issues = [];
      
      // Check each ledger
      for (const balance1 of date1Balances) {
        const balance2 = date2Balances.find(b => b.ledgerId === balance1.ledgerId);
        
        if (balance2) {
          const closing1 = parseFloat(balance1.closingAmount || 0);
          const opening2 = parseFloat(balance2.openingAmount || 0);
          const difference = Math.abs(closing1 - opening2);
          
          if (difference > 0.01) {
            isValid = false;
            issues.push({
              ledgerId: balance1.ledgerId,
              date1Closing: closing1,
              date2Opening: opening2,
              difference
            });
          }
        }
      }
      
      return {
        isValid,
        date1,
        date2,
        issues,
        message: isValid ? 
          'Balance continuity is valid' : 
          `Balance continuity broken: ${issues.length} ledger(s) have discrepancies`
      };
      
    } catch (error) {
      console.error('Error validating daily balance chain:', error);
      throw new Error(`Failed to validate balance chain: ${error.message}`);
    }
  }
  
  /**
   * Get array of dates between start and end
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
   * Recalculate ledger current balances to ensure consistency
   * Enhanced to work with the new balance continuity system
   */
  async recalculateLedgerBalances(userId = null) {
    const transaction = await sequelize.transaction();
    
    try {
      // Get all ledgers
      let ledgerWhereClause = { isActive: true };
      if (userId) {
        ledgerWhereClause.createdBy = userId;
      }
      
      const ledgers = await Ledger.findAll({
        where: ledgerWhereClause,
        transaction
      });
      
      for (const ledger of ledgers) {
        await this.updateLedgerCurrentBalance(ledger.id, transaction);
      }
      
      await transaction.commit();
      
      return {
        success: true,
        message: 'Ledger balances recalculated successfully',
        ledgerCount: ledgers.length
      };
      
    } catch (error) {
      await transaction.rollback();
      console.error('Enhanced ledger balance recalculation failed:', error);
      throw new Error(`Failed to recalculate ledger balances: ${error.message}`);
    }
  }

  async updateLedgerCurrentBalance(ledgerId, transaction) {
    const ledger = await Ledger.findByPk(ledgerId, { transaction });
    if (!ledger) {
      console.warn(`Ledger with ID ${ledgerId} not found for final balance update.`);
      return;
    }

    // Use a single SQL SUM query instead of loading all transactions into memory
    // This prevents OOM crashes at 20 lakh+ records
    const [result] = await sequelize.query(
      `SELECT 
        COALESCE(SUM("creditAmount"), 0) AS total_credits,
        COALESCE(SUM("debitAmount"), 0) AS total_debits
       FROM transactions 
       WHERE "ledgerId" = :ledgerId AND status = 'approved'`,
      {
        replacements: { ledgerId },
        type: sequelize.QueryTypes ? sequelize.QueryTypes.SELECT : 'SELECT',
        transaction
      }
    );

    const totalCredits = parseFloat(result?.total_credits || result?.[0]?.total_credits) || 0;
    const totalDebits = parseFloat(result?.total_debits || result?.[0]?.total_debits) || 0;
    const ledgerOpeningBalance = parseFloat(ledger.openingBalance) || 0;
    const totalBalance = ledgerOpeningBalance + totalCredits - totalDebits;

    await ledger.update({ currentBalance: totalBalance }, { transaction });
  }
}

module.exports = new BalanceRecalculationService();