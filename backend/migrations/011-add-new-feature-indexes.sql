-- Performance optimization indexes for Credit+Anamath and Opening Balance features
-- Migration 011: Minimal indexes for new features (other indexes created by ultra-performance-optimizer)

-- ============================================
-- INDEXES FOR CREDIT+ANAMATH SYNCHRONIZATION
-- ============================================

-- Index on combinedWithAnamathId for quick lookup of linked anamath records
-- Used when editing Credit+Anamath transactions to update linked anamath entry
CREATE INDEX IF NOT EXISTS idx_transactions_combined_anamath 
ON transactions("combined_with_anamath_id") 
WHERE "combined_with_anamath_id" IS NOT NULL;

-- Composite index for date and combinedWithAnamathId for date-change operations
-- Used when changing transaction dates to find and update anamath records
CREATE INDEX IF NOT EXISTS idx_transactions_date_combined 
ON transactions(date, "combined_with_anamath_id") 
WHERE "combined_with_anamath_id" IS NOT NULL;

-- NOTE: All other performance indexes are created automatically by:
-- - Migration 010 (base indexes)
-- - ultra-performance-optimizer.js (comprehensive performance indexes)
-- This migration only adds Credit+Anamath specific indexes that aren't covered elsewhere
