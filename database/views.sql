USE hostel_finder;

-- A simple, explainable compatibility score from the four lifestyle fields in
-- the submitted preference model. Budget is a room filter, not a roommate score.
-- Equal categories receive 25 points each; cleanliness is graduated from 0-25.
CREATE OR REPLACE VIEW v_roommate_compatibility AS
SELECT p1.student_id AS student_id,
       p2.student_id AS other_student_id,
       CAST(ROUND(
         (CASE WHEN p1.smoking = p2.smoking THEN 25 ELSE 0 END)
         + (CASE WHEN p1.sleep_schedule = p2.sleep_schedule THEN 25 ELSE 0 END)
         + (CASE WHEN p1.food_type = p2.food_type THEN 25 ELSE 0 END)
         + 25 * (1 - ABS(p1.cleanliness - p2.cleanliness) / 4)
       , 2) AS DECIMAL(5,2)) AS compatibility_percent
FROM ROOMMATE_PREFERENCE p1
JOIN ROOMMATE_PREFERENCE p2 ON p1.student_id <> p2.student_id;
