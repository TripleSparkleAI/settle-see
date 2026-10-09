// settle-see · global - THE GLOBAL SETTLE: one page-wide registry of every mounted settle and one ripple bus, so a
// click that ripples the page (the logo's) passes through the hero, the footer and every other settle on its way.
// Since lane RADIALPULSE it is a face over THE RADIAL PULSE BUS (radialpulse.js): a page ripple IS a radial pulse,
// every settle is one consumer of that bus, and anything else on the page (a background, a sound, a drawing on its
// own canvas) answers the same wave through the bus directly.
//
// <claudes_code_comments>
// ** Function List **
// GLOBAL_DEFAULTS                       - the ripple's numbers: speed (px/s), band (px), fade (px), floor, kick, pulse
// createGlobalSettle(opts)              - a registry and bus with injected clock, frame, state and window (tests)
//   .register(entry) -> off             - add a settle: { id, el, rect(), wave(w), arrive(a), pulse(p) }
//   .ripple(spec) -> record | null      - send a ripple: { x, y, strength, kind, scope, source, target, sound }
//   .onRipple(fn) -> off                - hear every ripple sent (the detail of the window event 'settle:ripple')
//   .tick(t)                            - one frame of the travelling rings (the frame loop calls it; tests too)
//   .refresh()                          - mark every rectangle stale (scroll and resize do this)
//   .stats()                            - { settles, ripples, frames, scheduled, sent }: frames counts ring frames
//   .clear()                            - drop every live ripple
//   .bus                                - the radial pulse bus underneath (radialpulse.js)
// globalSettle()                        - the page's one registry, over the page's one bus (radialPulse())
// registerSettle(entry) / ripple(spec) / onRipple(fn) / globalStats() - the same, on the page's registry
// clickPulse(spec)                      - a click in a settle with sound: the LOCAL ripple (its click noise) and a
//                                         page pulse from the same point through the bus, the settle itself skipped
// nearestPoint(x, y, r) / farthestCorner(x, y, r) - pure geometry: distance from a point to a rectangle
//
// ** Technical Review **
// - Every settle() registers itself (mount.js) with its canvas; opt out with the option global: false. The entry's
//   wave/arrive/pulse hooks are the bus's respond/arrive/still, translated to the shape the mount expects: wave gets
//   { x, y, r, band, a, kind, id, w, h, effect, turn } in its own CSS pixels with a = the strength at the front now
//   (effect: the RADIAL EFFECTS member, radialeffects.js), arrive gets the same plus d and kick = GLOBAL_DEFAULTS.kick
//   * a (a sound pop: its member's own kick), pulse (reduced motion) gets { x, y, w, h, d, a, ms, kind, id }
//   with a = the gradient at the settle.
// - A PAGE ripple is the bus's emit(): a ring at GLOBAL_DEFAULTS.speed (900 px/s) whose strength at radius r is
//   strength * exp(-r / fade); it ends when that falls under floor or the ring has passed everything. The mount turns
//   wave into a lean on the lights nearest the wavefront and arrive into a small temperature kick; then the settle
//   goes back to its own target. Consumers off screen are skipped by the bus.
// - A LOCAL ripple (scope 'local', a click inside a settle that has audio) travels nowhere: the settle draws its own
//   rings, and the bus only tells listeners (the click noises in settle-hear) through 'settle:ripple'. clickPulse()
//   adds the page pulse such a click now also sends (navigator 2026-10-02: a click inside the hero reaches every
//   settle and every background on the page), with the clicked settle as the source so it keeps to its own rings.
// - Under prefers-reduced-motion a page ripple sends one soft pulse() to every settle at once, in distance order, and
//   no ring. PAUSE ALL (settle-see's ticker state 'held'), a hidden tab or an away reader refuse new ripples and drop
//   live ones. The frame counter in stats() is the bus's: nothing runs while no wave travels.
// </claudes_code_comments>

import { createRadialPulse, radialPulse, nearestPoint, farthestCorner } from './radialpulse.js';
import { effectOf } from './radialeffects.js';
import { masterBeat } from './masterbeat.js';

export { nearestPoint, farthestCorner };

export const GLOBAL_DEFAULTS = {
  speed: 900, // px/s: how fast the ring travels across the page
  band: 56, // px: the width of the wavefront a settle leans on
  fade: 1400, // px: strength * exp(-r / fade)
  floor: 0.04, // a ripple ends when its strength at the front falls under this
  maxRipples: 6, // the oldest is dropped beyond this
  kick: 0.35, // the temperature kick at full strength (the mount multiplies T by 1 + kick * a)
  pulseMs: 450, // the reduced-motion pulse's length
};

export function createGlobalSettle(opts = {}) {
  const P = { ...GLOBAL_DEFAULTS, ...(opts.defaults ?? {}) };
  const win = opts.win === undefined ? (typeof window !== 'undefined' ? window : null) : opts.win;
  const now = opts.now ?? masterBeat().now; // THE MASTER BEAT's clock (masterbeat.js): one timebase for the page
  const bus = opts.bus ?? createRadialPulse({
    win, now, frame: opts.frame, reduced: opts.reduced, state: opts.state, viewport: opts.viewport, watch: opts.watch,
    defaults: { speed: P.speed, band: P.band, fade: P.fade, floor: P.floor, maxWaves: P.maxRipples, stillMs: P.pulseMs },
  });
  const listeners = new Set();
  let settles = 0;
  let sent = 0;

  const emit = (detail) => {
    sent++;
    for (const fn of listeners) { try { fn(detail); } catch { /* a listener that fails is left alone */ } }
    if (win?.dispatchEvent && typeof CustomEvent !== 'undefined') {
      try { win.dispatchEvent(new CustomEvent('settle:ripple', { detail })); } catch { /* no event, no harm */ }
    }
  };

  const G = {
    defaults: P,
    bus,
    register(entry) {
      settles++;
      const off = bus.register({
        id: entry.id ?? null,
        el: entry.el,
        rect: entry.rect,
        respond: entry.wave ? (w) => entry.wave({ x: w.x, y: w.y, r: w.r, band: w.band, a: w.front, kind: w.kind, id: w.id, w: w.w, h: w.h, effect: w.effect, turn: w.turn }) : undefined,
        // a user's click kicks the temperature by GLOBAL_DEFAULTS.kick; a sound's pop by its own member's kick
        arrive: entry.arrive ? (w) => entry.arrive({ x: w.x, y: w.y, w: w.w, h: w.h, d: w.d, a: w.front, kick: (w.effect && w.effect !== 'click' ? effectOf(w.effect).kick : P.kick) * w.front, kind: w.kind, id: w.id, effect: w.effect }) : undefined,
        still: entry.pulse ? (w) => entry.pulse({ x: w.x, y: w.y, w: w.w, h: w.h, d: w.d, a: w.a, ms: w.ms ?? P.pulseMs, kind: w.kind, id: w.id }) : undefined,
      });
      let gone = false;
      return () => {
        if (gone) return;
        gone = true;
        settles--;
        off();
      };
    },
    ripple(spec = {}) {
      const x = Number(spec.x);
      const y = Number(spec.y);
      if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
      const strength = Math.min(1, Math.max(0, Number.isFinite(spec.strength) ? spec.strength : 1));
      const scope = spec.scope === 'local' ? 'local' : 'page';
      const kind = spec.kind ?? 'ripple';
      const source = spec.source ?? null;
      let id;
      let reduced = false;
      if (scope === 'page') {
        const d = bus.emit({ x, y, strength, kind, source });
        if (!d) return null;
        id = d.id;
        reduced = d.reduced;
      } else {
        if (!bus.running()) return null;
        id = ++serial;
      }
      // drag and part (THE DRAG BOX): which drop a birth belongs to and which of its four it is, so a hearing can
      // treat a drop as one event (settle-hear THE DROP)
      const detail = { id, x, y, strength, kind, scope, source, sound: !!spec.sound, power: spec.power ?? null, reduced, drag: spec.drag ?? null, part: spec.part ?? null };
      emit(detail);
      return detail;
    },
    onRipple(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    tick: (t) => bus.tick(t),
    refresh: () => bus.refresh(),
    clear: () => bus.clear(),
    stats: () => {
      const s = bus.stats();
      return { settles, ripples: s.waves, frames: s.frames, scheduled: s.scheduled, sent };
    },
  };
  let serial = 1e6; // local ripples count on their own, past any page id
  return G;
}

let PAGE = null;
export function globalSettle() {
  if (!PAGE) {
    PAGE = createGlobalSettle({ bus: radialPulse() });
    if (typeof globalThis !== 'undefined') globalThis.__settleGlobal = PAGE;
  }
  return PAGE;
}
export const registerSettle = (entry) => globalSettle().register(entry);
export const ripple = (spec) => globalSettle().ripple(spec);
export const onRipple = (fn) => globalSettle().onRipple(fn);
export const globalStats = () => globalSettle().stats();

// a click in a settle with sound (mount.js, and lane HERODRAG's four births): the local ripple that plays its click
// noise, and a page pulse from the same point that every other settle, background and sound on the page answers
export function clickPulse(spec = {}) {
  const local = ripple({ ...spec, scope: 'local', sound: spec.sound ?? true });
  if (!local) return null;
  const page = radialPulse().emit({ x: spec.x, y: spec.y, strength: spec.pageStrength ?? spec.strength, kind: spec.kind ?? 'click', source: spec.source ?? null, drag: spec.drag ?? null });
  return { local, page };
}
