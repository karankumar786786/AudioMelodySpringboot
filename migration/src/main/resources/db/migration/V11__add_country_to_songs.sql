-- ==============================================================================
-- Flyway Database Migration: V11__add_country_to_songs.sql
-- Add country column to songs and jobs tables with default 'India'
-- ==============================================================================

-- 1. Add country column to songs table
ALTER TABLE songs
ADD COLUMN IF NOT EXISTS country VARCHAR(255) DEFAULT 'India';

-- 2. Add country column to ingestion jobs table
ALTER TABLE jobs
ADD COLUMN IF NOT EXISTS country VARCHAR(255) DEFAULT 'India';

-- 3. Backfill any existing records
UPDATE songs SET country = 'India' WHERE country IS NULL OR country = '';
UPDATE jobs SET country = 'India' WHERE country IS NULL OR country = '';

-- 4. Create index on country for fast filtering and regional discovery
CREATE INDEX IF NOT EXISTS idx_songs_country ON songs(country);

