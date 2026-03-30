const { body, param, query } = require('express-validator');

// Auth validations
const validateRegister = [
  body('username')
    .isLength({ min: 3, max: 30 })
    .trim()
    .withMessage('Username must be between 3 and 30 characters'),

  body('email')
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email'),

  body('password')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('Password must contain at least one lowercase letter, one uppercase letter, and one number')
];

const validateLogin = [
  body('email')
    .notEmpty()
    .trim()
    .withMessage('Email or username is required')
    .custom((value) => {
      // Allow either email format or username (3+ characters)
      const isEmail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
      const isUsername = value.length >= 3 && /^[a-zA-Z0-9_]+$/.test(value);

      if (!isEmail && !isUsername) {
        throw new Error('Please provide a valid email or username');
      }

      return true;
    }),

  body('password')
    .notEmpty()
    .withMessage('Password is required')
];

const validateUpdateProfile = [
  body('username')
    .optional()
    .isLength({ min: 3, max: 30 })
    .trim()
    .withMessage('Username must be between 3 and 30 characters'),

  body('email')
    .optional()
    .isEmail()
    .normalizeEmail()
    .withMessage('Please provide a valid email')
];

const validateChangePassword = [
  body('currentPassword')
    .notEmpty()
    .withMessage('Current password is required'),

  body('newPassword')
    .isLength({ min: 6 })
    .withMessage('New password must be at least 6 characters long')
    .matches(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/)
    .withMessage('New password must contain at least one lowercase letter, one uppercase letter, and one number')
];

// Ledger validations
const validateCreateLedger = [
  body('name')
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Ledger name is required and must be less than 100 characters'),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .trim()
    .withMessage('Description must be less than 500 characters')
];

const validateUpdateLedger = [
  param('id')
    .isUUID()
    .withMessage('Invalid ledger ID'),

  body('name')
    .optional()
    .isLength({ min: 1, max: 100 })
    .trim()
    .withMessage('Ledger name must be less than 100 characters'),

  body('description')
    .optional()
    .isLength({ max: 500 })
    .trim()
    .withMessage('Description must be less than 500 characters')
];

// Common validations
const validateId = [
  param('id')
    .isUUID()
    .withMessage('Invalid ID format')
];

const validatePagination = [
  query('page')
    .optional()
    .isInt({ min: 1 })
    .withMessage('Page must be a positive integer'),

  query('limit')
    .optional()
    .isInt({ min: 1, max: 50000 })
    .withMessage('Limit must be between 1 and 50000')
];

const validateDateRange = [
  query('startDate')
    .optional()
    .isISO8601()
    .withMessage('Start date must be a valid ISO 8601 date'),

  query('endDate')
    .optional()
    .isISO8601()
    .withMessage('End date must be a valid ISO 8601 date')
    .custom((value, { req }) => {
      if (!value || !req.query.startDate) return true;

      const startDate = new Date(req.query.startDate);
      const endDate = new Date(value);

      if (endDate < startDate) {
        throw new Error('End date must be after start date');
      }

      const diffTime = Math.abs(endDate - startDate);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays > 366) {
        throw new Error('Date range cannot exceed one year');
      }

      return true;
    })
];

const validateDeleteTransaction = [
  param('id')
    .isUUID()
    .withMessage('Invalid transaction ID'),

  body('reason')
    .optional()
    .isLength({ min: 1, max: 500 })
    .trim()
    .withMessage('If provided, reason must be between 1 and 500 characters')
];

// Transaction validations - Combined and enhanced version
const validateCreateTransaction = [
  body('ledgerId')
    .notEmpty()
    .withMessage('Ledger ID is required')
    .isUUID()
    .withMessage('Ledger ID must be a valid UUID'),

  body('remarks')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Remarks must be less than 500 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!@#$%^&*()+={}[\]:";'<>?/\\|`~]*$/)
    .withMessage('Remarks contains invalid characters'),

  body('transactionType')
    .isIn(['regular', 'combined', 'anamath'])
    .withMessage('Invalid transaction type'),

  body('type')
    .optional()
    .isIn(['credit', 'debit'])
    .withMessage('Transaction type must be credit or debit'),

  body('amount')
    .optional()
    .isFloat({ min: 0.01, max: 999999999.99 })
    .withMessage('Amount must be a positive number between 0.01 and 999,999,999.99'),

  body('debitAmount')
    .optional()
    .isFloat({ min: 0, max: 999999999.99 })
    .withMessage('Debit amount must be a positive number less than 999,999,999.99')
    .custom((value, { req }) => {
      const credit = parseFloat(req.body.creditAmount) || 0;
      const debit = parseFloat(value) || 0;
      const amount = parseFloat(req.body.amount) || 0;
      const type = req.body.type;
      const transactionType = req.body.transactionType;

      // Skip strict combined transaction validation if transactionType is not explicitly set
      // (This allows editing existing combined transactions without sending transactionType)
      const isCreatingCombined = transactionType === 'combined' && req.method === 'POST';

      // For creating combined transactions (not editing)
      if (isCreatingCombined) {
        // Combined transactions need exactly one of debit or credit
        if (debit > 0 && credit > 0) {
          throw new Error('Combined transaction cannot have both debit and credit amounts');
        }
        if (debit <= 0 && credit <= 0) {
          throw new Error('Combined transaction must have either debit or credit amount');
        }
      }
      // For regular transactions (or editing), allow either debit or credit, but not both > 0
      if (!isCreatingCombined) {
        // Only one of debit or credit can be positive, or both zero is not allowed
        if ((debit > 0 && credit > 0)) {
          throw new Error('Transaction cannot have both debit and credit amounts');
        }
        if ((debit <= 0 && credit <= 0)) {
          throw new Error('Transaction must have either debit or credit amount');
        }
      }
      return true;
    }),

  body('creditAmount')
    .optional()
    .isFloat({ min: 0, max: 999999999.99 })
    .withMessage('Credit amount must be a positive number less than 999,999,999.99')
    .custom((value, { req }) => {
      const transactionType = req.body.transactionType;
      const credit = parseFloat(value) || 0;

      // Only enforce strict combined validation when explicitly creating combined transactions
      const isCreatingCombined = transactionType === 'combined' && req.method === 'POST';

      if (isCreatingCombined) {
        // Combined transactions need exactly one of debit or credit - already validated in debitAmount
      }

      return true;
    }),

  body('date')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Invalid date format')
    .custom((value) => {
      const date = new Date(value);
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

      if (date < oneYearAgo || date > oneYearFromNow) {
        throw new Error('Date must be within one year of current date');
      }

      return true;
    }),

  body('reference')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference must be less than 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]*$/)
    .withMessage('Reference can only contain letters, numbers, spaces, hyphens, and underscores'),

  body('referenceNumber')
    .optional()
    .trim()
    .isLength({ max: 100 })
    .withMessage('Reference number must be less than 100 characters')
    .matches(/^[a-zA-Z0-9\s\-_]*$/)
    .withMessage('Reference number can only contain letters, numbers, spaces, hyphens, and underscores'),

  // Anamath-specific fields for combined transactions
  body('anamathAmount')
    .optional()
    .isFloat({ min: 0.01, max: 999999999.99 })
    .withMessage('Anamath amount must be a positive number'),

  body('anamathRemarks')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 1000 })
    .withMessage('Anamath remarks must be less than 1000 characters'),

  body('anamathLedgerId')
    .optional()
    .isUUID()
    .withMessage('Anamath ledger ID must be a valid UUID')
];

const validateUpdateTransaction = [
  param('id')
    .isUUID()
    .withMessage('Invalid transaction ID'),

  body('ledgerId')
    .optional()
    .isUUID()
    .withMessage('Ledger ID must be a valid UUID'),

  body('remarks')
    .optional({ checkFalsy: true })
    .trim()
    .isLength({ max: 500 })
    .withMessage('Remarks must be less than 500 characters')
    .matches(/^[a-zA-Z0-9\s\-_.,!@#$%^&*()+={}[\]:";'<>?/\\|`~]*$/)
    .withMessage('Remarks contains invalid characters'),

  body('debitAmount')
    .optional()
    .isFloat({ min: 0, max: 999999999.99 })
    .withMessage('Debit amount must be a positive number less than 999,999,999.99')
    .custom((value, { req }) => {
      const credit = parseFloat(req.body.creditAmount);
      const debit = parseFloat(value);

      // For updates, if both amounts are provided, ensure they're not both positive
      // (This allows updating either field separately)
      if (!isNaN(credit) && !isNaN(debit) && credit > 0 && debit > 0) {
        throw new Error('Transaction cannot have both debit and credit amounts');
      }

      return true;
    }),

  body('creditAmount')
    .optional()
    .isFloat({ min: 0, max: 999999999.99 })
    .withMessage('Credit amount must be a positive number less than 999,999,999.99'),

  body('date')
    .optional()
    .isISO8601()
    .toDate()
    .withMessage('Invalid date format'),

  body('reference')
    .optional()
    .trim()
    .isLength({ max: 50 })
    .withMessage('Reference must be less than 50 characters')
];

module.exports = {
  validateRegister,
  validateLogin,
  validateUpdateProfile,
  validateChangePassword,
  validateCreateLedger,
  validateUpdateLedger,
  validateCreateTransaction,
  validateUpdateTransaction,
  validateId,
  validatePagination,
  validateDateRange,
  validateDeleteTransaction
};