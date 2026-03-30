-- Migration: Add suspend functionality to transactions
-- Date: September 20, 2025
-- Description: Add suspend fields to transactions table to allow excluding transactions from calculations

-- Add suspend fields to transactions table (with IF NOT EXISTS handling)
DO $$ 
BEGIN
    -- Add is_suspended column if it doesn't exist
    BEGIN
        ALTER TABLE transactions ADD COLUMN is_suspended BOOLEAN NOT NULL DEFAULT FALSE;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    -- Add suspended_at column if it doesn't exist
    BEGIN
        ALTER TABLE transactions ADD COLUMN suspended_at TIMESTAMP NULL;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    -- Add suspended_by column if it doesn't exist
    BEGIN
        ALTER TABLE transactions ADD COLUMN suspended_by UUID NULL REFERENCES users(id);
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
    
    -- Add remarks column if it doesn't exist
    BEGIN
        ALTER TABLE transactions ADD COLUMN remarks TEXT NULL;
    EXCEPTION
        WHEN duplicate_column THEN NULL;
    END;
END $$;

-- Add index for suspended transactions if it doesn't exist
DO $$ 
BEGIN
    BEGIN
        CREATE INDEX idx_transactions_suspended ON transactions(is_suspended);
    EXCEPTION
        WHEN duplicate_table THEN NULL;
    END;
END $$;