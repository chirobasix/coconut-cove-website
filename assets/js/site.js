/* Coconut Cove — shared interactivity
   Mobile nav toggle + active-link marking. */
(function () {
  'use strict';

  // ---------- Mobile nav ----------
  var navToggle = document.querySelector('.cc-nav-toggle');
  var nav = document.getElementById('primary-nav');
  if (navToggle && nav) {
    navToggle.addEventListener('click', function () {
      var open = nav.classList.toggle('is-open');
      navToggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    });
    // Close on link click (mobile)
    nav.addEventListener('click', function (e) {
      if (e.target.tagName === 'A' && window.matchMedia('(max-width: 900px)').matches) {
        nav.classList.remove('is-open');
        navToggle.setAttribute('aria-expanded', 'false');
      }
    });
  }

  // ---------- Mark active nav link ----------
  var path = (location.pathname || '').split('/').pop().toLowerCase();
  if (!path) path = 'index.html';
  document.querySelectorAll('.cc-nav a[href]').forEach(function (a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    if (href === path) a.setAttribute('aria-current', 'page');
  });
})();
