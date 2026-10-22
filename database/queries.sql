USE hostel_finder;

-- Search rooms by city, rent budget, room type, and selected hostel facilities.
SELECT r.room_id, h.name AS hostel, h.city, r.room_type, r.capacity,
       r.available_beds, r.rent_per_month,
       GROUP_CONCAT(DISTINCT f.facility_name ORDER BY f.facility_name) AS facilities
FROM ROOM r
JOIN HOSTEL h ON h.hostel_id = r.hostel_id
JOIN HOSTEL_FACILITY hf ON hf.hostel_id = h.hostel_id
JOIN FACILITY f ON f.facility_id = hf.facility_id
WHERE h.city = 'Mumbai' AND r.rent_per_month <= 7000 AND r.room_type = 'Double'
  AND f.facility_name IN ('Wi-Fi','Laundry')
GROUP BY r.room_id, h.hostel_id
HAVING r.available_beds > 0 AND COUNT(DISTINCT f.facility_name) = 2;

-- Room availability counts by hostel.
SELECT h.hostel_id, h.name,
       SUM(r.capacity) AS total_beds,
       SUM(r.capacity - r.available_beds) AS occupied_beds,
       SUM(r.available_beds) AS available_beds
FROM HOSTEL h JOIN ROOM r ON r.hostel_id = h.hostel_id
GROUP BY h.hostel_id, h.name;

-- Rank possible roommates for student 1 (only names and compatibility are shown).
SELECT s.name, c.compatibility_percent
FROM v_roommate_compatibility c
JOIN STUDENT s ON s.student_id = c.other_student_id
WHERE c.student_id = 1
ORDER BY c.compatibility_percent DESC, s.name;

-- Pending bookings grouped by hostel.
SELECT h.hostel_id, h.name, COUNT(*) AS pending_bookings
FROM BOOKING b
JOIN ROOM r ON r.room_id = b.room_id
JOIN HOSTEL h ON h.hostel_id = r.hostel_id
WHERE b.status = 'Pending'
GROUP BY h.hostel_id, h.name
ORDER BY pending_bookings DESC;

-- A student's booking history, including the room, hostel, and current status.
SELECT b.booking_id, b.booking_date, b.check_in_date, b.status,
       h.name AS hostel, r.room_type, r.rent_per_month
FROM BOOKING b
JOIN ROOM r ON r.room_id = b.room_id
JOIN HOSTEL h ON h.hostel_id = r.hostel_id
WHERE b.student_id = 1
ORDER BY b.booking_date DESC, b.booking_id DESC;

-- Reviews and average ratings for one hostel.
SELECT h.name, AVG(rv.rating) AS average_rating, COUNT(rv.student_id) AS review_count
FROM HOSTEL h LEFT JOIN REVIEW rv ON rv.hostel_id = h.hostel_id
WHERE h.hostel_id = 1
GROUP BY h.hostel_id, h.name;
