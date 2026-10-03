// settle-see · measure - how close a settle came to its picture, and the control a picture must beat.
//
// <claudes_code_comments>
// ** Function List **
// correlation(a, b)       - Pearson correlation of two +1 / -1 arrangements (1 = the same picture, 0 = unrelated)
// shuffled(target, seed)  - the same number of lit lights in random places: the control target
//
// ** Technical Review **
// - correlation subtracts each arrangement's mean, so a picture that is mostly dark does not score high just by
//   being dark. field.stats().r is the same number for the field and its target, computed from running sums.
// - A settle toward shuffled(t) keeps t's lit count and destroys its shape; a page's tests settle toward both and
//   require the real target to reach the shape and the shuffled one not to.
// </claudes_code_comments>

import { Rng } from './rng.js';

export function correlation(a, b) {
  const n = a.length;
  let ma = 0;
  let mb = 0;
  for (let i = 0; i < n; i++) {
    ma += a[i];
    mb += b[i];
  }
  ma /= n;
  mb /= n;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i] - ma;
    const y = b[i] - mb;
    sab += x * y;
    saa += x * x;
    sbb += y * y;
  }
  return saa && sbb ? sab / Math.sqrt(saa * sbb) : 0;
}

export function shuffled(target, seed = 1) {
  const rng = new Rng(seed);
  const t = Int8Array.from(target);
  for (let k = t.length - 1; k > 0; k--) {
    const r = rng.below(k + 1);
    const tmp = t[k];
    t[k] = t[r];
    t[r] = tmp;
  }
  return t;
}
