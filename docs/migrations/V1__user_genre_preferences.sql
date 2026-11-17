-- P6: Cold-start genre onboarding preferences table
-- Run this SQL migration against your PostgreSQL database before deploying P6.
-- (Hibernate ddl-auto is set to 'validate', so the table must exist beforehand.)

CREATE TABLE IF NOT EXISTS user_genre_preferences (
    id          VARCHAR(255) NOT NULL PRIMARY KEY,
    user_id     VARCHAR(255) NOT NULL UNIQUE,
    genres      TEXT         NOT NULL,
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    CONSTRAINT fk_ugp_user FOREIGN KEY (user_id)
        REFERENCES users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_ugp_user_id ON user_genre_preferences (user_id);

