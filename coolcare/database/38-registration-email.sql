-- Additive, repeat-safe migration; existing accounts do not require reverification.
CREATE TABLE IF NOT EXISTS registration_email_verification (
 email VARCHAR(255) NOT NULL PRIMARY KEY,
 challenge_id CHAR(48) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 session_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 code_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NULL,
 expires_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
 attempts TINYINT UNSIGNED NOT NULL DEFAULT 0,
 window_started_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
 send_count SMALLINT UNSIGNED NOT NULL DEFAULT 0,
 next_send_at BIGINT UNSIGNED NOT NULL DEFAULT 0,
 delivery_status ENUM('Sending','Ready','Failed','Consumed') NOT NULL DEFAULT 'Failed',
 INDEX idx_registration_expiry (expires_at)
) ENGINE=InnoDB;
