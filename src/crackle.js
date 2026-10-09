// settle-see · crackle - THE EDGE CRACKLE (lane CLEARTEXT, navigator 2026-10-04: "sometimes an OVERBRIGHT SPARKLE,
// like a crackle effect on the EDGES, a FONT EFFECT"). The weather's `crackle` knob: the lights along a picture's
// edges flare overbright, at random, a few a frame, while the body of the picture stays settled.
//
// <claudes_code_comments>
// ** Function List **
// CRACKLE_LIMITS            - the hard bounds settle-see keeps whatever a page asks: strength up to 0.85, a rim
//                             light's chance a frame up to 0.2, the outer rim's share up to 0.6, the spit's up to 0.5
// crackleOf(c)              - pure: a page's crackle -> { strength, rate, outer, spit } inside CRACKLE_LIMITS, or null
// createRim()               - the rim of a target: .update(target, w, h) finds the INNER rim (lit target lights with an
//                             unlit four-neighbour; past the frame's edge counts as unlit), the OUTER rim (unlit lights touching a lit one) and
//                             the FAR ring (unlit lights one step past the outer rim); .inner / .outer / .far are
//                             Int32Array views; .nIn / .nOut / .nFar their counts
// crackleRng(seed)          - the crackle's own small generator (mulberry32), so a crackle never moves the physics'
//                             random sequence
// crackleFrame(F, rim, c, r) - one frame of crackle: each inner-rim light flares with chance c.rate, each outer-rim
//                             light with chance c.rate x c.outer, through F.flash at strength c.strength x (0.55 ..
//                             1), and each far-ring light with chance c.rate x c.spit at 0.6 of that (a spark thrown
//                             off the edge); returns how many flared
//
// ** Technical Review **
// - A FLARE IS DRAW-ONLY. F.flash (field.js) adds the renderer's flash colour (the lit neon most of the way to white)
//   over a light and lights its hot core; it touches no p-bit, no lean and no temperature. So the body of a word
//   settles exactly as it would without the crackle: the agreement with the target is unchanged, and only the rim
//   glitters. Each flare fades by the settle's flashDecay (0.72 a frame), so a flare lives about five frames: the
//   rim crackles rather than blinks.
// - BRIGHTNESS SANITY: the strength is capped at 0.85, the chance a frame at 0.2 of the rim, and only rim lights ever
//   flare, so the lit area of a flare is a small, steady fraction of the picture frame to frame (no field-wide flash).
//   A page keeps tighter limits (the SETTLE site: no crackle under the 40 Hz light or reduced motion).
// - THE RIM is found from the target alone in one pass over the grid (four-neighbour test), cached by the mount on
//   the target's identity and refreshed every few frames, because a live item may rewrite its target in place.
// </claudes_code_comments>

export const CRACKLE_LIMITS = Object.freeze({ strength: [0, 0.85], rate: [0, 0.2], outer: [0, 0.6], spit: [0, 0.5] });

const bound = (x, [lo, hi], d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);

export function crackleOf(c) {
  if (!c || typeof c !== 'object') return null;
  const strength = bound(c.strength, CRACKLE_LIMITS.strength, 0);
  const rate = bound(c.rate, CRACKLE_LIMITS.rate, 0.06);
  if (!(strength > 0) || !(rate > 0)) return null;
  return { strength, rate, outer: bound(c.outer, CRACKLE_LIMITS.outer, 0.25), spit: bound(c.spit, CRACKLE_LIMITS.spit, 0) };
}

export function createRim() {
  let inner = new Int32Array(0);
  let outer = new Int32Array(0);
  let far = new Int32Array(0);
  let mark = new Uint8Array(0);
  const rim = {
    nIn: 0,
    nOut: 0,
    nFar: 0,
    get inner() { return inner.subarray(0, rim.nIn); },
    get outer() { return outer.subarray(0, rim.nOut); },
    get far() { return far.subarray(0, rim.nFar); },
    update(t, w, h) {
      const n = w * h;
      if (inner.length < n) { inner = new Int32Array(n); outer = new Int32Array(n); far = new Int32Array(n); mark = new Uint8Array(n); }
      mark.fill(0, 0, n);
      let a = 0;
      let b = 0;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const i = row + x;
          const lit = t[i] > 0;
          const l = x > 0 && t[i - 1] > 0;
          const r = x + 1 < w && t[i + 1] > 0;
          const u = y > 0 && t[i - w] > 0;
          const d = y + 1 < h && t[i + w] > 0;
          if (lit) { if (!l || !r || !u || !d) inner[a++] = i; }
          else if (l || r || u || d) { outer[b++] = i; mark[i] = 1; }
        }
      }
      // the far ring: unlit lights one step past the outer ring (where a spark spits to)
      let c = 0;
      for (let y = 0; y < h; y++) {
        const row = y * w;
        for (let x = 0; x < w; x++) {
          const i = row + x;
          if (t[i] > 0 || mark[i]) continue;
          if ((x > 0 && mark[i - 1]) || (x + 1 < w && mark[i + 1]) || (y > 0 && mark[i - w]) || (y + 1 < h && mark[i + w])) far[c++] = i;
        }
      }
      rim.nIn = a;
      rim.nOut = b;
      rim.nFar = c;
      return rim;
    },
  };
  return rim;
}

export function crackleRng(seed = 1) {
  let a = (seed >>> 0) || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const one = [0];
export function crackleFrame(F, rim, c, r = Math.random) {
  if (!c || !rim) return 0;
  let k = 0;
  const flare = (i) => {
    one[0] = i;
    F.flash(one, c.strength * (0.55 + 0.45 * r()));
    k++;
  };
  const inner = rim.inner;
  for (let j = 0; j < inner.length; j++) if (r() < c.rate) flare(inner[j]);
  const po = c.rate * c.outer;
  if (po > 0) {
    const outer = rim.outer;
    for (let j = 0; j < outer.length; j++) if (r() < po) flare(outer[j]);
  }
  // spits: a rarer, dimmer flare one step further out, so the rim throws sparks
  const ps = c.rate * (c.spit ?? 0);
  if (ps > 0 && rim.far) {
    const far = rim.far;
    for (let j = 0; j < far.length; j++) {
      if (r() < ps) {
        one[0] = far[j];
        F.flash(one, c.strength * 0.6 * (0.55 + 0.45 * r()));
        k++;
      }
    }
  }
  return k;
}
