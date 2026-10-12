USE hostel_finder;

-- Pairwise preference score used by the API when listing occupants of a room.
-- Study habits use a practical three-level scale: same = full, Flexible paired
-- with another value = half, and Daily paired with Exam-focused = zero.
CREATE OR REPLACE VIEW v_student_compatibility AS
SELECT p1.student_id AS student_id,
       p2.student_id AS other_student_id,
       CAST(ROUND(
         (CASE
           WHEN p1.sleep_schedule = p2.sleep_schedule THEN 25
           WHEN (p1.sleep_schedule = 'Flexible' AND p2.sleep_schedule IN ('Early','Late'))
             OR (p2.sleep_schedule = 'Flexible' AND p1.sleep_schedule IN ('Early','Late')) THEN 12.5
           ELSE 0 END)
         + 25 * (1 - ABS(p1.cleanliness_level - p2.cleanliness_level) / 4)
         + (CASE WHEN p1.smoking_habit = p2.smoking_habit THEN 20
           WHEN (p1.smoking_habit = 'Non-smoker' AND p2.smoking_habit = 'Smoker')
             OR (p2.smoking_habit = 'Non-smoker' AND p1.smoking_habit = 'Smoker') THEN 0 ELSE 10 END)
         + 15 * (1 - ABS(p1.noise_tolerance - p2.noise_tolerance) / 4)
         + (CASE WHEN p1.study_habit = p2.study_habit THEN 15
           WHEN p1.study_habit = 'Flexible' OR p2.study_habit = 'Flexible' THEN 7.5 ELSE 0 END)
       , 2) AS DECIMAL(5,2)) AS compatibility_percent
FROM STUDENT_PREFERENCE p1
JOIN STUDENT_PREFERENCE p2 ON p1.student_id <> p2.student_id;
