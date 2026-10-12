# Project instructions

This repository implements the Student Accommodation & Roommate Finder for Hostel described in `CASE_STUDY.md`. Treat that document as the source of truth for requirements, entities, relationships, keys, constraints, roles, workflow, and compatibility rules. If another instruction conflicts with it, follow the case study and report the conflict.

## Strict technology stack

- Frontend: HTML, CSS, JavaScript, and React. Use Vite only as build tooling.
- Backend: Node.js using only the built-in `http` module for routing. Do not use Express or any other framework.
- Database: MySQL 8.x.
- Allowed packages: `mysql2`, React, and React's Vite tooling. Use Node's built-in `crypto` (`scrypt`) for password hashing and session tokens, and Node's `--env-file` flag instead of `dotenv`.
- Do not use PHP, Python, Java, Firebase, MongoDB, TypeScript, Tailwind, or any UI library. Before adding any other dependency, stop and ask the user.
- The browser must never connect to MySQL. Credentials belong only in server-side environment variables. Parameterize every query. Never commit `.env`.

## Required repository structure

- `/database`: `schema.sql`, `triggers_procedures.sql`, `views.sql`, `seed.sql`, and `queries.sql`.
- `/server`: Node.js API.
- `/client`: React app.
- `README.md`: setup and run steps, plus a mapping from each implementation part to the case-study sections.

## Database requirements

1. Implement exactly the 11 tables in Section 15 (STUDENT, STUDENT_PREFERENCE, ADMIN, HOSTEL, AMENITY, HOSTEL_AMENITY, ROOM, BED, BOOKING_REQUEST, ALLOCATION, BOOKING_STATUS_HISTORY), with keys, UNIQUE, NOT NULL, CHECK, ENUM, DEFAULT, ON DELETE rules, and indexes from Section 16. Add a session table only if needed, and report if one is added.
2. Create tables in the dependency order from Section 15.3.
3. Enforce Section 16 business rules with triggers or stored procedures: gender must match hostel type; a student may have at most one Pending request or active allocation; a Booked bed cannot be requested; every status change is logged to BOOKING_STATUS_HISTORY.
4. Approval must be a stored procedure using one transaction and `SELECT ... FOR UPDATE` on the bed. It sets the bed to Booked, the request to Approved, inserts the ALLOCATION, auto-rejects other Pending requests for that bed, and writes history rows. Rejection and cancellation must use the same status-change and history rules.
5. Do not store compatibility scores. Create a view or function using Section 17 weights (sleep 25, cleanliness 25, smoking 20, noise 15, study 15; total 100) and its matching rules. State any rule that must be defined, including study-habit partial matches.
6. `seed.sql` must include at least 3 hostels (boys, girls, co-ed), 20+ rooms, 50+ beds, 8 amenities, 12 students with preferences, 1 system admin, 3 hostel admins, and booking requests in every status with matching allocations and history. Use realistic Indian college data with clearly fake contact details. Do not store plain-text passwords: seed hashes must use the same scrypt scheme as the server, and the README must list demo logins.
7. `queries.sql` must demonstrate filtering by budget, room type, and amenities; availability counts; compatibility ranking; pending requests per hostel; and booking history.

## Backend requirements

Implement a REST/JSON API for student registration, login and logout; profile and preferences; hostel listing and detail; room/bed search with all FR5 filters and sorting; room compatibility; submitting, listing and cancelling booking requests; request status and history; admin review, approval and rejection; hostel/room/bed/amenity management; system-admin creation of hostels and admin accounts; and booking history by role.

Apply role-based access exactly as in the Section 12 permission table. Hostel admins may only manage their own hostel. Validate all input on the server, return consistent JSON errors with correct status codes, restrict CORS to the client origin, rate-limit login, and never expose password hashes or other students' contact details. Compatibility responses show only the percentage and lifestyle labels.

## Frontend requirements

Build a responsive and accessible interface with labels, adequate contrast, and keyboard support, without a UI library.

- Student screens: registration, login, profile and preferences, hostel browsing, filtering and search, room detail with availability and compatibility, booking request form, and “My requests” with status and history.
- Admin screens: pending requests with approve/reject and remark, hostel/room/bed/amenity management, occupancy, and history.
- System-admin screens: create hostels and admin accounts, and manage amenity master data.
- Every form needs client-side validation and loading, empty, and error states.

## Working method

1. Build in this order: database, backend, frontend. After each stage, run and verify it before moving on (load SQL into MySQL, call the endpoints, then test the UI).
2. Do not run Git commands; the user commits with GitHub Desktop.
3. Test and show results for: double booking prevention when two students request one bed; approval auto-rejecting the competing request; rejection of a gender-mismatched request; prevention of a student's second Pending request; a hostel admin being unable to act on another hostel; and SQL injection attempts failing.
4. Keep code simple and well commented so a college student can explain every file.
5. At completion, list what was built against Sections 10–17 of the case study, along with deviations and assumptions.
