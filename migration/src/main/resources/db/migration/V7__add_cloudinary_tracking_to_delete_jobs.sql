-- ==============================================================================
-- Flyway Database Migration: V7__add_cloudinary_tracking_to_delete_jobs.sql
-- Add cloudinary_deleted_at and cloudinary_duration_ms to delete_jobs for tracking
-- ==============================================================================

ALTER TABLE delete_jobs
ADD COLUMN IF NOT EXISTS cloudinary_deleted_at TIMESTAMP WITHOUT TIME ZONE;

ALTER TABLE delete_jobs
ADD COLUMN IF NOT EXISTS cloudinary_duration_ms BIGINT;
