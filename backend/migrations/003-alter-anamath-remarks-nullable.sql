-- Migration to alter anamath_entries.remarks to be nullable
ALTER TABLE anamath_entries ALTER COLUMN remarks DROP NOT NULL;