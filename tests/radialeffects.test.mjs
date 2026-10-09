// THE RADIAL EFFECTS (radialeffects.js, lane SOUNDSHAKE) and THE WEATHER option (weather.js): the family is named and
// bounded, a user's click draws exactly what it drew before the family existed, each sound member draws its own
// variation, the bus times, fades, caps and confines each member, and a weather moves the settle's own knobs only.
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
  setAttribute() {}
  removeAttribute() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}
globalThis.OffscreenCanvas = FakeCanvas;
let frames = [];
globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };

const {
  RADIAL_EFFECTS, EFFECT_KEYS, SOUND_EFFECTS, effectOf, ringCells, onSpoke, effectHolds, createRadialPulse, RADIAL_DEFAULTS,
  WEATHER_NEUTRAL, WEATHER_LIMITS, weatherOf, settle,
} = await import('../src/index.js');

test('THE FAMILY: four named members, a user\'s click and three sound pops, each bounded and complete', () => {
  assert.deepEqual(EFFECT_KEYS, ['click', 'shimmer', 'double', 'spokes']);
  assert.deepEqual(SOUND_EFFECTS, ['shimmer', 'double', 'spokes']);
  assert.equal(RADIAL_EFFECTS.click.from, 'user');
  for (const k of EFFECT_KEYS) {
    const e = RADIAL_EFFECTS[k];
    for (const f of ['speed', 'band', 'fade', 'crest', 'kick', 'cap']) assert.ok(Number.isFinite(e[f]) && e[f] >= 0, `${k}.${f}`);
    assert.ok(e.cap <= 1 && e.kick <= 0.35, k);
    assert.equal(typeof e.label, 'string');
    assert.ok(Object.isFrozen(e));
  }
  // the sound's members are softer than a click and say nothing under reduced motion
  for (const k of SOUND_EFFECTS) {
    assert.ok(RADIAL_EFFECTS[k].cap < 1, k);
    assert.ok(RADIAL_EFFECTS[k].kick < RADIAL_EFFECTS.click.kick, k);
    assert.equal(RADIAL_EFFECTS[k].still, false, k);
  }
  assert.equal(RADIAL_EFFECTS.click.speed, RADIAL_DEFAULTS.speed);
  assert.equal(RADIAL_EFFECTS.click.band, RADIAL_DEFAULTS.band);
  assert.equal(RADIAL_EFFECTS.click.fade, RADIAL_DEFAULTS.fade);
  assert.equal(effectOf('no-such'), RADIAL_EFFECTS.click);
});

// the crest and trough the mount drew before the family existed, written out again as the reference
function oldClick(x, y, R, band, a, w, h) {
  const out = [];
  const b = Math.max(2, band);
  const crest = ringCells(x, y, R, Math.max(1, b * 0.25), w, h, new Set());
  const trough = ringCells(x, y, R - b * 0.4, Math.max(1, b * 0.2), w, h, new Set());
  for (const i of trough) if (!crest.has(i)) out.push([i, -1, a * 0.6]);
  for (const i of crest) out.push([i, 1, a]);
  return out;
}

test('a user\'s CLICK draws exactly the old crest and trough; every other member draws its own variation', () => {
  const w = 120;
  const h = 70;
  for (const [x, y, R, band, a] of [[60, 35, 20, 8, 0.9], [-30, 10, 70, 14, 0.4], [100, 60, 5, 3, 1]]) {
    const got = [];
    effectHolds('click', { x, y, R, band, a }, w, h, (i, s, v) => got.push([i, s, v]));
    assert.deepEqual(got, oldClick(x, y, R, band, a, w, h));
  }
  const count = (key, extra = {}) => {
    const c = { up: 0, down: 0, lights: new Set() };
    effectHolds(key, { x: 60, y: 35, R: 24, band: 10, a: 0.5, ...extra }, w, h, (i, s) => { c.lights.add(i); if (s > 0) c.up++; else c.down++; });
    return c;
  };
  const click = count('click');
  const shimmer = count('shimmer');
  const dbl = count('double');
  const spokes = count('spokes');
  assert.ok(click.down > 0, 'a click has its dark trough');
  for (const c of [shimmer, dbl, spokes]) assert.equal(c.down, 0, 'a sound pop never darkens');
  assert.ok(shimmer.up < click.up, 'the shimmer is a thinner ring than a click');
  assert.ok(dbl.up > shimmer.up, 'the double draws two rings');
  assert.ok(spokes.up < click.up / 2, 'the spokes light only narrow wedges');
  // the double's two rings sit 0.7 band apart: lights near R and near R - 7
  const r = [...dbl.lights].map((i) => Math.hypot((i % w) - 60, ((i / w) | 0) - 35));
  assert.ok(r.some((d) => Math.abs(d - 24) < 1.5) && r.some((d) => Math.abs(d - 17) < 1.5));
  // every spoke light is on a spoke; a turn moves them
  for (const i of spokes.lights) assert.ok(onSpoke(i % w, (i / w) | 0, 60, 35, 9, 0.16, 0));
  const turned = count('spokes', { turn: 0.3 });
  assert.notDeepEqual([...turned.lights].sort(), [...spokes.lights].sort());
  // strengths never pass a (the member's own cap is the bus's job)
  effectHolds('double', { x: 60, y: 35, R: 24, band: 10, a: 0.5 }, w, h, (i, s, v) => assert.ok(v <= 0.5 + 1e-12));
});

// a bus on a hand-driven clock
const rig = (o = {}) => {
  let q = [];
  let t = 0;
  const B = createRadialPulse({ win: null, now: () => t, frame: (fn) => q.push(fn), state: () => 'running', reduced: () => false, ...o });
  return { B, at(ms) { t = ms; const f = q; q = []; f.forEach((fn) => fn(ms)); }, run(to, step = 16) { for (let k = t + step; k <= to; k += step) this.at(k); } };
};
const box = (left, top, width = 100, height = 60) => () => ({ left, top, width, height });

test('THE BUS takes each member\'s speed, fade and cap, and a pop with only: id reaches that consumer alone', () => {
  const R = rig();
  const seen = { hero: [], page: [], sound: [] };
  R.B.register({ id: 'hero', rect: box(0, 0, 400, 200), respond: (w) => seen.hero.push(w) });
  R.B.register({ id: 'page', rect: box(0, 300, 400, 200), respond: (w) => seen.page.push(w) });
  R.B.register({ id: 'hero-sound', rect: box(0, 0, 400, 200), arrive: (w) => seen.sound.push(w) });
  const d = R.B.emit({ x: 200, y: 100, strength: 1, effect: 'shimmer', only: 'hero' });
  assert.equal(d.effect, 'shimmer');
  assert.equal(d.strength, RADIAL_EFFECTS.shimmer.cap, 'clamped to the member\'s cap');
  assert.equal(d.speed, RADIAL_EFFECTS.shimmer.speed);
  R.run(2000);
  assert.ok(seen.hero.length > 0, 'the hero answers its pop');
  assert.equal(seen.page.length, 0, 'the page never hears it');
  assert.equal(seen.sound.length, 0, 'nor does the hero\'s sound anchor: no loop of sound into picture into sound');
  assert.ok(seen.hero.every((w) => w.effect === 'shimmer' && w.band === RADIAL_EFFECTS.shimmer.band));
  // the front fades by the member's own fade
  const w = seen.hero.at(-1);
  assert.ok(Math.abs(w.front - w.strength * Math.exp(-w.r / RADIAL_EFFECTS.shimmer.fade)) < 1e-12);
  // a plain emit is a click with the bus's numbers, as before the family
  const c = R.B.emit({ x: 10, y: 10 });
  assert.equal(c.effect, 'click');
  assert.equal(c.speed, RADIAL_DEFAULTS.speed);
  assert.equal(c.strength, 1);
});

test('THE BUS drops the oldest SOUND wave first, and under reduced motion a sound pop sends nothing', () => {
  const R = rig();
  R.B.register({ id: 'hero', rect: box(0, 0, 4000, 4000) });
  R.B.emit({ x: 1, y: 1, kind: 'click-1' });
  for (let k = 0; k < RADIAL_DEFAULTS.maxWaves; k++) R.B.emit({ x: 2000, y: 2000, effect: 'double', only: 'hero' });
  assert.equal(R.B.stats().waves, RADIAL_DEFAULTS.maxWaves);
  // the visitor's click survived eight pops (a pop went instead)
  const kinds = [];
  R.B.register({ id: 'probe', rect: box(0, 0, 50, 50), arrive: (w) => kinds.push(w.kind) });
  R.at(16);
  assert.ok(kinds.includes('click-1'));
  // reduced motion: a click keeps its one still answer, a pop sends none
  const still = [];
  const S = rig({ reduced: () => true });
  S.B.register({ id: 'hero', rect: box(0, 0, 400, 200), still: (w) => still.push(w.effect) });
  S.B.emit({ x: 10, y: 10 });
  const pop = S.B.emit({ x: 10, y: 10, effect: 'spokes', only: 'hero' });
  assert.equal(pop.reduced, true);
  assert.deepEqual(still, ['click']);
  assert.equal(S.B.stats().waves, 0);
});

test('THE WEATHER: neutral by default, every knob bounded, and on a settle it moves heat, lean, pull and rate only', () => {
  assert.deepEqual(weatherOf(null), WEATHER_NEUTRAL);
  const w = weatherOf({ heat: 99, lean: -5, pull: NaN, rate: 0, soften: 2, streak: { strength: 0 } });
  assert.equal(w.heat, WEATHER_LIMITS.heat[1]);
  assert.equal(w.lean, WEATHER_LIMITS.lean[0]);
  assert.equal(w.pull, 1);
  assert.equal(w.rate, WEATHER_LIMITS.rate[0]);
  assert.equal(w.soften, WEATHER_LIMITS.soften[1]);
  assert.equal(w.streak, null);
  // on a settle: T is multiplied (the step hook sees it), lean and pull are the settle's own times the weather, reset
  // every frame, and the sweep rate carries its fraction
  let W = { heat: 1.2, lean: 0.9, pull: 1.25, rate: 0.5 };
  const seen = [];
  const h = settle(new FakeCanvas(), { shape: 'vinyl', res: [40, 20], schedule: { kind: 'fixed', T: 1 }, lean: 0.8, pull: 0.4, motion: 'always', weather: () => W, beforeStep: (F, i) => seen.push({ T: i.T, lean: F.lean, pull: F.pull }) });
  const s0 = h.field.sweeps;
  h.advance(10);
  assert.ok(seen.every((x) => Math.abs(x.T - 1.2) < 1e-12), 'T x heat');
  assert.ok(seen.every((x) => Math.abs(x.lean - 0.72) < 1e-12 && Math.abs(x.pull - 0.5) < 1e-12), 'lean and pull from the settle\'s own');
  assert.equal(h.field.sweeps - s0, 5, 'half the sweeps at rate 0.5');
  W = null;
  seen.length = 0;
  h.advance(2);
  assert.ok(seen.every((x) => x.T === 1 && x.lean === 0.8 && x.pull === 0.4), 'a null weather gives the settle back exactly');
  // the streak holds a band of lights for one frame and lets it go the next
  W = { streak: { x: 0.5, y: 0.5, tilt: 0, width: 1.6, reach: 0.4, strength: 0.4, shimmer: 0 } };
  h.advance(1);
  const held = [...h.field.held].filter((v) => v > 0).length;
  assert.ok(held > 10, `the streak holds ${held} lights`);
  W = null;
  h.advance(1);
  // the streak's lights are let go (the trail fades what the step did not clear; nothing new is held at full)
  assert.ok([...h.field.held].every((v) => v < 0.4));
  h.destroy();
});
