# Project instructions

This is a DBMS mini-project based on the nine-relation model in `CASE_STUDY.md`. Keep MySQL design and integrity rules central, with a small interface that is easy to explain.

## Technology

- Frontend: plain HTML, CSS, and browser JavaScript. Do not use React, Vite, or a UI library.
- Backend: Node.js using the built-in `http` module. Serve the static page and JSON API from one server.
- Database: MySQL 8.x.
- Only backend npm package: `mysql2`. Use Node's built-in `crypto` only for session tokens.
- Do not use other frameworks or add packages without asking.
- The browser must never connect directly to MySQL. Keep database credentials in `server/.env`, parameterize SQL, and never commit `.env`.
- For this classroom-only version, account passwords are plain `VARCHAR(255)` values because that is the requested DBMS demonstration. Warn that real passwords must never be used.

## Structure and database

- `database/`: schema, seed, views, procedures, verification, and query examples.
- `public/`: `index.html`, `styles.css`, and `app.js`.
- `server/`: the Node HTTP server and its `mysql2` package files.
- Keep exactly the nine relations documented in `CASE_STUDY.md`.
- Procedures lock rooms while approving/cancelling bookings and keep `ROOM.available_beds` synchronized. Calculate compatibility in a view.

## Working method

1. Load and verify the SQL scripts against the dedicated `hostel_finder` database. `schema.sql` recreates its tables.
2. Run the Node server, verify API/database access, and check the browser interface.
3. Do not run Git commands; the user commits with GitHub Desktop unless the user explicitly asks otherwise.
4. Keep code straightforward and document implementation assumptions in `CASE_STUDY.md` and `README.md`.
