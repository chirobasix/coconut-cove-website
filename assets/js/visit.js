/* Coconut Cove — Visit page: contact form
   Submits to Web3Forms (configured in visit.html with the access_key
   hidden field) and swaps in an inline "Message sent" thank-you.

   Falls back to mailto: if the network call fails for any reason, so
   the visitor's message still reaches us in the worst case.

   With JS disabled the form posts natively to Web3Forms and shows
   their plain JSON response — message still delivered, plain UX. */
(function () {
  'use strict';

  var form = document.getElementById('contact-form');
  if (!form) return;

  var TO_EMAIL  = 'coconutcovesurfcity@gmail.com';
  var TO_PHONE  = '910-752-6780';
  var ENDPOINT  = 'https://api.web3forms.com/submit';
  var submitBtn = form.querySelector('[data-submit]');
  var submitLbl = form.querySelector('[data-submit-label]');

  form.addEventListener('submit', function (e) {
    e.preventDefault();

    var data = new FormData(form);
    var topic = (data.get('topic') || 'General question').toString().trim();
    var name  = (data.get('name')  || '').toString().trim();

    // Build a useful subject line that shows up in the inbox.
    data.set('subject',
      '[Coconut Cove Website] ' + topic + ' — ' + (name || '(no name)'));

    if (submitBtn) submitBtn.disabled = true;
    if (submitLbl) submitLbl.textContent = 'Sending…';

    fetch(ENDPOINT, { method: 'POST', body: data })
      .then(function (r) { return r.json().catch(function () { return {}; }); })
      .then(function (json) {
        if (json && json.success) {
          showSentState();
        } else {
          throw new Error((json && json.message) || 'Submission failed');
        }
      })
      .catch(function (err) {
        console.warn('Web3Forms POST failed; falling back to mailto.', err);
        fallbackToMailto(data);
      });
  });

  function fallbackToMailto(data) {
    var topic   = (data.get('topic')   || 'General question').toString().trim();
    var name    = (data.get('name')    || '').toString().trim();
    var email   = (data.get('email')   || '').toString().trim();
    var phone   = (data.get('phone')   || '').toString().trim();
    var message = (data.get('message') || '').toString().trim();

    var subject = '[Coconut Cove] ' + topic + ' — ' + (name || '(no name)');
    var body =
      'Name: '  + name  +
      '\nEmail: ' + email +
      '\nPhone: ' + phone +
      '\nTopic: ' + topic +
      '\n\n' + message + '\n';

    window.location.href = 'mailto:' + TO_EMAIL +
      '?subject=' + encodeURIComponent(subject) +
      '&body='    + encodeURIComponent(body);
  }

  function showSentState() {
    var html =
      '<div class="sent-state">' +
        '<div class="sent-state__check" aria-hidden="true">' +
          '<svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>' +
        '</div>' +
        '<h3 class="cc-heading sent-state__heading">Message sent.</h3>' +
        '<p class="cc-script sent-state__sub">we’ll write back soon</p>' +
        '<p class="sent-state__text">Thanks — we’ll be in touch shortly. If you don’t hear back within a day, give us a call at ' + TO_PHONE + '.</p>' +
        '<p style="margin-top: 18px;">' +
          '<button type="button" class="cc-btn cc-btn--ghost-light cc-btn--md" data-send-another>Send another</button>' +
        '</p>' +
      '</div>';

    form.innerHTML = html;
    form.setAttribute('aria-live', 'polite');

    var again = form.querySelector('[data-send-another]');
    if (again) {
      again.addEventListener('click', function () { window.location.reload(); });
    }
  }
})();
