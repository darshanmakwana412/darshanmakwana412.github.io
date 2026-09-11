// ASCII noise bands in the site header and sidebar.
// A port of ertdfgcvb's play.core "Hotlink" sketch: every character cell samples
// OpenSimplex noise at (x, y, t) and picks a glyph from a density ramp.
// Every .ascii-noise-wrap on the page is one band. They share a single noise
// field, offset by their position on the page, so they read as one texture.
// Depends on assets/js/simplex-noise.js (defines the global openSimplexNoise).
(function () {
  var wraps = Array.prototype.slice.call(document.querySelectorAll('.ascii-noise-wrap'));
  if (!wraps.length || typeof openSimplexNoise !== 'function') return;

  // Clicking the site title toggles the bands. The choice is remembered across
  // pages, and head.html applies it before first paint. The title's href stays
  // as a no-JS fallback; the "Blogs" link in the sidebar also goes home.
  var title = document.querySelector('.site-title');
  if (title) {
    title.addEventListener('click', function (e) {
      e.preventDefault();
      var root = document.documentElement;
      var off = root.getAttribute('data-noise') === 'off';
      if (off) {
        root.removeAttribute('data-noise');
      } else {
        root.setAttribute('data-noise', 'off');
      }
      try { localStorage.setItem('noise', off ? 'on' : 'off'); } catch (_) {}
    });
  }

  // A fixed seed and a wall-clock time base make the field identical on every
  // page, so following a link or refreshing does not restart the animation.
  var SEED = 20260911;
  var EPOCH = Date.UTC(2026, 0, 1);
  var noise3D = openSimplexNoise(SEED).noise3D;
  var density = ' .:░▒▓█Ñ#+-'.split('');
  var SCALE = 0.08;          // spatial frequency, in cells
  var SPEED = 0.0005;        // time scale, per ms
  var FRAME_MS = 1000 / 30;  // cap at ~30fps; the noise moves slowly anyway

  function wallTime() { return Date.now() - EPOCH; }

  var reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var bands = wraps.map(function (wrap) {
    var pre = wrap.querySelector('.ascii-noise');
    return pre ? { wrap: wrap, pre: pre, cols: 0, rows: 0, ox: 0, oy: 0, aspect: 1, visible: true } : null;
  }).filter(Boolean);
  if (!bands.length) return;

  function docRect(el) {
    var r = el.getBoundingClientRect();
    return { left: r.left + window.pageXOffset, top: r.top + window.pageYOffset };
  }

  // Measure one character cell so each grid fits its wrapper exactly, and
  // offset each band so all of them sample the same field.
  function measure() {
    var origin = docRect(bands[0].wrap);
    bands.forEach(function (b) {
      var probe = document.createElement('span');
      probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;display:inline-block';
      probe.textContent = 'MMMMMMMMMMMMMMMMMMMM'; // 20 chars
      b.pre.appendChild(probe);
      var rect = probe.getBoundingClientRect();
      b.pre.removeChild(probe);

      var cellW = rect.width / 20;
      var cellH = rect.height;
      if (!cellW || !cellH || b.wrap.clientWidth === 0) { b.cols = b.rows = 0; return; }

      // Round up so a partial last row/column is clipped rather than left blank.
      b.cols = Math.ceil(b.wrap.clientWidth / cellW);
      b.rows = Math.ceil(b.wrap.clientHeight / cellH);
      b.aspect = cellW / cellH;

      var pos = docRect(b.wrap);
      b.ox = Math.round((pos.left - origin.left) / cellW);
      b.oy = Math.round((pos.top - origin.top) / cellH);
    });
  }

  function renderBand(b, timeMs) {
    if (b.cols <= 0 || b.rows <= 0) { b.pre.textContent = ''; return; }
    var t = timeMs * SPEED;
    var last = density.length - 1;
    var out = '';
    for (var y = 0; y < b.rows; y++) {
      var ny = (y + b.oy) * SCALE / b.aspect + t;
      for (var x = 0; x < b.cols; x++) {
        var v = noise3D((x + b.ox) * SCALE, ny, t) * 0.5 + 0.5;
        var i = Math.floor(v * density.length);
        out += density[i < 0 ? 0 : i > last ? last : i];
      }
      if (y < b.rows - 1) out += '\n';
    }
    b.pre.textContent = out;
  }

  function renderAll(timeMs) {
    bands.forEach(function (b) { if (b.visible) renderBand(b, timeMs); });
  }

  var running = false, rafId = 0, lastFrame = 0;

  function loop(now) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;
    renderAll(wallTime());
  }

  function syncLoop() {
    if (reduceMotion) return;
    var anyVisible = bands.some(function (b) { return b.visible; });
    if (anyVisible && !running) {
      running = true;
      rafId = requestAnimationFrame(loop);
    } else if (!anyVisible && running) {
      running = false;
      if (rafId) cancelAnimationFrame(rafId);
      rafId = 0;
    }
  }

  measure();
  renderAll(wallTime());

  if (reduceMotion) return; // one static frame is enough

  // Re-fit the grids when any band changes size.
  var pending = false;
  function refit() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(function () {
      pending = false;
      measure();
      renderAll(wallTime());
    });
  }
  if (typeof ResizeObserver === 'function') {
    var ro = new ResizeObserver(refit);
    bands.forEach(function (b) { ro.observe(b.wrap); });
  } else {
    window.addEventListener('resize', refit);
  }

  // Only animate bands that are on screen.
  if (typeof IntersectionObserver === 'function') {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        var b = bands.filter(function (b) { return b.wrap === e.target; })[0];
        if (b) b.visible = e.isIntersecting;
      });
      syncLoop();
    });
    bands.forEach(function (b) { io.observe(b.wrap); });
  }
  syncLoop();
})();
