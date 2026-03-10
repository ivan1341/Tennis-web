-- Idempotent production schema update
-- Safe to run multiple times on MySQL 5.7+ / 8.x

SET @db := DATABASE();

-- ---------------------------------------------------------------------------
-- 1) tournaments: regulation_pdf_path
-- ---------------------------------------------------------------------------
SET @has_tournaments_reg_pdf := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'tournaments'
    AND COLUMN_NAME = 'regulation_pdf_path'
);

SET @sql := IF(
  @has_tournaments_reg_pdf = 0,
  'ALTER TABLE tournaments ADD COLUMN regulation_pdf_path VARCHAR(255) NULL AFTER rounds_count',
  'SELECT "tournaments.regulation_pdf_path already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 2) tournament_players: position_index
-- ---------------------------------------------------------------------------
SET @has_tp_position := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'tournament_players'
    AND COLUMN_NAME = 'position_index'
);

SET @sql := IF(
  @has_tp_position = 0,
  'ALTER TABLE tournament_players ADD COLUMN position_index INT UNSIGNED NOT NULL DEFAULT 1 AFTER group_number',
  'SELECT "tournament_players.position_index already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- Ensure expected definition even if column existed with a different shape
ALTER TABLE tournament_players
  MODIFY COLUMN position_index INT UNSIGNED NOT NULL DEFAULT 1;

-- ---------------------------------------------------------------------------
-- 3) tournament_players: withdrawn_round_number
-- ---------------------------------------------------------------------------
SET @has_tp_withdrawn_round := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'tournament_players'
    AND COLUMN_NAME = 'withdrawn_round_number'
);

SET @sql := IF(
  @has_tp_withdrawn_round = 0,
  'ALTER TABLE tournament_players ADD COLUMN withdrawn_round_number INT UNSIGNED NULL AFTER position_index',
  'SELECT "tournament_players.withdrawn_round_number already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 4) tournament_players unique key (tournament_id, user_id)
-- ---------------------------------------------------------------------------
SET @has_tp_unique := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.STATISTICS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'tournament_players'
    AND INDEX_NAME = 'uq_tournament_players_tournament_user'
);

SET @sql := IF(
  @has_tp_unique = 0,
  'ALTER TABLE tournament_players ADD CONSTRAINT uq_tournament_players_tournament_user UNIQUE (tournament_id, user_id)',
  'SELECT "uq_tournament_players_tournament_user already exists"'
);
PREPARE stmt FROM @sql;
EXECUTE stmt;
DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 5) match_results set-based schema fields
-- ---------------------------------------------------------------------------
SET @has_mr_set1_p1 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_results' AND COLUMN_NAME = 'set1_player_one_games'
);
SET @sql := IF(
  @has_mr_set1_p1 = 0,
  'ALTER TABLE match_results ADD COLUMN set1_player_one_games INT UNSIGNED NOT NULL DEFAULT 0 AFTER player_two_id',
  'SELECT "match_results.set1_player_one_games already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_mr_set1_p2 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_results' AND COLUMN_NAME = 'set1_player_two_games'
);
SET @sql := IF(
  @has_mr_set1_p2 = 0,
  'ALTER TABLE match_results ADD COLUMN set1_player_two_games INT UNSIGNED NOT NULL DEFAULT 0 AFTER set1_player_one_games',
  'SELECT "match_results.set1_player_two_games already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_mr_set2_p1 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_results' AND COLUMN_NAME = 'set2_player_one_games'
);
SET @sql := IF(
  @has_mr_set2_p1 = 0,
  'ALTER TABLE match_results ADD COLUMN set2_player_one_games INT UNSIGNED NOT NULL DEFAULT 0 AFTER set1_player_two_games',
  'SELECT "match_results.set2_player_one_games already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_mr_set2_p2 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_results' AND COLUMN_NAME = 'set2_player_two_games'
);
SET @sql := IF(
  @has_mr_set2_p2 = 0,
  'ALTER TABLE match_results ADD COLUMN set2_player_two_games INT UNSIGNED NOT NULL DEFAULT 0 AFTER set2_player_one_games',
  'SELECT "match_results.set2_player_two_games already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_mr_set3_p1 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_results' AND COLUMN_NAME = 'set3_player_one_games'
);
SET @sql := IF(
  @has_mr_set3_p1 = 0,
  'ALTER TABLE match_results ADD COLUMN set3_player_one_games INT UNSIGNED NOT NULL DEFAULT 0 AFTER set2_player_two_games',
  'SELECT "match_results.set3_player_one_games already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_mr_set3_p2 := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_results' AND COLUMN_NAME = 'set3_player_two_games'
);
SET @sql := IF(
  @has_mr_set3_p2 = 0,
  'ALTER TABLE match_results ADD COLUMN set3_player_two_games INT UNSIGNED NOT NULL DEFAULT 0 AFTER set3_player_one_games',
  'SELECT "match_results.set3_player_two_games already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_mr_walkover := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_results' AND COLUMN_NAME = 'is_walkover'
);
SET @sql := IF(
  @has_mr_walkover = 0,
  'ALTER TABLE match_results ADD COLUMN is_walkover TINYINT(1) NOT NULL DEFAULT 0 AFTER set3_player_two_games',
  'SELECT "match_results.is_walkover already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_mr_walkover_player_id := (
  SELECT COUNT(*) FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = @db AND TABLE_NAME = 'match_results' AND COLUMN_NAME = 'walkover_player_id'
);
SET @sql := IF(
  @has_mr_walkover_player_id = 0,
  'ALTER TABLE match_results ADD COLUMN walkover_player_id INT UNSIGNED NULL AFTER is_walkover',
  'SELECT "match_results.walkover_player_id already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

SET @has_fk_walkover := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.TABLE_CONSTRAINTS
  WHERE TABLE_SCHEMA = @db
    AND TABLE_NAME = 'match_results'
    AND CONSTRAINT_TYPE = 'FOREIGN KEY'
    AND CONSTRAINT_NAME = 'fk_match_results_walkover_player_id'
);
SET @sql := IF(
  @has_fk_walkover = 0,
  'ALTER TABLE match_results ADD CONSTRAINT fk_match_results_walkover_player_id FOREIGN KEY (walkover_player_id) REFERENCES users(id) ON DELETE SET NULL',
  'SELECT "fk_match_results_walkover_player_id already exists"'
);
PREPARE stmt FROM @sql; EXECUTE stmt; DEALLOCATE PREPARE stmt;

-- ---------------------------------------------------------------------------
-- 6) app_settings table (for configurable contact email)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS app_settings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  setting_key VARCHAR(100) NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  created_at TIMESTAMP NULL DEFAULT NULL,
  updated_at TIMESTAMP NULL DEFAULT NULL
);

-- Optional default value for contact email
INSERT INTO app_settings (setting_key, setting_value, created_at, updated_at)
SELECT 'contact_email', 'info@escaleramundet.com', NOW(), NOW()
FROM DUAL
WHERE NOT EXISTS (
  SELECT 1 FROM app_settings WHERE setting_key = 'contact_email'
);

-- ---------------------------------------------------------------------------
-- Final checks
-- ---------------------------------------------------------------------------
SELECT 'Schema update finished' AS status;
