-- Migration to drop unique constraint on reference_number in anamath_entries table
DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conrelid = 'anamath_entries'::regclass
      AND contype = 'u'
      AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'anamath_entries'::regclass AND attname = 'reference_number')
  ) THEN
    EXECUTE 'ALTER TABLE anamath_entries DROP CONSTRAINT ' || (
      SELECT conname
      FROM pg_constraint
      WHERE conrelid = 'anamath_entries'::regclass
        AND contype = 'u'
        AND conkey = (SELECT array_agg(attnum) FROM pg_attribute WHERE attrelid = 'anamath_entries'::regclass AND attname = 'reference_number')
    );
  END IF;
END
$$;

-- Ensure the column is nullable (if it wasn't already from previous migration)
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'anamath_entries' AND column_name = 'reference_number') THEN
    ALTER TABLE anamath_entries ALTER COLUMN reference_number DROP NOT NULL;
  END IF;
END
$$;