const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const OpeningBalance = sequelize.define('OpeningBalance', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    validate: {
      isDate: true,
      notEmpty: true
    }
  },
  ledgerId: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'ledger_id',
    references: {
      model: 'ledgers',
      key: 'id'
    }
  },
  openingAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'opening_amount',
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  isManuallySet: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_manually_set'
  },
  closingAmount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'closing_amount',
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  totalCredits: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'total_credits',
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  totalDebits: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    field: 'total_debits',
    validate: {
      isDecimal: true,
      min: 0
    }
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  }
}, {
  tableName: 'opening_balances',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      unique: true,
      fields: ['date', 'ledger_id'],
      name: 'unique_date_ledger'
    },
    {
      fields: ['date'],
      name: 'idx_opening_balances_date'
    },
    {
      fields: ['ledger_id'],
      name: 'idx_opening_balances_ledger_id'
    }
  ]
});

// Instance methods
OpeningBalance.prototype.isOpeningAmountLocked = function() {
  // An opening amount is locked if it was manually set.
  // System-calculated balances should always be re-calculable.
  return this.isManuallySet; 
};

// Static method for system-only opening amount update
OpeningBalance.setAutomaticOpeningAmount = async function(id, newAmount) {
  const ob = await OpeningBalance.findByPk(id);
  if (!ob) throw new Error('OpeningBalance not found');
  if (ob.isOpeningAmountLocked()) throw new Error('Opening amount is locked and cannot be modified manually.');
  ob.openingAmount = newAmount;
  ob.isManuallySet = false;
  await ob.save();
  return ob;
};
// Add a method for system-driven updates that bypasses manual lock
OpeningBalance.setSystemCalculatedAmount = async function(id, newOpeningAmount, newClosingAmount, newTotalCredits, newTotalDebits, transaction) {
  const ob = await OpeningBalance.findByPk(id, { transaction });
  if (!ob) throw new Error('OpeningBalance record not found for system update');
  
  // Overwrite values, ensuring isManuallySet remains false if it was already false
  await ob.update({
    openingAmount: newOpeningAmount,
    closingAmount: newClosingAmount,
    totalCredits: newTotalCredits,
    totalDebits: newTotalDebits,
    isManuallySet: false // System update overrides manual status
  }, { transaction });
  return ob;
};

OpeningBalance.prototype.calculateClosingBalance = function() {
  const opening = parseFloat(this.openingAmount) || 0;
  const credits = parseFloat(this.totalCredits) || 0;
  const debits = parseFloat(this.totalDebits) || 0;
  return opening + credits - debits;
};

OpeningBalance.prototype.updateClosingBalance = async function() {
  this.closingAmount = this.calculateClosingBalance();
  return await this.save();
};

// Static methods
OpeningBalance.findByDateAndLedger = async function(date, ledgerId) {
  return await this.findOne({
    where: {
      date: date,
      ledgerId: ledgerId
    }
  });
};

OpeningBalance.findByDateRange = async function(startDate, endDate, ledgerId = null) {
  const whereClause = {
    date: {
      [sequelize.Sequelize.Op.between]: [startDate, endDate]
    }
  };
  
  if (ledgerId) {
    whereClause.ledgerId = ledgerId;
  }
  
  return await this.findAll({
    where: whereClause,
    order: [['date', 'ASC']],
    include: [
      {
        model: sequelize.models.Ledger,
        as: 'ledger',
        attributes: ['id', 'name', 'ledgerType']
      }
    ]
  });
};

OpeningBalance.getLatestByLedger = async function(ledgerId, beforeDate = null) {
  const whereClause = { ledgerId };
  
  if (beforeDate) {
    whereClause.date = {
      [sequelize.Sequelize.Op.lt]: beforeDate
    };
  }
  
  return await this.findOne({
    where: whereClause,
    order: [['date', 'DESC']]
  });
};

/**
 * Ensure balance continuity between consecutive dates
 * This method updates the opening balance of a date to match the closing balance of the previous date
 */
OpeningBalance.ensureContinuity = async function(date, ledgerId, transaction = null) {
  try {
    // Get previous day's record
    const previousDate = new Date(date);
    previousDate.setDate(previousDate.getDate() - 1);
    const previousDateStr = previousDate.toISOString().split('T')[0];
    
    const previousBalance = await OpeningBalance.findOne({
      where: {
        date: previousDateStr,
        ledgerId: ledgerId
      },
      transaction
    });
    
    if (previousBalance) {
      // Get current day's record
      const currentBalance = await OpeningBalance.findOne({
        where: {
          date: date,
          ledgerId: ledgerId
        },
        transaction
      });
      
      if (currentBalance) {
        // Update opening balance to match previous day's closing balance
        const previousClosing = parseFloat(previousBalance.closingAmount) || 0;
        const currentOpening = parseFloat(currentBalance.openingAmount) || 0;
        
        // Only update if there's a discrepancy
        if (Math.abs(previousClosing - currentOpening) > 0.01) {
          // Only allow system update if not locked
          if (currentBalance.isOpeningAmountLocked()) {
            throw new Error('Opening amount is locked and cannot be modified manually.');
          }
          await currentBalance.update({
            openingAmount: previousClosing,
            isManuallySet: false
          }, { transaction });

          // Recalculate closing balance
          const credits = parseFloat(currentBalance.totalCredits) || 0;
          const debits = parseFloat(currentBalance.totalDebits) || 0;
          const newClosing = previousClosing + credits - debits;

          await currentBalance.update({
            closingAmount: newClosing
          }, { transaction });

          console.log(`Ensured continuity for ledger ${ledgerId} on ${date}: Opening=${previousClosing}, Closing=${newClosing}`);
          return newClosing;
        }
        return parseFloat(currentBalance.closingAmount) || 0;
      }
    }
    return null;
  } catch (error) {
    console.error('Error ensuring balance continuity:', error);
    throw error;
  }
};

/**
 * Ensure system-wide balance continuity for a specific date
 * Updates all ledgers' opening balances to match previous day's closing balances
 */
OpeningBalance.ensureSystemContinuity = async function(date, transaction = null) {
  try {
    console.log(`Ensuring system-wide continuity for date: ${date}`);
    
    // Get all opening balance records for this date
    const currentBalances = await OpeningBalance.findAll({
      where: { date: date },
      transaction
    });
    
    let updatedClosingBalances = [];
    
    // Ensure continuity for each ledger
    for (const balance of currentBalances) {
      const newClosing = await OpeningBalance.ensureContinuity(date, balance.ledgerId, transaction);
      if (newClosing !== null) {
        updatedClosingBalances.push({
          ledgerId: balance.ledgerId,
          closingAmount: newClosing
        });
      }
    }
    
    return updatedClosingBalances;
  } catch (error) {
    console.error('Error ensuring system-wide balance continuity:', error);
    throw error;
  }
};

module.exports = OpeningBalance;