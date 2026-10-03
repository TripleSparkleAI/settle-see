// settle-see · masterbeat - THE MASTER BEAT: one clock and one grid for everything on the page that keeps time.
//
// <claudes_code_comments>
// ** Function List **
// MASTER                        - the grid's fixed numbers: tickMs 500 (TRUE TIME), bpm 120 (a beat a tick),
//                                 beatsPerBar 4 (a 2 s bar), flashHz 40 (a 25 ms cycle, 20 to a tick)
// MASTER_GLOBAL                 - '__settleMasterBeat', where the page's master beat is published for settle-hear
// unitMs(unit, m)               - the period of a grid unit in ms: 'tick' | 'truetime' | 'beat' | 'bar' | 'flash' | ms
// createMasterBeat(opts)        - a master beat over a clock (opts.now, default performance.now) and an origin
//                                 (opts.origin, default 0: the page's own time origin); returns the object below
//   .now()                      - the master time in ms (the clock)
//   .at(t)                      - every phase at t: { t, ms, tick, tickPhase, beat, beatPhase, bar, barPhase,
//                                 beatInBar, flash, flashPhase }
//   .index(t, unit)             - which grid line of `unit` t is past (floor((t - origin) / period))
//   .floor(t, unit)             - the time of that grid line
//   .next(t, unit)              - the time of the first grid line strictly after t
//   .phase(t, hz)               - where t sits in a cycle of hz (0..1), counted from the origin (the binaural phase)
//   .on(unit, fn)               - fn({ unit, index, t, now, skipped }) once each time `unit`'s grid line is crossed;
//                                 returns an unsubscribe. skipped: lines crossed while no frame ran (never replayed)
//   .step(now)                  - dispatch crossings up to now (the shared ticker calls it every frame)
//   .pause() / .resume()        - stop and restart dispatch; the grid never moves
//   .info()                     - the plain numbers settle-hear reads: { origin, tickMs, bpm, beatsPerBar, barMs,
//                                 flashHz, version }
// masterBeat()                  - THE PAGE'S MASTER BEAT (one per page, built on first use, published on
//                                 globalThis.__settleMasterBeat, its dispatch driven by the shared ticker)
//
// ** Technical Review **
// - THE LAW (navigator, 2026-10-01): one universal master beat. TRUE TIME, the 40 Hz light, the hero's rotation, the
//   footer's views, the logo's settle, THE DJ's bar line, the house passes and the binaural pair all count from ONE
//   origin on ONE grid. Every period is a whole multiple of the 25 ms flash cycle: a TRUE TIME tick is 20 flashes, a
//   beat is a tick, a bar is 4 beats (2 s, 80 flashes). So every bar line is a tick, every tick is a flash onset, and
//   a 40 Hz binaural pair started on a tick crosses phase zero with the light.
// - THE ORIGIN IS THE PAGE'S OWN TIME ORIGIN (performance.now() = 0). That choice needs no shared state: settle-hear
//   (which never imports settle-see) computes the same grid from the same clock. The object published on
//   globalThis.__settleMasterBeat carries the numbers anyway, so settle-hear follows a page that overrides them.
// - Wall-clock anchored: the grid is a pure function of the clock. Pausing (the ticker held, a hidden tab, nobody
//   there) stops dispatch only; on resume each subscriber is told the CURRENT line once, with skipped = the lines it
//   missed. Nothing catches up in a burst and nothing drifts: line k is always at origin + k * period.
// - The audio clock: settle-hear maps master time onto AudioContext time with getOutputTimestamp (the pair of
//   context and performance times for the sample leaving the speakers now), so a note scheduled for a master line
//   sounds at the instant the light shows that line. See settle-hear src/masterbeat.js.
// - Reduced motion does not touch the master beat: it is time, not motion. The things that move decide for
//   themselves what reduced motion means.
// </claudes_code_comments>

import { addTick } from './ticker.js';

export const MASTER = Object.freeze({ tickMs: 500, bpm: 120, beatsPerBar: 4, flashHz: 40 });
export const MASTER_GLOBAL = '__settleMasterBeat';

const perfNow = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

export function unitMs(unit, m = MASTER) {
  if (typeof unit === 'number') {
    if (!(unit > 0)) throw new Error('settle-see masterbeat: a period must be positive');
    return unit;
  }
  switch (unit) {
    case 'tick':
    case 'truetime':
    case 'beat':
      return m.tickMs;
    case 'bar':
      return m.tickMs * m.beatsPerBar;
    case 'flash':
      return 1000 / m.flashHz;
    default:
      throw new Error(`settle-see masterbeat: unknown unit ${unit}`);
  }
}

export function createMasterBeat({ now = perfNow, origin = 0, tickMs = MASTER.tickMs, beatsPerBar = MASTER.beatsPerBar, flashHz = MASTER.flashHz } = {}) {
  if (!(tickMs > 0) || !(beatsPerBar >= 1) || !(flashHz > 0)) throw new Error('settle-see masterbeat: bad grid');
  const m = { tickMs, beatsPerBar, flashHz, bpm: 60000 / tickMs };
  const barMs = tickMs * beatsPerBar;
  const subs = new Set();
  let paused = false;
  const per = (unit) => unitMs(unit, m);
  const index = (t, unit) => Math.floor((t - origin) / per(unit) + 1e-9);
  const B = {
    origin,
    tickMs,
    beatMs: tickMs,
    barMs,
    beatsPerBar,
    flashHz,
    bpm: m.bpm,
    now,
    index,
    floor(t, unit) {
      return origin + index(t, unit) * per(unit);
    },
    next(t, unit) {
      return origin + (index(t, unit) + 1) * per(unit);
    },
    phase(t, hz) {
      const c = ((t - origin) / 1000) * hz;
      return c - Math.floor(c);
    },
    at(t = now()) {
      const ms = t - origin;
      const tick = index(t, 'tick');
      const bar = index(t, 'bar');
      const flash = index(t, 'flash');
      return {
        t,
        ms,
        tick,
        tickPhase: ms / tickMs - tick,
        beat: tick,
        beatPhase: ms / tickMs - tick,
        bar,
        barPhase: ms / barMs - bar,
        beatInBar: tick - bar * beatsPerBar,
        flash,
        flashPhase: (ms * flashHz) / 1000 - flash,
      };
    },
    on(unit, fn) {
      const s = { unit, fn, last: null };
      per(unit); // refuse an unknown unit now, not at the first frame
      subs.add(s);
      return () => subs.delete(s);
    },
    get subscribers() {
      return subs.size;
    },
    step(t = now()) {
      if (paused) return;
      for (const s of [...subs]) {
        const k = index(t, s.unit);
        if (s.last === null) {
          s.last = k; // a new subscriber hears from the next line on
          continue;
        }
        if (k <= s.last) continue;
        const skipped = k - s.last - 1;
        s.last = k;
        try {
          s.fn({ unit: s.unit, index: k, t: origin + k * per(s.unit), now: t, skipped });
        } catch {
          /* one listener's failure never stops the beat */
        }
      }
    },
    pause() {
      paused = true;
    },
    resume() {
      paused = false;
    },
    get paused() {
      return paused;
    },
    info() {
      return { origin, tickMs, bpm: m.bpm, beatsPerBar, barMs, flashHz, version: 1 };
    },
  };
  return B;
}

let page = null;
let unTick = null;

// THE PAGE'S MASTER BEAT. Its dispatch rides the shared ticker (one requestAnimationFrame loop, halted with every
// settle when the tab is hidden or nobody is there), and only while somebody subscribes.
export function masterBeat() {
  if (page) return page;
  const pub = typeof globalThis !== 'undefined' ? globalThis[MASTER_GLOBAL] : null;
  page = createMasterBeat(pub && Number.isFinite(pub.origin) ? { origin: pub.origin } : {});
  if (typeof globalThis !== 'undefined') {
    const info = page.info();
    globalThis[MASTER_GLOBAL] = { ...info, now: page.now, at: page.at, next: page.next, floor: page.floor, phase: page.phase };
  }
  const on = page.on;
  page.on = (unit, fn) => {
    const off = on(unit, fn);
    if (!unTick) unTick = addTick((t) => page.step(t), 240, 'master beat');
    return () => {
      off();
      if (!page.subscribers && unTick) {
        unTick();
        unTick = null;
      }
    };
  };
  return page;
}
