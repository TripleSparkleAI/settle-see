// THE RADIAL PULSE BUS (radialpulse.js, lane RADIALPULSE): a wave reaches a consumer after the right delay and with the
// right falloff and direction, off-screen consumers are skipped, one frame serves every consumer and none runs idle,
// the source is skipped, reduced motion is one still answer, PAUSE ALL refuses, the 40 Hz lights answer of their own
// accord, THE GLOBAL SETTLE rides the bus, and the scene settle heats and pushes along the front.
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
  constructor(w = 1, h = 1) { this.width = w; this.height = h; this.clientWidth = 140; this.clientHeight = 70; this.attrs = {}; }
  getContext() { return stubCtx(); }
  setAttribute(k, v) { this.attrs[k] = v; }
  removeAttribute(k) { delete this.attrs[k]; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}
globalThis.OffscreenCanvas = FakeCanvas;
globalThis.requestAnimationFrame = () => 0;

const {
  createRadialPulse, RADIAL_DEFAULTS, arrivalMs, falloff, onScreen, createGlobalSettle, createFortyHz, createSceneSettle, pulsePrims, SCENE_DEFAULTS,
} = await import('../src/index.js');

// a bus on a hand-driven clock: frame() only queues, run(t) fires the queue
const rig = (o = {}) => {
  let q = [];
  let t = 0;
  let state = 'running';
  const B = createRadialPulse({ win: null, now: () => t, frame: (fn) => q.push(fn), state: () => state, reduced: () => false, ...o });
  return {
    B,
    at(ms) { t = ms; const f = q; q = []; f.forEach((fn) => fn(ms)); },
    run(to, step = 16) { for (let k = t + step; k <= to; k += step) this.at(k); },
    queued: () => q.length,
    set state(s) { state = s; },
  };
};
const box = (left, top, width, height, extra = {}) => {
  const log = { respond: [], arrive: [], leave: [], still: [] };
  const entry = { rect: () => ({ left, top, width, height }) };
  for (const k of Object.keys(log)) entry[k] = (w) => log[k].push(w);
  return { log, entry: { ...entry, ...extra } };
};

test('arrivalMs and falloff: the delay is (d - band) / speed and the gradient is strength * exp(-d / fade)', () => {
  assert.equal(arrivalMs(RADIAL_DEFAULTS.band), 0);
  assert.ok(Math.abs(arrivalMs(956) - 1000) < 1e-9, '956 px away, 56 of band: one second at 900 px/s');
  assert.equal(falloff(0), 1);
  assert.ok(Math.abs(falloff(1400) - Math.exp(-1)) < 1e-12);
  assert.ok(Math.abs(falloff(700, 0.5) - 0.5 * Math.exp(-0.5)) < 1e-12);
});

test('a pulse reaches a consumer after the right delay, with the right falloff and direction, and leaves after it', () => {
  const R = rig();
  const c = box(1000, 0, 100, 100); // nearest point 1000 px to the right, far corner at hypot(1100, 100)
  R.B.register(c.entry);
  const d = R.B.emit({ x: 0, y: 0, strength: 1, kind: 'test' });
  assert.equal(d.kind, 'test');
  assert.equal(d.reduced, false);
  R.run(2000, 10);
  assert.equal(c.log.arrive.length, 1, 'one arrival');
  const a = c.log.arrive[0];
  const expected = arrivalMs(1000);
  assert.ok(a.dt >= expected && a.dt < expected + 10, `arrives at ${a.dt} ms, expected ${expected} (one frame late at most)`);
  assert.ok(Math.abs(a.a - falloff(1000)) < 1e-12, 'the gradient at the consumer');
  assert.equal(a.d, 1000);
  assert.equal(a.x, -1000, 'the origin in the consumer\'s own pixels');
  assert.equal(a.y, 0);
  assert.ok(a.dir.x > 0.99 && Math.abs(a.dir.y) < 0.05, 'the direction points from the origin to the consumer\'s centre');
  assert.ok(a.phase >= 0 && a.phase < 0.05, `the phase starts at the front's first contact (${a.phase})`);
  assert.ok(c.log.respond.length > 5, `respond ran every frame while the band crossed (${c.log.respond.length})`);
  const phases = c.log.respond.map((w) => w.phase);
  for (let i = 1; i < phases.length; i++) assert.ok(phases[i] >= phases[i - 1], 'the phase only rises');
  assert.ok(phases.at(-1) > 0.9);
  assert.equal(c.log.leave.length, 1, 'one leave once the band has passed the far corner');
  assert.ok(c.log.leave[0].dt > a.dt + a.passMs - 20);
  assert.equal(R.B.stats().waves, 0, 'the wave ends once it has passed everything');
});

test('consumers are reached nearest first, even when one long frame carries the front past them all', () => {
  const R = rig();
  const order = [];
  R.B.register(box(700, 0, 50, 50, { arrive: () => order.push('far') }).entry);
  R.B.register(box(100, 0, 50, 50, { arrive: () => order.push('near') }).entry);
  R.B.emit({ x: 0, y: 0 });
  R.at(1000);
  assert.deepEqual(order, ['near', 'far']);
});

test('off-screen consumers are skipped: no arrive, no respond, nothing', () => {
  let view = { left: 0, top: 0, width: 1000, height: 800 };
  const R = rig({ viewport: () => view });
  const on = box(300, 100, 100, 100);
  const below = box(300, 3000, 100, 100); // far down the page
  R.B.register(on.entry);
  R.B.register(below.entry);
  R.B.emit({ x: 0, y: 0 });
  R.run(6000);
  assert.equal(on.log.arrive.length, 1);
  assert.equal(below.log.arrive.length + below.log.respond.length, 0, 'the one below the fold gets nothing');
  // scrolled down to it, a new wave reaches it
  view = { left: 0, top: 2800, width: 1000, height: 800 };
  R.B.emit({ x: 0, y: 2900 });
  R.run(12000);
  assert.equal(below.log.arrive.length, 1);
  assert.equal(onScreen({ left: 0, top: 0, width: 10, height: 10 }, null), true, 'no viewport: everything is on screen');
  assert.equal(onScreen({ left: 0, top: 1000, width: 10, height: 10 }, { left: 0, top: 0, width: 100, height: 100 }, 100), false);
  assert.equal(onScreen({ left: 0, top: 150, width: 10, height: 10 }, { left: 0, top: 0, width: 100, height: 100 }, 100), true, 'within the margin counts');
});

test('one timer for every consumer and none while idle: a wave schedules one frame, and the counter holds after it', () => {
  const R = rig();
  for (let i = 0; i < 20; i++) R.B.register(box(i * 100, 0, 50, 50).entry);
  R.run(500);
  assert.equal(R.queued(), 0);
  assert.equal(R.B.stats().frames, 0);
  R.B.emit({ x: 0, y: 0 });
  assert.equal(R.queued(), 1, 'one frame for twenty consumers');
  R.B.emit({ x: 10, y: 0 });
  assert.equal(R.queued(), 1, 'a second wave rides the same frame');
  R.run(4000);
  const f = R.B.stats().frames;
  assert.ok(f > 0);
  R.run(6000);
  assert.equal(R.B.stats().frames, f, 'idle again: no more frames');
  assert.equal(R.queued(), 0);
});

test('the source is skipped, a client-space emit adds the scroll, and a bad position is refused', () => {
  const win = { scrollX: 0, scrollY: 500 };
  const R = rig({ win });
  const self = box(0, 500, 100, 100, { id: 'hero' });
  const other = box(200, 500, 100, 100);
  R.B.register(self.entry);
  R.B.register(other.entry);
  const d = R.B.emit({ x: 50, y: 50, space: 'client', source: 'hero' });
  assert.equal(d.y, 550, 'client y plus the scroll');
  R.run(1500);
  assert.equal(self.log.arrive.length, 0, 'the source keeps to its own rings');
  assert.equal(other.log.arrive.length, 1);
  assert.equal(R.B.emit({}), null);
  assert.equal(R.B.emit({ x: NaN, y: 1 }), null);
});

test('reduced motion: one still answer per consumer on screen, nearest first, with the gradient, and no wave', () => {
  const R = rig({ reduced: () => true });
  const order = [];
  R.B.register(box(1200, 0, 100, 100, { still: (w) => order.push(['b', w]) }).entry);
  R.B.register(box(200, 0, 100, 100, { still: (w) => order.push(['a', w]) }).entry);
  const d = R.B.emit({ x: 0, y: 0 });
  assert.equal(d.reduced, true);
  assert.deepEqual(order.map((o) => o[0]), ['a', 'b']);
  assert.equal(order[0][1].reduced, true);
  assert.equal(order[0][1].ms, RADIAL_DEFAULTS.stillMs);
  assert.ok(order[0][1].a > order[1][1].a, 'the nearer one gets the stronger answer');
  assert.equal(R.queued(), 0);
  assert.equal(R.B.stats().waves, 0);
});

test('PAUSE ALL (a held page) refuses a wave and drops a live one', () => {
  const R = rig();
  const c = box(500, 0, 100, 100);
  R.B.register(c.entry);
  R.B.emit({ x: 0, y: 0 });
  R.state = 'held';
  R.at(16);
  assert.equal(R.B.stats().waves, 0);
  assert.equal(R.B.emit({ x: 0, y: 0 }), null);
  assert.equal(R.B.running(), false);
  R.state = 'running';
  assert.ok(R.B.emit({ x: 0, y: 0 }));
});

test('every listener hears every pulse, and unregistering a consumer ends its part', () => {
  const R = rig();
  const heard = [];
  const off = R.B.onPulse((d) => heard.push(d));
  const c = box(300, 0, 100, 100);
  const stop = R.B.register(c.entry);
  R.B.emit({ x: 0, y: 0, kind: 'logo', source: 'logo' });
  assert.equal(heard.length, 1);
  assert.equal(heard[0].kind, 'logo');
  stop();
  R.run(2000);
  assert.equal(c.log.arrive.length, 0, 'gone before the front reached it');
  off();
  R.B.emit({ x: 0, y: 0 });
  assert.equal(heard.length, 1);
});

test('the drawings on the 40 Hz gate answer of their own accord with a brightness animation, unless something registered them', () => {
  const R = rig();
  class El {
    constructor(rect) { this.rect = rect; this.anims = []; this.attrs = {}; this.kids = []; }
    getBoundingClientRect() { return this.rect; }
    setAttribute(k, v) { this.attrs[k] = v; }
    removeAttribute(k) { delete this.attrs[k]; }
    animate(frames, opts) { this.anims.push({ frames, opts }); return {}; }
    contains(el) { return this.kids.includes(el); }
  }
  const gate = createFortyHz({ reduced: () => false });
  const film = new El({ left: 300, top: 0, width: 200, height: 100 });
  const canvas = new El({ left: 900, top: 0, width: 200, height: 100 });
  const wrap = new El({ left: 900, top: 0, width: 200, height: 100 });
  wrap.kids.push(canvas);
  gate.register(film, 'film stage');
  gate.register(wrap, 'hero');
  R.B.attachLights(gate);
  assert.equal(R.B.stats().lights, 2, 'the film stage and the wrap, before anything else registers');
  const explicit = box(900, 0, 200, 100, { el: canvas });
  R.B.register(explicit.entry);
  assert.equal(R.B.stats().lights, 1, 'the wrap round the registered canvas leaves the lights');
  R.B.emit({ x: 0, y: 50, strength: 1 });
  R.run(3000, 10);
  assert.equal(film.anims.length, 1, 'the film stage took one animation');
  const a = film.anims[0];
  assert.match(a.frames[1].filter, /^brightness\(1\.\d+\)$/);
  assert.ok(parseFloat(a.frames[1].filter.slice(11)) <= 1 + RADIAL_DEFAULTS.lightGain + 1e-9);
  assert.ok(a.opts.duration >= 120 && a.opts.duration <= 1400);
  assert.equal(wrap.anims.length, 0, 'a wrap round a registered canvas is left to that consumer');
  assert.equal(explicit.log.arrive.length, 1);
  // a drawing leaving the gate leaves the bus
  gate.lights();
  const off = gate.register(new El({ left: 0, top: 0, width: 10, height: 10 }), 'late');
  assert.equal(R.B.stats().lights, 2);
  off();
  assert.equal(R.B.stats().lights, 1);
});

test('THE GLOBAL SETTLE rides the bus: its ripple is the bus\'s wave, with the mount\'s wave, arrive and pulse shapes', () => {
  let t = 0;
  const q = [];
  const bus = createRadialPulse({ win: null, now: () => t, frame: (fn) => q.push(fn), state: () => 'running', reduced: () => false, watch: false });
  const G = createGlobalSettle({ bus, win: null });
  const other = box(400, 0, 100, 100);
  bus.register(other.entry);
  const waves = [];
  const arrives = [];
  G.register({ id: 'hero', rect: () => ({ left: 200, top: 0, width: 100, height: 100 }), wave: (w) => waves.push(w), arrive: (a) => arrives.push(a) });
  assert.equal(G.stats().settles, 1);
  const d = G.ripple({ x: 0, y: 50, kind: 'logo', source: 'logo' });
  assert.equal(d.scope, 'page');
  for (t = 16; t <= 2000; t += 16) { const f = q.splice(0); f.forEach((fn) => fn(t)); }
  assert.equal(arrives.length, 1);
  assert.ok(arrives[0].kick > 0 && arrives[0].kick <= 0.35);
  assert.equal(arrives[0].d, 200);
  assert.ok(waves.length > 1);
  assert.ok('r' in waves[0] && 'band' in waves[0] && 'a' in waves[0] && 'w' in waves[0]);
  assert.equal(other.log.arrive.length, 1, 'a plain bus consumer answers the settle\'s ripple too');
  assert.equal(G.stats().ripples, 0);
  // a click pulse through the bus skips its own settle and reaches the rest
  const local = G.ripple({ x: 250, y: 50, scope: 'local', source: 'hero', sound: true });
  assert.equal(local.scope, 'local');
  assert.equal(bus.stats().waves, 0, 'a local ripple sends no wave');
});

test('pulsePrims pushes a shape on the front outward and lifts its gain, and leaves the rest alone', () => {
  const prims = [
    { k: 'disc', x: 300, y: 0, r: 10, hue: 1, gain: 0.5 },
    { k: 'disc', x: 1000, y: 0, r: 10, hue: 1, gain: 0.5 },
    { k: 'line', x1: 290, y1: 0, x2: 900, y2: 0, hue: 2, gain: 0.5 },
  ];
  const out = pulsePrims(prims, [{ x: 0, y: 0, r: 300, band: 56, a: 1 }], SCENE_DEFAULTS);
  assert.ok(out[0].x > 300 && out[0].x <= 300 + SCENE_DEFAULTS.pulsePush, `pushed outward (${out[0].x})`);
  assert.equal(out[0].y, 0);
  assert.ok(out[0].gain > 0.5);
  assert.equal(out[1], prims[1], 'a shape far from the front is the same object');
  assert.ok(out[2].x1 > 290 && out[2].x2 === 900, 'a line moves the end on the front only');
  assert.equal(pulsePrims(prims, [], SCENE_DEFAULTS), prims);
});

test('the scene settle heats and brightens along a passing front in live mode, and does nothing per frame in still mode', () => {
  let now = 0;
  let frames = [];
  const saved = globalThis.requestAnimationFrame;
  globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };
  try {
    const renders = [];
    const renderer = ({ w, h }) => ({ pitch: 7, render(F, { paint }) { renders.push(paint); return { width: w, height: h }; }, set() {}, destroy() {} });
    const cv = new FakeCanvas(140, 70);
    const scene = () => [{ k: 'disc', x: 70, y: 35, r: 12, hue: 1, gain: 1 }];
    const S = createSceneSettle(cv, { scene, palette: ['#ff0000', '#00ff00'], renderer, now: () => now, fortyHz: false, platePitch: 7, mode: 'live' });
    const tick = () => { const f = frames.splice(0); f.forEach((fn) => fn(now)); };
    for (now = 50; now <= 3000; now += 50) tick();
    const T0 = S.stats().T;
    const n0 = S.stats().rebuilds;
    const gainBefore = renders.at(-1).gain;
    assert.equal(S.pulse({ id: 1, x: 0, y: 35, r: 60, band: 56, a: 1, phase: 0.2 }), true);
    assert.equal(S.pulses, 1);
    now += 50; tick();
    assert.ok(S.stats().T > T0, `the arrival kicks the temperature (${T0} -> ${S.stats().T})`);
    assert.ok(S.stats().rebuilds > n0, 'the scene is re-read with the shapes pushed');
    const g = renders.at(-1).gain;
    assert.notEqual(g, gainBefore, 'the plate is drawn with the front\'s brightening');
    // an empty light on the front (about 60 px from the origin, up at row 1, clear of the disc) is lit by the crossing
    const col = Math.floor(58 / 7);
    const row = 1;
    const i = row * S.geom.w + col;
    assert.equal(gainBefore[i], 0, 'at rest that light is dark');
    assert.ok(g[i] > 0.3, `the light on the front brightened (${gainBefore[i]} -> ${g[i]})`);
    const far = 2 * S.geom.w + 18; // a light well beyond the front stays as it was
    assert.equal(g[far], gainBefore[far]);
    assert.equal(S.pulseEnd(1), true);
    assert.equal(S.pulses, 0);
    S.destroy();
    const still = createSceneSettle(new FakeCanvas(140, 70), { scene, palette: ['#ff0000', '#00ff00'], renderer, now: () => now, fortyHz: false, platePitch: 7, mode: 'still' });
    const f0 = frames.length;
    assert.equal(still.pulse({ id: 2, x: 0, y: 0, r: 10, band: 56, a: 1 }), false, 'still mode takes no wave');
    assert.equal(frames.length, f0, 'and schedules nothing');
    still.destroy();
  } finally {
    globalThis.requestAnimationFrame = saved;
  }
});
