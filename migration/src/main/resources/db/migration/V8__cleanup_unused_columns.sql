-- ==============================================================================
-- Flyway Database Migration: V8__cleanup_unused_columns.sql
-- Clean up unused and redundant columns across database tables:
-- 1. artist_metadata: Drop redundant duplicate column 'id' (artist_id is the canonical primary key)
-- 2. artist_follow_events: Drop redundant duplicate column 'follow_event' (event_type is the canonical column)
-- 3. user_playlists: Drop unused column 'status' (not modeled or used by the domain entity)
-- ==============================================================================

-- 1. Drop redundant id column from artist_metadata
ALTER TABLE artist_metadata DROP COLUMN IF EXISTS id;

-- 2. Drop redundant follow_event column from artist_follow_events
ALTER TABLE artist_follow_events DROP COLUMN IF EXISTS follow_event;

-- 3. Drop unused status column from user_playlists
ALTER TABLE user_playlists DROP COLUMN IF EXISTS status;
