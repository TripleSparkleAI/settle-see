// settle-see · fortyscan - THE 40 Hz CRACKLE'S SCANLINES: the eight TV patterns and the generator that draws them
// (lane FORTYSCAN 2026-10-08). The numbers, the bounds and the gate's clock are in fortycrackle.js, and its header
// carries the whole technical review (why, brightness only, the patterns, morphing, timing, draw-only, bounds).
//
// <claudes_code_comments>
// ** Function List **
// scanParams(name, rng, w, h)- pure: one dealt pattern's random shape (period, angle, speed, width ...) for a w x h
//                              picture
// scanAt(p, x, y, t, w, h)   - pure: one pattern's line intensity (0..1) at light (x, y) at lit phase t
// createFortyCrackle(w, h, o)- the scanline generator for one w x h picture:
//   .advance(k)              - k lit phases on: the clock, the hold and the morph; deals the next pattern from THE
//                              DECK RULE when a hold ends (at most CATCH_UP + 1 deals however large k is)
//   .phases                  - lit phases advanced so far
//   .deals                   - patterns dealt so far (the cost meter tests read)
//   .pattern                 - the pattern showing now (its name); .next the one it morphs toward, or null
//   .mix                     - the morph's progress, 0 (all .pattern) to 1 (all .next)
//   .intensity(x, y)         - the line intensity (0..1) at light (x, y) now, the morph blended in
//   .draw(F, target)         - brightens the LIT lights under the lines through F.flash, each by line intensity x its
//                              own soft read, in eight strength steps; an unlit light is never drawn; returns lights
// layerOf(p, t, w, h, store) - one pattern's intensity for a frame, once a row (level) or once a column (comb)
// layerAt(L, x, y)           - a light's intensity from layerOf, exactly scanAt's
//   .resize(w, h)            - a new picture size
//
// ** Technical Review **
// - Loaded on demand: mount.js imports this file the first time THE 40 Hz LIGHT shows a lit phase, so a page that
//   never turns the light on never loads it; index.js re-exports it for the tests and for any page that wants it.
// - scanAt is the pure definition of every pattern; layerOf/layerAt work the same values out once a row (level
//   patterns) or once a column (leaning and bent ones), and a test checks every light of every pattern against scanAt.
// - createFortyCrackle advances on the gate's lit-phase count, deals patterns from THE DECK RULE (deck.js) with its
//   own generator (crackleRng), morphs one into the next by smoothstep, and draws through the field's draw-only
//   F.flash in eight strength steps, brightening only lights whose soft read is at least o.minLit.
// </claudes_code_comments>

import { crackleRng } from './crackle.js';
import { createBag } from './deck.js';
import { fortyCrackleOf } from './fortycrackle.js';

const between = (rng, lo, hi) => lo + (hi - lo) * rng();
const sign = (rng) => (rng() < 0.5 ? -1 : 1);

// one dealt pattern's shape. Every length is in lights; the period is never under 3.5 rows (2 for interlace, which is
// one row on and one off by definition), so a line never fills the picture
export function scanParams(name, rng, w = 1, h = 1) {
  const base = { name, phase: rng(), gain: 1 };
  switch (name) {
    case 'lines':
      return { ...base, period: between(rng, 3.5, 6), width: 0.35, speed: between(rng, 0.004, 0.02) * sign(rng) };
    case 'tilt':
      return { ...base, period: between(rng, 3.5, 6), width: 0.35, speed: between(rng, 0.004, 0.02) * sign(rng), angle: between(rng, 5, 28) * sign(rng) };
    case 'roll':
      return { ...base, period: between(rng, 4, 8), width: 0.4, speed: between(rng, 0.15, 0.4) };
    case 'interlace':
      return { ...base, period: 2, width: 0.5, speed: 0, gain: 0.85 };
    case 'vhold':
      return { ...base, period: between(rng, 3.5, 5), width: 0.3, speed: 0.01, gain: 0.4, bar: between(rng, 0.1, 0.2) * h, cross: between(rng, 40, 90) };
    case 'wobble':
      return { ...base, period: between(rng, 4, 7), width: 0.35, speed: between(rng, 0.004, 0.015), amp: between(rng, 0.6, 1.8), wave: between(rng, 0.3, 0.8) * w, wobble: between(rng, 0.05, 0.14) };
    case 'bloom':
      return { ...base, period: between(rng, 7, 10), sigma: between(rng, 0.7, 1.0), speed: between(rng, 0.004, 0.015) * sign(rng), breathe: between(rng, 0.03, 0.07) };
    case 'retro':
      return { ...base, period: between(rng, 7, 11), width: between(rng, 0.8, 1.2), speed: between(rng, 0.01, 0.04), angle: between(rng, 1, 4) * sign(rng) };
    default:
      return { ...base, name: 'lines', period: 4, width: 0.35, speed: 0.01 };
  }
}

// the distance in rows from u to the nearest line centre of a comb of the given period, shifted by phase (a fraction
// of the period)
const TAU = 2 * Math.PI;
const toLine = (u, period, phase) => {
  let f = u / period + phase;
  f -= Math.floor(f);
  return Math.min(f, 1 - f) * period;
};
// a crisp line: full brightness within width rows of its centre, then a half-row soft edge
const EDGE = 0.5;
const crisp = (d, width) => (d <= width ? 1 : d >= width + EDGE ? 0 : 1 - (d - width) / EDGE);

export function scanAt(p, x, y, t, w = 1, h = 1) {
  if (!p) return 0;
  const drift = p.phase + p.speed * t;
  switch (p.name) {
    case 'lines':
    case 'roll':
      return crisp(toLine(y, p.period, drift), p.width) * p.gain;
    case 'interlace':
      // field A lights the even rows, field B the odd rows, swapping every lit phase
      return (Math.floor(y) + t) % 2 === 0 ? p.gain : 0;
    case 'tilt':
    case 'retro': {
      if (p._angle !== p.angle) {
        // the angle's cosine and sine, kept on the pattern so a frame works them out once rather than once a light
        const a = (p.angle * Math.PI) / 180;
        p._angle = p.angle;
        p._cos = Math.cos(a);
        p._sin = Math.sin(a);
      }
      const u = y * p._cos + (x - w / 2) * p._sin;
      return crisp(toLine(u, p.period, drift), p.width) * p.gain;
    }
    case 'vhold': {
      // faint lines, and a bright bar rolling down through them, entering at the top again when it leaves the bottom
      const faint = crisp(toLine(y, p.period, drift), p.width) * p.gain;
      const span = h + p.bar;
      let c = ((t / p.cross + p.phase) % 1) * span - p.bar / 2;
      const d = Math.abs(y - c);
      const bar = d <= p.bar / 2 ? 1 : d >= p.bar / 2 + 2 ? 0 : 1 - (d - p.bar / 2) / 2;
      return Math.max(faint, bar);
    }
    case 'wobble': {
      const u = y + p.amp * Math.sin((TAU * x) / p.wave + p.wobble * t);
      return crisp(toLine(u, p.period, drift), p.width) * p.gain;
    }
    case 'bloom': {
      const d = toLine(y, p.period, drift);
      const glow = 0.85 + 0.15 * Math.sin(p.breathe * t * 2 * Math.PI);
      return Math.exp(-(d * d) / (2 * p.sigma * p.sigma)) * glow;
    }
    default:
      return 0;
  }
}

// the patterns whose intensity depends on the row alone (draw works them out once a row)
const ROW_ONLY = new Set(['lines', 'roll', 'interlace', 'vhold', 'bloom']);

// one pattern's intensity for one frame, worked out the cheap way: a level pattern (ROW_ONLY) once a row into
// L.row; a comb pattern as the comb of u = y * cy + col[x], col worked out once a column (tilt and retro lean by the
// angle, wobble bends by a travelling sine). layerAt(L, x, y) then equals scanAt(p, x, y, t, w, h) exactly. The
// arrays live in store, reused from frame to frame
function layerOf(p, t, w, h, store) {
  if (ROW_ONLY.has(p.name)) {
    if (!store.row || store.row.length !== h) store.row = new Float64Array(h);
    for (let y = 0; y < h; y++) store.row[y] = scanAt(p, 0, y, t, w, h);
    return { row: store.row };
  }
  if (!store.col || store.col.length !== w) store.col = new Float64Array(w);
  const col = store.col;
  let cy = 1;
  if (p.name === 'wobble') {
    for (let x = 0; x < w; x++) col[x] = p.amp * Math.sin((TAU * x) / p.wave + p.wobble * t);
  } else {
    scanAt(p, 0, 0, t, w, h); // sets the pattern's cached cosine and sine
    cy = p._cos;
    for (let x = 0; x < w; x++) col[x] = (x - w / 2) * p._sin;
  }
  return { row: null, col, cy, p, drift: p.phase + p.speed * t };
}

function layerAt(L, x, y) {
  if (L.row) return L.row[y];
  return crisp(toLine(y * L.cy + L.col[x], L.p.period, L.drift), L.p.width) * L.p.gain;
}

const STEPS = 8; // strength steps, so a frame is a handful of F.flash calls rather than one a light
const CATCH_UP = 2; // whole schedule cycles one advance replays; the ones before them are skipped undealt

export function createFortyCrackle(w, h, opts = {}) {
  const o = fortyCrackleOf(opts) ?? fortyCrackleOf({});
  const rng = crackleRng(opts.seed ?? 0x40c0ffee);
  const deck = createBag(o.patterns, { random: rng });
  let pw = Math.max(1, Math.round(w));
  let ph = Math.max(1, Math.round(h));
  let phases = 0;
  let deals = 0;
  let cur = null; // the pattern showing (its parameters)
  let nxt = null; // the pattern it morphs toward, during a morph
  let shownAt = 0; // the phase cur began to show alone
  const buckets = Array.from({ length: STEPS }, () => []);
  const storeA = {};
  const storeB = {};

  const deal = () => {
    deals++;
    return scanParams(deck.next(), rng, pw, ph);
  };
  cur = deal();

  // the schedule: cur shows alone for o.hold phases, then nxt fades in over o.morph phases, then nxt becomes cur. A
  // long jump (a slow picture that missed many lit phases) skips the whole cycles nobody saw without dealing them,
  // so one advance deals at most CATCH_UP + 1 cards
  const step = (k) => {
    let left = k;
    const cycle = o.hold + o.morph;
    while (left > 0) {
      if (!nxt) {
        const holdEnd = shownAt + o.hold;
        if (phases + left < holdEnd) {
          phases += left;
          return;
        }
        left -= holdEnd - phases;
        phases = holdEnd;
        const whole = Math.floor(left / cycle);
        if (whole > CATCH_UP) {
          const skip = (whole - CATCH_UP) * cycle;
          phases += skip;
          shownAt += skip;
          left -= skip;
        }
        nxt = deal();
      }
      const end = shownAt + cycle; // the phase the morph ends at
      if (phases + left < end) {
        phases += left;
        return;
      }
      left -= end - phases;
      phases = end;
      cur = nxt;
      nxt = null;
      shownAt = end;
    }
  };
  const mixNow = () => {
    if (!nxt) return 0;
    const m = (phases - (shownAt + o.hold)) / o.morph;
    return m <= 0 ? 0 : m >= 1 ? 1 : m * m * (3 - 2 * m); // smoothstep, so a morph eases in and out
  };
  const at = (x, y) => {
    const m = mixNow();
    const a = m < 1 ? scanAt(cur, x, y, phases, pw, ph) : 0;
    const b = m > 0 ? scanAt(nxt, x, y, phases, pw, ph) : 0;
    return (1 - m) * a + m * b;
  };

  return {
    get phases() { return phases; },
    get deals() { return deals; },
    get pattern() { return cur.name; },
    get next() { return nxt ? nxt.name : null; },
    get mix() { return mixNow(); },
    get params() { return { cur, next: nxt }; },
    get size() { return [pw, ph]; },
    get options() { return o; },
    intensity: at,
    advance(k = 1) {
      const m = Math.max(0, Math.floor(k));
      if (m) step(m);
      return phases;
    },
    resize(W, H) {
      pw = Math.max(1, Math.round(W));
      ph = Math.max(1, Math.round(H));
    },
    draw(F, target = F?.target ?? null) {
      if (!F || typeof F.flash !== 'function') return 0;
      for (const b of buckets) b.length = 0;
      const m = F.m ?? null;
      const mix = mixNow();
      // each showing pattern worked out the cheap way for this frame (layerOf): a level one once a row, a comb one
      // (tilt, retro, wobble) once a column; the values are exactly scanAt's
      const A = mix < 1 ? layerOf(cur, phases, pw, ph, storeA) : null;
      const B = mix > 0 ? layerOf(nxt, phases, pw, ph, storeB) : null;
      const level = (!A || A.row) && (!B || B.row);
      let lights = 0;
      for (let y = 0; y < ph; y++) {
        const rowLine = level ? (A ? (1 - mix) * A.row[y] : 0) + (B ? mix * B.row[y] : 0) : -1;
        if (rowLine === 0) continue; // a dark row of a level pattern: nothing under it is drawn
        for (let x = 0; x < pw; x++) {
          const i = y * pw + x;
          // how lit the light is: the soft read, else the target's yes or no. An unlit light is never drawn
          const on = m ? (m[i] > 1 ? 1 : m[i] > 0 ? m[i] : 0) : target ? (target[i] > 0 ? 1 : 0) : 1;
          if (on < o.minLit) continue;
          const line = rowLine >= 0 ? rowLine : (A ? (1 - mix) * layerAt(A, x, y) : 0) + (B ? mix * layerAt(B, x, y) : 0);
          const s = Math.round(line * on * STEPS);
          if (s < 1) continue;
          buckets[Math.min(STEPS, s) - 1].push(i);
          lights++;
        }
      }
      for (let b = 0; b < STEPS; b++) {
        if (buckets[b].length) F.flash(buckets[b], o.strength * ((b + 1) / STEPS));
      }
      return lights;
    },
  };
}
