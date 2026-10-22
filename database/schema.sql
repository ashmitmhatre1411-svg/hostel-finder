-- Nine relations from DBMS_MinProj_2025800080.docx.
-- Apply only to the dedicated hostel_finder database; this script recreates the schema.
SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;
DROP VIEW IF EXISTS v_roommate_compatibility;
DROP VIEW IF EXISTS v_student_compatibility;
DROP TABLE IF EXISTS REVIEW, BOOKING, ROOMMATE_PREFERENCE, STUDENT_PREFERENCE,
  BOOKING_STATUS_HISTORY, ALLOCATION, BOOKING_REQUEST, AUTH_SESSION, BED,
  ROOM, HOSTEL_AMENITY, FACILITY, AMENITY, ADMIN, HOSTEL_FACILITY,
  HOSTEL, STUDENT, OWNER;
SET FOREIGN_KEY_CHECKS = 1;

-- A hostel owner can list multiple hostels.
CREATE TABLE OWNER (
  owner_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  PRIMARY KEY (owner_id),
  UNIQUE KEY uq_owner_email (email)
) ENGINE=InnoDB;

-- Hostels are owned by one account and can have many rooms and facilities.
CREATE TABLE HOSTEL (
  hostel_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(150) NOT NULL,
  address VARCHAR(255) NOT NULL,
  city VARCHAR(100) NOT NULL,
  gender_type ENUM('Boys','Girls','Co-ed') NOT NULL,
  owner_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (hostel_id),
  KEY ix_hostel_city_gender (city, gender_type),
  KEY ix_hostel_owner (owner_id),
  CONSTRAINT fk_hostel_owner FOREIGN KEY (owner_id) REFERENCES OWNER(owner_id) ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Facilities are a shared lookup list.
CREATE TABLE FACILITY (
  facility_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  facility_name VARCHAR(80) NOT NULL,
  PRIMARY KEY (facility_id),
  UNIQUE KEY uq_facility_name (facility_name)
) ENGINE=InnoDB;

-- Join table for the Hostel Offers Facility many-to-many relationship.
CREATE TABLE HOSTEL_FACILITY (
  hostel_id BIGINT UNSIGNED NOT NULL,
  facility_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (hostel_id, facility_id),
  KEY ix_hostel_facility_facility (facility_id),
  CONSTRAINT fk_hostel_facility_hostel FOREIGN KEY (hostel_id) REFERENCES HOSTEL(hostel_id) ON DELETE CASCADE,
  CONSTRAINT fk_hostel_facility_facility FOREIGN KEY (facility_id) REFERENCES FACILITY(facility_id) ON DELETE CASCADE
) ENGINE=InnoDB;

-- available_beds is stored as requested in the submitted relational model.
-- Procedures keep it in sync with approved bookings.
CREATE TABLE ROOM (
  room_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  room_type ENUM('Single','Double','Triple') NOT NULL,
  capacity SMALLINT UNSIGNED NOT NULL,
  rent_per_month DECIMAL(10,2) NOT NULL,
  available_beds SMALLINT UNSIGNED NOT NULL,
  hostel_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (room_id),
  KEY ix_room_hostel (hostel_id),
  KEY ix_room_type_rent (room_type, rent_per_month),
  KEY ix_room_available (available_beds),
  CONSTRAINT fk_room_hostel FOREIGN KEY (hostel_id) REFERENCES HOSTEL(hostel_id) ON DELETE RESTRICT,
  CONSTRAINT chk_room_capacity CHECK (capacity > 0),
  CONSTRAINT chk_room_rent CHECK (rent_per_month > 0),
  CONSTRAINT chk_room_availability CHECK (available_beds <= capacity)
) ENGINE=InnoDB;

CREATE TABLE STUDENT (
  student_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(254) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  phone VARCHAR(24) NOT NULL,
  gender ENUM('Male','Female','Non-binary','Undisclosed') NOT NULL,
  college VARCHAR(150) NOT NULL,
  PRIMARY KEY (student_id),
  UNIQUE KEY uq_student_email (email)
) ENGINE=InnoDB;

-- One preference row belongs to each student. Lifestyle values support matching;
-- max_budget is used to filter room rents.
CREATE TABLE ROOMMATE_PREFERENCE (
  pref_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  smoking ENUM('Non-smoker','Occasional','Smoker') NOT NULL DEFAULT 'Non-smoker',
  sleep_schedule ENUM('Early','Flexible','Late') NOT NULL DEFAULT 'Flexible',
  food_type ENUM('Vegetarian','Eggetarian','Non-vegetarian','Vegan') NOT NULL DEFAULT 'Vegetarian',
  cleanliness TINYINT UNSIGNED NOT NULL,
  max_budget DECIMAL(10,2) NOT NULL,
  student_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (pref_id),
  UNIQUE KEY uq_preference_student (student_id),
  CONSTRAINT fk_preference_student FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE,
  CONSTRAINT chk_preference_cleanliness CHECK (cleanliness BETWEEN 1 AND 5),
  CONSTRAINT chk_preference_budget CHECK (max_budget >= 0)
) ENGINE=InnoDB;

-- Bookings link students to rooms. An approval transaction locks the room row,
-- checks available_beds, and decrements it atomically.
CREATE TABLE BOOKING (
  booking_id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  booking_date DATE NOT NULL DEFAULT (CURRENT_DATE),
  check_in_date DATE NOT NULL,
  status ENUM('Pending','Approved','Rejected','Cancelled') NOT NULL DEFAULT 'Pending',
  student_id BIGINT UNSIGNED NOT NULL,
  room_id BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (booking_id),
  KEY ix_booking_student (student_id, booking_date),
  KEY ix_booking_room_status (room_id, status),
  CONSTRAINT fk_booking_student FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE RESTRICT,
  CONSTRAINT fk_booking_room FOREIGN KEY (room_id) REFERENCES ROOM(room_id) ON DELETE RESTRICT,
  CONSTRAINT chk_booking_dates CHECK (check_in_date >= booking_date)
) ENGINE=InnoDB;

-- A student can review a given hostel once; the pair is the primary key.
CREATE TABLE REVIEW (
  student_id BIGINT UNSIGNED NOT NULL,
  hostel_id BIGINT UNSIGNED NOT NULL,
  rating TINYINT UNSIGNED NOT NULL,
  comment VARCHAR(1000) NULL,
  PRIMARY KEY (student_id, hostel_id),
  KEY ix_review_hostel (hostel_id),
  CONSTRAINT fk_review_student FOREIGN KEY (student_id) REFERENCES STUDENT(student_id) ON DELETE CASCADE,
  CONSTRAINT fk_review_hostel FOREIGN KEY (hostel_id) REFERENCES HOSTEL(hostel_id) ON DELETE RESTRICT,
  CONSTRAINT chk_review_rating CHECK (rating BETWEEN 1 AND 5)
) ENGINE=InnoDB;
