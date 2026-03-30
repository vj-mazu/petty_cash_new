-- Migration 014: Add missing columns and enum values
-- These were previously auto-created by sequelize.sync({ alter: true })
-- but should be tracked as explicit migrations for production safety.

-- =============================================
-- 1. Add 'manager' enum value to user roles
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid
    WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'manager'
  ) THEN
    ALTER TYPE "enum_users_role" ADD VALUE 'manager';
  END IF;
END $$;

-- =============================================
-- 2. Add 'status' enum type for transactions
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_transactions_status') THEN
    CREATE TYPE "enum_transactions_status" AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Add status column to transactions table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'transactions' AND column_name = 'status'
  ) THEN
    ALTER TABLE transactions ADD COLUMN status "enum_transactions_status" NOT NULL DEFAULT 'approved';
  END IF;
END $$;

-- =============================================
-- 3. Add 'status' enum type for anamath_entries
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'enum_anamath_entries_status') THEN
    CREATE TYPE "enum_anamath_entries_status" AS ENUM ('pending', 'approved', 'rejected');
  END IF;
END $$;

-- Add status column to anamath_entries table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'anamath_entries' AND column_name = 'status'
  ) THEN
    ALTER TABLE anamath_entries ADD COLUMN status "enum_anamath_entries_status" NOT NULL DEFAULT 'approved';
  END IF;
END $$;

-- =============================================
-- 4. Add is_manually_set to opening_balances
-- =============================================
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'opening_balances' AND column_name = 'is_manually_set'
  ) THEN
    ALTER TABLE opening_balances ADD COLUMN is_manually_set BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- =============================================
-- 5. Add missing user indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_users_created_by ON users("createdBy");
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_is_active ON users("isActive");

-- =============================================
-- 6. Add missing transaction composite indexes
-- =============================================
CREATE INDEX IF NOT EXISTS idx_transactions_main_query ON transactions(is_suspended, date, "createdAt");
CREATE INDEX IF NOT EXISTS idx_transactions_cursor_page ON transactions(date, id);

-- Update statistics
ANALYZE transactions;
ANALYZE anamath_entries;
ANALYZE opening_balances;
ANALYZE users;
