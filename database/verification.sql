-- Run after schema.sql, triggers_procedures.sql, views.sql, and seed.sql.
-- This leaves the database unchanged: expected constraint failures are caught.
USE hostel_finder;
DROP PROCEDURE IF EXISTS run_business_checks;
DELIMITER $$
CREATE PROCEDURE run_business_checks()
BEGIN
  DECLARE gender_rejected BOOLEAN DEFAULT FALSE;
  DECLARE second_pending_rejected BOOLEAN DEFAULT FALSE;
  DECLARE active_allocation_rejected BOOLEAN DEFAULT FALSE;
  DECLARE cross_hostel_rejected BOOLEAN DEFAULT FALSE;

  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET gender_rejected = TRUE;
    INSERT INTO BOOKING_REQUEST (student_id,bed_id,requested_move_in,student_note)
    VALUES (7,3,CURRENT_DATE,'Verification: must fail because this is a girls-hostel student applying to a boys hostel bed.');
  END;

  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET active_allocation_rejected = TRUE;
    INSERT INTO BOOKING_REQUEST (student_id,bed_id,requested_move_in,student_note)
    VALUES (1,10,CURRENT_DATE,'Verification: must fail because this student has an active allocation.');
  END;

  BEGIN
    DECLARE CONTINUE HANDLER FOR 1062 SET second_pending_rejected = TRUE;
    INSERT INTO BOOKING_REQUEST (student_id,bed_id,requested_move_in,student_note)
    VALUES (5,10,CURRENT_DATE,'Verification: must fail because this student already has a Pending request.');
  END;

  BEGIN
    DECLARE CONTINUE HANDLER FOR SQLSTATE '45000' SET cross_hostel_rejected = TRUE;
    CALL reject_booking_request(107,2,'Verification: must fail because admin 2 does not own hostel 2.');
  END;

  SELECT 'Same-bed approval and competing auto-rejection' AS check_name,
    IF((SELECT status FROM BOOKING_REQUEST WHERE request_id=101)='Approved'
      AND (SELECT status FROM BOOKING_REQUEST WHERE request_id=102)='Rejected'
      AND (SELECT COUNT(*) FROM ALLOCATION WHERE bed_id=1 AND status='Active')=1,'PASS','FAIL') AS result;
  SELECT 'Gender mismatch rejected by trigger' AS check_name, IF(gender_rejected,'PASS','FAIL') AS result;
  SELECT 'Second Pending request rejected' AS check_name, IF(second_pending_rejected,'PASS','FAIL') AS result;
  SELECT 'New request rejected for active allocation holder' AS check_name, IF(active_allocation_rejected,'PASS','FAIL') AS result;
  SELECT 'Cross-hostel admin decision rejected' AS check_name, IF(cross_hostel_rejected,'PASS','FAIL') AS result;
END$$
DELIMITER ;
CALL run_business_checks();
DROP PROCEDURE run_business_checks;
