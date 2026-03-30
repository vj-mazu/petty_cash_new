// services/auditService.js

const fs = require('fs').promises;
const path = require('path');

class AuditService {
  constructor() {
    this.logDir = path.join(__dirname, '../logs');
    this.auditLogFile = path.join(this.logDir, 'audit.log');
    this.ensureLogDirectory();
  }

  async ensureLogDirectory() {
    try {
      await fs.access(this.logDir);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(this.logDir, { recursive: true });
      }
    }
  }

  async logTransactionEdit(transactionId, oldData, newData, userId, username) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'TRANSACTION_EDIT',
      transactionId,
      userId,
      username,
      oldData: {
        description: oldData.description,
        debitAmount: oldData.debitAmount,
        creditAmount: oldData.creditAmount,
        date: oldData.date,
        reference: oldData.reference,
        ledgerId: oldData.ledgerId
      },
      newData: {
        description: newData.description,
        debitAmount: newData.debitAmount,
        creditAmount: newData.creditAmount,
        date: newData.date,
        reference: newData.reference,
        ledgerId: newData.ledgerId
      },
      changes: this.calculateChanges(oldData, newData)
    };

    await this.writeAuditLog(auditEntry);
    console.log('Transaction edit audit logged:', auditEntry);
  }

  async logTransactionDelete(transactionData, userId, username, newLedgerBalance) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      action: 'TRANSACTION_DELETE',
      transactionId: transactionData.id,
      userId,
      username,
      deletedData: {
        description: transactionData.description,
        debitAmount: transactionData.debitAmount,
        creditAmount: transactionData.creditAmount,
        date: transactionData.date,
        reference: transactionData.reference,
        ledgerId: transactionData.ledgerId,
        ledgerName: transactionData.ledger?.name,
        originalCreator: transactionData.creator?.username
      },
      balanceImpact: {
        oldLedgerBalance: transactionData.ledger?.currentBalance,
        newLedgerBalance: newLedgerBalance,
        adjustment: newLedgerBalance - transactionData.ledger?.currentBalance
      }
    };

    await this.writeAuditLog(auditEntry);
    console.log('Transaction delete audit logged:', auditEntry);
  }

  calculateChanges(oldData, newData) {
    const changes = [];

    Object.keys(newData).forEach(key => {
      if (newData[key] !== undefined && oldData[key] !== newData[key]) {
        changes.push({
          field: key,
          oldValue: oldData[key],
          newValue: newData[key]
        });
      }
    });

    return changes;
  }

  async writeAuditLog(auditEntry) {
    try {
      const logLine = JSON.stringify(auditEntry) + '\n';
      await fs.appendFile(this.auditLogFile, logLine);
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  async getAuditLogs(transactionId = null, limit = 100) {
    try {
      const logContent = await fs.readFile(this.auditLogFile, 'utf8');
      const logs = logContent
        .split('\n')
        .filter(line => line.trim())
        .map(line => {
          try {
            return JSON.parse(line);
          } catch (e) {
            return null;
          }
        })
        .filter(log => log !== null)
        .reverse(); // Most recent first

      if (transactionId) {
        return logs
          .filter(log => log.transactionId === transactionId)
          .slice(0, limit);
      }

      return logs.slice(0, limit);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      console.error('Failed to read audit logs:', error);
      return [];
    }
  }

  async getTransactionHistory(transactionId) {
    const logs = await this.getAuditLogs(transactionId);
    return logs.map(log => ({
      timestamp: log.timestamp,
      action: log.action,
      user: log.username || log.userId,
      changes: log.changes || [],
      balanceImpact: log.balanceImpact
    }));
  }
}

module.exports = new AuditService();