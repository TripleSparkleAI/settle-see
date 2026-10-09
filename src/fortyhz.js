// settle-see · fortyhz - THE 40 Hz LIGHT, ONE MODE: one page-wide switch and one clock that every settling picture
// on the page flickers to, in phase.
//
// <claudes_code_comments>
// ** Function List **
// FORTY_HZ                     - the mode's numbers: hz 40, duty 0.5 (fully dark half of every cycle), slow 'nearest'
// FORTY_HZ_ATTR                - 'data-settle-light': the attribute every drawing that takes part carries
// FORTY_HZ_ROOT                - 'data-fortyhz': on <html> while the mode is on, 'lit' or 'dark' for the frame drawn
// FORTY_HZ_SESSION             - the sessionStorage key that keeps the mode on across a reload in the same tab
// FORTY_HZ_CSS                 - the one stylesheet: a drawing goes fully dark while the root reads 'dark'
// createFortyHz(opts)          - a gate over injected document, frame, clock, storage and reduced-motion (tests); the
//                                object below
//   .on                        - is the mode on
//   .set(on) -> boolean        - turn the mode on or off; on is refused (false) under reduced motion
//   .toggle()                  - flip it
//   .subscribe(fn) -> off      - fn(state) on every change of on, info or the light list; state = { on, info, lights }
//   .onPhase(fn) -> off        - fn(bright) at every flip while on, fn(null) when the mode goes off
//   .register(el, name) -> off - a drawing joins the clock: it gets the attribute and is listed by name
//   .lights()                  - the names of every drawing on the clock now
//   .elements()                - [element, name] for every drawing on the clock (the radial pulse bus reads it)
//   .phase                     - the state drawn now: true lit, false dark, null when off
//   .litCycle                  - how many lit phases have begun since the light went on (0 when off); THE 40 Hz
//                                CRACKLE (fortycrackle.js) advances its scanlines once per lit phase by it
//   .info                      - { hz, asked, refresh, nearest, refused, running, shownHz, darkShare, lockMs }
//   .step(now)                 - one display frame (the gate's own loop calls it; tests drive it directly)
//   .restore()                 - turn on again when this tab's session says it was on (and motion is allowed)
// fortyHz()                    - THE PAGE'S GATE, built on first use with the real document and window
// fortyHzRate(info)            - the rate the light actually shows, as a number for the status chip (0 when not shown)
//
// ** Technical Review **
// - ONE MODE (navigator, 2026-10-02: "The 40 Hz flashing mode must be ONE mode! It applies to ALL SETTLES site-wide,
//   including the footer!"). One gate per page, one switch, one clock. Every settle() registers its canvas here
//   (mount.js, opt out with fortyHz: false) and a page registers any picture it draws itself (useFortyHzLight in
//   settle-see/react). Turning the mode off anywhere turns it off everywhere: every off button calls set(false).
// - ONE WRITE PER FLIP. The gate writes FORTY_HZ_ROOT on <html> ('lit' / 'dark') and the one stylesheet does the rest:
//   every [data-settle-light] goes to opacity 0 while the root reads 'dark'. So every drawing changes on the same
//   frame by construction, whatever its own render loop is doing. A drawing whose own loop cannot keep up drops its
//   own frames; its light still follows the gate, so it cannot drift out of phase. Transitions on the drawings are
//   switched off while the mode is on, so no fade softens the dark half.
// - THE CLOCK is settle-see's createFlashClock on THE MASTER BEAT's origin (gamma.js, masterbeat.js): a frame is lit or
//   dark by where it falls on the master 25 ms grid, a dropped frame is dropped and never made up, a cycle never
//   flashes twice. THE RATE RULE is gamma.js's pickFlashRate: 40 Hz on a display that draws 100 frames a second and
//   up; below that the nearest exact 50% rate the display draws (30 Hz at 60), and info says so.
// - THE DISPLAY RATE is measured with measureRefresh over about a second when the mode goes on and again whenever the
//   tab becomes visible. measureRefresh takes a low percentile of the frame intervals, so a page busy enough to drop
//   frames still reads its display at the true rate (a dropped frame only ever lengthens an interval).
// - ESCAPE turns the mode off, page-wide, while it is on (one keydown listener on the document, added and removed with
//   the mode). The keypress is not consumed: whatever else Escape closes still closes.
// - SESSION ONLY: on sets FORTY_HZ_SESSION in sessionStorage and off removes it, so a reload in the same tab keeps the
//   mode and a fresh visit never starts flashing. Nothing goes in localStorage.
// - REDUCED MOTION refuses the mode (set(true) returns false and info.refused says why), and a change to reduced motion
//   while the mode is on turns it off.
// </claudes_code_comments>

import { masterBeat } from './masterbeat.js';
import { createFlashClock, measureRefresh, pickFlashRate } from './gamma.js';

export const FORTY_HZ = Object.freeze({ hz: 40, duty: 0.5, slow: 'nearest' });
export const FORTY_HZ_ATTR = 'data-settle-light';
export const FORTY_HZ_ROOT = 'data-fortyhz';
export const FORTY_HZ_SESSION = 'settle.fortyhz';
export const FORTY_HZ_CSS = `html[${FORTY_HZ_ROOT}] [${FORTY_HZ_ATTR}]{transition:none !important}
html[${FORTY_HZ_ROOT}='dark'] [${FORTY_HZ_ATTR}]{opacity:0 !important}`;

const STYLE_ID = 'settle-fortyhz-style';
const REDUCED = '(prefers-reduced-motion: reduce)';

export function fortyHzRate(info) {
  if (!info || info.refused || !info.running) return 0;
  return info.hz;
}

export function createFortyHz({
  doc = null,
  raf = null,
  caf = null,
  measure = measureRefresh,
  reduced = () => false,
  onReducedChange = null,
  storage = null,
  origin = null,
  hz = FORTY_HZ.hz,
  duty = FORTY_HZ.duty,
  slow = FORTY_HZ.slow,
} = {}) {
  const listeners = new Set();
  const phaseFns = new Set();
  const lights = new Map(); // element -> name
  const info = { hz, asked: hz, refresh: 0, nearest: false, refused: null, running: false, shownHz: 0, darkShare: 0, lockMs: 0 };
  let on = false;
  let phase = null;
  let clock = null;
  let frame = 0;
  let ticket = 0;
  let t0 = 0;
  let tPrev = 0;
  let flips = 0;
  let darkT = 0;
  let lock = 0;
  let litCycle = 0;
  const root = () => doc?.documentElement ?? null;
  const org = () => (Number.isFinite(origin) ? origin : masterBeat().origin);
  const state = () => ({ on, info: { ...info }, lights: [...lights.values()] });
  const notify = () => {
    const s = state();
    for (const fn of [...listeners]) {
      try { fn(s); } catch { /* one listener never stops the others */ }
    }
  };
  const writeRoot = (v) => {
    const r = root();
    if (!r) return;
    if (v === null) r.removeAttribute?.(FORTY_HZ_ROOT);
    else r.setAttribute?.(FORTY_HZ_ROOT, v);
  };
  const tellPhase = (b) => {
    for (const fn of [...phaseFns]) {
      try { fn(b); } catch { /* ignore */ }
    }
  };
  const injectStyle = () => {
    if (!doc || typeof doc.getElementById !== 'function' || doc.getElementById(STYLE_ID)) return;
    const s = doc.createElement('style');
    s.id = STYLE_ID;
    s.textContent = FORTY_HZ_CSS;
    (doc.head ?? doc.documentElement)?.appendChild?.(s);
  };
  const onKey = (e) => {
    if (e.key === 'Escape' && on) G.set(false);
  };
  const onVisible = () => {
    if (on && !doc?.hidden) start(); // the tab woke: the display may have changed, so measure again
  };
  const stopLoop = () => {
    if (frame && caf) caf(frame);
    frame = 0;
    clock = null;
  };
  const loop = (now) => {
    if (!on || !clock) return;
    frame = raf ? raf(loop) : 0;
    G.step(now);
  };
  function start() {
    stopLoop();
    const mine = ++ticket;
    info.running = false;
    Promise.resolve(measure()).then((r) => {
      if (!on || mine !== ticket) return;
      info.refresh = r;
      const pick = pickFlashRate(r, hz, slow);
      info.refused = pick.refused;
      info.nearest = pick.nearest;
      info.hz = pick.refused ? hz : pick.hz;
      if (pick.refused) {
        notify();
        return;
      }
      clock = createFlashClock({ hz: pick.hz, duty, refresh: r, origin: org() });
      info.running = true;
      t0 = 0;
      tPrev = 0;
      flips = 0;
      darkT = 0;
      lock = 0;
      frame = raf ? raf(loop) : 0;
      notify();
    });
  }
  const G = {
    get on() {
      return on;
    },
    get phase() {
      return phase;
    },
    get litCycle() {
      return on ? litCycle : 0;
    },
    get info() {
      return { ...info };
    },
    set(want) {
      const v = !!want;
      if (v === on) return true;
      if (v) {
        if (reduced()) {
          info.refused = 'reduced motion is on';
          notify();
          return false;
        }
        on = true;
        info.refused = null;
        info.shownHz = 0;
        info.darkShare = 0;
        try { storage?.setItem(FORTY_HZ_SESSION, '1'); } catch { /* storage may be blocked */ }
        injectStyle();
        phase = true;
        litCycle = 1;
        writeRoot('lit');
        doc?.addEventListener?.('keydown', onKey);
        doc?.addEventListener?.('visibilitychange', onVisible);
        notify();
        start();
        return true;
      }
      on = false;
      ticket++;
      stopLoop();
      info.running = false;
      phase = null;
      litCycle = 0;
      writeRoot(null);
      tellPhase(null);
      try { storage?.removeItem(FORTY_HZ_SESSION); } catch { /* ignore */ }
      doc?.removeEventListener?.('keydown', onKey);
      doc?.removeEventListener?.('visibilitychange', onVisible);
      notify();
      return true;
    },
    toggle() {
      return G.set(!on);
    },
    subscribe(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    onPhase(fn) {
      phaseFns.add(fn);
      return () => phaseFns.delete(fn);
    },
    register(el, name = 'settle') {
      if (!el) return () => {};
      lights.set(el, String(name));
      el.setAttribute?.(FORTY_HZ_ATTR, String(name));
      notify();
      return () => {
        if (!lights.has(el)) return;
        lights.delete(el);
        el.removeAttribute?.(FORTY_HZ_ATTR);
        notify();
      };
    },
    lights() {
      return [...lights.values()];
    },
    // every drawing on the clock with its element, for THE RADIAL PULSE BUS (radialpulse.js attachLights)
    elements() {
      return [...lights.entries()];
    },
    step(now) {
      if (!on || !clock) return phase;
      const { bright, onset, cycle } = clock.step(now);
      if (onset) lock = Math.max(lock, Math.abs(now - (org() + (cycle * 1000) / clock.hz)));
      if (tPrev && phase === false) darkT += (now - tPrev) / 1000;
      tPrev = now;
      if (bright !== phase) {
        if (bright && phase === false) {
          flips++;
          litCycle++;
        }
        phase = bright;
        writeRoot(bright ? 'lit' : 'dark');
        tellPhase(bright);
      }
      if (!t0) t0 = now;
      if (now - t0 >= 1000) {
        const sec = (now - t0) / 1000;
        info.shownHz = flips / sec;
        info.darkShare = darkT / sec;
        info.lockMs = lock;
        flips = 0;
        darkT = 0;
        lock = 0;
        t0 = now;
        notify();
      }
      return phase;
    },
    restore() {
      let was = null;
      try { was = storage?.getItem(FORTY_HZ_SESSION); } catch { /* ignore */ }
      if (was === '1' && !on) return G.set(true);
      return false;
    },
  };
  onReducedChange?.((isReduced) => {
    if (isReduced && on) G.set(false);
  });
  return G;
}

let page = null;

// THE PAGE'S GATE: one per page, on the real document, requestAnimationFrame, sessionStorage and the reduced-motion
// query. Outside a browser it is a gate with no document (register and set still work, nothing is drawn).
export function fortyHz() {
  if (page) return page;
  const hasDoc = typeof document !== 'undefined' && !!document.documentElement;
  const mq = typeof matchMedia === 'function' ? matchMedia(REDUCED) : null;
  let store = null;
  try { store = typeof sessionStorage !== 'undefined' ? sessionStorage : null; } catch { store = null; }
  page = createFortyHz({
    doc: hasDoc ? document : null,
    raf: typeof requestAnimationFrame === 'function' ? (f) => requestAnimationFrame(f) : null,
    caf: typeof cancelAnimationFrame === 'function' ? (id) => cancelAnimationFrame(id) : null,
    reduced: () => !!mq?.matches,
    onReducedChange: (fn) => mq?.addEventListener?.('change', (e) => fn(e.matches)),
    storage: store,
  });
  if (typeof globalThis !== 'undefined') globalThis.__settleFortyHz = page;
  return page;
}
