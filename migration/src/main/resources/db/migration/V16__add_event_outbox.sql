-- ==============================================================================
-- Flyway Database Migration: V16__add_event_outbox.sql
-- Transactional outbox. The core API and the admin API insert a row in the same
-- transaction as the change it describes; outboxRelay (streams/) publishes it to
-- Kafka and sets sent_at. Additive only: no existing table changes.
--
-- payload holds the event's domain fields as plain JSON (snake_case, the Avro field
-- names); outboxRelay adds EventMeta from id / created_at / source and converts it
-- to the topic's Avro schema. Rows for notification.email.* carry one-time codes:
-- the relay blanks their payload once sent, and sent rows are deleted after 3 days.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS outbox_events (
    id          UUID PRIMARY KEY,
    topic       VARCHAR(255) NOT NULL,
    msg_key     VARCHAR(255) NOT NULL,
    payload     JSONB NOT NULL,
    source      VARCHAR(64)  NOT NULL,
    created_at  TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    sent_at     TIMESTAMP WITH TIME ZONE,
    attempts    INTEGER NOT NULL DEFAULT 0,
    last_error  VARCHAR(500)
);

-- The relay only ever scans unsent rows, oldest first.
CREATE INDEX IF NOT EXISTS idx_outbox_events_unsent
    ON outbox_events (created_at) WHERE sent_at IS NULL;

-- Cleanup of published rows.
CREATE INDEX IF NOT EXISTS idx_outbox_events_sent_at
    ON outbox_events (sent_at) WHERE sent_at IS NOT NULL;
