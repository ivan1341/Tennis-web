CREATE TABLE IF NOT EXISTS users (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    phone VARCHAR(50) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    role ENUM('admin', 'user') NOT NULL DEFAULT 'user',
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS auth_tokens (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    user_id INT UNSIGNED NOT NULL,
    token VARCHAR(128) NOT NULL UNIQUE,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_auth_tokens_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS tournaments (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    start_date DATE NOT NULL,
    end_date DATE NOT NULL,
    participants_count INT UNSIGNED DEFAULT 0,
    groups_count INT UNSIGNED DEFAULT 0,
    rounds_count INT UNSIGNED DEFAULT 0,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL
);

CREATE TABLE IF NOT EXISTS tournament_players (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT UNSIGNED NOT NULL,
    user_id INT UNSIGNED NOT NULL,
    group_number INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_tournament_players_tournament_id FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT fk_tournament_players_user_id FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_tournament_players_tournament_user UNIQUE (tournament_id, user_id)
);

CREATE TABLE IF NOT EXISTS match_results (
    id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    tournament_id INT UNSIGNED NOT NULL,
    round_number INT UNSIGNED NOT NULL,
    group_number INT UNSIGNED NOT NULL,
    player_one_id INT UNSIGNED NOT NULL,
    player_two_id INT UNSIGNED NOT NULL,
    player_one_score INT UNSIGNED NOT NULL,
    player_two_score INT UNSIGNED NOT NULL,
    edited_by_user_id INT UNSIGNED NOT NULL,
    created_at TIMESTAMP NULL DEFAULT NULL,
    updated_at TIMESTAMP NULL DEFAULT NULL,
    CONSTRAINT fk_match_results_tournament_id FOREIGN KEY (tournament_id) REFERENCES tournaments(id) ON DELETE CASCADE,
    CONSTRAINT fk_match_results_player_one_id FOREIGN KEY (player_one_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_match_results_player_two_id FOREIGN KEY (player_two_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT fk_match_results_edited_by_user_id FOREIGN KEY (edited_by_user_id) REFERENCES users(id) ON DELETE CASCADE,
    CONSTRAINT uq_match_results_unique_match UNIQUE (tournament_id, round_number, group_number, player_one_id, player_two_id)
);

