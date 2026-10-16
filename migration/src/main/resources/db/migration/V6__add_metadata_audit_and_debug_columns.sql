-- ==============================================================================
-- Flyway Database Migration: V6__add_metadata_audit_and_debug_columns.sql
-- Add updated_at timestamp and soft_deleted_count to pagination_metadata
-- Add follow_event to artist_follow_events and id to artist_metadata for full compatibility
-- ==============================================================================

-- 1. Pagination Metadata: Add updated_at for tracking and soft_deleted_count for audit
ALTER TABLE pagination_metadata
ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE pagination_metadata
ADD COLUMN IF NOT EXISTS soft_deleted_count BIGINT NOT NULL DEFAULT 0;

UPDATE pagination_metadata
SET soft_deleted_count = deleted_count
WHERE soft_deleted_count = 0 AND deleted_count > 0;

-- 2. Artist Follow Events: Add follow_event column synced with event_type
ALTER TABLE artist_follow_events
ADD COLUMN IF NOT EXISTS follow_event VARCHAR(50);

UPDATE artist_follow_events
SET follow_event = event_type
WHERE follow_event IS NULL;

-- 3. Artist Metadata: Add id column synced with artist_id
ALTER TABLE artist_metadata
ADD COLUMN IF NOT EXISTS id VARCHAR(255);

UPDATE artist_metadata
SET id = artist_id
WHERE id IS NULL;
