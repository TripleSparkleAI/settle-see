// THE GLOBAL SETTLE: the registry tracks mount and unmount, a page ripple reaches settles in distance order with
// the right local coordinates, the source and global: false opt out, nothing runs while idle, reduced motion is one
// pulse, PAUSE ALL refuses, and settle() wires a wave into a real lean on its lights.
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
  constructor(left = 0, top = 0, w = 200, h = 100) { this.width = 1; this.height = 1; this.clientWidth = w; this.clientHeight = h; this.left = left; this.top = top; this.ls = {}; }
  getContext() { return stubCtx(); }
  addEventListener(k, fn) { this.ls[k] = fn; }
  removeEventListener(k) { delete this.ls[k]; }
  getBoundingClientRect() { return { left: this.left, top: this.top, width: this.clientWidth, height: this.clientHeight }; }
}
globalThis.OffscreenCanvas = FakeCanvas;
globalThis.requestAnimationFrame = () => 0;

const { createGlobalSettle, globalSettle, settle, GLOBAL_DEFAULTS, nearestPoint } = await import('../src/index.js');

// a registry on a hand-driven clock: frame() only queues, run(t) fires the queue
const rig = (o = {}) => {
  let q = [];
  let t = 0;
  let state = 'running';
  const G = createGlobalSettle({ win: null, now: () => t, frame: (fn) => q.push(fn), state: () => state, ...o });
  return {
    G,
    at(ms) { t = ms; const f = q; q = []; f.forEach((fn) => fn(ms)); },
    queued: () => q.length,
    set state(s) { state = s; },
  };
};
const box = (left, top, width, height, extra = {}) => {
  const log = { waves: [], arrive: [], pulse: [] };
  return { log, entry: { rect: () => ({ left, top, width, height }), wave: (w) => log.waves.push(w), arrive: (a) => log.arrive.push(a), pulse: (p) => log.pulse.push(p), ...extra } };
};

test('the registry tracks mount and unmount', () => {
  const R = rig();
  const a = box(0, 0, 10, 10);
  const b = box(100, 0, 10, 10);
  const offA = R.G.register(a.entry);
  const offB = R.G.register(b.entry);
  assert.equal(R.G.stats().settles, 2);
  offA();
  assert.equal(R.G.stats().settles, 1);
  offB();
  assert.equal(R.G.stats().settles, 0);
});

test('a page ripple reaches settles in distance order, with local coordinates', () => {
  const R = rig();
  const order = [];
  const far = box(2000, 0, 200, 100, { arrive: (a) => order.push(['far', a]) });
  const near = box(300, 0, 200, 100, { arrive: (a) => order.push(['near', a]) });
  const mid = box(900, 0, 200, 100, { arrive: (a) => order.push(['mid', a]) });
  for (const x of [far, near, mid]) R.G.register(x.entry);
  const d = R.G.ripple({ x: 50, y: 50, strength: 1, kind: 'logo' });
  assert.equal(d.scope, 'page');
  // step the clock in frames until the ring has passed every settle
  for (let t = 16; t <= 3000; t += 16) R.at(t);
  assert.deepEqual(order.map((o) => o[0]), ['near', 'mid', 'far']);
  const n = order[0][1];
  assert.equal(n.x, 50 - 300);
  assert.equal(n.y, 50);
  assert.equal(n.d, 250);
  assert.ok(Math.abs(order[1][1].d - 850) < 1e-9);
  // the ring reaches the near settle only once it has travelled 250 px - band (900 px/s => >= ~0.2 s)
  assert.ok(near.log.waves.length > 0 && mid.log.waves.length > 0);
  assert.ok(near.log.waves[0].r + GLOBAL_DEFAULTS.band >= 250);
  // strength falls with distance
  assert.ok(order[2][1].a < order[0][1].a);
  assert.equal(R.G.stats().ripples, 0, 'the ring ends once it has passed everything');
});

test('settles the ring reaches in the same frame still arrive nearest first', () => {
  const R = rig();
  const order = [];
  R.G.register(box(700, 0, 50, 50, { arrive: () => order.push('far') }).entry);
  R.G.register(box(100, 0, 50, 50, { arrive: () => order.push('near') }).entry);
  R.G.ripple({ x: 0, y: 0 });
  R.at(1000); // one long frame: the ring is already 900 px out, past both
  assert.deepEqual(order, ['near', 'far']);
});

test('the source settle is left out of its own page ripple', () => {
  const R = rig();
  const self = box(0, 0, 100, 100, { id: 'logo' });
  const other = box(200, 0, 100, 100);
  R.G.register(self.entry);
  R.G.register(other.entry);
  R.G.ripple({ x: 50, y: 50, source: 'logo' });
  for (let t = 16; t <= 1000; t += 16) R.at(t);
  assert.equal(self.log.arrive.length, 0);
  assert.equal(other.log.arrive.length, 1);
});

test('nothing runs while no ripple travels: no frame is scheduled and the frame counter holds', () => {
  const R = rig();
  R.G.register(box(0, 0, 100, 100).entry);
  for (let t = 16; t <= 500; t += 16) R.at(t);
  assert.equal(R.queued(), 0);
  assert.equal(R.G.stats().frames, 0);
  R.G.ripple({ x: 10, y: 10 });
  assert.equal(R.queued(), 1, 'a ripple schedules one frame');
  for (let t = 16; t <= 4000; t += 16) R.at(t);
  const f = R.G.stats().frames;
  assert.ok(f > 0);
  for (let t = 4016; t <= 6000; t += 16) R.at(t);
  assert.equal(R.G.stats().frames, f, 'idle again: no more frames');
  assert.equal(R.queued(), 0);
});

test('a local ripple travels nowhere and only reaches listeners', () => {
  const R = rig();
  const a = box(0, 0, 100, 100);
  R.G.register(a.entry);
  const heard = [];
  const off = R.G.onRipple((d) => heard.push(d));
  const d = R.G.ripple({ x: 10, y: 10, scope: 'local', kind: 'click', sound: true, source: 'hero' });
  assert.equal(R.queued(), 0);
  assert.equal(a.log.arrive.length + a.log.waves.length, 0);
  assert.equal(heard.length, 1);
  assert.equal(heard[0].sound, true);
  assert.equal(d.kind, 'click');
  off();
  R.G.ripple({ x: 10, y: 10, scope: 'local' });
  assert.equal(heard.length, 1);
});

test('reduced motion: one soft pulse per settle, in distance order, and no ring', () => {
  const R = rig({ reduced: () => true });
  const order = [];
  R.G.register(box(1200, 0, 100, 100, { pulse: () => order.push('b') }).entry);
  R.G.register(box(200, 0, 100, 100, { pulse: () => order.push('a') }).entry);
  const d = R.G.ripple({ x: 0, y: 0 });
  assert.equal(d.reduced, true);
  assert.deepEqual(order, ['a', 'b']);
  assert.equal(R.queued(), 0);
  assert.equal(R.G.stats().ripples, 0);
});

test('PAUSE ALL (and a hidden tab) refuses a ripple and drops a live one', () => {
  const R = rig();
  const a = box(500, 0, 100, 100);
  R.G.register(a.entry);
  R.G.ripple({ x: 0, y: 0 });
  R.state = 'held';
  R.at(16);
  assert.equal(R.G.stats().ripples, 0);
  assert.equal(R.G.ripple({ x: 0, y: 0 }), null);
  R.state = 'running';
  assert.ok(R.G.ripple({ x: 0, y: 0 }));
});

test('a ripple with no position is refused', () => {
  const R = rig();
  assert.equal(R.G.ripple({}), null);
  assert.equal(R.G.ripple({ x: NaN, y: 1 }), null);
});

test('nearestPoint is zero inside a rectangle and the edge distance outside', () => {
  const r = { left: 10, top: 10, width: 10, height: 10 };
  assert.equal(nearestPoint(15, 15, r), 0);
  assert.equal(nearestPoint(0, 15, r), 10);
  assert.equal(nearestPoint(23, 24, r), 5);
});

test('settle() registers itself on the page registry, and global: false opts out', () => {
  const G = globalSettle();
  const before = G.stats().settles;
  const h = settle(new FakeCanvas(), { res: [40, 20], motion: 'always' });
  assert.equal(G.stats().settles, before + 1);
  const o = settle(new FakeCanvas(), { res: [40, 20], motion: 'always', global: false });
  assert.equal(G.stats().settles, before + 1, 'global: false stays out');
  h.destroy();
  o.destroy();
  assert.equal(G.stats().settles, before, 'destroy unregisters');
});

test('a page ripple passing through a settle leans its lights on the wavefront and kicks its temperature', () => {
  const seen = { T: [] };
  const P = globalSettle();
  const c2 = new FakeCanvas(400, 0, 200, 100);
  const h2 = settle(c2, { res: [40, 20], motion: 'always', still: true, shape: 'dots', afterStep: (F, i) => seen.T.push(i.T) });
  h2.advance(3);
  const T0 = seen.T.at(-1);
  P.ripple({ x: 300, y: 50, strength: 1 });
  // run the page registry's frames by hand at ring radii that cross the canvas (100 .. 400 px from the origin)
  P.tick(performance.now() + 250); // r ~ 225 px: reaching in
  h2.advance(1);
  const T1 = seen.T.at(-1);
  assert.ok(T1 > T0, `the arrival kicks the temperature (${T0} -> ${T1})`);
  P.tick(performance.now() + 330); // r ~ 300 px: the crest crosses the middle of the canvas
  h2.advance(1);
  assert.ok(h2.field.holding, 'the wavefront holds lights');
  h2.advance(80);
  assert.ok(Math.abs(seen.T.at(-1) - T0) < 1e-6, 'the kick fades and the picture goes back to its own temperature');
  P.clear();
  h2.destroy();
});

test('a settle with audio: a click is a local ripple asking for a sound; Enter on it counts as a click at its centre', () => {
  const P = globalSettle();
  const heard = [];
  const off = P.onRipple((d) => heard.push(d));
  const c = new FakeCanvas(0, 0, 200, 100);
  const h = settle(c, { res: [40, 20], motion: 'always', audio: true, globalId: 'hero' });
  assert.equal(c.tabIndex, 0, 'a settle with sound is reachable by keyboard');
  c.ls.pointerdown({ clientX: 20, clientY: 30, timeStamp: 1 });
  assert.equal(heard.length, 1);
  assert.equal(heard[0].scope, 'local');
  assert.equal(heard[0].sound, true);
  assert.equal(heard[0].source, 'hero');
  c.ls.keydown({ key: 'Enter', preventDefault() {}, timeStamp: 2 });
  assert.equal(heard.length, 2);
  assert.equal(heard[1].x, 100);
  assert.equal(heard[1].y, 50);
  c.ls.keydown({ key: 'a', preventDefault() {} });
  assert.equal(heard.length, 2, 'other keys do nothing');
  h.destroy();
  const q = new FakeCanvas();
  const h3 = settle(q, { res: [40, 20], motion: 'always' });
  q.ls.pointerdown({ clientX: 20, clientY: 30, timeStamp: 3 });
  assert.equal(heard.length, 2, 'a settle without sound sends nothing');
  assert.equal(q.ls.keydown, undefined);
  h3.destroy();
  off();
});
