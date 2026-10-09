// settle-see · weather - THE WEATHER OPTION (lane SOUNDSHAKE): a page's per-frame modulation of a settle's own knobs,
// so something outside the picture (the hero's sound) can move it through its physics alone.
//
// <claudes_code_comments>
// ** Function List **
// WEATHER_NEUTRAL      - { heat 1, lean 1, pull 1, rate 1, soften null, streak null, crackle null }: the settle as it is
// WEATHER_LIMITS       - the hard bounds settle-see keeps whatever a page asks (a page keeps tighter ones)
// weatherOf(w)         - pure: a page's answer -> a weather with every knob finite and inside WEATHER_LIMITS; null or
//                        a missing knob is neutral
//
// ** Technical Review **
// - settle(canvas, { weather }) calls weather({ frame, T, phase, index }) once a frame, before the page's beforeStep:
//   heat multiplies the frame's temperature (after the schedule, the film and any ripple's kick), lean and pull
//   multiply the settle's own lean and pull into the field (so set() still owns the base values, and a weather of 1
//   gives them back exactly), rate multiplies the sweeps a frame (a fraction is carried to the next frame), soften
//   replaces the soft read's factor (a slower read is a motion blur of the running average), and streak draws a band
//   of holds across the field for that frame only (a lens-flare streak: { x, y, tilt, width, reach, strength,
//   shimmer }). Nothing here colours a light; colour stays the renderer's.
// - crackle (lane CLEARTEXT, crackle.js): { strength, rate, outer } flares the lights along the target's edges
//   overbright, a few a frame, through the field's draw-only flash; the physics and the body of the picture are
//   untouched. crackleOf bounds it (CRACKLE_LIMITS); null or a zero strength is no crackle.
// - A page that passes weather gets the field's lean and pull reset from the settle's own every frame, so a
//   beforeStep that nudges F.pull starts from the true base each time.
// </claudes_code_comments>

import { crackleOf } from './crackle.js';

export const WEATHER_NEUTRAL = Object.freeze({ heat: 1, lean: 1, pull: 1, rate: 1, soften: null, streak: null, crackle: null });

export const WEATHER_LIMITS = Object.freeze({ heat: [0.5, 2], lean: [0.5, 1.5], pull: [0.5, 2], rate: [0.25, 3], soften: [0, 0.95] });

const bound = (x, [lo, hi], d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);

export function weatherOf(w) {
  if (!w || typeof w !== 'object') return WEATHER_NEUTRAL;
  return {
    heat: bound(w.heat, WEATHER_LIMITS.heat, 1),
    lean: bound(w.lean, WEATHER_LIMITS.lean, 1),
    pull: bound(w.pull, WEATHER_LIMITS.pull, 1),
    rate: bound(w.rate, WEATHER_LIMITS.rate, 1),
    soften: Number.isFinite(w.soften) ? bound(w.soften, WEATHER_LIMITS.soften, null) : null,
    streak: w.streak && typeof w.streak === 'object' && w.streak.strength > 0 ? w.streak : null,
    crackle: crackleOf(w.crackle),
  };
}
