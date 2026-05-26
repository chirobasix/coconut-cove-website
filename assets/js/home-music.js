/* Coconut Cove — Home page live-music snippet
   Renders the next 3 upcoming shows from the public Google Calendar
   into <ul data-home-music> in the "Live on the Lanai" section.

   Mirrors the calendar-fetch logic in assets/js/live-music.js
   (Google Calendar API → ICS via CORS proxy → demo fallback)
   without pulling in the full month-grid renderer. If both
   real paths fail, the placeholder loading card stays and the
   "Full lineup" link still gets the user to the live music page.

   To enable the fast direct API path in production, paste a
   Calendar-API-only key from Google Cloud Console into
   GCAL_API_KEY below. */
(function () {
  'use strict';

  var listEl = document.querySelector('[data-home-music]');
  if (!listEl) return;

  var CALENDAR_EMAIL     = 'coconutcovesurfcity@gmail.com';
  var CALENDAR_EMAIL_ENC = encodeURIComponent(CALENDAR_EMAIL);
  var GCAL_API_KEY       = ''; // paste a public API key here for production

  var ICS_FEED = 'https://calendar.google.com/calendar/ical/' + CALENDAR_EMAIL_ENC + '/public/basic.ics';
  var PROXIES  = [
    function (url) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(url); },
    function (url) { return 'https://corsproxy.io/?' + encodeURIComponent(url); },
    function (url) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url); }
  ];

  // ---------- Helpers ----------
  function pad2(n) { return String(n).padStart(2, '0'); }
  function fmtTime(d) {
    var h = d.getHours(), m = d.getMinutes();
    var period = h >= 12 ? 'pm' : 'am';
    var h12 = ((h + 11) % 12) + 1;
    return m === 0 ? h12 + ' ' + period : h12 + ':' + pad2(m) + ' ' + period;
  }
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }
  // Google Calendar's public iCal feed exposes private events as "Busy".
  // Drop those — they're not real shows.
  function isRealShow(title) {
    if (!title) return false;
    var t = String(title).trim().toLowerCase();
    return t !== 'busy' && t !== 'private' && t !== 'private event';
  }

  // ---------- ICS parsing (subset of live-music.js) ----------
  function unfoldIcs(text) { return text.replace(/\r?\n[ \t]/g, ''); }
  function parseIcsDate(raw) {
    var m = raw.match(/(?:.*:)?(\d{8})T?(\d{6})?Z?/);
    if (!m) return null;
    var d = m[1], t = m[2] || '000000';
    var y = +d.slice(0,4), mo = +d.slice(4,6) - 1, day = +d.slice(6,8);
    var hh = +t.slice(0,2), mm = +t.slice(2,4), ss = +t.slice(4,6);
    var isUtc = /Z$/.test(raw.split(':').pop());
    return isUtc ? new Date(Date.UTC(y, mo, day, hh, mm, ss))
                 : new Date(y, mo, day, hh, mm, ss);
  }
  function unescapeIcsText(s) {
    return (s || '').replace(/\\n/g, '\n').replace(/\\,/g, ',')
                    .replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  }
  function icsToEvents(text) {
    var unfolded = unfoldIcs(text);
    var lines = unfolded.split(/\r?\n/);
    var events = [], cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (line === 'END:VEVENT') {
        if (cur && cur.startAt && isRealShow(cur.title)) events.push(cur);
        cur = null; continue;
      }
      if (!cur) continue;
      var idx = line.indexOf(':');
      if (idx < 0) continue;
      var keyName = line.slice(0, idx).split(';')[0];
      var value = line.slice(idx + 1);
      if (keyName === 'DTSTART')      cur.startAt = parseIcsDate(line);
      else if (keyName === 'SUMMARY') cur.title = unescapeIcsText(value);
    }
    return events.sort(function (a, b) { return a.startAt - b.startAt; });
  }

  // ---------- Fetch paths ----------
  function fetchWithTimeout(url, ms) {
    ms = ms || 6000;
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, { cache: 'no-store', signal: ctrl.signal })
      .then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.text();
      });
  }
  function fetchViaApi() {
    if (!GCAL_API_KEY) return Promise.resolve(null);
    var now = new Date();
    var params = new URLSearchParams({
      key: GCAL_API_KEY,
      timeMin: now.toISOString(),
      maxResults: '20',
      singleEvents: 'true',
      orderBy: 'startTime'
    });
    var url = 'https://www.googleapis.com/calendar/v3/calendars/' + CALENDAR_EMAIL_ENC + '/events?' + params;
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Calendar API HTTP ' + r.status); return r.json(); })
      .then(function (json) {
        return (json.items || [])
          .filter(function (it) { return isRealShow(it.summary); })
          .map(function (it) {
            return {
              title: it.summary,
              startAt: new Date(it.start.dateTime || it.start.date)
            };
          })
          .sort(function (a, b) { return a.startAt - b.startAt; });
      });
  }
  function fetchViaProxy() {
    return PROXIES.reduce(function (promise, mkUrl) {
      return promise.catch(function () {
        return fetchWithTimeout(mkUrl(ICS_FEED), 6000).then(function (text) {
          if (!text || text.indexOf('BEGIN:VCALENDAR') === -1) throw new Error('Bad ICS body');
          return icsToEvents(text);
        });
      });
    }, Promise.reject(new Error('init')));
  }
  function fetchEvents() {
    return fetchViaApi()
      .then(function (events) {
        if (events && events.length) return events;
        return fetchViaProxy();
      })
      .catch(function () { return fetchViaProxy().catch(function () { return []; }); });
  }

  // ---------- Render ----------
  var DOW_ABBR = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  var MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

  function render(events) {
    if (!events.length) {
      // Network failed — show a polite fallback that points to the full page.
      listEl.innerHTML =
        '<li class="show-card show-card--pink">' +
          '<div class="show-card__date">' +
            '<div class="show-card__day">···</div>' +
            '<div class="show-card__when">SOON</div>' +
          '</div>' +
          '<div>' +
            '<div class="show-card__band">Lineup loading slowly</div>' +
            '<div class="show-card__style">Check the full calendar page</div>' +
          '</div>' +
          '<svg class="show-card__icon--pink" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
        '</li>';
      return;
    }

    // Take the next 3 upcoming shows from "right now" (not start of day),
    // so once a show is over it falls off the home page.
    var now = new Date();
    var upcoming = events.filter(function (e) { return e.startAt >= now; }).slice(0, 3);

    if (!upcoming.length) {
      listEl.innerHTML =
        '<li class="show-card show-card--pink">' +
          '<div class="show-card__date">' +
            '<div class="show-card__day">—</div>' +
            '<div class="show-card__when">QUIET WEEK</div>' +
          '</div>' +
          '<div>' +
            '<div class="show-card__band">No shows on the books</div>' +
            '<div class="show-card__style">Check back soon — we book about six months out</div>' +
          '</div>' +
          '<svg class="show-card__icon--pink" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
        '</li>';
      return;
    }

    var html = upcoming.map(function (ev, i) {
      // Alternate pink/teal borders to match the original visual rhythm.
      var tone = i % 2 === 0 ? 'pink' : 'teal';
      var iconClass = tone === 'pink' ? 'show-card__icon--pink' : 'show-card__icon--teal';
      var dow = DOW_ABBR[ev.startAt.getDay()];
      var dateLabel = MONTH_ABBR[ev.startAt.getMonth()] + ' ' + ev.startAt.getDate();
      return '<li class="show-card show-card--' + tone + '">' +
        '<div class="show-card__date">' +
          '<div class="show-card__day">' + dow + '</div>' +
          '<div class="show-card__when">' + dateLabel.toUpperCase() + '</div>' +
        '</div>' +
        '<div>' +
          '<div class="show-card__band">' + escapeHtml(ev.title) + '</div>' +
          '<div class="show-card__style">Live on the Lanai · ' + fmtTime(ev.startAt) + '</div>' +
        '</div>' +
        '<svg class="' + iconClass + '" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>' +
      '</li>';
    }).join('');

    listEl.innerHTML = html;
  }

  // ---------- Boot ----------
  fetchEvents().then(render);
})();
