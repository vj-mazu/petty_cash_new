-- Migration 005: Add sequential transaction_number to transactions
-- Adds a monotonic bigint column and backfills existing rows based on createdAt order.

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name='transactions' AND column_name='transaction_number'
  ) THEN
    ALTER TABLE transactions ADD COLUMN transaction_number BIGINT;
  END IF;
END $$;

-- Create a sequence if not exists for portability
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_class WHERE relkind='S' AND relname='transactions_transaction_number_seq') THEN
    CREATE SEQUENCE transactions_transaction_number_seq START 1;
  END IF;
END $$;

-- Backfill null transaction_number in createdAt chronological order
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY "createdAt", id) AS rn
  FROM transactions
  WHERE transaction_number IS NULL
)
UPDATE transactions t
SET transaction_number = o.rn
FROM ordered o
WHERE t.id = o.id;

-- Ensure future inserts auto-populate via trigger
CREATE OR REPLACE FUNCTION set_transaction_number()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.transaction_number IS NULL THEN
    NEW.transaction_number := nextval('transactions_transaction_number_seq');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_transaction_number ON transactions;
CREATE TRIGGER trg_set_transaction_number
BEFORE INSERT ON transactions
FOR EACH ROW EXECUTE FUNCTION set_transaction_number();

-- Add unique index for fast lookup / display ordering
CREATE UNIQUE INDEX IF NOT EXISTS idx_transactions_transaction_number ON transactions(transaction_number);
