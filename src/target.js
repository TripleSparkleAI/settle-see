// settle-see · target - turns "what to settle into" into a grid of +1 (lit) and -1 (unlit) leans.
//
// <claudes_code_comments>
// ** Function List **
// makeCanvas(w, h)                 - an OffscreenCanvas, or a DOM canvas where OffscreenCanvas is missing
// toTarget(spec, w, h, opts)       - a spec -> Int8Array(w * h) of +1 / -1 (synchronous)
// loadTarget(spec, w, h, opts)     - the same, but waits for an image spec given as a URL
// describe(spec)                   - a short human name for a spec ("the word SETTLE", "a heart")
//
// ** Technical Review **
// - A spec can be: a registered shape name ('heart'); any other string (a word to write); { word, font, weight };
//   { shape, ...params }; { svg: 'M0 0 L...' } with an optional viewBox [x, y, w, h]; { draw: (c, w, h, u) => {} };
//   a shape registered with defineBits() is read straight from its bits(w, h), with no canvas (so it works in node);
//   { image } holding an <img>, ImageBitmap or canvas (or a URL, through loadTarget); { bits: Int8Array } as is.
// - Everything is painted white on black into a w x h canvas and thresholded (opts.threshold, default 110 of 255).
//   opts.invert swaps lit and unlit. Images fit inside the grid ("contain") and are read by luminance.
// - u = max(1, h / 90) is the line width handed to shape drawings (see shapes.js).
// - FONT carries Japanese, Simplified Chinese and Devanagari faces after the Latin ones (the site draws its hero
//   words in Japanese, Chinese and Hindi too; lane MORELANGS, 2026-10-02).
// </claudes_code_comments>

import { getShape } from './shapes.js';

// the word font: Latin faces first, then the Japanese system faces (macOS Hiragino, Noto Sans JP / CJK on Linux and
// Android, Yu Gothic and Meiryo on Windows), then the Simplified Chinese faces (PingFang SC, Noto Sans SC, Microsoft
// YaHei) for a Han glyph the Japanese faces lack, then the Devanagari faces (Kohinoor Devanagari on macOS, IBM Plex
// Sans Devanagari and Noto Sans Devanagari as the site loads them, Nirmala UI on Windows), so a word in any of the
// site's languages is drawn in a real face for its script rather than in whatever the canvas falls back to
export const FONT =
  '"Space Grotesk", Montserrat, "Helvetica Neue", Arial, "Hiragino Sans", "Hiragino Kaku Gothic ProN", "Noto Sans JP", "Noto Sans CJK JP", "Yu Gothic", Meiryo, "PingFang SC", "Noto Sans SC", "Noto Sans CJK SC", "Microsoft YaHei", "Kohinoor Devanagari", "IBM Plex Sans Devanagari", "Noto Sans Devanagari", "Nirmala UI", sans-serif';

export function makeCanvas(w, h) {
  if (typeof OffscreenCanvas !== 'undefined') return new OffscreenCanvas(w, h);
  const cv = document.createElement('canvas');
  cv.width = w;
  cv.height = h;
  return cv;
}

function paint(w, h, fn) {
  const cv = makeCanvas(w, h);
  const c = cv.getContext('2d', { willReadFrequently: true });
  c.fillStyle = '#000';
  c.fillRect(0, 0, w, h);
  c.fillStyle = '#fff';
  c.strokeStyle = '#fff';
  fn(c, Math.max(1, h / 90));
  return c.getImageData(0, 0, w, h).data;
}

function threshold(data, w, h, opts) {
  const th = opts.threshold ?? 110;
  const t = new Int8Array(w * h);
  for (let i = 0; i < w * h; i++) {
    const L = 0.2126 * data[4 * i] + 0.7152 * data[4 * i + 1] + 0.0722 * data[4 * i + 2];
    t[i] = (L > th) !== !!opts.invert ? 1 : -1;
  }
  return t;
}

function word(text, c, w, h, spec) {
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  const weight = spec.weight ?? 700;
  const font = spec.font ?? FONT;
  let size = Math.round(h * (spec.scale ?? 0.8));
  do {
    c.font = `${weight} ${size}px ${font}`;
    size--;
  } while (c.measureText(text).width > w * 0.94 && size > 6);
  c.fillText(text, w / 2, h / 2 + h * 0.03);
}

function svg(d, c, w, h, spec) {
  const [vx, vy, vw, vh] = spec.viewBox ?? [0, 0, 100, 100];
  const k = Math.min((w * 0.92) / vw, (h * 0.92) / vh);
  c.translate((w - vw * k) / 2 - vx * k, (h - vh * k) / 2 - vy * k);
  c.scale(k, k);
  const p = new Path2D(d);
  if (spec.stroke) {
    c.lineWidth = spec.stroke / k;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.stroke(p);
  } else c.fill(p, spec.rule ?? 'nonzero');
}

function image(img, c, w, h) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  const k = Math.min(w / iw, h / ih);
  c.imageSmoothingQuality = 'high';
  c.drawImage(img, (w - iw * k) / 2, (h - ih * k) / 2, iw * k, ih * k);
}

export function toTarget(spec, w, h, opts = {}) {
  if (spec && spec.bits) return Int8Array.from(spec.bits);
  if (typeof spec === 'string') spec = getShape(spec) ? { shape: spec } : { word: spec };
  const o = { ...opts, ...(spec.threshold != null ? { threshold: spec.threshold } : {}), ...(spec.invert ? { invert: true } : {}) };
  let data;
  if (spec.word != null) data = paint(w, h, (c) => word(String(spec.word), c, w, h, spec));
  else if (spec.shape) {
    const s = getShape(spec.shape);
    if (!s) throw new Error(`settle-see: no shape named "${spec.shape}"`);
    if (s.bits) {
      const t = Int8Array.from(s.bits(w, h, spec));
      if (o.invert) for (let i = 0; i < t.length; i++) t[i] = -t[i];
      return t;
    }
    data = paint(w, h, (c, u) => s.draw(c, w, h, u, spec));
  } else if (spec.svg) data = paint(w, h, (c) => svg(spec.svg, c, w, h, spec));
  else if (spec.draw) data = paint(w, h, (c, u) => spec.draw(c, w, h, u));
  else if (spec.image && typeof spec.image !== 'string') data = paint(w, h, (c) => image(spec.image, c, w, h));
  else throw new Error('settle-see: a target spec needs word, shape, svg, draw, image or bits');
  return threshold(data, w, h, o);
}

export async function loadTarget(spec, w, h, opts = {}) {
  if (spec && typeof spec.image === 'string') {
    const img = new Image();
    img.decoding = 'async';
    img.src = spec.image;
    await img.decode();
    return toTarget({ ...spec, image: img }, w, h, opts);
  }
  return toTarget(spec, w, h, opts);
}

export function describe(spec) {
  if (typeof spec === 'string') {
    const s = getShape(spec);
    return s ? s.note || spec : `the word ${spec}`;
  }
  if (spec.note) return spec.note;
  if (spec.film || spec.frames) return 'a short film';
  if (typeof spec.live === 'function') return 'a live picture';
  if (spec.word != null) return `the word ${spec.word}`;
  if (spec.shape) return getShape(spec.shape)?.note || spec.shape;
  if (spec.image) return 'a picture';
  return 'a drawing';
}
