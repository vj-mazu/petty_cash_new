// routes/balanceRecalculation.js
const express = require('express');
const router = express.Router();
const balanceRecalculationService = require('../services/balanceRecalculationService');
const { authenticate } = require('../middleware/auth');

// POST /api/balance-recalculation/recalculate-from-date
// Manually trigger balance recalculation from a specific date
router.post('/recalculate-from-date', authenticate, async (req, res) => {
  try {
    const { startDate } = req.body;
    
    if (!startDate) {
      return res.status(400).json({
        success: false,
        message: 'Start date is required',
        error: 'Missing required field: startDate'
      });
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(startDate)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid date format. Use YYYY-MM-DD',
        error: 'Invalid date format'
      });
    }
    
    console.log(`Manual balance recalculation requested from ${startDate} by user ${req.user.id}`);
    
    const result = await balanceRecalculationService.recalculateFromDate(startDate, req.user.id);
    
    res.json({
      success: true,
      message: 'Balance recalculation completed successfully',
      data: result
    });
    
  } catch (error) {
    console.error('Balance recalculation API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate balances',
      error: error.message
    });
  }
});

// POST /api/balance-recalculation/recalculate-all
// Recalculate all opening balances from the beginning
router.post('/recalculate-all', authenticate, async (req, res) => {
  try {
    console.log(`Full balance recalculation requested by user ${req.user.id}`);
    
    // Start from a very early date to recalculate everything
    const startDate = '2024-01-01'; // Adjust this based on your data
    
    const [balanceResult, ledgerResult] = await Promise.all([
      balanceRecalculationService.recalculateFromDate(startDate, req.user.id),
      balanceRecalculationService.recalculateLedgerBalances(req.user.id)
    ]);
    
    res.json({
      success: true,
      message: 'Complete balance recalculation finished successfully',
      data: {
        openingBalances: balanceResult,
        ledgerBalances: ledgerResult
      }
    });
    
  } catch (error) {
    console.error('Complete balance recalculation API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate all balances',
      error: error.message
    });
  }
});

// POST /api/balance-recalculation/recalculate-ledgers
// Recalculate ledger current balances only
router.post('/recalculate-ledgers', authenticate, async (req, res) => {
  try {
    console.log(`Ledger balance recalculation requested by user ${req.user.id}`);
    
    await balanceRecalculationService.recalculateLedgerBalances(req.user.id);
    
    res.json({
      success: true,
      message: 'Ledger balance recalculation completed successfully'
    });
    
  } catch (error) {
    console.error('Ledger balance recalculation API error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to recalculate ledger balances',
      error: error.message
    });
  }
});

module.exports = router;