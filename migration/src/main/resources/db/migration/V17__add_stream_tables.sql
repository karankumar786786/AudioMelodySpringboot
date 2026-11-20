-- ==============================================================================
-- Flyway Database Migration: V17__add_stream_tables.sql
-- Tables written by the stream services (streams/). Additive only.
--
-- The stats tables hold totals computed by statsStreams from Kafka, written as
-- absolute values (never increments), so replaying a topic can't double-count.
-- They have no foreign keys to songs/artists: an event can arrive before the catalog
-- row exists, and readers join on songs, so rows for deleted songs are just ignored.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS song_stats (
    song_id             VARCHAR(255) PRIMARY KEY,
    plays               BIGINT NOT NULL DEFAULT 0,
    qualified_streams   BIGINT NOT NULL DEFAULT 0,
    listened_ratio_sum  DOUBLE PRECISION NOT NULL DEFAULT 0,
    skips               BIGINT NOT NULL DEFAULT 0,
    favourites          BIGINT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_song_stats_qualified ON song_stats (qualified_streams DESC);

CREATE TABLE IF NOT EXISTS song_daily_stats (
    song_id             VARCHAR(255) NOT NULL,
    day                 DATE NOT NULL,
    plays               BIGINT NOT NULL DEFAULT 0,
    qualified_streams   BIGINT NOT NULL DEFAULT 0,
    skips               BIGINT NOT NULL DEFAULT 0,
    updated_at          TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (song_id, day)
);
CREATE INDEX IF NOT EXISTS idx_song_daily_stats_day ON song_daily_stats (day DESC, qualified_streams DESC);

CREATE TABLE IF NOT EXISTS artist_stats (
    artist_id       VARCHAR(255) PRIMARY KEY,
    follows_gained  BIGINT NOT NULL DEFAULT 0,
    follows_lost    BIGINT NOT NULL DEFAULT 0,
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- One row per listening session (plays with gaps under 30 minutes), from activityStreams.
CREATE TABLE IF NOT EXISTS listening_sessions (
    id              VARCHAR(255) PRIMARY KEY,   -- user_id + session start, stable across replays
    user_id         VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    started_at      TIMESTAMP WITH TIME ZONE NOT NULL,
    ended_at        TIMESTAMP WITH TIME ZONE NOT NULL,
    plays           INTEGER NOT NULL DEFAULT 0,
    skips           INTEGER NOT NULL DEFAULT 0,
    listened_ms     BIGINT NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_listening_sessions_user ON listening_sessions (user_id, started_at DESC);
