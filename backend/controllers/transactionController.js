// Helper to validate opening balance immutability
const validateOpeningBalanceImmutability = async (ledgerId, date) => {
  const { OpeningBalance } = require('../models');
  const ob = await OpeningBalance.findByDateAndLedger(date, ledgerId);
  if (ob && ob.isOpeningAmountLocked && ob.isOpeningAmountLocked()) {
    throw new Error('Opening balance is locked and cannot be modified manually.');
  }
};
// controllers/transactionController.js
const { Transaction, Ledger, User, AnamathEntry, sequelize } = require('../models');
const { Op } = require('sequelize');
const auditService = require('../services/auditService');
const balanceRecalculationService = require('../services/balanceRecalculationService');
const dailyBalanceService = require('../services/dailyBalanceService');
const cacheService = require('../services/cacheService');

// Utility functions for validation and error handling
const validateAmount = (amount, fieldName) => {
  if (amount === undefined || amount === null) return null;

  const parsed = parseFloat(amount);
  if (isNaN(parsed)) {
    return { field: fieldName, message: `${fieldName} must be a valid number` };
  }
  if (parsed < 0) {
    return { field: fieldName, message: `${fieldName} cannot be negative` };
  }
  if (parsed > 999999999.99) {
    return { field: fieldName, message: `${fieldName} exceeds maximum allowed value` };
  }
  return null;
};

// Get opening/closing balances for a specific date
const getBalancesForDate = async (req, res) => {
  try {
    const { date } = req.query;
    if (!date || isNaN(new Date(date).getTime())) {
      return res.status(400).json({ success: false, message: 'Valid date (YYYY-MM-DD) is required' });
    }

    // Normalize to YYYY-MM-DD string
    const d = new Date(date);
    const yyyy = d.getFullYear();
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const dd = String(d.getDate()).padStart(2, '0');
    const dateStr = `${yyyy}-${mm}-${dd}`;

    const openingBalance = await dailyBalanceService.getOpeningBalanceForDate(dateStr);
    const closingBalance = await dailyBalanceService.calculateClosingBalanceForDate(dateStr);

    return res.json({
      success: true,
      data: {
        date: dateStr,
        openingBalance,
        closingBalance
      }
    });
  } catch (error) {
    console.error('Error getting balances for date:', error);
    return res.status(500).json({ success: false, message: 'Failed to get balances for date' });
  }
};

// Get opening balances for multiple dates in one call (bulk)
const getBulkBalancesForDates = async (req, res) => {
  try {
    const { dates } = req.query;
    if (!dates) {
      return res.status(400).json({ success: false, message: 'Comma-separated dates (YYYY-MM-DD) required' });
    }

    const dateList = dates.split(',').map(d => d.trim()).filter(Boolean);
    if (dateList.length === 0 || dateList.length > 90) {
      return res.status(400).json({ success: false, message: 'Provide 1-90 valid dates' });
    }

    // Compute balances iteratively: first date uses DB, subsequent dates chain from previous closing
    const sortedDates = [...dateList].sort();
    const balances = {};

    // Get the opening balance for the earliest date from the DB
    const firstDate = sortedDates[0];
    const firstOpening = await dailyBalanceService.getOpeningBalanceForDate(firstDate);

    // Get ALL approved transactions across the full date range in ONE query
    const { Op } = require('sequelize');
    const { startOfDay, endOfDay, parseISO } = require('date-fns');
    const allTransactions = await Transaction.findAll({
      where: {
        date: {
          [Op.between]: [
            startOfDay(parseISO(sortedDates[0])),
            endOfDay(parseISO(sortedDates[sortedDates.length - 1]))
          ]
        },
        status: 'approved'
      },
      attributes: ['creditAmount', 'debitAmount', 'date'],
      raw: true
    });

    // Group transactions by date
    const txByDate = {};
    for (const tx of allTransactions) {
      const txDate = new Date(tx.date);
      const key = `${txDate.getFullYear()}-${String(txDate.getMonth() + 1).padStart(2, '0')}-${String(txDate.getDate()).padStart(2, '0')}`;
      if (!txByDate[key]) txByDate[key] = { credits: 0, debits: 0 };
      txByDate[key].credits += parseFloat(tx.creditAmount) || 0;
      txByDate[key].debits += parseFloat(tx.debitAmount) || 0;
    }

    // Chain through dates
    let runningBalance = firstOpening;
    for (const dateStr of sortedDates) {
      const opening = runningBalance;
      const dayTx = txByDate[dateStr] || { credits: 0, debits: 0 };
      const closing = opening + dayTx.credits - dayTx.debits;
      balances[dateStr] = opening;
      runningBalance = closing; // next day's opening = this day's closing
    }

    return res.json({ success: true, data: { balances } });
  } catch (error) {
    console.error('Error getting bulk balances:', error);
    return res.status(500).json({ success: false, message: 'Failed to get bulk balances' });
  }
};

const validateText = (text, fieldName = 'text') => {
  // Accept undefined or null (means no text provided)
  if (text === undefined || text === null) return null;

  if (typeof text !== 'string') {
    return { field: fieldName, message: `${fieldName} must be a string` };
  }
  // Allow empty strings: frontend may send empty to indicate removal. Only enforce max length.
  if (text.length > 500) {
    return { field: fieldName, message: `${fieldName} cannot exceed 500 characters` };
  }
  return null;
};

const validateDate = (date) => {
  if (date === undefined) return null;

  const parsedDate = new Date(date);
  if (isNaN(parsedDate.getTime())) {
    return { field: 'date', message: 'Invalid date format' };
  }

  const now = new Date();
  const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

  if (parsedDate < oneYearAgo || parsedDate > oneYearFromNow) {
    return { field: 'date', message: 'Date must be within one year of current date' };
  }

  return null;
};

const createErrorResponse = (error, defaultMessage = 'An error occurred') => {
  const errorResponse = {
    success: false,
    message: defaultMessage
  };

  if (error.name === 'SequelizeValidationError') {
    errorResponse.message = 'Validation error occurred';
    errorResponse.errors = error.errors.map(err => ({
      field: err.path,
      message: err.message
    }));
  } else if (error.name === 'SequelizeUniqueConstraintError') {
    errorResponse.message = 'Duplicate entry detected';
    errorResponse.errors = [{ field: 'reference', message: 'Reference number already exists' }];
  } else if (error.name === 'SequelizeForeignKeyConstraintError') {
    errorResponse.message = 'Invalid reference to related data';
    errorResponse.errors = [{ field: 'ledgerId', message: 'Invalid ledger reference' }];
  } else {
    errorResponse.error = process.env.NODE_ENV === 'development' ? error.message : 'Internal server error';
  }

  return errorResponse;
};

// Create new transaction
const createTransaction = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    let {
      ledgerId,
      reference,
      debitAmount,
      creditAmount,
      date,
      type,
      amount,
      transactionType,
      referenceNumber,
      remarks,
      // Anamath-specific fields for combined transactions
      anamathAmount,
      anamathRemarks,
      anamathLedgerId
    } = req.body;

    // Default transactionType to 'regular' if not provided
    if (!transactionType) transactionType = 'regular';
    // Enhanced validation using utility functions
    const validationErrors = [];
    if (!req.user || !req.user.id) {
      await t.rollback();
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }
    if (!ledgerId) {
      validationErrors.push({ field: 'ledgerId', message: 'Ledger selection is required' });
    }

    // Standardize amount parsing
    let finalDebit = parseFloat(debitAmount) || 0;
    let finalCredit = parseFloat(creditAmount) || 0;
    let finalAnamathAmount = parseFloat(anamathAmount) || 0;

    // If using simple 'amount' and 'type' fields
    if (amount && type) {
      if (type === 'credit') {
        finalCredit = parseFloat(amount);
        finalDebit = 0;
      } else {
        finalDebit = parseFloat(amount);
        finalCredit = 0;
      }
    }



    // Validate amounts
    const debitError = validateAmount(finalDebit, 'debitAmount');
    const creditError = validateAmount(finalCredit, 'creditAmount');
    if (debitError) validationErrors.push(debitError);
    if (creditError) validationErrors.push(creditError);

    // Amount logic based on transaction type
    if (transactionType === 'combined') {
      // For combined transactions, validate both main transaction and anamath amounts
      if (finalCredit <= 0 && finalDebit <= 0) {
        validationErrors.push({ field: 'amount', message: 'Combined transaction must have either debit or credit amount.' });
      }
      if (finalCredit > 0 && finalDebit > 0) {
        validationErrors.push({ field: 'amounts', message: 'Combined transaction cannot have both debit and credit amounts.' });
      }
      if (finalAnamathAmount <= 0) {
        validationErrors.push({ field: 'anamathAmount', message: 'Anamath amount must be greater than 0 for combined transactions.' });
      }
      // Anamath remarks are now optional - backend will use transaction remarks as fallback
    } else { // For 'regular' transactions

      if (finalDebit <= 0 && finalCredit <= 0) {
        validationErrors.push({ field: 'amount', message: 'Transaction must have a positive debit or credit amount.' });
      }
      if (finalDebit > 0 && finalCredit > 0) {
        validationErrors.push({ field: 'amounts', message: 'Transaction cannot have both debit and credit amounts.' });
      }
    }
    const remarksError = validateText(remarks, 'remarks');
    const dateError = validateDate(date);
    if (remarksError) validationErrors.push(remarksError);
    if (dateError) validationErrors.push(dateError);
    if (validationErrors.length > 0) {

      await t.rollback();
      return res.status(400).json({ success: false, message: 'Validation failed', errors: validationErrors });
    }
    const ledger = await Ledger.findOne({ where: { id: ledgerId, isActive: true }, transaction: t });
    if (!ledger) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Ledger not found or inactive' });
    }
    let createdTransactions = [];
    let anamathEntry = null;
    let newBalance = parseFloat(ledger.currentBalance);

    if (transactionType === 'combined') {
      // Let the beforeCreate hook handle transaction numbering via PostgreSQL sequence
      // This avoids race conditions from using MAX() under concurrent writes


      // Create the AnamathEntry first with the correct anamath amount and details
      // Smart fallback: Use transaction remarks if anamath remarks is empty
      const finalAnamathRemarks = (anamathRemarks && anamathRemarks.trim())
        ? anamathRemarks.trim()
        : (remarks && remarks.trim())
          ? remarks.trim()
          : null;

      anamathEntry = await AnamathEntry.create({
        date: date || new Date(),
        amount: finalAnamathAmount, // Use the specific anamath amount
        remarks: finalAnamathRemarks,
        ledgerId: anamathLedgerId || ledgerId, // Use anamath-specific ledger or default to transaction ledger
        // transactionNumber is auto-assigned by beforeCreate hook via PostgreSQL sequence
        createdBy: req.user.id,
        status: req.user.role === 'staff' ? 'pending' : 'approved'
      }, { transaction: t });



      // Then create the main transaction and link it to the anamath entry
      const mainTxData = {
        ledgerId,
        date: date || new Date(),
        reference: 'A', // Indicator for Anamath
        remarks: remarks ? remarks.trim() : null,
        debitAmount: finalDebit,
        creditAmount: finalCredit,
        transactionType: 'combined',
        createdBy: req.user.id,
        isCombined: true,
        combinedWithAnamathId: anamathEntry.id,
        status: req.user.role === 'staff' ? 'pending' : 'approved'
      };

      const mainTx = await Transaction.create(mainTxData, { transaction: t });


      if (mainTx.status === 'approved') {
        newBalance += finalCredit - finalDebit;
      }
      createdTransactions = [mainTx];
    } else {
      const txData = {
        ledgerId,
        date: date || new Date(),
        reference: referenceNumber || (reference ? reference.trim() : null),
        remarks: remarks ? remarks.trim() : null,
        debitAmount: finalDebit,
        creditAmount: finalCredit,
        transactionType: transactionType || 'regular',
        createdBy: req.user.id,
        status: req.user.role === 'staff' ? 'pending' : 'approved'
      };
      const transaction = await Transaction.create(txData, { transaction: t });

      // Only update balance if status is approved
      if (transaction.status === 'approved') {
        newBalance += finalCredit - finalDebit;
      }

      createdTransactions = [transaction];
    }

    if (createdTransactions[0].status === 'approved') {
      await ledger.update({ currentBalance: newBalance, updatedBy: req.user.id }, { transaction: t });
    }

    await t.commit();

    // INVALIDATE CACHE after creating new transaction
    cacheService.invalidateAfterWrite();

    setTimeout(async () => {
      try {
        const transactionDate = new Date(createdTransactions[0].date).toISOString().split('T')[0];
        await balanceRecalculationService.recalculateFromDate(transactionDate, createdTransactions[0].ledgerId, req.user.id);
      } catch (recalcError) {
        console.error('Asynchronous balance recalculation failed after new transaction:', recalcError);
      }
    }, 0);
    const transactionsWithAssociations = await Promise.all(createdTransactions.map(async tx => {
      return await Transaction.findByPk(tx.id, {
        include: [
          { model: Ledger, as: 'ledger', attributes: ['id', 'name', 'currentBalance'] },
          { model: User, as: 'creator', attributes: ['id', 'username'] }
        ]
      });
    }));
    res.status(201).json({
      success: true,
      message: transactionType === 'combined' ? 'Combined transaction created successfully' : 'Transaction created successfully',
      data: {
        transactions: transactionsWithAssociations,
        transactionNumbers: transactionsWithAssociations.map(tx => tx.transactionNumber),
        newLedgerBalance: newBalance
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Create transaction error:', error);
    res.status(500).json(createErrorResponse(error, 'Failed to create transaction'));
  }
};

// Approve a pending transaction
const approveTransaction = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const transaction = await Transaction.findByPk(id, {
      include: [{ model: Ledger, as: 'ledger' }],
      transaction: t
    });

    if (!transaction) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Transaction is not in pending state' });
    }

    // Role check: Staff cannot approve anything
    if (req.user.role === 'staff') {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Staff cannot approve transactions' });
    }

    // Manager can only approve DEBIT transactions
    const isCredit = parseFloat(transaction.creditAmount) > 0;
    if (req.user.role === 'manager' && isCredit) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Managers can only approve debit transactions. Credit approval requires Admin or Owner.' });
    }

    // Manager cannot approve anamath/combined transactions
    if (req.user.role === 'manager' && transaction.transactionType === 'combined') {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Managers cannot approve combined/anamath transactions. Requires Admin or Owner.' });
    }

    // Update status to approved
    await transaction.update({ status: 'approved', updatedBy: req.user.id }, { transaction: t });

    // Update ledger balance only now (if we want pending to not affect balance)
    // For now, in Petty Cash, we'll follow the user's "see staff entry always pending" 
    // and assume approval is the final confirmation.
    const amountAdjustment = transaction.creditAmount - transaction.debitAmount;
    const ledger = transaction.ledger;
    const newBalance = parseFloat(ledger.currentBalance) + amountAdjustment;

    await ledger.update({ currentBalance: newBalance, updatedBy: req.user.id }, { transaction: t });

    await t.commit();

    // Invalidate caches
    cacheService.invalidateAfterWrite();

    // Trigger recalculation
    setTimeout(async () => {
      try {
        const transactionDate = new Date(transaction.date).toISOString().split('T')[0];
        await balanceRecalculationService.recalculateFromDate(transactionDate, transaction.ledgerId, req.user.id);
      } catch (recalcError) {
        console.error('Async recalibration failed after approval:', recalcError);
      }
    }, 0);

    return res.json({
      success: true,
      message: 'Transaction approved successfully',
      data: { transaction, newBalance }
    });
  } catch (error) {
    await t.rollback();
    console.error('Approval error:', error);
    return res.status(500).json({ success: false, message: 'Failed to approve transaction' });
  }
};

// Reject a pending transaction
const rejectTransaction = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const transaction = await Transaction.findByPk(id, {
      include: [{ model: Ledger, as: 'ledger' }],
      transaction: t
    });

    if (!transaction) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Transaction is not in pending state' });
    }

    // Staff cannot reject
    if (req.user.role === 'staff') {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Staff cannot reject transactions' });
    }

    // Manager can only reject DEBIT transactions
    const isCredit = parseFloat(transaction.creditAmount) > 0;
    if (req.user.role === 'manager' && isCredit) {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Managers can only reject debit transactions. Credit rejection requires Admin or Owner.' });
    }

    if (req.user.role === 'manager' && transaction.transactionType === 'combined') {
      await t.rollback();
      return res.status(403).json({ success: false, message: 'Managers cannot reject combined/anamath transactions. Requires Admin or Owner.' });
    }

    // Update status to rejected (no balance impact since pending didn't affect balance)
    await transaction.update({ status: 'rejected', updatedBy: req.user.id }, { transaction: t });

    await t.commit();

    // Invalidate caches
    cacheService.invalidateAfterWrite();

    return res.json({
      success: true,
      message: 'Transaction rejected successfully',
      data: { transaction }
    });
  } catch (error) {
    await t.rollback();
    console.error('Rejection error:', error);
    return res.status(500).json({ success: false, message: 'Failed to reject transaction' });
  }
};

// Get all transactions - Optimized for 10M+ records with cursor and offset pagination
const getAllTransactions = async (req, res) => {
  try {
    const {
      page = 1,
      limit = 20,
      ledgerId,
      startDate,
      endDate,
      search,
      type,
      tx_number,
      includeSuspended = 'false',
      no_count = 'false',
      cursor // Cursor-based pagination: "date|id" from last row of previous page
    } = req.query;

    // Cap limits for fast response times
    const hasFilters = ledgerId || startDate || endDate || type || tx_number || search;
    const maxLimit = hasFilters ? 500 : 200;
    const parsedLimit = Math.min(parseInt(limit) || 20, maxLimit);
    const parsedPage = parseInt(page) || 1;

    // CHECK CACHE FIRST
    const cacheParams = { page: parsedPage, limit: parsedLimit, ledgerId, startDate, endDate, search, type, tx_number, includeSuspended, cursor };
    const cached = cacheService.getTransactions(cacheParams);
    if (cached) return res.json(cached);

    let whereClause = {};
    let ledgerWhereClause = { isActive: true };

    if (includeSuspended !== 'true') {
      whereClause.isSuspended = false;
    }
    if (ledgerId) whereClause.ledgerId = ledgerId;

    // Date range filters
    if (startDate && endDate) {
      whereClause.date = { [Op.between]: [startDate, endDate] };
    } else if (startDate) {
      whereClause.date = { [Op.gte]: startDate };
    } else if (endDate) {
      whereClause.date = { [Op.lte]: endDate };
    }

    // Transaction type filter
    if (type === 'debit') whereClause.debitAmount = { [Op.gt]: 0 };
    else if (type === 'credit') whereClause.creditAmount = { [Op.gt]: 0 };

    // Transaction number filter
    if (tx_number) {
      const txNum = parseInt(tx_number);
      if (!isNaN(txNum)) {
        whereClause.transactionNumber = txNum;
      }
    }

    // Search
    if (search) {
      const searchTerm = search.toLowerCase();
      whereClause[Op.or] = [
        sequelize.where(sequelize.fn('LOWER', sequelize.col('description')), {
          [Op.iLike]: `%${searchTerm}%`
        }),
        sequelize.where(sequelize.fn('LOWER', sequelize.col('reference')), {
          [Op.iLike]: `%${searchTerm}%`
        })
      ];
    }

    // CURSOR-BASED PAGINATION: O(1) at any depth, parameterized for security
    if (cursor) {
      const [cursorDate, cursorId] = cursor.split('|');
      if (cursorDate && cursorId) {
        // Safe keyset condition using Sequelize operators (no raw SQL)
        whereClause[Op.and] = [
          ...(whereClause[Op.and] || []),
          {
            [Op.or]: [
              { date: { [Op.lt]: cursorDate } },
              {
                [Op.and]: [
                  { date: cursorDate },
                  { id: { [Op.lt]: cursorId } }
                ]
              }
            ]
          }
        ];
      }
    }

    // Query
    const transactions = await Transaction.findAll({
      where: whereClause,
      include: [
        {
          model: Ledger,
          as: 'ledger',
          where: ledgerWhereClause,
          attributes: ['id', 'name', 'ledgerType'],
          required: true
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username'],
          required: false
        }
      ],
      attributes: [
        'id', 'date', 'creditAmount', 'debitAmount', 'description',
        'reference', 'transactionNumber', 'isSuspended', 'ledgerId',
        'createdAt', 'updatedAt', 'remarks', 'transactionType', 'status'
      ],
      limit: parsedLimit,
      offset: cursor ? 0 : (parsedPage - 1) * parsedLimit, // No offset when using cursor
      order: [['date', 'DESC'], ['createdAt', 'DESC']],
      raw: false,
      logging: false
    });

    // Fast count: use pg_class approximate count ONLY when no filters are active
    let count = 0;
    const hasActiveFilters = ledgerId || startDate || endDate || type || tx_number || search;
    if (parsedPage === 1 && !cursor && no_count !== 'true') {
      if (!hasActiveFilters) {
        // No filters — safe to use fast approximate count from PostgreSQL statistics
        try {
          const [countResult] = await sequelize.query(
            `SELECT reltuples::bigint AS approx FROM pg_class WHERE relname = 'transactions'`
          );
          count = parseInt(countResult[0]?.approx) || 0;
          // If approximate count is small, get exact count
          if (count < 10000) {
            count = await Transaction.count({
              where: whereClause,
              include: [{ model: Ledger, as: 'ledger', where: ledgerWhereClause, required: true }]
            });
          }
        } catch {
          count = await Transaction.count({
            where: whereClause,
            include: [{ model: Ledger, as: 'ledger', where: ledgerWhereClause, required: true }]
          });
        }
      } else {
        // Filters active — must use exact count for accurate pagination
        count = await Transaction.count({
          where: whereClause,
          include: [{ model: Ledger, as: 'ledger', where: ledgerWhereClause, required: true }]
        });
      }
    } else if (no_count !== 'true' && !cursor) {
      count = transactions.length < parsedLimit
        ? (parsedPage - 1) * parsedLimit + transactions.length
        : (parsedPage - 1) * parsedLimit + parsedLimit + 1;
    }

    // Build cursor for next page
    const lastRow = transactions[transactions.length - 1];
    const nextCursor = lastRow ? `${lastRow.date}|${lastRow.id}` : null;
    const hasMore = transactions.length === parsedLimit;

    // Page totals
    const pageTotals = transactions.reduce((acc, t) => {
      acc.totalDebit += parseFloat(t.debitAmount || 0);
      acc.totalCredit += parseFloat(t.creditAmount || 0);
      return acc;
    }, { totalDebit: 0, totalCredit: 0 });

    const responseData = {
      success: true,
      data: {
        transactions,
        totals: pageTotals,
        summary: { openingBalance: 0, closingBalance: 0, totalDebit: 0, totalCredit: 0, netChange: 0 },
        pagination: {
          total: count,
          page: parsedPage,
          pages: count > 0 ? Math.ceil(count / parsedLimit) : 1,
          limit: parsedLimit,
          nextCursor, // For cursor-based pagination
          hasMore     // Whether there are more rows after this page
        }
      }
    };

    cacheService.setTransactions(cacheParams, responseData);
    res.json(responseData);

  } catch (error) {
    console.error('Get transactions error:', error.message);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transactions',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Get transaction by ID
const getTransactionById = async (req, res) => {
  try {
    const { id } = req.params;

    let ledgerWhereClause = { isActive: true };
    // Since all users are admin now, no role-based restrictions

    const transaction = await Transaction.findByPk(id, {
      include: [
        {
          model: Ledger,
          as: 'ledger',
          where: ledgerWhereClause,
          attributes: ['id', 'name', 'ledgerType', 'currentBalance']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username', 'email']
        },
        {
          model: User,
          as: 'updater',
          attributes: ['id', 'username', 'email'],
          required: false
        }
      ]
    });

    if (!transaction) {
      return res.status(404).json({
        success: false,
        message: 'Transaction not found'
      });
    }

    res.json({
      success: true,
      data: { transaction, transactionNumber: transaction.transactionNumber }
    });
  } catch (error) {
    console.error('Get transaction error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction',
      error: error.message
    });
  }
};

// Update transaction
const updateTransaction = async (req, res) => {
  const t = await sequelize.transaction();

  try {
    const { id } = req.params;
    const { reference, debitAmount, creditAmount, date, ledgerId, remarks } = req.body;

    // Enhanced validation with detailed error messages
    const validationErrors = [];

    // Validate transaction ID (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      validationErrors.push({ field: 'id', message: 'Valid transaction ID is required' });
    }

    // Validate amounts with detailed checks
    const newDebit = debitAmount !== undefined ? parseFloat(debitAmount) : undefined;
    const newCredit = creditAmount !== undefined ? parseFloat(creditAmount) : undefined;

    if (newDebit !== undefined && (isNaN(newDebit) || newDebit < 0)) {
      validationErrors.push({ field: 'debitAmount', message: 'Debit amount must be a positive number' });
    }

    if (newCredit !== undefined && (isNaN(newCredit) || newCredit < 0)) {
      validationErrors.push({ field: 'creditAmount', message: 'Credit amount must be a positive number' });
    }

    // Check that at least one amount is provided and valid
    const hasValidDebit = newDebit !== undefined && newDebit > 0;
    const hasValidCredit = newCredit !== undefined && newCredit > 0;

    // For editing, we need to allow either debit OR credit, but not both with positive values
    if (hasValidDebit && hasValidCredit) {
      validationErrors.push({ field: 'amounts', message: 'Transaction cannot have both debit and credit amounts' });
    }

    // For editing, if both amounts are provided but both are 0 or invalid, that's invalid
    // But if only one is provided (the other being 0), that's valid for editing
    const bothAmountsProvided = newDebit !== undefined && newCredit !== undefined;
    const bothAmountsZeroOrInvalid = (!hasValidDebit && !hasValidCredit);

    if (bothAmountsProvided && bothAmountsZeroOrInvalid) {
      validationErrors.push({ field: 'amounts', message: 'Transaction must have either debit or credit amount' });
    } else if (!bothAmountsProvided && !hasValidDebit && !hasValidCredit) {
      // If neither amount is provided at all, that's also invalid
      validationErrors.push({ field: 'amounts', message: 'Transaction must have either debit or credit amount' });
    }

    // Validate remarks (if provided) - allow empty string to mean "clear remarks" or omitted
    if (remarks !== undefined) {
      if (typeof remarks !== 'string') {
        validationErrors.push({ field: 'remarks', message: 'Remarks must be a string' });
      } else if (remarks.length > 1000) {
        validationErrors.push({ field: 'remarks', message: 'Remarks cannot exceed 1000 characters' });
      }
    }

    // Validate reference
    if (reference !== undefined && reference !== null && typeof reference !== 'string') {
      validationErrors.push({ field: 'reference', message: 'Reference must be a string' });
    }

    // Validate date
    if (date !== undefined) {
      const parsedDate = new Date(date);
      if (isNaN(parsedDate.getTime())) {
        validationErrors.push({ field: 'date', message: 'Invalid date format' });
      } else {
        const now = new Date();
        const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
        const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

        if (parsedDate < oneYearAgo || parsedDate > oneYearFromNow) {
          validationErrors.push({ field: 'date', message: 'Date must be within one year of current date' });
        }
      }
    }

    // Return validation errors if any
    if (validationErrors.length > 0) {

      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Validation failed',
        errors: validationErrors
      });
    }

    // Find transaction with optimistic locking check
    const transaction = await Transaction.findByPk(id, {
      include: [
        {
          model: Ledger,
          as: 'ledger',
          where: { isActive: true }
        }
      ],
      transaction: t
    });

    if (!transaction) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or has been deleted'
      });
    }

    // Handle ledger change if provided
    let targetLedger = transaction.ledger;
    let oldLedger = transaction.ledger;

    if (ledgerId && ledgerId !== transaction.ledgerId) {
      // Validate new ledger exists
      const newLedger = await Ledger.findOne({
        where: { id: ledgerId, isActive: true },
        transaction: t
      });

      if (!newLedger) {
        await t.rollback();
        return res.status(400).json({
          success: false,
          message: 'Target ledger not found or inactive',
          errors: [{ field: 'ledgerId', message: 'Invalid ledger selection' }]
        });
      }

      targetLedger = newLedger;
    }

    // Calculate balance adjustments
    const oldDebit = parseFloat(transaction.debitAmount) || 0;
    const oldCredit = parseFloat(transaction.creditAmount) || 0;

    // Determine final amounts - if amount is provided (even if 0), use it; otherwise keep old value
    const finalDebit = newDebit !== undefined ? newDebit : oldDebit;
    const finalCredit = newCredit !== undefined ? newCredit : oldCredit;



    // Update transaction with only provided fields
    const updateData = {
      updatedBy: req.user.id,
      updatedAt: new Date()
    };

    if (remarks !== undefined) updateData.remarks = remarks.trim();
    if (reference !== undefined) updateData.reference = reference;

    // Update amounts if they were provided in the request
    if (newDebit !== undefined) updateData.debitAmount = finalDebit;
    if (newCredit !== undefined) updateData.creditAmount = finalCredit;

    if (date !== undefined) updateData.date = new Date(date);
    if (ledgerId && ledgerId !== transaction.ledgerId) updateData.ledgerId = ledgerId;

    // Store old data for audit logging
    const oldTransactionData = {
      remarks: transaction.remarks,
      debitAmount: transaction.debitAmount,
      creditAmount: transaction.creditAmount,
      date: transaction.date,
      reference: transaction.reference,
      ledgerId: transaction.ledgerId
    };

    await transaction.update(updateData, { transaction: t });

    // CRITICAL FIX: Update linked Anamath entry if this is a Credit+Anamath transaction
    if (transaction.combinedWithAnamathId && date !== undefined) {
      const { AnamathEntry } = require('../models');
      const linkedAnamath = await AnamathEntry.findByPk(transaction.combinedWithAnamathId, { transaction: t });

      if (linkedAnamath) {
        await linkedAnamath.update({
          date: new Date(date),
          updatedBy: req.user.id,
          updatedAt: new Date()
        }, { transaction: t });


      } else {
        console.warn('⚠️ Linked Anamath entry not found:', transaction.combinedWithAnamathId);
      }
    }

    // Check if date was changed or amounts were changed - if so, trigger balance recalculation
    const oldDateString = new Date(oldTransactionData.date).toISOString().split('T')[0];
    const newDateString = date ? new Date(date).toISOString().split('T')[0] : oldDateString;
    const dateChanged = date !== undefined && newDateString !== oldDateString;
    const amountsChanged = (newDebit !== undefined && newDebit !== parseFloat(oldTransactionData.debitAmount)) ||
      (newCredit !== undefined && newCredit !== parseFloat(oldTransactionData.creditAmount));

    let recalculationTriggered = false;
    const editDate = dateChanged ? newDateString : oldDateString;

    if (dateChanged || amountsChanged) {

      // Determine the earliest date that needs recalculation
      // If date was moved back, we need to recalculate from that earlier date
      // If date was moved forward or amounts changed, we recalculate from the original date
      const earliestDate = dateChanged && (new Date(newDateString) < new Date(oldDateString))
        ? newDateString
        : oldDateString;

      // Immediately adjust ledger balance within the DB transaction to prevent drift
      if (transaction.status === 'approved') {
        const balanceDelta = (finalCredit - finalDebit) - (oldCredit - oldDebit);
        if (balanceDelta !== 0) {
          const newLedgerBalance = parseFloat(oldLedger.currentBalance) + balanceDelta;
          await oldLedger.update({ currentBalance: newLedgerBalance, updatedBy: req.user.id }, { transaction: t });
        }

        // If ledger changed, reverse from old ledger and add to new ledger
        if (ledgerId && ledgerId !== oldLedger.id) {
          // Reverse entire effect from old ledger
          const reverseBalance = parseFloat(oldLedger.currentBalance) + oldDebit - oldCredit;
          await oldLedger.update({ currentBalance: reverseBalance, updatedBy: req.user.id }, { transaction: t });

          // Add effect to new ledger
          const newBalance = parseFloat(targetLedger.currentBalance) + finalCredit - finalDebit;
          await targetLedger.update({ currentBalance: newBalance, updatedBy: req.user.id }, { transaction: t });
        }
      }

      recalculationTriggered = true;
    }

    await t.commit();

    // INVALIDATE CACHE after updating transaction
    cacheService.invalidateAfterWrite();
    if (date) {
      cacheService.invalidateBalance(new Date(date).toISOString().split('T')[0]);
    }

    // Trigger balance recalculation AFTER transaction commit (to avoid deadlocks)
    if (recalculationTriggered) {
      try {
        const oldDateString = new Date(oldTransactionData.date).toISOString().split('T')[0];
        const newDateString = date ? new Date(date).toISOString().split('T')[0] : oldDateString;

        // Determine the earliest date that needs recalculation
        const earliestDate = dateChanged && (new Date(newDateString) < new Date(oldDateString))
          ? newDateString
          : oldDateString;


        await balanceRecalculationService.recalculateFromDate(earliestDate, oldLedger.id, req.user.id);
        // If the ledger was changed, we also need to recalculate for the new ledger
        if (ledgerId && ledgerId !== oldLedger.id) {
          await balanceRecalculationService.recalculateFromDate(earliestDate, ledgerId, req.user.id);
        }
        // NOTE: dailyBalanceService.recalculateBalancesFromDate() removed here
        // because balanceRecalculationService already handles full continuity chain.
        // Running both caused double-work and 2x latency on every edit.
      } catch (recalcError) {
        console.error('Balance recalculation failed after transaction edit:', recalcError);
        // Don't fail the transaction update, but log the error
      }
    }

    // Log the edit for audit trail
    try {
      await auditService.logTransactionEdit(
        id,
        oldTransactionData,
        updateData,
        req.user.id,
        req.user.username || req.user.email
      );
    } catch (auditError) {
      console.error('Failed to log transaction edit audit:', auditError);
    }

    // Fetch updated transaction with fresh data
    const updatedTransaction = await Transaction.findByPk(id, {
      include: [
        {
          model: Ledger,
          as: 'ledger',
          attributes: ['id', 'name', 'currentBalance', 'ledgerType']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username']
        },
        {
          model: User,
          as: 'updater',
          attributes: ['id', 'username'],
          required: false
        }
      ]
    });

    res.json({
      success: true,
      message: 'Transaction updated successfully',
      data: {
        transaction: updatedTransaction,
        transactionNumber: updatedTransaction.transactionNumber,
        newLedgerBalance: targetLedger.currentBalance,
        balanceChange: ledgerId && ledgerId !== transaction.ledgerId ? 'ledger_changed' : 'amount_adjusted'
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('Update transaction error:', error);

    // Enhanced error response with more details
    const errorResponse = {
      success: false,
      message: 'Failed to update transaction'
    };

    // Handle specific error types
    if (error.name === 'SequelizeValidationError') {
      errorResponse.message = 'Validation error occurred';
      errorResponse.errors = error.errors.map(err => ({
        field: err.path,
        message: err.message
      }));
    } else if (error.name === 'SequelizeUniqueConstraintError') {
      errorResponse.message = 'Duplicate entry detected';
      errorResponse.errors = [{ field: 'reference', message: 'Reference number already exists' }];
    } else if (error.name === 'SequelizeForeignKeyConstraintError') {
      errorResponse.message = 'Invalid reference to related data';
      errorResponse.errors = [{ field: 'ledgerId', message: 'Invalid ledger reference' }];
    } else {
      // Generic error - don't expose internal details in production
      errorResponse.error = process.env.NODE_ENV === 'development' ? error.message : 'Internal server error';
    }

    res.status(500).json(errorResponse);
  }
};

// Delete transaction
const deleteTransaction = async (req, res) => {

  const t = await sequelize.transaction();

  try {
    const { id } = req.params;

    // Enhanced validation for transaction ID (UUID format)
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    if (!id || !uuidRegex.test(id)) {
      await t.rollback();
      return res.status(400).json({
        success: false,
        message: 'Valid transaction ID is required',
        errors: [{ field: 'id', message: 'Transaction ID must be a valid UUID' }]
      });
    }

    // Find transaction with detailed includes for audit logging
    const transaction = await Transaction.findByPk(id, {
      include: [
        {
          model: Ledger,
          as: 'ledger',
          where: { isActive: true },
          attributes: ['id', 'name', 'currentBalance', 'ledgerType']
        },
        {
          model: User,
          as: 'creator',
          attributes: ['id', 'username'],
          required: false
        }
      ],
      transaction: t
    });

    if (!transaction) {
      await t.rollback();
      return res.status(404).json({
        success: false,
        message: 'Transaction not found or has been deleted'
      });
    }

    // ✅ 30-day restriction REMOVED - Can now delete transactions of any age
    // Previously: Cannot delete transactions older than 30 days
    // Now: Can delete any transaction (with proper permissions)

    const ledger = transaction.ledger;
    const debit = parseFloat(transaction.debitAmount) || 0;
    const credit = parseFloat(transaction.creditAmount) || 0;

    // Store transaction details for audit log before deletion
    const auditData = {
      transactionId: transaction.id,
      ledgerId: ledger.id,
      ledgerName: ledger.name,
      description: transaction.description,
      reference: transaction.reference,
      debitAmount: debit,
      creditAmount: credit,
      date: transaction.date,
      originalCreator: transaction.creator?.username || 'Unknown',
      deletedBy: req.user.username || req.user.id,
      deletedAt: new Date(),
      oldLedgerBalance: parseFloat(ledger.currentBalance)
    };

    // Calculate new ledger balance by reversing the transaction effect
    const newLedgerBalance = parseFloat(transaction.ledger.currentBalance) + debit - credit;

    // Trigger balance recalculation starting from the date of the deleted transaction
    const recalculationStartDate = new Date(transaction.date).toISOString().split('T')[0];

    // Allow deletion with warning - removed restrictive balance validation
    // In a cash management system, temporary negative balances may be acceptable

    // Optional: Add a warning log for significant negative balances
    if (newLedgerBalance < -100000) {
      console.warn(`⚠️  Large negative balance warning: ₹${newLedgerBalance.toFixed(2)} for ledger ${ledger.name}`);
    }

    // Update ledger balance
    await ledger.update({
      currentBalance: newLedgerBalance,
      updatedBy: req.user.id
    }, { transaction: t });

    // Soft delete option - comment out the destroy line and uncomment the update line below
    // to implement soft delete instead of hard delete
    await transaction.destroy({ transaction: t });

    // Store transaction date for balance recalculation
    const deletedTransactionDate = new Date(transaction.date).toISOString().split('T')[0];

    await t.commit();

    // INVALIDATE CACHE after deleting transaction
    cacheService.invalidateTransactions();
    cacheService.invalidateSummaries();
    cacheService.invalidateBalance(deletedTransactionDate);

    // Trigger balance recalculation from the date of the deleted transaction
    try {
      await balanceRecalculationService.recalculateFromDate(deletedTransactionDate, transaction.ledger.id, req.user.id);
    } catch (recalcError) {
      console.error('Balance recalculation failed after transaction deletion:', recalcError);
      // Don't fail the delete operation, but log the error
    }
    // Log the deletion for audit trail
    try {
      await auditService.logTransactionDelete(
        transaction,
        req.user.id,
        req.user.username || req.user.email,
        newLedgerBalance
      );
    } catch (auditError) {
      console.error('Failed to log transaction delete audit:', auditError);
    }

    // For soft delete, use this instead:
    // await transaction.update({
    //   isDeleted: true,
    //   deletedBy: req.user.id,
    //   deletedAt: new Date()
    // }, { transaction: t });

    res.json({
      success: true,
      message: 'Transaction deleted successfully',
      data: {
        newLedgerBalance,
        deletedTransaction: {
          id: auditData.transactionId,
          description: auditData.description,
          amount: credit > 0 ? credit : debit,
          type: credit > 0 ? 'credit' : 'debit',
          ledgerName: auditData.ledgerName
        }
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('Delete transaction error:', error);

    // Enhanced error response
    const errorResponse = {
      success: false,
      message: 'Failed to delete transaction'
    };

    // Handle specific error types
    if (error.name === 'SequelizeForeignKeyConstraintError') {
      errorResponse.message = 'Cannot delete transaction: it is referenced by other records';
      errorResponse.errors = [{ field: 'references', message: 'Transaction has dependent records' }];
    } else if (error.name === 'SequelizeValidationError') {
      errorResponse.message = 'Validation error during deletion';
      errorResponse.errors = error.errors.map(err => ({
        field: err.path,
        message: err.message
      }));
    } else {
      // Generic error - don't expose internal details in production
      errorResponse.error = process.env.NODE_ENV === 'development' ? error.message : 'Internal server error';
    }

    res.status(500).json(errorResponse);
  }
};

// Get transaction audit logs
const getTransactionAuditLogs = async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 10000 } = req.query; // No limit - unlimited records

    if (id) {
      // Get audit logs for specific transaction
      const logs = await auditService.getTransactionHistory(id);
      res.json({
        success: true,
        data: { logs }
      });
    } else {
      // Get all recent audit logs
      const logs = await auditService.getAuditLogs(null, parseInt(limit));
      res.json({
        success: true,
        data: { logs }
      });
    }
  } catch (error) {
    console.error('Get audit logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch audit logs',
      error: error.message
    });
  }
};

// Get transaction statistics
const getTransactionStats = async (req, res) => {
  try {
    const { ledgerId, startDate, endDate } = req.query;

    let whereClause = {};
    let ledgerWhereClause = { isActive: true };

    // Since all users are admin now, no role-based restrictions

    // Exclude suspended from stats as well
    whereClause.isSuspended = false;

    if (ledgerId) {
      whereClause.ledgerId = ledgerId;
    }

    if (startDate && endDate) {
      whereClause.date = {
        [Op.between]: [startDate, endDate]
      };
    }

    const stats = await Transaction.findAll({
      where: whereClause,
      include: [
        {
          model: Ledger,
          as: 'ledger',
          attributes: []
        }
      ],
      attributes: [
        [sequelize.fn('COUNT', sequelize.col('Transaction.id')), 'totalTransactions'],
        [sequelize.fn('SUM', sequelize.col('debitAmount')), 'totalDebits'],
        [sequelize.fn('SUM', sequelize.col('creditAmount')), 'totalCredits'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN "debitAmount" > 0 THEN 1 END')), 'debitCount'],
        [sequelize.fn('COUNT', sequelize.literal('CASE WHEN "creditAmount" > 0 THEN 1 END')), 'creditCount']
      ],
      raw: true
    });

    const result = stats[0] || {
      totalTransactions: 0,
      totalDebits: 0,
      totalCredits: 0,
      debitCount: 0,
      creditCount: 0
    };

    result.netAmount = parseFloat(result.totalCredits || 0) - parseFloat(result.totalDebits || 0);

    res.json({
      success: true,
      data: { stats: result }
    });
  } catch (error) {
    console.error('Get transaction stats error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch transaction statistics',
      error: error.message
    });
  }
};

// Get next transaction number (sequential preview)
const getNextTransactionNumber = async (req, res) => {
  try {
    const maxNumber = await Transaction.max('transactionNumber');
    const nextTransactionNumber = (maxNumber || 0) + 1;
    res.json({
      success: true,
      data: { nextTransactionNumber }
    });
  } catch (error) {
    console.error('Get next transaction number error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch next transaction number'
    });
  }
};

// Get current business date balances
const getCurrentBusinessBalances = async (req, res) => {
  try {
    const businessDate = dailyBalanceService.getCurrentBusinessDate();
    const openingBalance = await dailyBalanceService.getCurrentOpeningBalance();
    const closingBalance = await dailyBalanceService.getCurrentClosingBalance();

    res.json({
      success: true,
      data: {
        businessDate,
        openingBalance,
        closingBalance,
        isBeforeSixAM: new Date().getHours() < 6
      },
      message: 'Current business balances retrieved successfully'
    });
  } catch (error) {
    console.error('Error getting current business balances:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get current business balances'
    });
  }
};

// Manual trigger for daily rollover (admin only)
const triggerDailyRollover = async (req, res) => {
  try {
    await dailyBalanceService.handleDailyRollover();

    res.json({
      success: true,
      message: 'Daily rollover completed successfully'
    });
  } catch (error) {
    console.error('Error triggering daily rollover:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to trigger daily rollover'
    });
  }
};

// Suspend a transaction (excludes from calculations)
const suspendTransaction = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!req.user || !req.user.id) {
      await t.rollback();
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const transaction = await Transaction.findByPk(id, { transaction: t });
    if (!transaction) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (transaction.isSuspended) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Transaction is already suspended' });
    }

    // Update transaction to suspended status
    await transaction.update({
      isSuspended: true,
      suspendedAt: new Date(),
      suspendedBy: req.user.id,
      remarks: reason ? `SUSPENDED: ${reason}` : 'SUSPENDED'
    }, { transaction: t });

    // Recalculate balances since this transaction is now excluded
    const transactionDate = new Date(transaction.date).toISOString().split('T')[0];

    await t.commit();

    // Asynchronous balance recalculation
    setTimeout(async () => {
      try {
        await balanceRecalculationService.recalculateFromDate(transactionDate, transaction.ledgerId, req.user.id);
      } catch (recalcError) {
        console.error('Asynchronous balance recalculation failed after suspend:', recalcError);
      }
    }, 0);

    // Audit log
    await auditService.log(req.user.id, 'SUSPEND_TRANSACTION', 'transactions', id, {
      reason: reason || 'No reason provided',
      suspendedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Transaction suspended successfully',
      data: {
        transactionId: id,
        suspendedAt: new Date(),
        reason: reason || 'No reason provided'
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Suspend transaction error:', error);
    res.status(500).json(createErrorResponse(error, 'Failed to suspend transaction'));
  }
};

// Unsuspend a transaction (includes back in calculations)
const unsuspendTransaction = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { reason } = req.body;

    if (!req.user || !req.user.id) {
      await t.rollback();
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    const transaction = await Transaction.findByPk(id, { transaction: t });
    if (!transaction) {
      await t.rollback();
      return res.status(404).json({ success: false, message: 'Transaction not found' });
    }

    if (!transaction.isSuspended) {
      await t.rollback();
      return res.status(400).json({ success: false, message: 'Transaction is not suspended' });
    }

    // Update transaction to active status
    await transaction.update({
      isSuspended: false,
      suspendedAt: null,
      suspendedBy: null,
      remarks: reason ? `UNSUSPENDED: ${reason}` : null
    }, { transaction: t });

    // Recalculate balances since this transaction is now included
    const transactionDate = new Date(transaction.date).toISOString().split('T')[0];

    await t.commit();

    // Asynchronous balance recalculation
    setTimeout(async () => {
      try {
        await balanceRecalculationService.recalculateFromDate(transactionDate, transaction.ledgerId, req.user.id);
      } catch (recalcError) {
        console.error('Asynchronous balance recalculation failed after unsuspend:', recalcError);
      }
    }, 0);

    // Audit log
    await auditService.log(req.user.id, 'UNSUSPEND_TRANSACTION', 'transactions', id, {
      reason: reason || 'No reason provided',
      unsuspendedAt: new Date()
    });

    res.json({
      success: true,
      message: 'Transaction unsuspended successfully',
      data: {
        transactionId: id,
        unsuspendedAt: new Date(),
        reason: reason || 'No reason provided'
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Unsuspend transaction error:', error);
    res.status(500).json(createErrorResponse(error, 'Failed to unsuspend transaction'));
  }
};

module.exports = {
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
};