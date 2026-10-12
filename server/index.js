import http from 'node:http';
import { URL } from 'node:url';
import mysql from 'mysql2/promise';
import { hashPassword, verifyPassword, newSessionToken, digestToken } from './security.js';

const PORT = Number(process.env.PORT || 3000);
const CLIENT_ORIGIN = process.env.CLIENT_ORIGIN || 'http://localhost:5173';
const pool = mysql.createPool({
  host: process.env.DB_HOST || '127.0.0.1', port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'root', password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'hostel_finder', waitForConnections: true,
  connectionLimit: 10, dateStrings: true, decimalNumbers: true
});

const loginAttempts = new Map();
const MAX_BODY = 1024 * 1024;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const fail = (status, message) => { const e = new Error(message); e.status = status; throw e; };
const requireFields = (data, fields) => { for (const field of fields) if (data[field] === undefined || data[field] === '') fail(400, `${field} is required`); };
const validEmail = (email) => { if (typeof email !== 'string' || !EMAIL.test(email) || email.length > 254) fail(400, 'Enter a valid email address'); };
const positiveId = (value, name = 'id') => { const n = Number(value); if (!Number.isSafeInteger(n) || n < 1) fail(400, `Invalid ${name}`); return n; };
const bool = (v) => v === true || v === 'true' || v === '1' || v === 1;
const validDate = (value, name) => {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(`${value}T00:00:00Z`)) || new Date(`${value}T00:00:00Z`).toISOString().slice(0,10)!==value) fail(400, `${name} must be a valid date`);
};

async function query(sql, params = []) { const [rows] = await pool.execute(sql, params); return rows; }
async function body(req) {
  let raw = ''; for await (const chunk of req) { raw += chunk; if (raw.length > MAX_BODY) fail(413, 'Request body is too large'); }
  if (!raw) return {};
  try { const value = JSON.parse(raw); if (value === null || Array.isArray(value) || typeof value !== 'object') fail(400, 'JSON object required'); return value; }
  catch (e) { if (e.status) throw e; fail(400, 'Invalid JSON body'); }
}
function send(res, status, payload) {
  const data = JSON.stringify(payload);
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data),
    'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(data);
}
function authenticate(req, res, adminRoles = null) {
  const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
  if (!token) fail(401, 'Sign in to continue');
  return query(`SELECT ss.session_id, ss.student_id, ss.admin_id, a.role, a.hostel_id, a.name
    FROM AUTH_SESSION ss LEFT JOIN ADMIN a ON a.admin_id = ss.admin_id
    WHERE ss.token_hash = ? AND ss.revoked_at IS NULL AND ss.expires_at > NOW()
      AND (ss.student_id IS NOT NULL OR a.is_active = TRUE)`, [digestToken(token)])
    .then(async rows => {
      if (!rows.length) fail(401, 'Session expired or invalid');
      const session = rows[0];
      req.user = session.student_id ? { kind: 'student', id: session.student_id } :
        { kind: 'admin', id: session.admin_id, role: session.role, hostelId: session.hostel_id, name: session.name };
      if (adminRoles && (req.user.kind !== 'admin' || !adminRoles.includes(req.user.role))) fail(403, 'Insufficient permissions');
      return session;
    });
}
function studentOnly(req) { if (req.user?.kind !== 'student') fail(403, 'Student access required'); }
function adminOnly(req, roles = ['Hostel Admin']) { if (req.user?.kind !== 'admin' || !roles.includes(req.user.role)) fail(403, 'Insufficient permissions'); }
function scopedHostel(req, hostelId) {
  adminOnly(req);
  if (Number(req.user.hostelId) !== Number(hostelId)) fail(403, 'You can only manage your assigned hostel');
}
async function currentUser(req) {
  if (req.user.kind === 'student') return { kind: 'student', ...(await query('SELECT student_id AS id, full_name AS name, full_name, email, roll_no, phone, gender, department, year_of_study FROM STUDENT WHERE student_id = ?', [req.user.id]))[0] };
  return { kind: 'admin', ...(await query('SELECT admin_id AS id, name, email, role, hostel_id FROM ADMIN WHERE admin_id = ?', [req.user.id]))[0] };
}
async function createSession(ownerType, ownerId, res) {
  const token = newSessionToken(); const hash = digestToken(token);
  const column = ownerType === 'student' ? 'student_id' : 'admin_id';
  await query(`INSERT INTO AUTH_SESSION (token_hash, ${column}, expires_at) VALUES (?, ?, DATE_ADD(NOW(), INTERVAL 12 HOUR))`, [hash, ownerId]);
  return token;
}
async function login(data, req, res) {
  requireFields(data, ['email', 'password']); validEmail(data.email);
  const ip = req.socket.remoteAddress || 'unknown'; const key = `${ip}:${String(data.email).toLowerCase()}`;
  const prior = loginAttempts.get(key) || { count: 0, until: 0 };
  if (prior.until > Date.now() && prior.count >= 8) fail(429, 'Too many sign-in attempts. Try again in 15 minutes.');
  const students = await query('SELECT student_id AS id, password_hash FROM STUDENT WHERE email = ?', [data.email]);
  const admins = students.length ? [] : await query('SELECT admin_id AS id, password_hash, role, hostel_id, name FROM ADMIN WHERE email = ? AND is_active = TRUE', [data.email]);
  const account = students[0] ? { ...students[0], kind: 'student' } : admins[0] ? { ...admins[0], kind: 'admin' } : null;
  if (!account || !await verifyPassword(data.password, account.password_hash)) {
    const count = prior.until > Date.now() ? prior.count + 1 : 1;
    loginAttempts.set(key, { count, until: Date.now() + 15 * 60 * 1000 }); fail(401, 'Email or password is incorrect');
  }
  loginAttempts.delete(key);
  const token = await createSession(account.kind, account.id, res);
  return { token, user: await (async () => {
    if (account.kind === 'student') return currentUser({ user: { kind: 'student', id: account.id } });
    return { id: account.id, name: account.name, role: account.role, hostelId: account.hostel_id };
  })() };
}

async function registerStudent(data) {
  requireFields(data, ['rollNo','fullName','email','phone','gender','department','yearOfStudy','password']);
  validEmail(data.email);
  if (String(data.password).length < 10 || !/[A-Za-z]/.test(data.password) || !/[0-9]/.test(data.password)) fail(400, 'Password must be at least 10 characters and include a letter and number');
  if (!['Male','Female','Non-binary','Undisclosed'].includes(data.gender)) fail(400, 'Choose a valid gender');
  if (!Number.isInteger(Number(data.yearOfStudy)) || Number(data.yearOfStudy) < 1 || Number(data.yearOfStudy) > 8) fail(400, 'Year of study must be between 1 and 8');
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const [result] = await connection.execute(`INSERT INTO STUDENT (roll_no, full_name, email, password_hash, phone, gender, department, year_of_study)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [data.rollNo.trim(), data.fullName.trim(), data.email.trim().toLowerCase(), await hashPassword(data.password), data.phone.trim(), data.gender, data.department.trim(), Number(data.yearOfStudy)]);
    if (data.preferences) {
      const p = data.preferences;
      await connection.execute(`INSERT INTO STUDENT_PREFERENCE (student_id, sleep_schedule, cleanliness_level, smoking_habit, noise_tolerance, study_habit, budget_min, budget_max, preferred_room_type, move_in_date)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [result.insertId, p.sleepSchedule || 'Flexible', Number(p.cleanlinessLevel || 3), p.smokingHabit || 'Non-smoker', Number(p.noiseTolerance || 3), p.studyHabit || 'Flexible', Number(p.budgetMin || 0), Number(p.budgetMax || 10000), p.preferredRoomType || null, p.moveInDate || null]);
    }
    await connection.commit();
    return { studentId: result.insertId };
  } catch (e) { await connection.rollback(); throw e; } finally { connection.release(); }
}

function roomSearchSql(params, studentGender) {
  const where = ['h.is_active = TRUE', 'r.is_active = TRUE']; const values = [];
  if (params.q) { where.push('(h.name LIKE ? OR h.address LIKE ?)'); values.push(`%${params.q}%`, `%${params.q}%`); }
  if (params.hostelId) { where.push('h.hostel_id = ?'); values.push(positiveId(params.hostelId, 'hostel id')); }
  if (params.roomType) { if(!['Single','Double','Triple'].includes(params.roomType)) fail(400,'Invalid room type'); where.push('r.room_type = ?'); values.push(params.roomType); }
  if (params.floor !== undefined) { const floor=Number(params.floor); if(!Number.isInteger(floor)) fail(400,'Floor must be a whole number'); where.push('r.floor_no = ?'); values.push(floor); }
  for (const [key,operator] of [['rentMin','>='],['rentMax','<=']]) if(params[key]!==undefined&&params[key]!=='') { const rent=Number(params[key]); if(!Number.isFinite(rent)||rent<0) fail(400,'Rent filters must be non-negative numbers'); where.push(`r.rent_per_bed ${operator} ?`); values.push(rent); }
  for (const [key,column] of [['ac','r.has_ac'],['bathroom','r.has_attached_bath'],['mess','r.has_mess']]) if(params[key]!==undefined) { if(!['true','false','1','0'].includes(String(params[key]).toLowerCase())) fail(400,`${key} must be true or false`); where.push(`${column} = ?`); values.push(bool(params[key])); }
  if (studentGender) {
    if (studentGender === 'Male') where.push("h.hostel_type IN ('Boys','Co-ed')");
    else if (studentGender === 'Female') where.push("h.hostel_type IN ('Girls','Co-ed')");
    else where.push("h.hostel_type = 'Co-ed'");
  }
  const amenityIds = String(params.amenityIds || '').split(',').filter(Boolean).map(x => positiveId(x, 'amenity id'));
  const avail = params.available === undefined ? true : bool(params.available);
  if (avail) where.push("EXISTS (SELECT 1 FROM BED bx WHERE bx.room_id = r.room_id AND bx.status = 'Available')");
  if (params.sort && !['distance','rent','rent_desc'].includes(params.sort)) fail(400,'Invalid sort order');
  const order = params.sort === 'distance' ? 'h.distance_km ASC, r.rent_per_bed ASC' : params.sort === 'rent_desc' ? 'r.rent_per_bed DESC' : 'r.rent_per_bed ASC';
  const amenityClause = amenityIds.length ? ` AND (SELECT COUNT(DISTINCT ha.amenity_id) FROM HOSTEL_AMENITY ha WHERE ha.hostel_id = h.hostel_id AND ha.amenity_id IN (${amenityIds.map(() => '?').join(',')})) = ?` : '';
  values.push(...amenityIds); if (amenityIds.length) values.push(amenityIds.length);
  return { sql: `SELECT r.room_id, r.hostel_id, h.name AS hostel_name, h.hostel_type, h.address, h.distance_km,
    r.room_number, r.floor_no, r.room_type, r.total_beds, r.rent_per_bed, r.has_ac, r.has_attached_bath, r.has_mess,
    COUNT(DISTINCT CASE WHEN b.status = 'Available' THEN b.bed_id END) AS available_beds,
    GROUP_CONCAT(DISTINCT a.amenity_name ORDER BY a.amenity_name) AS amenities
    FROM ROOM r JOIN HOSTEL h ON h.hostel_id = r.hostel_id JOIN BED b ON b.room_id = r.room_id
    LEFT JOIN HOSTEL_AMENITY ha ON ha.hostel_id = h.hostel_id LEFT JOIN AMENITY a ON a.amenity_id = ha.amenity_id
    WHERE ${where.join(' AND ')}${amenityClause} GROUP BY r.room_id ORDER BY ${order} LIMIT 100`, values };
}

async function roomCompatibility(roomId, studentId) {
  const occupants = await query(`SELECT p.sleep_schedule, p.cleanliness_level,
      p.smoking_habit, p.noise_tolerance, p.study_habit, c.compatibility_percent
    FROM ALLOCATION a JOIN BED b ON b.bed_id = a.bed_id
    LEFT JOIN STUDENT_PREFERENCE p ON p.student_id = a.student_id
    LEFT JOIN v_student_compatibility c ON c.student_id = ? AND c.other_student_id = a.student_id
    WHERE b.room_id = ? AND a.status = 'Active' ORDER BY c.compatibility_percent DESC`, [studentId, roomId]);
  const labels = occupants.map(({ sleep_schedule, cleanliness_level, smoking_habit, noise_tolerance, study_habit, compatibility_percent }) => ({
    sleepSchedule: sleep_schedule || 'Not set', cleanlinessLevel: cleanliness_level ?? null,
    smokingHabit: smoking_habit || 'Not set', noiseTolerance: noise_tolerance ?? null,
    studyHabit: study_habit || 'Not set', compatibilityPercent: compatibility_percent === null ? null : Number(compatibility_percent)
  }));
  const scores = labels.map(x => x.compatibilityPercent).filter(x => x !== null);
  return { occupants: labels, averageCompatibilityPercent: scores.length ? Number((scores.reduce((a,b) => a+b, 0) / scores.length).toFixed(2)) : null };
}

async function route(req, res, url) {
  const path = url.pathname.replace(/\/$/, '') || '/'; const method = req.method;
  if (method === 'OPTIONS') { res.writeHead(204); return res.end(); }
  if (method === 'GET' && path === '/api/health') return send(res, 200, { ok: true, service: 'hostel-finder-api' });
  if (method === 'POST' && path === '/api/auth/register') return send(res, 201, { ok: true, ...(await registerStudent(await body(req))) });
  if (method === 'POST' && path === '/api/auth/login') return send(res, 200, { ok: true, ...(await login(await body(req), req, res)) });
  if (method === 'POST' && path === '/api/auth/logout') {
    const token = (req.headers.authorization || '').replace(/^Bearer\s+/i, '');
    if (token) await query('UPDATE AUTH_SESSION SET revoked_at = NOW() WHERE token_hash = ? AND revoked_at IS NULL', [digestToken(token)]);
    return send(res, 200, { ok: true });
  }

  if (method === 'GET' && path === '/api/hostels') {
    let gender = null;
    if (req.headers.authorization) { try { await authenticate(req, res); if (req.user.kind === 'student') gender = (await query('SELECT gender FROM STUDENT WHERE student_id = ?', [req.user.id]))[0]?.gender; } catch {} }
    const q = url.searchParams.get('q'); const vals = []; const where = ['h.is_active = TRUE'];
    if (q) { where.push('(h.name LIKE ? OR h.address LIKE ?)'); vals.push(`%${q}%`, `%${q}%`); }
    if (gender === 'Male') where.push("h.hostel_type IN ('Boys','Co-ed')"); else if (gender === 'Female') where.push("h.hostel_type IN ('Girls','Co-ed')"); else if (gender) where.push("h.hostel_type = 'Co-ed'");
    const items = await query(`SELECT h.hostel_id, h.name, h.hostel_type, h.address, h.distance_km, h.contact_no, h.rules,
      GROUP_CONCAT(DISTINCT a.amenity_name ORDER BY a.amenity_name) AS amenities,
      COUNT(DISTINCT CASE WHEN b.status = 'Available' THEN b.bed_id END) AS available_beds
      FROM HOSTEL h LEFT JOIN HOSTEL_AMENITY ha ON ha.hostel_id = h.hostel_id LEFT JOIN AMENITY a ON a.amenity_id = ha.amenity_id
      LEFT JOIN ROOM r ON r.hostel_id = h.hostel_id AND r.is_active = TRUE LEFT JOIN BED b ON b.room_id = r.room_id
      WHERE ${where.join(' AND ')} GROUP BY h.hostel_id ORDER BY h.distance_km, h.name`, vals);
    return send(res, 200, { ok: true, items });
  }
  if (method === 'GET' && path === '/api/amenities') return send(res, 200, { ok: true, items: await query('SELECT amenity_id, amenity_name FROM AMENITY ORDER BY amenity_name') });
  if (method === 'GET' && path === '/api/rooms') {
    let gender = null;
    if (req.headers.authorization) { try { await authenticate(req, res); if (req.user.kind === 'student') gender = (await query('SELECT gender FROM STUDENT WHERE student_id = ?', [req.user.id]))[0]?.gender; } catch {} }
    const built = roomSearchSql(Object.fromEntries(url.searchParams.entries()), gender);
    return send(res, 200, { ok: true, items: await query(built.sql, built.values) });
  }

  await authenticate(req, res);
  if (path === '/api/me' && method === 'GET') {
    const user = await currentUser(req);
    if (req.user.kind === 'student') user.preferences = (await query('SELECT sleep_schedule, cleanliness_level, smoking_habit, noise_tolerance, study_habit, budget_min, budget_max, preferred_room_type, move_in_date FROM STUDENT_PREFERENCE WHERE student_id = ?', [req.user.id]))[0] || null;
    return send(res, 200, { ok: true, user });
  }
  if (path === '/api/me' && method === 'PATCH') {
    studentOnly(req); const d = await body(req); const allowed = ['fullName','phone','department','yearOfStudy']; requireFields(d, []);
    const sets = []; const values = []; for (const [key,col] of Object.entries({fullName:'full_name',phone:'phone',department:'department',yearOfStudy:'year_of_study'})) if (d[key] !== undefined) { sets.push(`${col} = ?`); values.push(d[key]); }
    for(const key of ['fullName','phone','department']) if(d[key]!==undefined&&(!String(d[key]).trim()||String(d[key]).length>120)) fail(400,`${key} must be between 1 and 120 characters`);
    if(d.yearOfStudy!==undefined&&(!Number.isInteger(Number(d.yearOfStudy))||Number(d.yearOfStudy)<1||Number(d.yearOfStudy)>8)) fail(400,'Year of study must be between 1 and 8');
    if (sets.length) { values.push(req.user.id); await query(`UPDATE STUDENT SET ${sets.join(', ')} WHERE student_id = ?`, values); }
    return send(res, 200, { ok: true, user: await currentUser(req) });
  }
  if (path === '/api/me/preferences' && (method === 'PUT' || method === 'POST')) {
    studentOnly(req); const p = await body(req);
    if(!['Early','Flexible','Late'].includes(p.sleepSchedule||'Flexible')) fail(400,'Invalid sleep schedule');
    if(!['Non-smoker','Occasional','Smoker'].includes(p.smokingHabit||'Non-smoker')) fail(400,'Invalid smoking preference');
    if(!['Daily','Flexible','Exam-focused'].includes(p.studyHabit||'Flexible')) fail(400,'Invalid study habit');
    if(p.preferredRoomType&&!['Single','Double','Triple'].includes(p.preferredRoomType)) fail(400,'Invalid preferred room type');
    const clean=Number(p.cleanlinessLevel), noise=Number(p.noiseTolerance), min=Number(p.budgetMin), max=Number(p.budgetMax);
    if(!Number.isInteger(clean)||clean<1||clean>5||!Number.isInteger(noise)||noise<1||noise>5) fail(400,'Cleanliness and noise preferences must be from 1 to 5');
    if(!Number.isFinite(min)||!Number.isFinite(max)||min<0||min>max) fail(400,'Enter a valid budget range');
    if(p.moveInDate) validDate(p.moveInDate,'Move-in date');
    const values = [p.sleepSchedule || 'Flexible', Number(p.cleanlinessLevel), p.smokingHabit || 'Non-smoker', Number(p.noiseTolerance), p.studyHabit || 'Flexible', Number(p.budgetMin), Number(p.budgetMax), p.preferredRoomType || null, p.moveInDate || null, req.user.id];
    await query(`INSERT INTO STUDENT_PREFERENCE (sleep_schedule, cleanliness_level, smoking_habit, noise_tolerance, study_habit, budget_min, budget_max, preferred_room_type, move_in_date, student_id)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE sleep_schedule=VALUES(sleep_schedule), cleanliness_level=VALUES(cleanliness_level), smoking_habit=VALUES(smoking_habit), noise_tolerance=VALUES(noise_tolerance), study_habit=VALUES(study_habit), budget_min=VALUES(budget_min), budget_max=VALUES(budget_max), preferred_room_type=VALUES(preferred_room_type), move_in_date=VALUES(move_in_date)`, values);
    return send(res, 200, { ok: true });
  }
  let match;
  if (method === 'GET' && (match = path.match(/^\/api\/hostels\/(\d+)$/))) {
    const id = positiveId(match[1]); const items = await query(`SELECT h.*, GROUP_CONCAT(DISTINCT a.amenity_name ORDER BY a.amenity_name) AS amenities
      FROM HOSTEL h LEFT JOIN HOSTEL_AMENITY ha ON ha.hostel_id=h.hostel_id LEFT JOIN AMENITY a ON a.amenity_id=ha.amenity_id
      WHERE h.hostel_id=? AND h.is_active=TRUE GROUP BY h.hostel_id`, [id]);
    if (!items.length) fail(404, 'Hostel not found'); return send(res, 200, { ok: true, hostel: items[0] });
  }
  if (method === 'GET' && (match = path.match(/^\/api\/rooms\/(\d+)$/))) {
    const rows = await query(`SELECT r.*, h.name AS hostel_name, h.hostel_type, h.address,
      (SELECT COUNT(*) FROM BED b WHERE b.room_id=r.room_id AND b.status='Available') AS available_beds,
      (SELECT JSON_ARRAYAGG(JSON_OBJECT('bedId', b.bed_id, 'label', b.bed_label, 'status', b.status)) FROM BED b WHERE b.room_id=r.room_id) AS beds
      FROM ROOM r JOIN HOSTEL h ON h.hostel_id=r.hostel_id WHERE r.room_id=? AND r.is_active=TRUE`, [positiveId(match[1])]);
    if (!rows.length) fail(404, 'Room not found');
    const room = rows[0]; room.beds = typeof room.beds === 'string' ? JSON.parse(room.beds) : room.beds;
    return send(res, 200, { ok: true, room });
  }
  if (method === 'GET' && (match = path.match(/^\/api\/rooms\/(\d+)\/compatibility$/))) {
    studentOnly(req); return send(res, 200, { ok: true, ...(await roomCompatibility(positiveId(match[1]), req.user.id)) });
  }
  if (method === 'POST' && path === '/api/requests') {
    studentOnly(req); const d = await body(req); requireFields(d, ['bedId','requestedMoveIn']);
    validDate(d.requestedMoveIn,'Requested move-in date');
    const result = await query('INSERT INTO BOOKING_REQUEST (student_id, bed_id, requested_move_in, student_note) VALUES (?, ?, ?, ?)', [req.user.id, positiveId(d.bedId, 'bed id'), d.requestedMoveIn, d.studentNote || null]);
    return send(res, 201, { ok: true, requestId: result.insertId });
  }
  if (path === '/api/requests' && method === 'GET') {
    studentOnly(req); const items = await query(`SELECT q.request_id, q.status, q.requested_move_in, q.student_note, q.admin_remark, q.requested_at, q.decided_at,
      r.room_number, r.room_type, h.name AS hostel_name, b.bed_label
      FROM BOOKING_REQUEST q JOIN BED b ON b.bed_id=q.bed_id JOIN ROOM r ON r.room_id=b.room_id JOIN HOSTEL h ON h.hostel_id=r.hostel_id
      WHERE q.student_id=? ORDER BY q.requested_at DESC`, [req.user.id]); return send(res, 200, { ok: true, items });
  }
  if (method === 'GET' && (match = path.match(/^\/api\/requests\/(\d+)$/))) {
    const id = positiveId(match[1]); const ownerClause = req.user.kind === 'student' ? 'q.student_id = ?' : '1=1';
    const vals = req.user.kind === 'student' ? [id, req.user.id] : [id];
    const rows = await query(`SELECT q.*, h.name AS hostel_name, r.room_number, b.bed_label FROM BOOKING_REQUEST q
      JOIN BED b ON b.bed_id=q.bed_id JOIN ROOM r ON r.room_id=b.room_id JOIN HOSTEL h ON h.hostel_id=r.hostel_id
      WHERE q.request_id=? AND ${ownerClause}`, vals);
    if (!rows.length) fail(404, 'Request not found');
    if (req.user.kind === 'admin') scopedHostel(req, (await query('SELECT hostel_id FROM ROOM r JOIN BED b ON b.room_id=r.room_id JOIN BOOKING_REQUEST q ON q.bed_id=b.bed_id WHERE q.request_id=?', [id]))[0].hostel_id);
    const history = await query('SELECT old_status, new_status, changed_at, changed_by_admin FROM BOOKING_STATUS_HISTORY WHERE request_id=? ORDER BY changed_at, history_id', [id]);
    return send(res, 200, { ok: true, request: rows[0], history });
  }
  if (method === 'POST' && (match = path.match(/^\/api\/requests\/(\d+)\/cancel$/))) {
    studentOnly(req); await query('CALL cancel_booking_request(?, ?)', [positiveId(match[1]), req.user.id]); return send(res, 200, { ok: true });
  }
  if (path === '/api/admin/requests' && method === 'GET') {
    adminOnly(req); const status = url.searchParams.get('status') || 'Pending';
    const items = await query(`SELECT q.request_id, q.status, q.requested_move_in, q.requested_at, q.student_note, s.full_name AS student_name,
      s.gender, s.department, h.name AS hostel_name, h.hostel_id, r.room_number, r.room_type, b.bed_label,
      (SELECT c.compatibility_percent FROM v_student_compatibility c JOIN ALLOCATION a ON a.student_id=c.other_student_id
        JOIN BED bx ON bx.bed_id=a.bed_id WHERE c.student_id=q.student_id AND bx.room_id=r.room_id AND a.status='Active' ORDER BY c.compatibility_percent DESC LIMIT 1) AS best_occupant_match
      FROM BOOKING_REQUEST q JOIN STUDENT s ON s.student_id=q.student_id JOIN BED b ON b.bed_id=q.bed_id
      JOIN ROOM r ON r.room_id=b.room_id JOIN HOSTEL h ON h.hostel_id=r.hostel_id
      WHERE h.hostel_id=? AND q.status=? ORDER BY q.requested_at`, [req.user.hostelId, status]); return send(res, 200, { ok: true, items });
  }
  if (method === 'POST' && (match = path.match(/^\/api\/admin\/requests\/(\d+)\/(approve|reject)$/))) {
    adminOnly(req); const d = await body(req); const id = positiveId(match[1]);
    const action = match[2];
    if (action === 'approve') await query('CALL approve_booking_request(?, ?)', [id, req.user.id]);
    else await query('CALL reject_booking_request(?, ?, ?)', [id, req.user.id, d.remark || '']);
    return send(res, 200, { ok: true });
  }
  if (path === '/api/admin/occupancy' && method === 'GET') {
    adminOnly(req); return send(res, 200, { ok: true, items: await query(`SELECT r.room_id, r.room_number, r.room_type,
      COUNT(b.bed_id) AS total_beds, SUM(b.status='Booked') AS occupied_beds, SUM(b.status='Available') AS available_beds
      FROM ROOM r JOIN BED b ON b.room_id=r.room_id WHERE r.hostel_id=? GROUP BY r.room_id ORDER BY r.room_number`, [req.user.hostelId]) });
  }
  if (method === 'POST' && (match=path.match(/^\/api\/admin\/allocations\/(\d+)\/end$/))) {
    adminOnly(req); const d=await body(req); requireFields(d,['endDate']);
    validDate(d.endDate,'End date');
    await query('CALL end_allocation(?, ?, ?)',[positiveId(match[1],'allocation id'),req.user.id,d.endDate]); return send(res,200,{ok:true});
  }
  if (path === '/api/history' && method === 'GET') {
    if (req.user.kind === 'student') return send(res, 200, { ok: true, items: await query(`SELECT q.request_id,q.status,q.requested_at,q.decided_at,q.admin_remark,h.name AS hostel_name,
      r.room_number,b.bed_label,a.allocation_id,a.start_date,a.end_date,a.status AS allocation_status
      FROM BOOKING_REQUEST q JOIN BED b ON b.bed_id=q.bed_id JOIN ROOM r ON r.room_id=b.room_id JOIN HOSTEL h ON h.hostel_id=r.hostel_id
      LEFT JOIN ALLOCATION a ON a.request_id=q.request_id WHERE q.student_id=? ORDER BY q.requested_at DESC`, [req.user.id]) });
    if (req.user.role === 'System Admin') return send(res, 200, { ok: true, items: await query(`SELECT q.status, COUNT(*) AS total
      FROM BOOKING_REQUEST q GROUP BY q.status ORDER BY q.status`) });
    adminOnly(req); return send(res, 200, { ok: true, items: await query(`SELECT q.request_id,q.status,q.requested_at,q.decided_at,q.admin_remark,s.full_name AS student_name,
      h.name AS hostel_name,r.room_number,b.bed_label,a.allocation_id,a.start_date,a.end_date,a.status AS allocation_status
      FROM BOOKING_REQUEST q JOIN STUDENT s ON s.student_id=q.student_id JOIN BED b ON b.bed_id=q.bed_id
      JOIN ROOM r ON r.room_id=b.room_id JOIN HOSTEL h ON h.hostel_id=r.hostel_id LEFT JOIN ALLOCATION a ON a.request_id=q.request_id
      WHERE h.hostel_id=? ORDER BY q.requested_at DESC LIMIT 500`, [req.user.hostelId]) });
  }
  if (path === '/api/system/hostels' && method === 'POST') {
    adminOnly(req, ['System Admin']); const d = await body(req); requireFields(d, ['name','hostelType','address','distanceKm','contactNo','rules']);
    if(!['Boys','Girls','Co-ed'].includes(d.hostelType)||!Number.isFinite(Number(d.distanceKm))||Number(d.distanceKm)<0) fail(400,'Enter a valid hostel type and distance');
    const result = await query('INSERT INTO HOSTEL (name,hostel_type,address,distance_km,contact_no,rules) VALUES (?,?,?,?,?,?)', [d.name,d.hostelType,d.address,Number(d.distanceKm),d.contactNo,d.rules]);
    return send(res, 201, { ok: true, hostelId: result.insertId });
  }
  if (path === '/api/system/admins' && method === 'POST') {
    adminOnly(req, ['System Admin']); const d = await body(req); requireFields(d, ['name','email','password','role']); validEmail(d.email);
    if (!['System Admin','Hostel Admin'].includes(d.role)) fail(400, 'Invalid administrator role');
    if (d.role === 'Hostel Admin') requireFields(d, ['hostelId']);
    if (String(d.password).length < 10) fail(400, 'Password must be at least 10 characters');
    const result = await query('INSERT INTO ADMIN (name,email,password_hash,role,hostel_id) VALUES (?,?,?,?,?)', [d.name,d.email.toLowerCase(),await hashPassword(d.password),d.role,d.role==='Hostel Admin'?positiveId(d.hostelId):null]);
    return send(res, 201, { ok: true, adminId: result.insertId });
  }
  if (path === '/api/system/amenities' && method === 'POST') {
    adminOnly(req, ['System Admin']); const d = await body(req); requireFields(d, ['name']);
    const result = await query('INSERT INTO AMENITY (amenity_name) VALUES (?)', [d.name.trim()]); return send(res, 201, { ok: true, amenityId: result.insertId });
  }
  if (path === '/api/system/hostels' && method === 'GET') {
    adminOnly(req, ['System Admin']); return send(res, 200, { ok: true, items: await query('SELECT hostel_id,name,hostel_type,address,is_active FROM HOSTEL ORDER BY name') });
  }
  if (method === 'PATCH' && (match = path.match(/^\/api\/system\/hostels\/(\d+)$/))) {
    adminOnly(req, ['System Admin']); const d = await body(req); const id = positiveId(match[1]);
    if(d.hostelType!==undefined&&!['Boys','Girls','Co-ed'].includes(d.hostelType)) fail(400,'Invalid hostel type');
    if(d.distanceKm!==undefined&&(!Number.isFinite(Number(d.distanceKm))||Number(d.distanceKm)<0)) fail(400,'Distance must be a non-negative number');
    const columns = {name:'name',hostelType:'hostel_type',address:'address',distanceKm:'distance_km',contactNo:'contact_no',rules:'rules',isActive:'is_active'};
    const sets=[]; const values=[];
    for (const [key,column] of Object.entries(columns)) if (d[key] !== undefined) { sets.push(`${column}=?`); values.push(key==='isActive'?bool(d[key]):key==='distanceKm'?Number(d[key]):d[key]); }
    if (!sets.length) fail(400,'Provide at least one hostel field to update'); values.push(id);
    await query(`UPDATE HOSTEL SET ${sets.join(',')} WHERE hostel_id=?`,values); return send(res,200,{ok:true});
  }
  if (method === 'PATCH' && (match = path.match(/^\/api\/system\/amenities\/(\d+)$/))) {
    adminOnly(req, ['System Admin']); const d=await body(req); requireFields(d,['name']);
    await query('UPDATE AMENITY SET amenity_name=? WHERE amenity_id=?',[d.name.trim(),positiveId(match[1],'amenity id')]); return send(res,200,{ok:true});
  }

  // Hostel-scoped listing management for the fields administrators own.
  if (method === 'POST' && path === '/api/admin/rooms') {
    adminOnly(req); const d = await body(req); scopedHostel(req, d.hostelId || req.user.hostelId);
    requireFields(d, ['roomNumber','roomType','totalBeds','rentPerBed']);
    const expectedBeds = {Single:1,Double:2,Triple:3}[d.roomType];
    if (!expectedBeds || Number(d.totalBeds)!==expectedBeds) fail(400,'Bed count must match the selected room type');
    if (!Number.isFinite(Number(d.rentPerBed)) || Number(d.rentPerBed)<=0) fail(400,'Rent per bed must be greater than zero');
    const c = await pool.getConnection();
    try { await c.beginTransaction(); const [r] = await c.execute(`INSERT INTO ROOM (hostel_id,room_number,floor_no,room_type,total_beds,rent_per_bed,has_ac,has_attached_bath,has_mess)
      VALUES (?,?,?,?,?,?,?,?,?)`, [req.user.hostelId,d.roomNumber,d.floorNo||0,d.roomType,Number(d.totalBeds),Number(d.rentPerBed),bool(d.hasAc),bool(d.hasAttachedBath),bool(d.hasMess)]);
      for (let i=1;i<=Number(d.totalBeds);i++) await c.execute('INSERT INTO BED (room_id,bed_label) VALUES (?,?)',[r.insertId,String(i)]);
      await c.commit(); return send(res,201,{ok:true,roomId:r.insertId});
    } catch(e) { await c.rollback(); throw e; } finally { c.release(); }
  }
  if (method === 'GET' && path === '/api/admin/rooms') {
    adminOnly(req); return send(res,200,{ok:true,items:await query(`SELECT r.room_id,r.room_number,r.room_type,r.is_active,
      JSON_ARRAYAGG(JSON_OBJECT('bedId',b.bed_id,'label',b.bed_label,'status',b.status)) AS beds
      FROM ROOM r LEFT JOIN BED b ON b.room_id=r.room_id WHERE r.hostel_id=? GROUP BY r.room_id ORDER BY r.room_number`,[req.user.hostelId])});
  }
  if (method === 'POST' && path === '/api/admin/beds') {
    adminOnly(req); const d=await body(req); requireFields(d,['roomId','bedLabel']);
    const room=(await query('SELECT hostel_id FROM ROOM WHERE room_id=?',[positiveId(d.roomId,'room id')]))[0]; if(!room) fail(404,'Room not found'); scopedHostel(req,room.hostel_id);
    const result=await query('INSERT INTO BED (room_id,bed_label,status) VALUES (?,?,?)',[d.roomId,d.bedLabel,d.status||'Available']); return send(res,201,{ok:true,bedId:result.insertId});
  }
  if (method === 'PATCH' && (match=path.match(/^\/api\/admin\/beds\/(\d+)$/))) {
    adminOnly(req); const d=await body(req); const id=positiveId(match[1]);
    const row=(await query(`SELECT r.hostel_id,b.status,
      EXISTS(SELECT 1 FROM ALLOCATION a WHERE a.bed_id=b.bed_id AND a.status='Active') AS has_active_allocation
      FROM BED b JOIN ROOM r ON r.room_id=b.room_id WHERE b.bed_id=?`,[id]))[0]; if(!row) fail(404,'Bed not found'); scopedHostel(req,row.hostel_id);
    if (row.has_active_allocation) fail(409,'A bed with an active allocation cannot be changed');
    if (!['Available','Maintenance'].includes(d.status)) fail(400,'Bed status can be changed to Available or Maintenance');
    await query('UPDATE BED SET status=? WHERE bed_id=?',[d.status,id]); return send(res,200,{ok:true});
  }
  if (method === 'POST' && path === '/api/admin/hostel-amenities') {
    adminOnly(req); const d=await body(req); const hid=d.hostelId||req.user.hostelId; scopedHostel(req,hid); requireFields(d,['amenityId']);
    await query('INSERT INTO HOSTEL_AMENITY (hostel_id,amenity_id) VALUES (?,?)',[hid,positiveId(d.amenityId,'amenity id')]); return send(res,201,{ok:true});
  }
  if (method === 'PATCH' && (match=path.match(/^\/api\/admin\/rooms\/(\d+)$/))) {
    adminOnly(req); const d=await body(req); const id=positiveId(match[1]); const room=(await query('SELECT hostel_id FROM ROOM WHERE room_id=?',[id]))[0]; if(!room) fail(404,'Room not found'); scopedHostel(req,room.hostel_id);
    const cols={rentPerBed:'rent_per_bed',hasAc:'has_ac',hasAttachedBath:'has_attached_bath',hasMess:'has_mess',isActive:'is_active'}; const sets=[]; const vals=[];
    for(const [k,c] of Object.entries(cols)) if(d[k]!==undefined){sets.push(`${c}=?`); vals.push(k==='rentPerBed'?Number(d[k]):bool(d[k]));}
    if(d.isActive===false || d.isActive==='false' || d.isActive===0 || d.isActive==='0') {
      const active=(await query(`SELECT COUNT(*) AS count FROM ALLOCATION a JOIN BED b ON b.bed_id=a.bed_id WHERE b.room_id=? AND a.status='Active'`,[id]))[0].count;
      if(active) fail(409,'A room with active allocations cannot be deactivated');
    }
    if(sets.length){vals.push(id); await query(`UPDATE ROOM SET ${sets.join(',')} WHERE room_id=?`,vals);} return send(res,200,{ok:true});
  }
  fail(404, 'Endpoint not found');
}

const server = http.createServer(async (req, res) => {
  const origin = req.headers.origin;
  if (origin && origin === CLIENT_ORIGIN) {
    res.setHeader('Access-Control-Allow-Origin', CLIENT_ORIGIN);
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
  } else if (origin) return send(res, 403, { ok: false, error: 'Origin is not allowed' });
  try { await route(req, res, new URL(req.url, `http://${req.headers.host || 'localhost'}`)); }
  catch (error) {
    const conflictCodes = ['ER_DUP_ENTRY','ER_NO_REFERENCED_ROW_2','ER_ROW_IS_REFERENCED_2'];
    const inputCodes = ['ER_CHECK_CONSTRAINT_VIOLATED','ER_DATA_TOO_LONG','ER_TRUNCATED_WRONG_VALUE_FOR_FIELD','ER_BAD_NULL_ERROR'];
    const status = error.status || (conflictCodes.includes(error.code) ? 409 : error.sqlState === '45000' ? 409 : inputCodes.includes(error.code) ? 400 : 500);
    const message = status === 500 ? 'Internal server error' : error.message;
    if (status === 500) console.error(error);
    if (!res.headersSent) send(res, status, { ok: false, error: message }); else res.end();
  }
});

server.listen(PORT, async () => {
  try { await pool.query('SELECT 1'); console.log(`Hostel Finder API listening on http://localhost:${PORT}`); }
  catch (error) { console.error('MySQL connection failed:', error.message); }
});
