// settle-see · scenefield - THE SCENE SETTLE: a vector scene (discs, rings, lines in many colours) rasterised into a
// light field and settled, full colour. Built for page backgrounds (lane SETTLEBG, 2026-10-02): a page hands its vector
// picture to the field, the lights settle into it, and the pointer changes the picture, so the hover is settled too.
//
// <claudes_code_comments>
// ** Function List **
// SCENE_DEFAULTS                - cell 7 px a light (platePitch: the plate's own pitch, 0 = the cell), fps 20, lean 0.9, pull 0.3, hot 2.6 cooling to cold 0.42, the
//                                 look (glow, dim, level) and the pacing (sceneMs, pointerMs, restAfter)
// coverage(d, half, cell)       - how much of a light a shape edge covers: 1 inside, 0 outside, linear across one light
// rasterScene(prims, geom, opts)- the scene -> { bits, hue, gain }: one light per cell, each lit where a shape covers
//                                 it, with the palette index and the brightness of the brightest shape there
// sceneTemperature(ms, kick, o) - the temperature at ms after the start: hot, then cooling geometrically to cold, plus
//                                 a decaying kick that each new target gives
// sameBits(a, b)                - two targets equal, light by light
// createSceneSettle(canvas, opts) - the engine; returns the handle below
//   .pointer(p)                 - the pointer in canvas CSS pixels ({ x, y }) or null; the scene is rebuilt from it
//   .pulse(w)                   - THE RADIAL PULSE BUS's wave in canvas CSS pixels ({ id, x, y, r, band, a, phase });
//                                 live mode only: the lights brighten along the front, the shapes are pushed
//                                 outward and the temperature kicks; .pulseEnd(id) lets a wave go
// pulsePrims(prims, waves, o)   - pure: the shapes displaced radially by the waves crossing them (pulsePush px at
//                                 full gradient, a gain bump on the front)
//   .setScene(fn)               - a new scene function; the field re-settles into it
// scene.cadence(t) / scene.kickT(t) - optional, on the scene function: how often (ms) the engine re-reads it at
//                                 master time t (default opts.sceneMs) and the temperature a changed target re-settles
//                                 at (default opts.kickT); a moving 3D scene asks for every frame while its camera
//                                 swoops and a slower, gentler read while it drifts (lane BG3D)
//   .setMode('live' | 'still')  - live: settles every frame on the shared ticker; still: one pre-settled picture,
//                                 drawn once, with no ticker entry, no frame work at all
//   .resize()                   - re-read the canvas size (the page calls it on a window resize)
//   .stats()                    - { mode, w, h, n, T, frames, rebuilds, resting, r, stillMs, perf }
//   .perf                       - { phys, draw, raster, frames }: milliseconds spent, for the page's meter
//   .destroy()                  - leave the ticker and let go
//
// ** Technical Review **
// - THE SCENE is a function state -> prims, where state = { W, H, t, pointer }: W, H the canvas in CSS pixels, t
//   the master beat's time in ms, pointer the pointer or null. A prim is { k: 'disc', x, y, r }, { k: 'ring', x, y,
//   r, width } or { k: 'line', x1, y1, x2, y2, width }, each with hue (an index into opts.palette), gain (0..1) and,
//   for a line, hue2 (the far end's index: the line walks the palette between them). The engine owns no picture; a
//   site owns its scenes.
// - RASTERISING is plain JavaScript (no canvas), so it runs the same in node as in a browser and the tests check it.
//   Each light is a cell of opts.cell CSS pixels; its alpha from a shape is gain x coverage; the brightest shape over
//   a light gives it its hue and gain. A light is in the target (+1) when that alpha reaches litAt (0.2). A line is at
//   least 0.9 of a light wide, so a hairline still draws as a row of lights; a line with thin: true is exactly one light
//   wide (one light per step along its longer axis, clipped to the grid), at its gain (lane BG3D2). opts.ground(x, y) gives the empty cells
//   their colour (a faint dust), so the noise of a hot field shows across the whole picture and settles away.
// - THE PHYSICS is settle-see's field (field.js): every light a p-bit leaning toward the target and pulled by its
//   four neighbours, one exact checkerboard Gibbs sweep a frame. The temperature starts hot and cools to cold in about
//   two seconds (sceneTemperature); each new target (a hover, the scene's own step) kicks it up to kickT, decaying by
//   kickDecay a frame, so the new picture grows in through the field rather than appearing.
// - THE COLOUR is the renderer's 'map' mode (render.js): each light's own palette colour times its gain. opts.level
//   caps the whole picture's brightness, so a page can keep its text readable.
// - THE SCENE'S OWN PACE (lane BG3D): a scene function may carry cadence(t) and kickT(t). The engine reads them at
//   each step, so a scene that moves (the background's 3D camera) can ask to be re-read every frame through a fast
//   move and re-settle warm, and every few hundred ms through a slow drift and re-settle gently. Without them the
//   scene is re-read every opts.sceneMs and a change re-settles at opts.kickT, as before.
// - REST: once the field is cold, the kick has died and the target has not changed for restAfter frames, the frame
//   function returns at once (no sweep, no draw) until the next new target. The scene is still re-read every sceneMs
//   (its own motion) and after a pointer move (at most every pointerMs); an unchanged target costs one comparison.
// - TIME is THE MASTER BEAT's (masterbeat.js): the ticker entry runs with beat: true, so frames fall on the 1000 / fps
//   grid, and the scene's t is the master clock. The shared ticker halts the field with every other settle (a hidden
//   tab, an away reader, PAUSE ALL).
// - STILL MODE (the low CPU mode): the field settles out of sight in one go (stillSweeps sweeps through the same
//   schedule), is drawn once, and the engine leaves the ticker. Nothing runs per frame; stats().stillMs is the cost.
//   setMode('live') joins the ticker again from the settled picture.
// - THE 40 Hz LIGHT, ONE MODE: the canvas registers with the page's one 40 Hz gate (fortyhz.js register, by its label),
//   which gives it data-settle-light, so the site-wide 40 Hz mode dims it in phase with every other settle;
//   destroy() lets it go; opts.fortyHz = false opts out.
// - THE RADIAL PULSE (radialpulse.js, lane RADIALPULSE): a page hands the engine each wave as it crosses the canvas
//   (pulse(w), the wave in canvas CSS pixels). While a wave lives the scene is re-read at the pointer rate with its
//   shapes pushed outward along the front (pulsePrims), the plate's gain is raised along the front (the lights
//   brighten and fall back as it passes), and the temperature takes a kick of pulseKick x the gradient, so the lights
//   near the front re-settle: the picture heats along the passing wavefront and re-cools. Still mode does none of
//   this (pulse() answers false; the page draws a brightness change instead), so the low CPU mode keeps its promise.
// - opts.renderer replaces the 2D renderer (tests pass a stand-in); opts.now replaces the master clock.
// </claudes_code_comments>

import { createField } from './field.js';
import { createRenderer } from './render.js';
import { addTick } from './ticker.js';
import { masterBeat } from './masterbeat.js';
import { fortyHz } from './fortyhz.js';

export const SCENE_DEFAULTS = {
  cell: 7,
  fps: 20,
  lean: 0.9,
  pull: 0.3,
  hot: 2.6,
  cold: 0.42,
  hotMs: 350,
  coolMs: 1800,
  kickT: 0.95,
  kickDecay: 0.86,
  litAt: 0.2,
  glow: 0.7,
  dim: 0.1,
  level: 1,
  core: false,
  sceneMs: 500,
  pointerMs: 50,
  restAfter: 30,
  stillSweeps: 90,
  platePitch: 0,
  seed: 7,
  pulsePush: 10, // px: how far a shape on the wavefront is pushed outward at full gradient
  pulseGain: 0.6, // the gain raised along the front at full gradient
  pulseKick: 0.5, // the temperature kick a wave's arrival gives, times the gradient
};

// the shapes displaced radially by the waves crossing them: a shape whose centre (a line: each end) sits within
// a wave's band of its front moves outward from the wave's origin by pulsePush x a x (1 - u^2), u the distance from
// the front in bands, and its gain rises by the same bell. Pure; the engine calls it on every rebuild while a wave lives.
export function pulsePrims(prims, waves, o = SCENE_DEFAULTS) {
  if (!waves?.length) return prims;
  const push = o.pulsePush ?? SCENE_DEFAULTS.pulsePush;
  const bell = (x, y) => {
    let dx = 0;
    let dy = 0;
    let g = 0;
    for (const w of waves) {
      const ddx = x - w.x;
      const ddy = y - w.y;
      const k = Math.hypot(ddx, ddy);
      const u = (k - w.r) / Math.max(1, w.band);
      if (u <= -1 || u >= 1) continue;
      const b = Math.min(1, w.a) * (1 - u * u);
      g += b;
      if (k > 1e-9) { dx += (ddx / k) * b * push; dy += (ddy / k) * b * push; }
    }
    return { dx, dy, g };
  };
  return prims.map((p) => {
    if (p.k === 'line') {
      const a = bell(p.x1, p.y1);
      const b = bell(p.x2, p.y2);
      if (!a.g && !b.g) return p;
      return { ...p, x1: p.x1 + a.dx, y1: p.y1 + a.dy, x2: p.x2 + b.dx, y2: p.y2 + b.dy, gain: Math.min(1, (p.gain ?? 1) + 0.5 * Math.max(a.g, b.g)) };
    }
    const c = bell(p.x, p.y);
    if (!c.g) return p;
    return { ...p, x: p.x + c.dx, y: p.y + c.dy, gain: Math.min(1, (p.gain ?? 1) + 0.5 * c.g) };
  });
}

export function coverage(d, half, cell) {
  const c = (half - d) / cell + 0.5;
  return c <= 0 ? 0 : c >= 1 ? 1 : c;
}

// the scene -> one light per cell; geom = { w, h, cell }
export function rasterScene(prims, geom, opts = {}) {
  const { w, h, cell } = geom;
  const n = w * h;
  const litAt = opts.litAt ?? SCENE_DEFAULTS.litAt;
  const hue = new Uint8Array(n);
  const gain = new Float32Array(n);
  const best = new Float32Array(n); // the strongest shape's alpha at each light
  if (opts.ground) {
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const g = opts.ground((x + 0.5) * cell, (y + 0.5) * cell);
        if (!g) continue;
        hue[y * w + x] = g.hue;
        gain[y * w + x] = g.gain;
      }
    }
  }
  const put = (i, a, hu) => {
    if (a > best[i]) {
      best[i] = a;
      hue[i] = hu;
      gain[i] = a;
    }
  };
  const box = (x0, y0, x1, y1, fn) => {
    const cx0 = Math.max(0, Math.floor(x0 / cell));
    const cy0 = Math.max(0, Math.floor(y0 / cell));
    const cx1 = Math.min(w - 1, Math.floor(x1 / cell));
    const cy1 = Math.min(h - 1, Math.floor(y1 / cell));
    for (let y = cy0; y <= cy1; y++) for (let x = cx0; x <= cx1; x++) fn(y * w + x, (x + 0.5) * cell, (y + 0.5) * cell);
  };
  for (const p of prims) {
    const g = p.gain ?? 1;
    if (g <= 0) continue;
    if (p.k === 'disc') {
      const r = Math.max(p.r, cell * 0.45);
      box(p.x - r - cell, p.y - r - cell, p.x + r + cell, p.y + r + cell, (i, cx, cy) => {
        const a = g * coverage(Math.hypot(cx - p.x, cy - p.y), r, cell);
        if (a > 0) put(i, a, p.hue);
      });
    } else if (p.k === 'ring') {
      const half = Math.max(p.width ?? 1, cell * 0.9) / 2;
      const R = p.r + half + cell;
      box(p.x - R, p.y - R, p.x + R, p.y + R, (i, cx, cy) => {
        const d = Math.hypot(cx - p.x, cy - p.y);
        let a = g * coverage(Math.abs(d - p.r), half, cell);
        if (a > 0 && p.dash) {
          // a dashed ring: on for dash[0] px of arc, off for dash[1]
          const arc = (Math.atan2(cy - p.y, cx - p.x) + Math.PI) * p.r;
          if (arc % (p.dash[0] + p.dash[1]) > p.dash[0]) a = 0;
        }
        if (a > 0) put(i, a, p.hue);
      });
    } else if (p.k === 'line' && p.thin) {
      // a thin line (lane BG3D2): exactly one light per step along its longer axis, clipped to the grid first, at
      // the line's gain (no coverage falloff), so a long line costs its length in lights and draws one light wide
      const W = w * cell, H = h * cell;
      let x1 = p.x1, y1 = p.y1, x2 = p.x2, y2 = p.y2;
      let t0 = 0, t1 = 1;
      const ddx = x2 - x1, ddy = y2 - y1;
      const clip = (pp, q) => {
        if (pp === 0) return q >= 0;
        const r = q / pp;
        if (pp < 0) { if (r > t1) return false; if (r > t0) t0 = r; } else { if (r < t0) return false; if (r < t1) t1 = r; }
        return true;
      };
      if (!(clip(-ddx, x1) && clip(ddx, W - 1e-6 - x1) && clip(-ddy, y1) && clip(ddy, H - 1e-6 - y1))) continue;
      x2 = x1 + ddx * t1; y2 = y1 + ddy * t1; x1 += ddx * t0; y1 += ddy * t0;
      const n = Math.max(1, Math.ceil(Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1)) / cell));
      const hue2 = p.hue2;
      for (let k = 0; k <= n; k++) {
        const u = k / n;
        const cx = Math.floor((x1 + (x2 - x1) * u) / cell);
        const cy = Math.floor((y1 + (y2 - y1) * u) / cell);
        if (cx < 0 || cy < 0 || cx >= w || cy >= h) continue;
        const tt = t0 + (t1 - t0) * u;
        put(cy * w + cx, g, hue2 == null ? p.hue : Math.round(p.hue + (hue2 - p.hue) * tt));
      }
    } else if (p.k === 'line') {
      // walk the line's span row by row (a steep line) or column by column (a flat one): only the lights within
      // reach of the infinite line are visited, a superset of those the segment covers (lane BG3D: a 3D scene
      // draws about 1,500 short lines a read, and the bounding box visited three times as many lights)
      const half = Math.max(p.width ?? 1, cell * 0.9) / 2;
      const reach = half + cell * 0.5;
      const x1 = p.x1, y1 = p.y1, dx = p.x2 - x1, dy = p.y2 - y1;
      const L2 = dx * dx + dy * dy || 1;
      const adx = Math.abs(dx), ady = Math.abs(dy);
      const hue2 = p.hue2;
      const cover = (i, cx, cy) => {
        let t = ((cx - x1) * dx + (cy - y1) * dy) / L2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const ex = cx - (x1 + t * dx), ey = cy - (y1 + t * dy);
        const a = g * coverage(Math.sqrt(ex * ex + ey * ey), half, cell);
        if (a <= 0) return;
        put(i, a, hue2 == null ? p.hue : Math.round(p.hue + (hue2 - p.hue) * t));
      };
      if (ady >= adx) {
        const ext = (reach * Math.sqrt(L2)) / (ady || 1) + cell;
        const ry0 = Math.max(0, Math.floor((Math.min(y1, p.y2) - reach) / cell));
        const ry1 = Math.min(h - 1, Math.floor((Math.max(y1, p.y2) + reach) / cell));
        for (let y = ry0; y <= ry1; y++) {
          const cy = (y + 0.5) * cell;
          const xc = ady ? x1 + ((cy - y1) * dx) / dy : x1;
          const rx0 = Math.max(0, Math.floor((xc - ext) / cell));
          const rx1 = Math.min(w - 1, Math.floor((xc + ext) / cell));
          for (let x = rx0; x <= rx1; x++) cover(y * w + x, (x + 0.5) * cell, cy);
        }
      } else {
        const ext = (reach * Math.sqrt(L2)) / adx + cell;
        const rx0 = Math.max(0, Math.floor((Math.min(x1, p.x2) - reach) / cell));
        const rx1 = Math.min(w - 1, Math.floor((Math.max(x1, p.x2) + reach) / cell));
        for (let x = rx0; x <= rx1; x++) {
          const cx = (x + 0.5) * cell;
          const yc = y1 + ((cx - x1) * dy) / dx;
          const ry0 = Math.max(0, Math.floor((yc - ext) / cell));
          const ry1 = Math.min(h - 1, Math.floor((yc + ext) / cell));
          for (let y = ry0; y <= ry1; y++) cover(y * w + x, cx, (y + 0.5) * cell);
        }
      }
    }
  }
  const bits = new Int8Array(n);
  for (let i = 0; i < n; i++) bits[i] = best[i] >= litAt ? 1 : -1;
  return { bits, hue, gain };
}

export function sceneTemperature(ms, kick = 0, o = SCENE_DEFAULTS) {
  let T;
  if (ms < o.hotMs) T = o.hot;
  else if (ms < o.hotMs + o.coolMs) T = o.hot * Math.pow(o.cold / o.hot, (ms - o.hotMs) / o.coolMs);
  else T = o.cold;
  return Math.max(T, o.cold + kick);
}

export function sameBits(a, b) {
  if (!a || !b || a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false;
  return true;
}

export function createSceneSettle(canvas, options = {}) {
  const defined = (x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined));
  const o = { ...SCENE_DEFAULTS, ...defined(options) };
  const clock = o.now ?? (() => masterBeat().now());
  const pnow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  let scene = o.scene ?? (() => []);
  let mode = o.mode === 'still' ? 'still' : 'live';
  let pointer = null;
  let F = null;
  let R = null;
  let geom = null;
  let paint = null;
  let ctx = null;
  let t0 = clock();
  let kick = 0;
  let quiet = 0;
  let frames = 0;
  let rebuilds = 0;
  let lastScene = -1e9;
  let lastPointer = -1e9;
  let pointerDirty = false;
  let remove = null;
  let dead = false;
  let stillMs = null;
  let lastT = o.hot;
  const waves = new Map(); // THE RADIAL PULSE: the waves crossing this canvas now, by id (the latest frame of each)
  let lastPulse = -1e9;
  let pulseGain = null; // the plate's gain with the front's brightening, rebuilt per frame while a wave lives
  const perf = { phys: 0, draw: 0, raster: 0, frames: 0 };
  // THE 40 Hz LIGHT, ONE MODE (fortyhz.js): the canvas joins the page's one 40 Hz clock by its label; fortyHz: false
  // opts out
  const unlight = o.fortyHz === false ? null : fortyHz().register(canvas, o.label ?? 'scene settle');

  const size = () => ({ W: Math.max(1, Math.round(canvas.clientWidth || canvas.width || 1)), H: Math.max(1, Math.round(canvas.clientHeight || canvas.height || 1)) });

  const build = () => {
    const a = pnow();
    const { W, H } = size();
    let prims = scene({ W, H, t: clock(), pointer });
    if (waves.size) prims = pulsePrims(prims, [...waves.values()], o);
    const r = rasterScene(prims, geom, { litAt: o.litAt, ground: o.ground ? (x, y) => o.ground(x, y, W, H) : null });
    perf.raster += pnow() - a;
    rebuilds++;
    return r;
  };

  const retarget = (force = false) => {
    const r = build();
    if (!force && sameBits(r.bits, F.target) && paint && sameGain(r, paint)) return false;
    F.setTarget(r.bits);
    paint = { hue: r.hue, gain: r.gain };
    const kt = typeof scene.kickT === 'function' ? scene.kickT(clock()) : o.kickT;
    kick = Math.max(0, (Number.isFinite(kt) ? kt : o.kickT) - o.cold);
    quiet = 0;
    return true;
  };
  // the colours may change with the target unchanged (a node brightening): compare the gain, coarsely
  const sameGain = (r, p) => {
    for (let i = 0; i < r.gain.length; i++) if (Math.abs(r.gain[i] - p.gain[i]) > 0.04 || r.hue[i] !== p.hue[i]) return false;
    return true;
  };

  const layout = () => {
    const { W, H } = size();
    const cell = o.cell;
    const w = Math.ceil(W / cell);
    const h = Math.ceil(H / cell);
    if (canvas.width !== W) canvas.width = W;
    if (canvas.height !== H) canvas.height = H;
    if (geom && geom.w === w && geom.h === h) return false;
    geom = { w, h, cell, W, H };
    F = createField({ w, h, lean: o.lean, pull: o.pull, seed: o.seed });
    R?.destroy?.();
    const look = { color: 'map', palette: o.palette, glow: o.glow, dim: o.dim, level: o.level, core: o.core, clear: true };
    // the plate is drawn at platePitch device pixels a light (0: the cell itself) and scaled up to the canvas, so a
    // full-window picture composites a small plate: the dots soften, the cost falls with the square of the ratio
    const pitch = o.platePitch > 0 ? o.platePitch : cell;
    R = o.renderer ? o.renderer({ w, h, pitch, ...look }) : createRenderer({ w, h, pitch, ...look });
    ctx = canvas.getContext('2d');
    retarget(true);
    t0 = clock();
    quiet = 0;
    return true;
  };

  const sweepOnce = (T) => {
    F.sweep(1 / T);
    F.soften(0.55);
    lastT = T;
  };

  // the lights brighten along every live front: the gain raised by pulseGain x a x (1 - u^2), u the distance from
  // the front in bands; one pass over the lights, no allocation after the first
  const frontPaint = () => {
    if (!waves.size || !paint) return paint;
    const n = geom.w * geom.h;
    if (!pulseGain || pulseGain.length !== n) pulseGain = new Float32Array(n);
    pulseGain.set(paint.gain);
    const cell = geom.cell;
    for (const w of waves.values()) {
      const a = Math.min(1, w.a) * o.pulseGain;
      if (a <= 0) continue;
      const band = Math.max(1, w.band);
      const y0 = Math.max(0, Math.floor((w.y - w.r - band) / cell));
      const y1 = Math.min(geom.h - 1, Math.ceil((w.y + w.r + band) / cell));
      const x0 = Math.max(0, Math.floor((w.x - w.r - band) / cell));
      const x1 = Math.min(geom.w - 1, Math.ceil((w.x + w.r + band) / cell));
      for (let y = y0; y <= y1; y++) {
        const cy = (y + 0.5) * cell - w.y;
        for (let x = x0; x <= x1; x++) {
          const cx = (x + 0.5) * cell - w.x;
          const u = (Math.hypot(cx, cy) - w.r) / band;
          if (u <= -1 || u >= 1) continue;
          const i = y * geom.w + x;
          pulseGain[i] = Math.min(1, pulseGain[i] + a * (1 - u * u));
        }
      }
    }
    return { hue: paint.hue, gain: pulseGain };
  };

  const draw = () => {
    const a = pnow();
    const plate = R.render(F, { paint: frontPaint() });
    ctx.globalCompositeOperation = 'source-over';
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (R.pitch === geom.cell) ctx.drawImage(plate, 0, 0);
    else {
      ctx.imageSmoothingEnabled = true;
      const k = geom.cell / R.pitch;
      ctx.drawImage(plate, 0, 0, plate.width * k, plate.height * k);
    }
    perf.draw += pnow() - a;
  };

  const resting = () => quiet >= o.restAfter && kick < 0.01 && clock() - t0 > o.hotMs + o.coolMs;

  const step = () => {
    if (dead) return;
    const now = clock();
    // the scene's own motion (sceneMs) and the pointer (pointerMs): re-read the picture, settle into it if it changed
    const pulsing = waves.size > 0;
    const every = typeof scene.cadence === 'function' ? scene.cadence(now) : o.sceneMs;
    if (now - lastScene >= (Number.isFinite(every) ? every : o.sceneMs) || (pointerDirty && now - lastPointer >= o.pointerMs) || (pulsing && now - lastPulse >= o.pointerMs)) {
      lastScene = now;
      if (pointerDirty) {
        lastPointer = now;
        pointerDirty = false;
      }
      if (pulsing) lastPulse = now;
      retarget();
    }
    if (pulsing) quiet = 0;
    if (resting()) return;
    const a = pnow();
    sweepOnce(sceneTemperature(now - t0, kick, o));
    kick *= o.kickDecay;
    if (kick < 0.01) kick = 0;
    quiet++;
    perf.phys += pnow() - a;
    draw();
    frames++;
    perf.frames++;
  };

  const settleStill = () => {
    // the low CPU mode: settle out of sight through the same schedule, draw once, leave the ticker
    const a = pnow();
    retarget();
    F.randomise();
    const per = (o.hotMs + o.coolMs) / (o.stillSweeps - 10);
    for (let k = 0; k < o.stillSweeps; k++) sweepOnce(sceneTemperature(k * per, 0, o));
    draw();
    stillMs = pnow() - a;
  };

  const startLive = () => {
    if (remove || dead) return;
    remove = addTick(step, o.fps, o.label ?? 'scene settle', { beat: o.beat ?? true });
  };
  const stopLive = () => {
    remove?.();
    remove = null;
  };

  layout();
  if (mode === 'still') settleStill();
  else startLive();

  return {
    get mode() { return mode; },
    get field() { return F; },
    get geom() { return geom; },
    get paint() { return paint; },
    get perf() { return perf; },
    get frames() { return frames; },
    get live() { return !!remove; },
    pointer(p) {
      pointer = p ? { x: p.x, y: p.y } : null;
      pointerDirty = true;
    },
    pulse(w) {
      if (mode !== 'live' || dead || !w || !Number.isFinite(w.x) || !Number.isFinite(w.y)) return false;
      const fresh = !waves.has(w.id);
      waves.set(w.id, { id: w.id, x: w.x, y: w.y, r: w.r ?? 0, band: w.band ?? 56, a: Math.min(1, Math.max(0, w.a ?? 1)), phase: w.phase ?? 0 });
      if (fresh) kick = Math.max(kick, o.pulseKick * Math.min(1, w.a ?? 1));
      quiet = 0;
      return true;
    },
    pulseEnd(id) {
      if (!waves.delete(id)) return false;
      if (!waves.size && !dead && mode === 'live') { pulseGain = null; retarget(); }
      return true;
    },
    get pulses() { return waves.size; },
    setScene(fn) {
      scene = fn;
      t0 = clock();
      if (mode === 'still') settleStill();
      else {
        F.randomise();
        retarget(true);
      }
    },
    setMode(m) {
      const next = m === 'still' ? 'still' : 'live';
      if (next === mode) return;
      mode = next;
      if (mode === 'still') {
        stopLive();
        settleStill();
      } else {
        t0 = clock() - (o.hotMs + o.coolMs); // already settled: start cold
        quiet = 0;
        startLive();
      }
    },
    resize() {
      const changed = layout();
      if (mode === 'still') settleStill();
      else if (!changed) draw();
    },
    step,
    stats() {
      const s = F.stats();
      return { mode, w: geom.w, h: geom.h, n: geom.w * geom.h, T: lastT, frames, rebuilds, resting: resting(), r: s.r, q: s.q, stillMs, pulses: waves.size, perf: { ...perf } };
    },
    destroy() {
      dead = true;
      stopLive();
      unlight?.();
      R?.destroy?.();
    },
  };
}
