-- ==============================================================================
-- Flyway Database Migration: V10__add_device_telemetry_to_sessions.sql
-- Add device telemetry & geolocation metadata columns to sessions table
-- ==============================================================================

-- 1. Add device name, ip address, location, and last active timestamp to sessions
ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS device_name VARCHAR(255);

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS ip_address VARCHAR(255);

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS location VARCHAR(255);

ALTER TABLE sessions
ADD COLUMN IF NOT EXISTS last_active_at TIMESTAMP WITHOUT TIME ZONE;

-- 2. Create index on last_active_at for activity tracking & session ordering
CREATE INDEX IF NOT EXISTS idx_session_last_active_at ON sessions(last_active_at);
