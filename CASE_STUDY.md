# Student Accommodation and Roommate Finder for Hostel

## Purpose

Students need one place to find hostels, compare monthly rent and facilities, state roommate preferences, request rooms, and review hostels. Owners list their hostels, rooms, and facilities and decide booking requests. MySQL is the main project deliverable; the website is a small interface for demonstrating the database.

## Relational model

The project uses the nine relations shown in the submitted mini-project report. `PK` means primary key, `FK` means foreign key, and `UQ` means unique.

![ER diagram from the submitted report](er_diagram.png)

1. `OWNER(owner_id PK, name, email UQ, phone, password)`
2. `HOSTEL(hostel_id PK, name, address, city, gender_type, owner_id FK)`
3. `FACILITY(facility_id PK, facility_name UQ)`
4. `HOSTEL_FACILITY(hostel_id PK/FK, facility_id PK/FK)`
5. `ROOM(room_id PK, room_type, capacity, rent_per_month, available_beds, hostel_id FK)`
6. `STUDENT(student_id PK, name, email UQ, password, phone, gender, college)`
7. `ROOMMATE_PREFERENCE(pref_id PK, smoking, sleep_schedule, food_type, cleanliness, max_budget, student_id FK/UQ)`
8. `BOOKING(booking_id PK, booking_date, check_in_date, status, student_id FK, room_id FK)`
9. `REVIEW(student_id PK/FK, hostel_id PK/FK, rating, comment)`

The project uses a plain `VARCHAR(255)` password column because this is a local DBMS demonstration. Seed accounts use the shared demo password shown in the README. Never use real passwords with this project.

## Relationships

- One owner can own many hostels; each hostel belongs to one owner.
- One hostel contains many rooms.
- Hostels offer many facilities, and a facility can be offered by many hostels. `HOSTEL_FACILITY` resolves this many-to-many relationship.
- A student has one roommate-preference row. The unique foreign key on `student_id` enforces the one-to-one relationship.
- Students and rooms have a many-to-many relationship represented by `BOOKING`.
- Students and hostels have a many-to-many relationship represented by `REVIEW`. A student can review each hostel once; the `(student_id, hostel_id)` pair is the primary key.

## Practical rules added for implementation

The report does not define all domain values or algorithms, so this implementation uses explicit, simple choices:

- Hostel gender types are `Boys`, `Girls`, and `Co-ed`; student gender values are `Male`, `Female`, `Non-binary`, and `Undisclosed`. Boys hostels accept Male students, girls hostels accept Female students, and co-ed hostels accept all values.
- Room types are `Single`, `Double`, and `Triple`. Capacity is stored separately so the number of occupants is explicit.
- Booking states are `Pending`, `Approved`, `Rejected`, and `Cancelled`. Owners approve or reject pending requests. Approval locks the room row and decrements `available_beds` in the same transaction; cancellation of an approved booking increments it again.
- `available_beds` is included in the report and stored for quick browsing. Booking procedures keep it synchronized with approved bookings.
- Compatibility is not given numeric weights in the report. The project gives smoking, sleep schedule, and food type equal weight, and scores cleanliness by its distance on a 1–5 scale. The view computes the percentage instead of storing it. `max_budget` filters rooms by rent rather than affecting roommate compatibility.
- Authenticated students with saved roommate preferences can see each match's phone number, name, and college to contact potential roommates. Hostel owners see a student's phone number and email only while that student's booking is Pending, so they can review the request before deciding.
- Food choices are `Vegetarian`, `Eggetarian`, `Non-vegetarian`, and `Vegan`; sleep choices are `Early`, `Flexible`, and `Late`; cleanliness is 1–5.
- The report specifies nine relations and no booking-history, bed-level, administrator, or session table. The database keeps the nine relations. API login tokens are held in memory, expire after 12 hours, and are cleared on logout or API restart.

## Application scope

The interface uses plain HTML, CSS, and browser JavaScript: public room search, a student account for preferences/bookings/reviews, and an owner dashboard for hostels, facilities, rooms, and booking decisions. A small Node.js server serves the pages and JSON API. Only the server connects to MySQL.
