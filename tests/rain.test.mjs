// RAIN AND WATERFALLS OF LIGHT (lane HERORAIN): the rain is a stochastic process whose spawns are column p-bits drawn
// by the tanh rule; the same seed and ticks draw the same rain at any frame rate; a waterfall crowds its stream and
// breathes mist at its pool; the paint lights a streak's head brightest. Also THE ITEM'S OWN PAINT (an item's
// livePaint draws in its own palette, with the held trail and the flashes over it) and THE ITEM'S OWN STEP (an item's
// beforeStep runs each frame it shows). Each claim carries a control.
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
  constructor(w = 1, h = 1) { this.width = w; this.height = h; this.clientWidth = 200; this.clientHeight = 100; }
  getContext() { return stubCtx(); }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}
globalThis.OffscreenCanvas = FakeCanvas;
globalThis.requestAnimationFrame = () => 0;

const { livePaintOf, fillCells, makeColours, createField, RENDER_DEFAULTS, settle } = await import('../src/index.js');
// the rain is its own entry ('settle-see/rain'), kept out of the main index so a page that never rains does not carry it
const { createRain, RAIN_KINDS, RAIN_TICK_MS, pbitP, rainField } = await import('../src/rain.js');

const lit = (b) => b.reduce((a, v) => a + (v > 0), 0);

test('the spawn is a p-bit: P(+1) = (1 + tanh(beta I)) / 2, exactly', () => {
  for (const [I, beta] of [[0, 1], [-1.75, 1], [2, 0.5], [-3.2, 2]]) assert.equal(pbitP(I, beta), (1 + Math.tanh(beta * I)) / 2);
  assert.equal(pbitP(0, 7), 0.5, 'no field: a fair coin at any temperature');
  assert.equal(RAIN_TICK_MS, 40);
});

test('the column field: rain is flat; a waterfall leans its p-bits toward its stream (centre over edge)', () => {
  const rain = rainField(RAIN_KINDS.rain, 100);
  assert.ok(rain.every((v) => v === RAIN_KINDS.rain.base), 'rain: every column the base');
  const wf = rainField(RAIN_KINDS.waterfall, 100);
  const s = RAIN_KINDS.waterfall.streams[0];
  const c = Math.floor(s.x * 100);
  assert.ok(wf[c] > 0, 'the stream centre leans +');
  assert.ok(wf[c] > wf[c + 3] && wf[c + 3] > wf[c + 8], 'the lean falls off from the centre');
  assert.ok(wf[5] < 0 && wf[95] < 0, 'far from the stream it leans -');
});

test('the same seed and ticks draw the same rain, whatever the frame rate that drove them', () => {
  const a = createRain({ kind: 'rain', w: 60, h: 30, seed: 9 });
  const b = createRain({ kind: 'rain', w: 60, h: 30, seed: 9 });
  a.advance(1000);
  for (let i = 0; i < 59; i++) b.advance(1000 / 59);
  b.advance(1); // the accumulator: 59 slices of 16.9 ms plus 1 ms reach the same 25 ticks
  const ba = new Int8Array(60 * 30);
  const bb = new Int8Array(60 * 30);
  a.render(ba);
  b.render(bb);
  assert.equal(a.stats().ticks, 25);
  assert.equal(b.stats().ticks, 25);
  assert.deepEqual([...ba], [...bb]);
  // control: another seed draws other rain
  const c = createRain({ kind: 'rain', w: 60, h: 30, seed: 10 });
  c.advance(1000);
  const bc = new Int8Array(60 * 30);
  c.render(bc);
  assert.notDeepEqual([...bc], [...ba]);
});

test('the spawn rate is the p-bits\' own rate, and the temperature moves it the way the tanh rule says', () => {
  const run = (T) => {
    const R = createRain({ kind: 'rain', w: 200, h: 400, seed: 4, T, maxDrops: 1000 });
    R.warm(RAIN_TICK_MS * 400); // warm: advance clamps one call to a second, so a long run goes in slices
    assert.equal(R.stats().ticks, 400);
    return R.stats().spawned / (200 * 400);
  };
  const p1 = pbitP(RAIN_KINDS.rain.base, 1);
  const m1 = run(1);
  assert.ok(Math.abs(m1 - p1) < 0.004, `measured ${m1.toFixed(4)} against the rule's ${p1.toFixed(4)}`);
  const hot = run(10);
  assert.ok(Math.abs(hot - pbitP(RAIN_KINDS.rain.base, 0.1)) < 0.01, 'hot: near a fair coin');
  assert.ok(hot > 10 * m1, 'heat makes it rain everywhere');
  const cold = run(0.4);
  assert.ok(cold < m1 / 20, 'cold: the base leans every column off');
});

test('a waterfall crowds its stream, sprays at its edges and breathes mist at its pool; rain does not', () => {
  const W = 120;
  const H = 80;
  const R = createRain({ kind: 'waterfall', w: W, h: H, seed: 2 });
  const cols = new Float64Array(W);
  R.onLand = (d) => { cols[Math.max(0, Math.min(W - 1, Math.round(d.x)))]++; };
  R.warm(4000);
  const c = Math.round(RAIN_KINDS.waterfall.streams[0].x * W);
  let centre = 0;
  let edge = 0;
  for (let x = 0; x < W; x++) {
    if (Math.abs(x - c) <= 2) centre += cols[x];
    else if (Math.abs(x - c) > 12) edge += cols[x];
  }
  assert.ok(centre > 10 * Math.max(1, edge), `centre ${centre} against far ${edge}`);
  const kinds = new Set(R.parts.map((p) => p.kind));
  assert.ok(kinds.has('mist'), 'mist at the pool');
  const pool = Math.round(RAIN_KINDS.waterfall.pool * H);
  const mist = R.parts.filter((p) => p.kind === 'mist');
  assert.ok(mist.every((p) => p.y >= pool - 20), 'mist stays near the pool');
  assert.ok(R.drops.some((d) => d.spray), 'some drops spray sideways');
  // control: rain has no mist and no spray
  const rain = createRain({ kind: 'rain', w: W, h: H, seed: 2 });
  rain.warm(4000);
  assert.ok(!rain.parts.some((p) => p.kind === 'mist'));
  assert.ok(!rain.drops.some((d) => d.spray));
});

test('the paint: a streak\'s head is its brightest light, its tail falls off, and it wears its own colour', () => {
  const W = 40;
  const H = 60;
  const R = createRain({ kind: 'rain', w: W, h: H, seed: 1, T: 0.05 }); // cold: no spawn of its own
  R.drops.push({ x: 10, y: 40, vx: 0, vy: 30, len: 20, b: 1, hue: 1, z: 1, spray: false, wide: false });
  const bits = new Int8Array(W * H);
  const paint = { hue: new Uint8Array(W * H), gain: new Float32Array(W * H) };
  R.render(bits, paint);
  assert.equal(lit(bits), 20, 'the streak is 20 lights long');
  const at = (y) => paint.gain[y * W + 10];
  assert.equal(at(40), 1, 'the head at full gain');
  assert.ok(at(40) > at(35) && at(35) > at(30) && at(30) > at(22), 'the tail falls off');
  assert.equal(paint.hue[40 * W + 10], 1);
  // the afterglow: once the drop has gone, its cells keep its colour and their gain fades
  R.drops.length = 0;
  R.render(bits, paint);
  assert.equal(lit(bits), 0);
  assert.ok(Math.abs(at(40) - 0.7) < 1e-6, 'one render later the head glows at 0.7');
  assert.equal(paint.hue[40 * W + 10], 1, 'and keeps its colour');
});

test('THE ITEM\'S OWN PAINT: livePaintOf reads it once per draw and makes its colours once; a bad paint is refused', () => {
  const F = createField({ w: 4, h: 2 });
  let calls = 0;
  const paint = { hue: new Uint8Array(8), gain: new Float32Array(8).fill(1) };
  const lp = { palette: ['#ff46bd', '#33f0ff'], paint: () => { calls++; return paint; } };
  const a = livePaintOf({ livePaint: lp }, F, 0);
  const b = livePaintOf({ livePaint: lp }, F, 1);
  assert.equal(calls, 2);
  assert.equal(a.colours, b.colours, 'the colours are made once per livePaint');
  assert.deepEqual(a.colours.palette, [[255, 70, 189], [51, 240, 255]]);
  assert.equal(livePaintOf({ livePaint: { palette: ['#fff'], paint: () => ({ hue: new Uint8Array(3), gain: new Float32Array(3) }) } }, F, 0), null, 'a wrong size is refused');
  assert.equal(livePaintOf({ livePaint: { palette: ['#fff'], paint: () => { throw new Error('x'); } } }, F, 0), null, 'a throw is refused');
  assert.equal(livePaintOf({ word: 'SETTLE' }, F, 0), null, 'a plain item has none');
});

test('THE ITEM\'S OWN PAINT draws two neons in one picture, and the pointer\'s trail still shows over it', () => {
  const F = createField({ w: 4, h: 1 });
  F.m.set([1, 1, 0, 0]);
  const o = { ...RENDER_DEFAULTS, color: 'meaning', dim: 0.16 };
  const colours = makeColours(o);
  const paint = { hue: Uint8Array.from([0, 1, 0, 1]), gain: Float32Array.from([1, 1, 1, 0]) };
  const lp = livePaintOf({ livePaint: { palette: ['#ff46bd', '#33f0ff'], paint: () => paint } }, F, 0);
  const d = new Uint8ClampedArray(16);
  fillCells(F, { paint: { ...paint, mapColours: lp.colours }, time: 0 }, o, colours, d, null);
  assert.deepEqual([...d.slice(0, 3)], [255, 70, 189], 'light 0 lit in the hyper pink');
  assert.deepEqual([...d.slice(4, 7)], [51, 240, 255], 'light 1 lit in the hyper blue');
  assert.deepEqual([...d.slice(8, 11)], [41, 11, 30], 'light 2 unlit: the pink at the dim');
  assert.deepEqual([...d.slice(12, 15)], [0, 0, 0], 'light 3 at gain 0: dark');
  // control: the same field with no item paint draws in the meaning mode's own rose
  const e = new Uint8ClampedArray(16);
  fillCells(F, { time: 0 }, o, colours, e, null);
  assert.notDeepEqual([...e.slice(4, 7)], [51, 240, 255]);
  // the held trail is added over the paint
  F.holdIndex(3, 1, 1);
  const h = new Uint8ClampedArray(16);
  fillCells(F, { paint: { ...paint, mapColours: lp.colours }, time: 0 }, o, colours, h, null);
  assert.ok(h[12] + h[13] + h[14] > 0, 'the held light shows over a dark painted light');
});

test('THE ITEM\'S OWN STEP runs each frame its item shows, and an item\'s paint is drawn unless itemPaints is false', () => {
  const c = { t: 0, now() { return this.t; } };
  let steps = 0;
  let paints = 0;
  const live = (w, h) => new Int8Array(w * h).fill(-1);
  const mk = () => ({ live, T: 0.5, beforeStep: () => { steps++; }, livePaint: { palette: ['#ff46bd'], paint: (F) => { paints++; return { hue: new Uint8Array(F.n), gain: new Float32Array(F.n) }; } } });
  const h = settle(new FakeCanvas(), { items: [mk()], res: [12, 6], schedule: 'fixed', fps: 24, motion: 'always', now: () => c.now() });
  h.advance(10);
  assert.ok(steps >= 10, `the item's step ran ${steps} times in 10 frames`);
  assert.ok(paints >= 1, 'its paint was read for the draw');
  h.destroy();
  // control: itemPaints false keeps the page's colours; a plain item's frames call nothing of the item's
  paints = 0;
  const h2 = settle(new FakeCanvas(), { items: [mk()], res: [12, 6], schedule: 'fixed', fps: 24, motion: 'always', itemPaints: false, now: () => c.now() });
  h2.advance(10);
  assert.equal(paints, 0);
  h2.destroy();
  steps = 0;
  const h3 = settle(new FakeCanvas(), { items: [{ live, T: 0.5 }], res: [12, 6], schedule: 'fixed', fps: 24, motion: 'always', now: () => c.now() });
  h3.advance(10);
  assert.equal(steps, 0);
  // an item's step that throws leaves the frame running
  const h4 = settle(new FakeCanvas(), { items: [{ live, T: 0.5, beforeStep: () => { throw new Error('x'); } }], res: [12, 6], schedule: 'fixed', fps: 24, motion: 'always', now: () => c.now() });
  assert.doesNotThrow(() => h4.advance(5));
  h3.destroy();
  h4.destroy();
});
