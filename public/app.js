// Plain JavaScript UI. All database work goes through the Node /api routes.
const app = document.querySelector('#app');
const topbar = document.querySelector('#topbar');
const tokenKey = 'hostelFinderToken';
const state = {
  user: null, mode: 'browse', authMode: 'login', accountKind: 'student',
  rooms: [], facilities: [], filters: {}, selected: null,
  student: { profile: null, preferences: null, bookings: [], matches: [] },
  owner: { hostels: [], bookings: [] }, notice: '', error: '', busy: false, loading: true
};

function el(tag, attrs, ...children) {
  const item = document.createElement(tag);
  Object.entries(attrs || {}).forEach(([key, value]) => {
    if (key === 'className') item.className = value;
    else if (key === 'text') item.textContent = value;
    else if (key === 'dataset') Object.entries(value).forEach(([name, entry]) => { item.dataset[name] = entry; });
    else if (key === 'checked' || key === 'disabled' || key === 'required') item[key] = Boolean(value);
    else if (value !== undefined && value !== null) item.setAttribute(key, value);
  });
  children.flat(Infinity).forEach(child => {
    if (child === null || child === undefined || child === false) return;
    item.append(child instanceof Node ? child : document.createTextNode(String(child)));
  });
  return item;
}
function button(text, action, style = 'text-button', data = {}) {
  return el('button', { type: 'button', className: style, dataset: { action, ...data } }, text);
}
function field(label, name, type, value = '', attrs = {}) {
  const control = el('input', { name, type, ...attrs });
  if (value !== undefined && value !== null) control.value = value;
  return el('label', { className: 'field' }, label, control);
}
function selectField(label, name, options, selected = '') {
  const select = el('select', { name });
  options.forEach(option => {
    const item = typeof option === 'string' ? { value: option, label: option } : option;
    const optionNode = el('option', { value: item.value }, item.label);
    optionNode.selected = String(item.value) === String(selected);
    select.append(optionNode);
  });
  return el('label', { className: 'field' }, label, select);
}
function form(kind, ...children) {
  return el('form', { className: 'form-grid', dataset: { form: kind } }, ...children);
}
function section(cls, ...children) { return el('section', { className: cls }, ...children); }
function panel(...children) { return el('div', { className: 'panel' }, ...children); }
function heading(level, text) { return el('h' + level, {}, text); }
function paragraph(text, cls = '') { return el('p', { className: cls }, text); }
function money(value) { return '₹' + Number(value).toLocaleString('en-IN'); }
function dateLabel(value) {
  if (!value) return '—';
  const [year, month, day] = String(value).slice(0, 10).split('-');
  return year && month && day ? `${day}-${month}-${year}` : '—';
}
function dateInputToIso(value) {
  const match = /^(\d{2})-(\d{2})-(\d{4})$/.exec(String(value).trim());
  if (!match) throw new Error('Enter the date as DD-MM-YYYY.');
  const [, day, month, year] = match;
  const date = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (date.getUTCFullYear() !== Number(year) || date.getUTCMonth() !== Number(month) - 1 || date.getUTCDate() !== Number(day)) {
    throw new Error('Enter a valid date as DD-MM-YYYY.');
  }
  const todayLocal = new Date();
  todayLocal.setHours(0, 0, 0, 0);
  if (new Date(Number(year), Number(month) - 1, Number(day)) < todayLocal) {
    throw new Error('Check-in date cannot be in the past.');
  }
  return `${year}-${month}-${day}`;
}

async function api(path, options = {}) {
  const token = localStorage.getItem(tokenKey);
  const response = await fetch('/api' + path, {
    ...options,
    headers: {
      ...(options.body ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: 'Bearer ' + token } : {}),
      ...options.headers
    }
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || 'The request could not be completed');
  return result;
}
const send = (method, body) => ({ method, body: JSON.stringify(body) });

function table(headers, rows) {
  const thead = el('thead', {}, el('tr', {}, headers.map(label => el('th', {}, label))));
  const tbody = el('tbody', {}, rows);
  return el('div', { className: 'table-scroll' }, el('table', {}, thead, tbody));
}
function statusBadge(status) { return el('span', { className: 'status ' + String(status).toLowerCase() }, status); }
function setContent(element, children) { element.replaceChildren(...children.filter(Boolean)); }

function renderHeader() {
  const nav = el('nav', { 'aria-label': 'Main navigation' },
    button('Browse rooms', 'browse', 'nav-button' + (state.mode === 'browse' ? ' active' : '')),
    state.user?.kind === 'student' ? button('My account', 'account', 'nav-button' + (state.mode === 'account' ? ' active' : '')) : null,
    state.user?.kind === 'owner' ? button('Owner dashboard', 'owner', 'nav-button' + (state.mode === 'owner' ? ' active' : '')) : null
  );
  const userArea = el('div', { className: 'header-account' },
    state.user ? [
      el('span', {}, state.user.name + ' · ' + state.user.kind),
      button('Sign out', 'sign-out', 'button secondary small')
    ] : button('Sign in', 'sign-in', 'button primary small')
  );
  setContent(topbar, [
    el('a', { className: 'brand', href: '#top', dataset: { action: 'browse' } }, 'Hostel Finder'),
    nav, userArea
  ]);
}

function renderAuth() {
  const register = state.authMode === 'register';
  const student = state.accountKind === 'student';
  const intro = el('div', {},
    paragraph('STUDENT ACCOMMODATION & ROOMMATE FINDER', 'eyebrow'),
    heading(1, register ? 'Create an account' : 'Sign in'),
    paragraph('Students can search and book rooms. Hostel owners can list rooms and review requests.'),
    paragraph('This mini-project stores demo passwords as plain text for database demonstration. Do not use a real password.', 'help')
  );
  const tabs = el('div', { className: 'form-tabs' },
    button('Sign in', 'auth-login', state.authMode === 'login' ? 'selected' : ''),
    button('Register', 'auth-register', state.authMode === 'register' ? 'selected' : '')
  );
  const accountType = selectField('I am a', 'kind', [
    { value: 'student', label: 'Student' }, { value: 'owner', label: 'Hostel owner' }
  ], state.accountKind);
  const authForm = form('auth',
    accountType,
    ...(register ? [
      field('Full name', 'name', 'text', '', { required: true, maxlength: 120, autocomplete: 'name' }),
      field('Phone', 'phone', 'tel', '', { required: true, maxlength: 24, autocomplete: 'tel' }),
      ...(student ? [
        selectField('Gender', 'gender', [
          { value: '', label: 'Select gender' }, 'Male', 'Female', 'Non-binary', 'Undisclosed'
        ]),
        field('College', 'college', 'text', '', { required: true, maxlength: 150 })
      ] : [])
    ] : []),
    field('Email', 'email', 'email', '', { required: true, maxlength: 254, autocomplete: 'email' }),
    field('Password', 'password', 'password', '', { required: true, maxlength: 255, autocomplete: register ? 'new-password' : 'current-password' }),
    el('button', { className: 'button primary', disabled: state.busy }, state.busy ? 'Please wait…' : register ? 'Create account' : 'Sign in')
  );
  return section('panel auth-panel', intro, el('div', { className: 'form-card' }, tabs, authForm));
}

function renderIntro(title, description, eyebrow = 'Student Accommodation & Roommate Finder') {
  return section('intro', paragraph(eyebrow, 'eyebrow'), heading(1, title), paragraph(description));
}

function renderBrowse() {
  const filters = state.filters;
  const filterForm = el('form', { className: 'panel filters', dataset: { form: 'filters' } },
    field('Search hostels or city', 'q', 'search', filters.q || '', { placeholder: 'Mumbai, Andheri…' }),
    field('City', 'city', 'text', filters.city || '', { placeholder: 'Any city' }),
    selectField('Hostel type', 'genderType', [
      { value: '', label: 'Any type' }, 'Boys', 'Girls', 'Co-ed'
    ], filters.genderType || ''),
    selectField('Room type', 'roomType', [
      { value: '', label: 'Any type' }, 'Single', 'Double', 'Triple'
    ], filters.roomType || ''),
    field('Maximum monthly rent', 'maxRent', 'number', filters.maxRent || '', { min: 0, placeholder: '₹' }),
    selectField('Facility', 'facility', [
      { value: '', label: 'Any facility' }, ...state.facilities.map(item => item.facility_name)
    ], filters.facility || ''),
    selectField('Sort by', 'sort', [
      { value: 'rent', label: 'Rent: low to high' }, { value: 'rent-desc', label: 'Rent: high to low' }
    ], filters.sort || 'rent'),
    el('button', { className: 'button primary', disabled: state.busy }, 'Search rooms')
  );
  const intro = renderIntro('Find a room that fits your budget.', 'Compare rooms, check availability and facilities, then send a booking request.');
  return [intro, filterForm, state.selected ? renderHostelDetails() : renderRoomList()];
}

function renderRoomList() {
  const title = el('div', { className: 'section-head' },
    heading(2, 'Available rooms'),
    el('span', {}, state.loading ? 'Loading…' : state.rooms.length + ' results')
  );
  if (state.loading) return section('results', title, panel('Loading room listings…'));
  if (!state.rooms.length) return section('results', title,
    el('div', { className: 'empty' }, heading(3, 'No rooms match those filters'), paragraph('Try another city, rent, or facility.'))
  );
  const rows = state.rooms.map(room => el('tr', {},
    el('td', {}, el('strong', {}, room.hostel_name), el('small', {}, room.gender_type)),
    el('td', {}, room.city), el('td', {}, room.room_type),
    el('td', {}, room.available_beds + ' / ' + room.capacity),
    el('td', {}, money(room.rent_per_month)), el('td', {}, room.facilities || '—'),
    el('td', {}, button('View hostel', 'hostel', 'text-button', { hostelId: room.hostel_id }))
  ));
  return section('results', title,
    table(['Hostel', 'City', 'Type', 'Available', 'Rent / month', 'Facilities', ''], rows)
  );
}

function renderHostelDetails() {
  const data = state.selected;
  const hostel = data.hostel;
  const roomRows = data.rooms.map(room => {
    let request = state.user?.kind === 'student' && room.available_beds > 0
      ? form('booking',
        el('input', { type: 'hidden', name: 'roomId', value: room.room_id }),
        el('input', { type: 'text', name: 'checkInDate', placeholder: 'DD-MM-YYYY', inputmode: 'numeric',
          pattern: '\\d{2}-\\d{2}-\\d{4}', maxlength: 10, required: true,
          'aria-label': 'Check-in date, day-month-year' }),
        el('button', { className: 'button primary small', disabled: state.busy }, 'Request')
      )
      : el('span', {}, state.user ? 'Student account required' : 'Sign in as a student to request');
    request.classList.add('inline-book');
    request.dataset.roomId = room.room_id;
    return el('tr', {}, el('td', {}, room.room_type), el('td', {}, room.capacity),
      el('td', {}, room.available_beds), el('td', {}, money(room.rent_per_month)), el('td', {}, request));
  });
  const reviews = data.reviews.length
    ? el('ul', { className: 'review-list' }, data.reviews.map(item =>
      el('li', {}, el('strong', {}, item.student_name), ' · ' + item.rating + '/5',
        paragraph(item.comment || 'No comment'))
    ))
    : paragraph('No reviews yet.');
  const nodes = [
    button('← Back to rooms', 'back-to-rooms'),
    heading(2, hostel.name),
    paragraph(hostel.address + ', ' + hostel.city + ' · ' + hostel.gender_type),
    paragraph('Facilities: ' + (hostel.facilities || 'None listed')),
    heading(3, 'Rooms'),
    table(['Type', 'Capacity', 'Available', 'Monthly rent', 'Request'], roomRows),
    heading(3, 'Reviews'), reviews
  ];
  if (state.user?.kind === 'student') {
    const reviewForm = form('review',
      selectField('Your rating', 'rating', ['5', '4', '3', '2', '1'], '5'),
      el('label', { className: 'field' }, 'Comment', el('textarea', { name: 'comment', rows: 2, maxlength: 1000 })),
      el('button', { className: 'button secondary', disabled: state.busy }, 'Save review')
    );
    reviewForm.classList.add('review-form');
    reviewForm.dataset.hostelId = hostel.hostel_id;
    nodes.push(reviewForm);
  }
  return section('panel detail-panel', nodes);
}

function renderStudentAccount() {
  const data = state.student;
  const profile = data.profile;
  if (!profile) return section('panel', 'Loading your account…');
  const profileForm = form('profile',
    field('Name', 'name', 'text', profile.name, { required: true, maxlength: 120 }),
    field('Email', 'email', 'email', profile.email, { disabled: true }),
    field('Phone', 'phone', 'tel', profile.phone, { required: true, maxlength: 24 }),
    field('College', 'college', 'text', profile.college, { required: true, maxlength: 150 }),
    selectField('Gender', 'gender', ['Male', 'Female', 'Non-binary', 'Undisclosed'], profile.gender),
    el('button', { className: 'button primary', disabled: state.busy }, 'Save profile')
  );
  const pref = data.preferences || {};
  const preferencesForm = form('preferences',
    selectField('Smoking', 'smoking', ['Non-smoker', 'Occasional', 'Smoker'], pref.smoking || 'Non-smoker'),
    selectField('Sleep schedule', 'sleepSchedule', ['Early', 'Flexible', 'Late'], pref.sleep_schedule || 'Flexible'),
    selectField('Food preference', 'foodType', ['Vegetarian', 'Eggetarian', 'Non-vegetarian', 'Vegan'], pref.food_type || 'Vegetarian'),
    field('Cleanliness (1–5)', 'cleanliness', 'number', pref.cleanliness ?? 3, { min: 1, max: 5, required: true }),
    field('Maximum monthly budget (₹)', 'maxBudget', 'number', pref.max_budget ?? 7000, { min: 0, required: true }),
    el('button', { className: 'button primary', disabled: state.busy }, 'Save preferences')
  );
  const bookingRows = data.bookings.map(item => el('tr', {},
    el('td', {}, item.hostel_name, el('small', {}, item.city)),
    el('td', {}, item.room_type + ' · ' + money(item.rent_per_month) + '/month'),
    el('td', {}, dateLabel(item.check_in_date)), el('td', {}, statusBadge(item.status)),
    el('td', {}, ['Pending', 'Approved'].includes(item.status)
      ? button('Cancel', 'cancel-booking', 'text-button danger', { bookingId: item.booking_id }) : '—')
  ));
  const bookingTable = data.bookings.length
    ? table(['Hostel', 'Room', 'Check-in', 'Status', ''], bookingRows)
    : paragraph('No booking requests yet. Browse rooms to get started.', 'empty-message');
  const matchRows = data.matches.map(item => el('tr', {},
    el('td', {}, item.name, el('small', {}, 'Phone: ' + item.phone)), el('td', {}, item.college),
    el('td', {}, el('strong', {}, item.compatibility_percent + '%')),
    el('td', {}, item.smoking + ', ' + item.sleep_schedule + ', ' + item.food_type + ', cleanliness ' + item.cleanliness + '/5')
  ));
  const matchTable = data.matches.length
    ? table(['Student / phone', 'College', 'Compatibility', 'Lifestyle'], matchRows)
    : paragraph('Save your roommate preferences to see matches.', 'empty-message');
  const bookingTitle = el('div', { className: 'section-head' }, heading(2, 'My bookings'), button('Refresh', 'refresh'));
  return section('account-grid',
    panel(heading(1, 'Student account'), profileForm),
    panel(heading(2, 'Roommate preferences'), preferencesForm),
    el('div', { className: 'panel wide' }, bookingTitle, bookingTable),
    el('div', { className: 'panel wide' }, heading(2, 'Roommate matches'),
      paragraph('Other students with saved roommate preferences can see your name, college, and phone number.', 'help'), matchTable)
  );
}

function renderOwnerDashboard() {
  const addHostel = form('add-hostel',
    field('Hostel name', 'name', 'text', '', { required: true, maxlength: 150 }),
    field('Address', 'address', 'text', '', { required: true, maxlength: 255 }),
    field('City', 'city', 'text', '', { required: true, maxlength: 100 }),
    selectField('Hostel type', 'genderType', ['Boys', 'Girls', 'Co-ed'], 'Co-ed'),
    el('button', { className: 'button primary', disabled: state.busy }, 'Add hostel')
  );
  const hostelChoices = [{ value: '', label: 'Select hostel' },
  ...state.owner.hostels.map(item => ({ value: item.hostel_id, label: item.name }))];
  const addRoom = form('add-room',
    selectField('Hostel', 'hostelId', hostelChoices, ''),
    selectField('Room type', 'roomType', ['Single', 'Double', 'Triple'], 'Double'),
    field('Capacity', 'capacity', 'number', 2, { min: 1, max: 50, required: true }),
    field('Monthly rent (₹)', 'rentPerMonth', 'number', '', { min: 1, required: true }),
    el('button', { className: 'button primary', disabled: state.busy || !state.owner.hostels.length }, 'Add room')
  );
  const facilities = state.owner.hostels.map(hostel => {
    const current = (hostel.facilities || '').split(', ').filter(Boolean);
    const choices = el('fieldset', {}, el('legend', {}, 'Facilities'),
      state.facilities.map(facility => {
        const checkbox = el('input', { type: 'checkbox', name: 'facilityId', value: facility.facility_id });
        checkbox.checked = current.includes(facility.facility_name);
        return el('label', { className: 'check-label' }, checkbox, facility.facility_name);
      })
    );
    const saveForm = form('facilities',
      el('div', {}, el('strong', {}, hostel.name),
        el('small', {}, hostel.address + ', ' + hostel.city + ' · ' + hostel.gender_type),
        el('small', {}, 'Current facilities: ' + (hostel.facilities || 'None'))),
      choices,
      el('button', { className: 'button secondary small', disabled: state.busy }, 'Save facilities')
    );
    saveForm.classList.add('facility-row');
    saveForm.dataset.hostelId = hostel.hostel_id;
    return saveForm;
  });
  const hostelList = facilities.length ? el('div', { className: 'owner-hostels' }, facilities)
    : paragraph('Add a hostel to begin listing rooms.', 'empty-message');
  const bookingRows = state.owner.bookings.map(item => {
    const decisions = item.status === 'Pending'
      ? el('div', { className: 'actions' },
        button('Approve', 'decide', 'button primary small', { decision: 'approve', bookingId: item.booking_id }),
        button('Reject', 'decide', 'button secondary small', { decision: 'reject', bookingId: item.booking_id })
      ) : '—';
    return el('tr', {},
      el('td', {}, item.student_name,
        el('small', {}, item.gender + ' · ' + item.college),
        item.status === 'Pending' ? el('small', {}, 'Phone: ' + item.student_phone, el('br', {}), 'Email: ' + item.student_email) : null),
      el('td', {}, item.hostel_name, el('small', {}, item.room_type + ' · ' + item.capacity + ' beds')),
      el('td', {}, dateLabel(item.check_in_date)), el('td', {}, statusBadge(item.status)), el('td', {}, decisions)
    );
  });
  const bookingContent = bookingRows.length
    ? table(['Student', 'Hostel / room', 'Check-in', 'Status', 'Decision'], bookingRows)
    : paragraph('No booking requests for your hostels.', 'empty-message');
  const title = el('div', { className: 'section-head' }, heading(2, 'Booking requests'), button('Refresh', 'refresh'));
  return section('owner-view',
    renderIntro('Manage your hostels', 'Add a property, list its rooms, and review student requests.', 'Owner tools'),
    el('div', { className: 'account-grid' },
      panel(heading(2, 'Add a hostel'), addHostel),
      panel(heading(2, 'Add a room'), addRoom)
    ),
    panel(heading(2, 'Your hostels and facilities'), hostelList),
    el('div', { className: 'panel' }, title,
      paragraph('Pending requests include the student’s phone number and email so you can review their details before deciding.', 'help'), bookingContent)
  );
}

function render() {
  renderHeader();
  const content = [];
  if (state.notice) content.push(el('div', { className: 'notice', role: 'status' },
    state.notice, button('×', 'dismiss', 'text-button')));
  if (state.error) content.push(el('div', { className: 'error', role: 'alert' },
    state.error, button('×', 'dismiss-error', 'text-button')));
  if (state.mode === 'auth') content.push(renderAuth());
  else if (state.mode === 'account' && state.user?.kind === 'student') content.push(renderStudentAccount());
  else if (state.mode === 'owner' && state.user?.kind === 'owner') content.push(renderOwnerDashboard());
  else content.push(...renderBrowse());
  setContent(app, content);
}

async function loadRooms() {
  const params = new URLSearchParams();
  Object.entries(state.filters).forEach(([key, value]) => { if (value) params.set(key, value); });
  state.rooms = (await api('/rooms?' + params)).items;
  state.loading = false;
}
async function loadAccount() {
  if (state.user?.kind === 'student') {
    const [profile, preferences, bookings, matches] = await Promise.all([
      api('/me'), api('/me/preferences'), api('/bookings'), api('/me/compatibility')
    ]);
    state.student = { profile: profile.user, preferences: preferences.preferences, bookings: bookings.items, matches: matches.items };
  } else if (state.user?.kind === 'owner') {
    const [hostels, bookings] = await Promise.all([api('/owner/hostels'), api('/owner/bookings')]);
    state.owner = { hostels: hostels.items, bookings: bookings.items };
  }
}
async function run(action, message = '') {
  state.busy = true; state.error = ''; state.notice = ''; render();
  try { await action(); if (message) state.notice = message; }
  catch (error) { state.error = error.message || 'Something went wrong'; }
  finally { state.busy = false; render(); }
}
function valuesOf(formElement) { return Object.fromEntries(new FormData(formElement)); }

async function submitForm(event) {
  const target = event.target.closest('form[data-form]');
  if (!target) return;
  event.preventDefault();
  const kind = target.dataset.form;
  const values = valuesOf(target);
  if (kind === 'filters') {
    state.filters = values; state.loading = true;
    await run(loadRooms);
  } else if (kind === 'auth') {
    await run(async () => {
      if (state.authMode === 'register') await api('/auth/register', send('POST', { ...values, kind: state.accountKind }));
      const result = await api('/auth/login', send('POST', {
        kind: state.accountKind, email: values.email, password: values.password
      }));
      localStorage.setItem(tokenKey, result.token);
      state.user = result.user;
      await loadAccount();
      state.mode = state.user.kind === 'owner' ? 'owner' : 'account';
    }, state.authMode === 'register' ? 'Account created and signed in.' : 'Signed in.');
  } else if (kind === 'profile') {
    await run(async () => { await api('/me', send('PATCH', values)); await loadAccount(); }, 'Profile saved.');
  } else if (kind === 'preferences') {
    await run(async () => { await api('/me/preferences', send('PUT', values)); await loadAccount(); }, 'Roommate preferences saved.');
  } else if (kind === 'booking') {
    const roomId = Number(target.dataset.roomId);
    await run(async () => {
      await api('/bookings', send('POST', { roomId, checkInDate: dateInputToIso(values.checkInDate) }));
      await loadRooms(); await loadAccount();
      state.selected = await api('/hostels/' + state.selected.hostel.hostel_id);
    }, 'Booking request submitted. The owner must approve it.');
  } else if (kind === 'review') {
    const hostelId = Number(target.dataset.hostelId);
    await run(async () => {
      await api('/reviews', send('POST', { ...values, hostelId }));
      state.selected = await api('/hostels/' + hostelId);
    }, 'Review saved.');
  } else if (kind === 'add-hostel') {
    await run(async () => { await api('/owner/hostels', send('POST', values)); await loadAccount(); }, 'Hostel added.');
  } else if (kind === 'add-room') {
    await run(async () => { await api('/owner/rooms', send('POST', values)); await loadAccount(); await loadRooms(); }, 'Room added.');
  } else if (kind === 'facilities') {
    const facilityIds = new FormData(target).getAll('facilityId');
    const hostelId = Number(target.dataset.hostelId);
    await run(async () => { await api('/owner/hostels/' + hostelId + '/facilities', send('PUT', { facilityIds })); await loadAccount(); }, 'Facilities saved.');
  }
}

async function handleClick(event) {
  const target = event.target.closest('[data-action]');
  if (!target) return;
  const action = target.dataset.action;
  if (action === 'browse') { state.mode = 'browse'; state.selected = null; render(); }
  else if (action === 'account') { state.mode = 'account'; state.selected = null; render(); }
  else if (action === 'owner') { state.mode = 'owner'; state.selected = null; render(); }
  else if (action === 'sign-in') { state.mode = 'auth'; state.authMode = 'login'; render(); }
  else if (action === 'auth-login') { state.authMode = 'login'; render(); }
  else if (action === 'auth-register') { state.authMode = 'register'; render(); }
  else if (action === 'dismiss') { state.notice = ''; render(); }
  else if (action === 'dismiss-error') { state.error = ''; render(); }
  else if (action === 'back-to-rooms') { state.selected = null; render(); }
  else if (action === 'hostel') {
    await run(async () => { state.selected = await api('/hostels/' + target.dataset.hostelId); });
  } else if (action === 'refresh') {
    await run(async () => { await loadAccount(); await loadRooms(); });
  } else if (action === 'cancel-booking') {
    const id = Number(target.dataset.bookingId);
    await run(async () => { await api('/bookings/' + id + '/cancel', { method: 'POST' }); await loadAccount(); await loadRooms(); }, 'Booking cancelled.');
  } else if (action === 'decide') {
    const id = Number(target.dataset.bookingId), decision = target.dataset.decision;
    await run(async () => { await api('/owner/bookings/' + id + '/' + decision, { method: 'POST' }); await loadAccount(); await loadRooms(); }, 'Booking ' + decision + 'd.');
  } else if (action === 'sign-out') {
    await run(async () => {
      await api('/auth/logout', { method: 'POST' });
      localStorage.removeItem(tokenKey);
      state.user = null; state.mode = 'browse'; state.selected = null;
      state.student = { profile: null, preferences: null, bookings: [], matches: [] };
      state.owner = { hostels: [], bookings: [] };
    }, 'Signed out.');
  }
}

app.addEventListener('submit', submitForm);
app.addEventListener('click', handleClick);
topbar.addEventListener('click', handleClick);
app.addEventListener('change', event => {
  if (event.target.name === 'kind') {
    state.accountKind = event.target.value;
    render();
  }
});
async function start() {
  try {
    const [rooms, facilities] = await Promise.all([api('/rooms'), api('/facilities')]);
    state.rooms = rooms.items; state.facilities = facilities.items; state.loading = false;
    if (localStorage.getItem(tokenKey)) {
      try {
        state.user = (await api('/me')).user;
        await loadAccount();
      } catch {
        localStorage.removeItem(tokenKey);
      }
    }
  } catch (error) {
    state.loading = false;
    state.error = error.message || 'Could not connect to the database';
  }
  render();
}
render();
start();
