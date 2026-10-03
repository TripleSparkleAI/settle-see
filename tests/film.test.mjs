// SMALL FILMS: the packed format round-trips, it IS the TRACES layout (a trace becomes a film, a film becomes
// echoes), the timing is one film frame per second of the settle's clock, the tween ramps the leans, and a film
// item is fetched lazily (only when its turn is near).
import test from 'node:test';
import assert from 'node:assert/strict';

const stubCtx = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)) });
    if (k === 'measureText') return () => ({ width: 1 });
    return () => ({ addColorStop() {} });
  },
  set(t, k, v) { t[k] = v; return true; },
});
class FakeCanvas {
  constructor(w = 1, h = 1) { this.width = w; this.height = h; this.clientWidth = 200; this.clientHeight = 100; }
  getContext() { return stubCtx(); }
  addEventListener() {}
  removeEventListener() {}
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}
globalThis.OffscreenCanvas = FakeCanvas;
globalThis.requestAnimationFrame = () => 0;

const S = await import('../src/index.js');
const { packFrames, unpackFrames, packBits, unpackBits, fitBits, filmFrameIndex, filmPhase, filmMeta, loadFilm, clearFilmCache, FILM_FORMAT, createField, createTraces, tracesToFilm, filmToTraces, settle } = S;

const rnd = (n, seed) => {
  let x = seed >>> 0;
  return Int8Array.from({ length: n }, () => ((x = (x * 1664525 + 1013904223) >>> 0) & 0x100 ? 1 : -1));
};

test('the format round-trips: frames -> packed bytes -> the same frames, at sizes that are not multiples of 8', () => {
  for (const [w, h, n] of [[8, 8, 3], [13, 7, 5], [128, 72, 10], [1, 1, 2]]) {
    const frames = Array.from({ length: n }, (_, k) => rnd(w * h, 17 + k));
    const bytes = packFrames(frames, w, h);
    assert.equal(bytes.length, ((w * h + 7) >> 3) * n);
    assert.deepEqual(unpackFrames(bytes, w, h, n), frames);
  }
  assert.throws(() => unpackFrames(new Uint8Array(3), 8, 8, 1), /need 8/);
  assert.throws(() => packFrames([new Int8Array(5)], 2, 2), /expected 4/);
});

test('ONE format: a film frame packs exactly as TRACES packs the field (light i in bit i & 7 of byte i >> 3)', () => {
  const F = createField({ w: 13, h: 7, seed: 3 });
  const T = createTraces(F, { keep: 4 });
  const slot = T.capture();
  assert.deepEqual(slot.bits, packBits(F.s));
  assert.deepEqual(packFrames([F.s], 13, 7), slot.bits);
  // the bit for light 9 sits in byte 1, bit 1
  const one = new Int8Array(16).fill(-1);
  one[9] = 1;
  assert.deepEqual([...packBits(one)], [0, 2]);
});

test('a recorded trace replays as a film: tracesToFilm -> unpackFrames gives back every captured state, oldest first', () => {
  const F = createField({ w: 11, h: 6, seed: 9 });
  const T = createTraces(F, { keep: 8 });
  const states = [];
  for (let k = 0; k < 5; k++) {
    F.sweep(1 / 2);
    states.push(Int8Array.from(F.s));
    T.capture();
  }
  const film = tracesToFilm(T, 11, 6, { name: 'test-trace' });
  assert.equal(filmMeta(film.meta).frames, 5);
  assert.deepEqual(unpackFrames(film.bytes, 11, 6, 5), states);
});

test('a film shows as echoes: filmToTraces pushes its frames, and the echo is lit where the earlier frames were lit', () => {
  const F = createField({ w: 8, h: 4, seed: 1 });
  const a = new Int8Array(32).fill(-1);
  const b = new Int8Array(32).fill(-1);
  a[3] = 1; // only in the older frame
  b[20] = 1; // only in the newest
  const T = filmToTraces(F, { meta: { width: 8, height: 4 }, frames: [a, b] });
  assert.equal(T.length, 2);
  assert.deepEqual(T.unpack(0), b);
  const echo = T.echo(4, 0.8, 1);
  assert.ok(echo[3] > 0, 'the older frame shows as an echo');
  assert.equal(echo[20], 0, 'the newest frame is the present, not an echo');
  assert.equal(echo[0], 0);
});

test('fitBits: contain, centred, nearest light; a 2 x 1 film in a 10 x 10 grid fills a centred band', () => {
  const t = fitBits(Int8Array.from([1, -1]), 2, 1, 10, 10, { fill: 1 });
  // scale 5: the lit half covers x 0..5 and y 2.5..7.5; a light reads the film under its centre -> rows 2..6
  for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) {
    const lit = y >= 2 && y <= 6 && x < 5;
    assert.equal(t[y * 10 + x], lit ? 1 : -1, `${x},${y}`);
  }
});

test('timing: one film frame per second of the settle clock; loop false holds the last frame, loop true wraps', () => {
  assert.equal(filmFrameIndex(0, 24, 1, 10), 0);
  assert.equal(filmFrameIndex(23, 24, 1, 10), 0);
  assert.equal(filmFrameIndex(24, 24, 1, 10), 1);
  assert.equal(filmFrameIndex(24 * 9, 24, 1, 10), 9);
  assert.equal(filmFrameIndex(24 * 30, 24, 1, 10), 9, 'held');
  assert.equal(filmFrameIndex(24 * 12, 24, 1, 10, true), 2, 'wrapped');
  assert.equal(filmFrameIndex(36, 24, 0.5, 10), 0, 'at 0.5 fps a frame lasts two seconds');
  assert.equal(filmFrameIndex(48, 24, 0.5, 10), 1);
  const p = filmPhase(30, 24, 1, 10);
  assert.deepEqual([p.k, p.next], [1, 2]);
  assert.ok(Math.abs(p.a - 0.25) < 1e-12);
  assert.deepEqual(filmPhase(24 * 9 + 5, 24, 1, 10), { k: 9, next: 9, a: 0 }, 'the last frame does not tween onward');
});

test('filmMeta refuses a file without its format, size, bin or source, naming the field', () => {
  const ok = { format: FILM_FORMAT, name: 'x', width: 4, height: 2, frames: 3, bin: 'x.bin', source: { kind: 'drawn' } };
  assert.equal(filmMeta(ok).fps, 1, 'the default rate is one frame a second');
  assert.throws(() => filmMeta({ ...ok, format: 'nope' }), /format/);
  assert.throws(() => filmMeta({ ...ok, width: 0 }), /width/);
  assert.throws(() => filmMeta({ ...ok, bin: undefined }), /bin/);
  assert.throws(() => filmMeta({ ...ok, source: undefined }), /source/);
});

// a tiny 4 x 2 film served by a fake fetch that counts its calls
const W = 4;
const H = 2;
const FR = [Int8Array.from([1, 1, -1, -1, 1, 1, -1, -1]), Int8Array.from([-1, -1, 1, 1, -1, -1, 1, 1]), Int8Array.from([1, -1, 1, -1, 1, -1, 1, -1])];
function server() {
  const calls = [];
  const meta = { format: FILM_FORMAT, name: 'tiny', note: 'a tiny film', fps: 1, width: W, height: H, frames: FR.length, bin: 'tiny.bin', source: { kind: 'drawn' } };
  const bin = packFrames(FR, W, H);
  const fetch = async (url) => {
    calls.push(url);
    if (url.endsWith('tiny.json')) return { ok: true, json: async () => meta };
    if (url.endsWith('tiny.bin')) return { ok: true, arrayBuffer: async () => bin.buffer.slice(0) };
    return { ok: false, status: 404 };
  };
  return { fetch, calls };
}
const tick = () => new Promise((r) => setTimeout(r, 0));

test('loadFilm fetches the JSON then the .bin beside it, once per url', async () => {
  clearFilmCache();
  const { fetch, calls } = server();
  const f = await loadFilm('/films/tiny.json', { fetch });
  assert.deepEqual(calls, ['/films/tiny.json', '/films/tiny.bin']);
  assert.deepEqual(f.frames, FR);
  await loadFilm('/films/tiny.json', { fetch });
  assert.equal(calls.length, 2, 'cached');
});

test('LAZY: a film item is not fetched while far off; it is fetched when the item before it comes up', async () => {
  clearFilmCache();
  const { fetch, calls } = server();
  const items = ['A', 'B', { film: '/lazy/tiny.json', fps: 1 }];
  const h = settle(new FakeCanvas(), { items, res: [W, H], schedule: { kind: 'cycle', heat: 2, cool: 2, hold: 2, reheat: 2 }, fps: 24, fetch, motion: 'always' });
  h.advance(3); // item 0
  assert.equal(calls.length, 0, 'nothing fetched on the first item');
  h.advance(8); // item 1: the film is next
  await tick();
  assert.ok(calls.includes('/lazy/tiny.json'), 'fetched when the item before it came up');
  h.destroy();
});

// TRUE TIME (truetime.js): a film's frames follow the wall clock (here an injected one), never the settle's own frame
// count; the field moves to the movie's current frame once its overlap with the frame it shows reaches the threshold
function clock() {
  const c = { t: 0 };
  c.now = () => c.t;
  return c;
}

test('TRUE TIME: a film follows the clock, not the settle frames: 200 sweeps with the clock still never move it', async () => {
  clearFilmCache();
  const { fetch } = server();
  const c = clock();
  const h = settle(new FakeCanvas(), { items: [{ film: '/tt/tiny.json', fps: 2, loop: false, threshold: 0.5 }], res: [W, H], schedule: 'fixed', fps: 24, fetch, motion: 'always', now: c.now });
  await tick();
  h.advance(200);
  assert.deepEqual([...h.field.target], [...FR[0]], 'the clock has not moved: still frame 0');
  c.t = 520; // the movie behind is at frame 1 (500 ms a frame at 2 fps)
  h.advance(60);
  assert.deepEqual([...h.field.target], [...FR[1]], 'the clock moved: frame 1');
  assert.equal(h.stats().film.movie, 1);
  c.t = 5000; // far past the end: loop false holds the last frame
  h.advance(200);
  assert.deepEqual([...h.field.target], [...FR[2]], 'held on the last frame');
  h.destroy();
});

test('TRUE TIME: a slow front skips frames to keep the movie\'s time (it jumps to where the movie IS, not to the next frame)', async () => {
  clearFilmCache();
  const { fetch } = server();
  const c = clock();
  const h = settle(new FakeCanvas(), { items: [{ film: '/skip/tiny.json', fps: 2, loop: false, threshold: 0.5, tween: 'snap' }], res: [W, H], schedule: 'fixed', fps: 24, fetch, motion: 'always', now: c.now });
  await tick();
  h.advance(1);
  c.t = 1100; // two periods passed before the front could look: the movie is at frame 2
  h.advance(60);
  assert.deepEqual([...h.field.target], [...FR[2]], 'jumped straight from frame 0 to frame 2');
  h.destroy();
});

test('TRUE TIME, the ramp tween: just after a jump the leans slide from the old frame to the new one, then clear', async () => {
  clearFilmCache();
  const { fetch } = server();
  const c = clock();
  const h = settle(new FakeCanvas(), { items: [{ film: '/play/tiny.json', fps: 2, loop: false, threshold: 0.5 }], res: [W, H], schedule: 'fixed', fps: 24, fetch, motion: 'always', now: c.now });
  await tick();
  h.advance(60);
  c.t = 510;
  let tries = 0;
  while (h.field.target[0] === FR[0][0] && tries++ < 200) h.advance(1);
  assert.deepEqual([...h.field.target], [...FR[1]]);
  c.t += 62.5; // half of the ramp (a quarter of the 500 ms period)
  h.advance(1);
  assert.ok(h.field.leans, 'ramped leans are set');
  assert.ok(Math.abs(h.field.leans[0]) < 0.2, `lean ${h.field.leans[0]}`);
  c.t += 200;
  h.advance(1);
  assert.equal(h.field.leans, null, 'the ramp is over');
  h.destroy();
});

test('negative control: tween "snap" never sets leans, the target switches whole', async () => {
  clearFilmCache();
  const { fetch } = server();
  const c = clock();
  const h = settle(new FakeCanvas(), { items: [{ film: '/snap/tiny.json', fps: 2, tween: 'snap', threshold: 0.5 }], res: [W, H], schedule: 'fixed', fps: 24, fetch, motion: 'always', now: c.now });
  await tick();
  h.advance(60);
  assert.deepEqual([...h.field.target], [...FR[0]]);
  c.t = 510;
  for (let k = 0; k < 120; k++) {
    h.advance(1);
    assert.equal(h.field.leans, null);
  }
  assert.deepEqual([...h.field.target], [...FR[1]]);
  h.destroy();
});

test('inline frames: { frames: [spec, ...] } plays the same way, no fetch at all', () => {
  const frames = FR.map((b) => ({ bits: b }));
  const c = clock();
  const h = settle(new FakeCanvas(), { items: [{ frames, fps: 2, tween: 'snap', threshold: 0.5 }], res: [W, H], schedule: 'fixed', fps: 24, motion: 'always', now: c.now });
  h.advance(1);
  assert.deepEqual([...h.field.target], [...FR[0]]);
  c.t = 1010;
  h.advance(100);
  assert.deepEqual([...h.field.target], [...FR[2]]);
  h.destroy();
});

test('item.fallback: a film that will not load falls back to a second film', async () => {
  clearFilmCache();
  const { fetch, calls } = server();
  const h = settle(new FakeCanvas(), { items: [{ film: '/gone/missing.json', fallback: '/fb/tiny.json', tween: 'snap' }], res: [W, H], schedule: 'fixed', fps: 24, fetch, motion: 'always' });
  await tick();
  await tick();
  h.advance(2);
  assert.ok(calls.includes('/gone/missing.json') && calls.includes('/fb/tiny.json'));
  assert.deepEqual([...h.field.target], [...FR[0]]);
  h.destroy();
});

test('TRUE TIME agreement counts only the lights a jump changed: a mostly dark frame cannot pass on its background', async () => {
  const { changedLights, agreementOn } = await import('../src/film.js');
  const n = 100;
  const a = new Int8Array(n).fill(-1);
  const b = new Int8Array(n).fill(-1);
  for (let i = 0; i < 10; i++) a[i] = 1; // the rider is at lights 0..9 in frame a
  for (let i = 10; i < 20; i++) b[i] = 1; // and at 10..19 in frame b
  const idx = changedLights(b, a);
  assert.deepEqual([...idx], [...Array(20).keys()]);
  // the field still shows frame a: the plain overlap with b is 0.6, its agreement on the changed lights is 0
  let ov = 0;
  for (let i = 0; i < n; i++) ov += a[i] * b[i];
  assert.equal(ov / n, 0.6);
  assert.equal(agreementOn(a, b, idx), 0);
  assert.equal(agreementOn(b, b, idx), 1);
  assert.deepEqual([...changedLights(b)], [...Array(10).keys()].map((k) => k + 10), 'no old frame: the new frame\'s lit lights');
  assert.equal(agreementOn(a, b, new Int32Array(0)), 1, 'nothing changed: nothing to wait for');
});
