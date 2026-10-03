// settle-see · live - a LIVE TARGET: an item whose target is a function of the moment (a spectrum, a meter, a clock),
// sampled on TRUE TIME's grid, so the field chases a source that keeps changing.
//
// <claudes_code_comments>
// ** Function List **
// LIVE_DEFAULTS            - { periodMs: 125, threshold: 0.8 }: the grid a live item is sampled on, and the agreement
//                            the field must reach before it takes a fresh sample
// LIVE_FRAMES              - the frame count handed to TRUE TIME for a live item (it never ends)
// isLive(item)             - true for { live: (w, h, t) => bits }
// liveFrame(item, w, h, t) - one sample: the function's answer checked and copied into a fresh Int8Array of w x h
//                            (+1 lit, -1 dark); null when the function throws or answers the wrong size
//
// ** Technical Review **
// - A live item is { live: fn, periodMs, threshold, T, tween, rampMs, note } in settle()'s items. fn(w, h, t) gets
//   the grid size and the clock time in ms and answers w * h values; anything above 0 is lit.
// - TRUE TIME (truetime.js) runs it exactly like a film whose frames are made on demand: the source behind is sampled
//   on a fixed grid (periodMs, 125 ms by default, a quarter of the films' 500 ms); the field settles toward the
//   sample it holds; when its agreement with that sample, counted on the lights the new sample changed, reaches the
//   threshold, the field takes the sample of THAT instant. A fast machine shows every grid step and holds each
//   settled one; a slow one skips steps; the picture is never more than one settling time behind the source.
// - A sample is always copied: the function may reuse its own buffer between calls.
// - A wrong answer (a throw, null, a wrong length) keeps the target the field already has: a live source that falls
//   over leaves the last good picture, never an empty one.
// - Under reduced motion a live item is sampled once and held still.
// </claudes_code_comments>

export const LIVE_DEFAULTS = { periodMs: 125, threshold: 0.8 };
export const LIVE_FRAMES = 2 ** 30;

export function isLive(it) {
  return !!(it && typeof it === 'object' && typeof it.live === 'function');
}

export function liveFrame(item, w, h, t) {
  let b;
  try {
    b = item.live(w, h, t);
  } catch {
    return null;
  }
  const n = w * h;
  if (!b || typeof b.length !== 'number' || b.length !== n) return null;
  const out = new Int8Array(n);
  for (let i = 0; i < n; i++) out[i] = b[i] > 0 ? 1 : -1;
  return out;
}
