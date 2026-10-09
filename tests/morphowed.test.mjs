// THE OWED LIGHTS (lane HEROPASS, 2026-10-06): a morph starts from the picture that is LIT, not from the target the
// field was heading for, and the field may not rest while a light the morph changed still disagrees with the target.
// Before, a morph begun while another was still running started from the half-way target, never watched the lights
// lit from the old words, and the rest rule could freeze them lit (the poem lab's film saw the waiting dots stay lit).
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
let frames = [];
globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
const tick = (now) => { const f = frames; frames = []; f.forEach((fn) => fn(now)); };
globalThis.matchMedia = () => ({ matches: false });

const { settle, toTarget, OWED_MAX_FRAMES } = await import('../src/index.js');

const W = 64;
const H = 24;
const A = toTarget({ shape: 'hammingBall' }, W, H); // the old words, still lit
const bar = (x0, x1) => { const b = new Int8Array(W * H).fill(-1); for (let x = x0; x < x1; x++) b[12 * W + x] = 1; return b; };
const B = bar(2, 10); // the target the field was heading for (a morph half way)
const C = bar(50, 60); // the new words
const diff = (x, y) => { let n = 0; for (let i = 0; i < x.length; i++) n += x[i] !== y[i]; return n; };
const make = (t, extra = {}) => settle(new FakeCanvas(), { items: [{ bits: B }], res: [W, H], schedule: { kind: 'fixed', T: 0.45 }, lean: 1.1, pull: 0.3, motion: 'always', now: t, seed: 3, rest: true, restAfter: 12, fps: 1000, ...extra });

test('a morph starts from the picture that is LIT, so the old words are in its first frame', () => {
  let t = 1000;
  const h = make(() => t);
  h.advance(5);
  h.field.s.set(A); // the old words still lit while the field heads for B
  assert.equal(h.morph({ items: [{ bits: C }] }, { frames: 4, periodMs: 300 }), true);
  assert.equal(diff(h.field.target, A), 0, 'frame 0 is what is lit (it was the half-way target B before this lane)');
  assert.ok(diff(h.field.target, B) > 0);
  h.destroy();
});

// the real loop (the rest rule lives in it; advance() steps whatever the rule says): a light the morph changed is
// pinned against its target by an afterStep hook, so it disagrees when the owed check runs
const run = (pinFrames) => {
  let t = 1000;
  let now = 0;
  const i = 12 * W + 4; // lit in B, off in C: a light the morph changes
  let pin = 0;
  const h = make(() => t, { afterStep: (F) => { if (pin > 0) { pin -= 1; F.s[i] = 1; } } });
  const frame = () => { t += 20; tick((now += 20)); };
  for (let k = 0; k < 60; k++) frame();
  const before = h.field.sweeps;
  frame();
  assert.equal(h.field.sweeps, before, 'settled on B and resting (the sweeps stopped)');
  h.morph({ items: [{ bits: C }] }, { frames: 4, periodMs: 300 });
  pin = pinFrames;
  const sweeps = [];
  for (let k = 0; k < pinFrames + OWED_MAX_FRAMES + 80; k++) { frame(); sweeps.push(h.field.sweeps); }
  const lastMove = sweeps.findLastIndex((v, k) => k > 0 && v !== sweeps[k - 1]);
  const out = { lastMove, stray: h.field.s[i], resting: sweeps.at(-1) === sweeps.at(-20), owed: h.stats().owed ?? 0 };
  h.destroy();
  return out;
};

test('the field does not rest while a light the morph changed still disagrees, and rests once it agrees', () => {
  const r = run(100); // pinned lit for 100 frames, far past the morph (about 60 frames) and the rest wait (12)
  assert.ok(r.lastMove >= 100, `kept sweeping while the light was owed (last sweep at frame ${r.lastMove})`);
  assert.ok(r.lastMove < 100 + 40, 'and rested soon after it agreed');
  assert.equal(r.stray, -1, 'the light went out before the field rested');
  assert.equal(r.resting, true);
  assert.equal(r.owed, 0);
});

test('the owed hold has a limit: a light that never agrees lets the field rest after OWED_MAX_FRAMES', () => {
  const r = run(100000);
  assert.equal(r.resting, true, 'rested in the end');
  assert.ok(r.lastMove < 60 + OWED_MAX_FRAMES + 40, `rested by frame ${r.lastMove}`);
});
