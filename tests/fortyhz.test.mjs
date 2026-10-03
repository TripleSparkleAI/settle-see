// THE 40 Hz LIGHT, ONE MODE (fortyhz.js, lane FORTYHZ): one page gate, one clock, every drawing on it.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  createFortyHz, fortyHz, fortyHzRate, FORTY_HZ, FORTY_HZ_ATTR, FORTY_HZ_ROOT, FORTY_HZ_SESSION, FORTY_HZ_CSS,
} from '../src/fortyhz.js';
import { refreshFromIntervals } from '../src/gamma.js';

// a stand-in element: attributes only
class El {
  constructor() { this.attrs = new Map(); }
  setAttribute(k, v) { this.attrs.set(k, String(v)); }
  getAttribute(k) { return this.attrs.has(k) ? this.attrs.get(k) : null; }
  removeAttribute(k) { this.attrs.delete(k); }
}
// a stand-in document: a root that counts its writes, listeners, a head for the stylesheet
function fakeDoc() {
  const root = new El();
  let rootWrites = 0;
  const set = root.setAttribute.bind(root);
  root.setAttribute = (k, v) => { if (k === FORTY_HZ_ROOT) rootWrites++; set(k, v); };
  const listeners = new Map();
  const head = { kids: [], appendChild(n) { this.kids.push(n); } };
  return {
    documentElement: root,
    head,
    hidden: false,
    get rootWrites() { return rootWrites; },
    getElementById: (id) => head.kids.find((n) => n.id === id) ?? null,
    createElement: () => ({ id: '', textContent: '' }),
    addEventListener(type, fn) { if (!listeners.has(type)) listeners.set(type, new Set()); listeners.get(type).add(fn); },
    removeEventListener(type, fn) { listeners.get(type)?.delete(fn); },
    fire(type, ev) { for (const fn of [...(listeners.get(type) ?? [])]) fn(ev); },
    count(type) { return listeners.get(type)?.size ?? 0; },
  };
}
const memStore = () => {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), m };
};
const settled = () => new Promise((r) => setTimeout(r, 0));

// a gate on a fake display: the measured refresh is given, frames are driven by hand through step()
function gate(over = {}) {
  const doc = fakeDoc();
  const storage = memStore();
  let reducedFn = null;
  let reduced = false;
  const G = createFortyHz({
    doc,
    storage,
    raf: null,
    caf: null,
    measure: () => over.refresh ?? 120,
    reduced: () => reduced,
    onReducedChange: (fn) => { reducedFn = fn; },
    origin: 0,
    ...over,
  });
  return { G, doc, storage, setReduced: (v) => { reduced = v; reducedFn?.(v); } };
}
// run whole-frame steps at a display rate for a while, from t0 (ms); skip lists frame indices that are dropped
function drive(G, fps, ms, { t0 = 100000, skip = () => false } = {}) {
  const F = 1000 / fps;
  const n = Math.round(ms / F);
  const out = [];
  for (let k = 0; k < n; k++) {
    if (skip(k)) continue;
    const t = t0 + k * F;
    out.push({ t, b: G.step(t) });
  }
  return out;
}

test('one gate, one source of truth: every registered drawing is listed and carries the attribute', () => {
  const { G } = gate();
  const a = new El();
  const b = new El();
  const c = new El();
  const offA = G.register(a, 'hero');
  G.register(b, 'footer');
  G.register(c, 'logo');
  assert.deepEqual(G.lights(), ['hero', 'footer', 'logo']);
  for (const el of [a, b, c]) assert.ok(el.getAttribute(FORTY_HZ_ATTR) !== null, 'on the clock');
  offA();
  assert.deepEqual(G.lights(), ['footer', 'logo']);
  assert.equal(a.getAttribute(FORTY_HZ_ATTR), null, 'unregistering takes the attribute away');
});

test('the page has exactly one gate: fortyHz() returns the same object every time', () => {
  assert.equal(fortyHz(), fortyHz());
  assert.equal(globalThis.__settleFortyHz, fortyHz());
});

test('ONE WRITE PER FLIP: the root attribute is the only thing written, and the stylesheet darkens every drawing', async () => {
  const { G, doc } = gate();
  for (let i = 0; i < 12; i++) G.register(new El(), `settle ${i}`);
  assert.equal(G.set(true), true);
  await settled();
  assert.equal(doc.documentElement.getAttribute(FORTY_HZ_ROOT), 'lit');
  assert.equal(doc.head.kids.length, 1, 'the one stylesheet, injected once');
  assert.match(FORTY_HZ_CSS, new RegExp(`html\\[${FORTY_HZ_ROOT}='dark'\\] \\[${FORTY_HZ_ATTR}\\]\\{opacity:0 !important\\}`));
  assert.match(FORTY_HZ_CSS, /transition:none !important/, 'no fade softens the dark half');
  const before = doc.rootWrites;
  const frames = drive(G, 120, 1000);
  const flips = frames.filter((f, i) => i && f.b !== frames[i - 1].b).length;
  assert.equal(doc.rootWrites - before, flips, 'one root write per flip, however many drawings are on the clock');
  G.set(false);
});

test('on a 120 Hz display the gate runs 40 Hz, fully dark about half the time', async () => {
  const { G } = gate({ refresh: 120 });
  G.set(true);
  await settled();
  assert.equal(G.info.hz, 40);
  assert.equal(G.info.nearest, false);
  drive(G, 120, 2100);
  assert.ok(Math.abs(G.info.shownHz - 40) <= 1, `shown ${G.info.shownHz}`);
  assert.ok(Math.abs(G.info.darkShare - 0.5) < 0.06, `dark ${G.info.darkShare}`);
  assert.equal(fortyHzRate(G.info), 40);
  G.set(false);
});

test('a dropped frame is dropped, never made up: every onset stays on the master 25 ms grid', async () => {
  const { G } = gate({ refresh: 120 });
  G.set(true);
  await settled();
  // drop two frames in every seven: the drawings that cannot keep up stay in phase
  const frames = drive(G, 120, 3000, { skip: (k) => k % 7 === 3 || k % 7 === 4 });
  const onsets = frames.filter((f, i) => i && f.b && !frames[i - 1].b).map((f) => f.t);
  assert.ok(onsets.length > 60);
  for (let i = 1; i < onsets.length; i++) assert.ok(onsets[i] - onsets[i - 1] >= 25 - 1000 / 120, 'never two flashes in one cycle');
  for (const t of onsets) {
    const off = ((t % 25) + 25) % 25;
    assert.ok(Math.min(off, 25 - off) <= 1000 / 120 + 1e-6, `onset ${t} sits ${off} ms from its cycle start`);
  }
  G.set(false);
});

test('THE RATE RULE: a 60 Hz screen runs the nearest exact rate (30 Hz) and says so; the chip reads the true rate', async () => {
  const { G } = gate({ refresh: 60 });
  G.set(true);
  await settled();
  assert.equal(G.info.nearest, true);
  assert.equal(G.info.hz, 30);
  assert.equal(G.info.refresh, 60);
  assert.equal(fortyHzRate(G.info), 30);
  G.set(false);
  assert.equal(fortyHzRate(G.info), 0, 'no rate while off');
});

test('the display measure reads the display, not the dropped frames: 120 Hz with half the frames dropped is 120', () => {
  const F = 1000 / 120;
  const intervals = [];
  for (let k = 0; k < 120; k++) intervals.push(k % 2 ? 2 * F : F); // half the intervals doubled by a dropped frame
  for (let k = 0; k < 20; k++) intervals.push(2 * F);
  assert.equal(refreshFromIntervals(intervals), 120);
  const median = [...intervals].sort((a, b) => a - b)[Math.floor(intervals.length / 2)];
  assert.equal(Math.round(1000 / median), 60, 'control: the old median would have read 60 and shown 30 Hz');
  assert.equal(refreshFromIntervals(new Array(30).fill(1000 / 60)), 60);
  assert.equal(refreshFromIntervals([]), 0);
});

test('Escape turns the mode off everywhere; any other key does nothing; the listener lives only while on', async () => {
  const { G, doc } = gate();
  assert.equal(doc.count('keydown'), 0);
  G.set(true);
  await settled();
  assert.equal(doc.count('keydown'), 1);
  doc.fire('keydown', { key: 'Enter' });
  assert.equal(G.on, true);
  doc.fire('keydown', { key: 'Escape' });
  assert.equal(G.on, false);
  assert.equal(doc.documentElement.getAttribute(FORTY_HZ_ROOT), null, 'every drawing is lit again');
  assert.equal(doc.count('keydown'), 0);
});

test('off: the root attribute goes, phase listeners hear null, subscribers hear off', async () => {
  const { G, doc } = gate();
  const phases = [];
  const states = [];
  G.onPhase((b) => phases.push(b));
  G.subscribe((s) => states.push(s.on));
  G.set(true);
  await settled();
  drive(G, 120, 200);
  assert.ok(phases.includes(false) && phases.includes(true));
  G.set(false);
  assert.equal(phases.at(-1), null);
  assert.equal(states.at(-1), false);
  assert.equal(G.phase, null);
  assert.equal(doc.documentElement.getAttribute(FORTY_HZ_ROOT), null);
  const after = phases.length;
  drive(G, 120, 200);
  assert.equal(phases.length, after, 'nothing flickers while off');
});

test('reduced motion refuses the mode and says why; turning reduced motion on ends it', async () => {
  const a = gate();
  a.setReduced(true);
  assert.equal(a.G.set(true), false);
  assert.equal(a.G.on, false);
  assert.equal(a.G.info.refused, 'reduced motion is on');
  assert.equal(a.doc.documentElement.getAttribute(FORTY_HZ_ROOT), null);
  const b = gate();
  b.G.set(true);
  await settled();
  b.setReduced(true);
  assert.equal(b.G.on, false);
});

test('session only: on is kept for this tab, off clears it, restore turns it on again only when it was on', async () => {
  const { G, storage } = gate();
  assert.equal(G.restore(), false, 'a fresh visit never starts flashing');
  G.set(true);
  assert.equal(storage.getItem(FORTY_HZ_SESSION), '1');
  G.set(false);
  assert.equal(storage.getItem(FORTY_HZ_SESSION), null);
  storage.setItem(FORTY_HZ_SESSION, '1');
  assert.equal(G.restore(), true, 'a reload in the same tab keeps the mode');
  assert.equal(G.on, true);
  G.set(false);
});

test('a refusal from the display is reported and nothing goes dark', async () => {
  const { G, doc } = gate({ refresh: 0 });
  G.set(true);
  await settled();
  assert.match(G.info.refused, /could not be measured/);
  assert.equal(G.info.running, false);
  drive(G, 120, 300);
  assert.equal(doc.documentElement.getAttribute(FORTY_HZ_ROOT), 'lit');
  assert.equal(fortyHzRate(G.info), 0);
  G.set(false);
});

test('every settle() joins the clock: mount.js registers its canvas with the page gate, opt out with fortyHz: false', async () => {
  const src = readFileSync(new URL('../src/mount.js', import.meta.url), 'utf8');
  assert.match(src, /import \{ fortyHz \} from '\.\/fortyhz\.js';/);
  assert.match(src, /o\.fortyHz === false \? null : fortyHz\(\)\.register\(canvas,/);
  assert.match(src, /unlight\?\.\(\);/, 'destroy lets the canvas go');
  // and in behaviour: a settle on a stand-in canvas is on the page gate's list until it is destroyed
  const ctx = () => new Proxy({}, {
    get(t, k) {
      if (k in t) return t[k];
      if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)) });
      if (k === 'measureText') return () => ({ width: 1 });
      return () => ({ addColorStop() {} });
    },
    set(t, k, v) { t[k] = v; return true; },
  });
  class Canvas extends El {
    constructor() { super(); this.width = 1; this.height = 1; this.clientWidth = 200; this.clientHeight = 100; }
    getContext() { return ctx(); }
    addEventListener() {}
    removeEventListener() {}
    getBoundingClientRect() { return { left: 0, top: 0, width: 200, height: 100 }; }
  }
  globalThis.OffscreenCanvas = Canvas;
  globalThis.requestAnimationFrame ??= () => 0;
  const { settle } = await import('../src/index.js');
  const cv = new Canvas();
  cv.setAttribute('aria-label', 'a test settle');
  const before = fortyHz().lights().length;
  const h = settle(cv, { shape: 'heart', res: [24, 16], still: true, motion: 'always' });
  assert.equal(fortyHz().lights().length, before + 1);
  assert.equal(fortyHz().lights().at(-1), 'a test settle', 'named by its label');
  assert.equal(cv.getAttribute(FORTY_HZ_ATTR), 'a test settle');
  h.destroy();
  assert.equal(fortyHz().lights().length, before);
  const out = new Canvas();
  const h2 = settle(out, { shape: 'heart', res: [24, 16], still: true, motion: 'always', fortyHz: false });
  assert.equal(fortyHz().lights().length, before, 'fortyHz: false stays off the clock');
  h2.destroy();
});

test('the numbers: 40 Hz, half on and half off, the nearest rate below 100 frames a second', () => {
  assert.deepEqual({ ...FORTY_HZ }, { hz: 40, duty: 0.5, slow: 'nearest' });
});
