// settle-see · gamma - HOT GAMMA RED: a 40 Hz brightness flicker over a whole settle, in hot red.
//
// <claudes_code_comments>
// ** Function List **
// measureRefresh(ms)         - the display's frame rate: the 20th-percentile requestAnimationFrame interval over about a
//                              second, snapped to a standard rate within 2% (snapRefresh, DISPLAY_RATES)
// refreshFromIntervals(d)    - the same rule on a list of frame intervals in ms (pure; the measurement's arithmetic)
// pickFlashRate(refresh, hz, slow) - THE RATE RULE: true hz at 100 frames a second and up, the nearest exact rate below
// createFlashClock(opts)     - step(t) -> { bright, onset, cycle } on the MASTER BEAT's phase: drops frames rather than
//                              drifting, one onset per cycle at most, the carry capped at one frame
// gammaPhase(t, hz, duty)    - true in the bright half of a square wave of frequency hz at time t (seconds)
// gammaLevel(bright, depth)  - the opacity drawn for a phase: 1 when bright, 1 - depth when dark (depth 1 = black)
// darkTime(t0, t1, hz, duty) - how long the ideal square wave is dark between t0 and t1 (seconds)
// createDither(hz, duty, frame) - step(t) -> bright: picks each frame's state so the drawn dark time tracks the
//                              ideal one (error carried frame to frame), so a display whose frames do not split a
//                              period evenly still shows the asked duty on average and one flip per period
// nearestRate(refresh, hz)  - the exact 50% square wave a slow display CAN draw closest to hz: refresh / (2k), k whole
//                              frames lit then k dark ({ hz, k }); 30 Hz at 60, 36 at 72, 37.5 at 75, 45 at 90
// clampGamma(opts)           - hz, duty and depth made safe: duty in [0.05, 0.95], depth in [0, 1]
// createGamma(el, opts)      - start a flicker on an element; returns { stop(), info } where info carries the
//                              display rate, the target hz, the flicker frequency actually shown and lockMs (the
//                              worst distance in the last second from an onset frame to its master cycle start)
// canShowHz(refresh, hz)     - can a display at `refresh` frames per second show `hz` without a slower beat
//
// ** Technical Review **
// - OFF BY DEFAULT everywhere. It is a mode a person switches on, behind a warning (fortyhz.js holds the page's one
//   switch and clock).
// - The flicker is a square wave in the element's opacity between 1 and 1 - depth, timed by the clock rather than
//   by the frame count, and checked every display frame. opts.apply(bright) replaces the opacity write, so a page can
//   flicker something else. The site's 40 Hz mode does not call this per element: it runs ONE page clock for every
//   settle (fortyhz.js), built from the same createFlashClock and pickFlashRate. A display shows a 40 Hz square wave only if it draws at
//   least twice per half period well enough: below about 100 frames per second the wave aliases into a slower beat
//   (a 60 Hz screen turns 40 Hz into 20 Hz flicker, which is worse for photosensitive viewers), so createGamma
//   never asks a slow display for 40 Hz: it shows the nearest exact rate or refuses (info.refused).
// - depth 1 with duty 0.5 is a full on/off square wave: the element is fully dark for half of every period
//   (12.5 ms on, 12.5 ms off at 40 Hz, the same timing as the light flicker in Iaccarino et al. 2016).
// - A frame is shown for a whole frame interval, so the state is chosen for the interval it will be on screen, not
//   for the instant it was drawn: createDither() compares the ideal dark time inside the coming interval with the
//   dark time already drawn and carries the difference. On a 120 Hz display (three frames per 25 ms period) plain
//   sampling shows 2 frames lit and 1 dark (or the reverse, as the clock drifts), a 33% or 67% duty; the dither
//   alternates the two so the average is 50% while each period still flips once.
// - info.darkShare is the share of drawn time the element actually spent dark over the last second, measured from
//   the frame timestamps, so a display that cannot split a period evenly shows its real duty, not the asked one.
// - A SLOW DISPLAY (below 100 frames a second): with opts.slow 'refuse' createGamma refuses; with 'nearest' (the
//   default) it runs the nearest rate the display draws exactly (nearestRate), on the master phase, and says so:
//   info.nearest = true, info.hz the rate shown, info.asked the rate asked for. A 60 Hz
//   screen cannot show 40 Hz: a square wave there has a half-period of a whole number of frames (30, 15, 10 Hz with
//   50% duty), and a 40 Hz request aliases into an uneven pattern the eye reads mostly as 20 Hz.
// - info.shownHz counts the bright-to-dim transitions actually drawn per second, so the readout reports the
//   frequency the viewer is seeing, not the one asked for.
// - ON THE MASTER BEAT (navigator, 2026-10-01): the wave is counted from the master beat's origin (masterbeat.js),
//   the same origin TRUE TIME, THE DJ's bar line and the binaural pair count from. A TRUE TIME tick is 20 cycles of
//   40 Hz, so every tick is a flash onset. Each frame's state comes from createFlashClock: frames that miss are
//   dropped, never made up; a cycle never flashes twice; the carry that keeps the duty exact is capped at a frame.
// - THE DEFAULT IS 'nearest' (a good default that works on every display): 40 Hz at 100 frames a second and up
//   (120, 144, 165, 240), 45 Hz at 90, 37.5 at 75, 30 at 60, and the light says which rate it shows. The display's
//   rate is measured over about a second and measured again whenever the tab becomes visible. 'refuse' remains.
// - Respect for viewers: prefers-reduced-motion refuses the mode; the site shows a photosensitivity warning beside
//   the switch.
// </claudes_code_comments>

import { masterBeat } from './masterbeat.js';

export function canShowHz(refresh, hz) {
  return refresh >= Math.max(100, 2.4 * hz);
}

export function gammaPhase(t, hz = 40, duty = 0.5) {
  const p = (t * hz) % 1;
  return p < duty;
}

export function gammaLevel(bright, depth = 0.55) {
  const d = Math.min(1, Math.max(0, Number.isFinite(depth) ? depth : 0));
  return bright ? 1 : 1 - d;
}

function litTime(t, hz, duty) {
  const c = t * hz;
  const k = Math.floor(c);
  return (k * duty + Math.min(c - k, duty)) / hz;
}

export function darkTime(t0, t1, hz = 40, duty = 0.5) {
  if (!(t1 > t0)) return 0;
  return Math.max(0, t1 - t0 - (litTime(t1, hz, duty) - litTime(t0, hz, duty)));
}

export function createDither(hz = 40, duty = 0.5, frame = 1 / 120) {
  let carry = 0;
  return {
    step(t) {
      const want = darkTime(t, t + frame, hz, duty);
      const dark = carry + want > frame / 2;
      carry += want - (dark ? frame : 0);
      return !dark;
    },
  };
}

export function nearestRate(refresh, hz = 40) {
  if (!(refresh > 0)) return { hz: 0, k: 0 };
  const k = Math.max(1, Math.round(refresh / (2 * hz)));
  return { hz: refresh / (2 * k), k };
}

export function clampGamma({ hz = 40, duty = 0.5, depth = 0.55 } = {}) {
  const ok = (x, d) => (Number.isFinite(x) ? x : d);
  return {
    hz: Math.max(0.1, ok(hz, 40)),
    duty: Math.min(0.95, Math.max(0.05, ok(duty, 0.5))),
    depth: Math.min(1, Math.max(0, ok(depth, 0.55))),
  };
}

// the rates displays actually run at; a measured interval within 2% of one of them is that rate (59.94 reads as 60)
export const DISPLAY_RATES = [24, 25, 30, 48, 50, 60, 72, 75, 90, 100, 120, 144, 165, 240];

export function snapRefresh(r) {
  if (!(r > 0)) return 0;
  for (const s of DISPLAY_RATES) if (Math.abs(r - s) / s < 0.02) return s;
  return r;
}

// the display's frame rate from a list of frame intervals (ms). A dropped frame only ever LENGTHENS an interval, so
// the median of a busy page reads a 120 Hz display as 60 once half its frames drop (lane FORTYHZ, 2026-10-02: the
// navigator's 120 Hz screen showed "ON, 30 HZ"). The 20th percentile reads the display's own period while up to 80% of
// frames are dropped; the snap to a standard rate absorbs the jitter of the shortest ones.
export function refreshFromIntervals(d) {
  const ok = (d ?? []).filter((x) => x > 0).sort((a, b) => a - b);
  if (!ok.length) return 0;
  return snapRefresh(1000 / ok[Math.floor(ok.length * 0.2)]);
}

// the display's frame rate: refreshFromIntervals over about a second of requestAnimationFrame (at least 10 frames)
export function measureRefresh(ms = 1000) {
  return new Promise((resolve) => {
    if (typeof requestAnimationFrame === 'undefined') return resolve(0);
    const ts = [];
    const f = (t) => {
      ts.push(t);
      if (ts.length < 11 || t - ts[0] < ms) requestAnimationFrame(f);
      else resolve(refreshFromIntervals(ts.slice(1).map((x, i) => x - ts[i])));
    };
    requestAnimationFrame(f);
  });
}

// THE RATE RULE: true hz on a display that draws it (canShowHz: 100 frames a second and up for 40 Hz); below that,
// the nearest exact 50% wave the display draws (nearestRate), or a refusal when slow is 'refuse'
export function pickFlashRate(refresh, hz = 40, slow = 'nearest') {
  if (!(refresh > 0)) return { hz: 0, nearest: false, refused: 'the display rate could not be measured' };
  if (canShowHz(refresh, hz)) return { hz, nearest: false, refused: null };
  if (slow === 'nearest') {
    const n = nearestRate(refresh, hz);
    return { hz: n.hz, k: n.k, nearest: true, refused: null };
  }
  return { hz: 0, nearest: false, refused: `this display draws ${Math.round(refresh)} frames a second; ${hz} Hz needs at least ${Math.round(Math.max(100, 2.4 * hz))}` };
}

// THE FLASH ON THE MASTER PHASE: step(t) -> { bright, onset, cycle } for the frame drawn at master time t (ms).
// Each frame covers [t, t + frame); its state comes from the ideal square wave over that interval (darkTime),
// counted from the master origin, with the dither's carry so an uneven split still averages the duty. Three rules:
//   - display slots, not timestamps: the display's vsync phase is learned from the frames (a slow running mean),
//     and each frame is placed in its slot on that grid, so timestamp jitter under half a frame changes nothing;
//     a second call in one slot changes nothing;
//   - drop, never drift: a skipped slot (a dropped frame, a stalled tab) clears the carry, so the next frame is
//     decided by the master phase alone and the missed flashes are never made up;
//   - one onset per cycle: a dark-to-bright change less than a cycle (less one frame) after the last onset stays
//     dark, so no cycle ever flashes twice; cycle is the master cycle whose start the onset is nearest; the one
//     exception re-locks a late phase to the on-time onset (see the step);
//   - the carry never exceeds one frame, so a stall cannot bank a burst.
export function createFlashClock({ hz = 40, duty = 0.5, refresh = 120, origin = 0 } = {}) {
  const F = 1000 / refresh;
  const f = F / 1000;
  const P = 1000 / hz;
  const minGap = P - 0.9 * F; // two onsets closer than a cycle less one frame would be a double flash
  let carry = 0;
  let lastN = null;
  let last = null;
  let lastOnsetT = -Infinity;
  let lastOnsetCycle = null;
  let lastLate = false;
  let held = null;
  let phi = null; // the display's vsync phase against the master grid, in ms, learned from the frames
  const wrap = (x) => ((x % F) + F) % F;
  return {
    hz,
    frameMs: F,
    step(t) {
      // the display slot this frame fills: frame timestamps jitter, the slots do not
      // phi is learned as a running mean and never wrapped after the first frame: wrapping it would let a frame
      // that sits on a grid line (a timestamp a hair either side of a whole frame) jump phi by a whole frame, which
      // moves every slot index by one and reads as a repeated or a dropped frame (lane FORTYHZ found it at t = 100 s)
      if (phi === null) phi = wrap(t - origin);
      else phi += 0.05 * (wrap(t - origin - phi + F / 2) - F / 2);
      const n = Math.round((t - origin - phi) / F);
      if (lastN !== null && n <= lastN) return { ...held, onset: false }; // a second call in one slot changes nothing
      if (lastN !== null && n - lastN > 1) carry = 0; // dropped frames: dropped, never made up
      lastN = n;
      const tq = origin + phi + n * F;
      const s = (tq - origin) / 1000;
      const want = darkTime(s, s + f, hz, duty);
      let dark = carry + want > f / 2;
      const wasDark = last === false;
      // ONE ONSET PER CYCLE: a dark-to-bright change less than a cycle (less one frame) after the last onset stays
      // dark, so no cycle flashes twice. ONE EXCEPTION, THE RE-LOCK (lane FORTYHZ): when the last onset was LATE (more
      // than half a frame after its cycle start) and this frame holds its own cycle start, the on-time onset wins.
      // Without it, frames that land on the grid lines (a page open exactly 100 s) let one late onset bar the next
      // cycle's on-time one, and the clock locked into the late phase at a 33% duty for good (0.62-0.67 dark at 120 Hz).
      const cyc = Math.round((tq - origin) / P);
      const onTime = Math.abs(tq - (origin + cyc * P)) <= F / 2;
      if (!dark && wasDark && tq - lastOnsetT < minGap && !(onTime && lastLate && cyc !== lastOnsetCycle)) dark = true;
      carry = Math.max(-f, Math.min(f, carry + want - (dark ? f : 0)));
      const bright = !dark;
      const rising = bright && last !== true;
      if (rising) {
        lastOnsetT = tq;
        lastOnsetCycle = cyc;
        lastLate = tq - (origin + cyc * P) > F / 2;
      }
      last = bright;
      held = { bright, onset: rising && wasDark, cycle: Math.round((tq - origin) / P) };
      return held;
    },
  };
}

export function createGamma(el, { onInfo, onFlash, apply, slow = 'nearest', origin: originOpt = null, ...opts } = {}) {
  const { hz, duty, depth } = clampGamma(opts);
  const origin = Number.isFinite(originOpt) ? originOpt : masterBeat().origin; // THE MASTER BEAT's phase origin
  const info = { hz, asked: hz, nearest: false, duty, depth, refresh: 0, shownHz: 0, darkShare: 0, lockMs: 0, running: false, refused: null };
  const write = apply ?? ((bright) => { el.style.opacity = String(gammaLevel(bright, depth)); });
  let raf = 0;
  let stopped = false;
  let measuring = 0;
  let last = null;
  let flips = 0;
  let t0 = 0;
  let tPrev = 0;
  let darkT = 0;
  let lock = 0;
  let clock = null;
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const hasDoc = typeof document !== 'undefined' && typeof document.addEventListener === 'function';
  const onVisible = () => {
    if (!stopped && !document.hidden) start(); // the tab woke: the display may have changed, so measure again
  };
  const stop = () => {
    stopped = true;
    cancelAnimationFrame(raf);
    if (hasDoc) document.removeEventListener('visibilitychange', onVisible);
    if (apply) apply(null);
    else el.style.opacity = '';
    info.running = false;
    onInfo?.({ ...info });
  };
  if (reduced) {
    info.refused = 'reduced motion is on';
    onInfo?.({ ...info });
    return { stop, info };
  }
  const loop = (now) => {
    if (stopped || !clock) return;
    raf = requestAnimationFrame(loop);
    const { bright, onset, cycle } = clock.step(now);
    if (onset) {
      // how far this onset frame sits from its cycle's start on the master grid
      const err = Math.abs(now - (origin + (cycle * 1000) / clock.hz));
      lock = Math.max(lock, err);
      onFlash?.(now, cycle);
    }
    // the state drawn since the last frame was `last`: count how long it stayed dark
    if (tPrev && last === false) darkT += (now - tPrev) / 1000;
    tPrev = now;
    if (last !== null && bright && !last) flips++;
    if (bright !== last) write(bright);
    last = bright;
    if (!t0) t0 = now;
    if (now - t0 >= 1000) {
      const sec = (now - t0) / 1000;
      info.shownHz = flips / sec;
      info.darkShare = darkT / sec;
      info.lockMs = lock;
      flips = 0;
      darkT = 0;
      lock = 0;
      t0 = now;
      onInfo?.({ ...info });
    }
  };
  function start() {
    cancelAnimationFrame(raf);
    clock = null;
    const ticket = ++measuring;
    measureRefresh().then((r) => {
      if (stopped || ticket !== measuring) return;
      info.refresh = r;
      const pick = pickFlashRate(r, hz, slow);
      info.refused = pick.refused;
      info.nearest = pick.nearest;
      info.hz = pick.refused ? hz : pick.hz;
      if (pick.refused) {
        info.running = false;
        onInfo?.({ ...info });
        return;
      }
      clock = createFlashClock({ hz: pick.hz, duty, refresh: r, origin });
      info.running = true;
      last = null;
      t0 = 0;
      tPrev = 0;
      raf = requestAnimationFrame(loop);
      onInfo?.({ ...info });
    });
  }
  if (hasDoc) document.addEventListener('visibilitychange', onVisible);
  start();
  return { stop, info };
}
