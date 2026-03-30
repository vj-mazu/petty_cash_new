const { OpeningBalance, Ledger, Transaction, User } = require('../models');
const { Op } = require('sequelize');

class OpeningBalanceService {
  /**
   * Calculate daily opening balance for a specific ledger and date
   */
  async calculateDailyOpeningBalance(ledgerId, date) {
    try {
      // Get the ledger
      const ledger = await Ledger.findByPk(ledgerId);
      if (!ledger) {
        throw new Error('Ledger not found');
      }

      // Check if opening balance already exists for this date
      let openingBalance = await OpeningBalance.findByDateAndLedger(date, ledgerId);
      
      if (!openingBalance) {
        // Get previous day's closing balance
        const previousDate = new Date(date);
        previousDate.setDate(previousDate.getDate() - 1);
        const previousBalance = await OpeningBalance.getLatestByLedger(ledgerId, date);
        
        const previousClosingAmount = previousBalance ? previousBalance.closingAmount : ledger.currentBalance;
        
        // Create new opening balance record
        openingBalance = await OpeningBalance.create({
          date: date,
          ledgerId: ledgerId,
          openingAmount: previousClosingAmount,
          closingAmount: previousClosingAmount,
          totalCredits: 0,
          totalDebits: 0,
          createdBy: ledger.createdBy
        });
      }

      // Calculate totals for the day
      const dayTotals = await Transaction.getTotalsByDateRange(date, date, ledgerId);
      
      // Update the opening balance record
      openingBalance.totalCredits = dayTotals.totalCredits;
      openingBalance.totalDebits = dayTotals.totalDebits;
      openingBalance.closingAmount = parseFloat(openingBalance.openingAmount) + dayTotals.totalCredits - dayTotals.totalDebits;
      
      await openingBalance.save();
      
      return openingBalance;
    } catch (error) {
      throw new Error(`Failed to calculate opening balance: ${error.message}`);
    }
  }

  /**
   * Update opening balance for a specific ledger and date
   */
  async updateOpeningBalance(ledgerId, date, amount) {
    try {
      const ledger = await Ledger.findByPk(ledgerId);
      if (!ledger) {
        throw new Error('Ledger not found');
      }

      let openingBalance = await OpeningBalance.findByDateAndLedger(date, ledgerId);
      
      if (!openingBalance) {
        // Create new opening balance record
        openingBalance = await OpeningBalance.create({
          date: date,
          ledgerId: ledgerId,
          openingAmount: amount,
          closingAmount: amount,
          totalCredits: 0,
          totalDebits: 0,
          createdBy: ledger.createdBy
        });
      } else {
        // Update existing record
        const difference = amount - parseFloat(openingBalance.openingAmount);
        openingBalance.openingAmount = amount;
        openingBalance.closingAmount = parseFloat(openingBalance.closingAmount) + difference;
        await openingBalance.save();
      }

      // Recalculate for the day
      return await this.calculateDailyOpeningBalance(ledgerId, date);
    } catch (error) {
      throw new Error(`Failed to update opening balance: ${error.message}`);
    }
  }

  /**
   * Get opening balance history for a ledger
   */
  async getOpeningBalanceHistory(ledgerId, days = 7) {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const history = await OpeningBalance.findByDateRange(
        startDate.toISOString().split('T')[0],
        endDate.toISOString().split('T')[0],
        ledgerId
      );

      return history;
    } catch (error) {
      throw new Error(`Failed to get opening balance history: ${error.message}`);
    }
  }

  /**
   * Set manual opening balance (creates audit trail)
   */
  async setManualOpeningBalance(ledgerId, date, amount, userId) {
    try {
      const ledger = await Ledger.findByPk(ledgerId);
      if (!ledger) {
        throw new Error('Ledger not found');
      }

      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Update the opening balance
      const openingBalance = await this.updateOpeningBalance(ledgerId, date, amount);
      
      // Create audit trail entry (you can expand this to a separate audit table if needed)
      console.log(`Manual opening balance set: Ledger ${ledgerId}, Date ${date}, Amount ${amount}, User ${userId}`);
      
      return openingBalance;
    } catch (error) {
      throw new Error(`Failed to set manual opening balance: ${error.message}`);
    }
  }

  /**
   * Get current day's opening balance for all ledgers
   */
  async getCurrentDayOpeningBalances(userId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      
      let whereClause = {};
      if (userId) {
        // If userId provided, filter by user's ledgers
        const userLedgers = await Ledger.findAll({
          where: { createdBy: userId },
          attributes: ['id']
        });
        const ledgerIds = userLedgers.map(l => l.id);
        whereClause.ledgerId = { [Op.in]: ledgerIds };
      }

      const openingBalances = await OpeningBalance.findAll({
        where: {
          date: today,
          ...whereClause
        },
        include: [
          {
            model: Ledger,
            as: 'ledger',
            attributes: ['id', 'name', 'ledgerType', 'currentBalance']
          }
        ],
        order: [['ledger', 'name', 'ASC']]
      });

      return openingBalances;
    } catch (error) {
      throw new Error(`Failed to get current day opening balances: ${error.message}`);
    }
  }

  /**
   * Get opening balance summary for dashboard
   */
  async getOpeningBalanceSummary(userId = null) {
    try {
      const today = new Date().toISOString().split('T')[0];
      const openingBalances = await this.getCurrentDayOpeningBalances(userId);
      
      const summary = {
        totalOpeningBalance: 0,
        totalClosingBalance: 0,
        totalCredits: 0,
        totalDebits: 0,
        netChange: 0,
        ledgerCount: openingBalances.length,
        date: today
      };

      openingBalances.forEach(ob => {
        summary.totalOpeningBalance += parseFloat(ob.openingAmount) || 0;
        summary.totalClosingBalance += parseFloat(ob.closingAmount) || 0;
        summary.totalCredits += parseFloat(ob.totalCredits) || 0;
        summary.totalDebits += parseFloat(ob.totalDebits) || 0;
      });

      summary.netChange = summary.totalCredits - summary.totalDebits;

      return summary;
    } catch (error) {
      throw new Error(`Failed to get opening balance summary: ${error.message}`);
    }
  }

  /**
   * Recalculate opening balances for a date range (maintenance function)
   */
  async recalculateOpeningBalances(startDate, endDate, ledgerId = null) {
    try {
      const whereClause = {
        date: {
          [Op.between]: [startDate, endDate]
        }
      };

      if (ledgerId) {
        whereClause.ledgerId = ledgerId;
      }

      const openingBalances = await OpeningBalance.findAll({
        where: whereClause,
        order: [['date', 'ASC'], ['ledgerId', 'ASC']]
      });

      const results = [];
      for (const ob of openingBalances) {
        const recalculated = await this.calculateDailyOpeningBalance(ob.ledgerId, ob.date);
        results.push(recalculated);
      }

      return results;
    } catch (error) {
      throw new Error(`Failed to recalculate opening balances: ${error.message}`);
    }
  }
  /**
   * Calculate closing balance for a specific ledger and date
   */
  async calculateClosingBalance(ledgerId, date) {
    try {
      // Get opening balance for the date
      const openingBalance = await OpeningBalance.findByDateAndLedger(date, ledgerId);
      
      if (openingBalance) {
        return parseFloat(openingBalance.closingAmount) || 0;
      }
      
      // If no opening balance record exists, calculate from ledger's current balance
      const ledger = await Ledger.findByPk(ledgerId);
      if (!ledger) {
        throw new Error('Ledger not found');
      }
      
      return parseFloat(ledger.currentBalance) || 0;
    } catch (error) {
      throw new Error(`Failed to calculate closing balance: ${error.message}`);
    }
  }
}

module.exports = new OpeningBalanceService();