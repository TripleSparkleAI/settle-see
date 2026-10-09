// The morph tests: a settle changes its target BY SETTLING (the bilingual site's language switch). The movie behind,
// its TRUE TIME pacing on fast and slow fronts, the hot-field overrun, and handle.morph() on a stand-in canvas.
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
globalThis.requestAnimationFrame = () => 1;

const { settle, toTarget, correlation, morphFrames, createMorph, MORPH_DEFAULTS, WORD_FONT } = await import('../src/index.js');
await (await import('../src/index.js')).loadCreditShapes(); // the credits family loads on demand (lane LAUNCHGATES); its shapes are fixtures here

const W = 48;
const H = 26;
const A = toTarget('hammingBall', W, H);
const B = toTarget('vinyl', W, H);
const diff = (x, y) => { let n = 0; for (let i = 0; i < x.length; i++) n += x[i] !== y[i]; return n; };

test('the movie: frame 0 is the old picture, the last is the new, and each frame only moves further toward it', () => {
  const f = morphFrames(A, B, { frames: 4, width: W, seed: 7 });
  assert.equal(f.length, 4);
  assert.equal(diff(f[0], A), 0);
  assert.equal(diff(f[3], B), 0);
  const total = diff(A, B);
  assert.ok(total > 50, 'the two pictures differ enough to test');
  let prev = 0;
  for (let k = 1; k < 4; k++) {
    const moved = diff(f[k], A);
    assert.ok(moved > prev, `frame ${k} moved more lights than frame ${k - 1}`);
    // a light that has switched stays switched
    for (let i = 0; i < A.length; i++) if (f[k - 1][i] !== A[i]) assert.equal(f[k][i], B[i]);
    prev = moved;
  }
  // a soft wipe: the lights switched by frame 1 sit further left than the lights that differ overall
  const meanCol = (pick) => { let s = 0; let n = 0; for (let i = 0; i < A.length; i++) if (pick(i)) { s += i % W; n++; } return s / n; };
  assert.ok(meanCol((i) => f[1][i] !== A[i]) < meanCol((i) => A[i] !== B[i]), 'the left switches first');
});

test('TRUE TIME: a fast front shows every frame, a slow one skips, and both keep the movie\'s pace', () => {
  const run = (sweepsToAgree) => {
    let t = 0;
    const M = createMorph({ from: A, to: B, width: W, now: () => t, overrun: 6 });
    const shown = [M.showing];
    const s = Int8Array.from(A);
    let waited = 0;
    let lastShow = M.showing;
    for (let step = 0; step < 400 && !M.done; step++) {
      t += 25; // a sweep every 25 ms
      waited = M.showing === lastShow ? waited + 1 : 0;
      lastShow = M.showing;
      if (waited >= sweepsToAgree) s.set(M.target); // the field has settled onto its target
      const r = M.update(s, t);
      if (r.changed) shown.push(M.showing);
    }
    return { shown, t, done: M.done };
  };
  const fast = run(2);
  const slow = run(50); // 1,250 ms to settle a frame, longer than two 500 ms periods
  assert.deepEqual(fast.shown, [0, 1, 2, 3], 'fast: every frame');
  assert.ok(fast.done && slow.done);
  assert.ok(slow.shown.length < fast.shown.length, `slow skipped frames: ${slow.shown}`);
  assert.equal(slow.shown.at(-1), 3, 'slow still ends on the new picture');
  // pace: the fast front cannot finish before the movie reaches its last frame (3 x 500 ms)
  assert.ok(fast.t >= 3 * MORPH_DEFAULTS.periodMs, `fast took ${fast.t} ms`);
});

test('a hot field that never agrees is let go after the overrun, on the new picture (no cut, no hang)', () => {
  let t = 0;
  const M = createMorph({ from: A, to: B, width: W, now: () => t, overrun: 2 });
  const s = Int8Array.from(A);
  let steps = 0;
  while (!M.done && steps++ < 1000) { t += 50; M.update(s, t); }
  assert.ok(M.done);
  assert.equal(diff(M.target, B), 0);
  assert.ok(t >= MORPH_DEFAULTS.periodMs * (3 + 2), `let go at ${t} ms`);
});

test('handle.morph(): the field settles from the old item to the new one, the cycle keeps its frame', () => {
  globalThis.matchMedia = () => ({ matches: false });
  let t = 0;
  const h = settle(new FakeCanvas(), { items: ['hammingBall'], res: [W, H], schedule: { kind: 'fixed', T: 0.3 }, motion: 'always', now: () => t, seed: 3 });
  h.advance(40);
  assert.ok(correlation(h.field.s, A) > 0.9, 'settled on the first picture');
  const frameBefore = h.frame;
  assert.equal(h.morph({ items: ['vinyl'] }), true);
  assert.ok(h.morphing);
  assert.equal(h.frame, frameBefore, 'the schedule was not restarted');
  let sawMiddle = false;
  for (let k = 0; k < 400 && h.morphing; k++) {
    t += 20;
    h.advance(1);
    const tg = h.field.target;
    if (diff(tg, A) > 0 && diff(tg, B) > 0) sawMiddle = true;
  }
  assert.ok(!h.morphing, 'the morph finished');
  assert.ok(sawMiddle, 'an intermediate frame was a target on the way');
  assert.ok(t >= 3 * 500, `the switch kept true time (${t} ms)`);
  h.advance(20);
  assert.ok(correlation(h.field.s, B) > 0.9, 'settled on the new picture');
  assert.ok(h.frame > frameBefore + 40);
  h.destroy();
});

test('handle.morph() under reduced motion is a cut; a change of item count falls back to set()', () => {
  globalThis.matchMedia = () => ({ matches: true });
  const r = settle(new FakeCanvas(), { items: ['hammingBall'], res: [W, H], schedule: { kind: 'fixed', T: 0.3 } });
  assert.equal(r.morph({ items: ['vinyl'] }), false);
  assert.equal(r.morphing, false);
  assert.equal(correlation(r.field.s, B), 1, 'the new picture is in the lights at once');
  r.destroy();
  globalThis.matchMedia = () => ({ matches: false });
  const h = settle(new FakeCanvas(), { items: ['hammingBall'], res: [W, H], motion: 'always', schedule: { kind: 'fixed', T: 0.3 } });
  h.advance(10);
  assert.equal(h.morph({ items: ['vinyl', 'dots'] }), false);
  assert.equal(h.frame, 0, 'a new list restarts the schedule');
  h.destroy();
});

test('the word font carries Japanese faces after the Latin ones', () => {
  assert.match(WORD_FONT, /^"Space Grotesk"/);
  for (const f of ['Hiragino Sans', 'Noto Sans JP', 'Yu Gothic']) assert.ok(WORD_FONT.includes(f), f);
  assert.ok(WORD_FONT.indexOf('Hiragino') > WORD_FONT.indexOf('Arial'), 'Latin first, so English words keep their face');
});

test('handle.morph() to a DIFFERENT film or live source at the same index starts it; the SAME film keeps playing', () => {
  globalThis.matchMedia = () => ({ matches: false });
  let t = 0;
  const filmA = { frames: ['hammingBall', 'hammingBall'], T: 0.3 };
  const filmB = { frames: ['vinyl', 'vinyl'], T: 0.3 };
  const h = settle(new FakeCanvas(), { items: [filmA], res: [W, H], schedule: { kind: 'fixed', T: 0.3 }, motion: 'always', now: () => t, seed: 3 });
  h.advance(30);
  assert.ok(correlation(h.field.target, A) > 0.99, 'playing film A');
  // the same film, copied (a language switch re-spells the caption): nothing restarts
  const f = h.frame;
  assert.equal(h.morph({ items: [{ ...filmA, note: 'other words' }] }), false);
  assert.equal(h.frame, f, 'the same film keeps playing');
  // a different film at the same index: it starts (before this fix the old film kept playing)
  h.morph({ items: [filmB] });
  t += 600;
  h.advance(30);
  assert.ok(correlation(h.field.target, B) > 0.99, 'film B is the target now');
  // and a different live source
  const liveA = { live: (w, hh) => toTarget('hammingBall', w, hh), T: 0.3 };
  const liveB = { live: (w, hh) => toTarget('vinyl', w, hh), T: 0.3 };
  const l = settle(new FakeCanvas(), { items: [liveA], res: [W, H], schedule: { kind: 'fixed', T: 0.3 }, motion: 'always', now: () => t, seed: 3 });
  l.advance(30);
  assert.ok(correlation(l.field.target, A) > 0.99);
  l.morph({ items: [liveB] });
  t += 600;
  l.advance(30);
  assert.ok(correlation(l.field.target, B) > 0.99, 'live B is the target now');
  h.destroy();
  l.destroy();
});
