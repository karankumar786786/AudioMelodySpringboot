-- ==============================================================================
-- Migration V3: Add album column to songs and jobs tables
-- Allows songs to have album attribution and enables search by album name
-- ==============================================================================

-- 1. Add album column to songs table
ALTER TABLE songs ADD COLUMN IF NOT EXISTS album VARCHAR(255);

-- 2. Add album column to ingestion jobs table (retains album metadata during audio pipeline)
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS album VARCHAR(255);

-- 3. Create index for fast lookups and text matching by album
CREATE INDEX IF NOT EXISTS idx_songs_album ON songs(album);
