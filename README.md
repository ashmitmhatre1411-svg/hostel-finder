# Hostel Finder — DBMS Mini Project

A small hostel and roommate finder built to demonstrate a relational MySQL database. The browser interface uses plain HTML, CSS, and JavaScript. A small Node.js server serves the page and API; the browser cannot connect directly to MySQL.

## Project folders

- `database/` — schema, sample data, queries, views, procedures, and verification SQL.
- `public/` — the three browser files: `index.html`, `styles.css`, and `app.js`.
- `server/` — the Node HTTP server and `mysql2` database connector.

## Run on Windows

Start the MySQL service in PowerShell. If it is already running, continue to the next step:

```powershell
Get-Service MySQL80
# If stopped, run PowerShell as Administrator and use:
Start-Service MySQL80
```

Configure the API once. Edit `server\.env` and set your local MySQL connection details; keep the file private and do not commit it.

```powershell
Set-Location "C:\Users\ashmi\OneDrive\Documents\GitHub\hostel-finder\server"
npm install
if (!(Test-Path .env)) { Copy-Item .env.example .env }
# Edit .env: set DB_USER, DB_PASSWORD, and DB_NAME=hostel_finder.
npm start
```

Open <http://localhost:3000>. The Node server serves both the website and its `/api` routes, so you only need one application terminal (plus MySQL running in the background).

## Database setup

From the project root, create the dedicated database once and load the scripts in order. The schema script drops and recreates the project's nine tables; back up data before applying it again.

```powershell
Set-Location "C:\Users\ashmi\OneDrive\Documents\GitHub\hostel-finder"
mysql -u root -p -e "CREATE DATABASE hostel_finder CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
cmd.exe /c "mysql -u root -p hostel_finder < database\schema.sql"
cmd.exe /c "mysql -u root -p hostel_finder < database\triggers_procedures.sql"
cmd.exe /c "mysql -u root -p hostel_finder < database\views.sql"
cmd.exe /c "mysql -u root -p hostel_finder < database\seed.sql"
```

Each `-p` asks for the MySQL login password. Run `database/verification.sql` once after seeding; it changes the sample bookings to demonstrate approval and automatic rejection.

### Upgrade the previous hashed-password database

For an existing database from the earlier version, back it up and run `database/migrate_plain_passwords.sql` once instead of reloading `schema.sql`. The migration preserves hostel and booking data, renames both password columns, and resets existing hashed accounts to the shared demo password because hashes cannot be reversed.

## Demo accounts

All seeded accounts use the shared demo password `HostelDemo2026!`.

| Role | Email |
|---|---|
| Student | `aarav.desai@student-hostel.invalid` |
| Hostel owner | `anita@hostel-owner.invalid` |
| Hostel owner | `meera@hostel-owner.invalid` |
| Hostel owner | `rahul@hostel-owner.invalid` |

The database stores passwords as plain text in `VARCHAR(255)` columns because this classroom project is meant to demonstrate the database schema. This is not safe for real accounts. Use only the fake demo accounts and never reuse personal passwords.

## Nine relations

`OWNER`, `HOSTEL`, `FACILITY`, `HOSTEL_FACILITY`, `ROOM`, `STUDENT`, `ROOMMATE_PREFERENCE`, `BOOKING`, and `REVIEW` follow the submitted report. `HOSTEL_FACILITY` links hostels and facilities; `BOOKING` links students and rooms; `REVIEW` uses `(student_id, hostel_id)` as its key. Password is a normal `VARCHAR(255)` field in `OWNER` and `STUDENT`.

The report leaves some details open. This project uses hostel categories Boys/Girls/Co-ed; room categories Single/Double/Triple; booking states Pending/Approved/Rejected/Cancelled; and a simple compatibility view that equally weights smoking, sleep, and food while scoring cleanliness by distance on a 1–5 scale. Budget filters room rent. The approval procedure locks the room and maintains `available_beds` in a transaction. These choices are listed in `CASE_STUDY.md`.

## Key files

- `database/schema.sql` — nine tables, keys, checks, foreign keys, and indexes.
- `database/triggers_procedures.sql` — booking validation and transaction procedures.
- `database/views.sql` — calculated roommate compatibility.
- `database/seed.sql` — fake Indian college sample data and demo accounts.
- `database/queries.sql` — examples for room filters, availability, compatibility, and bookings.
- `database/verification.sql` — sample integrity checks.
- `server/index.js` — serves static pages and the JSON API, with MySQL access through parameterized queries.
- `public/index.html`, `public/styles.css`, `public/app.js` — plain, responsive, readable browser interface.

The UI supports room search and filtering, student profile/preferences/bookings/reviews, and owner hostel/room/facility management and booking decisions. Student roommate matches show the other student's phone number; hostel owners see an applicant's phone and email while a request is Pending. See `CASE_STUDY.md` for table relationships and implementation assumptions.
