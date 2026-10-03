// The renderer's colour fill: the fast loop and the full loop give the same bytes, and the fill means what it says.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, fillCells, makeColours, RENDER_DEFAULTS } from '../src/index.js';

const stripes = (w, h) => Int8Array.from({ length: w * h }, (_, i) => ((i % w) < w / 2 ? 1 : -1));

function both(F, o, extra = {}) {
  const n = F.n * 4;
  const c = makeColours(o);
  const a = new Uint8ClampedArray(n), ka = new Uint8ClampedArray(n);
  const b = new Uint8ClampedArray(n), kb = new Uint8ClampedArray(n);
  fillCells(F, extra, o, c, a, ka, false);
  fillCells(F, extra, o, c, b, kb, true);
  return { a, b, ka, kb };
}

test('the fast fill gives exactly the full loop\'s bytes, in every colour mode', () => {
  for (const color of ['meaning', 'single', 'duo']) {
    const F = createField({ w: 40, h: 22, target: stripes(40, 22), seed: 4 });
    for (let k = 0; k < 12; k++) { F.sweep(1 / 0.8); F.soften(0.55); }
    const o = { ...RENDER_DEFAULTS, color, dim: 0.07 };
    const { a, b, ka, kb } = both(F, o);
    assert.deepEqual(a, b, color);
    assert.deepEqual(ka, kb, color);
  }
});

test('a clamped light takes the full loop and is drawn in ice', () => {
  const F = createField({ w: 8, h: 8, target: stripes(8, 8), seed: 2 });
  F.clamp([0], 1);
  const o = { ...RENDER_DEFAULTS };
  const c = makeColours(o);
  const d = new Uint8ClampedArray(F.n * 4);
  fillCells(F, {}, o, c, d, null);
  assert.deepEqual([d[0], d[1], d[2]], c.held);
});

test('negative control: an unlit light is dim, a lit one is its neon', () => {
  const F = createField({ w: 2, h: 1, target: Int8Array.of(1, 1), seed: 1 });
  F.m[0] = 1;
  F.m[1] = 0;
  const o = { ...RENDER_DEFAULTS, dim: 0.16 };
  const c = makeColours(o);
  const d = new Uint8ClampedArray(8);
  fillCells(F, {}, o, c, d, null);
  assert.deepEqual([d[0], d[1], d[2]], c.yes);
  assert.deepEqual([d[4], d[5], d[6]], c.off.map((v) => Math.round(v * 0.16)));
});

// LOGORAW (2026-10-02): background 'transparent' draws raw lights with no plate. The cell image carries its light as
// alpha (alpha = the brightest channel), so an unlit light and the gap between dots are see-through.
test('transparent: an unlit light has alpha 0, a lit one keeps its colour as alpha > 0', async () => {
  const { lightAlpha, isClearBackground } = await import('../src/index.js');
  const F = createField({ w: 2, h: 1, target: Int8Array.of(1, 1), seed: 1 });
  F.m[0] = 1;
  F.m[1] = 0;
  const o = { ...RENDER_DEFAULTS, color: 'single', neon: 'yes', dim: 0 };
  const c = makeColours(o);
  const d = new Uint8ClampedArray(8).fill(255);
  fillCells(F, {}, o, c, d, null);
  lightAlpha(d);
  assert.equal(d[7], 0, 'the unlit light is see-through');
  const a = d[3];
  assert.equal(a, Math.max(...c.yes), 'the lit light is as opaque as its brightest channel');
  // composited (premultiplied), the lit light gives back its own colour
  assert.deepEqual([0, 1, 2].map((k) => Math.round((d[k] * a) / 255)), c.yes);
  assert.equal(isClearBackground('transparent'), true);
  assert.equal(isClearBackground(undefined), false, 'the default plate is opaque');
  assert.equal(isClearBackground('#000'), false);
});

test('default: fillCells leaves every alpha byte at 255, so the plate stays opaque', () => {
  const F = createField({ w: 2, h: 1, target: Int8Array.of(1, 1), seed: 1 });
  F.m[0] = 1;
  F.m[1] = 0;
  const o = { ...RENDER_DEFAULTS, dim: 0 };
  const d = new Uint8ClampedArray(8).fill(255);
  fillCells(F, {}, o, makeColours(o), d, null);
  assert.equal(d[3], 255);
  assert.equal(d[7], 255, 'an unlit light is opaque black on the default plate');
});
