-- Migration v7: Add genre column to songs and jobs tables
-- Tracks musical genre for cataloging and Recombee recommendation engine

-- 1. Add genre column to songs table
ALTER TABLE songs ADD COLUMN IF NOT EXISTS genre VARCHAR(100);

-- 2. Add genre column to jobs table
ALTER TABLE jobs ADD COLUMN IF NOT EXISTS genre VARCHAR(100);
