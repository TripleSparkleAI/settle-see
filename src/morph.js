// settle-see · morph - a settle changes its target BY SETTLING: a short TRUE TIME movie from the old picture to the new.
//
// <claudes_code_comments>
// ** Function List **
// morphFrames(from, to, opts)  - the movie behind: frames 0..n-1 of Int8Array, frame 0 = from, the last = to; each
//                                light that differs switches at its own seeded moment, sooner on the left (a soft wipe)
// createMorph(opts)            - the movie on a TRUE TIME clock (truetime.js, loop false); returns the object below
//   .target                    - the frame the field settles toward now
//   .update(s, t)              - report the field's lights at time t; returns { changed, done, agree, showing }
//   .frames / .work            - the movie, and the lights the last switch changed (the agreement is counted on them)
//   .history                   - the TRUE TIME snapshots, for replay
// MORPH_DEFAULTS               - { frames: 4, periodMs: 500, threshold: 0.8, overrun: 2 }
//
// ** Technical Review **
// - THE PRINCIPLE (navigator, 2026-10-01, the bilingual site): a word in one language turns into the same word in
//   another by settling, never by a cut. The movie behind is the sequence old word -> new word, on settle-see's TRUE
//   TIME clock: one movie frame every periodMs (500 ms), whatever the machine does. The field in front settles toward
//   the frame the clock holds; when its agreement reaches the threshold (0.8) the frame counts as shown and the field
//   turns to the frame the movie is at then. A fast machine shows every intermediate frame; a slow one skips some;
//   on both the switch keeps the movie's pace.
// - AGREEMENT is counted on the lights the last switch changed (film.js changedLights / agreementOn), as for films:
//   the whole grid's overlap is dominated by the background that both words share and would pass 0.8 at once.
// - DONE when the field has shown the last frame (agreement on it reached the threshold), or when the movie's clock
//   is `overrun` periods past its end (a hot field that cannot agree yet: the field keeps settling toward the last
//   frame, which is the new target, so nothing is cut).
// - The intermediate frames are a seeded dissolve weighted toward a left-to-right wipe: light i switches when the
//   movie passes rank(i) = 0.65 * column / width + 0.35 * u(i), u a seeded uniform. Pure and node-testable.
// </claudes_code_comments>

import { createTrueTime } from './truetime.js';
import { masterBeat } from './masterbeat.js';
import { changedLights, agreementOn } from './film.js';

export const MORPH_DEFAULTS = { frames: 4, periodMs: 500, threshold: 0.8, overrun: 2 };

function uniform(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function morphFrames(from, to, { frames = MORPH_DEFAULTS.frames, width = 0, seed = 1 } = {}) {
  if (!from || !to || from.length !== to.length) throw new Error('settle-see morph: from and to must be the same size');
  const n = Math.max(2, frames | 0);
  const w = width > 0 ? width : to.length;
  const u = uniform(seed);
  const rank = new Float32Array(to.length);
  for (let i = 0; i < to.length; i++) rank[i] = 0.65 * ((i % w) / w) + 0.35 * u();
  const out = [];
  for (let k = 0; k < n; k++) {
    if (k === 0) out.push(Int8Array.from(from));
    else if (k === n - 1) out.push(Int8Array.from(to));
    else {
      const cut = k / (n - 1);
      const f = new Int8Array(to.length);
      for (let i = 0; i < to.length; i++) f[i] = from[i] === to[i] || rank[i] >= cut ? from[i] : to[i];
      out.push(f);
    }
  }
  return out;
}

export function createMorph({ from, to, width = 0, frames = MORPH_DEFAULTS.frames, periodMs = MORPH_DEFAULTS.periodMs, threshold = MORPH_DEFAULTS.threshold, overrun = MORPH_DEFAULTS.overrun, seed = 1, now = null } = {}) {
  const movie = morphFrames(from, to, { frames, width, seed });
  // THE MASTER BEAT: with no clock of its own the morph reads the page's master beat and starts on its grid line
  const MB = now ? null : masterBeat();
  const clock = now ?? MB.now;
  const t0 = MB ? MB.floor(clock(), periodMs) : clock();
  const TT = createTrueTime({ frames: movie.length, periodMs, threshold, loop: false, now: clock, start: t0 });
  let showing = TT.showing;
  let work = new Int32Array(0); // frame 0 is the picture the field already holds
  let done = false;
  const last = movie.length - 1;
  const M = {
    frames: movie,
    periodMs,
    get target() { return movie[showing]; },
    get showing() { return showing; },
    get work() { return work; },
    get history() { return TT.history; },
    get done() { return done; },
    update(s, t = clock()) {
      if (done) return { changed: false, done: true, agree: 1, showing };
      const agree = agreementOn(s, movie[showing], work);
      if (showing === last && agree >= threshold) {
        done = true;
        return { changed: false, done, agree, showing };
      }
      if (t - t0 >= periodMs * (last + overrun)) {
        // the movie ended long ago and the field has not agreed (it is hot): target the new picture and let go
        if (showing !== last) {
          work = changedLights(movie[last], movie[showing]);
          showing = last;
          return { changed: true, done, agree, showing };
        }
        done = true;
        return { changed: false, done, agree, showing };
      }
      const r = TT.update(agree, t);
      let changed = false;
      if (r.frame !== showing) {
        work = changedLights(movie[r.frame], movie[showing]);
        showing = r.frame;
        changed = true;
      }
      return { changed, done, agree, showing };
    },
  };
  return M;
}
