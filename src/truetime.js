// settle-see · truetime - TRUE TIME RENDER: a movie keeps its own pace behind, and the field in front settles
// toward whatever frame the movie is at NOW.
//
// <claudes_code_comments>
// ** Function List **
// createTrueTime(opts)   - a true-time clock over a list of frames; returns the object below
//   .frameAt(t)          - the frame the movie behind is at, at clock time t (ms): floor((t - t0) / periodMs)
//   .showing             - the frame the field in front is settling toward now
//   .update(agree, t)    - report the field's agreement with its target (0..1) at time t; when it reaches the
//                          threshold: record a snapshot of `showing`, then switch to frameAt(t). Returns
//                          { switched, snapshot, frame, behind } ('behind' = frames the front is behind the movie)
//   .history             - every snapshot: { t, frame, agree, next } (next = the frame switched to), for replay
//   .on(fn)              - fn(event) on every snapshot: { type: 'snapshot', t, frame, agree, next }
//   .restart(t)          - the movie starts again at t (t may be in the past); the front moves to the frame of now
//   .set({ threshold })  - change the threshold (the perf ladder sets it once; never the pace)
// replayFrames(history)  - the sequence of frames a recorded run showed, in order
// TRUE_TIME_DEFAULTS     - { periodMs: 500, threshold: 0.8, loop: true }
//
// ** Technical Review **
// - THE PRINCIPLE (navigator, 2026-10-01). Two things run at once. THE MOVIE BEHIND advances at its true pace, one
//   frame every periodMs (500 ms by default), whatever the machine does; it is a pure function of the clock. THE
//   FIELD IN FRONT settles toward its current target as fast as the CPU or GPU lets it. When the field's agreement
//   with that target reaches the threshold (80% by default), the frame counts as shown: a snapshot is recorded, and
//   the target becomes the frame the movie is at AT THAT INSTANT, not the next frame in order. A fast machine
//   settles many times per movie frame and shows every frame (and holds the current one, settled, until the movie
//   moves on); a slow machine skips frames; on both the movie keeps its time.
// - In machine-learning terms: the movie is the data stream sampled on a fixed time grid; the field is an anytime
//   inference procedure that is read out when its estimate passes a quality threshold, and then re-targeted to the
//   newest observation instead of the backlog. Latency is bounded by the settle time, never accumulated.
// - In sound-and-picture terms: it is a projector that never slows the film down. If the bulb takes long to warm
//   each frame, some frames are never projected, but the frame on screen is always close to the one the soundtrack
//   is playing.
// - frames may be any list (targets, item specs); only its length is read here. With loop false the movie stops
//   at its last frame. The clock is injectable (opts.now) so tests simulate slow and fast fronts against one clock.
// - history makes a run replayable: replayFrames(history) is exactly the frames shown, in order.
// - THE MASTER BEAT (masterbeat.js): without opts.now the clock is the page's master beat and the movie starts on
//   the master grid line at or before now (restart() with no argument does the same), so every movie's frames turn
//   on the same ticks as the 40 Hz light's onsets and THE DJ's bar line. An injected clock keeps its own start.
// </claudes_code_comments>

import { masterBeat } from './masterbeat.js';

export const TRUE_TIME_DEFAULTS = { periodMs: 500, threshold: 0.8, loop: true };

export function createTrueTime({ frames, periodMs = 500, threshold = 0.8, loop = true, now = null, start = null, keep = 2000 } = {}) {
  const count = typeof frames === 'number' ? frames : frames?.length ?? 0;
  if (!(count > 0)) throw new Error('settle-see truetime: frames must be a non-empty list or a count');
  if (!(periodMs > 0)) throw new Error('settle-see truetime: periodMs must be positive');
  // THE MASTER BEAT: with no clock of its own, a movie reads the page's master beat and starts on its grid line, so
  // every TRUE TIME movie on the page turns its frames on the same 500 ms ticks as the light and the bar line
  const M = now ? null : masterBeat();
  const clock = now ?? M.now;
  let t0 = start ?? (M ? M.floor(clock(), periodMs) : clock());
  let thr = threshold;
  const listeners = new Set();
  const history = [];
  const frameAt = (t = clock()) => {
    const k = Math.max(0, Math.floor((t - t0) / periodMs));
    return loop ? k % count : Math.min(count - 1, k);
  };
  const ticks = (t) => Math.max(0, Math.floor((t - t0) / periodMs)); // unwrapped movie frame count, for 'behind'
  let showing = frameAt(t0);
  let showingTick = 0;
  let settled = false; // the current target has already been snapshotted (a fast front waiting for the movie)
  const T = {
    periodMs,
    count,
    get threshold() { return thr; },
    get showing() { return showing; },
    get history() { return history; },
    frameAt,
    update(agree, t = clock()) {
      const tick = ticks(t);
      const behind = Math.max(0, tick - showingTick);
      let snapshot = null;
      if (!settled && agree >= thr) {
        const next = frameAt(t);
        snapshot = { t, frame: showing, agree, next };
        history.push(snapshot);
        if (history.length > keep) history.shift();
        for (const fn of listeners) fn({ type: 'snapshot', ...snapshot });
        settled = next === showing; // the movie has not moved on: hold this frame, settled, until it does
        if (!settled) {
          showing = next;
          showingTick = tick;
          return { switched: true, snapshot, frame: showing, behind: 0 };
        }
        return { switched: false, snapshot, frame: showing, behind };
      }
      if (settled && frameAt(t) !== showing) {
        // a fast front held a settled frame; the movie moved on, so the target moves with it at once
        showing = frameAt(t);
        showingTick = tick;
        settled = false;
        return { switched: true, snapshot: null, frame: showing, behind: 0 };
      }
      return { switched: false, snapshot, frame: showing, behind };
    },
    on(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    restart(t) {
      t0 = t ?? (M ? M.floor(clock(), periodMs) : clock());
      // the frame the movie holds NOW: a restart dated in the past (a clock moved back to a view's start) lands the
      // front on the current frame of the new timeline, not on frame 0
      showing = frameAt(clock());
      showingTick = 0;
      settled = false;
    },
    set({ threshold: th } = {}) {
      if (th > 0 && th <= 1) thr = th;
    },
  };
  return T;
}

export function replayFrames(history) {
  return history.map((h) => h.frame);
}
