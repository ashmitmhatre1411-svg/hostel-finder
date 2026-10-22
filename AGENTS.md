# Project instructions

This repository follows the nine-relation mini-project model documented in `CASE_STUDY.md`, based on the user's submitted DBMS report. Keep MySQL schema design and integrity rules as the main focus; keep the React interface simple and easy to explain.

## Technology

- Frontend: HTML, CSS, JavaScript, and React. Use Vite only as build tooling.
- Backend: Node.js and the built-in `http` module. Do not add a server framework.
- Database: MySQL 8.x.
- Allowed npm packages: `mysql2`, React, and React's Vite tooling. Use Node's built-in crypto `scrypt` and `--env-file`.
- Do not use PHP, Python, Java, Firebase, MongoDB, TypeScript, Tailwind, or a UI library. Ask before adding another dependency.
- The browser must not connect to MySQL. Keep credentials in the server environment, parameterize values, and never commit `.env`.

## Required database relations

Implement the nine relations from `CASE_STUDY.md`: `OWNER`, `HOSTEL`, `FACILITY`, `HOSTEL_FACILITY`, `ROOM`, `STUDENT`, `ROOMMATE_PREFERENCE`, `BOOKING`, and `REVIEW`. Do not add bed, administrator, audit-history, or database-session tables without an updated user requirement. Password attributes must hold salted hashes.

Keep relationship keys and checks in MySQL. Stored procedures must lock rooms while approving/cancelling bookings and maintain `ROOM.available_beds`. Calculate roommate compatibility in a view; do not store scores.

## Working method

1. Implement database schema, seed, procedures, view, and query examples first. Apply them only to the dedicated `hostel_finder` database; `schema.sql` recreates its tables.
2. Then implement and verify the Node API, followed by a simple accessible React interface.
3. Do not run Git commands; the user commits with GitHub Desktop.
4. Keep code straightforward and commented enough for a college student to explain.
5. Document which values and rules were not specified by the submitted report and how this project fills those gaps.
