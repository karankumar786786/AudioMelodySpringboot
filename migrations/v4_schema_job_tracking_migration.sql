-- Migration v4: Track song processing stages, webhook execution timestamps, durations, and attempts

-- 1. Add current_stage to jobs
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS current_stage VARCHAR(64) DEFAULT 'QUEUED';

-- 2. Add stage transition timestamps
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transcoding_started_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transcoded_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommendation_saved_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_saved_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS completed_at TIMESTAMP;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failed_at TIMESTAMP;

-- 3. Add failure reason
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS failure_reason TEXT;

-- 4. Add stage duration in milliseconds for precise metrics
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS transcoding_duration_ms BIGINT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS recommendation_duration_ms BIGINT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS search_duration_ms BIGINT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS finalize_duration_ms BIGINT;
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS total_duration_ms BIGINT;

-- 5. Backfill existing records
UPDATE jobs 
SET current_stage = CASE 
    WHEN status = 'COMPLETED' THEN 'COMPLETED'
    WHEN status = 'FAILED' THEN 'FAILED'
    WHEN status = 'PROCESSING' THEN 'TRANSCODING'
    ELSE 'QUEUED'
END,
created_at = COALESCE(created_at, NOW())
WHERE current_stage IS NULL OR created_at IS NULL;

-- 6. Indexes for real-time tracking queries
CREATE INDEX IF NOT EXISTS idx_jobs_current_stage ON jobs (current_stage);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs (created_at);
