/* Cloudflare Pages Function — GET /api/events
   ----------------------------------------------------------------
   Fetches the PUBLIC Coconut Cove Google Calendar iCal feed
   server-side, parses it to JSON, and returns the upcoming shows.

   Why this exists:
   - Browsers can't fetch Google's .ics feed directly (Google sends
     no CORS headers on that endpoint), which forced the old client
     code through flaky public CORS proxies. When those proxies were
     down, the page showed fake placeholder events. This function
     removes the proxy entirely — a server-to-server fetch has no
     CORS restriction.
   - The Google response is cached at Cloudflare's edge for 12 hours
     (via the `cf.cacheTtl` subrequest option AND the Cache API), so
     Google is hit at most once per 12h per edge location no matter
     how many visitors load the page.

   Response shape:
     { "events": [ { id, title, startAt(ISO), endAt(ISO),
                     date, start, end, genre, description } ],
       "source": "google-ics", "cachedAt": ISO }
   On upstream failure it returns { events: [], error } with a 200 so
   the client can degrade gracefully (it will fall back to its own
   localStorage cache, never to fake data). */

const CALENDAR_EMAIL = 'coconutcovesurfcity@gmail.com';
const ICS_URL = 'https://calendar.google.com/calendar/ical/' +
  encodeURIComponent(CALENDAR_EMAIL) + '/public/basic.ics';

const TWELVE_HOURS = 12 * 60 * 60; // seconds
const MAX_EVENTS = 250;            // cap payload size

export async function onRequest(context) {
  const { request, waitUntil } = context;

  // Only GET/HEAD make sense here.
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    return json({ events: [], error: 'method not allowed' }, 405);
  }

  // --- Edge cache layer (shared across all visitors) ---
  const cache = caches.default;
  const cacheKey = new Request(new URL('/api/events', request.url).toString(), { method: 'GET' });

  let cached = await cache.match(cacheKey);
  if (cached) return cached;

  // --- Cache miss: fetch the iCal feed from Google, server-side ---
  let icsText;
  try {
    const upstream = await fetch(ICS_URL, {
      // Cache Google's response at the edge for 12h so we don't hammer it.
      cf: { cacheTtl: TWELVE_HOURS, cacheEverything: true },
      headers: { 'User-Agent': 'CoconutCoveWebsite/1.0 (+https://coconutcovesurfcity.com)' }
    });
    if (!upstream.ok) throw new Error('Google calendar HTTP ' + upstream.status);
    icsText = await upstream.text();
    if (!icsText || icsText.indexOf('BEGIN:VCALENDAR') === -1) {
      throw new Error('Unexpected calendar payload');
    }
  } catch (err) {
    // Don't cache failures. Return an empty (not fake) list; the client
    // will fall back to its own localStorage cache if it has one.
    return json({ events: [], error: String(err && err.message || err) }, 200, 60);
  }

  const events = icsToEvents(icsText).slice(0, MAX_EVENTS);
  const body = {
    events: events,
    source: 'google-ics',
    cachedAt: nowIso()
  };

  const response = json(body, 200, TWELVE_HOURS);
  // Store in the edge cache for 12h (fire-and-forget).
  waitUntil(cache.put(cacheKey, response.clone()));
  return response;
}

/* ---------- helpers ---------- */

function json(obj, status, maxAgeSeconds) {
  const headers = {
    'content-type': 'application/json; charset=utf-8',
    'access-control-allow-origin': '*'
  };
  if (maxAgeSeconds) {
    // Browser caches briefly; the shared edge cache holds the full 12h.
    headers['cache-control'] =
      'public, max-age=1800, s-maxage=' + maxAgeSeconds;
  } else {
    headers['cache-control'] = 'no-store';
  }
  return new Response(JSON.stringify(obj), { status: status || 200, headers });
}

function nowIso() {
  return new Date().toISOString();
}

function pad2(n) { return String(n).padStart(2, '0'); }

// Drop Google's private-event placeholders ("Busy") and obvious non-shows.
function isRealShow(title) {
  if (!title) return false;
  const t = String(title).trim().toLowerCase();
  return t !== 'busy' && t !== 'private' && t !== 'private event';
}

function unfoldIcs(text) {
  return text.replace(/\r?\n[ \t]/g, '');
}

function parseIcsDate(raw) {
  const m = raw.match(/(?:.*:)?(\d{8})T?(\d{6})?Z?/);
  if (!m) return null;
  const d = m[1], t = m[2] || '000000';
  const y = +d.slice(0, 4), mo = +d.slice(4, 6) - 1, day = +d.slice(6, 8);
  const hh = +t.slice(0, 2), mm = +t.slice(2, 4), ss = +t.slice(4, 6);
  const isUtc = /Z$/.test(raw.split(':').pop());
  return isUtc
    ? new Date(Date.UTC(y, mo, day, hh, mm, ss))
    : new Date(y, mo, day, hh, mm, ss);
}

function unescapeIcsText(s) {
  return (s || '')
    .replace(/\\n/g, '\n').replace(/\\,/g, ',')
    .replace(/\\;/g, ';').replace(/\\\\/g, '\\');
}

function parseIcs(text) {
  const lines = unfoldIcs(text).split(/\r?\n/);
  const events = [];
  let cur = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line === 'BEGIN:VEVENT') { cur = {}; continue; }
    if (line === 'END:VEVENT') { if (cur) events.push(cur); cur = null; continue; }
    if (!cur) continue;
    const idx = line.indexOf(':');
    if (idx < 0) continue;
    const keyName = line.slice(0, idx).split(';')[0];
    const value = line.slice(idx + 1);
    if (keyName === 'DTSTART') cur.startAt = parseIcsDate(line);
    else if (keyName === 'DTEND') cur.endAt = parseIcsDate(line);
    else if (keyName === 'SUMMARY') cur.title = unescapeIcsText(value);
    else if (keyName === 'DESCRIPTION') cur.description = unescapeIcsText(value);
    else if (keyName === 'UID') cur.id = value;
    else if (keyName === 'CATEGORIES') cur.categories = value.split(',');
  }
  return events;
}

function enrichGenre(ev) {
  const lines = (ev.description || '').split('\n').map(function (s) { return s.trim(); }).filter(Boolean);
  let genre = '';
  const body = [];
  for (let i = 0; i < lines.length; i++) {
    const mg = lines[i].match(/^genre\s*:\s*(.+)$/i);
    if (mg) genre = mg[1].trim();
    else body.push(lines[i]);
  }
  if (!genre && ev.categories && ev.categories.length) genre = ev.categories.join(' · ');
  if (!genre) genre = 'Live on the Lanai';
  ev.genre = genre;
  ev.description = body.join(' ').trim();
  return ev;
}

function icsToEvents(text) {
  const now = Date.now();
  const horizon = now - 24 * 60 * 60 * 1000; // include events from ~yesterday onward
  return parseIcs(text)
    .filter(function (e) {
      if (!e.startAt || !e.title) return false;
      if (!isRealShow(e.title)) return false;
      return e.startAt.getTime() >= horizon;
    })
    .map(function (e) {
      const startAt = e.startAt;
      const endAt = e.endAt || new Date(startAt.getTime() + 2 * 60 * 60 * 1000);
      enrichGenre(e);
      return {
        id: e.id || (isoDate(startAt) + '-' + e.title),
        title: e.title,
        startAt: startAt.toISOString(),
        endAt: endAt.toISOString(),
        date: isoDate(startAt),
        start: pad2(startAt.getHours()) + ':' + pad2(startAt.getMinutes()),
        end: pad2(endAt.getHours()) + ':' + pad2(endAt.getMinutes()),
        genre: e.genre,
        description: e.description
      };
    })
    .sort(function (a, b) { return new Date(a.startAt) - new Date(b.startAt); });
}

function isoDate(d) {
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate());
}
