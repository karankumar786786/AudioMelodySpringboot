-- ==============================================================================
-- Flyway Database Migration: V19__add_listen_analytics.sql
-- Small pre-computed song analytics for the admin dashboard, written by the
-- `analytics` profile in streams/ from Kafka (absolute totals, so replays can't
-- double-count). Raw listening events live in the S3 data lake (Parquet). Additive.
-- ==============================================================================

-- One row per second of a song: the listening heatmap and drop-off curve.
CREATE TABLE IF NOT EXISTS song_timeline (
    song_id     VARCHAR(255) NOT NULL,
    sec         INTEGER NOT NULL,
    listens     BIGINT NOT NULL DEFAULT 0,   -- plays that covered this second
    exits       BIGINT NOT NULL DEFAULT 0,   -- listens that stopped in this second
    skips       BIGINT NOT NULL DEFAULT 0,   -- skip button pressed in this second
    seeks_away  BIGINT NOT NULL DEFAULT 0,   -- seeks that left this second
    seeks_into  BIGINT NOT NULL DEFAULT 0,   -- seeks that landed in this second
    PRIMARY KEY (song_id, sec)
);

CREATE TABLE IF NOT EXISTS song_listen_daily (
    song_id            VARCHAR(255) NOT NULL,
    day                DATE NOT NULL,
    plays              BIGINT NOT NULL DEFAULT 0,
    qualified_streams  BIGINT NOT NULL DEFAULT 0,
    completions        BIGINT NOT NULL DEFAULT 0,
    skips              BIGINT NOT NULL DEFAULT 0,
    listened_ms        BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (song_id, day)
);
CREATE INDEX IF NOT EXISTS idx_song_listen_daily_day ON song_listen_daily (day);

-- Delivery quality per rendition and platform (startup time, stalls).
CREATE TABLE IF NOT EXISTS song_quality_daily (
    song_id          VARCHAR(255) NOT NULL,
    day              DATE NOT NULL,
    quality          VARCHAR(16) NOT NULL,
    platform         VARCHAR(16) NOT NULL,
    plays            BIGINT NOT NULL DEFAULT 0,
    listened_ms      BIGINT NOT NULL DEFAULT 0,
    startup_ms_sum   BIGINT NOT NULL DEFAULT 0,
    startup_samples  BIGINT NOT NULL DEFAULT 0,
    rebuffer_count   BIGINT NOT NULL DEFAULT 0,
    rebuffer_ms      BIGINT NOT NULL DEFAULT 0,
    PRIMARY KEY (song_id, day, quality, platform)
);
CREATE INDEX IF NOT EXISTS idx_song_quality_daily_day ON song_quality_daily (day);
