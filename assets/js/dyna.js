/**
 * An ASCII trail that lags behind the cursor like a weighted pen.
 *
 * Port of ertdfgcvb's "Dyna" (https://play.ertdfgcvb.xyz/#/src/demos/dyna),
 * itself a remix of Paul Haeberli's Dynadraw from 1989. The original runs on
 * the play.core framework, which hands the sketch a character grid, a cursor in
 * grid coordinates and a value buffer; this file rebuilds just that much around
 * a plain <pre> and keeps the physics and the renderer identical.
 */
(function () {
  const MASS = 40    // Pencil mass
  const DAMP = 0.95  // Pencil damping
  const RADIUS = 6   // Pencil radius
  const FPS = 60

  const density = ' .:░▒▓█Ñ#+-'.split('')

  // No cursor to follow, or the reader asked for stillness.
  if (!window.matchMedia('(hover: hover)').matches) return
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const el = document.createElement('pre')
  el.className = 'dyna'
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)

  let cols = 0, rows = 0, cellW = 0, cellH = 0, aspect = 1
  let buffer = new Float32Array(0)

  const cursor = { x: 0, y: 0 }

  // Cursor and pen state in pixels, carried across page loads so the pen picks
  // up mid-stroke instead of flying in from the centre or stopping dead.
  const STORE_KEY = 'dyna-state'
  const pointer = { x: NaN, y: NaN }
  let saved = null
  try {
    const s = JSON.parse(sessionStorage.getItem(STORE_KEY))
    if (s && isFinite(s.cx) && isFinite(s.cy)) {
      saved = s
      pointer.x = s.cx
      pointer.y = s.cy
    }
  } catch (_) {}

  function remember() {
    if (!isFinite(pointer.x) || !cellW || !cellH) return
    // Quantise the trail to one byte per cell so it fits comfortably in storage.
    let trail = ''
    for (let i = 0; i < buffer.length; i++) {
      trail += String.fromCharCode(Math.round(Math.min(1, Math.max(0, buffer[i])) * 255))
    }
    const state = {
      t: performance.timeOrigin + performance.now(),
      cx: pointer.x, cy: pointer.y,
      px: dyna.pos.x * cellW, py: dyna.pos.y * cellH,
      vx: dyna.vel.x * cellW, vy: dyna.vel.y * cellH,
      cols, rows, trail,
    }
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)) } catch (_) {}
  }

  // One cell, measured off the element itself so it tracks the real font.
  function measure() {
    const probe = document.createElement('span')
    probe.style.cssText = 'position:absolute;visibility:hidden;white-space:pre'
    probe.textContent = 'X'.repeat(100)
    el.appendChild(probe)
    const box = probe.getBoundingClientRect()
    cellW = box.width / 100
    cellH = box.height
    probe.remove()
  }

  function resize() {
    measure()
    if (!cellW || !cellH) return
    cols = Math.ceil(window.innerWidth / cellW)
    rows = Math.ceil(window.innerHeight / cellH)
    aspect = cellW / cellH
    buffer = new Float32Array(cols * rows)
  }

  window.addEventListener('pointermove', (e) => {
    pointer.x = e.clientX
    pointer.y = e.clientY
    if (!cellW || !cellH) return
    cursor.x = e.clientX / cellW
    cursor.y = e.clientY / cellH
  })

  // Links and refreshes both fire pagehide; that's the moment to save.
  window.addEventListener('pagehide', remember)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') remember()
  })

  window.addEventListener('resize', resize)

  // -----------------------------------------------------------------------------

  class Dyna {
    constructor(mass, damp) {
      this.pos = { x: 0, y: 0 }
      this.vel = { x: 0, y: 0 }
      this.pre = { x: 0, y: 0 }
      this.mass = mass
      this.damp = damp
    }
    update(cursor) {
      const fx = cursor.x - this.pos.x
      const fy = cursor.y - this.pos.y
      this.vel.x = (this.vel.x + fx / this.mass) * this.damp
      this.vel.y = (this.vel.y + fy / this.mass) * this.damp
      this.pre.x = this.pos.x
      this.pre.y = this.pos.y
      this.pos.x += this.vel.x
      this.pos.y += this.vel.y
    }
  }

  const dyna = new Dyna(MASS, DAMP)

  // -----------------------------------------------------------------------------
  // Bresenham's line algorithm
  // https://en.wikipedia.org/wiki/Bresenham%27s_line_algorithm
  // NOTE: vectors a and b will be floored

  function line(a, b) {
    let   x0 = Math.floor(a.x)
    let   y0 = Math.floor(a.y)
    const x1 = Math.floor(b.x)
    const y1 = Math.floor(b.y)
    const dx = Math.abs(x1 - x0)
    const dy = -Math.abs(y1 - y0)
    const sx = x0 < x1 ? 1 : -1
    const sy = y0 < y1 ? 1 : -1
    let  err = dx + dy

    const points = []

    while (true) {
      points.push({ x: x0, y: y0 })
      if (x0 == x1 && y0 == y1) break
      let e2 = 2 * err
      if (e2 >= dy) {
        err += dy
        x0 += sx
      }
      if (e2 <= dx) {
        err += dx
        y0 += sy
      }
    }
    return points
  }

  function smoothstep(edge0, edge1, x) {
    const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)))
    return t * t * (3 - 2 * t)
  }

  // -----------------------------------------------------------------------------

  // Stamp the pen along the segment it just travelled.
  function pre() {
    dyna.update(cursor)

    const points = line(dyna.pos, dyna.pre)

    for (const p of points) {
      const sx = Math.max(0, p.x - RADIUS)
      const ex = Math.min(cols, p.x + RADIUS)
      const sy = Math.floor(Math.max(0, p.y - RADIUS * aspect))
      const ey = Math.floor(Math.min(rows, p.y + RADIUS * aspect))

      for (let j = sy; j < ey; j++) {
        for (let i = sx; i < ex; i++) {
          const x = (p.x - i)
          const y = (p.y - j) / aspect
          const l = 1 - Math.sqrt(x * x + y * y) / RADIUS
          const idx = i + cols * j
          buffer[idx] = Math.max(buffer[idx], l)
        }
      }
    }
  }

  // Just a renderer
  const out = []
  function main() {
    let n = 0
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const idx = i + cols * j
        const v = smoothstep(0, 0.9, buffer[idx])
        buffer[idx] *= 0.99
        out[n++] = density[Math.floor(v * (density.length - 1))]
      }
      out[n++] = '\n'
    }
    out.length = n
    el.textContent = out.join('')
  }

  let last = 0
  const interval = 1000 / FPS

  function frame(t) {
    requestAnimationFrame(frame)
    if (t - last < interval - 1) return
    last = t
    if (!cols || !rows) return
    pre()
    main()
  }

  resize()
  // Resume the previous page's stroke: cursor, pen position and pen velocity.
  // On the first page of the session everything rests at the centre.
  if (saved && cellW && cellH) {
    cursor.x = saved.cx / cellW
    cursor.y = saved.cy / cellH
    const hasPen = [saved.px, saved.py, saved.vx, saved.vy].every(isFinite)
    dyna.pos.x = hasPen ? saved.px / cellW : cursor.x
    dyna.pos.y = hasPen ? saved.py / cellH : cursor.y
    dyna.vel.x = hasPen ? saved.vx / cellW : 0
    dyna.vel.y = hasPen ? saved.vy / cellH : 0

    // Bring the glow back, resampling if the grid changed shape.
    if (typeof saved.trail === 'string' && saved.cols > 0 && saved.rows > 0) {
      const same = saved.cols === cols && saved.rows === rows
      for (let j = 0; j < rows; j++) {
        const sj = same ? j : Math.min(saved.rows - 1, Math.round(j * saved.rows / rows))
        for (let i = 0; i < cols; i++) {
          const si = same ? i : Math.min(saved.cols - 1, Math.round(i * saved.cols / cols))
          const code = saved.trail.charCodeAt(si + saved.cols * sj)
          if (code > 0) buffer[i + cols * j] = code / 255
        }
      }
    }

    // The physics paused while the new page loaded. Replay the frames that
    // would have run in that gap so the pen lands where it would have been.
    if (isFinite(saved.t)) {
      const elapsed = performance.timeOrigin + performance.now() - saved.t
      const missed = Math.min(FPS * 2, Math.max(0, Math.round(elapsed / interval)))
      for (let k = 0; k < missed; k++) {
        pre()
        for (let i = 0; i < buffer.length; i++) buffer[i] *= 0.99
      }
    }
  } else {
    cursor.x = dyna.pos.x = cols / 2
    cursor.y = dyna.pos.y = rows / 2
  }
  dyna.pre.x = dyna.pos.x
  dyna.pre.y = dyna.pos.y
  requestAnimationFrame(frame)
})()
