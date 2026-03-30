-- backend/migrations/012-add-user-management-hierarchy.sql
-- NEW FILE: Add managedBy column to users table for manager-staff hierarchy
-- When a manager creates staff, the staff's managedBy points to that manager
-- When admin disables a manager, all staff under that manager are also disabled
ALTER TABLE users ADD COLUMN IF NOT EXISTS "managedBy" UUID REFERENCES users(id) ON DELETE SET NULL;

-- Index for efficient staff lookup by manager
CREATE INDEX IF NOT EXISTS idx_users_managed_by ON users("managedBy");
