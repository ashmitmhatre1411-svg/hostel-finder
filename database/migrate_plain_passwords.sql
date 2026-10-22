-- Run once against a database created by the previous hashed-password version.
-- Existing hashes cannot be converted back to their original passwords, so
-- affected demo accounts are reset to the shared local demo password.
USE hostel_finder;

ALTER TABLE OWNER
  CHANGE COLUMN password_hash password VARCHAR(255) NOT NULL;

ALTER TABLE STUDENT
  CHANGE COLUMN password_hash password VARCHAR(255) NOT NULL;

UPDATE OWNER
SET password = 'HostelDemo2026!'
WHERE password LIKE 'scrypt$%';

UPDATE STUDENT
SET password = 'HostelDemo2026!'
WHERE password LIKE 'scrypt$%';
