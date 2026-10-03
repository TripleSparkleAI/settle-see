// The shared ticker: its meter, and the halt rule (tab hidden, or nobody there) that every settle on the site obeys.
import test from 'node:test';
import assert from 'node:assert/strict';

// a browser stand-in installed before the ticker loads: window and document as event targets, a rAF on a timer
const win = new EventTarget();
const doc = new EventTarget();
doc.hidden = false;
globalThis.window = win;
globalThis.document = doc;
globalThis.requestAnimationFrame = (cb) => setTimeout(() => cb(performance.now()), 4);
const T = await import('../src/ticker.js');
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

test('the ticker runs entries and meters them', async () => {
  T.resetTickerStats();
  let n = 0;
  const off = T.addTick(() => { n++; }, 200, 'meter-test');
  await wait(250);
  off();
  const s = T.tickerStats();
  assert.ok(n > 2, `ran ${n} times`);
  assert.ok(s.calls >= n && s.byLabel['meter-test'] >= 0, JSON.stringify(s));
  assert.ok(s.share >= 0 && s.share < 1);
});

test('negative control: with the default 5-minute rule a busy page keeps running', async () => {
  T.setIdleTimeout(T.IDLE_MS);
  let n = 0;
  const off = T.addTick(() => { n++; }, 200);
  await wait(100);
  const a = n;
  await wait(150);
  off();
  assert.equal(T.tickerState().state, 'running');
  assert.ok(n > a, 'still ticking');
});

test('no activity for the idle time halts every settle, fires the event, and a pointer move resumes', async () => {
  const seen = [];
  const unsub = T.onTickerState((d) => seen.push(d.state));
  const events = [];
  const onEv = (e) => events.push(e.detail.state);
  win.addEventListener('settle:ticker', onEv);
  let n = 0;
  const off = T.addTick(() => { n++; }, 200);
  T.setIdleTimeout(40);
  await wait(150);
  assert.equal(T.tickerState().state, 'away');
  const frozen = n;
  await wait(60);
  assert.equal(n, frozen, 'no calls while away');
  win.dispatchEvent(new Event('pointermove'));
  assert.equal(T.tickerState().state, 'running');
  await wait(150);
  assert.ok(n > frozen, 'ticking again after the pointer moved');
  off();
  unsub();
  win.removeEventListener('settle:ticker', onEv);
  T.setIdleTimeout(T.IDLE_MS);
  assert.deepEqual(seen.slice(0, 2), ['away', 'running']);
  assert.deepEqual(events.slice(0, 2), ['away', 'running']);
});

test('a hidden tab halts every settle and a visible one resumes', async () => {
  T.wakeTicker();
  let n = 0;
  const off = T.addTick(() => { n++; }, 200);
  doc.hidden = true;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(T.tickerState().state, 'hidden');
  await wait(20);
  const frozen = n;
  await wait(50);
  assert.equal(n, frozen, 'no calls while hidden');
  doc.hidden = false;
  doc.dispatchEvent(new Event('visibilitychange'));
  assert.equal(T.tickerState().state, 'running');
  await wait(150);
  off();
  assert.ok(n > frozen);
});

test('the away detail reports how long the page was away', async () => {
  const got = [];
  const unsub = T.onTickerState((d) => got.push(d));
  T.setIdleTimeout(20);
  await wait(1100); // the stopped loop is checked by the 1 s away timer
  T.wakeTicker();
  unsub();
  T.setIdleTimeout(T.IDLE_MS);
  const back = got.find((d) => d.state === 'running');
  assert.ok(back && back.was === 'away' && back.awayMs > 0, JSON.stringify(got));
});

test('PAUSE ALL: holdTicker halts every settle (state held), activity and a visible tab do not resume it, release does', async () => {
  let n = 0;
  const off = T.addTick(() => { n++; }, 200);
  await wait(40);
  assert.ok(n > 0, 'running before the hold (positive control)');
  T.holdTicker(true);
  assert.equal(T.tickerState().state, 'held');
  assert.equal(T.tickerHeld(), true);
  await wait(20);
  const frozen = n;
  win.dispatchEvent(new Event('pointermove'));
  win.dispatchEvent(new Event('keydown'));
  doc.dispatchEvent(new Event('visibilitychange'));
  await wait(80);
  assert.equal(T.tickerState().state, 'held');
  assert.equal(n, frozen, 'no calls while held, whatever the reader does');
  T.holdTicker(false);
  assert.equal(T.tickerState().state, 'running');
  await wait(80);
  assert.ok(n > frozen, 'ticking again after the release');
  off();
});
