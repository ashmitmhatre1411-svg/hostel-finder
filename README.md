# Student Accommodation & Roommate Finder for Hostel

An RDBMS mini-project based on [`CASE_STUDY.md`](CASE_STUDY.md). Students can browse rooms, view compatibility with current occupants, submit booking requests, and track decisions. Hostel administrators manage their own listings and booking decisions. A system administrator creates hostels, administrator accounts, and amenity master data.

## Requirements

- Node.js 20 or later (the server uses `--env-file`)
- MySQL 8.0.16 or later (the schema uses enforced `CHECK` constraints)
- npm

## Database setup

Create a local database, then run the scripts in this order from the repository root:

```sh
mysql -u root -p -e "CREATE DATABASE hostel_finder CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;"
mysql -u root -p hostel_finder < database/schema.sql
mysql -u root -p hostel_finder < database/triggers_procedures.sql
mysql -u root -p hostel_finder < database/views.sql
mysql -u root -p hostel_finder < database/seed.sql
```

`schema.sql` recreates the project tables. Apply it only to the dedicated project database. The core schema has the 11 case-study tables. It adds `AUTH_SESSION` because login must support revocable logout, expiration, and persistence across server restarts. Session tokens are random; only SHA-256 token digests are stored.

The seed contains 3 hostels, 24 rooms, 51 beds, 8 amenities, 12 students and preference records, 1 system administrator, 3 hostel administrators, and booking requests in all four request states. Every contact detail is fake and uses reserved `.invalid` email domains or `9000000xxx` phone numbers. Demo password hashes were generated with the server's scrypt format.

## Run the application

Open two terminals from the repository root.

Server terminal:

```sh
cd server
npm install
Copy-Item .env.example .env
```

Edit `server/.env` with the local database username and password, then run:

```sh
npm start
```

Client terminal:

```sh
cd client
npm install
npm run dev
```

Open <http://localhost:5173>. The default API address is `http://localhost:3000/api`; configure `VITE_API_URL` in a client `.env` file if the server uses another address. The backend allows the client origin in `CLIENT_ORIGIN`; configure it if Vite uses a different origin. Never put database credentials in the client and never commit `.env` files.

## Demo logins

All seeded accounts use the password `HostelDemo2026!`.

| Role | Email | Scope |
|---|---|---|
| System admin | `system-admin@hostel-finder.invalid` | Hostel/account/amenity setup and summary counts |
| Hostel admin | `boys-admin@hostel-finder.invalid` | Aarohan Boys Residence |
| Hostel admin | `girls-admin@hostel-finder.invalid` | Sakhi Girls Hostel |
| Hostel admin | `coed-admin@hostel-finder.invalid` | Campus Grove Living |
| Student | `aarav.desai@student-hostel.invalid` | Seeded approved request |
| Student | `rohan.kulkarni@student-hostel.invalid` | Seeded auto-rejected competing request |

Any other seeded student can also sign in with the same demo password. These accounts and passwords are for local demonstration only.

## API overview

All routes return JSON. Authenticated routes use `Authorization: Bearer <token>`. Login is rate-limited; sessions expire after 12 hours, and logout revokes the stored token digest. Every SQL value is bound as a parameter; only allow-listed SQL identifiers and fixed sort expressions are interpolated.

- `POST /api/auth/register`, `/api/auth/login`, `/api/auth/logout`
- `GET/PATCH /api/me`, `PUT /api/me/preferences`
- `GET /api/hostels`, `/api/hostels/:id`, `/api/rooms`, `/api/rooms/:id`, `/api/rooms/:id/compatibility`, `/api/amenities`
- `POST/GET /api/requests`, `GET /api/requests/:id`, `POST /api/requests/:id/cancel`
- `GET /api/admin/requests`, `POST /api/admin/requests/:id/approve|reject`, `GET /api/admin/occupancy`
- Hostel admin listing routes: `GET/POST /api/admin/rooms`, `PATCH /api/admin/rooms/:id`, `POST /api/admin/beds`, `PATCH /api/admin/beds/:id`, `POST /api/admin/hostel-amenities`, `POST /api/admin/allocations/:id/end`
- System admin routes: `GET/POST/PATCH /api/system/hostels`, `POST /api/system/admins`, `POST/PATCH /api/system/amenities`
- `GET /api/history` returns the signed-in student's history, the hostel admin's own hostel history, or a system-admin status summary.

## Practical domain decisions

- Student gender values are `Male`, `Female`, `Non-binary`, and `Undisclosed`. Boys hostels accept Male students; Girls hostels accept Female students; Co-ed hostels accept any of the values. This rule is checked when a request is inserted and again at approval.
- Allocation status is `Active`, `Completed`, or `Cancelled`. An active allocation has no `end_date`; completed or cancelled allocations have one. Only Active allocations prevent a student from opening a new pending request.
- Study habit uses `Daily`, `Flexible`, and `Exam-focused`. Equal values score the full 15 points; `Flexible` paired with either other value scores 7.5; `Daily` paired with `Exam-focused` scores 0.
- The schema uses conventional MySQL data types and lengths because the case study lists keys and constraints but not concrete sizes.
- Compatibility is derived in `v_student_compatibility`, never stored. Sleep: same 25, Flexible against Early/Late 12.5, Early against Late 0. Cleanliness and noise use the Section 17 difference formula. Smoking: same 20, Non-smoker against Smoker 0, other mismatches 10.
- The database uses database-side triggers to create a history row for each request insertion and every later status change. The approval procedure locks the bed and performs the request, allocation, bed, and competing-request updates in a transaction.

## Case-study implementation map

| Case-study section | Project files / implementation |
|---|---|
| 10 Functional requirements | `server/index.js`; `client/src/App.jsx` |
| 11 Non-functional requirements | `server/security.js`, API validation/CORS/rate limiting, parameterized SQL, and responsive/accessibility styles in `client/src/styles.css` |
| 12 Roles and permissions | `server/index.js` authorization helpers and role-specific routes; hostel ownership is checked on every management/decision route |
| 13 Workflow | Student requests, admin review/decision, cancellation, status history, and allocation completion SQL procedure |
| 14 Architecture | `/client` React/Vite frontend, `/server` Node built-in HTTP API, `/database` MySQL scripts |
| 15 Entities and relationships | `database/schema.sql`; 11 core tables plus the required `AUTH_SESSION` table |
| 16 Keys, constraints, and business rules | `database/schema.sql`, `database/triggers_procedures.sql` |
| 17 Compatibility | `database/views.sql`, `/api/rooms/:id/compatibility`, and the documented matching rules above |

## SQL demo queries

`database/queries.sql` demonstrates budget/room/amenity filtering, availability counts, compatibility ranking, pending requests by hostel, and booking history. Replace the example IDs and filter values before running against modified data. `database/verification.sql` runs non-destructive database checks for the seeded double-request outcome, gender policy, pending-request limits, active allocation limits, and hostel-admin scope.

## Verification checklist

The database scripts enforce and demonstrate double-booking protection, competing-request auto-rejection, gender-policy validation, one pending request or active allocation per student, and hostel-admin scope. `database/verification.sql` reports PASS/FAIL for the database checks. A successful response from `GET /api/health` confirms the API process is running; the client build is checked with `npm run build`. The API binds user input as SQL parameters, including room search text; try `GET /api/rooms?q=%27%20OR%201%3D1%20--` to check an injection-shaped search value is treated as plain text.

## Folder guide

- `database/schema.sql`: table creation and declarative constraints.
- `database/triggers_procedures.sql`: status audit triggers and transactional booking operations.
- `database/views.sql`: derived compatibility score.
- `database/seed.sql`: demo records and initial booking lifecycle.
- `database/queries.sql`: class demonstration queries.
- `server/index.js`: HTTP API, authentication, validation, roles, and database access.
- `server/security.js`: scrypt password hashing and random session-token helpers.
- `client/src/App.jsx`: application screens and client workflows.
- `client/src/styles.css`: responsive visual styling.
- `AGENTS.md`: persistent project stack and working rules.
