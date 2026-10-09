// THE EDGE CRACKLE (crackle.js, lane CLEARTEXT): the weather's crackle knob flares the lights along a target's rim
// overbright, through the draw-only flash. It is bounded, it touches only rim lights, and it never moves the physics:
// the same settle with and without a crackle keeps every light's state identical, frame for frame.
import test from 'node:test';
import assert from 'node:assert/strict';

const stubCtx = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)) });
    if (k === 'measureText') return () => ({ width: 1 });
    return () => ({ addColorStop() {} });
  },
  set(t, k, v) { t[k] = v; return true; },
});
class FakeCanvas {
  constructor(w = 1, h = 1) { this.width = w; this.height = h; this.clientWidth = 200; this.clientHeight = 100; }
  getContext() { return stubCtx(); }
  addEventListener() {}
  removeEventListener() {}
  setAttribute() {}
  removeAttribute() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}
globalThis.OffscreenCanvas = FakeCanvas;
globalThis.requestAnimationFrame = () => 1;

const { CRACKLE_LIMITS, crackleOf, createRim, crackleRng, crackleFrame, createField, weatherOf, WEATHER_NEUTRAL, settle } = await import('../src/index.js');
await (await import('../src/index.js')).loadCreditShapes(); // the credits family loads on demand (lane LAUNCHGATES); its shapes are fixtures here

// a 12 x 8 target with a lit 6 x 4 block at (3..8, 2..5): its rim is the block's border, its body the 4 x 2 inside
const W = 12;
const H = 8;
const block = () => {
  const t = new Int8Array(W * H).fill(-1);
  for (let y = 2; y <= 5; y++) for (let x = 3; x <= 8; x++) t[y * W + x] = 1;
  return t;
};
const isBody = (i) => { const x = i % W; const y = Math.floor(i / W); return x >= 4 && x <= 7 && y >= 3 && y <= 4; };

test('crackleOf: bounded by CRACKLE_LIMITS; null, a zero strength or a zero rate is no crackle', () => {
  assert.equal(crackleOf(null), null);
  assert.equal(crackleOf({ strength: 0, rate: 0.1 }), null);
  assert.equal(crackleOf({ strength: 0.5, rate: 0 }), null);
  const c = crackleOf({ strength: 9, rate: 9, outer: 9, spit: 9 });
  assert.equal(c.spit, CRACKLE_LIMITS.spit[1]);
  assert.equal(c.strength, CRACKLE_LIMITS.strength[1]);
  assert.equal(c.rate, CRACKLE_LIMITS.rate[1]);
  assert.equal(c.outer, CRACKLE_LIMITS.outer[1]);
  assert.ok(CRACKLE_LIMITS.strength[1] <= 0.85 && CRACKLE_LIMITS.rate[1] <= 0.2, 'the brightness sanity caps');
  assert.equal(WEATHER_NEUTRAL.crackle, null);
  assert.equal(weatherOf({ heat: 1 }).crackle, null);
  assert.deepEqual(weatherOf({ crackle: { strength: 0.6, rate: 0.1, outer: 0.2 } }).crackle, { strength: 0.6, rate: 0.1, outer: 0.2, spit: 0 });
});

test('createRim: the inner rim is the lit border, the outer rim the unlit lights touching it, the body is neither', () => {
  const rim = createRim().update(block(), W, H);
  // the 6 x 4 block's border: 6 + 6 + 2 + 2 = 16 lights; the outer ring touching it by a side: 6 + 6 + 4 + 4 = 20
  assert.equal(rim.nIn, 16);
  assert.equal(rim.nOut, 20);
  const t = block();
  for (const i of rim.inner) { assert.ok(t[i] > 0, 'inner rim lights are lit'); assert.ok(!isBody(i), 'never the body'); }
  for (const i of rim.outer) assert.ok(t[i] < 0, 'outer rim lights are unlit');
  // the far ring, one step past the outer ring: 6 + 6 + 4 + 4 two lights out, and the 4 corner diagonals = 24
  assert.equal(rim.nFar, 24);
  const outerSet = new Set(rim.outer);
  for (const i of rim.far) { assert.ok(t[i] < 0 && !outerSet.has(i), 'far lights are unlit and past the outer rim'); }
  // an all-lit target: the frame's own border is its rim (the edge of the picture counts as unlit)
  const full = createRim().update(new Int8Array(W * H).fill(1), W, H);
  assert.equal(full.nIn, 2 * W + 2 * (H - 2));
  assert.equal(full.nOut, 0);
});

test('crackleFrame: flares only rim lights, never the body, at a strength inside the cap', () => {
  const F = createField({ w: W, h: H, target: block(), seed: 3 });
  const rim = createRim().update(F.target, W, H);
  const r = crackleRng(7);
  let flared = 0;
  for (let k = 0; k < 40; k++) flared += crackleFrame(F, rim, { strength: 0.8, rate: 0.2, outer: 0.5, spit: 0.5 }, r);
  assert.ok(flared > 40, `the rim crackles (${flared} flares over 40 frames)`);
  const a = F.flashA;
  for (let i = 0; i < F.n; i++) {
    if (isBody(i)) assert.equal(a[i], 0, 'the body never flares');
    assert.ok(a[i] <= 0.8 + 1e-9, 'never above the strength');
  }
  assert.equal(crackleFrame(F, rim, null, r), 0, 'no crackle, no flare');
});

test('on a settle: a crackle leaves the physics exactly as it was, and flares only rim lights', () => {
  const opts = (weather) => ({ shape: 'vinyl', res: [48, 24], schedule: { kind: 'fixed', T: 0.6 }, seed: 11, motion: 'always', weather });
  const plain = settle(new FakeCanvas(), opts(() => null));
  const crack = settle(new FakeCanvas(), opts(() => ({ crackle: { strength: 0.8, rate: 0.15, outer: 0.3, spit: 0.4 } })));
  for (let k = 0; k < 30; k++) {
    plain.advance(1);
    crack.advance(1);
    assert.deepEqual(crack.field.s, plain.field.s, `frame ${k}: the lights' states are identical`);
  }
  assert.equal(plain.field.flashA, null, 'no crackle, no flash');
  const a = crack.field.flashA;
  assert.ok(a && a.some((v) => v > 0), 'the crackle flares');
  const rim = createRim().update(crack.field.target, 48, 24);
  const onRim = new Set([...rim.inner, ...rim.outer, ...rim.far]);
  for (let i = 0; i < a.length; i++) if (a[i] > 0) assert.ok(onRim.has(i), `light ${i} flared off the rim`);
  plain.destroy();
  crack.destroy();
});
