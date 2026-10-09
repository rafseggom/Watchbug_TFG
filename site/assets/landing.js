/* Watchbug landing — minimal vanilla JS (no dependencies, no tracking) */
(function () {
  'use strict';

  // Mark JS availability for reveal animations (progressive enhancement)
  document.documentElement.classList.add('js');

  // Scroll reveal
  var revealEls = document.querySelectorAll('.reveal');
  if ('IntersectionObserver' in window && revealEls.length) {
    var io = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-in');
            io.unobserve(entry.target);
          }
        });
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
    );
    revealEls.forEach(function (el) {
      io.observe(el);
    });
  } else {
    revealEls.forEach(function (el) {
      el.classList.add('is-in');
    });
  }

  // Product image placeholders: if the real asset is missing, show the
  // dashed placeholder describing what belongs there.
  document.querySelectorAll('.shot[data-file]').forEach(function (fig) {
    var img = fig.querySelector('img');
    if (!img) return;
    var mark = function () {
      fig.classList.add('is-placeholder');
    };
    if (img.complete && img.naturalWidth === 0) mark();
    img.addEventListener('error', mark);
  });

  // Copy button on the integration snippet
  document.querySelectorAll('.copy-btn').forEach(function (btn) {
    btn.addEventListener('click', function () {
      var pre = btn.parentElement.querySelector('pre.code');
      if (!pre) return;
      var text = pre.innerText;
      var done = function () {
        var old = btn.textContent;
        btn.textContent = btn.getAttribute('data-copied') || 'Copied';
        setTimeout(function () {
          btn.textContent = old;
        }, 1600);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(text).then(done, function () {});
      } else {
        var ta = document.createElement('textarea');
        ta.value = text;
        document.body.appendChild(ta);
        ta.select();
        try {
          document.execCommand('copy');
          done();
        } catch (e) {}
        document.body.removeChild(ta);
      }
    });
  });
})();
