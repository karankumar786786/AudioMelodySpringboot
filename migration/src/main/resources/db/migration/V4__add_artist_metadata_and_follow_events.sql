-- ==============================================================================
-- Flyway Database Migration: V4__add_artist_metadata_and_follow_events.sql
-- Artist Metadata (Follower Counter) & Follow Event Log (Audit Trail & Tracking)
-- ==============================================================================

-- 1. Artist Metadata Table (Stores aggregated follower counts and timestamps)
CREATE TABLE IF NOT EXISTS artist_metadata (
    artist_id VARCHAR(255) PRIMARY KEY,
    artist_name VARCHAR(255) NOT NULL,
    followers_count BIGINT NOT NULL DEFAULT 0,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_artist_metadata_name ON artist_metadata(artist_name);
CREATE INDEX IF NOT EXISTS idx_artist_metadata_followers ON artist_metadata(followers_count DESC);

-- 2. Artist Follow Events Table (Audit log for every follow / unfollow interaction)
CREATE TABLE IF NOT EXISTS artist_follow_events (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    artist_id VARCHAR(255) NOT NULL,
    event_type VARCHAR(50) NOT NULL, -- 'FOLLOW' or 'UNFOLLOW'
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_follow_events_user_artist ON artist_follow_events(user_id, artist_id);
CREATE INDEX IF NOT EXISTS idx_follow_events_artist ON artist_follow_events(artist_id);
CREATE INDEX IF NOT EXISTS idx_follow_events_created ON artist_follow_events(created_at DESC);
