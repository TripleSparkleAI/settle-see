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
// livePaintOf(item, F, t)  - THE ITEM'S OWN PAINT (lane HERORAIN): an item's livePaint { palette, paint(F, t) } read
//                            for one draw: { paint: { hue, gain }, colours: { palette, paletteCore } }, or null
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
// - THE ITEM'S OWN PAINT (lane HERORAIN): any item (a live one above all) may carry livePaint = { palette: [hex],
//   paint: (F, timeSec) => { hue: Uint8Array, gain: Float32Array } }. While it shows, the renderer draws it in the
//   'map' colour mode with that palette (render.js fillMap): every light its palette colour times its gain times its
//   soft read, whatever the settle's own colour mode, so one picture can hold several neons at once. The palette's
//   colours are made once per livePaint object (a WeakMap); a paint whose arrays are the wrong size, or a throw,
//   draws the settle's own colours instead.
// </claudes_code_comments>

import { rgb, tint } from './palette.js';

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

const PAINT_COLOURS = new WeakMap();
export function livePaintOf(item, F, t) {
  const lp = item?.livePaint;
  if (!F || typeof lp?.paint !== 'function' || !Array.isArray(lp.palette)) return null;
  let paint = null;
  try {
    paint = lp.paint(F, t);
  } catch {
    // a paint that throws draws the settle's own colours
  }
  if (paint?.hue?.length !== F.n || paint.gain?.length !== F.n) return null;
  if (!PAINT_COLOURS.has(lp)) PAINT_COLOURS.set(lp, { palette: lp.palette.map(rgb), paletteCore: lp.palette.map((x) => tint(x, lp.coreMix ?? 0.78)) });
  return { paint, colours: PAINT_COLOURS.get(lp) };
}
