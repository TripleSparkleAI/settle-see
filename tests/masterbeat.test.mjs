// THE MASTER BEAT: one origin, one grid; and the 40 Hz light on its phase, checked frame by frame on fake displays.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createMasterBeat, unitMs, MASTER, masterBeat, MASTER_GLOBAL } from '../src/masterbeat.js';
import { createGamma, createFlashClock, pickFlashRate, snapRefresh } from '../src/gamma.js';

// ── the grid ──

test('one grid: a tick is a beat (500 ms, 120 bpm), a bar is 4 beats, a tick holds exactly 20 flash cycles', () => {
  assert.equal(unitMs('tick'), 500);
  assert.equal(unitMs('truetime'), 500);
  assert.equal(unitMs('beat'), 500);
  assert.equal(unitMs('bar'), 2000);
  assert.equal(unitMs('flash'), 25);
  assert.equal(unitMs('tick') / unitMs('flash'), 20);
  assert.equal(MASTER.bpm, 120);
  assert.throws(() => unitMs('nope'));
  assert.throws(() => unitMs(0));
});

test('at(t) reads every phase from one origin', () => {
  const B = createMasterBeat({ origin: 1000, now: () => 0 });
  const a = B.at(1000 + 2 * 2000 + 3 * 500 + 12.5);
  assert.equal(a.bar, 2);
  assert.equal(a.tick, 11);
  assert.equal(a.beatInBar, 3);
  assert.ok(Math.abs(a.tickPhase - 0.025) < 1e-9);
  assert.ok(Math.abs(a.flashPhase - 0.5) < 1e-9, 'half way through a 25 ms cycle');
  assert.equal(B.floor(1000 + 1234, 'tick'), 1000 + 1000);
  assert.equal(B.next(1000 + 1000, 'tick'), 1000 + 1500, 'next is strictly after a line');
  assert.equal(B.next(1000 + 1999, 'bar'), 3000);
  assert.ok(Math.abs(B.phase(1000 + 50, 40)) < 1e-9, 'every 25 ms is phase 0 of 40 Hz');
  assert.ok(Math.abs(B.phase(1000 + 250, 10) - 0.5) < 1e-9);
});

test('every bar line is a tick, every tick is a flash onset: the units share phase zero', () => {
  const B = createMasterBeat({ origin: 37 });
  for (let k = 0; k < 50; k++) {
    const bar = 37 + k * 2000;
    assert.ok(Math.abs(B.at(bar).tickPhase) < 1e-9);
    assert.ok(Math.abs(B.at(bar).flashPhase) < 1e-6);
    assert.ok(Math.abs(B.phase(bar, 40)) < 1e-6, 'a 40 Hz binaural beat crosses zero on the bar line');
    assert.ok(Math.abs(B.phase(bar, 10)) < 1e-6 && Math.abs(B.phase(bar, 6)) < 1e-6 && Math.abs(B.phase(bar, 2.5)) < 1e-6);
  }
  assert.ok(Math.abs(B.phase(37 + 2000, 7.83)) > 0.01, 'negative control: 7.83 Hz is off the 0.5 Hz lattice');
});

// ── subscribers ──

test('subscribers stay in phase: each hears every line once, at the line time, from frames of any rate', () => {
  let t = 0;
  const B = createMasterBeat({ now: () => t });
  const ticks = [];
  const bars = [];
  B.on('tick', (e) => ticks.push(e));
  B.on('bar', (e) => bars.push(e));
  for (t = 0; t <= 8010; t += 16.667) B.step(t);
  assert.equal(ticks.length, 16);
  assert.equal(bars.length, 4);
  ticks.forEach((e, i) => {
    assert.equal(e.index, i + 1);
    assert.equal(e.t, (i + 1) * 500, 'the event carries the grid time, not the frame time');
    assert.ok(e.now - e.t < 16.7, 'heard within one frame of its line');
    assert.equal(e.skipped, 0);
  });
  // every bar event coincides with a tick event
  for (const b of bars) assert.ok(ticks.some((k) => k.t === b.t));
});

test('pause and resume: no catch-up burst, the skipped lines are counted, the grid has not drifted', () => {
  let t = 0;
  const B = createMasterBeat({ now: () => t });
  const ev = [];
  B.on('tick', (e) => ev.push(e));
  for (t = 0; t <= 2000; t += 10) B.step(t);
  B.pause();
  for (t = 2000; t <= 9730; t += 10) B.step(t);
  const before = ev.length;
  B.resume();
  B.step(t);
  assert.equal(ev.length, before + 1, 'one event on resume, not a burst');
  const e = ev.at(-1);
  assert.equal(e.index, Math.floor(t / 500));
  assert.equal(e.t, e.index * 500, 'line k is still origin + k * 500');
  assert.equal(e.skipped, e.index - ev[before - 1].index - 1);
  for (t += 10; t <= 12000; t += 10) B.step(t);
  for (const x of ev.slice(before)) assert.equal(x.t % 500, 0);
});

test('a listener that throws does not stop the others; unsubscribing stops delivery', () => {
  let t = 0;
  const B = createMasterBeat({ now: () => t });
  let n = 0;
  B.on('tick', () => { throw new Error('boom'); });
  const off = B.on('tick', () => n++);
  for (t = 0; t <= 1600; t += 20) B.step(t);
  assert.equal(n, 3);
  off();
  for (t = 1600; t <= 3000; t += 20) B.step(t);
  assert.equal(n, 3);
});

test('reduced motion does not touch the master beat (it is time, not motion)', () => {
  const saved = globalThis.matchMedia;
  globalThis.matchMedia = () => ({ matches: true });
  try {
    let t = 0;
    const B = createMasterBeat({ now: () => t });
    let n = 0;
    B.on('beat', () => n++);
    for (t = 0; t <= 2000; t += 16) B.step(t);
    assert.equal(n, 4);
    assert.equal(B.at(1250).tick, 2);
  } finally {
    globalThis.matchMedia = saved;
  }
});

test('the page master beat is one object, published for settle-hear with origin 0 (the page time origin)', () => {
  const a = masterBeat();
  assert.equal(a, masterBeat());
  assert.equal(a.origin, 0);
  const pub = globalThis[MASTER_GLOBAL];
  assert.equal(pub.origin, 0);
  assert.equal(pub.tickMs, 500);
  assert.equal(pub.barMs, 2000);
  assert.equal(pub.flashHz, 40);
});

// ── the 40 Hz light on the master phase ──

test('THE RATE RULE: 40 at 120 and 144, 45 at 90, 30 at 60, said honestly; refuse only when asked', () => {
  assert.deepEqual([120, 144, 165, 240, 100].map((r) => pickFlashRate(r).hz), [40, 40, 40, 40, 40]);
  assert.equal(pickFlashRate(90).hz, 45);
  assert.equal(pickFlashRate(90).nearest, true);
  assert.equal(pickFlashRate(75).hz, 37.5);
  assert.equal(pickFlashRate(60).hz, 30);
  assert.equal(pickFlashRate(60).nearest, true);
  assert.match(pickFlashRate(60, 40, 'refuse').refused, /60 frames a second/);
  assert.ok(pickFlashRate(0).refused);
  assert.equal(snapRefresh(59.94), 60);
  assert.equal(snapRefresh(119.6), 120);
  assert.equal(snapRefresh(143.9), 144);
  assert.equal(snapRefresh(87), 87, 'an unusual rate is kept as measured');
});

// frames at `fps` from t0, with optional jitter and dropped frames; returns the onset timestamps and states
function drive({ fps, seconds = 10, jitter = 0, drops = [], origin = 0, t0 = 123.4, seed = 7 }) {
  const pick = pickFlashRate(fps);
  const C = createFlashClock({ hz: pick.hz, duty: 0.5, refresh: fps, origin });
  let a = seed >>> 0;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  const F = 1000 / fps;
  const onsets = [];
  let dark = 0;
  let n = 0;
  let prev = -Infinity;
  for (let k = 0; k < seconds * fps; k++) {
    if (drops.includes(k)) continue;
    let t = t0 + k * F + (jitter ? (rnd() * 2 - 1) * jitter : 0);
    if (t <= prev) t = prev + 0.1;
    prev = t;
    const s = C.step(t);
    if (s.onset) onsets.push({ t, cycle: s.cycle });
    if (!s.bright) dark++;
    n++;
  }
  onsets.F = F;
  return { hz: pick.hz, F, onsets, darkShare: dark / n };
}

// each onset's distance to its master cycle start, and the check that no cycle flashes twice
function lockStats({ hz, onsets }, origin = 0) {
  const P = 1000 / hz;
  const errs = onsets.map((o) => {
    const c = (o.t - origin) / P;
    return Math.abs(c - Math.round(c)) * P;
  });
  // never a double flash: consecutive onsets at least a cycle less one frame apart (to float precision: the re-lock
  // from a late onset to the on-time one is exactly a cycle less one frame), and no two on one master cycle
  const F = onsets.F ?? 0;
  const gaps = onsets.slice(1).map((o, i) => o.t - onsets[i].t);
  const cycles = onsets.map((o) => o.cycle);
  return { maxErr: Math.max(...errs), lateErr: Math.max(...errs.slice(Math.floor(errs.length / 2))), minGap: Math.min(...gaps), unique: new Set(cycles).size === cycles.length && Math.min(...gaps) >= P - F - 1e-6 };
}

for (const fps of [60, 90, 120, 144]) {
  test(`a ${fps} Hz display: the light flashes on the master phase, once a cycle, at the honest rate, no drift`, () => {
    const r = drive({ fps });
    const want = { 60: 30, 90: 45, 120: 40, 144: 40 }[fps];
    assert.equal(r.hz, want);
    // steady state: the last five seconds (the first frames settle the dither's carry)
    const late = r.onsets.filter((o) => o.t >= 123.4 + 5000).length / 5;
    assert.ok(Math.abs(late - want) <= 0.2, `${late} onsets a second`);
    assert.ok(Math.abs(r.onsets.length / 10 - want) <= 1, `${r.onsets.length / 10} onsets a second overall`);
    const L = lockStats(r);
    assert.ok(L.unique, 'never two onsets in one cycle');
    assert.ok(L.maxErr <= r.F + 1e-6, `onset within one frame of its cycle start (worst ${L.maxErr.toFixed(2)} ms)`);
    assert.ok(L.lateErr <= r.F + 1e-6, 'no drift: the last half of the run is as close as the first');
    assert.ok(Math.abs(r.darkShare - 0.5) < 0.02, `duty ${r.darkShare}`);
  });
}

test('a jittery 60 Hz display (frames +-3 ms): still 30 Hz, once a cycle, locked within a frame', () => {
  const r = drive({ fps: 60, jitter: 3, seconds: 20 });
  const L = lockStats(r);
  assert.ok(L.unique, 'never two onsets in one cycle');
  assert.ok(L.maxErr <= r.F + 3 + 1e-6, `worst ${L.maxErr.toFixed(2)} ms`);
  assert.ok(L.lateErr <= r.F + 3 + 1e-6, 'no drift');
  assert.ok(Math.abs(r.onsets.length / 20 - 30) <= 1.5, `${r.onsets.length / 20} a second`);
  assert.ok(Math.abs(r.darkShare - 0.5) < 0.05, `duty ${r.darkShare}`);
});

test('dropped frames are dropped, never made up: no burst after a stall, and the phase holds', () => {
  const drops = [];
  for (let k = 300; k < 330; k++) drops.push(k); // a quarter-second stall at 120 Hz
  const r = drive({ fps: 120, drops });
  const L = lockStats(r);
  assert.ok(L.unique);
  assert.ok(L.lateErr <= r.F + 1e-6, `after the stall the light is back on phase (worst ${L.lateErr.toFixed(2)} ms)`);
  // in the 100 ms after the stall there are no more onsets than cycles
  const tEnd = 123.4 + 330 * (1000 / 120);
  const after = r.onsets.filter((o) => o.t >= tEnd && o.t < tEnd + 100).length;
  assert.ok(after <= 5, `${after} onsets in 100 ms`);
});

test('negative control: a light counted from its own origin is caught off the master phase', () => {
  // the check can fail: the same clock started 12.5 ms off the master origin sits half a cycle away
  const r = drive({ fps: 120, origin: 12.5 });
  const L = lockStats(r, 0);
  assert.ok(L.maxErr > r.F, `worst ${L.maxErr.toFixed(2)} ms`);
  assert.ok(lockStats(r, 12.5).maxErr <= r.F + 1e-6, 'and it is locked to the origin it was given');
});

test('negative control: without the guard a frame-counted light double-flashes inside a cycle on a jittery 60', () => {
  // plain sampling of a 40 Hz wave at jittery 60 Hz frames: onsets bunch, some cycles flash twice per 20 ms
  let a = 7;
  const rnd = () => { a = (a * 1664525 + 1013904223) >>> 0; return a / 4294967296; };
  let last = null;
  const on = [];
  for (let k = 0; k < 1200; k++) {
    const t = 123.4 + k * (1000 / 60) + (rnd() * 2 - 1) * 3;
    const b = ((t / 1000) * 40) % 1 < 0.5;
    if (b && last === false) on.push(t);
    last = b;
  }
  const rate = on.length / 20;
  assert.ok(Math.abs(rate - 40) > 5, `plain sampling shows ${rate} Hz, not 40`);
});

test('createGamma follows the master origin and reports how close each onset sits to its cycle (lockMs)', async () => {
  const q = [];
  let now = 0;
  globalThis.requestAnimationFrame = (f) => { q.push(f); return q.length; };
  globalThis.cancelAnimationFrame = () => {};
  const run = (s, fps) => { const end = now + s * 1000; while (now < end && q.length) { now += 1000 / fps; for (const f of q.splice(0)) f(now); } };
  const flashes = [];
  let info = null;
  const g = createGamma({ style: {} }, { hz: 40, depth: 1, onFlash: (t) => flashes.push(t), onInfo: (i) => { info = i; } });
  run(1.2, 144);
  await new Promise((r) => setTimeout(r, 0));
  run(3, 144);
  assert.equal(info.hz, 40);
  assert.ok(info.lockMs <= 1000 / 144 + 1e-6, `lockMs ${info.lockMs}`);
  for (const t of flashes) {
    const c = t / 25;
    assert.ok(Math.abs(c - Math.round(c)) * 25 <= 1000 / 144 + 1e-6, 'every flash within a frame of a 25 ms line from origin 0');
  }
  g.stop();
});

// ── the hero's cycle on the master beat: items change on master ticks, whatever the frame rate ──
import { makeSchedule } from '../src/schedule.js';

test('a master cycle changes its item on a master tick, at any frame rate', () => {
  let t = 0;
  const beat = createMasterBeat({ now: () => t });
  const sch = makeSchedule({ kind: 'cycle', on: 'master', fps: 24, beat });
  // 300 frames at 24 fps is 12.5 s: exactly 25 ticks
  assert.equal(sch(0).periodMs, 12500);
  const changes = [];
  let last = sch(0).index;
  for (t = 0; t < 60000; t += 37.3) {
    const s = sch(Math.random() * 1e6);
    if (s.index !== last) { changes.push(t); last = s.index; }
  }
  assert.equal(changes.length, 4);
  for (const c of changes) assert.ok(c % 12500 < 37.3 + 1e-9, `changed ${c % 12500} ms after a cycle line`);
  t = 1500 + 12500;
  assert.equal(sch(0).phase, 'cooling', 'phases follow the clock, not the frame');
  const odd = makeSchedule({ kind: 'cycle', on: 'master', fps: 30, beat });
  assert.equal(odd(0).periodMs % 500, 0, 'a cycle that is not whole ticks is rounded to whole ticks');
});

test('negative control: the frame cycle drifts off the grid on a slow machine', () => {
  const sch = makeSchedule({ kind: 'cycle' });
  // 300 frames drawn at 17 frames a second instead of 24: the item changes 17.6 s in, not on a 12.5 s line
  const tChange = (300 / 17) * 1000;
  assert.notEqual(tChange % 500, 0);
  assert.equal(sch(299).index, 0);
  assert.equal(sch(300).index, 1);
});

test('THE GLOBAL SETTLE\'s ripple bus keeps time on the master beat\'s clock', async () => {
  const { readFileSync } = await import('node:fs');
  const g = readFileSync(new URL('../src/global.js', import.meta.url), 'utf8');
  assert.match(g, /const now = opts\.now \?\? masterBeat\(\)\.now;/);
});

test('addTick with beat: an 8 fps entry runs once per 125 ms master line, whatever the display', async () => {
  const { addTick } = await import('../src/ticker.js');
  const q = [];
  const saved = [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame];
  globalThis.requestAnimationFrame = (f) => { q.push(f); return q.length; };
  globalThis.cancelAnimationFrame = () => {};
  try {
    const at = [];
    const off = addTick((t) => at.push(t), 8, 'beat test', { beat: true });
    for (let t = 1000 / 144; t < 4000; t += 1000 / 144) for (const f of q.splice(0)) f(t);
    off();
    assert.ok(Math.abs(at.length - 32) <= 1, `${at.length} calls in 4 s`);
    const lines = at.map((t) => Math.floor(t / 125));
    assert.equal(new Set(lines).size, lines.length, 'one call per 125 ms line');
    for (const t of at) assert.ok(t % 125 < 1000 / 144 + 1e-9, 'each call is the first frame past its line');
  } finally {
    [globalThis.requestAnimationFrame, globalThis.cancelAnimationFrame] = saved;
  }
});

test('THE RE-LOCK (lane FORTYHZ): frames that land on the grid lines never lock the light into a late 33% duty', () => {
  // a page open exactly 100 s: at 120 Hz every third frame sits on a cycle start, a hair either side in floating point
  for (const fps of [100, 120, 144, 240]) {
    const r = drive({ fps, t0: 100000, seconds: 20 });
    const late = r.onsets.filter((o) => o.t >= 100000 + 10000);
    assert.ok(Math.abs(late.length / 10 - 40) <= 0.2, `${fps} Hz: ${late.length / 10} onsets a second`);
    assert.ok(Math.abs(r.darkShare - 0.5) < 0.02, `${fps} Hz: duty ${r.darkShare}`);
    assert.ok(lockStats(r).unique, 'never two onsets in one cycle');
  }
});
