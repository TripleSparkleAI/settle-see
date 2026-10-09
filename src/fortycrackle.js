// settle-see · fortycrackle - THE 40 Hz CRACKLE AS TV SCANLINES (lane FORTYCRACKLE 2026-10-07, reworked by lane
// FORTYSCAN 2026-10-08). The navigator, 2026-10-08, of the first crackle: "it looks like splotchy poop! I want
// horizontal scanlines, with various angles, and morphing, like traditional TV effects, but old retro style too. For
// brightness only: this shows through on top of the existing settle, and only in 40 Hz flashing mode."
//
// <claudes_code_comments>
// ** Function List **
// FORTY_CRACKLE              - the numbers: the strength, the lightest soft read it brightens, the lit phases a
//                              pattern holds and the lit phases a morph takes
// FORTY_CRACKLE_LIMITS       - the hard bounds a page cannot pass: strength up to 0.85, hold and morph in lit phases
// FORTY_SCAN_PATTERNS        - the eight scanline patterns the deck deals: lines, tilt, roll, interlace, vhold,
//                              wobble, bloom, retro
// FORTY_SCAN_COVER           - the most of a picture a pattern may light, as its mean line intensity (0.45)
// fortyCrackleOf(c)          - pure: a page's option (true, false, an object) -> the bounded numbers, or null for none
// createFortyCrackle, scanParams, scanAt - the scanline generator itself lives in fortyscan.js (lane FORTYSCAN), so
//                              a page loads it only when THE 40 Hz LIGHT turns on (mount.js imports it on demand)
// fortyLitCycle(gate)        - the gate's count of lit phases since the light went on, or -1 when it is not lit now
//
// ** Technical Review **
// - TWO FILES (lane FORTYSCAN): this file holds the numbers and the gate's clock, which every picture reads at mount;
//   fortyscan.js holds the patterns and the generator, which only a page with the light on needs. mount.js imports
//   fortyscan.js on demand the first time a lit phase arrives, so the site's first-load chunk does not carry it
//   (tests/bundleslim.test.mjs holds that chunk under a ceiling). The first lit phases while it loads draw no lines.
// - WHY: THE 40 Hz LIGHT (fortyhz.js) is a full on/off square wave, so half of every cycle every picture is fully
//   dark and the light a picture sends halves over time (the Talbot-Plateau law). The crackle wins some of it back
//   on the LIT half only, now as a television's scanlines: bright horizontal lines lie over the picture and the lit
//   lights under them are pushed toward white through the field's draw-only flash. The dark half stays fully dark
//   (the stylesheet still sets every [data-settle-light] to opacity 0), so the square wave and its duty are kept.
// - BRIGHTNESS ONLY: a light is brightened by line intensity x strength x its own soft read F.m (or the target's yes
//   when the field has no soft read), and a light whose soft read is under o.minLit gets nothing. So the lines show
//   only where the settle already shows light: a dark picture stays dark, and no light the settle did not light is
//   ever drawn. (The first crackle lifted the unlit ground too, and those grey patches were the "splotches".)
// - THE PATTERNS, each a pure function of light position and lit phase (scanAt), every length in lights:
//   lines     - plain horizontal scanlines, a period of 3.5 to 6 rows, drifting slowly
//   tilt      - the same lines at an angle of 5 to 28 degrees either way
//   roll      - lines rolling down the picture at 0.15 to 0.4 rows a lit phase
//   interlace - every other row, the odd and even fields swapping at every lit phase (two fields make the frame)
//   vhold     - a vertical-hold roll: a tall bright bar rolling down through faint lines, crossing in 40 to 90 phases
//   wobble    - lines bent by a travelling sine across the picture, as on a set with a bad horizontal hold
//   bloom     - phosphor bloom: soft lines (a gaussian profile, a period of 7 to 10 rows) breathing in brightness
//   retro     - an old set's chunky scanlines: a period of 7 to 11 rows, lines about 2 rows thick, a slight tilt
//   Every pattern's mean intensity stays under FORTY_SCAN_COVER, so the lines cover at most 45% of a picture.
// - MORPHING, DEALT BY THE DECK: the patterns come from THE DECK RULE (deck.js createBag over FORTY_SCAN_PATTERNS
//   with the crackle's own generator): one shows for o.hold lit phases, then the next card's lines fade in over
//   o.morph lit phases while the old ones fade out (the intensity is the mix of the two), so the screen morphs from
//   one effect to the next and every effect shows once before any repeats. Each dealt card draws its own shape
//   (period, angle, speed) at random, so the same effect looks different the next time round.
// - IT ACCOUNTS FOR THE TIMING OF 40 Hz: the clock is the gate's lit count (fortyLitCycle), not the picture's
//   frames. A picture that draws twice in one lit phase draws the same lines twice; a picture that misses lit phases
//   (a slow footer) jumps its clock by the phases it missed, and the patterns are pure functions of the clock, so
//   catching up costs nothing but the deals the jump crossed (at most CATCH_UP + 1). A dark frame brightens nothing.
// - DRAW-ONLY: F.flash (field.js) touches no p-bit, no lean and no temperature, so the picture settles exactly as it
//   would without the crackle (tests/fortycrackle.test.mjs keeps two settles' states identical). The crackle has its
//   own generator (crackleRng), so it never moves the physics' random sequence.
// - BOUNDS: strength at most 0.85 whatever a page asks. Under reduced motion the gate refuses the light, so the
//   crackle never runs; WCAG 2.3.1's general limits and the flashing-light warning are untouched: nothing the crackle
//   draws ever shows on a dark phase, it only brightens parts of the lit phases the light already has.
// </claudes_code_comments>

export const FORTY_CRACKLE = Object.freeze({
  strength: 0.8, // the flash strength on a fully lit light at the centre of a line
  minLit: 0.12, // a light whose soft read is under this is not lit: the lines never draw it
  hold: 48, // lit phases one pattern shows (1.2 s at 40 Hz, 1.6 s at 30 Hz)
  morph: 20, // lit phases one pattern takes to become the next
});

export const FORTY_CRACKLE_LIMITS = Object.freeze({ strength: [0, 0.85], minLit: [0.01, 1], hold: [4, 4000], morph: [1, 400] });

export const FORTY_SCAN_PATTERNS = Object.freeze(['lines', 'tilt', 'roll', 'interlace', 'vhold', 'wobble', 'bloom', 'retro']);

export const FORTY_SCAN_COVER = 0.45;

const bound = (x, [lo, hi], d) => (Number.isFinite(x) ? Math.min(hi, Math.max(lo, x)) : d);

export function fortyCrackleOf(c) {
  if (c === false || c === null) return null;
  const o = c && typeof c === 'object' ? c : {};
  const strength = bound(o.strength, FORTY_CRACKLE_LIMITS.strength, FORTY_CRACKLE.strength);
  if (!(strength > 0)) return null;
  const patterns = Array.isArray(o.patterns) ? o.patterns.filter((p) => FORTY_SCAN_PATTERNS.includes(p)) : null;
  return {
    strength,
    minLit: bound(o.minLit, FORTY_CRACKLE_LIMITS.minLit, FORTY_CRACKLE.minLit),
    hold: Math.round(bound(o.hold, FORTY_CRACKLE_LIMITS.hold, FORTY_CRACKLE.hold)),
    morph: Math.round(bound(o.morph, FORTY_CRACKLE_LIMITS.morph, FORTY_CRACKLE.morph)),
    patterns: patterns && patterns.length ? patterns : [...FORTY_SCAN_PATTERNS],
  };
}

// the gate's lit-phase count, or -1 when the light is off or the frame drawn now is dark
export function fortyLitCycle(gate) {
  if (!gate || !gate.on || gate.phase !== true) return -1;
  return gate.litCycle ?? 0;
}
