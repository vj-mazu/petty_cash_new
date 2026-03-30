const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW
  },
  description: {
    type: DataTypes.STRING,
    allowNull: true, // Allow null values
    validate: {
      len: [0, 255] // Allow empty strings
    }
  },
  reference: {
    type: DataTypes.STRING,
    allowNull: true,
    validate: {
      len: [0, 100]
    }
  },
  debitAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  creditAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  ledgerId: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'ledgers',
      key: 'id'
    }
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  transactionType: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'regular',
    field: 'transaction_type',
    validate: {
      isIn: {
        args: [['regular', 'combined', 'anamath']],
        msg: 'Transaction type must be regular, combined, or anamath'
      }
    }
  },
  referenceNumber: {
    type: DataTypes.STRING(100),
    allowNull: true,
    field: 'reference_number',
    validate: {
      len: [0, 100]
    }
  },
  isCombined: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_combined'
  },
  combinedWithAnamathId: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'combined_with_anamath_id',
    references: {
      model: 'anamath_entries',
      key: 'id'
    }
  },
  transactionNumber: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'transaction_number',
    unique: true
  },
  isSuspended: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_suspended'
  },
  suspendedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'suspended_at'
  },
  suspendedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'suspended_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 1000]
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'approved'
  }
}, {
  tableName: 'transactions',
  timestamps: true,
  indexes: [
    {
      fields: ['date'],
      name: 'idx_transactions_date'
    },
    {
      fields: ['transaction_type'],
      name: 'idx_transactions_type'
    },
    {
      fields: ['reference_number'],
      name: 'idx_transactions_reference'
    },
    {
      fields: ['is_combined'],
      name: 'idx_transactions_combined'
    },
    {
      fields: ['ledgerId', 'date'],
      name: 'idx_transactions_ledger_date'
    },
    {
      fields: ['is_suspended'],
      name: 'idx_transactions_suspended'
    },
    // Covering index for the main paginated query — critical for 10M+ records
    {
      fields: ['is_suspended', 'date', 'createdAt'],
      name: 'idx_transactions_main_query'
    },
    // Cursor pagination index
    {
      fields: ['date', 'id'],
      name: 'idx_transactions_cursor_page'
    }
  ],
  validate: {
    eitherDebitOrCredit() {
      if (this.debitAmount > 0 && this.creditAmount > 0) {
        throw new Error('Transaction cannot have both debit and credit amounts');
      }
      // Allow both amounts to be zero only for anamath transactions
      if (this.debitAmount === 0 && this.creditAmount === 0 && this.transactionType !== 'anamath') {
        throw new Error('Transaction must have either debit or credit amount');
      }
    },
    suspendedValidation() {
      if (this.isSuspended && !this.suspendedAt) {
        this.suspendedAt = new Date();
      }
    }
  }
});

// Instance methods
Transaction.prototype.getTransactionAmount = function () {
  return this.debitAmount > 0 ? this.debitAmount : this.creditAmount;
};

Transaction.prototype.getTransactionDirection = function () {
  return this.debitAmount > 0 ? 'debit' : 'credit';
};

Transaction.prototype.generateReferenceNumber = function () {
  const date = new Date(this.date);
  const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
  const type = this.getTransactionDirection().toUpperCase();
  const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
  return `${type}-${dateStr}-${randomStr}`;
};

Transaction.prototype.toJSON = function () {
  const values = { ...this.get() };
  // Add computed fields
  values.amount = this.getTransactionAmount();
  values.direction = this.getTransactionDirection();
  values.reference = this.reference;

  // Formatted transaction number with "T" prefix
  if (values.transactionNumber !== undefined && values.transactionNumber !== null) {
    values.displayTransactionNumber = `T${values.transactionNumber.toString().padStart(2, '0')}`;
  }

  // Note: Amount formatting removed — frontend handles this via formatIndianCurrency()
  return values;
};

// Static methods
Transaction.findWithRunningBalance = async function (options = {}) {
  const whereClause = {};

  if (options.ledgerId) {
    whereClause.ledgerId = options.ledgerId;
  }

  if (options.dateRange) {
    whereClause.date = {
      [sequelize.Sequelize.Op.between]: [options.dateRange.start, options.dateRange.end]
    };
  }

  if (options.transactionType) {
    whereClause.transactionType = options.transactionType;
  }

  // Include suspended transactions in display but mark them separately
  if (options.includeSuspended !== true) {
    whereClause.isSuspended = false;
  }

  const transactions = await this.findAll({
    where: whereClause,
    order: [['date', 'ASC'], ['createdAt', 'ASC']],
    include: [
      {
        model: sequelize.models.Ledger,
        as: 'ledger',
        attributes: ['id', 'name', 'ledgerType', 'currentBalance']
      },
      {
        model: sequelize.models.User,
        as: 'creator',
        attributes: ['id', 'username', 'email']
      }
    ],
    limit: options.limit || 50,
    offset: options.offset || 0
  });

  // Calculate running balance (exclude suspended transactions from balance calculation)
  let runningBalance = options.startingBalance || 0;
  return transactions.map(transaction => {
    const transactionData = transaction.toJSON();

    // Only include non-suspended transactions in balance calculations
    if (!transaction.isSuspended) {
      if (transaction.creditAmount > 0) {
        runningBalance += parseFloat(transaction.creditAmount);
      } else {
        runningBalance -= parseFloat(transaction.debitAmount);
      }
    }

    transactionData.runningBalance = runningBalance;
    transactionData.affectsBalance = !transaction.isSuspended;
    return transactionData;
  });
};

Transaction.getTotalsByDateRange = async function (startDate, endDate, ledgerId = null) {
  const whereClause = {
    date: {
      [sequelize.Sequelize.Op.between]: [startDate, endDate]
    }
  };

  if (ledgerId) {
    whereClause.ledgerId = ledgerId;
  }

  const result = await this.findOne({
    where: whereClause,
    attributes: [
      [sequelize.fn('SUM', sequelize.col('creditAmount')), 'totalCredits'],
      [sequelize.fn('SUM', sequelize.col('debitAmount')), 'totalDebits'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalTransactions']
    ],
    raw: true
  });

  return {
    totalCredits: parseFloat(result.totalCredits) || 0,
    totalDebits: parseFloat(result.totalDebits) || 0,
    totalTransactions: parseInt(result.totalTransactions) || 0,
    netAmount: (parseFloat(result.totalCredits) || 0) - (parseFloat(result.totalDebits) || 0)
  };
};

// Hooks — Use PostgreSQL SEQUENCE for O(1) numbering instead of MAX()
Transaction.beforeCreate(async (transaction) => {
  if (!transaction.referenceNumber) {
    transaction.referenceNumber = transaction.generateReferenceNumber();
  }

  // Use PostgreSQL SEQUENCE for instant numbering (O(1) vs O(N) at 10M rows)
  if (!transaction.transactionNumber) {
    try {
      const [result] = await sequelize.query(
        `SELECT nextval('transaction_number_seq') as next_num`
      );
      transaction.transactionNumber = parseInt(result[0].next_num);
    } catch (error) {
      // Fallback to MAX() if sequence doesn't exist yet (pre-migration)
      const maxTransactionNumber = await Transaction.max('transactionNumber');
      transaction.transactionNumber = (maxTransactionNumber || 0) + 1;
    }
  }
});

module.exports = Transaction;