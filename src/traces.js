// settle-see · traces - TRACES: a settle's own history, captured frame by frame, to replay and to draw as echoes.
//
// <claudes_code_comments>
// ** Function List **
// createTraces(field, opts)  - a ring of past frames for one field; returns the object below
//   .capture(extra)          - store the field's lights now (packed one bit per light) with a stamp and extras
//   .length / .at(k)         - how many are kept / frame k back (0 = newest): { bits, stamp, extra }
//   .unpack(k, into)         - frame k back as +1 / -1 lights, written into an Int8Array
//   .echo(K, decay, phase)   - a Float32Array of pulsing echoes: sum over the last K frames of w_k [light on]
//   .clear()
//   .push(bytes, extra)      - add one already-packed frame (a film's frame, say) as the newest, so it shows as an echo
//   .toFrames()              - every kept frame, oldest first, as packed Uint8Arrays (copies)
// tracesToFilm(traces, w, h, meta) - a recorded trace as a film: { meta, bytes } in settle-see's film format (film.js)
// filmToTraces(field, film, opts)  - a film's frames pushed into a new trace ring for the field (drawn as echoes)
//
// ** Technical Review **
// - A frame is w * h bits: a 384 x 200 field is 9.6 kB, so the default ring of 64 frames is about 600 kB.
// - Echo weights w_k = decay^k * (0.55 + 0.45 sin(phase - 0.9 k)): older frames fade, and a bright band travels back
//   through the history as phase advances, so the past pulses. The renderer draws the echo only where a light is
//   off now, so it shows where the picture has been, not where it is.
// - The packed layout (light i in bit i & 7 of byte i >> 3) is film.js's: one frame-sequence format for both
//   directions, a trace recording the past and a film playing frames forward as targets.
// - Replay: unpack a frame into the field's own lights and draw it; the live settle resumes from the replayed
//   state when play is pressed, which is how a trace becomes a starting point.
// </claudes_code_comments>

import { FILM_FORMAT, packBits, fitBits, unpackBits } from './film.js';

export function createTraces(field, { keep = 64 } = {}) {
  const n = field.n;
  const bytes = (n + 7) >> 3;
  const ring = [];
  let head = 0;
  let count = 0;
  let echoBuf = new Float32Array(n);
  const T = {
    get length() { return count; },
    capture(extra = null) {
      let slot = ring[head];
      if (!slot) slot = ring[head] = { bits: new Uint8Array(bytes), stamp: 0, extra: null };
      packBits(field.s, slot.bits);
      slot.stamp = field.sweeps;
      slot.extra = extra;
      head = (head + 1) % keep;
      count = Math.min(keep, count + 1);
      return slot;
    },
    at(k) {
      if (k < 0 || k >= count) return null;
      return ring[(head - 1 - k + keep * 2) % keep];
    },
    unpack(k, into = new Int8Array(n)) {
      const f = T.at(k);
      if (!f) return null;
      return unpackBits(f.bits, n, into);
    },
    push(bits, extra = null) {
      if (bits.length !== bytes) throw new Error(`settle-see traces: a frame is ${bytes} bytes, got ${bits.length}`);
      let slot = ring[head];
      if (!slot) slot = ring[head] = { bits: new Uint8Array(bytes), stamp: 0, extra: null };
      slot.bits.set(bits);
      slot.stamp = field.sweeps;
      slot.extra = extra;
      head = (head + 1) % keep;
      count = Math.min(keep, count + 1);
      return slot;
    },
    toFrames() {
      const out = [];
      for (let k = count - 1; k >= 0; k--) out.push(Uint8Array.from(T.at(k).bits));
      return out;
    },
    echo(K = 8, decay = 0.8, phase = 0) {
      if (echoBuf.length !== n) echoBuf = new Float32Array(n);
      echoBuf.fill(0);
      const kk = Math.min(K, count);
      for (let k = 1; k < kk; k++) {
        const wk = Math.pow(decay, k) * (0.55 + 0.45 * Math.sin(phase - 0.9 * k));
        const b = T.at(k).bits;
        for (let j = 0; j < b.length; j++) {
          const byte = b[j];
          if (!byte) continue;
          for (let q = 0; q < 8; q++) if (byte & (1 << q)) echoBuf[(j << 3) + q] += wk;
        }
      }
      return echoBuf;
    },
    clear() {
      head = 0;
      count = 0;
    },
  };
  return T;
}

export function tracesToFilm(traces, w, h, { name = 'trace', note = 'a recorded trace', fps = 1, source = { kind: 'trace', made: 'recorded from a settle' } } = {}) {
  const frames = traces.toFrames();
  const per = (w * h + 7) >> 3;
  const bytes = new Uint8Array(per * frames.length);
  frames.forEach((f, k) => bytes.set(f.subarray(0, per), k * per));
  return { meta: { format: FILM_FORMAT, name, note, fps, frames: frames.length, width: w, height: h, bin: `${name}.bin`, source }, bytes };
}

export function filmToTraces(field, film, { fill = 0.92, keep } = {}) {
  const { meta, frames } = film;
  const T = createTraces(field, { keep: keep ?? Math.max(1, frames.length) });
  const buf = new Uint8Array((field.n + 7) >> 3);
  for (const f of frames) {
    const bits = meta.width === field.w && meta.height === field.h ? f : fitBits(f, meta.width, meta.height, field.w, field.h, { fill });
    T.push(packBits(bits, buf));
  }
  return T;
}
