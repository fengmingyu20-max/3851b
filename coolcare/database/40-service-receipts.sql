-- Immutable uploaded receipts for offline payments. Uploading does not confirm payment.
CREATE TABLE IF NOT EXISTS service_receipt (
 receipt_id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 booking_id INT UNSIGNED NOT NULL,
 job_id INT UNSIGNED NOT NULL,
 uploaded_by_user_id INT UNSIGNED NOT NULL,
 request_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL UNIQUE,
 payload_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
 image_bytes MEDIUMBLOB NOT NULL,
 created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
 FOREIGN KEY (booking_id) REFERENCES booking(booking_id),
 FOREIGN KEY (job_id) REFERENCES work_order(job_id),
 FOREIGN KEY (uploaded_by_user_id) REFERENCES user_account(user_id),
 INDEX idx_receipt_booking(booking_id,receipt_id)
) ENGINE=InnoDB;
