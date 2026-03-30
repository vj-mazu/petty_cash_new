const express = require('express');
const router = express.Router();
const {
  createTransaction,
  getAllTransactions,
  getTransactionById,
  updateTransaction,
  deleteTransaction,
  getTransactionStats,
  getTransactionAuditLogs,
  getNextTransactionNumber,
  getBalancesForDate,
  getBulkBalancesForDates,
  getCurrentBusinessBalances,
  triggerDailyRollover,
  suspendTransaction,
  unsuspendTransaction,
  approveTransaction,
  rejectTransaction
} = require('../controllers/transactionController');
const { streamTransactions, getFastCount } = require('../controllers/streamController');
const { authenticate, authorize, authorizeAdminOnly, authorizeCreate, authorizeEdit, authorizeDelete, authorizeView, authorizeExport } = require('../middleware/auth');
const { transactionLimiter } = require('../middleware/rateLimiting');
const { handleValidation } = require('../middleware/errorHandler');
const {
  validateCreateTransaction,
  validateUpdateTransaction,
  validateDeleteTransaction,
  validateId,
  validatePagination,
  validateDateRange
} = require('../validators');

// All routes require authentication
router.use(authenticate);

// Get transaction statistics
router.get('/stats',
  validateDateRange,
  handleValidation,
  getTransactionStats
);

// Next transaction number
router.get('/next-number', getNextTransactionNumber);

// Current business balances
router.get('/business-balances', getCurrentBusinessBalances);

// Get balances for a specific date
router.get('/balances', getBalancesForDate);

// Get opening balances for multiple dates in one call
router.get('/bulk-balances', getBulkBalancesForDates);

// Daily rollover (admin only)
router.post('/daily-rollover',
  authorizeAdminOnly(),
  triggerDailyRollover
);

// Get audit logs
router.get('/audit/:id',
  getTransactionAuditLogs
);

router.get('/audit',
  getTransactionAuditLogs
);

// Streaming export (NDJSON) — handles 10M+ records without buffering
router.get('/export-stream',
  authorizeExport(),
  streamTransactions
);

// Fast approximate count using PostgreSQL statistics
router.get('/fast-count',
  authorizeView(),
  getFastCount
);

// CRUD operations
router.post('/',
  authorizeCreate(), // Staff + Admin can create transactions
  transactionLimiter,
  validateCreateTransaction,
  handleValidation,
  createTransaction
);

router.get('/',
  authorizeView(),
  validatePagination,
  validateDateRange,
  handleValidation,
  getAllTransactions // Optimized: cursor pagination + conditional count
);

router.get('/:id',
  authorizeView(), // Staff + Admin can view individual transactions
  validateId,
  handleValidation,
  getTransactionById
);

router.put('/:id',
  authorizeEdit(), // Admin1, Admin2, Staff can edit transactions
  transactionLimiter,
  validateUpdateTransaction,
  handleValidation,
  updateTransaction
);

router.delete('/:id',
  authorizeDelete(), // Only Admin1 can delete transactions
  transactionLimiter,
  validateDeleteTransaction,
  handleValidation,
  deleteTransaction
);

// Suspend transaction
router.patch('/:id/suspend',
  authorizeEdit(), // Admin1, Admin2, Staff can suspend transactions
  validateId,
  handleValidation,
  suspendTransaction
);

// Unsuspend transaction
router.patch('/:id/unsuspend',
  authorizeEdit(), // Admin, Manager can unsuspend transactions
  validateId,
  handleValidation,
  unsuspendTransaction
);

// Approve transaction
router.post('/:id/approve',
  authorizeEdit(), // Admin, Manager can approve transactions
  validateId,
  handleValidation,
  approveTransaction
);

// Reject transaction
router.post('/:id/reject',
  authorizeEdit(), // Admin, Owner, Manager can reject transactions
  validateId,
  handleValidation,
  rejectTransaction
);

module.exports = router;