// THE 40 Hz CRACKLE (fortycrackle.js, lane FORTYCRACKLE, reworked into TV scanlines by lane FORTYSCAN): while the
// 40 Hz light is on, bright scanlines brighten the LIT lights under them on the LIT phases only, through the
// draw-only flash. The patterns (horizontal, tilted, rolling, interlaced, vertical hold, wobble, bloom, retro) are
// dealt by THE DECK RULE and morph from one to the next; brightness only (a light the settle did not light is never
// drawn); bounded; advancing once per lit phase of the gate's clock; never moving the physics.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

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
globalThis.requestAnimationFrame = () => 1;

const {
  FORTY_CRACKLE, FORTY_CRACKLE_LIMITS, FORTY_SCAN_PATTERNS, FORTY_SCAN_COVER, fortyCrackleOf, createFortyCrackle,
  fortyLitCycle, scanParams, scanAt, createField, createFortyHz, fortyHz, settle, fortyScanReady, fortyScanState,
} = await import('../src/index.js');
await (await import('../src/index.js')).loadCreditShapes(); // the credits family loads on demand (lane LAUNCHGATES); its shapes are fixtures here

// a deterministic generator for the pure pattern tests
const lcg = (seed = 7) => {
  let r = seed >>> 0;
  return () => {
    r = (Math.imul(r, 1103515245) + 12345) >>> 0;
    return r / 4294967296;
  };
};
// a W x H field whose every light is lit (m = 1), or lit where a predicate says
const litField = (W, H, on = () => true) => {
  const target = new Int8Array(W * H).fill(-1);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (on(x, y)) target[y * W + x] = 1;
  return { F: createField({ w: W, h: H, target, seed: 3, init: 'target' }), target };
};

test('fortyCrackleOf: on by default, false or null is none, every number bounded by FORTY_CRACKLE_LIMITS', () => {
  assert.equal(fortyCrackleOf(false), null);
  assert.equal(fortyCrackleOf(null), null);
  assert.equal(fortyCrackleOf({ strength: 0 }), null);
  const d = fortyCrackleOf(true);
  assert.equal(d.strength, FORTY_CRACKLE.strength);
  assert.equal(d.hold, FORTY_CRACKLE.hold);
  assert.equal(d.morph, FORTY_CRACKLE.morph);
  assert.deepEqual(d.patterns, [...FORTY_SCAN_PATTERNS]);
  const big = fortyCrackleOf({ strength: 9, hold: 1e9, morph: 1e9, minLit: 9 });
  assert.equal(big.strength, FORTY_CRACKLE_LIMITS.strength[1]);
  assert.equal(big.hold, FORTY_CRACKLE_LIMITS.hold[1]);
  assert.equal(big.morph, FORTY_CRACKLE_LIMITS.morph[1]);
  assert.equal(big.minLit, 1);
  assert.ok(FORTY_CRACKLE_LIMITS.strength[1] <= 0.85, 'the brightness sanity cap');
  assert.deepEqual(fortyCrackleOf({ patterns: ['roll', 'nonsense', 'bloom'] }).patterns, ['roll', 'bloom'], 'unknown pattern names are dropped');
  assert.deepEqual(fortyCrackleOf({ patterns: ['nonsense'] }).patterns, [...FORTY_SCAN_PATTERNS], 'an empty list falls back to all');
});

test('fortyLitCycle: -1 when the light is off or the frame is dark, the lit count when lit', () => {
  assert.equal(fortyLitCycle(null), -1);
  assert.equal(fortyLitCycle({ on: false, phase: null, litCycle: 0 }), -1);
  assert.equal(fortyLitCycle({ on: true, phase: false, litCycle: 7 }), -1, 'a dark frame brightens nothing');
  assert.equal(fortyLitCycle({ on: true, phase: true, litCycle: 7 }), 7);
});

test('the gate counts lit phases: litCycle starts at 1, rises by one at each dark-to-lit onset, and is 0 when off', async () => {
  const G = createFortyHz({ doc: null, raf: null, caf: null, measure: () => 120, reduced: () => false, origin: 0 });
  assert.equal(G.litCycle, 0);
  G.set(true);
  assert.equal(G.litCycle, 1);
  await new Promise((r) => setTimeout(r, 0)); // the measured refresh arrives, the clock starts
  let onsets = 0;
  let prev = G.phase;
  for (let k = 0; k < 120; k++) { // one second at 120 frames a second: 40 cycles
    const b = G.step(100000 + (k * 1000) / 120);
    if (b && prev === false) onsets++;
    prev = b;
  }
  assert.ok(onsets >= 38 && onsets <= 40, `about 40 onsets in a second (${onsets})`);
  assert.equal(G.litCycle, 1 + onsets, 'one count per onset');
  G.set(false);
  assert.equal(G.litCycle, 0);
});


test('the eight scanline patterns: each covers a visible share of a picture and never more than FORTY_SCAN_COVER', () => {
  assert.deepEqual([...FORTY_SCAN_PATTERNS], ['lines', 'tilt', 'roll', 'interlace', 'vhold', 'wobble', 'bloom', 'retro']);
  const rng = lcg(11);
  for (const name of FORTY_SCAN_PATTERNS) {
    for (const [W, H] of [[30, 18], [120, 60], [240, 150]]) {
      for (let k = 0; k < 12; k++) {
        const p = scanParams(name, rng, W, H);
        assert.equal(p.name, name);
        let sum = 0;
        let n = 0;
        for (let t = 0; t < 120; t += 11) for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
          const v = scanAt(p, x, y, t, W, H);
          assert.ok(v >= 0 && v <= 1, `${name}: an intensity in 0..1 (${v})`);
          sum += v;
          n++;
        }
        const cover = sum / n;
        assert.ok(cover <= FORTY_SCAN_COVER, `${name} ${W}x${H}: covers ${cover.toFixed(3)}, at most ${FORTY_SCAN_COVER}`);
        assert.ok(cover >= 0.1, `${name} ${W}x${H}: the lines show (${cover.toFixed(3)})`);
      }
    }
  }
});

test('lines are horizontal scanlines: every light in a row is brightened alike, and the rows alternate bright and dark', () => {
  const W = 40;
  const H = 30;
  const { F, target } = litField(W, H);
  const C = createFortyCrackle(W, H, { seed: 5, patterns: ['lines'] });
  C.advance(3);
  assert.equal(C.pattern, 'lines');
  C.draw(F, target);
  const a = F.flashA;
  assert.ok(a, 'it brightens');
  const rows = [];
  for (let y = 0; y < H; y++) {
    const v = a[y * W];
    for (let x = 1; x < W; x++) assert.equal(a[y * W + x], v, `row ${y} is one brightness across (x ${x})`);
    rows.push(v);
  }
  const bright = rows.filter((v) => v > 0).length;
  assert.ok(bright > 0.1 * H && bright < 0.6 * H, `some rows lit, many dark (${bright} of ${H})`);
  let changes = 0;
  for (let y = 1; y < H; y++) if ((rows[y] > 0) !== (rows[y - 1] > 0)) changes++;
  assert.ok(changes >= 6, `the rows alternate: a comb of lines, not one band (${changes} edges)`);
});

test('tilt and retro lean: one line crosses rows along the picture, unlike the level lines', () => {
  const W = 200;
  const H = 40;
  const p = { ...scanParams('tilt', lcg(3), W, H), angle: 20 };
  const colsDiffer = [0, 50, 100, 150].some((x) => {
    for (let y = 0; y < H; y++) if (scanAt(p, x, y, 0, W, H) !== scanAt(p, x + 1, y, 0, W, H)) return true;
    return false;
  });
  assert.ok(colsDiffer, 'a tilted line is not level: neighbouring columns differ');
  const lv = scanParams('lines', lcg(3), W, H);
  for (let x = 0; x < W - 1; x += 37) for (let y = 0; y < H; y++) assert.equal(scanAt(lv, x, y, 0, W, H), scanAt(lv, x + 1, y, 0, W, H), 'level lines are level');
  const r = scanParams('retro', lcg(9), W, H);
  assert.ok(Math.abs(r.angle) >= 1 && Math.abs(r.angle) <= 4, `retro leans a little (${r.angle.toFixed(2)} degrees)`);
  assert.ok(r.period >= 7 && r.width >= 0.8, 'retro lines are chunky and far apart');
});

test('roll rolls, vhold sends a bar down the picture, wobble bends, bloom breathes: each one moves with the lit phase', () => {
  const W = 80;
  const H = 60;
  const at = (p, t) => { const v = []; for (let y = 0; y < H; y++) for (let x = 0; x < W; x += 9) v.push(scanAt(p, x, y, t, W, H)); return v; };
  const moved = (p, dt) => at(p, 0).some((v, i) => Math.abs(v - at(p, dt)[i]) > 0.25);
  for (const name of ['roll', 'vhold', 'wobble', 'bloom', 'interlace']) {
    const p = scanParams(name, lcg(21), W, H);
    assert.ok(moved(p, name === 'interlace' ? 1 : 12), `${name} changes between lit phases`);
  }
  // the vertical-hold bar travels downward: its centre row grows with t, then wraps to the top
  const v = { ...scanParams('vhold', lcg(4), W, H), phase: 0, cross: 60, gain: 0 };
  const barRow = (t) => { let best = -1; let row = -1; for (let y = 0; y < H; y++) { const s = scanAt(v, 0, y, t, W, H); if (s > best) { best = s; row = y; } } return row; };
  assert.ok(barRow(20) > barRow(10) && barRow(30) > barRow(20), `the bar rolls down (${barRow(10)} ${barRow(20)} ${barRow(30)})`);
  // interlace: the rows lit on one lit phase are exactly the rows dark on the next (two fields make the frame)
  const il = scanParams('interlace', lcg(1), W, H);
  for (let y = 0; y < H; y++) assert.equal(scanAt(il, 0, y, 4, W, H) > 0, !(scanAt(il, 0, y, 5, W, H) > 0), `row ${y} swaps field`);
});

test('brightness only: a light the settle did not light is never drawn, and a lit one is brightened by its own soft read', () => {
  const W = 60;
  const H = 40;
  // half the picture lit, in vertical stripes, so every scanline crosses lit and unlit lights
  const { F, target } = litField(W, H, (x) => Math.floor(x / 5) % 2 === 0);
  // and a band of half-lit lights (a soft read of 0.5) to see the brightening follow the soft read
  for (let y = 0; y < H; y++) for (let x = 0; x < 5; x++) F.m[y * W + x] = 0.5;
  // the default crackle first (this is the check the first crackle failed: it lifted the unlit ground)
  {
    const C = createFortyCrackle(W, H, { seed: 9 });
    C.advance(7);
    assert.ok(C.draw(F, target) > 0, 'the default crackle brightens');
    for (let i = 0; i < F.n; i++) if (F.m[i] === 0) assert.equal(F.flashA[i], 0, `unlit light ${i} is never drawn`);
  }
  for (const name of FORTY_SCAN_PATTERNS) {
    F.fadeFlash(0); // clear the flashes of the last pattern
    const C = createFortyCrackle(W, H, { seed: 9, patterns: [name] });
    C.advance(7);
    const k = C.draw(F, target);
    assert.ok(k > 0, `${name}: it brightens`);
    const a = F.flashA;
    let full = 0;
    let half = 0;
    for (let i = 0; i < F.n; i++) {
      if (F.m[i] < FORTY_CRACKLE.minLit) assert.equal(a[i], 0, `${name}: unlit light ${i} is never drawn`);
      assert.ok(a[i] <= FORTY_CRACKLE.strength + 1e-6, `${name}: inside the cap`);
      if (F.m[i] === 1) full = Math.max(full, a[i]);
      else if (F.m[i] === 0.5) half = Math.max(half, a[i]);
    }
    assert.ok(full > 0.5 * FORTY_CRACKLE.strength, `${name}: a fully lit light under a line is brightened well (${full.toFixed(3)})`);
    assert.ok(half > 0 && half <= 0.5 * FORTY_CRACKLE.strength + FORTY_CRACKLE.strength / 8 + 1e-6, `${name}: a half-lit light gets about half (${half.toFixed(3)})`);
  }
  // a dark picture stays dark: nothing lit, nothing drawn
  const dark = litField(W, H, () => false);
  assert.equal(createFortyCrackle(W, H, { seed: 2 }).draw(dark.F, dark.target), 0, 'a fully dark picture gets no light');
  assert.equal(dark.F.flashA, null);
});

test('the draw is the pure pattern: every light gets strength x step(line x soft read), the line exactly scanAt or its morph', () => {
  const W = 50;
  const H = 32;
  const { F, target } = litField(W, H, (x, y) => (x + 2 * y) % 3 !== 0);
  for (let i = 0; i < F.n; i++) if (F.m[i] > 0) F.m[i] = 0.4 + 0.6 * ((i * 7) % 10) / 10;
  const check = (C, label) => {
    F.fadeFlash(0);
    C.draw(F, target);
    const a = F.flashA ?? new Float32Array(F.n);
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      const i = y * W + x;
      const on = F.m[i];
      const st = on < FORTY_CRACKLE.minLit ? 0 : Math.min(8, Math.round(C.intensity(x, y) * on * 8));
      const want = st < 1 ? 0 : Math.fround(FORTY_CRACKLE.strength * (st / 8));
      assert.equal(a[i], want, `${label}: light ${x},${y}`);
    }
  };
  for (const name of FORTY_SCAN_PATTERNS) {
    const C = createFortyCrackle(W, H, { seed: 31, patterns: [name] });
    C.advance(5);
    check(C, name);
  }
  // and mid-morph: two leaning patterns, two level ones, and a level one with a leaning one either way round
  for (const pats of [['tilt', 'wobble'], ['lines', 'bloom'], ['retro', 'vhold'], ['interlace', 'tilt']]) {
    const C = createFortyCrackle(W, H, { seed: 8, patterns: pats });
    C.advance(FORTY_CRACKLE.hold + Math.round(FORTY_CRACKLE.morph / 2));
    assert.ok(C.mix > 0 && C.mix < 1, `${pats}: mid-morph (${C.mix})`);
    check(C, `morph ${pats.join('>')}`);
  }
});

test('THE DECK RULE deals the patterns: every pattern shows once before any repeats, each holds, then morphs into the next', () => {
  const C = createFortyCrackle(64, 40, { seed: 13 });
  const cycle = FORTY_CRACKLE.hold + FORTY_CRACKLE.morph;
  const shown = [C.pattern];
  let midMorph = null;
  for (let k = 0; k < cycle * FORTY_SCAN_PATTERNS.length; k++) {
    C.advance(1);
    if (C.pattern !== shown.at(-1)) shown.push(C.pattern);
    if (!midMorph && C.next && C.mix > 0.3 && C.mix < 0.7) midMorph = { mix: C.mix, a: C.params.cur, b: C.params.next, t: C.phases };
  }
  const first = shown.slice(0, FORTY_SCAN_PATTERNS.length);
  assert.equal(new Set(first).size, FORTY_SCAN_PATTERNS.length, `a full round before a repeat: ${first.join(' ')}`);
  for (let j = 1; j < shown.length; j++) assert.notEqual(shown[j], shown[j - 1], 'never the same pattern twice running');
  assert.ok(midMorph, 'a morph was seen in progress');
  // mid-morph the intensity is the blend of the two patterns
  const M = createFortyCrackle(64, 40, { seed: 13 });
  M.advance(midMorph.t);
  const x = 10;
  for (let y = 0; y < 40; y++) {
    const want = (1 - M.mix) * scanAt(M.params.cur, x, y, M.phases, 64, 40) + M.mix * scanAt(M.params.next, x, y, M.phases, 64, 40);
    assert.ok(Math.abs(M.intensity(x, y) - want) < 1e-9, `row ${y}: the morph blends the two`);
  }
  assert.equal(M.deals, 2, 'one pattern showing, one coming');
});

test('a slow picture catches up cheaply: a long advance keeps the phase clock exactly and deals at most three patterns', () => {
  const cycle = FORTY_CRACKLE.hold + FORTY_CRACKLE.morph;
  for (const k of [3, FORTY_CRACKLE.hold, cycle, cycle + 7, 2 * cycle + 5]) {
    const fast = createFortyCrackle(96, 54, { seed: 21 });
    const slow = createFortyCrackle(96, 54, { seed: 21 });
    for (let j = 0; j < k; j++) fast.advance(1);
    slow.advance(k);
    assert.equal(slow.phases, fast.phases, `k=${k}: the phase clock is kept`);
    assert.equal(slow.pattern, fast.pattern, `k=${k}: the same pattern as stepping one phase at a time`);
    assert.equal(slow.next, fast.next, `k=${k}: the same morph in progress`);
    assert.ok(Math.abs(slow.mix - fast.mix) < 1e-12, `k=${k}: the same mix`);
  }
  const huge = createFortyCrackle(96, 54, { seed: 4 });
  const d0 = huge.deals;
  huge.advance(1e6);
  assert.equal(huge.phases, 1e6, 'a million phases on the clock');
  assert.ok(huge.deals - d0 <= 3, `at most three deals for a huge jump (${huge.deals - d0})`);
});

test('the generator loads on demand: never with the light off, first at a lit phase, and nothing is drawn while it loads', async () => {
  // this test runs before any other test in this file mounts a settle, so the generator has not been asked for yet
  const opts = (fc) => ({ shape: 'vinyl', res: [48, 24], schedule: { kind: 'fixed', T: 0.6 }, seed: 19, motion: 'always', fortyCrackle: fc });
  const plain = settle(new FakeCanvas(), opts(false));
  const crack = settle(new FakeCanvas(), opts(true));
  const G = fortyHz();
  for (let k = 0; k < 10; k++) { plain.advance(1); crack.advance(1); }
  assert.equal(fortyScanState(), 'idle', 'the light is off: the generator is never loaded');
  assert.ok(G.set(true), 'the light goes on');
  plain.advance(1);
  crack.advance(1);
  assert.equal(fortyScanState(), 'loading', 'the first lit phase starts the load');
  assert.equal(crack.field.flashA, null, 'while it loads, a lit phase draws no lines');
  assert.deepEqual(crack.field.s, plain.field.s, 'and the physics is untouched');
  const mod = await fortyScanReady();
  assert.equal(fortyScanState(), 'ready');
  assert.equal(typeof mod.createFortyCrackle, 'function', 'the loaded module is the generator');
  assert.equal(mod.createFortyCrackle, createFortyCrackle, 'the same module index.js re-exports');
  for (let k = 0; k < 3; k++) { plain.advance(1); crack.advance(1); }
  assert.ok(crack.field.flashA, 'once loaded, the lit phases draw');
  assert.deepEqual(crack.field.s, plain.field.s, 'the physics is still untouched');
  G.set(false);
  plain.destroy();
  crack.destroy();
});

test('the site loads mount.js without the generator: only fortyscan.js holds it, and mount imports it on demand', () => {
  const src = readFileSync(new URL('../src/mount.js', import.meta.url), 'utf8');
  assert.ok(!/import\s*\{[^}]*createFortyCrackle[^}]*\}\s*from/.test(src), 'mount.js has no static import of the generator');
  assert.match(src, /import\('\.\/fortyscan\.js'\)/, 'mount.js imports fortyscan.js on demand');
  const light = readFileSync(new URL('../src/fortycrackle.js', import.meta.url), 'utf8');
  assert.ok(!/fortyscan\.js/.test(light.replace(/^\s*\/\/.*$/gm, '')), 'fortycrackle.js (read at mount) does not import the generator');
});

test('on a settle: the 40 Hz crackle leaves the physics exactly as it was; it draws only while the light is on and lit', async () => {
  await fortyScanReady();
  const opts = (fc) => ({ shape: 'vinyl', res: [48, 24], schedule: { kind: 'fixed', T: 0.6 }, seed: 11, motion: 'always', fortyCrackle: fc });
  const plain = settle(new FakeCanvas(), opts(false));
  const crack = settle(new FakeCanvas(), opts(true));
  const G = fortyHz();
  // light off: nothing brightens
  for (let k = 0; k < 5; k++) { plain.advance(1); crack.advance(1); }
  assert.equal(crack.field.flashA, null, 'the light is off: no crackle');
  assert.ok(G.set(true), 'the light goes on');
  assert.equal(G.phase, true);
  for (let k = 0; k < 30; k++) {
    plain.advance(1);
    crack.advance(1);
    assert.deepEqual(crack.field.s, plain.field.s, `frame ${k}: the lights' states are identical`);
  }
  assert.equal(plain.field.flashA, null, 'fortyCrackle: false opts out');
  const a = crack.field.flashA;
  assert.ok(a, 'the crackle draws on the lit phase');
  const lit = a.filter((v) => v > 0).length;
  assert.ok(lit > 0 && lit <= FORTY_SCAN_COVER * a.length + 1, `under the cover cap: ${lit} of ${a.length} lights brightened`);
  G.set(false);
  crack.advance(40);
  assert.ok(!crack.field.flashing, 'the light goes off: the flashes fade away');
  plain.destroy();
  crack.destroy();
});

test('a resting picture under the 40 Hz light: its physics stays still while only its crackle moves', async () => {
  await fortyScanReady();
  const G = fortyHz();
  const still = settle(new FakeCanvas(), { shape: 'vinyl', res: [48, 24], schedule: { kind: 'fixed', T: 0.6 }, seed: 13, motion: 'always', still: true, restAfter: 2 });
  still.advance(40); // settled and quiet
  const before = Int8Array.from(still.field.s);
  G.set(true);
  const before2 = still.perf.forty;
  for (let k = 0; k < 20; k++) still.tick(1000 + k * 16);
  assert.deepEqual(still.field.s, before, 'no sweep ran on the resting picture');
  assert.ok(still.field.flashing, 'its crackle draws');
  assert.ok(still.perf.forty >= before2, 'the meter carries the crackle\'s cost');
  G.set(false);
  still.destroy();
});

test('the measurement switch: globalThis.__settleFortyCrackleOff holds the crackle off while the light runs', async () => {
  await fortyScanReady();
  const G = fortyHz();
  const s = settle(new FakeCanvas(), { shape: 'vinyl', res: [48, 24], schedule: { kind: 'fixed', T: 0.6 }, seed: 17, motion: 'always' });
  G.set(true);
  globalThis.__settleFortyCrackleOff = true;
  try {
    s.advance(12);
    assert.equal(s.field.flashA, null, 'switched off: nothing brightens');
  } finally {
    delete globalThis.__settleFortyCrackleOff;
  }
  s.advance(2);
  assert.ok(s.field.flashA, 'switched back on: the crackle draws');
  G.set(false);
  s.destroy();
});
