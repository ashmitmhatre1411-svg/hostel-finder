USE hostel_finder;

-- Demo password for all seeded accounts: HostelDemo2026!
-- Plain-text passwords are demo-only; never use real user passwords in this project.
INSERT INTO OWNER (owner_id,name,email,phone,password) VALUES
(1,'Anita Sharma','anita@hostel-owner.invalid','9000000201','HostelDemo2026!'),
(2,'Meera Iyer','meera@hostel-owner.invalid','9000000202','HostelDemo2026!'),
(3,'Rahul Desai','rahul@hostel-owner.invalid','9000000203','HostelDemo2026!');

INSERT INTO HOSTEL (hostel_id,name,address,city,gender_type,owner_id) VALUES
(1,'Aarohan Boys Residence','S.V. Road, Andheri West','Mumbai','Boys',1),
(2,'Sakhi Girls Hostel','JVPD Scheme, Vile Parle West','Mumbai','Girls',2),
(3,'Campus Grove Living','Bhavans Campus Road, Andheri West','Mumbai','Co-ed',3);

INSERT INTO FACILITY (facility_id,facility_name) VALUES
(1,'Wi-Fi'),(2,'Laundry'),(3,'Study room'),(4,'CCTV'),(5,'Power backup'),
(6,'Parking'),(7,'Mess'),(8,'Gym'),(9,'Common kitchen');

INSERT INTO HOSTEL_FACILITY (hostel_id,facility_id) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),(1,7),(1,8),
(2,1),(2,2),(2,3),(2,4),(2,5),(2,7),(2,9),
(3,1),(3,2),(3,3),(3,4),(3,5),(3,6),(3,7),(3,8),(3,9);

-- 24 rooms and 54 total beds. Room 1 has one bed for the booking concurrency demo.
INSERT INTO ROOM (room_id,room_type,capacity,rent_per_month,available_beds,hostel_id) VALUES
(1,'Single',1,9500,1,1),(2,'Double',2,6500,1,1),(3,'Triple',3,5200,3,1),(4,'Double',2,6800,2,1),
(5,'Triple',3,5000,3,1),(6,'Double',2,6200,2,1),(7,'Triple',3,5400,3,1),(8,'Double',2,7000,2,1),
(9,'Single',1,10500,1,2),(10,'Double',2,7500,2,2),(11,'Triple',3,5900,3,2),(12,'Double',2,7200,2,2),
(13,'Triple',3,5700,3,2),(14,'Double',2,7800,2,2),(15,'Triple',3,6100,3,2),(16,'Double',2,7400,2,2),
(17,'Single',1,11000,1,3),(18,'Double',2,8200,2,3),(19,'Triple',3,6500,3,3),(20,'Double',2,8000,2,3),
(21,'Triple',3,6300,3,3),(22,'Double',2,8500,2,3),(23,'Triple',3,6700,3,3),(24,'Double',2,8300,2,3);

INSERT INTO STUDENT (student_id,name,email,password,phone,gender,college) VALUES
(1,'Aarav Desai','aarav.desai@student-hostel.invalid','HostelDemo2026!','9000000301','Male','Sardar Patel Institute of Technology'),
(2,'Rohan Kulkarni','rohan.kulkarni@student-hostel.invalid','HostelDemo2026!','9000000302','Male','Sardar Patel Institute of Technology'),
(3,'Kabir Shah','kabir.shah@student-hostel.invalid','HostelDemo2026!','9000000303','Male','Sardar Patel Institute of Technology'),
(4,'Sana Merchant','sana.merchant@student-hostel.invalid','HostelDemo2026!','9000000304','Female','Sardar Patel Institute of Technology'),
(5,'Nisha Patil','nisha.patil@student-hostel.invalid','HostelDemo2026!','9000000305','Female','Sardar Patel Institute of Technology'),
(6,'Ishaan Joshi','ishaan.joshi@student-hostel.invalid','HostelDemo2026!','9000000306','Male','Sardar Patel Institute of Technology'),
(7,'Ananya Rao','ananya.rao@student-hostel.invalid','HostelDemo2026!','9000000307','Female','Sardar Patel Institute of Technology'),
(8,'Dev Mehta','dev.mehta@student-hostel.invalid','HostelDemo2026!','9000000308','Male','Sardar Patel Institute of Technology'),
(9,'Mira Fernandes','mira.fernandes@student-hostel.invalid','HostelDemo2026!','9000000309','Female','Sardar Patel Institute of Technology'),
(10,'Arjun Nair','arjun.nair@student-hostel.invalid','HostelDemo2026!','9000000310','Male','Sardar Patel Institute of Technology'),
(11,'Tara Shah','tara.shah@student-hostel.invalid','HostelDemo2026!','9000000311','Female','Sardar Patel Institute of Technology'),
(12,'Neel Kamat','neel.kamat@student-hostel.invalid','HostelDemo2026!','9000000312','Non-binary','Sardar Patel Institute of Technology');

INSERT INTO ROOMMATE_PREFERENCE (pref_id,smoking,sleep_schedule,food_type,cleanliness,max_budget,student_id) VALUES
(1,'Non-smoker','Early','Vegetarian',5,7000,1),(2,'Non-smoker','Flexible','Vegetarian',4,6500,2),
(3,'Occasional','Late','Eggetarian',3,7500,3),(4,'Non-smoker','Early','Vegetarian',5,8000,4),
(5,'Non-smoker','Flexible','Vegan',4,7500,5),(6,'Non-smoker','Late','Non-vegetarian',3,6500,6),
(7,'Occasional','Early','Eggetarian',4,8000,7),(8,'Smoker','Late','Non-vegetarian',2,7000,8),
(9,'Non-smoker','Flexible','Vegetarian',5,8500,9),(10,'Non-smoker','Early','Eggetarian',4,9000,10),
(11,'Occasional','Flexible','Vegetarian',3,7000,11),(12,'Non-smoker','Late','Vegan',5,7000,12);

-- Seed each status. Two Pending applications target room 1 (one bed) for the
-- approval/overbooking verification script.
INSERT INTO BOOKING (booking_id,booking_date,check_in_date,status,student_id,room_id) VALUES
(101,CURRENT_DATE,DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY),'Pending',1,1),
(102,CURRENT_DATE,DATE_ADD(CURRENT_DATE, INTERVAL 14 DAY),'Pending',2,1),
(103,CURRENT_DATE,DATE_ADD(CURRENT_DATE, INTERVAL 21 DAY),'Approved',3,2),
(104,CURRENT_DATE,DATE_ADD(CURRENT_DATE, INTERVAL 28 DAY),'Rejected',4,3),
(105,CURRENT_DATE,DATE_ADD(CURRENT_DATE, INTERVAL 35 DAY),'Cancelled',5,10);

INSERT INTO REVIEW (student_id,hostel_id,rating,comment) VALUES
(6,1,5,'Clean rooms and helpful staff.'),
(7,2,4,'Good location near campus.'),
(8,3,5,'Convenient shared study space.');
