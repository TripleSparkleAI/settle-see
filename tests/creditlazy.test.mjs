// The credits family loads on demand (lane LAUNCHGATES, 2026-10-09): the package index carries the family's names
// and notes (creditnames.js) and never the drawings (creditshapes.js, about 19 kB), which load the first time one is
// needed. node runs each test file in its own process, so in this file the drawings start unloaded; the tests run in
// order and the last ones load them.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// a 2d context that accepts every call and draws nothing; enough for settle() to run in node
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

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src');
const see = await import('../src/index.js');
const { settle, toTarget, loadTarget, describe, getShape, shapeNames, isPending, ensureShape, pendingShape, KANERVA, CREDIT_NAMES, CREDIT_NOTES } = see;

// every module the index reaches through static imports (dynamic import() calls are not followed)
function staticClosure(entry) {
  const seen = new Set();
  const walk = (file) => {
    if (seen.has(file)) return;
    seen.add(file);
    const text = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const m of text.matchAll(/\b(?:import|export)\b[^;'"]*?\bfrom\s*['"](\.[^'"]+)['"]|\bimport\s*['"](\.[^'"]+)['"]/g)) {
      walk(join(dirname(file), m[1] || m[2]));
    }
  };
  walk(entry);
  return [...seen].map((f) => f.slice(SRC.length + 1));
}

test('the index reaches the credits names statically and never the drawings', () => {
  const reached = staticClosure(join(SRC, 'index.js'));
  assert.ok(reached.includes('creditnames.js'), 'creditnames.js is reached');
  assert.ok(reached.includes('mount.js') && reached.includes('shapes.js'), `the walk follows imports: ${reached.length} modules`);
  assert.ok(!reached.includes('creditshapes.js'), 'creditshapes.js is reached statically');
});

test('before the drawings load, the family is known by name and note, and pending', () => {
  assert.equal(shapeNames('credits').length, 26);
  assert.deepEqual(shapeNames('credits'), CREDIT_NAMES);
  for (const k of KANERVA) assert.ok(CREDIT_NAMES.includes(k), k);
  for (const n of CREDIT_NAMES) {
    assert.ok(isPending(n), `${n} is pending`);
    assert.equal(getShape(n).bits, undefined, `${n} has no drawing yet`);
    assert.equal(describe(n), CREDIT_NOTES[n], `${n} is described by its note`);
  }
  assert.equal(pendingShape('hammingBall'), 'hammingBall');
  assert.equal(pendingShape({ shape: 'vinyl', invert: true }), 'vinyl');
});

test('control: a built-in shape, a word and an unknown name are never pending', () => {
  assert.equal(pendingShape('heart'), null);
  assert.equal(pendingShape({ word: 'vote' }), null, 'a word spec is a word even when it spells a credits name');
  assert.equal(pendingShape('nosuchshape'), null);
  assert.equal(isPending('heart'), false);
  assert.equal(toTarget('heart', 16, 8).length, 128);
});

test('toTarget refuses a pending shape by name, never drawing it as a word', () => {
  assert.throws(() => toTarget('hammingBall', 48, 26), /hammingBall.*on demand/);
  assert.throws(() => toTarget({ shape: 'vote' }, 48, 26), /vote.*on demand/);
});

test('settle() on a pending shape starts unlit and settles to the drawing when it arrives', async () => {
  const h = settle(new FakeCanvas(), { shape: 'tesseract', still: true, res: [48, 26], motion: 'always' });
  assert.ok(h.field.target.every((v) => v === -1), 'an unlit target while the drawing loads');
  await ensureShape('tesseract');
  await new Promise((r) => setTimeout(r, 0));
  const t = toTarget('tesseract', 48, 26);
  assert.deepEqual(Array.from(h.field.target), Array.from(t), 'the real target once it arrived');
  assert.ok(t.some((v) => v === 1) && t.some((v) => v === -1), 'the drawing is neither blank nor full');
  h.destroy();
});

test('after the load, every drawing matches the eager module and nothing is pending', async () => {
  const eager = await import('../src/creditshapes.js');
  assert.deepEqual(Object.keys(eager.CREDIT_SHAPES), CREDIT_NAMES, 'the names and the drawings are the same list, in order');
  const viaLoad = await loadTarget('hammingBall', 40, 14);
  assert.deepEqual(Array.from(viaLoad), Array.from(eager.CREDIT_SHAPES.hammingBall(40, 14)));
  for (const n of CREDIT_NAMES) {
    assert.equal(isPending(n), false, `${n} still pending`);
    assert.deepEqual(Array.from(toTarget(n, 48, 26)), Array.from(eager.CREDIT_SHAPES[n](48, 26)), n);
    assert.equal(getShape(n).note, CREDIT_NOTES[n], `${n} keeps its note`);
  }
  assert.deepEqual(shapeNames('credits'), CREDIT_NAMES, 'the family keeps its order');
});
