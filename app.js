/* ─── State ───────────────────────────────────────────────────────────────── */
const STORAGE_KEY = 'travel-planner-v1';

const ACTIVITY_TYPES = [
  { id: 'hotel',         emoji: '🏨', label: 'Hotel',       color: '#8b5cf6' },
  { id: 'food',          emoji: '🍜', label: 'Food',        color: '#f59e0b' },
  { id: 'attraction',    emoji: '🏛',  label: 'Attraction',  color: '#0ea5e9' },
  { id: 'transit',       emoji: '🚇', label: 'Transit',     color: '#10b981' },
  { id: 'walk',          emoji: '🚶', label: 'Walk',        color: '#6b7280' },
  { id: 'shopping',      emoji: '🛍',  label: 'Shopping',    color: '#ec4899' },
  { id: 'entertainment', emoji: '🎭', label: 'Entertainment', color: '#ef4444' },
];

const CURRENCIES = ['USD','EUR','GBP','JPY','CNY','HKD','SGD','THB','AUD','CAD','KRW','MYR','TWD','VND','IDR','PHP','CHF','SEK','NOK','DKK'];

const REGION_CURRENCY = {
  US:'USD', GB:'GBP', JP:'JPY', CN:'CNY', HK:'HKD', SG:'SGD', TH:'THB',
  AU:'AUD', CA:'CAD', KR:'KRW', MY:'MYR', TW:'TWD', VN:'VND', ID:'IDR',
  PH:'PHP', CH:'CHF', SE:'SEK', NO:'NOK', DK:'DKK',
  DE:'EUR', FR:'EUR', IT:'EUR', ES:'EUR', NL:'EUR', BE:'EUR', AT:'EUR',
  PT:'EUR', FI:'EUR', IE:'EUR', GR:'EUR', LU:'EUR', SK:'EUR', SI:'EUR',
  EE:'EUR', LV:'EUR', LT:'EUR', CY:'EUR', MT:'EUR',
};

// Timezone prefix → currency (more reliable than navigator.language)
const TZ_CURRENCY = {
  'Asia/Hong_Kong':'HKD', 'Asia/Tokyo':'JPY', 'Asia/Shanghai':'CNY',
  'Asia/Chongqing':'CNY', 'Asia/Harbin':'CNY', 'Asia/Urumqi':'CNY',
  'Asia/Singapore':'SGD', 'Asia/Bangkok':'THB', 'Asia/Seoul':'KRW',
  'Asia/Kuala_Lumpur':'MYR', 'Asia/Kuching':'MYR',
  'Asia/Taipei':'TWD', 'Asia/Ho_Chi_Minh':'VND', 'Asia/Saigon':'VND',
  'Asia/Jakarta':'IDR', 'Asia/Makassar':'IDR', 'Asia/Jayapura':'IDR',
  'Asia/Manila':'PHP', 'Asia/Macau':'HKD',
  'Asia/Kolkata':'INR', 'Asia/Calcutta':'INR', 'Asia/Dubai':'AED',
  'Asia/Riyadh':'SAR', 'Asia/Istanbul':'TRY', 'Asia/Jerusalem':'ILS',
  'Australia/Sydney':'AUD', 'Australia/Melbourne':'AUD',
  'Australia/Brisbane':'AUD', 'Australia/Perth':'AUD',
  'Pacific/Auckland':'NZD', 'Pacific/Fiji':'FJD',
  'Europe/London':'GBP', 'Europe/Zurich':'CHF', 'Europe/Stockholm':'SEK',
  'Europe/Oslo':'NOK', 'Europe/Copenhagen':'DKK',
  'America/Toronto':'CAD', 'America/Vancouver':'CAD',
  'America/Winnipeg':'CAD', 'America/Halifax':'CAD',
};

function guessCurrency() {
  // Primary: system timezone (most reliable)
  try {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (tz) {
      if (TZ_CURRENCY[tz]) return TZ_CURRENCY[tz];
      // European timezones not listed above → EUR
      if (tz.startsWith('Europe/')) return 'EUR';
      // US timezones → USD
      if (tz.startsWith('America/') && !TZ_CURRENCY[tz]) return 'USD';
    }
  } catch {}
  // Fallback: locale region code
  try {
    for (const lang of (navigator.languages || [navigator.language])) {
      const region = lang.split('-')[1]?.toUpperCase();
      if (region && REGION_CURRENCY[region]) return REGION_CURRENCY[region];
    }
  } catch {}
  return 'USD';
}

/* ─── Apps Script template (reserved for future OAuth sync) ──────────────── */
const APPS_SCRIPT_CODE = `/* Travel Planner — Apps Script
   1. In your Google Sheet: Extensions → Apps Script
   2. Replace everything with this code and save
   3. Deploy → New Deployment → Web App
      Execute as: Me  |  Who has access: Anyone
   4. Copy the Web App URL into Travel Planner */

const SHEET_NAME = 'Itinerary';

function doGet(e) {
  if (e.parameter.action === 'ping') {
    return respond({ status: 'ok', name: SpreadsheetApp.getActiveSpreadsheet().getName() });
  }
  try {
    const sheet = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
    if (!sheet) return respond({ error: 'No Itinerary sheet yet — sync from the app first.' });
    const [headers, ...rows] = sheet.getDataRange().getValues();
    return respond({ status: 'ok', headers, rows });
  } catch (err) { return respond({ error: err.message }); }
}

function doPost(e) {
  try {
    const payload = JSON.parse(e.postData.contents);
    const ss = SpreadsheetApp.getActiveSpreadsheet();
    let sheet = ss.getSheetByName(SHEET_NAME) || ss.insertSheet(SHEET_NAME);
    sheet.clearContents();
    const headers = ['Day','Theme','Date','Type','Emoji','Title','Start','End','Cost','Currency','Location','Notes'];
    const rows = [headers];
    (payload.days || []).forEach((day, di) => {
      const date = payload.startDate ? fmtDate(payload.startDate, di) : '';
      const acts = day.activities || [];
      if (!acts.length) {
        rows.push([di+1, day.title||'', date, '', '', '', '', '', '', '', '', '']);
      } else {
        acts.forEach(a => rows.push([
          di+1, day.title||'', date,
          a.type, a.emoji||'', a.title||'',
          a.startTime, a.endTime,
          a.cost||'', a.currency||payload.currency||'',
          a.location||'', a.notes||''
        ]));
      }
    });
    sheet.getRange(1, 1, rows.length, headers.length).setValues(rows);
    const hdr = sheet.getRange(1, 1, 1, headers.length);
    hdr.setFontWeight('bold').setBackground('#1a73e8').setFontColor('#ffffff');
    sheet.setFrozenRows(1);
    sheet.autoResizeColumns(1, headers.length);
    return respond({ status: 'ok', rows: rows.length - 1 });
  } catch (err) { return respond({ error: err.message }); }
}

function fmtDate(startDate, offset) {
  const d = new Date(startDate + 'T00:00:00');
  d.setDate(d.getDate() + offset);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEE, MMM d yyyy');
}

function respond(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}`;

let state = { trips: [] };
let currentView       = 'trips'; // 'trips' | 'trip' | 'day' | 'settings'
let currentTripId     = null;
let currentDayId      = null;
let currentActivityId = null;

/* ─── Persistence ─────────────────────────────────────────────────────────── */
function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) state = JSON.parse(raw);
  } catch {}
}

/* ─── Helpers ─────────────────────────────────────────────────────────────── */
function uid() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }

function typeInfo(id) { return ACTIVITY_TYPES.find(t => t.id === id) || ACTIVITY_TYPES[0]; }

function tripById(id) { return state.trips.find(t => t.id === id); }
function dayById(trip, id) { return trip?.days.find(d => d.id === id); }

// minutes since midnight  e.g. "09:30" → 570
function timeToMins(t) {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + m;
}
function minsToTime(m) {
  const h = Math.floor(m / 60) % 24;
  const mm = m % 60;
  return String(h).padStart(2,'0') + ':' + String(mm).padStart(2,'0');
}

// Timeline: always 24 hours, start hour configurable (default 6 AM)
const TL_PX_PER_MIN = 1; // 60px/hr = 1px/min
const TL_HOURS = 24;
function tlStartMins() { return (state.dayStartHour ?? 6) * 60; }

function minsToY(mins) {
  let rel = mins - tlStartMins();
  if (rel < 0) rel += 1440;
  return rel * TL_PX_PER_MIN;
}
function yToMins(y) {
  let mins = Math.round(y / TL_PX_PER_MIN) + tlStartMins();
  mins = Math.round(mins / 30) * 30;
  if (mins >= 1440) mins -= 1440;
  return mins;
}

function formatTime(t) {
  const [h, m] = t.split(':').map(Number);
  const suffix = h < 12 ? 'AM' : 'PM';
  const hh = h % 12 || 12;
  return `${hh}:${String(m).padStart(2,'0')} ${suffix}`;
}

function formatCost(cost, currency) {
  if (!cost && cost !== 0) return '';
  return `${currency || ''} ${Number(cost).toLocaleString()}`.trim();
}

function tripTotalCost(trip) {
  let total = {};
  trip.days.forEach(d => {
    d.activities.forEach(a => {
      if (a.cost) {
        const cur = a.currency || trip.currency || 'USD';
        total[cur] = (total[cur] || 0) + Number(a.cost);
      }
    });
  });
  return Object.entries(total).map(([c, v]) => `${c} ${v.toLocaleString()}`).join('  ·  ');
}

function dayTotalCost(trip, day) {
  let total = {};
  day.activities.forEach(a => {
    if (a.cost) {
      const cur = a.currency || trip.currency || 'USD';
      total[cur] = (total[cur] || 0) + Number(a.cost);
    }
  });
  return Object.entries(total).map(([c, v]) => `${c} ${v.toLocaleString()}`).join('  ·  ');
}

// Compute a day's calendar date from trip start date + day index (0-based)
function dayDate(trip, index) {
  if (!trip.startDate) return null;
  const d = new Date(trip.startDate + 'T00:00');
  d.setDate(d.getDate() + index);
  return d;
}

function formatDateRange(startDate, endDate) {
  if (!startDate) return '';
  const opts = { month: 'short', day: 'numeric' };
  const s = new Date(startDate + 'T00:00').toLocaleDateString('en-US', opts);
  if (!endDate || endDate === startDate) return s;
  const e = new Date(endDate + 'T00:00').toLocaleDateString('en-US', opts);
  return `${s} – ${e}`;
}

/* ─── Overlap Layout ──────────────────────────────────────────────────────── */
function layoutActivities(activities) {
  // Assign columns to overlapping activities
  const sorted = [...activities].sort((a, b) => timeToMins(a.startTime) - timeToMins(b.startTime));
  const cols = []; // each col is array of activities

  sorted.forEach(act => {
    const startM = timeToMins(act.startTime);
    let endM = timeToMins(act.endTime);
    if (endM <= startM) endM += 1440; // crosses midnight

    let placed = false;
    for (let ci = 0; ci < cols.length; ci++) {
      const last = cols[ci][cols[ci].length - 1];
      const lastEnd = (() => {
        let e = timeToMins(last.endTime);
        const s = timeToMins(last.startTime);
        if (e <= s) e += 1440;
        return e;
      })();
      if (startM >= lastEnd) {
        cols[ci].push(act);
        placed = true;
        break;
      }
    }
    if (!placed) cols.push([act]);
  });

  const result = {};
  cols.forEach((col, ci) => {
    col.forEach(act => {
      result[act.id] = { col: ci, totalCols: cols.length };
    });
  });
  // Fix totalCols per activity to reflect actual overlapping group width
  // Simple approach: pass total col count for that time window
  // Re-pass after knowing total cols
  const total = cols.length;
  Object.keys(result).forEach(id => { result[id].totalCols = total; });
  return result;
}

/* ─── Day Navigation ──────────────────────────────────────────────────────── */
function navigateDay(delta) {
  const trip = tripById(currentTripId);
  if (!trip) return;
  const idx    = trip.days.findIndex(d => d.id === currentDayId);
  const newIdx = idx + delta;
  if (newIdx < 0 || newIdx >= trip.days.length) return;
  currentActivityId = null;
  navigate('day', currentTripId, trip.days[newIdx].id);
}

/* ─── Date / Time Picker Helpers ─────────────────────────────────────────── */
function renderDatePicker(idPrefix, dateStr) {
  return `<input type="date" id="${idPrefix}" value="${esc(dateStr || '')}" />`;
}

function getDatePickerValue(idPrefix) {
  return document.getElementById(idPrefix)?.value || '';
}

function renderTimePicker(id, value) {
  // Snap value to nearest 30-min slot
  const snapped = (() => {
    if (!value) return '09:00';
    const m = timeToMins(value);
    const s = Math.round(m / 30) * 30 % 1440;
    return minsToTime(s);
  })();
  let opts = '';
  for (let h = 0; h < 24; h++) {
    for (let m = 0; m < 60; m += 30) {
      const t = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      opts += `<option value="${t}" ${snapped === t ? 'selected' : ''}>${formatTime(t)}</option>`;
    }
  }
  return `<select id="${id}">${opts}</select>`;
}

/* ─── Location Search (Nominatim + Google Maps iframe) ────────────────────── */
async function nominatimSearch(query) {
  const url = `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`;
  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  return res.json();
}

function initLocMap(lat, lng) {
  const container = document.getElementById('am-loc-map');
  if (!container) return;
  container.style.display = 'block';
  const src = `https://maps.google.com/maps?q=${lat},${lng}&z=15&output=embed`;
  container.innerHTML = `
    <iframe src="${src}" width="100%" height="100%" frameborder="0"
      style="border:0;width:100%;height:100%" allowfullscreen loading="lazy">
    </iframe>
    <button class="loc-map-expand" id="loc-map-expand-btn" title="Expand map">⤢</button>`;
  document.getElementById('loc-map-expand-btn')?.addEventListener('click', () => {
    const expanded = container.classList.toggle('expanded');
    const btn = document.getElementById('loc-map-expand-btn');
    if (btn) { btn.innerHTML = expanded ? '⤡' : '⤢'; btn.title = expanded ? 'Collapse' : 'Expand map'; }
  });
}

function destroyLocMap() {
  const container = document.getElementById('am-loc-map');
  if (container) { container.innerHTML = ''; container.style.display = 'none'; }
}

function attachLocSearch() {
  const input   = document.getElementById('am-location');
  const btn     = document.getElementById('am-loc-search');
  const results = document.getElementById('am-loc-results');

  const doSearch = async () => {
    const q = input.value.trim();
    if (!q) return;
    btn.textContent = '⏳';
    btn.disabled = true;
    try {
      const data = await nominatimSearch(q);
      results.innerHTML = '';
      if (!data.length) {
        results.innerHTML = '<div class="loc-no-results">No results found</div>';
      } else {
        data.forEach(item => {
          const el = document.createElement('div');
          el.className = 'loc-result-item';
          el.textContent = item.display_name;
          el.addEventListener('click', () => {
            input.value = item.display_name;
            document.getElementById('am-lat').value = item.lat;
            document.getElementById('am-lng').value = item.lon;
            results.innerHTML = '';
            results.style.display = 'none';
            initLocMap(parseFloat(item.lat), parseFloat(item.lon), item.display_name);
          });
          results.appendChild(el);
        });
      }
      results.style.display = '';
    } catch {
      results.innerHTML = '<div class="loc-no-results">Search failed — check connection</div>';
      results.style.display = '';
    } finally {
      btn.textContent = '🔍';
      btn.disabled = false;
    }
  };

  btn.addEventListener('click', doSearch);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); doSearch(); } });

  // If lat/lng already saved, show map immediately
  const lat = document.getElementById('am-lat').value;
  const lng = document.getElementById('am-lng').value;
  if (lat && lng) {
    requestAnimationFrame(() => initLocMap(parseFloat(lat), parseFloat(lng), input.value));
  }
}

/* ─── Navigate ────────────────────────────────────────────────────────────── */
function navigate(view, tripId, dayId) {
  clearInterval(window._nowLineTimer);
  currentView   = view;
  if (tripId !== undefined) currentTripId = tripId;
  if (dayId  !== undefined) currentDayId  = dayId;
  render();
}

/* ─── Render ──────────────────────────────────────────────────────────────── */
function render() {
  const app = document.getElementById('app');
  if (currentView === 'trips')    app.innerHTML = renderTrips();
  else if (currentView === 'trip') app.innerHTML = renderTrip();
  else if (currentView === 'day')  app.innerHTML = renderDay();
  else if (currentView === 'settings') app.innerHTML = renderSettings();
  attachHandlers();
}

/* ─── Trips List ──────────────────────────────────────────────────────────── */
function renderTrips() {
  const cards = state.trips.length
    ? state.trips.map(t => {
        const total = tripTotalCost(t);
        const range = formatDateRange(t.startDate, t.endDate);
        const dayCount = t.days.length;
        return `
        <div class="trip-card" data-trip="${t.id}">
          <div class="tc-left">
            <div class="tc-name">✈️ ${esc(t.name)}</div>
            ${t.destination ? `<div class="tc-dest">📍 ${esc(t.destination)}</div>` : ''}
            <div class="tc-meta">
              ${range ? `<span>🗓 ${range}</span>` : ''}
              <span>📅 ${dayCount} day${dayCount !== 1 ? 's' : ''}</span>
              ${t.currency ? `<span>💱 ${esc(t.currency)}</span>` : ''}
            </div>
            ${total ? `<div class="tc-cost">${total}</div>` : ''}
          </div>
          <div class="tc-right">
            <button class="btn-icon btn-del-trip" data-trip="${t.id}" title="Delete trip">🗑</button>
            <span class="tc-arrow">›</span>
          </div>
        </div>`;
      }).join('')
    : `<div class="empty-state">
        <div class="empty-icon">🌍</div>
        <div class="empty-msg">No trips yet</div>
        <div class="empty-sub">Tap + to plan your first adventure</div>
      </div>`;

  return `
  <div class="screen">
    <div class="app-bar">
      <div class="ab-title-wrap">
        <div class="ab-title">✈️ Travel Planner</div>
      </div>
      <div class="ab-actions">
        <button class="btn-icon" id="btn-open-settings" title="Settings">⚙️</button>
        <button class="btn-primary-sm" id="btn-new-trip">+ Trip</button>
      </div>
    </div>
    <div class="screen-body" id="trips-list">${cards}</div>
  </div>`;
}

/* ─── Trip Detail (Day List) ──────────────────────────────────────────────── */
function renderTrip() {
  const trip = tripById(currentTripId);
  if (!trip) { navigate('trips'); return ''; }

  const range = formatDateRange(trip.startDate, trip.endDate);
  const total = tripTotalCost(trip);

  const cards = trip.days.length
    ? trip.days.map((d, i) => {
        const cost = dayTotalCost(trip, d);
        const actCount = d.activities.length;
        const dd = dayDate(trip, i);
        const ddLabel = dd ? dd.toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}) : '';
        return `
        <div class="day-card" data-day="${d.id}">
          <div class="dc-num">Day ${i + 1}</div>
          <div class="dc-info">
            <div class="dc-title">${esc(d.title || 'Day ' + (i + 1))}</div>
            ${ddLabel ? `<div class="dc-date">📅 ${ddLabel}</div>` : ''}
            <div class="dc-meta">
              <span>${actCount} activit${actCount !== 1 ? 'ies' : 'y'}</span>
              ${cost ? `<span class="dc-cost">${cost}</span>` : ''}
            </div>
          </div>
          <div class="dc-actions">
            <button class="btn-icon btn-del-day" data-day="${d.id}" title="Delete day">🗑</button>
            <span class="dc-arrow">›</span>
          </div>
        </div>`;
      }).join('')
    : `<div class="empty-state">
        <div class="empty-icon">📅</div>
        <div class="empty-msg">No days yet</div>
        <div class="empty-sub">Tap + Day to add your first day</div>
      </div>`;

  return `
  <div class="screen">
    <div class="app-bar">
      <button class="btn-back" id="btn-back">‹</button>
      <div class="ab-title-wrap">
        <div class="ab-title">${esc(trip.name)}</div>
        <div class="ab-sub">${[trip.destination ? '📍 ' + trip.destination : '', range].filter(Boolean).join('  ·  ')}</div>
      </div>
      <div class="ab-actions">
        <button class="btn-icon btn-sheets-trip" title="${trip.sheetUrl ? 'Sheets connected' : 'Connect Google Sheets'}" style="${trip.sheetUrl ? '' : 'opacity:0.45'}">📊</button>
        <button class="btn-icon btn-edit-trip" title="Edit trip">✏️</button>
        <button class="btn-primary-sm" id="btn-new-day">+ Day</button>
      </div>
    </div>
    ${total ? `<div class="trip-header"><div class="th-total">Total: <strong>${total}</strong></div></div>` : ''}
    <div class="screen-body" id="days-list">${cards}</div>
  </div>`;
}

/* ─── Day Timeline ────────────────────────────────────────────────────────── */
function renderDay() {
  const trip = tripById(currentTripId);
  const day  = dayById(trip, currentDayId);
  if (!trip || !day) { navigate('trip', currentTripId); return ''; }

  const cost = dayTotalCost(trip, day);

  // Build hour labels (24 + endpoint label)
  const startHour = state.dayStartHour ?? 6;
  let labels = '';
  for (let h = 0; h <= TL_HOURS; h++) {
    const absHour = (startHour + h) % 24;
    const label = absHour === 0 ? '12 AM' : absHour < 12 ? `${absHour} AM` : absHour === 12 ? '12 PM' : `${absHour - 12} PM`;
    const y = h * 60;
    labels += `<div class="tl-label" style="top:${y}px">${label}</div>`;
  }

  // Grid lines (24 hours)
  let gridLines = '';
  for (let h = 0; h < TL_HOURS; h++) {
    gridLines += `<div class="tl-grid-line" style="top:${h * 60}px"></div>`;
    gridLines += `<div class="tl-grid-half" style="top:${h * 60 + 30}px"></div>`;
  }

  // Activity blocks with overlap layout
  const layout = layoutActivities(day.activities);
  const blocks = day.activities.map(act => {
    const info = typeInfo(act.type);
    const startM = timeToMins(act.startTime);
    let endM   = timeToMins(act.endTime);
    if (endM <= startM) endM += 1440;
    const durMins = endM - startM;
    const y = minsToY(startM);
    const h = Math.max(durMins * TL_PX_PER_MIN, 22);
    const { col, totalCols } = layout[act.id] || { col: 0, totalCols: 1 };
    const W = 100 / totalCols;
    const L = col * W;
    const costStr = act.cost ? formatCost(act.cost, act.currency || trip.currency || '') : '';
    const selected = act.id === currentActivityId;
    return `
    <div class="activity-block ${selected ? 'selected' : ''}" data-act="${act.id}"
      style="top:${y}px; height:${h}px; left:calc(${L}% + 2px); width:calc(${W}% - 4px);
             background: color-mix(in srgb, ${info.color} ${selected ? 30 : 20}%, transparent);
             border-left-color: ${info.color};">
      <div class="ab-inner">
        <div class="ab-title">${info.emoji} ${esc(act.title || info.label)}${act.booked ? ' <span class="ab-booked">✓</span>' : ''}</div>
        ${h > 30 ? `<div class="ab-meta">${formatTime(act.startTime)}${act.endTime ? ' – ' + formatTime(act.endTime) : ''}${costStr ? '  ·  ' + costStr : ''}</div>` : ''}
      </div>
    </div>`;
  }).join('');

  const dayIndex = trip.days.findIndex(d => d.id === day.id);
  const dd = dayDate(trip, dayIndex);
  const dateLabel = dd ? dd.toLocaleDateString('en-US', {weekday:'long', month:'short', day:'numeric'}) : '';

  return `
  <div class="screen">
    <div class="app-bar">
      <button class="btn-back" id="btn-back">‹</button>
      <div class="ab-title-wrap">
        <div class="ab-title">${esc(day.title || 'Day ' + (dayIndex + 1))}</div>
        ${dateLabel ? `<div class="ab-sub">${dateLabel}</div>` : ''}
      </div>
      <div class="ab-actions">
        <button class="btn-icon btn-edit-day" title="Edit day">✏️</button>
        <button class="btn-primary-sm" id="btn-new-act">+ Add</button>
      </div>
    </div>
    <div class="day-nav-bar">
      <button class="btn-day-nav" id="btn-day-prev" ${dayIndex === 0 ? 'disabled' : ''}>‹</button>
      <div class="day-nav-info">
        <span class="day-nav-cost">${cost || '—'}</span>
        <span class="day-nav-pos">Day ${dayIndex + 1} of ${trip.days.length}</span>
      </div>
      <button class="btn-day-nav" id="btn-day-next" title="${dayIndex === trip.days.length - 1 ? 'Last day' : 'Next day'}" ${dayIndex === trip.days.length - 1 ? 'disabled' : ''}>›</button>
    </div>
    <div class="day-timeline" id="day-timeline">
      <div class="tl-inner" style="height:${TL_HOURS * 60}px;min-height:${TL_HOURS * 60}px">
        <div class="tl-labels">${labels}</div>
        <div class="tl-area" id="tl-area">
          ${gridLines}
          ${blocks}
          <div class="tl-now-line" id="tl-now-line" style="display:none">
            <div class="tl-now-dot"></div>
          </div>
        </div>
      </div>
    </div>
    <div class="day-detail" id="day-detail">${renderActivityDetail(
      day.activities.find(a => a.id === currentActivityId) || null, trip
    )}</div>
  </div>`;
}

/* ─── Activity Detail Panel ───────────────────────────────────────────────── */
function renderActivityDetail(act, trip) {
  if (!act) return `
    <div class="detail-empty">
      <span>Tap an activity to see details</span>
    </div>`;

  const info    = typeInfo(act.type);
  const cost    = act.cost ? formatCost(act.cost, act.currency || trip?.currency || '') : '';
  const mapsUrl = act.mapsUrl || (act.location ? `https://maps.google.com/?q=${encodeURIComponent(act.location)}` : '');

  return `
  <div class="detail-content">
    <div class="detail-header">
      <div class="detail-type" style="color:${info.color}">${info.emoji} <strong>${esc(act.title || info.label)}</strong>
        <span class="detail-booking ${act.booked ? 'booked' : ''}">${act.booked ? '✅ Booked' : '○ Not booked'}</span>
      </div>
      <div class="detail-acts">
        ${mapsUrl ? `<a href="${esc(mapsUrl)}" target="_blank" class="btn-icon" title="Open in Maps">🗺</a>` : ''}
        <button class="btn-icon detail-share-btn" title="Share">↗</button>
        <button class="btn-icon detail-edit-btn" title="Edit">✏️</button>
      </div>
    </div>
    <div class="detail-row">🕐 ${formatTime(act.startTime)} – ${formatTime(act.endTime)}${cost ? `  ·  💰 ${cost}` : ''}</div>
    ${act.location ? `<div class="detail-row">📍 ${esc(act.location)}</div>` : ''}
    ${act.notes    ? `<div class="detail-row detail-notes">📝 ${esc(act.notes)}</div>` : ''}
  </div>`;
}

function updateDetailPanel(actId) {
  if (actId !== undefined) currentActivityId = actId;
  const panel = document.getElementById('day-detail');
  if (!panel) return;
  const trip = tripById(currentTripId);
  const day  = dayById(trip, currentDayId);
  const act  = day?.activities.find(a => a.id === currentActivityId) || null;

  panel.innerHTML = renderActivityDetail(act, trip);

  // Highlight selected block
  document.querySelectorAll('.activity-block').forEach(b => {
    const sel = b.dataset.act === currentActivityId;
    b.classList.toggle('selected', sel);
    b.style.background = (() => {
      const info = typeInfo(tripById(currentTripId)?.days
        .flatMap(d => d.activities).find(a => a.id === b.dataset.act)?.type);
      return `color-mix(in srgb, ${info?.color || '#888'} ${sel ? 30 : 20}%, transparent)`;
    })();
  });

  panel.querySelector('.detail-edit-btn')?.addEventListener('click', () => {
    if (act) openActivityModal(act, null);
  });
  panel.querySelector('.detail-share-btn')?.addEventListener('click', () => {
    if (act) openShareModal(act, trip, dayById(trip, currentDayId));
  });
}

/* ─── Share ───────────────────────────────────────────────────────────────── */
function buildShareText(act, trip, day) {
  const trip2  = trip  || tripById(currentTripId);
  const day2   = day   || dayById(trip2, currentDayId);
  const info   = typeInfo(act.type);
  const dayIdx = trip2.days.findIndex(d => d.id === day2?.id);
  const dd     = dayDate(trip2, dayIdx);
  const dateStr = dd ? dd.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric'}) : '';
  const cost   = act.cost ? formatCost(act.cost, act.currency || trip2?.currency || '') : '';
  const mapsUrl = act.mapsUrl || (act.location ? `https://maps.google.com/?q=${encodeURIComponent(act.location)}` : '');

  const lines = [];
  lines.push(`${info.emoji} *${act.title || info.label}*`);
  if (trip2?.name) lines.push(`✈️ ${trip2.name}${dateStr ? ` · ${dateStr}` : ''}`);
  lines.push(`🕐 ${formatTime(act.startTime)} – ${formatTime(act.endTime)}`);
  if (act.location) lines.push(`📍 ${act.location}`);
  if (cost)         lines.push(`💰 ${cost}`);
  if (act.booked)   lines.push(`✅ Booked`);
  if (act.notes)    lines.push(`📝 ${act.notes}`);
  if (mapsUrl)      lines.push(`🗺 ${mapsUrl}`);
  return lines.join('\n');
}

function openShareModal(act, trip, day) {
  const text = buildShareText(act, trip, day);
  const encoded = encodeURIComponent(text);

  openModal(`
  <div class="modal-header">
    <button class="modal-cancel">Cancel</button>
    <span class="modal-title">Share Activity</span>
  </div>
  <div class="modal-body">
    <textarea id="share-text" rows="7" style="font-size:0.8rem;line-height:1.6">${esc(text)}</textarea>
    <div class="share-btns">
      <button class="share-btn" id="share-copy">📋<span>Copy</span></button>
      <a class="share-btn" href="https://wa.me/?text=${encoded}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#25D366"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
        <span>WhatsApp</span>
      </a>
      <a class="share-btn" href="https://t.me/share/url?url=.&text=${encoded}" target="_blank" rel="noopener">
        <svg viewBox="0 0 24 24" width="20" height="20" fill="#229ED9"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/></svg>
        <span>Telegram</span>
      </a>
      ${navigator.share ? `<button class="share-btn" id="share-native">↗<span>More</span></button>` : ''}
    </div>
  </div>`);

  document.getElementById('share-copy')?.addEventListener('click', () => {
    const txt = document.getElementById('share-text').value;
    navigator.clipboard.writeText(txt).then(() => {
      const btn = document.getElementById('share-copy');
      if (btn) { btn.innerHTML = '✅<span>Copied!</span>'; setTimeout(() => { if (btn) btn.innerHTML = '📋<span>Copy</span>'; }, 2000); }
    });
  });

  document.getElementById('share-native')?.addEventListener('click', () => {
    const txt = document.getElementById('share-text').value;
    navigator.share({ text: txt }).catch(() => {});
  });
}

/* ─── Settings ────────────────────────────────────────────────────────────── */
function renderSettings() {
  return `
  <div class="screen">
    <div class="app-bar">
      <button class="btn-back" id="btn-back">‹</button>
      <div class="ab-title-wrap"><div class="ab-title">Settings</div></div>
    </div>
    <div class="screen-body">
      <div class="settings-body">
        <div class="settings-section">
          <h3>🕐 Timeline</h3>
          <div class="form-group">
            <label>DAY START HOUR</label>
            <select id="inp-start-hour">
              ${Array.from({length: 24}, (_, h) => {
                const label = h === 0 ? '12 AM (midnight)' : h < 12 ? `${h} AM` : h === 12 ? '12 PM (noon)' : `${h - 12} PM`;
                const sel = (state.dayStartHour ?? 6) === h ? 'selected' : '';
                return `<option value="${h}" ${sel}>${label}</option>`;
              }).join('')}
            </select>
          </div>
          <button class="btn-primary-sm" id="btn-save-start-hour">Save</button>
        </div>
        <div class="settings-section">
          <h3>📊 Google Sheets Sync</h3>
          <p class="settings-desc">Paste your Google OAuth Client ID to enable direct Sheets sync per trip. <a href="https://console.cloud.google.com/" target="_blank" style="color:var(--accent)">Get one free →</a></p>
          <input type="text" id="inp-gclient-id" class="input-code" placeholder="xxxxxxxx.apps.googleusercontent.com" value="${esc(state.gClientId || '')}" />
          <button class="btn-primary-sm" id="btn-save-gclient">Save Client ID</button>
          <div class="settings-status ${state.gClientId ? '' : 'coming-soon'}">${state.gClientId ? '✅ Client ID saved — tap 📊 on any trip to sync' : '⬜ No Client ID — CSV export/import available'}</div>
        </div>
        <div class="settings-section">
          <h3>💾 Data</h3>
          <button class="btn-danger" id="btn-export-json">⬇️ Export all trips (JSON)</button>
          <button class="btn-danger" id="btn-import-json">⬆️ Import trips (JSON)</button>
          <input type="file" id="inp-import-file" accept=".json" style="display:none" />
          <button class="btn-danger" id="btn-export-sheets">📊 Export all trips to Sheets (CSV)</button>
          <button class="btn-danger" id="btn-import-sheets">📊 Import from Sheets (CSV)</button>
          <input type="file" id="inp-import-sheets" accept=".csv" style="display:none" />
          <button class="btn-danger" id="btn-clear-data">🗑 Clear all data</button>
        </div>
      </div>
    </div>
  </div>`;
}

/* ─── Escape ──────────────────────────────────────────────────────────────── */
function esc(s) {
  return String(s ?? '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}

/* ─── Modal ───────────────────────────────────────────────────────────────── */
let modalCloseTimer = null;

function openModal(html, onSave) {
  const root = document.getElementById('modal-root');
  root.innerHTML = `
  <div class="modal-overlay" id="modal-overlay">
    <div class="modal-sheet" id="modal-sheet">${html}</div>
  </div>`;
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      document.getElementById('modal-sheet').classList.add('visible');
    });
  });
  document.getElementById('modal-overlay').addEventListener('click', e => {
    if (e.target.id === 'modal-overlay') closeModal();
  });
  document.getElementById('modal-sheet').addEventListener('click', e => e.stopPropagation());
  if (onSave) {
    document.getElementById('modal-sheet').querySelectorAll('.modal-save').forEach(btn => {
      btn.addEventListener('click', onSave);
    });
  }
  document.getElementById('modal-sheet').querySelectorAll('.modal-cancel').forEach(btn => {
    btn.addEventListener('click', closeModal);
  });
}

function closeModal() {
  const sheet = document.getElementById('modal-sheet');
  if (!sheet) return;
  destroyLocMap();
  sheet.classList.remove('visible');
  clearTimeout(modalCloseTimer);
  modalCloseTimer = setTimeout(() => {
    document.getElementById('modal-root').innerHTML = '';
  }, 320);
}

/* ─── Trip Modal ──────────────────────────────────────────────────────────── */
function defaultTripName(dest, startDate) {
  if (!dest) return '';
  const city = dest.split(',')[0].trim();
  if (!startDate) return city;
  const d = new Date(startDate + 'T00:00');
  const mmm = d.toLocaleDateString('en-US', { month: 'short' });
  const yy  = String(d.getFullYear()).slice(2);
  return `${city} ${mmm} '${yy}`;
}

function openTripModal(trip) {
  const modalTitle = trip ? 'Edit Trip' : 'New Trip';
  const defaultCurrency = trip?.currency || guessCurrency();
  const curOptions = CURRENCIES.map(c =>
    `<option value="${c}" ${defaultCurrency === c ? 'selected' : ''}>${c}</option>`
  ).join('');

  // For edit: derive numDays from existing endDate if present
  let numDays = '';
  if (trip?.startDate && trip?.endDate) {
    const diff = (new Date(trip.endDate + 'T00:00') - new Date(trip.startDate + 'T00:00')) / 86400000;
    numDays = diff + 1;
  } else if (trip?.days?.length) {
    numDays = trip.days.length;
  }

  openModal(`
  <div class="modal-header">
    <button class="modal-cancel">Cancel</button>
    <span class="modal-title">${modalTitle}</span>
    <button class="modal-save">Save</button>
  </div>
  <div class="modal-body">
    <div class="form-group">
      <label>DESTINATION <span style="color:var(--danger)">*</span></label>
      <input type="text" id="tm-dest" placeholder="e.g. Tokyo, Japan" value="${esc(trip?.destination || '')}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>START DATE <span style="color:var(--danger)">*</span></label>
        ${renderDatePicker('tm-start', trip?.startDate || '')}
      </div>
      <div class="form-group">
        <label>END DATE</label>
        ${renderDatePicker('tm-end', trip?.endDate || '')}
      </div>
    </div>
    <div class="form-group">
      <label>NUMBER OF DAYS <span style="color:var(--muted);font-weight:400">(fills end date)</span></label>
      <input type="number" id="tm-numdays" min="1" max="365" placeholder="e.g. 7" value="${esc(numDays)}" />
    </div>
    <div class="form-group">
      <label>TRIP NAME <span style="color:var(--muted);font-weight:400">(optional — auto-generated if blank)</span></label>
      <input type="text" id="tm-name" placeholder="e.g. Tokyo Apr '25" value="${esc(trip?.name || '')}" />
    </div>
    <div class="form-group">
      <label>DEFAULT CURRENCY</label>
      <select id="tm-currency">${curOptions}</select>
    </div>
    ${trip ? `<button class="btn-delete-act" id="tm-delete">Delete Trip</button>` : ''}
  </div>`, () => saveTripModal(trip));

  const toLocalDateStr = d =>
    `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;

  // Sync numDays → end date
  const syncEnd = () => {
    const start = getDatePickerValue('tm-start');
    const n     = parseInt(document.getElementById('tm-numdays').value, 10);
    if (start && n > 0) {
      const d = new Date(start + 'T00:00');
      d.setDate(d.getDate() + n - 1);
      document.getElementById('tm-end').value = toLocalDateStr(d);
    }
  };
  // Sync end date → numDays
  const syncNum = () => {
    const start = getDatePickerValue('tm-start');
    const end   = getDatePickerValue('tm-end');
    if (start && end) {
      const diff = (new Date(end + 'T00:00') - new Date(start + 'T00:00')) / 86400000;
      if (diff >= 0) document.getElementById('tm-numdays').value = diff + 1;
    }
  };
  document.getElementById('tm-numdays')?.addEventListener('input', syncEnd);
  document.getElementById('tm-start')?.addEventListener('change', () => {
    if (document.getElementById('tm-numdays').value) syncEnd(); else syncNum();
  });
  document.getElementById('tm-end')?.addEventListener('change', syncNum);

  if (trip) {
    document.getElementById('tm-delete')?.addEventListener('click', () => {
      if (confirm('Delete this trip and all its days?')) {
        state.trips = state.trips.filter(t => t.id !== trip.id);
        save(); closeModal(); navigate('trips');
      }
    });
  }
  document.getElementById('tm-dest')?.focus();
}

function saveTripModal(existing) {
  const dest      = document.getElementById('tm-dest').value.trim();
  const startDate = getDatePickerValue('tm-start');
  const endDate   = getDatePickerValue('tm-end');
  const currency  = document.getElementById('tm-currency').value;
  const name      = document.getElementById('tm-name').value.trim() || defaultTripName(dest, startDate);

  if (!dest)      { alert('Destination is required.'); return; }
  if (!startDate) { alert('Start date is required.'); return; }

  if (existing) {
    Object.assign(existing, { name, destination: dest, startDate, endDate, currency });
    // Reconcile days to match new trip length
    const numDays = (startDate && endDate)
      ? Math.max(1, Math.round((new Date(endDate+'T00:00') - new Date(startDate+'T00:00')) / 86400000) + 1)
      : Math.max(1, existing.days.length);
    while (existing.days.length < numDays) existing.days.push({ id: uid(), title: '', activities: [] });
    // Trim only empty trailing days if trip got shorter
    while (existing.days.length > numDays && !existing.days[existing.days.length-1].activities.length)
      existing.days.pop();
    save(); closeModal(); navigate('trip', currentTripId);
  } else {
    const trip = { id: uid(), name, destination: dest, startDate, endDate, currency, days: [] };
    // Auto-create all days based on trip length
    const numDays = (startDate && endDate)
      ? Math.max(1, Math.round((new Date(endDate+'T00:00') - new Date(startDate+'T00:00')) / 86400000) + 1)
      : 1;
    for (let i = 0; i < numDays; i++) trip.days.push({ id: uid(), title: '', activities: [] });
    state.trips.push(trip);
    currentTripId = trip.id;
    currentDayId  = trip.days[0].id;
    save(); closeModal(); navigate('day', currentTripId, currentDayId);
  }
}

/* ─── Day Modal ───────────────────────────────────────────────────────────── */
function openDayModal(day) {
  const trip = tripById(currentTripId);
  const dayIndex = day ? trip.days.findIndex(d => d.id === day.id) : trip.days.length;
  const dayNum = dayIndex + 1;
  const dd = dayDate(trip, dayIndex);
  const ddLabel = dd ? dd.toLocaleDateString('en-US', {weekday:'long', month:'long', day:'numeric'}) : '';
  const modalTitle = day ? `Edit Day ${dayNum}` : `Add Day ${dayNum}`;

  openModal(`
  <div class="modal-header">
    <button class="modal-cancel">Cancel</button>
    <span class="modal-title">${modalTitle}</span>
    <button class="modal-save">Save</button>
  </div>
  <div class="modal-body">
    ${ddLabel ? `<div class="settings-status" style="text-align:center">📅 ${ddLabel}</div>` : ''}
    <div class="form-group">
      <label>THEME / TITLE <span style="color:var(--muted);font-weight:400">(optional)</span></label>
      <input type="text" id="dm-title" placeholder="e.g. Arrival &amp; Shibuya" value="${esc(day?.title || '')}" />
    </div>
    ${day ? `<button class="btn-delete-act" id="dm-delete">Delete Day</button>` : ''}
  </div>`, () => saveDayModal(day, dayNum));

  if (day) {
    document.getElementById('dm-delete')?.addEventListener('click', () => {
      if (confirm('Delete this day and all its activities?')) {
        const trip = tripById(currentTripId);
        if (trip) trip.days = trip.days.filter(d => d.id !== day.id);
        save();
        closeModal();
        navigate('trip', currentTripId);
      }
    });
  }
  document.getElementById('dm-title')?.focus();
}

function saveDayModal(existing, dayNum) {
  const title = document.getElementById('dm-title').value.trim();
  const trip  = tripById(currentTripId);
  if (!trip) return;

  if (existing) {
    existing.title = title;
  } else {
    const day = { id: uid(), title, activities: [] };
    trip.days.push(day);
    currentDayId = day.id;
  }
  save();
  closeModal();
  if (existing) render();
  else navigate('day', currentTripId, currentDayId);
}

/* ─── Google Sheets OAuth + API ──────────────────────────────────────────── */
const SHEETS_SCOPE   = 'https://www.googleapis.com/auth/spreadsheets';
const SHEETS_API     = 'https://sheets.googleapis.com/v4/spreadsheets';
const DRIVE_API      = 'https://www.googleapis.com/drive/v3/files';
let   gToken         = null; // in-memory only — never persisted

const CSV_HEADERS = ['Day','Theme','Date','Type','Emoji','Title','Start','End','Cost','Currency','Location','Notes'];

function openSheetsModal(trip) {
  const hasOAuth = !!state.gClientId;
  const connected = !!trip.gSheetId;

  openModal(`
  <div class="modal-header">
    <button class="modal-cancel">Cancel</button>
    <span class="modal-title">📊 Google Sheets</span>
  </div>
  <div class="modal-body">
    ${hasOAuth ? `
      ${connected ? `
        <div class="settings-status" style="font-size:0.75rem;word-break:break-all">
          ✅ Linked — <a href="https://docs.google.com/spreadsheets/d/${esc(trip.gSheetId)}" target="_blank" style="color:var(--accent)">Open Sheet</a>
        </div>
        <button class="btn-primary-sm" id="sh-sync" style="width:100%">📤 Sync to Sheet</button>
        <button class="btn-danger" id="sh-pull">📥 Import from Sheet</button>
        <button class="btn-danger" id="sh-unlink">🔌 Unlink Sheet</button>
      ` : `
        <p class="settings-desc">Sign in with Google to create or link a sheet for this trip.</p>
        <div class="sheets-btns">
          <button class="btn-sheets" id="sh-new">
            <span>📄</span><span>New Sheet</span>
          </button>
          <button class="btn-sheets" id="sh-existing">
            <span>🔗</span><span>Existing Sheet</span>
          </button>
        </div>
        <div id="sh-existing-form" style="display:none">
          <div class="form-group" style="margin-top:10px">
            <label>SHEET ID OR URL</label>
            <input type="text" id="sh-sheet-id" class="input-code" placeholder="Paste Google Sheets URL or ID" />
          </div>
          <button class="btn-primary-sm" id="sh-link" style="width:100%;margin-top:4px">🔗 Sign in & Link</button>
        </div>
      `}
      <div id="sh-status" class="settings-status" style="display:none;margin-top:6px"></div>
    ` : `
      <p class="settings-desc">Add your Google OAuth Client ID in Settings to enable live sync.</p>
      <p class="settings-desc" style="margin-top:4px">For now, use CSV export/import below.</p>
    `}
    <div style="margin-top:10px;display:flex;flex-direction:column;gap:6px">
      <button class="btn-danger" id="sh-export-csv">⬇️ Export CSV</button>
      <button class="btn-danger" id="sh-import-csv">⬆️ Import CSV</button>
      <input type="file" id="sh-import-file" accept=".csv" style="display:none" />
    </div>
  </div>`);

  // CSV always available
  document.getElementById('sh-export-csv')?.addEventListener('click', () => exportTripCSV(trip));
  document.getElementById('sh-import-csv')?.addEventListener('click', () =>
    document.getElementById('sh-import-file').click()
  );
  document.getElementById('sh-import-file')?.addEventListener('change', e => importTripCSV(trip, e));

  if (!hasOAuth) return;

  const setStatus = (msg) => {
    const el = document.getElementById('sh-status');
    if (el) { el.style.display = ''; el.textContent = msg; }
  };

  if (connected) {
    document.getElementById('sh-sync')?.addEventListener('click', async () => {
      setStatus('⏳ Signing in…');
      withGToken(async token => {
        setStatus('⏳ Syncing…');
        try {
          await syncToGSheet(trip, token);
          setStatus('✅ Synced successfully');
        } catch (e) { setStatus('❌ ' + e.message); }
      });
    });
    document.getElementById('sh-pull')?.addEventListener('click', async () => {
      setStatus('⏳ Signing in…');
      withGToken(async token => {
        setStatus('⏳ Importing…');
        try {
          await importFromGSheet(trip, token);
          setStatus('✅ Imported');
          setTimeout(() => { closeModal(); render(); }, 800);
        } catch (e) { setStatus('❌ ' + e.message); }
      });
    });
    document.getElementById('sh-unlink')?.addEventListener('click', () => {
      if (confirm('Unlink this sheet? Sheet data is not deleted.')) {
        delete trip.gSheetId; save(); closeModal(); render();
      }
    });
  } else {
    document.getElementById('sh-new')?.addEventListener('click', () => {
      setStatus('⏳ Signing in…');
      withGToken(async token => {
        setStatus('⏳ Creating sheet…');
        try {
          const id = await createGSheet(trip.name || 'Trip', token);
          trip.gSheetId = id; save();
          setStatus('⏳ Writing itinerary…');
          await syncToGSheet(trip, token);
          setStatus(`✅ Created & synced — <a href="https://docs.google.com/spreadsheets/d/${id}" target="_blank" style="color:var(--accent)">Open Sheet</a>`);
          document.getElementById('sh-status').innerHTML = document.getElementById('sh-status').textContent;
          document.getElementById('sh-status').innerHTML = `✅ Created — <a href="https://docs.google.com/spreadsheets/d/${id}" target="_blank" style="color:var(--accent)">Open Sheet</a>`;
          setTimeout(() => { closeModal(); render(); }, 1500);
        } catch (e) { setStatus('❌ ' + e.message); }
      });
    });
    document.getElementById('sh-existing')?.addEventListener('click', () => {
      document.getElementById('sh-existing-form').style.display = '';
      document.getElementById('sh-sheet-id')?.focus();
    });
    document.getElementById('sh-link')?.addEventListener('click', () => {
      const raw = document.getElementById('sh-sheet-id').value.trim();
      const id  = extractSheetId(raw);
      if (!id) { setStatus('❌ Could not find a sheet ID in that URL.'); return; }
      setStatus('⏳ Signing in…');
      withGToken(async token => {
        try {
          // Verify access by reading sheet metadata
          const res = await gFetch(`${SHEETS_API}/${id}?fields=spreadsheetId,properties.title`, token);
          trip.gSheetId = res.spreadsheetId; save();
          setStatus('✅ Linked to "' + res.properties.title + '"');
          setTimeout(() => { closeModal(); render(); }, 1000);
        } catch (e) { setStatus('❌ Could not access that sheet. Check the ID and try again.'); }
      });
    });
  }
}

/* ─── OAuth helpers ───────────────────────────────────────────────────────── */
function withGToken(callback) {
  const clientId = state.gClientId;
  if (!clientId) { alert('Add your Google Client ID in Settings first.'); return; }
  if (!window.google?.accounts?.oauth2) {
    alert('Google sign-in library not loaded yet — please try again in a moment.');
    return;
  }
  const client = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope:     SHEETS_SCOPE,
    callback:  response => {
      if (response.error) { alert('Sign-in failed: ' + response.error); return; }
      gToken = response.access_token;
      callback(gToken);
    },
  });
  client.requestAccessToken({ prompt: gToken ? '' : 'consent' });
}

async function gFetch(url, token, options = {}) {
  const res = await fetch(url, {
    ...options,
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json', ...(options.headers || {}) },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error?.message || `HTTP ${res.status}`);
  }
  return res.json();
}

function extractSheetId(raw) {
  // Accepts full URL or bare ID
  const m = raw.match(/\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
  return m ? m[1] : (raw.match(/^[a-zA-Z0-9_-]{20,}$/) ? raw : null);
}

async function createGSheet(name, token) {
  const data = await gFetch(SHEETS_API, token, {
    method: 'POST',
    body: {
      properties: { title: name + ' — Itinerary' },
      sheets: [{ properties: { title: 'Itinerary' } }],
    },
  });
  return data.spreadsheetId;
}

async function ensureItinerarySheet(sheetId, token) {
  // Check if 'Itinerary' tab exists; add it if not
  const meta = await gFetch(`${SHEETS_API}/${sheetId}?fields=sheets.properties.title`, token);
  const exists = meta.sheets?.some(s => s.properties.title === 'Itinerary');
  if (!exists) {
    await gFetch(`${SHEETS_API}/${sheetId}:batchUpdate`, token, {
      method: 'POST',
      body: { requests: [{ addSheet: { properties: { title: 'Itinerary' } } }] },
    });
  }
}

async function syncToGSheet(trip, token) {
  await ensureItinerarySheet(trip.gSheetId, token);
  const rows = tripToCSVRows(trip); // reuse existing row builder
  // Clear then write
  await gFetch(`${SHEETS_API}/${trip.gSheetId}/values/Itinerary:clear`, token, { method: 'POST', body: {} });
  await gFetch(`${SHEETS_API}/${trip.gSheetId}/values/Itinerary!A1?valueInputOption=USER_ENTERED`, token, {
    method: 'PUT',
    body: { values: rows },
  });
  // Bold + freeze header row via batchUpdate
  const sheetMeta = await gFetch(`${SHEETS_API}/${trip.gSheetId}?fields=sheets.properties`, token);
  const sheetTabId = sheetMeta.sheets?.find(s => s.properties.title === 'Itinerary')?.properties?.sheetId ?? 0;
  await gFetch(`${SHEETS_API}/${trip.gSheetId}:batchUpdate`, token, {
    method: 'POST',
    body: { requests: [
      { repeatCell: { range: { sheetId: sheetTabId, startRowIndex: 0, endRowIndex: 1 },
          cell: { userEnteredFormat: { textFormat: { bold: true }, backgroundColor: { red: 0.102, green: 0.451, blue: 0.914 } } },
          fields: 'userEnteredFormat(textFormat,backgroundColor)' } },
      { updateSheetProperties: { properties: { sheetId: sheetTabId, gridProperties: { frozenRowCount: 1 } },
          fields: 'gridProperties.frozenRowCount' } },
    ]},
  });
}

async function importFromGSheet(trip, token) {
  await ensureItinerarySheet(trip.gSheetId, token);
  const data = await gFetch(`${SHEETS_API}/${trip.gSheetId}/values/Itinerary`, token);
  const [headers, ...rows] = data.values || [];
  if (!headers) throw new Error('Sheet is empty — sync first.');
  const idx = k => headers.indexOf(k);
  if (idx('Day') === -1) throw new Error('Invalid sheet format — missing expected headers.');

  const dayMap = {};
  rows.forEach(row => {
    const dayNum = Number(row[idx('Day')]) || 1;
    if (!dayMap[dayNum]) dayMap[dayNum] = { title: row[idx('Theme')] || '', activities: [] };
    const type = row[idx('Type')]?.trim();
    if (type) {
      dayMap[dayNum].activities.push({
        id: uid(), type,
        title:     row[idx('Title')]    || '',
        startTime: row[idx('Start')]    || '09:00',
        endTime:   row[idx('End')]      || '10:00',
        cost:      row[idx('Cost')]     || '',
        currency:  row[idx('Currency')] || trip.currency || '',
        location:  row[idx('Location')] || '',
        notes:     row[idx('Notes')]    || '',
      });
    }
  });

  if (!confirm(`Import ${Object.keys(dayMap).length} day(s) from Google Sheet? This replaces the current itinerary.`)) return;
  trip.days = Object.entries(dayMap)
    .sort(([a],[b]) => Number(a)-Number(b))
    .map(([,d]) => ({ id: uid(), title: d.title, activities: d.activities }));
  save();
}

/* ─── CSV Export / Import ─────────────────────────────────────────────────── */
function tripToCSVRows(trip) {
  const rows = [CSV_HEADERS];
  trip.days.forEach((d, i) => {
    const dd = dayDate(trip, i);
    const dateStr = dd ? dd.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric'}) : '';
    const acts = d.activities;
    if (!acts.length) {
      rows.push([i+1, d.title||'', dateStr, '', '', '', '', '', '', '', '', '']);
    } else {
      acts.forEach(a => rows.push([
        i+1, d.title||'', dateStr,
        a.type, typeInfo(a.type).emoji, a.title||'',
        a.startTime, a.endTime,
        a.cost||'', a.currency||trip.currency||'',
        a.location||'', a.notes||''
      ]));
    }
  });
  return rows;
}

function csvEscapeCell(v) {
  const s = String(v ?? '');
  return s.includes(',') || s.includes('"') || s.includes('\n')
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}

function exportTripCSV(trip) {
  const rows = tripToCSVRows(trip);
  const csv  = rows.map(r => r.map(csvEscapeCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const filename = (trip.name || 'trip').replace(/[^a-z0-9]/gi, '-') + '-itinerary.csv';
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function parseCSV(text) {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n');
  return lines.filter(l => l.trim()).map(line => {
    const cells = [];
    let cur = '', inQ = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQ) {
        if (ch === '"' && line[i+1] === '"') { cur += '"'; i++; }
        else if (ch === '"') inQ = false;
        else cur += ch;
      } else {
        if (ch === '"') inQ = true;
        else if (ch === ',') { cells.push(cur); cur = ''; }
        else cur += ch;
      }
    }
    cells.push(cur);
    return cells;
  });
}

function importTripCSV(trip, e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const [headers, ...rows] = parseCSV(ev.target.result);
      const idx = k => headers.indexOf(k);
      if (idx('Day') === -1) { alert('Invalid CSV — missing expected headers.'); return; }

      const dayMap = {};
      rows.forEach(row => {
        const dayNum = Number(row[idx('Day')]) || 1;
        if (!dayMap[dayNum]) dayMap[dayNum] = { title: row[idx('Theme')] || '', activities: [] };
        const type = row[idx('Type')]?.trim();
        if (type) {
          dayMap[dayNum].activities.push({
            id:        uid(),
            type,
            title:     row[idx('Title')]    || '',
            startTime: row[idx('Start')]    || '09:00',
            endTime:   row[idx('End')]      || '10:00',
            cost:      row[idx('Cost')]     || '',
            currency:  row[idx('Currency')] || trip.currency || '',
            location:  row[idx('Location')] || '',
            notes:     row[idx('Notes')]    || '',
          });
        }
      });

      const dayCount = Object.keys(dayMap).length;
      if (!confirm(`Import ${dayCount} day(s) from CSV? This replaces the current itinerary.`)) return;

      trip.days = Object.entries(dayMap)
        .sort(([a], [b]) => Number(a) - Number(b))
        .map(([, d]) => ({ id: uid(), title: d.title, activities: d.activities }));

      save(); closeModal(); render();
    } catch { alert('Could not parse CSV — make sure it was exported from Travel Planner.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ─── Activity Modal ──────────────────────────────────────────────────────── */
function openActivityModal(act, prefillStartMins) {
  const trip   = tripById(currentTripId);
  const title  = act ? 'Edit Activity' : 'Add Activity';
  const defCur = trip?.currency || 'USD';

  const defaultStart = act ? act.startTime : minsToTime(prefillStartMins ?? (9 * 60));
  const defaultEnd   = act ? act.endTime   : minsToTime((prefillStartMins ?? (9 * 60)) + 60);

  const typeBtns = ACTIVITY_TYPES.map(t => `
    <button class="type-btn ${act?.type === t.id ? 'active' : ''}" data-type="${t.id}" style="--tc:${t.color}">
      <span>${t.emoji}</span><span>${t.label}</span>
    </button>`).join('');

  const curOptions = CURRENCIES.map(c =>
    `<option value="${c}" ${(act?.currency || defCur) === c ? 'selected' : ''}>${c}</option>`
  ).join('');

  const booked = act?.booked ?? false;

  openModal(`
  <div class="modal-header">
    <button class="modal-cancel">Cancel</button>
    <span class="modal-title">${title}</span>
    <button class="modal-save">Save</button>
  </div>
  <div class="modal-body">
    <div class="form-group"><label>TYPE</label>
      <div class="type-picker" id="am-type-picker">${typeBtns}</div>
      <input type="hidden" id="am-type" value="${esc(act?.type || 'attraction')}" />
    </div>
    <div class="form-group">
      <label>TITLE</label>
      <input type="text" id="am-title" placeholder="e.g. Senso-ji Temple" value="${esc(act?.title || '')}" />
    </div>
    <div class="form-group">
      <label>LOCATION</label>
      <div class="loc-search-row">
        <input type="text" id="am-location" placeholder="Search for a place…" value="${esc(act?.location || '')}" />
        <button class="btn-primary-sm" id="am-loc-search" type="button">🔍</button>
      </div>
      <div id="am-loc-results" class="loc-results" style="display:none"></div>
      <div id="am-loc-map" class="loc-map"></div>
      <input type="hidden" id="am-lat" value="${esc(String(act?.lat || ''))}" />
      <input type="hidden" id="am-lng" value="${esc(String(act?.lng || ''))}" />
    </div>
    <div class="form-row">
      <div class="form-group">
        <label>START TIME</label>
        ${renderTimePicker('am-start', defaultStart)}
      </div>
      <div class="form-group">
        <label>END TIME</label>
        ${renderTimePicker('am-end', defaultEnd)}
      </div>
    </div>
    <div class="form-row">
      <div class="form-group flex1">
        <label>COST</label>
        <input type="number" id="am-cost" placeholder="0" min="0" step="any" value="${esc(act?.cost ?? '')}" />
      </div>
      <div class="form-group" style="width:110px;flex-shrink:0">
        <label>CURRENCY</label>
        <select id="am-currency">${curOptions}</select>
      </div>
    </div>
    <div class="form-group">
      <label>BOOKING</label>
      <button class="btn-booking ${booked ? 'booked' : ''}" id="am-booked-btn" type="button">
        ${booked ? '✅ Booked' : '○ Not booked yet'}
      </button>
      <input type="hidden" id="am-booked" value="${booked ? '1' : '0'}" />
    </div>
    <div class="form-group">
      <label>NOTES</label>
      <textarea id="am-notes" rows="2" placeholder="Booking refs, tips…">${esc(act?.notes || '')}</textarea>
    </div>
    ${act ? `<button class="btn-delete-act" id="am-delete">Delete Activity</button>` : ''}
  </div>`, () => saveActivityModal(act));

  // Type picker
  document.getElementById('am-type-picker').addEventListener('click', e => {
    const btn = e.target.closest('.type-btn');
    if (!btn) return;
    document.querySelectorAll('#am-type-picker .type-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    document.getElementById('am-type').value = btn.dataset.type;
    const info = typeInfo(btn.dataset.type);
    const titleInp = document.getElementById('am-title');
    if (!titleInp.value) titleInp.placeholder = `e.g. ${info.label}`;
  });

  // Booking toggle
  document.getElementById('am-booked-btn')?.addEventListener('click', () => {
    const inp = document.getElementById('am-booked');
    const btn = document.getElementById('am-booked-btn');
    const now = inp.value === '1';
    inp.value = now ? '0' : '1';
    btn.textContent = now ? '○ Not booked yet' : '✅ Booked';
    btn.classList.toggle('booked', !now);
  });

  // Location search + map
  attachLocSearch();

  if (act) {
    document.getElementById('am-delete')?.addEventListener('click', () => {
      const trip = tripById(currentTripId);
      const day  = dayById(trip, currentDayId);
      if (!day) return;
      day.activities = day.activities.filter(a => a.id !== act.id);
      save(); closeModal(); render();
    });
  }
  document.getElementById('am-title')?.focus();
}

function saveActivityModal(existing) {
  const type      = document.getElementById('am-type').value;
  const title     = document.getElementById('am-title').value.trim();
  const location  = document.getElementById('am-location').value.trim();
  const lat       = document.getElementById('am-lat').value;
  const lng       = document.getElementById('am-lng').value;
  const startTime = document.getElementById('am-start').value;
  const endTime   = document.getElementById('am-end').value;
  const cost      = document.getElementById('am-cost').value;
  const currency  = document.getElementById('am-currency').value;
  const booked    = document.getElementById('am-booked').value === '1';
  const notes     = document.getElementById('am-notes').value.trim();

  if (!startTime || !endTime) { alert('Start and end time are required.'); return; }

  const trip = tripById(currentTripId);
  const day  = dayById(trip, currentDayId);
  if (!day) return;

  // Build Maps URL from coords if available, else from location text
  const mapsUrl = lat && lng
    ? `https://maps.google.com/?q=${lat},${lng}`
    : location ? `https://maps.google.com/?q=${encodeURIComponent(location)}` : '';

  const fields = { type, title, location, lat: lat || '', lng: lng || '', mapsUrl, startTime, endTime, cost: cost || '', currency, booked, notes };
  if (existing) {
    Object.assign(existing, fields);
    currentActivityId = existing.id;
  } else {
    const act = { id: uid(), ...fields };
    day.activities.push(act);
    currentActivityId = act.id;
  }
  save();
  closeModal();
  render();
}

/* ─── Attach Handlers ─────────────────────────────────────────────────────── */
function attachHandlers() {
  // Back button
  document.getElementById('btn-back')?.addEventListener('click', () => {
    if (currentView === 'day')      navigate('trip', currentTripId);
    else if (currentView === 'trip') navigate('trips');
    else if (currentView === 'settings') navigate('trips');
  });

  // Trips screen
  if (currentView === 'trips') {
    document.getElementById('btn-new-trip')?.addEventListener('click', () => openTripModal(null));
    document.getElementById('btn-open-settings')?.addEventListener('click', () => navigate('settings'));
    document.querySelectorAll('.trip-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.btn-del-trip')) return; // handled separately
        navigate('trip', card.dataset.trip);
      });
    });
    document.querySelectorAll('.btn-del-trip').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('Delete this trip?')) {
          state.trips = state.trips.filter(t => t.id !== btn.dataset.trip);
          save(); render();
        }
      });
    });
  }

  // Trip screen
  if (currentView === 'trip') {
    document.getElementById('btn-new-day')?.addEventListener('click', () => openDayModal(null));
    document.querySelector('.btn-edit-trip')?.addEventListener('click', () => {
      openTripModal(tripById(currentTripId));
    });
    document.querySelector('.btn-sheets-trip')?.addEventListener('click', () => {
      openSheetsModal(tripById(currentTripId));
    });
    document.querySelectorAll('.day-card').forEach(card => {
      card.addEventListener('click', e => {
        if (e.target.closest('.btn-del-day')) return;
        navigate('day', currentTripId, card.dataset.day);
      });
    });
    document.querySelectorAll('.btn-del-day').forEach(btn => {
      btn.addEventListener('click', e => {
        e.stopPropagation();
        if (confirm('Delete this day?')) {
          const trip = tripById(currentTripId);
          if (trip) { trip.days = trip.days.filter(d => d.id !== btn.dataset.day); save(); render(); }
        }
      });
    });
  }

  // Day screen
  if (currentView === 'day') {
    document.getElementById('btn-new-act')?.addEventListener('click', () => openActivityModal(null, null));
    document.querySelector('.btn-edit-day')?.addEventListener('click', () => {
      const trip = tripById(currentTripId);
      openDayModal(dayById(trip, currentDayId));
    });

    document.getElementById('btn-day-prev')?.addEventListener('click', () => navigateDay(-1));
    document.getElementById('btn-day-next')?.addEventListener('click', () => navigateDay(1));

    // Touch swipe on timeline
    let swipeStartX = 0;
    const tl = document.getElementById('day-timeline');
    tl?.addEventListener('touchstart', e => { swipeStartX = e.touches[0].clientX; }, { passive: true });
    tl?.addEventListener('touchend', e => {
      const dx = e.changedTouches[0].clientX - swipeStartX;
      if (Math.abs(dx) > 50) navigateDay(dx < 0 ? 1 : -1);
    }, { passive: true });

    // Timeline click to add
    document.getElementById('tl-area')?.addEventListener('click', e => {
      if (e.target.closest('.activity-block')) return; // handled by block click
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top + e.currentTarget.closest('.day-timeline').scrollTop;
      const mins = yToMins(y);
      openActivityModal(null, mins);
    });

    // Activity block click — select and show in detail panel
    document.querySelectorAll('.activity-block').forEach(block => {
      block.addEventListener('click', e => {
        e.stopPropagation();
        updateDetailPanel(block.dataset.act);
      });
    });

    // Scroll → auto-focus nearest activity to viewport centre
    let scrollTimer = null;
    document.getElementById('day-timeline')?.addEventListener('scroll', function() {
      clearTimeout(scrollTimer);
      scrollTimer = setTimeout(() => {
        const trip = tripById(currentTripId);
        const day  = dayById(trip, currentDayId);
        if (!day?.activities.length) return;
        const centre = this.scrollTop + this.clientHeight / 2;
        let closest = null, minDist = Infinity;
        day.activities.forEach(act => {
          const sm = timeToMins(act.startTime);
          let em = timeToMins(act.endTime);
          if (em <= sm) em += 1440;
          const midY = minsToY(sm) + (em - sm) * TL_PX_PER_MIN / 2;
          const d = Math.abs(midY - centre);
          if (d < minDist) { minDist = d; closest = act; }
        });
        if (closest && closest.id !== currentActivityId) updateDetailPanel(closest.id);
      }, 80);
    }, { passive: true });

    // Current time indicator
    const updateNowLine = () => {
      const line = document.getElementById('tl-now-line');
      if (!line) { clearInterval(window._nowLineTimer); return; }
      const now  = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const y    = minsToY(mins);
      // Only show if current time falls within the timeline range
      // 24h timeline always includes current time
      line.style.display = 'block';
      line.style.top = y + 'px';
    };
    updateNowLine();
    clearInterval(window._nowLineTimer);
    window._nowLineTimer = setInterval(updateNowLine, 60000);

    // Scroll to current time (or 8am if outside timeline range)
    requestAnimationFrame(() => {
      const tl = document.getElementById('day-timeline');
      if (!tl) return;
      const now  = new Date();
      const mins = now.getHours() * 60 + now.getMinutes();
      const y    = minsToY(mins);
      const targetY = y; // 24h always includes current time
      tl.scrollTop = Math.max(0, targetY - tl.clientHeight / 3);
    });
  }

  // Settings screen
  if (currentView === 'settings') {
    document.getElementById('btn-save-start-hour')?.addEventListener('click', () => {
      state.dayStartHour = parseInt(document.getElementById('inp-start-hour').value, 10);
      save(); render();
    });
    document.getElementById('btn-save-gclient')?.addEventListener('click', () => {
      state.gClientId = document.getElementById('inp-gclient-id').value.trim();
      save(); render();
    });
    document.getElementById('btn-export-json')?.addEventListener('click', exportJSON);
    document.getElementById('btn-import-json')?.addEventListener('click', () => {
      document.getElementById('inp-import-file').click();
    });
    document.getElementById('inp-import-file')?.addEventListener('change', importJSON);
    document.getElementById('btn-export-sheets')?.addEventListener('click', exportAllCSV);
    document.getElementById('btn-import-sheets')?.addEventListener('click', () => {
      document.getElementById('inp-import-sheets').click();
    });
    document.getElementById('inp-import-sheets')?.addEventListener('change', importAllCSV);
    document.getElementById('btn-clear-data')?.addEventListener('click', () => {
      if (confirm('Delete all trips and data? This cannot be undone.')) {
        state = { trips: [] };
        save(); navigate('trips');
      }
    });
  }
}

/* ─── Export / Import ─────────────────────────────────────────────────────── */
function exportJSON() {
  const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'travel-planner-backup.json'; a.click();
  URL.revokeObjectURL(url);
}

function importJSON(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const imported = JSON.parse(ev.target.result);
      if (!imported.trips) throw new Error('Invalid format');
      if (confirm(`Import ${imported.trips.length} trip(s)? Existing data will be replaced.`)) {
        state = imported;
        save(); navigate('trips');
      }
    } catch { alert('Invalid JSON file.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ─── Toast ───────────────────────────────────────────────────────────────── */
function showToast(msg, durationMs = 3500) {
  document.querySelectorAll('.toast').forEach(t => t.remove());
  const el = document.createElement('div');
  el.className = 'toast';
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => {
    el.classList.add('fade-out');
    setTimeout(() => el.remove(), 420);
  }, durationMs);
}

/* ─── All-trips CSV (Google Sheets compatible) ────────────────────────────── */
const ALL_CSV_HEADERS = ['Trip','TripStart','TripEnd','TripCurrency','Day','Theme','Date','Type','Emoji','Title','Start','End','Cost','Currency','Location','Notes'];

function allTripsToCSVRows() {
  const rows = [ALL_CSV_HEADERS];
  state.trips.forEach(trip => {
    trip.days.forEach((d, i) => {
      const dd = dayDate(trip, i);
      const dateStr = dd ? dd.toLocaleDateString('en-US', {weekday:'short', month:'short', day:'numeric', year:'numeric'}) : '';
      const acts = d.activities;
      const tripBase = [trip.name||'', trip.startDate||'', trip.endDate||'', trip.currency||''];
      if (!acts.length) {
        rows.push([...tripBase, i+1, d.title||'', dateStr, '', '', '', '', '', '', '', '', '']);
      } else {
        acts.forEach(a => rows.push([
          ...tripBase,
          i+1, d.title||'', dateStr,
          a.type, typeInfo(a.type).emoji, a.title||'',
          a.startTime, a.endTime,
          a.cost||'', a.currency||trip.currency||'',
          a.location||'', a.notes||''
        ]));
      }
    });
  });
  return rows;
}

function exportAllCSV() {
  if (!state.trips.length) { showToast('No trips to export.'); return; }
  const rows = allTripsToCSVRows();
  const csv  = rows.map(r => r.map(csvEscapeCell).join(',')).join('\r\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href = url; a.download = 'travel-planner-all-trips.csv'; a.click();
  URL.revokeObjectURL(url);
  setTimeout(() => window.open('https://sheets.new', '_blank'), 400);
  showToast('CSV downloaded! In Google Sheets: File → Import → Upload → Replace spreadsheet');
}

function importAllCSV(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = ev => {
    try {
      const [headers, ...rows] = parseCSV(ev.target.result);
      const idx = k => headers.indexOf(k);
      if (idx('Trip') === -1 || idx('Day') === -1) {
        alert('Invalid file — expected a Travel Planner all-trips CSV export.');
        return;
      }

      // Group rows by trip name+start
      const tripMap = new Map();
      rows.forEach(row => {
        const key = (row[idx('Trip')]||'') + '|' + (row[idx('TripStart')]||'');
        if (!tripMap.has(key)) {
          tripMap.set(key, {
            id: uid(),
            name:      row[idx('Trip')]        || 'Trip',
            startDate: row[idx('TripStart')]   || '',
            endDate:   row[idx('TripEnd')]     || '',
            currency:  row[idx('TripCurrency')]|| '',
            days: {}
          });
        }
        const trip = tripMap.get(key);
        const dayNum = Number(row[idx('Day')]) || 1;
        if (!trip.days[dayNum]) trip.days[dayNum] = { title: row[idx('Theme')]||'', activities: [] };
        const type = row[idx('Type')]?.trim();
        if (type) {
          trip.days[dayNum].activities.push({
            id:        uid(),
            type,
            title:     row[idx('Title')]    || '',
            startTime: row[idx('Start')]    || '09:00',
            endTime:   row[idx('End')]      || '10:00',
            cost:      row[idx('Cost')]     || '',
            currency:  row[idx('Currency')] || '',
            location:  row[idx('Location')] || '',
            notes:     row[idx('Notes')]    || '',
          });
        }
      });

      const importedTrips = [...tripMap.values()].map(t => ({
        ...t,
        days: Object.entries(t.days)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([, d]) => ({ id: uid(), title: d.title, activities: d.activities }))
      }));

      if (!confirm(`Import ${importedTrips.length} trip(s) from CSV? Existing data will be replaced.`)) return;
      state.trips = importedTrips;
      save(); navigate('trips');
    } catch { alert('Could not parse CSV — make sure it was exported from Travel Planner.'); }
  };
  reader.readAsText(file);
  e.target.value = '';
}

/* ─── Init ────────────────────────────────────────────────────────────────── */
load();
render();
