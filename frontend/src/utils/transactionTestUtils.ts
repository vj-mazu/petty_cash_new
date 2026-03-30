// Transaction Test Utilities
// This file contains utilities for testing and debugging transaction operations

export interface TransactionTestCase {
  name: string;
  description: string;
  testData: any;
  expectedResult: 'success' | 'error';
  expectedError?: string;
}

export const transactionEditTestCases: TransactionTestCase[] = [
  {
    name: 'Valid Edit - Description Only',
    description: 'Test editing only the description field',
    testData: {
      description: 'Updated description'
    },
    expectedResult: 'success'
  },
  {
    name: 'Valid Edit - Amount Only',
    description: 'Test editing only the amount field',
    testData: {
      creditAmount: 1500,
      debitAmount: 0
    },
    expectedResult: 'success'
  },
  {
    name: 'Invalid Edit - Both Amounts',
    description: 'Test editing with both debit and credit amounts',
    testData: {
      creditAmount: 1000,
      debitAmount: 500
    },
    expectedResult: 'error',
    expectedError: 'Transaction cannot have both debit and credit amounts'
  },
  {
    name: 'Invalid Edit - Negative Amount',
    description: 'Test editing with negative amount',
    testData: {
      creditAmount: -100
    },
    expectedResult: 'error',
    expectedError: 'Credit amount must be a positive number'
  },
  {
    name: 'Invalid Edit - Empty Description',
    description: 'Test editing with empty description',
    testData: {
      description: ''
    },
    expectedResult: 'error',
    expectedError: 'Description cannot be empty'
  },
  {
    name: 'Invalid Edit - Long Description',
    description: 'Test editing with description exceeding 500 characters',
    testData: {
      description: 'A'.repeat(501)
    },
    expectedResult: 'error',
    expectedError: 'Description cannot exceed 500 characters'
  },
  {
    name: 'Valid Edit - Ledger Change',
    description: 'Test changing the ledger of a transaction',
    testData: {
      ledgerId: '2' // Assuming ledger ID 2 exists
    },
    expectedResult: 'success'
  },
  {
    name: 'Valid Edit - Date Change',
    description: 'Test changing the transaction date',
    testData: {
      date: new Date().toISOString().split('T')[0]
    },
    expectedResult: 'success'
  }
];

export const transactionDeleteTestCases: TransactionTestCase[] = [
  {
    name: 'Valid Delete - Recent Transaction',
    description: 'Test deleting a recent transaction (within 30 days)',
    testData: {},
    expectedResult: 'success'
  },
  {
    name: 'Invalid Delete - Old Transaction',
    description: 'Test deleting an old transaction (older than 30 days)',
    testData: {},
    expectedResult: 'error',
    expectedError: 'Cannot delete transactions older than 30 days'
  },
  {
    name: 'Invalid Delete - Non-existent Transaction',
    description: 'Test deleting a transaction that does not exist',
    testData: {},
    expectedResult: 'error',
    expectedError: 'Transaction not found'
  }
];

// Validation utility functions
export const validateTransactionData = (data: any): { isValid: boolean; errors: string[] } => {
  const errors: string[] = [];

  // Check description
  if (data.description !== undefined) {
    if (typeof data.description !== 'string') {
      errors.push('Description must be a string');
    } else if (data.description.trim().length === 0) {
      errors.push('Description cannot be empty');
    } else if (data.description.length > 500) {
      errors.push('Description cannot exceed 500 characters');
    }
  }

  // Check amounts
  if (data.debitAmount !== undefined && data.creditAmount !== undefined) {
    const debit = parseFloat(data.debitAmount) || 0;
    const credit = parseFloat(data.creditAmount) || 0;

    if (debit > 0 && credit > 0) {
      errors.push('Transaction cannot have both debit and credit amounts');
    }

    if (debit === 0 && credit === 0) {
      errors.push('Transaction must have either debit or credit amount');
    }

    if (debit < 0 || credit < 0) {
      errors.push('Amounts cannot be negative');
    }

    if (debit > 999999999.99 || credit > 999999999.99) {
      errors.push('Amount cannot exceed 999,999,999.99');
    }
  }

  // Check date
  if (data.date !== undefined) {
    const date = new Date(data.date);
    if (isNaN(date.getTime())) {
      errors.push('Invalid date format');
    } else {
      const now = new Date();
      const oneYearAgo = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
      const oneYearFromNow = new Date(now.getFullYear() + 1, now.getMonth(), now.getDate());

      if (date < oneYearAgo || date > oneYearFromNow) {
        errors.push('Date must be within one year of current date');
      }
    }
  }

  // Check reference
  if (data.reference !== undefined && data.reference !== null) {
    if (typeof data.reference !== 'string') {
      errors.push('Reference must be a string');
    } else if (data.reference.length > 100) {
      errors.push('Reference cannot exceed 100 characters');
    }
  }

  return {
    isValid: errors.length === 0,
    errors
  };
};

// Debug logging utility
export const logTransactionOperation = (operation: 'edit' | 'delete', transactionId: string, data?: any, result?: any, error?: any) => {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    operation,
    transactionId,
    data,
    result,
    error: error ? {
      message: error.message,
      status: error.response?.status,
      data: error.response?.data
    } : null
  };

  console.group(`🔄 Transaction ${operation.toUpperCase()} - ${transactionId}`);
  
  if (data) {
  }
  
  if (result) {
  }
  
  if (error) {
    console.error('❌ Error:', logEntry.error);
  }
  
  console.groupEnd();

  // Store in localStorage for debugging (optional)
  try {
    const logs = JSON.parse(localStorage.getItem('transactionOperationLogs') || '[]');
    logs.push(logEntry);
    
    // Keep only last 50 logs
    if (logs.length > 50) {
      logs.splice(0, logs.length - 50);
    }
    
    localStorage.setItem('transactionOperationLogs', JSON.stringify(logs));
  } catch (e) {
  }
};

// Get operation logs for debugging
export const getTransactionOperationLogs = () => {
  try {
    return JSON.parse(localStorage.getItem('transactionOperationLogs') || '[]');
  } catch (e) {
    return [];
  }
};

// Clear operation logs
export const clearTransactionOperationLogs = () => {
  try {
    localStorage.removeItem('transactionOperationLogs');
  } catch (e) {
  }
};