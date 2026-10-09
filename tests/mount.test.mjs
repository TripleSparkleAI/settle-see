// The mount tests: settle() on a stand-in canvas (node has none), for the options pages build on: still pictures,
// show(), resting, the step hooks, a programmed schedule, offset and advance.
import test from 'node:test';
import assert from 'node:assert/strict';

// a 2d context that accepts every call and draws nothing; enough for settle() and its renderer to run
const stubCtx = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)) });
    if (k === 'measureText') return () => ({ width: 1 });
    return () => stubObj();
  },
  set(t, k, v) { t[k] = v; return true; },
});
const stubObj = () => ({ addColorStop() {} });
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

const { settle, toTarget, correlation } = await import('../src/index.js');
await (await import('../src/index.js')).loadCreditShapes(); // the credits family loads on demand (lane LAUNCHGATES); its shapes are fixtures here

test('still: the lights start as the target, and show() snaps a new one in', () => {
  const h = settle(new FakeCanvas(), { shape: 'hammingBall', still: true, res: [48, 26], motion: 'always' });
  const t = toTarget('hammingBall', 48, 26);
  assert.equal(correlation(h.field.s, t), 1);
  const bits = Int8Array.from(t, (v) => -v);
  assert.ok(h.show(bits));
  assert.equal(correlation(h.field.s, bits), 1);
  h.advance(30);
  assert.ok(correlation(h.field.s, bits) > 0.98, 'cold enough that the picture holds');
  assert.equal(h.show(new Int8Array(5)), false, 'a wrong-sized pattern is refused');
  h.destroy();
});

test('rest: a quiet still picture stops sweeping until something wakes it', () => {
  const h = settle(new FakeCanvas(), { shape: 'vinyl', still: true, res: [48, 26], fps: 1000, motion: 'always' });
  let now = 0;
  for (let k = 0; k < 40; k++) tick((now += 20));
  const a = h.field.sweeps;
  for (let k = 0; k < 20; k++) tick((now += 20));
  assert.equal(h.field.sweeps, a, 'resting: no sweeps');
  h.seek(0);
  tick((now += 20));
  assert.ok(h.field.sweeps > a, 'seek wakes it');
  h.destroy();
  tick((now += 20));
});

test('the hooks run around every frame with the schedule\'s info, and a hook may clamp', () => {
  const seen = [];
  const h = settle(new FakeCanvas(), {
    res: [24, 12], items: ['dots', 'vinyl'], motion: 'always',
    schedule: (f) => ({ T: 1, phase: f % 10 < 5 ? 'a' : 'b', index: Math.floor(f / 10) }),
    beforeStep: (F, i) => { if (i.frame === 3) F.clamp([0, 1, 2], 1); },
    afterStep: (F, i) => seen.push([i.frame, i.phase, i.index, F.s[0]]),
  });
  h.advance(25);
  assert.equal(seen.length, 25);
  assert.deepEqual(seen[7].slice(0, 3), [7, 'b', 0]);
  assert.deepEqual(seen[12].slice(0, 3), [12, 'a', 1]);
  assert.ok(seen.slice(3).every((x) => x[3] === 1), 'the clamped light stays yes');
  assert.equal(h.stats().index, 2);
  h.destroy();
});

test('offset starts the schedule part way through; reduced motion settles out of sight', () => {
  const h = settle(new FakeCanvas(), { shape: 'dots', res: [48, 26], offset: 123, motion: 'always' });
  assert.equal(h.frame, 123);
  h.destroy();
  globalThis.matchMedia = () => ({ matches: true });
  const r = settle(new FakeCanvas(), { shape: 'hopfieldNet', res: [48, 26], schedule: { kind: 'cycle', heat: 16, cool: 120, hold: 110, reheat: 14 } });
  assert.ok(r.stats().r > 0.85, `reduced motion draws the settled picture: r ${r.stats().r}`);
  assert.equal(r.stats().phase, 'settled');
  r.destroy();
  delete globalThis.matchMedia;
});

test('fit: an exact grid fills its canvas with no margin; without fit it sits at a whole pitch with one', () => {
  const plain = settle(new FakeCanvas(), { shape: 'dots', res: [48, 26], motion: 'always' });
  const fitted = settle(new FakeCanvas(), { shape: 'dots', res: [48, 26], fit: true, motion: 'always' });
  const a = plain.geom;
  const b = fitted.geom;
  assert.equal(a.P, 3);
  assert.ok(a.cw - a.dw > 50, 'the plain grid leaves a margin');
  assert.equal(b.P, 4);
  assert.ok(b.dw <= b.cw && b.dh <= b.ch && (b.dw === b.cw || b.dh === b.ch), `fitted ${b.dw} x ${b.dh} in ${b.cw} x ${b.ch}`);
  plain.destroy();
  fitted.destroy();
});

test('changedOptions hands set() only what moved; a dim change keeps the cycle, an items change restarts it', async () => {
  const { changedOptions } = await import('../src/index.js');
  const items = [{ word: 'A' }, { word: 'B' }];
  const a = { items, dim: 0.07, lean: 0.9, schedule: { kind: 'cycle', cool: 170 } };
  const b = { items: [{ word: 'A' }, { word: 'B' }], dim: 0.2, lean: 0.9, schedule: { kind: 'cycle', cool: 170 } };
  assert.deepEqual(changedOptions(a, b), { dim: 0.2 }, 'an equal items array (a new object) is not a change');
  assert.deepEqual(Object.keys(changedOptions(a, { ...b, items: [{ word: 'C' }] })).sort(), ['dim', 'items']);
  assert.deepEqual(changedOptions(a, a), {});
  const h = settle(new FakeCanvas(), { items, res: [16, 8], schedule: 'cycle', motion: 'always' });
  h.advance(40);
  const f = h.frame;
  h.set(changedOptions(a, b));
  assert.equal(h.frame, f, 'moving the dim does not restart the picture');
  h.set({ items });
  assert.equal(h.frame, 0, 'negative control: handing set() the items does restart it (why the diff matters)');
  h.destroy();
});

test('a flash from a step hook fades by flashDecay each frame, and a flashing still picture does not rest', () => {
  let fire = true;
  const h = settle(new FakeCanvas(), {
    shape: 'vinyl', still: true, res: [48, 26], motion: 'always', flashDecay: 0.5, fps: 1000,
    beforeStep: (F) => { if (fire) F.flash([5, 6], 1); },
  });
  h.advance(1);
  assert.equal(h.field.flashA[5], 0.5, 'flashed to 1 in the hook, faded once in the same frame');
  fire = false;
  h.advance(1);
  assert.equal(h.field.flashA[5], 0.25);
  h.advance(10);
  assert.equal(h.field.flashing, false, 'gone after enough frames');
  // a hook that keeps flashing keeps the picture awake past restAfter
  fire = true;
  let now = 0;
  for (let k = 0; k < 40; k++) tick((now += 20));
  const a = h.field.sweeps;
  for (let k = 0; k < 10; k++) tick((now += 20));
  assert.ok(h.field.sweeps > a, 'still sweeping while it flashes');
  h.destroy();
  tick((now += 20));
});

test('changedOptions: only what changed is passed on, so a change of fps never re-targets a cycling settle', async () => {
  const { changedOptions } = await import('../src/options.js');
  const items = [{ shape: 'star' }, { shape: 'ring' }];
  assert.deepEqual(changedOptions({ items, fps: 8, poke: true }, { items: [...items], fps: 4, poke: true }), { fps: 4 });
  assert.deepEqual(changedOptions({ items, fps: 8 }, { items, fps: 8 }), {});
  // a real change of items is passed on (positive control)
  assert.deepEqual(Object.keys(changedOptions({ items, fps: 8 }, { items: [{ shape: 'star' }], fps: 8 })), ['items']);
});

test('trueTime: the settle switches to the frame the movie holds, and the page quality scales an untagged settle', async () => {
  const { setQuality } = await import('../src/index.js');
  const h = settle(new FakeCanvas(), { items: [{ shape: 'hammingBall' }, { word: 'A' }, { word: 'B' }], res: [40, 20], schedule: 0.4, motion: 'always', trueTime: { periodMs: 40, threshold: 0.6 } });
  assert.ok(h.trueTime, 'the clock exists');
  const t0 = performance.now();
  while (performance.now() - t0 < 300) h.advance(2);
  const hist = h.trueTime.history;
  assert.ok(hist.length >= 2, `snapshots ${hist.length}`);
  for (const s of hist) assert.ok(s.agree >= 0.6);
  assert.ok(new Set(hist.map((s) => s.frame)).size >= 2, 'it moved on with the movie');
  h.destroy();
  // the page quality: a numeric res is scaled, an exact grid and a quality: false settle are not
  setQuality({ resScale: 0.5, fpsScale: 0.5 });
  const a = settle(new FakeCanvas(), { word: 'A', res: 100, motion: 'always' });
  const b = settle(new FakeCanvas(), { word: 'A', res: 100, quality: false, motion: 'always' });
  const c = settle(new FakeCanvas(), { word: 'A', res: [30, 10], motion: 'always' });
  assert.ok(a.geom.w < b.geom.w, `scaled ${a.geom.w} vs ${b.geom.w}`);
  assert.equal(c.geom.w, 30);
  setQuality({ resScale: 1, fpsScale: 1 });
  for (const x of [a, b, c]) x.destroy();
});

// LOGORAW (2026-10-02): a recording canvas. Every 2d call is logged with the fillStyle and composite op it ran under,
// and getContext's options are kept, so the tests can see whether a plate is painted opaque or cleared.
const LOG = [];
const recCtx = (tag) => new Proxy({ fillStyle: '#000', globalCompositeOperation: 'source-over' }, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)) });
    if (k === 'measureText') return () => ({ width: 1 });
    return (...args) => { LOG.push({ tag, k, fill: t.fillStyle, op: t.globalCompositeOperation, args }); return stubObj(); };
  },
  set(t, k, v) { t[k] = v; return true; },
});
class RecCanvas extends FakeCanvas {
  constructor(w, h, tag = 'plate') { super(w, h); this.tag = tag; this.asked = []; }
  getContext(kind, opts) { this.asked.push([kind, opts]); return kind === '2d' ? recCtx(this.tag) : null; }
}

const plateRun = (opts) => {
  LOG.length = 0;
  const saved = globalThis.OffscreenCanvas;
  globalThis.OffscreenCanvas = RecCanvas;
  const cv = new RecCanvas(1, 1, 'canvas');
  const h = settle(cv, { word: 'A', res: [16, 8], motion: 'always', poke: false, global: false, ...opts });
  h.advance(2);
  h.destroy();
  globalThis.OffscreenCanvas = saved;
  return { cv, log: LOG.slice() };
};
// a plate fill runs under 'copy'; target.js paints its word masks black under 'source-over', which is not a plate
const opaqueFills = (log, tag) => log.filter((x) => x.tag === tag && x.k === 'fillRect' && x.fill === '#000' && x.op === 'copy');
const clears = (log, tag) => log.filter((x) => x.tag === tag && x.k === 'clearRect');

test('default: the canvas and the renderer\'s plate are painted opaque black, never cleared', () => {
  const { log } = plateRun({});
  assert.ok(opaqueFills(log, 'canvas').length > 0, 'the canvas is filled #000');
  assert.ok(opaqueFills(log, 'plate').length > 0, 'the plate is filled #000');
  assert.equal(clears(log, 'canvas').length, 0);
  assert.equal(clears(log, 'plate').length, 0);
});

test('background transparent: the canvas and the plate are cleared, never painted opaque', () => {
  const { log } = plateRun({ background: 'transparent' });
  assert.ok(clears(log, 'canvas').length > 0, 'the canvas is cleared');
  assert.ok(clears(log, 'plate').length > 0, 'the plate is cleared');
  assert.equal(opaqueFills(log, 'canvas').length, 0);
  assert.equal(opaqueFills(log, 'plate').length, 0);
});

test('a gl settle asks for an alpha, premultiplied context only when it is transparent', () => {
  const a = plateRun({ renderer: 'gl' }).cv.asked.find(([k]) => k === 'webgl2')[1];
  assert.equal(a.alpha, false, 'the default gl context stays opaque');
  assert.equal(a.premultipliedAlpha, false);
  const b = plateRun({ renderer: 'gl', background: 'transparent' }).cv.asked.find(([k]) => k === 'webgl2')[1];
  assert.equal(b.alpha, true);
  assert.equal(b.premultipliedAlpha, true);
});

// THE PAINT (lane LOGOHOVER, 2026-10-04): the 'map' colour mode reaches settle() through opts.palette and opts.paint
test('map: opts.paint is read at every draw, as a function of the field or as a buffer, and only in the map mode', () => {
  const calls = [];
  const n = 24 * 12;
  const paint = (F, t) => { calls.push([F.n, t]); return { hue: new Uint8Array(n), gain: new Float32Array(n).fill(1) }; };
  const h = settle(new FakeCanvas(), { res: [24, 12], shape: 'dots', color: 'map', palette: ['#ff2b1c', '#ffffff'], paint, motion: 'always' });
  h.advance(1);
  assert.equal(calls.length, 1, 'one draw, one paint');
  assert.equal(calls[0][0], n, 'the paint sees the field');
  assert.equal(typeof calls[0][1], 'number', 'and the draw time in seconds');
  const buf = { hue: new Uint8Array(n).fill(1), gain: new Float32Array(n).fill(0.5) };
  h.set({ paint: buf });
  h.advance(1);
  assert.equal(calls.length, 1, 'a buffer replaces the function: it is not called again');
  h.set({ color: 'single', paint });
  h.advance(1);
  assert.equal(calls.length, 1, 'outside the map mode the paint is never read');
  h.destroy();
});

// THE RESIZE BLACK FRAME (lane WHATPICTURE, 2026-10-04): assigning canvas.width clears the canvas, and a running settle
// used to wait for its next step to draw again, so a canvas whose box kept changing size (a picture inside an auto-sized
// grid column) showed black between steps and blinked. A resize now redraws at once, and a resize that leaves the
// drawing-buffer size as it was does not touch the canvas at all.
test('a resize redraws at once, and a same-size resize leaves the canvas untouched', () => {
  const observers = [];
  const savedRO = globalThis.ResizeObserver;
  globalThis.ResizeObserver = class { constructor(cb) { observers.push(cb); } observe() {} disconnect() {} };
  let calls = 0;
  let sets = 0;
  class CountingCanvas extends FakeCanvas {
    constructor() { super(); this._w = 1; this._h = 1; }
    get width() { return this._w; }
    set width(v) { sets++; this._w = v; }
    get height() { return this._h; }
    set height(v) { sets++; this._h = v; }
    getContext() {
      const inner = stubCtx();
      return new Proxy(inner, { get(t, k) { const v = t[k]; return typeof v === 'function' ? (...a) => { calls++; return v(...a); } : v; }, set(t, k, v) { t[k] = v; return true; } });
    }
  }
  try {
    const c = new CountingCanvas();
    const h = settle(c, { shape: 'heart', res: [48, 26], fps: 30, motion: 'always' });
    assert.equal(observers.length, 1, 'the settle watches its canvas');
    const setsAfterMount = sets;
    observers[0]();
    assert.equal(sets, setsAfterMount, 'same size: width and height are not reassigned (no clear)');
    const before = calls;
    c.clientWidth = 300;
    observers[0]();
    assert.ok(sets > setsAfterMount, 'a new size reallocates the canvas');
    assert.ok(calls > before, 'and the picture is drawn again in the same callback, so no black frame waits for the next step');
    h.destroy();
  } finally {
    globalThis.ResizeObserver = savedRO;
  }
});
