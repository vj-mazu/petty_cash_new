const express = require('express');
const router = express.Router();
const { query, validationResult } = require('express-validator');
const exportService = require('../services/exportService');
const { authenticate, authorize, authorizeExport } = require('../middleware/auth');

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

// All routes require authentication and export permissions
router.use(authenticate);
router.use(authorizeExport()); // Staff + Admin can export

// GET /api/exports/transactions/csv - Export transactions to CSV
router.get('/transactions/csv', [
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  query('ledgerIds').optional().isArray().withMessage('Ledger IDs must be an array'),
  query('ledgerIds.*').optional().isUUID().withMessage('Invalid ledger ID'),
  query('transactionType').optional().isIn(['regular', 'combined', 'anamath']).withMessage('Invalid transaction type'),
  query('includeAnamath').optional().isBoolean().withMessage('Include anamath must be boolean'),
  query('startingBalance').optional().isNumeric().withMessage('Starting balance must be numeric')
], handleValidationErrors, async (req, res) => {
  try {
    const options = {
      dateRange: req.query.startDate && req.query.endDate ? {
        start: req.query.startDate,
        end: req.query.endDate
      } : null,
      ledgerIds: req.query.ledgerIds || [],
      transactionType: req.query.transactionType,
      includeAnamath: req.query.includeAnamath === 'true',
      startingBalance: parseFloat(req.query.startingBalance) || 0
    };

    // Get transactions for export
    const transactions = await exportService.getTransactionsForExport(req.user.id, options);

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No transactions found for the specified criteria'
      });
    }

    // Generate CSV content
    const csvContent = await exportService.exportToCSV(transactions, options);

    // Generate filename
    const filename = exportService.generateFilename('transactions', options);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.setHeader('Cache-Control', 'no-cache');

    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting transactions to CSV:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to export transactions to CSV'
    });
  }
});

// GET /api/exports/anamath/csv - Export anamath entries to CSV
router.get('/anamath/csv', [
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  query('ledgerIds').optional().isArray().withMessage('Ledger IDs must be an array'),
  query('ledgerIds.*').optional().isUUID().withMessage('Invalid ledger ID')
], handleValidationErrors, async (req, res) => {
  try {
    const options = {
      dateRange: req.query.startDate && req.query.endDate ? {
        start: req.query.startDate,
        end: req.query.endDate
      } : null,
      ledgerIds: req.query.ledgerIds || []
    };

    // Get anamath entries for export
    const anamathEntries = await exportService.getAnamathEntriesForExport(req.user.id, options);

    if (anamathEntries.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No anamath entries found for the specified criteria'
      });
    }

    // Generate CSV content
    const csvContent = await exportService.exportAnamathToCSV(anamathEntries, options);

    // Generate filename
    const filename = exportService.generateFilename('anamath_entries', options);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.setHeader('Cache-Control', 'no-cache');

    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting anamath entries to CSV:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to export anamath entries to CSV'
    });
  }
});

// GET /api/exports/combined/csv - Export combined transactions to CSV
router.get('/combined/csv', [
  query('startDate').optional().isISO8601().withMessage('Invalid start date format'),
  query('endDate').optional().isISO8601().withMessage('Invalid end date format'),
  query('ledgerIds').optional().isArray().withMessage('Ledger IDs must be an array'),
  query('ledgerIds.*').optional().isUUID().withMessage('Invalid ledger ID'),
  query('startingBalance').optional().isNumeric().withMessage('Starting balance must be numeric')
], handleValidationErrors, async (req, res) => {
  try {
    const options = {
      dateRange: req.query.startDate && req.query.endDate ? {
        start: req.query.startDate,
        end: req.query.endDate
      } : null,
      ledgerIds: req.query.ledgerIds || [],
      transactionType: 'combined',
      includeAnamath: true,
      startingBalance: parseFloat(req.query.startingBalance) || 0
    };

    // Get combined transactions for export
    const transactions = await exportService.getTransactionsForExport(req.user.id, options);

    if (transactions.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No combined transactions found for the specified criteria'
      });
    }

    // Generate CSV content
    const csvContent = await exportService.exportToCSV(transactions, options);

    // Generate filename
    const filename = exportService.generateFilename('combined_transactions', options);

    // Set headers for file download
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}.csv"`);
    res.setHeader('Cache-Control', 'no-cache');

    res.send(csvContent);
  } catch (error) {
    console.error('Error exporting combined transactions to CSV:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to export combined transactions to CSV'
    });
  }
});

module.exports = router;