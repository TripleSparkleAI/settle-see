// settle-see · film - a SMALL FILM as a settle target: a list of frames the lights re-settle through, one per second.
//
// <claudes_code_comments>
// ** Function List **
// packBits(s, into)               - one frame of lights (+1 / -1) -> packed bytes, the TRACES layout (bit i&7 of byte i>>3)
// unpackBits(bytes, n, into)      - the inverse, for one frame
// packFrames(frames, w, h)        - Int8Array frames -> one Uint8Array, the frames' packed bytes one after another
// unpackFrames(bytes, w, h, n)    - the inverse: Uint8Array -> n Int8Array frames
// filmPhase(steps, settleFps, filmFps, n, loop) - { k, next, a }: the frame up, the frame it tweens to, how far (0..1)
// fitBits(bits, w, h, W, H, opts) - one w x h frame drawn into a W x H grid: "contain", centred, nearest light,
//                                   scaled by opts.fill (0.92); outside the frame is unlit
// filmFrameIndex(steps, settleFps, filmFps, n, loop) - which frame shows `steps` settle frames after the film began
// changedLights(next, prev) - the lights a jump changes (Int32Array of indices), for TRUE TIME's agreement
// agreementOn(s, t, idx)  - the fraction of those lights already showing the new frame
// filmMeta(json)                  - a film's JSON checked and normalised (throws on a bad file, names the field)
// loadFilm(url, { fetch })        - fetch the JSON and its .bin (resolved beside it) -> { meta, frames }; cached per
//                                   url, so a page fetches a film once and only when an item first needs it
// clearFilmCache()                - forget every loaded film (tests)
//
// ** Technical Review **
// - THE FORMAT, two files side by side: <name>.json { format: 'settle-film/1', name, note, fps, frames, width,
//   height, bin: '<name>.bin', source: {...} } and <name>.bin, the frames packed one after another, each
//   ceil(width * height / 8) bytes, row-major, light i in bit (i & 7) of byte (i >> 3), a lit light 1. That is
//   exactly the layout TRACES packs its history in (traces.js), so ONE frame-sequence format serves both: a trace
//   records the field's past (traces.toFilm), a film plays frames forward as targets, a recorded trace replays as a
//   film and a film's frames load into a trace ring to be drawn as echoes (traces.push). 128 x 72 x 10 frames is
//   11,520 bytes.
// - THE TWEEN (item.tween, default 'ramp'): during frame k's slot each light's lean ramps linearly from frame k's
//   target toward frame k+1's (field.setLeans(lean * ((1 - a) t_k + a t_k+1)), then the usual tanh), so the lights
//   morph rather than switch. 'snap' sets each frame as the plain target when its slot begins.
// - An item in settle()'s items list may be a film: { film: 'url/of/name.json', fps, loop, T, note } (loaded lazily,
//   see mount.js) or { frames: [spec, spec, ...], fps, loop, T } (frames given inline as any target spec).
// - TIMING: fps (default 1) is film frames per second of the settle's own clock (opts.fps settle frames a second), so
//   at the default 24 a film frame lasts 24 settle frames and the lights visibly re-settle into each next frame.
//   loop false holds the last frame; loop true starts again.
// - fitBits never smooths: each grid light reads the film light under its centre, so a film stays crisp and a
//   test can predict every light.
// </claudes_code_comments>

export const FILM_FORMAT = 'settle-film/1';

export function packBits(s, into = new Uint8Array((s.length + 7) >> 3)) {
  into.fill(0);
  for (let i = 0; i < s.length; i++) if (s[i] > 0) into[i >> 3] |= 1 << (i & 7);
  return into;
}

export function unpackBits(bytes, n, into = new Int8Array(n)) {
  for (let i = 0; i < n; i++) into[i] = bytes[i >> 3] & (1 << (i & 7)) ? 1 : -1;
  return into;
}

export function packFrames(frames, w, h) {
  const per = (w * h + 7) >> 3;
  const out = new Uint8Array(per * frames.length);
  frames.forEach((f, k) => {
    if (f.length !== w * h) throw new Error(`settle-see film: frame ${k} has ${f.length} lights, expected ${w * h}`);
    packBits(f, out.subarray(k * per, (k + 1) * per));
  });
  return out;
}

export function unpackFrames(bytes, w, h, n) {
  const per = (w * h + 7) >> 3;
  if (bytes.length < per * n) throw new Error(`settle-see film: ${bytes.length} bytes, ${n} frames of ${w} x ${h} need ${per * n}`);
  const frames = [];
  for (let k = 0; k < n; k++) frames.push(unpackBits(bytes.subarray(k * per, (k + 1) * per), w * h));
  return frames;
}

export function fitBits(bits, w, h, W, H, { fill = 0.92 } = {}) {
  const out = new Int8Array(W * H).fill(-1);
  const k = Math.min(W / w, H / h) * fill;
  const dw = w * k;
  const dh = h * k;
  const ox = (W - dw) / 2;
  const oy = (H - dh) / 2;
  for (let y = 0; y < H; y++) {
    const sy = Math.floor((y + 0.5 - oy) / k);
    if (sy < 0 || sy >= h) continue;
    for (let x = 0; x < W; x++) {
      const sx = Math.floor((x + 0.5 - ox) / k);
      if (sx < 0 || sx >= w) continue;
      out[y * W + x] = bits[sy * w + sx];
    }
  }
  return out;
}

export function filmFrameIndex(steps, settleFps = 24, filmFps = 1, n = 1, loop = false) {
  if (!(n > 0)) return 0;
  const per = Math.max(1, Math.round(settleFps / Math.max(1e-6, filmFps || 1)));
  const k = Math.floor(Math.max(0, steps) / per);
  return loop ? k % n : Math.min(n - 1, k);
}

export function filmPhase(steps, settleFps = 24, filmFps = 1, n = 1, loop = false) {
  if (!(n > 0)) return { k: 0, next: 0, a: 0 };
  const per = Math.max(1, Math.round(settleFps / Math.max(1e-6, filmFps || 1)));
  const st = Math.max(0, steps);
  const raw = Math.floor(st / per);
  const a = (st % per) / per;
  if (loop) return { k: raw % n, next: (raw + 1) % n, a };
  if (raw >= n - 1) return { k: n - 1, next: n - 1, a: 0 };
  return { k: raw, next: raw + 1, a };
}

export function filmMeta(json) {
  const m = typeof json === 'string' ? JSON.parse(json) : json;
  const bad = (f) => { throw new Error(`settle-see film: ${f}`); };
  if (!m || m.format !== FILM_FORMAT) bad(`format is ${m?.format}, expected ${FILM_FORMAT}`);
  for (const f of ['width', 'height', 'frames']) if (!(Number.isInteger(m[f]) && m[f] > 0)) bad(`${f} must be a positive integer`);
  if (!m.name) bad('name is missing');
  if (!m.bin) bad('bin is missing');
  if (!m.source) bad('source is missing (every film records where its frames came from)');
  return { fps: 1, note: '', ...m };
}

const cache = new Map();
export function clearFilmCache() {
  cache.clear();
}

const resolve = (base, rel) => {
  if (/^[a-z]+:\/\//i.test(rel) || rel.startsWith('/')) return rel;
  const i = base.lastIndexOf('/');
  return (i >= 0 ? base.slice(0, i + 1) : '') + rel;
};

export function loadFilm(url, { fetch: f = globalThis.fetch } = {}) {
  if (cache.has(url)) return cache.get(url);
  const p = (async () => {
    const r = await f(url);
    if (!r.ok) throw new Error(`settle-see film: ${url} answered ${r.status}`);
    const meta = filmMeta(await r.json());
    const b = await f(resolve(url, meta.bin));
    if (!b.ok) throw new Error(`settle-see film: ${meta.bin} answered ${b.status}`);
    const bytes = new Uint8Array(await b.arrayBuffer());
    return { meta, frames: unpackFrames(bytes, meta.width, meta.height, meta.frames) };
  })();
  cache.set(url, p);
  p.catch(() => cache.delete(url));
  return p;
}

// TRUE TIME's measure for a film: of the lights that the jump changed (where the new frame differs from the old one;
// the new frame's lit lights when there is no old frame), the fraction that already show the new frame. The plain
// overlap is dominated by the unchanged background (a film is mostly dark sky), so it passes 0.8 before any of the
// moving part has moved; this counts only the work the jump asked for.
export function changedLights(next, prev = null) {
  const out = [];
  for (let i = 0; i < next.length; i++) if (prev ? next[i] !== prev[i] : next[i] > 0) out.push(i);
  return Int32Array.from(out);
}

export function agreementOn(s, t, idx) {
  if (!idx.length) return 1;
  let a = 0;
  for (let k = 0; k < idx.length; k++) if (s[idx[k]] === t[idx[k]]) a++;
  return a / idx.length;
}
