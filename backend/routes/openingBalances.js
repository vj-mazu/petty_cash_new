const express = require('express');
const router = express.Router();
const { body, param, query, validationResult } = require('express-validator');
const openingBalanceService = require('../services/openingBalanceService');
const { authenticate, authorizeCreate, authorizeEdit, authorizeOpeningBalanceAccess } = require('../middleware/auth');

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

// GET /api/opening-balances/current - Get current day's opening balances (admin1 and admin2 only)
router.get('/current', authenticate, authorizeOpeningBalanceAccess(), async (req, res) => {
  try {
    const openingBalances = await openingBalanceService.getCurrentDayOpeningBalances(req.user.id);
    
    res.json({
      success: true,
      data: openingBalances,
      message: 'Current day opening balances retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting current opening balances:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get current opening balances'
    });
  }
});

// GET /api/opening-balances/summary - Get opening balance summary for dashboard (admin1 and admin2 only)
router.get('/summary', authenticate, authorizeOpeningBalanceAccess(), async (req, res) => {
  try {
    const summary = await openingBalanceService.getOpeningBalanceSummary(req.user.id);
    
    res.json({
      success: true,
      data: summary,
      message: 'Opening balance summary retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting opening balance summary:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to get opening balance summary'
    });
  }
});

// GET /api/opening-balances/history/:ledgerId - Get opening balance history for a ledger (admin1 and admin2 only)
router.get('/history/:ledgerId', 
  authenticate,
  authorizeOpeningBalanceAccess(), // Only admin1 and admin2 can view opening balance history
  [
    param('ledgerId').isUUID().withMessage('Invalid ledger ID'),
    query('days').optional().isInt({ min: 1, max: 365 }).withMessage('Days must be between 1 and 365')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { ledgerId } = req.params;
      const days = parseInt(req.query.days) || 7;
      
      const history = await openingBalanceService.getOpeningBalanceHistory(ledgerId, days);
      
      res.json({
        success: true,
        data: history,
        message: 'Opening balance history retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting opening balance history:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get opening balance history'
      });
    }
  }
);

// POST /api/opening-balances/calculate - Calculate opening balance for specific ledger and date (admin1 and admin2 only)
router.post('/calculate',
  authenticate,
  authorizeOpeningBalanceAccess(), // Only admin1 and admin2 can calculate opening balances
  [
    body('ledgerId').isUUID().withMessage('Invalid ledger ID'),
    body('date').isISO8601().withMessage('Invalid date format (YYYY-MM-DD)')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { ledgerId, date } = req.body;
      
      const openingBalance = await openingBalanceService.calculateDailyOpeningBalance(ledgerId, date);
      
      res.json({
        success: true,
        data: openingBalance,
        message: 'Opening balance calculated successfully'
      });
    } catch (error) {
      console.error('Error calculating opening balance:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to calculate opening balance'
      });
    }
  }
);

// PUT /api/opening-balances/manual - Set manual opening balance (admin1 and admin2 only)
router.put('/manual',
  authenticate,
  authorizeOpeningBalanceAccess(), // Only admin1 and admin2 can set opening balances
  [
    body('ledgerId').isUUID().withMessage('Invalid ledger ID'),
    body('date').isISO8601().withMessage('Invalid date format (YYYY-MM-DD)'),
    body('amount').isNumeric().withMessage('Amount must be a number')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { ledgerId, date, amount } = req.body;
      
      const openingBalance = await openingBalanceService.setManualOpeningBalance(
        ledgerId, 
        date, 
        parseFloat(amount), 
        req.user.id
      );
      
      res.json({
        success: true,
        data: openingBalance,
        message: 'Manual opening balance set successfully'
      });
    } catch (error) {
      console.error('Error setting manual opening balance:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to set manual opening balance'
      });
    }
  }
);

// GET /api/opening-balances/range - Get opening balances for date range (admin1 and admin2 only)
router.get('/range',
  authenticate,
  authorizeOpeningBalanceAccess(), // Only admin1 and admin2 can view opening balance ranges
  [
    query('startDate').isISO8601().withMessage('Invalid start date format (YYYY-MM-DD)'),
    query('endDate').isISO8601().withMessage('Invalid end date format (YYYY-MM-DD)'),
    query('ledgerId').optional().isUUID().withMessage('Invalid ledger ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      const { startDate, endDate, ledgerId } = req.query;
      
      const openingBalances = await openingBalanceService.getOpeningBalanceHistory(ledgerId, 
        Math.ceil((new Date(endDate) - new Date(startDate)) / (1000 * 60 * 60 * 24))
      );
      
      res.json({
        success: true,
        data: openingBalances,
        message: 'Opening balances for date range retrieved successfully'
      });
    } catch (error) {
      console.error('Error getting opening balances for range:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to get opening balances for date range'
      });
    }
  }
);

// POST /api/opening-balances/recalculate - Recalculate opening balances (admin1 and admin2 only)
router.post('/recalculate',
  authenticate,
  authorizeOpeningBalanceAccess(), // Only admin1 and admin2 can recalculate
  [
    body('startDate').isISO8601().withMessage('Invalid start date format (YYYY-MM-DD)'),
    body('endDate').isISO8601().withMessage('Invalid end date format (YYYY-MM-DD)'),
    body('ledgerId').optional().isUUID().withMessage('Invalid ledger ID')
  ],
  handleValidationErrors,
  async (req, res) => {
    try {
      // Only allow admin users to recalculate (you can add role check here)
      const { startDate, endDate, ledgerId } = req.body;
      
      const results = await openingBalanceService.recalculateOpeningBalances(startDate, endDate, ledgerId);
      
      res.json({
        success: true,
        data: results,
        message: `Recalculated ${results.length} opening balance records`
      });
    } catch (error) {
      console.error('Error recalculating opening balances:', error);
      res.status(500).json({
        success: false,
        message: error.message || 'Failed to recalculate opening balances'
      });
    }
  }
);

module.exports = router;