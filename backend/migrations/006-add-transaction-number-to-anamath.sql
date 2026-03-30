-- Add transaction_number column to anamath_entries table
-- This migration adds transaction numbering to anamath entries for better tracking

DO $$ 
BEGIN
  -- Add transaction_number column if it doesn't exist
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'anamath_entries' AND column_name = 'transaction_number') THEN
    ALTER TABLE anamath_entries ADD COLUMN transaction_number BIGINT UNIQUE;
    
    -- Create index for better performance
    CREATE INDEX IF NOT EXISTS idx_anamath_entries_transaction_number ON anamath_entries(transaction_number);
    
    -- Add comment for documentation
    COMMENT ON COLUMN anamath_entries.transaction_number IS 'Sequential transaction number shared with transactions table for unified tracking';
  END IF;
END $$;