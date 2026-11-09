-- Additive and repeat-safe. Passwords change only after a valid reset submission.
CREATE TABLE IF NOT EXISTS password_reset_token (
 user_id INT UNSIGNED NOT NULL PRIMARY KEY,
 email VARCHAR(255) NOT NULL,
 token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE,
 credential_fingerprint CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 expires_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
 window_started_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
 send_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 next_send_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
 delivery_status ENUM('Sending','Ready','Failed','Consumed') NOT NULL DEFAULT 'Failed',
 FOREIGN KEY (user_id) REFERENCES user_account(user_id),
 INDEX idx_password_reset_expiry (expires_at)
) ENGINE=InnoDB;
