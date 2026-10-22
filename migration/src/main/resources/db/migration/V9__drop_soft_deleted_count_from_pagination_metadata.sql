-- ==============================================================================
-- Flyway Database Migration: V9__drop_soft_deleted_count_from_pagination_metadata.sql
-- Clean up unused redundant column:
-- Drop 'soft_deleted_count' from pagination_metadata (deleted_count is the canonical column)
-- ==============================================================================

ALTER TABLE pagination_metadata DROP COLUMN IF EXISTS soft_deleted_count;
