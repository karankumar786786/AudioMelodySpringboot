-- ==============================================================================
-- Flyway Database Migration: V15__add_audio_features_to_songs.sql
-- Copy the four ranking-relevant audio features (see V7) onto songs so the core
-- API can score recommendations and build mood radio without a Recombee lookup.
-- The full feature set stays on jobs; songs only carry what ranking reads.
-- ==============================================================================

-- 1. Nullable feature columns (unknown until the audio pipeline has analysed the song)
ALTER TABLE songs ADD COLUMN IF NOT EXISTS tempo DOUBLE PRECISION;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS energy DOUBLE PRECISION;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS valence DOUBLE PRECISION;
ALTER TABLE songs ADD COLUMN IF NOT EXISTS danceability DOUBLE PRECISION;

-- 2. Backfill from jobs. A song can have several jobs (the original upload plus audio/video
--    reprocesses, all sharing jobs.song_id); take the most recent job that has features,
--    since an audio reprocess replaces the audio the original features describe.
--    Video-only reprocesses carry no features and are skipped by the NULL filter.
UPDATE songs s
SET tempo        = j.tempo,
    energy       = j.energy,
    valence      = j.valence,
    danceability = j.danceability
FROM (
    SELECT DISTINCT ON (song_id) song_id, tempo, energy, valence, danceability
    FROM jobs
    WHERE tempo IS NOT NULL OR energy IS NOT NULL OR valence IS NOT NULL OR danceability IS NOT NULL
    ORDER BY song_id, created_at DESC NULLS LAST
) j
WHERE j.song_id = s.id
  AND s.tempo IS NULL AND s.energy IS NULL AND s.valence IS NULL AND s.danceability IS NULL;

-- 3. Mood radio filters active songs by energy and valence ranges
CREATE INDEX IF NOT EXISTS idx_songs_active_energy_valence
    ON songs (energy, valence)
    WHERE status = 'ACTIVE' AND energy IS NOT NULL;
