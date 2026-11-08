-- ==============================================================================
-- Flyway Database Migration: V12__add_composite_index_user_history.sql
-- Optimizes findRecentByUser query and user history deduplication
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_user_history_user_song_listened 
ON user_history(user_id, song_id, listened_at DESC);

