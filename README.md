# settle-see

SETTLE's seeing library (its sibling settle-hear makes sound from the same stats; settle-see does not depend on
it). Every picture it draws is a grid of p-bits settling out of noise into a word or a
shape, lit in the SETTLE neon code. It has no dependencies; React components are in `settle-see/react`.

```js
import { settle } from 'settle-see';

settle(canvas, { shape: 'heart', neon: 'mem', color: 'single', res: 64 });
```

```jsx
import { Settle, SettleBadge, SettleWord, SettleReadout } from 'settle-see/react';

<Settle shape="purkinje" res={200} height={320} />
<Settle items={['SETTLE', 'heart', { svg: 'M10 90 L50 10 L90 90 Z' }]} neon="random" color="single" />
<SettleBadge shape="star" neon="calm" size={96} />
<SettleWord word="Kanerva" neon="mem" height={120} />
```

## Get it

```sh
git clone https://github.com/triplesparkle/settle-see
cd settle-see
npm test
```

Or add it to an app from its repository: `npm install github:triplesparkle/settle-see`. The repository is
private for now, so both need access until it is made public. It has no dependencies; React is an optional peer.

## What a settle is

Each light is a p-bit. It says yes with probability `(1 + tanh(beta I)) / 2`, where
`I = lean t + pull (sum of its four neighbours)`, `t` is the target (+1 lit, -1 dark) and `beta = 1 / T`. Each
frame runs one exact Gibbs sweep over the whole grid, in two checkerboard halves. The temperature follows a
schedule: hot, cooling, settled, reheating, next picture. The field lowers the energy
`E = -lean sum t_i s_i - pull sum over neighbours s_i s_j`.

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

Shapes come in three families (`shapeNames('physics')` and so on):

- physics: `purkinje landscape tanh spins boltzmann hopfield sdm hypercube`, and three painted without a canvas:
  `cortex6` (the cerebral cortex in six labelled layers), `cerebellum` (Purkinje fans, parallel fibres, granule
  cells) and `brainbands` (both, one band above the other). Each takes `{ view, eye }`: `'section'`, `'below'`
  (looking up from the white matter) or `'voyage'` (riding through the tissue at depth `eye`). `brainScene(w, h, spec)`
  returns the bits with the spike paths along the wires and the layer labels; `BRAIN_VIEWS` is the footer's cycle
- plain: `circle ring heart star spiral wave cross diamond moon eye`
- credits: Kanerva's memory, `hardLocations hammingBall counters vote criticalDistance tesseract` (the list `KANERVA`),
  then the characters of the people SETTLE rests on: `isingDomains tanhRule boltzmannBars metropolisHop restoredDisc
  annealValley hopfieldNet boltzmannMachine pbitCoin tapField tannerGraph softmaxRead markovBlanket noisyWell pbitChip
  openBook vinyl railsAerobics dots`

Add your own with `defineShape(name, (c, w, h, u) => { ... }, note)` (a canvas drawing) or
`defineBits(name, (w, h) => Int8Array, note)` (painted in plain JavaScript with `Paint`: discs, rings, segments,
boxes). A `defineBits` shape needs no canvas, so it settles the same in node as in a browser and its tests can check
every size a page draws it at. The credits family is painted that way.

`eightball` is a Magic 8 Ball: alone it shows the cue face with its 8; with `{ shape: 'eightball', text: 'Outlook good.' }`
it shows the die's triangle and the answer in its window (`wrapLines` does the wrapping).

## Colour

`color: 'meaning'` (the default) colours by the SETTLE code: rose for a light that is on and agrees with its lean,
orange for heat (on against its lean), dim indigo for off. `color: 'single'` uses one neon (`neon: 'mem'`, a hex, or
`'random'`, seeded by `seed`). `color: 'duo'` uses `neon` for on and `off` for off. `dim` sets how bright an off
light is; `glow` scales the bloom. Brightness is each light's running average, so a steady light glows and a
flickering one does not.

`color: 'map'` gives every light its own colour through `settle()` (lane LOGOHOVER, 2026-10-04): `palette` is a list of
hexes and `paint` is `{ hue: Uint8Array, gain: Float32Array }` (an index into the palette and a brightness per light)
or a function `(field, timeSec) => that`, read at every draw; `level` scales every gain. settle-site's header mark uses
it for the kanji's touch neons, its white moment and the hover effects' colour maps. The 2D renderer draws it; the
WebGL renderer ignores `paint`.

`background` is the plate's colour (default `'#000'`). `background: 'transparent'` draws raw lights with no plate:
an unlit light and the gap between dots have alpha 0, and a lit dot keeps its colour, so the picture sits over
whatever is behind the canvas (settle-site's header logo uses it with `glow: 0` and `dim: 0`). Each light's alpha is
its brightest channel (`lightAlpha`), so the dots composite as the same light the black plate shows. A `'gl'` settle
reads this at mount and then asks for an alpha, premultiplied WebGL2 context; a 2D one also follows `set()`. A CSS
blend mode on the canvas cannot do this: the plate is drawn black, and a blend inside its own compositing group runs
against a transparent backdrop.

The ten neons: yes rose, no indigo, lean amber, pull cyan, heat orange, calm lime, mem violet, held ice,
data mint, miss red.

## The pointer

The pointer is a sparkle. It switches on the light under it, with thin twinkling rays and thin strands shooting
out from its path; everything it touches is held for a moment and fades, so the path leaves an echo and the field
settles back. A click sends pulses: thin rings expanding from the click. Rapid clicks build power (a click within
a second of the last adds a level, up to 8); a second's pause resets it. `poke: false` turns it off.

## TRACES

`traces: true` (or `{ keep, every }`) captures the field's history, one bit per light per frame. `echoes: K` draws
the last K traces as pulsing echoes where the picture has been. The handle's `replay(k)` shows frame k back and
`live()` resumes. `createTraces(field)` is the same for your own loop.

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

`stats().r` is the correlation between the lights and the target; `correlation(a, b)` and `shuffled(t, seed)` are the
measure and the control a page's tests use.

## Bursts

`BURSTS` holds 25 disturbances of a live field: rings and wipes of flipped lights, shakes, the pointer's own held
rings, the exact hold of a band then its release, and flashes along a scene's wires. Each runs a few frames from a
`beforeStep` hook (`createBurstPlayer().start(design, burstEnv(F, { paths }))`, then `step(F)` once a frame); the cold
field then repairs the picture by itself. `createBurstDeck(seed).next()` deals them like a deck of cards (THE DECK RULE,
`src/deck.js`): all 25 before any repeats, then a fresh shuffle whose first design is never the last one dealt. settle-site's footer plays one on every page change.

## THE DECK (deck.js, lane CYCLEBAG, 2026-10-02)

Every SETTLE cycle deals like a deck of cards (THE DECK RULE, `sites/CLAUDE.md`). `createBag(items, opts)` deals
each item once a round in a random order, reshuffles when the round is empty, and never opens a round on the card the
last round closed on. `opts.seed` makes the order exact for a test; with no seed and no `opts.random` it uses
`Math.random`. `opts.weights` puts an item into the deck that many times; `opts.first` deals one item first in the
first round; `opts.after` names a card treated as already dealt. The deck has `next()`, `peek()`, `putBack(item)`,
`reset()` and the counters `drawn`, `size`, `left`, `last`, `round`. `indexDeck(n)` is a deck over 0 .. n-1,
`bagSequence(items, n)` the first n deals as a loop-safe array, `freshSeed()` a seed for a new order every visit.

```js
import { createBag } from 'settle-see';
const deck = createBag(['ising', 'boltzmann', 'hopfield'], { seed: 7 });
deck.next(); deck.next(); deck.next(); // all three, then a fresh shuffle
```

This file is the one home of the deck. settle-hear keeps a byte-identical copy (it imports nothing from settle-see) and
its tests fail when the copies differ; the SETTLE site re-exports it from `src/bag.js`.

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
  `height`, `bin`, `source`) and `<name>.bin`, the frames' packed bits one after another. It is the same packed layout
  TRACES records the field in, so a trace replays as a film (`tracesToFilm`) and a film's frames load into a trace
  ring to be drawn as echoes (`filmToTraces`).
- **Lazy**: a film is fetched only when it is the current item or the next one, once per URL.
- **TRUE TIME** (`truetime.js`): the film keeps its own pace on the wall clock, one frame every `1000 / fps` ms (the
  film JSON's `fps`; the film tool writes 2, a 500 ms grid). The field settles toward the frame it shows; when its
  agreement with that frame reaches `threshold` (0.8 by default) it jumps to whatever frame the film is at THEN, so a
  slow machine skips frames and a fast one holds each settled frame until the film moves on. Agreement is counted on
  the lights the jump changed (`changedLights`, `agreementOn`), never the whole grid, whose unchanged background
  would pass 0.8 at once. `loop: false` holds the last frame; `now` replaces the clock in tests.
- **The tween**: `tween: 'ramp'` (default) slides each light's lean from the frame it left to the new one over the
  first quarter period after a jump (`rampMs` to change it); `tween: 'snap'` switches the target whole.
- **Under reduced motion** a film shows one still frame (`still`, default the middle one).
- `T` holds a fixed temperature while the film plays (a cycling schedule would otherwise heat it mid-film).

settle-site's `tools/make_hero_film.mjs` makes films from a video or a folder of frames, or from code.

## Live items (live.js)

An item can be a function of the moment: `{ live: (w, h, t) => bits, periodMs: 125, threshold: 0.8, T, tween }`.
It runs on TRUE TIME exactly like a film whose frames are made on demand: the source is sampled on a fixed grid
(125 ms by default), the field settles toward the sample it holds, and once it agrees with that sample on the lights
the sample changed (0.8 by default) it takes the sample of that instant. The `ramp` tween slides the leans from the
old sample to the new one. A function that throws or answers the wrong size keeps the last target, never an empty
one. `stats().live` = `{ sample, shown, behind, periodMs }`. settle-hear's `spectrumTarget(style)` is one: the
hero's spectrum settle (lane HOUSEDJ). `tests/live.test.mjs` checks the field follows the function, takes a new
sample only when the grid moves and it agrees, holds when hot, and keeps the last target when the source fails.

## The 40 Hz flicker (createGamma)

The SETTLE site's home hero calls this its 40 Hz and 432 Hz FLUTE MODE (once HOT GAMMA RED; the name lives in
settle-hear's `FLUTE_MODE_NAME`); the footer's switch still says HOT GAMMA RED. The library itself has no name for it.

`createGamma(el, { hz: 40, duty: 0.5, depth: 1, onInfo, onFlash })` flickers an element's opacity in a square wave
on THE MASTER BEAT (below). `depth: 1` is a full on/off wave: fully dark for half of every 25 ms period (12.5 ms lit,
12.5 ms dark). It is off until a page starts it and refuses under `prefers-reduced-motion`.

- **The display's rate is measured**: the median `requestAnimationFrame` interval over about a second, snapped to a
  standard rate within 2% (`snapRefresh`: 59.94 reads as 60), and measured again whenever the tab becomes visible.
- **THE RATE RULE** (`pickFlashRate`, the default `slow: 'nearest'`): true 40 Hz on a display of 100 frames a second
  and up (120, 144, 165, 240); below that, the nearest 50% square wave the display draws exactly (`nearestRate`: 45 Hz
  at 90, 37.5 at 75, 36 at 72, 30 at 60), and `info.nearest`, `info.hz` and `info.asked` say so. `slow: 'refuse'`
  refuses a slow display instead.
- **Each frame is decided on the master phase** (`createFlashClock`): the display's vsync phase is learned from the
  frames, each frame is placed in its display slot, and its state is the ideal wave over the interval it will be on
  screen, counted from the master origin, with a carry so a period that is not a whole number of frames (three at
  120 Hz, 3.6 at 144) still shows the asked duty on average. A skipped slot (a dropped frame, a stall) clears the
  carry: the missed flashes are dropped, never made up. No two onsets fall closer than a cycle less one frame, so a
  cycle never flashes twice.
- It reports what was drawn: `info.shownHz` (bright flips per second), `info.darkShare` (the share of drawn time spent
  dark) and `info.lockMs` (the worst distance in the last second from an onset frame to its master cycle start).

## THE MASTER BEAT (masterbeat.js, lane MASTERBEAT, 2026-10-01)

One clock and one grid for everything on a page that keeps time. The origin is the page's own time origin
(`performance.now()` = 0); the grid is a pure function of that clock.

| unit | period | in flash cycles |
|---|---|---|
| `'tick'` / `'truetime'` | 500 ms (a TRUE TIME frame) | 20 |
| `'beat'` | 500 ms (120 bpm) | 20 |
| `'bar'` | 2 s (4 beats) | 80 |
| `'flash'` | 25 ms (40 Hz) | 1 |

So every bar line is a tick and every tick is a 40 Hz flash onset. `masterBeat()` is the page's one master beat, built
on first use and published on `globalThis.__settleMasterBeat` (settle-hear reads the numbers there and never imports
settle-see). `.at(t)` gives every phase, `.floor(t, unit)` and `.next(t, unit)` the grid lines, `.phase(t, hz)` the
phase of any frequency counted from the origin (the binaural beat's), and `.on(unit, fn)` a subscriber that hears each
line once, from the shared ticker's frames, with `skipped` counting lines that passed while nothing ran (a hidden tab,
nobody there, PAUSE ALL). It never catches up in a burst and never drifts: line k is always at `origin + k * period`.
Reduced motion does not touch it; it is time, not motion. `createMasterBeat({ now, origin })` builds one for a test.

What reads it: `createTrueTime` and `createMorph` (with no clock injected, a movie starts on the grid line at or before
now, so its frames turn on master ticks), the film and live items of `settle()`, `makeSchedule({ kind: 'cycle', on:
'master', fps })` (the cycle runs on the master clock and its length is rounded to whole ticks, so an item changes on a
tick on every machine), `createGamma`, and THE GLOBAL SETTLE's ripple bus (`global.js`, whose clock is the master
beat's). `settle(canvas, { beat: true })` (and `<Settle beat>`) draws its frames on the master grid of
`1000 / fps`: an 8 fps settle steps once per 125 ms line, five 40 Hz cycles (the ticker's `addTick(fn, fps,
label, { beat })`). An injected `now` keeps its own clock, so tests and replays are untouched.

A `<Settle>` prop change hands `set()` only the options that changed (`changedOptions`), so a control panel can move
the dim, the lean or the pull without restarting a cycling picture.

## Speed, halting and true time (lane PERFLADDER, 2026-10-01)

**The halt rule.** Every settle on a page shares one `requestAnimationFrame` loop (`ticker.js`). It halts when the
tab is hidden, and after 5 minutes (`IDLE_MS`) with no pointer move, pointer down, key, wheel, scroll or touch in the
tab; any of those, or the tab becoming visible, resumes it at once. While halted the loop is not scheduled at all.
`tickerState()`, `onTickerState(fn)`, `setIdleTimeout(ms)` and `wakeTicker()` expose it, a window event
`settle:ticker` announces each change, and React's `useTickerState()` gives `{ state, awayMs }` for a quiet "paused
while you were away" note. settle-hear listens for the same event and suspends its AudioContext, so the sound halts
with the pictures. There is exactly one implementation; a page adds no idle timer of its own.

**Meters.** The ticker times every call (`tickerStats()`, `globalThis.__settleTicker`), and every settle times its
physics and its drawing (`handle.perf`, `settlePerfs()`, `globalThis.__settlePerfs`). `opts.perfLabel` names it.

**The WebGL2 renderer.** `opts.renderer: 'gl'` draws the same neon dots in one fragment-shader pass (`glrender.js`):
each pixel reads its light with `texelFetch`, cuts the dot and the hot core analytically, and adds the bloom from mip
levels 1 and 2 of the same texture with the 2D renderer's weights. The 2D renderer composites a full-size plate about
nine times a frame. The colours are still filled on the CPU by `fillCells()` (shared, tested byte-identical between
its fast and full loops). The choice is made once at mount and falls back to 2D without WebGL2. A browser allows only
a few WebGL contexts per page, so keep it for the large pictures.

**Page quality.** `setQuality({ resScale, fpsScale })`, applied once at load (the site's perf ladder does it), scales
the numeric `res` and the `fps` of every settle mounted afterwards. An exact `[w, h]` grid is never scaled, and a
settle with `quality: false` keeps what it is given.

**TRUE TIME RENDER** (`truetime.js`). For a film, or anything movie-like, two things run at once.
- *In sound-and-picture terms:* the movie behind runs at its true pace, one frame every 500 ms, like a soundtrack
  that never waits. The field in front settles toward the frame the movie holds now, as fast as the machine allows.
  When the field agrees with that frame well enough (80% by default) the frame counts as shown, and the field turns
  to whatever frame the movie is at in that instant. A fast machine shows every frame and waits on it; a slow machine
  skips frames. On both, the picture keeps the movie's time.
- *In machine-learning terms:* the movie is a data stream on a fixed time grid; the field is an anytime inference
  procedure, read out when its estimate passes a quality threshold and then re-targeted to the newest observation
  rather than the backlog. Its lag is bounded by one settling time and never accumulates.
`createTrueTime({ frames, periodMs: 500, threshold: 0.8, loop: true, now, start })` gives `.frameAt(t)`, `.showing`,
`.update(agree, t)`, `.history` (every snapshot, so `replayFrames(history)` replays a run), `.on(fn)`, `.restart(t)`
and `.set({ threshold })`. In `settle()`, `opts.trueTime = { periodMs, threshold, loop }` makes `items` the frames;
each frame the field's overlap with its target (`field.overlap()`) is the agreement, and `stats.trueTime` reports
`{ showing, movie, behind }`. A site's quality ladder may change the threshold; it never changes the pace. A film item
runs its own true-time clock at the film's fps, with the agreement counted on the lights each jump changed (see Small
films above).

**MORPH: a new target by settling** (`morph.js`, the bilingual site). `handle.morph({ items })` swaps the item specs
in place (same index, same schedule frame) and plays a short TRUE TIME movie from the target the field holds to the new
one: four frames at 500 ms, frame 0 the old picture, the last the new one, each light switching at its own seeded
moment, sooner on the left. The field settles toward the frame the clock holds and moves on when it agrees with it on
80% of the lights that frame changed, so a fast machine shows every frame and a slow one skips some, at the same pace.
A hot field that cannot agree is let go two periods after the movie ends, on the new picture. Under reduced motion, or
for a film item, it is a cut. In React, `<Settle morph ...>` sends a change of `items`, `word`, `shape` or `target`
through `morph()` instead of `set()`. The word font (`WORD_FONT`) lists Hiragino Sans, Noto Sans JP and Yu Gothic after
the Latin faces, so a Japanese word is drawn in a Japanese face.

**The GPU sweep** (`gpufield.js`, an exploration, not used by `settle()`): the checkerboard Gibbs sweep as two
fragment passes into ping-pong integer textures, with a PCG hash for the draws. It agrees with the CPU sweep in
distribution (mean magnetisation and correlation within 0.0009 on three cases; settle-site
`tools/perf/gpusweep_check.py`). The CPU sweep is already a few percent of one core for the site's largest pictures,
so it stays the default.

**Benchmark:** `node bench/sweep.bench.mjs [w h frames]` times sweep plus soft read per light, the field as it was
(`bench/field_v0.js`) against now, in CPU time. The sweep keeps its random words in locals and compares the raw u32
draw with integer thresholds, so it draws exactly the same sequence as before at 1.2 to 1.4 times the speed;
`stats()` is one row-by-row pass, ten times faster.

## The global settle (global.js, lane GLOBALSETTLE, 2026-10-01)

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
  (`GLOBAL_DEFAULTS.speed`). Its strength at radius r is `strength * exp(-r / 1400)`. Each settle the ring
  crosses leans the lights on the wavefront ON (the crest) with the lights just behind it OFF (the trough), and its
  temperature is raised by `1 + 0.35 * strength` when the ring first touches it (the kick fades by 0.86 a frame).
  The physics then takes the picture back to its own target. Settles are reached nearest first.
- **A local ripple** (`scope: 'local'`) travels nowhere. A settle with `audio` sends one on every click, or on
  Enter or Space when its canvas has focus (it gets `tabIndex` 0); its own rings stay inside it, and the click
  noises in settle-hear play one sound for every ripple with `sound: true`.
- **Options:** `global: false` keeps a settle out of the registry; `globalId` names it, so a page ripple whose
  `source` is that name skips it (the logo draws its own bloom); `audio` marks a settle with sound.
- **Cost:** nothing is scheduled while no ripple travels (`globalStats().frames` holds still). Rectangles are
  read from the layout only when a ripple starts or after a scroll or resize. A settle that is paused or off
  screen ignores the wave.
- **Reduced motion:** a page ripple is one soft pulse per settle, nearest first: the lights near the ripple's
  nearest point glow faintly once, the picture is drawn again, and the glow is gone after 450 ms. No ring.
- **PAUSE ALL, a hidden tab, an away reader:** a new ripple is refused (`ripple()` returns null) and live ones
  are dropped.
- `createGlobalSettle({ now, frame, state, reduced, win })` builds a private registry with an injected clock
  and frame loop, for tests. `tests/global.test.mjs` covers mount and unmount, distance order and local
  coordinates, the source opt-out, the idle counter, local ripples, reduced motion, PAUSE ALL, and a real lean.

## THE RADIAL PULSE BUS (radialpulse.js, lane RADIALPULSE, 2026-10-02)

One bus for every radial event on the page, and one consumer interface every drawing and every sound anchor
implements. The global settle above is now a face over it: `ripple({ scope: 'page' })` is `emit()`, every `settle()`
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

- **The wave** is a ring from (x, y) at 900 px/s (`RADIAL_DEFAULTS.speed`). For each consumer the bus computes
  the delay (the front touches it after `(d - band) / speed`, d its distance from the origin), THE GRADIENT
  (`w.a = strength * exp(-d / 1400)`), THE DIRECTION (`w.dir`, a unit vector from the origin to its centre) and the
  phase of the crossing (`w.phase`, 0 at arrival, 1 once the 56 px band has cleared its far corner; `w.passMs` is
  how long that takes). `arrive` runs once, nearest consumers first; `respond` every frame while the band crosses;
  `leave` once after it. `w.x, w.y` are the origin in the consumer's own CSS pixels.
- **Cost:** one `requestAnimationFrame` serves every consumer and nothing is scheduled while no wave lives
  (`radialStats().frames` holds still). A consumer more than 160 px outside the viewport is skipped entirely.
  Rectangles are read from the layout only when a wave starts or after a scroll or resize.
- **The 40 Hz lights answer of their own accord:** the page bus attaches to `fortyHz()` and every drawing registered
  there (a film stage, a player, a page's own canvas) gets a brightness animation as the band crosses it, unless
  something already registered its element or an element inside it (a wrap round a settle's canvas).
- **Reduced motion:** no wave travels; every consumer on screen gets one `still(w)` (the same shape, `w.reduced`
  true, `w.ms` 450), nearest first. **PAUSE ALL, a hidden tab, an away reader:** `emit()` answers null and live
  waves are dropped.
- **The scene settle** takes a wave through `pulse(w)` (in canvas pixels): the lights brighten along the front, the
  shapes are pushed outward (`pulsePrims`), the temperature kicks; `pulseEnd(id)` lets it go. Still mode answers
  false, so the low CPU mode keeps its promise.
- **settle-hear never imports settle-see**, so a page registers its sound anchors here and hands each `arrive` to
  settle-hear's `soundPulse(w, { anchors })`, which brightens, swells and pans every playing channel at that anchor.
- `createRadialPulse({ now, frame, state, reduced, win, viewport })` builds a private bus for tests;
  `tests/radialpulse.test.mjs` covers the delay, the falloff and the direction, the arrival order, off-screen
  consumers, the idle counter, the source, client space, reduced motion, PAUSE ALL, listeners, the 40 Hz lights,
  the global settle on the bus, and the scene settle's response.

## The drag box (dragbox.js, lane HERODRAG, 2026-10-02)

`drag: true` makes a settle's press a click OR a drag. The page draws the rectangle; settle-see decides the gesture
and lights the four children.

```js
settle(canvas, { audio: true, globalId: 'hero', drag: true, onDrag: (e) => draw(e) });
// e: { phase: 'armed', x, y } | { phase: 'move', box } | { phase: 'drop', id, box, fadeMs, still, marks } | { phase: 'cancel' }
```

- **The click** is the settle's usual click (rings, a burst, power, a local ripple with sound), fired on release at
  the press point when the pointer moved less than `DRAG.threshold` (6 CSS px). Without `drag` the press is the
  click, as before.
- **A drag** (a mouse or pen moved 6 px) reports a rectangle in CSS px inside the canvas on every move. A mouse press
  calls `preventDefault()` (no text selection) and captures the pointer, so the drag keeps going over anything on
  top of the canvas.
- **Touch:** a finger that moves more than `DRAG.touchSlop` (10 px) before `DRAG.longPressMs` (300 ms) is a scroll
  and the page scrolls. Held still for 300 ms it is armed (`phase: 'armed'`); from then `touchmove` and
  `contextmenu` are prevented, so the finger draws and the phone's own long-press menu waits. A tap is a click.
- **The drop** gives `fadeMs`, `lifeMs` and `insideMs` (`dragTiming`: a life of 5.6 s, +-10% per drag, twice the first
  version's; the box fades over the inside 20%, about 1.1 s), and four children born at the
  box's quarter centres. Each child is a star that sends a ring every 8 frames. INSIDE (the first 20%) they push
  apart and swirl round the box's centre, bounce off its walls, and their rings stay in the box. ESCAPED (the other
  80%) each splits into two of half the mass (`splitChildren`, the fractal touch: 4 become 8) and roams the whole
  picture on its own gently curving path, bouncing off its edges, with no pull between them (`stepEscape`). The
  last quarter of the life fades their rings out. THE INTERFERENCE: every drag ring is a crest and a trough half a
  wavelength behind it, added into one scratch sum over the grid (`createInterference`, each light once per
  circle); a light is held on or off by the sum's sign and strength, so where rings cross they brighten or cancel.
  The cost is the circles' length, at most `DRAG.maxRings` (128) rings. Four pulses with sound (kind `'drop'`)
  go out 90 ms apart through `dragPulse()`, so settle-hear's click lock plays the locked sound four times; when
  `global.js` carries THE RADIAL PULSE BUS's `clickPulse`, each one is also a page pulse the whole page answers,
  and before that it is a local ripple (the noise only).
- **Many boxes (lane MULTIRECT):** drags come one after another with no wait; at most `DRAG.maxBoxes` (10) groups
  live, and an eleventh drops the oldest, never the new one. They interact three ways. THE ONE ROOM: boxes still in
  their inside phase that overlap (`rooms()`, chains count) are one room; their twinkles swirl round the room's
  centre, wander through the overlap into the neighbour, are reflected only where they would leave the union, push
  each other as one group does, and each ring is clipped to the box its twinkle stands in. THE NUDGE: a drop kicks
  every twinkle already alive away from the new box's centre (`nudgeKids`, `DRAG.nudge` 0.9 lights a frame at the
  centre, falling as `exp(-d / reach)`, reach a quarter of the shorter side). THE CROSS PULL: escaped twinkles of
  different boxes bend toward each other (`stepEscape`'s `others`, at most `DRAG.crossPull` of the speed a frame),
  and every ring of every box sums in the one interference scratch. Past four boxes each twinkle rings less often
  (every `pulseEvery x boxes / 4` frames), so ten boxes cost about what four did. THE NOISE GATE (`createNoiseGate`): a burst of
  drags sounds at most `DRAG.noiseBurst` (6) noises, then `DRAG.noisePerSecond` (3); a birth over the limit still
  pulses the page, with `sound: false`. Reduced motion, a paused or hidden picture and PAUSE ALL drop still:
  `still: true`, the four `marks` for the page to draw, no children.
- Tests: `tests/dragbox.test.mjs`.

## THE SCENE SETTLE (scenefield.js, lane SETTLEBG, 2026-10-02)

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
- The colour is the renderer's `'map'` mode: each light its palette colour times its gain (`extra.paint = { hue, gain }`),
  `opts.level` caps the picture. `neonRange(extra, size)` builds the palette: the ten neons plus the caller's extra
  hexes, in hue order, with the widest hue gaps filled by in-between neons (mean saturation and value), near-white last.
- Temperature: hot 2.6 for 350 ms, then geometric cooling to 0.42 over 1.8 s; each new target kicks it to 0.95,
  decaying by 0.86 a frame. Once cold, unkicked and unchanged for 30 frames the frame function returns at once.
- `platePitch` draws the plate at fewer pixels a light and scales it up: a 1440 x 900 background at 7 px a light
  composites a 3 px plate (measured 2.5 to 3 ms a frame against 11 to 12 at 7 px, headless Chromium).
- The canvas registers with THE 40 Hz LIGHT's gate (`fortyHz().register`, by `opts.label`); `fortyHz: false` opts out.
- The bloom mips are drawn with `copy`: with a clear plate, drawing them over the last frame piled faint pixels into a
  full-colour wash (a renderer fix this lane found; `tests/scenefield.test.mjs` proves it red then green).

## Tests

`npm test` checks the sampler against the exact p-bit rate and exact two-light enumeration, a cold settle against
a no-lean negative control, the schedule, the neon code, the pointer's hold and TRACES; clamping (held lights never
move, a light beside a held row says yes more often than one far away) and per-light leans against the exact rate;
every credits shape settling to correlation above 0.85 at every size settle-site draws it while a shuffled-target
control stays below 0.25; and `settle()` itself on a stand-in canvas: still pictures, `show()`, resting, the step
hooks, a programmed schedule, `offset`, reduced motion and `fit`; and `soften('mean')` against a hand count. The
ticker's halt rule (away, hidden, a negative control), TRUE TIME (switches land on the clock's frame; fast and slow
fronts; a next-in-order control that falls behind), the page quality, and the renderer's colour fill;
the transparent plate (an unlit light at alpha 0 and a lit one at its brightest channel, the canvas and plate
cleared rather than filled, an alpha context asked for only then, and the default still opaque);
the gamma wave (40 flips a second, the dither's 50% dark share at 120, 144, 165 and 240 Hz, createGamma on a fake 120 Hz display, refusing a 60 Hz one when asked to); the master beat (`tests/masterbeat.test.mjs`: one grid, subscribers in phase, pause and resume without drift, reduced motion unaffected, and the light on fake 60, 90, 120 and 144 Hz displays and a jittery 60: each onset within one frame of its master cycle start, no double flash, no drift, dropped frames never made up, with negative controls);
`changedOptions` keeping a cycle running; and small films (the format round trip, the TRACES round trip, true-time
playback against an injected clock, the agreement on the lights a jump changed, the ramp and snap tweens, lazy
loading).

## Where settle-site uses it

Every settle on settle-site is a settle-see `<Settle>` (so every one takes the pointer and shares the one ticker):
the home hero and the footer's mirrored room (with TRACES echoes), the home coin field, the How page's horse count
(per-light leans, `soften: 'mean'`) and memory (a still picture you can draw on, which damages the Hopfield memory),
RELAX's class (a programmed schedule, `clamp` for HOLD, `afterStep` for ASK), the Memory page's patterns (still
pictures), every credit (the credits family, `fit`, the hero with echoes), and the Learning page's digits.
