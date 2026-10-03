// settle-see · render - draws a field as neon dots: the light's own colour, a hot core, a soft bloom.
//
// <claudes_code_comments>
// ** Function List **
// createRenderer(opts)       - a renderer for one w x h field; returns { plate, render(field), set(opts), pitch }
//   plate                    - the canvas it draws into: (w * pitch) x (h * pitch) pixels, black where nothing is lit
//   render(field)            - paint the field's current state into plate
//   set(opts)                - change colour mode, neons, pitch, glow, clear without rebuilding
// fillMap(F, paint, o, colours, d, k) - the 'map' colour mode's fill: a palette index and a gain per light
// lightAlpha(d)              - in place: each RGBA pixel's alpha becomes its brightest channel, its colour scaled up
//                              to match, so the pixel composites (premultiplied) as the same light with no plate
// isClearBackground(bg)      - true for background 'transparent': the settle draws raw lights, no plate
//
// ** Technical Review **
// - The cost does not grow with the number of dots drawn as sprites. Each frame writes the colour of every light
//   into ONE w x h ImageData (one pixel per light), then composites that tiny image a few times with the GPU:
//     1. dots:  the cell image scaled up without smoothing, then cut to round dots by a repeating dot mask
//               ('destination-in' with a pattern one pitch wide);
//     2. cores: a second cell image, near-white where a light is bright, cut by a smaller dot mask;
//     3. bloom: the cell image downsampled to 1/2 and 1/4 with smoothing and added back scaled up ('lighter'):
//               a two-level mip-chain glow that needs no canvas filter, so it looks the same in every browser.
//   A 384 x 192 field is about 74 thousand lights and costs a handful of drawImage calls per frame.
// - Colour modes (each light's brightness a is its soft read m, 0..1):
//     'meaning' (the SETTLE code): lit and agreeing with its lean -> yes (rose); lit against its lean -> heat
//                (orange, the noise); unlit -> no (indigo), dim.
//     'single':  lit -> one neon; unlit -> the same neon, dim.
//     'duo':     lit -> neon; unlit -> off (a second neon), dim.
//     'map' (lane SETTLEBG): every light its own colour. extra.paint = { hue: Uint8Array, gain: Float32Array } gives
//                each light an index into opts.palette (a list of hexes, the full neon range) and a brightness 0..1;
//                lit -> palette[hue] x gain, unlit -> the same colour x gain x dim. opts.level (default 1) scales the
//                whole picture, so a page can cap how bright a background gets. The map mode draws the plain
//                picture only: no hold, clamp, echo or flash (a page background has none of them).
// - render(field, { echo, time }): echo is a Float32Array from traces.echo(), drawn in its own neon (opts.echoColour,
//   default mem violet) where a light is off now; time makes the pointer trail pulse.
// - field.flash (a spike, say) is added in opts.flashColour at its strength, over whatever the light shows, and lights
//   the core too, so a flash reads as a white-hot point even on a lit wire.
// - The pointer's trail (field.held) is added in ice, the key's colour for "held": the user is holding those lights.
//   A clamped light (field.clamp) is drawn in ice outright: full when clamped yes, dim when clamped no.
// - dim is the brightness of an unlit light (default 0.16); glow scales the bloom (0 turns it off).
// - clear (opts.clear, set by mount when background is 'transparent'): the plate is cleared to transparent instead of
//   filled black, and the cell and core images carry their light as alpha (lightAlpha), so an unlit light and the gap
//   between dots have alpha 0 and a lit dot keeps its colour. 'lighter' then adds the layers in premultiplied space,
//   which is the same light the opaque plate shows, minus the black.
// - pitch is whole device pixels per light so the dot mask lines up exactly; below 3 the dots are drawn as plain
//   squares, which is what the eye sees at that size anyway.
// </claudes_code_comments>

import { NEON, neon, rgb, tint } from './palette.js';
import { makeCanvas } from './target.js';

export const RENDER_DEFAULTS = { color: 'meaning', neon: 'yes', off: 'no', heat: 'heat', dim: 0.16, glow: 1, core: true, pitch: 6, seed: 1, clear: false };

export const isClearBackground = (bg) => bg === 'transparent';

// the light as alpha: alpha = the brightest channel, colour scaled by 255 / alpha (ImageData is not premultiplied),
// so the browser's premultiplied pixel is the original colour. Black becomes fully transparent.
export function lightAlpha(d) {
  for (let p = 0; p < d.length; p += 4) {
    const r = d[p], g = d[p + 1], b = d[p + 2];
    const a = r > g ? (r > b ? r : b) : g > b ? g : b;
    d[p + 3] = a;
    if (a > 0 && a < 255) {
      const k = 255 / a;
      d[p] = r * k;
      d[p + 1] = g * k;
      d[p + 2] = b * k;
    }
  }
  return d;
}

// the colours a look uses, as [r, g, b] 0..255
export function makeColours(o) {
  const on = neon(o.neon, o.seed);
  return {
    yes: rgb(o.color === 'meaning' ? NEON.yes : on),
    heat: rgb(o.color === 'meaning' ? neon(o.heat) : on),
    off: rgb(o.color === 'single' ? on : neon(o.off)),
    coreYes: tint(o.color === 'meaning' ? NEON.yes : on, 0.78),
    coreHeat: tint(o.color === 'meaning' ? neon(o.heat) : on, 0.78),
    held: rgb(neon(o.heldColour ?? 'held')),
    echo: rgb(neon(o.echoColour ?? 'mem')),
    flash: o.flashColour ? rgb(neon(o.flashColour)) : tint(o.color === 'meaning' ? NEON.yes : on, 0.82),
    palette: (o.palette ?? []).map((x) => rgb(typeof x === 'string' ? x : x.hex)),
    paletteCore: (o.palette ?? []).map((x) => tint(typeof x === 'string' ? x : x.hex, 0.78)),
  };
}

// One light, one RGBA pixel: the colour of every light into d (and its hot core into k when k is given), both
// Uint8ClampedArray of w * h * 4. The alpha bytes are left alone (the caller fills them with 255 once). Pure, so it is
// shared by the 2D and the WebGL renderers and tested in node. A field with no clamp, hold, echo or flash (the
// common case) takes a loop with none of their branches; general = true forces the full loop (the tests compare them).
// the 'map' fill: each light its own palette colour and gain (a page background's full-colour picture)
export function fillMap(F, paint, o, colours, d, k) {
  const { m } = F;
  const n = F.n;
  const hue = paint.hue;
  const gain = paint.gain;
  const pal = colours.palette;
  const cores = colours.paletteCore;
  const dim = o.dim;
  const level = o.level ?? 1;
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    const c = pal[hue[i]];
    const a = m[i];
    const g = gain[i] * level;
    if (!c || g <= 0) {
      d[p] = d[p + 1] = d[p + 2] = 0;
      if (k !== null) k[p] = k[p + 1] = k[p + 2] = 0;
      continue;
    }
    const v = g * (a + dim * (1 - a));
    d[p] = c[0] * v;
    d[p + 1] = c[1] * v;
    d[p + 2] = c[2] * v;
    if (k !== null) {
      const hot = a > 0.4 ? ((a - 0.4) / 0.6) * g : 0;
      const cr = cores[hue[i]];
      k[p] = cr[0] * hot;
      k[p + 1] = cr[1] * hot;
      k[p + 2] = cr[2] * hot;
    }
  }
}

export function fillCells(F, extra, o, colours, d, k, general = false) {
  if (o.color === 'map' && extra.paint) return fillMap(F, extra.paint, o, colours, d, k);
  const { m, s } = F;
  const n = F.n;
  const ech = extra.echo ?? null;
  const ec = colours.echo;
  const tm = extra.time ?? 0;
  const hd = F.holding ? F.held : null;
  const cl = F.clamped;
  const ice = colours.held;
  const fl = F.flashA ?? null;
  const fc = colours.flash;
  const t = F.target;
  const dim = o.dim;
  const meaning = o.color === 'meaning';
  const { yes, heat, off, coreYes, coreHeat } = colours;
  if (!general && !hd && !cl && !ech && !fl) {
    // the plain picture: colour = neon x soft read + off x dim x (1 - soft read); the core glows above 0.4
    const y0 = yes[0], y1 = yes[1], y2 = yes[2];
    const h0 = heat[0], h1 = heat[1], h2 = heat[2];
    const o0 = off[0], o1 = off[1], o2 = off[2];
    for (let i = 0, p = 0; i < n; i++, p += 4) {
      const a = m[i];
      const agree = !meaning || t[i] > 0;
      const b = dim * (1 - a); // the same arithmetic as the full loop, so both give the same bytes
      if (agree) {
        d[p] = y0 * a + o0 * b;
        d[p + 1] = y1 * a + o1 * b;
        d[p + 2] = y2 * a + o2 * b;
      } else {
        d[p] = h0 * a + o0 * b;
        d[p + 1] = h1 * a + o1 * b;
        d[p + 2] = h2 * a + o2 * b;
      }
      if (k !== null) {
        const hot = a > 0.4 ? (a - 0.4) / 0.6 : 0;
        const cr = agree ? coreYes : coreHeat;
        k[p] = cr[0] * hot;
        k[p + 1] = cr[1] * hot;
        k[p + 2] = cr[2] * hot;
      }
    }
    return;
  }
  for (let i = 0, p = 0; i < n; i++, p += 4) {
    let a = m[i];
    const agree = t[i] > 0 || !meaning;
    let c = agree ? yes : heat;
    if (cl && cl[i]) {
      // a clamped light is drawn in ice, the key's colour for held: bright when held yes, dim when held no
      c = ice;
      a = cl[i] > 0 ? 1 : 0;
    }
    const b = dim * (1 - a);
    // the trail pulses: held falls with age, so a sine of it runs along the stroke like a heartbeat
    const g = hd && hd[i] > 0 ? hd[i] * (0.4 + 0.3 * Math.sin(tm * 7 - hd[i] * 9)) : 0;
    const e = ech && s[i] < 0 ? Math.min(1, ech[i]) * 0.5 : 0;
    const f = fl ? fl[i] : 0;
    // d is clamped to 0..255 by its type, so no Math.min is needed
    d[p] = c[0] * a + off[0] * b + ice[0] * g + ec[0] * e + fc[0] * f;
    d[p + 1] = c[1] * a + off[1] * b + ice[1] * g + ec[1] * e + fc[1] * f;
    d[p + 2] = c[2] * a + off[2] * b + ice[2] * g + ec[2] * e + fc[2] * f;
    if (k !== null) {
      const hot = Math.max(a > 0.4 ? (a - 0.4) / 0.6 : 0, f);
      const cr = f > 0 ? fc : agree ? coreYes : coreHeat;
      k[p] = cr[0] * hot;
      k[p + 1] = cr[1] * hot;
      k[p + 2] = cr[2] * hot;
    }
  }
}

export function createRenderer(opts) {
  const { w, h } = opts;
  const defined = (x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined));
  let o = { ...RENDER_DEFAULTS, ...defined(opts) };
  const cells = makeCanvas(w, h);
  const cc = cells.getContext('2d');
  const cores = makeCanvas(w, h);
  const kc = cores.getContext('2d');
  const img = cc.createImageData(w, h);
  const kimg = kc.createImageData(w, h);
  img.data.fill(255); // the alpha bytes stay 255; fillCells writes only colour
  kimg.data.fill(255);
  const half = makeCanvas(Math.max(1, w >> 1), Math.max(1, h >> 1));
  const quarter = makeCanvas(Math.max(1, w >> 2), Math.max(1, h >> 2));
  const hc = half.getContext('2d');
  const qc = quarter.getContext('2d');
  const plate = makeCanvas(1, 1);
  const pc = plate.getContext('2d');
  const layer = makeCanvas(1, 1);
  const lc = layer.getContext('2d');
  let dotMask = null;
  let coreMask = null;
  let colours = null;
  let alphaIsLight = false; // true while the alpha bytes hold light (clear), not 255

  const mask = (P, r) => {
    const cv = makeCanvas(P, P);
    const c = cv.getContext('2d');
    const g = c.createRadialGradient(P / 2, P / 2, 0, P / 2, P / 2, r);
    g.addColorStop(0, 'rgba(255,255,255,1)');
    g.addColorStop(0.7, 'rgba(255,255,255,1)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    c.fillStyle = g;
    c.fillRect(0, 0, P, P);
    return pc.createPattern(cv, 'repeat');
  };

  const setup = () => {
    const P = Math.max(1, Math.round(o.pitch));
    o.pitch = P;
    plate.width = layer.width = w * P;
    plate.height = layer.height = h * P;
    dotMask = P >= 3 ? mask(P, P * 0.46) : null;
    coreMask = P >= 4 ? mask(P, P * 0.22) : null;
    colours = makeColours(o);
  };
  setup();

  const layerOver = (src, cut) => {
    // one layer: the cell image scaled up sharp, cut into round dots, added onto the plate
    lc.globalCompositeOperation = 'copy';
    lc.imageSmoothingEnabled = false;
    lc.drawImage(src, 0, 0, layer.width, layer.height);
    if (cut) {
      lc.globalCompositeOperation = 'destination-in';
      lc.fillStyle = cut;
      lc.fillRect(0, 0, layer.width, layer.height);
    }
    pc.drawImage(layer, 0, 0);
  };

  const render = (F, extra = {}) => {
    const useCore = !!(o.core && coreMask);
    fillCells(F, extra, o, colours, img.data, useCore ? kimg.data : null);
    if (o.clear) {
      lightAlpha(img.data);
      if (useCore) lightAlpha(kimg.data);
      alphaIsLight = true;
    } else if (alphaIsLight) {
      // back to the opaque plate: fillCells writes only colour, so the alpha bytes are restored once
      for (let p = 3; p < img.data.length; p += 4) img.data[p] = kimg.data[p] = 255;
      alphaIsLight = false;
    }
    cc.putImageData(img, 0, 0);
    if (useCore) kc.putImageData(kimg, 0, 0);

    if (o.clear) {
      pc.globalCompositeOperation = 'source-over';
      pc.clearRect(0, 0, plate.width, plate.height);
    } else {
      pc.globalCompositeOperation = 'copy';
      pc.fillStyle = '#000';
      pc.fillRect(0, 0, plate.width, plate.height);
    }
    pc.globalCompositeOperation = 'lighter';
    if (o.glow > 0) {
      hc.imageSmoothingEnabled = qc.imageSmoothingEnabled = true;
      // 'copy', not source-over: with a clear plate the cells carry their light as alpha, and drawing them over the
      // last frame's mip would pile the faint pixels up frame after frame into a full-colour wash (lane SETTLEBG)
      hc.globalCompositeOperation = qc.globalCompositeOperation = 'copy';
      hc.drawImage(cells, 0, 0, half.width, half.height);
      qc.drawImage(half, 0, 0, quarter.width, quarter.height);
      pc.imageSmoothingEnabled = true;
      pc.globalAlpha = 0.5 * o.glow;
      pc.drawImage(quarter, 0, 0, plate.width, plate.height);
      pc.globalAlpha = 0.38 * o.glow;
      pc.drawImage(half, 0, 0, plate.width, plate.height);
      pc.globalAlpha = 1;
    }
    layerOver(cells, dotMask);
    if (useCore) layerOver(cores, coreMask);
    pc.globalCompositeOperation = 'source-over';
    return plate;
  };

  return {
    plate,
    render,
    get pitch() { return o.pitch; },
    set(next) {
      o = { ...o, ...defined(next) };
      setup();
    },
  };
}
