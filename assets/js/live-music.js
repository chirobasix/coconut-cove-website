/* Coconut Cove — Live Music page
   Calendar rendering + live Google Calendar sync.

   Configuration:
   - CALENDAR_EMAIL: the public Google Calendar this page reads from.
   - GCAL_API_KEY:   paste a public, Calendar-API-only key from
                     Google Cloud Console to enable the fast direct
                     fetch path (preferred for production).
   - If GCAL_API_KEY is empty, we fall back to public CORS proxies
     that read the .ics feed. Fine for previews; less reliable.
*/
(function () {
  'use strict';

  var CALENDAR_EMAIL     = 'coconutcovesurfcity@gmail.com';
  var CALENDAR_EMAIL_ENC = encodeURIComponent(CALENDAR_EMAIL);
  var GCAL_API_KEY       = ''; // <-- paste key here for production

  var ICS_FEED = 'https://calendar.google.com/calendar/ical/' + CALENDAR_EMAIL_ENC + '/public/basic.ics';
  var PROXIES  = [
    function (url) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(url); },
    function (url) { return 'https://corsproxy.io/?' + encodeURIComponent(url); },
    function (url) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url); }
  ];

  var SUBSCRIBE = {
    google: 'https://calendar.google.com/calendar/u/0?cid=' + btoa(CALENDAR_EMAIL).replace(/=+$/, ''),
    apple:  'webcal://calendar.google.com/calendar/ical/' + CALENDAR_EMAIL_ENC + '/public/basic.ics',
    ics:    'https://calendar.google.com/calendar/ical/' + CALENDAR_EMAIL_ENC + '/public/basic.ics'
  };

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

  // Demo events used until live feed loads, or if the feed fails entirely.
  var DEMO_EVENTS = [
    { title: 'Sam Holloway',           date: '2026-06-12', start: '18:30', end: '21:00', genre: 'Solo · acoustic',     description: 'Originals + low-key covers. Sit dockside, order the painkiller.' },
    { title: 'The Tar Heel Trio',      date: '2026-06-13', start: '19:30', end: '22:30', genre: 'Country soul',        description: 'A Coconut Cove regular. Three pieces, two encores, one really good fiddle.' },
    { title: 'Ocean Drive Band',       date: '2026-06-14', start: '20:00', end: '23:00', genre: 'Beach funk',          description: 'Six-piece beach band straight off the strip. Dancing on the deck encouraged.' },
    { title: 'Brunch with Cole',       date: '2026-06-15', start: '11:00', end: '13:30', genre: 'Jazz piano',          description: 'Sunday brunch on the dock. Cole takes requests after his second espresso.' },
    { title: 'Mary Allen & The Sailors', date: '2026-06-20', start: '19:30', end: '22:00', genre: 'Folk · songwriter', description: 'New songs from Mary\'s upcoming record. Quiet show — bring someone you like.' },
    { title: 'Big Carolina Brass',     date: '2026-06-21', start: '19:00', end: '22:00', genre: 'Brass band · funk',   description: 'Eight horns, two drums, no chill. Loudest show of the season.' },
    { title: 'Brunch with Cole',       date: '2026-06-22', start: '11:00', end: '13:30', genre: 'Jazz piano',          description: 'He\'s back. So is the espresso machine.' },
    { title: 'Pelican Bones',          date: '2026-06-26', start: '18:30', end: '21:00', genre: 'Indie · songwriter',  description: 'Wilmington four-piece. First time playing the Cove.' },
    { title: 'The Salt Drifters',      date: '2026-06-27', start: '20:00', end: '23:00', genre: 'Beach rock',          description: 'Three guitars and a stand-up bass. The kind of show that ends too early.' },
    { title: 'Sunday Songbook',        date: '2026-06-28', start: '11:00', end: '13:30', genre: 'Open mic · acoustic', description: 'Sign up at the bar by 10:30 to play a song. Or just sit and listen.' }
  ];

  // ---------- Helpers ----------
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }
  function startOfMonth(y, m) { return new Date(y, m, 1); }
  function daysInMonth(y, m) { return new Date(y, m + 1, 0).getDate(); }
  function fmtTime(hhmm) {
    var parts = hhmm.split(':').map(Number);
    var h = parts[0], m = parts[1];
    var period = h >= 12 ? 'pm' : 'am';
    var h12 = ((h + 11) % 12) + 1;
    return m === 0 ? h12 + ' ' + period : h12 + ':' + pad2(m) + ' ' + period;
  }

  // ---------- ICS parsing ----------
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
    return (s || '')
      .replace(/\\n/g, '\n').replace(/\\,/g, ',')
      .replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  }

  function parseIcs(text) {
    var lines = unfoldIcs(text).split(/\r?\n/);
    var events = [], cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (line === 'END:VEVENT')   { if (cur) events.push(cur); cur = null; continue; }
      if (!cur) continue;
      var idx = line.indexOf(':');
      if (idx < 0) continue;
      var keyName = line.slice(0, idx).split(';')[0];
      var value = line.slice(idx + 1);
      if (keyName === 'DTSTART')          cur.startAt = parseIcsDate(line);
      else if (keyName === 'DTEND')       cur.endAt = parseIcsDate(line);
      else if (keyName === 'SUMMARY')     cur.title = unescapeIcsText(value);
      else if (keyName === 'DESCRIPTION') cur.description = unescapeIcsText(value);
      else if (keyName === 'UID')         cur.id = value;
      else if (keyName === 'CATEGORIES')  cur.categories = value.split(',');
    }
    return events;
  }

  function enrichGenre(ev) {
    var lines = (ev.description || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
    var genre = '', body = [];
    for (var i = 0; i < lines.length; i++) {
      var mg = lines[i].match(/^genre\s*:\s*(.+)$/i);
      if (mg) genre = mg[1].trim();
      else body.push(lines[i]);
    }
    if (!genre && ev.categories && ev.categories.length) genre = ev.categories.join(' · ');
    if (!genre) genre = 'Live on the deck';
    return Object.assign({}, ev, { genre: genre, description: body.join(' ').trim() });
  }

  function icsToEvents(text) {
    return parseIcs(text)
      .filter(function (e) { return e.startAt && e.title; })
      .map(function (e) {
        var startAt = e.startAt;
        var endAt = e.endAt || new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
        return enrichGenre({
          id: e.id || (isoDate(startAt) + '-' + e.title),
          title: e.title,
          startAt: startAt,
          endAt: endAt,
          date:  isoDate(startAt),
          start: pad2(startAt.getHours()) + ':' + pad2(startAt.getMinutes()),
          end:   pad2(endAt.getHours())   + ':' + pad2(endAt.getMinutes()),
          description: e.description,
          categories: e.categories
        });
      })
      .sort(function (a, b) { return a.startAt - b.startAt; });
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
    var start = new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString();
    var params = new URLSearchParams({
      key: GCAL_API_KEY, timeMin: start, maxResults: '250',
      singleEvents: 'true', orderBy: 'startTime'
    });
    var url = 'https://www.googleapis.com/calendar/v3/calendars/' + CALENDAR_EMAIL_ENC + '/events?' + params;
    return fetch(url, { cache: 'no-store' })
      .then(function (r) { if (!r.ok) throw new Error('Calendar API HTTP ' + r.status); return r.json(); })
      .then(function (json) {
        return (json.items || []).map(function (it) {
          var startAt = new Date(it.start.dateTime || it.start.date);
          var endAt = new Date((it.end && (it.end.dateTime || it.end.date)) || startAt.getTime() + 2*60*60*1000);
          return enrichGenre({
            id: it.id,
            title: it.summary || 'Live music',
            startAt: startAt, endAt: endAt,
            date:  isoDate(startAt),
            start: pad2(startAt.getHours()) + ':' + pad2(startAt.getMinutes()),
            end:   pad2(endAt.getHours())   + ':' + pad2(endAt.getMinutes()),
            description: it.description
          });
        }).sort(function (a, b) { return a.startAt - b.startAt; });
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

  function demoEvents() {
    return DEMO_EVENTS.map(function (e) {
      return Object.assign({}, e, {
        id: e.date + '-' + e.title,
        startAt: new Date(e.date + 'T' + e.start + ':00'),
        endAt: new Date(e.date + 'T' + e.end + ':00')
      });
    });
  }

  function fetchEvents() {
    return fetchViaApi()
      .then(function (events) {
        if (events && events.length) return { events: events, source: 'google-api' };
        return fetchViaProxy().then(function (events) { return { events: events, source: 'google-ics' }; });
      })
      .catch(function () {
        return fetchViaProxy()
          .then(function (events) { return { events: events, source: 'google-ics' }; })
          .catch(function () { return { events: demoEvents(), source: 'demo' }; });
      });
  }

  // ---------- DOM refs ----------
  var monthTitle = document.querySelector('[data-month-title]');
  var prevBtn    = document.querySelector('[data-month-prev]');
  var nextBtn    = document.querySelector('[data-month-next]');
  var calCells   = document.querySelector('[data-cal-cells]');
  var upNextEl   = document.querySelector('[data-up-next]');
  var selectedEl = document.querySelector('[data-selected-day]');
  var upcomingEl = document.querySelector('[data-upcoming]');
  var googleA    = document.querySelector('[data-subscribe-google]');
  var appleA     = document.querySelector('[data-subscribe-apple]');
  var icsA       = document.querySelector('[data-subscribe-ics]');

  if (googleA) googleA.href = SUBSCRIBE.google;
  if (appleA)  appleA.href  = SUBSCRIBE.apple;
  if (icsA)    icsA.href    = SUBSCRIBE.ics;

  // ---------- State ----------
  var now = new Date();
  var state = {
    year: now.getFullYear(),
    month: now.getMonth(),
    events: [],
    selectedIso: null,
    weeks: 2
  };

  // ---------- Render ----------
  function escapeHtml(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  function render() {
    if (monthTitle) monthTitle.textContent = MONTHS[state.month] + ' ' + state.year;
    renderCalendar();
    renderUpNext();
    renderSelected();
    renderUpcoming();
  }

  function renderCalendar() {
    if (!calCells) return;
    var first = startOfMonth(state.year, state.month);
    var dim = daysInMonth(state.year, state.month);
    var startDow = first.getDay();

    var byDate = {};
    state.events.forEach(function (e) {
      if (e.startAt.getFullYear() !== state.year || e.startAt.getMonth() !== state.month) return;
      var key = isoDate(e.startAt);
      if (!byDate[key]) byDate[key] = [];
      byDate[key].push(e);
    });

    var html = '';
    for (var i = 0; i < startDow; i++) {
      html += '<div class="cal-cell cal-cell--blank"></div>';
    }
    for (var d = 1; d <= dim; d++) {
      var date = new Date(state.year, state.month, d);
      var iso = isoDate(date);
      var dayEvents = byDate[iso] || [];
      var has = dayEvents.length > 0;
      var selected = iso === state.selectedIso;
      var cls = 'cal-cell' + (has ? ' cal-cell--has-event' : '') + (selected ? ' cal-cell--selected' : '');
      var attr = has ? ' role="button" tabindex="0" data-iso="' + iso + '"' : '';
      html += '<div class="' + cls + '"' + attr + '>';
      html += '<div class="cal-cell__day">' + d + '</div>';
      if (has) {
        html += '<div class="cal-cell__events">';
        dayEvents.slice(0, 2).forEach(function (e) {
          html += '<div class="cal-cell__event"><span class="cal-cell__dot"></span><span>' + escapeHtml(e.title) + '</span></div>';
        });
        if (dayEvents.length > 2) {
          html += '<div class="cal-cell__more">+' + (dayEvents.length - 2) + ' more</div>';
        }
        html += '</div>';
      }
      html += '</div>';
    }
    while ((html.match(/cal-cell/g) || []).length % 7) {
      html += '<div class="cal-cell cal-cell--blank"></div>';
    }
    calCells.innerHTML = html;

    calCells.querySelectorAll('[data-iso]').forEach(function (cell) {
      cell.addEventListener('click', function () {
        state.selectedIso = state.selectedIso === cell.dataset.iso ? null : cell.dataset.iso;
        render();
      });
      cell.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); cell.click(); }
      });
    });
  }

  function renderUpNext() {
    if (!upNextEl) return;
    var today = new Date(); today.setHours(0,0,0,0);
    var ev = state.events.find(function (e) { return e.startAt >= today; });
    if (!ev) {
      upNextEl.innerHTML = '<div class="up-next__empty"><p class="cc-script cc-size-36">no shows in the queue</p><p style="margin-top: 12px; color: var(--cc-rope);">Check back soon — we book about six months out.</p></div>';
      return;
    }
    var dow = ev.startAt.toLocaleDateString('en-US', { weekday: 'long' });
    upNextEl.innerHTML =
      '<div class="up-next__card">' +
        '<img src="assets/images/coconut-drink-pink.png" alt="" class="up-next__bg-drink" aria-hidden="true" loading="lazy">' +
        '<div class="up-next__date-circle">' +
          '<span class="up-next__dow">' + dow.slice(0,3).toLowerCase() + '</span>' +
          '<span class="up-next__day-num">' + ev.startAt.getDate() + '</span>' +
          '<span class="up-next__month">' + MONTHS[ev.startAt.getMonth()] + '</span>' +
        '</div>' +
        '<div class="up-next__body">' +
          '<p class="cc-eyebrow up-next__eyebrow-pink">' + dow + ' · ' + fmtTime(ev.start) + '</p>' +
          '<h3 class="cc-heading up-next__title cc-size-72">' + escapeHtml(ev.title) + '</h3>' +
          '<p class="up-next__genre">' + escapeHtml(ev.genre.toLowerCase()) + '</p>' +
          (ev.description ? '<p class="up-next__desc">' + escapeHtml(ev.description) + '</p>' : '') +
        '</div>' +
      '</div>';
  }

  function renderSelected() {
    if (!selectedEl) return;
    if (!state.selectedIso) { selectedEl.innerHTML = ''; return; }
    var dayEvents = state.events.filter(function (e) { return isoDate(e.startAt) === state.selectedIso; });
    if (!dayEvents.length) { selectedEl.innerHTML = ''; return; }
    var d = new Date(state.selectedIso + 'T12:00:00');
    var dateLabel = d.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });
    var html = '<div class="selected-day__panel">' +
      '<div class="selected-day__head"><p class="cc-eyebrow" style="color: var(--cc-pink);">Selected · ' + dateLabel + '</p>' +
      '<span class="selected-day__count">' + dayEvents.length + ' show' + (dayEvents.length > 1 ? 's' : '') + '</span></div>';
    dayEvents.forEach(function (e) {
      html += '<div class="selected-day__event">' +
        '<div class="selected-day__time">' + fmtTime(e.start) + '</div>' +
        '<div>' +
          '<div class="selected-day__title">' + escapeHtml(e.title) + '</div>' +
          '<div class="selected-day__genre">' + escapeHtml(e.genre) + '</div>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';
    selectedEl.innerHTML = html;
  }

  function renderUpcoming() {
    if (!upcomingEl) return;
    var today = new Date(); today.setHours(0,0,0,0);
    var end = new Date(today); end.setDate(end.getDate() + state.weeks * 7);

    var future = state.events.filter(function (e) { return e.startAt >= today && e.startAt <= end; });
    var remaining = state.events.filter(function (e) { return e.startAt > end; }).length;

    var groups = {};
    future.forEach(function (e) {
      var k = e.startAt.getFullYear() + '-' + e.startAt.getMonth();
      if (!groups[k]) groups[k] = { year: e.startAt.getFullYear(), month: e.startAt.getMonth(), events: [] };
      groups[k].events.push(e);
    });

    var html = '<div class="upcoming__head">' +
      '<p class="cc-eyebrow">The whole lineup</p>' +
      '<h2 class="cc-heading upcoming__heading cc-size-80">What\'s coming.</h2>' +
      '<p class="cc-script cc-size-36" style="margin-top: 8px;">' +
        (state.weeks === 2 ? 'next two weeks' : 'next ' + state.weeks + ' weeks') +
      '</p></div>';

    var groupKeys = Object.keys(groups);
    if (groupKeys.length === 0) {
      html += '<div class="upcoming__empty"><p class="cc-script cc-size-36">nothing in this window</p>' +
        '<p style="margin-top: 12px; color: var(--cc-rope);">Try the calendar above or load further out.</p></div>';
    } else {
      groupKeys.forEach(function (k) {
        var g = groups[k];
        html += '<div class="upcoming__group">' +
          '<div class="upcoming__group-head"><h3 class="cc-heading">' + MONTHS[g.month] + '</h3>' +
          '<span>' + g.year + '</span></div>';
        g.events.forEach(function (e) {
          html += '<div class="upcoming__event">' +
            '<div>' +
              '<div class="upcoming__date-num">' + e.startAt.getDate() + '</div>' +
              '<div class="upcoming__date-dow">' + e.startAt.toLocaleDateString('en-US', { weekday: 'short' }) + '</div>' +
            '</div>' +
            '<div>' +
              '<div class="upcoming__title">' + escapeHtml(e.title) + '</div>' +
              '<div class="upcoming__genre">' + escapeHtml(e.genre) + '</div>' +
            '</div>' +
            '<div class="upcoming__time">' + fmtTime(e.start) + '</div>' +
          '</div>';
        });
        html += '</div>';
      });
    }

    if (remaining > 0) {
      html += '<div class="upcoming__load-more">' +
        '<button type="button" class="cc-btn cc-btn--primary cc-btn--lg" data-load-more>' +
          'Load next two weeks ' +
          '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>' +
        '</button>' +
        '<p class="upcoming__remaining">' + remaining + ' more show' + (remaining > 1 ? 's' : '') + ' booked further out</p>' +
      '</div>';
    }

    upcomingEl.innerHTML = html;

    var loadMore = upcomingEl.querySelector('[data-load-more]');
    if (loadMore) loadMore.addEventListener('click', function () { state.weeks += 2; render(); });
  }

  // ---------- Month nav ----------
  function step(delta) {
    state.selectedIso = null;
    var m = state.month + delta, y = state.year;
    if (m < 0)  { m = 11; y -= 1; }
    if (m > 11) { m = 0;  y += 1; }
    state.month = m; state.year = y;
    render();
  }
  if (prevBtn) prevBtn.addEventListener('click', function () { step(-1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { step(+1); });

  // ---------- Boot ----------
  // Render once with empty state so the page paints fast,
  // then update when the feed arrives.
  render();

  fetchEvents().then(function (result) {
    state.events = result.events;
    var today = new Date(); today.setHours(0,0,0,0);
    var next = state.events.find(function (e) { return e.startAt >= today; });
    if (next) {
      state.year = next.startAt.getFullYear();
      state.month = next.startAt.getMonth();
    }
    render();
  });
})();
