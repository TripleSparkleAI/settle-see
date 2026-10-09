// THE ITEM LOOK (lane HEROHYPER): an item's own neonLook lights it in other neons unless the caller turned item looks
// off; an item without one draws exactly as before.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, fillCells, makeColours, withItemLook, resolveItemLook, ITEM_LOOK_KEYS, RENDER_DEFAULTS, NEON, rgb, tint } from '../src/index.js';

const PINK = '#ff46bd'; // a test fixture: the site's hyper pink token's value (the site test reads the token itself)
const HYPER = { yes: PINK, coreMix: 0.9, glow: 1.5 };
const stripes = (w, h) => Int8Array.from({ length: w * h }, (_, i) => ((i % w) < w / 2 ? 1 : -1));

function fill(o) {
  const F = createField({ w: 24, h: 12, target: stripes(24, 12), seed: 3 });
  for (let k = 0; k < 10; k++) { F.sweep(1 / 0.6); F.soften(0.55); }
  const d = new Uint8ClampedArray(F.n * 4);
  const k = new Uint8ClampedArray(F.n * 4);
  fillCells(F, {}, o, makeColours(o), d, k);
  return { d, k };
}

test('an item with a neonLook is lit in its own neon, with a hotter core', () => {
  const o = withItemLook({ ...RENDER_DEFAULTS }, HYPER);
  const c = makeColours(o);
  assert.deepEqual(c.yes, rgb(PINK));
  assert.deepEqual(c.coreYes, tint(PINK, 0.9));
  assert.equal(o.glow, 1.5);
  // the noise against the lean stays orange: heat keeps its meaning
  assert.deepEqual(c.heat, makeColours({ ...RENDER_DEFAULTS }).heat);
});

test('an item without a neonLook draws byte for byte as before', () => {
  const before = fill({ ...RENDER_DEFAULTS, dim: 0.07 });
  const after = fill(withItemLook({ ...RENDER_DEFAULTS, dim: 0.07 }, resolveItemLook({ word: 'A' })));
  assert.deepEqual(after.d, before.d);
  assert.deepEqual(after.k, before.k);
  // positive control: the same field in the item look gives other bytes
  const hyper = fill(withItemLook({ ...RENDER_DEFAULTS, dim: 0.07 }, resolveItemLook({ word: 'A', neonLook: HYPER })));
  assert.notDeepEqual(hyper.d, before.d);
});

test('item looks off (a page\'s own colours, a 40 Hz light, a colour shift): the caller\'s colours win', () => {
  for (const color of ['meaning', 'single', 'duo']) {
    const o = withItemLook({ ...RENDER_DEFAULTS, color, neon: 'miss', itemLooks: false }, HYPER);
    assert.deepEqual(makeColours(o).yes, rgb(color === 'meaning' ? NEON.yes : NEON.miss), color);
    assert.equal(o.glow, 1, color);
  }
  // positive control: on, a duo look takes the item's lit and unlit neons
  const duo = makeColours(withItemLook({ ...RENDER_DEFAULTS, color: 'duo', neon: 'miss' }, { neon: '#33f0ff', off: PINK }));
  assert.deepEqual(duo.yes, rgb('#33f0ff'));
  assert.deepEqual(duo.off, rgb(PINK));
});

test('a function neonLook is read when asked, so a live item may change its look mid-slot', () => {
  let k = 0;
  const looks = [null, HYPER];
  const item = { live: () => null, neonLook: () => looks[k] };
  assert.equal(resolveItemLook(item), null);
  k = 1;
  assert.equal(resolveItemLook(item), HYPER);
});

test('every item-look key is always present, so set() never keeps the last item\'s colour', () => {
  const plain = withItemLook({ ...RENDER_DEFAULTS }, resolveItemLook({ word: 'B' }));
  for (const k of ITEM_LOOK_KEYS) assert.ok(k in plain && plain[k] !== undefined, k);
  assert.deepEqual(makeColours(plain).yes, rgb(NEON.yes));
});

// THE MOUNT: settle() re-makes its colours when the item showing changes to one with a different neonLook. A 2d
// context stand-in that records every putImageData, so the cell colours the renderer drew can be read back.
const puts = [];
const recCtx = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)), width: w, height: h });
    if (k === 'putImageData') return (img) => puts.push(Uint8ClampedArray.from(img.data));
    if (k === 'measureText') return () => ({ width: 1 });
    return () => ({ addColorStop() {} });
  },
  set(t, k, v) { t[k] = v; return true; },
});
// one frame queue for the whole file: settle-see's shared ticker keeps the requestAnimationFrame it first saw
let frames = [];
const tick = (now) => { const g = frames; frames = []; g.forEach((fn) => fn(now)); };
class RecCanvas {
  constructor(w = 1, h = 1) { this.width = w; this.height = h; this.clientWidth = 200; this.clientHeight = 100; }
  getContext() { return recCtx(); }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}

test('settle(): an item with a neonLook is drawn in it from its first frame, and the next plain item in rose again', async () => {
  globalThis.OffscreenCanvas = RecCanvas;
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  const { settle } = await import('../src/index.js');
  const third = (f) => (f < 30 ? 0 : f < 60 ? 1 : 2);
  // the colour of the brightest lit cell in the last drawn cell image
  const litColour = () => {
    const d = puts.at(-1);
    let best = [0, 0, 0];
    for (let p = 0; p < d.length; p += 4) if (d[p] + d[p + 1] + d[p + 2] > best[0] + best[1] + best[2]) best = [d[p], d[p + 1], d[p + 2]];
    return best;
  };
  let now = 0;
  const h2 = settle(new RecCanvas(), {
    items: [{ bits: stripes(32, 16) }, { bits: stripes(32, 16), neonLook: HYPER }, { bits: stripes(32, 16) }],
    res: [32, 16], fps: 1000, motion: 'always', core: false,
    schedule: (f) => ({ T: 0.05, phase: 'hold', index: third(f) }),
  });
  const colours = [];
  for (let k = 0; k < 90; k++) {
    tick((now += 2));
    if (k === 20 || k === 50 || k === 80) colours.push([h2.stats()?.index, ...litColour()]);
  }
  h2.destroy();
  assert.deepEqual(colours[0], [0, ...rgb(NEON.yes)], 'the plain item: rose');
  assert.deepEqual(colours[1], [1, ...rgb(PINK)], 'the item with a neonLook: its own neon');
  assert.deepEqual(colours[2], [2, ...rgb(NEON.yes)], 'the next plain item: rose again, nothing kept');
});

test('settle(): a function neonLook switches the colours mid-item, the moment it answers another look, even at rest', async () => {
  const { settle } = await import('../src/index.js');
  let f = 0;
  const h = settle(new RecCanvas(), {
    items: [{ bits: stripes(32, 16), neonLook: () => (f >= 40 ? HYPER : null) }],
    res: [32, 16], fps: 1000, motion: 'always', core: false, rest: true, restAfter: 4,
    schedule: (n) => ({ T: 0.02, phase: 'hold', index: 0 }),
  });
  const lit = () => {
    const d = puts.at(-1);
    let best = [0, 0, 0];
    for (let p = 0; p < d.length; p += 4) if (d[p] + d[p + 1] + d[p + 2] > best[0] + best[1] + best[2]) best = [d[p], d[p + 1], d[p + 2]];
    return best;
  };
  let now = 1000;
  const seen = [];
  for (let k = 0; k < 60; k++) { f = k; tick((now += 2)); if (k === 15 || k === 55) seen.push(lit()); }
  h.destroy();
  assert.deepEqual(seen[0], rgb(NEON.yes));
  assert.deepEqual(seen[1], rgb(PINK));
});
