-- Migration to update user roles system
-- Add new roles: admin1, admin2, admin3, staff

-- First, add the new enum values to the role type if they don't already exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'admin1'
  ) THEN
    ALTER TYPE "enum_users_role" ADD VALUE 'admin1';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'admin2'
  ) THEN
    ALTER TYPE "enum_users_role" ADD VALUE 'admin2';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'admin3'
  ) THEN
    ALTER TYPE "enum_users_role" ADD VALUE 'admin3';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum e JOIN pg_type t ON e.enumtypid = t.oid 
    WHERE t.typname = 'enum_users_role' AND e.enumlabel = 'staff'
  ) THEN
    ALTER TYPE "enum_users_role" ADD VALUE 'staff';
  END IF;
END $$;

-- Update existing admin users to admin1 (highest level)
-- We need to be careful here because the 'admin' value may no longer be valid
-- Let's use a more defensive approach
-- This block is removed as 'admin' is not a valid enum value.

