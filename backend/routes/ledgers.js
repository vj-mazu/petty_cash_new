const express = require('express');
const router = express.Router();
const {
  createLedger,
  getAllLedgers,
  getLedgerById,
  updateLedger,
  deleteLedger,
  getLedgerSummary,
  getLedgerSummaries
} = require('../controllers/ledgerController');
const { authenticate, authorize, authorizeAdminOnly, authorizeCreate, authorizeEdit, authorizeDelete, authorizeView } = require('../middleware/auth');
const { handleValidation } = require('../middleware/errorHandler');
const {
  validateCreateLedger,
  validateUpdateLedger,
  validateId,
  validatePagination
} = require('../validators');

// All routes require authentication
router.use(authenticate);

// Get ledger summary/dashboard
router.get('/summary', 
  authorizeView(), // Staff + Admin can view summary
  getLedgerSummary
);

// Get ledger summaries for view page
router.get('/summaries', 
  authorizeView(), // Staff + Admin can view summary
  getLedgerSummaries
);

// CRUD operations
router.post('/', 
  authorizeCreate(), // Staff + Admin can create ledgers
  validateCreateLedger, 
  handleValidation, 
  createLedger
);

router.get('/', 
  authorizeView(), // Staff + Admin can view ledgers
  validatePagination, 
  handleValidation, 
  getAllLedgers
);

router.get('/:id', 
  authorizeView(), // Staff + Admin can view individual ledgers
  validateId, 
  handleValidation, 
  getLedgerById
);

router.put('/:id', 
  authorizeEdit(), // Only admins can edit ledgers
  validateUpdateLedger, 
  handleValidation, 
  updateLedger
);

router.delete('/:id', 
  authorizeDelete(), // Only admins can delete ledgers
  validateId, 
  handleValidation, 
  deleteLedger
);

module.exports = router;