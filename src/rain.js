// settle-see · rain - RAIN AND WATERFALLS OF LIGHT (lane HERORAIN, navigator 2026-10-10, after teamLab Planets'
// waterfall room: "vertical streaks of light falling, dense rain in purple, cyan and pink, and a single bright column
// of falling light on black"). A stochastic process on a settle's own grid: every column carries a p-bit, drawn once a
// tick by the tanh rule, and a +1 starts a drop. The drops fall, the field's p-bits settle onto them, and the soft
// read leaves their tails.
//
// <claudes_code_comments>
// ** Function List **
// RAIN_TICK_MS             - 40: the process's own fixed step (25 ticks a second), whatever the frame rate
// RAIN_KINDS               - the two presets, rain and waterfall: the column field, the speeds, lengths, depth,
//                            colours, spray, mist and pool
// pbitP(field, beta)       - the tanh rule: P(+1) = (1 + tanh(beta I)) / 2
// rainField(o, w)          - the column field I(x): the preset's base plus a Gaussian bump per stream
// createRain(opts)         - one process on a w x h grid; returns the object below
//   .resize(w, h)          - a new grid (the process starts again)
//   .reset()               - empty sky, tick 0, the generator back at its seed
//   .advance(ms)           - run the ticks ms covers (an accumulator: the same ticks whatever the frame rate)
//   .warm(ms)              - advance with no frame in between, so a picture opens full of rain
//   .setStreams(streams)   - move or reshape the streams (a sweeping waterfall); the column field is remade
//   .setT(T) / .T          - the temperature of the column p-bits (beta = 1 / T); hot rain falls everywhere at random,
//                            cold rain falls only where the field leans it
//   .cells(cb)             - every lit cell of every streak and particle: cb(i, x, y, gain, hue, kind)
//   .render(bits, paint)   - write the streaks into bits (+1 lit, -1 dark) and, if given, paint { hue, gain }: the
//                            brightest streak's colour, its head brightest, its tail fading; a cell no streak covers
//                            keeps its colour and lets its gain fall by `afterglow` (0.7 a render) toward `ground`
//   .paintInto(bits, paint) - the streaks ADDED into bits and paint (nothing cleared or faded): render's inner walk,
//                            for a page with several processes on one grid
//   .heads(cb)             - the head cell of every drop: cb(i, gain, hue), for a page that holds only the heads
//   .stats()               - { drops, parts, spawned, landed, ticks }
//   .onLand                - set to (drop) => {} to hear every drop that reaches the pool or the floor
//
// ** Technical Review **
// - THE SPAWN IS A P-BIT. Column x has a field I(x) = base + sum over streams of field_k exp(-((x - cx_k) / wid_k)^2).
//   Each tick its p-bit is drawn: +1 with probability (1 + tanh(I / T)) / 2, and a +1 starts a drop at the top of
//   that column. Rain is a uniform negative base (about one drop a column a second at T 1); a waterfall is a very
//   negative base with strong positive streams, so the drops crowd its centre and thin out at its edges. Heating the
//   p-bits (T up) flattens tanh toward 1/2, so a hot sky rains everywhere and a cold one only where it leans: the
//   same anneal as the settle under it.
// - A stream may name its own colour weights (`hues`); a drop born in it wears them, so one curtain can hold a pink
//   stream beside a blue one.
// - A DROP has a depth z in [0, 1]: a near drop falls fast and long and bright, a far one slow, short and dim, with
//   the preset's far colour more likely (THE PARALLAX). Speed and length are fractions of the grid's height per
//   second, so the picture keeps its look at every grid size. Its streak is drawn back from the head along its
//   velocity, the head at full gain and the tail falling as (1 - k / len)^1.5.
// - SPRAY: a drop born at a stream's edge (where the stream is under half its peak) drifts sideways, away from the
//   centre, and is shorter; a falling stream also sheds spray particles from its head. MIST: a drop that reaches the
//   pool line dies there and may throw up mist particles, which rise a little, drift and fade; the pool also breathes
//   its own mist from p-bits whose field is the streams' wider shadow. A rain drop that reaches the floor may splash.
// - EVERYTHING IS SEEDED (rng.js), and ticks are fixed: two processes with the same seed, grid and ticks draw the same
//   rain, whatever the frame rate that drove them. The process owns no canvas and touches no field: a page decides
//   whether its streaks are a target (a live item), holds (an overlay on another picture) or a paint.
// - COST: one draw per column per tick and a walk of the streak cells per render. At 384 x 216 the hero's rain keeps
//   about 400 drops: a few thousand cells a render.
// </claudes_code_comments>

import { Rng } from './rng.js';

export const RAIN_TICK_MS = 40;

// speed and length are fractions of the grid's height (a second, a streak); hue weights pick a palette index
export const RAIN_KINDS = Object.freeze({
  rain: Object.freeze({
    base: -1.75, // P(+1) at T 1: 0.029 a tick, about 0.7 drops a column a second
    streams: [],
    speed: [0.55, 1.6],
    length: [0.05, 0.24],
    depth: [0, 1],
    hues: [0.46, 0.46, 0.08], // pink, blue, far colour
    farHue: 2,
    spray: 0,
    splash: 0.25,
    mist: 0,
    mistField: 0,
    pool: 1, // the floor: drops land at the bottom edge
    width: 1,
    maxDrops: 4,
  }),
  waterfall: Object.freeze({
    base: -3.2,
    streams: [{ x: 0.5, width: 0.035, field: 4.6 }],
    speed: [1.05, 1.75],
    length: [0.2, 0.45],
    depth: [0.55, 1],
    hues: [0.36, 0.54, 0.1],
    farHue: 2,
    spray: 0.35,
    splash: 0,
    mist: 0.55,
    mistField: -1.1,
    pool: 0.86,
    width: 1,
    maxDrops: 6,
  }),
});

export const pbitP = (field, beta) => (1 + Math.tanh(beta * field)) / 2;

// the tail's fall, (1 - q / 64)^1.5 for q in 0..64: a lookup, not a power a light
const TAIL = Float32Array.from({ length: 65 }, (_, q) => (1 - q / 64) ** 1.5);

export function rainField(o, w) {
  const f = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let I = o.base;
    for (const s of o.streams ?? []) {
      const d = (x + 0.5 - s.x * w) / Math.max(0.5, s.width * w);
      I += s.field * Math.exp(-d * d);
    }
    f[x] = I;
  }
  return f;
}

// the streams' wider shadow: where the pool breathes its own mist
function mistShadow(o, w) {
  const f = new Float32Array(w);
  for (let x = 0; x < w; x++) {
    let a = 0;
    for (const s of o.streams ?? []) {
      const d = (x + 0.5 - s.x * w) / Math.max(1, s.width * w * 3.2);
      a = Math.max(a, Math.exp(-d * d));
    }
    f[x] = a;
  }
  return f;
}

const pick = (r, weights) => {
  let tot = 0;
  for (const v of weights) tot += v;
  let u = r.unit() * tot;
  for (let i = 0; i < weights.length; i++) {
    u -= weights[i];
    if (u < 0) return i;
  }
  return weights.length - 1;
};
const lerp = (a, b, k) => a + (b - a) * k;

export function createRain(opts = {}) {
  const kind = RAIN_KINDS[opts.kind] ? opts.kind : 'rain';
  const o = { ...RAIN_KINDS[kind], ...opts, kind };
  let w = 0;
  let h = 0;
  let T = o.T ?? 1;
  let rng = new Rng(o.seed ?? 1);
  let field = null;
  let shadow = null;
  let P = null; // the column p-bits' P(+1) this temperature
  let mistP = null;
  let drops = [];
  let parts = [];
  let acc = 0;
  let ticks = 0;
  let spawned = 0;
  let landed = 0;

  const remakeP = () => {
    if (!field) return;
    const beta = 1 / Math.max(0.05, T);
    P = new Float32Array(w);
    mistP = new Float32Array(w);
    for (let x = 0; x < w; x++) {
      P[x] = pbitP(field[x], beta);
      mistP[x] = shadow[x] > 0.02 ? pbitP(o.mistField + 2.2 * shadow[x], beta) * o.mist : 0;
    }
  };

  const R = {
    kind,
    opts: o,
    onLand: null,
    get w() { return w; },
    get h() { return h; },
    get T() { return T; },
    get drops() { return drops; },
    get parts() { return parts; },
    resize(W, H) {
      w = Math.max(1, W | 0);
      h = Math.max(1, H | 0);
      field = rainField(o, w);
      shadow = mistShadow(o, w);
      R.reset();
    },
    reset() {
      rng = new Rng(o.seed ?? 1);
      drops = [];
      parts = [];
      acc = 0;
      ticks = 0;
      spawned = 0;
      landed = 0;
      remakeP();
    },
    setStreams(streams) {
      o.streams = streams ?? [];
      if (!w) return;
      field = rainField(o, w);
      shadow = mistShadow(o, w);
      remakeP();
    },
    setT(t) {
      const v = Math.max(0.05, Number(t) || 1);
      if (v === T) return;
      T = v;
      remakeP();
    },
    advance(ms) {
      if (!field) return 0;
      acc += Math.max(0, Math.min(1000, Number(ms) || 0));
      let n = 0;
      while (acc >= RAIN_TICK_MS) {
        acc -= RAIN_TICK_MS;
        tick();
        n++;
      }
      return n;
    },
    warm(ms) {
      let left = Math.max(0, ms);
      while (left > 0) {
        R.advance(Math.min(500, left));
        left -= 500;
      }
    },
    cells(cb) {
      for (const d of drops) {
        const len = Math.max(1, Math.round(d.len));
        const sx = d.vy > 0 ? d.vx / d.vy : 0;
        for (let k = 0; k < len; k++) {
          const y = Math.round(d.y) - k;
          if (y < 0) break;
          if (y >= h) continue;
          const x = Math.round(d.x - sx * k);
          if (x < 0 || x >= w) continue;
          const g = d.b * TAIL[((k * 64) / len) | 0];
          cb(y * w + x, x, y, g, d.hue, 'drop');
          if (d.wide && x + 1 < w) cb(y * w + x + 1, x + 1, y, g * 0.7, d.hue, 'drop');
        }
      }
      for (const p of parts) {
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        cb(y * w + x, x, y, p.b * Math.max(0, 1 - p.age / p.life), p.hue, p.kind);
      }
    },
    render(bits, paint = null) {
      const n = w * h;
      if (bits) bits.fill(-1);
      if (paint) {
        const af = o.afterglow ?? 0.7;
        const g0 = o.ground ?? 0;
        const G = paint.gain;
        for (let i = 0; i < n; i++) {
          const v = G[i] * af;
          G[i] = v < g0 ? g0 : v;
        }
      }
      R.paintInto(bits, paint);
      return bits;
    },
    // the streaks added into bits and paint, nothing cleared or faded first (a scene with several processes): the
    // same cells as cells(), walked inline (no callback a light), which is what keeps a hero sample under a millisecond
    paintInto(bits, paint = null) {
      const G = paint ? paint.gain : null;
      const U = paint ? paint.hue : null;
      for (let j = 0; j < drops.length; j++) {
        const d = drops[j];
        const len = Math.max(1, Math.round(d.len));
        const sx = d.vy > 0 ? d.vx / d.vy : 0;
        const y0 = Math.round(d.y);
        const kTop = Math.min(len - 1, y0); // rows above the top are not drawn
        const kBot = Math.max(0, y0 - h + 1); // nor rows below the floor
        const hue = d.hue;
        const step = 64 / len;
        const b = d.b;
        const xr = Math.round(d.x);
        if (!sx && !d.wide && G && bits) {
          // the common case, a straight streak: one column, no per-light rounding
          if (xr < 0 || xr >= w) continue;
          for (let k = kBot, i = (y0 - kBot) * w + xr; k <= kTop; k++, i -= w) {
            const g = b * TAIL[(k * step) | 0];
            bits[i] = 1;
            // a cell takes the colour of the brightest streak over it this render
            if (g >= G[i]) {
              G[i] = g;
              U[i] = hue;
            }
          }
          continue;
        }
        for (let k = kBot; k <= kTop; k++) {
          const x = sx ? Math.round(d.x - sx * k) : xr;
          if (x < 0 || x >= w) continue;
          const i = (y0 - k) * w + x;
          const g = b * TAIL[(k * step) | 0];
          if (bits) bits[i] = 1;
          if (G && g >= G[i]) {
            G[i] = g;
            U[i] = hue;
          }
          if (d.wide && x + 1 < w) {
            if (bits) bits[i + 1] = 1;
            if (G && g * 0.7 >= G[i + 1]) {
              G[i + 1] = g * 0.7;
              U[i + 1] = hue;
            }
          }
        }
      }
      for (let j = 0; j < parts.length; j++) {
        const p = parts[j];
        const x = Math.round(p.x);
        const y = Math.round(p.y);
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        const i = y * w + x;
        const g = p.b * Math.max(0, 1 - p.age / p.life);
        if (bits) bits[i] = 1;
        if (G && g >= G[i]) {
          G[i] = g;
          U[i] = p.hue;
        }
      }
      return bits;
    },
    heads(cb) {
      for (const d of drops) {
        const x = Math.round(d.x);
        const y = Math.round(d.y);
        if (x < 0 || x >= w || y < 0 || y >= h) continue;
        cb(y * w + x, d.b, d.hue);
      }
    },
    stats() {
      return { drops: drops.length, parts: parts.length, spawned, landed, ticks };
    },
  };

  const poolY = () => (o.pool >= 1 ? h : Math.round(o.pool * h));

  const spawnDrop = (x) => {
    const r = rng;
    const z = lerp(o.depth[0], o.depth[1], r.unit());
    const vy = lerp(o.speed[0], o.speed[1], r.unit()) * (0.45 + 0.55 * z) * h; // rows a second
    const len = Math.max(2, lerp(o.length[0], o.length[1], r.unit()) * (0.35 + 0.65 * z) * h);
    // a drop wears its strongest stream's colours when that stream names its own (a curtain of pink and blue streams)
    let own = null;
    let best = 0.03;
    for (const s of o.streams ?? []) {
      const d = (x + 0.5 - s.x * w) / Math.max(0.5, s.width * w);
      const a = Math.exp(-d * d);
      if (a > best && s.hues) {
        best = a;
        own = s.hues;
      }
    }
    let hue = pick(r, own ?? o.hues);
    if (z < 0.3 && r.unit() < 0.5) hue = o.farHue;
    let vx = 0;
    let spray = false;
    let edge = 1;
    for (const s of o.streams ?? []) {
      const d = (x + 0.5 - s.x * w) / Math.max(0.5, s.width * w);
      const a = Math.exp(-d * d);
      if (a > 0.03) edge = Math.min(edge, a);
      if (a > 0.03 && a < 0.5 && o.spray > 0 && r.unit() < o.spray) {
        spray = true;
        vx = Math.sign(d || r.signed()) * lerp(0.04, 0.18, r.unit()) * vy;
      }
    }
    drops.push({
      x: x + (o.streams?.length ? r.signed() * 0.35 : 0),
      y: -r.unit() * len * 0.5,
      vx,
      vy,
      len: spray ? len * 0.4 : len,
      b: (0.4 + 0.6 * z) * (spray ? 0.75 : 1),
      hue,
      z,
      spray,
      wide: !!o.streams?.length && edge > 0.85 && (o.width ?? 1) > 1,
    });
    spawned++;
  };

  const addPart = (x, y, vx, vy, life, hue, kind, b = 0.8) => {
    if (parts.length > w * 3) return;
    parts.push({ x, y, vx, vy, life, age: 0, hue, kind, b });
  };

  function tick() {
    const dt = RAIN_TICK_MS / 1000;
    const r = rng;
    ticks++;
    // the column p-bits: one tanh-rule draw each, a +1 starts a drop
    const cap = w * (o.maxDrops ?? 4);
    for (let x = 0; x < w; x++) if (r.unit() < P[x] && drops.length < cap) spawnDrop(x);
    // the pool breathes: p-bits in the streams' shadow throw up mist
    const py = poolY();
    if (o.mist > 0 && py < h) {
      for (let x = 0; x < w; x++) {
        if (mistP[x] > 0 && r.unit() < mistP[x] * 0.25) addPart(x + r.signed() * 0.5, py + r.unit() * (h - py), r.signed() * 0.03 * h, -lerp(0.02, 0.09, r.unit()) * h, lerp(0.35, 1.1, r.unit()), r.unit() < 0.5 ? 0 : 1, 'mist', lerp(0.35, 0.8, r.unit()));
      }
    }
    // the drops fall; a stream sheds spray from its head; a drop that reaches the pool or the floor lands
    const next = [];
    for (const d of drops) {
      d.y += d.vy * dt;
      d.x += d.vx * dt;
      if (d.vx) d.vx *= 1.04; // spray curves outward as it falls
      if (o.spray > 0 && !d.spray && o.streams?.length && r.unit() < o.spray * 0.12) {
        addPart(d.x, d.y, (r.unit() < 0.5 ? -1 : 1) * lerp(0.05, 0.16, r.unit()) * h, d.vy * 0.5, lerp(0.15, 0.45, r.unit()), d.hue, 'spray', d.b * 0.8);
      }
      if (d.y >= py) {
        landed++;
        R.onLand?.(d);
        if (py < h && o.mist > 0 && r.unit() < o.mist) {
          const k = 1 + (r.u32() % 3);
          for (let j = 0; j < k; j++) addPart(d.x + r.signed() * 2, py - r.unit() * 2, r.signed() * 0.06 * h, -lerp(0.04, 0.16, r.unit()) * h, lerp(0.3, 0.9, r.unit()), d.hue, 'mist', d.b * 0.7);
        } else if (o.splash > 0 && r.unit() < o.splash) {
          for (let j = 0; j < 2; j++) addPart(d.x, h - 1, (j ? 1 : -1) * lerp(0.03, 0.1, r.unit()) * h, -lerp(0.05, 0.14, r.unit()) * h, 0.18, d.hue, 'splash', d.b * 0.6);
        }
        continue;
      }
      if (d.x < -2 || d.x > w + 2) continue;
      next.push(d);
    }
    drops = next;
    const keep = [];
    for (const p of parts) {
      p.age += dt;
      if (p.age >= p.life) continue;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.kind === 'mist') p.vx += r.signed() * 0.02 * h;
      else p.vy += 0.6 * h * dt; // spray and splash fall back
      keep.push(p);
    }
    parts = keep;
  }

  if (opts.w && opts.h) R.resize(opts.w, opts.h);
  return R;
}
