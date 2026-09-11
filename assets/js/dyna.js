/**
 * An ASCII trail that lags behind a wandering point like a weighted pen.
 *
 * Port of ertdfgcvb's "Dyna" (https://play.ertdfgcvb.xyz/#/src/demos/dyna),
 * itself a remix of Paul Haeberli's Dynadraw from 1989. The original follows
 * the cursor; here the pen chases a point riding a Lorenz attractor, confined
 * to the empty margin to the right of the content so it never sits on text.
 */
(function () {
  const MASS = 60    // Pencil mass
  const DAMP = 0.95  // Pencil damping
  const RADIUS = 5   // Pencil radius
  const DECAY = 0.97 // Per-frame fade of the trail; lower is shorter
  const FPS = 60

  // Lorenz system. SPEED scales time so the pen can keep up; SUBSTEPS keeps
  // the integration stable at that speed.
  const SIGMA = 10, RHO = 28, BETA = 8 / 3
  const SPEED = 0.4
  const SUBSTEPS = 4
  // The camera tumbles around the attractor at two incommensurate rates, so
  // the projected shape never repeats. Radians per second.
  const SPIN_A = 0.11
  const SPIN_B = 0.07
  // Per-axis envelope: how fast the fitted extents relax, and their floor.
  const ENV_DECAY = 0.9995
  const ENV_FLOOR = 8
  // The flow is densest near its centre; a gamma below 1 pushes it outward
  // so the point spends its time across the whole strip, not the middle.
  const GAMMA = 0.6
  // The target stays this far inside the strip so the pen's body, RADIUS
  // cells either side, never reaches the text or the window edge.
  const MARGIN = RADIUS + 1
  const MIN_REGION = 8     // Cells of roaming room; below this, hide the trail

  const density = ' .:░▒▓█Ñ#+-'.split('')
  // Density levels at or below this are the comet tail and take the accent.
  const TAIL_LEVEL = 2

  // The reader asked for stillness.
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return

  const el = document.createElement('pre')
  el.className = 'dyna'
  el.setAttribute('aria-hidden', 'true')
  document.body.appendChild(el)

  let cols = 0, rows = 0, cellW = 0, cellH = 0, aspect = 1
  let buffer = new Float32Array(0)

  // The region of the grid the point may roam, in cells.
  const region = { x0: 0, y0: 0, x1: 0, y1: 0 }

  // The point the pen chases, in cells.
  const target = { x: 0, y: 0 }

  // Attractor state. Start slightly off the origin so the flow picks up.
  const lorenz = { x: 0.1, y: 0, z: 0 }
  // Camera angles and the running extents of the projection.
  const cam = { a: 0, b: 0 }
  const env = { x: ENV_FLOOR, y: ENV_FLOOR }

  // Everything carried across page loads so the stroke reads as one motion.
  const STORE_KEY = 'dyna-state'
  let saved = null
  try {
    const s = JSON.parse(sessionStorage.getItem(STORE_KEY))
    if (s && [s.lx, s.ly, s.lz].every(isFinite)) saved = s
  } catch (_) {}

  function remember() {
    if (!cellW || !cellH) return
    let trail = ''
    for (let i = 0; i < buffer.length; i++) {
      trail += String.fromCharCode(Math.round(Math.min(1, Math.max(0, buffer[i])) * 255))
    }
    const state = {
      t: performance.timeOrigin + performance.now(),
      lx: lorenz.x, ly: lorenz.y, lz: lorenz.z,
      ca: cam.a, cb: cam.b, ex: env.x, ey: env.y,
      px: dyna.pos.x * cellW, py: dyna.pos.y * cellH,
      vx: dyna.vel.x * cellW, vy: dyna.vel.y * cellH,
      cols, rows, trail,
    }
    try { sessionStorage.setItem(STORE_KEY, JSON.stringify(state)) } catch (_) {}
  }

  window.addEventListener('pagehide', remember)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') remember()
  })

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

  // The empty strip between the content column and the window edge.
  function locateRegion() {
    const outer = document.querySelector('.site-outer')
    const right = outer ? outer.getBoundingClientRect().right : 0
    region.x0 = Math.ceil(right / cellW) + MARGIN
    region.x1 = cols - MARGIN
    region.y0 = MARGIN
    region.y1 = rows - MARGIN
  }

  function regionUsable() {
    return region.x1 - region.x0 >= MIN_REGION && region.y1 - region.y0 >= MIN_REGION * 2
  }

  function resize() {
    measure()
    if (!cellW || !cellH) return
    cols = Math.ceil(window.innerWidth / cellW)
    rows = Math.ceil(window.innerHeight / cellH)
    aspect = cellW / cellH
    buffer = new Float32Array(cols * rows)
    locateRegion()
    el.style.display = regionUsable() ? '' : 'none'
  }

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
    update(target) {
      const fx = target.x - this.pos.x
      const fy = target.y - this.pos.y
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
  // Lorenz attractor, integrated with RK4 and projected onto the x–z plane,
  // which is the classic butterfly. x spans roughly [-20, 20], z [0, 50].

  function lorenzDeriv(s) {
    return {
      x: SIGMA * (s.y - s.x),
      y: s.x * (RHO - s.z) - s.y,
      z: s.x * s.y - BETA * s.z,
    }
  }

  function lorenzStep(dt) {
    const s = lorenz
    const k1 = lorenzDeriv(s)
    const k2 = lorenzDeriv({ x: s.x + k1.x * dt / 2, y: s.y + k1.y * dt / 2, z: s.z + k1.z * dt / 2 })
    const k3 = lorenzDeriv({ x: s.x + k2.x * dt / 2, y: s.y + k2.y * dt / 2, z: s.z + k2.z * dt / 2 })
    const k4 = lorenzDeriv({ x: s.x + k3.x * dt, y: s.y + k3.y * dt, z: s.z + k3.z * dt })
    s.x += (k1.x + 2 * k2.x + 2 * k3.x + k4.x) * dt / 6
    s.y += (k1.y + 2 * k2.y + 2 * k3.y + k4.y) * dt / 6
    s.z += (k1.z + 2 * k2.z + 2 * k3.z + k4.z) * dt / 6
  }

  // Advance one frame and map the attractor into the region.
  function moveTarget() {
    const dt = SPEED / FPS / SUBSTEPS
    for (let i = 0; i < SUBSTEPS; i++) lorenzStep(dt)
    cam.a += SPIN_A / FPS
    cam.b += SPIN_B / FPS

    // Centre the attractor, then view it from a slowly tumbling camera.
    const x = lorenz.x, y = lorenz.y, z = lorenz.z - RHO + 1
    const ca = Math.cos(cam.a), sa = Math.sin(cam.a)
    const cb = Math.cos(cam.b), sb = Math.sin(cam.b)
    const x1 = x * ca + z * sa          // rotate about y
    const z1 = -x * sa + z * ca
    const u = x1
    const v = y * cb - z1 * sb          // rotate about x

    // Stretch each axis on its own so the shape fills the strip. The envelope
    // jumps up instantly and relaxes slowly, so the point never leaves.
    env.x = Math.max(env.x * ENV_DECAY, Math.abs(u), ENV_FLOOR)
    env.y = Math.max(env.y * ENV_DECAY, Math.abs(v), ENV_FLOOR)

    const spread = (n) => Math.sign(n) * Math.pow(Math.abs(n), GAMMA)
    const w = region.x1 - region.x0
    const h = region.y1 - region.y0
    target.x = region.x0 + w / 2 + spread(u / env.x) * (w / 2)
    target.y = region.y0 + h / 2 + spread(v / env.y) * (h / 2)
  }

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
    moveTarget()
    dyna.update(target)

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

  // Just a renderer. Runs of tail characters are wrapped so they can take
  // the accent colour while the body of the pen keeps the base colour.
  const out = []
  function main() {
    let n = 0
    let inTail = false
    for (let j = 0; j < rows; j++) {
      for (let i = 0; i < cols; i++) {
        const idx = i + cols * j
        const v = smoothstep(0, 0.9, buffer[idx])
        buffer[idx] *= DECAY
        const level = Math.floor(v * (density.length - 1))
        const tail = level > 0 && level <= TAIL_LEVEL
        if (tail !== inTail) {
          out[n++] = tail ? '<span class="tail">' : '</span>'
          inTail = tail
        }
        out[n++] = density[level]
      }
      if (inTail) { out[n++] = '</span>'; inTail = false }
      out[n++] = '\n'
    }
    out.length = n
    el.innerHTML = out.join('')
  }

  let last = 0
  const interval = 1000 / FPS

  function frame(t) {
    requestAnimationFrame(frame)
    if (t - last < interval - 1) return
    last = t
    if (!cols || !rows || !regionUsable()) return
    pre()
    main()
  }

  resize()

  if (saved && cellW && cellH) {
    // Resume the previous page's stroke: attractor, pen position and velocity.
    lorenz.x = saved.lx
    lorenz.y = saved.ly
    lorenz.z = saved.lz
    if (isFinite(saved.ca)) cam.a = saved.ca
    if (isFinite(saved.cb)) cam.b = saved.cb
    if (isFinite(saved.ex)) env.x = saved.ex
    if (isFinite(saved.ey)) env.y = saved.ey
    moveTarget()
    const hasPen = [saved.px, saved.py, saved.vx, saved.vy].every(isFinite)
    dyna.pos.x = hasPen ? saved.px / cellW : target.x
    dyna.pos.y = hasPen ? saved.py / cellH : target.y
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
        for (let i = 0; i < buffer.length; i++) buffer[i] *= DECAY
      }
    }
  } else {
    // First page of the session: let the flow settle onto the attractor and
    // the envelopes find its size, then drop the pen right on the point.
    for (let k = 0; k < FPS * 10; k++) moveTarget()
    dyna.pos.x = target.x
    dyna.pos.y = target.y
  }
  dyna.pre.x = dyna.pos.x
  dyna.pre.y = dyna.pos.y
  requestAnimationFrame(frame)
})()
