-- Enhanced Transaction System Database Migration
-- This migration adds support for opening balances, anamath entries, and enhanced transactions

-- Create opening_balances table
CREATE TABLE IF NOT EXISTS opening_balances (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  ledger_id UUID NOT NULL REFERENCES ledgers(id) ON DELETE CASCADE,
  opening_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  closing_amount DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_credits DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  total_debits DECIMAL(15,2) NOT NULL DEFAULT 0.00,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  CONSTRAINT unique_date_ledger UNIQUE(date, ledger_id)
);

-- Create anamath_entries table
CREATE TABLE IF NOT EXISTS anamath_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  date DATE NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  remarks TEXT,
  ledger_id UUID REFERENCES ledgers(id) ON DELETE SET NULL,
  transaction_number BIGINT UNIQUE,
  created_by UUID NOT NULL REFERENCES users(id),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Add new columns to transactions table (one by one to avoid conflicts)
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'transaction_type') THEN
    ALTER TABLE transactions ADD COLUMN transaction_type VARCHAR(20) DEFAULT 'regular';
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'reference_number') THEN
    ALTER TABLE transactions ADD COLUMN reference_number VARCHAR(100);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'is_combined') THEN
    ALTER TABLE transactions ADD COLUMN is_combined BOOLEAN DEFAULT FALSE;
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'transactions' AND column_name = 'combined_with_anamath_id') THEN
    ALTER TABLE transactions ADD COLUMN combined_with_anamath_id UUID REFERENCES anamath_entries(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_opening_balances_date ON opening_balances(date);
CREATE INDEX IF NOT EXISTS idx_opening_balances_ledger_id ON opening_balances(ledger_id);
CREATE INDEX IF NOT EXISTS idx_opening_balances_date_ledger ON opening_balances(date, ledger_id);

CREATE INDEX IF NOT EXISTS idx_anamath_entries_date ON anamath_entries(date);
CREATE INDEX IF NOT EXISTS idx_anamath_entries_ledger_id ON anamath_entries(ledger_id);
CREATE INDEX IF NOT EXISTS idx_anamath_entries_transaction_number ON anamath_entries(transaction_number);

CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_transactions_reference ON transactions(reference_number);
CREATE INDEX IF NOT EXISTS idx_transactions_combined ON transactions(is_combined);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON transactions(date);

-- Add check constraints
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_opening_amount_positive') THEN
    ALTER TABLE opening_balances ADD CONSTRAINT chk_opening_amount_positive CHECK (opening_amount >= 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_closing_amount_positive') THEN
    ALTER TABLE opening_balances ADD CONSTRAINT chk_closing_amount_positive CHECK (closing_amount >= 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_total_credits_positive') THEN
    ALTER TABLE opening_balances ADD CONSTRAINT chk_total_credits_positive CHECK (total_credits >= 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_total_debits_positive') THEN
    ALTER TABLE opening_balances ADD CONSTRAINT chk_total_debits_positive CHECK (total_debits >= 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_anamath_amount_positive') THEN
    ALTER TABLE anamath_entries ADD CONSTRAINT chk_anamath_amount_positive CHECK (amount > 0);
  END IF;
  
  IF NOT EXISTS (SELECT 1 FROM information_schema.table_constraints WHERE constraint_name = 'chk_transaction_type') THEN
    ALTER TABLE transactions ADD CONSTRAINT chk_transaction_type CHECK (transaction_type IN ('regular', 'combined', 'anamath'));
  END IF;
END $$;

-- Create function to automatically update opening balances
CREATE OR REPLACE FUNCTION update_opening_balance()
RETURNS TRIGGER AS $$
BEGIN
  -- Update opening balance when transaction is inserted/updated/deleted
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    INSERT INTO opening_balances (id, date, ledger_id, opening_amount, closing_amount, total_credits, total_debits, created_by, created_at, updated_at)
VALUES (
  gen_random_uuid(), -- Explicitly generate UUID
  NEW.date,
  NEW."ledgerId",
  0, -- Will be calculated by application logic
  0, -- Will be calculated by application logic
  CASE WHEN NEW."creditAmount" > 0 THEN NEW."creditAmount" ELSE 0 END,
  CASE WHEN NEW."debitAmount" > 0 THEN NEW."debitAmount" ELSE 0 END,
  NEW."createdBy",
  NOW(), -- Explicitly set created_at
  NOW()  -- Explicitly set updated_at
)
    ON CONFLICT (date, ledger_id) 
    DO UPDATE SET
      total_credits = opening_balances.total_credits + 
        CASE WHEN NEW."creditAmount" > 0 THEN NEW."creditAmount" ELSE 0 END -
        CASE WHEN TG_OP = 'UPDATE' AND OLD."creditAmount" > 0 THEN OLD."creditAmount" ELSE 0 END,
      total_debits = opening_balances.total_debits + 
        CASE WHEN NEW."debitAmount" > 0 THEN NEW."debitAmount" ELSE 0 END -
        CASE WHEN TG_OP = 'UPDATE' AND OLD."debitAmount" > 0 THEN OLD."debitAmount" ELSE 0 END,
      updated_at = NOW();
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    UPDATE opening_balances 
    SET 
      total_credits = total_credits - CASE WHEN OLD."creditAmount" > 0 THEN OLD."creditAmount" ELSE 0 END,
      total_debits = total_debits - CASE WHEN OLD."debitAmount" > 0 THEN OLD."debitAmount" ELSE 0 END,
      updated_at = NOW()
    WHERE date = OLD.date AND ledger_id = OLD."ledgerId";
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for automatic opening balance updates
DROP TRIGGER IF EXISTS trigger_update_opening_balance ON transactions;
CREATE TRIGGER trigger_update_opening_balance
  AFTER INSERT OR UPDATE OR DELETE ON transactions
  FOR EACH ROW EXECUTE FUNCTION update_opening_balance();

-- Insert initial opening balances for existing ledgers
INSERT INTO opening_balances (date, ledger_id, opening_amount, closing_amount, total_credits, total_debits, created_by)
SELECT 
  CURRENT_DATE,
  l.id,
  COALESCE(l."currentBalance", 0),
  COALESCE(l."currentBalance", 0),
  0,
  0,
  l."createdBy"
FROM ledgers l
WHERE l."isActive" = true
ON CONFLICT (date, ledger_id) DO NOTHING;