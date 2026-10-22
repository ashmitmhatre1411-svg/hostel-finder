USE hostel_finder;
DROP PROCEDURE IF EXISTS approve_booking;
DROP PROCEDURE IF EXISTS reject_booking;
DROP PROCEDURE IF EXISTS cancel_booking;
DROP PROCEDURE IF EXISTS approve_booking_request;
DROP PROCEDURE IF EXISTS reject_booking_request;
DROP PROCEDURE IF EXISTS cancel_booking_request;
DROP PROCEDURE IF EXISTS end_allocation;
DROP PROCEDURE IF EXISTS run_business_checks;
DROP PROCEDURE IF EXISTS run_project_checks;
DROP TRIGGER IF EXISTS trg_booking_before_insert;
DROP TRIGGER IF EXISTS trg_booking_before_update;
DELIMITER $$

-- A request must target a room with advertised availability and a compatible hostel.
CREATE TRIGGER trg_booking_before_insert
BEFORE INSERT ON BOOKING FOR EACH ROW
BEGIN
  DECLARE v_gender VARCHAR(20);
  DECLARE v_gender_type VARCHAR(20);
  DECLARE v_available INT DEFAULT 0;
  SELECT s.gender, h.gender_type, r.available_beds
    INTO v_gender, v_gender_type, v_available
    FROM STUDENT s
    JOIN ROOM r ON r.room_id = NEW.room_id
    JOIN HOSTEL h ON h.hostel_id = r.hostel_id
    WHERE s.student_id = NEW.student_id;

  IF NEW.status = 'Pending' THEN
    IF v_available < 1 THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room has no available beds';
    END IF;
    IF (v_gender_type = 'Boys' AND v_gender <> 'Male')
      OR (v_gender_type = 'Girls' AND v_gender <> 'Female') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student gender does not match hostel policy';
    END IF;
  END IF;
END$$

-- Status changes must go through the procedures so availability stays in sync.
CREATE TRIGGER trg_booking_before_update
BEFORE UPDATE ON BOOKING FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    IF COALESCE(@booking_procedure, '') = '' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Use a booking procedure to change status';
    END IF;
    IF NOT ((OLD.status = 'Pending' AND NEW.status IN ('Approved','Rejected','Cancelled'))
      OR (OLD.status = 'Approved' AND NEW.status = 'Cancelled')) THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid booking status transition';
    END IF;
    IF NEW.status = 'Approved' AND @booking_procedure <> 'approve' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only the approval procedure can approve bookings';
    END IF;
    IF NEW.status = 'Rejected' AND @booking_procedure <> 'reject' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only the rejection procedure can reject bookings';
    END IF;
    IF NEW.status = 'Cancelled' AND @booking_procedure <> 'cancel' THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only the cancellation procedure can cancel bookings';
    END IF;
  END IF;
END$$

-- Lock the room before checking availability so two owners cannot approve the
-- final bed concurrently.
CREATE PROCEDURE approve_booking(IN p_booking_id BIGINT UNSIGNED, IN p_owner_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_available INT DEFAULT 0;
  DECLARE v_gender VARCHAR(20);
  DECLARE v_gender_type VARCHAR(20);
  DECLARE v_owner BIGINT UNSIGNED;
  DECLARE v_room_id BIGINT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SET @booking_procedure = NULL;
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT b.status, r.available_beds, s.gender, h.gender_type, h.owner_id, r.room_id
    INTO v_status, v_available, v_gender, v_gender_type, v_owner, v_room_id
    FROM BOOKING b
    JOIN STUDENT s ON s.student_id = b.student_id
    JOIN ROOM r ON r.room_id = b.room_id
    JOIN HOSTEL h ON h.hostel_id = r.hostel_id
    WHERE b.booking_id = p_booking_id
    FOR UPDATE;

  IF v_owner <> p_owner_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking is not in this owner’s hostel';
  END IF;
  IF v_status <> 'Pending' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only Pending bookings can be approved';
  END IF;
  IF v_available < 1 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Room has no available beds';
  END IF;
  IF (v_gender_type = 'Boys' AND v_gender <> 'Male')
    OR (v_gender_type = 'Girls' AND v_gender <> 'Female') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student gender does not match hostel policy';
  END IF;

  SET @booking_procedure = 'approve';
  UPDATE ROOM r JOIN BOOKING b ON b.room_id = r.room_id
    SET r.available_beds = r.available_beds - 1
    WHERE b.booking_id = p_booking_id;
  UPDATE BOOKING SET status = 'Approved' WHERE booking_id = p_booking_id;
  IF v_available = 1 THEN
    SET @booking_procedure = 'reject';
    UPDATE BOOKING SET status = 'Rejected'
      WHERE room_id = v_room_id AND booking_id <> p_booking_id AND status = 'Pending';
  END IF;
  SET @booking_procedure = NULL;
  COMMIT;
END$$

CREATE PROCEDURE reject_booking(IN p_booking_id BIGINT UNSIGNED, IN p_owner_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_owner BIGINT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SET @booking_procedure = NULL;
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  SELECT b.status, h.owner_id INTO v_status, v_owner
    FROM BOOKING b JOIN ROOM r ON r.room_id = b.room_id JOIN HOSTEL h ON h.hostel_id = r.hostel_id
    WHERE b.booking_id = p_booking_id FOR UPDATE;
  IF v_owner <> p_owner_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking is not in this owner’s hostel';
  END IF;
  IF v_status <> 'Pending' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only Pending bookings can be rejected';
  END IF;
  SET @booking_procedure = 'reject';
  UPDATE BOOKING SET status = 'Rejected' WHERE booking_id = p_booking_id;
  SET @booking_procedure = NULL;
  COMMIT;
END$$

CREATE PROCEDURE cancel_booking(IN p_booking_id BIGINT UNSIGNED, IN p_student_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_room_id BIGINT UNSIGNED;
  DECLARE v_student_id BIGINT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    SET @booking_procedure = NULL;
    ROLLBACK;
    RESIGNAL;
  END;
  START TRANSACTION;
  SELECT status, room_id, student_id INTO v_status, v_room_id, v_student_id
    FROM BOOKING WHERE booking_id = p_booking_id FOR UPDATE;
  IF v_student_id <> p_student_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking does not belong to this student';
  END IF;
  IF v_status NOT IN ('Pending','Approved') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only Pending or Approved bookings can be cancelled';
  END IF;
  SET @booking_procedure = 'cancel';
  IF v_status = 'Approved' THEN
    UPDATE ROOM SET available_beds = available_beds + 1 WHERE room_id = v_room_id;
  END IF;
  UPDATE BOOKING SET status = 'Cancelled' WHERE booking_id = p_booking_id;
  SET @booking_procedure = NULL;
  COMMIT;
END$$
DELIMITER ;
