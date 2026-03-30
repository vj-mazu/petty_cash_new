const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const combinedTransactionService = require('../services/combinedTransactionService');
const { authenticate, authorize, authorizeCreate, authorizeEdit, authorizeDelete } = require('../middleware/auth');

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

// POST /api/combined-transactions - Create combined transaction
router.post('/', 
  authorizeCreate(), // Admin1, Admin2, Staff can create combined transactions
  [
    // Transaction validation
    body('transaction.ledgerId').isUUID().withMessage('Invalid transaction ledger ID'),
    body('transaction.date').isISO8601().withMessage('Invalid transaction date format'),
    body('transaction.description').notEmpty().isLength({ min: 1, max: 255 }).withMessage('Transaction description is required (1-255 characters)'),
    body('transaction.reference').optional().isLength({ max: 100 }).withMessage('Transaction reference must be max 100 characters'),
    body('transaction.debitAmount').optional().isNumeric().custom(value => {
      if (value !== undefined && parseFloat(value) < 0) {
        throw new Error('Debit amount cannot be negative');
      }
      return true;
    }),
    body('transaction.creditAmount').optional().isNumeric().custom(value => {
      if (value !== undefined && parseFloat(value) < 0) {
        throw new Error('Credit amount cannot be negative');
      }
      return true;
    }),
    
    // Anamath validation
    body('anamath.date').isISO8601().withMessage('Invalid anamath date format'),
    body('anamath.amount').isNumeric().custom(value => {
      if (parseFloat(value) <= 0) {
        throw new Error('Anamath amount must be greater than 0');
      }
      return true;
    }),
    body('anamath.remarks').notEmpty().isLength({ min: 1, max: 1000 }).withMessage('Anamath remarks are required (1-1000 characters)'),
    body('anamath.ledgerId').optional().isUUID().withMessage('Invalid anamath ledger ID'),
    
    // Custom validation for transaction amounts
    body().custom((value) => {
      const { transaction } = value;
      const debitAmount = parseFloat(transaction.debitAmount) || 0;
      const creditAmount = parseFloat(transaction.creditAmount) || 0;
      
      if (debitAmount > 0 && creditAmount > 0) {
        throw new Error('Transaction cannot have both debit and credit amounts');
      }
      
      if (debitAmount === 0 && creditAmount === 0) {
        throw new Error('Transaction must have either debit or credit amount');
      }
      
      return true;
    })
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { transaction, anamath } = req.body;
      
      // Validate the data using service
      const validationErrors = combinedTransactionService.validateCombinedTransactionData(transaction, anamath);
      if (validationErrors.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Validation failed',
          errors: validationErrors
        });
      }

      const result = await combinedTransactionService.createCombinedTransaction(
        transaction,
        anamath,
        req.user.id
      );

      res.status(201).json({
        success: true,
        data: result,
        message: 'Combined transaction created successfully'
      });
    } catch (error) {
      console.error('Error creating combined transaction:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to create combined transaction'
      });
    }
  }
);

// GET /api/combined-transactions - Get all combined transactions
router.get('/', [
  query('page').optional().isInt({ min: 1 }).withMessage('Page must be a positive integer'),
  query('limit').optional().isInt({ min: 1, max: 10000 }).withMessage('Limit must be between 1 and 10000'),
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  query('ledgerId').optional().isUUID().withMessage('Invalid ledger ID')
], handleValidationErrors, async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10000; // Default to high limit for unlimited records
    const offset = (page - 1) * limit;
    
    const options = {
      limit,
      offset
    };

    if (req.query.startDate && req.query.endDate) {
      options.dateRange = {
        start: req.query.startDate,
        end: req.query.endDate
      };
    }

    if (req.query.ledgerId) {
      options.ledgerId = req.query.ledgerId;
    }

    const transactions = await combinedTransactionService.getCombinedTransactions(req.user.id, options);

    res.json({
      success: true,
      data: {
        transactions,
        pagination: {
          currentPage: page,
          itemsPerPage: limit,
          totalItems: transactions.length
        }
      },
      message: 'Combined transactions retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting combined transactions:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get combined transactions'
    });
  }
});

// GET /api/combined-transactions/:id - Get specific combined transaction
router.get('/:id', [
  param('id').isUUID().withMessage('Invalid transaction ID')
], handleValidationErrors, async (req, res) => {
  try {
    const result = await combinedTransactionService.findCombinedTransactionByReference(req.params.id, req.user.id);

    res.json({
      success: true,
      data: result,
      message: 'Combined transaction retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting combined transaction:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get combined transaction'
      });
    }
  }
});

// PUT /api/combined-transactions/:id - Update combined transaction
router.put('/:id',
  authorizeEdit(), // Admin1, Admin2, Staff can update combined transactions
  [
    param('id').isUUID().withMessage('Invalid transaction ID'),
    
    // Transaction validation (all optional for updates)
    body('transaction.date').optional().isISO8601().withMessage('Invalid transaction date format'),
    body('transaction.description').optional().isLength({ min: 1, max: 255 }).withMessage('Transaction description must be 1-255 characters'),
    body('transaction.reference').optional().isLength({ max: 100 }).withMessage('Transaction reference must be max 100 characters'),
    body('transaction.debitAmount').optional().isNumeric().custom(value => {
      if (value !== undefined && parseFloat(value) < 0) {
        throw new Error('Debit amount cannot be negative');
      }
      return true;
    }),
    body('transaction.creditAmount').optional().isNumeric().custom(value => {
      if (value !== undefined && parseFloat(value) < 0) {
        throw new Error('Credit amount cannot be negative');
      }
      return true;
    }),
    
    // Anamath validation (all optional for updates)
    body('anamath.date').optional().isISO8601().withMessage('Invalid anamath date format'),
    body('anamath.amount').optional().isNumeric().custom(value => {
      if (value !== undefined && parseFloat(value) <= 0) {
        throw new Error('Anamath amount must be greater than 0');
      }
      return true;
    }),
    body('anamath.remarks').optional().isLength({ min: 1, max: 1000 }).withMessage('Anamath remarks must be 1-1000 characters'),
    body('anamath.ledgerId').optional().isUUID().withMessage('Invalid anamath ledger ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { transaction, anamath } = req.body;

      const result = await combinedTransactionService.updateCombinedTransaction(
        req.params.id,
        transaction || {},
        anamath || {},
        req.user.id
      );

      res.json({
        success: true,
        data: result,
        message: 'Combined transaction updated successfully'
      });
    } catch (error) {
      console.error('Error updating combined transaction:', error);
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to update combined transaction'
        });
      }
    }
  }
);

// DELETE /api/combined-transactions/:id - Delete combined transaction
router.delete('/:id',
  authorizeDelete(), // Only Admin1 can delete combined transactions
  [
    param('id').isUUID().withMessage('Invalid transaction ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const result = await combinedTransactionService.deleteCombinedTransaction(req.params.id, req.user.id);

      res.json({
        success: true,
        data: result,
        message: 'Combined transaction deleted successfully'
      });
    } catch (error) {
      console.error('Error deleting combined transaction:', error);
      if (error.message.includes('not found')) {
        res.status(404).json({
          success: false,
          message: error.message
        });
      } else {
        res.status(500).json({
          success: false,
          message: error.message || 'Failed to delete combined transaction'
        });
      }
    }
  }
);

// GET /api/combined-transactions/reference/:referenceNumber - Find by reference number
router.get('/reference/:referenceNumber', [
  param('referenceNumber').notEmpty().withMessage('Reference number is required')
], handleValidationErrors, async (req, res) => {
  try {
    const result = await combinedTransactionService.findCombinedTransactionByReference(
      req.params.referenceNumber,
      req.user.id
    );

    res.json({
      success: true,
      data: result,
      message: 'Combined transaction found successfully'
    });
  } catch (error) {
    console.error('Error finding combined transaction by reference:', error);
    if (error.message.includes('not found')) {
      res.status(404).json({
        success: false,
        message: error.message
      });
    } else {
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to find combined transaction'
      });
    }
  }
});

module.exports = router;