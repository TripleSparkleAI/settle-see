// PAUSE ALL HOLDS THE 40 Hz LIGHT (lane PAUSELIGHT, navigator 2026-10-10): the page gate stops flashing while the
// ticker is held, every drawing rests LIT, the mode's own on/off is untouched, and releasing the hold resumes the
// same clock. A control in every case shows the light DOES flash when nothing holds it.
import test from 'node:test';
import assert from 'node:assert/strict';

import { createFortyHz, fortyHz, tickerHold, FORTY_HZ_ROOT, FORTY_HZ_SESSION } from '../src/fortyhz.js';
import { holdTicker, tickerHeld, setIdleTimeout, wakeTicker, tickerState, IDLE_MS } from '../src/ticker.js';

class El {
  constructor() { this.attrs = new Map(); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(k); }
}
function fakeDoc() {
  const root = new El();
  const writes = [];
  const set = root.setAttribute.bind(root);
  root.setAttribute = (k, v) => { if (k === FORTY_HZ_ROOT) writes.push(String(v)); set(k, v); };
  const listeners = new Map();
  const head = { kids: [], appendChild(n) { this.kids.push(n); } };
  return {
    documentElement: root,
    head,
    hidden: false,
    writes,
    getElementById: (id) => head.kids.find((n) => n.id === id) ?? null,
    createElement: () => ({ id: '', textContent: '' }),
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    fire(type, ev) { for (const fn of [...(listeners.get(type) ?? [])]) fn(ev); },
  };
}
const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const settled = () => new Promise((r) => setTimeout(r, 0));

// a gate whose PAUSE ALL is a plain switch, as the page gate's ticker is; measure() calls are counted
function gate({ refresh = 120, heldAtStart = false, raf = null, caf = null } = {}) {
  const doc = fakeDoc();
  const storage = memStore();
  let heldNow = heldAtStart;
  let heldFn = null;
  let measures = 0;
  const G = createFortyHz({
    doc,
    storage,
    raf,
    caf,
    measure: () => { measures++; return refresh; },
    held: () => heldNow,
    onHeldChange: (fn) => { heldFn = fn; },
    origin: 0,
  });
  const pauseAll = (v) => { heldNow = v; heldFn?.(v); };
  return { G, doc, storage, pauseAll, measures: () => measures };
}
// drive whole display frames through the gate's own step from t0 (ms); returns the phases drawn
function drive(G, fps, ms, t0) {
  const F = 1000 / fps;
  const out = [];
  for (let k = 0; k < Math.round(ms / F); k++) out.push(G.step(t0 + k * F));
  return out;
}

test('CONTROL: with nothing held the light flashes, dark half and all', async () => {
  const { G, doc } = gate();
  G.set(true);
  await settled();
  const phases = drive(G, 120, 1100, 100000);
  assert.ok(phases.includes(false) && phases.includes(true), 'it flips');
  assert.ok(doc.writes.includes('dark'), 'the root reads dark on the dark half');
  assert.ok(Math.abs(G.info.shownHz - 40) <= 1, `shown ${G.info.shownHz}`);
  assert.equal(G.held, false);
  assert.equal(G.info.held, false);
  G.set(false);
});

test('PAUSE ALL caught in the dark half: every drawing rests LIT at once, and nothing flashes while held', async () => {
  const { G, doc, storage, pauseAll } = gate();
  const heard = [];
  G.onPhase((b) => heard.push(b));
  G.set(true);
  await settled();
  // run until the frame drawn is dark, then press PAUSE ALL
  let t = 100000;
  while (G.step(t) !== false) t += 1000 / 120;
  assert.equal(doc.documentElement.getAttribute(FORTY_HZ_ROOT), 'dark', 'the precondition: caught in the dark half');
  pauseAll(true);
  assert.equal(doc.documentElement.getAttribute(FORTY_HZ_ROOT), 'lit', 'rests lit, never stuck dark');
  assert.equal(G.phase, true);
  assert.equal(heard.at(-1), true, 'a phase listener hears it lit');
  assert.equal(G.held, true);
  assert.equal(G.info.held, true);
  assert.equal(G.info.running, false);
  const writes = doc.writes.length;
  const lit = G.litCycle;
  const phases = drive(G, 120, 2000, t + 10);
  assert.ok(phases.every((b) => b === true), 'every frame drawn while held is lit');
  assert.equal(doc.writes.length, writes, 'no flip is written while held');
  assert.equal(G.litCycle, lit, 'no lit phase begins while held (the crackle stands still)');
  assert.equal(G.info.shownHz, 0);
  // the mode itself is untouched
  assert.equal(G.on, true, 'the light is still ON: a pause is not an off');
  assert.equal(storage.m.get(FORTY_HZ_SESSION), '1', 'the session still says on');
  pauseAll(false);
  G.set(false);
});

test('pressing PAUSE ALL again resumes the same light on the next frames, without measuring the display again', async () => {
  const { G, doc, pauseAll, measures } = gate({ refresh: 120 });
  G.set(true);
  await settled();
  drive(G, 120, 500, 100000);
  assert.equal(measures(), 1);
  const hz = G.info.hz;
  pauseAll(true);
  drive(G, 120, 1000, 101000);
  pauseAll(false);
  assert.equal(G.held, false);
  assert.equal(G.info.held, false);
  assert.equal(G.info.running, true, 'running again at once');
  assert.equal(measures(), 1, 'no second measure: the rate is the one already measured');
  const writes = doc.writes.length;
  const phases = drive(G, 120, 1100, 103000);
  assert.ok(phases.includes(false) && phases.includes(true), 'it flashes again');
  assert.ok(doc.writes.length > writes, 'the root flips again');
  assert.equal(G.info.hz, hz);
  assert.ok(Math.abs(G.info.shownHz - 40) <= 1, `shown ${G.info.shownHz}`);
  G.set(false);
});

test('the 40 Hz button keeps its state through a pause: OFF stays off, ON stays on', async () => {
  // off before the pause: the pause turns nothing on, and releasing it turns nothing on
  const a = gate();
  a.pauseAll(true);
  assert.equal(a.G.on, false);
  assert.equal(a.doc.documentElement.getAttribute(FORTY_HZ_ROOT), null, 'nothing written for a light that is off');
  a.pauseAll(false);
  assert.equal(a.G.on, false);
  assert.equal(a.doc.documentElement.getAttribute(FORTY_HZ_ROOT), null);

  // on, then turned OFF while paused (40 Hz OFF, Escape): it stays off after the release
  const b = gate();
  b.G.set(true);
  await settled();
  b.pauseAll(true);
  b.doc.fire('keydown', { key: 'Escape' });
  assert.equal(b.G.on, false, 'Escape still turns it off while paused');
  assert.equal(b.doc.documentElement.getAttribute(FORTY_HZ_ROOT), null);
  b.pauseAll(false);
  assert.equal(b.G.on, false, 'still off after the release');
  assert.deepEqual(drive(b.G, 120, 500, 100000).filter((x) => x !== null), [], 'nothing flashes');

  // turned ON while paused (the warning's GO): it rests lit, then flashes on the release
  const c = gate();
  c.pauseAll(true);
  assert.equal(c.G.set(true), true);
  await settled();
  assert.equal(c.G.on, true);
  assert.equal(c.doc.documentElement.getAttribute(FORTY_HZ_ROOT), 'lit');
  assert.ok(drive(c.G, 120, 600, 100000).every((x) => x === true), 'rests lit while still paused');
  c.pauseAll(false);
  await settled();
  const phases = drive(c.G, 120, 600, 101000);
  assert.ok(phases.includes(false) && phases.includes(true), 'flashes once released');
  c.G.set(false);
});

test('a gate built while PAUSE ALL already holds the page starts held', async () => {
  const { G, doc, pauseAll } = gate({ heldAtStart: true });
  assert.equal(G.held, true);
  assert.equal(G.info.held, true);
  G.set(true);
  await settled();
  assert.equal(G.info.running, false);
  assert.ok(drive(G, 120, 500, 100000).every((x) => x === true));
  assert.ok(!doc.writes.includes('dark'));
  pauseAll(false);
  await settled();
  assert.ok(drive(G, 120, 500, 101000).includes(false), 'the CONTROL: released, it flashes');
  G.set(false);
});

test('one loop, no second timer: the gate\'s frame loop is cancelled by the hold and asked for again on release', async () => {
  const pending = new Map();
  let id = 0;
  let asked = 0;
  const raf = (fn) => { asked++; pending.set(++id, fn); return id; };
  const caf = (k) => { pending.delete(k); };
  const { G, pauseAll } = gate({ raf, caf });
  G.set(true);
  await settled();
  assert.equal(pending.size, 1, 'the loop is waiting on one frame');
  // run a few frames through the loop itself
  for (let k = 0; k < 5; k++) {
    const [key, fn] = [...pending][0];
    pending.delete(key);
    fn(100000 + k * (1000 / 120));
  }
  assert.equal(pending.size, 1);
  pauseAll(true);
  assert.equal(pending.size, 0, 'PAUSE ALL cancels the frame the loop asked for');
  const before = asked;
  await settled();
  assert.equal(asked, before, 'nothing asks for a frame while held');
  pauseAll(false);
  assert.equal(pending.size, 1, 'released: the same one loop asks for its next frame');
  G.set(false);
  assert.equal(pending.size, 0);
});

test('the page gate is wired to PAUSE ALL itself: holdTicker holds the light and releases it', () => {
  const g = fortyHz();
  assert.equal(tickerHeld(), false);
  assert.equal(g.held, false);
  holdTicker(true);
  assert.equal(g.held, true, 'PAUSE ALL holds the page\'s one gate');
  assert.equal(g.info.held, true);
  holdTicker(false);
  assert.equal(g.held, false, 'pressing it again releases the light');
});

test('THE IDLE FREEZE holds the light the same way: rests lit, says why, resumes with the pictures', async () => {
  const { G, doc, pauseAll } = gate();
  G.set(true);
  await settled();
  let t = 100000;
  while (G.step(t) !== false) t += 1000 / 120;
  pauseAll('away');
  assert.equal(doc.documentElement.getAttribute(FORTY_HZ_ROOT), 'lit', 'rests lit, never stuck dark');
  assert.equal(G.held, true);
  assert.equal(G.heldBy, 'away');
  assert.equal(G.info.heldBy, 'away');
  assert.ok(drive(G, 120, 1500, t + 10).every((b) => b === true), 'no flashing while the reader is away');
  assert.equal(G.on, true, 'the idle freeze is not an off');
  pauseAll(null);
  assert.equal(G.held, false);
  assert.equal(G.heldBy, null);
  const phases = drive(G, 120, 600, t + 3000);
  assert.ok(phases.includes(false) && phases.includes(true), 'the reader moves: it flashes again');
  G.set(false);
});

test('which ticker states hold the light: PAUSE ALL and the idle freeze; running and a hidden tab do not (the controls)', () => {
  assert.equal(tickerHold('held'), 'pause');
  assert.equal(tickerHold('away'), 'away');
  assert.equal(tickerHold('running'), null, 'the CONTROL: a running page flashes');
  assert.equal(tickerHold('hidden'), null, 'a hidden tab draws no frames and re-measures on waking, so it is no hold');
});

test('the page gate is wired to the idle freeze itself: five quiet minutes hold the light, the next move releases it', async () => {
  const g = fortyHz();
  assert.equal(g.held, false, 'the CONTROL: an active reader, nothing held');
  try {
    setIdleTimeout(1);
    await new Promise((r) => setTimeout(r, 10));
    setIdleTimeout(1); // the away rule is checked again: the reader has been quiet longer than the timeout
    assert.equal(tickerState().state, 'away');
    assert.equal(g.held, true, 'the idle freeze holds the page\'s one gate');
    assert.equal(g.heldBy, 'away');
  } finally {
    setIdleTimeout(IDLE_MS);
    wakeTicker();
  }
  assert.equal(tickerState().state, 'running');
  assert.equal(g.held, false, 'the next move releases the light');
});
