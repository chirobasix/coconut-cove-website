/* Coconut Cove — shared interactivity
   Mobile nav toggle, Reserve modal, body scroll lock. */
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

  // ---------- Reserve modal ----------
  var modal = document.getElementById('reserve-modal');
  var openers = document.querySelectorAll('[data-open-reserve]');
  var lastFocus = null;

  function openModal() {
    if (!modal) return;
    lastFocus = document.activeElement;
    modal.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';
    var firstBtn = modal.querySelector('.cc-modal__close');
    if (firstBtn) firstBtn.focus();
  }
  function closeModal() {
    if (!modal) return;
    modal.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
    if (lastFocus && typeof lastFocus.focus === 'function') lastFocus.focus();
  }

  openers.forEach(function (el) {
    el.addEventListener('click', function (e) {
      e.preventDefault();
      openModal();
    });
  });

  if (modal) {
    modal.addEventListener('click', function (e) {
      if (e.target === modal || e.target.hasAttribute('data-close-reserve')) closeModal();
    });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && modal.getAttribute('aria-hidden') === 'false') closeModal();
    });
  }

  // ---------- Smooth-scroll offset for anchor nav (works without JS too) ----------
  // Modern browsers handle scroll-margin-top in CSS; no extra JS needed.

  // ---------- Mark active nav link ----------
  var path = (location.pathname || '').split('/').pop().toLowerCase();
  if (!path) path = 'index.html';
  document.querySelectorAll('.cc-nav a[href]').forEach(function (a) {
    var href = (a.getAttribute('href') || '').toLowerCase();
    if (href === path) a.setAttribute('aria-current', 'page');
  });
})();
