-- Migration to add 'owner' role to the user role enum
-- Owner: Can approve all transaction types, create managers/staff, but cannot create admin

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'owner'
  ) THEN
    ALTER TYPE "enum_users_role" ADD VALUE 'owner';
  END IF;
END $$;
