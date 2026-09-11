// ASCII noise band in the site header.
// A port of ertdfgcvb's play.core "Hotlink" sketch: every character cell samples
// OpenSimplex noise at (x, y, t) and picks a glyph from a density ramp.
// Depends on assets/js/simplex-noise.js (defines the global openSimplexNoise).
(function () {
  var wrap = document.querySelector('.ascii-noise-wrap');
  var pre = document.getElementById('ascii-noise');
  if (!wrap || !pre || typeof openSimplexNoise !== 'function') return;

  var noise3D = openSimplexNoise(Date.now()).noise3D;
  var density = ' .:░▒▓█Ñ#+-'.split('');
  var SCALE = 0.08;          // spatial frequency, in cells
  var SPEED = 0.0005;        // time scale, per ms
  var FRAME_MS = 1000 / 30;  // cap at ~30fps; the noise moves slowly anyway

  var reduceMotion = window.matchMedia
    && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var cols = 0, rows = 0, aspect = 1;

  // Measure one character cell so the grid fits the wrapper exactly.
  function measure() {
    var probe = document.createElement('span');
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre;display:inline-block';
    probe.textContent = 'MMMMMMMMMMMMMMMMMMMM'; // 20 chars
    pre.appendChild(probe);
    var rect = probe.getBoundingClientRect();
    pre.removeChild(probe);

    var cellW = rect.width / 20;
    var cellH = rect.height;
    if (!cellW || !cellH) { cols = rows = 0; return; }

    cols = Math.floor(wrap.clientWidth / cellW);
    rows = Math.floor(wrap.clientHeight / cellH);
    aspect = cellW / cellH;
  }

  function render(timeMs) {
    if (cols <= 0 || rows <= 0) { pre.textContent = ''; return; }
    var t = timeMs * SPEED;
    var last = density.length - 1;
    var out = '';
    for (var y = 0; y < rows; y++) {
      var ny = y * SCALE / aspect + t;
      for (var x = 0; x < cols; x++) {
        var v = noise3D(x * SCALE, ny, t) * 0.5 + 0.5;
        var i = Math.floor(v * density.length);
        out += density[i < 0 ? 0 : i > last ? last : i];
      }
      if (y < rows - 1) out += '\n';
    }
    pre.textContent = out;
  }

  var running = false, rafId = 0, lastFrame = 0;

  function loop(now) {
    if (!running) return;
    rafId = requestAnimationFrame(loop);
    if (now - lastFrame < FRAME_MS) return;
    lastFrame = now;
    render(now);
  }

  function start() {
    if (running || reduceMotion) return;
    running = true;
    rafId = requestAnimationFrame(loop);
  }

  function stop() {
    running = false;
    if (rafId) cancelAnimationFrame(rafId);
    rafId = 0;
  }

  measure();
  render(performance.now());

  if (reduceMotion) return; // one static frame is enough

  // Re-fit the grid when the header changes size.
  if (typeof ResizeObserver === 'function') {
    var pending = false;
    new ResizeObserver(function () {
      if (pending) return;
      pending = true;
      requestAnimationFrame(function () {
        pending = false;
        measure();
        render(performance.now());
      });
    }).observe(wrap);
  } else {
    window.addEventListener('resize', function () { measure(); render(performance.now()); });
  }

  // Only animate while the header is on screen.
  if (typeof IntersectionObserver === 'function') {
    new IntersectionObserver(function (entries) {
      entries[0].isIntersecting ? start() : stop();
    }).observe(wrap);
  } else {
    start();
  }
})();
