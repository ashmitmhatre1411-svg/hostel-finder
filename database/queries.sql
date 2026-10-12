USE hostel_finder;

-- Budget, room type, and selected amenities (replace 6000, 'Double', and amenity ids).
SELECT r.room_id, h.name AS hostel, r.room_number, r.room_type, r.rent_per_bed,
       SUM(b.status = 'Available') AS available_beds,
       GROUP_CONCAT(DISTINCT a.amenity_name ORDER BY a.amenity_name) AS amenities
FROM ROOM r JOIN HOSTEL h ON h.hostel_id = r.hostel_id
JOIN BED b ON b.room_id = r.room_id
LEFT JOIN HOSTEL_AMENITY ha ON ha.hostel_id = h.hostel_id
LEFT JOIN AMENITY a ON a.amenity_id = ha.amenity_id
WHERE h.is_active = TRUE AND r.is_active = TRUE
  AND r.rent_per_bed <= 6000 AND r.room_type = 'Double'
  AND a.amenity_id IN (1, 2)
GROUP BY r.room_id HAVING available_beds > 0 AND COUNT(DISTINCT a.amenity_id) = 2;

-- Availability counts by hostel.
SELECT h.hostel_id, h.name,
       COUNT(DISTINCT CASE WHEN b.status = 'Available' THEN b.bed_id END) AS available_beds,
       COUNT(DISTINCT CASE WHEN b.status = 'Booked' THEN b.bed_id END) AS booked_beds,
       COUNT(DISTINCT CASE WHEN b.status = 'Maintenance' THEN b.bed_id END) AS maintenance_beds
FROM HOSTEL h JOIN ROOM r ON r.hostel_id = h.hostel_id JOIN BED b ON b.room_id = r.room_id
WHERE h.is_active = TRUE AND r.is_active = TRUE GROUP BY h.hostel_id, h.name;

-- Compatibility ranking against the signed-in student's current-room occupants.
SELECT c.other_student_id, c.compatibility_percent
FROM v_student_compatibility c
WHERE c.student_id = 1 AND c.other_student_id IN (
  SELECT a.student_id FROM ALLOCATION a JOIN BED b ON b.bed_id = a.bed_id
  WHERE b.room_id = 1 AND a.status = 'Active'
) ORDER BY c.compatibility_percent DESC;

-- Pending requests grouped by hostel.
SELECT h.hostel_id, h.name, COUNT(*) AS pending_requests
FROM BOOKING_REQUEST q JOIN BED b ON b.bed_id = q.bed_id JOIN ROOM r ON r.room_id = b.room_id
JOIN HOSTEL h ON h.hostel_id = r.hostel_id
WHERE q.status = 'Pending' GROUP BY h.hostel_id, h.name ORDER BY pending_requests DESC;

-- Student booking and status history.
SELECT q.request_id, q.status, q.requested_move_in, q.requested_at, q.admin_remark,
       hs.old_status, hs.new_status, hs.changed_at, ad.name AS changed_by
FROM BOOKING_REQUEST q JOIN BOOKING_STATUS_HISTORY hs ON hs.request_id = q.request_id
LEFT JOIN ADMIN ad ON ad.admin_id = hs.changed_by_admin
WHERE q.student_id = 1 ORDER BY q.request_id DESC, hs.changed_at;
