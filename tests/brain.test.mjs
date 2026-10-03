// The brain shapes (brainshapes.js): two bands of the brain in four views. Each view settles into itself and a
// shuffled control does not; the two bands are separate and sharp; the six cortical layers and three cerebellar
// layers are labelled in order inside their band; the spike paths run along drawn wires; the views differ.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createField, makeSchedule, toTarget, getShape, shapeNames, correlation, shuffled, brainScene, BRAIN_VIEWS, CORTEX_LAYERS, CEREBELLUM_LAYERS } from '../src/index.js';

const SCHED = { kind: 'cycle', hot: 3.0, cold: 0.45, heat: 16, cool: 120, hold: 110, reheat: 14 };
const END = SCHED.heat + SCHED.cool + SCHED.hold;
function settleTo(target, w, h, seed) {
  const F = createField({ w, h, target, seed, lean: 0.9, pull: 0.3 });
  const s = makeSchedule(SCHED);
  for (let f = 0; f < END; f++) F.sweep(1 / s(f).T);
  return F;
}
// the sizes the footer draws: a phone (390 css px at 2x, P = 2) and a laptop (960 lights across)
const SIZES = [[400, 440], [640, 300]];
const spec = (v) => ({ shape: 'brainbands', view: v.view, eye: v.eye });

test('cortex6, cerebellum and brainbands are registered physics shapes with notes', () => {
  for (const n of ['cortex6', 'cerebellum', 'brainbands']) {
    assert.ok(shapeNames('physics').includes(n), n);
    assert.ok(getShape(n).note.length > 10, n);
  }
  assert.equal(CORTEX_LAYERS.map((l) => l.key).join(' '), 'I II III IV V VI');
  assert.ok(Math.abs(CORTEX_LAYERS.reduce((a, l) => a + l.f, 0) - 1) < 1e-9);
  assert.ok(Math.abs(CEREBELLUM_LAYERS.reduce((a, l) => a + l.f, 0) - 1) < 1e-9);
  assert.equal(BRAIN_VIEWS.length, 4);
});

test('every view settles into itself (correlation above 0.85), and a shuffled control does not (below 0.25)', () => {
  for (const v of BRAIN_VIEWS)
    for (const [w, h] of SIZES) {
      const t = toTarget(spec(v), w, h);
      const lit = t.reduce((a, x) => a + (x > 0), 0) / t.length;
      assert.ok(lit > 0.05 && lit < 0.6, `${v.view} ${w}x${h}: lit ${lit.toFixed(3)}`);
      const q = correlation(settleTo(t, w, h, 7).s, t);
      assert.ok(q > 0.85, `${v.view}/${v.eye} at ${w}x${h}: correlation ${q.toFixed(3)}`);
      const c = correlation(settleTo(shuffled(t, 3), w, h, 11).s, t);
      assert.ok(Math.abs(c) < 0.25, `${v.view} control ${c.toFixed(3)}`);
    }
});

test('the single-band shapes settle too', () => {
  for (const n of ['cortex6', 'cerebellum']) {
    const t = toTarget(n, 400, 180);
    assert.ok(correlation(settleTo(t, 400, 180, 5).s, t) > 0.85, n);
  }
});

test('exactly two bands: the rows between them are dark, each band has lit cells, each frame row is solid', () => {
  for (const v of BRAIN_VIEWS) {
    const [w, h] = [420, 190];
    const s = brainScene(w, h, v);
    assert.equal(s.rects.length, 2);
    const [a, b] = s.rects;
    assert.equal(a.band, 'cortex');
    assert.equal(b.band, 'cerebellum');
    for (let y = a.y1 + 3; y <= b.y0 - 3; y++) for (let x = 0; x < w; x++) assert.equal(s.bits[y * w + x], -1, `${v.view}: gap row ${y} lit`);
    for (const rc of s.rects) {
      for (const y of [rc.y0, rc.y1]) for (let x = 0; x < w; x++) assert.equal(s.bits[y * w + x], 1, `${v.view}: frame row ${y}`);
      let lit = 0;
      for (let y = rc.y0 + 3; y < rc.y1 - 2; y++) for (let x = 0; x < w; x++) lit += s.bits[y * w + x] > 0;
      assert.ok(lit > (rc.y1 - rc.y0) * w * 0.05, `${v.view} ${rc.band} nearly empty`);
    }
  }
});

test('labels: six cortical layers I to VI top to bottom and three cerebellar layers, inside their band', () => {
  const [w, h] = [420, 190];
  for (const v of BRAIN_VIEWS.filter((x) => x.view !== 'voyage')) {
    const s = brainScene(w, h, v);
    const cx = s.labels.filter((l) => l.band === 'cortex');
    const cb = s.labels.filter((l) => l.band === 'cerebellum');
    assert.deepEqual(cx.map((l) => l.key), ['I', 'II', 'III', 'IV', 'V', 'VI']);
    assert.deepEqual(cb.map((l) => l.key), ['ML', 'PCL', 'GL']);
    for (const [ls, rc] of [[cx, s.rects[0]], [cb, s.rects[1]]]) {
      for (let i = 1; i < ls.length; i++) assert.ok(ls[i].y > ls[i - 1].y, `${v.view}: ${ls[i].key} not below ${ls[i - 1].key}`);
      for (const l of ls) assert.ok(l.y * h > rc.y0 && l.y * h < rc.y1, `${v.view}: ${l.key} outside its band`);
    }
  }
  // a voyage labels what its wall shows, still in order and inside the band
  for (const v of BRAIN_VIEWS.filter((x) => x.view === 'voyage')) {
    const s = brainScene(w, h, v);
    const cx = s.labels.filter((l) => l.band === 'cortex');
    assert.ok(cx.length >= 1, `${v.eye}: no cortex label`);
    for (let i = 1; i < cx.length; i++) assert.ok(cx[i].y > cx[i - 1].y);
  }
});

test('spike paths run along the wires: contiguous, and on lit cells far more often than chance', () => {
  const [w, h] = [640, 300];
  for (const v of BRAIN_VIEWS) {
    const s = brainScene(w, h, v);
    assert.ok(s.paths.length >= 20, `${v.view}: ${s.paths.length} paths`);
    let on = 0;
    let all = 0;
    for (const p of s.paths) {
      for (let i = 1; i < p.cells.length; i++) {
        const a = p.cells[i - 1];
        const b = p.cells[i];
        assert.ok(Math.abs((a % w) - (b % w)) <= 2 && Math.abs(Math.floor(a / w) - Math.floor(b / w)) <= 2, `${v.view} ${p.kind}: a jump`);
      }
      for (const c of p.cells) {
        all++;
        on += s.bits[c] > 0;
      }
    }
    // the control: a random cell is lit at the scene's lit fraction, which is far below what the paths reach
    let lit = 0;
    for (const x of s.bits) lit += x > 0;
    assert.ok(on / all > 0.9, `${v.view}: only ${((100 * on) / all).toFixed(1)}% of path cells lit`);
    assert.ok(lit / s.bits.length < 0.45, `${v.view}: lit fraction ${(lit / s.bits.length).toFixed(3)} leaves the control no room`);
  }
});

test('the views are different configurations, and a scene is deterministic', () => {
  const [w, h] = [420, 190];
  const ts = BRAIN_VIEWS.map((v) => toTarget(spec(v), w, h));
  for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++) assert.ok(correlation(ts[i], ts[j]) < 0.6, `views ${i} and ${j} too alike`);
  assert.deepEqual(toTarget(spec(BRAIN_VIEWS[1]), w, h), ts[1]);
});

test('the ride: moving forward, sideways, up and turning each changes the view; a still camera does not', async () => {
  const { rideScene, RIDE_START, clampRide, RIDE_LIMITS } = await import('../src/brainshapes.js');
  const W = 240;
  const H = 140;
  const base = rideScene(W, H, { eye: 0.16, cam: RIDE_START }).bits;
  const diff = (a, b) => a.reduce((n, v, i) => n + (v !== b[i]), 0) / a.length;
  // a still camera draws the same picture twice (negative control: the measure reads zero when nothing moved)
  assert.equal(diff(base, rideScene(W, H, { eye: 0.16, cam: RIDE_START }).bits), 0);
  for (const [k, v] of [['z', 0.3], ['x', 0.2], ['y', 0.15], ['yaw', 0.2], ['pitch', 0.15]]) {
    const d = diff(base, rideScene(W, H, { eye: 0.16, cam: { ...RIDE_START, [k]: v } }).bits);
    assert.ok(d > 0.02, `${k} moved the view by only ${d}`);
  }
  // the tissue repeats along the ride: far ahead it is still full of cells
  const far = rideScene(W, H, { eye: 0.72, cam: { ...RIDE_START, z: 40 } }).bits;
  const lit = far.reduce((n, v) => n + (v > 0), 0) / far.length;
  assert.ok(lit > 0.1 && lit < 0.6, `lit ${lit} at z = 40`);
  // the camera stays between the walls and above the floor; the yaw is free and the pitch stops short of vertical
  const c = clampRide({ x: 9, y: -9, z: 3, yaw: 9, pitch: -9 });
  assert.deepEqual(c, { x: RIDE_LIMITS.x, y: -9, z: 3, yaw: 9, pitch: -RIDE_LIMITS.pitch });
  assert.ok(RIDE_LIMITS.pitch > 1.5 && RIDE_LIMITS.pitch < Math.PI / 2, `pitch limit ${RIDE_LIMITS.pitch}`);
  assert.equal(clampRide({ x: 0, y: 9, z: 0, yaw: 0, pitch: 0 }).y, RIDE_LIMITS.y, 'the floor holds');
});

test('the fly-cam looks every way: back, sideways, straight up and straight down each draw their own picture, culled at the eye', async () => {
  const { rideScene, RIDE_START, RIDE_LIMITS } = await import('../src/brainshapes.js');
  const W = 240;
  const H = 140;
  const lit = (bits) => bits.reduce((n, v) => n + (v > 0), 0) / bits.length;
  const diff = (a, b) => a.reduce((n, v, i) => n + (v !== b[i]), 0) / a.length;
  const at = (cam) => rideScene(W, H, { eye: 0.16, cam: { ...RIDE_START, z: 12, ...cam } }).bits;
  const looks = [{}, { yaw: Math.PI / 2 }, { yaw: Math.PI }, { yaw: -Math.PI / 2 }, { pitch: -RIDE_LIMITS.pitch }, { pitch: RIDE_LIMITS.pitch }].map(at);
  for (let i = 0; i < looks.length; i++) {
    const l = lit(looks[i]);
    assert.ok(l > 0.01 && l < 0.7, `look ${i} lights ${l}`);
    for (let j = i + 1; j < looks.length; j++) assert.ok(diff(looks[i], looks[j]) > 0.01, `looks ${i} and ${j} are alike`);
  }
  // a full turn is the same view (the yaw is periodic, never clamped)
  assert.equal(diff(at({ yaw: 0.7 }), at({ yaw: 0.7 + 2 * Math.PI })), 0);
  // the tissue repeats behind as it does ahead: looking back from far along the ride, the view is full of cells
  assert.ok(lit(at({ yaw: Math.PI, z: 30 })) > 0.1);
});

test('the ride climbs without end: above the top layer the tissue is stacked in tiers, local ones in full, far ones sparse', async () => {
  const { rideScene, rideTiers, clampRide, RIDE_START, RIDE_UP, RIDE_FAR } = await import('../src/brainshapes.js');
  assert.equal(RIDE_UP, Infinity);
  const W = 240;
  const H = 140;
  const lit = (bits) => bits.reduce((n, v) => n + (v > 0), 0) / bits.length;
  const diff = (a, b) => a.reduce((n, v, i) => n + (v !== b[i]), 0) / a.length;
  // forty band heights up the picture is still full of cells, and differs from the start
  const high = rideScene(W, H, { eye: 0.16, cam: { ...RIDE_START, y: -40 } }).bits;
  const l = lit(high);
  assert.ok(l > 0.1 && l < 0.6, `lit ${l} at y = -40`);
  assert.ok(diff(high, rideScene(W, H, { eye: 0.16, cam: RIDE_START }).bits) > 0.02);
  // the clamp never lowers a climb (an unbounded direction, numerically): y -1e6 stays -1e6
  assert.equal(clampRide({ ...RIDE_START, y: -1e6 }).y, -1e6);
  // at the start the band and the tier just above it are local; higher up the tier the camera is in is local and
  // the band below is drawn only from where it shows on screen (its far rows); no tier lies below the floor
  const t0 = rideTiers(RIDE_START, 0.16);
  assert.deepEqual(t0.filter((t) => t.local).map((t) => t.k), [0, 1]);
  assert.ok(t0.every((t) => t.k >= 0 && t.zFrom <= RIDE_FAR));
  const t3 = rideTiers({ ...RIDE_START, y: -3 }, 0.16);
  assert.ok(t3.some((t) => t.k === 3 && t.local), `tier 3 is local at y = -3: ${JSON.stringify(t3)}`);
  const far = t3.find((t) => t.k === 0);
  assert.ok(far && !far.local && far.zFrom > 1, `the band below is far at y = -3: ${JSON.stringify(far)}`);
  // the far field is faint: switching it off changes under 3% of the lights, and more than none
  const withFar = rideScene(W, H, { eye: 0.16, cam: RIDE_START }).bits;
  const noFar = rideScene(W, H, { eye: 0.16, cam: RIDE_START, far: false }).bits;
  const d = diff(withFar, noFar);
  assert.ok(d > 0 && d < 0.03, `the far field moves ${d} of the lights`);
  // and it fires slowly: a different clock moves a few far lights, a same clock none
  assert.equal(diff(withFar, rideScene(W, H, { eye: 0.16, cam: RIDE_START, t: 0 }).bits), 0);
  const d2 = diff(withFar, rideScene(W, H, { eye: 0.16, cam: RIDE_START, t: 2000 }).bits);
  assert.ok(d2 > 0 && d2 < 0.01, `the firing moves ${d2}`);
});
