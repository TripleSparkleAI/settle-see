// settle-see · rng - a small seeded generator, so a settle with the same seed draws the same way every time.
//
// <claudes_code_comments>
// ** Function List **
// Rng(seed)   - xorshift128: u32(), unit() in [0,1), signed() in [-1,1), below(n)
//
// ** Technical Review **
// - The same generator as the SETTLE site's JavaScript sampler (SETTLE/settle-site/src/engine/ising.js), copied so
//   the library stands alone with no import from any site.
// </claudes_code_comments>

export class Rng {
  constructor(seed = 1) {
    const s = (seed >>> 0) ^ 0x9e3779b9;
    this.a = s || 1;
    this.b = 362436069;
    this.c = 521288629;
    this.d = 88675123;
    for (let i = 0; i < 16; i++) this.u32();
  }
  u32() {
    const t = this.a ^ (this.a << 11);
    this.a = this.b;
    this.b = this.c;
    this.c = this.d;
    this.d = (this.d ^ (this.d >>> 19) ^ (t ^ (t >>> 8))) >>> 0;
    return this.d;
  }
  unit() {
    return this.u32() / 4294967296;
  }
  signed() {
    return this.u32() / 2147483648 - 1;
  }
  below(n) {
    return this.u32() % n;
  }
}
