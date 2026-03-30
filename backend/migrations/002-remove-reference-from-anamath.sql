-- Migration to remove reference_number from anamath_entries
ALTER TABLE anamath_entries DROP COLUMN IF EXISTS reference_number;
