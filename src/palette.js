// settle-see · palette - THE SETTLE NEON CODE: ten neons, each meaning one thing in the physics.
//
// <claudes_code_comments>
// ** Function List **
// NEONS                 - [{ key, hex, colour, meaning }], the ten neons in their fixed order
// NEON                  - key -> hex
// GROUND                - the dark grounds the lights live on
// RANDOM_KEYS           - the neons a random pick draws from (all but 'held', which is near white)
// neon(name, seed)      - a key, a hex, 'random' or 'random:<seed>' -> a hex
// rgb(hex) / rgba(hex, a) / mixRgb(a, b, k) / tint(hex, k)  - colour arithmetic for canvases
// hsv(hex) / hexOfHsv(h, s, v) - hue (degrees), saturation and value of a neon, and back
// neonRange(extra, size) - THE NEON RANGE: the ten neons plus any extra source hexes (a site's package neons), the
//                         saturated ones in hue order with the widest hue gaps filled by in-between neons, the
//                         near-white ones last; [{ hex, key, source }] (lane SETTLEBG)
//
// ** Technical Review **
// - The values are the site's (sites/settle-site/src/neon.js, fixed 2026-10-01); the site's tests check the two lists
//   agree. The base look is two colours: a dark grey ground and one prime neon, rose.
// - A random pick is seeded, so "neon: 'random'" with the same seed gives the same colour on every load.
// - THE NEON RANGE (lane SETTLEBG, 2026-10-02) is the full-colour palette of the page backgrounds. It types no new
//   hex: its sources are the ten neons and whatever the caller passes (the site passes its package neons from its own
//   neon.js). Each fill colour sits halfway round the hue wheel between its two neighbours, at their mean saturation
//   and value, so it stays a neon rather than the grey a plain RGB average would give. The widest gap is split first.
// </claudes_code_comments>

import { Rng } from './rng.js';

export const NEONS = [
  { key: 'yes', hex: '#ff4f8b', colour: 'rose', meaning: 'a thing that says yes (+1), a lit light' },
  { key: 'no', hex: '#5b5bff', colour: 'indigo', meaning: 'a thing that says no (-1), drawn dim' },
  { key: 'lean', hex: '#ffb000', colour: 'amber', meaning: 'a lean: what one thing wants on its own' },
  { key: 'pull', hex: '#22e6ff', colour: 'cyan', meaning: 'a pull between two things' },
  { key: 'heat', hex: '#ff5a1f', colour: 'orange', meaning: 'heat and noise, a light fighting its lean' },
  { key: 'calm', hex: '#9dff3a', colour: 'lime', meaning: 'calm: settled, low energy, a hit' },
  { key: 'mem', hex: '#b26bff', colour: 'violet', meaning: 'memory: a stored pattern' },
  { key: 'held', hex: '#d6f3ff', colour: 'ice', meaning: 'held: fixed by the user' },
  { key: 'data', hex: '#3dffb5', colour: 'mint', meaning: 'a measured number from a real run' },
  { key: 'miss', hex: '#ff3355', colour: 'red', meaning: 'an error, a miss, a refusal' },
];

export const NEON = Object.fromEntries(NEONS.map((n) => [n.key, n.hex]));

export const GROUND = { room: '#0a0a0c', bg: '#111114', panel: '#1a1a1f' };

export const RANDOM_KEYS = NEONS.map((n) => n.key).filter((k) => k !== 'held');

export function neon(name = 'yes', seed = 1) {
  if (typeof name !== 'string') return NEON.yes;
  if (name.startsWith('#')) return name;
  if (name === 'random' || name.startsWith('random:')) {
    const s = name.includes(':') ? Number(name.split(':')[1]) || 1 : seed;
    return NEON[RANDOM_KEYS[new Rng(s).below(RANDOM_KEYS.length)]];
  }
  return NEON[name] ?? NEON.yes;
}

export function rgb(hex) {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

export function rgba(hex, a) {
  const [r, g, b] = rgb(hex);
  return `rgba(${r},${g},${b},${a})`;
}

export function mixRgb(a, b, k) {
  return [0, 1, 2].map((i) => Math.round(a[i] + (b[i] - a[i]) * k));
}

// toward white by k: the hot core of a lit light is its own neon, nearly white
export function tint(hex, k) {
  return mixRgb(rgb(hex), [255, 255, 255], k);
}

// hue in degrees 0..360, saturation and value 0..1
export function hsv(hex) {
  const [r, g, b] = rgb(hex).map((c) => c / 255);
  const mx = Math.max(r, g, b);
  const mn = Math.min(r, g, b);
  const d = mx - mn;
  let h = 0;
  if (d > 0) {
    if (mx === r) h = ((g - b) / d) % 6;
    else if (mx === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  return [h, mx === 0 ? 0 : d / mx, mx];
}

export function hexOfHsv(h, s, v) {
  const c = v * s;
  const x = c * (1 - Math.abs(((h / 60) % 2) - 1));
  const m = v - c;
  const k = Math.floor(((h % 360) + 360) % 360 / 60);
  const [r, g, b] = [[c, x, 0], [x, c, 0], [0, c, x], [0, x, c], [x, 0, c], [c, 0, x]][k];
  return '#' + [r, g, b].map((u) => Math.round((u + m) * 255).toString(16).padStart(2, '0')).join('');
}

// THE NEON RANGE: sources (the ten neons and the extra hexes) plus in-between neons up to size colours
export function neonRange(extra = [], size = 24) {
  const sources = [...NEONS.map((n) => ({ hex: n.hex, key: n.key, source: true }))];
  for (const e of extra) {
    const hex = (typeof e === 'string' ? e : e.hex).toLowerCase();
    if (!sources.some((x) => x.hex === hex)) sources.push({ hex, key: typeof e === 'string' ? hex : e.key ?? hex, source: true });
  }
  const pale = sources.filter((x) => hsv(x.hex)[1] < 0.5);
  const ring = sources.filter((x) => hsv(x.hex)[1] >= 0.5).map((x) => ({ ...x, h: hsv(x.hex)[0] })).sort((a, b) => a.h - b.h);
  while (ring.length + pale.length < size && ring.length > 1) {
    // split the widest hue gap (the wrap from the last to the first included)
    let best = -1;
    let gap = -1;
    for (let i = 0; i < ring.length; i++) {
      const a = ring[i].h;
      const b = i + 1 < ring.length ? ring[i + 1].h : ring[0].h + 360;
      if (b - a > gap) { gap = b - a; best = i; }
    }
    const A = ring[best];
    const B = ring[(best + 1) % ring.length];
    const [, sa, va] = hsv(A.hex);
    const [, sb, vb] = hsv(B.hex);
    const h = (A.h + gap / 2) % 360;
    const hex = hexOfHsv(h, (sa + sb) / 2, (va + vb) / 2);
    ring.splice(best + 1, 0, { hex, key: `mix:${A.key}+${B.key}`, source: false, h: A.h + gap / 2 });
  }
  return [...ring.map(({ hex, key, source }) => ({ hex, key, source })), ...pale];
}
