USE hostel_finder;

INSERT INTO HOSTEL (hostel_id,name,hostel_type,address,distance_km,contact_no,rules,is_active) VALUES
(1,'Aarohan Boys Residence','Boys','Near Sardar Patel Institute of Technology, Andheri West, Mumbai',0.7,'9000000101','Visitor hours: 8 AM–9 PM. Quiet hours after 10 PM. No smoking indoors.',TRUE),
(2,'Sakhi Girls Hostel','Girls','JVPD Scheme, Vile Parle West, Mumbai',1.2,'9000000102','Visitor hours: 9 AM–8 PM. Quiet hours after 10 PM. Entry register required.',TRUE),
(3,'Campus Grove Living','Co-ed','Bhavans Campus Road, Andheri West, Mumbai',0.4,'9000000103','Separate residential floors. Quiet hours after 10 PM. Shared common areas.',TRUE);

INSERT INTO AMENITY (amenity_id,amenity_name) VALUES
(1,'Wi-Fi'),(2,'Laundry'),(3,'Study room'),(4,'CCTV'),(5,'Power backup'),(6,'Gym'),(7,'Parking'),(8,'Common kitchen');

INSERT INTO HOSTEL_AMENITY (hostel_id,amenity_id) VALUES
(1,1),(1,2),(1,3),(1,4),(1,5),(1,7),(1,8),
(2,1),(2,2),(2,3),(2,4),(2,5),(2,6),(2,8),
(3,1),(3,2),(3,3),(3,4),(3,5),(3,6),(3,7),(3,8);

INSERT INTO ADMIN (admin_id,name,email,password_hash,role,hostel_id) VALUES
(1,'Hostel Finder System Admin','system-admin@hostel-finder.invalid','scrypt$16384$8$1$274410dc0258298fb1371343efabc430$bda3b7884b194ca5ae3f74bbf0644d5da9b423870645325ad9842041f0152c6126196b0f458808cd36912cdc52fead00e35ac5130e1718983976b2a90564ff42','System Admin',NULL),
(2,'Aarohan Hostel Office','boys-admin@hostel-finder.invalid','scrypt$16384$8$1$b1a6fdef4c39eb863d1f8d0f83654cde$5697ab9f36870deecd7fdf7306648d7ae99741815b92d7822570c1d780204a7e8b0a1439f5a414528b0092a468d5346c3db0cea2b5c7c8ab0ec1e6e5def0a09d','Hostel Admin',1),
(3,'Sakhi Hostel Office','girls-admin@hostel-finder.invalid','scrypt$16384$8$1$ef8710a9d05ad2d9dc8b6928c6c6d256$ee054ff18165d8233d0f2c9cd19df304133257a186ed8331b16794750cd3b186fe818c64da2b9fce06c0cf72a3a552330f66ba2f79f094001fb1adba69fd2f06','Hostel Admin',2),
(4,'Campus Grove Hostel Office','coed-admin@hostel-finder.invalid','scrypt$16384$8$1$8469067588df14828cbd7e18bdf42009$7daf3b4aa7ae4b33e773b5ca936e98bbe1bc7525d8a5b847d365786bae11cc90841c1fefe0694ba525b3fc4cfe6951ba8ebf5e6776d967c19bf2dd3f49f81cda','Hostel Admin',3);

-- 24 rooms: two single rooms, three double rooms, and three triple rooms per hostel.
INSERT INTO ROOM (room_id,hostel_id,room_number,floor_no,room_type,total_beds,rent_per_bed,has_ac,has_attached_bath,has_mess,is_active) VALUES
(101,1,'A-101',1,'Single',1,9200,TRUE,TRUE,TRUE,TRUE),(102,1,'A-102',1,'Single',1,8800,FALSE,FALSE,TRUE,TRUE),
(103,1,'A-201',2,'Double',2,6400,TRUE,TRUE,TRUE,TRUE),(104,1,'A-202',2,'Double',2,5900,FALSE,FALSE,TRUE,TRUE),(105,1,'A-203',2,'Double',2,6100,TRUE,FALSE,TRUE,TRUE),
(106,1,'A-301',3,'Triple',3,4800,TRUE,TRUE,TRUE,TRUE),(107,1,'A-302',3,'Triple',3,4200,FALSE,FALSE,TRUE,TRUE),(108,1,'A-303',3,'Triple',3,4500,FALSE,TRUE,TRUE,TRUE),
(201,2,'S-101',1,'Single',1,9800,TRUE,TRUE,TRUE,TRUE),(202,2,'S-102',1,'Single',1,9000,FALSE,FALSE,TRUE,TRUE),
(203,2,'S-201',2,'Double',2,6900,TRUE,TRUE,TRUE,TRUE),(204,2,'S-202',2,'Double',2,6300,FALSE,FALSE,TRUE,TRUE),(205,2,'S-203',2,'Double',2,6500,TRUE,FALSE,TRUE,TRUE),
(206,2,'S-301',3,'Triple',3,5100,TRUE,TRUE,TRUE,TRUE),(207,2,'S-302',3,'Triple',3,4600,FALSE,FALSE,TRUE,TRUE),(208,2,'S-303',3,'Triple',3,4800,FALSE,TRUE,TRUE,TRUE),
(301,3,'G-101',1,'Single',1,10500,TRUE,TRUE,TRUE,TRUE),(302,3,'G-102',1,'Single',1,9600,FALSE,FALSE,TRUE,TRUE),
(303,3,'G-201',2,'Double',2,7200,TRUE,TRUE,TRUE,TRUE),(304,3,'G-202',2,'Double',2,6700,FALSE,FALSE,TRUE,TRUE),(305,3,'G-203',2,'Double',2,7000,TRUE,FALSE,TRUE,TRUE),
(306,3,'G-301',3,'Triple',3,5500,TRUE,TRUE,TRUE,TRUE),(307,3,'G-302',3,'Triple',3,5000,FALSE,FALSE,TRUE,TRUE),(308,3,'G-303',3,'Triple',3,5200,FALSE,TRUE,TRUE,TRUE);

INSERT INTO BED (bed_id,room_id,bed_label,status) VALUES
(1,101,'A', 'Available'),(2,102,'A','Available'),(3,103,'A','Available'),(4,103,'B','Available'),(5,104,'A','Available'),(6,104,'B','Available'),
(7,105,'A','Available'),(8,105,'B','Available'),(9,106,'A','Available'),(10,106,'B','Available'),(11,106,'C','Available'),(12,107,'A','Available'),(13,107,'B','Available'),(14,107,'C','Available'),(15,108,'A','Available'),(16,108,'B','Available'),(17,108,'C','Available'),
(18,201,'A','Available'),(19,202,'A','Available'),(20,203,'A','Available'),(21,203,'B','Available'),(22,204,'A','Available'),(23,204,'B','Available'),(24,205,'A','Available'),(25,205,'B','Available'),(26,206,'A','Available'),(27,206,'B','Available'),(28,206,'C','Available'),(29,207,'A','Available'),(30,207,'B','Available'),(31,207,'C','Available'),(32,208,'A','Available'),(33,208,'B','Available'),(34,208,'C','Available'),
(35,301,'A','Available'),(36,302,'A','Available'),(37,303,'A','Available'),(38,303,'B','Available'),(39,304,'A','Available'),(40,304,'B','Available'),(41,305,'A','Available'),(42,305,'B','Available'),(43,306,'A','Available'),(44,306,'B','Available'),(45,306,'C','Available'),(46,307,'A','Available'),(47,307,'B','Available'),(48,307,'C','Available'),(49,308,'A','Available'),(50,308,'B','Available'),(51,308,'C','Available');

INSERT INTO STUDENT (student_id,roll_no,full_name,email,password_hash,phone,gender,department,year_of_study) VALUES
(1,'HF2026001','Aarav Deshmukh','aarav.desai@student-hostel.invalid','scrypt$16384$8$1$be671c342465ef9a88a184931c2d831e$7f609ca0599e0a6bc83ec24570efcfd47dbe9fcf8fd211516aa37699548317d8e381a36c9452214358b9f52280b54976d042a0fc448bc7db599809f3403d3db8','9000000201','Male','Computer Engineering',2),
(2,'HF2026002','Rohan Kulkarni','rohan.kulkarni@student-hostel.invalid','scrypt$16384$8$1$eab1dde69f7b7e200f3ba53f4ff7560d$9d799d324ae42b3ab91f078c7c9e2852890bf6e5bf720592bf5cae4827baa9237120b5c9637598500b7d0939f1b8fb978267117a6e1012956c99479d004e05fe','9000000202','Male','Information Technology',1),
(3,'HF2026003','Ishaan Patil','ishaan.patil@student-hostel.invalid','scrypt$16384$8$1$3344a049a074397f18e5da5e5a35c8a3$5392166b97e4029ceb1838b37c8e2ca8da6ce43e4aee29a2882c56c64ee8f77abbfe52a8bff65fc9db2f289dedc5e3765d3acc7cab43023e4f64db7bb7073850','9000000203','Male','Electrical Engineering',3),
(4,'HF2026004','Kabir Shah','kabir.shah@student-hostel.invalid','scrypt$16384$8$1$7c2b3a06e8f228d1d6835a6cff20c52d$6c99a0bae34b7176330799c6ead51fe8942f4c3e91b6375e583884d7e4a8094a20545f192eb8383d561e4151984419824d92cacefbc28ccd5196eabd96374b53','9000000204','Male','Electronics Engineering',2),
(5,'HF2026005','Vihaan Joshi','vihaan.joshi@student-hostel.invalid','scrypt$16384$8$1$8f0f06bbfc888f8a926552768264987a$9affe6b8aa23c71de368af33d8244945b39bb70b0bec6bbc41f6307655aa066a06cf5530bcf2864632fd50d0b571dd49ec45aa74662d4f27c16612c7ae6b20ec','9000000205','Male','Mechanical Engineering',1),
(6,'HF2026006','Neel Nair','neel.nair@student-hostel.invalid','scrypt$16384$8$1$52e00f211cf5ecf10aac2fe099283789$0bbb228b9f7f054a3555e8447a590ecbd6e8df1160e1033e015a96d95326bde8b5b0e8e307eb093b639da180d31a9669103e28783f21c87ba209a567f0d3fb0c','9000000206','Male','Computer Engineering',4),
(7,'HF2026007','Ananya Rao','ananya.rao@student-hostel.invalid','scrypt$16384$8$1$87b3737cd4d82d3b0a4287e9ebb8c362$58b368eedf008ccd42c2d99bf2eb7cd923397367ace00d3f909b97395dab837457b1a396c8aa1bd0ef790778277b9593061fb74dcfc5a0c83a1b5e96adc02a94','9000000207','Female','Information Technology',2),
(8,'HF2026008','Meera Iyer','meera.iyer@student-hostel.invalid','scrypt$16384$8$1$3509be2997fdd564617a6ac55da6be66$7eff46bcc8cbbbd8ec7ed9f9a6abbd571a10d1cf278435d9d96f50376d84f90b1f8764311dfb4a7680ad20426b149a99b0b7174367afb4b52f2d7c05e33c0087','9000000208','Female','Electronics Engineering',1),
(9,'HF2026009','Sana Merchant','sana.merchant@student-hostel.invalid','scrypt$16384$8$1$6cb681ae06f33a408191bfb72792db73$4e878ad116f25b1c9ac7ea1d27d5bd2d2ec4c8dd28ae3fcc521cdde26dd5035225fe321d9c0902234a45f2de8ce4dc0e772cc155bf273d613ce55d615dc4cdbd','9000000209','Female','Computer Engineering',3),
(10,'HF2026010','Pooja Menon','pooja.menon@student-hostel.invalid','scrypt$16384$8$1$70daeb0a727c62d2f8882064fea2eb8b$d436360b04ed626ace74fb518875245ec032d2957576854090e73d343ed1361ab26ab36afedbe441a8033ed581bfcc68d3f1169b562a967cad44998d48db80fb','9000000210','Female','Civil Engineering',4),
(11,'HF2026011','Tara Merchant','tara.merchant@student-hostel.invalid','scrypt$16384$8$1$637f1350d7efac98af0c5ba6bff6b1eb$111c939946706d15bffbb36aed422924c0bfdbe910cbc98b2b1b6afd618878d1b30af656c861855b02eaf30ec7ac49fb801cfcbd6c777940a768e0a2416d9cc0','9000000211','Non-binary','Computer Engineering',2),
(12,'HF2026012','Dev Malhotra','dev.malhotra@student-hostel.invalid','scrypt$16384$8$1$d6a5d2dab22ab81d0257985360e64dfd$afe9501a125412c8ac6932bf21d7691661a4d1fa6d2b943357108c9e307a2e1748af5209964702be57f429885063431e9925adfce64c62a685b6e4325b192cf6','9000000212','Male','Information Technology',2);

INSERT INTO STUDENT_PREFERENCE (student_id,sleep_schedule,cleanliness_level,smoking_habit,noise_tolerance,study_habit,budget_min,budget_max,preferred_room_type,move_in_date) VALUES
(1,'Early',4,'Non-smoker',2,'Daily',4000,6500,'Double','2026-11-01'),(2,'Flexible',3,'Non-smoker',3,'Flexible',3500,6000,'Triple','2026-11-05'),
(3,'Late',3,'Occasional',4,'Exam-focused',4000,7000,'Double','2026-11-01'),(4,'Flexible',4,'Non-smoker',3,'Daily',5000,7500,'Double','2026-12-01'),
(5,'Early',2,'Non-smoker',2,'Exam-focused',3500,5000,'Triple','2026-11-15'),(6,'Late',5,'Smoker',4,'Flexible',4000,7000,'Triple','2026-11-12'),
(7,'Early',4,'Non-smoker',2,'Daily',4500,7000,'Double','2026-11-01'),(8,'Flexible',3,'Non-smoker',3,'Flexible',4000,6500,'Triple','2026-11-10'),
(9,'Late',4,'Non-smoker',4,'Exam-focused',4500,7500,'Double','2026-12-01'),(10,'Early',5,'Non-smoker',2,'Daily',5000,8000,'Single','2026-11-20'),
(11,'Flexible',3,'Non-smoker',3,'Flexible',4000,6500,'Double','2026-11-05'),(12,'Late',3,'Occasional',4,'Exam-focused',4500,7000,'Triple','2026-11-15');

-- Requests start pending so triggers create the initial history row. The procedure
-- below approves one request and automatically rejects its competing application.
INSERT INTO BOOKING_REQUEST (request_id,student_id,bed_id,requested_move_in,status,student_note) VALUES
(101,1,1,'2026-11-01','Pending','Quiet student, looking for a long-term stay.'),
(102,2,1,'2026-11-05','Pending','I can move in early.'),
(103,3,3,'2026-11-01','Pending','Near the campus shuttle would be helpful.'),
(104,4,4,'2026-12-01','Pending','I will confirm my travel dates shortly.'),
(105,5,9,'2026-11-15','Pending','Prefer a study-friendly floor.'),
(106,6,12,'2026-11-12','Pending','Please let me know about the mess timings.'),
(107,7,18,'2026-11-01','Pending','Interested in a room near the common study area.'),
(108,8,20,'2026-11-10','Pending','I can attend a viewing this week.'),
(109,9,22,'2026-12-01','Pending','Please share the move-in checklist.'),
(110,10,26,'2026-11-20','Pending','Looking for a calm study environment.'),
(111,11,37,'2026-11-05','Pending','Flexible move-in by a few days.'),
(112,12,43,'2026-11-15','Pending','Interested in the available triple rooms.');

CALL approve_booking_request(101,2);
CALL reject_booking_request(103,2,'Applicant selected a different room.');
CALL cancel_booking_request(104,4);
