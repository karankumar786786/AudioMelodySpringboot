-- ==============================================================================
-- Migration V2: Add total_songs counter column to playlists & user_playlists
-- Avoids runtime COUNT(*) joins when querying playlists
-- ==============================================================================

-- 1. Add total_songs column to playlists (System / Curated Playlists)
ALTER TABLE playlists ADD COLUMN IF NOT EXISTS total_songs INT NOT NULL DEFAULT 0;

-- 2. Populate initial counts from playlist_songs join table
UPDATE playlists p
SET total_songs = COALESCE((
    SELECT COUNT(*)
    FROM playlist_songs ps
    WHERE ps.playlist_id = p.id
), 0);

-- 3. Add total_songs column to user_playlists (Personal User Playlists)
ALTER TABLE user_playlists ADD COLUMN IF NOT EXISTS total_songs INT NOT NULL DEFAULT 0;

-- 4. Populate initial counts from user_playlist_songs join table
UPDATE user_playlists up
SET total_songs = COALESCE((
    SELECT COUNT(*)
    FROM user_playlist_songs ups
    WHERE ups.user_playlist_id = up.id
), 0);
