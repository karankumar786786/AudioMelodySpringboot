-- ==============================================================================
-- Flyway Database Migration: V5__add_sessions_and_song_metadata.sql
-- User Sessions & Song Metadata Tables (Unified CoreEngine & Admin Sync)
-- ==============================================================================

-- 1. Sessions Table (Consumer / Multi-Device Auth Sessions)
CREATE TABLE IF NOT EXISTS sessions (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    device_id VARCHAR(255) NOT NULL,
    refresh_token VARCHAR(1000) NOT NULL,
    expires_at TIMESTAMP WITHOUT TIME ZONE NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_device_session UNIQUE (user_id, device_id)
);

CREATE INDEX IF NOT EXISTS idx_session_user_device ON sessions(user_id, device_id);
CREATE INDEX IF NOT EXISTS idx_session_refresh_token ON sessions(refresh_token);
CREATE INDEX IF NOT EXISTS idx_session_expires_at ON sessions(expires_at);

-- 2. Song Metadata Table (Streaming Counters & Real-Time Performance Analytics)
CREATE TABLE IF NOT EXISTS song_metadata (
    id VARCHAR(255) PRIMARY KEY,
    song_id VARCHAR(255) NOT NULL UNIQUE REFERENCES songs(id) ON DELETE CASCADE,
    total_streams BIGINT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_song_metadata_song_id ON song_metadata(song_id);
CREATE INDEX IF NOT EXISTS idx_song_metadata_total_streams ON song_metadata(total_streams DESC);

-- 3. Backfill Song Metadata for Any Pre-existing Songs
INSERT INTO song_metadata (id, song_id, total_streams, updated_at)
SELECT md5(random()::text || clock_timestamp()::text || s.id), s.id, 0, CURRENT_TIMESTAMP
FROM songs s
WHERE NOT EXISTS (
    SELECT 1 FROM song_metadata sm WHERE sm.song_id = s.id
)
ON CONFLICT (song_id) DO NOTHING;
