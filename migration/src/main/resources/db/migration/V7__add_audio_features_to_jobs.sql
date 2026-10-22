-- ==============================================================================
-- Flyway Database Migration: V7__add_audio_features_to_jobs.sql
-- Add Spotify-like audio features (tempo, danceability, energy, valence, etc.)
-- to the jobs table for audio analysis persistence and Recombee recommendations.
-- Note: Stored strictly in jobs table (not in songs table).
-- ==============================================================================

ALTER TABLE jobs ADD COLUMN IF NOT EXISTS tempo DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS danceability DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS energy DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS valence DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS acousticness DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS instrumentalness DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS liveness DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS speechiness DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS loudness DOUBLE PRECISION;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS key INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS mode INTEGER;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS audio_features JSONB;
