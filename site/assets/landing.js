/* Watchbug landing — minimal vanilla JS (no dependencies, no tracking).
   Jobs: copy button (announced via live region), rail scrollspy. */
(function () {
  'use strict';

  // Copy button on the integration snippet.
  // Label change is announced through aria-live="polite"; on clipboard
  // failure we fall back to execCommand and never claim success falsely.
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var wrap = btn.closest('.code-wrap');
      var pre = wrap && wrap.querySelector('pre.code');
      if (!pre) return;
      var text = pre.innerText;
      var done = function () {
        var old = btn.textContent;
        btn.textContent = btn.getAttribute('data-copied') || 'Copied';
        setTimeout(function () {
          btn.textContent = old;
        }, 1600);
      };
      var fallback = function () {
        var ta = document.createElement('textarea');
        ta.value = text;
        ta.setAttribute('readonly', '');
        ta.style.position = 'fixed';
        ta.style.opacity = '0';
        document.body.appendChild(ta);
        ta.select();
        try {
          if (document.execCommand('copy')) done();
        } catch (e) {}
        document.body.removeChild(ta);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, fallback);
      } else {
        fallback();
      }
    });
  });

  // Rail scrollspy: mark the section currently in view.
  var rail = document.querySelector('.rail');
  if (!rail || !('IntersectionObserver' in window)) return;

  var links = {};
  rail.querySelectorAll('a[href^="#"]').forEach(function (a) {
    links[a.getAttribute('href').slice(1)] = a;
  });

  var current = null;
  var io = new IntersectionObserver(
    function (entries) {
      entries.forEach(function (entry) {
        if (!entry.isIntersecting) return;
        var link = links[entry.target.id];
        if (!link || link === current) return;
        if (current) current.removeAttribute('aria-current');
        link.setAttribute('aria-current', 'true');
        current = link;
      });
    },
    { rootMargin: '-35% 0px -55% 0px', threshold: 0 }
  );

  Object.keys(links).forEach(function (id) {
    var section = document.getElementById(id);
    if (section) io.observe(section);
  });
})();
