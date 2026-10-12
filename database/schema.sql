-- MySQL 8.0.16+. Apply to a dedicated database created by the operator.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS v_student_compatibility;
DROP TABLE IF EXISTS AUTH_SESSION, BOOKING_STATUS_HISTORY, ALLOCATION, BOOKING_REQUEST,
  BED, ROOM, HOSTEL_AMENITY, AMENITY, HOSTEL, ADMIN, STUDENT_PREFERENCE, STUDENT;
SET FOREIGN_KEY_CHECKS = 1;

CREATE TABLE STUDENT (
  student_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  roll_no VARCHAR(24) NOT NULL,
  full_name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  gender ENUM('Male','Female','Non-binary','Undisclosed') NOT NULL,
  department VARCHAR(100) NOT NULL,
  year_of_study TINYINT UNSIGNED NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (student_id), UNIQUE KEY uq_student_roll (roll_no), UNIQUE KEY uq_student_email (email),
  CONSTRAINT chk_student_year CHECK (year_of_study BETWEEN 1 AND 8)
) ENGINE=InnoDB;

CREATE TABLE STUDENT_PREFERENCE (
  preference_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  sleep_schedule ENUM('Early','Flexible','Late') NOT NULL DEFAULT 'Flexible',
  cleanliness_level TINYINT UNSIGNED NOT NULL,
  smoking_habit ENUM('Non-smoker','Occasional','Smoker') NOT NULL DEFAULT 'Non-smoker',
  noise_tolerance TINYINT UNSIGNED NOT NULL,
  study_habit ENUM('Daily','Flexible','Exam-focused') NOT NULL DEFAULT 'Flexible',
  budget_min DECIMAL(10,2) NOT NULL DEFAULT 0,
  budget_max DECIMAL(10,2) NOT NULL,
  preferred_room_type ENUM('Single','Double','Triple') NULL,
  move_in_date DATE NULL,
  PRIMARY KEY (preference_id), UNIQUE KEY uq_preference_student (student_id),
  CONSTRAINT fk_preference_student FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE,
  CONSTRAINT chk_cleanliness CHECK (cleanliness_level BETWEEN 1 AND 5),
  CONSTRAINT chk_noise CHECK (noise_tolerance BETWEEN 1 AND 5),
  CONSTRAINT chk_budget CHECK (budget_min >= 0 AND budget_min <= budget_max)
) ENGINE=InnoDB;

CREATE TABLE HOSTEL (
  hostel_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  hostel_type ENUM('Boys','Girls','Co-ed') NOT NULL,
  address VARCHAR(255) NOT NULL,
  distance_km DECIMAL(6,2) NOT NULL,
  contact_no VARCHAR(24) NOT NULL,
  rules TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (hostel_id), KEY ix_hostel_active_type (is_active, hostel_type),
  CONSTRAINT chk_hostel_distance CHECK (distance_km >= 0)
) ENGINE=InnoDB;

CREATE TABLE AMENITY (
  amenity_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  amenity_name VARCHAR(80) NOT NULL,
  PRIMARY KEY (amenity_id), UNIQUE KEY uq_amenity_name (amenity_name)
) ENGINE=InnoDB;

CREATE TABLE ADMIN (
  admin_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role ENUM('Hostel Admin','System Admin') NOT NULL,
  hostel_id BIGINT UNSIGNED NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (admin_id), UNIQUE KEY uq_admin_email (email), KEY ix_admin_hostel (hostel_id),
  CONSTRAINT fk_admin_hostel FOREIGN KEY (hostel_id) REFERENCES HOSTEL(hostel_id) ON DELETE RESTRICT,
  CONSTRAINT chk_admin_hostel_role CHECK ((role = 'System Admin' AND hostel_id IS NULL) OR (role = 'Hostel Admin' AND hostel_id IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE HOSTEL_AMENITY (
  hostel_id BIGINT UNSIGNED NOT NULL,
  amenity_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (hostel_id, amenity_id), KEY ix_hostel_amenity_amenity (amenity_id),
  CONSTRAINT fk_hostel_amenity_hostel FOREIGN KEY (hostel_id) REFERENCES HOSTEL(hostel_id) ON DELETE CASCADE,
  CONSTRAINT fk_hostel_amenity_amenity FOREIGN KEY (amenity_id) REFERENCES AMENITY(amenity_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE ROOM (
  room_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  hostel_id BIGINT UNSIGNED NOT NULL,
  room_number VARCHAR(20) NOT NULL,
  floor_no SMALLINT NOT NULL DEFAULT 0,
  room_type ENUM('Single','Double','Triple') NOT NULL,
  total_beds TINYINT UNSIGNED NOT NULL,
  rent_per_bed DECIMAL(10,2) NOT NULL,
  has_ac BOOLEAN NOT NULL DEFAULT FALSE,
  has_attached_bath BOOLEAN NOT NULL DEFAULT FALSE,
  has_mess BOOLEAN NOT NULL DEFAULT FALSE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  PRIMARY KEY (room_id), UNIQUE KEY uq_room_number (hostel_id, room_number),
  KEY ix_room_rent (rent_per_bed), KEY ix_room_type (room_type), KEY ix_room_hostel_active (hostel_id, is_active),
  CONSTRAINT fk_room_hostel FOREIGN KEY (hostel_id) REFERENCES HOSTEL(hostel_id) ON DELETE RESTRICT,
  CONSTRAINT chk_room_beds CHECK (total_beds > 0), CONSTRAINT chk_room_rent CHECK (rent_per_bed > 0)
) ENGINE=InnoDB;

CREATE TABLE BED (
  bed_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_id BIGINT UNSIGNED NOT NULL,
  bed_label VARCHAR(12) NOT NULL,
  status ENUM('Available','Booked','Maintenance') NOT NULL DEFAULT 'Available',
  PRIMARY KEY (bed_id), UNIQUE KEY uq_bed_label (room_id, bed_label), KEY ix_bed_status (status),
  CONSTRAINT fk_bed_room FOREIGN KEY (room_id) REFERENCES ROOM(room_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE BOOKING_REQUEST (
  request_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  student_id BIGINT UNSIGNED NOT NULL,
  bed_id BIGINT UNSIGNED NOT NULL,
  requested_move_in DATE NOT NULL,
  status ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
  student_note VARCHAR(1000) NULL,
  admin_remark VARCHAR(1000) NULL,
  decided_by BIGINT UNSIGNED NULL,
  requested_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  decided_at TIMESTAMP NULL DEFAULT NULL,
  pending_student_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'Pending' THEN student_id ELSE NULL END) STORED,
  PRIMARY KEY (request_id), KEY ix_request_status (status), KEY ix_request_student (student_id),
  KEY ix_request_bed_status (bed_id, status), KEY ix_request_decided_by (decided_by),
  UNIQUE KEY uq_one_pending_request (pending_student_id),
  CONSTRAINT fk_request_student FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE RESTRICT,
  CONSTRAINT fk_request_bed FOREIGN KEY (bed_id) REFERENCES BED(bed_id) ON DELETE RESTRICT,
  CONSTRAINT fk_request_admin FOREIGN KEY (decided_by) REFERENCES ADMIN(admin_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE ALLOCATION (
  allocation_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  bed_id BIGINT UNSIGNED NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NULL,
  status ENUM('Active','Completed','Cancelled') NOT NULL DEFAULT 'Active',
  active_student_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'Active' THEN student_id ELSE NULL END) STORED,
  active_bed_id BIGINT UNSIGNED GENERATED ALWAYS AS (CASE WHEN status = 'Active' THEN bed_id ELSE NULL END) STORED,
  PRIMARY KEY (allocation_id), UNIQUE KEY uq_allocation_request (request_id),
  KEY ix_allocation_student_status (student_id, status), KEY ix_allocation_bed_status (bed_id, status),
  UNIQUE KEY uq_one_active_allocation (active_student_id), UNIQUE KEY uq_one_active_bed (active_bed_id),
  CONSTRAINT fk_allocation_request FOREIGN KEY (request_id) REFERENCES BOOKING_REQUEST(request_id) ON DELETE RESTRICT,
  CONSTRAINT fk_allocation_student FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE RESTRICT,
  CONSTRAINT fk_allocation_bed FOREIGN KEY (bed_id) REFERENCES BED(bed_id) ON DELETE RESTRICT,
  CONSTRAINT chk_allocation_dates CHECK (end_date IS NULL OR end_date >= start_date),
  CONSTRAINT chk_allocation_state CHECK ((status = 'Active' AND end_date IS NULL) OR (status <> 'Active' AND end_date IS NOT NULL))
) ENGINE=InnoDB;

CREATE TABLE BOOKING_STATUS_HISTORY (
  history_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  request_id BIGINT UNSIGNED NOT NULL,
  old_status ENUM('Pending','Approved','Rejected','Cancelled') NULL,
  new_status ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL,
  changed_by_admin BIGINT UNSIGNED NULL,
  changed_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (history_id), KEY ix_history_request (request_id), KEY ix_history_actor (changed_by_admin),
  CONSTRAINT fk_history_request FOREIGN KEY (request_id) REFERENCES BOOKING_REQUEST(request_id) ON DELETE RESTRICT,
  CONSTRAINT fk_history_admin FOREIGN KEY (changed_by_admin) REFERENCES ADMIN(admin_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Needed to persist hashed session tokens so logout, expiry, and revocation work across restarts.
CREATE TABLE AUTH_SESSION (
  session_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  token_hash BINARY(32) NOT NULL,
  student_id BIGINT UNSIGNED NULL,
  admin_id BIGINT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at DATETIME NOT NULL,
  revoked_at DATETIME NULL,
  PRIMARY KEY (session_id), UNIQUE KEY uq_session_token_hash (token_hash),
  KEY ix_session_student (student_id), KEY ix_session_admin (admin_id), KEY ix_session_expiry (expires_at),
  CONSTRAINT fk_session_student FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_session_admin FOREIGN KEY (admin_id) REFERENCES ADMIN(admin_id) ON DELETE CASCADE,
  CONSTRAINT chk_session_owner CHECK ((student_id IS NOT NULL AND admin_id IS NULL) OR (student_id IS NULL AND admin_id IS NOT NULL))
) ENGINE=InnoDB;
