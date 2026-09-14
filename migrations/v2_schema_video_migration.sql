-- Migration: Support video keys on songs and playlists, and remove banner images from artists and playlists

-- 1. Add video_key to songs
ALTER TABLE songs ADD COLUMN IF NOT EXISTS video_key VARCHAR(255);

-- 2. Add video_key to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS video_key VARCHAR(255);

-- 3. Add video_key to playlists
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS video_key VARCHAR(255);

-- 4. Drop deprecated banner_image_key columns
ALTER TABLE playlists DROP COLUMN IF EXISTS banner_image_key;
ALTER TABLE artists DROP COLUMN IF EXISTS banner_image_key;
