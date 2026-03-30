const sequelize = require('../config/database');
const User = require('./User');
const Ledger = require('./Ledger');
const Transaction = require('./Transaction');
const SystemSettings = require('./SystemSettings');
const OpeningBalance = require('./OpeningBalance');
const AnamathEntry = require('./AnamathEntry');

// Define associations

// User hierarchy: manager -> staff
User.hasMany(User, {
  foreignKey: 'managedBy',
  as: 'managedStaff'
});
User.belongsTo(User, {
  foreignKey: 'managedBy',
  as: 'manager'
});

User.hasMany(Ledger, { 
  foreignKey: 'createdBy', 
  as: 'createdLedgers' 
});
Ledger.belongsTo(User, { 
  foreignKey: 'createdBy', 
  as: 'creator' 
});

Ledger.hasMany(Transaction, { 
  foreignKey: 'ledgerId', 
  as: 'transactions',
  onDelete: 'CASCADE'
});
Transaction.belongsTo(Ledger, { 
  foreignKey: 'ledgerId', 
  as: 'ledger' 
});

User.hasMany(Transaction, { 
  foreignKey: 'createdBy', 
  as: 'createdTransactions' 
});
Transaction.belongsTo(User, { 
  foreignKey: 'createdBy', 
  as: 'creator' 
});

Transaction.belongsTo(User, { 
  foreignKey: 'updatedBy', 
  as: 'updater' 
});

// SystemSettings associations
User.hasMany(SystemSettings, { 
  foreignKey: 'createdBy', 
  as: 'createdSettings' 
});
SystemSettings.belongsTo(User, { 
  foreignKey: 'createdBy', 
  as: 'creator' 
});

SystemSettings.belongsTo(User, { 
  foreignKey: 'updatedBy', 
  as: 'updater' 
});

// OpeningBalance associations
Ledger.hasMany(OpeningBalance, { 
  foreignKey: 'ledgerId', 
  as: 'openingBalances',
  onDelete: 'CASCADE'
});
OpeningBalance.belongsTo(Ledger, { 
  foreignKey: 'ledgerId', 
  as: 'ledger' 
});

User.hasMany(OpeningBalance, { 
  foreignKey: 'createdBy', 
  as: 'createdOpeningBalances' 
});
OpeningBalance.belongsTo(User, { 
  foreignKey: 'createdBy', 
  as: 'creator' 
});

// AnamathEntry associations
Ledger.hasMany(AnamathEntry, { 
  foreignKey: 'ledgerId', 
  as: 'anamathEntries',
  onDelete: 'SET NULL'
});
AnamathEntry.belongsTo(Ledger, { 
  foreignKey: 'ledgerId', 
  as: 'ledger' 
});

User.hasMany(AnamathEntry, { 
  foreignKey: 'createdBy', 
  as: 'createdAnamathEntries' 
});
AnamathEntry.belongsTo(User, { 
  foreignKey: 'createdBy', 
  as: 'creator' 
});

// AnamathEntry closedBy association
User.hasMany(AnamathEntry, { 
  foreignKey: 'closedBy', 
  as: 'closedAnamathEntries' 
});
AnamathEntry.belongsTo(User, { 
  foreignKey: 'closedBy', 
  as: 'closedByUser' 
});

// Enhanced Transaction associations
Transaction.belongsTo(AnamathEntry, { 
  foreignKey: 'combinedWithAnamathId', 
  as: 'combinedAnamathEntry' 
});
AnamathEntry.hasOne(Transaction, { 
  foreignKey: 'combinedWithAnamathId', 
  as: 'combinedTransaction' 
});

module.exports = {
  sequelize,
  User,
  Ledger,
  Transaction,
  SystemSettings,
  OpeningBalance,
  AnamathEntry
};