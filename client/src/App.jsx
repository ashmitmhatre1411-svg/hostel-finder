import { useEffect, useState } from 'react';

const API = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';
const tokenKey = 'hostelFinderToken';

async function api(path, options = {}) {
  const token = localStorage.getItem(tokenKey);
  const response = await fetch(`${API}${path}`, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed');
  return result;
}

const send = (method, body) => ({ method, body: JSON.stringify(body) });
const displayDate = (value) => value ? new Date(`${value}T00:00:00`).toLocaleDateString() : '—';

function Field({ label, name, type = 'text', required = false, defaultValue = '', children, ...props }) {
  return <label className="field">{label}
    {children || <input name={name} type={type} defaultValue={defaultValue} required={required} {...props} />}
  </label>;
}

export default function App() {
  const [user, setUser] = useState(null);
  const [mode, setMode] = useState('browse');
  const [authMode, setAuthMode] = useState('login');
  const [accountKind, setAccountKind] = useState('student');
  const [rooms, setRooms] = useState([]);
  const [facilities, setFacilities] = useState([]);
  const [filters, setFilters] = useState({ q: '', city: '', genderType: '', roomType: '', maxRent: '', facility: '', sort: 'rent' });
  const [selected, setSelected] = useState(null);
  const [studentData, setStudentData] = useState({ profile: null, preferences: null, bookings: [], matches: [] });
  const [ownerData, setOwnerData] = useState({ hostels: [], bookings: [] });
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function loadRooms(nextFilters = filters) {
    const params = new URLSearchParams();
    Object.entries(nextFilters).forEach(([key, value]) => { if (value) params.set(key, value); });
    const data = await api(`/rooms?${params.toString()}`);
    setRooms(data.items);
  }

  async function loadAccount(nextUser = user) {
    if (!nextUser) return;
    if (nextUser.kind === 'student') {
      const [profile, preferences, bookings, matches] = await Promise.all([
        api('/me'), api('/me/preferences'), api('/bookings'), api('/me/compatibility')
      ]);
      setStudentData({ profile: profile.user, preferences: preferences.preferences, bookings: bookings.items, matches: matches.items });
    } else {
      const [hostels, bookings] = await Promise.all([api('/owner/hostels'), api('/owner/bookings')]);
      setOwnerData({ hostels: hostels.items, bookings: bookings.items });
    }
  }

  useEffect(() => {
    loadRooms().catch((reason) => setError(reason.message));
    api('/facilities').then((data) => setFacilities(data.items)).catch((reason) => setError(reason.message));
    if (localStorage.getItem(tokenKey)) {
      api('/me').then((data) => { setUser(data.user); return loadAccount(data.user); })
        .catch(() => { localStorage.removeItem(tokenKey); setUser(null); });
    }
  }, []);

  async function run(action, successText = '') {
    setBusy(true); setError(''); setNotice('');
    try {
      await action();
      if (successText) setNotice(successText);
    } catch (reason) {
      setError(reason.message || 'Something went wrong');
    } finally { setBusy(false); }
  }

  async function submitAuth(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => {
      if (authMode === 'register') {
        await api('/auth/register', send('POST', { ...values, kind: accountKind }));
      }
      const result = await api('/auth/login', send('POST', {
        kind: accountKind, email: values.email, password: values.password
      }));
      localStorage.setItem(tokenKey, result.token);
      await loadAccount(result.user);
      setUser(result.user);
      setMode(accountKind === 'owner' ? 'owner' : 'account');
    }, authMode === 'register' ? 'Account created and signed in.' : 'Signed in.');
  }

  async function signOut() {
    await run(async () => {
      await api('/auth/logout', { method: 'POST' });
      localStorage.removeItem(tokenKey); setUser(null); setMode('browse');
      setStudentData({ profile: null, preferences: null, bookings: [], matches: [] });
      setOwnerData({ hostels: [], bookings: [] });
    }, 'Signed out.');
  }

  async function openHostel(hostelId) {
    await run(async () => setSelected((await api(`/hostels/${hostelId}`))));
  }

  async function bookRoom(event, roomId) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => {
      await api('/bookings', send('POST', { roomId, checkInDate: values.checkInDate }));
      await loadRooms(); await loadAccount(user);
    }, 'Booking request submitted. The owner must approve it.');
  }

  async function saveProfile(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => { await api('/me', send('PATCH', values)); await loadAccount(user); }, 'Profile saved.');
  }

  async function savePreferences(event) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => { await api('/me/preferences', send('PUT', values)); await loadAccount(user); }, 'Roommate preferences saved.');
  }

  async function submitReview(event, hostelId) {
    event.preventDefault();
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await run(async () => { await api('/reviews', send('POST', { ...values, hostelId: Number(hostelId) })); await openHostel(hostelId); }, 'Review saved.');
  }

  async function cancelBooking(bookingId) {
    await run(async () => { await api(`/bookings/${bookingId}/cancel`, { method: 'POST' }); await loadAccount(user); await loadRooms(); }, 'Booking cancelled.');
  }

  async function addHostel(event) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    await run(async () => { await api('/owner/hostels', send('POST', values)); await loadAccount(user); form.reset(); }, 'Hostel added.');
  }

  async function addRoom(event) {
    event.preventDefault(); const form = event.currentTarget; const values = Object.fromEntries(new FormData(form));
    await run(async () => { await api('/owner/rooms', send('POST', values)); await loadRooms(); await loadAccount(user); form.reset(); }, 'Room added.');
  }

  async function saveFacilities(event, hostelId) {
    event.preventDefault(); const facilityIds = new FormData(event.currentTarget).getAll('facilityId');
    await run(async () => { await api(`/owner/hostels/${hostelId}/facilities`, send('PUT', { facilityIds })); await loadAccount(user); }, 'Facilities saved.');
  }

  async function decideBooking(bookingId, action) {
    await run(async () => { await api(`/owner/bookings/${bookingId}/${action}`, { method: 'POST' }); await loadAccount(user); await loadRooms(); }, `Booking ${action}d.`);
  }

  async function applyFilters(event) {
    event.preventDefault(); const next = Object.fromEntries(new FormData(event.currentTarget));
    setFilters(next); await run(() => loadRooms(next));
  }

  const fieldValue = (object, key, fallback = '') => object?.[key] ?? fallback;

  return <div className="app-shell">
    <header className="topbar">
      <a className="brand" href="#top" onClick={() => { setMode('browse'); setSelected(null); }}>Hostel Finder</a>
      <nav aria-label="Main navigation">
        <button className={mode === 'browse' ? 'nav-button active' : 'nav-button'} onClick={() => { setMode('browse'); setSelected(null); }}>Browse rooms</button>
        {user?.kind === 'student' && <button className={mode === 'account' ? 'nav-button active' : 'nav-button'} onClick={() => { setMode('account'); setSelected(null); }}>My account</button>}
        {user?.kind === 'owner' && <button className={mode === 'owner' ? 'nav-button active' : 'nav-button'} onClick={() => { setMode('owner'); setSelected(null); }}>Owner dashboard</button>}
      </nav>
      <div className="header-account">
        {user ? <><span>{user.name} · {user.kind}</span><button className="button secondary small" onClick={signOut} disabled={busy}>Sign out</button></>
          : <button className="button primary small" onClick={() => { setMode('auth'); setAuthMode('login'); }}>Sign in</button>}
      </div>
    </header>

    <main id="top" className="page">
      {notice && <div className="notice" role="status">{notice}<button onClick={() => setNotice('')} aria-label="Dismiss message">×</button></div>}
      {error && <div className="error" role="alert">{error}<button onClick={() => setError('')} aria-label="Dismiss error">×</button></div>}

      {mode === 'auth' && <section className="panel auth-panel">
        <div><p className="eyebrow">Simple hostel search</p><h1>{authMode === 'login' ? 'Sign in' : 'Create an account'}</h1>
          <p>Students can search and book rooms. Owners can list hostels and review booking requests.</p></div>
        <div className="form-card">
          <div className="form-tabs">
            <button className={authMode === 'login' ? 'selected' : ''} onClick={() => setAuthMode('login')}>Sign in</button>
            <button className={authMode === 'register' ? 'selected' : ''} onClick={() => setAuthMode('register')}>Register</button>
          </div>
          <form className="form-grid" onSubmit={submitAuth}>
            <Field label="I am a" name="kind" required>
              <select value={accountKind} onChange={(event) => setAccountKind(event.target.value)}>
                <option value="student">Student</option><option value="owner">Hostel owner</option>
              </select>
            </Field>
            {authMode === 'register' && <>
              <Field label="Full name" name="name" required />
              <Field label="Phone" name="phone" type="tel" required />
              {accountKind === 'student' && <>
                <Field label="Gender" name="gender" required><select name="gender" defaultValue=""><option value="" disabled>Select gender</option><option>Male</option><option>Female</option><option>Non-binary</option><option>Undisclosed</option></select></Field>
                <Field label="College" name="college" required />
              </>}
            </>}
            <Field label="Email" name="email" type="email" required autoComplete="email" />
            <Field label="Password" name="password" type="password" required autoComplete={authMode === 'login' ? 'current-password' : 'new-password'} />
            {authMode === 'register' && <p className="help">Use at least 10 characters, including a letter and a number.</p>}
            <button className="button primary" disabled={busy}>{busy ? 'Please wait…' : authMode === 'login' ? 'Sign in' : 'Create account'}</button>
          </form>
        </div>
      </section>}

      {mode === 'browse' && <>
        <section className="intro">
          <p className="eyebrow">Student Accommodation & Roommate Finder</p>
          <h1>Find a room that fits your budget.</h1>
          <p>Compare rooms, check availability and hostel facilities, then send a booking request.</p>
        </section>
        <form className="panel filters" onSubmit={applyFilters}>
          <Field label="Search hostels or city" name="q" defaultValue={filters.q} placeholder="Mumbai, Andheri…" />
          <Field label="City" name="city" defaultValue={filters.city} placeholder="Any city" />
          <Field label="Hostel type" name="genderType"><select name="genderType" defaultValue={filters.genderType}><option value="">Any type</option><option>Boys</option><option>Girls</option><option>Co-ed</option></select></Field>
          <Field label="Room type" name="roomType"><select name="roomType" defaultValue={filters.roomType}><option value="">Any type</option><option>Single</option><option>Double</option><option>Triple</option></select></Field>
          <Field label="Maximum monthly rent" name="maxRent" type="number" min="0" defaultValue={filters.maxRent} placeholder="₹" />
          <Field label="Facility" name="facility"><select name="facility" defaultValue={filters.facility}><option value="">Any facility</option>{facilities.map((item) => <option key={item.facility_id}>{item.facility_name}</option>)}</select></Field>
          <Field label="Sort by" name="sort"><select name="sort" defaultValue={filters.sort}><option value="rent">Rent: low to high</option><option value="rent-desc">Rent: high to low</option></select></Field>
          <button className="button primary" disabled={busy}>Search rooms</button>
        </form>

        {selected ? <section className="panel detail-panel">
          <button className="text-button" onClick={() => setSelected(null)}>← Back to rooms</button>
          <h2>{selected.hostel.name}</h2><p>{selected.hostel.address}, {selected.hostel.city} · {selected.hostel.gender_type}</p>
          <p><strong>Facilities:</strong> {selected.hostel.facilities || 'None listed'}</p>
          <h3>Rooms</h3>
          <div className="table-scroll"><table><thead><tr><th>Type</th><th>Capacity</th><th>Available</th><th>Monthly rent</th><th>Request</th></tr></thead>
            <tbody>{selected.rooms.map((room) => <tr key={room.room_id}><td>{room.room_type}</td><td>{room.capacity}</td><td>{room.available_beds}</td><td>₹{room.rent_per_month.toLocaleString('en-IN')}</td><td>
              {user?.kind === 'student' && room.available_beds > 0 ? <form className="inline-book" onSubmit={(event) => bookRoom(event, room.room_id)}><input name="checkInDate" type="date" min={new Date().toISOString().slice(0,10)} required aria-label="Check-in date" /><button className="button primary small" disabled={busy}>Request</button></form>
                : !user ? <button className="text-button" onClick={() => { setMode('auth'); setAuthMode('login'); }}>Sign in to request</button> : <span>Full</span>}
            </td></tr>)}</tbody></table></div>
          <h3>Reviews</h3>
          {selected.reviews.length ? <ul className="review-list">{selected.reviews.map((review, index) => <li key={`${review.student_name}-${index}`}><strong>{review.student_name}</strong> · {review.rating}/5<p>{review.comment || 'No comment'}</p></li>)}</ul> : <p>No reviews yet.</p>}
          {user?.kind === 'student' && <form className="form-grid review-form" onSubmit={(event) => submitReview(event, selected.hostel.hostel_id)}>
            <label className="field">Your rating<select name="rating" defaultValue="5"><option>5</option><option>4</option><option>3</option><option>2</option><option>1</option></select></label>
            <label className="field">Comment<textarea name="comment" rows="2" maxLength="1000" /></label>
            <button className="button secondary" disabled={busy}>Save review</button>
          </form>}
        </section> : <section className="results">
          <div className="section-head"><h2>Available rooms</h2><span>{rooms.length} results</span></div>
          {rooms.length ? <div className="table-scroll"><table><thead><tr><th>Hostel</th><th>City</th><th>Type</th><th>Available</th><th>Rent / month</th><th>Facilities</th><th /></tr></thead>
            <tbody>{rooms.map((room) => <tr key={room.room_id}><td><strong>{room.hostel_name}</strong><small>{room.gender_type}</small></td><td>{room.city}</td><td>{room.room_type}</td><td>{room.available_beds} / {room.capacity}</td><td>₹{room.rent_per_month.toLocaleString('en-IN')}</td><td>{room.facilities || '—'}</td><td><button className="text-button" onClick={() => openHostel(room.hostel_id)}>View hostel</button></td></tr>)}</tbody></table></div>
            : <div className="empty"><h3>No rooms match those filters</h3><p>Try a different city, rent or facility.</p></div>}
        </section>}
      </>}

      {mode === 'account' && user?.kind === 'student' && <section className="account-grid">
        <div className="panel"><h1>Student account</h1><form className="form-grid" onSubmit={saveProfile}>
          <Field label="Name" name="name" defaultValue={fieldValue(studentData.profile,'name')} required />
          <Field label="Email" name="email" type="email" defaultValue={fieldValue(studentData.profile,'email')} disabled />
          <Field label="Phone" name="phone" type="tel" defaultValue={fieldValue(studentData.profile,'phone')} required />
          <Field label="College" name="college" defaultValue={fieldValue(studentData.profile,'college')} required />
          <Field label="Gender" name="gender"><select name="gender" defaultValue={fieldValue(studentData.profile,'gender','Male')}><option>Male</option><option>Female</option><option>Non-binary</option><option>Undisclosed</option></select></Field>
          <button className="button primary" disabled={busy}>Save profile</button>
        </form></div>
        <div className="panel"><h2>Roommate preferences</h2><form className="form-grid" onSubmit={savePreferences}>
          <Field label="Smoking" name="smoking"><select name="smoking" defaultValue={fieldValue(studentData.preferences,'smoking','Non-smoker')}><option>Non-smoker</option><option>Occasional</option><option>Smoker</option></select></Field>
          <Field label="Sleep schedule" name="sleepSchedule"><select name="sleepSchedule" defaultValue={fieldValue(studentData.preferences,'sleep_schedule','Flexible')}><option>Early</option><option>Flexible</option><option>Late</option></select></Field>
          <Field label="Food preference" name="foodType"><select name="foodType" defaultValue={fieldValue(studentData.preferences,'food_type','Vegetarian')}><option>Vegetarian</option><option>Eggetarian</option><option>Non-vegetarian</option><option>Vegan</option></select></Field>
          <Field label="Cleanliness (1–5)" name="cleanliness" type="number" min="1" max="5" defaultValue={fieldValue(studentData.preferences,'cleanliness',3)} required />
          <Field label="Maximum monthly budget (₹)" name="maxBudget" type="number" min="0" defaultValue={fieldValue(studentData.preferences,'max_budget','7000')} required />
          <button className="button primary" disabled={busy}>Save preferences</button>
        </form></div>
        <div className="panel wide"><div className="section-head"><h2>My bookings</h2><button className="text-button" onClick={() => run(() => loadAccount(user))}>Refresh</button></div>
          {studentData.bookings.length ? <div className="table-scroll"><table><thead><tr><th>Hostel</th><th>Room</th><th>Check-in</th><th>Status</th><th /></tr></thead><tbody>
            {studentData.bookings.map((booking) => <tr key={booking.booking_id}><td>{booking.hostel_name}<small>{booking.city}</small></td><td>{booking.room_type} · ₹{booking.rent_per_month.toLocaleString('en-IN')}/month</td><td>{displayDate(booking.check_in_date)}</td><td><span className={`status ${booking.status.toLowerCase()}`}>{booking.status}</span></td><td>{['Pending','Approved'].includes(booking.status) && <button className="text-button danger" onClick={() => cancelBooking(booking.booking_id)}>Cancel</button>}</td></tr>)}
          </tbody></table></div> : <p className="empty-message">No booking requests yet. Browse rooms to get started.</p>}
        </div>
        <div className="panel wide"><h2>Roommate matches</h2>
          {studentData.matches.length ? <div className="table-scroll"><table><thead><tr><th>Student</th><th>College</th><th>Compatibility</th><th>Lifestyle</th></tr></thead><tbody>{studentData.matches.map((match, index) => <tr key={`${match.name}-${index}`}><td>{match.name}</td><td>{match.college}</td><td><strong>{match.compatibility_percent}%</strong></td><td>{match.smoking}, {match.sleep_schedule}, {match.food_type}, cleanliness {match.cleanliness}/5</td></tr>)}</tbody></table></div>
            : <p className="empty-message">Save your roommate preferences to see matches.</p>}
        </div>
      </section>}

      {mode === 'owner' && user?.kind === 'owner' && <section className="owner-view">
        <div className="intro compact"><p className="eyebrow">Owner tools</p><h1>Manage your hostels</h1><p>Add a property, list its rooms and review student requests.</p></div>
        <div className="account-grid">
          <div className="panel"><h2>Add a hostel</h2><form className="form-grid" onSubmit={addHostel}>
            <Field label="Hostel name" name="name" required /><Field label="Address" name="address" required />
            <Field label="City" name="city" required />
            <Field label="Hostel type" name="genderType"><select name="genderType" defaultValue="Co-ed"><option>Boys</option><option>Girls</option><option>Co-ed</option></select></Field>
            <button className="button primary" disabled={busy}>Add hostel</button>
          </form></div>
          <div className="panel"><h2>Add a room</h2><form className="form-grid" onSubmit={addRoom}>
            <Field label="Hostel" name="hostelId" required><select name="hostelId" required defaultValue=""><option value="" disabled>Select hostel</option>{ownerData.hostels.map((hostel) => <option key={hostel.hostel_id} value={hostel.hostel_id}>{hostel.name}</option>)}</select></Field>
            <Field label="Room type" name="roomType"><select name="roomType" defaultValue="Double"><option>Single</option><option>Double</option><option>Triple</option></select></Field>
            <Field label="Capacity" name="capacity" type="number" min="1" max="50" defaultValue="2" required />
            <Field label="Monthly rent (₹)" name="rentPerMonth" type="number" min="1" required />
            <button className="button primary" disabled={busy || !ownerData.hostels.length}>Add room</button>
          </form></div>
        </div>
        <section className="panel"><h2>Your hostels and facilities</h2>
          {ownerData.hostels.length ? <div className="owner-hostels">{ownerData.hostels.map((hostel) => <form key={hostel.hostel_id} className="facility-row" onSubmit={(event) => saveFacilities(event, hostel.hostel_id)}>
            <div><strong>{hostel.name}</strong><small>{hostel.address}, {hostel.city} · {hostel.gender_type}</small><small>Current facilities: {hostel.facilities || 'None'}</small></div>
            <fieldset><legend>Facilities</legend>{facilities.map((facility) => <label key={facility.facility_id} className="check-label"><input type="checkbox" name="facilityId" value={facility.facility_id} defaultChecked={hostel.facilities?.split(', ').includes(facility.facility_name)} />{facility.facility_name}</label>)}</fieldset>
            <button className="button secondary small" disabled={busy}>Save facilities</button>
          </form>)}</div> : <p className="empty-message">Add a hostel to begin listing rooms.</p>}
        </section>
        <section className="panel"><div className="section-head"><h2>Booking requests</h2><button className="text-button" onClick={() => run(() => loadAccount(user))}>Refresh</button></div>
          {ownerData.bookings.length ? <div className="table-scroll"><table><thead><tr><th>Student</th><th>Hostel / room</th><th>Check-in</th><th>Status</th><th>Decision</th></tr></thead><tbody>
            {ownerData.bookings.map((booking) => <tr key={booking.booking_id}><td>{booking.student_name}<small>{booking.gender} · {booking.college}</small></td><td>{booking.hostel_name}<small>{booking.room_type} · {booking.capacity} beds</small></td><td>{displayDate(booking.check_in_date)}</td><td><span className={`status ${booking.status.toLowerCase()}`}>{booking.status}</span></td><td>{booking.status === 'Pending' ? <div className="actions"><button className="button primary small" onClick={() => decideBooking(booking.booking_id,'approve')}>Approve</button><button className="button secondary small" onClick={() => decideBooking(booking.booking_id,'reject')}>Reject</button></div> : '—'}</td></tr>)}
          </tbody></table></div> : <p className="empty-message">No booking requests for your hostels.</p>}
        </section>
      </section>}

      {user && mode !== 'browse' && ((user.kind === 'student' && mode !== 'account') || (user.kind === 'owner' && mode !== 'owner')) && <div className="panel"><p>Choose the section from the navigation above.</p></div>}
    </main>
    <footer><span>Hostel Finder · MySQL DBMS mini project</span><span>Search · Book · Review</span></footer>
  </div>;
}
