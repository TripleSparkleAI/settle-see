// TRUE TIME RENDER: the movie behind keeps its pace; a slow front skips frames, a fast front shows every frame, and
// both always switch to the frame the clock holds at that instant.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTrueTime, replayFrames, createField } from '../src/index.js';

// a front that reaches full agreement settleMs after each switch (agreement rises linearly from 0)
function simulate(settleMs, { until = 10000, dt = 10, frames = 40, threshold = 0.8 } = {}) {
  let t = 0;
  const TT = createTrueTime({ frames, periodMs: 500, threshold, now: () => t, start: 0 });
  let since = 0;
  const switches = [];
  for (t = 0; t <= until; t += dt) {
    const agree = Math.min(1, (t - since) / settleMs);
    const r = TT.update(agree, t);
    if (r.switched) {
      since = t;
      switches.push({ t, frame: r.frame });
    }
  }
  return { TT, switches };
}

test('every switch goes to the frame the movie is at in that instant', () => {
  for (const settleMs of [60, 120, 700, 1700]) {
    const { TT, switches } = simulate(settleMs);
    for (const s of switches) assert.equal(s.frame, Math.floor(s.t / 500) % 40, `settle ${settleMs} at ${s.t}`);
    for (const h of TT.history) assert.equal(h.next, Math.floor(h.t / 500) % 40);
  }
});

test('a fast front shows every frame once and waits for the movie; it never runs ahead', () => {
  const { TT } = simulate(120);
  assert.deepEqual(replayFrames(TT.history), [...Array(20).keys()], 'frames 0..19 in 10 s, each once');
  for (const h of TT.history) assert.ok(h.frame <= Math.floor(h.t / 500), 'never ahead of the movie');
});

test('a slow front skips frames and still keeps the movie\'s time', () => {
  const { TT } = simulate(1700);
  const shown = replayFrames(TT.history);
  const gaps = shown.slice(1).map((f, i) => f - shown[i]);
  assert.ok(gaps.some((g) => g > 1), `skips: ${shown}`);
  assert.ok(Math.floor(10000 / 500) - TT.showing <= Math.ceil(1700 / 500) + 1, `at 10 s showing ${TT.showing}, the movie at 20`);
});

test('negative control: stepping to the NEXT frame in order falls further behind every frame on a slow front', () => {
  // the policy TRUE TIME replaces: on reaching the threshold, show frame + 1
  let shown = 0;
  let since = 0;
  for (let t = 0; t <= 10000; t += 10) if ((t - since) / 1700 >= 0.8) { shown++; since = t; }
  const naiveLag = 20 - shown;
  const { TT } = simulate(1700);
  const ttLag = 20 - TT.showing;
  assert.ok(naiveLag >= 12 && ttLag <= 4, `naive lag ${naiveLag}, true time lag ${ttLag}`);
});

test('the threshold is the ladder\'s dial; the pace is not', () => {
  const lo = simulate(1700, { threshold: 0.6 }).TT;
  const hi = simulate(1700, { threshold: 0.9 }).TT;
  assert.ok(lo.history.length > hi.history.length, 'a lower threshold shows more frames on a slow front');
  assert.equal(lo.frameAt(9999), hi.frameAt(9999), 'the movie is at the same frame for both');
  const T = createTrueTime({ frames: 3, now: () => 0, start: 0 });
  T.set({ threshold: 0.5 });
  assert.equal(T.threshold, 0.5);
  T.set({ threshold: 7 });
  assert.equal(T.threshold, 0.5, 'an impossible threshold is refused');
});

test('a movie that does not loop stops at its last frame; a bad spec is refused', () => {
  const T = createTrueTime({ frames: 4, loop: false, now: () => 0, start: 0 });
  assert.equal(T.frameAt(60000), 3);
  assert.throws(() => createTrueTime({ frames: [] }));
  assert.throws(() => createTrueTime({ frames: 3, periodMs: 0 }));
});

test('field.overlap() is the stats overlap, computed alone', () => {
  const t = Int8Array.from({ length: 300 }, (_, i) => (i % 3 ? 1 : -1));
  const F = createField({ w: 20, h: 15, target: t, seed: 5 });
  for (let k = 0; k < 10; k++) F.sweep(1 / 0.7);
  assert.equal(F.overlap(), F.stats().q);
});

test('restart(t) dated in the past puts the front on the frame the new timeline holds now (CHROMEFS: the footer jumps views)', async () => {
  const { createTrueTime } = await import('../src/truetime.js');
  let t = 10000;
  const T = createTrueTime({ frames: 248, periodMs: 500, now: () => t });
  T.restart(t - 62 * 500 - 6500); // 31 s plus 6.5 s ago: the second view, 13 frames in
  assert.equal(T.showing, 62 + 13);
  assert.equal(T.frameAt(), 62 + 13);
  T.restart(t); // a restart now is frame 0 (the old behaviour, kept)
  assert.equal(T.showing, 0);
});

// ── THE MASTER BEAT: with no clock of its own, a movie turns its frames on the master grid ──
import { masterBeat } from '../src/masterbeat.js';

test('a movie with no clock of its own starts on the master grid and turns on master ticks', () => {
  const T = createTrueTime({ frames: 8 });
  const M = masterBeat();
  const now = M.now();
  const k = T.frameAt(now);
  assert.equal(k, 0, 'it starts at frame 0 on the grid line at or before now');
  // the next frame begins exactly on the next master tick
  const next = M.next(now, 'tick');
  assert.equal(T.frameAt(next - 0.01), 0);
  assert.equal(T.frameAt(next + 0.01), 1);
  // two movies made at different moments share their frame boundaries
  const U = createTrueTime({ frames: 8, periodMs: 125 });
  const b = M.next(M.now(), 125);
  assert.notEqual(U.frameAt(b - 0.01), U.frameAt(b + 0.01));
});

test('negative control: an injected clock keeps its own start (tests and replays are untouched)', () => {
  const T = createTrueTime({ frames: 4, now: () => 1234, periodMs: 500 });
  assert.equal(T.frameAt(1234), 0);
  assert.equal(T.frameAt(1733), 0, 'off the master grid: its start is 1234, not 1000');
  assert.equal(T.frameAt(1735), 1);
});
