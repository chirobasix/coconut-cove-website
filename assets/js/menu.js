/* Coconut Cove — Menu page: Lunch/Dinner toggle */
(function () {
  'use strict';
  var buttons = document.querySelectorAll('.menu-toggle__btn');
  var sub = document.querySelector('[data-entrees-sub]');
  if (!buttons.length) return;

  function setMode(mode) {
    document.body.setAttribute('data-mode', mode);
    buttons.forEach(function (b) {
      b.setAttribute('aria-pressed', b.dataset.mode === mode ? 'true' : 'false');
    });
    if (sub) {
      sub.textContent = mode === 'dinner'
        ? 'Including 3 dinner-only steaks & pasta'
        : 'Served 11am — 4pm';
    }
  }

  buttons.forEach(function (b) {
    b.addEventListener('click', function () { setMode(b.dataset.mode); });
  });
})();
