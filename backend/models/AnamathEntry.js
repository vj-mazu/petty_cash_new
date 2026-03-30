const { DataTypes, Op } = require('sequelize');
const sequelize = require('../config/database');

const AnamathEntry = sequelize.define('AnamathEntry', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  date: {
    type: DataTypes.DATEONLY,
    allowNull: false,
    defaultValue: DataTypes.NOW,
    validate: {
      isDate: true,
      notEmpty: true
    }
  },
  amount: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    validate: {
      isDecimal: true,
      min: 0.01
    }
  },
  remarks: {
    type: DataTypes.TEXT,
    allowNull: true,
    validate: {
      len: [0, 1000]
    }
  },
  transactionNumber: {
    type: DataTypes.BIGINT,
    allowNull: true,
    field: 'transaction_number',
    unique: true
  },
  ledgerId: {
    type: DataTypes.UUID,
    allowNull: true, // Can be null for general anamath entries
    field: 'ledger_id',
    references: {
      model: 'ledgers',
      key: 'id'
    }
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'created_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  isClosed: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false,
    field: 'is_closed'
  },
  closedAt: {
    type: DataTypes.DATE,
    allowNull: true,
    field: 'closed_at'
  },
  closedBy: {
    type: DataTypes.UUID,
    allowNull: true,
    field: 'closed_by',
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    allowNull: false,
    defaultValue: 'approved'
  }
}, {
  tableName: 'anamath_entries',
  timestamps: true,
  underscored: true,
  indexes: [
    {
      fields: ['date'],
      name: 'idx_anamath_entries_date'
    },
    {
      fields: ['ledger_id'],
      name: 'idx_anamath_entries_ledger_id'
    },
    {
      fields: ['created_by'],
      name: 'idx_anamath_entries_created_by'
    }
  ]
});

// Instance methods
AnamathEntry.prototype.toJSON = function () {
  const values = { ...this.get() };
  // Note: Amount formatting removed — frontend handles this via formatIndianCurrency()
  return values;
};

// Static methods
AnamathEntry.findByDateRange = async function (startDate, endDate, options = {}) {
  const whereClause = {
    date: {
      [sequelize.Sequelize.Op.between]: [startDate, endDate]
    }
  };

  if (options.ledgerId) {
    whereClause.ledgerId = options.ledgerId;
  }

  if (options.createdBy) {
    whereClause.createdBy = options.createdBy;
  }

  return await this.findAll({
    where: whereClause,
    order: [['date', 'DESC'], ['createdAt', 'DESC']],
    include: [
      {
        model: sequelize.models.Ledger,
        as: 'ledger',
        attributes: ['id', 'name', 'ledgerType'],
        required: false
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
};

AnamathEntry.getTotalByDateRange = async function (startDate, endDate, ledgerId = null) {
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
      [sequelize.fn('SUM', sequelize.col('amount')), 'totalAmount'],
      [sequelize.fn('COUNT', sequelize.col('id')), 'totalEntries']
    ],
    raw: true
  });

  return {
    totalAmount: parseFloat(result.totalAmount) || 0,
    totalEntries: parseInt(result.totalEntries) || 0
  };
};

// Hooks — Use PostgreSQL SEQUENCE for O(1) numbering
AnamathEntry.beforeCreate(async (entry) => {
  if (!entry.transactionNumber) {
    try {
      const [result] = await sequelize.query(
        `SELECT nextval('anamath_number_seq') as next_num`
      );
      entry.transactionNumber = parseInt(result[0].next_num);
    } catch (error) {
      // Fallback to MAX() if sequence doesn't exist yet (pre-migration)
      const maxNum = await AnamathEntry.max('transactionNumber');
      entry.transactionNumber = (maxNum || 0) + 1;
    }
  }
});

module.exports = AnamathEntry;