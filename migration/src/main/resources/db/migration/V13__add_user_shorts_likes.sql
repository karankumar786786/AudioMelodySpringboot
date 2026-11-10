-- ==============================================================================
-- Flyway Database Migration: V13__add_user_shorts_likes.sql
-- Dedicated interaction storage for Canvas Shorts likes separate from favourites
-- ==============================================================================

CREATE TABLE IF NOT EXISTS user_shorts_likes (
    id BIGSERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    song_id VARCHAR(255) NOT NULL REFERENCES songs(id) ON DELETE CASCADE,
    created_at TIMESTAMP WITHOUT TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT uk_user_shorts_like UNIQUE (user_id, song_id)
);

CREATE INDEX IF NOT EXISTS idx_shorts_like_user ON user_shorts_likes(user_id);
CREATE INDEX IF NOT EXISTS idx_shorts_like_song ON user_shorts_likes(song_id);
