// settle-see · radialpulse - THE RADIAL PULSE BUS (lane RADIALPULSE, navigator 2026-10-02: "a click inside the HERO,
// or the LOGO, or a RADIAL CLICK EVENT anywhere: ALL SETTLES we have now rendered, in whatever form, on the user's
// current page, INTERACT and RESPOND internally to the radial thing"). One bus for every radial event on the page and
// one consumer interface every drawing (and every sound anchor) implements.
//
// <claudes_code_comments>
// ** Function List **
// RADIAL_DEFAULTS                      - speed 900 px/s, band 56 px, fade 1400 px, floor 0.04, maxWaves 8, margin 160,
//                                        stillMs 450
// PULSE_EVENT                          - 'settle:pulse', the window event every emit() fires
// arrivalMs(d, o) / falloff(d, s, o)   - pure: when a front first touches a thing d px away, and the gradient there
// nearestPoint(x, y, r) / farthestCorner(x, y, r) / onScreen(r, v, margin) - pure rectangle geometry
// createRadialPulse(opts)              - a bus with injected window, clock, frame, reduced-motion, state and viewport
//                                        (tests); returns the object below
//   .register(consumer) -> off         - { id, el | rect(), respond(w), arrive(w), leave(w), still(w) }
//   .emit(spec) -> detail | null       - { x, y, strength, kind, source, space: 'page' | 'client', speed }
//   .onPulse(fn) -> off                - hear every pulse sent (the detail of the window event)
//   .tick(t)                           - one frame of every travelling wave (the frame loop calls it; tests too)
//   .running()                         - is the page running (not PAUSE ALL, hidden or away)
//   .refresh()                         - mark every rectangle stale (scroll and resize do this)
//   .clear()                           - drop every live wave
//   .attachLights(gate)                - every drawing on THE 40 Hz gate becomes a consumer of its own (a brightness
//                                        animation) unless something already registered its element
//   .stats()                           - { consumers, waves, frames, scheduled, sent, lights }
// radialPulse()                        - THE PAGE'S BUS (one per page, on THE MASTER BEAT's clock and the 40 Hz gate)
// registerRadial(c) / emitPulse(spec) / onPulse(fn) / radialStats() - the same, on the page's bus
//
// ** Technical Review **
// - A WAVE is a ring growing from (x, y) in page pixels at `speed`. Nothing is computed per consumer until a frame runs.
//   Each frame, for every live wave and every consumer on screen: d = the distance from the origin to the consumer's
//   nearest point, D = to its farthest corner, r = the front's radius now. The front reaches the consumer when
//   r + band >= d (so its delay is arrivalMs(d) = (d - band) / speed), and has passed it when r - band > D. In between,
//   respond(w) is called every frame with w = { x, y (the origin in the consumer's own CSS px), ox, oy, w, h, d, r,
//   band, a (THE GRADIENT: strength * exp(-d / fade), the wave's strength at this consumer), front (the strength at the
//   front now), phase (0 at arrival .. 1 once the band has cleared the far corner), dir { x, y } (a unit vector from
//   the origin to the consumer's centre: THE DIRECTION), dist, t, dt, speed, kind, source, id, strength }. arrive(w)
//   runs once, on the first frame of contact, nearest consumers first; leave(w) once, when the band has passed.
// - ONE TIMER for every consumer: a single requestAnimationFrame runs while any wave lives and nothing is scheduled
//   otherwise (stats().frames holds still). No consumer owns a timer; the bus tells it when the front is there.
// - OFF SCREEN IS SKIPPED: a consumer whose rectangle lies more than `margin` px outside the viewport gets nothing,
//   not even arrive(). Rectangles come from getBoundingClientRect plus the scroll, cached, and marked stale on scroll
//   and resize (passive listeners, added with the first consumer and removed with the last); they are re-read only
//   when a wave starts or a frame runs after they went stale, never on a timer.
// - THE SOURCE IS SKIPPED: a consumer whose id equals the wave's source does not take its own wave (the hero's own
//   canvas draws its own rings; the logo draws its own bloom).
// - REDUCED MOTION: emit() sends one still(w) to every consumer on screen, nearest first, with the same w shape
//   (r = d, phase 0, reduced true, ms = stillMs) and no wave travels; a consumer answers with at most a brief
//   brightness change. PAUSE ALL, a hidden tab or an away reader (settle-see's ticker state) refuse a new wave and
//   drop live ones.
// - THE 40 Hz LIGHTS: attachLights(gate) reads the gate's registered drawings (fortyhz.js elements()) and gives each
//   one a consumer of its own, a Web Animation of filter: brightness that rises with the gradient as the band crosses
//   and falls as it passes, so a picture a page draws on its own canvas (a film stage, a player) answers the wave with
//   no page code and no per-frame work. An element that something already registered, or that contains a registered
//   element (a wrap round a settle's canvas), is left to that consumer.
// - THE CLOCK is THE MASTER BEAT's (masterbeat.js), so every wave's dt agrees with every TRUE TIME movie and the 40 Hz
//   light, and the bus's one frame reads the same time the drawings do.
// - settle-see's own settles join through global.js (THE GLOBAL SETTLE is now a face over this bus: ripple() is
//   emit(), and every settle() canvas is a consumer that leans its lights on the front and takes a temperature kick).
//   settle-hear never imports settle-see: a page registers its sound anchors here and hands the wave to the sound.
// </claudes_code_comments>

import { tickerState, onTickerState } from './ticker.js';
import { masterBeat } from './masterbeat.js';

export const RADIAL_DEFAULTS = Object.freeze({
  speed: 900, // px/s: how fast the front travels across the page
  band: 56, // px: the width of the wavefront a consumer answers
  fade: 1400, // px: a = strength * exp(-d / fade), the gradient
  floor: 0.04, // a wave ends when its strength at the front falls under this
  maxWaves: 8, // the oldest wave is dropped beyond this
  margin: 160, // px past the viewport a consumer still counts as on screen
  stillMs: 450, // the reduced-motion answer's length
  lightGain: 0.35, // the 40 Hz lights' brightness rise at full gradient (filter: brightness(1 + lightGain * a))
});

export const PULSE_EVENT = 'settle:pulse';

export const arrivalMs = (d, o = RADIAL_DEFAULTS) => (Math.max(0, d - (o.band ?? RADIAL_DEFAULTS.band)) * 1000) / (o.speed ?? RADIAL_DEFAULTS.speed);
export const falloff = (d, strength = 1, o = RADIAL_DEFAULTS) => strength * Math.exp(-Math.max(0, d) / (o.fade ?? RADIAL_DEFAULTS.fade));

export function nearestPoint(x, y, r) {
  const dx = Math.max(r.left - x, 0, x - (r.left + r.width));
  const dy = Math.max(r.top - y, 0, y - (r.top + r.height));
  return Math.hypot(dx, dy);
}

export function farthestCorner(x, y, r) {
  const dx = Math.max(Math.abs(x - r.left), Math.abs(x - (r.left + r.width)));
  const dy = Math.max(Math.abs(y - r.top), Math.abs(y - (r.top + r.height)));
  return Math.hypot(dx, dy);
}

// is a rectangle (page px) within `margin` of the viewport (page px)? With no viewport everything is on screen.
export function onScreen(r, v, margin = RADIAL_DEFAULTS.margin) {
  if (!v) return true;
  return r.left + r.width >= v.left - margin && r.left <= v.left + v.width + margin && r.top + r.height >= v.top - margin && r.top <= v.top + v.height + margin;
}

const pageRect = (el, win) => {
  if (!el?.getBoundingClientRect) return null;
  const b = el.getBoundingClientRect();
  const sx = win?.scrollX ?? win?.pageXOffset ?? 0;
  const sy = win?.scrollY ?? win?.pageYOffset ?? 0;
  return { left: b.left + sx, top: b.top + sy, width: b.width, height: b.height };
};

const viewportOf = (win) => {
  if (!win || !Number.isFinite(win.innerWidth)) return null;
  return { left: win.scrollX ?? win.pageXOffset ?? 0, top: win.scrollY ?? win.pageYOffset ?? 0, width: win.innerWidth, height: win.innerHeight };
};

export function createRadialPulse(opts = {}) {
  const P = { ...RADIAL_DEFAULTS, ...(opts.defaults ?? {}) };
  const win = opts.win === undefined ? (typeof window !== 'undefined' ? window : null) : opts.win;
  const now = opts.now ?? masterBeat().now; // THE MASTER BEAT's clock: one timebase for the page
  const frame = opts.frame ?? ((fn) => (typeof requestAnimationFrame !== 'undefined' ? requestAnimationFrame(fn) : 0));
  const reduced = opts.reduced ?? (() => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches);
  const state = opts.state ?? (() => tickerState().state);
  const viewport = opts.viewport ?? (() => viewportOf(win));
  const consumers = new Set();
  const lights = new Map(); // element -> its auto consumer entry (attachLights)
  const listeners = new Set();
  let live = [];
  let scheduled = false;
  let frames = 0;
  let sent = 0;
  let serial = 0;
  let listening = false;
  let lightsOff = null;
  let gate = null; // the 40 Hz gate whose drawings answer of their own accord (attachLights)

  const stale = () => { for (const e of consumers) e.stale = true; };
  const listen = (on) => {
    if (!win?.addEventListener || on === listening) return;
    listening = on;
    const f = on ? 'addEventListener' : 'removeEventListener';
    win[f]('scroll', stale, { passive: true, capture: true });
    win[f]('resize', stale, { passive: true });
  };
  const rectOf = (e) => {
    if (e.stale || !e.cache) {
      e.cache = e.rect === 'viewport' ? viewport() : e.rect ? e.rect() : pageRect(e.el, win);
      e.stale = false;
    }
    return e.cache;
  };
  const running = () => state() === 'running';

  const tell = (detail) => {
    sent++;
    for (const fn of listeners) { try { fn(detail); } catch { /* a listener that fails is left alone */ } }
    if (win?.dispatchEvent && typeof CustomEvent !== 'undefined') {
      try { win.dispatchEvent(new CustomEvent(PULSE_EVENT, { detail })); } catch { /* no event, no harm */ }
    }
  };

  const schedule = () => {
    if (scheduled || !live.length) return;
    scheduled = true;
    frame((t) => { scheduled = false; tick(t ?? now()); });
  };

  // the wave as one consumer sees it
  const waveFor = (wv, e, R, d, D, r, t) => {
    const cx = R.left + R.width / 2;
    const cy = R.top + R.height / 2;
    const dist = Math.hypot(cx - wv.x, cy - wv.y);
    const dir = dist > 1e-9 ? { x: (cx - wv.x) / dist, y: (cy - wv.y) / dist } : { x: 0, y: 0 };
    const span = D - d + 2 * P.band;
    return {
      id: wv.id, kind: wv.kind, source: wv.source, strength: wv.strength, speed: wv.speed,
      x: wv.x - R.left, y: wv.y - R.top, ox: wv.x, oy: wv.y, w: R.width, h: R.height,
      d, dist, r, band: P.band, a: falloff(d, wv.strength, P), front: falloff(r, wv.strength, P),
      phase: span > 0 ? Math.min(1, Math.max(0, (r - (d - P.band)) / span)) : 1,
      passMs: (span * 1000) / wv.speed,
      dir, t, dt: t - wv.t0, reduced: false,
    };
  };

  function tick(t = now()) {
    if (!live.length) return;
    if (!running()) { live = []; return; }
    frames++;
    const v = viewport();
    const keep = [];
    for (const wv of live) {
      const r = (wv.speed * Math.max(0, t - wv.t0)) / 1000;
      const front = falloff(r, wv.strength, P);
      let ahead = false;
      const arrivals = [];
      for (const e of consumers) {
        if (e.id != null && e.id === wv.source) continue;
        const R = rectOf(e);
        if (!R || !(R.width > 0) || !(R.height > 0)) continue;
        if (!onScreen(R, v, P.margin)) continue;
        const d = nearestPoint(wv.x, wv.y, R);
        if (r + P.band < d) { ahead = true; continue; }
        const D = farthestCorner(wv.x, wv.y, R);
        const passed = r - P.band > D;
        // a long frame may carry the front past a consumer it never touched: it still arrives (once), then leaves
        if (!wv.reached.has(e)) { wv.reached.add(e); arrivals.push({ e, w: waveFor(wv, e, R, d, D, r, t), passed }); if (!passed) ahead = true; continue; }
        if (passed) {
          if (!wv.left.has(e)) { wv.left.add(e); try { e.leave?.(waveFor(wv, e, R, d, D, r, t)); } catch { /* a consumer that fails is left alone */ } }
          continue;
        }
        ahead = true;
        try { e.respond?.(waveFor(wv, e, R, d, D, r, t)); } catch { /* ignore */ }
      }
      arrivals.sort((p, q) => p.w.d - q.w.d);
      for (const { e, w, passed } of arrivals) {
        try { e.arrive?.(w); } catch { /* ignore */ }
        try { e.respond?.(w); } catch { /* ignore */ }
        if (passed) { wv.left.add(e); try { e.leave?.(w); } catch { /* ignore */ } }
      }
      if (ahead && front >= P.floor) keep.push(wv);
      else for (const e of wv.reached) if (!wv.left.has(e)) { wv.left.add(e); const R = rectOf(e); if (R) { try { e.leave?.(waveFor(wv, e, R, nearestPoint(wv.x, wv.y, R), farthestCorner(wv.x, wv.y, R), r, t)); } catch { /* ignore */ } } }
    }
    live = keep;
    schedule();
  }

  // the brightness answer of a drawing on the 40 Hz gate: one Web Animation per wave, no frame work
  const lightArrive = (el) => (w) => {
    if (typeof el.animate !== 'function') return;
    const peak = 1 + P.lightGain * Math.min(1, w.a);
    const ms = w.reduced ? (w.ms ?? P.stillMs) : Math.max(120, Math.min(1400, w.passMs));
    try {
      el.animate(
        [{ filter: 'brightness(1)' }, { filter: `brightness(${peak.toFixed(3)})`, offset: w.reduced ? 0.3 : 0.35 }, { filter: 'brightness(1)' }],
        { duration: ms, easing: 'ease-out', composite: 'replace' },
      );
    } catch { /* an element with no animations */ }
  };
  const covered = (el) => {
    for (const e of consumers) {
      if (e.auto) continue;
      if (!e.el) continue;
      if (e.el === el) return true;
      if (typeof el.contains === 'function' && el.contains(e.el)) return true;
    }
    return false;
  };
  const syncLights = (gate) => {
    const els = new Set();
    for (const [el, name] of gate.elements?.() ?? []) {
      if (covered(el)) continue;
      els.add(el);
      if (lights.has(el)) continue;
      const entry = { id: `light:${name}`, el, auto: true, name, stale: true, cache: null };
      entry.arrive = lightArrive(el);
      entry.still = entry.arrive;
      lights.set(el, entry);
      consumers.add(entry);
      listen(true);
    }
    for (const [el, entry] of lights) {
      if (els.has(el)) continue;
      lights.delete(el);
      consumers.delete(entry);
    }
    if (!consumers.size) listen(false);
  };

  const G = {
    defaults: P,
    register(consumer) {
      const e = { ...consumer, stale: true, cache: null, auto: false };
      consumers.add(e);
      listen(true);
      if (gate) syncLights(gate); // a drawing this consumer covers leaves the lights' own answer
      return () => {
        consumers.delete(e);
        for (const wv of live) { wv.reached.delete(e); wv.left.delete(e); }
        if (gate) syncLights(gate);
        if (!consumers.size) listen(false);
      };
    },
    emit(spec = {}) {
      if (!running()) return null;
      let x = Number(spec.x);
      let y = Number(spec.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      if (spec.space === 'client') {
        x += win?.scrollX ?? win?.pageXOffset ?? 0;
        y += win?.scrollY ?? win?.pageYOffset ?? 0;
      }
      const strength = Math.min(1, Math.max(0, Number.isFinite(spec.strength) ? spec.strength : 1));
      const speed = Number.isFinite(spec.speed) && spec.speed > 0 ? spec.speed : P.speed;
      const wv = { id: ++serial, x, y, strength, speed, kind: spec.kind ?? 'pulse', source: spec.source ?? null, t0: now(), reached: new Set(), left: new Set() };
      const detail = { id: wv.id, x, y, strength, kind: wv.kind, source: wv.source, speed, sound: !!spec.sound, reduced: false, t0: wv.t0 };
      stale();
      if (reduced()) {
        detail.reduced = true;
        const v = viewport();
        const hits = [];
        for (const e of consumers) {
          if (e.id != null && e.id === wv.source) continue;
          const R = rectOf(e);
          if (!R || !(R.width > 0) || !(R.height > 0) || !onScreen(R, v, P.margin)) continue;
          const d = nearestPoint(x, y, R);
          const a = falloff(d, strength, P);
          if (a < P.floor) continue;
          const w = waveFor(wv, e, R, d, farthestCorner(x, y, R), d, wv.t0);
          w.reduced = true;
          w.ms = P.stillMs;
          w.phase = 0;
          hits.push({ e, w });
        }
        hits.sort((p, q) => p.w.d - q.w.d);
        for (const { e, w } of hits) { try { e.still?.(w); } catch { /* ignore */ } }
      } else {
        live.push(wv);
        if (live.length > P.maxWaves) live.shift();
        schedule();
      }
      tell(detail);
      return detail;
    },
    onPulse(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    tick,
    running,
    refresh: stale,
    clear() { live = []; },
    attachLights(g) {
      lightsOff?.();
      lightsOff = null;
      gate = null;
      if (!g?.subscribe) return () => {};
      gate = g;
      syncLights(g);
      const off = g.subscribe(() => syncLights(g));
      lightsOff = () => { off(); gate = null; for (const [, entry] of lights) consumers.delete(entry); lights.clear(); };
      return lightsOff;
    },
    stats: () => ({ consumers: consumers.size - lights.size, waves: live.length, frames, scheduled, sent, lights: lights.size }),
  };
  // PAUSE ALL, a hidden tab, an away reader: the waves stop with the pictures
  if (opts.watch !== false && !opts.state) onTickerState((s) => { if (s.state !== 'running') live = []; });
  return G;
}

let PAGE = null;
export function radialPulse() {
  if (!PAGE) {
    PAGE = createRadialPulse();
    if (typeof globalThis !== 'undefined') globalThis.__settleRadial = PAGE;
    // the drawings on THE 40 Hz gate answer of their own accord (a late import keeps this module free of a cycle)
    import('./fortyhz.js').then((m) => PAGE.attachLights(m.fortyHz())).catch(() => {});
  }
  return PAGE;
}
export const registerRadial = (consumer) => radialPulse().register(consumer);
export const emitPulse = (spec) => radialPulse().emit(spec);
export const onPulse = (fn) => radialPulse().onPulse(fn);
export const radialStats = () => radialPulse().stats();
