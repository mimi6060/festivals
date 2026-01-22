-- Drop performances indexes and table
DROP INDEX IF EXISTS idx_performances_festival_stage_time;
DROP INDEX IF EXISTS idx_performances_stage_time;
DROP INDEX IF EXISTS idx_performances_festival_time;
DROP INDEX IF EXISTS idx_performances_is_headliner;
DROP INDEX IF EXISTS idx_performances_status;
DROP INDEX IF EXISTS idx_performances_end_time;
DROP INDEX IF EXISTS idx_performances_start_time;
DROP INDEX IF EXISTS idx_performances_artist_id;
DROP INDEX IF EXISTS idx_performances_stage_id;
DROP INDEX IF EXISTS idx_performances_festival_id;
DROP TABLE IF EXISTS performances;

-- Drop stages indexes and table
ALTER TABLE stages DROP CONSTRAINT IF EXISTS stages_festival_name_unique;
DROP INDEX IF EXISTS idx_stages_status;
DROP INDEX IF EXISTS idx_stages_festival_id;
DROP TABLE IF EXISTS stages;

-- Drop artists indexes and table
DROP INDEX IF EXISTS idx_artists_country;
DROP INDEX IF EXISTS idx_artists_genre;
DROP INDEX IF EXISTS idx_artists_name;
DROP INDEX IF EXISTS idx_artists_slug;
ALTER TABLE artists DROP CONSTRAINT IF EXISTS artists_slug_unique;
DROP TABLE IF EXISTS artists;
