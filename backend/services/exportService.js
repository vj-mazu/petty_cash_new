const { Transaction, Ledger, AnamathEntry, User } = require('../models');
const { Op } = require('sequelize');

class ExportService {
  /**
   * Export transactions to CSV format
   */
  async exportToCSV(transactions, options = {}) {
    try {
      // Add clean header format
      let csvContent = '';
      const openingBalance = options.startingBalance || 0;

      // Add transaction report header
      csvContent += 'TRANSACTION REPORT\n';
      if (options.dateRange) {
        const startDate = new Date(options.dateRange.start);
        csvContent += `${startDate.toLocaleDateString('en-US', { month: 'short', day: '2-digit', year: 'numeric' }).toUpperCase()}\n`;
      }
      csvContent += '\n';

      // Add opening balance section
      csvContent += 'OPENING BALANCE\n';
      csvContent += `Opening Bal,${this.formatCurrency(openingBalance)}\n`;
      csvContent += '\n';

      // Add transaction details section
      csvContent += 'TRANSACTION DETAILS\n';

      const headers = [
        'SL NO',
        'DATE',
        'CREDIT',
        'CREDIT DESCRIPTION',
        'DEBIT',
        'DEBIT DESCRIPTION'
      ];

      if (options.includeAnamath) {
        headers.push('Anamath Amount', 'Anamath Remarks');
      }

      csvContent += headers.join(',') + '\n';

      let runningBalance = openingBalance;

      transactions.forEach((transaction, index) => {
        // Calculate running balance
        const creditAmount = parseFloat(transaction.creditAmount) || 0;
        const debitAmount = parseFloat(transaction.debitAmount) || 0;

        if (creditAmount > 0) {
          runningBalance += creditAmount;
        } else {
          runningBalance -= debitAmount;
        }

        const row = [
          index + 1, // SL NO
          this.formatDate(transaction.date),
          creditAmount > 0 ? this.formatCurrency(creditAmount) : '',
          creditAmount > 0 ? `"${this.escapeCsvValue(transaction.description || transaction.remarks || '')}"` : '',
          debitAmount > 0 ? this.formatCurrency(debitAmount) : '',
          debitAmount > 0 ? `"${this.escapeCsvValue(transaction.description || transaction.remarks || '')}"` : ''
        ];

        if (options.includeAnamath && transaction.combinedAnamathEntry) {
          row.push(
            this.formatCurrency(transaction.combinedAnamathEntry.amount),
            `"${this.escapeCsvValue(transaction.combinedAnamathEntry.remarks)}"`
          );
        } else if (options.includeAnamath) {
          row.push('', '');
        }

        csvContent += row.join(',') + '\n';
      });

      // Add totals section
      const totalCredits = transactions.reduce((sum, t) => sum + (parseFloat(t.creditAmount) || 0), 0);
      const totalDebits = transactions.reduce((sum, t) => sum + (parseFloat(t.debitAmount) || 0), 0);
      const closingBalance = runningBalance;

      csvContent += '\n'; // Empty line before totals
      csvContent += 'DAILY TOTALS\n';
      csvContent += `CREDIT:,${this.formatCurrency(totalCredits)}\n`;
      csvContent += `DEBIT:,${this.formatCurrency(totalDebits)}\n`;
      csvContent += `NET TOTAL:,${this.formatCurrency(totalCredits - totalDebits)}\n`;
      csvContent += '\n';
      csvContent += 'CLOSING BALANCE\n';
      csvContent += `Closing Bala,${this.formatCurrency(closingBalance)}\n`;

      return csvContent;
    } catch (error) {
      throw new Error(`Failed to generate CSV: ${error.message}`);
    }
  }

  /**
   * Export anamath entries to CSV format
   */
  async exportAnamathToCSV(anamathEntries, options = {}) {
    try {
      const headers = [
        'Date',
        'Amount',
        'Remarks',
        'Ledger',
        'Reference Number',
        'Created By',
        'Created At'
      ];

      let csvContent = headers.join(',') + '\n';

      anamathEntries.forEach(entry => {
        const row = [
          this.formatDate(entry.date),
          this.formatCurrency(entry.amount),
          `"${this.escapeCsvValue(entry.remarks)}"`,
          `"${this.escapeCsvValue(entry.ledger?.name || 'General')}"`,
          `"${this.escapeCsvValue(entry.referenceNumber || '')}"`,
          `"${this.escapeCsvValue(entry.creator?.username || '')}"`,
          this.formatDateTime(entry.createdAt)
        ];

        csvContent += row.join(',') + '\n';
      });

      return csvContent;
    } catch (error) {
      throw new Error(`Failed to generate anamath CSV: ${error.message}`);
    }
  }



  /**
   * Get transactions for export with filters
   */
  async getTransactionsForExport(userId, options = {}) {
    try {
      const whereClause = {
        createdBy: userId
      };

      // Date range filter
      if (options.dateRange) {
        whereClause.date = {
          [Op.between]: [options.dateRange.start, options.dateRange.end]
        };
      }

      // Ledger filter
      if (options.ledgerIds && options.ledgerIds.length > 0) {
        whereClause.ledgerId = {
          [Op.in]: options.ledgerIds
        };
      }

      // Transaction type filter
      if (options.transactionType) {
        whereClause.transactionType = options.transactionType;
      }

      const includeArray = [
        {
          model: Ledger,
          as: 'ledger',
          attributes: ['id', 'name', 'ledgerType']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        }
      ];

      if (options.includeAnamath) {
        includeArray.push({
          model: AnamathEntry,
          as: 'combinedAnamathEntry',
          required: false
        });
      }

      const transactions = await Transaction.findAll({
        where: whereClause,
        include: includeArray,
        order: [['date', 'ASC'], ['createdAt', 'ASC']],
        limit: options.limit || 1000
      });

      return transactions;
    } catch (error) {
      throw new Error(`Failed to get transactions for export: ${error.message}`);
    }
  }

  /**
   * Get anamath entries for export with filters
   */
  async getAnamathEntriesForExport(userId, options = {}) {
    try {
      const whereClause = {
        createdBy: userId
      };

      // Date range filter
      if (options.dateRange) {
        whereClause.date = {
          [Op.between]: [options.dateRange.start, options.dateRange.end]
        };
      }

      // Ledger filter
      if (options.ledgerIds && options.ledgerIds.length > 0) {
        whereClause.ledgerId = {
          [Op.in]: options.ledgerIds
        };
      }

      const anamathEntries = await AnamathEntry.findAll({
        where: whereClause,
        include: [
          {
            model: Ledger,
            as: 'ledger',
            attributes: ['id', 'name', 'ledgerType'],
            required: false
          },
          {
            model: User,
            as: 'creator',
            attributes: ['id', 'username', 'email']
          }
        ],
        order: [['date', 'ASC'], ['createdAt', 'ASC']],
        limit: options.limit || 1000
      });

      return anamathEntries;
    } catch (error) {
      throw new Error(`Failed to get anamath entries for export: ${error.message}`);
    }
  }

  /**
   * Helper methods for formatting
   */
  formatDate(date) {
    return new Date(date).toLocaleDateString('en-IN');
  }

  formatDateTime(datetime) {
    return new Date(datetime).toLocaleString('en-IN');
  }

  formatCurrency(amount) {
    const num = parseFloat(amount) || 0;
    return num.toLocaleString('en-IN', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2
    });
  }

  escapeCsvValue(value) {
    if (typeof value !== 'string') {
      return value;
    }
    // Escape double quotes by doubling them
    return value.replace(/"/g, '""');
  }

  /**
   * Generate export filename
   */
  generateFilename(type, options = {}) {
    const date = new Date().toISOString().slice(0, 10);
    const time = new Date().toTimeString().slice(0, 8).replace(/:/g, '');

    let filename = `${type}_${date}_${time}`;

    if (options.dateRange) {
      filename += `_${options.dateRange.start}_to_${options.dateRange.end}`;
    }

    return filename;
  }
}

module.exports = new ExportService();