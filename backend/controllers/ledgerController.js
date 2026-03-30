// controllers/ledgerController.js

const { Ledger, Transaction, User, SystemSettings, sequelize } = require('../models');
const { Op } = require('sequelize');

// Create new ledger
const createLedger = async (req, res) => {
  try {
    const { name, description } = req.body;

    // Check if ledger name already exists for this user
    const existingLedger = await Ledger.findOne({
      where: {
        name,
        createdBy: req.user.id
      }
    });

    if (existingLedger) {
      return res.status(409).json({
        success: false,
        message: 'Ledger with this name already exists'
      });
    }

    // Always create ledger with 'asset' type as default
    const ledger = await Ledger.create({
      name,
      description,
      currentBalance: 0, // Always start with 0 - balance calculated through transactions
      ledgerType: 'asset', // Always set to 'asset' as default
      createdBy: req.user.id
    });

    res.status(201).json({
      success: true,
      message: 'Ledger created successfully',
      data: { ledger }
    });
  } catch (error) {
    console.error('Create ledger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to create ledger',
      error: error.message
    });
  }
};

// Get all ledgers
const getAllLedgers = async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const offset = (page - 1) * limit;

    let whereClause = { isActive: true };

    // Since all users are admin now, no role-based restrictions

    if (search) {
      const searchTerm = search.toLowerCase();
      whereClause[Op.or] = [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('name')), {
          [Op.like]: `%${searchTerm}%`
        }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('description')), {
          [Op.like]: `%${searchTerm}%`
        })
      ];
    }

    const { count, rows: ledgers } = await Ledger.findAndCountAll({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        }
      ],
      limit: parseInt(limit),
      offset: parseInt(offset),
      order: [['createdAt', 'DESC']]
    });

    res.json({
      success: true,
      data: {
        ledgers,
        pagination: {
          total: count,
          page: parseInt(page),
          pages: Math.ceil(count / limit),
          limit: parseInt(limit)
        }
      }
    });
  } catch (error) {
    console.error('Get ledgers error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ledgers',
      error: error.message
    });
  }
};

// Get ledger by ID
const getLedgerById = async (req, res) => {
  try {
    const { id } = req.params;

    let whereClause = { id, isActive: true };

    // Since all users are admin now, no role-based restrictions

    const ledger = await Ledger.findOne({
      where: whereClause,
      include: [
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        },
        {
          model: Transaction,
          as: 'transactions',
          include: [
            {
              model: User,
              as: 'creator',
              attributes: ['id', 'username']
            }
          ],
          order: [['date', 'DESC'], ['createdAt', 'DESC']],
          limit: 50 // Get latest 50 transactions
        }
      ]
    });

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    res.json({
      success: true,
      data: { ledger }
    });
  } catch (error) {
    console.error('Get ledger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ledger',
      error: error.message
    });
  }
};

// Update ledger
const updateLedger = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description } = req.body; // Only allow name and description updates

    let whereClause = { id, isActive: true };

    // Since all users are admin now, no role-based restrictions

    const ledger = await Ledger.findOne({ where: whereClause });

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    // Check if name already exists for another ledger
    if (name && name !== ledger.name) {
      const existingLedger = await Ledger.findOne({
        where: {
          name,
          createdBy: ledger.createdBy,
          id: { [Op.ne]: id }
        }
      });

      if (existingLedger) {
        return res.status(409).json({
          success: false,
          message: 'Ledger with this name already exists'
        });
      }
    }

    // Update allowed fields (ledgerType is not allowed to be updated)
    const updateData = {
      updatedBy: req.user.id
    };

    if (name !== undefined) updateData.name = name;
    if (description !== undefined) updateData.description = description;

    await ledger.update(updateData);

    res.json({
      success: true,
      message: 'Ledger updated successfully',
      data: { ledger }
    });
  } catch (error) {
    console.error('Update ledger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update ledger',
      error: error.message
    });
  }
};

// Delete ledger (soft delete)
const deleteLedger = async (req, res) => {
  try {
    const { id } = req.params;

    let whereClause = { id, isActive: true };

    // Since all users are admin now, no role-based restrictions

    const ledger = await Ledger.findOne({ where: whereClause });

    if (!ledger) {
      return res.status(404).json({
        success: false,
        message: 'Ledger not found'
      });
    }

    await ledger.update({
      isActive: false,
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Ledger deleted successfully'
    });
  } catch (error) {
    console.error('Delete ledger error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete ledger',
      error: error.message
    });
  }
};

// Get ledger summary/dashboard data
const getLedgerSummary = async (req, res) => {
  try {
    let whereClause = { isActive: true };

    // Run both queries in parallel (no transaction needed for read-only)
    const [globalOpeningBalance, ledgers] = await Promise.all([
      SystemSettings.findOne({
        where: { settingKey: 'global_opening_balance', isActive: true }
      }),
      Ledger.findAll({
        where: whereClause,
        attributes: ['id', 'name', 'ledgerType', 'currentBalance']
      })
    ]);

    const openingBalance = globalOpeningBalance ? parseFloat(globalOpeningBalance.settingValue) : 0;

    // Calculate total from ledgers (sum of all ledger balances)
    const totalLedgersBalance = ledgers.reduce((sum, ledger) => sum + parseFloat(ledger.currentBalance), 0);

    // Calculate total balance: Opening Balance + (Sum of all ledger balances)
    const totalBalance = openingBalance + totalLedgersBalance;

    const summary = {
      totalLedgers: ledgers.length,
      totalBalance: totalBalance,
      openingBalance: openingBalance,
      totalLedgersBalance: totalLedgersBalance,
      byType: {}
    };

    // Group by ledger type
    ledgers.forEach(ledger => {
      const type = ledger.ledgerType;
      if (!summary.byType[type]) {
        summary.byType[type] = {
          count: 0,
          balance: 0
        };
      }
      summary.byType[type].count++;
      summary.byType[type].balance += parseFloat(ledger.currentBalance);
    });

    res.json({
      success: true,
      data: { summary, ledgers }
    });
  } catch (error) {
    console.error('Get ledger summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ledger summary',
      error: error.message
    });
  }
};

const getLedgerSummaries = async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const hasDateFilter = !!(startDate && endDate);
    const replacements = {
      startDate: startDate || null,
      endDate: endDate || null
    };

    // Query combines both transactions and approved anamath entries for each ledger
    // All conditions use parameterized replacements — no string interpolation
    const [summaries] = await sequelize.query(`
      SELECT
        l.id,
        l.name,
        COALESCE(tx.total_credits, 0) + COALESCE(an.total_anamath, 0) AS "totalCredits",
        COALESCE(tx.total_debits, 0) AS "totalDebits",
        COALESCE(tx.tx_count, 0) + COALESCE(an.an_count, 0) AS "transactionCount",
        GREATEST(tx.last_tx_date, an.last_an_date) AS "lastTransactionDate"
      FROM ledgers l
      LEFT JOIN (
        SELECT
          "ledgerId",
          SUM("creditAmount") AS total_credits,
          SUM("debitAmount") AS total_debits,
          COUNT(id) AS tx_count,
          MAX(date) AS last_tx_date
        FROM transactions
        WHERE (CAST(:startDate AS DATE) IS NULL OR date >= CAST(:startDate AS DATE))
          AND (CAST(:endDate AS DATE) IS NULL OR date <= CAST(:endDate AS DATE))
        GROUP BY "ledgerId"
      ) tx ON tx."ledgerId" = l.id
      LEFT JOIN (
        SELECT
          ledger_id,
          SUM(amount) AS total_anamath,
          COUNT(id) AS an_count,
          MAX(date) AS last_an_date
        FROM anamath_entries
        WHERE status = 'approved' AND is_closed = false
          AND (CAST(:startDate AS DATE) IS NULL OR date >= CAST(:startDate AS DATE))
          AND (CAST(:endDate AS DATE) IS NULL OR date <= CAST(:endDate AS DATE))
        GROUP BY ledger_id
      ) an ON an.ledger_id = l.id
      ORDER BY l.name ASC
    `, { replacements });

    const summariesWithBalance = summaries.map(s => {
      const totalCredits = parseFloat(s.totalCredits) || 0;
      const totalDebits = parseFloat(s.totalDebits) || 0;
      return {
        id: s.id,
        name: s.name,
        totalCredits,
        totalDebits,
        balance: totalCredits - totalDebits,
        transactionCount: parseInt(s.transactionCount, 10) || 0,
        lastTransactionDate: s.lastTransactionDate
      };
    });

    res.json({
      success: true,
      data: summariesWithBalance
    });

  } catch (error) {
    console.error('Get ledger summaries error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch ledger summaries',
      error: error.message
    });
  }
};

module.exports = {
  createLedger,
  getAllLedgers,
  getLedgerById,
  updateLedger,
  deleteLedger,
  getLedgerSummary,
  getLedgerSummaries
};