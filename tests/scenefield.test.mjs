// THE SCENE SETTLE (lane SETTLEBG): a vector scene rasterised into lights and settled in full colour; the neon range;
// the 'map' colour mode; the hover as a change of target; the still mode doing no frame work.
import test from 'node:test';
import assert from 'node:assert/strict';

const stubCtx = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)) });
    return () => ({ addColorStop() {} });
  },
  set(t, k, v) { t[k] = v; return true; },
});
class FakeCanvas {
  constructor(w = 1, h = 1) { this.width = w; this.height = h; this.clientWidth = 140; this.clientHeight = 70; this.attrs = {}; }
  getContext() { return stubCtx(); }
  setAttribute(k, v) { this.attrs[k] = v; }
}
globalThis.OffscreenCanvas = FakeCanvas;
let frames = [];
globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
const tick = (now) => { const f = frames; frames = []; f.forEach((fn) => fn(now)); };

const { NEONS, neonRange, hsv, rasterScene, sceneTemperature, createSceneSettle, createField, fillCells, makeColours, RENDER_DEFAULTS, correlation, shuffled, SCENE_DEFAULTS, fortyHz } = await import('../src/index.js');

test('THE NEON RANGE: every neon and every extra hex is in it once, filled to the size by saturated in-between neons', () => {
  const extra = ['#c94dff', '#2ff0ff', '#d4ff00'];
  const r = neonRange(extra, 24);
  assert.equal(r.length, 24);
  for (const n of NEONS) assert.equal(r.filter((x) => x.hex === n.hex).length, 1, n.key);
  for (const e of extra) assert.equal(r.filter((x) => x.hex === e).length, 1, e);
  assert.equal(new Set(r.map((x) => x.hex)).size, 24, 'no colour twice');
  for (const x of r.filter((y) => !y.source)) assert.ok(hsv(x.hex)[1] > 0.6 && hsv(x.hex)[2] > 0.9, `${x.hex} stays a neon`);
  // the saturated ones go round the wheel in order
  const hues = r.filter((x) => hsv(x.hex)[1] >= 0.5).map((x) => hsv(x.hex)[0]);
  let wraps = 0;
  for (let i = 1; i < hues.length; i++) if (hues[i] < hues[i - 1] - 1) wraps++;
  assert.ok(wraps <= 1);
  assert.equal(neonRange([], 10).length, 10, 'never fewer than the sources ask');
});

test('rasterScene: a disc lights the cells it covers, in its hue, and nothing else', () => {
  const geom = { w: 20, h: 10, cell: 10 };
  const r = rasterScene([{ k: 'disc', x: 100, y: 50, r: 25, hue: 3, gain: 1 }], geom);
  const on = [...r.bits].map((b, i) => (b > 0 ? i : -1)).filter((i) => i >= 0);
  assert.ok(on.length >= 16 && on.length <= 32, `about pi r^2 / cell^2 = 20 lights, got ${on.length}`);
  for (const i of on) assert.equal(r.hue[i], 3);
  assert.equal(r.bits[0], -1);
  assert.equal(r.gain[0], 0);
  // the middle is fully covered
  assert.equal(r.gain[5 * 20 + 10], 1);
});

test('rasterScene: a hairline still draws a connected row of lights, and a gradient line walks the palette', () => {
  const geom = { w: 40, h: 10, cell: 7 };
  const r = rasterScene([{ k: 'line', x1: 10, y1: 35, x2: 270, y2: 35, width: 1, hue: 2, hue2: 12, gain: 0.8 }], geom);
  const row = 5;
  let lit = 0;
  for (let x = 2; x < 38; x++) lit += r.bits[row * 40 + x] > 0 ? 1 : 0;
  assert.equal(lit, 36, 'every light along the line');
  assert.equal(r.hue[row * 40 + 2], 2);
  assert.equal(r.hue[row * 40 + 38], 12);
  assert.ok(r.hue[row * 40 + 20] > 5 && r.hue[row * 40 + 20] < 9);
});

test('rasterScene: the brightest shape wins a light; the ground colours the empty cells', () => {
  const geom = { w: 10, h: 10, cell: 10 };
  const r = rasterScene([
    { k: 'disc', x: 50, y: 50, r: 30, hue: 1, gain: 0.3 },
    { k: 'disc', x: 50, y: 50, r: 10, hue: 4, gain: 1 },
  ], geom, { ground: () => ({ hue: 9, gain: 0.2 }) });
  assert.equal(r.hue[5 * 10 + 5], 4, 'the core');
  assert.equal(r.hue[5 * 10 + 7], 1, 'the halo');
  assert.equal(r.hue[0], 9, 'the dust');
  assert.equal(r.bits[0], -1, 'dust is not in the target');
});

test('the map fill: each light its own palette colour times its gain, an empty light black', () => {
  const palette = ['#000000', '#ff0000', '#00ff00'];
  const F = createField({ w: 3, h: 1 });
  F.m.set([1, 1, 0]);
  const paint = { hue: Uint8Array.from([1, 2, 0]), gain: Float32Array.from([1, 0.5, 0]) };
  const o = { ...RENDER_DEFAULTS, color: 'map', palette, dim: 0 };
  const d = new Uint8ClampedArray(12);
  fillCells(F, { paint }, o, makeColours(o), d, null);
  assert.deepEqual([...d.slice(0, 3)], [255, 0, 0]);
  assert.deepEqual([...d.slice(4, 7)], [0, 128, 0]);
  assert.deepEqual([...d.slice(8, 11)], [0, 0, 0]);
  const half = new Uint8ClampedArray(12);
  fillCells(F, { paint }, { ...o, level: 0.5 }, makeColours(o), half, null);
  assert.equal(half[0], 128, 'level caps the picture');
});

test('the temperature: hot, cooling geometrically to cold, kicked up by a new target', () => {
  const o = SCENE_DEFAULTS;
  assert.equal(sceneTemperature(0, 0, o), o.hot);
  const mid = sceneTemperature(o.hotMs + o.coolMs / 2, 0, o);
  assert.ok(Math.abs(mid - Math.sqrt(o.hot * o.cold)) < 1e-9, 'geometric: the halfway point is the geometric mean');
  assert.equal(sceneTemperature(1e6, 0, o), o.cold);
  assert.equal(sceneTemperature(1e6, 0.5, o), o.cold + 0.5);
});

const scene = (st) => {
  const prims = [
    { k: 'disc', x: 35, y: 35, r: 14, hue: 1, gain: 1 },
    { k: 'line', x1: 35, y1: 35, x2: 105, y2: 35, width: 2, hue: 1, hue2: 2, gain: 0.7 },
    { k: 'disc', x: 105, y: 35, r: 10, hue: 2, gain: 0.6 },
  ];
  if (st.pointer) prims.push({ k: 'disc', x: st.pointer.x, y: st.pointer.y, r: 12, hue: 3, gain: 1 });
  return prims;
};
const PAL = neonRange([], 12).map((x) => x.hex);

test('the engine settles a small scene to its target and its colours, and a shuffled target does not match', () => {
  let now = 0;
  const h = createSceneSettle(new FakeCanvas(), { scene, palette: PAL, cell: 7, now: () => now, beat: false, fps: 1000 });
  for (let k = 0; k < 140; k++) tick((now += 20));
  const t = h.field.target;
  const r = correlation(h.field.s, t);
  assert.ok(r > 0.9, `settled r ${r}`);
  assert.ok(correlation(h.field.s, shuffled(t, 5)) < 0.3, 'the shuffled control');
  // the colours: the lit lights read the scene's hues
  const lit = [...t].map((b, i) => (b > 0 ? h.paint.hue[i] : -1)).filter((x) => x >= 0);
  assert.ok(lit.includes(1) && lit.includes(2));
  assert.ok(h.stats().resting, 'cold, quiet: resting');
  h.destroy();
});

test('the hover is a change of target: the pointer adds its shape, the field settles into it, and leaving takes it away', () => {
  let now = 0;
  const h = createSceneSettle(new FakeCanvas(), { scene, palette: PAL, cell: 7, now: () => now, beat: false, fps: 1000 });
  for (let k = 0; k < 140; k++) tick((now += 20));
  const before = Int8Array.from(h.field.target);
  h.pointer({ x: 70, y: 56 });
  for (let k = 0; k < 140; k++) tick((now += 20));
  const cell = Math.floor(56 / 7) * h.geom.w + Math.floor(70 / 7);
  assert.equal(before[cell], -1, 'nothing there before');
  assert.equal(h.field.target[cell], 1, 'the hover put it in the target');
  assert.equal(h.paint.hue[cell], 3, 'in the hover\'s colour');
  assert.ok(h.field.m[cell] > 0.8, 'and the lights settled into it');
  h.pointer(null);
  for (let k = 0; k < 140; k++) tick((now += 20));
  assert.equal(h.field.target[cell], -1, 'leaving takes it away');
  h.destroy();
});

test('still mode (the low CPU mode): pre-settled, drawn once, no ticker entry, zero frame work', () => {
  let now = 0;
  const h = createSceneSettle(new FakeCanvas(), { scene, palette: PAL, cell: 7, now: () => now, mode: 'still', beat: false, fps: 1000 });
  assert.equal(h.live, false);
  assert.ok(correlation(h.field.s, h.field.target) > 0.9, 'already settled');
  const sweeps = h.field.sweeps;
  const f = h.frames;
  for (let k = 0; k < 50; k++) tick((now += 20));
  assert.equal(h.live, false, 'no ticker entry');
  assert.equal(h.field.sweeps, sweeps, 'no sweeps');
  assert.equal(h.frames, f, 'no frames');
  assert.ok(h.stats().stillMs >= 0);
  // negative control: live mode does run frames
  h.setMode('live');
  h.pointer({ x: 70, y: 56 });
  for (let k = 0; k < 10; k++) tick((now += 20));
  assert.ok(h.frames > f, 'live mode runs');
  h.setMode('still');
  const g = h.frames;
  for (let k = 0; k < 10; k++) tick((now += 20));
  assert.equal(h.frames, g, 'back to still: no frames');
  h.destroy();
});

test('the canvas joins the page\'s one 40 Hz clock by its label, and leaves it on destroy; fortyHz: false opts out', () => {
  const cv = new FakeCanvas();
  cv.removeAttribute = (k) => { delete cv.attrs[k]; };
  const h = createSceneSettle(cv, { scene, palette: PAL, mode: 'still', label: 'page background' });
  assert.equal(cv.attrs['data-settle-light'], 'page background');
  assert.ok(fortyHz().lights().includes('page background'));
  h.destroy();
  assert.ok(!fortyHz().lights().includes('page background'));
  assert.equal(cv.attrs['data-settle-light'], undefined);
  const out = new FakeCanvas();
  createSceneSettle(out, { scene, palette: PAL, mode: 'still', fortyHz: false }).destroy();
  assert.equal(out.attrs['data-settle-light'], undefined, 'opted out');
});

test('the bloom mips are drawn with copy, so a clear plate cannot pile faint pixels up frame after frame', async () => {
  const { createRenderer } = await import('../src/index.js');
  const log = [];
  class RecCanvas extends FakeCanvas {
    getContext() {
      const cv = this;
      const ctx = stubCtx();
      ctx.globalCompositeOperation = 'source-over';
      ctx.drawImage = () => log.push({ w: cv.width, h: cv.height, op: ctx.globalCompositeOperation });
      return ctx;
    }
  }
  const was = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = RecCanvas;
  try {
    const R = createRenderer({ w: 40, h: 20, pitch: 3, color: 'map', palette: PAL, clear: true, glow: 1 });
    const F = createField({ w: 40, h: 20 });
    const paint = { hue: new Uint8Array(800).fill(2), gain: new Float32Array(800).fill(0.2) };
    R.render(F, { paint });
    R.render(F, { paint });
  } finally {
    globalThis.OffscreenCanvas = was;
  }
  const mips = log.filter((x) => (x.w === 20 && x.h === 10) || (x.w === 10 && x.h === 5));
  assert.equal(mips.length, 4, 'two mips a frame, two frames');
  for (const m of mips) assert.equal(m.op, 'copy');
});
