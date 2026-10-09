// settle-see · credits shapes - the shapes of the people SETTLE rests on, painted without a canvas (see paint.js).
//
// <claudes_code_comments>
// ** Function List **
// NOTES / KANERVA       - re-exported from creditnames.js (the notes and Kanerva's teaching order live there, so
//                         they load without the drawings)
// CREDIT_SHAPES         - every shape in this file, by name
//
// ** Technical Review **
// - Each entry is (w, h) => Int8Array of +1 (lit) and -1 (unlit), registered with defineBits() in family 'credits',
//   so toTarget() reads them with no canvas: they settle identically in node (the tests) and in a browser.
// - Kanerva's memory: hardLocations, hammingBall, counters, vote, criticalDistance, tesseract (the binary hypercube
//   drawn as a tesseract; named tesseract because 'hypercube' is the physics family's canvas drawing).
// - The other credits' characters: isingDomains, tanhRule, boltzmannBars, metropolisHop, restoredDisc, annealValley,
//   hopfieldNet, boltzmannMachine, pbitCoin, tapField, tannerGraph, softmaxRead, markovBlanket, noisyWell, pbitChip,
//   openBook, vinyl, railsAerobics, dots, musicMachine (THE DJ's credit, lane DJCREDIT).
// - tests/shapes.test.mjs settles every one at the sizes settle-site draws it: correlation with the shape above 0.85
//   after one cool-down, and below 0.25 when the leans come from a shuffled copy.
// - Moved from settle-site's src/engine/creditshapes.js with the drawings unchanged.
// - THE LAZY SPLIT (lane LAUNCHGATES, 2026-10-09): the package index no longer imports this file; it imports
//   creditnames.js, which registers the family's names and notes and loads this file on demand. Importing this file
//   (or 'settle-see/credits') registers every drawing at once, for a caller that needs them synchronously.
// </claudes_code_comments>

import { Paint, seeded, scatter, curve } from './paint.js';
import { defineBits } from './shapes.js';
import { NOTES, KANERVA } from './creditnames.js';

export { NOTES, KANERVA };

const CREDITS = {
  // ── Kanerva's memory ──
  // Hard locations: a few thousand addresses chosen at random in a huge space. Drawn as scattered lights.
  hardLocations(w, h) {
    const p = new Paint(w, h);
    const n = Math.round(Math.max(10, Math.min(70, (w * h) / 110)));
    for (const [u, v] of scatter(n, 11)) p.disc(u, v, 0.032);
    return p.t;
  },
  // A cue and the Hamming ball of radius r it wakes: the same scatter, the locations inside the circle lit large.
  hammingBall(w, h) {
    const p = new Paint(w, h);
    const n = Math.round(Math.max(10, Math.min(70, (w * h) / 110)));
    const [cu, cv] = [0.5, 0.5];
    const R = 0.36;
    for (const [u, v] of scatter(n, 11)) {
      const dx = (u - cu) * (w - 1);
      const dy = (v - cv) * (h - 1);
      if (Math.hypot(dx, dy) < R * p.S) p.disc(u, v, 0.06);
      else p.disc(u, v, 0.02);
    }
    p.ring(cu, cv, R, 0.035);
    p.disc(cu, cv, 0.07);
    return p.t;
  },
  // Writing: every woken location adds +1 or -1 to each of its counters. One location's counters, as bars.
  counters(w, h) {
    const p = new Paint(w, h);
    const r = seeded(5);
    const n = Math.max(6, Math.min(24, Math.floor(w / 4)));
    const gap = 0.9 / n;
    p.seg(0.03, 0.5, 0.97, 0.5, 0.03);
    for (let k = 0; k < n; k++) {
      const u0 = 0.05 + k * gap + gap * 0.18;
      const u1 = u0 + gap * 0.62;
      const hgt = 0.12 + r() * 0.34;
      if (r() < 0.5) p.box(u0, 0.5 - hgt, u1, 0.5);
      else p.box(u0, 0.5, u1, 0.5 + hgt);
    }
    return p.t;
  },
  // Reading is a vote: five woken locations each say yes or no per column; the bottom row is the majority.
  vote(w, h) {
    const p = new Paint(w, h);
    const r = seeded(9);
    const cols = Math.max(5, Math.min(16, Math.floor(w / 5)));
    const rows = 5;
    const cw = 0.9 / cols;
    for (let c = 0; c < cols; c++) {
      let sum = 0;
      const u = 0.05 + (c + 0.5) * cw;
      for (let k = 0; k < rows; k++) {
        const yes = r() < 0.5;
        sum += yes ? 1 : -1;
        if (yes) p.disc(u, 0.08 + k * 0.1, 0.035);
      }
      if (sum > 0) p.box(u - cw * 0.32, 0.74, u + cw * 0.32, 0.93);
    }
    p.seg(0.04, 0.62, 0.96, 0.62, 0.03);
    return p.t;
  },
  // Kanerva's convergence picture: new distance to the stored word against old distance. Below the diagonal a
  // read moves closer and iterating converges; past the critical distance it moves away.
  criticalDistance(w, h) {
    const p = new Paint(w, h);
    const [u0, v0, u1, v1] = [0.08, 0.08, 0.92, 0.92];
    p.seg(u0, v0, u0, v1, 0.04);
    p.seg(u0, v1, u1, v1, 0.04);
    p.poly([[u0, v1], [u1, v0]], 0.03);
    const f = (x) => 0.5 / (1 + Math.exp(-(x - 0.45) * 11)) + 0.02 * x;
    p.poly(curve(f, u0, v0, u1, v1), 0.05);
    // the crossing: f(x) = x near x = 0.44 * ... found numerically
    let xc = 0.3;
    for (let k = 0; k < 200; k++) {
      const x = 0.2 + k * 0.003;
      if (f(x) <= x) {
        xc = x;
        break;
      }
    }
    p.disc(u0 + xc * (u1 - u0), v1 - xc * (v1 - v0), 0.07);
    return p.t;
  },
  // The address space is a binary hypercube: every corner an address, every edge one bit flipped. A tesseract.
  tesseract(w, h) {
    const p = new Paint(w, h);
    const P = [];
    for (let i = 0; i < 16; i++) P.push([i & 1 ? 1 : -1, i & 2 ? 1 : -1, i & 4 ? 1 : -1, i & 8 ? 1 : -1]);
    const a = 0.6;
    const b = 0.45;
    const Q = P.map(([x, y, z, q]) => {
      const x1 = x * Math.cos(a) - q * Math.sin(a);
      const u1 = x * Math.sin(a) + q * Math.cos(a);
      const y1 = y * Math.cos(b) - z * Math.sin(b);
      const z1 = y * Math.sin(b) + z * Math.cos(b);
      const k = 1 / (3 - u1);
      const k2 = 1 / (3.2 - z1 * k * 1.6);
      return p.sq(x1 * k * k2 * 3.5, y1 * k * k2 * 3.5);
    });
    for (let i = 0; i < 16; i++) {
      for (let d = 0; d < 4; d++) {
        const j = i ^ (1 << d);
        if (j > i) p.seg(Q[i][0], Q[i][1], Q[j][0], Q[j][1], 0.03);
      }
    }
    for (const [u, v] of Q) p.disc(u, v, 0.04);
    return p.t;
  },

  // ── the other credits' characters ──
  // Ising and Lenz: two domains of aligned spins meeting at a wall.
  isingDomains(w, h) {
    const p = new Paint(w, h);
    const cell = Math.max(3, Math.round(p.S / 7));
    for (let y = 0; y + cell <= h; y += cell) {
      const wall = w * (0.5 + 0.12 * Math.sin((y / h) * Math.PI * 2));
      for (let x = 0; x + cell <= w; x += cell) {
        if (x + cell / 2 > wall) continue;
        p.each(x, y, x + cell - 2, y + cell - 2, () => true);
      }
    }
    return p.t;
  },
  // Glauber: the single-flip rule itself, P(yes) = (1 + tanh I) / 2, with its axes.
  tanhRule(w, h) {
    const p = new Paint(w, h);
    p.seg(0.06, 0.5, 0.94, 0.5, 0.025);
    p.seg(0.5, 0.06, 0.5, 0.94, 0.025);
    p.poly(curve((x) => (1 + Math.tanh((x - 0.5) * 7)) / 2, 0.08, 0.1, 0.92, 0.9), 0.07);
    return p.t;
  },
  // Boltzmann and Gibbs: the weights e^(-E/T) falling over the energy levels.
  boltzmannBars(w, h) {
    const p = new Paint(w, h);
    const n = Math.max(5, Math.min(12, Math.floor(w / 5)));
    const bw = 0.86 / n;
    for (let k = 0; k < n; k++) {
      const hgt = Math.exp(-k / 2.6) * 0.8;
      p.box(0.07 + k * bw + bw * 0.12, 0.9 - hgt, 0.07 + (k + 0.88) * bw, 0.9);
    }
    p.seg(0.05, 0.93, 0.95, 0.93, 0.03);
    return p.t;
  },
  // Metropolis: an energy landscape with two valleys and a proposed hop over the barrier.
  metropolisHop(w, h) {
    const p = new Paint(w, h);
    const E = (x) => 0.25 + 0.55 * (1 - (((x - 0.5) * 2.4) ** 2 - 1) ** 2 * 0.9) + 0.1 * (x - 0.5);
    const pts = curve((x) => 1 - E(x) * 0.9, 0.05, 0.3, 0.95, 0.95);
    p.poly(pts, 0.05);
    const arc = [...Array(21)].map((_, k) => {
      const t = k / 20;
      return [0.3 + t * 0.42, 0.42 - Math.sin(t * Math.PI) * 0.3];
    });
    for (let k = 0; k < arc.length; k += 2) p.disc(arc[k][0], arc[k][1], 0.03);
    p.disc(0.3, 0.52, 0.08);
    return p.t;
  },
  // Geman and Geman: a picture restored: the left half of a disc is noise, the right half is clean.
  restoredDisc(w, h) {
    const p = new Paint(w, h);
    p.disc(0.5, 0.5, 0.4);
    const r = seeded(21);
    const cx = p.X(0.5);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        if (x < cx - 0.5 && r() < 0.35) {
          const i = y * w + x;
          // noise on the left, in 2 x 2 blocks so every speck survives the pull
          p.t[i] = r() < 0.5 ? 1 : -1;
          if (x + 1 < w && x + 1 < cx) p.t[i + 1] = p.t[i];
          if (y + 1 < h) p.t[i + w] = p.t[i];
        }
      }
    }
    p.seg(0.5, 0.04, 0.5, 0.96, 0.02);
    return p.t;
  },
  // Kirkpatrick, Gelatt and Vecchi: a rugged landscape, and the ball in the deepest valley that slow cooling finds.
  annealValley(w, h) {
    const p = new Paint(w, h);
    const E = (x) => 0.5 + 0.18 * Math.sin(x * 19) + 0.12 * Math.sin(x * 7 + 1) - 0.3 * Math.exp(-(((x - 0.63) / 0.07) ** 2));
    p.poly(curve((x) => 1 - E(x), 0.04, 0.12, 0.96, 0.92), 0.05);
    let best = 0;
    let bx = 0;
    for (let k = 0; k <= 200; k++) {
      const x = k / 200;
      const y = 1 - E(x);
      if (y > best) {
        best = y;
        bx = x;
      }
    }
    p.disc(0.04 + bx * 0.92, 0.92 - best * 0.8 - 0.1, 0.08);
    return p.t;
  },
  // Hopfield: six units, every unit pulled by every other.
  hopfieldNet(w, h) {
    const p = new Paint(w, h);
    const n = 6;
    const pts = [...Array(n)].map((_, k) => {
      const a = -Math.PI / 2 + (k / n) * Math.PI * 2;
      return p.sq(Math.cos(a) * 0.9, Math.sin(a) * 0.9);
    });
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) p.seg(pts[i][0], pts[i][1], pts[j][0], pts[j][1], 0.012);
    for (const [u, v] of pts) p.disc(u, v, 0.085);
    return p.t;
  },
  // Ackley, Hinton and Sejnowski: a Boltzmann machine, visible units below, hidden units above, every pair joined.
  boltzmannMachine(w, h) {
    const p = new Paint(w, h);
    const vis = [0.12, 0.31, 0.5, 0.69, 0.88].map((u) => [u, 0.82]);
    const hid = [0.25, 0.5, 0.75].map((u) => [u, 0.18]);
    for (const a of vis) for (const b of hid) p.seg(a[0], a[1], b[0], b[1], 0.02);
    for (const [u, v] of vis) p.disc(u, v, 0.08);
    for (const [u, v] of hid) p.ring(u, v, 0.08, 0.05);
    return p.t;
  },
  // Datta and Camsari: a p-bit, a coin with a lean: a ring with an arrow tilted toward yes.
  pbitCoin(w, h) {
    const p = new Paint(w, h);
    const [cu, cv] = p.sq(0, 0);
    p.ring(cu, cv, 0.42, 0.06);
    const [au, av] = p.sq(-0.35, 0.5);
    const [bu, bv] = p.sq(0.3, -0.55);
    p.seg(au, av, bu, bv, 0.08);
    const [l1u, l1v] = p.sq(0.02, -0.55);
    const [l2u, l2v] = p.sq(0.38, -0.25);
    p.seg(bu, bv, l1u, l1v, 0.07);
    p.seg(bu, bv, l2u, l2v, 0.07);
    return p.t;
  },
  // Thouless, Anderson and Palmer: mean-field leans, each light's size its average, falling across the grid.
  tapField(w, h) {
    const p = new Paint(w, h);
    const cols = Math.max(4, Math.min(9, Math.floor(w / 6)));
    const rows = Math.max(3, Math.min(5, Math.floor(h / 6)));
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        const m = 1 - (i + j * 0.5) / (cols + rows * 0.5);
        p.disc((i + 0.5) / cols, (j + 0.5) / rows, 0.025 + m * 0.075);
      }
    }
    return p.t;
  },
  // Gallager and Pearl: a Tanner graph, parity checks above, bits below, a few joins each, messages passing.
  tannerGraph(w, h) {
    const p = new Paint(w, h);
    const bits = [0.08, 0.22, 0.36, 0.5, 0.64, 0.78, 0.92];
    const checks = [0.2, 0.5, 0.8];
    const joins = [[0, 0], [1, 0], [3, 0], [4, 0], [1, 1], [2, 1], [4, 1], [5, 1], [3, 2], [5, 2], [6, 2], [0, 2]];
    for (const [b, c] of joins) p.seg(bits[b], 0.8, checks[c], 0.2, 0.02);
    for (const u of bits) p.disc(u, 0.8, 0.075);
    for (const u of checks) p.box(u - 0.05, 0.1, u + 0.05, 0.3);
    return p.t;
  },
  // Bricken and Pehlevan: a softened read is a softmax over stored patterns, peaked on the nearest one.
  softmaxRead(w, h) {
    const p = new Paint(w, h);
    const n = Math.max(7, Math.min(15, Math.floor(w / 4)));
    const bw = 0.86 / n;
    for (let k = 0; k < n; k++) {
      const d = (k - (n - 1) / 2) / n;
      const hgt = Math.exp(-(d * d) / 0.012) * 0.7 + 0.05;
      p.box(0.07 + k * bw + bw * 0.15, 0.88 - hgt, 0.07 + (k + 0.85) * bw, 0.88);
    }
    p.ring(0.5, 0.22, 0.13, 0.04);
    return p.t;
  },
  // Friston: a Markov blanket: the inside, the blanket of sensing and acting states, the world outside.
  markovBlanket(w, h) {
    const p = new Paint(w, h);
    const [cu, cv] = p.sq(0, 0);
    p.disc(cu, cv, 0.16);
    const n = 10;
    for (let k = 0; k < n; k++) {
      const a = (k / n) * Math.PI * 2;
      const [u, v] = p.sq(Math.cos(a) * 0.62, Math.sin(a) * 0.62);
      p.disc(u, v, 0.05);
    }
    const r = seeded(3);
    for (let k = 0; k < 16; k++) {
      const u = r();
      const v = r();
      const [x, y] = [(u - 0.5) * (w - 1), (v - 0.5) * (h - 1)];
      if (Math.hypot(x, y) > p.S * 0.46) p.disc(u, v, 0.035);
    }
    return p.t;
  },
  // Normal Computing: noise as a resource: a jittering path in a smooth well.
  noisyWell(w, h) {
    const p = new Paint(w, h);
    p.poly(curve((x) => 1 - 4 * (x - 0.5) ** 2 * 0.95, 0.05, 0.12, 0.95, 0.92), 0.04);
    const r = seeded(13);
    const pts = [];
    let x = 0.2;
    for (let k = 0; k < 26; k++) {
      x = Math.max(0.12, Math.min(0.88, x + (0.5 - x) * 0.18 + (r() - 0.5) * 0.14));
      const f = 1 - 4 * (x - 0.5) ** 2 * 0.95;
      pts.push([0.05 + x * 0.9, 0.92 - f * 0.8 - 0.12 - r() * 0.1]);
    }
    p.poly(pts, 0.035);
    return p.t;
  },
  // Extropic: a chip of p-bits: a die with pins, a grid of cells inside.
  pbitChip(w, h) {
    const p = new Paint(w, h);
    const [a, b] = p.sq(-0.62, -0.62);
    const [c, d] = p.sq(0.62, 0.62);
    p.poly([[a, b], [c, b], [c, d], [a, d], [a, b]], 0.045);
    for (let k = 0; k < 4; k++) {
      const t = (k + 0.5) / 4;
      const [pu, pv] = p.sq(-0.62 + t * 1.24, -0.62);
      const [qu] = p.sq(-0.62 + t * 1.24, 0.62);
      p.seg(pu, pv, pu, pv - 0.1, 0.04);
      p.seg(qu, d, qu, d + 0.1, 0.04);
    }
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < 3; j++) {
        const [u, v] = p.sq(-0.36 + i * 0.36, -0.36 + j * 0.36);
        if ((i + j) % 2 === 0) p.disc(u, v, 0.07);
      }
    }
    return p.t;
  },
  // Whitehead: an open book with its lines of prose.
  openBook(w, h) {
    const p = new Paint(w, h);
    p.poly([[0.5, 0.12], [0.1, 0.18], [0.1, 0.88], [0.5, 0.82], [0.9, 0.88], [0.9, 0.18], [0.5, 0.12]], 0.035);
    p.seg(0.5, 0.12, 0.5, 0.82, 0.03);
    for (let k = 0; k < 4; k++) {
      const v = 0.32 + k * 0.13;
      p.seg(0.17, v, 0.42, v - 0.02, 0.025);
      p.seg(0.58, v - 0.02, 0.83, v, 0.025);
    }
    return p.t;
  },
  // The trip hop mix: a record, its grooves and its label.
  vinyl(w, h) {
    const p = new Paint(w, h);
    const [cu, cv] = p.sq(0, 0);
    p.ring(cu, cv, 0.45, 0.04);
    p.ring(cu, cv, 0.32, 0.03);
    p.disc(cu, cv, 0.13);
    const [tu, tv] = p.sq(0.95, -0.9);
    const [su, sv] = p.sq(0.3, -0.1);
    p.seg(tu, tv, su, sv, 0.04);
    return p.t;
  },
  // Our tribute: an aerobics figure, arms up, sweatband on, standing on a pair of rails.
  railsAerobics(w, h) {
    const p = new Paint(w, h);
    const [hu, hv] = p.sq(0, -0.62);
    p.disc(hu, hv, 0.1);
    const band = p.sq(0.16, -0.66);
    p.seg(p.sq(-0.16, -0.66)[0], band[1], band[0], band[1], 0.05);
    const neck = p.sq(0, -0.46);
    const hip = p.sq(0, 0.18);
    p.seg(neck[0], neck[1], hip[0], hip[1], 0.06);
    const lh = p.sq(-0.5, -0.9);
    const rh = p.sq(0.5, -0.9);
    p.seg(neck[0], neck[1] + 0.04, lh[0], lh[1], 0.05);
    p.seg(neck[0], neck[1] + 0.04, rh[0], rh[1], 0.05);
    const lf = p.sq(-0.45, 0.62);
    const rf = p.sq(0.45, 0.62);
    p.seg(hip[0], hip[1], lf[0], lf[1], 0.055);
    p.seg(hip[0], hip[1], rf[0], rf[1], 0.055);
    p.seg(0.04, 0.84, 0.96, 0.84, 0.03);
    p.seg(0.04, 0.95, 0.96, 0.95, 0.03);
    for (let k = 0; k < 9; k++) {
      const u = 0.08 + k * 0.105;
      p.seg(u, 0.8, u, 0.97, 0.03);
    }
    return p.t;
  },
  // Kusama's rooms, Muybridge's frames and Blender's film: polka dots, the one shape all three share on this site.
  dots(w, h) {
    const p = new Paint(w, h);
    const r = seeded(17);
    const n = Math.max(5, Math.min(14, Math.floor((w * h) / 130)));
    for (let k = 0; k < n; k++) p.disc(0.08 + r() * 0.84, 0.1 + r() * 0.8, 0.05 + r() * 0.07);
    return p.t;
  },
  // THE DJ's credit (lane DJCREDIT): a small music-making machine, a speaker in its face and a crank on its top, with
  // three notes leaving it, rising to the right.
  musicMachine(w, h) {
    const p = new Paint(w, h);
    p.poly([[0.08, 0.36], [0.44, 0.36], [0.44, 0.82], [0.08, 0.82], [0.08, 0.36]], 0.05);
    p.ring(0.26, 0.59, 0.15, 0.045);
    p.disc(0.26, 0.59, 0.035);
    p.seg(0.13, 0.82, 0.13, 0.95, 0.045);
    p.seg(0.39, 0.82, 0.39, 0.95, 0.045);
    p.seg(0.26, 0.36, 0.26, 0.2, 0.04);
    p.disc(0.26, 0.16, 0.04);
    for (const [u, v] of [[0.56, 0.72], [0.72, 0.56], [0.88, 0.4]]) {
      p.disc(u, v, 0.075);
      p.seg(u + 0.035, v, u + 0.035, v - 0.36, 0.045);
      p.seg(u + 0.035, v - 0.36, u + 0.09, v - 0.25, 0.04);
    }
    return p.t;
  },
};


export const CREDIT_SHAPES = CREDITS;

for (const [name, bits] of Object.entries(CREDITS)) defineBits(name, bits, NOTES[name], 'credits');
