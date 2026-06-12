/* Coconut Cove — Home page live-music snippet
   Renders the next 3 upcoming shows into <ul data-home-music> in the
   "Live on the Lanai" section.

   All fetching/parsing/12h-caching/"Busy"-filtering lives in the
   shared data layer (assets/js/calendar-data.js → window.CCCalendar),
   which must be loaded before this file. There is NO demo/placeholder
   data here — if the calendar can't load, we show an honest message
   that points to the full Live Music page, never fake shows. */
(function () {
  'use strict';

  var listEl = document.querySelector('[data-home-music]');
  if (!listEl) return;

  var DOW_ABBR   = ['SUN','MON','TUE','WED','THU','FRI','SAT'];
  var MONTH_ABBR = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

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

  var MUSIC_ICON =
    '<svg class="ICONCLASS" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.75" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>';

  function card(tone, day, when, band, style) {
    var iconClass = tone === 'pink' ? 'show-card__icon--pink' : 'show-card__icon--teal';
    return '<li class="show-card show-card--' + tone + '">' +
      '<div class="show-card__date">' +
        '<div class="show-card__day">' + escapeHtml(day) + '</div>' +
        '<div class="show-card__when">' + escapeHtml(when) + '</div>' +
      '</div>' +
      '<div>' +
        '<div class="show-card__band">' + escapeHtml(band) + '</div>' +
        '<div class="show-card__style">' + escapeHtml(style) + '</div>' +
      '</div>' +
      MUSIC_ICON.replace('ICONCLASS', iconClass) +
    '</li>';
  }

  function render(events) {
    events = events || [];
    var now = new Date();
    var upcoming = events
      .filter(function (e) { return e.startAt >= now; })
      .sort(function (a, b) { return a.startAt - b.startAt; })
      .slice(0, 3);

    if (!upcoming.length) {
      // Honest empty / unavailable state — never fake bands.
      listEl.innerHTML = card(
        'pink', '—', 'LINEUP',
        'See the full calendar',
        'Tap "Full lineup" for upcoming shows'
      );
      return;
    }

    listEl.innerHTML = upcoming.map(function (ev, i) {
      var tone = i % 2 === 0 ? 'pink' : 'teal';
      var dow = DOW_ABBR[ev.startAt.getDay()];
      var dateLabel = (MONTH_ABBR[ev.startAt.getMonth()] + ' ' + ev.startAt.getDate()).toUpperCase();
      return card(tone, dow, dateLabel, ev.title, 'Live on the Lanai · ' + fmtTime(ev.startAt));
    }).join('');
  }

  // ---------- Boot ----------
  if (window.CCCalendar && typeof window.CCCalendar.getEvents === 'function') {
    window.CCCalendar.getEvents().then(render).catch(function () { render([]); });
  } else {
    render([]);
  }
})();
