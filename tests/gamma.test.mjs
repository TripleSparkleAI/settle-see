// HOT GAMMA RED: the square wave is 40 Hz by the clock, and a slow display is refused rather than aliased.
import test from 'node:test';
import assert from 'node:assert/strict';
import { gammaPhase, canShowHz } from '../src/gamma.js';

test('the square wave turns bright 40 times a second, sampled finely', () => {
  let flips = 0;
  let last = gammaPhase(0);
  for (let i = 1; i <= 100000; i++) {
    const b = gammaPhase(i / 100000, 40);
    if (b && !last) flips++;
    last = b;
  }
  assert.ok(Math.abs(flips - 40) <= 1, `${flips}`);
});

test('a 120 Hz display can show 40 Hz; a 60 Hz display is refused', () => {
  assert.equal(canShowHz(120, 40), true);
  assert.equal(canShowHz(60, 40), false);
});

test('negative control: sampled at 60 frames a second, 40 Hz aliases to a slower beat', () => {
  let flips = 0;
  let last = gammaPhase(0);
  for (let i = 1; i <= 600; i++) {
    const b = gammaPhase(i / 60, 40);
    if (b && !last) flips++;
    last = b;
  }
  assert.ok(flips / 10 < 30, `shown ${flips / 10} Hz`);
});

// ── full on/off (depth 1, duty 0.5): the hero's HOT GAMMA RED, 12.5 ms lit and 12.5 ms dark at 40 Hz ──
import { gammaLevel, clampGamma, createGamma } from '../src/gamma.js';

test('depth 1 draws the dark half fully dark; depth is clamped to [0, 1] and NaN is refused', () => {
  assert.equal(gammaLevel(true, 1), 1);
  assert.equal(gammaLevel(false, 1), 0);
  assert.equal(gammaLevel(false, 0.55), 1 - 0.55);
  assert.equal(gammaLevel(false, 3), 0);
  assert.equal(gammaLevel(false, -1), 1);
  assert.equal(gammaLevel(false, NaN), 1, 'a broken depth flickers nothing rather than going black');
});

test('clampGamma keeps duty inside (0, 1) and defaults what is missing', () => {
  assert.deepEqual(clampGamma({ hz: 40, duty: 0.5, depth: 1 }), { hz: 40, duty: 0.5, depth: 1 });
  assert.equal(clampGamma({ duty: 0 }).duty, 0.05);
  assert.equal(clampGamma({ duty: 1 }).duty, 0.95);
  assert.equal(clampGamma({ hz: NaN }).hz, 40);
});

test('at depth 1 and duty 0.5 the square wave is dark for half of each 25 ms period', () => {
  let dark = 0;
  const N = 100000;
  for (let i = 0; i < N; i++) if (!gammaPhase(i / N, 40, 0.5)) dark++;
  assert.ok(Math.abs(dark / N - 0.5) < 0.001, `${dark / N}`);
  // 12.5 ms lit, 12.5 ms dark
  assert.equal(gammaPhase(0.0124, 40, 0.5), true);
  assert.equal(gammaPhase(0.0126, 40, 0.5), false);
  assert.equal(gammaPhase(0.0249, 40, 0.5), false);
});

// a fake display: requestAnimationFrame fires at a fixed rate on a fake clock
function display(fps) {
  const q = [];
  let now = 0;
  globalThis.requestAnimationFrame = (f) => { q.push(f); return q.length; };
  globalThis.cancelAnimationFrame = () => {};
  return {
    run(seconds) {
      const end = now + seconds * 1000;
      while (now < end && q.length) {
        now += 1000 / fps;
        const fs = q.splice(0);
        for (const f of fs) f(now);
      }
    },
  };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('createGamma on a 120 Hz display: shows 40 Hz, fully dark (opacity 0) about half the drawn time', async () => {
  const D = display(120);
  const el = { style: { opacity: '' } };
  const seen = new Set();
  let info = null;
  const g = createGamma(el, { hz: 40, depth: 1, duty: 0.5, onInfo: (i) => { info = i; } });
  D.run(1.2); // measureRefresh (about a second of frames)
  await tick();
  const orig = el.style;
  el.style = new Proxy(orig, { set(o, k, v) { if (k === 'opacity') seen.add(v); o[k] = v; return true; } });
  D.run(2.2);
  assert.equal(info.refused, null);
  assert.equal(info.depth, 1);
  assert.ok(Math.abs(info.refresh - 120) < 1, `refresh ${info.refresh}`);
  assert.ok(Math.abs(info.shownHz - 40) <= 1, `shown ${info.shownHz}`);
  assert.ok(Math.abs(info.darkShare - 0.5) < 0.05, `dark share ${info.darkShare}`);
  assert.deepEqual([...seen].sort(), ['0', '1']);
  g.stop();
  assert.equal(el.style.opacity, '', 'stop restores the element');
});

test('negative control: slow "refuse" on a 60 Hz display refuses and never touches the element', async () => {
  const D = display(60);
  const el = { style: { opacity: '' } };
  let info = null;
  createGamma(el, { hz: 40, depth: 1, slow: 'refuse', onInfo: (i) => { info = i; } });
  D.run(1.2);
  await tick();
  D.run(1);
  assert.match(info.refused, /60 frames a second/);
  assert.equal(info.running, false);
  assert.equal(el.style.opacity, '');
});

import { darkTime, createDither } from '../src/gamma.js';

test('darkTime integrates the ideal wave: half of any whole number of periods, exact inside one period', () => {
  assert.ok(Math.abs(darkTime(0, 1, 40, 0.5) - 0.5) < 1e-9);
  assert.ok(Math.abs(darkTime(0, 0.0125, 40, 0.5)) < 1e-9, 'the first 12.5 ms are lit');
  assert.ok(Math.abs(darkTime(0.0125, 0.025, 40, 0.5) - 0.0125) < 1e-9, 'the next 12.5 ms are dark');
  assert.equal(darkTime(1, 0.5), 0);
});

for (const fps of [120, 144, 165, 240]) {
  test(`the dither on a ${fps} Hz display: 40 flips a second and a 50% dark share`, () => {
    const D = createDither(40, 0.5, 1 / fps);
    let flips = 0;
    let dark = 0;
    let last = null;
    const N = fps * 10;
    for (let k = 0; k < N; k++) {
      const b = D.step(100 + k / fps); // far from zero, as a page that has been open a while
      if (last === false && b) flips++;
      if (!b) dark++;
      last = b;
    }
    assert.ok(Math.abs(flips / 10 - 40) <= 0.2, `${flips / 10} Hz`);
    assert.ok(Math.abs(dark / N - 0.5) < 0.01, `${dark / N}`);
  });
}

test('negative control: plain sampling at 120 Hz drifts off 50% (why the dither exists)', () => {
  let dark = 0;
  const N = 1200;
  for (let k = 0; k < N; k++) if (!gammaPhase(100 + k / 120, 40, 0.5)) dark++;
  assert.ok(Math.abs(dark / N - 0.5) > 0.1, `${dark / N}`);
});

// ── a display slower than 100 frames a second: the nearest rate it draws exactly, labelled ──
import { nearestRate } from '../src/gamma.js';

test('nearestRate: the closest exact 50% square wave a display draws: 30 at 60, 36 at 72, 37.5 at 75, 45 at 90', () => {
  assert.deepEqual(nearestRate(60, 40), { hz: 30, k: 1 });
  assert.deepEqual(nearestRate(72, 40), { hz: 36, k: 1 });
  assert.deepEqual(nearestRate(75, 40), { hz: 37.5, k: 1 });
  assert.deepEqual(nearestRate(90, 40), { hz: 45, k: 1 });
  assert.deepEqual(nearestRate(30, 40), { hz: 15, k: 1 });
  assert.equal(nearestRate(0, 40).hz, 0);
});

test('slow "nearest" on a 60 Hz display: runs 30 Hz, labelled, half the time dark, through a custom apply', async () => {
  const D = display(60);
  const el = { style: { opacity: '' } };
  const states = [];
  let info = null;
  const g = createGamma(el, { hz: 40, depth: 1, slow: 'nearest', apply: (b) => states.push(b), onInfo: (i) => { info = i; } });
  D.run(1.2);
  await tick();
  D.run(2.2);
  assert.equal(info.refused, null);
  assert.equal(info.nearest, true);
  assert.equal(info.asked, 40);
  assert.ok(Math.abs(info.hz - 30) < 0.5, `${info.hz}`);
  assert.ok(Math.abs(info.shownHz - 30) <= 1, `shown ${info.shownHz}`);
  assert.ok(Math.abs(info.darkShare - 0.5) < 0.05, `${info.darkShare}`);
  assert.equal(el.style.opacity, '', 'apply replaced the opacity write');
  assert.ok(states.includes(true) && states.includes(false));
  g.stop();
  assert.equal(states.at(-1), null, 'stop tells apply to clear');
});
