// settle-see · bursts - 25 dramatic disturbances of a live field, and a deck that deals them in a seeded order.
//
// <claudes_code_comments>
// ** Function List **
// BURSTS                    - the 25 burst designs: { key, name, note, frames, step(F, k, env) }
// burstDeckOrder(seed, n)   - a seeded shuffle of 0..n-1 (Fisher-Yates on settle-see's own lcg)
// createBurstDeck(seed)     - THE DECK RULE (deck.js): next() deals every design once a round, a fresh shuffle each
//                             round, never the same design across the seam; .order (the first round), .dealt
// createBurstPlayer(opts)   - start(design, env) then step(F) once a frame (from a beforeStep hook) until it is done
// burstEnv(F, extra)        - the env a design reads: w, h, the centre, a seeded rnd, optional paths (spike wires)
//
// ** Technical Review **
// - Every burst is real settle-see behaviour acting on the field: flipping p-bits (s = -s), shaking (F.shake), the
//   pointer's hold (F.hold, rings of held lights that fade), the exact hold (F.clamp / release) and the flash channel
//   (F.flash, white-hot, touching no p-bit). After a burst the field settles back on its own: the burst disturbs, the
//   physics repairs. Nothing here changes the target.
// - A design runs for `frames` frames; step(F, k, env) is called with k = 0 .. frames - 1. Designs are cheap: a ring is
//   its circumference, a wipe is one row or column, the only whole-field passes are the single-frame flips.
// - The deck is settle-see's one deck (deck.js indexDeck over the 25 designs): the first 25 deals are all different,
//   deal 26 starts a fresh shuffle whose first design is never deal 25's. The same seed gives the same deals.
// </claudes_code_comments>

import { indexDeck } from './deck.js';

const lcg = (seed) => {
  let x = seed >>> 0 || 1;
  return () => ((x = (x * 1664525 + 1013904223) >>> 0) / 4294967296);
};

const idx = (env, x, y) => {
  const xi = Math.round(x);
  const yi = Math.round(y);
  return xi < 0 || yi < 0 || xi >= env.w || yi >= env.h ? -1 : yi * env.w + xi;
};
const flip = (F, cells) => {
  const cl = F.clamped;
  for (const i of cells) if (i >= 0 && !(cl && cl[i])) F.s[i] = -F.s[i];
};
const ring = (env, cx, cy, r, step = 0.8) => {
  const out = [];
  const n = Math.max(8, Math.ceil((2 * Math.PI * r) / step));
  for (let j = 0; j < n; j++) {
    const a = (j / n) * Math.PI * 2;
    const i = idx(env, cx + Math.cos(a) * r, cy + Math.sin(a) * r);
    if (i >= 0) out.push(i);
  }
  return out;
};
const line = (env, x0, y0, x1, y1) => {
  const out = [];
  const n = Math.max(1, Math.ceil(Math.hypot(x1 - x0, y1 - y0)));
  for (let j = 0; j <= n; j++) {
    const i = idx(env, x0 + ((x1 - x0) * j) / n, y0 + ((y1 - y0) * j) / n);
    if (i >= 0) out.push(i);
  }
  return out;
};
const thick = (env, cells) => {
  const out = [];
  for (const i of cells) out.push(i, i - 1, i + 1, i - env.w, i + env.w);
  return out.filter((i) => i >= 0 && i < env.w * env.h);
};
const row = (env, y) => {
  const yi = Math.round(y);
  if (yi < 0 || yi >= env.h) return [];
  return Array.from({ length: env.w }, (_, x) => yi * env.w + x);
};
const col = (env, x) => {
  const xi = Math.round(x);
  if (xi < 0 || xi >= env.w) return [];
  return Array.from({ length: env.h }, (_, y) => y * env.w + xi);
};
const far = (env) => Math.hypot(env.w, env.h) / 2;
const disc = (env, cx, cy, r) => {
  const out = [];
  for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(env.h - 1, Math.ceil(cy + r)); y++)
    for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(env.w - 1, Math.ceil(cx + r)); x++)
      if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) out.push(y * env.w + x);
  return out;
};
// spike paths, or (with none) straight random wires, for the designs that fire along the wiring
const wires = (env, n) => {
  if (env.paths?.length) return Array.from({ length: n }, () => env.paths[Math.floor(env.rnd() * env.paths.length)].cells);
  return Array.from({ length: n }, () => {
    const x = env.rnd() * env.w;
    return line(env, x, 0, x + (env.rnd() - 0.5) * env.w * 0.3, env.h - 1);
  });
};

const B = (key, name, frames, note, step) => ({ key, name, frames, note, step });

export const BURSTS = [
  B('heat-pulse', 'heat pulse', 14, 'half the lights shaken at once, then the cold pulls the picture back', (F, k, e) => {
    if (k === 0) F.shake(0.5);
    if (k < 3) F.flash(Array.from({ length: Math.floor(e.w * e.h * 0.02) }, () => Math.floor(e.rnd() * e.w * e.h)), 1 - k / 3);
  }),
  B('ring-of-flips', 'a ring of flips', 18, 'a ring grows from the centre, flipping every light it crosses', (F, k, e) => {
    const r = ((k + 1) / 18) * far(e);
    const c = thick(e, ring(e, e.cx, e.cy, r));
    flip(F, c);
    F.flash(c, 1);
  }),
  B('twin-rings', 'twin rings', 18, 'two rings from the left and right thirds cross in the middle', (F, k, e) => {
    const r = ((k + 1) / 18) * far(e) * 0.8;
    for (const cx of [e.w / 3, (2 * e.w) / 3]) {
      const c = thick(e, ring(e, cx, e.cy, r));
      flip(F, c);
      F.flash(c, 0.9);
    }
  }),
  B('spike-storm', 'spike storm', 20, 'sixty spikes fire along the wiring at once', (F, k, e) => {
    if (k === 0) e.mem.storm = wires(e, 60);
    for (const cells of e.mem.storm) {
      const head = Math.floor(((k + 1) / 20) * cells.length);
      F.flash(cells.slice(Math.max(0, head - 14), head + 1), 1);
    }
  }),
  B('melt-reform', 'melt and re-form', 16, 'the picture melts a little more each frame, then re-forms', (F, k) => {
    if (k < 8) F.shake(0.04 + k * 0.03);
  }),
  B('scanline', 'scanline', 16, 'a line sweeps down, flipping each row it passes', (F, k, e) => {
    const y = ((k + 0.5) / 16) * e.h;
    for (let d = -1; d <= 1; d++) {
      const r = row(e, y + d);
      flip(F, r);
      F.flash(r, 1);
    }
  }),
  B('vertical-wipe', 'vertical wipe', 16, 'a column sweeps across, flipping as it goes', (F, k, e) => {
    const x = ((k + 0.5) / 16) * e.w;
    for (let d = -2; d <= 2; d++) {
      const c = col(e, x + d);
      flip(F, c);
      F.flash(c, 1);
    }
  }),
  B('diagonal-wipe', 'diagonal wipe', 16, 'a diagonal edge crosses the field corner to corner', (F, k, e) => {
    const s = ((k + 0.5) / 16) * (e.w + e.h);
    const c = thick(e, line(e, s, 0, s - e.h, e.h - 1));
    flip(F, c);
    F.flash(c, 1);
  }),
  B('shockwave', 'shockwave', 18, 'the pointer\'s own rings: held lights that fade behind them', (F, k, e) => {
    const r = ((k + 1) / 18) * far(e);
    for (const i of ring(e, e.cx, e.cy, r, 1.2)) F.hold(i % e.w, Math.floor(i / e.w), 1.2, 1, 0.9);
  }),
  B('implosion', 'implosion', 18, 'a ring closes in from the edges to the centre', (F, k, e) => {
    const r = (1 - k / 18) * far(e);
    const c = thick(e, ring(e, e.cx, e.cy, r));
    flip(F, c);
    F.flash(c, 1);
  }),
  B('starburst', 'starburst', 14, 'rays race out from the centre', (F, k, e) => {
    const L = ((k + 1) / 14) * far(e);
    for (let j = 0; j < 24; j++) {
      const a = (j / 24) * Math.PI * 2;
      F.flash(line(e, e.cx + Math.cos(a) * L * 0.7, e.cy + Math.sin(a) * L * 0.7, e.cx + Math.cos(a) * L, e.cy + Math.sin(a) * L), 1);
    }
  }),
  B('rain', 'rain', 20, 'streaks fall through the field', (F, k, e) => {
    if (k === 0) e.mem.drops = Array.from({ length: 70 }, () => ({ x: e.rnd() * e.w, y: -e.rnd() * e.h, v: 2 + e.rnd() * 4 }));
    for (const d of e.mem.drops) {
      d.y += d.v * (e.h / 60);
      F.flash(line(e, d.x, d.y - e.h * 0.06, d.x, d.y), 1);
    }
  }),
  B('checker-flip', 'checkerboard flip', 12, 'every light of one checkerboard colour flips at once', (F, k, e) => {
    if (k !== 0) return;
    const cells = [];
    for (let y = 0; y < e.h; y++) for (let x = y & 1; x < e.w; x += 2) cells.push(y * e.w + x);
    flip(F, cells);
  }),
  B('band-shake', 'band by band', 16, 'the top half shakes, then the bottom half', (F, k, e) => {
    if (k !== 0 && k !== 6) return;
    const y0 = k === 0 ? 0 : Math.floor(e.h / 2);
    const cells = [];
    for (let y = y0; y < y0 + e.h / 2 && y < e.h; y++) for (let x = 0; x < e.w; x++) if (e.rnd() < 0.5) cells.push(y * e.w + x);
    flip(F, cells);
  }),
  B('spiral', 'spiral', 18, 'a spiral unwinds from the centre', (F, k, e) => {
    const out = [];
    for (let t = (k / 18) * 30; t < ((k + 1) / 18) * 30; t += 0.05) out.push(idx(e, e.cx + Math.cos(t) * t * (far(e) / 30), e.cy + Math.sin(t) * t * (far(e) / 30)));
    const c = thick(e, out.filter((i) => i >= 0));
    flip(F, c);
    F.flash(c, 1);
  }),
  B('sparkle', 'sparkle', 14, 'hundreds of points flare and fade', (F, k, e) => {
    for (let j = 0; j < 220; j++) F.flash(thick(e, [Math.floor(e.rnd() * e.w * e.h)]), 1);
  }),
  B('lightning', 'lightning', 12, 'a bolt walks from top to bottom, flipping its path', (F, k, e) => {
    if (k % 4 !== 0) return;
    let x = e.rnd() * e.w;
    const pts = [];
    for (let y = 0; y < e.h; y += 2) {
      x += (e.rnd() - 0.5) * 6;
      pts.push(idx(e, x, y));
    }
    const c = thick(e, pts.filter((i) => i >= 0));
    flip(F, c);
    F.flash(c, 1);
  }),
  B('columns-fire', 'the columns fire', 16, 'every vertical wire fires at once', (F, k, e) => {
    if (k === 0) e.mem.cols = env_kind(e, ['apical', 'axon', 'purkinje-axon']);
    for (const cells of e.mem.cols) {
      const head = Math.floor(((k + 1) / 16) * cells.length);
      F.flash(cells.slice(Math.max(0, head - 10), head + 1), 1);
    }
  }),
  B('fibre-rush', 'fibre rush', 14, 'every parallel fibre carries a spike at once', (F, k, e) => {
    if (k === 0) e.mem.fib = env_kind(e, ['parallel-fibre', 'tangential-fibre', 'axon-ahead']);
    for (const cells of e.mem.fib) {
      const head = Math.floor(((k + 1) / 14) * cells.length);
      F.flash(cells.slice(Math.max(0, head - 30), head + 1), 1);
    }
  }),
  B('freeze-band', 'freeze', 14, 'a band is held dark (the exact hold), then let go to re-form', (F, k, e) => {
    if (k === 0) {
      const cells = [];
      for (let y = Math.floor(e.h * 0.4); y < Math.floor(e.h * 0.6); y++) cells.push(...row(e, y));
      F.clamp(cells, -1);
    }
    if (k === 8) F.release();
  }),
  B('negative', 'negative', 12, 'every light flips: the picture goes negative, then rights itself', (F, k) => {
    if (k === 0) for (let i = 0; i < F.n; i++) if (!(F.clamped && F.clamped[i])) F.s[i] = -F.s[i];
  }),
  B('matrix-grid', 'matrix grid', 12, 'a glowing grid lights across the whole field', (F, k, e) => {
    const step = Math.max(8, Math.round(e.w / 24));
    const off = (k * 2) % step;
    const cells = [];
    for (let x = off; x < e.w; x += step) cells.push(...col(e, x));
    for (let y = off; y < e.h; y += step) cells.push(...row(e, y));
    F.flash(cells, 0.8);
  }),
  B('five-pulses', 'five pulses', 16, 'rings from five random points', (F, k, e) => {
    if (k === 0) e.mem.pts = Array.from({ length: 5 }, () => [e.rnd() * e.w, e.rnd() * e.h]);
    const r = ((k + 1) / 16) * far(e) * 0.45;
    for (const [x, y] of e.mem.pts) {
      const c = ring(e, x, y, r);
      flip(F, c);
      F.flash(c, 1);
    }
  }),
  B('radial-heat', 'radial heat', 16, 'a growing disc of shaken lights', (F, k, e) => {
    const r1 = ((k + 1) / 16) * far(e);
    const r0 = (k / 16) * far(e);
    const cells = disc(e, e.cx, e.cy, r1).filter((i) => Math.hypot((i % e.w) - e.cx, Math.floor(i / e.w) - e.cy) >= r0 && e.rnd() < 0.5);
    flip(F, cells);
  }),
  B('noise-bloom', 'noise blooms', 16, 'blooms of noise open at random points and close again', (F, k, e) => {
    if (k === 0) e.mem.bl = Array.from({ length: 7 }, () => [e.rnd() * e.w, e.rnd() * e.h, 0.08 + e.rnd() * 0.1]);
    if (k > 8) return;
    for (const [x, y, s] of e.mem.bl) {
      const cells = disc(e, x, y, s * Math.min(e.w, e.h) * ((k + 1) / 9)).filter(() => e.rnd() < 0.4);
      flip(F, cells);
    }
  }),
];

function env_kind(e, kinds) {
  const got = (e.paths ?? []).filter((p) => kinds.includes(p.kind)).map((p) => p.cells);
  return got.length ? got : wires(e, 40);
}

export function burstDeckOrder(seed = 1, n = BURSTS.length) {
  const r = lcg(seed);
  const a = Array.from({ length: n }, (_, i) => i);
  for (let i = n - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function createBurstDeck(seed = 20261001) {
  // THE DECK RULE (deck.js): every design once in a round, a fresh shuffle each round, never the same design across
  // the seam. order is the first round's order (the same seed, the same order).
  const deck = indexDeck(BURSTS.length, { seed });
  const first = indexDeck(BURSTS.length, { seed });
  const order = Array.from({ length: BURSTS.length }, () => first.next());
  return {
    order,
    get dealt() { return deck.drawn; },
    next() {
      return BURSTS[deck.next()];
    },
  };
}

export function burstEnv(F, extra = {}) {
  return { w: F.w, h: F.h, cx: F.w / 2, cy: F.h / 2, rnd: lcg(extra.seed ?? 7), mem: {}, ...extra };
}

export function createBurstPlayer() {
  let cur = null;
  let k = 0;
  let env = null;
  return {
    get active() { return !!cur; },
    get design() { return cur; },
    start(design, e) {
      cur = design;
      k = 0;
      env = e ?? null;
    },
    step(F) {
      if (!cur) return false;
      if (!env || env.w !== F.w || env.h !== F.h) env = burstEnv(F, env ?? {});
      cur.step(F, k, env);
      k++;
      if (k >= cur.frames) {
        if (cur.key === 'freeze-band') F.release();
        cur = null;
      }
      return true;
    },
  };
}
