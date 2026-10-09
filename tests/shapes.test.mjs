// The shape tests: every canvas-free shape settles into itself at the sizes settle-site draws it, and a settle whose
// leans come from a shuffled copy does not (the control).
import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, makeSchedule, toTarget, getShape, shapeNames, defineBits, describe, KANERVA, correlation, shuffled, Paint } from '../src/index.js';

// the credits page's schedule: hot 16 frames, cool 120 to 0.45, hold 110, reheat 14
const SCHED = { kind: 'cycle', hot: 3.0, cold: 0.45, heat: 16, cool: 120, hold: 110, reheat: 14 };
const END = SCHED.heat + SCHED.cool + SCHED.hold;

function settleTo(target, w, h, seed) {
  const F = createField({ w, h, target, seed, lean: 0.9, pull: 0.3 });
  const s = makeSchedule(SCHED);
  for (let f = 0; f < END; f++) F.sweep(1 / s(f).T);
  return F;
}

// the sizes settle-site's credits page draws: hero, theme, card and the six section marks
const KANERVA_SIZES = [[144, 52], [64, 30], [48, 26], [40, 14], [24, 12], [16, 8], [32, 32], [20, 10], [56, 16]];
const CARD = [48, 26];
const credits = shapeNames('credits');
const drawn = [
  ...KANERVA.flatMap((name) => KANERVA_SIZES.map(([w, h]) => [name, w, h])),
  ...credits.filter((n) => !KANERVA.includes(n)).map((name) => [name, ...CARD]),
];

test('the credits family: 26 shapes, Kanerva\'s six first among them, each with a note', () => {
  assert.equal(credits.length, 26);
  for (const k of KANERVA) assert.ok(credits.includes(k), k);
  for (const n of credits) assert.ok(getShape(n).note.length > 5, `${n} has no note`);
  assert.ok(shapeNames('physics').includes('hypercube') && !credits.includes('hypercube'), 'the physics hypercube is a different shape');
});

test('every credits shape settles into itself: correlation above 0.85 after one cool-down', () => {
  for (const [name, w, h] of drawn) {
    const t = toTarget(name, w, h);
    const lit = t.reduce((a, v) => a + (v > 0), 0);
    assert.ok(lit > 0 && lit < t.length, `${name} ${w}x${h} is blank or full`);
    const F = settleTo(t, w, h, 7);
    const q = correlation(F.s, t);
    assert.ok(q > 0.85, `${name} at ${w}x${h}: correlation ${q.toFixed(3)}`);
    assert.ok(Math.abs(F.stats().r - q) < 1e-9, 'stats().r is the same correlation');
  }
});

test('control: settling toward a shuffled copy does not reach the shape', () => {
  for (const [name, w, h] of drawn) {
    const t = toTarget(name, w, h);
    let mean = 0;
    for (const seed of [1, 2, 3]) mean += correlation(settleTo(shuffled(t, seed), w, h, seed + 10).s, t) / 3;
    assert.ok(Math.abs(mean) < 0.25, `${name} at ${w}x${h}: control correlation ${mean.toFixed(3)}`);
  }
});

test('shuffled keeps the lit count and moves the lights', () => {
  const t = toTarget('hammingBall', 48, 26);
  const u = shuffled(t, 4);
  assert.equal(u.reduce((a, v) => a + v, 0), t.reduce((a, v) => a + v, 0));
  assert.ok(Math.abs(correlation(u, t)) < 0.15);
  assert.equal(correlation(t, t), 1);
});

test('defineBits: a canvas-free shape is read as is, and invert flips it', () => {
  defineBits('test-bar', (w, h) => { const p = new Paint(w, h); p.box(0.2, 0.4, 0.8, 0.6); return p.t; }, 'a test bar');
  const t = toTarget('test-bar', 20, 10);
  const u = toTarget({ shape: 'test-bar', invert: true }, 20, 10);
  assert.ok(t.some((v) => v > 0));
  for (let i = 0; i < t.length; i++) assert.equal(u[i], -t[i]);
  assert.equal(describe('test-bar'), 'a test bar');
  assert.equal(getShape('test-bar').family, 'custom');
});

test('the energy landscape reads as a plot: axes with ticks, ASYMMETRIC valleys (shallow left, deep right), a ball in the shallow one', async () => {
  const { landscapeGeometry } = await import('../src/shapes.js');
  const g = landscapeGeometry();
  assert.ok(g.left < g.barrier && g.barrier < g.right, 'shallow valley, barrier, deep valley, left to right');
  const depthL = g.E(g.barrier) - g.E(g.left);
  const depthR = g.E(g.barrier) - g.E(g.right);
  assert.ok(depthR > 2 * depthL, `the right valley is much deeper: ${depthR.toFixed(3)} vs ${depthL.toFixed(3)}`);
  // not a mirror image: reflect the curve about the barrier and it no longer matches
  const asym = [0.05, 0.1, 0.15, 0.2].map((d) => Math.abs(g.E(g.barrier - d) - g.E(g.barrier + d)));
  assert.ok(Math.max(...asym) > 0.2, `asymmetric: ${asym.map((x) => x.toFixed(2))}`);
  for (const [w, h] of [[384, 216], [128, 72], [96, 40]]) {
    const t = toTarget('landscape', w, h);
    const lit = (x, y) => t[Math.round(y) * w + Math.round(x)] > 0;
    // the x axis: a lit row along the bottom; ticks hang below it
    const ay = Math.round(0.88 * (h - 1));
    let row = 0;
    for (let x = Math.round(0.1 * w); x < Math.round(0.9 * w); x++) row += lit(x, ay) ? 1 : 0;
    assert.ok(row > 0.75 * 0.8 * w, `${w}x${h}: x axis`);
    // the ball: lit just above the shallow valley's floor
    const bu = g.U(g.left) * (w - 1);
    const bv = (g.V(g.E(g.left)) - 0.06) * (h - 1);
    assert.ok(lit(bu, bv), `${w}x${h}: the ball sits above the shallow valley`);
    // the deep valley's floor is lower on the screen than the shallow one's
    assert.ok(g.V(g.E(g.right)) > g.V(g.E(g.left)) + 0.2, 'deep valley drawn lower');
    const F = settleTo(t, w, h, 3);
    assert.ok(correlation(F.s, t) > 0.85, `${w}x${h} settles: ${correlation(F.s, t).toFixed(3)}`);
    const C = settleTo(shuffled(t, 4), w, h, 3);
    assert.ok(correlation(C.s, t) < 0.25, `${w}x${h} control: ${correlation(C.s, t).toFixed(3)}`);
  }
});
