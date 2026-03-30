-- Performance optimization indexes for large datasets
-- Migration 010: Add strategic indexes for better query performance

-- Index for transactions date column (most commonly filtered field)
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

-- Composite index for ledgerId and date (common query pattern)
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_date ON transactions("ledgerId", date DESC);

-- Index for debitAmount (for filtering debit transactions)
CREATE INDEX IF NOT EXISTS idx_transactions_debit_amount ON transactions("debitAmount") WHERE "debitAmount" > 0;

-- Index for creditAmount (for filtering credit transactions)  
CREATE INDEX IF NOT EXISTS idx_transactions_credit_amount ON transactions("creditAmount") WHERE "creditAmount" > 0;

-- Index for createdAt (for ordering by creation time)
CREATE INDEX IF NOT EXISTS idx_transactions_created_at ON transactions("createdAt" DESC);

-- Composite index for ledgerId and createdAt (for ledger-specific recent transactions)
CREATE INDEX IF NOT EXISTS idx_transactions_ledger_created ON transactions("ledgerId", "createdAt" DESC);

-- Index for transaction_number (for reference lookups)
CREATE INDEX IF NOT EXISTS idx_transactions_number ON transactions(transaction_number);

-- Index for reference_number (for reference lookups)
CREATE INDEX IF NOT EXISTS idx_transactions_reference_number ON transactions(reference_number);

-- Index for ledgers isActive (for filtering active ledgers)
CREATE INDEX IF NOT EXISTS idx_ledgers_is_active ON ledgers("isActive");

-- Index for suspended transactions (for filtering non-suspended transactions)
CREATE INDEX IF NOT EXISTS idx_transactions_is_suspended ON transactions(is_suspended);

-- Analyze tables to update statistics for better query planning
ANALYZE transactions;
ANALYZE ledgers;
ANALYZE users;