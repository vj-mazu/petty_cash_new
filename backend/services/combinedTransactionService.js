const { Transaction, AnamathEntry, Ledger, sequelize } = require('../models');

class CombinedTransactionService {
  /**
   * Create a combined transaction (regular transaction + anamath entry)
   */
  async createCombinedTransaction(transactionData, anamathData, userId) {
    const t = await sequelize.transaction();
    
    try {
      // Get user info for access validation
      const { User } = require('../models');
      const user = await User.findByPk(userId);
      if (!user) {
        throw new Error('User not found');
      }

      // Validate ledger exists and user has access
      const ledgerWhere = { id: transactionData.ledgerId };
      
      // If user is not an admin/owner, restrict access to only their created ledgers
      if (!['admin', 'owner'].includes(user.role)) {
        ledgerWhere.createdBy = userId;
      }

      const ledger = await Ledger.findOne({
        where: ledgerWhere,
        transaction: t
      });

      if (!ledger) {
        throw new Error('Ledger not found or access denied');
      }

      // Generate a unique transaction number for both entries
      const transactionNumber = await this.generateTransactionNumber();
      console.log(`🔢 Generated transaction number: ${transactionNumber} for new combined transaction`);

      // Create the anamath entry first
      const anamathEntry = await AnamathEntry.create({
        date: anamathData.date,
        amount: parseFloat(anamathData.amount),
        remarks: anamathData.remarks || null, // Ensure empty remarks stay null
        ledgerId: anamathData.ledgerId || transactionData.ledgerId,
        transactionNumber: transactionNumber,
        createdBy: userId
      }, { transaction: t });

      console.log(`🎯 Created anamath entry with transaction number: ${anamathEntry.transactionNumber}`);

      // Create the main transaction
      const transaction = await Transaction.create({
        date: transactionData.date,
        description: transactionData.description,
        reference: 'A',
        debitAmount: transactionData.debitAmount || 0,
        creditAmount: transactionData.creditAmount || 0,
        ledgerId: transactionData.ledgerId,
        transactionType: 'combined',
        transactionNumber: transactionNumber,
        isCombined: true,
        combinedWithAnamathId: anamathEntry.id,
        createdBy: userId
      }, { transaction: t });

      // Update ledger balance
      const balanceChange = (parseFloat(transactionData.creditAmount) || 0) - (parseFloat(transactionData.debitAmount) || 0);
      await ledger.update({
        currentBalance: parseFloat(ledger.currentBalance) + balanceChange
      }, { transaction: t });

      await t.commit();

      // Return the combined result
      return {
        transaction: await Transaction.findByPk(transaction.id, {
          include: [
            {
              model: Ledger,
              as: 'ledger',
              attributes: ['id', 'name', 'ledgerType', 'currentBalance']
            },
            {
              model: AnamathEntry,
              as: 'combinedAnamathEntry'
            }
          ]
        }),
        anamathEntry: await AnamathEntry.findByPk(anamathEntry.id, {
          include: [
            {
              model: Ledger,
              as: 'ledger',
              attributes: ['id', 'name', 'ledgerType']
            }
          ]
        }),
        transactionNumber
      };
    } catch (error) {
      await t.rollback();
      throw new Error(`Failed to create combined transaction: ${error.message}`);
    }
  }

  /**
   * Update a combined transaction
   */
  async updateCombinedTransaction(transactionId, transactionData, anamathData, userId) {
    const t = await sequelize.transaction();
    
    try {
      // Find the existing transaction
      const existingTransaction = await Transaction.findOne({
        where: {
          id: transactionId,
          createdBy: userId,
          isCombined: true
        },
        include: [
          {
            model: AnamathEntry,
            as: 'combinedAnamathEntry'
          }
        ],
        transaction: t
      });

      if (!existingTransaction) {
        throw new Error('Combined transaction not found');
      }

      const anamathEntry = existingTransaction.combinedAnamathEntry;
      if (!anamathEntry) {
        throw new Error('Associated anamath entry not found');
      }

      // Calculate old balance change to reverse it
      const oldBalanceChange = parseFloat(existingTransaction.creditAmount) - parseFloat(existingTransaction.debitAmount);

      // Update the transaction
      const transactionUpdateData = {};
      if (transactionData.date !== undefined) transactionUpdateData.date = transactionData.date;
      if (transactionData.description !== undefined) transactionUpdateData.description = transactionData.description;
      if (transactionData.reference !== undefined) transactionUpdateData.reference = transactionData.reference;
      if (transactionData.debitAmount !== undefined) transactionUpdateData.debitAmount = parseFloat(transactionData.debitAmount);
      if (transactionData.creditAmount !== undefined) transactionUpdateData.creditAmount = parseFloat(transactionData.creditAmount);

      await existingTransaction.update(transactionUpdateData, { transaction: t });

      // Update the anamath entry
      const anamathUpdateData = {};
      if (anamathData.date !== undefined) anamathUpdateData.date = anamathData.date;
      if (anamathData.amount !== undefined) anamathUpdateData.amount = parseFloat(anamathData.amount);
      if (anamathData.remarks !== undefined) anamathUpdateData.remarks = anamathData.remarks || null; // Ensure empty remarks stay null
      if (anamathData.ledgerId !== undefined) anamathUpdateData.ledgerId = anamathData.ledgerId;

      await anamathEntry.update(anamathUpdateData, { transaction: t });

      // Update ledger balance
      const newBalanceChange = (transactionUpdateData.creditAmount || parseFloat(existingTransaction.creditAmount)) - 
                              (transactionUpdateData.debitAmount || parseFloat(existingTransaction.debitAmount));
      const netBalanceChange = newBalanceChange - oldBalanceChange;

      const ledger = await Ledger.findByPk(existingTransaction.ledgerId, { transaction: t });
      await ledger.update({
        currentBalance: parseFloat(ledger.currentBalance) + netBalanceChange
      }, { transaction: t });

      await t.commit();

      // Return updated combined result
      return {
        transaction: await Transaction.findByPk(existingTransaction.id, {
          include: [
            {
              model: Ledger,
              as: 'ledger',
              attributes: ['id', 'name', 'ledgerType', 'currentBalance']
            },
            {
              model: AnamathEntry,
              as: 'combinedAnamathEntry'
            }
          ]
        }),
        anamathEntry: await AnamathEntry.findByPk(anamathEntry.id, {
          include: [
            {
              model: Ledger,
              as: 'ledger',
              attributes: ['id', 'name', 'ledgerType']
            }
          ]
        })
      };
    } catch (error) {
      await t.rollback();
      throw new Error(`Failed to update combined transaction: ${error.message}`);
    }
  }

  /**
   * Delete a combined transaction
   */
  async deleteCombinedTransaction(transactionId, userId) {
    const t = await sequelize.transaction();
    
    try {
      // Find the existing transaction
      const existingTransaction = await Transaction.findOne({
        where: {
          id: transactionId,
          createdBy: userId,
          isCombined: true
        },
        include: [
          {
            model: AnamathEntry,
            as: 'combinedAnamathEntry'
          }
        ],
        transaction: t
      });

      if (!existingTransaction) {
        throw new Error('Combined transaction not found');
      }

      const anamathEntry = existingTransaction.combinedAnamathEntry;

      // Reverse the balance change
      const balanceChange = parseFloat(existingTransaction.creditAmount) - parseFloat(existingTransaction.debitAmount);
      const ledger = await Ledger.findByPk(existingTransaction.ledgerId, { transaction: t });
      await ledger.update({
        currentBalance: parseFloat(ledger.currentBalance) - balanceChange
      }, { transaction: t });

      // Delete both entries
      if (anamathEntry) {
        await anamathEntry.destroy({ transaction: t });
      }
      await existingTransaction.destroy({ transaction: t });

      await t.commit();

      return {
        success: true,
        message: 'Combined transaction deleted successfully'
      };
    } catch (error) {
      await t.rollback();
      throw new Error(`Failed to delete combined transaction: ${error.message}`);
    }
  }

  /**
   * Get combined transactions with their anamath entries
   */
  async getCombinedTransactions(userId, options = {}) {
    try {
      const whereClause = {
        createdBy: userId,
        isCombined: true
      };

      if (options.dateRange) {
        whereClause.date = {
          [sequelize.Sequelize.Op.between]: [options.dateRange.start, options.dateRange.end]
        };
      }

      if (options.ledgerId) {
        whereClause.ledgerId = options.ledgerId;
      }

      const transactions = await Transaction.findAll({
        where: whereClause,
        include: [
          {
            model: Ledger,
            as: 'ledger',
            attributes: ['id', 'name', 'ledgerType']
          },
          {
            model: AnamathEntry,
            as: 'combinedAnamathEntry',
            include: [
              {
                model: Ledger,
                as: 'ledger',
                attributes: ['id', 'name', 'ledgerType']
              }
            ]
          }
        ],
        order: [['date', 'DESC'], ['createdAt', 'DESC']],
        limit: options.limit || 50,
        offset: options.offset || 0
      });

      return transactions;
    } catch (error) {
      throw new Error(`Failed to get combined transactions: ${error.message}`);
    }
  }

  /**
   * Find combined transaction by reference number
   */
  async findCombinedTransactionByReference(referenceNumber, userId) {
    try {
      const transaction = await Transaction.findOne({
        where: {
          referenceNumber: referenceNumber,
          createdBy: userId,
          isCombined: true
        },
        include: [
          {
            model: Ledger,
            as: 'ledger',
            attributes: ['id', 'name', 'ledgerType', 'currentBalance']
          },
          {
            model: AnamathEntry,
            as: 'combinedAnamathEntry',
            include: [
              {
                model: Ledger,
                as: 'ledger',
                attributes: ['id', 'name', 'ledgerType']
              }
            ]
          }
        ]
      });

      if (!transaction) {
        throw new Error('Combined transaction not found');
      }

      return {
        transaction,
        anamathEntry: transaction.combinedAnamathEntry
      };
    } catch (error) {
      throw new Error(`Failed to find combined transaction: ${error.message}`);
    }
  }

  /**
   * Generate a unique transaction number for combined transactions
   */
  async generateTransactionNumber() {
    const { AnamathEntry } = require('../models');
    
    // Find the highest transaction number from anamath entries and increment it
    const lastAnamathEntry = await AnamathEntry.findOne({
      attributes: [[sequelize.fn('MAX', sequelize.col('transaction_number')), 'maxTransactionNumber']],
      raw: true
    });
    
    const maxNumber = lastAnamathEntry?.maxTransactionNumber || 0;
    const nextNumber = parseInt(maxNumber) + 1;
    
    console.log(`🔢 Generating transaction number: maxNumber=${maxNumber}, nextNumber=${nextNumber}`);
    
    return nextNumber;
  }

  /**
   * Validate combined transaction data
   */
  validateCombinedTransactionData(transactionData, anamathData) {
    const errors = [];

    // Validate transaction data
    if (!transactionData.ledgerId) {
      errors.push('Transaction ledger ID is required');
    }
    if (!transactionData.date) {
      errors.push('Transaction date is required');
    }
    if (!transactionData.description) {
      errors.push('Transaction description is required');
    }
    if ((!transactionData.debitAmount || transactionData.debitAmount <= 0) && 
        (!transactionData.creditAmount || transactionData.creditAmount <= 0)) {
      errors.push('Transaction must have either debit or credit amount greater than 0');
    }
    if (transactionData.debitAmount > 0 && transactionData.creditAmount > 0) {
      errors.push('Transaction cannot have both debit and credit amounts');
    }

    // Validate anamath data
    if (!anamathData.date) {
      errors.push('Anamath date is required');
    }
    if (!anamathData.amount || anamathData.amount <= 0) {
      errors.push('Anamath amount must be greater than 0');
    }
    if (!anamathData.remarks || anamathData.remarks.trim().length === 0) {
      errors.push('Anamath remarks are required');
    }

    return errors;
  }
}

module.exports = new CombinedTransactionService();