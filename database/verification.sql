-- Run once after schema.sql, triggers_procedures.sql, views.sql, and seed.sql.
-- This approves the seeded test booking and rejects its competing room request.
USE hostel_finder;
DROP PROCEDURE IF EXISTS run_project_checks;
DELIMITER $$
CREATE PROCEDURE run_project_checks()
BEGIN
  DECLARE gender_rejected BOOLEAN DEFAULT FALSE;
  DECLARE owner_scope_rejected BOOLEAN DEFAULT FALSE;
  DECLARE second_approval_rejected BOOLEAN DEFAULT FALSE;

  CALL approve_booking(101, 1);

  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET second_approval_rejected = TRUE;
    CALL approve_booking(102, 1);
  END;

  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET gender_rejected = TRUE;
    INSERT INTO BOOKING (check_in_date,student_id,room_id)
    VALUES (DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY),4,4);
  END;

  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET owner_scope_rejected = TRUE;
    CALL reject_booking(104, 2);
  END;

  SELECT 'Double booking prevented; one approval for one bed' AS check_name,
    IF((SELECT COUNT(*) FROM BOOKING WHERE room_id=1 AND status='Approved')=1
      AND (SELECT available_beds FROM ROOM WHERE room_id=1)=0
      AND second_approval_rejected,'PASS','FAIL') AS result;
  SELECT 'Competing request auto-rejected when room filled' AS check_name,
    IF((SELECT status FROM BOOKING WHERE booking_id=102)='Rejected','PASS','FAIL') AS result;
  SELECT 'Gender-mismatched booking rejected' AS check_name,
    IF(gender_rejected,'PASS','FAIL') AS result;
  SELECT 'Owner cannot decide for another owner’s hostel' AS check_name,
    IF(owner_scope_rejected,'PASS','FAIL') AS result;
END$$
DELIMITER ;
CALL run_project_checks();
DROP PROCEDURE run_project_checks;
