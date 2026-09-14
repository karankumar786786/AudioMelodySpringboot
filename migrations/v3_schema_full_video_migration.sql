-- Migration: Support full video streaming (HLS/DASH), video-only song creation with canvas clipping, and video re-processing

-- 1. Add full_video_key to songs
ALTER TABLE songs ADD COLUMN IF NOT EXISTS full_video_key VARCHAR(255);

-- 2. Add full video and clipping columns to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS full_video_key VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS temp_video_key VARCHAR(255);
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS clip_start_sec INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS clip_end_sec INTEGER;

-- 3. Make temp_song_key nullable in jobs (video-only song uploads do not have an initial audio track)
ALTER TABLE jobs ALTER COLUMN temp_song_key DROP NOT NULL;

-- 4. Add is_video_reprocess flag to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS is_video_reprocess BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Drop unique constraint on jobs(song_id) to allow reprocess jobs for existing songs
ALTER TABLE jobs DROP CONSTRAINT IF EXISTS ukc59qfqa9jg8w6vfktgk6txovn;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_jobs_song_id ON jobs (song_id);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs (status);
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs (status);
CREATE INDEX IF NOT EXISTS idx_songs_featured ON songs (is_featured);

