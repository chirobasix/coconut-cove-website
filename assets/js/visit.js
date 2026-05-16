/* Coconut Cove — Visit page: contact form mailto handler.
   Falls back gracefully if JS is disabled — the form's
   action="mailto:" + enctype="text/plain" submits directly. */
(function () {
  'use strict';
  var form = document.getElementById('contact-form');
  if (!form) return;

  var TO = 'coconutcovesurfcity@gmail.com';

  form.addEventListener('submit', function (e) {
    e.preventDefault();
    var data = new FormData(form);
    var name = (data.get('name') || '').toString().trim();
    var email = (data.get('email') || '').toString().trim();
    var phone = (data.get('phone') || '').toString().trim();
    var topic = (data.get('topic') || 'General question').toString().trim();
    var message = (data.get('message') || '').toString().trim();

    var subject = '[Coconut Cove] ' + topic + ' — ' + (name || '(no name)');
    var body = 'Name: ' + name +
      '\nEmail: ' + email +
      '\nPhone: ' + phone +
      '\nTopic: ' + topic +
      '\n\n' + message + '\n';

    var href = 'mailto:' + TO +
      '?subject=' + encodeURIComponent(subject) +
      '&body=' + encodeURIComponent(body);
    window.location.href = href;
  });
})();
