# Student Accommodation and Roommate Finder

A small DBMS mini project centered on the MySQL model in [`CASE_STUDY.md`](CASE_STUDY.md). Owners list hostels, rooms, and facilities. Students search by city, rent, and facilities; save roommate preferences; book a room; and review a hostel. The interface stays deliberately simple so the database and its relationships remain the focus.

## Technology

- MySQL 8.x for the nine-relational schema, constraints, view, triggers, and booking procedures.
- Node.js 20+ with the built-in `http` module for a small JSON API.
- React and Vite for the browser interface.
- `mysql2` is the only backend package. The client uses React and Vite packages.

## Database setup on Windows

Open PowerShell as Administrator if the MySQL service is stopped. The service installed for this project is `MySQL80`:

```powershell
Start-Service MySQL80
Get-Service MySQL80
```

From the project root, create the database once and apply the scripts in order:

```powershell
mysql -u root -p -e "CREATE DATABASE hostel_finder CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
cmd.exe /c "mysql -u root -p hostel_finder < database\schema.sql"
cmd.exe /c "mysql -u root -p hostel_finder < database\triggers_procedures.sql"
cmd.exe /c "mysql -u root -p hostel_finder < database\views.sql"
cmd.exe /c "mysql -u root -p hostel_finder < database\seed.sql"
```

Each `-p` prompts for the MySQL password; do not put it in the command. **`schema.sql` drops and recreates the nine project tables. Back up any existing data before reapplying it.** Run `database/verification.sql` once after seeding; it approves the test booking and auto-rejects the competing request when the last bed is taken.

## Run the API and client

Set up the server environment one time:

```powershell
Set-Location .\server
npm install
Copy-Item .env.example .env
```

Edit `server\.env` with your local database credentials. Then run `npm start` in one PowerShell terminal. In a second terminal:

```powershell
Set-Location .\client
npm install
npm run dev
```

Open the local URL printed by Vite, normally <http://localhost:5173>. The API defaults to <http://localhost:3000/api>. Keep both terminals open. Never put database credentials in the client or commit `.env`.

## Demo accounts

All seeded accounts use `HostelDemo2026!`.

| Role | Email |
|---|---|
| Student | `aarav.desai@student-hostel.invalid` |
| Hostel owner | `anita@hostel-owner.invalid` |
| Hostel owner | `meera@hostel-owner.invalid` |
| Hostel owner | `rahul@hostel-owner.invalid` |

The other seeded students use the same demo password. These sample accounts are for local demonstration only.

## Database overview

The schema has exactly the nine relations shown in the submitted report: `OWNER`, `HOSTEL`, `FACILITY`, `HOSTEL_FACILITY`, `ROOM`, `STUDENT`, `ROOMMATE_PREFERENCE`, `BOOKING`, and `REVIEW`. `HOSTEL_FACILITY` implements the hostel-to-facility many-to-many relationship. `BOOKING` connects students to rooms; `REVIEW` uses `(student_id, hostel_id)` so a student can leave one review per hostel.

The report lists `password`; the implementation calls it `password_hash` and stores salted scrypt hashes. It lists `available_beds`; booking procedures keep that count synchronized with approved bookings. The approval procedure uses a transaction and `SELECT ... FOR UPDATE` on the room row to prevent two owners from approving the last bed concurrently. Cancelling an approved booking makes its place available again.

The report does not set exact booking status values, preference categories, or compatibility weights. The project uses Pending, Approved, Rejected, and Cancelled; three room types; the categories in `CASE_STUDY.md`; and a 100-point compatibility view that gives smoking, sleep, and food equal weight while scoring cleanliness by distance on a 1–5 scale. Budget is used for room search, not the roommate score. These are documented implementation assumptions.

No bed, admin, audit-history, or database-session relation is added. Owners manage their own hostels. Login tokens are held in memory, expire after 12 hours, and are cleared at logout or API restart.

## Main API routes

- Accounts: `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET/PATCH /api/me`.
- Search: `GET /api/hostels`, `GET /api/hostels/:id`, `GET /api/rooms`, `GET /api/facilities`.
- Student: `GET/PUT /api/me/preferences`, `GET /api/me/compatibility`, `GET/POST /api/bookings`, `POST /api/bookings/:id/cancel`, `POST /api/reviews`.
- Owner: `GET/POST /api/owner/hostels`, `PUT /api/owner/hostels/:id/facilities`, `POST /api/owner/rooms`, `GET /api/owner/bookings`, `POST /api/owner/bookings/:id/approve|reject`.

All values are sent to MySQL as parameters. Search sort choices use a fixed allow-list. Owners can only change bookings and hostel data belonging to their own accounts.

## Project files

- `er_diagram.png`: the entity-relationship diagram from the submitted report.
- `database/schema.sql`: the nine tables, keys, foreign keys, checks, and indexes.
- `database/triggers_procedures.sql`: gender validation, status transition rules, and booking procedures.
- `database/views.sql`: calculated roommate compatibility; scores are not stored.
- `database/seed.sql`: three owners and hostels, rooms, facilities, twelve students and preferences, sample bookings, and reviews.
- `database/queries.sql`: room filtering, availability, compatibility ranking, pending bookings, booking history, and ratings.
- `database/verification.sql`: booking capacity, gender policy, and owner-scope checks.
- `server/index.js`: Node HTTP API, authentication, validation, and database calls.
- `client/src/App.jsx` and `client/src/styles.css`: simple responsive search, student, and owner screens.

## Verification

The implementation was checked by loading the SQL into MySQL, running the SQL verification script, checking the API routes, and building the React client. The key database checks cover last-bed double booking, competing requests, gender mismatch, and cross-owner booking decisions. The parameterized room search was also checked with an injection-shaped query.
