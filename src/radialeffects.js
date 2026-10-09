// settle-see · radialeffects - THE RADIAL EFFECTS (lane SOUNDSHAKE, navigator 2026-10-04: "make pop effects more like
// radial, but a different style of radial than user clicks: the same system but a different variation of the
// user-click action. Make that a good defined system: the RADIAL EFFECTS"). One named family of wave styles on THE
// RADIAL PULSE BUS (radialpulse.js). A user's click is one member; the sound's pops are the others.
//
// <claudes_code_comments>
// ** Function List **
// RADIAL_EFFECTS        - the family: click (a user's), shimmer, double, spokes (the sound's), each a frozen record of
//                         speed, band, fade, crest, trough, rings, gap, spokes, kick, cap and still
// EFFECT_KEYS           - the members in order; SOUND_EFFECTS - the members the sound may fire
// effectOf(key)         - one member by key (click for an unknown key)
// ringCells(cx, cy, R, width, w, h, into) - pure: the lights on the band R - width/2 .. R + width/2 of a circle round
//                         (cx, cy) inside a w x h grid, added to the Set `into` (only the arc that crosses the grid)
// onSpoke(x, y, cx, cy, n, width, turn) - pure: is the light at (x, y) within width/2 radians of one of n spokes
// effectHolds(effect, wave, w, h, hold) - pure: the settle operation one effect performs at one frame of its wave:
//                         calls hold(i, sign, strength) for every light it leans (+1 a crest, -1 a trough); returns
//                         how many lights it touched. wave = { x, y, R, band, a, turn } in lights
// KEY_EFFECTS           - THE KEY SUIT (lane HEROKEYS): fifty gentle members a step of the hero deals, one at a time,
//                         from a 50-card deck: rings, ripples, crests, blooms, sweeps, collapses, spokes, spirals,
//                         petals, wavy rings and standing waves; KEY_EFFECT_KEYS - their keys in order
// GENTLE                - the bounds every key member keeps: cap, kick, crest and trough
// isGentle(e)           - pure: does a member keep GENTLE (the tests walk all fifty)
//
// ** Technical Review **
// - EVERY MEMBER IS THE SAME PHYSICS: a front travelling out from a point, its strength falling as
//   strength * exp(-r / fade); on the lights under it the settle's own hand (field.hold, the pointer's mechanism) leans
//   them on (a crest) or off (a trough) for that frame only, and on arrival the temperature takes a kick of
//   kick * strength. The field then settles back. No overlay, no colour: the picture moves because its p-bits do.
// - THE MEMBERS:
//     click    the user's: 900 px/s, a crest a quarter of the 56 px band wide, a dark trough 0.4 band behind it at 0.6
//              of the crest's strength, a 0.35 heat kick; what every click and drag box has always sent
//     shimmer  a sound's high band: a thin fast ring, 1,800 px/s, no trough, no heat, fading over 700 px
//     double   a sound's tonal hit: two soft rings 0.7 band apart, slower (650 px/s), the second at 0.6
//     spokes   a sound's drum hit: the crest only along nine narrow spokes (0.16 rad), turned by the wave's own turn
//   A member's cap bounds its strength (the bus clamps every emit to it); still: false means it sends nothing under
//   prefers-reduced-motion (a sound pop is decoration; a user's click keeps its one still answer).
// - SPEED, BAND AND FADE ride on the wave, so the bus times and fades each member by its own numbers.
// - ringCells is the arc walk the mount used for page ripples, moved here so it is pure and tested: seen from
//   outside the grid, only the smallest arc that covers the grid's corners is walked.
// - THE KEY SUIT (lane HEROKEYS, navigator 2026-10-04: "a radial effect, a gentle one, a random one of 50: choose the
//   effect too on each keyboard left/right press"). The same physics with more knobs, each optional and neutral at 0:
//     rings, gap      n crests gap x band apart, the k-th lit at 0.6^k (the double's rule, generalised)
//     inward          the front runs from the far corner in to the origin (radius Rmax - R): a collapse
//     standing        the crests sit still at (k + 1) x gap x band and swell and fade as the wave's time passes
//     spokes, twist   the crest only along n spokes; twist turns each spoke by twist radians per band of radius,
//                     which makes a spiral
//     petals, depth   the strength rises and falls round the ring n times (depth 0..1): a flower
//     wavy, wavyAmp   the ring's radius rolls wavy times round the circle by wavyAmp x band: a soft crown
//     origin          where the page starts it: 'centre', 'side' (the edge the arrow points to) or 'far' (well past
//                     that edge, so the front crosses the picture nearly straight: a sweep)
//   Every key member is GENTLE: a cap of at most 0.45, a heat kick of at most 0.12, a crest at most 0.4 of the band,
//   a trough (if any) at most 0.5 of the crest (a click's is 0.6 at full strength), and still: true, so under reduced
//   motion it gives the one still brightness answer a click gives. A plain click and the three sound members leave
//   every new knob at 0 and draw exactly what they drew before.
// </claudes_code_comments>

const F = (o) => Object.freeze({ trough: null, rings: 1, gap: 0, spokes: 0, spokeWidth: 0, twist: 0, petals: 0, petalDepth: 0, wavy: 0, wavyAmp: 0, standing: false, inward: false, origin: 'centre', ...o });

export const RADIAL_EFFECTS = Object.freeze({
  click: F({ key: 'click', from: 'user', label: 'CLICK', line: 'a bright crest with a dark trough behind it', speed: 900, band: 56, fade: 1400, crest: 0.25, trough: Object.freeze({ at: 0.4, width: 0.2, k: 0.6 }), kick: 0.35, cap: 1, still: true }),
  shimmer: F({ key: 'shimmer', from: 'sound', label: 'SHIMMER', line: 'a thin fast ring, no trough and no heat: a glint passing', speed: 1800, band: 28, fade: 700, crest: 0.18, kick: 0, cap: 0.5, still: false }),
  double: F({ key: 'double', from: 'sound', label: 'DOUBLE', line: 'two soft rings a little apart, slower', speed: 650, band: 64, fade: 1000, crest: 0.2, rings: 2, gap: 0.7, kick: 0.08, cap: 0.55, still: false }),
  spokes: F({ key: 'spokes', from: 'sound', label: 'SPOKES', line: 'a burst along nine narrow spokes', speed: 1200, band: 48, fade: 900, crest: 0.35, spokes: 9, spokeWidth: 0.16, kick: 0.05, cap: 0.6, still: false }),
});

export const EFFECT_KEYS = Object.freeze(Object.keys(RADIAL_EFFECTS));
export const SOUND_EFFECTS = Object.freeze(EFFECT_KEYS.filter((k) => RADIAL_EFFECTS[k].from === 'sound'));

// THE KEY SUIT (lane HEROKEYS): the bounds, then fifty members over one gentle base
export const GENTLE = Object.freeze({ cap: 0.45, kick: 0.12, crest: 0.4, trough: 0.5 });
const K = (key, label, line, o) => F({ key, from: 'keys', label, line, speed: 700, band: 48, fade: 1100, crest: 0.22, kick: 0.06, cap: 0.38, still: true, ...o });
const T = (k = 0.3, at = 0.45, width = 0.2) => Object.freeze({ at, width, k });
const KEYS_LIST = [
  // rings and ripples
  K('ring', 'RING', 'one soft ring', {}),
  K('halo', 'HALO', 'a wide slow ring', { speed: 500, band: 80, crest: 0.3 }),
  K('thread', 'THREAD', 'a thin quick ring', { speed: 1300, band: 24, crest: 0.2, cap: 0.32 }),
  K('ripple', 'RIPPLE', 'a ring with a shallow trough behind it', { trough: T(0.35) }),
  K('hush', 'HUSH', 'the faintest wide ring', { band: 70, crest: 0.3, cap: 0.22, kick: 0.03 }),
  K('ember', 'EMBER', 'a slow warm ring that leaves a little heat', { speed: 420, kick: 0.12, trough: T(0.25, 0.5, 0.15) }),
  // double and triple crests
  K('echo', 'ECHO', 'two rings a little apart', { rings: 2, gap: 0.8 }),
  K('lub', 'LUB-DUB', 'two rings close together, a heartbeat', { rings: 2, gap: 0.4, speed: 600 }),
  K('triplet', 'TRIPLET', 'three rings, each fainter', { rings: 3, gap: 0.6 }),
  K('rain', 'RAIN', 'three thin rings from the side', { rings: 3, gap: 0.9, band: 30, crest: 0.25, origin: 'side', speed: 900 }),
  // slow blooms
  K('bloom', 'BLOOM', 'a slow wide bloom', { speed: 380, band: 90, crest: 0.35, fade: 900, kick: 0.1, cap: 0.42 }),
  K('dawn', 'DAWN', 'a slow bloom rising from the side', { speed: 420, band: 100, crest: 0.35, origin: 'far', fade: 2200 }),
  K('drift', 'DRIFT', 'a soft ring drifting in from the edge', { speed: 450, band: 60, origin: 'side', fade: 1600 }),
  // sweeps from the side the arrow points to
  K('sweep', 'SWEEP', 'a straight thin front across the picture', { speed: 1100, band: 30, crest: 0.25, origin: 'far', fade: 3000 }),
  K('tide', 'TIDE', 'two straight fronts, one after the other', { speed: 800, rings: 2, gap: 1.2, origin: 'far', fade: 3000 }),
  K('shore', 'SHORE', 'a wavy front rolling in from the side', { speed: 700, wavy: 6, wavyAmp: 0.3, origin: 'far', fade: 3000 }),
  K('aurora', 'AURORA', 'a slow wavy curtain from the side', { speed: 450, band: 70, wavy: 4, wavyAmp: 0.35, origin: 'far', fade: 3000, cap: 0.34 }),
  K('comet', 'COMET', 'one bright wedge from the side', { spokes: 1, spokeWidth: 0.7, origin: 'side', crest: 0.3, speed: 900 }),
  K('fan', 'FAN', 'seven rays fanning from the side', { spokes: 7, spokeWidth: 0.16, origin: 'side', speed: 900 }),
  // inward collapses
  K('collapse', 'COLLAPSE', 'a ring that closes in to the middle', { inward: true }),
  K('gather', 'GATHER', 'two rings closing in', { inward: true, rings: 2, gap: 0.8 }),
  K('inhale', 'INHALE', 'a slow wide bloom drawing in', { inward: true, speed: 420, band: 90, crest: 0.33, fade: 1600 }),
  K('breath', 'BREATH', 'the faintest ring drawing in', { inward: true, band: 70, crest: 0.3, cap: 0.24, kick: 0.03, fade: 1600 }),
  K('iris', 'IRIS', 'a six-petal ring closing in', { inward: true, petals: 6, petalDepth: 0.8, fade: 1600 }),
  // spokes
  K('spokes6', 'SIX SPOKES', 'a burst along six spokes', { spokes: 6, spokeWidth: 0.22, crest: 0.3 }),
  K('star', 'STAR', 'twelve fine rays', { spokes: 12, spokeWidth: 0.12, crest: 0.3, speed: 1000 }),
  K('wheel', 'WHEEL', 'four broad spokes', { spokes: 4, spokeWidth: 0.5 }),
  K('compass', 'COMPASS', 'four fine spokes on two rings', { spokes: 4, spokeWidth: 0.14, rings: 2, gap: 0.7, crest: 0.3 }),
  // spirals
  K('spiral', 'SPIRAL', 'three arms turning as they grow', { spokes: 3, spokeWidth: 0.3, twist: 0.6, crest: 0.3 }),
  K('swirl', 'SWIRL', 'five arms in a swirl', { spokes: 5, spokeWidth: 0.22, twist: 1, crest: 0.3 }),
  K('vortex', 'VORTEX', 'eight thin arms in a tight spiral', { spokes: 8, spokeWidth: 0.18, twist: 1.6, crest: 0.32 }),
  K('galaxy', 'GALAXY', 'two wide arms, slow and wound', { spokes: 2, spokeWidth: 0.5, twist: 2.2, speed: 480, band: 64, crest: 0.3 }),
  K('seashell', 'SEASHELL', 'one wide arm wound tight', { spokes: 1, spokeWidth: 0.9, twist: 2.6, speed: 520, crest: 0.32 }),
  K('eddy', 'EDDY', 'three spiral arms closing in', { inward: true, spokes: 3, spokeWidth: 0.35, twist: 1.2, crest: 0.3, fade: 1600 }),
  K('whirlpool', 'WHIRLPOOL', 'six spiral arms closing in', { inward: true, spokes: 6, spokeWidth: 0.2, twist: 1.4, crest: 0.32, fade: 1600 }),
  // petals
  K('clover', 'CLOVER', 'a three-petal ring', { petals: 3, petalDepth: 0.8, crest: 0.3 }),
  K('petals', 'PETALS', 'a four-petal ring', { petals: 4, petalDepth: 0.8, crest: 0.3 }),
  K('lotus', 'LOTUS', 'a six-petal ring', { petals: 6, petalDepth: 0.75, crest: 0.3 }),
  K('daisy', 'DAISY', 'an eight-petal ring', { petals: 8, petalDepth: 0.7, crest: 0.28 }),
  K('rose', 'ROSE', 'two five-petal rings', { petals: 5, petalDepth: 0.7, rings: 2, gap: 0.7, crest: 0.3 }),
  K('lantern', 'LANTERN', 'two four-petal rings, slow', { petals: 4, petalDepth: 0.6, rings: 2, gap: 1, speed: 500, crest: 0.3 }),
  // wavy rings
  K('wobble', 'WOBBLE', 'a ring that rolls five times round', { wavy: 5, wavyAmp: 0.25 }),
  K('jelly', 'JELLY', 'a slow ring that rolls three times round', { wavy: 3, wavyAmp: 0.4, speed: 480, band: 60 }),
  K('crown', 'CROWN', 'a ring with nine soft points', { wavy: 9, wavyAmp: 0.15 }),
  K('lace', 'LACE', 'a thin ring with twelve small waves', { wavy: 12, wavyAmp: 0.12, band: 30, crest: 0.26 }),
  K('snowflake', 'SNOWFLAKE', 'six spokes on a wavy ring', { spokes: 6, spokeWidth: 0.3, wavy: 6, wavyAmp: 0.2, crest: 0.3 }),
  // standing waves
  K('standing', 'STANDING', 'three still rings that swell and fade', { standing: true, rings: 3, gap: 1.2 }),
  K('pulse', 'PULSE', 'two still rings that swell and fade', { standing: true, rings: 2, gap: 1.5, speed: 600 }),
  K('chime', 'CHIME', 'four thin still rings that ring out', { standing: true, rings: 4, gap: 1, band: 34, crest: 0.28 }),
  K('gong', 'GONG', 'three still petalled rings that swell and fade', { standing: true, rings: 3, gap: 1.3, petals: 4, petalDepth: 0.5, speed: 500 }),
];
export const KEY_EFFECTS = Object.freeze(Object.fromEntries(KEYS_LIST.map((e) => [e.key, e])));
export const KEY_EFFECT_KEYS = Object.freeze(KEYS_LIST.map((e) => e.key));
export const effectOf = (key) => RADIAL_EFFECTS[key] ?? KEY_EFFECTS[key] ?? RADIAL_EFFECTS.click;
export const isGentle = (e) => !!e && e.cap <= GENTLE.cap && e.kick <= GENTLE.kick && e.crest <= GENTLE.crest && (!e.trough || e.trough.k <= GENTLE.trough) && e.still === true;

export function ringCells(cx, cy, R, width, w, h, into = new Set()) {
  if (!(R > 0)) return into;
  let a0 = 0;
  let a1 = Math.PI * 2;
  const inside = cx >= -1 && cy >= -1 && cx <= w + 1 && cy <= h + 1;
  if (!inside) {
    const angs = [[0, 0], [w, 0], [0, h], [w, h]].map(([x, y]) => Math.atan2(y - cy, x - cx)).sort((p, q) => p - q);
    let gap = -1;
    let at = 0;
    for (let i = 0; i < 4; i++) {
      const g = (i === 3 ? angs[0] + Math.PI * 2 : angs[i + 1]) - angs[i];
      if (g > gap) { gap = g; at = i; }
    }
    a0 = angs[(at + 1) % 4];
    a1 = a0 + (Math.PI * 2 - gap);
  }
  const half = width / 2;
  for (let dr = -half; dr <= half + 1e-9; dr += 0.7) {
    const r = R + dr;
    if (r <= 0) continue;
    const step = 0.7 / r;
    for (let t = a0; t <= a1; t += step) {
      const x = Math.round(cx + Math.cos(t) * r);
      const y = Math.round(cy + Math.sin(t) * r);
      if (x < 0 || y < 0 || x >= w || y >= h) continue;
      into.add(y * w + x);
    }
  }
  return into;
}

const TAU = Math.PI * 2;
export function onSpoke(x, y, cx, cy, n, width, turn = 0) {
  if (!(n > 0)) return true;
  const a = Math.atan2(y - cy, x - cx) - turn;
  const step = TAU / n;
  const off = ((a % step) + step) % step;
  return Math.min(off, step - off) <= width / 2;
}

export function effectHolds(effect, wave, w, h, hold) {
  const e = typeof effect === 'string' ? effectOf(effect) : effect ?? RADIAL_EFFECTS.click;
  const { x, y } = wave;
  const band = Math.max(2, wave.band);
  const a = Math.min(1, Math.max(0, wave.a));
  const turn = wave.turn ?? 0;
  let n = 0;
  // inward: the front runs from the farthest corner in to the origin
  const Rmax = e.inward ? Math.max(Math.hypot(x, y), Math.hypot(w - x, y), Math.hypot(x, h - y), Math.hypot(w - x, h - y)) : 0;
  const R = e.inward ? Math.max(0, Rmax - wave.R) : wave.R;
  const behind = e.inward ? 1 : -1; // the trough and the later rings trail the front
  // the k-th crest's radius: a travelling ring k x gap behind the front, or a still ring at (k + 1) x gap
  const radii = [];
  for (let k = 0; k < e.rings; k++) radii.push(e.standing ? (k + 1) * Math.max(0.2, e.gap) * band : R + behind * k * e.gap * band);
  // a standing wave swells and fades in place as the wave's time (its radius) passes
  const swell = e.standing ? Math.sin((Math.PI * wave.R) / (2 * band)) ** 2 : 1;
  const width = Math.max(1, band * e.crest);
  const wav = e.wavy > 0 && e.wavyAmp > 0 ? e.wavyAmp * band : 0;
  const crest = new Set();
  for (let k = 0; k < radii.length; k++) ringCells(x, y, radii[k], width + 2 * wav, w, h, crest);
  if (e.trough) {
    const trough = ringCells(x, y, R + behind * band * e.trough.at, Math.max(1, band * e.trough.width), w, h, new Set());
    for (const i of trough) if (!crest.has(i)) { hold(i, -1, a * e.trough.k * swell); n++; }
  }
  for (const i of crest) {
    const cx = i % w;
    const cy = (i / w) | 0;
    const d = Math.hypot(cx - x, cy - y);
    const th = Math.atan2(cy - y, cx - x);
    if (e.spokes && !onSpoke(cx, cy, x, y, e.spokes, e.spokeWidth, turn + (e.twist ? (e.twist * d) / band : 0))) continue;
    // the nearest crest (the double's rule: the second ring at 0.6, the third at 0.36)
    const roll = wav ? wav * Math.sin(e.wavy * th + turn) : 0;
    let j = 0;
    let best = Infinity;
    for (let k = 0; k < radii.length; k++) { const q = Math.abs(d - (radii[k] + roll)); if (q < best) { best = q; j = k; } }
    if (wav && best > width / 2 + 0.5) continue; // a wavy ring keeps only the lights on its rolling line
    let s = a * Math.pow(0.6, j) * swell;
    if (e.petals > 0) s *= 1 - e.petalDepth + e.petalDepth * (0.5 + 0.5 * Math.cos(e.petals * (th - turn)));
    if (!(s > 0)) continue;
    hold(i, 1, s);
    n++;
  }
  return n;
}
