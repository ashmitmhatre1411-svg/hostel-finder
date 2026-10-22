USE hostel_finder;

-- Demo password for all seeded accounts: HostelDemo2026!
-- Only salted scrypt hashes are stored in this file.
INSERT INTO OWNER (owner_id,name,email,phone,password_hash) VALUES
(1,'Anita Sharma','anita@hostel-owner.invalid','9000000201','scrypt$16384$8$1$b9f7e008d3c777923f10f645e7b3380d$268a96d48acc55d327c9bf984c0dd30bd8c7f912705d8639533bb999bc150b61422aab94e6b1a0df411722e3751d42faf512904721ec5fd4a72ea513be3ad689'),
(2,'Meera Iyer','meera@hostel-owner.invalid','9000000202','scrypt$16384$8$1$774bb2079440fa0f6b3cea6febb3526e$f93e7490fe62a127e1d7c8148fa8aed0872fd2b6f8245448e642551071a749dfcc51be78e36815ef90a182f0d4ead24617bdf6c65b3ddd0c0709ec868ed44776'),
(3,'Rahul Desai','rahul@hostel-owner.invalid','9000000203','scrypt$16384$8$1$0292d72c2d6a557e51ff1d7fbea62d48$cc61fb84ec1e864ec64e50971013a0a58edeb8f5d2e8349f4b74712479108967abc76a9b5b7d2b9556c4213dcffffa451288d23fbbe32e1b410ee97be505f2a3');

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

INSERT INTO STUDENT (student_id,name,email,password_hash,phone,gender,college) VALUES
(1,'Aarav Desai','aarav.desai@student-hostel.invalid','scrypt$16384$8$1$5cb64ad4ca7927b4ac08ecbe319b5eda$b9888e2f06b41756ce243e78c1889b3b601c85f70d7691536ef5f2e32c74f26df6c89b61d9451dbd621099471637f7e78f280af7fa58c5b4be1b2edf2a46e0c0','9000000301','Male','Sardar Patel Institute of Technology'),
(2,'Rohan Kulkarni','rohan.kulkarni@student-hostel.invalid','scrypt$16384$8$1$6245684e628c82ba16f378dd2a0fa9cb$3a64ec5b620e9f9520edd4451e9c6710886831192d36e6eb2c611c82a5f4eaafa9a0dfadd3e66ce9d019fed32257905fd328bf460704eb0cc4eb1d13f945d509','9000000302','Male','Sardar Patel Institute of Technology'),
(3,'Kabir Shah','kabir.shah@student-hostel.invalid','scrypt$16384$8$1$67d31d26b3cae7de9bbf57e3950bc341$05c516b108013bb446f5ed12a195537a296f6f5daf22f148cb687b4813695abcba09af7f0d51e9fec6550996cc895c820451fdd1c2472847d58f3f89972d8996','9000000303','Male','Sardar Patel Institute of Technology'),
(4,'Sana Merchant','sana.merchant@student-hostel.invalid','scrypt$16384$8$1$dacd1425971337d606f26a32dca99125$98dc1b22b3900aa2e4dceeb52b0eeb86c15489c91e3004b65a7da07cc664a2f4201ce6f4c82b63bb39a09af2f93eb9b984dfa2865231ae411a4244647ac96298','9000000304','Female','Sardar Patel Institute of Technology'),
(5,'Nisha Patil','nisha.patil@student-hostel.invalid','scrypt$16384$8$1$840c093aeb22f6b770e74213762eb341$33b83afadeb3d38f8a084152655541a568ee52a49f9030e429c7ee2027758ae53d91740743dff5c4baa32fd32e8239baa3fea6886d312e2a6533b64b216a851f','9000000305','Female','Sardar Patel Institute of Technology'),
(6,'Ishaan Joshi','ishaan.joshi@student-hostel.invalid','scrypt$16384$8$1$0b25ecd20e0c387cbf5f84a52009d965$a6226995938408fb28f6b1d8c81ab975f236f685434ad2911c4df5e3086de18d5e4a7af39d983bba8c1e21827d18a7de8b0244d4e3f479a3a99c3f8b6bdf812b','9000000306','Male','Sardar Patel Institute of Technology'),
(7,'Ananya Rao','ananya.rao@student-hostel.invalid','scrypt$16384$8$1$f51f2e9999cae9fa16bb92429f22262a$95c4b2d6607fd80d662ab6717386d4461bcda430bd35be50f568184e385816d504907162524bb8fa00795dc8d5d511487b2623a48daeb8b691904c69eba6d18d','9000000307','Female','Sardar Patel Institute of Technology'),
(8,'Dev Mehta','dev.mehta@student-hostel.invalid','scrypt$16384$8$1$3adad41f7d74dfd53f5f1e36031800a3$35056370bd7b04c5efd0682fafae6021db166735f478ba5ccedf34417eb352d7b1f1afe7f2e6623d39c59d4ad8679bf722fb047388bea3ed0622ac6c46440696','9000000308','Male','Sardar Patel Institute of Technology'),
(9,'Mira Fernandes','mira.fernandes@student-hostel.invalid','scrypt$16384$8$1$7a0a468f7eeeb361f0113497b92d4ade$5d1cb42af04e1f7eadf7c523f6bae9709ba1aacbf3471c4f05cc1fc7190d7def3045ac39b9860e4665e10909fdac94e3d038625faf7f0ca54851db9ec6037a02','9000000309','Female','Sardar Patel Institute of Technology'),
(10,'Arjun Nair','arjun.nair@student-hostel.invalid','scrypt$16384$8$1$97e864b6a50787702ded44bcc9f551a6$74bd9ccb4a7fd83b51359e7f7dcfe8bf4485d8838e598178cd2a5cb2642abdf7ea0e73627ecbb90f60c38aa076705594b91020a6e6dd0fa494718dc8d36b84a0','9000000310','Male','Sardar Patel Institute of Technology'),
(11,'Tara Shah','tara.shah@student-hostel.invalid','scrypt$16384$8$1$9eaadda8e92142b8959f86303569fd78$80d87074a2565dcb921d1cfa36f156654d8e40161a5e79ceff703747c91cc368fb3ec157dec280826c80adaa4417d0196e88e41228546973d9ac671cabadfcbc','9000000311','Female','Sardar Patel Institute of Technology'),
(12,'Neel Kamat','neel.kamat@student-hostel.invalid','scrypt$16384$8$1$e796208551ce029265da36a49f1c67f4$bdb48ab6b62d3cba789839b3ad18427c7d9f47ef7a49502610be1de3297e664466a45d9c329de1804d9c06b715ae38a86f280fa869a5d0fc4796deb128fb8192','9000000312','Non-binary','Sardar Patel Institute of Technology');

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
