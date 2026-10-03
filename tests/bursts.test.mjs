// The bursts (bursts.js): 25 distinct designs, each a real disturbance of the field that the physics then repairs, and a
// deck that deals them like a deck of cards (THE DECK RULE): all 25 a round, a fresh shuffle each round.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, toTarget, correlation, BURSTS, burstDeckOrder, createBurstDeck, createBurstPlayer, burstEnv, brainScene } from '../src/index.js';

const W = 160;
const H = 90;
function settled(seed = 3) {
  const t = brainScene(W, H, { view: 'section' }).bits;
  const F = createField({ w: W, h: H, target: t, seed, init: 'target' });
  for (let k = 0; k < 20; k++) F.sweep(1 / 0.42);
  return { F, t };
}
// what a burst did in one frame: lights whose p-bit flipped, plus lights flashed or held
function play(design, withPaths = true) {
  const { F, t } = settled();
  const player = createBurstPlayer();
  const env = burstEnv(F, { seed: 11, paths: withPaths ? brainScene(W, H, { view: 'section' }).paths : undefined });
  player.start(design, env);
  let touched = 0;
  let minR = 1;
  while (player.active) {
    const before = Int8Array.from(F.s);
    player.step(F);
    let flips = 0;
    for (let i = 0; i < F.n; i++) flips += before[i] !== F.s[i];
    const lit = F.flashA ? F.flashA.reduce((a, v) => a + (v > 0), 0) : 0;
    const held = F.held.reduce((a, v) => a + (v > 0), 0);
    touched += flips + lit + held;
    minR = Math.min(minR, correlation(F.s, t));
    F.fade(0.86);
    F.fadeFlash(0.72);
    F.sweep(1 / 0.42);
  }
  for (let k = 0; k < 40; k++) F.sweep(1 / 0.42);
  return { touched, minR, after: correlation(F.s, t), clamped: F.clamped ? F.clamped.reduce((a, v) => a + (v !== 0), 0) : 0 };
}

test('25 designs, each with its own key, name and note', () => {
  assert.equal(BURSTS.length, 25);
  assert.equal(new Set(BURSTS.map((b) => b.key)).size, 25);
  assert.equal(new Set(BURSTS.map((b) => b.name)).size, 25);
  for (const b of BURSTS) assert.ok(b.note.length > 15 && b.frames >= 8 && b.frames <= 24, b.key);
});

test('every burst disturbs the field, and the cold field repairs it afterwards', () => {
  for (const b of BURSTS) {
    const r = play(b);
    assert.ok(r.touched > W * H * 0.02, `${b.key}: touched only ${r.touched}`);
    assert.ok(r.after > 0.8, `${b.key}: the picture came back only to ${r.after.toFixed(3)}`);
    assert.equal(r.clamped, 0, `${b.key}: left lights clamped`);
  }
});

test('the wiring designs fall back to straight wires when a scene has no paths', () => {
  for (const key of ['spike-storm', 'columns-fire', 'fibre-rush']) assert.ok(play(BURSTS.find((b) => b.key === key), false).touched > 100, key);
});

test('control: a field with no burst is not disturbed by the player', () => {
  const { F } = settled();
  const before = Int8Array.from(F.s);
  const player = createBurstPlayer();
  assert.equal(player.step(F), false);
  assert.deepEqual(F.s, before);
  assert.equal(F.flashing, false);
});

test('the dramatic ones really drop the picture before it returns (a burst is not decoration)', () => {
  for (const key of ['negative', 'heat-pulse', 'checker-flip']) assert.ok(play(BURSTS.find((b) => b.key === key)).minR < 0.5, key);
});

test('the deck (THE DECK RULE): 25 different designs a round, a fresh shuffle each round, no repeat across the seam; seeded', () => {
  const d = createBurstDeck(42);
  const first = Array.from({ length: 25 }, () => d.next().key);
  assert.equal(new Set(first).size, 25, 'no repeat before all 25 are used');
  const rounds = [first];
  for (let k = 0; k < 7; k++) rounds.push(Array.from({ length: 25 }, () => d.next().key));
  for (const r of rounds) assert.equal(new Set(r).size, 25, 'every design once a round');
  const all = rounds.flat();
  for (let i = 1; i < all.length; i++) assert.notEqual(all[i], all[i - 1], `the same design twice at ${i}`);
  assert.notDeepEqual(rounds[1], first, 'the second round is a fresh shuffle, not the first again');
  assert.equal(d.dealt, 200);
  assert.deepEqual(first, d.order.map((i) => BURSTS[i].key), 'order is the first round');
  assert.deepEqual(createBurstDeck(42).order, d.order, 'same seed, same order');
  assert.notDeepEqual(createBurstDeck(43).order, d.order, 'another seed, another order');
  assert.notDeepEqual(d.order, [...Array(25).keys()], 'shuffled, not the list order');
  assert.deepEqual([...burstDeckOrder(42)].sort((a, b) => a - b), [...Array(25).keys()]);
});
