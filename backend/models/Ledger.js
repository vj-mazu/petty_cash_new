const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Ledger = sequelize.define('Ledger', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING,
    allowNull: false,
    validate: {
      len: [1, 100]
    }
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  currentBalance: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      isDecimal: true
    }
  },
  openingBalance: {
    type: DataTypes.DECIMAL(15, 2),
    allowNull: false,
    defaultValue: 0.00,
    validate: {
      isDecimal: true
    }
  },
  ledgerType: {
    type: DataTypes.ENUM('asset', 'liability', 'equity', 'revenue', 'expense'),
    allowNull: false,
    defaultValue: 'asset'
  },
  isActive: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  createdBy: {
    type: DataTypes.UUID,
    allowNull: false
  },
  updatedBy: {
    type: DataTypes.UUID,
    allowNull: true
  }
}, {
  tableName: 'ledgers',
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['name', 'createdBy']
    }
  ]
});

module.exports = Ledger;