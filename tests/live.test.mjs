// LIVE ITEMS: a target made on demand by a function and sampled on TRUE TIME's grid, so the field chases a source
// that keeps changing (the hero's spectrum). The field follows the function, takes a fresh sample only once it agrees,
// keeps the last good target when the function fails.
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
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}
globalThis.OffscreenCanvas = FakeCanvas;
globalThis.requestAnimationFrame = () => 0;

const { settle, isLive, liveFrame, LIVE_DEFAULTS, describe, agreementOn, changedLights } = await import('../src/index.js');

const W = 24;
const H = 12;
// a bar of lit columns from 0 to k (a one-bar "spectrum")
const bar = (k) => (w, h) => { const b = new Int8Array(w * h).fill(-1); for (let y = 0; y < h; y++) for (let x = 0; x < Math.min(w, k); x++) b[y * w + x] = 1; return b; };
const clock = () => { const c = { t: 0 }; c.now = () => c.t; return c; };
const lit = (h) => h.field.target.filter((v) => v > 0).length;

test('isLive and liveFrame: a function item is live; a sample is copied, sized and signed', () => {
  assert.ok(isLive({ live: () => null }));
  assert.ok(!isLive({ film: 'x' }) && !isLive('SETTLE') && !isLive(null));
  const buf = new Float32Array(W * H).fill(0.5);
  const f = liveFrame({ live: () => buf }, W, H, 0);
  assert.equal(f.length, W * H);
  assert.ok(f.every((v) => v === 1));
  buf[0] = -2;
  assert.equal(f[0], 1, 'a copy: the function may reuse its buffer');
  assert.equal(liveFrame({ live: () => new Int8Array(3) }, W, H, 0), null, 'the wrong size is refused');
  assert.equal(liveFrame({ live: () => { throw new Error('x'); } }, W, H, 0), null, 'a throw is refused');
  assert.equal(describe({ live: () => null }), 'a live picture');
  assert.equal(describe({ live: () => null, note: 'the spectrum' }), 'the spectrum');
  assert.equal(LIVE_DEFAULTS.periodMs, 125);
});

test('the field settles toward the function\'s answer', () => {
  const c = clock();
  const h = settle(new FakeCanvas(), { items: [{ live: bar(8), T: 0.5 }], res: [W, H], schedule: 'fixed', fps: 24, motion: 'always', now: c.now });
  h.advance(30);
  const t = h.field.target;
  assert.equal(lit(h), 8 * H, 'the target is the function\'s bar');
  assert.ok(agreementOn(h.field.s, t, Int32Array.from({ length: W * H }, (_, i) => i)) > 0.9, 'the lights agree with it');
  assert.ok(h.stats().live, 'stats carry the live block');
  h.destroy();
});

test('TRUE TIME: a new sample is taken only when the grid moves and the field agrees; it is the sample of that instant', () => {
  const c = clock();
  let k = 4;
  let calls = 0;
  const h = settle(new FakeCanvas(), { items: [{ live: (w, hh) => { calls++; return bar(k)(w, hh); }, T: 0.5, tween: 'snap' }], res: [W, H], schedule: 'fixed', fps: 24, motion: 'always', now: c.now });
  h.advance(40);
  const first = calls;
  k = 12;
  h.advance(40);
  assert.equal(calls, first, 'the clock has not moved: no new sample, however long the field waits');
  assert.equal(lit(h), 4 * H);
  c.t = 130; // one grid step on (125 ms)
  h.advance(40);
  assert.equal(lit(h), 12 * H, 'the field took the sample of now');
  h.destroy();
});

test('a hot field that never agrees keeps its sample; the same run cold moves on (positive control)', () => {
  const run = (T) => {
    const c = clock();
    let k = 4;
    const h = settle(new FakeCanvas(), { items: [{ live: (w, hh) => bar(k)(w, hh), T, tween: 'snap', threshold: 0.95 }], res: [W, H], schedule: 'fixed', fps: 24, motion: 'always', now: c.now });
    h.advance(1);
    k = 20;
    c.t = 130;
    h.advance(30);
    const n = lit(h);
    h.destroy();
    return n;
  };
  assert.equal(run(50), 4 * H, 'at T 50 the field never reaches 0.95, so the target holds');
  assert.equal(run(0.4), 20 * H, 'cold, it agrees and takes the new sample');
});

test('a failing function keeps the last good target, never an empty one', () => {
  const c = clock();
  let fail = false;
  const h = settle(new FakeCanvas(), { items: [{ live: (w, hh) => { if (fail) throw new Error('gone'); return bar(6)(w, hh); }, T: 0.5 }], res: [W, H], schedule: 'fixed', fps: 24, motion: 'always', now: c.now });
  h.advance(20);
  fail = true;
  c.t = 1000;
  h.advance(20);
  assert.equal(lit(h), 6 * H);
  h.destroy();
});

test('changedLights counts what a new sample changed (the measure behind the switch)', () => {
  assert.equal(changedLights(bar(6)(W, H), bar(4)(W, H)).length, 2 * H);
});
