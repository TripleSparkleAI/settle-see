// settle-see · brainshapes - two layers of the brain, painted without a canvas: the cerebral cortex in its six layers
// and the cerebellar cortex with its Purkinje cells, seen from three angles. Built for settle-site's footer hero.
//
// <claudes_code_comments>
// ** Function List **
// CORTEX_LAYERS            - the six layers of the cerebral cortex, top (the surface) to bottom, with their depth shares
// CEREBELLUM_LAYERS        - the three layers of the cerebellar cortex: molecular, Purkinje cell, granular
// BRAIN_VIEWS              - the footer's cycle of views: the side section, looking up from below, two voyages
// brainScene(w, h, spec)   - { bits, paths, labels, rects } for a w x h grid; spec { view, eye, bands, split } (cached)
// BAND_SPLIT               - 0.5: where the gap between the two bands is centred unless spec.split moves it
// rideScene(w, h, spec)    - the voyage seen from a steered camera { x, y, z, yaw, pitch } (RIDE_START, clampRide);
//                            the tissue repeats along z both ways and stacks UPWARD without end (rideTiers), with a sparse far
//                            field beyond RIDE_FAR (farField) when spec.far is not false
// Raster                   - a +1 / -1 grid with a clip box: dot, line (optionally recording the cells it passes),
//                            trace (record without drawing), tri, ell
// penSection / penBelow / penDepth - the three cameras: world (x across, y down a band, both in band heights) to grid
// camView / penCam         - the ride's steered fly-cam: project, cull a box against the view, clip a segment at the eye
// rideFibres(...)          - the ride's long fibres, ahead and behind, clipped at the near plane
// cortexColumn(...)        - one minicolumn of the cerebral cortex: granules, stellates, two pyramids, fusiform cells
// pyramid(...)             - a pyramidal neuron: triangle body, apical dendrite to layer I, tuft, obliques, basal
//                            dendrites, axon (the apical and the axon are recorded as spike paths)
// purkinjeUnit(...)        - one Purkinje cell (flask body, primary dendrite, a planar fan of branches, axon) with the
//                            granule cells, a Golgi cell, a basket cell and an ascending granule axon around it
// registered shapes        - cortex6 (the cortex band alone), cerebellum (the cerebellar band alone), brainbands (both)
//
// ** Technical Review **
// - Every shape is painted in plain JavaScript on an Int8Array (no canvas), so it settles the same in node (the tests)
//   and in a browser, at any size. Sizes are in BAND HEIGHTS: a band B lights tall draws a dendrite 0.0078 B wide, and
//   a line is never drawn thinner than 1.6 lights, since a lit light whose four neighbours are dark goes dark at lean
//   0.9 and pull 0.3 (input 0.9 - 1.2 < 0).
// - Exactly two bands in 'brainbands': the cerebral cortex in the upper area and the cerebellar cortex in the lower,
//   each framed by a solid line top and bottom, with a dark gap between. The six cortical layers are I molecular, II
//   external granular, III external pyramidal, IV internal granular, V internal pyramidal, VI multiform; the shares
//   (CORTEX_LAYERS.f) are a schematic of a typical neocortex, not a measurement of any one area.
// - Views: 'section' is a flat side section; 'below' looks up from the white matter, so higher things are further
//   away and shrink toward the band's top edge (a perspective in which straight lines stay straight); 'voyage' rides
//   horizontally through the tissue at depth `eye` (a fraction of the band), with neurons standing in rows on both
//   sides at depths 0.55 x 1.45^j (cortex) and Purkinje fans face-on ahead (cerebellum: we ride a parallel fibre, and
//   the fans are perpendicular to it), receding toward a vanishing point like the repeated lights of a mirror room.
// - paths: polylines of grid indices along wires (axons going down, apical dendrites going up, parallel fibres across,
//   ascending granule axons, and in a voyage the fibres running toward the viewer), in the direction a spike travels.
//   settle-site's footer lights a few cells moving along them each frame ("firing" along "wiring").
// - labels: { band, key, text, y } with y a fraction of the grid height, placed from the geometry actually drawn.
// - The same seed gives the same scene; brainScene caches the last 12 scenes by size and spec.
// </claudes_code_comments>

import { seeded } from './paint.js';
import { defineBits } from './shapes.js';

export const CORTEX_LAYERS = [
  { key: 'I', name: 'molecular', f: 0.1 },
  { key: 'II', name: 'external granular', f: 0.1 },
  { key: 'III', name: 'external pyramidal', f: 0.22 },
  { key: 'IV', name: 'internal granular', f: 0.1 },
  { key: 'V', name: 'internal pyramidal', f: 0.25 },
  { key: 'VI', name: 'multiform', f: 0.23 },
];
export const CEREBELLUM_LAYERS = [
  { key: 'ML', name: 'molecular layer', f: 0.5 },
  { key: 'PCL', name: 'Purkinje cell layer', f: 0.08 },
  { key: 'GL', name: 'granular layer', f: 0.42 },
];
export const BRAIN_VIEWS = [
  { view: 'section', eye: 0.5, name: 'the side section', note: 'both cortices cut from the side: six layers above, the Purkinje cells below' },
  { view: 'below', eye: 0.5, name: 'looking up from below', note: 'from the white matter, up through layer VI to layer I, and up into the Purkinje fans' },
  { view: 'voyage', eye: 0.16, name: 'the voyage, at layer II', note: 'riding through layer II and along a parallel fibre, through fan after fan' },
  { view: 'voyage', eye: 0.72, name: 'the voyage, at layer V', note: 'down at layer V among the big pyramids, and further along the fibre' },
];

const bounds = (layers) => layers.reduce((a, l) => [...a, a[a.length - 1] + l.f], [0]);
const CB = bounds(CORTEX_LAYERS); // 0, .1, .2, .42, .52, .77, 1
const KB = bounds(CEREBELLUM_LAYERS); // 0, .5, .58, 1

// widths and sizes, in band heights
const WD = { dend: 0.0078, apical: 0.009, fine: 0.0062, axon: 0.0068, frame: 0.009 };
const COL = 0.115; // the cortical minicolumn spacing
const PSEC = 0.2; // the Purkinje cell spacing in a section

export class Raster {
  constructor(w, h) {
    this.w = w;
    this.h = h;
    this.t = new Int8Array(w * h).fill(-1);
    this.clip(0, 0, w - 1, h - 1);
  }
  clip(x0, y0, x1, y1) {
    this.cx0 = Math.max(0, Math.floor(x0));
    this.cy0 = Math.max(0, Math.floor(y0));
    this.cx1 = Math.min(this.w - 1, Math.ceil(x1));
    this.cy1 = Math.min(this.h - 1, Math.ceil(y1));
  }
  dot(x, y, r) {
    r = Math.max(0.8, r);
    const a = Math.max(this.cx0, Math.floor(x - r));
    const b = Math.min(this.cx1, Math.ceil(x + r));
    const c = Math.max(this.cy0, Math.floor(y - r));
    const d = Math.min(this.cy1, Math.ceil(y + r));
    const r2 = r * r + 0.01;
    for (let j = c; j <= d; j++) {
      const dy = j - y;
      for (let i = a; i <= b; i++) if ((i - x) ** 2 + dy * dy <= r2) this.t[j * this.w + i] = 1;
    }
  }
  // a line of width w0 at its start and w1 at its end; out (an array) records the cells under its centre, in order
  line(x0, y0, x1, y1, w0, w1 = w0, out = null, draw = true) {
    if (![x0, y0, x1, y1].every(Number.isFinite)) return;
    const len = Math.hypot(x1 - x0, y1 - y0);
    if (len > 4 * (this.w + this.h)) return;
    const n = Math.max(1, Math.ceil(len / 0.6));
    let last = -1;
    for (let k = 0; k <= n; k++) {
      const u = k / n;
      const x = x0 + (x1 - x0) * u;
      const y = y0 + (y1 - y0) * u;
      if (draw) this.dot(x, y, Math.max(1.6, w0 + (w1 - w0) * u) / 2);
      if (out) {
        const xi = Math.round(x);
        const yi = Math.round(y);
        if (xi >= this.cx0 && xi <= this.cx1 && yi >= this.cy0 && yi <= this.cy1) {
          const id = yi * this.w + xi;
          if (id !== last) out.push(id);
          last = id;
        }
      }
    }
  }
  trace(x0, y0, x1, y1, out) {
    this.line(x0, y0, x1, y1, 0, 0, out, false);
  }
  // a filled triangle, apex up: apex (x, y - s), base at y + 0.45 s, half-width 0.62 s
  tri(x, y, s) {
    s = Math.max(1.6, s);
    const top = y - s;
    const bot = y + 0.45 * s;
    for (let j = Math.max(this.cy0, Math.floor(top)); j <= Math.min(this.cy1, Math.ceil(bot)); j++) {
      const half = Math.max(0.6, (0.62 * s * (j - top)) / (bot - top));
      for (let i = Math.max(this.cx0, Math.floor(x - half)); i <= Math.min(this.cx1, Math.ceil(x + half)); i++)
        if (Math.abs(i - x) <= half) this.t[j * this.w + i] = 1;
    }
  }
  ell(x, y, rx, ry) {
    rx = Math.max(1, rx);
    ry = Math.max(1, ry);
    for (let j = Math.max(this.cy0, Math.floor(y - ry)); j <= Math.min(this.cy1, Math.ceil(y + ry)); j++)
      for (let i = Math.max(this.cx0, Math.floor(x - rx)); i <= Math.min(this.cx1, Math.ceil(x + rx)); i++)
        if (((i - x) / rx) ** 2 + ((j - y) / ry) ** 2 <= 1.02) this.t[j * this.w + i] = 1;
  }
}

// ── the cameras: a pen maps world (x across, y down the band, both in band heights) to grid, with a local scale ──

function penSection(rc) {
  const B = rc.y1 - rc.y0;
  return { P: (x, y) => [rc.x0 + x * B, rc.y0 + y * B], S: () => B, span: [0, (rc.x1 - rc.x0) / B] };
}

// looking up: depth z grows with height, z(1) = 1 at the band's bottom and z(0) = ztop at its top; screen y is linear in
// 1/z, so the band's bottom and top land exactly on its frame and straight lines stay straight
function penBelow(rc, ztop, zoom) {
  const B = rc.y1 - rc.y0;
  const vx = (rc.x0 + rc.x1) / 2;
  const z = (y) => 1 + (ztop - 1) * (1 - y);
  const Y = (y) => rc.y1 - (B * (1 - 1 / z(y))) / (1 - 1 / ztop);
  const S = (x, y) => (B * zoom) / z(y);
  const half = ((rc.x1 - rc.x0) / 2 / (B * zoom)) * ztop;
  return { P: (x, y) => [vx + x * S(x, y), Y(y)], S, Y, span: [-half, half] };
}

// a plane at depth z facing the viewer, seen from the axis (0, eye): what a voyage passes
function penDepth(rc, eye, z) {
  const B = rc.y1 - rc.y0;
  const vx = (rc.x0 + rc.x1) / 2;
  const vy = rc.y0 + eye * B;
  const k = B / z;
  return { P: (x, y) => [vx + x * k, vy + (y - eye) * k], S: () => k, z };
}

const draw = (R, pen) => ({
  pen,
  line(x0, y0, x1, y1, wd, out = null) {
    const [a, b] = pen.P(x0, y0);
    const [c, d] = pen.P(x1, y1);
    R.line(a, b, c, d, wd * pen.S(x0, y0), wd * pen.S(x1, y1), out);
  },
  trace(x0, y0, x1, y1, out) {
    const [a, b] = pen.P(x0, y0);
    const [c, d] = pen.P(x1, y1);
    R.trace(a, b, c, d, out);
  },
  dot(x, y, r) {
    const s = r * pen.S(x, y);
    if (s < 0.5) return;
    const [a, b] = pen.P(x, y);
    R.dot(a, b, s);
  },
  tri(x, y, s) {
    const [a, b] = pen.P(x, y);
    R.tri(a, b, s * pen.S(x, y));
  },
  ell(x, y, rx, ry) {
    const [a, b] = pen.P(x, y);
    const k = pen.S(x, y);
    R.ell(a, b, rx * k, ry * k);
  },
  // how many lights one band height is here: the drawings drop fine detail when it is small
  detail(x, y) {
    return pen.S(x, y);
  },
});

const keep = (paths, kind, cells) => {
  if (paths && cells.length >= 8) paths.push({ kind, cells });
};

// ── the cerebral cortex ─────────────────────────────────────────────────────────────────────────────────────────

function pyramid(D, x, y, s, top, axonTo, r, paths, big) {
  const lights = D.detail(x, y);
  D.tri(x, y, s);
  const ax = x + (r() - 0.5) * s * 0.5;
  const ap = paths ? [] : null;
  D.line(x, y - s, ax, top, WD.apical, ap);
  if (ap) keep(paths, 'apical', ap); // recorded body to tuft: a back-propagating spike goes up
  if (lights * s > 3) {
    // oblique branches off the apical dendrite
    const n = big ? 3 : 2;
    for (let i = 0; i < n; i++) {
      const t = 0.18 + (0.6 * (i + r())) / n;
      const py = y - s + (top - (y - s)) * t;
      const px = x + (ax - x) * t;
      const d = i % 2 ? 1 : -1;
      const len = s * (1.3 + r() * 0.8);
      D.line(px, py, px + d * len * 0.9, py - len * 0.45, WD.fine);
    }
    // the tuft in layer I
    for (const d of [-1, 1]) {
      const bx = ax + d * s * (1.4 + r() * 0.6);
      const by = Math.max(0.012, top - 0.004);
      D.line(ax, top + 0.03, bx, by, WD.fine);
      D.line(bx, by, bx + d * s * 0.8, by + 0.012 + r() * 0.01, WD.fine);
      D.line(ax, top + 0.012, ax + d * s * 0.9, Math.max(0.01, top - 0.002), WD.fine);
    }
    // basal dendrites from the base corners, down and out
    for (const a of [2.55, 2.1, 1.05, 0.6]) {
      const len = s * (1.5 + r() * 0.9);
      const bx = x + Math.cos(a) * s * 0.55;
      const by = y + 0.4 * s;
      D.line(bx, by, bx + Math.cos(a) * len, by + Math.sin(a) * len * 0.8, WD.fine);
    }
  }
  const axon = paths ? [] : null;
  D.line(x, y + 0.45 * s, x + (r() - 0.5) * 0.01, axonTo, WD.axon, axon);
  if (axon) keep(paths, 'axon', axon);
}

function cortexColumn(D, xc, r, paths) {
  const lights = D.detail(xc, 0.5);
  const lay = (l, u) => CB[l] + u * (CB[l + 1] - CB[l]);
  // II: small round granule cells
  if (lights * 0.009 > 0.9)
    for (let g = 0; g < 3; g++) D.dot(xc + (r() - 0.5) * COL * 0.85, lay(1, 0.15 + 0.7 * r()), 0.0085);
  // IV: stellate cells, a body and short spokes
  for (let g = 0; g < 2; g++) {
    const sx = xc + (r() - 0.5) * COL * 0.8;
    const sy = lay(3, 0.2 + 0.6 * r());
    D.dot(sx, sy, 0.0085);
    if (lights * 0.02 > 3)
      for (let k = 0; k < 5; k++) {
        const a = r() * Math.PI * 2;
        D.line(sx, sy, sx + Math.cos(a) * 0.02, sy + Math.sin(a) * 0.02, WD.fine);
      }
  }
  // III: a small pyramid, its axon to layer IV; V: a large one, its axon out of the band
  pyramid(D, xc + COL * 0.26 + (r() - 0.5) * 0.02, lay(2, 0.45 + 0.35 * r()), 0.021, 0.02 + r() * 0.025, lay(4, 0.2), r, paths, false);
  pyramid(D, xc - COL * 0.14 + (r() - 0.5) * 0.015, lay(4, 0.38 + 0.3 * r()), r() < 0.5 ? 0.034 : 0.027, 0.014 + r() * 0.02, 0.998, r, paths, true);
  // VI: spindle-shaped cells with a process up and a process down
  for (let g = 0; g < 2; g++) {
    const fx = xc + (r() - 0.5) * COL * 0.8;
    const fy = lay(5, 0.2 + 0.6 * r());
    D.ell(fx, fy, 0.0075, 0.016);
    if (lights * 0.04 > 3) {
      D.line(fx, fy - 0.016, fx + (r() - 0.5) * 0.01, fy - 0.06, WD.fine);
      D.line(fx, fy + 0.016, fx + (r() - 0.5) * 0.01, fy + 0.045, WD.fine);
    }
  }
}

// the layer boundaries as dotted lines from world x0 to x1 (in the section and the view from below)
function dottedLevels(D, levels, x0, x1, step) {
  for (const b of levels) for (let x = x0; x <= x1; x += step) D.dot(x, b, 0.0072);
}

// ── the cerebellar cortex ───────────────────────────────────────────────────────────────────────────────────────

function purkinjeUnit(D, xc, width, r, paths, opts = {}) {
  const yP = (KB[1] + KB[2]) / 2;
  const lights = D.detail(xc, yP);
  const fine = lights > 70;
  // the flask-shaped body and the primary dendrite
  D.ell(xc, yP, 0.027, 0.032);
  const yTop = KB[1] - 0.045;
  D.line(xc, yP - 0.03, xc, yTop, 0.013);
  // the fan: a planar tree in its own slab, filling the molecular layer. It climbs in equal steps; each branch splits
  // in two while there is room (the sideways step halves each level), then climbs on with a little zigzag, giving
  // off short spiny twigs. That is how a Purkinje fan looks in a section: dense, flat, reaching the surface.
  const lo = xc - width * 0.47;
  const hi = xc + width * 0.47;
  const levels = lights > 160 ? 9 : lights > 70 ? 7 : lights > 30 ? 5 : 3;
  const twigs = lights > 60;
  const dy = (yTop - 0.022) / levels;
  const cap = Math.max(3, Math.floor((width * 0.94) / (lights > 90 ? 0.017 : 0.03)));
  let tips = [-1, 0, 1].map((k) => ({ x: xc, y: yTop, dx: k * width * 0.22 }));
  for (let lev = 0; lev < levels; lev++) {
    const next = [];
    const w = Math.max(0.006, 0.011 * 0.82 ** lev);
    for (const t of tips) {
      const kids = lev > 0 && next.length + (tips.length - tips.indexOf(t)) * 2 <= cap && r() < 0.85 ? 2 : 1;
      for (let k = 0; k < kids; k++) {
        const side = kids === 2 ? (k ? 1 : -1) : 0;
        const spread = lev === 0 ? t.dx : side * width * 0.2 * 0.62 ** lev * (0.7 + 0.6 * r()) + (r() - 0.5) * 0.012;
        const nx = Math.min(hi, Math.max(lo, t.x + spread));
        const ny = Math.max(0.016, t.y - dy * (0.8 + 0.4 * r()));
        D.line(t.x, t.y, nx, ny, w);
        if (twigs && r() < 0.7) {
          const mx = (t.x + nx) / 2;
          const my = (t.y + ny) / 2;
          const d = r() < 0.5 ? -1 : 1;
          D.line(mx, my, Math.min(hi, Math.max(lo, mx + d * dy * (0.5 + 0.4 * r()))), my - dy * 0.35, WD.fine);
        }
        next.push({ x: nx, y: ny });
      }
    }
    tips = next;
  }
  // the axon, down through the granular layer and out
  const axon = paths ? [] : null;
  D.line(xc, yP + 0.027, xc + (r() - 0.5) * 0.02, 0.998, WD.axon, axon);
  if (axon) keep(paths, 'purkinje-axon', axon);
  if (opts.bare) return;
  // around it: granule cells (dense), a Golgi cell, a basket cell, and one granule cell's axon rising to a fibre
  const gx0 = xc - width / 2;
  const n = fine ? Math.round(width * 320) : lights > 30 ? Math.round(width * 90) : 0;
  for (let g = 0; g < n; g++) D.dot(gx0 + r() * width, KB[2] + 0.03 + r() * (0.94 - KB[2]), 0.0072);
  if (lights > 30) {
    D.dot(xc + (r() - 0.5) * width * 0.6, KB[2] + 0.07, 0.016);
    const by = KB[1] - 0.04 - r() * 0.05;
    const bx = xc + (r() - 0.5) * width * 0.5;
    D.dot(bx, by, 0.009);
    D.line(bx - width * 0.16, by + 0.004, bx + width * 0.16, by + 0.004, WD.fine);
  }
  if (opts.fibres?.length && lights > 30) {
    const gx = xc + (0.2 + 0.3 * r()) * width * (r() < 0.5 ? -1 : 1);
    const gy = KB[2] + 0.2 + r() * 0.2;
    const fy = opts.fibres[Math.floor(r() * opts.fibres.length)];
    D.dot(gx, gy, 0.0085);
    const up = paths ? [] : null;
    D.line(gx, gy, gx, fy, WD.fine, up);
    D.line(gx - 0.02, fy, gx + 0.02, fy, WD.fine);
    if (up) keep(paths, 'ascending-axon', up);
  }
}

// parallel fibres: dashed lines across the molecular layer; the spike path runs their whole length
function parallelFibres(D, ys, x0, x1, r, paths) {
  for (const y of ys) {
    const on = 0.07 + r() * 0.03;
    const off = 0.025;
    let x = x0 - r() * (on + off);
    while (x < x1) {
      D.line(Math.max(x0, x), y, Math.min(x1, x + on), y, WD.fine);
      x += on + off;
    }
    const tr = paths ? [] : null;
    if (r() < 0.5) D.trace(x0, y, x1, y, tr);
    else D.trace(x1, y, x0, y, tr);
    if (tr) keep(paths, 'parallel-fibre', tr);
  }
}
const FIBRE_YS = [0.05, 0.1, 0.15, 0.2, 0.25, 0.3, 0.35, 0.4, 0.45];

// ── the scene ───────────────────────────────────────────────────────────────────────────────────────────────────

// split (spec.split, default 0.5): where the gap between the two bands is centred, as a fraction of the height. The
// footer (lane FOOTERLADDER) passes 0.38, so the cerebellar band is the larger and holds the credits text
export const BAND_SPLIT = 0.5;
const splitOf = (s) => (Number.isFinite(s) ? Math.min(0.7, Math.max(0.3, s)) : BAND_SPLIT);
function bandRects(w, h, bands, split = BAND_SPLIT) {
  if (bands === 'both') {
    const k = splitOf(split);
    return [
      { band: 'cortex', x0: 0, y0: Math.round(h * 0.035), x1: w - 1, y1: Math.round(h * (k - 0.03)) },
      { band: 'cerebellum', x0: 0, y0: Math.round(h * (k + 0.03)), x1: w - 1, y1: Math.round(h * 0.965) },
    ];
  }
  return [{ band: bands, x0: 0, y0: Math.round(h * 0.04), x1: w - 1, y1: Math.round(h * 0.96) }];
}

// the band's frame: solid full rows at its top and bottom edge, so the two bands are sharp
function frame(R, rc) {
  const B = rc.y1 - rc.y0;
  const t = Math.max(2, Math.round(WD.frame * B));
  for (const y of [rc.y0, rc.y1])
    for (let j = Math.max(0, y - (t >> 1)); j < Math.min(R.h, y - (t >> 1) + t); j++) R.t.fill(1, j * R.w + rc.x0, j * R.w + rc.x1 + 1);
}

function labelsFor(rc, h, layers, levels, Y) {
  return layers.map((l, i) => ({ band: rc.band, key: l.key, text: l.name, y: Y((levels[i] + levels[i + 1]) / 2) / h }));
}

function drawCortex(R, rc, view, eye, seed, paths, labels, h) {
  const B = rc.y1 - rc.y0;
  const r = seeded(seed);
  R.clip(rc.x0, rc.y0 + 1, rc.x1, rc.y1 - 1);
  const inner = CB.slice(1, -1);
  if (view === 'section' || view === 'below') {
    const pen = view === 'section' ? penSection(rc) : penBelow(rc, 1.7, 1.35);
    const D = draw(R, pen);
    const [a, b] = pen.span;
    dottedLevels(D, inner, a, b, 0.036);
    // two tangential fibres in layer I
    for (const y of [0.035, 0.07]) {
      const tr = [];
      D.line(a, y, b, y, WD.fine * 0.9);
      if (r() < 0.5) D.trace(a, y, b, y, tr);
      else D.trace(b, y, a, y, tr);
      keep(paths, 'tangential-fibre', tr);
    }
    for (let x = a + COL * 0.5; x < b; x += COL) cortexColumn(D, x + (r() - 0.5) * 0.02, r, paths);
    labels.push(...labelsFor(rc, h, CORTEX_LAYERS, CB, (y) => pen.P(0, y)[1]));
    return;
  }
  // the voyage: rows of columns standing on both sides, receding toward the vanishing point
  const XW = 0.62;
  const zs = [...Array(9)].map((_, j) => 0.5 * 1.42 ** j).reverse();
  for (const z of zs) {
    const D = draw(R, penDepth(rc, eye, z));
    for (const side of [-1, 1]) for (let m = 0; m < 8; m++) cortexColumn(D, side * (XW + (m + 0.5) * COL), r, z < 2.2 ? paths : null);
  }
  // the layer boundaries along both walls, dotted, receding
  const vx = (rc.x0 + rc.x1) / 2;
  for (const b of inner)
    for (const side of [-1, 1])
      for (let z = 0.45; z < 9; z *= 1.07) {
        const p = penDepth(rc, eye, z).P(side * XW, b);
        R.dot(p[0], p[1], Math.max(0.8, (0.0072 * B) / z));
      }
  // fibres running toward the viewer, near the axis: what we ride along
  for (let i = 0; i < 6; i++) {
    const fx = (r() - 0.5) * 0.7;
    const fy = eye + (r() - 0.5) * 0.18;
    const far = penDepth(rc, eye, 12).P(fx, fy);
    const near = penDepth(rc, eye, 0.42).P(fx, fy);
    const tr = [];
    R.line(far[0], far[1], near[0], near[1], 1.6, Math.max(1.6, WD.fine * B * 2.4), tr);
    keep(paths, 'axon-ahead', tr);
  }
  // the labels sit on the left wall where it passes a sixth of the way across
  const zL = (XW * B) / Math.max(1, vx - rc.x0 - (rc.x1 - rc.x0) * 0.16);
  const pen = penDepth(rc, eye, zL);
  for (const l of labelsFor(rc, h, CORTEX_LAYERS, CB, (y) => pen.P(0, y)[1])) if (l.y * h > rc.y0 + 4 && l.y * h < rc.y1 - 4) labels.push(l);
}

function drawCerebellum(R, rc, view, eye, seed, paths, labels, h) {
  const B = rc.y1 - rc.y0;
  const r = seeded(seed);
  R.clip(rc.x0, rc.y0 + 1, rc.x1, rc.y1 - 1);
  if (view === 'section' || view === 'below') {
    const pen = view === 'section' ? penSection(rc) : penBelow(rc, 1.6, 1.5);
    const D = draw(R, pen);
    const [a, b] = pen.span;
    parallelFibres(D, FIBRE_YS, a, b, r, paths);
    for (let x = a + PSEC * 0.5; x < b + PSEC; x += PSEC) purkinjeUnit(D, x + (r() - 0.5) * 0.02, PSEC, r, paths, { fibres: FIBRE_YS });
    labels.push(...labelsFor(rc, h, CEREBELLUM_LAYERS, KB, (y) => pen.P(0, y)[1]));
    return;
  }
  // the voyage along a parallel fibre: the Purkinje fans are perpendicular to it, so they stand face-on ahead of us,
  // one behind another, with the next fans of the row beside them
  const zs = [...Array(8)].map((_, j) => 0.62 * 1.5 ** j).reverse();
  // the second voyage is further along the fibre: lower in the molecular layer, the row of fans shifted
  const later = eye > 0.5;
  const e = later ? 0.34 : 0.22;
  const shift = later ? 0.62 : 0;
  for (const z of zs) {
    const D = draw(R, penDepth(rc, e, z));
    for (const x of [-2.5, -1.25, 0, 1.25, 2.5]) purkinjeUnit(D, x + shift, 1.05, r, z < 3 ? paths : null, { bare: z > 4 });
  }
  // the parallel fibres all run toward us: lines from the vanishing point outward
  for (let i = 0; i < 10; i++) {
    const fx = (r() - 0.5) * 2.4;
    const fy = 0.03 + r() * 0.44;
    const far = penDepth(rc, e, 14).P(fx, fy);
    const near = penDepth(rc, e, 0.5).P(fx, fy);
    const tr = [];
    R.line(far[0], far[1], near[0], near[1], 1.6, Math.max(1.6, WD.fine * B * 1.6), tr);
    keep(paths, 'parallel-fibre', tr);
  }
  const vx = (rc.x0 + rc.x1) / 2;
  const zL = (1.25 * B) / Math.max(1, vx - rc.x0 - (rc.x1 - rc.x0) * 0.12);
  const pen = penDepth(rc, e, Math.max(0.62, zL));
  for (const l of labelsFor(rc, h, CEREBELLUM_LAYERS, KB, (y) => pen.P(0, y)[1])) if (l.y * h > rc.y0 + 4 && l.y * h < rc.y1 - 4) labels.push(l);
}

// ── THE RIDE: the voyage with a camera you steer ──────────────────────────────────────────────────────────────────
// cam: x across, y up/down (both in band heights, relative to the voyage's eye), z forward along the ride, yaw and
// pitch in radians. The tissue repeats along z (rows of columns every RIDE_ROW_Z, each row seeded by its index), so the
// ride goes on as far as it is steered, forward or back. No submarine is drawn: this is the view from it.
export const RIDE_START = Object.freeze({ x: 0, y: 0, z: 0, yaw: 0, pitch: 0 });
// y grows DOWN the band, so climbing is y going below zero. RIDE_LIMITS.y is the DOWN bound only (navigator,
// 2026-10-01: "give it an infinite up direction"). Above the top layer the next tier of tissue is stacked, each tier
// seeded by its index, so the climb goes on as far as it is steered. THE FLY-CAM (lane FLYCAM, 2026-10-02): the look
// turns all the way round (no yaw limit) and tilts to just short of straight up or down (pitch, so the view never flips
// over the pole); every row and tier is culled against the view, so looking back, sideways, up or down draws what is
// there and nothing from behind the eye.
export const RIDE_LIMITS = Object.freeze({ x: 0.5, y: 0.3, yaw: Infinity, pitch: Math.PI / 2 - 0.05 });
// the near plane: a point this close in front of the eye, or behind it, is not drawn
const RIDE_CLIP = 0.12;
export const RIDE_UP = Infinity;
const RIDE_ROW_Z = 0.62;
const RIDE_NEAR = 0.32;
export const RIDE_FAR = 9;
// the far field: sparse planes beyond RIDE_FAR, out to RIDE_FAR_END, a few single lights each (dim, slow, low contrast)
const RIDE_FAR_STEP = 3;
export const RIDE_FAR_END = 27;
const RIDE_FAR_DOTS = 10;
// a tier counts as LOCAL within this many band heights of the camera's line of sight: the tier it is in and the one
// just above. Every tier draws only the rows at which it is on screen at all (rideTiers' zFrom), so the band two
// tiers down costs only its far, sparse rows; far tiers also drop the fine detail (the cerebellum's bare fans)
const RIDE_LOCAL = 1.0;

// clamp a camera into the tissue: between the walls, above the floor, the pitch short of vertical; the yaw is free
export function clampRide(cam) {
  const c = (v, m) => Math.max(-m, Math.min(m, v));
  const y = Number.isFinite(cam.y) ? Math.min(cam.y, RIDE_LIMITS.y) : 0;
  const yaw = Number.isFinite(cam.yaw) ? cam.yaw : 0;
  const pitch = Number.isFinite(cam.pitch) ? c(cam.pitch, RIDE_LIMITS.pitch) : 0;
  return { x: c(cam.x, RIDE_LIMITS.x), y, z: cam.z, yaw, pitch };
}

// the tiers of tissue a camera can see, with the nearest depth at which each shows on screen. Tier k occupies world
// y in [-k, 1 - k] (tier 0 is the band itself). At depth z a world height d above or below the camera's line of
// sight lands d / z band heights from the vanishing line, and the band is at most max(eye, 1 - eye) tall on either
// side of it, so the tier is on screen from z = d / that span outward (a loose margin covers the pitch). Tiers
// farther than the ride can see are left out, and tiers below the band never arise (y is bounded below).
export function rideTiers(cam, eye = 0.16) {
  const span = Math.max(eye, 1 - eye) * 1.25;
  const line = eye + cam.y; // the camera's height in world y
  const out = [];
  const kMax = Math.max(0, Math.ceil(-cam.y)) + Math.ceil(RIDE_FAR * span) + 1;
  for (let k = 0; k <= kMax; k++) {
    const top = -k;
    const bottom = 1 - k;
    const d = line < top ? top - line : line > bottom ? line - bottom : 0;
    const zFrom = d / span;
    if (zFrom > RIDE_FAR) continue;
    out.push({ k, d, local: d <= RIDE_LOCAL, zFrom: Math.max(RIDE_NEAR, zFrom) });
  }
  return out;
}

// a pen shifted up by k band heights: tier k drawn with tier 0's drawing code
const shiftPen = (pen, k) => (k ? { P: (x, y) => pen.P(x, y - k), S: pen.S, z: pen.z } : pen);

// the steered camera for one band: C(x, y, z) is a world point in camera space [across, down, depth]; S projects it to
// the grid ([NaN, NaN] in front of the near plane or behind the eye, which every Raster call skips); sees() is false
// only when a world box lies wholly outside the view (behind the eye, nearer than `near`, or past one edge of the
// band); seg() projects a segment clipped to depth `clip`, or null when it lies wholly nearer.
function camView(rc, eye, cam) {
  const B = rc.y1 - rc.y0;
  const vx = (rc.x0 + rc.x1) / 2;
  const vy = rc.y0 + eye * B;
  const cy = Math.cos(cam.yaw);
  const sy = Math.sin(cam.yaw);
  const cp = Math.cos(cam.pitch);
  const sp = Math.sin(cam.pitch);
  const C = (x, y, z) => {
    const dx = x - cam.x;
    const dy = y - (eye + cam.y);
    const dz = z - cam.z;
    const x1 = dx * cy - dz * sy;
    const z1 = dx * sy + dz * cy;
    return [x1, dy * cp - z1 * sp, dy * sp + z1 * cp];
  };
  const S = (p) => (p[2] < RIDE_CLIP ? [NaN, NaN] : [vx + (p[0] * B) / p[2], vy + (p[1] * B) / p[2]]);
  const ax0 = (rc.x0 - vx) / B;
  const ax1 = (rc.x1 - vx) / B;
  const ay0 = (rc.y0 - vy) / B;
  const ay1 = (rc.y1 - vy) / B;
  const sees = (x0, x1, y0, y1, z, near = RIDE_CLIP) => {
    const ps = [C(x0, y0, z), C(x1, y0, z), C(x0, y1, z), C(x1, y1, z)];
    const out = (f) => ps.every((p) => f(p) < 0);
    return !(out((p) => p[2] - near) || out((p) => p[0] - ax0 * p[2]) || out((p) => ax1 * p[2] - p[0]) || out((p) => p[1] - ay0 * p[2]) || out((p) => ay1 * p[2] - p[1]));
  };
  const seg = (a, b, clip) => {
    let p = C(...a);
    let q = C(...b);
    if (p[2] < clip && q[2] < clip) return null;
    if (p[2] < clip) p = p.map((v, i) => v + ((q[i] - v) * (clip - p[2])) / (q[2] - p[2]));
    if (q[2] < clip) q = q.map((v, i) => v + ((p[i] - v) * (clip - q[2])) / (p[2] - q[2]));
    return [S(p), S(q)];
  };
  return { B, C, S, sees, seg };
}

// a pen on the plane z = zw seen by the steered camera: its scale is the point's own depth, so a turned view keeps
// near things big and far things small
function penCam(rc, eye, zw, cam, V = camView(rc, eye, cam)) {
  const P = (x, y) => V.S(V.C(x, y, zw));
  const S = (x, y) => {
    const d = V.C(x, y, zw)[2];
    return d < RIDE_CLIP ? 0 : V.B / d;
  };
  return { P, S, z: Math.max(0.2, Math.abs(zw - cam.z)) };
}

// the rows within RIDE_FAR of the camera along the ride, ahead and behind, far to near
const rowsAround = (cam, dz) => {
  const out = [];
  for (let j = Math.ceil((cam.z - RIDE_FAR) / dz); j <= Math.floor((cam.z + RIDE_FAR) / dz); j++) out.push(j);
  return out.sort((a, b) => Math.abs(b * dz - cam.z) - Math.abs(a * dz - cam.z));
};

// the fibres along the ride: each runs from RIDE_FAR ahead of the camera to RIDE_FAR behind, drawn as two halves that
// meet at the camera, each clipped at depth `clip` and widest at its near end
function rideFibres(R, V, cam, pts, reach, clip, wNear) {
  for (const [fx, fy] of pts)
    for (const dir of [1, -1]) {
      const s = V.seg([fx, fy, cam.z + dir * reach], [fx, fy, cam.z], clip);
      if (s) R.line(s[0][0], s[0][1], s[1][0], s[1][1], 1.6, wNear);
    }
}

function rideCortex(R, rc, eye, cam, seed, far = true, t = 0) {
  const B = rc.y1 - rc.y0;
  R.clip(rc.x0, rc.y0 + 1, rc.x1, rc.y1 - 1);
  const XW = 0.62;
  const XB = XW + 8 * COL + 0.1;
  const V = camView(rc, eye, cam);
  const tiers = rideTiers(cam, eye);
  for (const tier of tiers) {
    for (const j of rowsAround(cam, RIDE_ROW_Z)) {
      const z = j * RIDE_ROW_Z;
      // a row is drawn only where some of it is past RIDE_NEAR in front of the eye and inside the band's view
      if (!V.sees(-XB, XB, -tier.k - 0.05, 1.05 - tier.k, z, RIDE_NEAR)) continue;
      const r = seeded(seed + j * 7919 + tier.k * 104729);
      const D = draw(R, shiftPen(penCam(rc, eye, z, cam, V), tier.k));
      for (const side of [-1, 1]) for (let m = 0; m < 8; m++) cortexColumn(D, side * (XW + (m + 0.5) * COL), r, null);
    }
    // the layer boundaries along both walls, dotted every quarter unit of the ride
    for (const b of CB.slice(1, -1))
      for (const side of [-1, 1])
        for (let k = Math.ceil((cam.z - RIDE_FAR) / 0.25); k * 0.25 < cam.z + RIDE_FAR; k++) {
          const c = V.C(side * XW, b - tier.k, k * 0.25);
          if (c[2] < RIDE_NEAR) continue;
          const p = V.S(c);
          R.dot(p[0], p[1], Math.max(0.8, (0.0072 * B) / c[2]));
        }
  }
  if (far) farField(R, rc, eye, cam, seed, tiers, t);
  // fibres along the ride, near the axis: fixed in the tissue, so they slide past as you steer
  const r = seeded(seed + 1);
  const pts = [];
  for (let i = 0; i < 6; i++) pts.push([(r() - 0.5) * 0.7, eye + (r() - 0.5) * 0.18]);
  rideFibres(R, V, cam, pts, RIDE_FAR, RIDE_NEAR + 0.1, Math.max(1.6, WD.fine * B * 2.4));
}

function rideCerebellum(R, rc, eye, cam, seed) {
  const B = rc.y1 - rc.y0;
  R.clip(rc.x0, rc.y0 + 1, rc.x1, rc.y1 - 1);
  const e = eye > 0.5 ? 0.34 : 0.22;
  const shift = eye > 0.5 ? 0.62 : 0;
  const V = camView(rc, e, cam);
  for (const tier of rideTiers(cam, e)) {
    for (const j of rowsAround(cam, 0.9)) {
      if (!V.sees(shift - 3.3, shift + 3.3, -tier.k - 0.05, 1.05 - tier.k, j * 0.9, RIDE_NEAR)) continue;
      const pen = penCam(rc, e, j * 0.9, cam, V);
      const r = seeded(seed + j * 104729 + tier.k * 7919);
      const D = draw(R, shiftPen(pen, tier.k));
      for (const x of [-2.5, -1.25, 0, 1.25, 2.5]) purkinjeUnit(D, x + shift, 1.05, r, null, { bare: pen.z > 4 || !tier.local });
    }
  }
  const r = seeded(seed + 2);
  const pts = [];
  for (let i = 0; i < 10; i++) pts.push([(r() - 0.5) * 2.4, 0.03 + r() * 0.44]);
  rideFibres(R, V, cam, pts, 14, 0.5, Math.max(1.6, WD.fine * B * 1.6));
}

// THE FAR FIELD: beyond RIDE_FAR, planes every RIDE_FAR_STEP out to RIDE_FAR_END, each a handful of single lights
// fixed in the tissue (seeded by the plane and the tier), so they slide past slowly by parallax; on each plane one
// light at a time is swapped for another every 400 ms of `t` (a faint distant firing). Cheap: a few dozen dots, and
// a dot a light wide at that depth is as dim as the picture gets.
function farField(R, rc, eye, cam, seed, tiers, t = 0) {
  const B = rc.y1 - rc.y0;
  const m0 = Math.ceil((cam.z - RIDE_FAR_END) / RIDE_FAR_STEP);
  const m1 = Math.floor((cam.z + RIDE_FAR_END) / RIDE_FAR_STEP);
  const tick = Math.floor(t / 400);
  const V = camView(rc, eye, cam);
  for (const tier of tiers) {
    for (let m = m1; m >= m0; m--) {
      // the far planes lie beyond RIDE_FAR, ahead and behind
      if (Math.abs(m * RIDE_FAR_STEP - cam.z) < RIDE_FAR) continue;
      const r = seeded(seed + 31 + m * 7331 + tier.k * 104729);
      const pen = penCam(rc, eye, m * RIDE_FAR_STEP, cam, V);
      const fire = (tick + m) % RIDE_FAR_DOTS;
      for (let i = 0; i < RIDE_FAR_DOTS; i++) {
        let fx = (r() - 0.5) * 3.2;
        let fy = r() - tier.k;
        if (i === fire) {
          const q = seeded(seed + 97 + m * 13 + tick);
          fx = (q() - 0.5) * 3.2;
          fy = q() - tier.k;
        }
        const p = pen.P(fx, fy);
        R.dot(p[0], p[1], Math.max(0.8, (0.006 * B) / pen.z));
      }
    }
  }
}

// rideScene(w, h, { eye, cam, seed, far, t }) - the voyage at `eye` seen from camera `cam` (not cached: it moves);
// far (default true) draws the far field, t is a clock in ms for its slow distant firing
export function rideScene(w, h, spec = {}) {
  const eye = spec.eye ?? 0.16;
  const cam = clampRide({ ...RIDE_START, ...(spec.cam ?? {}) });
  const seed = spec.seed ?? 20261001;
  const R = new Raster(w, h);
  const rects = bandRects(w, h, spec.bands ?? 'both', spec.split);
  for (const rc of rects) {
    if (rc.band === 'cortex') rideCortex(R, rc, eye, cam, seed, spec.far !== false, spec.t ?? 0);
    else rideCerebellum(R, rc, eye, cam, seed + 7);
    frame(R, rc);
  }
  return { bits: R.t, rects, cam, eye };
}

const CACHE = new Map();

export function brainScene(w, h, spec = {}) {
  const view = spec.view ?? 'section';
  const eye = spec.eye ?? 0.5;
  const bands = spec.bands ?? 'both';
  const seed = spec.seed ?? 20261001;
  const split = splitOf(spec.split);
  const key = `${w}x${h}:${view}:${eye}:${bands}:${seed}:${split}`;
  if (CACHE.has(key)) return CACHE.get(key);
  const R = new Raster(w, h);
  const paths = [];
  const labels = [];
  const rects = bandRects(w, h, bands, split);
  for (const rc of rects) {
    if (rc.band === 'cortex') drawCortex(R, rc, view, eye, seed, paths, labels, h);
    else drawCerebellum(R, rc, view, eye, seed + 7, paths, labels, h);
    frame(R, rc);
  }
  const scene = { bits: R.t, paths, labels, rects, view, eye, bands };
  CACHE.set(key, scene);
  if (CACHE.size > 12) CACHE.delete(CACHE.keys().next().value);
  return scene;
}

defineBits('cortex6', (w, h, spec = {}) => brainScene(w, h, { ...spec, bands: 'cortex' }).bits, 'the cerebral cortex in six layers: I molecular to VI multiform', 'physics');
defineBits('cerebellum', (w, h, spec = {}) => brainScene(w, h, { ...spec, bands: 'cerebellum' }).bits, 'the cerebellar cortex: Purkinje fans, parallel fibres, granule cells', 'physics');
defineBits('brainbands', (w, h, spec = {}) => brainScene(w, h, { ...spec, bands: 'both' }).bits, 'two layers of the brain: the cerebral cortex above, the cerebellar cortex below', 'physics');
