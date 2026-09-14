-- =====================================================================
-- Migration V5: Sync Jobs table with Songs entity
-- Clean up orphaned/stale jobs and ensure all existing songs have a
-- matching, fully synchronized, COMPLETED job entity.
-- =====================================================================

BEGIN;

-- 1. Remove orphaned jobs that do not correspond to any active song
DELETE FROM jobs
WHERE id NOT IN (
    SELECT job_id FROM songs WHERE job_id IS NOT NULL
);

-- 2. Insert any missing job rows for existing songs
INSERT INTO jobs (
    id,
    song_id,
    title,
    artist_name,
    duration,
    song_key,
    image_key,
    video_key,
    full_video_key,
    preview_start_time,
    preview_end_time,
    language,
    lrclib_id,
    status,
    current_stage,
    transcoded,
    saved_in_search,
    saved_in_recommendation,
    is_video_reprocess,
    transcoding_attempt,
    created_at,
    completed_at
)
SELECT 
    s.job_id,
    s.id,
    s.title,
    s.artist_name,
    s.duration,
    s.song_key,
    s.image_key,
    s.video_key,
    s.full_video_key,
    s.preview_start_time,
    s.preview_end_time,
    s.language,
    s.lrclib_id,
    'COMPLETED',
    'COMPLETED',
    TRUE,
    TRUE,
    TRUE,
    FALSE,
    1,
    COALESCE(s.created_at, NOW()),
    COALESCE(s.created_at, NOW())
FROM songs s
WHERE s.job_id NOT IN (SELECT id FROM jobs);

-- 3. Synchronize all attributes from songs to jobs for existing records
UPDATE jobs j
SET 
    song_id = s.id,
    title = s.title,
    artist_name = s.artist_name,
    duration = s.duration,
    song_key = s.song_key,
    image_key = s.image_key,
    video_key = s.video_key,
    full_video_key = s.full_video_key,
    preview_start_time = s.preview_start_time,
    preview_end_time = s.preview_end_time,
    language = s.language,
    lrclib_id = s.lrclib_id,
    status = 'COMPLETED',
    current_stage = 'COMPLETED',
    transcoded = TRUE,
    saved_in_search = TRUE,
    saved_in_recommendation = TRUE,
    is_video_reprocess = FALSE,
    transcoding_attempt = COALESCE(j.transcoding_attempt, 1),
    created_at = COALESCE(j.created_at, s.created_at, NOW()),
    completed_at = COALESCE(j.completed_at, s.created_at, NOW()),
    transcoding_started_at = COALESCE(j.transcoding_started_at, j.created_at, s.created_at),
    transcoded_at = COALESCE(j.transcoded_at, j.created_at, s.created_at),
    recommendation_saved_at = COALESCE(j.recommendation_saved_at, j.created_at, s.created_at),
    search_saved_at = COALESCE(j.search_saved_at, j.created_at, s.created_at),
    failure_reason = NULL
FROM songs s
WHERE j.id = s.job_id;

COMMIT;
