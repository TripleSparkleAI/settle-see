// THE KEY SUIT (radialeffects.js KEY_EFFECTS, lane HEROKEYS): fifty gentle members a step of the hero deals. Each is a
// real parameter set the bus and the mount draw, each keeps GENTLE, none darkens deeper than a click's trough, and the
// new knobs (inward, standing, twist, petals, wavy, origin) each change the drawing they claim to.
import test from 'node:test';
import assert from 'node:assert/strict';

const {
  RADIAL_EFFECTS, EFFECT_KEYS, KEY_EFFECTS, KEY_EFFECT_KEYS, GENTLE, isGentle, effectOf, effectHolds, createRadialPulse,
} = await import('../src/index.js');

const W = 120;
const H = 70;
const draw = (key, wave = {}) => {
  const out = { up: 0, down: 0, lights: new Set(), maxUp: 0, maxDown: 0, hits: [] };
  effectHolds(key, { x: 60, y: 35, R: 24, band: 10, a: 0.4, turn: 0, ...wave }, W, H, (i, s, v) => {
    out.lights.add(i);
    out.hits.push([i, s, v]);
    if (s > 0) { out.up++; out.maxUp = Math.max(out.maxUp, v); } else { out.down++; out.maxDown = Math.max(out.maxDown, v); }
  });
  return out;
};

test('THE KEY SUIT has exactly fifty members, each named, unique and apart from the four', () => {
  assert.equal(KEY_EFFECT_KEYS.length, 50);
  assert.equal(new Set(KEY_EFFECT_KEYS).size, 50);
  assert.deepEqual(EFFECT_KEYS, ['click', 'shimmer', 'double', 'spokes'], 'the original family is unchanged');
  for (const k of KEY_EFFECT_KEYS) {
    assert.ok(!(k in RADIAL_EFFECTS), `${k} does not shadow a family member`);
    const e = KEY_EFFECTS[k];
    assert.equal(e.key, k);
    assert.equal(e.from, 'keys');
    assert.equal(effectOf(k), e, 'the bus finds every key member by name');
    assert.ok(typeof e.label === 'string' && e.label.length > 0 && typeof e.line === 'string' && e.line.length > 0, k);
    for (const f of ['speed', 'band', 'fade', 'crest', 'kick', 'cap', 'rings', 'gap', 'spokes', 'spokeWidth', 'twist', 'petals', 'petalDepth', 'wavy', 'wavyAmp']) {
      assert.ok(Number.isFinite(e[f]) && e[f] >= 0, `${k}.${f}`);
    }
    assert.ok(['centre', 'side', 'far'].includes(e.origin), `${k}.origin`);
    assert.ok(e.petalDepth <= 1, k);
    assert.ok(Object.isFrozen(e));
  }
});

test('every key member is GENTLE: capped, a small kick, a modest crest, and a still answer under reduced motion', () => {
  const click = RADIAL_EFFECTS.click;
  for (const k of KEY_EFFECT_KEYS) {
    const e = KEY_EFFECTS[k];
    assert.ok(isGentle(e), k);
    assert.ok(e.cap <= GENTLE.cap && e.cap < click.cap, `${k} cap`);
    assert.ok(e.kick <= GENTLE.kick && e.kick < click.kick, `${k} kick`);
    assert.ok(e.crest <= GENTLE.crest, `${k} crest`);
    assert.equal(e.still, true, k);
  }
  assert.ok(!isGentle(click), 'a full click is not gentle, so the check can fail');
});

test('each of the fifty draws lights at a mid frame, never past the wave strength, and no trough deeper than a click\'s', () => {
  const clickTrough = draw('click', { a: 1 }).maxDown;
  assert.ok(clickTrough > 0);
  for (const k of KEY_EFFECT_KEYS) {
    const e = KEY_EFFECTS[k];
    // a key wave arrives at most at its cap; draw it there, at a radius the member is alive at
    const R = e.inward ? 40 : e.standing ? 10 : 24;
    const c = draw(k, { a: e.cap, R });
    assert.ok(c.up > 0, `${k} lights something`);
    assert.ok(c.maxUp <= e.cap + 1e-12, `${k} never passes its strength`);
    assert.ok(c.maxDown <= clickTrough + 1e-12, `${k} darkens no deeper than a click`);
    for (const [i] of c.hits) assert.ok(i >= 0 && i < W * H, k);
  }
});

const meanR = (c) => {
  const up = c.hits.filter(([, s]) => s > 0).map(([i]) => Math.hypot((i % W) - 60, ((i / W) | 0) - 35));
  return up.reduce((p, q) => p + q, 0) / up.length;
};

test('INWARD runs from the far corner in; STANDING rings stay put and swell; the plain ring runs out', () => {
  const out1 = meanR(draw('ring', { R: 10 }));
  const out2 = meanR(draw('ring', { R: 30 }));
  assert.ok(out2 > out1 + 10, 'an outward ring grows');
  const in1 = meanR(draw('collapse', { R: 10 }));
  const in2 = meanR(draw('collapse', { R: 30 }));
  assert.ok(in2 < in1 - 10, 'an inward ring closes in');
  const st1 = draw('standing', { R: 5 });
  const st2 = draw('standing', { R: 10 });
  assert.ok(Math.abs(meanR(st1) - meanR(st2)) < 0.5, 'standing rings do not move');
  const peak1 = Math.max(...st1.hits.map((h) => h[2]));
  const peak2 = Math.max(...st2.hits.map((h) => h[2]));
  assert.ok(peak2 > peak1 + 0.05, 'standing rings swell as the wave passes');
});

test('SPIRALS turn with radius, PETALS vary round the ring, WAVY rings roll off the circle', () => {
  const spokes = draw('star');
  const spiral = draw('vortex');
  assert.ok(spokes.up > 0 && spiral.up > 0);
  // the same arms at two radii: a twist turns them, a plain spoke does not
  const angles = (c) => c.hits.filter(([, s]) => s > 0).map(([i]) => Math.atan2(((i / W) | 0) - 35, (i % W) - 60));
  const near = draw('vortex', { R: 12 });
  const far = draw('vortex', { R: 30 });
  assert.notDeepEqual(angles(near).map((x) => x.toFixed(1)).sort(), angles(far).map((x) => x.toFixed(1)).sort());
  const lotus = draw('lotus');
  const vs = lotus.hits.map((h) => h[2]);
  assert.ok(Math.max(...vs) > 2 * Math.min(...vs), 'petals: strength rises and falls round the ring');
  const ring = draw('ring');
  const wob = draw('wobble');
  const spread = (c) => { const r = c.hits.filter(([, s]) => s > 0).map(([i]) => Math.hypot((i % W) - 60, ((i / W) | 0) - 35)); return Math.max(...r) - Math.min(...r); };
  assert.ok(spread(wob) > spread(ring) + 2, 'a wavy ring reaches in and out of the circle');
});

test('THE BUS caps a key member at its cap, tells from: keys and the drag id, and drops key waves before a click', () => {
  let q = [];
  let t = 0;
  const B = createRadialPulse({ win: null, now: () => t, frame: (fn) => q.push(fn), state: () => 'running', reduced: () => false, defaults: { maxWaves: 3 } });
  const seen = [];
  B.onPulse((d) => seen.push(d));
  B.register({ id: 'hero', rect: () => ({ left: 0, top: 0, width: 400, height: 200 }), respond() {} });
  const d = B.emit({ x: 10, y: 10, strength: 1, effect: 'bloom', only: 'hero', source: 'keys', kind: 'step' });
  assert.equal(d.effect, 'bloom');
  assert.equal(d.from, 'keys');
  assert.equal(d.strength, KEY_EFFECTS.bloom.cap);
  assert.equal(d.speed, KEY_EFFECTS.bloom.speed);
  const drop = B.emit({ x: 10, y: 10, strength: 0.6, kind: 'drop', source: 'hero', drag: 7 });
  assert.equal(drop.drag, 7);
  assert.equal(drop.from, 'user');
  B.emit({ x: 10, y: 10, kind: 'click', source: 'hero' });
  B.emit({ x: 10, y: 10, kind: 'click', source: 'hero' });
  // four waves, room for three: the key wave went, both clicks and the drop stayed
  assert.equal(B.stats().waves, 3);
  assert.equal(seen.length, 4);
});

test('under reduced motion a key member gives the one still answer, to the hero alone', () => {
  const B = createRadialPulse({ win: null, now: () => 0, frame: () => 0, state: () => 'running', reduced: () => true });
  const still = { hero: 0, other: 0 };
  B.register({ id: 'hero', rect: () => ({ left: 0, top: 0, width: 400, height: 200 }), still: () => still.hero++ });
  B.register({ id: 'other', rect: () => ({ left: 0, top: 0, width: 400, height: 200 }), still: () => still.other++ });
  const d = B.emit({ x: 200, y: 100, effect: 'ring', only: 'hero', source: 'keys', kind: 'step' });
  assert.equal(d.reduced, true);
  assert.deepEqual(still, { hero: 1, other: 0 });
  assert.equal(B.stats().waves, 0, 'no ring travels');
});
