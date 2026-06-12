/* Coconut Cove — Live Music page
   Calendar grid + upcoming list. All data (fetching, parsing, 12h
   caching, and the "Busy"/private-event filtering) comes from the
   shared data layer in assets/js/calendar-data.js (window.CCCalendar).

   This file only RENDERS. There is intentionally NO demo/placeholder
   data — if the calendar can't load, the page shows an honest empty
   state, never fake shows. */
(function () {
  'use strict';

  var MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
  var DOW    = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];

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

// (Fetching, parsing, caching and filtering live in calendar-data.js.)

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

  var SUBSCRIBE = (window.CCCalendar && window.CCCalendar.subscribe) || {};
  if (googleA) googleA.href = SUBSCRIBE.google || '#';
  if (appleA)  appleA.href  = SUBSCRIBE.apple  || '#';
  if (icsA)    icsA.href    = SUBSCRIBE.ics    || '#';

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
        '<img src="assets/images/coconut-drink-pink.webp" alt="" class="up-next__bg-drink" aria-hidden="true" loading="lazy">' +
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

    var html = '<div class="upcoming__inner">' +
      '<div class="upcoming__head">' +
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

    html += '</div>';
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
  // then update when the shared data layer resolves.
  render();

  function applyEvents(events) {
    state.events = events || [];
    var today = new Date(); today.setHours(0, 0, 0, 0);
    var next = state.events.find(function (e) { return e.startAt >= today; });
    if (next) {
      state.year = next.startAt.getFullYear();
      state.month = next.startAt.getMonth();
    }
    render();
  }

  if (window.CCCalendar && typeof window.CCCalendar.getEvents === 'function') {
    window.CCCalendar.getEvents().then(applyEvents).catch(function () { applyEvents([]); });
  } else {
    // calendar-data.js failed to load — show an honest empty calendar,
    // never fake events.
    applyEvents([]);
  }
})();
