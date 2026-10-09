<!-- settle-banner -->
```text
 ●··●·● ●●● ●●● ●   ●●●      ●● ●●● ●●●
··  ●    ●   ●  ●   ●       ●   ●   ●
 ●  ●●   ●   ●  ●   ●●  ●●●  ●  ●●  ●●
  ●·●    ●·  ●  ●   ●         ● ●   ●
●●  ●●●  ●   ●  ●●● ●●●     ●●  ●●● ●●●
↑↓↓↑↓↑↑↑↑↑ ●●●●●●●●
✦ pictures that settle out of noise, for a canvas or React
```

# settle-see

Pictures that settle out of noise. Give it a word, a shape, a photo or a film, and it draws a grid of neon lights
that starts as noise and cools into your picture, then keeps it alive. One function for a canvas, one component for
React, no dependencies.

Every picture on the SETTLE site is drawn by it: the hero, the footer, the header logo, the credits and the films.

## Quick start

```sh
npm install github:triplesparkle/settle-see
```

That installs it from its public repository, `github.com/triplesparkle/settle-see`. Nothing is on the npm registry.
To run its tests, clone it:

```sh
git clone https://github.com/triplesparkle/settle-see
cd settle-see
npm test
```

In React:

```jsx
import { Settle } from 'settle-see/react';

<Settle word="SETTLE" neon="yes" height={160} />
```

On any canvas:

```js
import { settle } from 'settle-see';

const handle = settle(canvas, { shape: 'heart', neon: 'mem', color: 'single', res: 64 });
handle.set({ word: 'hello' }); // settle into something else
```

In node, with no canvas at all, the same physics prints as text (`node examples/first.mjs`):

```text
40 sweeps: settled  (agreement with the heart: 1.00)
·······●●●●●●●●······●●●●●●●●·······
····●●●●●●●●●●●●●●●●●●●●●●●●●●●●····
···●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●···
··●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●··
··●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●··
···●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●···
···●●●●●●●●●●●●●●●●●●●●●●●●●●●●●●···
····●●●●●●●●●●●●●●●●●●●●●●●●●●●●····
·····●●●●●●●●●●●●●●●●●●●●●●●●●●·····
·······●●●●●●●●●●●●●●●●●●●●●●·······
·········●●●●●●●●●●●●●●●●●●·········
············●●●●●●●●●●●●············
···············●●●●●●···············
····································
····································
```

That is the last of three pictures in `examples/first.out`, the program's recorded output (noise, cooling, settled); `tests/first.test.mjs` runs the
program and fails if it stops printing exactly that.

## The components

`settle-see/react` has four components and a hook. React 18 or newer is an optional peer: the main entry,
`settle-see`, needs no React at all.

```jsx
import { Settle, SettleWord, SettleBadge, SettleReadout, useSettle } from 'settle-see/react';
```

### Settle

A canvas that settles. Every option of `settle()` (the next section) is a prop, plus these:

| prop | default | what it does |
|---|---|---|
| `width` | `'100%'` | the box's width, any CSS length |
| `height` | `240` | the box's height |
| `label` | from the target | the words a screen reader hears; the canvas has `role="img"` |
| `decorative` | `false` | hide the canvas from a screen reader (`aria-hidden`) |
| `morph` | off | `true` or `{ frames, periodMs, threshold }`: a new word, shape or target settles from the old picture instead of restarting |
| `paused` | `false` | hold the picture still; `false` plays it again |
| `stats` / `onStats` | off | the live numbers: temperature, energy, agreement, flips |
| `onHandle` | none | the live handle: `show`, `seek`, `advance`, `shake`, `morph`, `front`, the field |
| `beforeStep` / `afterStep` | none | run your own code around every frame's sweep |
| `onDrag` | none | with `drag`, hears a press turn into a drag box: armed, move, drop, cancel |
| `children` | none | drawn on top of the canvas |

```jsx
<Settle shape="purkinje" res={200} height={320} />
<Settle items={['SETTLE', 'heart', { svg: 'M10 90 L50 10 L90 90 Z' }]} neon="random" color="single" />
<Settle word="hello" morph neon="calm" />   // change word and the lights settle from the old one
```

A prop change goes to the running settle without restarting it, so a slider can move the pull, the dim or the colour
while the picture keeps its place.

### SettleWord

A word settling out of noise, sized to its text.

| prop | default | what it does |
|---|---|---|
| `word` | `'SETTLE'` | the word |
| `height` | `120` | the height; the width follows the word's length |
| `neon` | `'yes'` | the colour, a neon name or a hex |
| `color` | `'single'` | the colour mode (see Colour) |

```jsx
<SettleWord word="Kanerva" neon="mem" height={120} />
```

### SettleBadge

A small square settle of one shape in one neon, for cards and credits.

| prop | default | what it does |
|---|---|---|
| `shape` | `'star'` | a registered shape |
| `neon` | `'random'` | the colour, seeded by `seed` |
| `size` | `96` | width and height in pixels |
| `res` | `32` | lights across and down |

```jsx
<SettleBadge shape="star" neon="calm" size={96} />
```

### SettleReadout

The live numbers in a small translucent panel, meant to sit on the lights: sweeps, temperature, the grid, the energy,
the agreement and the flips.

```jsx
function Live() {
  const [s, setS] = useState(null);
  return (
    <Settle word="SETTLE" onStats={setS}>
      <SettleReadout stats={s} />
    </Settle>
  );
}
```

### useSettle and the hooks

`useSettle(options)` returns `{ ref, handle, stats }` for building your own component around a canvas. The other
hooks: `useTickerState()` (the page's halt state, for a "paused while you were away" note), `useRadialPulse` (THE
RADIAL PULSE BUS), and `useFortyHz` and `useFortyHzLight` (the 40 Hz light). `settle-see/react` also re-exports
everything in the main entry.

## The options

The options you reach for first. Each is an option of `settle()` and a prop of `<Settle>`; the sections after this
one say everything else.

| option | default | what it does |
|---|---|---|
| `word`, `shape`, `items`, `target` | the word SETTLE | what to settle into (see What to settle into) |
| `res` | `160` | lights across; `[w, h]` is an exact grid |
| `neon` | `'yes'` | the colour of a lit light: one of the ten neons, a hex, or `'random'` |
| `color` | `'meaning'` | `'meaning'` (the SETTLE colour code), `'single'`, `'duo'` or `'map'` |
| `dim` | `0.16` | how bright an unlit light is |
| `glow` | `1` | the bloom |
| `background` | `'#000'` | the plate; `'transparent'` draws the lights alone |
| `lean` | `0.9` | how hard each light leans toward the picture |
| `pull` | `0.3` | how hard neighbours pull toward agreeing |
| `schedule` | `'cycle'` | the temperature over time: `'cycle'`, `'cool'`, `'fixed'`, a number or a function |
| `fps` | `24` | sweeps a second |
| `still` | `false` | start settled and hold still; the pointer still plays on it |
| `rest` | `false` | stop drawing once nothing changes, until woken |
| `poke` | `true` | the pointer: a sparkle under it, rings on a click |
| `seed` | `1` | the noise, so a picture is the same every visit |
| `renderer` | `'2d'` | `'gl'` draws in one WebGL2 pass, for large pictures |

## What it is

- **What it does:** draws. It has no opinion about what your page is for. settle-text wraps it for people who only
  want text, images and vectors with plain props; settle-hear makes sound from the same numbers and imports nothing
  from it.
- **What it costs:** every settle on a page shares one animation loop, pauses off screen and in a hidden tab, and
  stops after five minutes with nobody there. A 384 x 192 field sweeps in about a millisecond (see Speed, halting and
  true time).
- **Access:** every `<Settle>` is an image with a name a screen reader reads. Under reduced motion a picture is drawn
  once, still, and a film shows one frame.
- **Its state, plainly:** version 0.1.0, MIT licence (`LICENSE`), nothing published to the npm registry. It
  runs in any browser with a 2D canvas; its pure half (the field, the shapes painted without a canvas, the deck, the
  clocks) runs in node, which is how its tests run.

## What a settle is

Each light is a p-bit. It says yes with probability `(1 + tanh(beta I)) / 2`, where
`I = lean t + pull (sum of its four neighbours)`, `t` is the target (+1 lit, -1 dark) and `beta = 1 / T`. Each
frame runs one exact Gibbs sweep over the whole grid (`sweeps`, default 1), in two checkerboard halves. The
temperature follows a schedule (`makeSchedule`): hot, cooling, settled, reheating, next picture. The default cycle
holds T 3.0 for 20 frames, cools geometrically to 0.45 over 170 frames, holds for 90 and reheats over 20. The field
lowers the energy
`E = -lean sum t_i s_i - pull sum over neighbours s_i s_j`. The defaults are `res: 160`, `fps: 24`, `lean: 0.9`
and `pull: 0.3`.

## What to settle into

| spec | meaning |
|---|---|
| `'heart'` | a registered shape (see below) |
| `'SETTLE'` or `{ word: 'SETTLE', weight, font }` | a word |
| `{ shape: 'spiral' }` | a registered shape, with parameters |
| `{ svg: 'M...', viewBox: [x, y, w, h], stroke }` | an SVG path, filled or stroked |
| `{ draw: (c, w, h, u) => {} }` | your own canvas drawing, white on black |
| `{ image: url or <img> }` | a picture, read by brightness |
| `{ bits: Int8Array }` | a target as is |
| `{ film: url }` | a small film (see Small films) |
| `{ live: (w, h, t) => bits }` | a target made on demand (see Live items) |

Shapes come in three families (`shapeNames('physics')` and so on):

- physics: `purkinje landscape tanh spins boltzmann hopfield sdm hypercube`, and three painted without a canvas:
  `cortex6` (the cerebral cortex in six labelled layers), `cerebellum` (Purkinje fans, parallel fibres, granule
  cells) and `brainbands` (both, one band above the other; `split`, default 0.5, centres the gap between them, so
  `split: 0.36` makes the cerebellar band the larger, as the SETTLE site's footer does). Each brain shape takes
  `{ view, eye }`: `'section'`, `'below'` (looking up from the white matter) or `'voyage'` (riding through the tissue
  at depth `eye`). `brainScene(w, h, spec)` returns the bits with the spike paths along the wires and the layer
  labels; `BRAIN_VIEWS` is the footer's cycle.
- plain: `circle ring heart star spiral wave cross diamond moon eye eightball`
- credits: Kanerva's memory, `hardLocations hammingBall counters vote criticalDistance tesseract` (the list
  `KANERVA`), then the characters of the people SETTLE rests on: `isingDomains tanhRule boltzmannBars metropolisHop
  restoredDisc annealValley hopfieldNet boltzmannMachine pbitCoin tapField tannerGraph softmaxRead markovBlanket
  noisyWell pbitChip openBook vinyl railsAerobics dots musicMachine`. The credits family LOADS ON DEMAND: the index
  knows the names and notes (`CREDIT_NAMES`, `CREDIT_NOTES`), and the drawings (about 19 kB of source) arrive the
  first time one is needed. `settle()` handles that itself (an unlit field, then the shape); `loadTarget` and
  `ensureShape(name)` wait for it; `toTarget` refuses a shape whose drawing has not arrived. To have them at once, call
  `await loadCreditShapes()` or import `'settle-see/credits'`.

Add your own with `defineShape(name, (c, w, h, u) => { ... }, note)` (a canvas drawing) or
`defineBits(name, (w, h) => Int8Array, note)` (painted in plain JavaScript with `Paint`: discs, rings, segments,
boxes). A `defineBits` shape needs no canvas, so it settles the same in node as in a browser, and its tests can
check every size a page draws it at. The credits family is painted that way.

`eightball` is a Magic 8 Ball. Alone it shows the cue face with its 8. With
`{ shape: 'eightball', text: 'Outlook good.' }` it shows the die's triangle and the answer in its window
(`wrapLines` does the wrapping).

## Colour

`color: 'meaning'` (the default) colours by the SETTLE code: rose for a light that is on and agrees with its lean,
orange for heat (on against its lean), dim indigo for off. `color: 'single'` uses one neon (`neon: 'mem'`, a hex,
or `'random'`, seeded by `seed`). `color: 'duo'` uses `neon` for on and `off` for off. `dim` sets how bright an off
light is (default 0.16); `glow` scales the bloom. Brightness is each light's running average, so a steady light
glows and a flickering one does not.

`color: 'map'` gives every light its own colour. `palette` is a list of hexes, and `paint` is
`{ hue: Uint8Array, gain: Float32Array }` (an index into the palette and a brightness per light) or a function
`(field, timeSec) => that`, read at every draw. `level` scales every gain. The SETTLE site's header mark uses it for
its colour maps. The 2D renderer draws it; the WebGL renderer ignores `paint`.

`background` is the plate's colour (default `'#000'`). `background: 'transparent'` draws raw lights with no plate:
an unlit light and the gap between dots have alpha 0, and a lit dot keeps its colour, so the picture sits over
whatever is behind the canvas (the site's header logo uses it with `glow: 0` and `dim: 0`). Each light's alpha is
its brightest channel (`lightAlpha`), so the dots composite as the same light the black plate shows. A `'gl'`
settle reads this at mount and then asks for an alpha, premultiplied WebGL2 context; a 2D one also follows `set()`.
A CSS blend mode on the canvas cannot do this: the plate is drawn black, and a blend inside its own compositing
group runs against a transparent backdrop.

The ten neons (`NEONS`): yes rose, no indigo, lean amber, pull cyan, heat orange, calm lime, mem violet, held ice,
data mint, miss red.

## The pointer

The pointer is a sparkle. It switches on the light under it, with thin twinkling rays and thin strands shooting out
from its path. Everything it touches is held for a moment and fades, so the path leaves an echo and the field
settles back. A click sends pulses: thin rings expanding from the click. Rapid clicks build power (a click within a
second of the last adds a level, up to 8); a second's pause resets it. `poke: false` turns the pointer off.

**Gentle rings.** `rings: { count, reach, ms, gapMs, width, bright, sparks }` replaces the pulses with `count` rings
one light wide. They reach `reach` x the grid's shorter side in `ms` (time, not frames, so a 4 fps settle answers as
fast as a 24 fps one), `gapMs` apart, fading from `bright` to nothing. Each ring is a moving crest that lets its last
lights go, with `sparks` short strands; there is no combo power and no shake. `ringsFor(o, geom, fps, power)` is the
pure rule, the default pulses included.

**The answer to a page wave.** `radial: { gain, band, kick, floor }` scales this settle's answer to a page wave (the
crest's strength and width, the temperature kick). `floor` (default 0) is the least crest strength drawn for any
wave that reaches the settle, so a far, faint wave still shows on a thin window. `radialAnswer(w, radial)` is the
pure rule.

**The front.** `handle.front(x, y, r, width, level, rows)` flashes, draw-only, the lights a wave's front crosses:
origin and radius in the canvas's own CSS px, `width` lights thick, `level` 0..1, and only in the canvas rows
`rows = [top, bottom]` (CSS px), the part a window shows. The physics is untouched; the flash fades by `flashDecay`
a frame, and nothing is drawn while paused or hidden. `frontCells(cx, cy, R, width, w, h, row0, row1)` is the pure
rule: row by row it solves the circle for its two x, so a 10-row window costs a few cells a row. The site's footer
calls it on every bus frame a wave touches the strip.

## TRACES

`traces: true` (or `{ keep, every }`) captures the field's history, one bit per light per frame. `echoes: K` draws
the last K traces as pulsing echoes where the picture has been. The handle's `replay(k)` shows frame k back and
`live()` resumes. `createTraces(field)` does the same for your own loop.

## A page's own program

| option | what it does |
|---|---|
| `schedule: (frame) => ({ T, phase, index })` | the temperature, a phase name, and which item to settle into |
| `offset: 120` | start the schedule 120 frames in, so many settles on a page do not pulse in step |
| `beforeStep(field, info)` / `afterStep(field, info)` | run around every frame's sweeps; `info` is `{ frame, T, beta, phase, index }` |
| `field.clamp(lights, v)` / `field.release()` | SETTLE's exact `hold`: clamped lights keep their value through every sweep, drawn in ice |
| `field.setLeans(Float32Array)` | a real lean per light (a grey picture's leans) in place of `lean * target` |
| `soften: 'mean'` | a dot's brightness is its plain yes count since `field.resetSoft()` (SETTLE's `ask`), not a running average |
| `still: true` | a still picture: the lights start as the target, a new target is copied in, `stillT` (0.3) holds it; the pointer still plays on it |
| `rest: true` | at equilibrium (no change of temperature or target, no pointer trail) for `restAfter` (24) frames, stop until woken |
| `handle.show(bits)` | settle into this Int8Array now (with `still`, copy it in at once) |
| `handle.seek(frame)` / `handle.advance(n)` | jump the schedule / run n frames now and draw once |
| `stillFrames: n` | under reduced motion, run exactly n frames and draw them (for a schedule whose phases are its own names) |
| `field.flash(lights, a)` | from a hook: draw those lights white-hot (`flashColour`) at strength `a`, fading by `flashDecay` (0.72) a frame; no p-bit moves, so a spike shows on a wire that is already lit |
| `fit: true` | an exact `res: [w, h]` grid fills its canvas: drawn at the next whole pitch up and scaled down (`handle.geom` has the layout) |
| `onHandle(handle)` (React) | the live handle, for show, seek, advance and the field |

`stats().r` is the correlation between the lights and the target. `correlation(a, b)` and `shuffled(t, seed)` are
the measure and the control a page's tests use.

A `<Settle>` prop change hands `set()` only the options that changed (`changedOptions`), so a control panel can
move the dim, the lean or the pull without restarting a cycling picture.

## Bursts and the deck

`BURSTS` holds 25 disturbances of a live field: rings and wipes of flipped lights, shakes, the pointer's own held
rings, the exact hold of a band then its release, and flashes along a scene's wires. Each runs a few frames from a
`beforeStep` hook (`createBurstPlayer().start(design, burstEnv(F, { paths }))`, then `step(F)` once a frame); the
cold field then repairs the picture by itself. `createBurstDeck(seed).next()` deals them like a deck of cards: all
25 before any repeats, then a fresh shuffle whose first design is never the last one dealt. The site's footer plays
one on every page change.

**THE DECK RULE** (`src/deck.js`, stated for the site in `sites/CLAUDE.md`): every SETTLE cycle deals like a deck
of cards. `createBag(items, opts)` deals each item once a round in a random order, reshuffles when the round is
empty, and never opens a round on the card the last round closed on. `opts.seed` makes the order exact for a test;
with no seed and no `opts.random` it uses `Math.random`. `opts.weights` puts an item into the deck that many times;
`opts.first` deals one item first in the first round; `opts.after` names a card treated as already dealt. The deck
has `next()`, `peek()`, `putBack(item)`, `reset()` and the counters `drawn`, `size`, `left`, `last`, `round`.
`indexDeck(n)` is a deck over 0 .. n-1, `bagSequence(items, n)` the first n deals as a loop-safe array, and
`freshSeed()` a seed for a new order every visit.

```js
import { createBag } from 'settle-see';
const deck = createBag(['ising', 'boltzmann', 'hopfield'], { seed: 7 });
deck.next(); deck.next(); deck.next(); // all three, then a fresh shuffle
```

This file is the one home of the deck. settle-hear keeps a byte-identical copy (it imports nothing from settle-see),
and its tests fail when the copies differ. The SETTLE site re-exports it from `src/bag.js`.

## Resolution

`res: 384` is a density: about 384 lights across, rows following the canvas, whole-pixel dots filling the canvas
edge to edge. `res: [64, 32]` is an exact grid, centred. The renderer writes one pixel per light and lets the GPU
scale, cut into dots and bloom it, so a 400 x 230 field (92 thousand lights) draws in a few milliseconds.

## Small films (film.js)

A settle can play a short film as well as hold a still target. An item in `items` may be a film:

```js
<Settle items={['SETTLE', { film: '/hero-films/horse.json', note: 'a horse at the gallop', T: 0.6 }]} />
```

- **The format is two files**: `<name>.json` (`format: 'settle-film/1'`, `name`, `note`, `fps`, `frames`, `width`,
  `height`, `bin`, `source`) and `<name>.bin`, the frames' packed bits one after another. It is the same packed
  layout TRACES records the field in, so a trace replays as a film (`tracesToFilm`) and a film's frames load into a
  trace ring to be drawn as echoes (`filmToTraces`).
- **Lazy**: a film is fetched only when it is the current item or the next one, once per URL.
- **TRUE TIME** (`truetime.js`): the film keeps its own pace on the wall clock, one frame every `1000 / fps` ms (the
  film JSON's `fps`; the site's film tool writes 2, a 500 ms grid). The field settles toward the frame it shows.
  When its agreement with that frame reaches `threshold` (0.8 by default), it jumps to whatever frame the film is at
  then, so a slow machine skips frames and a fast one holds each settled frame until the film moves on. Agreement is
  counted on the lights the jump changed (`changedLights`, `agreementOn`), never the whole grid, whose unchanged
  background would pass 0.8 at once. `loop: false` holds the last frame; `now` replaces the clock in tests.
- **The tween**: `tween: 'ramp'` (default) slides each light's lean from the frame it left to the new one over the
  first quarter period after a jump (`rampMs` to change it); `tween: 'snap'` switches the target whole.
- **Under reduced motion** a film shows one still frame (`still`, default the middle one).
- `T` holds a fixed temperature while the film plays (a cycling schedule would otherwise heat it mid-film).

The SETTLE site's `tools/make_hero_film.mjs` makes films from a video, a folder of frames, or code.

## Live items (live.js)

An item can be a function of the moment: `{ live: (w, h, t) => bits, periodMs: 125, threshold: 0.8, T, tween }`.
It runs on TRUE TIME exactly like a film whose frames are made on demand. The source is sampled on a fixed grid
(125 ms by default), the field settles toward the sample it holds, and once it agrees with that sample on the
lights the sample changed (0.8 by default) it takes the sample of that instant. The `ramp` tween slides the leans
from the old sample to the new one. A function that throws or answers the wrong size keeps the last target, never
an empty one. `stats().live` is `{ sample, shown, behind, periodMs }`. settle-hear's `spectrumTarget(style)` makes a
live source from its spectrum. The SETTLE site's hero visualisers (`src/visualisers.js`) are live items.

## The 40 Hz light (fortyhz.js, gamma.js)

The 40 Hz light is a page-wide flicker a person switches on, behind a warning. It is off by default everywhere,
refused under `prefers-reduced-motion`, and turned off by Escape and by every off button. The SETTLE site calls it
the 40 Hz light (`LIGHT_NAME` in the site's `heroControls.js`); its old name was HOT GAMMA RED. The hero's mode that
pairs the light with the flute sound takes its name from settle-hear's `FLUTE_MODE_NAME`.

**One mode, one clock.** `fortyHz()` is the page's one gate (`createFortyHz(opts)` builds one with injected parts
for tests). Every `settle()` registers its canvas with it (opt out with `fortyHz: false`), and a page registers a
picture it draws itself with `useFortyHzLight(ref, name)`. On each flip the gate writes `data-fortyhz` on `<html>`
(`'lit'` or `'dark'`), and one stylesheet (`FORTY_HZ_CSS`) takes every `[data-settle-light]` element to opacity 0
while the root reads dark, so every drawing changes on the same frame. The mode is kept for a reload in the same tab
(`sessionStorage`) and never starts on a fresh visit. React's `useFortyHz()` gives `{ on, info, lights, set, toggle }`.

**The display's rate is measured** (`measureRefresh`): the 20th-percentile `requestAnimationFrame` interval over
about a second, snapped to a standard rate within 2% (`snapRefresh`: 59.94 reads as 60), and measured again whenever
the tab becomes visible. A low percentile reads the display's own period even on a page busy enough to drop frames.

**THE RATE RULE** (`pickFlashRate`, the default `slow: 'nearest'`): true 40 Hz on a display of 100 frames a second
and up (120, 144, 165, 240). Below that it shows the nearest 50% square wave the display draws exactly
(`nearestRate`: 45 Hz at 90, 37.5 at 75, 36 at 72, 30 at 60), and `info.nearest`, `info.hz` and `info.asked` say so.
`slow: 'refuse'` refuses a slow display instead.

**Each frame is decided on the master phase** (`createFlashClock`): the display's vsync phase is learned from the
frames, each frame is placed in its display slot, and its state is the ideal wave over the interval it will be on
screen, counted from the master origin. A carry lets a period that is not a whole number of frames (three at
120 Hz, 3.6 at 144) still show the asked duty on average. A skipped slot (a dropped frame, a stall) clears the
carry: the missed flashes are dropped, never made up, and a cycle never flashes twice. The gate reports what was
drawn: `info.shownHz` (bright flips per second), `info.darkShare` (the share of drawn time spent dark) and
`info.lockMs` (the worst distance in the last second from an onset frame to its master cycle start).

`createGamma(el, { hz: 40, duty: 0.5, depth, onInfo, onFlash, apply })` is the same flicker on one element's
opacity, between 1 and `1 - depth` (default depth 0.55; `depth: 1` is a full on/off wave, fully dark for half of
every 25 ms period). `apply(bright)` replaces the opacity write.

## THE MASTER BEAT (masterbeat.js)

One clock and one grid for everything on a page that keeps time. The origin is the page's own time origin
(`performance.now()` = 0); the grid is a pure function of that clock.

| unit | period | in flash cycles |
|---|---|---|
| `'tick'` / `'truetime'` | 500 ms (a TRUE TIME frame) | 20 |
| `'beat'` | 500 ms (120 bpm) | 20 |
| `'bar'` | 2 s (4 beats) | 80 |
| `'flash'` | 25 ms (40 Hz) | 1 |

So every bar line is a tick and every tick is a 40 Hz flash onset. `masterBeat()` is the page's one master beat,
built on first use and published on `globalThis.__settleMasterBeat` (settle-hear reads the numbers there and never
imports settle-see). `.at(t)` gives every phase, `.floor(t, unit)` and `.next(t, unit)` the grid lines,
`.phase(t, hz)` the phase of any frequency counted from the origin (the binaural beat's), and `.on(unit, fn)` a
subscriber that hears each line once, from the shared ticker's frames. `skipped` counts lines that passed while
nothing ran (a hidden tab, nobody there, PAUSE ALL). It never catches up in a burst and never drifts: line k is
always at `origin + k * period`. Reduced motion does not touch it; it is time, not motion. `createMasterBeat({ now,
origin })` builds one for a test.

What reads it: `createTrueTime` and `createMorph` (with no clock injected, a movie starts on the grid line at or
before now, so its frames turn on master ticks), the film and live items of `settle()`,
`makeSchedule({ kind: 'cycle', on: 'master', fps })` (the cycle runs on the master clock and its length is rounded to
whole ticks, so an item changes on a tick on every machine), the 40 Hz light, and the global settle's ripple bus.
`settle(canvas, { beat: true })` (and `<Settle beat>`) draws its frames on the master grid of `1000 / fps`: an 8 fps
settle steps once per 125 ms line, five 40 Hz cycles (the ticker's `addTick(fn, fps, label, { beat })`). An injected
`now` keeps its own clock, so tests and replays are untouched.

## Speed, halting and true time

**The halt rule.** Every settle on a page shares one `requestAnimationFrame` loop (`ticker.js`). It halts when the
tab is hidden, and after 5 minutes (`IDLE_MS`) with no pointer move, pointer down, key, wheel, scroll or touch in the
tab; any of those, or the tab becoming visible, resumes it at once. While halted the loop is not scheduled at all.
`tickerState()`, `onTickerState(fn)`, `setIdleTimeout(ms)` and `wakeTicker()` expose it, a window event
`settle:ticker` announces each change, and React's `useTickerState()` gives `{ state, awayMs }` for a quiet "paused
while you were away" note. settle-hear listens for the same event and suspends its AudioContext, so the sound halts
with the pictures. There is exactly one implementation; a page adds no idle timer of its own.

**Off screen.** Each settle watches its canvas with an IntersectionObserver and does no frame work while it is off
screen. When one callback carries several entries for the canvas, the LAST decides (`seenNow`): a
canvas inside a panel that opens goes from clipped to shown inside one frame, and reading the first entry left it
paused as hidden for good.

**Meters.** The ticker times every call (`tickerStats()`, `globalThis.__settleTicker`), and every settle times its
physics and its drawing (`handle.perf`, `settlePerfs()`, `globalThis.__settlePerfs`). `opts.perfLabel` names it.

**The WebGL2 renderer.** `opts.renderer: 'gl'` draws the same neon dots in one fragment-shader pass (`glrender.js`):
each pixel reads its light with `texelFetch`, cuts the dot and the hot core analytically, and adds the bloom from
mip levels 1 and 2 of the same texture with the 2D renderer's weights. The 2D renderer composites a full-size plate
about nine times a frame. The colours are still filled on the CPU by `fillCells()` (shared, tested byte-identical
between its fast and full loops). The choice is made once at mount and falls back to 2D without WebGL2. A browser
allows only a few WebGL contexts per page, so keep it for the large pictures.

**Page quality.** `setQuality({ resScale, fpsScale })`, applied once at load (the site's perf ladder does it), scales
the numeric `res` and the `fps` of every settle mounted afterwards. An exact `[w, h]` grid is never scaled, and a
settle with `quality: false` keeps what it is given.

**TRUE TIME RENDER** (`truetime.js`). For a film, or anything movie-like, two things run at once.
- *In sound-and-picture terms:* the movie behind runs at its true pace, one frame every 500 ms, like a soundtrack
  that never waits. The field in front settles toward the frame the movie holds now, as fast as the machine allows.
  When the field agrees with that frame well enough (80% by default) the frame counts as shown, and the field turns
  to whatever frame the movie is at in that instant. A fast machine shows every frame and waits on it; a slow
  machine skips frames. On both, the picture keeps the movie's time.
- *In machine-learning terms:* the movie is a data stream on a fixed time grid; the field is an anytime inference
  procedure, read out when its estimate passes a quality threshold and then re-targeted to the newest observation
  rather than the backlog. Its lag is bounded by one settling time and never accumulates.

`createTrueTime({ frames, periodMs: 500, threshold: 0.8, loop: true, now, start })` gives `.frameAt(t)`, `.showing`,
`.update(agree, t)`, `.history` (every snapshot, so `replayFrames(history)` replays a run), `.on(fn)`, `.restart(t)`
and `.set({ threshold })`. In `settle()`, `opts.trueTime = { periodMs, threshold, loop }` makes `items` the frames;
each frame the field's overlap with its target (the field's `overlap()`) is the agreement, and `stats.trueTime`
reports `{ showing, movie, behind }`. A site's quality ladder may change the threshold; it never changes the pace. A
film item runs its own true-time clock at the film's fps, with the agreement counted on the lights each jump changed
(see Small films).

**MORPH: a new target by settling** (`morph.js`). `handle.morph({ items })` swaps the item specs in place (same index,
same schedule frame) and plays a short TRUE TIME movie from the picture that is lit to the new one: four frames
at 500 ms, frame 0 the old picture, the last the new one, each light switching at its own seeded moment, sooner on
the left. The field settles toward the frame the clock holds and moves on when it agrees with it on 80% of the
lights that frame changed. A hot field that cannot agree is let go two periods after the movie ends, on the new
picture. Under reduced motion, or for a film item, it is a cut. In React, `<Settle morph ...>` sends a change of
`items`, `word`, `shape` or `target` through `morph()` instead of `set()`. The site uses it when the language changes.
THE OWED LIGHTS: the lights a morph changes are owed, and when the movie ends every light that still disagrees with
the new target joins them; a settle with `rest` does not rest until each owed light agrees, or `OWED_MAX_FRAMES` (120)
frames pass. The movie starts from what is lit rather than from the target the field was heading for, so a morph
begun while another was still under way watches the lights lit from the old words too, and the rest rule can no longer
freeze them lit (`morphowed.test.mjs`). `stats().owed` counts the owed lights; `handle.resting` says whether the rest
rule holds the field.
The word font (`WORD_FONT`) lists Hiragino Sans, Noto Sans JP and Yu Gothic after the Latin faces, so a Japanese
word is drawn in a Japanese face.

**The GPU sweep** (`gpufield.js`, an exploration, not used by `settle()`): the checkerboard Gibbs sweep as two
fragment passes into ping-pong integer textures, with a PCG hash for the draws. It agrees with the CPU sweep in
distribution (mean magnetisation and correlation within 0.0009 on three cases; the site's
`tools/perf/gpusweep_check.py`). The CPU sweep is already a few percent of one core for the site's largest
pictures, so it stays the default.

**Benchmark:** `node bench/sweep.bench.mjs [w h frames]` times sweep plus soft read per light, the earlier field
(`bench/field_v0.js`) against the current one, in CPU time. The sweep keeps its random words in locals and compares
the raw u32 draw with integer thresholds, so it draws exactly the same sequence as before at 1.2 to 1.4 times the
speed; `stats()` is one row-by-row pass, ten times faster.

## The global settle (global.js)

Every settle on a page sits in one registry, and one bus carries ripples between them. `settle()` registers its
canvas when it mounts and leaves when it is destroyed, so every `<Settle>` takes part with no page code.

```js
import { ripple, onRipple, globalStats } from 'settle-see';

// a page-wide ripple from the logo: a ring that passes through every settle on the page
ripple({ x: ev.pageX, y: ev.pageY, strength: 1, kind: 'logo', scope: 'page', source: 'logo', sound: false });
onRipple((d) => console.log(d.kind, d.scope));   // every ripple; also the window event 'settle:ripple'
globalStats();   // { settles, ripples, frames, scheduled, sent }
```

- **A page ripple** (`scope: 'page'`, the default) is a ring growing from (x, y), in page pixels, at 900 px/s
  (`GLOBAL_DEFAULTS.speed`). Its strength at radius r is `strength * exp(-r / 1400)`. Each settle the ring crosses
  leans the lights on the wavefront ON (the crest) with the lights just behind it OFF (the trough), and its
  temperature is raised by `1 + 0.35 * strength` when the ring first touches it (the kick fades by 0.86 a frame,
  `GLOBAL_KICK_DECAY`). The physics then takes the picture back to its own target. Settles are reached nearest
  first.
- **A local ripple** (`scope: 'local'`) travels nowhere. A settle with `audio` sends one on every click, or on Enter
  or Space when its canvas has focus (it gets `tabIndex` 0); its own rings stay inside it, and settle-hear's click
  noises play one sound for every ripple with `sound: true`.
- **Options:** `global: false` keeps a settle out of the registry; `globalId` names it, so a page ripple whose
  `source` is that name skips it (the logo draws its own bloom); `audio` marks a settle with sound.
- **Cost:** nothing is scheduled while no ripple travels (`globalStats().frames` holds still). Rectangles are read
  from the layout only when a ripple starts or after a scroll or resize. A settle that is paused or off screen
  ignores the wave.
- **Reduced motion:** a page ripple is one soft pulse per settle, nearest first: the lights near the ripple's
  nearest point glow faintly once, the picture is drawn again, and the glow is gone after 450 ms. No ring.
- **PAUSE ALL, a hidden tab, an away reader:** a new ripple is refused (`ripple()` returns null) and live ones are
  dropped.
- `createGlobalSettle({ now, frame, state, reduced, win })` builds a private registry with an injected clock and
  frame loop, for tests.

## THE RADIAL PULSE BUS (radialpulse.js)

One bus for every radial event on the page, and one consumer interface every drawing and every sound anchor
implements. The global settle above is a face over it: `ripple({ scope: 'page' })` is `emit()`, every `settle()`
canvas is one consumer (the same lean, kick and reduced-motion pulse), and anything else on the page joins the same
bus directly.

```js
import { emitPulse, registerRadial, onPulse, clickPulse, radialStats } from 'settle-see';
import { useRadialPulse } from 'settle-see/react';

emitPulse({ x, y, strength: 0.6, kind: 'drop', source: 'hero' });        // page px; space: 'client' adds the scroll
clickPulse({ x, y, strength, kind: 'click', source: 'hero', sound: true }); // a click in a settle with sound: the local
                                                                          // ripple (its noise) and a page pulse
const off = registerRadial({
  id: 'thing',                // a wave whose source equals this id skips you
  el: canvas,                 // or rect: () => ({ left, top, width, height }) in page px, or rect: 'viewport'
  arrive(w) {}, respond(w) {}, leave(w) {}, still(w) {},
});
useRadialPulse(ref, { arrive, respond, leave, still }, { id, rect });    // React: the same, while mounted
onPulse((d) => {});                                                       // every pulse; also the window event 'settle:pulse'
```

- **The wave** is a ring from (x, y) at 900 px/s (`RADIAL_DEFAULTS.speed`). For each consumer the bus computes the
  delay (the front touches it after `(d - band) / speed`, d its distance from the origin), the gradient
  (`w.a = strength * exp(-d / 1400)`), the direction (`w.dir`, a unit vector from the origin to its centre) and the
  phase of the crossing (`w.phase`, 0 at arrival, 1 once the 56 px band has cleared its far corner; `w.passMs` is
  how long that takes). `arrive` runs once, nearest consumers first; `respond` every frame while the band crosses;
  `leave` once after it. `w.x, w.y` are the origin in the consumer's own CSS pixels.
- **Cost:** one `requestAnimationFrame` serves every consumer, and nothing is scheduled while no wave lives
  (`radialStats().frames` holds still). A consumer more than 160 px outside the viewport is skipped entirely.
  Rectangles are read from the layout only when a wave starts or after a scroll or resize. At most 8 waves live at
  once (`RADIAL_DEFAULTS.maxWaves`).
- **The 40 Hz lights answer of their own accord:** the page bus attaches to `fortyHz()`, and every drawing
  registered there (a film stage, a player, a page's own canvas) gets a brightness animation as the band crosses
  it, unless something already registered its element or an element inside it (a wrap round a settle's canvas).
- **Reduced motion:** no wave travels; every consumer on screen gets one `still(w)` (the same shape, `w.reduced`
  true, `w.ms` 450), nearest first. **PAUSE ALL, a hidden tab, an away reader:** `emit()` answers null and live
  waves are dropped.
- **The scene settle** takes a wave through `pulse(w)` (in canvas pixels): the lights brighten along the front, the
  shapes are pushed outward (`pulsePrims`), the temperature kicks; `pulseEnd(id)` lets it go. Still mode answers
  false, so the low CPU mode keeps its promise.
- **settle-hear never imports settle-see**, so a page registers its sound anchors here and hands each `arrive` to
  settle-hear's `soundPulse(w, { anchors })`, which brightens, swells and pans every playing channel at that anchor.
- `createRadialPulse({ now, frame, state, reduced, win, viewport })` builds a private bus for tests.

## THE RADIAL EFFECTS, THE WEATHER and THE EDGE CRACKLE (radialeffects.js, weather.js, crackle.js)

**THE RADIAL EFFECTS** are one named family of wave styles on THE RADIAL PULSE BUS. Every member is the same
physics: a front travelling out from a point, its strength `strength * exp(-r / fade)`. Under the front the settle's
own hand (`field.hold`) leans the lights on (a crest) or off (a trough) for that frame only, and on arrival the
temperature takes a kick. There is no overlay and no colour: the picture moves because its p-bits do.

```
member   from    speed px/s  band px  fade px  what the crest is                         kick  cap
click    user    900         56       1400     a crest, a dark trough 0.4 band behind     0.35  1
shimmer  sound   1800        28       700      a thin fast ring, no trough, no heat       0     0.5
double   sound   650         64       1000     two soft rings 0.7 band apart (2nd 0.6)    0.08  0.55
spokes   sound   1200        48       900      the crest only along nine narrow spokes    0.05  0.6
```

`emitPulse({ x, y, strength, effect, only, turn })`: `effect` names the member. A plain emit is a `click` with the
bus's own numbers, and `effectHolds('click', ...)` reproduces that crest and trough exactly (a test holds them
equal). The bus clamps the strength to the member's cap, times and fades the wave by its numbers, and carries
`effect` and `turn` to every consumer. `only: id` keeps a wave to one consumer: the hero's pops reach the hero's
canvas alone, never the page and never the hero's sound anchor. Past `maxWaves` the oldest machine wave (a sound pop
or a key member) is dropped first, so they never push out a visitor's click. Under reduced motion a sound member
sends nothing (a click keeps its one still answer). Pure helpers: `ringCells`, `onSpoke`,
`effectHolds(effect, { x, y, R, band, a, turn }, w, h, hold)`.

**THE WEATHER** is a settle option: `weather(info) -> { heat, lean, pull, rate, soften, streak, crackle }`, called
once a frame before `beforeStep` (on `<Settle>` it is read through a ref, like `beforeStep`). `heat` multiplies the
frame's temperature after the schedule, the film and any kick. `lean` and `pull` multiply the settle's own lean and
pull into the field, reset every frame (so a `beforeStep` that nudges `F.pull` starts from the true base). `rate`
multiplies the sweeps a frame, a fraction carried over. `soften` replaces the soft read's factor (a slower running
average: a filmic smear). `streak` draws a lens-flare band of holds across the field for that frame
(`{ x, y, tilt, width, reach, strength, shimmer }`, through `field.holdIndex`). `weatherOf` clamps every knob to
`WEATHER_LIMITS`, and a null answer gives the settle back exactly. The site's hero drives it from its sound
(`sites/CLAUDE.md`, THE SOUND AND THE PICTURE).

**THE EDGE CRACKLE** is the weather's seventh knob: `crackle: { strength, rate, outer, spit }`. Each frame every
light on the target's inner rim (a lit light with an unlit four-neighbour) flares with chance `rate`, every light of
the outer rim (an unlit light touching a lit one) with chance `rate x outer`, and every light one step further out
with chance `rate x spit` at 0.6 of the strength, through `field.flash`: the renderer's flash colour, the lit neon
most of the way to white, with its hot core lit. A flare is draw-only, so the physics, the agreement and the body
of the picture are untouched (a settle with and without it keeps identical states frame for frame), and it uses its
own generator, never the physics' one. `crackleOf` bounds it (`CRACKLE_LIMITS`: strength 0.85, rate 0.2, outer 0.6,
spit 0.5). The rim is found again when the target changes or every six frames. The site's hero uses it on a quarter
of its word slots.

### THE KEY SUIT: fifty gentle members

`KEY_EFFECTS` (50 members, `from: 'keys'`) is a second suit of the family. A step of the site's hero (an arrow key,
or a burst of clicks) deals the next one from a 50-card deck (THE DECK RULE) and sends it with `only: 'hero'` and
`source: 'keys'`, so it ripples the hero alone and the site's click counter does not hear it. `effectOf` finds a key
member by name, so the bus times, fades and caps it like any other; `EFFECT_KEYS` still lists only the four.

The suit adds knobs to `effectHolds`, each neutral at 0, so `click` and the three sound members draw exactly what
they drew before:

```
knob             what it does
rings, gap       n crests gap x band apart, the k-th lit at 0.6^k (the double's rule, generalised)
inward           the front runs from the far corner in to the origin (radius Rmax - R): a collapse
standing         the crests sit still at (k + 1) x gap x band and swell and fade as the wave's time passes
spokes, twist    the crest only along n spokes; twist turns a spoke by twist radians per band of radius: a spiral
petals, depth    the strength rises and falls round the ring n times (depth 0..1): a flower
wavy, wavyAmp    the ring's radius rolls wavy times round the circle by wavyAmp x band: a crown
origin           where the page starts it: 'centre', 'side' (the edge the arrow points to) or 'far' (1.5 widths
                 past that edge, so the front crosses the picture nearly straight: a sweep)
```

**GENTLE** (`GENTLE`, `isGentle`): every key member has a cap of at most 0.45 (a click's is 1), a heat kick of at most
0.12 (a click's 0.35), a crest at most 0.4 of the band, a trough (if any) at most 0.5 of the crest (a click's trough
is 0.6), and `still: true`, so under reduced motion it gives the one still brightness answer a click gives.

The fifty, by kind (key, then what it is):

```
rings      ring (one soft ring) · halo (wide, slow) · thread (thin, quick) · ripple (a shallow trough behind)
           · hush (the faintest wide ring) · ember (slow, warm, a little heat)
crests     echo (two rings) · lub (two close rings, a heartbeat) · triplet (three, each fainter)
           · rain (three thin rings from the side)
blooms     bloom (slow, wide) · dawn (a slow bloom rising from the side) · drift (a soft ring in from the edge)
sweeps     sweep (a straight thin front) · tide (two straight fronts) · shore (a wavy front) · aurora (a slow wavy
           curtain) · comet (one wedge from the side) · fan (seven rays from the side)
collapses  collapse (a ring closing in) · gather (two rings closing in) · inhale (a wide bloom drawing in)
           · breath (the faintest ring drawing in) · iris (a six-petal ring closing in)
spokes     spokes6 (six spokes) · star (twelve fine rays) · wheel (four broad spokes) · compass (four fine spokes on
           two rings)
spirals    spiral (three arms) · swirl (five arms) · vortex (eight tight arms) · galaxy (two wide wound arms)
           · seashell (one wide arm wound tight) · eddy (three arms closing in) · whirlpool (six arms closing in)
petals     clover (three) · petals (four) · lotus (six) · daisy (eight) · rose (two five-petal rings)
           · lantern (two four-petal rings, slow)
wavy       wobble (five rolls) · jelly (three rolls, slow) · crown (nine points) · lace (twelve small waves, thin)
           · snowflake (six spokes on a wavy ring)
standing   standing (three still rings swell and fade) · pulse (two) · chime (four thin) · gong (three, petalled)
```

The bus detail also carries `from` (the member's family: `user`, `sound` or `keys`) and `drag` (the drag box's id
when a drop sent it; `clickPulse` passes it on), so a page can tell a person's waves from the machine's and count a
drag once.

## The drag box (dragbox.js)

`drag: true` makes a settle's press a click or a drag. The page draws the rectangle; settle-see decides the gesture
and lights the four children.

```js
settle(canvas, { audio: true, globalId: 'hero', drag: true, onDrag: (e) => draw(e) });
// e: { phase: 'armed', x, y } | { phase: 'move', box } | { phase: 'drop', id, box, fadeMs, still, marks } | { phase: 'cancel' }
```

- **The click** is the settle's usual click (rings, a burst, power, a local ripple with sound), fired on release at
  the press point when the pointer moved less than `DRAG.threshold` (6 CSS px). Without `drag` the press is the
  click.
- **A drag** (a mouse or pen moved 6 px) reports a rectangle in CSS px inside the canvas on every move. A mouse press
  calls `preventDefault()` (no text selection) and captures the pointer, so the drag keeps going over anything on
  top of the canvas.
- **Touch:** a finger that moves more than `DRAG.touchSlop` (10 px) before `DRAG.longPressMs` (300 ms) is a scroll,
  and the page scrolls. Held still for 300 ms it is armed (`phase: 'armed'`); from then `touchmove` and `contextmenu`
  are prevented, so the finger draws and the phone's own long-press menu waits. A tap is a click.
- **The drop** gives `fadeMs`, `lifeMs` and `insideMs` (`dragTiming`: a life of 5.6 s, +-10% per drag; the box fades
  over the inside 20%, about 1.1 s), and four children born at the box's quarter centres. Each child is a star that
  sends a ring every 8 frames. INSIDE (the first 20%) they push apart and swirl round the box's centre, bounce off
  its walls, and their rings stay in the box. ESCAPED (the other 80%) each splits into two of half the mass
  (`splitChildren`: 4 become 8) and roams the whole picture on its own gently curving path, bouncing off its edges,
  with no pull between them (`stepEscape`). The last quarter of the life fades their rings out.
- **The interference:** every drag ring is a crest and a trough half a wavelength behind it, added into one scratch
  sum over the grid (`createInterference`, each light once per circle). A light is held on or off by the sum's sign
  and strength, so where rings cross they brighten or cancel. The cost is the circles' length, at most
  `DRAG.maxRings` (128) rings.
- **The sound:** four pulses with sound (kind `'drop'`) go out 90 ms apart through `dragPulse()`, so settle-hear's
  click lock plays the locked sound four times. Each is also a page pulse the whole page answers.
- **Many boxes:** drags come one after another with no wait. At most `DRAG.maxBoxes` (10) groups live, and an
  eleventh drops the oldest, never the new one. They interact three ways. THE ONE ROOM: boxes still in their inside
  phase that overlap (`rooms()`, chains count) are one room; their twinkles swirl round the room's centre, wander
  through the overlap into the neighbour, are reflected only where they would leave the union, and push each other
  as one group does, and each ring is clipped to the box its twinkle stands in. THE NUDGE: a drop kicks every
  twinkle already alive away from the new box's centre (`nudgeKids`, `DRAG.nudge` 0.9 lights a frame at the centre,
  falling as `exp(-d / reach)`, reach a quarter of the shorter side). THE CROSS PULL: escaped twinkles of different
  boxes bend toward each other (`stepEscape`'s `others`, at most `DRAG.crossPull` of the speed a frame), and every
  ring of every box sums in the one interference scratch. Past four boxes each twinkle rings less often (every
  `pulseEvery x boxes / 4` frames), so ten boxes cost about what four did.
- **THE NOISE GATE** (`createNoiseGate`): a burst of drags sounds at most `DRAG.noiseBurst` (6) DROPS, then
  `DRAG.noisePerSecond` (3) drops a second. A drop is ONE token: the gate is asked once at the
  release and its answer rides all four births, which carry `drag` (the drop's id) and `part` (0 to 3) in the ripple
  detail, so a hearing can play the drop as one event. A drop over the limit still pulses the page, with
  `sound: false`. A birth the bus refuses is told on the window event `settle:dragsound` (`tellDropSound`). While a
  mouse or pen is pressed the window also hears the release, so a release outside the canvas completes the box.
- **Reduced motion, a paused or hidden picture and PAUSE ALL** drop still: `still: true`, the four `marks` for the
  page to draw, no children.

## THE SCENE SETTLE (scenefield.js)

A vector scene settled in full colour, built for page backgrounds. A scene is a function `state -> shapes`, where
`state = { W, H, t, pointer }` (the canvas in CSS pixels, the master beat's time, the pointer or null) and a shape is
`{ k: 'disc', x, y, r }`, `{ k: 'ring', x, y, r, width, dash }` or `{ k: 'line', x1, y1, x2, y2, width, hue2 }`, each
with `hue` (an index into the palette) and `gain` (0 to 1).

```js
import { createSceneSettle, neonRange } from 'settle-see';
const palette = neonRange(['#c94dff'], 24).map((x) => x.hex);
const h = createSceneSettle(canvas, { scene: (st) => [{ k: 'disc', x: st.W / 2, y: st.H / 2, r: 40, hue: 3 }], palette });
h.pointer({ x, y });   // the scene redraws around it and the field settles into the new shapes
h.setMode('still');    // the low CPU mode: settled once out of sight, drawn once, no ticker entry
```

- `rasterScene(shapes, { w, h, cell })` is plain JavaScript (no canvas): one light per cell, lit where a shape covers
  it at gain 0.2 or more, with the hue and gain of the brightest shape there; a line is at least 0.9 of a light wide.
  `opts.ground(x, y)` colours the empty cells faintly, so a hot field's noise shows everywhere and settles away.
- The colour is the renderer's `'map'` mode: each light its palette colour times its gain
  (`extra.paint = { hue, gain }`), and `opts.level` caps the picture. `neonRange(extra, size)` builds the palette:
  the ten neons plus the caller's extra hexes, in hue order, with the widest hue gaps filled by in-between neons
  (mean saturation and value), near-white last.
- Temperature: hot 2.6 for 350 ms, then geometric cooling to 0.42 over 1.8 s. Each new target kicks it to 0.95,
  decaying by 0.86 a frame. Once cold, unkicked and unchanged for 30 frames, the frame function returns at once.
- `platePitch` draws the plate at fewer pixels a light and scales it up: a 1440 x 900 background at 7 px a light
  composites a 3 px plate (measured 2.5 to 3 ms a frame against 11 to 12 at 7 px, headless Chromium).
- **The scene's own pace.** A scene function may carry `cadence(t)` (how often, in ms, the engine re-reads it at
  master time `t`; default `opts.sceneMs`, 500) and `kickT(t)` (the temperature a changed target re-settles at;
  default `opts.kickT`, 0.95). The site's 3D background asks for every frame and 0.62 while its camera swoops, and
  250 ms and 0.47 while it drifts, so a fast move smears through the lights and a slow drift shimmers. A scene
  without them behaves as before.
- **A line walks its span.** `rasterScene` visits, row by row for a steep line and column by column for a flat one,
  only the lights within reach of the infinite line, a superset of the lights the segment covers. It lights exactly
  what a bounding-box walk lights (`tests/scenefield.test.mjs` compares the two on 600 random lines). Measured in
  node on an M5 (the minimum of 15): 1,404 short lines of a 3D scene at 288 x 180 lights rasterise in 1.0 ms
  against 4.7 ms for the box walk.
- **A thin line.** A line with `thin: true` is exactly one light wide: one light per step along its longer axis,
  8-connected, clipped to the grid before it is walked (so a line running far off screen costs only the grid), at
  the line's own gain with no edge falloff; a `hue2` still walks the palette along it. The site's 3D background draws
  every line this way.
- The canvas registers with the 40 Hz light's gate (`fortyHz().register`, by `opts.label`); `fortyHz: false` opts
  out.
- The bloom mips are drawn with `copy`: with a clear plate, drawing them over the last frame piled faint pixels
  into a full-colour wash (`tests/scenefield.test.mjs` guards it).

## Tests

`npm test` runs 298 tests in 29 files under `tests/` with `node --test`, using stand-in canvases (node has none).
Each file opens with a comment saying what it proves. In brief:

| file | what it checks |
|---|---|
| `field.test.mjs` | the checkerboard sweep against the exact p-bit rate and exact two-light enumeration; a cold settle against a no-lean control; clamping and per-light leans |
| `mount.test.mjs` | `settle()` on a stand-in canvas: still pictures, `show()`, resting, the step hooks, a programmed schedule, `offset`, reduced motion, `fit`, `soften: 'mean'`, the transparent plate |
| `shapes.test.mjs`, `brain.test.mjs`, `eightball.test.mjs` | every credits shape settles into itself at every size the site draws it (correlation above 0.85) while a shuffled-target control stays below 0.25; each brain view settles and its control does not; the eight ball and its word wrap |
| `creditlazy.test.mjs` | the credits family loads on demand: the index reaches its names and never its drawings, a pending shape is described by its note and refused by `toTarget` by name, `settle()` starts unlit and takes the drawing when it arrives, and every loaded drawing matches the eager module |
| `render.test.mjs`, `seennow.test.mjs` | the colour fill: the fast and full loops give the same bytes; a settle reads the last entry of its visibility batch, so a canvas shown inside one frame runs |
| `ticker.test.mjs`, `truetime.test.mjs`, `morph.test.mjs`, `morphowed.test.mjs`, `film.test.mjs`, `live.test.mjs` | the halt rule; TRUE TIME on fast and slow fronts with a falling-behind control; the morph movie; THE OWED LIGHTS (a morph from the lit picture, no rest while a changed light disagrees); the film format and the TRACES round trip; live items |
| `gamma.test.mjs`, `fortyhz.test.mjs`, `masterbeat.test.mjs` | the 40 Hz wave and THE RATE RULE; the one page gate; the master grid, and the light on fake 60, 90, 120 and 144 Hz displays and a jittery 60, with negative controls |
| `global.test.mjs`, `radialpulse.test.mjs`, `radialeffects.test.mjs`, `keyeffects.test.mjs`, `gentlerings.test.mjs` | the registry and the ripple; the bus's delay, falloff, direction, order and costs; the effect family and THE WEATHER; the fifty key members; the gentle rings |
| `first.test.mjs` | `examples/first.mjs` prints exactly its recorded output, `examples/first.out`, with a seed control |
| `crackle.test.mjs`, `fortycrackle.test.mjs`, `bursts.test.mjs`, `deck.test.mjs`, `dragbox.test.mjs`, `scenefield.test.mjs` | the edge crackle leaves the physics untouched; the 40 Hz scanlines brighten only lit lights on lit phases and never move the physics; the 25 bursts and their deck; THE DECK RULE; the drag box; the scene settle |

One test in `global.test.mjs` ("a page ripple passing through a settle leans its lights on the wavefront and kicks
its temperature") drives the registry with `performance.now()` offsets, so it is timing-dependent: on 2026-10-05 it failed in two full
runs and in one of two runs of the file alone. It is a known flaky test, not a known bug.

## Where the SETTLE site uses it

The SETTLE site draws with settle-see on every page: the header logo, the footer's room and its bursts, and the
page backgrounds are all settles. Every use shares the one ticker, the one 40 Hz gate and the one radial pulse bus.
These pages lean on it most:

| page | what settle-see draws there |
|---|---|
| the home page | the hero, with the drag box, the weather and the TRACES echoes |
| `#/settlesee` | this package's own page: the showcase, the playground, every component and option |
| `#/what` | the coin field and the small live pictures, on the shared ticker |
| `#/who-you-are` | the three doors, each a scene settle (`createSceneSettle`) |
| `#/relax` | the cool-down class: a programmed schedule with `clamp` for HOLD, and its correlation control |
| `#/credits` | every credit, settled from the credits family with `fit` |
| `#/settle-tour` | the digits a settling machine learns |
| `#/sdmmemory` and `#/sdmexplore` | the memory pictures |
| `#/six-layer-feedback` | the cortex and cerebellum layers (`CORTEX_LAYERS`, `CEREBELLUM_LAYERS`) |
| `#/paper` | the top panel, settling into the words lime and coconut |
| `#/film` | the 40 Hz light on the film player |
| `#/puzzles` | the shared ticker's state, so a solver stops while the ticker is held |

> Index verified 2026-10-08 (this README is the folder's only doc; `examples/first.mjs` is its first program)
