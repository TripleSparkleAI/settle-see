// settle-see · shapes - the pictures a settle can settle into, as small canvas drawings.
//
// <claudes_code_comments>
// ** Function List **
// defineShape(name, draw, note)  - add a shape: draw(c, w, h, u) paints white on black; u is one line width
// defineBits(name, bits, note, family) - add a shape painted without a canvas: bits(w, h, spec) -> Int8Array of +1 / -1
// getShape(name) / shapeNames(family) - look one up / list them (all, or one family: physics, plain, credits)
// wrapLines(c, text, width, max)  - greedy word wrap by measured width, at most `max` lines (the last one carries the rest)
// landscapeE(x) / landscapeGeometry() - the energy landscape's curve and its valleys (for the shape and its test)
// SHAPES                         - the canvas built-ins (physics and plain), by name:
//   physics: purkinje, landscape, tanh, spins, boltzmann, hopfield, sdm, hypercube (the internal shapes of SETTLE's
//            own physics, first drawn for the home page's room; landscape is painted without a canvas, paint.js)
//   plain:   circle, ring, heart, star, spiral, wave, cross, diamond, moon, eye (quick shapes to settle into)
//   credits: the shapes of the people SETTLE rests on, Kanerva's memory first (creditshapes.js, painted by paint.js)
//   eightball (plain family): a Magic 8 Ball; with { text } its window shows the die's triangle and the answer
//            (wrapLines does the wrapping, at most three lines)
//
// ** Technical Review **
// - A shape is a function, not a bitmap, so it can be settled at any resolution. u = max(1, h / 90) is one line
//   width: at 64 rows it is one pixel and at 192 rows about two, so a higher resolution shows finer detail rather
//   than the same drawing blown up.
// - Shapes paint only white (a lit light) on black (an unlit one). target.js thresholds the result into +1 / -1.
// - Drawings with randomness use their own seeded generator so they look the same on every load.
// </claudes_code_comments>

import { Paint } from './paint.js';

const seeded = (seed) => {
  let x = seed >>> 0;
  return () => {
    x = (x * 1664525 + 1013904223) >>> 0;
    return x / 4294967296;
  };
};

const registry = new Map();

let family = 'physics';

export function defineShape(name, draw, note = '', fam = family) {
  registry.set(name, { name, draw, note, family: fam });
  return registry.get(name);
}
export function defineBits(name, bits, note = '', fam = 'custom') {
  registry.set(name, { name, bits, note, family: fam });
  return registry.get(name);
}
export const getShape = (name) => registry.get(name);
export const shapeNames = (fam) => [...registry.values()].filter((s) => !fam || s.family === fam).map((s) => s.name);

const path = (c, pts, close = false) => {
  c.beginPath();
  pts.forEach(([x, y], k) => (k ? c.lineTo(x, y) : c.moveTo(x, y)));
  if (close) c.closePath();
};

// ── physics ────────────────────────────────────────────────────────────────────────────────────────────────────

defineShape(
  'purkinje',
  (c, w, h, u) => {
    const r = seeded(7);
    c.strokeStyle = '#fff';
    c.lineCap = 'round';
    const branch = (x, y, a, len, lw, depth) => {
      const x2 = x + Math.cos(a) * len;
      const y2 = y + Math.sin(a) * len;
      c.lineWidth = Math.max(0.8, lw * u);
      c.beginPath();
      c.moveTo(x, y);
      c.lineTo(x2, y2);
      c.stroke();
      if (depth === 0 || y2 < h * 0.04) return;
      const kids = depth > 4 ? 2 : 2 + (r() < 0.5 ? 1 : 0);
      for (let k = 0; k < kids; k++) {
        const spread = (k / (kids - 1) - 0.5) * (0.9 + r() * 0.5);
        branch(x2, y2, a + spread, len * (0.7 + r() * 0.12), Math.max(0.7, lw * 0.72), depth - 1);
      }
    };
    const sx = w / 2;
    const sy = h * 0.78;
    branch(sx, sy, -Math.PI / 2, h * 0.2, 3, u > 1.5 ? 8 : 7);
    c.lineWidth = 2 * u;
    c.beginPath();
    c.moveTo(sx, sy);
    c.lineTo(sx + 2 * u, h);
    c.stroke();
    c.fillStyle = '#fff';
    c.beginPath();
    c.ellipse(sx, sy, h * 0.08, h * 0.07, 0, 0, Math.PI * 2);
    c.fill();
  },
  'a Purkinje cell: the most branched neuron',
);

// THE ENERGY LANDSCAPE, as a plot (redrawn 2026-10-01: the old symmetric double well read as something else at hero
// size). Painted without a canvas (paint.js), so it is exact at any size and its tests run in node: two axes with
// ticks and an E, an ASYMMETRIC curve (a shallow narrow valley on the left, a deep wide one on the right, a barrier
// between, walls at both ends), a ball resting in the shallow valley, and a dashed arrow over the barrier into the deep
// one: where settling goes.
export function landscapeE(x) {
  // x in [0, 1]; larger is higher energy
  return (
    1.15 -
    0.42 * Math.exp(-(((x - 0.27) / 0.075) ** 2)) -
    0.95 * Math.exp(-(((x - 0.69) / 0.13) ** 2)) +
    3.2 * (x - 0.5) ** 4 +
    0.08 * x
  );
}
export function landscapeGeometry() {
  const n = 160;
  const xs = Array.from({ length: n + 1 }, (_, k) => k / n);
  const es = xs.map(landscapeE);
  const lo = Math.min(...es);
  const hi = Math.max(...es);
  const U = (x) => 0.12 + x * 0.82;
  const V = (e) => 0.8 - ((e - lo) / (hi - lo)) * 0.66; // higher energy is higher up
  const pts = xs.map((x, k) => [U(x), V(es[k])]);
  const min = (a, b) => xs.filter((x) => x >= a && x <= b).reduce((m, x) => (landscapeE(x) < landscapeE(m) ? x : m), a);
  const left = min(0.15, 0.4);
  const right = min(0.5, 0.9);
  const barrier = xs.filter((x) => x >= left && x <= right).reduce((m, x) => (landscapeE(x) > landscapeE(m) ? x : m), left);
  return { pts, U, V, left, right, barrier, E: landscapeE };
}
defineBits(
  'landscape',
  (w, h) => {
    const p = new Paint(w, h);
    const g = landscapeGeometry();
    const th = 0.028;
    // the axes, with arrowheads, ticks, an E up the side and an x along the bottom
    const ox = 0.08;
    const oy = 0.88;
    p.seg(ox, 0.06, ox, oy, 0.022);
    p.seg(ox, oy, 0.97, oy, 0.022);
    p.poly([[ox - 0.018, 0.1], [ox, 0.05], [ox + 0.018, 0.1]], 0.02);
    p.poly([[0.95, oy - 0.03], [0.975, oy], [0.95, oy + 0.03]], 0.02);
    for (let k = 1; k <= 8; k++) p.seg(ox + k * 0.105, oy, ox + k * 0.105, oy + 0.045, 0.016);
    for (let k = 1; k <= 4; k++) p.seg(ox - 0.03, oy - k * 0.17, ox, oy - k * 0.17, 0.016);
    // E: a vertical and three bars, left of the axis near its top
    p.seg(0.012, 0.12, 0.012, 0.26, 0.02);
    for (const v of [0.12, 0.19, 0.26]) p.seg(0.012, v, 0.042, v, 0.02);
    // x: two strokes under the arrow
    p.seg(0.935, 0.93, 0.965, 0.99, 0.018);
    p.seg(0.965, 0.93, 0.935, 0.99, 0.018);
    // the curve
    p.poly(g.pts, th);
    // the ball in the shallow valley, resting on the curve
    const r = 0.055;
    const bu = g.U(g.left);
    const bv = g.V(g.E(g.left)) - (r * Math.min(w, h)) / (h - 1) - 0.02;
    p.disc(bu, bv, r);
    // a dashed arrow from the ball, over the barrier, down into the deep valley
    const a0 = [bu + 0.04, bv - 0.05];
    const a1 = [g.U(g.right) - 0.03, g.V(g.E(g.right)) - 0.16];
    const top = g.V(g.E(g.barrier)) - 0.12;
    const at = (t) => [a0[0] + (a1[0] - a0[0]) * t, (1 - t) * (1 - t) * a0[1] + 2 * (1 - t) * t * top + t * t * a1[1]];
    for (let k = 0; k < 8; k += 2) {
      const [u0, v0] = at(k / 8);
      const [u1, v1] = at((k + 1) / 8);
      p.seg(u0, v0, u1, v1, 0.02);
    }
    const [eu, ev] = at(1);
    const [pu, pv] = at(0.92);
    const dx = eu - pu;
    const dy = ev - pv;
    const L = Math.hypot(dx, dy) || 1;
    p.poly([[eu - (dx / L) * 0.04 - (dy / L) * 0.03, ev - (dy / L) * 0.04 + (dx / L) * 0.03], [eu, ev], [eu - (dx / L) * 0.04 + (dy / L) * 0.03, ev - (dy / L) * 0.04 - (dx / L) * 0.03]], 0.02);
    return p.t;
  },
  'the energy landscape: a shallow valley, a deep one, a barrier between; the ball settles downhill',
  'physics',
);

defineShape(
  'tanh',
  (c, w, h, u) => {
    c.strokeStyle = '#fff';
    c.lineWidth = 2 * u;
    path(c, [[w * 0.1, h * 0.5], [w * 0.9, h * 0.5]]);
    c.stroke();
    path(c, [[w * 0.5, h * 0.08], [w * 0.5, h * 0.92]]);
    c.stroke();
    c.lineWidth = 5 * u;
    path(c, [...Array(101)].map((_, k) => [w * 0.1 + (k / 100) * w * 0.8, h * 0.5 - Math.tanh(-4 + (k / 100) * 8) * h * 0.36]));
    c.stroke();
  },
  'the p-bit rule: P(yes) = (1 + tanh I) / 2',
);

defineShape(
  'spins',
  (c, w, h, u) => {
    c.strokeStyle = '#fff';
    c.fillStyle = '#fff';
    c.lineWidth = 2 * u;
    const cols = u > 1.5 ? 16 : 12;
    const rows = u > 1.5 ? 7 : 5;
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const x = w * 0.06 + (i + 0.5) * ((w * 0.88) / cols);
        const y = h * 0.1 + (j + 0.5) * ((h * 0.8) / rows);
        const d = i < Math.round(cols * 0.42) + (j % 2) ? -1 : 1;
        const L = (h * 0.38) / rows;
        path(c, [[x, y - d * L], [x, y + d * L]]);
        c.stroke();
        const a = 3 * u;
        path(c, [[x, y - d * L - d * a], [x - a, y - d * L + d * a * 0.7], [x + a, y - d * L + d * a * 0.7]], true);
        c.fill();
      }
    }
  },
  'an Ising lattice: two domains and a wall',
);

defineShape(
  'boltzmann',
  (c, w, h, u) => {
    c.fillStyle = '#fff';
    const n = 12;
    const bw = (w * 0.8) / n;
    for (let k = 0; k < n; k++) {
      const bh = Math.exp(-k / 3) * h * 0.8;
      c.fillRect(w * 0.1 + k * bw + u, h * 0.9 - bh, bw - 3 * u, bh);
    }
    c.fillRect(w * 0.08, h * 0.9, w * 0.84, 2 * u);
  },
  'Boltzmann weights: e^(-E/T)',
);

defineShape(
  'hopfield',
  (c, w, h, u) => {
    const n = u > 1.5 ? 11 : 8;
    const pts = [...Array(n)].map((_, k) => {
      const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
      return [w / 2 + Math.cos(a) * h * 0.4, h / 2 + Math.sin(a) * h * 0.4];
    });
    c.strokeStyle = '#fff';
    c.lineWidth = u;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { path(c, [pts[i], pts[j]]); c.stroke(); }
    c.fillStyle = '#fff';
    for (const [x, y] of pts) { c.beginPath(); c.arc(x, y, 4.5 * u, 0, Math.PI * 2); c.fill(); }
  },
  'a Hopfield net: every pair pulled',
);

defineShape(
  'sdm',
  (c, w, h, u) => {
    const r = seeded(11);
    const cx = w / 2;
    const cy = h / 2;
    const R = h * 0.3;
    c.fillStyle = '#fff';
    const n = Math.round(150 * Math.min(3, u));
    for (let k = 0; k < n; k++) {
      const x = w * 0.04 + r() * w * 0.92;
      const y = h * 0.06 + r() * h * 0.88;
      const inside = Math.hypot(x - cx, y - cy) < R;
      c.beginPath();
      c.arc(x, y, (inside ? 2.4 : 0.9) * u, 0, Math.PI * 2);
      c.fill();
    }
    c.strokeStyle = '#fff';
    c.lineWidth = 1.5 * u;
    c.beginPath();
    c.arc(cx, cy, R, 0, Math.PI * 2);
    c.stroke();
    c.beginPath();
    c.arc(cx, cy, 4 * u, 0, Math.PI * 2);
    c.fill();
  },
  'sparse distributed memory: the hard locations a cue wakes',
);

defineShape(
  'hypercube',
  (c, w, h, u) => {
    const P = [];
    for (let i = 0; i < 16; i++) P.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    const a = 0.6;
    const b = 0.45;
    const Q = P.map(([x, y, z, v]) => {
      const x1 = x * Math.cos(a) - v * Math.sin(a);
      const v1 = x * Math.sin(a) + v * Math.cos(a);
      const y1 = y * Math.cos(b) - z * Math.sin(b);
      const z1 = y * Math.sin(b) + z * Math.cos(b);
      const k = 1 / (3 - v1);
      const k2 = 1 / (3.2 - z1 * k * 1.6);
      return [w / 2 + x1 * k * k2 * h * 1.35, h / 2 + y1 * k * k2 * h * 1.35];
    });
    c.strokeStyle = '#fff';
    c.lineWidth = 2 * u;
    for (let i = 0; i < 16; i++) for (let d = 0; d < 4; d++) { const j = i ^ (1 << d); if (j > i) { path(c, [Q[i], Q[j]]); c.stroke(); } }
    c.fillStyle = '#fff';
    for (const [x, y] of Q) { c.beginPath(); c.arc(x, y, 2.5 * u, 0, Math.PI * 2); c.fill(); }
  },
  'the address space: every corner an address',
);

// ── plain ──────────────────────────────────────────────────────────────────────────────────────────────────────

const R = (w, h) => Math.min(w, h) * 0.42;

family = 'plain';
defineShape('circle', (c, w, h) => { c.fillStyle = '#fff'; c.beginPath(); c.arc(w / 2, h / 2, R(w, h), 0, Math.PI * 2); c.fill(); }, 'a disc');

defineShape('ring', (c, w, h, u) => {
  c.strokeStyle = '#fff';
  c.lineWidth = Math.max(2 * u, R(w, h) * 0.22);
  c.beginPath();
  c.arc(w / 2, h / 2, R(w, h) * 0.85, 0, Math.PI * 2);
  c.stroke();
}, 'a ring');

defineShape('heart', (c, w, h) => {
  const s = R(w, h) / 17;
  c.fillStyle = '#fff';
  path(c, [...Array(200)].map((_, k) => {
    const t = (k / 200) * Math.PI * 2;
    const x = 16 * Math.sin(t) ** 3;
    const y = 13 * Math.cos(t) - 5 * Math.cos(2 * t) - 2 * Math.cos(3 * t) - Math.cos(4 * t);
    return [w / 2 + x * s, h / 2 - y * s - s];
  }), true);
  c.fill();
}, 'a heart');

defineShape('star', (c, w, h) => {
  const r = R(w, h);
  c.fillStyle = '#fff';
  path(c, [...Array(10)].map((_, k) => {
    const a = -Math.PI / 2 + (k * Math.PI) / 5;
    const rr = k % 2 ? r * 0.42 : r;
    return [w / 2 + Math.cos(a) * rr, h / 2 + Math.sin(a) * rr + r * 0.08];
  }), true);
  c.fill();
}, 'a five-pointed star');

defineShape('spiral', (c, w, h, u) => {
  const r = R(w, h);
  c.strokeStyle = '#fff';
  c.lineWidth = Math.max(2 * u, r * 0.09);
  c.lineCap = 'round';
  path(c, [...Array(400)].map((_, k) => {
    const t = (k / 400) * Math.PI * 6;
    const rr = (r * t) / (Math.PI * 6);
    return [w / 2 + Math.cos(t) * rr, h / 2 + Math.sin(t) * rr];
  }));
  c.stroke();
}, 'a spiral');

defineShape('wave', (c, w, h, u) => {
  c.strokeStyle = '#fff';
  c.lineWidth = Math.max(3 * u, h * 0.1);
  c.lineCap = 'round';
  path(c, [...Array(200)].map((_, k) => [w * 0.06 + (k / 199) * w * 0.88, h / 2 + Math.sin((k / 199) * Math.PI * 4) * h * 0.28]));
  c.stroke();
}, 'a wave');

defineShape('cross', (c, w, h) => {
  const r = R(w, h);
  const t = r * 0.34;
  c.fillStyle = '#fff';
  c.fillRect(w / 2 - t / 2, h / 2 - r, t, 2 * r);
  c.fillRect(w / 2 - r, h / 2 - t / 2, 2 * r, t);
}, 'a plus');

defineShape('diamond', (c, w, h) => {
  const r = R(w, h);
  c.fillStyle = '#fff';
  path(c, [[w / 2, h / 2 - r], [w / 2 + r * 0.8, h / 2], [w / 2, h / 2 + r], [w / 2 - r * 0.8, h / 2]], true);
  c.fill();
}, 'a diamond');

defineShape('moon', (c, w, h) => {
  const r = R(w, h);
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(w / 2, h / 2, r, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(w / 2 + r * 0.45, h / 2 - r * 0.2, r * 0.85, 0, Math.PI * 2);
  c.fill();
}, 'a crescent moon');

defineShape('eye', (c, w, h, u) => {
  const r = R(w, h);
  c.fillStyle = '#fff';
  c.beginPath();
  c.moveTo(w / 2 - r * 1.3, h / 2);
  c.quadraticCurveTo(w / 2, h / 2 - r * 1.25, w / 2 + r * 1.3, h / 2);
  c.quadraticCurveTo(w / 2, h / 2 + r * 1.25, w / 2 - r * 1.3, h / 2);
  c.fill();
  c.fillStyle = '#000';
  c.beginPath();
  c.arc(w / 2, h / 2, r * 0.42, 0, Math.PI * 2);
  c.fill();
  c.fillStyle = '#fff';
  c.beginPath();
  c.arc(w / 2, h / 2, r * 0.18, 0, Math.PI * 2);
  c.fill();
}, 'an eye');


// ── the eight ball ─────────────────────────────────────────────────────────────────────────────────────────────

export function wrapLines(c, text, width, max = 3) {
  const words = String(text).split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const wd of words) {
    const next = cur ? `${cur} ${wd}` : wd;
    if (cur && c.measureText(next).width > width && lines.length < max - 1) {
      lines.push(cur);
      cur = wd;
    } else cur = next;
  }
  if (cur) lines.push(cur);
  return lines;
}

defineShape('eightball', (c, w, h, u, spec = {}) => {
  const r = Math.min(w, h) * 0.46;
  const cx = w / 2;
  const cy = h / 2;
  c.strokeStyle = '#fff';
  c.fillStyle = '#fff';
  c.lineWidth = Math.max(2 * u, r * 0.06);
  c.beginPath();
  c.arc(cx, cy, r, 0, Math.PI * 2);
  c.stroke();
  // the shine, top left
  c.lineWidth = Math.max(1.5 * u, r * 0.035);
  c.beginPath();
  c.arc(cx, cy, r * 0.82, Math.PI * 1.08, Math.PI * 1.38);
  c.stroke();
  const wr = r * (spec.text ? 0.68 : 0.6);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  if (spec.text) {
    // the window: a ring, and the die's triangle (point down) with the answer in lit letters
    c.lineWidth = Math.max(1.5 * u, r * 0.035);
    c.beginPath();
    c.arc(cx, cy, wr, 0, Math.PI * 2);
    c.stroke();
    const top = cy - wr * 0.62;
    const bottom = cy + wr * 0.86;
    path(c, [[cx - wr * 0.86, top], [cx + wr * 0.86, top], [cx, bottom]], true);
    c.stroke();
    // the widest a line may be at height y: the triangle's width there, less a margin
    const room = (y) => 2 * wr * 0.86 * ((bottom - y) / (bottom - top)) * 0.9;
    let size = Math.round(wr * 0.3);
    let lines;
    let ys;
    for (;;) {
      c.font = `700 ${size}px sans-serif`;
      const lh = size * 1.12;
      lines = wrapLines(c, spec.text, room(top + wr * 0.25), 3);
      ys = lines.map((_, k) => top + wr * 0.22 + k * lh);
      const fits = lines.every((l, k) => c.measureText(l).width <= room(ys[k] + size * 0.5));
      if (fits || size <= 6) break;
      size--;
    }
    lines.forEach((l, k) => c.fillText(l, cx, ys[k]));
  } else {
    // the cue face: a lit disc with a dark 8
    c.beginPath();
    c.arc(cx, cy, wr * 0.82, 0, Math.PI * 2);
    c.fill();
    c.fillStyle = '#000';
    c.font = `800 ${Math.round(wr * 1.25)}px sans-serif`;
    c.fillText('8', cx, cy + wr * 0.06);
  }
}, 'a magic eight ball');

export const SHAPES = Object.fromEntries(registry);
