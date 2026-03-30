-- Migration: Add closing fields to anamath_entries table
-- Date: 2024
-- Description: Add isClosed, closedAt, and closedBy fields for anamath record closing functionality

DO $$
BEGIN
  -- Add is_closed column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'anamath_entries' AND column_name = 'is_closed'
  ) THEN
    ALTER TABLE anamath_entries ADD COLUMN is_closed BOOLEAN NOT NULL DEFAULT FALSE;
  END IF;

  -- Add closed_at column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'anamath_entries' AND column_name = 'closed_at'
  ) THEN
    ALTER TABLE anamath_entries ADD COLUMN closed_at TIMESTAMP NULL;
  END IF;

  -- Add closed_by column if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'anamath_entries' AND column_name = 'closed_by'
  ) THEN
    ALTER TABLE anamath_entries ADD COLUMN closed_by UUID NULL;
  END IF;
END $$;

-- Add foreign key constraint for closed_by if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'anamath_entries' 
    AND constraint_name = 'fk_anamath_closed_by'
  ) THEN
    ALTER TABLE anamath_entries
    ADD CONSTRAINT fk_anamath_closed_by 
    FOREIGN KEY (closed_by) REFERENCES users(id);
  END IF;
END $$;

-- Add index for better query performance on closed records if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'anamath_entries' AND indexname = 'idx_anamath_is_closed'
  ) THEN
    CREATE INDEX idx_anamath_is_closed ON anamath_entries(is_closed);
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes 
    WHERE tablename = 'anamath_entries' AND indexname = 'idx_anamath_closed_at'
  ) THEN
    CREATE INDEX idx_anamath_closed_at ON anamath_entries(closed_at);
  END IF;
END $$;

-- Add comments for documentation
COMMENT ON COLUMN anamath_entries.is_closed IS 'Indicates if the anamath record has been closed';
COMMENT ON COLUMN anamath_entries.closed_at IS 'Timestamp when the record was closed';
COMMENT ON COLUMN anamath_entries.closed_by IS 'User ID who closed the record';