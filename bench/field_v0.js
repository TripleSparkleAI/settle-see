// settle-see · field - the physics: a grid of p-bits, each leaning toward a target and pulled by its neighbours.
//
// <claudes_code_comments>
// ** Function List **
// createField(opts)   - a w x h grid of p-bits; returns the field object below
//   .sweep(beta)      - one full Gibbs sweep at inverse temperature beta, as two checkerboard half-sweeps
//   .setTarget(t)     - a new Int8Array target (the lean of each light)
//   .shake(frac)      - flip a random fraction of the lights (noise on demand)
//   .soften(k)        - update the soft read m: an exponential average of each light's recent yes; k = 'mean' makes
//                       m the plain count, yes frames / frames since resetSoft() (SETTLE's `ask`)
//   .resetSoft()      - start the count again (m follows the lights from the next soften('mean'))
//   .hold(x, y, r, v, strength) - the pointer: switch on (v = +1) every light within r of (x, y), leaving a trail
//   .fade(k)          - let the trail fade: hold strength times k each frame
//   .clamp(lights, v) - SETTLE's `hold`: the listed lights are set to v and left out of every sweep until released
//   .release()        - free every clamped light
//   .setLeans(a)      - a Float32Array of per-light leans (any real numbers) in place of lean * target; null undoes it
//   .randomise()      - every light a fair coin again
//   .stats()          - { q overlap with the target, r correlation with it, e energy, ePer, yes fraction, flips last
//                         sweep, sweeps }
//
// ** Technical Review **
// - Each light i is a p-bit: P(s_i = +1) = (1 + tanh(beta I_i)) / 2 with I_i = lean t_i + pull sum_nb s_j over its
//   four neighbours. The energy it lowers is E = -lean sum_i t_i s_i - pull sum_<ij> s_i s_j.
// - The four-neighbour grid is bipartite, so all "black" squares are independent given the "white" ones: updating
//   one colour, then the other, is an exact Gibbs sweep (the checkerboard schedule), with no shuffle to pay for.
// - I_i takes only a handful of values (t = +1 or -1, neighbour sum -4 .. 4), so P(yes) is read from a 2 x 9 table
//   computed once per sweep: no tanh per light. A 384 x 192 field (73,728 lights) sweeps in about a millisecond.
// - hold[i] in 0..1 is the user's hand: after each light's Gibbs draw, with probability hold[i] it is set to the held
//   value instead. The pointer sets hold to 1 under it; fade() shrinks it every frame, so a stroke leaves an echo
//   that thins out over about a second and the field then settles back. This is SETTLE's `hold` (clamping), done
//   by hand, a little at a time.
// - clamp() is the exact hold: a clamped light keeps its value through every sweep (it is skipped, as settle-rs leaves
//   held things out of `free`), at any temperature. The renderer draws clamped lights in ice, the key's colour for held.
// - setLeans() gives each light its own real lean h_i (a picture's grey levels, a mean-field fit): I_i = h_i + pull nb.
//   The 2 x 9 table no longer applies, so a sweep evaluates tanh per light; the energy uses -sum h_i s_i.
// - m[i] is the soft read: m <- k m + (1 - k) [s > 0]. The renderer draws brightness from m, so a light that keeps
//   saying yes glows steadily and one that flickers glows dimly: the picture is the running average the sampler
//   estimates, which is what SETTLE's `ask` reports.
// </claudes_code_comments>

import { Rng } from '../src/rng.js';

export function createField({ w, h, target = null, lean = 0.9, pull = 0.3, seed = 1, init = 'random' }) {
  const n = w * h;
  const rng = new Rng(seed);
  const s = new Int8Array(n);
  const m = new Float32Array(n);
  const held = new Float32Array(n);
  const heldTo = new Int8Array(n).fill(1);
  let holding = 0;
  let clamped = null;
  let clampN = 0;
  let leans = null;
  let softN = 0;
  let t = target ?? new Int8Array(n).fill(-1);
  for (let i = 0; i < n; i++) {
    s[i] = init === 'target' ? t[i] : rng.unit() < 0.5 ? -1 : 1;
    m[i] = s[i] > 0 ? 1 : 0;
  }
  const table = new Float32Array(18); // index (t > 0 ? 9 : 0) + (nb + 4)
  const F = {
    w, h, n, s, m, held, heldTo, rng, lean, pull,
    get holding() { return holding > 0; },
    get clamped() { return clamped; },
    get leans() { return leans; },
    get counted() { return softN; },
    resetSoft() { softN = 0; },
    get target() { return t; },
    flips: 0,
    sweeps: 0,
    setTarget(nt) {
      if (nt.length !== n) throw new Error('settle-see: target size does not match the field');
      t = nt;
    },
    sweep(beta) {
      for (let k = 0; k < 9; k++) {
        const nb = k - 4;
        table[9 + k] = (1 + Math.tanh(beta * (F.lean + F.pull * nb))) / 2;
        table[k] = (1 + Math.tanh(beta * (-F.lean + F.pull * nb))) / 2;
      }
      let flips = 0;
      const cl = clampN ? clamped : null;
      const L = leans;
      const pl = F.pull;
      for (let colour = 0; colour < 2; colour++) {
        for (let y = 0; y < h; y++) {
          const row = y * w;
          for (let x = (y + colour) & 1; x < w; x += 2) {
            const i = row + x;
            let nb = 0;
            if (x > 0) nb += s[i - 1];
            if (x + 1 < w) nb += s[i + 1];
            if (y > 0) nb += s[i - w];
            if (y + 1 < h) nb += s[i + w];
            if (cl && cl[i]) continue;
            const p = L ? (1 + Math.tanh(beta * (L[i] + pl * nb))) / 2 : table[(t[i] > 0 ? 9 : 0) + nb + 4];
            let v = rng.unit() < p ? 1 : -1;
            if (holding && held[i] > 0 && rng.unit() < held[i]) v = heldTo[i];
            if (v !== s[i]) flips++;
            s[i] = v;
          }
        }
      }
      F.flips = flips;
      F.sweeps++;
    },
    hold(cx, cy, r, v = 1, strength = 1) {
      const r2 = r * r;
      for (let y = Math.max(0, Math.floor(cy - r)); y <= Math.min(h - 1, Math.ceil(cy + r)); y++) {
        for (let x = Math.max(0, Math.floor(cx - r)); x <= Math.min(w - 1, Math.ceil(cx + r)); x++) {
          const d2 = (x - cx) ** 2 + (y - cy) ** 2;
          if (d2 > r2) continue;
          const i = y * w + x;
          if (clampN && clamped[i]) continue;
          held[i] = Math.max(held[i], strength * (1 - 0.35 * (d2 / r2)));
          heldTo[i] = v;
          if (strength > 0.5) s[i] = v;
        }
      }
      holding = 1;
    },
    clamp(lights, v = 1) {
      if (!clamped) clamped = new Int8Array(n);
      for (const i of lights) {
        if (i < 0 || i >= n) continue;
        if (!clamped[i]) clampN++;
        clamped[i] = v;
        s[i] = v;
      }
    },
    release() {
      if (clamped) clamped.fill(0);
      clampN = 0;
    },
    setLeans(a) {
      if (a && a.length !== n) throw new Error('settle-see: leans size does not match the field');
      leans = a ? Float32Array.from(a) : null;
    },
    randomise() {
      for (let i = 0; i < n; i++) if (!(clampN && clamped[i])) s[i] = rng.unit() < 0.5 ? -1 : 1;
    },
    fade(k = 0.86) {
      if (!holding) return;
      let any = 0;
      for (let i = 0; i < n; i++) {
        if (held[i] === 0) continue;
        held[i] = held[i] < 0.02 ? 0 : held[i] * k;
        any = 1;
      }
      holding = any;
    },
    shake(frac = 0.5) {
      for (let i = 0; i < n; i++) if (rng.unit() < frac && !(clampN && clamped[i])) s[i] = -s[i];
    },
    soften(k = 0.55) {
      if (k === 'mean') {
        softN++;
        const a = 1 / softN;
        for (let i = 0; i < n; i++) m[i] += ((s[i] > 0 ? 1 : 0) - m[i]) * a;
        return;
      }
      const j = 1 - k;
      for (let i = 0; i < n; i++) m[i] = m[i] * k + (s[i] > 0 ? j : 0);
    },
    stats() {
      let q = 0;
      let e = 0;
      let yes = 0;
      let st = 0;
      let ss = 0;
      for (let i = 0; i < n; i++) {
        q += t[i] * s[i];
        st += t[i];
        ss += s[i];
        e -= (leans ? leans[i] : F.lean * t[i]) * s[i];
        if ((i % w) + 1 < w) e -= F.pull * s[i] * s[i + 1];
        if (i + w < n) e -= F.pull * s[i] * s[i + w];
        if (s[i] > 0) yes++;
      }
      // Pearson correlation of two +1/-1 arrangements from their sums: (E[st] - E[s]E[t]) / sqrt((1-E[s]^2)(1-E[t]^2))
      const ms = ss / n;
      const mt = st / n;
      const d = (1 - ms * ms) * (1 - mt * mt);
      const r = d > 0 ? (q / n - ms * mt) / Math.sqrt(d) : 0;
      return { q: q / n, r, e, ePer: e / n, yes: yes / n, flips: F.flips, sweeps: F.sweeps };
    },
  };
  return F;
}
