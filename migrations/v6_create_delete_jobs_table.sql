-- Migration v6: Create dedicated delete_jobs table for tracking cascade delete progress, metrics, and failures

CREATE TABLE IF NOT EXISTS delete_jobs (
    id VARCHAR(64) PRIMARY KEY,
    entity_type VARCHAR(32) NOT NULL,
    entity_id VARCHAR(64) NOT NULL,
    entity_title VARCHAR(255),
    song_key VARCHAR(255),
    image_key VARCHAR(255),
    cover_image_key VARCHAR(255),
    video_key VARCHAR(255),
    full_video_key VARCHAR(255),
    status VARCHAR(32) NOT NULL DEFAULT 'PENDING',
    current_stage VARCHAR(32) NOT NULL DEFAULT 'QUEUED',
    attempt_count INT NOT NULL DEFAULT 0,
    max_attempts INT NOT NULL DEFAULT 3,
    failure_reason TEXT,
    started_at TIMESTAMP,
    search_deleted_at TIMESTAMP,
    recommendation_deleted_at TIMESTAMP,
    imagekit_deleted_at TIMESTAMP,
    s3_deleted_at TIMESTAMP,
    completed_at TIMESTAMP,
    failed_at TIMESTAMP,
    search_duration_ms BIGINT,
    recommendation_duration_ms BIGINT,
    imagekit_duration_ms BIGINT,
    s3_duration_ms BIGINT,
    finalize_duration_ms BIGINT,
    total_duration_ms BIGINT,
    created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_delete_jobs_status ON delete_jobs (status);
CREATE INDEX IF NOT EXISTS idx_delete_jobs_current_stage ON delete_jobs (current_stage);
CREATE INDEX IF NOT EXISTS idx_delete_jobs_created_at ON delete_jobs (created_at);
CREATE INDEX IF NOT EXISTS idx_delete_jobs_entity ON delete_jobs (entity_type, entity_id);
