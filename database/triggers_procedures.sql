USE hostel_finder;
DROP PROCEDURE IF EXISTS approve_booking_request;
DROP PROCEDURE IF EXISTS reject_booking_request;
DROP PROCEDURE IF EXISTS cancel_booking_request;
DROP PROCEDURE IF EXISTS end_allocation;
DELIMITER $$

CREATE TRIGGER trg_request_before_insert
BEFORE INSERT ON BOOKING_REQUEST FOR EACH ROW
BEGIN
  DECLARE v_gender VARCHAR(20);
  DECLARE v_hostel_type VARCHAR(20);
  DECLARE v_bed_status VARCHAR(20);
  DECLARE v_active INT DEFAULT 0;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;

  UPDATE STUDENT SET student_id = student_id WHERE student_id = NEW.student_id;
  UPDATE BED SET bed_id = bed_id WHERE bed_id = NEW.bed_id;
  SELECT s.gender, h.hostel_type, b.status INTO v_gender, v_hostel_type, v_bed_status
    FROM STUDENT s JOIN BED b ON b.bed_id = NEW.bed_id
    JOIN ROOM r ON r.room_id = b.room_id JOIN HOSTEL h ON h.hostel_id = r.hostel_id
    WHERE s.student_id = NEW.student_id;
  IF NEW.status = 'Pending' THEN
    IF v_bed_status <> 'Available' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bed is not available'; END IF;
    IF (v_hostel_type = 'Boys' AND v_gender <> 'Male') OR (v_hostel_type = 'Girls' AND v_gender <> 'Female') THEN
      SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student gender does not match hostel policy';
    END IF;
    SELECT COUNT(*) INTO v_active FROM ALLOCATION WHERE student_id = NEW.student_id AND status = 'Active';
    IF v_active > 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student already has an active allocation'; END IF;
  END IF;
END$$

CREATE TRIGGER trg_request_before_update
BEFORE UPDATE ON BOOKING_REQUEST FOR EACH ROW
BEGIN
  DECLARE v_gender VARCHAR(20);
  DECLARE v_hostel_type VARCHAR(20);
  DECLARE v_bed_status VARCHAR(20);
  DECLARE v_active INT DEFAULT 0;
  DECLARE CONTINUE HANDLER FOR NOT FOUND BEGIN END;
  IF NEW.status <> OLD.status THEN
    IF OLD.status <> 'Pending' OR NEW.status = 'Pending' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Invalid booking status transition'; END IF;
    IF NEW.status = 'Approved' THEN
      SELECT s.gender, h.hostel_type, b.status INTO v_gender, v_hostel_type, v_bed_status
        FROM STUDENT s JOIN BED b ON b.bed_id = NEW.bed_id
        JOIN ROOM r ON r.room_id = b.room_id JOIN HOSTEL h ON h.hostel_id = r.hostel_id
        WHERE s.student_id = NEW.student_id;
      IF (v_hostel_type = 'Boys' AND v_gender <> 'Male') OR (v_hostel_type = 'Girls' AND v_gender <> 'Female') THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student gender does not match hostel policy';
      END IF;
      SELECT COUNT(*) INTO v_active FROM ALLOCATION WHERE student_id = NEW.student_id AND status = 'Active';
      IF v_active > 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student already has an active allocation'; END IF;
      IF v_bed_status <> 'Available' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bed is not available'; END IF;
    END IF;
  END IF;
END$$

CREATE TRIGGER trg_request_after_insert
AFTER INSERT ON BOOKING_REQUEST FOR EACH ROW
BEGIN
  INSERT INTO BOOKING_STATUS_HISTORY (request_id, old_status, new_status, changed_by_admin)
  VALUES (NEW.request_id, NULL, NEW.status, NULL);
END$$

CREATE TRIGGER trg_request_after_update
AFTER UPDATE ON BOOKING_REQUEST FOR EACH ROW
BEGIN
  IF NEW.status <> OLD.status THEN
    INSERT INTO BOOKING_STATUS_HISTORY (request_id, old_status, new_status, changed_by_admin)
    VALUES (NEW.request_id, OLD.status, NEW.status, NEW.decided_by);
  END IF;
END$$

CREATE TRIGGER trg_allocation_before_insert
BEFORE INSERT ON ALLOCATION FOR EACH ROW
BEGIN
  DECLARE v_count INT DEFAULT 0;
  DECLARE v_request_count INT DEFAULT 0;
  DECLARE v_bed_status VARCHAR(20);
  UPDATE STUDENT SET student_id = student_id WHERE student_id = NEW.student_id;
  IF NEW.status = 'Active' THEN
    SELECT COUNT(*) INTO v_count FROM BOOKING_REQUEST WHERE student_id = NEW.student_id AND status = 'Pending';
    IF v_count > 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student still has a pending request'; END IF;
    SELECT COUNT(*) INTO v_request_count FROM BOOKING_REQUEST
      WHERE request_id = NEW.request_id AND student_id = NEW.student_id AND bed_id = NEW.bed_id AND status = 'Approved';
    IF v_request_count = 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active allocations require the matching Approved request'; END IF;
    SELECT status INTO v_bed_status FROM BED WHERE bed_id = NEW.bed_id FOR UPDATE;
    IF v_bed_status <> 'Booked' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Active allocation requires a Booked bed'; END IF;
  END IF;
END$$

CREATE PROCEDURE approve_booking_request(IN p_request_id BIGINT UNSIGNED, IN p_admin_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_student_id BIGINT UNSIGNED;
  DECLARE v_bed_id BIGINT UNSIGNED;
  DECLARE v_status VARCHAR(20);
  DECLARE v_bed_status VARCHAR(20);
  DECLARE v_hostel_id BIGINT UNSIGNED;
  DECLARE v_admin_role VARCHAR(30);
  DECLARE v_admin_hostel BIGINT UNSIGNED;
  DECLARE v_gender VARCHAR(20);
  DECLARE v_hostel_type VARCHAR(20);
  DECLARE v_active INT DEFAULT 0;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  SELECT student_id, bed_id, status INTO v_student_id, v_bed_id, v_status
    FROM BOOKING_REQUEST WHERE request_id = p_request_id;
  IF v_status IS NULL THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Booking request not found'; END IF;
  SELECT b.status, r.hostel_id INTO v_bed_status, v_hostel_id
    FROM BED b JOIN ROOM r ON r.room_id = b.room_id WHERE b.bed_id = v_bed_id FOR UPDATE;
  SELECT role, hostel_id INTO v_admin_role, v_admin_hostel FROM ADMIN WHERE admin_id = p_admin_id AND is_active = TRUE;
  IF v_admin_role IS NULL OR v_admin_role <> 'Hostel Admin' OR v_admin_hostel <> v_hostel_id THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Administrator cannot manage this hostel';
  END IF;
  SELECT student_id, bed_id, status INTO v_student_id, v_bed_id, v_status FROM BOOKING_REQUEST WHERE request_id = p_request_id FOR UPDATE;
  IF v_status <> 'Pending' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Request is no longer pending'; END IF;
  IF v_bed_status <> 'Available' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Bed is no longer available'; END IF;
  SELECT s.gender, h.hostel_type INTO v_gender, v_hostel_type FROM STUDENT s
    JOIN BED b ON b.bed_id = v_bed_id JOIN ROOM r ON r.room_id = b.room_id
    JOIN HOSTEL h ON h.hostel_id = r.hostel_id WHERE s.student_id = v_student_id;
  IF (v_hostel_type = 'Boys' AND v_gender <> 'Male') OR (v_hostel_type = 'Girls' AND v_gender <> 'Female') THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student gender does not match hostel policy';
  END IF;
  UPDATE STUDENT SET student_id = student_id WHERE student_id = v_student_id;
  SELECT COUNT(*) INTO v_active FROM ALLOCATION WHERE student_id = v_student_id AND status = 'Active';
  IF v_active > 0 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Student already has an active allocation'; END IF;
  UPDATE BOOKING_REQUEST SET status = 'Approved', decided_by = p_admin_id, decided_at = CURRENT_TIMESTAMP,
    admin_remark = COALESCE(admin_remark, 'Approved') WHERE request_id = p_request_id;
  UPDATE BED SET status = 'Booked' WHERE bed_id = v_bed_id;
  INSERT INTO ALLOCATION (request_id, student_id, bed_id, start_date, status)
    SELECT request_id, student_id, bed_id, requested_move_in, 'Active' FROM BOOKING_REQUEST WHERE request_id = p_request_id;
  UPDATE BOOKING_REQUEST SET status = 'Rejected', decided_by = p_admin_id, decided_at = CURRENT_TIMESTAMP,
    admin_remark = 'Bed was allocated to another student'
    WHERE bed_id = v_bed_id AND request_id <> p_request_id AND status = 'Pending';
  COMMIT;
END$$

CREATE PROCEDURE reject_booking_request(IN p_request_id BIGINT UNSIGNED, IN p_admin_id BIGINT UNSIGNED, IN p_remark VARCHAR(1000))
BEGIN
  DECLARE v_hostel_id BIGINT UNSIGNED;
  DECLARE v_admin_hostel BIGINT UNSIGNED;
  DECLARE v_role VARCHAR(30);
  DECLARE v_status VARCHAR(20);
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  SELECT r.status, h.hostel_id INTO v_status, v_hostel_id FROM BOOKING_REQUEST r JOIN BED b ON b.bed_id = r.bed_id
    JOIN ROOM rm ON rm.room_id = b.room_id JOIN HOSTEL h ON h.hostel_id = rm.hostel_id
    WHERE r.request_id = p_request_id FOR UPDATE;
  SELECT role, hostel_id INTO v_role, v_admin_hostel FROM ADMIN WHERE admin_id = p_admin_id AND is_active = TRUE;
  IF v_role <> 'Hostel Admin' OR v_admin_hostel <> v_hostel_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Administrator cannot manage this hostel'; END IF;
  IF v_status <> 'Pending' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Request is no longer pending'; END IF;
  UPDATE BOOKING_REQUEST SET status = 'Rejected', decided_by = p_admin_id, decided_at = CURRENT_TIMESTAMP,
    admin_remark = COALESCE(NULLIF(p_remark, ''), 'Rejected by hostel administrator') WHERE request_id = p_request_id;
  COMMIT;
END$$

CREATE PROCEDURE cancel_booking_request(IN p_request_id BIGINT UNSIGNED, IN p_student_id BIGINT UNSIGNED)
BEGIN
  DECLARE v_status VARCHAR(20);
  DECLARE v_owner BIGINT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  SELECT status, student_id INTO v_status, v_owner FROM BOOKING_REQUEST WHERE request_id = p_request_id FOR UPDATE;
  IF v_owner <> p_student_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Request not found'; END IF;
  IF v_status <> 'Pending' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only pending requests can be cancelled'; END IF;
  UPDATE BOOKING_REQUEST SET status = 'Cancelled', decided_at = CURRENT_TIMESTAMP WHERE request_id = p_request_id;
  COMMIT;
END$$

CREATE PROCEDURE end_allocation(IN p_allocation_id BIGINT UNSIGNED, IN p_admin_id BIGINT UNSIGNED, IN p_end_date DATE)
BEGIN
  DECLARE v_bed_id BIGINT UNSIGNED;
  DECLARE v_hostel_id BIGINT UNSIGNED;
  DECLARE v_status VARCHAR(20);
  DECLARE v_role VARCHAR(30);
  DECLARE v_admin_hostel BIGINT UNSIGNED;
  DECLARE EXIT HANDLER FOR SQLEXCEPTION BEGIN ROLLBACK; RESIGNAL; END;
  START TRANSACTION;
  SELECT a.bed_id, a.status, rm.hostel_id INTO v_bed_id, v_status, v_hostel_id FROM ALLOCATION a
    JOIN BED b ON b.bed_id = a.bed_id JOIN ROOM rm ON rm.room_id = b.room_id
    WHERE a.allocation_id = p_allocation_id FOR UPDATE;
  SELECT role, hostel_id INTO v_role, v_admin_hostel FROM ADMIN WHERE admin_id = p_admin_id AND is_active = TRUE;
  IF v_role <> 'Hostel Admin' OR v_admin_hostel <> v_hostel_id THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Administrator cannot manage this hostel'; END IF;
  IF v_status <> 'Active' THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Allocation is not active'; END IF;
  UPDATE ALLOCATION SET status = 'Completed', end_date = p_end_date WHERE allocation_id = p_allocation_id;
  UPDATE BED SET status = 'Available' WHERE bed_id = v_bed_id;
  COMMIT;
END$$

DELIMITER ;
