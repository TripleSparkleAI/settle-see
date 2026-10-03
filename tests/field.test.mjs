// The physics tests: the checkerboard sweep is the exact Gibbs rule, and a cold field settles into its target.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, makeSchedule, neon, NEON, NEONS, RANDOM_KEYS } from '../src/index.js';

const stripes = (w, h) => Int8Array.from({ length: w * h }, (_, i) => ((i % w) < w / 2 ? 1 : -1));

test('a cold field settles into its target', () => {
  const F = createField({ w: 48, h: 24, target: stripes(48, 24), seed: 3 });
  for (let k = 0; k < 120; k++) F.sweep(1 / 0.45);
  assert.ok(F.stats().q > 0.95, `overlap ${F.stats().q}`);
});

test('negative control: with no lean the field does not find the target', () => {
  // a random target: with a lean the field copies it (smoothed by the pull); with no lean it cannot know it
  let x = 1;
  const t = Int8Array.from({ length: 48 * 24 }, () => ((x = (x * 1664525 + 1013904223) >>> 0) < 2 ** 31 ? 1 : -1));
  const withLean = createField({ w: 48, h: 24, target: t, seed: 3 });
  const noLean = createField({ w: 48, h: 24, target: t, lean: 0, seed: 3 });
  for (let k = 0; k < 120; k++) { withLean.sweep(1 / 0.45); noLean.sweep(1 / 0.45); }
  assert.ok(withLean.stats().q > 0.5, `with lean ${withLean.stats().q}`);
  assert.ok(Math.abs(noLean.stats().q) < 0.15, `no lean ${noLean.stats().q}`);
});

test('a hot field stays noise', () => {
  const F = createField({ w: 48, h: 24, target: stripes(48, 24), seed: 3 });
  for (let k = 0; k < 60; k++) F.sweep(1 / 50);
  assert.ok(Math.abs(F.stats().q) < 0.15, `overlap ${F.stats().q}`);
});

test('one light with no neighbours matches the exact p-bit rate (1 + tanh(beta lean)) / 2', () => {
  // a 1 x 1 field has no pull, so its yes rate must be the p-bit rule itself
  const F = createField({ w: 1, h: 1, target: Int8Array.of(1), seed: 9 });
  let yes = 0;
  const N = 200000;
  for (let k = 0; k < N; k++) { F.sweep(1); if (F.s[0] > 0) yes++; }
  const exact = (1 + Math.tanh(0.9)) / 2;
  assert.ok(Math.abs(yes / N - exact) < 0.005, `${yes / N} vs ${exact}`);
});

test('two pulled lights match exact enumeration', () => {
  // w = 2, h = 1: E = -lean (t0 s0 + t1 s1) - pull s0 s1; compare the sampled P(s0 = s1 = +1) with the exact one
  const lean = 0.2;
  const pull = 0.7;
  const F = createField({ w: 2, h: 1, target: Int8Array.of(1, -1), lean, pull, seed: 5 });
  const Z = {};
  let total = 0;
  for (const a of [-1, 1]) for (const b of [-1, 1]) { const p = Math.exp(lean * (a - b) + pull * a * b); Z[`${a}${b}`] = p; total += p; }
  let both = 0;
  const N = 200000;
  for (let k = 0; k < N; k++) { F.sweep(1); if (F.s[0] > 0 && F.s[1] > 0) both++; }
  const exact = Z['11'] / total;
  assert.ok(Math.abs(both / N - exact) < 0.006, `${both / N} vs ${exact}`);
});

test('the soft read follows the lights', () => {
  const F = createField({ w: 4, h: 4, target: new Int8Array(16).fill(1), seed: 1, init: 'target' });
  for (let k = 0; k < 30; k++) { F.sweep(1 / 0.2); F.soften(); }
  assert.ok(F.m.every((v) => v > 0.9));
});

test('the cycle schedule cools, holds, reheats and counts targets', () => {
  const S = makeSchedule('cycle');
  assert.equal(S(0).T, 3);
  assert.equal(S(0).phase, 'hot');
  assert.ok(Math.abs(S(190).T - 0.45) < 1e-9);
  assert.equal(S(200).phase, 'settled');
  assert.equal(S(290).phase, 'reheating');
  assert.equal(S(300).index, 1);
  assert.equal(makeSchedule(0.7)(99).T, 0.7);
  assert.equal(makeSchedule('cool')(5000).T, 0.45);
});

test('the neon code: ten neons, random picks are seeded and never ice', () => {
  assert.equal(NEONS.length, 10);
  assert.equal(neon('mem'), NEON.mem);
  assert.equal(neon('#123456'), '#123456');
  assert.equal(neon('random', 7), neon('random:7'));
  const seen = new Set([...Array(200)].map((_, k) => neon('random', k + 1)));
  assert.ok(!seen.has(NEON.held));
  assert.ok(seen.size >= RANDOM_KEYS.length - 1);
});

test('the pointer switches lights on, and the trail fades so the field settles back', () => {
  const F = createField({ w: 40, h: 20, target: new Int8Array(800).fill(-1), seed: 2, init: 'target' });
  F.hold(20, 10, 4);
  for (let k = 0; k < 3; k++) { F.sweep(1 / 0.45); F.fade(); }
  assert.ok(F.s[10 * 40 + 20] > 0, 'the light under the pointer is on while held');
  for (let k = 0; k < 200; k++) { F.sweep(1 / 0.45); F.fade(); }
  assert.equal(F.holding, false);
  assert.ok(F.stats().q > 0.95, `settled back, overlap ${F.stats().q}`);
});

test('TRACES capture, unpack exactly, and echo the past', async () => {
  const { createTraces } = await import('../src/index.js');
  const F = createField({ w: 13, h: 7, seed: 4 });
  const T = createTraces(F, { keep: 5 });
  const copies = [];
  for (let k = 0; k < 7; k++) { F.sweep(1 / 3); T.capture(); copies.push(Int8Array.from(F.s)); }
  assert.equal(T.length, 5);
  assert.deepEqual(T.unpack(0), copies[6]);
  assert.deepEqual(T.unpack(4), copies[2]);
  assert.equal(T.at(5), null);
  const e = T.echo(5, 0.8, 0);
  assert.equal(e.length, 91);
  assert.ok(e.some((v) => v > 0));
});

test('clamp: clamped lights never move, even hot; released ones move again; the pointer cannot move them', () => {
  const F = createField({ w: 24, h: 12, target: stripes(24, 12), seed: 5 });
  const band = [...Array(24).keys()].map((x) => 6 * 24 + x);
  F.clamp(band, 1);
  for (let k = 0; k < 200; k++) {
    F.sweep(1 / 3);
    for (const i of band) assert.equal(F.s[i], 1);
  }
  F.hold(12, 6, 3, -1, 1);
  F.sweep(1 / 3);
  for (const i of band) assert.equal(F.s[i], 1, 'the pointer does not move a clamped light');
  F.release();
  let moved = false;
  for (let k = 0; k < 20 && !moved; k++) {
    F.sweep(0);
    for (const i of band) if (F.s[i] < 0) moved = true;
  }
  assert.ok(moved, 'a released light is free again');
});

test('clamp: a light beside a clamped yes row says yes more often than one far from it', () => {
  // all leans toward no; row 6 clamped yes; count rows 5 (beside) and 0 (far) at T 1
  const F = createField({ w: 24, h: 12, target: new Int8Array(24 * 12).fill(-1), seed: 6 });
  F.clamp([...Array(24).keys()].map((x) => 6 * 24 + x), 1);
  let near = 0;
  let far = 0;
  for (let k = 0; k < 3000; k++) {
    F.sweep(1);
    for (let x = 0; x < 24; x++) { near += F.s[5 * 24 + x] > 0; far += F.s[x] > 0; }
  }
  assert.ok(near / 72000 > far / 72000 + 0.02 && near > 1.5 * far, `near ${near / 72000} far ${far / 72000}`);
});

test('per-light leans: one free light matches (1 + tanh(beta h)) / 2 for its own h', () => {
  const F = createField({ w: 2, h: 1, seed: 11, pull: 0 });
  F.setLeans(Float32Array.of(0.4, -1.2));
  const N = 100000;
  const yes = [0, 0];
  for (let k = 0; k < N; k++) { F.sweep(1); yes[0] += F.s[0] > 0; yes[1] += F.s[1] > 0; }
  for (const [i, h] of [[0, 0.4], [1, -1.2]]) {
    const exact = (1 + Math.tanh(h)) / 2;
    assert.ok(Math.abs(yes[i] / N - exact) < 0.006, `light ${i}: ${yes[i] / N} vs ${exact}`);
  }
  F.setLeans(null);
  assert.equal(F.leans, null);
});

test('randomise: a settled field becomes noise again', () => {
  const F = createField({ w: 48, h: 24, target: stripes(48, 24), seed: 3 });
  for (let k = 0; k < 120; k++) F.sweep(1 / 0.45);
  F.randomise();
  assert.ok(Math.abs(F.stats().q) < 0.1, `after randomise ${F.stats().q}`);
});

test("soften('mean') is the plain count: yes frames over frames since resetSoft()", () => {
  const F = createField({ w: 8, h: 4, seed: 2, pull: 0 });
  F.setLeans(new Float32Array(32).fill(0.3));
  const yes = new Float64Array(32);
  for (let k = 0; k < 50; k++) {
    F.sweep(1);
    F.soften('mean');
    for (let i = 0; i < 32; i++) yes[i] += F.s[i] > 0;
  }
  assert.equal(F.counted, 50);
  for (let i = 0; i < 32; i++) assert.ok(Math.abs(F.m[i] - yes[i] / 50) < 1e-6);
  F.resetSoft();
  F.sweep(1);
  F.soften('mean');
  for (let i = 0; i < 32; i++) assert.equal(F.m[i], F.s[i] > 0 ? 1 : 0);
});

test('resetSoft(keep): the count carries on from m without a jump; keep = n - 1 a frame is a running average of n', () => {
  const F = createField({ w: 8, h: 4, seed: 3, pull: 0 });
  F.setLeans(new Float32Array(32).fill(0.3));
  for (let k = 0; k < 40; k++) {
    F.sweep(1);
    F.soften('mean');
  }
  const before = Float64Array.from(F.m);
  F.resetSoft(9);
  assert.equal(F.counted, 9);
  F.sweep(1);
  F.soften('mean');
  assert.equal(F.counted, 10);
  for (let i = 0; i < 32; i++) assert.ok(Math.abs(F.m[i] - (before[i] + ((F.s[i] > 0 ? 1 : 0) - before[i]) / 10)) < 1e-6, `light ${i}`);
  // a running average of 4: holding the count at 3 before each frame gives every new frame the weight 1 / 4
  const m0 = Float64Array.from(F.m);
  F.resetSoft(3);
  F.sweep(1);
  F.soften('mean');
  for (let i = 0; i < 32; i++) assert.ok(Math.abs(F.m[i] - (m0[i] * 0.75 + (F.s[i] > 0 ? 0.25 : 0))) < 1e-6);
  // the old call is unchanged: no argument starts from nothing
  F.resetSoft();
  assert.equal(F.counted, 0);
  F.resetSoft(-5);
  assert.equal(F.counted, 0);
});

test('flash: lights a set of lights, fades by k a frame, ends under 0.03, and never moves a p-bit', () => {
  const F = createField({ w: 8, h: 4, seed: 3 });
  const before = Int8Array.from(F.s);
  assert.equal(F.flashA, null);
  assert.equal(F.flashing, false);
  F.flash([1, 2, 99, -1], 1);
  assert.ok(F.flashing);
  assert.equal(F.flashA[1], 1);
  assert.equal(F.flashA[2], 1);
  assert.equal(F.flashA[3], 0, 'an unlisted light is not lit');
  F.flash([1], 0.5);
  assert.equal(F.flashA[1], 1, 'a weaker flash does not dim a stronger one');
  F.fadeFlash(0.5);
  assert.equal(F.flashA[1], 0.5);
  for (let k = 0; k < 6; k++) F.fadeFlash(0.5);
  assert.equal(F.flashing, false);
  assert.equal(F.flashA, null);
  assert.deepEqual(F.s, before, 'the physics never saw it');
});

test('control: a field that is never flashed reports no flash after fading', () => {
  const F = createField({ w: 4, h: 4 });
  F.fadeFlash(0.5);
  assert.equal(F.flashing, false);
  F.sweep(2);
  assert.equal(F.flashA, null);
});
