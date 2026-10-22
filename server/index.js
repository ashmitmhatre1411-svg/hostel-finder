import http from 'node:http';
import { URL } from 'node:url';
import mysql from 'mysql2/promise';
import { hashPassword, verifyPassword, newSessionToken } from './security.js';

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hostel_finder',
  waitForConnections: true,
  connectionLimit: 10,
  dateStrings: true,
  decimalNumbers: true
});

// Sessions live in memory to keep the database at the nine relations in the report.
// They expire after 12 hours and are cleared when a user logs out or the API restarts.
const sessions = new Map();
const loginAttempts = new Map();
const MAX_BODY = 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (status, message) => { const error = new Error(message); error.status = status; throw error; };
const query = async (sql, values = []) => {
  const [rows] = await pool.execute(sql, values);
  return rows;
};

function positiveId(value, name = 'id') {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id < 1) fail(400, `Invalid ${name}`);
  return id;
}

function validEmail(value) {
  if (typeof value !== 'string' || value.length > 254 || !EMAIL.test(value)) fail(400, 'Enter a valid email address');
}

function validDate(value, name) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) fail(400, `${name} must be a valid date`);
  const date = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(date.valueOf()) || date.toISOString().slice(0, 10) !== value) fail(400, `${name} must be a valid date`);
}

async function readBody(request) {
  let raw = '';
  for await (const chunk of request) {
    raw += chunk;
    if (raw.length > MAX_BODY) fail(413, 'Request body is too large');
  }
  if (!raw) return {};
  try {
    const value = JSON.parse(raw);
    if (!value || Array.isArray(value) || typeof value !== 'object') fail(400, 'JSON object required');
    return value;
  } catch (error) {
    if (error.status) throw error;
    fail(400, 'Invalid JSON body');
  }
}

function send(response, status, payload) {
  const text = JSON.stringify(payload);
  response.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': Buffer.byteLength(text),
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  });
  response.end(text);
}

function sessionUser(request) {
  const token = (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
  const session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) {
    if (session) sessions.delete(token);
    fail(401, 'Sign in to continue');
  }
  return { ...session.user, token };
}

function requireUser(request, kind = null) {
  const user = sessionUser(request);
  if (kind && user.kind !== kind) fail(403, `${kind === 'owner' ? 'Owner' : 'Student'} access required`);
  return user;
}

async function getOwnedHostel(ownerId, hostelId) {
  const rows = await query('SELECT hostel_id FROM HOSTEL WHERE hostel_id = ? AND owner_id = ?', [hostelId, ownerId]);
  if (!rows.length) fail(404, 'Hostel not found for this owner');
  return rows[0];
}

async function registerAccount(data) {
  const kind = data.kind;
  if (!['student', 'owner'].includes(kind)) fail(400, 'Choose Student or Owner');
  for (const field of ['name', 'email', 'phone', 'password']) {
    if (typeof data[field] !== 'string' || !data[field].trim()) fail(400, `${field} is required`);
  }
  validEmail(data.email);
  if (data.name.trim().length > 120 || data.phone.trim().length > 24) fail(400, 'Name or phone is too long');
  if (data.password.length < 10 || !/[A-Za-z]/.test(data.password) || !/[0-9]/.test(data.password)) {
    fail(400, 'Password must have at least 10 characters and include a letter and number');
  }
  const passwordHash = await hashPassword(data.password);

  if (kind === 'owner') {
    const result = await query('INSERT INTO OWNER (name,email,phone,password_hash) VALUES (?,?,?,?)',
      [data.name.trim(), data.email.trim().toLowerCase(), data.phone.trim(), passwordHash]);
    return { kind, id: result.insertId, name: data.name.trim(), email: data.email.trim().toLowerCase() };
  }

  if (!['Male', 'Female', 'Non-binary', 'Undisclosed'].includes(data.gender)) fail(400, 'Choose a valid gender');
  if (typeof data.college !== 'string' || !data.college.trim() || data.college.length > 150) fail(400, 'College is required');
  const result = await query('INSERT INTO STUDENT (name,email,password_hash,phone,gender,college) VALUES (?,?,?,?,?,?)',
    [data.name.trim(), data.email.trim().toLowerCase(), passwordHash, data.phone.trim(), data.gender, data.college.trim()]);
  return { kind, id: result.insertId, name: data.name.trim(), email: data.email.trim().toLowerCase() };
}

function hostelFilters(searchParams) {
  const where = [];
  const values = [];
  const text = searchParams.get('q')?.trim();
  if (text) {
    where.push('(h.name LIKE ? OR h.city LIKE ? OR h.address LIKE ?)');
    values.push(`%${text}%`, `%${text}%`, `%${text}%`);
  }
  const city = searchParams.get('city')?.trim();
  if (city) { where.push('h.city LIKE ?'); values.push(`%${city}%`); }
  const genderType = searchParams.get('genderType');
  if (genderType && ['Boys', 'Girls', 'Co-ed'].includes(genderType)) {
    where.push('h.gender_type = ?'); values.push(genderType);
  }
  const roomType = searchParams.get('roomType');
  if (roomType && ['Single', 'Double', 'Triple'].includes(roomType)) {
    where.push('EXISTS (SELECT 1 FROM ROOM rx WHERE rx.hostel_id = h.hostel_id AND rx.room_type = ?)');
    values.push(roomType);
  }
  const maxRent = searchParams.get('maxRent');
  if (maxRent !== null && maxRent !== '') {
    const amount = Number(maxRent);
    if (!Number.isFinite(amount) || amount < 0) fail(400, 'Maximum rent must be a non-negative number');
    where.push('EXISTS (SELECT 1 FROM ROOM rx WHERE rx.hostel_id = h.hostel_id AND rx.rent_per_month <= ? AND rx.available_beds > 0)');
    values.push(amount);
  }
  const facility = searchParams.get('facility')?.trim();
  if (facility) {
    where.push('EXISTS (SELECT 1 FROM HOSTEL_FACILITY hfx JOIN FACILITY fx ON fx.facility_id=hfx.facility_id WHERE hfx.hostel_id=h.hostel_id AND fx.facility_name = ?)');
    values.push(facility);
  }
  return { sql: where.length ? `WHERE ${where.join(' AND ')}` : '', values };
}

async function ownerBookingDecision(ownerId, bookingId, action) {
  const rows = await query(`SELECT h.owner_id FROM BOOKING b
    JOIN ROOM r ON r.room_id = b.room_id JOIN HOSTEL h ON h.hostel_id = r.hostel_id
    WHERE b.booking_id = ?`, [bookingId]);
  if (!rows.length) fail(404, 'Booking not found');
  if (Number(rows[0].owner_id) !== Number(ownerId)) fail(403, 'You can only manage bookings for your own hostels');
  await query(`CALL ${action}_booking(?, ?)`, [bookingId, ownerId]);
}

async function route(request, response, url) {
  const path = url.pathname.replace(/\/$/, '') || '/';
  const method = request.method;
  if (method === 'OPTIONS') { response.writeHead(204); return response.end(); }

  if (method === 'GET' && path === '/api/health') {
    await query('SELECT 1 AS database_ok');
    return send(response, 200, { ok: true, service: 'hostel-finder-api', database: 'connected' });
  }

  if (method === 'GET' && path === '/api/facilities') {
    return send(response, 200, { ok: true, items: await query('SELECT facility_id, facility_name FROM FACILITY ORDER BY facility_name') });
  }

  if (method === 'GET' && path === '/api/hostels') {
    const filters = hostelFilters(url.searchParams);
    const items = await query(`SELECT h.hostel_id,h.name,h.address,h.city,h.gender_type,h.owner_id,
      (SELECT GROUP_CONCAT(f.facility_name ORDER BY f.facility_name SEPARATOR ', ')
       FROM HOSTEL_FACILITY hf JOIN FACILITY f ON f.facility_id=hf.facility_id WHERE hf.hostel_id=h.hostel_id) AS facilities,
      (SELECT COUNT(*) FROM ROOM r WHERE r.hostel_id=h.hostel_id) AS room_count,
      (SELECT COALESCE(SUM(r.available_beds),0) FROM ROOM r WHERE r.hostel_id=h.hostel_id) AS available_beds,
      (SELECT MIN(r.rent_per_month) FROM ROOM r WHERE r.hostel_id=h.hostel_id AND r.available_beds>0) AS starting_rent
      FROM HOSTEL h ${filters.sql} ORDER BY h.city,h.name LIMIT 100`, filters.values);
    return send(response, 200, { ok: true, items });
  }

  if (method === 'GET' && path === '/api/rooms') {
    const filters = hostelFilters(url.searchParams);
    const sort = url.searchParams.get('sort');
    const orderBy = sort === 'rent-desc' ? 'r.rent_per_month DESC' : sort === 'rent' ? 'r.rent_per_month ASC' : 'h.city,h.name,r.room_type,r.room_id';
    const items = await query(`SELECT r.room_id,r.room_type,r.capacity,r.rent_per_month,r.available_beds,
      h.hostel_id,h.name AS hostel_name,h.city,h.gender_type,
      (SELECT GROUP_CONCAT(f.facility_name ORDER BY f.facility_name SEPARATOR ', ')
       FROM HOSTEL_FACILITY hf JOIN FACILITY f ON f.facility_id=hf.facility_id WHERE hf.hostel_id=h.hostel_id) AS facilities
      FROM ROOM r JOIN HOSTEL h ON h.hostel_id=r.hostel_id
      ${filters.sql.replaceAll('h.', 'h.')} ${filters.sql ? 'AND' : 'WHERE'} r.available_beds > 0
      ORDER BY ${orderBy} LIMIT 100`, filters.values);
    return send(response, 200, { ok: true, items });
  }

  let match = path.match(/^\/api\/hostels\/(\d+)$/);
  if (method === 'GET' && match) {
    const hostelId = positiveId(match[1], 'hostel id');
    const hostels = await query(`SELECT h.hostel_id,h.name,h.address,h.city,h.gender_type,
      (SELECT GROUP_CONCAT(f.facility_name ORDER BY f.facility_name SEPARATOR ', ')
       FROM HOSTEL_FACILITY hf JOIN FACILITY f ON f.facility_id=hf.facility_id WHERE hf.hostel_id=h.hostel_id) AS facilities
      FROM HOSTEL h WHERE h.hostel_id=?`, [hostelId]);
    if (!hostels.length) fail(404, 'Hostel not found');
    const rooms = await query('SELECT room_id,room_type,capacity,rent_per_month,available_beds FROM ROOM WHERE hostel_id=? ORDER BY room_type,rent_per_month', [hostelId]);
    const reviews = await query(`SELECT s.name AS student_name,rv.rating,rv.comment
      FROM REVIEW rv JOIN STUDENT s ON s.student_id=rv.student_id WHERE rv.hostel_id=? ORDER BY s.name`, [hostelId]);
    return send(response, 200, { ok: true, hostel: hostels[0], rooms, reviews });
  }

  if (method === 'POST' && path === '/api/auth/register') {
    const user = await registerAccount(await readBody(request));
    return send(response, 201, { ok: true, user });
  }

  if (method === 'POST' && path === '/api/auth/login') {
    const data = await readBody(request);
    if (!['student', 'owner'].includes(data.kind)) fail(400, 'Choose Student or Owner');
    validEmail(data.email);
    if (typeof data.password !== 'string') fail(400, 'Password is required');
    const ip = request.socket.remoteAddress || 'unknown';
    const key = `${ip}:${data.kind}:${String(data.email).toLowerCase()}`;
    const prior = loginAttempts.get(key) || { count: 0, until: 0 };
    if (prior.until > Date.now() && prior.count >= 8) fail(429, 'Too many sign-in attempts. Try again in 15 minutes.');
    const table = data.kind === 'owner' ? 'OWNER' : 'STUDENT';
    const idColumn = data.kind === 'owner' ? 'owner_id' : 'student_id';
    const rows = await query(`SELECT ${idColumn} AS id,name,email,password_hash FROM ${table} WHERE email=?`, [data.email.trim().toLowerCase()]);
    if (!rows.length || !await verifyPassword(data.password, rows[0].password_hash)) {
      const count = prior.until > Date.now() ? prior.count + 1 : 1;
      loginAttempts.set(key, { count, until: Date.now() + 15 * 60 * 1000 });
      fail(401, 'Email or password is incorrect');
    }
    loginAttempts.delete(key);
    const account = rows[0];
    const token = newSessionToken();
    sessions.set(token, { user: { kind: data.kind, id: Number(account.id), name: account.name, email: account.email }, expiresAt: Date.now() + 12 * 60 * 60 * 1000 });
    return send(response, 200, { ok: true, token, user: sessions.get(token).user });
  }

  if (method === 'POST' && path === '/api/auth/logout') {
    const token = (request.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token) sessions.delete(token);
    return send(response, 200, { ok: true });
  }

  const user = requireUser(request);

  if (method === 'GET' && path === '/api/me') {
    const table = user.kind === 'owner' ? 'OWNER' : 'STUDENT';
    const idColumn = user.kind === 'owner' ? 'owner_id' : 'student_id';
    const fields = user.kind === 'owner' ? `${idColumn} AS id,name,email,phone` : `${idColumn} AS id,name,email,phone,gender,college`;
    const rows = await query(`SELECT ${fields} FROM ${table} WHERE ${idColumn}=?`, [user.id]);
    return send(response, 200, { ok: true, user: { kind: user.kind, ...rows[0] } });
  }

  if (method === 'PATCH' && path === '/api/me') {
    const data = await readBody(request);
    if (typeof data.name !== 'string' || !data.name.trim() || data.name.length > 120) fail(400, 'Name is required');
    if (typeof data.phone !== 'string' || !data.phone.trim() || data.phone.length > 24) fail(400, 'Phone is required');
    if (user.kind === 'owner') {
      await query('UPDATE OWNER SET name=?,phone=? WHERE owner_id=?', [data.name.trim(), data.phone.trim(), user.id]);
    } else {
      if (typeof data.college !== 'string' || !data.college.trim() || data.college.length > 150) fail(400, 'College is required');
      if (!['Male','Female','Non-binary','Undisclosed'].includes(data.gender)) fail(400, 'Choose a valid gender');
      await query('UPDATE STUDENT SET name=?,phone=?,college=?,gender=? WHERE student_id=?', [data.name.trim(), data.phone.trim(), data.college.trim(), data.gender, user.id]);
    }
    return send(response, 200, { ok: true });
  }

  if (user.kind === 'student' && method === 'GET' && path === '/api/me/preferences') {
    const rows = await query(`SELECT smoking,sleep_schedule,food_type,cleanliness,max_budget
      FROM ROOMMATE_PREFERENCE WHERE student_id=?`, [user.id]);
    return send(response, 200, { ok: true, preferences: rows[0] || null });
  }

  if (user.kind === 'student' && method === 'PUT' && path === '/api/me/preferences') {
    const data = await readBody(request);
    const { smoking, sleepSchedule, foodType, cleanliness, maxBudget } = data;
    if (!['Non-smoker','Occasional','Smoker'].includes(smoking)) fail(400, 'Choose a valid smoking preference');
    if (!['Early','Flexible','Late'].includes(sleepSchedule)) fail(400, 'Choose a valid sleep schedule');
    if (!['Vegetarian','Eggetarian','Non-vegetarian','Vegan'].includes(foodType)) fail(400, 'Choose a valid food preference');
    if (!Number.isInteger(Number(cleanliness)) || Number(cleanliness) < 1 || Number(cleanliness) > 5) fail(400, 'Cleanliness must be from 1 to 5');
    if (!Number.isFinite(Number(maxBudget)) || Number(maxBudget) < 0) fail(400, 'Maximum budget must be non-negative');
    await query(`INSERT INTO ROOMMATE_PREFERENCE (smoking,sleep_schedule,food_type,cleanliness,max_budget,student_id)
      VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE smoking=VALUES(smoking),sleep_schedule=VALUES(sleep_schedule),
      food_type=VALUES(food_type),cleanliness=VALUES(cleanliness),max_budget=VALUES(max_budget)`,
      [smoking,sleepSchedule,foodType,Number(cleanliness),Number(maxBudget),user.id]);
    return send(response, 200, { ok: true });
  }

  if (user.kind === 'student' && method === 'GET' && path === '/api/me/compatibility') {
    const items = await query(`SELECT s.name,s.college,c.compatibility_percent,
      p.smoking,p.sleep_schedule,p.food_type,p.cleanliness
      FROM v_roommate_compatibility c JOIN STUDENT s ON s.student_id=c.other_student_id
      JOIN ROOMMATE_PREFERENCE p ON p.student_id=s.student_id
      WHERE c.student_id=? ORDER BY c.compatibility_percent DESC,s.name LIMIT 12`, [user.id]);
    return send(response, 200, { ok: true, items });
  }

  if (user.kind === 'student' && method === 'GET' && path === '/api/bookings') {
    const items = await query(`SELECT b.booking_id,b.booking_date,b.check_in_date,b.status,
      r.room_id,r.room_type,r.capacity,r.rent_per_month,h.hostel_id,h.name AS hostel_name,h.city
      FROM BOOKING b JOIN ROOM r ON r.room_id=b.room_id JOIN HOSTEL h ON h.hostel_id=r.hostel_id
      WHERE b.student_id=? ORDER BY b.booking_date DESC,b.booking_id DESC`, [user.id]);
    return send(response, 200, { ok: true, items });
  }

  if (user.kind === 'student' && method === 'POST' && path === '/api/bookings') {
    const data = await readBody(request);
    const roomId = positiveId(data.roomId, 'room id');
    validDate(data.checkInDate, 'Check-in date');
    const result = await query('INSERT INTO BOOKING (check_in_date,student_id,room_id) VALUES (?,?,?)', [data.checkInDate,user.id,roomId]);
    return send(response, 201, { ok: true, bookingId: result.insertId });
  }

  match = path.match(/^\/api\/bookings\/(\d+)\/cancel$/);
  if (user.kind === 'student' && method === 'POST' && match) {
    await query('CALL cancel_booking(?,?)', [positiveId(match[1], 'booking id'), user.id]);
    return send(response, 200, { ok: true });
  }

  if (user.kind === 'student' && method === 'POST' && path === '/api/reviews') {
    const data = await readBody(request);
    const hostelId = positiveId(data.hostelId, 'hostel id');
    if (!Number.isInteger(Number(data.rating)) || Number(data.rating) < 1 || Number(data.rating) > 5) fail(400, 'Rating must be from 1 to 5');
    if (data.comment !== undefined && (typeof data.comment !== 'string' || data.comment.length > 1000)) fail(400, 'Review must be 1000 characters or fewer');
    await query(`INSERT INTO REVIEW (student_id,hostel_id,rating,comment) VALUES (?,?,?,?)
      ON DUPLICATE KEY UPDATE rating=VALUES(rating),comment=VALUES(comment)`, [user.id,hostelId,Number(data.rating),data.comment?.trim() || null]);
    return send(response, 200, { ok: true });
  }

  if (user.kind === 'owner' && method === 'GET' && path === '/api/owner/hostels') {
    const items = await query(`SELECT h.hostel_id,h.name,h.address,h.city,h.gender_type,
      (SELECT GROUP_CONCAT(f.facility_name ORDER BY f.facility_name SEPARATOR ', ')
       FROM HOSTEL_FACILITY hf JOIN FACILITY f ON f.facility_id=hf.facility_id WHERE hf.hostel_id=h.hostel_id) AS facilities
      FROM HOSTEL h WHERE h.owner_id=? ORDER BY h.name`, [user.id]);
    return send(response, 200, { ok: true, items });
  }

  if (user.kind === 'owner' && method === 'POST' && path === '/api/owner/hostels') {
    const data = await readBody(request);
    for (const field of ['name','address','city']) if (typeof data[field] !== 'string' || !data[field].trim()) fail(400, `${field} is required`);
    if (!['Boys','Girls','Co-ed'].includes(data.genderType)) fail(400, 'Choose a hostel type');
    const result = await query('INSERT INTO HOSTEL (name,address,city,gender_type,owner_id) VALUES (?,?,?,?,?)',
      [data.name.trim(),data.address.trim(),data.city.trim(),data.genderType,user.id]);
    return send(response, 201, { ok: true, hostelId: result.insertId });
  }

  match = path.match(/^\/api\/owner\/hostels\/(\d+)\/facilities$/);
  if (user.kind === 'owner' && method === 'PUT' && match) {
    const hostelId = positiveId(match[1], 'hostel id');
    const data = await readBody(request);
    if (!Array.isArray(data.facilityIds) || data.facilityIds.some(id => !Number.isSafeInteger(Number(id)) || Number(id) < 1)) fail(400, 'Choose valid facilities');
    await getOwnedHostel(user.id, hostelId);
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      await connection.execute('DELETE FROM HOSTEL_FACILITY WHERE hostel_id=?', [hostelId]);
      for (const id of [...new Set(data.facilityIds.map(Number))]) {
        await connection.execute('INSERT INTO HOSTEL_FACILITY (hostel_id,facility_id) VALUES (?,?)', [hostelId,id]);
      }
      await connection.commit();
    } catch (error) { await connection.rollback(); throw error; }
    finally { connection.release(); }
    return send(response, 200, { ok: true });
  }

  if (user.kind === 'owner' && method === 'POST' && path === '/api/owner/rooms') {
    const data = await readBody(request);
    const hostelId = positiveId(data.hostelId, 'hostel id');
    const capacity = Number(data.capacity);
    const rent = Number(data.rentPerMonth);
    if (!['Single','Double','Triple'].includes(data.roomType)) fail(400, 'Choose a room type');
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 50) fail(400, 'Capacity must be from 1 to 50');
    if (!Number.isFinite(rent) || rent <= 0) fail(400, 'Monthly rent must be greater than zero');
    await getOwnedHostel(user.id, hostelId);
    const result = await query('INSERT INTO ROOM (room_type,capacity,rent_per_month,available_beds,hostel_id) VALUES (?,?,?,?,?)',
      [data.roomType,capacity,rent,capacity,hostelId]);
    return send(response, 201, { ok: true, roomId: result.insertId });
  }

  if (user.kind === 'owner' && method === 'GET' && path === '/api/owner/bookings') {
    const items = await query(`SELECT b.booking_id,b.booking_date,b.check_in_date,b.status,
      s.name AS student_name,s.gender,s.college,r.room_id,r.room_type,r.capacity,r.rent_per_month,
      h.hostel_id,h.name AS hostel_name
      FROM BOOKING b JOIN STUDENT s ON s.student_id=b.student_id
      JOIN ROOM r ON r.room_id=b.room_id JOIN HOSTEL h ON h.hostel_id=r.hostel_id
      WHERE h.owner_id=? ORDER BY FIELD(b.status,'Pending','Approved','Rejected','Cancelled'),b.booking_date DESC`, [user.id]);
    return send(response, 200, { ok: true, items });
  }

  match = path.match(/^\/api\/owner\/bookings\/(\d+)\/(approve|reject)$/);
  if (user.kind === 'owner' && method === 'POST' && match) {
    await ownerBookingDecision(user.id, positiveId(match[1], 'booking id'), match[2]);
    return send(response, 200, { ok: true });
  }

  fail(404, 'Route not found');
}

const server = http.createServer(async (request, response) => {
  const origin = request.headers.origin;
  if (origin === CLIENT_ORIGIN) {
    response.setHeader('Access-Control-Allow-Origin', CLIENT_ORIGIN);
    response.setHeader('Vary', 'Origin');
    response.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    response.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,OPTIONS');
  }
  try {
    const url = new URL(request.url, `http://${request.headers.host || 'localhost'}`);
    await route(request, response, url);
  } catch (error) {
    const status = error.status || (error.code === 'ER_DUP_ENTRY' ? 409 : error.sqlState === '45000' ? 409 : 500);
    const message = error.status || error.code === 'ER_DUP_ENTRY' || error.sqlState === '45000'
      ? error.message
      : 'Unexpected server error';
    if (status === 500) console.error(error);
    if (!response.headersSent) send(response, status, { ok: false, error: message });
    else response.destroy();
  }
});

server.listen(PORT, () => console.log(`Hostel Finder API listening on http://localhost:${PORT}`));
process.on('SIGINT', async () => { server.close(); await pool.end(); process.exit(0); });
process.on('SIGTERM', async () => { server.close(); await pool.end(); process.exit(0); });
