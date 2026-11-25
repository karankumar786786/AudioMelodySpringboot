-- ==============================================================================
-- Flyway Database Migration: V18__add_shorts.sql
-- Shorts become their own thing: a vertical video with its own audio, uploaded by an
-- admin or a listener, optionally linked to a catalog song. Until now a "short" was any
-- song with a canvas loop plus its preview window; that stays as the player background.
-- Additive only. The old user_shorts_likes table is dropped in a later migration, once
-- app versions that still call /api/canvas/* are gone.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS shorts (
    id              VARCHAR(36) PRIMARY KEY,
    owner_type      VARCHAR(16) NOT NULL CHECK (owner_type IN ('ADMIN', 'LISTENER')),
    user_id         VARCHAR(255) REFERENCES users(id) ON DELETE CASCADE,
    admin_id        VARCHAR(255),
    -- A short outlives the song it points at: the link is just cleared.
    song_id         VARCHAR(255) REFERENCES songs(id) ON DELETE SET NULL,
    caption         VARCHAR(300),
    status          VARCHAR(16) NOT NULL DEFAULT 'UPLOADING'
                    CHECK (status IN ('UPLOADING', 'PROCESSING', 'READY', 'FAILED', 'HIDDEN', 'DELETED')),
    raw_key         VARCHAR(512),   -- original upload in the temp bucket
    hls_key         VARCHAR(512),   -- master playlist in the production bucket
    thumbnail_key   VARCHAR(512),
    duration_ms     INTEGER,
    width           INTEGER,
    height          INTEGER,
    likes_count     BIGINT NOT NULL DEFAULT 0,
    views_count     BIGINT NOT NULL DEFAULT 0,
    reports_count   INTEGER NOT NULL DEFAULT 0,
    failure_reason  VARCHAR(500),
    hidden_reason   VARCHAR(300),
    created_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at      TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    published_at    TIMESTAMP WITH TIME ZONE,
    CHECK ((owner_type = 'LISTENER' AND user_id IS NOT NULL) OR owner_type = 'ADMIN')
);

-- Feed: newest published first (cursor = published_at, id).
CREATE INDEX IF NOT EXISTS idx_shorts_feed ON shorts (status, published_at DESC, id DESC);
CREATE INDEX IF NOT EXISTS idx_shorts_user ON shorts (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_shorts_song ON shorts (song_id) WHERE song_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS short_likes (
    short_id    VARCHAR(36)  NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
    user_id     VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    PRIMARY KEY (short_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_short_likes_user ON short_likes (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS short_reports (
    id           BIGSERIAL PRIMARY KEY,
    short_id     VARCHAR(36)  NOT NULL REFERENCES shorts(id) ON DELETE CASCADE,
    reporter_id  VARCHAR(255) NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    reason       VARCHAR(32)  NOT NULL
                 CHECK (reason IN ('SPAM', 'NUDITY', 'VIOLENCE', 'HATE', 'COPYRIGHT', 'OTHER')),
    note         VARCHAR(500),
    resolved     BOOLEAN NOT NULL DEFAULT FALSE,
    created_at   TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE (short_id, reporter_id)
);
CREATE INDEX IF NOT EXISTS idx_short_reports_open ON short_reports (resolved, created_at DESC);

-- Admins can stop an account from posting shorts (NULL = allowed).
ALTER TABLE users ADD COLUMN IF NOT EXISTS shorts_banned_until TIMESTAMP WITH TIME ZONE;
