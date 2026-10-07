-- ==============================================================================
-- Flyway Database Migration: V1__initial_schema.sql
-- Unified Database Schema for One Melody (Core Engine, Admin Service & Workers)
-- ==============================================================================

-- 1. Users (Consumer Application Users)
CREATE TABLE IF NOT EXISTS users (
    id VARCHAR(255) PRIMARY KEY,
    user_name VARCHAR(255),
    email VARCHAR(255) NOT NULL UNIQUE,
    status VARCHAR(255) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_status ON users(status);

-- 2. Admin Users (Dedicated Administration Plane Credentials)
CREATE TABLE IF NOT EXISTS admin_users (
    id VARCHAR(255) PRIMARY KEY,
    email VARCHAR(255) NOT NULL UNIQUE,
    name VARCHAR(255),
    role VARCHAR(255) NOT NULL DEFAULT 'ADMIN',
    status VARCHAR(255) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_status ON admin_users(status);

-- 3. Artists
CREATE TABLE IF NOT EXISTS artists (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    about VARCHAR(255),
    dob TIMESTAMP WITHOUT TIME ZONE,
    cover_image_key VARCHAR(255),
    status VARCHAR(255) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_artists_name ON artists(name);
CREATE INDEX IF NOT EXISTS idx_artists_status ON artists(status);

-- 4. Ingestion / Transcoding Jobs
CREATE TABLE IF NOT EXISTS jobs (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    duration INTEGER,
    temp_song_key VARCHAR(255),
    temp_video_key VARCHAR(255),
    song_key VARCHAR(255),
    full_video_key VARCHAR(255),
    image_key VARCHAR(255) NOT NULL,
    video_key VARCHAR(255),
    clip_start_sec INTEGER,
    clip_end_sec INTEGER,
    preview_start_time INTEGER,
    preview_end_time INTEGER,
    language VARCHAR(255),
    genre VARCHAR(255),
    lrclib_id VARCHAR(255),
    song_id VARCHAR(255) NOT NULL,
    transcoding_id VARCHAR(255),
    transcoding_attempt INTEGER DEFAULT 0,
    transcoded BOOLEAN DEFAULT FALSE,
    saved_in_search BOOLEAN DEFAULT FALSE,
    saved_in_recommendation BOOLEAN DEFAULT FALSE,
    is_video_reprocess BOOLEAN NOT NULL DEFAULT FALSE,
    is_audio_reprocess BOOLEAN DEFAULT FALSE,
    status VARCHAR(255) NOT NULL DEFAULT 'QUEUED',
    current_stage VARCHAR(255) NOT NULL DEFAULT 'QUEUED',
    transcoding_started_at TIMESTAMP WITHOUT TIME ZONE,
    transcoded_at TIMESTAMP WITHOUT TIME ZONE,
    recommendation_saved_at TIMESTAMP WITHOUT TIME ZONE,
    search_saved_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    failed_at TIMESTAMP WITHOUT TIME ZONE,
    failure_reason TEXT,
    transcoding_duration_ms BIGINT,
    recommendation_duration_ms BIGINT,
    search_duration_ms BIGINT,
    finalize_duration_ms BIGINT,
    total_duration_ms BIGINT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
CREATE INDEX IF NOT EXISTS idx_jobs_song_id ON jobs(song_id);
CREATE INDEX IF NOT EXISTS idx_jobs_current_stage ON jobs(current_stage);
CREATE INDEX IF NOT EXISTS idx_jobs_created_at ON jobs(created_at);

-- 5. Songs
CREATE TABLE IF NOT EXISTS songs (
    id VARCHAR(255) PRIMARY KEY,
    title VARCHAR(255) NOT NULL,
    artist_name VARCHAR(255) NOT NULL,
    duration INTEGER NOT NULL,
    song_key VARCHAR(255) NOT NULL,
    image_key VARCHAR(255) NOT NULL,
    video_key VARCHAR(255),
    full_video_key VARCHAR(255),
    preview_start_time INTEGER,
    preview_end_time INTEGER,
    is_featured BOOLEAN NOT NULL DEFAULT FALSE,
    language VARCHAR(255) NOT NULL,
    genre VARCHAR(255),
    lrclib_id VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'ACTIVE',
    job_id VARCHAR(255) NOT NULL,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_songs_artist_name ON songs(artist_name);
CREATE INDEX IF NOT EXISTS idx_songs_status ON songs(status);
CREATE INDEX IF NOT EXISTS idx_songs_is_featured ON songs(is_featured);
CREATE INDEX IF NOT EXISTS idx_songs_language ON songs(language);
CREATE INDEX IF NOT EXISTS idx_songs_job_id ON songs(job_id);

-- 6. Playlists (System & Curated Playlists)
CREATE TABLE IF NOT EXISTS playlists (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description VARCHAR(255),
    cover_image_key VARCHAR(255) NOT NULL,
    video_key VARCHAR(255),
    status VARCHAR(255) NOT NULL DEFAULT 'ACTIVE',
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_playlists_status ON playlists(status);

-- 7. Playlist Songs Join Table
CREATE TABLE IF NOT EXISTS playlist_songs (
    playlist_id VARCHAR(255) NOT NULL REFERENCES playlists(id) ON DELETE CASCADE,
    song_id VARCHAR(255) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    PRIMARY KEY (playlist_id, song_id)
);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_playlist_id ON playlist_songs(playlist_id);
CREATE INDEX IF NOT EXISTS idx_playlist_songs_song_id ON playlist_songs(song_id);

-- 8. User Playlists (Personal Playlists Created by Users)
CREATE TABLE IF NOT EXISTS user_playlists (
    id VARCHAR(255) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    status VARCHAR(255) NOT NULL DEFAULT 'ACTIVE',
    privacy VARCHAR(255) DEFAULT 'PRIVATE',
    share_token VARCHAR(255),
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_user_playlists_user_id ON user_playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_playlists_share_token ON user_playlists(share_token);

-- 9. User Playlist Songs Join Table
CREATE TABLE IF NOT EXISTS user_playlist_songs (
    user_playlist_id VARCHAR(255) NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
    song_id VARCHAR(255) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    PRIMARY KEY (user_playlist_id, song_id)
);
CREATE INDEX IF NOT EXISTS idx_user_playlist_songs_user_pl_id ON user_playlist_songs(user_playlist_id);
CREATE INDEX IF NOT EXISTS idx_user_playlist_songs_song_id ON user_playlist_songs(song_id);

-- 10. User Saved Playlists (Library Bookmarks)
CREATE TABLE IF NOT EXISTS user_saved_playlists (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    playlist_id VARCHAR(255) NOT NULL REFERENCES user_playlists(id) ON DELETE CASCADE,
    saved_at TIMESTAMP WITHOUT TIME ZONE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uk_user_saved_playlist UNIQUE (user_id, playlist_id)
);
CREATE INDEX IF NOT EXISTS idx_user_saved_playlists_user_id ON user_saved_playlists(user_id);
CREATE INDEX IF NOT EXISTS idx_user_saved_playlists_playlist_id ON user_saved_playlists(playlist_id);

-- 11. User Favourite Songs
CREATE TABLE IF NOT EXISTS user_favourite_songs (
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id VARCHAR(255) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    PRIMARY KEY (user_id, song_id)
);
CREATE INDEX IF NOT EXISTS idx_user_favourite_songs_user_id ON user_favourite_songs(user_id);
CREATE INDEX IF NOT EXISTS idx_user_favourite_songs_song_id ON user_favourite_songs(song_id);

-- 12. User Listening History
CREATE TABLE IF NOT EXISTS user_history (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id VARCHAR(255) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    part INTEGER NOT NULL,
    listened_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_history_user_id ON user_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_history_song_id ON user_history(song_id);
CREATE INDEX IF NOT EXISTS idx_user_history_listened_at ON user_history(listened_at);

-- 13. User Search History
CREATE TABLE IF NOT EXISTS user_search_history (
    id VARCHAR(255) PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    entity_type VARCHAR(255) NOT NULL,
    song_id VARCHAR(255) REFERENCES songs(id) ON DELETE CASCADE,
    artist_id VARCHAR(255) REFERENCES artists(id) ON DELETE CASCADE,
    playlist_id VARCHAR(255) REFERENCES playlists(id) ON DELETE CASCADE,
    user_playlist_id VARCHAR(255) REFERENCES user_playlists(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_user_search_history_user_id ON user_search_history(user_id);
CREATE INDEX IF NOT EXISTS idx_user_search_history_created_at ON user_search_history(created_at);

-- 14. Cascade Delete Jobs
CREATE TABLE IF NOT EXISTS delete_jobs (
    id VARCHAR(255) PRIMARY KEY,
    entity_type VARCHAR(255) NOT NULL,
    entity_id VARCHAR(255) NOT NULL,
    entity_title VARCHAR(255),
    song_key VARCHAR(255),
    image_key VARCHAR(255),
    cover_image_key VARCHAR(255),
    video_key VARCHAR(255),
    full_video_key VARCHAR(255),
    status VARCHAR(255) NOT NULL DEFAULT 'PENDING',
    current_stage VARCHAR(255) NOT NULL DEFAULT 'QUEUED',
    attempt_count INTEGER NOT NULL DEFAULT 0,
    max_attempts INTEGER NOT NULL DEFAULT 3,
    failure_reason TEXT,
    started_at TIMESTAMP WITHOUT TIME ZONE,
    search_deleted_at TIMESTAMP WITHOUT TIME ZONE,
    recommendation_deleted_at TIMESTAMP WITHOUT TIME ZONE,
    imagekit_deleted_at TIMESTAMP WITHOUT TIME ZONE,
    s3_deleted_at TIMESTAMP WITHOUT TIME ZONE,
    completed_at TIMESTAMP WITHOUT TIME ZONE,
    failed_at TIMESTAMP WITHOUT TIME ZONE,
    search_duration_ms BIGINT,
    recommendation_duration_ms BIGINT,
    imagekit_duration_ms BIGINT,
    s3_duration_ms BIGINT,
    finalize_duration_ms BIGINT,
    total_duration_ms BIGINT,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_delete_jobs_status ON delete_jobs(status);
CREATE INDEX IF NOT EXISTS idx_delete_jobs_current_stage ON delete_jobs(current_stage);
CREATE INDEX IF NOT EXISTS idx_delete_jobs_entity ON delete_jobs(entity_type, entity_id);

-- 15. Pagination Metadata (Fast Pre-Calculated Entity Counters)
CREATE TABLE IF NOT EXISTS pagination_metadata (
    id VARCHAR(255) PRIMARY KEY,
    entity_name VARCHAR(255) NOT NULL UNIQUE,
    total_count BIGINT NOT NULL DEFAULT 0,
    active_count BIGINT NOT NULL DEFAULT 0,
    blocked_count BIGINT NOT NULL DEFAULT 0,
    deleted_count BIGINT NOT NULL DEFAULT 0
);

-- Seed Default Pagination Metadata Rows
INSERT INTO pagination_metadata (id, entity_name, total_count, active_count, blocked_count, deleted_count)
VALUES
    ('UsersEntity', 'UsersEntity', 0, 0, 0, 0),
    ('ArtistsEntity', 'ArtistsEntity', 0, 0, 0, 0),
    ('PlaylistsEntity', 'PlaylistsEntity', 0, 0, 0, 0),
    ('SongsEntity', 'SongsEntity', 0, 0, 0, 0),
    ('JobsEntity', 'JobsEntity', 0, 0, 0, 0),
    ('DeleteJobsEntity', 'DeleteJobsEntity', 0, 0, 0, 0)
ON CONFLICT (entity_name) DO NOTHING;
