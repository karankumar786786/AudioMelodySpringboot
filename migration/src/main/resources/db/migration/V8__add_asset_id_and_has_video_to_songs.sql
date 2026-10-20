-- ==============================================================================
-- Flyway Database Migration: V8__add_asset_id_and_has_video_to_songs.sql
-- Add unified asset_id, has_video, and canvas timing columns to songs & jobs
-- Non-breaking migration maintaining full backward compatibility
-- ==============================================================================

-- 1. Update 'songs' table
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS asset_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS has_video BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS canvas_start_time INTEGER,
ADD COLUMN IF NOT EXISTS canvas_end_time INTEGER;

-- Backfill 'songs' data
UPDATE songs
SET 
    asset_id = COALESCE(NULLIF(asset_id, ''), id),
    has_video = (full_video_key IS NOT NULL AND TRIM(full_video_key) != ''),
    canvas_start_time = COALESCE(canvas_start_time, preview_start_time),
    canvas_end_time = COALESCE(canvas_end_time, preview_end_time)
WHERE asset_id IS NULL OR asset_id = '';

CREATE INDEX IF NOT EXISTS idx_songs_asset_id ON songs(asset_id);
CREATE INDEX IF NOT EXISTS idx_songs_has_video ON songs(has_video);

-- 2. Update 'jobs' table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS asset_id VARCHAR(255),
ADD COLUMN IF NOT EXISTS has_video BOOLEAN NOT NULL DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS canvas_start_time INTEGER,
ADD COLUMN IF NOT EXISTS canvas_end_time INTEGER;

-- Backfill 'jobs' data
UPDATE jobs
SET 
    asset_id = COALESCE(NULLIF(asset_id, ''), song_id),
    has_video = (full_video_key IS NOT NULL AND TRIM(full_video_key) != ''),
    canvas_start_time = COALESCE(canvas_start_time, preview_start_time),
    canvas_end_time = COALESCE(canvas_end_time, preview_end_time)
WHERE asset_id IS NULL OR asset_id = '';

CREATE INDEX IF NOT EXISTS idx_jobs_asset_id ON jobs(asset_id);
CREATE INDEX IF NOT EXISTS idx_jobs_has_video ON jobs(has_video);
