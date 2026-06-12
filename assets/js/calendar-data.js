/* Coconut Cove — shared live-music calendar data layer
   ----------------------------------------------------------------
   One source of truth for both the Live Music page and the home
   page snippet. Exposes window.CCCalendar.getEvents() →
   Promise<Array<event>>.

   Reliability strategy (NO fake/placeholder data, ever):
     1. Fresh localStorage cache (< 12h)  → resolve instantly,
        then quietly revalidate in the background for next time.
     2. /api/events  → the Cloudflare Pages Function that fetches
        Google's iCal feed server-side (no CORS, edge-cached 12h).
        This is the primary, reliable path.
     3. Public CORS proxies → legacy fallback, still REAL data,
        only used if the function is unreachable.
     4. Stale localStorage cache (any age) → last-known-good real
        events if the network is fully down.
     5. Empty array → honest "no shows / try again" state.

   Event shape (consumed by live-music.js and home-music.js):
     { id, title, startAt:Date, endAt:Date, date:"YYYY-MM-DD",
       start:"HH:MM", end:"HH:MM", genre, description } */
(function () {
  'use strict';

  var CALENDAR_EMAIL = 'coconutcovesurfcity@gmail.com';
  var EMAIL_ENC = encodeURIComponent(CALENDAR_EMAIL);

  var API_ENDPOINT = '/api/events';
  var ICS_FEED = 'https://calendar.google.com/calendar/ical/' + EMAIL_ENC + '/public/basic.ics';

  // Legacy CORS-proxy fallback. Only reached if /api/events is down.
  var PROXIES = [
    function (url) { return 'https://api.codetabs.com/v1/proxy/?quest=' + encodeURIComponent(url); },
    function (url) { return 'https://corsproxy.io/?' + encodeURIComponent(url); },
    function (url) { return 'https://api.allorigins.win/raw?url=' + encodeURIComponent(url); }
  ];

  var CACHE_KEY = 'cc-cal-v1';
  var CACHE_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

  var SUBSCRIBE = {
    google: 'https://calendar.google.com/calendar/u/0?cid=' + btoa(CALENDAR_EMAIL).replace(/=+$/, ''),
    apple:  'webcal://calendar.google.com/calendar/ical/' + EMAIL_ENC + '/public/basic.ics',
    ics:    'https://calendar.google.com/calendar/ical/' + EMAIL_ENC + '/public/basic.ics'
  };

  /* ---------- generic helpers ---------- */
  function pad2(n) { return String(n).padStart(2, '0'); }
  function isoDate(d) { return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); }

  function isRealShow(title) {
    if (!title) return false;
    var t = String(title).trim().toLowerCase();
    return t !== 'busy' && t !== 'private' && t !== 'private event';
  }

  function fetchWithTimeout(url, ms) {
    ms = ms || 8000;
    var ctrl = new AbortController();
    var t = setTimeout(function () { ctrl.abort(); }, ms);
    return fetch(url, { cache: 'no-store', signal: ctrl.signal })
      .then(function (r) {
        clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r;
      });
  }

  /* ---------- ICS parsing (proxy fallback path) ---------- */
  function unfoldIcs(text) { return text.replace(/\r?\n[ \t]/g, ''); }

  function parseIcsDate(raw) {
    var m = raw.match(/(?:.*:)?(\d{8})T?(\d{6})?Z?/);
    if (!m) return null;
    var d = m[1], t = m[2] || '000000';
    var y = +d.slice(0, 4), mo = +d.slice(4, 6) - 1, day = +d.slice(6, 8);
    var hh = +t.slice(0, 2), mm = +t.slice(2, 4), ss = +t.slice(4, 6);
    var isUtc = /Z$/.test(raw.split(':').pop());
    return isUtc ? new Date(Date.UTC(y, mo, day, hh, mm, ss))
                 : new Date(y, mo, day, hh, mm, ss);
  }

  function unescapeIcsText(s) {
    return (s || '').replace(/\\n/g, '\n').replace(/\\,/g, ',')
                    .replace(/\\;/g, ';').replace(/\\\\/g, '\\');
  }

  function parseIcs(text) {
    var lines = unfoldIcs(text).split(/\r?\n/);
    var events = [], cur = null;
    for (var i = 0; i < lines.length; i++) {
      var line = lines[i];
      if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
      if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
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
    if (!genre) genre = 'Live on the Lanai';
    return { genre: genre, description: body.join(' ').trim() };
  }

  // Turn a parsed VEVENT (Date startAt) into the normalized client shape.
  function normalizeFromIcs(e) {
    var startAt = e.startAt;
    var endAt = e.endAt || new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
    var enriched = enrichGenre(e);
    return {
      id: e.id || (isoDate(startAt) + '-' + e.title),
      title: e.title,
      startAt: startAt,
      endAt: endAt,
      date: isoDate(startAt),
      start: pad2(startAt.getHours()) + ':' + pad2(startAt.getMinutes()),
      end: pad2(endAt.getHours()) + ':' + pad2(endAt.getMinutes()),
      genre: enriched.genre,
      description: enriched.description
    };
  }

  function icsToEvents(text) {
    return parseIcs(text)
      .filter(function (e) { return e.startAt && e.title && isRealShow(e.title); })
      .map(normalizeFromIcs)
      .sort(function (a, b) { return a.startAt - b.startAt; });
  }

  // Revive an event object that came from JSON (startAt/endAt are ISO strings).
  function reviveEvent(e) {
    var startAt = new Date(e.startAt);
    var endAt = e.endAt ? new Date(e.endAt) : new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
    return {
      id: e.id || (isoDate(startAt) + '-' + e.title),
      title: e.title,
      startAt: startAt,
      endAt: endAt,
      date: e.date || isoDate(startAt),
      start: e.start || (pad2(startAt.getHours()) + ':' + pad2(startAt.getMinutes())),
      end: e.end || (pad2(endAt.getHours()) + ':' + pad2(endAt.getMinutes())),
      genre: e.genre || 'Live on the Lanai',
      description: e.description || ''
    };
  }

  /* ---------- network paths ---------- */
  // Primary: the Cloudflare Pages Function (same-origin, no CORS, edge-cached).
  function fetchViaApi() {
    return fetchWithTimeout(API_ENDPOINT, 8000)
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (!data || !Array.isArray(data.events)) throw new Error('bad /api/events payload');
        return data.events
          .filter(function (e) { return e && e.title && isRealShow(e.title); })
          .map(reviveEvent)
          .sort(function (a, b) { return a.startAt - b.startAt; });
      });
  }

  // Legacy fallback: read the ICS feed through a public CORS proxy.
  function fetchViaProxy() {
    return PROXIES.reduce(function (promise, mkUrl) {
      return promise.catch(function () {
        return fetchWithTimeout(mkUrl(ICS_FEED), 6000)
          .then(function (r) { return r.text(); })
          .then(function (text) {
            if (!text || text.indexOf('BEGIN:VCALENDAR') === -1) throw new Error('Bad ICS body');
            return icsToEvents(text);
          });
      });
    }, Promise.reject(new Error('init')));
  }

  /* ---------- localStorage cache ---------- */
  function readCache() {
    try {
      var raw = window.localStorage.getItem(CACHE_KEY);
      if (!raw) return null;
      var parsed = JSON.parse(raw);
      if (!parsed || !Array.isArray(parsed.events)) return null;
      return {
        ts: parsed.ts || 0,
        fresh: (Date.now() - (parsed.ts || 0)) < CACHE_TTL_MS,
        events: parsed.events.map(reviveEvent)
      };
    } catch (e) { return null; }
  }

  function writeCache(events) {
    try {
      var slim = events.map(function (e) {
        return {
          id: e.id, title: e.title,
          startAt: e.startAt.toISOString(),
          endAt: e.endAt.toISOString(),
          date: e.date, start: e.start, end: e.end,
          genre: e.genre, description: e.description
        };
      });
      window.localStorage.setItem(CACHE_KEY, JSON.stringify({ ts: Date.now(), events: slim }));
    } catch (e) { /* storage full / disabled — non-fatal */ }
  }

  // One network attempt: API first, then proxy. Caches on success.
  function fetchFresh() {
    return fetchViaApi()
      .catch(function () { return fetchViaProxy(); })
      .then(function (events) {
        if (events && events.length) { writeCache(events); return events; }
        // A successful fetch that legitimately has zero upcoming shows
        // is still real — cache it so we don't thrash the network.
        writeCache(events || []);
        return events || [];
      });
  }

  /* ---------- public API ---------- */
  // Resolves with REAL events or [] — never placeholder/fake data.
  function getEvents() {
    var cached = readCache();

    if (cached && cached.fresh) {
      // Serve cache instantly; refresh in the background for next load.
      fetchFresh().catch(function () { /* keep cached */ });
      return Promise.resolve(cached.events);
    }

    return fetchFresh().catch(function () {
      // Network fully failed — fall back to stale cache if we have one,
      // otherwise an empty list. Never fake events.
      return (cached && cached.events.length) ? cached.events : [];
    });
  }

  window.CCCalendar = {
    email: CALENDAR_EMAIL,
    subscribe: SUBSCRIBE,
    getEvents: getEvents
  };
})();
