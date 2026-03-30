const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const { AnamathEntry, Ledger, User, sequelize } = require('../models');
const { authenticate, authorize, authorizeAdminOnly, authorizeCreate, authorizeEdit, authorizeDelete, authorizeView } = require('../middleware/auth');
const { Op } = require('sequelize');

// Middleware to handle validation errors
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return res.status(400).json({
      success: false,
      message: 'Validation failed',
      errors: errors.array()
    });
  }
  next();
};

// GET /api/anamath-entries - Get all anamath entries with pagination and filtering
router.get('/', authenticate, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  query('ledgerId').optional().isUUID().withMessage('Invalid ledger ID'),
  query('search').optional()
], handleValidationErrors, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const offset = (page - 1) * limit;

    const whereClause = {
      isClosed: false // Only show open (non-closed) entries by default
    };

    // Date range filter
    if (req.query.startDate && req.query.endDate) {
      whereClause.date = {
        [Op.between]: [req.query.startDate, req.query.endDate]
      };
    } else if (req.query.startDate) {
      whereClause.date = {
        [Op.gte]: req.query.startDate
      };
    } else if (req.query.endDate) {
      whereClause.date = {
        [Op.lte]: req.query.endDate
      };
    }

    // Ledger filter
    if (req.query.ledgerId) {
      whereClause.ledgerId = req.query.ledgerId;
    }

    // Search filter - Enhanced to include ledger name and anamath ID (case-insensitive)
    let includeClause = [
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
    ];

    if (req.query.search) {
      const searchConditions = [
        { remarks: { [Op.iLike]: `%${req.query.search}%` } }
      ];

      // Handle transaction number search - support both "1" and "A001" formats
      const numericSearch = parseInt(req.query.search);
      if (!isNaN(numericSearch)) {
        searchConditions.push({ transactionNumber: { [Op.eq]: numericSearch } });
      }

      // Also handle A001 format by extracting the number
      const aFormatMatch = req.query.search.match(/^A(\d+)$/i);
      if (aFormatMatch) {
        const extractedNumber = parseInt(aFormatMatch[1]);
        searchConditions.push({ transactionNumber: { [Op.eq]: extractedNumber } });
      }

      whereClause[Op.or] = searchConditions;

      // Update include to add ledger name search
      includeClause[0] = {
        model: Ledger,
        as: 'ledger',
        attributes: ['id', 'name', 'ledgerType'],
        required: false,
        where: {
          [Op.or]: [
            { name: { [Op.iLike]: `%${req.query.search}%` } }
          ]
        }
      };
    }

    // Use separate count + findAll for better performance on large tables
    // When no search/filters, use fast approximate count
    const hasSearchOrFilters = req.query.search || req.query.startDate || req.query.endDate || req.query.ledgerId;

    let count;
    if (!hasSearchOrFilters && page === 1) {
      // Fast approximate count from PostgreSQL statistics
      try {
        const [countResult] = await sequelize.query(
          `SELECT reltuples::bigint AS approx FROM pg_class WHERE relname = 'anamath_entries'`
        );
        count = parseInt(countResult[0]?.approx) || 0;
        if (count < 10000) {
          count = await AnamathEntry.count({ where: whereClause });
        }
      } catch {
        count = await AnamathEntry.count({ where: whereClause });
      }
    } else {
      count = await AnamathEntry.count({
        where: whereClause,
        include: includeClause,
        distinct: true
      });
    }

    const anamathEntries = await AnamathEntry.findAll({
      where: whereClause,
      include: includeClause,
      order: [['transactionNumber', 'ASC'], ['createdAt', 'ASC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: {
        anamathEntries,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: limit
        }
      },
      message: 'Anamath entries retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting anamath entries:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get anamath entries'
    });
  }
});

// GET /api/anamath-entries/next-number - Get next anamath transaction number (fast)
router.get('/next-number', authenticate, async (req, res) => {
  try {
    const maxNumber = await AnamathEntry.max('transactionNumber');
    const nextNumber = (maxNumber || 0) + 1;
    res.json({
      success: true,
      data: { nextTransactionNumber: nextNumber }
    });
  } catch (error) {
    console.error('Get next anamath number error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch next anamath number'
    });
  }
});

// GET /api/anamath-entries/stats/summary - Get anamath entries statistics
router.get('/stats/summary', authenticate, [
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  query('ledgerId').optional().isUUID().withMessage('Invalid ledger ID')
], handleValidationErrors, async (req, res) => {
  try {
    const { startDate, endDate, ledgerId } = req.query;

    // Default to current month if no dates provided
    const start = startDate || new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    const end = endDate || new Date().toISOString().split('T')[0];

    const whereClause = {
      // All users are admin now, so no user restrictions
      date: {
        [Op.between]: [start, end]
      }
    };

    if (ledgerId) {
      whereClause.ledgerId = ledgerId;
    }

    const stats = await AnamathEntry.findOne({
      where: whereClause,
      attributes: [
        [AnamathEntry.sequelize.fn('SUM', AnamathEntry.sequelize.col('amount')), 'totalAmount'],
        [AnamathEntry.sequelize.fn('COUNT', AnamathEntry.sequelize.col('id')), 'totalEntries'],
        [AnamathEntry.sequelize.fn('AVG', AnamathEntry.sequelize.col('amount')), 'averageAmount'],
        [AnamathEntry.sequelize.fn('MAX', AnamathEntry.sequelize.col('amount')), 'maxAmount'],
        [AnamathEntry.sequelize.fn('MIN', AnamathEntry.sequelize.col('amount')), 'minAmount']
      ],
      raw: true
    });

    const summary = {
      totalAmount: parseFloat(stats.totalAmount) || 0,
      totalEntries: parseInt(stats.totalEntries) || 0,
      averageAmount: parseFloat(stats.averageAmount) || 0,
      maxAmount: parseFloat(stats.maxAmount) || 0,
      minAmount: parseFloat(stats.minAmount) || 0,
      dateRange: { start, end }
    };

    res.json({
      success: true,
      data: summary,
      message: 'Anamath entries statistics retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting anamath entries statistics:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get anamath entries statistics'
    });
  }
});

// GET /api/anamath-entries/closed - Get all closed anamath entries
router.get('/closed/list', authenticate, [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 1000 }).withMessage('Limit must be between 1 and 1000'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  query('ledgerId').optional().isUUID().withMessage('Invalid ledger ID'),
  query('search').optional()
], handleValidationErrors, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 100, 1000);
    const offset = (page - 1) * limit;

    const whereClause = {
      isClosed: true // Only get closed entries
    };

    // Date range filter (for entry date)
    if (req.query.startDate && req.query.endDate) {
      whereClause.date = {
        [Op.between]: [req.query.startDate, req.query.endDate]
      };
    } else if (req.query.startDate) {
      whereClause.date = {
        [Op.gte]: req.query.startDate
      };
    } else if (req.query.endDate) {
      whereClause.date = {
        [Op.lte]: req.query.endDate
      };
    }

    // Ledger filter
    if (req.query.ledgerId) {
      whereClause.ledgerId = req.query.ledgerId;
    }

    // Search filter
    if (req.query.search) {
      whereClause[Op.or] = [
        { remarks: { [Op.iLike]: `%${req.query.search}%` } },
        { referenceNumber: { [Op.iLike]: `%${req.query.search}%` } }
      ];
    }

    const { count, rows: closedEntries } = await AnamathEntry.findAndCountAll({
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
        },
        {
          model: User,
          as: 'closedByUser',
          attributes: ['id', 'username', 'email']
        }
      ],
      order: [['closedAt', 'DESC'], ['date', 'DESC']],
      limit,
      offset
    });

    res.json({
      success: true,
      data: {
        anamathEntries: closedEntries,
        pagination: {
          currentPage: page,
          totalPages: Math.ceil(count / limit),
          totalItems: count,
          itemsPerPage: limit
        }
      },
      message: 'Closed anamath entries retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting closed anamath entries:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get closed anamath entries'
    });
  }
});



// GET /api/anamath-entries/:id - Get specific anamath entry
router.get('/:id', authenticate, [
  param('id').isUUID().withMessage('Invalid anamath entry ID')
], handleValidationErrors, async (req, res) => {
  try {
    const anamathEntry = await AnamathEntry.findOne({
      where: {
        id: req.params.id
        // All users are admin now, so no user restrictions
      },
      include: [
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
      ]
    });

    if (!anamathEntry) {
      return res.status(404).json({
        success: false,
        message: 'Anamath entry not found'
      });
    }

    res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
    res.set('Pragma', 'no-cache');
    res.set('Expires', '0');
    res.set('Surrogate-Control', 'no-store');
    res.json({
      success: true,
      data: anamathEntry,
      message: 'Anamath entry retrieved successfully'
    });
  } catch (error) {
    console.error(`Error getting anamath entry for ID ${req.params.id}:`, error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get anamath entry'
    });
  }
});

// POST /api/anamath-entries - Create new anamath entry
router.post('/', authenticate, authorizeCreate(), [
  body('date').isISO8601().withMessage('Invalid date format (YYYY-MM-DD)'),
  body('amount').isNumeric().custom(value => {
    if (parseFloat(value) <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    return true;
  }),
  body('remarks').optional(),
  body('ledgerId').optional().isUUID().withMessage('Invalid ledger ID'),
  body('referenceNumber').optional().isString().withMessage('Invalid reference number'), // Added validation
  body('transactionNumber').optional().isInt().withMessage('Invalid transaction number') // Added validation
], handleValidationErrors, async (req, res) => {
  try { // Outer try-catch to catch any unexpected errors in the route handler
    if (!req.user || !req.user.id) {
      console.error('CRITICAL ERROR: User ID is missing from request for anamath entry creation.');
      return res.status(401).json({
        success: false,
        message: 'Authentication error: User session invalid or expired. Please log in again.'
      });
    }

    const { date, amount, remarks, ledgerId, referenceNumber, transactionNumber } = req.body; // Extracted new fields

    // Validate ledger if provided
    if (ledgerId) {
      const ledger = await Ledger.findOne({
        where: {
          id: ledgerId,
          isActive: true
          // All users are admin now, so no user restrictions
        }
      });

      if (!ledger) {
        return res.status(404).json({
          success: false,
          message: 'Ledger not found or inactive'
        });
      }
    }

    // Auto-generate transaction number if not provided
    let finalTransactionNumber = transactionNumber;
    if (!finalTransactionNumber) {
      // Find the highest transaction number and increment it
      const lastEntry = await AnamathEntry.findOne({
        attributes: [[sequelize.fn('MAX', sequelize.col('transaction_number')), 'maxNumber']],
        raw: true
      });
      const maxNumber = lastEntry?.maxNumber || 0;
      finalTransactionNumber = parseInt(maxNumber) + 1;

    }

    const anamathEntry = await AnamathEntry.create({
      date,
      amount: parseFloat(amount),
      remarks: remarks === '' ? null : remarks, // Ensure empty string is sent as null
      referenceNumber: referenceNumber || null, // Pass referenceNumber if provided
      transactionNumber: finalTransactionNumber, // Use auto-generated or provided number
      ledgerId: ledgerId || null,
      createdBy: req.user.id,
      status: req.user.role === 'staff' ? 'pending' : 'approved'
    });

    // Fetch the created entry with associations
    const createdEntry = await AnamathEntry.findByPk(anamathEntry.id, {
      include: [
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
      ]
    });

    res.status(201).json({
      success: true,
      data: createdEntry,
      message: 'Anamath entry created successfully'
    });
  } catch (error) {
    console.error('Error creating anamath entry:', error);
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.errors) {
      console.error('Validation errors (Sequelize):', error.errors);
    }
    if (error.original) {
      console.error('Original database error:', error.original);
    }
    if (error.parent) {
      console.error('Parent database error:', error.parent);
    }

    let errorMessage = 'Failed to create anamath entry';
    if (error.message) {
      errorMessage = error.message;
    }
    if (error.original && error.original.detail) {
      errorMessage = error.original.detail; // PostgreSQL specific detail
    }
    if (error.name === 'SequelizeUniqueConstraintError') {
      errorMessage = 'Duplicate entry: An anamath entry with these details already exists.';
    }

    res.status(500).json({
      success: false,
      message: errorMessage
    });
  }
});

// PUT /api/anamath-entries/:id - Update anamath entry
router.put('/:id', authenticate, authorizeEdit(), [
  param('id').isUUID().withMessage('Invalid anamath entry ID'),
  body('date').optional({ nullable: true, checkFalsy: false }).isISO8601().withMessage('Invalid date format (YYYY-MM-DD)'),
  body('amount').optional({ nullable: true, checkFalsy: false }).isNumeric().custom(value => {
    if (value !== undefined && value !== null && parseFloat(value) <= 0) {
      throw new Error('Amount must be greater than 0');
    }
    return true;
  }),
  body('remarks').optional({ nullable: true, checkFalsy: true }),
  body('ledgerId').optional({ nullable: true, checkFalsy: true }).custom(value => {
    if (value && !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)) {
      throw new Error('Invalid ledger ID format');
    }
    return true;
  })
], handleValidationErrors, async (req, res) => {
  try {

    const { date, amount, remarks, ledgerId } = req.body;

    // Find the anamath entry
    const anamathEntry = await AnamathEntry.findOne({
      where: {
        id: req.params.id
        // All users are admin now, so no user restrictions
      }
    });

    if (!anamathEntry) {
      return res.status(404).json({
        success: false,
        message: 'Anamath entry not found'
      });
    }

    // Validate ledger if provided
    if (ledgerId) {
      const ledger = await Ledger.findOne({
        where: {
          id: ledgerId,
          isActive: true
          // All users are admin now, so no user restrictions
        }
      });

      if (!ledger) {
        return res.status(404).json({
          success: false,
          message: 'Ledger not found or inactive'
        });
      }
    }

    // Update the entry
    const updateData = {};
    if (date !== undefined) updateData.date = date;
    if (amount !== undefined) updateData.amount = parseFloat(amount);
    if (remarks !== undefined) updateData.remarks = remarks;
    if (ledgerId !== undefined) updateData.ledgerId = ledgerId;

    await anamathEntry.update(updateData);

    // Fetch updated entry with associations
    const updatedEntry = await AnamathEntry.findByPk(anamathEntry.id, {
      include: [
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
      ]
    });

    res.json({
      success: true,
      data: updatedEntry,
      message: 'Anamath entry updated successfully'
    });
  } catch (error) {
    console.error('Error updating anamath entry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to update anamath entry'
    });
  }
});

// DELETE /api/anamath-entries/:id - Delete anamath entry
router.delete('/:id', authenticate, authorizeDelete(), [
  param('id').isUUID().withMessage('Invalid anamath entry ID')
], handleValidationErrors, async (req, res) => {
  try {
    const anamathEntry = await AnamathEntry.findOne({
      where: {
        id: req.params.id
        // All users are admin now, so no user restrictions
      }
    });

    if (!anamathEntry) {
      return res.status(404).json({
        success: false,
        message: 'Anamath entry not found'
      });
    }

    await anamathEntry.destroy();

    res.json({
      success: true,
      message: 'Anamath entry deleted successfully'
    });
  } catch (error) {
    console.error('Error deleting anamath entry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to delete anamath entry'
    });
  }
});

// PUT /api/anamath-entries/:id/close - Close an anamath entry
router.put('/:id/close', authenticate, authorizeEdit(), [
  param('id').isUUID().withMessage('Invalid anamath entry ID')
], handleValidationErrors, async (req, res) => {
  try {
    const anamathEntry = await AnamathEntry.findOne({
      where: {
        id: req.params.id,
        isClosed: false // Only allow closing entries that aren't already closed
      }
    });

    if (!anamathEntry) {
      return res.status(404).json({
        success: false,
        message: 'Anamath entry not found or already closed'
      });
    }

    // Update the entry to closed status
    await anamathEntry.update({
      isClosed: true,
      closedAt: new Date(),
      closedBy: req.user.id
    });

    // Fetch the updated entry with associations
    const updatedEntry = await AnamathEntry.findOne({
      where: { id: req.params.id },
      include: [
        {
          model: Ledger,
          as: 'ledger',
          attributes: ['id', 'name', 'ledgerType']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'closedByUser',
          attributes: ['id', 'username', 'email']
        }
      ]
    });

    res.json({
      success: true,
      data: updatedEntry,
      message: 'Anamath entry closed successfully'
    });
  } catch (error) {
    console.error('Error closing anamath entry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to close anamath entry'
    });
  }
});

// PUT /api/anamath-entries/:id/reopen - Reopen a closed anamath entry
router.put('/:id/reopen', authenticate, authorizeEdit(), [
  param('id').isUUID().withMessage('Invalid anamath entry ID')
], handleValidationErrors, async (req, res) => {
  try {
    const anamathEntry = await AnamathEntry.findOne({
      where: {
        id: req.params.id,
        isClosed: true // Only allow reopening entries that are currently closed
      }
    });

    if (!anamathEntry) {
      return res.status(404).json({
        success: false,
        message: 'Anamath entry not found or not closed'
      });
    }

    // Update the entry to open status
    await anamathEntry.update({
      isClosed: false,
      closedAt: null,
      closedBy: null
    });

    // Fetch the updated entry with associations
    const updatedEntry = await AnamathEntry.findOne({
      where: { id: req.params.id },
      include: [
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
      ]
    });

    res.json({
      success: true,
      data: updatedEntry,
      message: 'Anamath entry reopened successfully'
    });
  } catch (error) {
    console.error('Error reopening anamath entry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reopen anamath entry'
    });
  }
});

// Approve anamath entry
router.post('/:id/approve', authenticate, authorizeEdit(), [
  param('id').isUUID().withMessage('Invalid anamath entry ID')
], handleValidationErrors, async (req, res) => {
  try {
    // Manager cannot approve anamath entries - only Admin and Owner can
    if (req.user.role === 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Managers cannot approve anamath entries. Requires Admin or Owner.'
      });
    }

    if (req.user.role === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff cannot approve anamath entries.'
      });
    }

    const anamathEntry = await AnamathEntry.findOne({
      where: {
        id: req.params.id,
        status: 'pending'
      }
    });

    if (!anamathEntry) {
      return res.status(404).json({
        success: false,
        message: 'Pending anamath entry not found'
      });
    }

    await anamathEntry.update({
      status: 'approved',
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Anamath entry approved successfully'
    });
  } catch (error) {
    console.error('Error approving anamath entry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to approve anamath entry'
    });
  }
});

// Reject anamath entry
router.post('/:id/reject', authenticate, authorizeEdit(), [
  param('id').isUUID().withMessage('Invalid anamath entry ID')
], handleValidationErrors, async (req, res) => {
  try {
    // Manager cannot reject anamath entries - only Admin and Owner can
    if (req.user.role === 'manager') {
      return res.status(403).json({
        success: false,
        message: 'Managers cannot reject anamath entries. Requires Admin or Owner.'
      });
    }

    if (req.user.role === 'staff') {
      return res.status(403).json({
        success: false,
        message: 'Staff cannot reject anamath entries.'
      });
    }

    const anamathEntry = await AnamathEntry.findOne({
      where: {
        id: req.params.id,
        status: 'pending'
      }
    });

    if (!anamathEntry) {
      return res.status(404).json({
        success: false,
        message: 'Pending anamath entry not found'
      });
    }

    await anamathEntry.update({
      status: 'rejected',
      updatedBy: req.user.id
    });

    res.json({
      success: true,
      message: 'Anamath entry rejected successfully'
    });
  } catch (error) {
    console.error('Error rejecting anamath entry:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to reject anamath entry'
    });
  }
});

module.exports = router;

