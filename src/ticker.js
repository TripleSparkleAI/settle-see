// settle-see · ticker - one requestAnimationFrame loop shared by every settle on the page, its own cost meter, and
// the one place that decides when the page's settles halt (tab hidden, or nobody there).
//
// <claudes_code_comments>
// ** Function List **
// addTick(fn, fps, label, { beat }) - call fn(now) about fps times a second from the shared loop; returns a remove
//                           function; beat: true puts the calls on THE MASTER BEAT's 1000 / fps grid
// tickerStats()           - what the loop has cost since the last reset: { ms, frames, calls, seconds, share,
//                           entries, byLabel } (share = ms / wall ms, the main-thread fraction the settles used)
// resetTickerStats()      - start the meter again
// tickerState()           - { state: 'running' | 'hidden' | 'away' | 'held', since, idleMs, lastActivity }
// onTickerState(fn)       - fn({ state, reason, since, awayMs }) on every change of state; returns an unsubscribe
// setIdleTimeout(ms)      - how long with no activity before the settles halt (default IDLE_MS, 5 minutes)
// wakeTicker()            - count now as activity: resume at once (a page's "resume" button)
// holdTicker(on)          - PAUSE ALL: on halts every settle (state 'held', so settle-hear suspends too) until off
// tickerHeld()            - is PAUSE ALL on
// IDLE_MS                 - 300,000 ms
//
// ** Technical Review **
// - A page with thirty small settles (a credits page) runs one browser loop, not thirty. Each entry keeps its own
//   frame budget; the loop stops itself when no entries remain, while the tab is hidden, and while nobody is there.
// - THE HALT RULE (navigator, 2026-10-01), one implementation for every settle on the site:
//     hidden  - the tab is hidden (visibilitychange): nothing runs, the rAF loop is not even scheduled;
//     away    - no pointer move, pointer down, key, wheel, scroll or touch in this tab for idleMs (5 minutes):
//               the loop stops; the settles hold their last frame;
//     held    - the reader pressed PAUSE ALL (holdTicker(true)); only holdTicker(false) resumes, not activity;
//     running - otherwise. The tab becoming visible, or any of those inputs, resumes at once.
//   Every change fires onTickerState listeners and a window event 'settle:ticker' with the same detail, so a page
//   can show a quiet "paused while you were away" note, and settle-hear (which listens for that event) suspends its
//   AudioContext while the state is not running. Activity listeners are passive and only store a timestamp.
// - The away check runs from the loop itself and, while the loop is stopped, from a 1 s timer that does nothing but
//   compare two numbers; there is no other polling.
// - The meter: every call of an entry is timed with performance.now() and summed, overall and per label (a settle
//   passes its label, e.g. 'hero 360x209'). Two clock reads per call cost well under a microsecond, so the meter is
//   always on. The perf ladder's budget test and tools/perf read it through globalThis.__settleTicker.
// - The meter counts the JavaScript the settles run (the sweep, the soft read, filling the image, issuing the canvas
//   or WebGL draws). The GPU work those draws cause and the browser's compositing are not in it; tools/perf measures
//   them from the outside as process CPU time.
// </claudes_code_comments>

export const IDLE_MS = 300000;

const entries = new Set();
let raf = 0;
const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
const meter = { ms: 0, frames: 0, calls: 0, since: now(), byLabel: new Map() };
const hasDoc = typeof document !== 'undefined';
const hasWin = typeof window !== 'undefined';

let idleMs = IDLE_MS;
let lastActivity = now();
let state = hasDoc && document.hidden ? 'hidden' : 'running';
let stateSince = now();
let awayTimer = null;
let held = false;
const listeners = new Set();

const loop = (t) => {
  raf = 0;
  if (!entries.size) return;
  check();
  if (state !== 'running') return; // the loop stops; wake() starts it again
  raf = requestAnimationFrame(loop);
  let ran = false;
  for (const e of entries) {
    if (e.period) {
      const k = Math.floor(t / e.period);
      if (k === e.k) continue;
      e.k = k;
    } else if (t - e.last < e.every) continue;
    e.last = t;
    const t0 = now();
    e.fn(t);
    const dt = now() - t0;
    meter.ms += dt;
    meter.calls++;
    if (e.label) meter.byLabel.set(e.label, (meter.byLabel.get(e.label) ?? 0) + dt);
    ran = true;
  }
  if (ran) meter.frames++;
};

const schedule = () => {
  if (!raf && entries.size && state === 'running' && typeof requestAnimationFrame !== 'undefined') raf = requestAnimationFrame(loop);
};

function setState(next, reason) {
  if (next === state) return;
  const t = now();
  const detail = { state: next, reason, since: t, awayMs: state === 'running' ? 0 : t - stateSince, was: state };
  state = next;
  stateSince = t;
  if (next === 'away') startAwayTimer();
  else stopAwayTimer();
  for (const fn of [...listeners]) {
    try { fn(detail); } catch { /* a listener's failure must not stop the loop */ }
  }
  if (hasWin && typeof CustomEvent !== 'undefined') window.dispatchEvent(new CustomEvent('settle:ticker', { detail }));
  schedule();
}

// the away rule, evaluated from the loop (while running) and from the away timer (while stopped)
function check() {
  if (held) return setState('held', 'held');
  if (hasDoc && document.hidden) return setState('hidden', 'hidden');
  if (now() - lastActivity > idleMs) return setState('away', 'idle');
  return setState('running', 'active');
}

function startAwayTimer() {
  if (awayTimer || typeof setInterval === 'undefined') return;
  awayTimer = setInterval(check, 1000);
  awayTimer?.unref?.();
}
function stopAwayTimer() {
  if (awayTimer) clearInterval(awayTimer);
  awayTimer = null;
}

const activity = () => {
  lastActivity = now();
  if (state === 'away') check();
};

if (hasWin && typeof window.addEventListener === 'function') {
  const opt = { passive: true, capture: true };
  for (const ev of ['pointermove', 'pointerdown', 'keydown', 'wheel', 'scroll', 'touchstart']) window.addEventListener(ev, activity, opt);
}
if (hasDoc && typeof document.addEventListener === 'function') {
  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) lastActivity = now(); // coming back to the tab is activity
    check();
  });
}

export function addTick(fn, fps = 24, label = '', { beat = false } = {}) {
  // beat: the entry runs on THE MASTER BEAT's grid (origin 0, the page time origin, as masterbeat.js): once each time
  // the frame crosses a line of period 1000 / fps, so an 8 fps entry's frames fall on 125 ms lines, five 40 Hz cycles
  const e = { fn, every: 1000 / fps - 2, last: 0, label, period: beat ? 1000 / fps : 0, k: -1 };
  entries.add(e);
  schedule();
  return () => entries.delete(e);
}

export function tickerState() {
  return { state, since: stateSince, idleMs, lastActivity };
}

export function onTickerState(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setIdleTimeout(ms) {
  idleMs = Math.max(1, Number(ms) || IDLE_MS);
  check();
}

export function wakeTicker() {
  lastActivity = now();
  check();
}

export function holdTicker(on) {
  held = !!on;
  if (!held) lastActivity = now();
  check();
}

export function tickerHeld() {
  return held;
}

export function tickerStats() {
  const seconds = Math.max(1e-6, (now() - meter.since) / 1000);
  return {
    ms: meter.ms,
    frames: meter.frames,
    calls: meter.calls,
    seconds,
    share: meter.ms / (seconds * 1000),
    entries: entries.size,
    byLabel: Object.fromEntries(meter.byLabel),
  };
}

export function resetTickerStats() {
  meter.ms = 0;
  meter.frames = 0;
  meter.calls = 0;
  meter.since = now();
  meter.byLabel.clear();
}

if (typeof globalThis !== 'undefined') globalThis.__settleTicker = { stats: tickerStats, reset: resetTickerStats, state: tickerState };
