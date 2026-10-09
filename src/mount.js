// settle-see · mount - settle(canvas, opts): put a live settling picture on a canvas in one call.
//
// <claudes_code_comments>
// ** Function List **
// changedOptions(prev, next) - only the options whose value changed (compared by a JSON key); what set() should get
// settle(canvas, opts)  - start a settle on a canvas; returns the handle below
//   .play() .pause() .toggle() .paused     - motion
//   .set(opts)                             - change target, items, colours, lean, pull, schedule, speed
//   .resting                               - true while the rest rule holds the field still (opts.rest)
//   .morph(opts, how)                      - change items / word / shape / target BY SETTLING (morph.js): a TRUE TIME
//                                            movie from the picture now to the new one; the schedule keeps its place
//   .stats()                               - the live numbers (see onStats)
//   .shake(frac)                           - heat the whole picture now
//   .destroy()                             - stop and let go of everything
//   .traces                                - TRACES, the captured history (see traces.js), when opts.traces is set
//   .replay(k) / .live()                   - show the frame k back (and pause) / return to the live settle
//   .show(bits, { snap })                  - settle into this Int8Array now (snap: copy it into the lights at once)
//   .seek(frame)                           - jump the schedule to a frame
//   .advance(n)                            - run n frames now, without waiting for the clock, then draw once
//   .front(x, y, r, width, level, rows)    - a draw-only flash on the lights a wave's front crosses (lane FOOTERMINI)
//   .frame                                 - the schedule's current frame
//   .geom                                  - the layout: { cw, ch, w, h, P pitch, sc scale, dw, dh, ox, oy }
//   .trueTime                              - the TRUE TIME clock when opts.trueTime is set (truetime.js)
//   .perf                                  - the settle's own meter: { phys, draw, frames } in milliseconds
//   .renderer                              - '2d', 'gl', or 'gl-failed' (WebGL2 given but the shader did not build)
// setQuality({ resScale, fpsScale }) / getQuality() - the page-wide quality a site's perf ladder sets once at load
// fortyScanReady() / fortyScanState()               - the 40 Hz crackle's generator (fortyscan.js), loaded on
//                                                       demand: start the load / 'idle', 'loading' or 'ready'
// ringsFor(o, geom, fps, power)                       - pure: the rings, strands and star one click adds (opts.rings)
// echoRings(o, geom, fps, level, spec)                - pure: the echo's rings (a click's, or spec's), scaled by level
// radialAnswer(w, R)                                  - pure: this consumer's crest for a page wave (opts.radial: gain,
//                                                       band, floor)
// frontCells(cx, cy, R, width, w, h, row0, row1)      - pure: the lights a ring of radius R crosses in rows row0..row1
// dragPulse(spec, bus)                                - a drop's birth: through clickPulse, else a local ripple
// tellDropSound(detail)                               - a drop's refusal on the picture's side, as 'settle:dragsound'
// seenNow(entries, was)                              - pure: on screen or not, from an observer batch's LAST entry
//
// ** Technical Review **
// - opts.shape / opts.word / opts.target: one spec (see target.js); opts.items: a list, cycled by the schedule
//   (one item per period); nothing given settles into the word SETTLE.
// - LAZY SHAPES (lane LAUNCHGATES, 2026-10-09): an item naming a shape whose drawing loads on demand (the credits
//   family) gets an unlit target at once and the real one when the drawing arrives, like an image URL; the next
//   item's drawing is fetched when the current item starts, as a film is.
// - SMALL FILMS: an item may be { film: 'url/name.json', fps, loop, tween, T, threshold, note } or { frames: [spec,
//   ...] } (film.js). A film is fetched only when it is the current item or the next one (lazy), its frames are fitted
//   into the grid, and it plays in TRUE TIME (truetime.js, navigator 2026-10-01): the movie behind keeps its own pace
//   on the wall clock, one frame every 1000 / fps ms (the film JSON's fps; 2 fps, 500 ms, is the film tool's default);
//   the field settles toward the frame it shows, and when its agreement with that frame reaches the threshold (item
//   .threshold, else opts.filmThreshold, else 0.8) it jumps to the frame the movie is at THEN, so a slow machine skips
//   frames and a fast one holds each frame settled until the movie moves on. AGREEMENT is counted on the lights the
//   jump changed (film.js changedLights / agreementOn), not the whole grid, whose unchanged background would pass 0.8
//   at once. tween 'ramp' (default) slides each
//   light's lean from the frame it left to the new one over the first quarter period after a jump; 'snap' jumps.
//   T fixes the temperature while the film plays; loop false holds the last frame. Under reduced motion a film shows
//   one still frame (item.still, default the middle one). stats().film = { frame, movie, shown, frames, loading,
//   error }. item.fallback is a second film URL played when the first will not load. opts.fetch replaces fetch and
//   opts.now the clock (tests). opts.beat: the frames fall on THE MASTER BEAT's 1000 / fps grid (masterbeat.js).
// - opts.res: a NUMBER is a density: about that many lights across, the rows following the canvas's shape, and the
//   pitch rounded to whole device pixels so the dots fill the canvas edge to edge and stay sharp. An ARRAY [w, h] is
//   an exact grid, drawn centred at the largest whole pitch that fits; with opts.fit it is drawn at the next whole
//   pitch up and scaled down to fill the canvas exactly (no black margin, the dots a little soft).
// - opts.color 'map' (lane LOGOHOVER, 2026-10-04): every light its own colour, through opts.palette (a list of hexes)
//   and opts.paint, { hue: Uint8Array, gain: Float32Array } or a function (field, timeSec) => that, read at every
//   draw (render.js fillMap). The 2D renderer draws it; the WebGL renderer ignores paint. set({ paint }) swaps it.
// - opts.color 'meaning' | 'single' | 'duo', opts.neon (a key, a hex, or 'random'), opts.off, opts.dim, opts.glow:
//   see render.js. THE ITEM LOOK (lane HEROHYPER): an item may carry neonLook, an object of render.js ITEM_LOOK_KEYS
//   (yes, heat, neon, off, coreMix, glow, flashColour) or a function answering one (read every frame, so a live item
//   may change it); it is drawn in that look from its first frame. opts.itemLooks false turns item looks off. opts.background (default '#000') is the plate's colour; 'transparent' (lane LOGORAW, 2026-10-02)
//   draws raw lights with no plate: an unlit light and the gap between dots are see-through, a lit dot keeps its
//   colour. A 'gl' settle reads it at mount (it picks an alpha, premultiplied context); a 2D one follows set(). opts.seed seeds the noise and a random neon.
// - opts.schedule: see schedule.js ('cycle' default; 'cool'; 'fixed'; a number; a function). opts.fps (24) is
//   frames per second and opts.sweeps (1) is Gibbs sweeps per frame.
// - opts.poke (default true): the pointer is a SPARKLE: it switches ON the one light under it (opts.pokeValue, +1
//   by default), with thin rays that twinkle around it and a few thin strands that shoot outward from its path.
//   Every light it touches is held for a moment and the hold fades (opts.trail, the fade per frame, default 0.86),
//   so the path leaves a thin echo and the field then settles back. Positions between two pointer events are filled
//   in, so a fast stroke draws a line. opts.pokeRadius (default 0.7 lights) is the point's size; opts.sparks
//   (default 3) is the strands spawned per pointer event. A CLICK sends PULSES: four thin rings expanding from the
//   click point one after another (opts.pulses, default 4), and a ring of strands. Rapid clicks build POWER: each
//   click within opts.comboMs (default 1000 ms) of the last adds a level, up to opts.maxPower (default 8); each level
//   adds a ring, speed, thickness and strands; a pause of comboMs resets it. The level is in stats as power / maxPower.
// - Motion stops when the canvas is off screen or the tab is hidden. Under prefers-reduced-motion the picture settles
//   out of sight and is drawn once, still (opts.motion = 'always' overrides).
// - A resize (ResizeObserver) lays out and redraws in the same callback, and leaves the canvas alone when its drawing
//   buffer keeps its size: assigning canvas.width clears it, and a running settle used to wait for its next step, so a
//   canvas whose box kept changing showed black between steps (lane WHATPICTURE, 2026-10-04).
// - opts.traces: true or { keep, every } captures the field every `every` frames (default 1) into a ring of `keep`
//   (default 64). opts.echoes: K > 0 draws the last K traces as pulsing echoes (implies traces).
// - opts.offset (frames, default 0) starts the schedule part way through, so a page of settles does not pulse in step.
// - Under prefers-reduced-motion the schedule runs out of sight to its first 'settled' frame plus opts.reducedFrames
//   (60) and is drawn once; opts.stillFrames runs exactly that many frames instead (a page's own program, whose
//   phases are its own names).
// - opts.beforeStep(field, info) and opts.afterStep(field, info) run around every frame's sweeps, with info =
//   { frame, T, beta, phase, index }: a page's own program (clamp a band, count a row, swap leans) lives there.
// - opts.still: a still picture that answers the pointer. The lights start AS the target, a new target (items, show)
//   is copied straight into the lights, and the field sits at the fixed cold temperature opts.stillT (0.3), so the
//   pointer's sparkle and rings disturb it and it settles back. Use it to draw a pattern another engine computed.
// - opts.rest (default: on when still): when the temperature and the target have not changed and the pointer has
//   left no trail, sparks or rings for opts.restAfter frames (24), the field is at equilibrium; it then stops sweeping
//   and drawing (the picture holds its last frame) until the pointer, set(), show() or seek() wakes it. A page of
//   still pictures costs nothing while nobody touches it. Rest freezes the flicker, so leave it off where the
//   flicker is the point (a field of coins).
// - field.flash(lights, a) (from a step hook) draws those lights in opts.flashColour (default: the on neon mixed most of
//   the way to white, a white-hot core) at strength a, fading by opts.flashDecay (0.72) a frame. It touches no p-bit:
//   a spike can run along a wire that is already lit and still be seen.
// - opts.trueTime = { periodMs: 500, threshold: 0.8, loop: true }: TRUE TIME RENDER (truetime.js). The items are a
//   movie at its true pace; the field settles toward the frame the clock holds and, when its overlap with that frame
//   reaches the threshold, switches to the frame the movie is at then. stats gain trueTime { showing, movie, behind }.
// - LIVE ITEMS (live.js): an item { live: (w, h, t) => bits, periodMs (125), threshold (0.8), T, tween, note } is a
//   target made on demand, sampled on TRUE TIME's grid like a film's frames: the field settles toward the sample it
//   holds and takes the sample of that instant once its agreement on the changed lights reaches the threshold. The
//   ramp tween slides the leans from the old sample to the new one. A function that throws or answers the wrong size
//   keeps the last target. stats().live = { sample, shown, behind, periodMs }.
// - opts.quality (default true): scale this settle by the page quality (setQuality); false keeps res and fps as given.
// - opts.renderer: '2d' (default) or 'gl' (glrender.js: the whole picture in one WebGL2 fragment pass, the same
//   look, far less compositing). Chosen once at mount; 'gl' falls back to 2D when WebGL2 is not available. Keep it
//   for the large settles (a browser allows only a few WebGL contexts per page).
// - MORPH (morph.js, the bilingual site): handle.morph({ items }) swaps the specs in place (same index, same schedule
//   frame) and, when the current item is a still target and motion is allowed, plays a short TRUE TIME movie from
//   the target the field holds to the new one (`how` = { frames 4, periodMs 500, threshold 0.8, overrun 2 }); stats
//   gain morph { showing, frames, done }. Under reduced motion, or for a film item, it is a cut: the new target is
//   copied into the lights and drawn once. A change of item count falls back to set(), and so does a different film
//   or live source at the current index (the same film keeps playing).
// - THE OWED LIGHTS (lane HEROPASS, 2026-10-06): the movie starts from the picture that is LIT, not from the target
//   the field was heading for, and the lights it changes are OWED: when the movie ends, every light that still
//   disagrees with the new target joins them, and the field may not rest until each owed light agrees (or
//   OWED_MAX_FRAMES, 120, pass). Before, a morph begun while another was still running started from the half-way
//   target, never watched the lights lit from the old words, and the rest rule could freeze them lit. stats().owed
//   counts them; handle.resting says whether the rest rule holds the field.
// - THE GLOBAL SETTLE (global.js): every settle registers itself in the page's one registry (opts.global = false
//   opts out; opts.globalId names it, so a page ripple from that source skips it). A page ripple passing through
//   leans the lights on its wavefront (a bright crest, a dark trough behind it) and kicks the temperature by
//   1 + kick (the kick fades by GLOBAL_KICK_DECAY a frame); a resting or still settle wakes for it. Under reduced
//   motion a ripple is one soft pulse: the lights near its nearest point flash once and the picture is drawn again.
// - opts.audio: this settle has sound. A click (or Enter or Space when the canvas has focus; it gets tabIndex 0) sends
//   a LOCAL ripple on the bus with sound: true, which the click noises in settle-hear play; the rings stay inside; and
//   a page pulse through THE RADIAL PULSE BUS (radialpulse.js) that every other settle, background and sound answers.
// - opts.drag (lane HERODRAG; dragbox.js): true or { threshold, longPressMs, ... } makes the press CLICK OR DRAG. A
//   release within DRAG.threshold (6 px) of the press is the click above, run at release with the press point. A
//   mouse or pen moved 6 px draws a rectangle, a finger first held still DRAG.longPressMs (300 ms) does (moving
//   earlier is a scroll the page keeps). opts.onDrag(e) hears { phase: 'armed', x, y }, { phase: 'move', box }, {
//   phase: 'drop', id, box, fadeMs, lifeMs, insideMs, still, marks, children } and { phase: 'cancel' }; box is CSS px
//   inside the canvas and the page draws it. A drop lights four children (dragTiming: a life of 5.6 s +-10%, the
//   first 20% INSIDE the box, which fades over exactly that). Inside they repel, swirl and bounce off its walls, a
//   star each and a ring every 8 frames clipped to the box. Then each splits in two and the eight ESCAPE, roaming the
//   whole picture on their own curving paths for the other 80%. Every drag ring is a crest and a trough summed in one
//   interference scratch (dragbox.js createInterference), so crossings brighten or cancel. It sends four pulses with sound, DRAG.soundGapMs apart, through dragPulse() (kind 'drop'): THE RADIAL
//   PULSE BUS's clickPulse when global.js carries it (the noise plus a page pulse), else a LOCAL ripple (the noise). At most DRAG.maxBoxes (10) groups live; a new one drops the oldest. MANY BOXES
//   (lane MULTIRECT): boxes in their inside phase that overlap are ONE ROOM (twinkles wander through the overlap and
//   push each other), a drop NUDGES the twinkles already alive away from its centre, escaped twinkles of different
//   boxes bend toward each other (the cross pull), and THE NOISE GATE lets a burst of drags sound at most
//   DRAG.noiseBurst DROPS, then DRAG.noisePerSecond drops a second (the rest pulse the page silent). A drop is ONE
//   event for the gate (lane HERODRAGFIX): it is asked once at the release and its answer rides all four births, which
//   carry the drop's id (drag) and their part (0 .. 3). A birth the bus refuses is told as 'settle:dragsound'. A mouse
//   or pen release also reaches the gesture through the window while pressed, so a release outside the canvas
//   completes the box even where the pointer capture was lost.
//   Reduced motion, a paused or hidden picture or PAUSE ALL drop still (the marks only, no children). Armed or
//   dragging, touchmove and contextmenu are prevented, so the finger draws and the phone's long-press menu waits.
//   handle.dragGroups and handle.dropBox(box) are for tests and a page's own gesture.
// - opts.weather(info) (lane SOUNDSHAKE, weather.js): once a frame, before beforeStep, a page's modulation of this
//   settle's own knobs: { heat, lean, pull, rate, soften, streak }; heat multiplies the frame's T, lean and pull
//   multiply o.lean and o.pull into the field (reset every frame), rate the sweeps (a fraction carried over), soften
//   replaces the soft read's factor, streak draws a lens-flare band of holds for the frame. The hero's sound drives it.
//   crackle (lane CLEARTEXT, crackle.js) flares the target's rim lights overbright through the draw-only flash, a few
//   a frame, with its own generator: the physics, the agreement and the body of the picture are untouched.
// - opts.fortyCrackle (lane FORTYCRACKLE, fortycrackle.js, reworked into TV scanlines by lane FORTYSCAN; on by
//   default, false opts out, an object tunes it): THE 40 Hz CRACKLE. While the page's 40 Hz light is on and the frame
//   drawn is lit, bright scanlines lie over the picture (horizontal, tilted, rolling, interlaced, a vertical-hold
//   roll, a wobble, a phosphor bloom, chunky retro lines, morphing from one to the next as THE DECK RULE deals them)
//   and the LIT lights under them are brightened toward white through the draw-only flash, each by its own soft
//   read, so a light the settle did not light is never drawn. It advances once per lit phase of the gate's clock, so
//   a dark frame brightens nothing and the square wave is kept. A resting picture keeps its physics still and only
//   its crackle draws. The meter's perf.forty is its cost in ms. globalThis.__settleFortyCrackleOff = true holds every
//   crackle off (the brightness tool's switch, so one picture is measured with it off and on). The generator
//   (fortyscan.js) loads on demand, once a page, at the first lit phase; until it arrives a lit phase draws no lines.
// - THE RADIAL EFFECTS (radialeffects.js): a page wave crossing this settle is drawn as its member's crest (a user's
//   click: a crest and a trough; a sound pop: a shimmer, double rings or spokes) and kicks the temperature by that
//   member's kick.
// - opts.rings (lane FOOTERLADDER): a GENTLE click instead of the default pulses, in time rather than in frames, so a
//   slow settle (the footer runs at 4 to 8 fps) answers quickly: { count, reach, ms, gapMs, width, bright, sparks }.
//   count rings (no combo power), each growing to reach x the shorter side of the grid in ms, gapMs apart, width
//   lights thick, fading from bright to zero at its reach; sparks strands that live as long as a ring. Absent, the
//   click is the default pulses above, unchanged (the hero's look). ringsFor(o, geom, fps, power) is the pure rule.
// - opts.radial (lane FOOTERLADDER): { gain, band, kick } scale this settle's answer to a PAGE wave: the crest's
//   strength by gain, its width by band, the temperature kick by kick (each default 1). The bus and its shared
//   constants are untouched; only this consumer answers more softly. floor (lane FOOTERMINI, default 0) is the
//   least crest strength this consumer draws for any wave that reaches it, so a far, faint wave still shows on a thin
//   window (the footer's mini strip): radialAnswer(w, R) is the pure rule.
// - opts.onStats(s) is called every few frames: { T, beta, phase, q, e, ePer, yes, flips, sweeps, rate, w, h, n,
//   index, item, note }.
// </claudes_code_comments>

import { createField } from './field.js';
import { createRenderer, isClearBackground, withItemLook, resolveItemLook } from './render.js';
import { createGlRenderer } from './glrender.js';
import { makeSchedule } from './schedule.js';
import { toTarget, loadTarget, describe, pendingShape } from './target.js';
import { ensureShape } from './shapes.js';
import { addTick } from './ticker.js';
import { createTraces } from './traces.js';
import { loadFilm, fitBits, changedLights, agreementOn } from './film.js';
import { createTrueTime } from './truetime.js';
import { masterBeat } from './masterbeat.js';
import { isLive, liveFrame, LIVE_DEFAULTS, LIVE_FRAMES } from './live.js';
import { createMorph } from './morph.js';
import { effectHolds } from './radialeffects.js';
import { weatherOf } from './weather.js';
import { createRim, crackleRng, crackleFrame } from './crackle.js';
import { fortyCrackleOf, fortyLitCycle } from './fortycrackle.js';
// the scanline generator (fortyscan.js) loads on demand, once per page, the first time a lit phase arrives: a page
// that never turns THE 40 Hz LIGHT on never loads it (lane FORTYSCAN; tests/bundleslim.test.mjs in settle-site)
let fortyScan = null;
let fortyScanLoad = null;
// starts the generator's load if it has not started; resolves to the module (or null if the load failed, in which case
// the next lit phase tries again). A page or a test may call it to have the generator ready before the light goes on
export function fortyScanReady() {
  if (fortyScan) return Promise.resolve(fortyScan);
  if (!fortyScanLoad) {
    fortyScanLoad = import('./fortyscan.js').then(
      (m) => (fortyScan = m),
      () => ((fortyScanLoad = null), null),
    );
  }
  return fortyScanLoad;
}
// 'idle' (never asked for), 'loading' or 'ready'
export const fortyScanState = () => (fortyScan ? 'ready' : fortyScanLoad ? 'loading' : 'idle');
const fortyScanNow = () => (fortyScan || (fortyScanReady(), null));
import { registerSettle, clickPulse } from './global.js';
import { fortyHz } from './fortyhz.js';
import { tickerHeld } from './ticker.js';
import { DRAG, createDragGesture, dragTiming, placeChildren, stepChildren, splitChildren, stepEscape, createInterference, capList, rooms, nudgeKids, createNoiseGate } from './dragbox.js';
import * as globalBus from './global.js';

// THE DRAG BOX's sound and page answer for one child (a birth or a merge). THE RADIAL PULSE BUS (lane RADIALPULSE,
// global.js clickPulse) plays the click noise AND sends a page pulse every settle, background and sound answers;
// until that lands on the line, a LOCAL ripple plays the noise, as the hero's click does
export function dragPulse(spec, bus = globalBus) {
  // a birth THE NOISE GATE held back (lane MULTIRECT) is sound: false: the page pulse without the noise
  const s = { ...spec, kind: 'drop', sound: spec.sound !== false };
  if (typeof bus.clickPulse === 'function') return bus.clickPulse(s);
  return bus.ripple({ ...s, scope: 'local' });
}

// a drop's refusal on the picture's side, on the window event settle-hear also uses ('settle:dragsound')
export function tellDropSound(detail) {
  if (typeof window === 'undefined' || !window.dispatchEvent || typeof CustomEvent === 'undefined') return;
  try { window.dispatchEvent(new CustomEvent('settle:dragsound', { detail })); } catch { /* fine */ }
}
// THE OBSERVER'S BATCH (lane DJVISUAL): an IntersectionObserver may hand one callback several entries for one target,
// oldest first (a panel that opens grows its child from clipped to shown inside one frame: [hidden, shown]). The state
// is the LAST entry's; reading the first left such a settle paused as hidden for good (measured: 1 frame in 6 s)
export const seenNow = (entries, was = true) => (entries && entries.length ? !!entries[entries.length - 1].isIntersecting : was);

// every live settle's meter, for tools/perf and the perf ladder's budget test (globalThis.__settlePerfs)
const LIVE = new Set();
export function settlePerfs() {
  return [...LIVE].map((x) => ({ label: x.label(), renderer: x.kind(), ...x.perf }));
}
if (typeof globalThis !== 'undefined') globalThis.__settlePerfs = settlePerfs;

// THE PAGE'S QUALITY: one setting a site applies once at load (its perf ladder) that scales every settle that does
// not opt out (opts.quality = false): resScale multiplies a numeric res (a density; an exact [w, h] grid is never
// changed), fpsScale multiplies fps. A settle that the ladder sets itself (the hero, the footer) passes
// quality: false and its own res and fps. Settles already mounted keep what they had: the level never flaps.
const QUALITY = { resScale: 1, fpsScale: 1 };
// THE CLICK RINGS, as a pure rule (lane FOOTERLADDER): what one click adds, for the default pulses or for a gentle
// opts.rings. Returns { rings: [{ r, speed, width, wait, max, bright }], strands, strandLife, star }. Default: the
// pulses this file always drew (count 4 + power - 1, speed max(0.8, w / 160) lights a frame growing with power, to the
// grid's far corner, the fade floored at 0.15). Gentle: count rings that reach their radius in ms at this fps.
export function ringsFor(o, geom, fps, power = 1) {
  const far = Math.hypot(geom.w, geom.h);
  const g = o.rings;
  if (!g) {
    const n = (o.pulses ?? 4) + power - 1;
    const speed = Math.max(0.8, geom.w / 160) * (1 + 0.18 * (power - 1));
    const width = 0.55 + 0.22 * (power - 1);
    const rings = [];
    for (let j = 0; j < n; j++) rings.push({ r: 0, speed, width, wait: j * Math.max(3, 7 - power), max: far, bright: 1, floor: 0.15 });
    return { rings, strands: 16 + 10 * (power - 1), strandLife: null, star: 1 };
  }
  const count = Math.max(1, Math.round(g.count ?? 2));
  const max = Math.max(2, (g.reach ?? 0.2) * Math.min(geom.w, geom.h));
  const frames = Math.max(2, ((g.ms ?? 700) / 1000) * fps);
  const gap = Math.max(1, Math.round(((g.gapMs ?? 160) / 1000) * fps));
  const rings = [];
  for (let j = 0; j < count; j++) rings.push({ r: 0, speed: max / frames, width: g.width ?? 0.45, wait: j * gap, max, bright: g.bright ?? 0.5, floor: 0 });
  return { rings, strands: Math.max(0, Math.round(g.sparks ?? 4)), strandLife: Math.max(2, Math.round(frames)), star: g.bright ?? 0.5 };
}

// THE ECHO (lane FOOTERRADIAL): the rings a settle draws when a wave from elsewhere reaches it (handle.echo): its own
// click's rings (ringsFor at power 1), or the gentle rings `spec` names in the same shape as opts.rings, their
// brightness and the star scaled by level (0..1), the strands kept to the same count or fewer. Pure, so the footer's
// answer is pinned in a test.
// THE RADIAL ANSWER (lanes FOOTERLADDER and FOOTERMINI): one consumer's own crest for a page wave, from opts.radial
// { gain, band, floor }: the strength times gain, never under floor (when the wave has any strength at all), never
// past 1; the band times band. Absent, the wave as it is. Pure, so the footer's answer is pinned in a test.
export function radialAnswer(w, R = null) {
  if (!R) return w;
  const a = Math.max(0, Number(w?.a) || 0) * (R.gain ?? 1);
  const floor = Math.max(0, R.floor ?? 0);
  return { ...w, a: a > 0 ? Math.min(1, Math.max(floor, a)) : 0, band: (w?.band ?? 0) * (R.band ?? 1) };
}

// THE FRONT (lane FOOTERMINI): the lights of a w x h grid that a ring of radius R (width lights thick) about (cx, cy)
// crosses, in the rows row0..row1 only. Row by row it solves the circle for its two x, so a thin window (the footer's
// 10-row strip) costs a few cells a row and never walks the whole ring. Pure; returns a Set of light indices.
export function frontCells(cx, cy, R, width, w, h, row0 = 0, row1 = h - 1, into = new Set()) {
  if (!(R > 0) || !(w > 0) || !(h > 0)) return into;
  const half = Math.max(0.5, width / 2);
  const y0 = Math.max(0, Math.floor(row0));
  const y1 = Math.min(h - 1, Math.ceil(row1));
  for (let y = y0; y <= y1; y++) {
    const dy = y - cy;
    for (let rr = Math.max(0, R - half); rr <= R + half + 1e-9; rr += 0.7) {
      if (Math.abs(dy) > rr) continue;
      const dx = Math.sqrt(rr * rr - dy * dy);
      for (const x of [Math.round(cx - dx), Math.round(cx + dx)]) if (x >= 0 && x < w) into.add(y * w + x);
    }
  }
  return into;
}

export function echoRings(o, geom, fps, level = 1, spec = null) {
  const L = Math.min(1, Math.max(0, Number.isFinite(level) ? level : 0));
  const plan = ringsFor(spec ? { ...o, rings: spec } : o, geom, fps, 1);
  return {
    rings: plan.rings.map((g) => ({ ...g, bright: g.bright * L })),
    strands: Math.round(plan.strands * Math.min(1, 0.5 + L / 2)),
    strandLife: plan.strandLife,
    star: plan.star * L,
  };
}

export function setQuality(q = {}) {
  if (q.resScale > 0) QUALITY.resScale = Math.min(1, q.resScale);
  if (q.fpsScale > 0) QUALITY.fpsScale = Math.min(1, q.fpsScale);
  return { ...QUALITY };
}
export function getQuality() {
  return { ...QUALITY };
}

// a page ripple's temperature kick fades by this factor every frame
export const GLOBAL_KICK_DECAY = 0.86;
// the most frames a field may hold off its rest for the lights a morph changed (THE OWED LIGHTS): 5 s at 24 fps
export const OWED_MAX_FRAMES = 120;

const reducedMotion = () => typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

const optKey = (v) => JSON.stringify(v, (k, x) => (typeof x === 'function' ? x.toString() : x));

// handing set() every option re-targets the picture (items present means "new items"), so a control panel that
// moves one slider would restart the word; pass only what changed
export function changedOptions(prev = {}, next = {}) {
  const out = {};
  for (const k of Object.keys(next)) if (optKey(prev[k]) !== optKey(next[k])) out[k] = next[k];
  return out;
}

export function settle(canvas, options = {}) {
  const defined = (x) => Object.fromEntries(Object.entries(x).filter(([, v]) => v !== undefined));
  let o = { res: 160, fps: 24, sweeps: 1, poke: true, lean: 0.9, pull: 0.3, seed: 1, statsEvery: 4, ...defined(options) };
  // the page quality at mount, held for this settle's life
  const q = o.quality === false ? { resScale: 1, fpsScale: 1 } : getQuality();
  const resOf = () => (Array.isArray(o.res) ? o.res : Math.max(8, Math.round(o.res * q.resScale)));
  const fpsOf = () => Math.max(1, o.fps * q.fpsScale);
  const stillSchedule = () => (o.still ? { kind: 'fixed', T: o.stillT ?? 0.3 } : o.schedule);
  const resting = () => o.rest ?? !!o.still;
  // the drawing path is chosen once, at mount: a canvas holds one kind of context for life. 'gl' asks for WebGL2 and
  // falls back to 2D when the browser cannot give one (or the shader fails to build)
  let gl = null;
  if (o.renderer === 'gl') {
    try {
      // background 'transparent' needs a context with alpha, premultiplied (the shader writes premultiplied light);
      // the default stays opaque. Read at mount, as the renderer is
      const clear = isClearBackground(o.background);
      gl = canvas.getContext('webgl2', { alpha: clear, antialias: false, depth: false, stencil: false, premultipliedAlpha: clear, preserveDrawingBuffer: false, powerPreference: 'low-power' });
    } catch {
      gl = null;
    }
  }
  const ctx = gl ? null : canvas.getContext('2d');
  let F = null;
  let R = null;
  let sched = makeSchedule(stillSchedule());
  let frame = o.offset ?? 0;
  let quiet = 0;
  let index = -1;
  let paused = !!o.paused;
  let visible = true;
  let dead = false;
  let geom = null;
  let rate = 0;
  let rateT = 0;
  let rateN = 0;
  const cache = new Map();
  let TR = null;
  let power = 0;
  let lastClick = -1e9;
  // THE GLOBAL SETTLE: the wavefronts of page ripples crossing this settle (one per ripple, the latest frame) and
  // the temperature kick their arrival gave
  const waves = new Map();
  let kick = 0;
  // THE WEATHER (lane SOUNDSHAKE): the fractional sweep carried between frames, the last frame's sweep count, and the
  // lights a lens-flare streak held last frame (let go each frame, as the wavefronts' are)
  let sweepAcc = 0;
  let lastSweeps = o.sweeps;
  let streakLit = [];
  // THE EDGE CRACKLE (lane CLEARTEXT, crackle.js): the target's rim, found again when the target changes or every few
  // frames (a live item may rewrite its target in place), and the crackle's own generator (never the physics')
  const rim = createRim();
  let rimOf = null;
  let rimFrame = -1e9;
  const crackRng = crackleRng(((o.seed ?? 1) * 2654435761) >>> 0);
  const crackle = (c) => {
    if (!c || !geom) return;
    if (F.target !== rimOf || frame - rimFrame >= 6) {
      rim.update(F.target, geom.w, geom.h);
      rimOf = F.target;
      rimFrame = frame;
    }
    crackleFrame(F, rim, c, crackRng);
  };
  // THE 40 Hz CRACKLE (lane FORTYCRACKLE, fortycrackle.js; TV scanlines since lane FORTYSCAN): while the page's 40 Hz
  // light is on and the frame drawn is lit, scanlines brighten this picture's lit lights through the draw-only flash,
  // advancing once per lit phase of the gate's clock; a dark frame brightens nothing. fortyCrackle: false (or
  // fortyHz: false) opts out; an object tunes it inside FORTY_CRACKLE_LIMITS
  const fcOpts = o.fortyHz === false ? null : fortyCrackleOf(o.fortyCrackle ?? true);
  const fortyGate = fcOpts ? fortyHz() : null;
  let FC = null;
  let fcCycle = 0;
  const fortyLit = () => !!F && !!geom && fortyLitCycle(fortyGate) >= 0;
  const fortyFrame = () => {
    const c = fortyLitCycle(fortyGate);
    // globalThis.__settleFortyCrackleOff = true holds every crackle off (a measurement switch: the brightness tool
    // compares the same picture with the crackle off and on, seconds apart)
    if (c < 0 || !F || !geom || globalThis.__settleFortyCrackleOff) return 0;
    const t0 = clock();
    if (!FC) {
      const scan = fortyScanNow();
      if (!scan) return 0; // the generator is still loading: this lit phase draws no lines
      FC = scan.createFortyCrackle(geom.w, geom.h, { ...fcOpts, seed: (((o.seed ?? 1) * 40503) ^ 0x40c0ffee) >>> 0 });
      fcCycle = c;
    } else FC.resize(geom.w, geom.h);
    // once per lit phase: a picture drawing twice in one phase draws the same set; one that missed phases catches up
    if (c !== fcCycle) {
      FC.advance(c > fcCycle ? c - fcCycle : 1);
      fcCycle = c;
    }
    const k = FC.draw(F, F.target);
    perf.forty += clock() - t0;
    return k;
  };
  // SMALL FILMS: an item { film: url } or { frames: [...] } is a list of targets the lights re-settle through
  const films = new Map(); // url -> null while loading, { meta, frames } when loaded, { error } on failure
  // TRUE TIME for a film (truetime.js): the movie behind keeps its own pace on the wall clock (one frame every
  // 1000 / fps ms, 500 ms at the default 2 fps); the field settles toward the frame it shows, and once its overlap
  // with that frame reaches the threshold it jumps to whatever frame the movie is at then
  // the clock is THE MASTER BEAT's (masterbeat.js) unless a test injects one: every film and live item on the page
  // turns its frames on the same master ticks
  const filmClock = o.now ?? masterBeat().now;
  let FT = null; // the current film's true-time clock (null until its frames have arrived)
  let MO = null; // a running morph (morph.js): the field settles from the old target to the new one in true time
  // THE OWED LIGHTS (lane HEROPASS): the lights a morph changes, from what was LIT to the new target. Until they all
  // agree with the target (or OWED_MAX_FRAMES pass) the field may not rest, so a word left half-settled by a morph
  // begun while another was still running is not frozen in place by the rest rule.
  let owed = null;
  let owedFrames = 0;
  let rampFrom = null; // the target (Int8Array) the ramp tween starts from, and when
  let rampT0 = 0;
  let filmWork = null; // the lights the last jump changed: TRUE TIME's agreement is measured on these alone
  let shownFrame = -1;
  let ramping = false; // true while the film tween has set per-light leans on the field
  let rampBuf = null;
  const animate = () => !(reducedMotion() && o.motion !== 'always');
  const isFilm = (it) => !!(it && typeof it === 'object' && (it.film || it.frames));
  const ensureFilm = (it) => {
    if (!it?.film || films.has(it.film)) return;
    films.set(it.film, null);
    loadFilm(it.film, { fetch: o.fetch })
      .then((f) => { films.set(it.film, f); quiet = 0; })
      .catch((error) => {
        // item.fallback: a second film to play when the first cannot load (a dev-only film on a fresh checkout)
        if (!it.fallback) return films.set(it.film, { error });
        loadFilm(it.fallback, { fetch: o.fetch })
          .then((f) => { films.set(it.film, { ...f, fellBack: it.fallback }); quiet = 0; })
          .catch((e2) => films.set(it.film, { error: e2 }));
      });
  };
  const filmLength = (it) => (it.frames ? it.frames.length : films.get(it.film)?.frames?.length || 0);
  const filmFps = (it) => it.fps ?? films.get(it.film)?.meta?.fps ?? 1;
  const tracesOn = () => !!(o.traces || o.echoes);
  const makeTraces = () => { TR = tracesOn() ? createTraces(F, typeof o.traces === 'object' ? o.traces : {}) : null; };

  // THE ITEM LOOK (lane HEROHYPER): the neonLook of the item showing now (render.js withItemLook; opts.itemLooks false
  // turns it off, so a caller's own colours win)
  let itemLook = null;
  const look = () => withItemLook({ color: o.color, neon: o.neon, off: o.off, heat: o.heat, dim: o.dim, glow: o.glow, core: o.core, seed: o.seed, echoColour: o.echoColour, heldColour: o.heldColour, flashColour: o.flashColour, palette: o.palette, level: o.level, clear: isClearBackground(o.background), yes: o.yes, coreMix: o.coreMix, itemLooks: o.itemLooks }, itemLook);
  // THE PAINT (lane LOGOHOVER): the 'map' colour mode's per-light colours through settle(): opts.paint is
  // { hue: Uint8Array, gain: Float32Array } or a function (field, timeSec) => that, read at every draw
  const paintOf = (now) => (typeof o.paint === 'function' ? o.paint(F, now) : o.paint ?? null);

  const items = () => {
    if (o.items?.length) return o.items;
    return [o.target ?? (o.shape ? { shape: o.shape } : o.word != null ? { word: o.word } : { word: 'SETTLE' })];
  };

  const targetFor = (spec) => {
    if (isLive(spec)) return (geom && liveFrame(spec, geom.w, geom.h, filmClock())) || new Int8Array(geom.w * geom.h).fill(-1);
    if (isFilm(spec)) {
      ensureFilm(spec);
      return filmTarget(spec, 0);
    }
    const key = `${geom.w}x${geom.h}:${typeof spec === 'string' ? spec : JSON.stringify(spec, (k, v) => (typeof v === 'function' ? v.toString() : k === 'image' && typeof v !== 'string' ? v.src : v))}`;
    if (cache.has(key)) return cache.get(key);
    let t;
    // an image URL, or a shape of a lazy family whose drawing has not arrived (the credits family, lane LAUNCHGATES):
    // an unlit field now, the real target as soon as it loads
    if ((spec && typeof spec.image === 'string') || pendingShape(spec)) {
      t = new Int8Array(geom.w * geom.h).fill(-1);
      loadTarget(spec, geom.w, geom.h).then((real) => {
        cache.set(key, real);
        if (F && F.target === t) F.setTarget(real);
      }, () => {});
    } else t = toTarget(spec, geom.w, geom.h);
    cache.set(key, t);
    return t;
  };

  const filmTarget = (it, k) => {
    if (it.frames) return targetFor(it.frames[Math.min(k, it.frames.length - 1)]);
    const st = films.get(it.film);
    if (!st?.frames) return F?.target ?? new Int8Array(geom.w * geom.h).fill(-1);
    const key = `${geom.w}x${geom.h}:film:${it.film}:${k}:${it.fill ?? 0.92}`;
    if (!cache.has(key)) cache.set(key, fitBits(st.frames[k], st.meta.width, st.meta.height, geom.w, geom.h, { fill: it.fill ?? 0.92 }));
    return cache.get(key);
  };

  const layout = () => {
    const dpr = Math.min(2, (typeof devicePixelRatio !== 'undefined' && devicePixelRatio) || 1);
    const cw = Math.max(1, Math.round(canvas.clientWidth * dpr));
    const ch = Math.max(1, Math.round(canvas.clientHeight * dpr));
    // assigning a canvas's width clears it, so a resize that leaves the drawing buffer the same size touches nothing
    if (canvas.width !== cw) canvas.width = cw;
    if (canvas.height !== ch) canvas.height = ch;
    let w;
    let h;
    let P;
    const res = resOf();
    if (Array.isArray(res)) {
      [w, h] = res;
      const k = Math.min(cw / w, ch / h);
      P = Math.max(1, o.fit ? Math.ceil(k) : Math.floor(k));
    } else {
      P = Math.max(2, Math.round(cw / res));
      w = Math.ceil(cw / P);
      h = Math.ceil(ch / P);
    }
    const changed = !geom || geom.w !== w || geom.h !== h;
    // fit: the plate is drawn at the next whole pitch up and scaled down to fill the canvas, so an exact grid has no
    // black margin; dw, dh is the drawn size and P the plate's pitch (the pointer maps through the scale)
    const sc = Array.isArray(o.res) && o.fit ? Math.min(cw / (w * P), ch / (h * P)) : 1;
    const dw = Math.round(w * P * sc);
    const dh = Math.round(h * P * sc);
    geom = { cw, ch, w, h, P, sc, dw, dh, ox: Math.floor((cw - dw) / 2), oy: Math.floor((ch - dh) / 2) };
    if (changed) {
      cache.clear();
      const list = items();
      const i = Math.max(0, index) % list.length;
      F = createField({ w, h, lean: o.lean, pull: o.pull, seed: o.seed, target: targetFor(list[i]), init: o.still ? 'target' : 'random' });
      makeTraces();
      R?.destroy?.();
      R = null;
      if (gl) {
        try {
          R = createGlRenderer(gl, { w, h, pitch: P, glDebug: o.glDebug, ...look() });
        } catch {
          R = null; // a shader this GPU will not build: the settle draws nothing rather than throwing
        }
      }
      if (!gl) R = createRenderer({ w, h, pitch: P, ...look() });
      quiet = 0;
    } else R?.set({ pitch: P });
  };

  const draw = () => {
    if (!R) return;
    const now = typeof performance !== 'undefined' ? performance.now() / 1000 : 0;
    const echo = TR && o.echoes && TR.length > 1 ? TR.echo(o.echoes, o.echoDecay ?? 0.8, now * 5) : null;
    const paint = o.color === 'map' ? paintOf(now) : null;
    if (R.direct) {
      R.draw(F, { echo, time: now, paint }, geom, o.background ?? '#000');
      return;
    }
    const plate = R.render(F, { echo, time: now, paint });
    if (isClearBackground(o.background)) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.clearRect(0, 0, geom.cw, geom.ch);
    } else {
      ctx.globalCompositeOperation = 'copy';
      ctx.fillStyle = o.background ?? '#000';
      ctx.fillRect(0, 0, geom.cw, geom.ch);
    }
    ctx.globalCompositeOperation = 'source-over';
    if (geom.sc !== 1) {
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(plate, geom.ox, geom.oy, geom.dw, geom.dh);
    } else ctx.drawImage(plate, geom.ox, geom.oy);
  };

  let last = null;
  const report = (T, phase) => {
    if (performance.now() - lastClick > (o.comboMs ?? 1000)) power = 0;
    const item = items()[Math.max(0, index) % items().length];
    last = { power, maxPower: o.maxPower ?? 8, T, beta: 1 / T, phase, ...F.stats(), rate, w: geom.w, h: geom.h, n: geom.w * geom.h, index, item };
    if (isFilm(item)) last.film = { frame: shownFrame, movie: FT ? FT.frameAt(filmClock()) : shownFrame, shown: FT ? FT.history.length : 0, frames: filmLength(item), loading: !!item.film && !films.get(item.film), error: films.get(item.film)?.error ? String(films.get(item.film).error.message ?? films.get(item.film).error) : null };
    if (isLive(item)) last.live = { sample: shownFrame, shown: FT ? FT.history.length : 0, behind: FT ? Math.max(0, FT.frameAt(filmClock()) - FT.showing) : 0, periodMs: FT ? FT.periodMs : null };
    if (MO) last.morph = { showing: MO.showing, frames: MO.frames.length, done: MO.done };
    last.owed = owed ? owed.length : 0;
    if (TT) last.trueTime = { showing: TT.showing, movie: TT.frameAt(), behind: Math.max(0, TT.frameAt() - TT.showing), shown: TT.history.length, threshold: TT.threshold };
    last.note = describe(last.item);
    o.onStats?.(last);
  };

  const snap = () => {
    // a still settle shows its target at once: the lights become the target and the soft read follows
    const t = F.target;
    for (let i = 0; i < F.n; i++) {
      F.s[i] = t[i];
      F.m[i] = t[i] > 0 ? 1 : 0;
    }
  };

  // the ramp tween (films and live items): for the first rampMs after a jump (a quarter of the period by default),
  // each light's lean slides from the target it left (rampFrom, an Int8Array) to the one it now settles toward;
  // 'snap' jumps at once
  const rampStep = (cur) => {
    const rampMs = cur.rampMs ?? FT.periodMs / 4;
    const a = rampFrom === null ? 1 : Math.min(1, (filmClock() - rampT0) / rampMs);
    if (a < 1) {
      const t0 = rampFrom;
      const t1 = F.target;
      if (!rampBuf || rampBuf.length !== F.n) rampBuf = new Float32Array(F.n);
      const L = o.lean;
      for (let i = 0; i < F.n; i++) rampBuf[i] = L * ((1 - a) * t0[i] + a * t1[i]);
      F.setLeans(rampBuf);
      ramping = true;
      quiet = 0;
    } else if (ramping) {
      F.setLeans(null);
      ramping = false;
      rampFrom = null;
    }
  };

  // one frame of the settle: the schedule, the target, the pointer's strands and rings, the sweeps, the hooks
  let lastInfo = null;
  const stepOnce = () => {
    const sch = sched(frame);
    const { T, phase } = sch;
    // TRUE TIME: the item is the frame the movie behind holds, chosen by the true-time clock, not by the schedule
    const k = TT ? TT.showing : sch.index;
    const list = items();
    if (k !== index) {
      index = k;
      const it = list[index % list.length];
      FT = null;
      rampFrom = null;
      filmWork = null;
      shownFrame = -1;
      if (ramping) { F.setLeans(null); ramping = false; }
      MO = null; // the schedule moved on to the next item (already in the new form): no morph is owed
      owed = null;
      if (isFilm(it)) ensureFilm(it);
      else if (!isLive(it)) F.setTarget(targetFor(it));
      // load the NEXT film now, so it is ready when its turn comes (and no earlier); a lazy shape's drawing likewise
      const nx = list[(index + 1) % list.length];
      if (isFilm(nx)) ensureFilm(nx);
      const lazyNext = pendingShape(nx);
      if (lazyNext) ensureShape(lazyNext).catch(() => {});
      if (o.still) snap();
    }
    const cur = list[index % list.length];
    // THE ITEM LOOK: the item's neonLook (a function is read every frame, so a live item may change it mid-slot); a
    // change re-makes the colours once, an unchanged look costs one comparison
    const il = resolveItemLook(cur);
    if (il !== itemLook) { itemLook = il; R?.set(look()); }
    let Tuse = T;
    if (isFilm(cur)) {
      const n = filmLength(cur);
      if (n) {
        const moving = animate();
        if (!moving) {
          // reduced motion or a still settle: one frame (item.still, default the middle one), no clock
          const k = Math.min(n - 1, cur.still ?? Math.floor(n / 2));
          if (k !== shownFrame) {
            shownFrame = k;
            F.setTarget(filmTarget(cur, k));
            if (o.still) snap();
            quiet = 0;
          }
        } else {
          if (!FT) {
            const periodMs = cur.periodMs ?? 1000 / filmFps(cur);
            FT = createTrueTime({ frames: n, periodMs, threshold: cur.threshold ?? o.filmThreshold ?? 0.8, loop: !!cur.loop, now: o.now ?? null });
          }
          if (FT.showing !== shownFrame) {
            const prev = shownFrame;
            shownFrame = FT.showing;
            F.setTarget(filmTarget(cur, shownFrame));
            filmWork = changedLights(F.target, prev >= 0 ? filmTarget(cur, prev) : null);
            rampFrom = prev >= 0 && (cur.tween ?? 'ramp') === 'ramp' ? filmTarget(cur, prev) : null;
            rampT0 = filmClock();
            if (o.still) snap();
            quiet = 0;
          }
          rampStep(cur);
        }
      }
      if (cur.T != null) Tuse = cur.T;
    } else if (isLive(cur)) {
      // a LIVE item (live.js): a film whose frames are made on demand, sampled on TRUE TIME's grid
      if (!animate()) {
        if (shownFrame !== 0) {
          shownFrame = 0;
          const b = liveFrame(cur, geom.w, geom.h, filmClock());
          if (b) F.setTarget(b);
          if (o.still) snap();
          quiet = 0;
        }
      } else {
        if (!FT) FT = createTrueTime({ frames: LIVE_FRAMES, periodMs: cur.periodMs ?? LIVE_DEFAULTS.periodMs, threshold: cur.threshold ?? o.filmThreshold ?? LIVE_DEFAULTS.threshold, loop: true, now: o.now ?? null });
        if (FT.showing !== shownFrame) {
          const first = shownFrame < 0;
          shownFrame = FT.showing;
          const b = liveFrame(cur, geom.w, geom.h, filmClock());
          if (b) {
            const prevT = F.target;
            F.setTarget(b);
            filmWork = changedLights(b, first ? null : prevT);
            rampFrom = !first && (cur.tween ?? 'ramp') === 'ramp' ? prevT : null;
          } else filmWork = null;
          rampT0 = filmClock();
          if (o.still) snap();
          quiet = 0;
        }
        rampStep(cur);
      }
      if (cur.T != null) Tuse = cur.T;
    }
    if (kick > 0.005) Tuse *= 1 + kick;
    // THE WEATHER (lane SOUNDSHAKE): a page's per-frame modulation of the settle's own knobs, applied before the
    // page's beforeStep (which may still adjust F.lean or F.pull from here)
    const W = o.weather ? weatherOf(o.weather({ frame, T: Tuse, phase, index })) : null;
    if (W) {
      Tuse *= W.heat;
      F.lean = o.lean * W.lean;
      F.pull = o.pull * W.pull;
    }
    const info = { frame, T: Tuse, beta: 1 / Tuse, phase, index, filmFrame: shownFrame };
    o.beforeStep?.(F, info);
    sparkle();
    pulse();
    swarm();
    wavefronts();
    streak(W?.streak ?? null);
    crackle(W?.crackle ?? null);
    kick = kick > 0.005 ? kick * GLOBAL_KICK_DECAY : 0;
    // the sweep rate: a weather's rate carries a fractional sweep from frame to frame
    let nSweeps = o.sweeps;
    if (W && W.rate !== 1) {
      sweepAcc += o.sweeps * W.rate;
      nSweeps = Math.floor(sweepAcc);
      sweepAcc -= nSweeps;
    }
    for (let j = 0; j < nSweeps; j++) F.sweep(1 / Tuse);
    lastSweeps = nSweeps;
    F.fade(o.trail ?? 0.86);
    F.fadeFlash(o.flashDecay ?? 0.72);
    // after the fade, so a lit phase's brightened lights are drawn at their full strength
    fortyFrame();
    F.soften(W?.soften ?? o.soften ?? 0.55);
    frame++;
    if (TR && frame % ((typeof o.traces === 'object' && o.traces.every) || 1) === 0) TR.capture({ T, phase });
    o.afterStep?.(F, info);
    if (MO) {
      const r = MO.update(F.s, filmClock());
      if (r.changed) F.setTarget(MO.target);
      if (r.done) {
        MO = null;
        // the movie is over: every light that still disagrees with the new target joins the owed lights
        const out = owed ? Array.from(owed) : [];
        const seen = new Set(out);
        for (let i = 0; i < F.n; i++) if (F.s[i] !== F.target[i] && !seen.has(i)) out.push(i);
        owed = Int32Array.from(out);
        owedFrames = 0;
      }
      quiet = 0;
    }
    if (owed && !MO) {
      // the morph is over: the field still owes the lights it changed until every one agrees with the target
      if (agreementOn(F.s, F.target, owed) === 1 || ++owedFrames > (o.owedMax ?? OWED_MAX_FRAMES)) owed = null;
      else quiet = 0;
    }
    if (TT) TT.update(F.overlap());
    if (FT && !ramping) FT.update(agreementOn(F.s, F.target, filmWork ?? []), filmClock());
    const calm = !kick && !waves.size && !crestLit.length && !streakLit.length && lastInfo && lastInfo.T === Tuse && lastInfo.index === index && lastInfo.filmFrame === shownFrame && !F.holding && (!F.flashing || !!fortyGate?.on) && !sparks.length && !rings.length && !ringLit.length && !groups.length && !dragRings.length;
    // (under the 40 Hz light a flash does not keep a resting picture awake: the rest path below draws its crackle and
    // fades its flashes without moving the physics)
    quiet = calm ? quiet + 1 : 0;
    lastInfo = info;
    return info;
  };

  // the settle's own meter: milliseconds in the physics (sweeps, soft read, hooks) and in the drawing
  const perf = { phys: 0, draw: 0, frames: 0, forty: 0 };
  const live = { perf, label: () => o.perfLabel ?? (geom ? `settle ${geom.w}x${geom.h}` : 'settle'), kind: () => R?.kind ?? (gl ? 'gl-failed' : '2d') };
  LIVE.add(live);
  const clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const step = (now) => {
    // THE ITEM LOOK: a function look that has changed wakes a resting picture, so the new colours are drawn
    if (resting() && quiet > (o.restAfter ?? 24) && index >= 0 && resolveItemLook(items()[index % items().length]) !== itemLook) quiet = 0;
    if (resting() && quiet > (o.restAfter ?? 24)) {
      // a resting picture keeps its physics still; under the 40 Hz light only its crackle moves (draw-only)
      if (fcOpts && F && (fortyLit() || F.flashing)) {
        const t1 = clock();
        F.fadeFlash(o.flashDecay ?? 0.72);
        fortyFrame();
        draw();
        perf.draw += clock() - t1;
        perf.frames++;
      }
      return;
    }
    const t0 = clock();
    const { T, phase } = stepOnce();
    const t1 = clock();
    rateN += lastSweeps;
    if (now - rateT > 1000) {
      rate = (rateN * 1000) / (now - rateT || 1);
      rateT = now;
      rateN = 0;
    }
    draw();
    perf.phys += t1 - t0;
    perf.draw += clock() - t1;
    perf.frames++;
    if (frame % o.statsEvery === 0) report(T, phase);
  };

  const advance = (n) => {
    for (let j = 0; j < n; j++) stepOnce();
    draw();
    if (lastInfo) report(lastInfo.T, lastInfo.phase);
  };

  // prefers-reduced-motion: run the schedule out of sight to its first settled frame (or 60 frames of a fixed one)
  const still = () => {
    if (o.still) {
      advance(1);
      return;
    }
    if (o.stillFrames != null) {
      advance(Math.max(1, o.stillFrames));
      return;
    }
    let n = 0;
    while (n < 600 && sched(frame + n).phase !== 'settled') n++;
    advance(Math.min(600, n + (o.reducedFrames ?? 60)));
    for (let j = 0; j < 12; j++) F.soften(0.55);
    draw();
  };

  // TRUE TIME RENDER (truetime.js): opts.trueTime = { periodMs (500), threshold (0.8), loop (true) } makes the items a
  // movie that keeps its own pace; the field settles toward the frame the clock holds and switches when it agrees
  let TT = null;
  const makeTT = () => {
    TT = o.trueTime ? createTrueTime({ frames: items(), periodMs: o.trueTime.periodMs ?? 500, threshold: o.trueTime.threshold ?? 0.8, loop: o.trueTime.loop ?? true }) : null;
  };
  makeTT();
  layout();
  const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => { layout(); draw(); }) : null;
  ro?.observe(canvas);
  const io = typeof IntersectionObserver !== 'undefined' ? new IntersectionObserver((es) => { visible = seenNow(es, visible); }, { rootMargin: '120px' }) : null;
  io?.observe(canvas);

  let loop = null;
  const start = () => {
    loop?.();
    loop = addTick((now) => { if (!paused && visible && !dead) step(now); }, fpsOf(), o.perfLabel ?? `settle ${geom.w}x${geom.h}`, { beat: !!o.beat });
  };

  let lastPoke = null;
  let sparks = [];
  let rings = [];
  const star = (x, y, strength) => {
    // thin twinkling rays: four long, four short, a random turn each time so the star glitters
    const L = Math.max(3, geom.w / 70);
    const turn = F.rng.unit() * Math.PI;
    for (let k = 0; k < 8; k++) {
      const a = turn + (k * Math.PI) / 4;
      const len = (k % 2 ? 0.45 : 1) * L * (0.6 + 0.6 * F.rng.unit());
      for (let r = 1; r <= len; r++) F.hold(x + Math.cos(a) * r, y + Math.sin(a) * r, 0.6, o.pokeValue ?? 1, strength * (1 - r / (len + 1)));
    }
  };
  const sparkle = () => {
    // strands: each moves a little every frame and holds the light it passes, a thin line fading behind it
    if (!sparks.length) return;
    const v = o.pokeValue ?? 1;
    sparks = sparks.filter((p) => {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life--;
      if (p.life <= 0 || p.x < 0 || p.y < 0 || p.x >= geom.w || p.y >= geom.h) return false;
      F.hold(p.x, p.y, 0.6, v, Math.min(1, p.life / 12));
      return true;
    });
    if (lastPoke && performance.now() - lastPoke.wall < 700) star(lastPoke.x, lastPoke.y, 0.8);
  };
  // a gentle ring (opts.rings) is a crest, not a trail: the lights it held last frame are let go before it moves on, so
  // a slow settle shows one thin travelling ring instead of a stack of fading copies (lane FOOTERLADDER)
  let ringLit = [];
  const pulse = () => {
    for (const i of ringLit) F.held[i] = 0;
    ringLit = [];
    // rings: each waits its turn, then grows by `speed` lights a frame, holding the thin circle it sweeps through
    if (!rings.length) return;
    const v = o.pokeValue ?? 1;
    rings = rings.filter((g) => {
      if (g.wait-- > 0) return true;
      g.r += g.speed;
      if (g.r > g.max) return false;
      if (g.floor === 0) {
        // gentle: one light wide, fading from its brightness to nothing at its reach
        const a = g.bright * (1 - g.r / g.max);
        const steps = Math.ceil(2 * Math.PI * g.r * 1.2);
        for (let j = 0; j < steps; j++) {
          const t = (j / steps) * Math.PI * 2;
          const xi = Math.round(g.x + Math.cos(t) * g.r);
          const yi = Math.round(g.y + Math.sin(t) * g.r);
          if (xi < 0 || yi < 0 || xi >= geom.w || yi >= geom.h) continue;
          const i = yi * geom.w + xi;
          F.holdIndex(i, v, a);
          ringLit.push(i);
        }
        return true;
      }
      // the default pulses fade to a floor of 0.15 over 80% of the far corner
      const fade = Math.max(g.floor, 1 - g.r / (g.max * 0.8));
      const steps = Math.ceil(2 * Math.PI * g.r * 1.2);
      for (let j = 0; j < steps; j++) {
        const a = (j / steps) * Math.PI * 2;
        F.hold(g.x + Math.cos(a) * g.r, g.y + Math.sin(a) * g.r, g.width, v, fade);
      }
      return true;
    });
  };
  // THE DRAG BOX's children (dragbox.js), in two phases. INSIDE (the first g.inside frames, while the box fades): each
  // child repels and swirls in its rectangle (stepChildren), a twinkle sending a ring every g.every frames clipped to
  // the box. ESCAPED (the rest, 80%): each child splits in two (splitChildren) and roams the whole picture on its own
  // curving path (stepEscape). Every drag ring is a crest and a trough added into ONE interference sum
  // (createInterference), so where rings cross they brighten or cancel; a light is then held on or off by the sum.
  let groups = [];
  let dragRings = [];
  let IF = null;
  const swarm = () => {
    if ((!groups.length && !dragRings.length) || !geom) return;
    const v = o.pokeValue ?? 1;
    const W = geom.w;
    const H = geom.h;
    const short = Math.min(W, H);
    const all = { x0: 0, y0: 0, x1: W - 1, y1: H - 1 };
    // THE ONE ROOM and THE CROSS PULL (lane MULTIRECT): every group reads the others where they stood at the start of
    // this frame, so the order the groups are stepped in changes nothing
    const snap = new Map(groups.map((g) => [g, g.kids.map((c) => ({ x: c.x, y: c.y, mass: c.mass }))]));
    const inner = groups.filter((g) => !g.out);
    const roomNo = rooms(inner.map((g) => g.box));
    const roomOf = new Map(inner.map((g, i) => [g, roomNo[i]]));
    const outer = groups.filter((g) => g.out);
    // past four boxes each twinkle rings less often, so ten boxes cost about what four did (lane MULTIRECT)
    const spread = Math.max(1, groups.length / 4);
    groups = groups.filter((g) => {
      const every = Math.round(g.every * spread);
      g.age++;
      const size = Math.min(g.box.x1 - g.box.x0, g.box.y1 - g.box.y0);
      if (g.age === g.inside) {
        g.kids = splitChildren(g.kids, () => F.rng.unit()); // the fractal touch: 4 become 8 as the box goes
        g.out = true;
      }
      let room = null;
      if (g.out) {
        const others = outer.length > 1 ? outer.filter((h) => h !== g).flatMap((h) => snap.get(h)) : [];
        g.kids = stepEscape(g.kids, all, { life: g.life, others });
      } else {
        const mates = roomOf.has(g) ? inner.filter((h) => h !== g && roomOf.get(h) === roomOf.get(g)) : [];
        room = mates.length ? [g.box, ...mates.map((h) => h.box)] : null;
        g.kids = stepChildren(g.kids, g.box, { life: 1e9, room, others: mates.flatMap((h) => snap.get(h)) }).kids;
      }
      // a ring is clipped to the room's box the twinkle stands in (its own first)
      const clipOf = (c) => (room ? room.find((B) => c.x >= B.x0 && c.x <= B.x1 && c.y >= B.y0 && c.y <= B.y1) ?? g.box : g.box);
      // the last quarter of the life fades every ring the group sends, so it ends gradually
      const tail = Math.min(1, Math.max(0, (g.life - g.age) / (0.25 * g.life)));
      for (const c of g.kids) {
        F.hold(c.x, c.y, 0.6 * Math.sqrt(c.mass), v, tail);
        star(c.x, c.y, (g.out ? 0.75 : 1) * tail);
        if (c.age % every !== 1) continue;
        if (!g.out) {
          const width = Math.max(0.55, size / 90);
          dragRings.push({ x: c.x, y: c.y, r: 0, speed: Math.max(0.35, size / 36), width, lambda: Math.max(3, width * 5), amp: 0.62 * tail, clip: clipOf(c), max: g.max * 0.6 });
        } else {
          const width = Math.max(0.6, short / 160);
          dragRings.push({ x: c.x, y: c.y, r: 0, speed: Math.max(0.5, short / 50), width, lambda: Math.max(4, width * 5), amp: 0.55 * Math.sqrt(c.mass * 2) * tail, clip: null, max: short * 0.45 });
        }
      }
      return g.age < g.life && g.kids.length > 0;
    });
    if (dragRings.length > DRAG.maxRings) dragRings = dragRings.slice(dragRings.length - DRAG.maxRings);
    if (!dragRings.length) return;
    if (!IF || IF.size !== W * H) IF = createInterference(W, H);
    dragRings = dragRings.filter((r) => {
      r.r += r.speed;
      if (r.r > r.max) return false;
      IF.ring({ x: r.x, y: r.y, r: r.r, width: r.width, lambda: r.lambda, amp: r.amp * (1 - r.r / r.max), clip: r.clip });
      return true;
    });
    IF.flush((i, s) => {
      const a = Math.abs(s);
      if (a < 0.12) return; // a crest and a trough cancelled here: the picture shows through
      F.hold(i % W, (i / W) | 0, 0.5, s > 0 ? v : -v, Math.min(1, a));
    });
  };

  // a page ripple's wavefront, in this canvas's lights
  const toLights = (w) => {
    const k = geom.cw / Math.max(1, w.w || canvas.clientWidth || 1);
    const u = 1 / (geom.P * geom.sc);
    return { x: (w.x * k - geom.ox) * u, y: (w.y * k - geom.oy) * u, s: k * u };
  };
  // THE STREAK (lane SOUNDSHAKE): a lens-flare streak across the field, as a band of holds for this frame only: a
  // line through (x, y) (fractions of the grid) tilted by `tilt` radians, `width` lights thick, its strength falling
  // off from the flare's centre over `reach` of the grid's width, each light shimmering by `shimmer` (field.rng)
  const streak = (S) => {
    if (streakLit.length) {
      for (const i of streakLit) F.held[i] = 0;
      streakLit = [];
    }
    if (!S || !(S.strength > 0) || !geom) return;
    const v = o.pokeValue ?? 1;
    const W = geom.w;
    const H = geom.h;
    const x0 = (S.x ?? 0.5) * W;
    const y0 = (S.y ?? 0.5) * H;
    const k = Math.tan(S.tilt ?? 0);
    const half = Math.max(0.5, (S.width ?? 1.5) / 2);
    const reach = Math.max(1, (S.reach ?? 0.4) * W);
    const sh = Math.min(1, Math.max(0, S.shimmer ?? 0.3));
    const a = Math.min(0.6, S.strength);
    for (let x = 0; x < W; x++) {
      const fall = Math.exp(-(((x - x0) / reach) ** 2));
      if (fall < 0.05) continue;
      const yc = y0 + (x - x0) * k;
      for (let y = Math.max(0, Math.ceil(yc - half)); y <= Math.min(H - 1, Math.floor(yc + half)); y++) {
        const i = y * W + x;
        F.holdIndex(i, v, a * fall * (1 - sh + sh * F.rng.unit()) * (1 - Math.abs(y - yc) / (half + 0.5)));
        streakLit.push(i);
      }
    }
  };
  // the wavefront moves on every frame: the lights it held last frame are let go (the physics relaxes them), so the page sees one
  // travelling crest (bright) with a trough just behind it (off), never a stack of rings
  let crestLit = [];
  const wavefronts = () => {
    if (!waves.size && !crestLit.length) return;
    for (const i of crestLit) F.held[i] = 0;
    crestLit = [];
    const v = o.pokeValue ?? 1;
    // THE RADIAL EFFECTS (radialeffects.js): each wave draws its own member's crest (a user's click: a crest and a
    // trough; a sound's shimmer, double rings or spokes), as holds on the lights for this frame only
    const hold = (i, sign, a) => { F.hold(i % geom.w, (i / geom.w) | 0, 0.5, sign * v, a); crestLit.push(i); };
    for (const w of waves.values()) {
      const L = toLights(w);
      effectHolds(w.effect ?? 'click', { x: L.x, y: L.y, R: w.r * L.s, band: w.band * L.s, a: w.a, turn: w.turn ?? 0 }, geom.w, geom.h, hold);
    }
    waves.clear();
  };
  const softPulse = (p) => {
    // reduced motion: one soft flash on the lights nearest the ripple, drawn once, then gone
    if (!geom || !F || dead) return;
    const L = toLights(p);
    const cx = Math.min(geom.w - 1, Math.max(0, L.x));
    const cy = Math.min(geom.h - 1, Math.max(0, L.y));
    const rad = Math.max(3, Math.min(geom.w, geom.h) / 6);
    // soft: the flash fades with distance from the nearest point, and never reaches white
    const base = 0.12 + 0.28 * Math.min(1, p.a);
    for (let y = Math.max(0, Math.floor(cy - rad)); y <= Math.min(geom.h - 1, Math.ceil(cy + rad)); y++) {
      for (let x = Math.max(0, Math.floor(cx - rad)); x <= Math.min(geom.w - 1, Math.ceil(cx + rad)); x++) {
        const d = Math.hypot(x - cx, y - cy) / rad;
        if (d <= 1) F.flash([y * geom.w + x], base * (1 - d) * (1 - d));
      }
    }
    draw();
    const T = setTimeout(() => { if (!dead && F) { F.fadeFlash(0); draw(); } }, p.ms ?? 450);
    T?.unref?.();
  };
  const unregister = o.global === false ? null : registerSettle({
    id: o.globalId ?? null,
    el: canvas,
    wave(w) {
      if (dead || paused || !visible || !geom || !F) return;
      // opts.radial (lane FOOTERLADDER): this consumer's own softer answer; the wave itself is unchanged
      waves.set(w.id, radialAnswer(w, o.radial));
      quiet = 0;
    },
    arrive(a) {
      if (dead || paused || !visible || !F) return;
      kick = Math.min(1.2, kick + a.kick * (o.radial?.kick ?? 1));
      quiet = 0;
    },
    pulse: softPulse,
  });
  // THE 40 Hz LIGHT, ONE MODE (fortyhz.js): every settle's canvas joins the page's one 40 Hz clock, named by its label;
  // fortyHz: false opts out
  const unlight = o.fortyHz === false ? null : fortyHz().register(canvas, o.fortyHzName ?? canvas.getAttribute?.('aria-label') ?? o.globalId ?? 'settle');
  const pageXY = (ev) => ({ x: ev.clientX + ((typeof window !== 'undefined' && window.scrollX) || 0), y: ev.clientY + ((typeof window !== 'undefined' && window.scrollY) || 0) });

  const poke = (ev) => {
    if (!o.poke || !geom || !F) return;
    const r = canvas.getBoundingClientRect();
    const k = geom.cw / r.width;
    const x = ((ev.clientX - r.left) * k - geom.ox) / (geom.P * geom.sc);
    const y = ((ev.clientY - r.top) * k - geom.oy) / (geom.P * geom.sc);
    const rad = o.pokeRadius ?? 0.7;
    const from = lastPoke && ev.timeStamp - lastPoke.t < 120 ? lastPoke : { x, y };
    const steps = Math.max(1, Math.ceil(Math.hypot(x - from.x, y - from.y) / 0.5));
    for (let j = 1; j <= steps; j++) F.hold(from.x + ((x - from.x) * j) / steps, from.y + ((y - from.y) * j) / steps, rad, o.pokeValue ?? 1);
    star(x, y, 1);
    const n = o.sparks ?? 3;
    for (let j = 0; j < n && sparks.length < 400; j++) {
      const a = F.rng.unit() * Math.PI * 2;
      const sp = 0.35 + F.rng.unit() * 0.9;
      sparks.push({ x, y, vx: Math.cos(a) * sp + (x - from.x) * 0.15, vy: Math.sin(a) * sp + (y - from.y) * 0.15, life: 18 + F.rng.below(30) });
    }
    lastPoke = { x, y, t: ev.timeStamp, wall: performance.now() };
    quiet = 0;
    if (paused || !visible) draw();
  };
  canvas.addEventListener('pointermove', poke);
  const click = (ev) => {
    if (!o.poke || !geom || !F) return;
    const r = canvas.getBoundingClientRect();
    const k = geom.cw / r.width;
    const x = ((ev.clientX - r.left) * k - geom.ox) / (geom.P * geom.sc);
    const y = ((ev.clientY - r.top) * k - geom.oy) / (geom.P * geom.sc);
    const now = performance.now();
    const maxP = o.maxPower ?? 8;
    power = now - lastClick < (o.comboMs ?? 1000) ? Math.min(maxP, power + 1) : 1;
    lastClick = now;
    // THE CLICK RINGS (ringsFor): the default pulses, or the gentle rings of opts.rings (lane FOOTERLADDER)
    const plan = ringsFor(o, geom, fpsOf(), power);
    for (const g of plan.rings) rings.push({ x, y, ...g });
    const burst = plan.strands;
    for (let j = 0; j < burst; j++) {
      const a = (j / burst) * Math.PI * 2 + F.rng.unit() * 0.2;
      const sp = 1.6 * (1 + 0.15 * (power - 1)) * (0.7 + 0.6 * F.rng.unit());
      sparks.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: plan.strandLife ?? 30 + 6 * power + F.rng.below(20) });
    }
    if (power === maxP && !o.rings) F.shake(0.08);
    quiet = 0;
    if (last) { last.power = power; last.maxPower = maxP; o.onStats?.(last); }
    star(x, y, plan.star);
    // a settle with sound: the click is a LOCAL ripple on the page's bus, which plays a click noise
    // THE RADIAL PULSE BUS (global.js clickPulse): the local ripple plays the noise and a page pulse from the same
    // point reaches every other settle, background and sound on the page; this settle is the source and keeps to its own rings
    if (o.audio) clickPulse({ ...pageXY(ev), strength: Math.min(1, 0.45 + 0.07 * power), kind: 'click', source: o.globalId ?? null, sound: true, power });
  };
  // THE DRAG BOX (dragbox.js, opts.drag): the press waits to see whether it is a click or a drag. Without opts.drag
  // the press is the click, as it always was
  const dragCfg = () => ({ ...DRAG, ...(o.drag && typeof o.drag === 'object' ? o.drag : {}) });
  const dragOn = () => !!o.drag && !!o.poke;
  let G = null;
  let press = null;
  let armTimer = null;
  let dragSerial = 0;
  let noiseGate = null; // THE NOISE GATE (lane MULTIRECT), one per settle, made at the first drop
  let winUp = false; // the window's pointerup fallback is armed for this press
  const clientMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const cssSize = () => {
    const r = canvas.getBoundingClientRect();
    return { r, w: r.width || canvas.clientWidth || 1, h: r.height || canvas.clientHeight || 1 };
  };
  const local = (ev, S = cssSize()) => ({ x: Math.min(S.w, Math.max(0, ev.clientX - S.r.left)), y: Math.min(S.h, Math.max(0, ev.clientY - S.r.top)), t: ev.timeStamp ?? clientMs(), type: ev.pointerType ?? 'mouse', button: ev.button });
  // CSS px inside the canvas <-> lights
  const cssToLights = (p, S) => {
    const k = geom.cw / S.w;
    return { x: (p.x * k - geom.ox) / (geom.P * geom.sc), y: (p.y * k - geom.oy) / (geom.P * geom.sc) };
  };
  const lightsToCss = (p, S) => {
    const k = S.w / geom.cw;
    return { x: (p.x * geom.P * geom.sc + geom.ox) * k, y: (p.y * geom.P * geom.sc + geom.oy) * k };
  };
  const tellDrag = (e) => { try { o.onDrag?.(e); } catch { /* the page's drawing never breaks the gesture */ } };
  const growBox = (b, S, min) => {
    const w = Math.max(b.w, Math.min(min, S.w));
    const h = Math.max(b.h, Math.min(min, S.h));
    const x = Math.min(S.w - w, Math.max(0, b.x - (w - b.w) / 2));
    const y = Math.min(S.h - h, Math.max(0, b.y - (h - b.h) / 2));
    return { x, y, w, h };
  };
  const endPress = () => {
    if (armTimer) clearTimeout(armTimer);
    armTimer = null;
    if (winUp) { winUp = false; try { window.removeEventListener('pointerup', dragUp, true); } catch { /* gone */ } }
    // let go of the gesture before the capture: releasing it fires lostpointercapture, which must find nothing
    const pid = press?.pointerId;
    G = null;
    press = null;
    if (pid != null) { try { canvas.releasePointerCapture?.(pid); } catch { /* not captured */ } }
  };
  const dragStill = () => (reducedMotion() && o.motion !== 'always') || paused || !visible || tickerHeld() || !geom || !F;
  const drop = (boxCss, S) => {
    const C = dragCfg();
    const b = growBox(boxCss, S, C.minBox);
    const id = ++dragSerial;
    const rnd = F ? () => F.rng.unit() : Math.random;
    const T = dragTiming(rnd(), fpsOf(), C);
    const fadeMs = T.fadeMs; // the box fades over exactly the inside phase
    const still = dragStill();
    let marks = [];
    if (geom && F) {
      const a = cssToLights({ x: b.x, y: b.y }, S);
      const z = cssToLights({ x: b.x + b.w, y: b.y + b.h }, S);
      const box = { x0: Math.max(0, a.x), y0: Math.max(0, a.y), x1: Math.min(geom.w - 1, z.x), y1: Math.min(geom.h - 1, z.y) };
      const kids = placeChildren(box, C.children, rnd);
      marks = kids.map((c) => lightsToCss(c, S));
      if (!still) {
        // THE NUDGE (lane MULTIRECT): the new box kicks the twinkles already alive away from its centre
        const at = { x: (box.x0 + box.x1) / 2, y: (box.y0 + box.y1) / 2 };
        const reach = C.nudgeReach * Math.min(geom.w, geom.h);
        for (const g of groups) g.kids = nudgeKids(g.kids, at, { strength: C.nudge, reach });
        groups = capList([...groups, { id, box, kids, age: 0, life: T.lifeFrames, inside: T.insideFrames, out: false, every: C.pulseEvery, max: Math.hypot(box.x1 - box.x0, box.y1 - box.y0) }], C.maxBoxes);
        quiet = 0;
      }
    }
    tellDrag({ phase: 'drop', id, box: b, fadeMs, lifeMs: T.lifeMs, insideMs: T.insideMs, still, marks, children: marks.length });
    // the four births are heard one after another (THE CLICK LOCK replays the locked sound; MUTE ALL and the gesture
    // rule are settle-hear's): a LOCAL ripple each, on the page's bus. THE DROP IS ONE EVENT (lane HERODRAGFIX): THE
    // NOISE GATE is asked once, at the release, and its answer rides all four births, which carry the drop's id and
    // their part (0 .. 3), so the hearing plays the drop as one sound and never half of one
    if (o.audio) {
      const pg = { x: S.r.left + ((typeof window !== 'undefined' && window.scrollX) || 0), y: S.r.top + ((typeof window !== 'undefined' && window.scrollY) || 0) };
      noiseGate ??= createNoiseGate({ burst: C.noiseBurst, perSecond: C.noisePerSecond });
      const loud = noiseGate.take(clientMs());
      marks.forEach((m, j) => {
        const send = () => {
          if (dead) return;
          const r = dragPulse({ x: pg.x + m.x, y: pg.y + m.y, strength: 0.6, source: o.globalId ?? null, power: 1, drag: id, part: j, sound: loud });
          // the bus refused the birth (PAUSE ALL, a hidden tab, an away reader): say so, never silently
          if (!r) tellDropSound({ key: `${o.globalId ?? ''}:${id}`, part: j, ok: false, reason: 'bus-not-running' });
        };
        if (j === 0) send();
        else { const T = setTimeout(send, j * C.soundGapMs); T?.unref?.(); }
      });
    }
    return id;
  };
  const down = (ev) => {
    if (!dragOn()) return click(ev);
    if (ev.isPrimary === false) return undefined;
    // a right or middle button is not a gesture: it clicks as it always did
    if (ev.pointerType !== 'touch' && ev.button != null && ev.button !== 0) return click(ev);
    endPress();
    G = createDragGesture(dragCfg());
    const S = cssSize();
    G.down(local(ev, S));
    press = { clientX: ev.clientX, clientY: ev.clientY, timeStamp: ev.timeStamp, pointerId: ev.pointerId, pointerType: ev.pointerType ?? 'mouse' };
    if (press.pointerType === 'touch') {
      const C = dragCfg();
      armTimer = setTimeout(() => {
        armTimer = null;
        if (G && G.tick((press?.timeStamp ?? 0) + C.longPressMs) === 'arm') {
          try { canvas.setPointerCapture?.(press.pointerId); } catch { /* gone */ }
          tellDrag({ phase: 'armed', x: G.origin.x, y: G.origin.y });
        }
      }, C.longPressMs);
      armTimer?.unref?.();
    } else {
      // no text selection, no focus jump: the press belongs to the picture
      ev.preventDefault?.();
      try { canvas.setPointerCapture?.(ev.pointerId); } catch { /* not capturable */ }
      // THE RELEASE ANYWHERE (lane HERODRAGFIX): the capture sends the release to the canvas; where a browser lost or
      // refused it, the window still hears it, so a release outside the hero completes the box
      if (typeof window !== 'undefined' && window.addEventListener) {
        window.addEventListener('pointerup', dragUp, true);
        winUp = true;
      }
    }
    return undefined;
  };
  const dragMove = (ev) => {
    if (!G || !press || (ev.pointerId != null && press.pointerId != null && ev.pointerId !== press.pointerId)) return;
    const S = cssSize();
    const a = G.move(local(ev, S));
    if (a === 'scroll') { endPress(); return; }
    if (a === 'start' || a === 'move') tellDrag({ phase: 'move', box: G.box(), start: a === 'start' });
  };
  const dragUp = (ev) => {
    if (!G || !press || (ev.pointerId != null && press.pointerId != null && ev.pointerId !== press.pointerId)) return;
    const S = cssSize();
    const a = G.up(local(ev, S));
    const box = G.box();
    const p = press;
    endPress();
    if (a === 'click') click(p);
    else if (a === 'drop' && box) drop(box, S);
  };
  const dragCancel = (ev) => {
    if (!G || !press || (ev?.pointerId != null && press.pointerId != null && ev.pointerId !== press.pointerId)) return;
    const a = G.cancel();
    endPress();
    if (a === 'cancel') tellDrag({ phase: 'cancel' });
  };
  // a held finger, once armed, owns the touch: the page does not scroll and the phone's long-press menu waits
  const holdTouch = (ev) => { if (G && (G.state === 'armed' || G.state === 'dragging')) ev.preventDefault?.(); };
  canvas.addEventListener('pointerdown', down);
  canvas.addEventListener('pointermove', dragMove);
  canvas.addEventListener('pointerup', dragUp);
  canvas.addEventListener('pointercancel', dragCancel);
  canvas.addEventListener('lostpointercapture', dragCancel);
  canvas.addEventListener('touchmove', holdTouch, { passive: false });
  canvas.addEventListener('contextmenu', holdTouch);
  if (o.drag && canvas.style) {
    canvas.style.userSelect = 'none';
    canvas.style.webkitUserSelect = 'none';
    canvas.style.webkitTouchCallout = 'none';
  }
  // Enter or Space on a focused settle with sound counts as a click at its centre
  const key = (ev) => {
    if (ev.key !== 'Enter' && ev.key !== ' ') return;
    ev.preventDefault?.();
    const r = canvas.getBoundingClientRect();
    click({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2, timeStamp: ev.timeStamp });
  };
  if (o.audio) {
    if (canvas.tabIndex == null || canvas.tabIndex < 0) canvas.tabIndex = 0;
    canvas.addEventListener('keydown', key);
  }

  if (reducedMotion() && o.motion !== 'always') still();
  else start();

  return {
    get field() { return F; },
    get trueTime() { return TT; },
    get renderer() { return R?.kind ?? (gl ? 'gl-failed' : '2d'); },
    get perf() { return { ...perf }; },
    get geom() { return geom; },
    get traces() { return TR; },
    replay(k) {
      if (!TR || !TR.unpack(k, F.s)) return false;
      paused = true;
      for (let i = 0; i < F.n; i++) F.m[i] = F.s[i] > 0 ? 1 : 0;
      draw();
      return true;
    },
    live() { paused = false; quiet = 0; },
    get frame() { return frame; },
    seek(f) { frame = f; quiet = 0; },
    advance(n = 1) { advance(n); },
    // one frame exactly as the shared ticker runs it, the rest rule included (tests, and a page driving its own loop)
    tick(now) { if (!dead) step(now); },
    // THE ECHO (lane FOOTERRADIAL): a wave from elsewhere answered with this settle's own gentle rings, from a point in
    // the canvas's own CSS px; no sound, no page pulse (the wave is already on the bus), nothing while paused or hidden
    echo(x, y, level = 1, spec = null) {
      if (dead || paused || !visible || !geom || !F || !Number.isFinite(x) || !Number.isFinite(y)) return false;
      const L = toLights({ x, y, w: canvas.getBoundingClientRect().width });
      const plan = echoRings(o, geom, fpsOf(), level, spec);
      for (const g of plan.rings) rings.push({ x: L.x, y: L.y, ...g });
      for (let j = 0; j < plan.strands && sparks.length < 400; j++) {
        const a = (j / Math.max(1, plan.strands)) * Math.PI * 2 + F.rng.unit() * 0.2;
        const sp = 1.6 * (0.7 + 0.6 * F.rng.unit());
        sparks.push({ x: L.x, y: L.y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: plan.strandLife ?? 30 + F.rng.below(20) });
      }
      if (plan.star > 0) star(L.x, L.y, plan.star);
      quiet = 0;
      return true;
    },
    // THE FRONT (lane FOOTERMINI): a draw-only flash on the lights a wave's front crosses, from its origin (x, y) and
    // radius r in the canvas's own CSS px, width lights thick, at level (0..1), only in the canvas rows rows = [top,
    // bottom] (CSS px; the part a window shows). The physics is untouched (a flash, like the crackle); it fades by
    // opts.flashDecay a frame, so a front drawn every bus frame leaves a short bright trail. Nothing while paused or
    // hidden. Returns the number of lights flashed.
    front(x, y, r, width = 2, level = 1, rows = null) {
      if (dead || paused || !visible || !geom || !F || !Number.isFinite(x) || !Number.isFinite(y) || !(r > 0)) return 0;
      const cssW = canvas.getBoundingClientRect().width;
      const L = toLights({ x, y, w: cssW });
      const top = rows ? toLights({ x: 0, y: rows[0], w: cssW }).y : 0;
      const bottom = rows ? toLights({ x: 0, y: rows[1], w: cssW }).y : geom.h - 1;
      const cells = frontCells(L.x, L.y, r * L.s, width, geom.w, geom.h, top, bottom);
      if (!cells.size) return 0;
      F.flash(cells, Math.max(0, Math.min(1, level)));
      quiet = 0;
      return cells.size;
    },
    show(bits, { snap: copy = !!o.still } = {}) {
      if (!F || bits.length !== F.n) return false;
      index = sched(frame).index;
      F.setTarget(Int8Array.from(bits));
      if (copy) snap();
      quiet = 0;
      if (paused || !visible || !loop) draw();
      return true;
    },
    get paused() { return paused; },
    play() { paused = false; quiet = 0; },
    pause() { paused = true; },
    toggle() { paused = !paused; return paused; },
    shake(frac = 0.5) { F.shake(frac); },
    stats: () => last,
    // THE DRAG BOX: the groups of children alive in the lights, and a drop made by hand (tests, a page's own gesture):
    // box in CSS px inside the canvas, { x, y, w, h }
    get dragGroups() { return groups.map((g) => ({ id: g.id, box: { ...g.box }, kids: g.kids.map((c) => ({ ...c })), life: g.life, inside: g.inside, age: g.age, out: g.out })); },
    get dragRings() { return dragRings.length; },
    dropBox(box) { return drop(box, cssSize()); },
    set(next) {
      const rebuild = ['res', 'seed'].some((k) => k in next && next[k] !== o[k]);
      const retarget = ['items', 'shape', 'word', 'target'].some((k) => k in next);
      next = defined(next);
      o = { ...o, ...next };
      if ('schedule' in next || 'still' in next || 'stillT' in next) sched = makeSchedule(stillSchedule());
      quiet = 0;
      if ('lean' in next) F.lean = o.lean;
      if ('pull' in next) F.pull = o.pull;
      if (rebuild) { geom = null; layout(); }
      else if (tracesOn() !== !!TR) makeTraces();
      else {
        if (retarget) { cache.clear(); index = -1; frame = 0; }
        if (retarget || 'trueTime' in next) makeTT();
        R?.set(look());
      }
      if ('fps' in next && loop) start();
    },
    morph(next, how = {}) {
      const keys = ['items', 'shape', 'word', 'target'];
      const tgt = Object.fromEntries(Object.entries(next).filter(([k]) => keys.includes(k)));
      const rest = Object.fromEntries(Object.entries(next).filter(([k]) => !keys.includes(k)));
      if (Object.keys(rest).length) this.set(rest);
      if (!Object.keys(tgt).length) return false;
      const before = items().length;
      const prevIt = items()[Math.max(0, index) % before];
      const o2 = { ...o, ...defined(tgt) };
      if (!F || !geom || (o2.items?.length || 1) !== before) {
        this.set(tgt);
        return false;
      }
      // a different film or live source at the current index is a new item, not a new spelling of the same one: the
      // morph keeps a film playing only when it is the SAME film (lane HEROSHUFFLE: pinning one film, then another)
      const nextIt = (o2.items?.length ? o2.items : [])[Math.max(0, index) % before];
      const ident = (x) => (x && typeof x === 'object' ? x.film ?? x.frames ?? x.live ?? null : null);
      if (index >= 0 && nextIt && (isFilm(prevIt) || isFilm(nextIt) || isLive(prevIt) || isLive(nextIt)) && ident(prevIt) !== ident(nextIt)) {
        this.set(tgt);
        return false;
      }
      o = o2;
      cache.clear();
      quiet = 0;
      const list = items();
      const it = list[Math.max(0, index) % list.length];
      if (index < 0 || isFilm(it)) return false; // a film keeps playing; its words are in the caption, not the lights
      const to = targetFor(it);
      // the movie starts from what is LIT, not from the target the field was heading for: a morph begun while another
      // was still running (or while the lights were still settling) would otherwise never watch the lights that are
      // lit from the old words and off in both targets, and the rest rule froze them lit (lane HEROPASS)
      const from = Int8Array.from(F.s);
      let same = true;
      for (let i = 0; i < to.length && same; i++) same = F.target[i] === to[i];
      if (same) return false;
      if (!animate()) {
        MO = null;
        owed = null;
        F.setTarget(to);
        snap();
        draw();
        return false;
      }
      MO = createMorph({ from, to, width: geom.w, seed: o.seed, now: filmClock, ...how });
      owed = changedLights(to, from);
      owedFrames = 0;
      F.setTarget(MO.target);
      if (paused || !visible || !loop) draw();
      return true;
    },
    get morphing() { return !!MO; },
    // true while the rest rule holds the field still (opts.rest): no sweeps and no drawing until something wakes it
    get resting() { return resting() && quiet > (o.restAfter ?? 24); },
    destroy() {
      dead = true;
      LIVE.delete(live);
      R?.destroy?.();
      loop?.();
      ro?.disconnect();
      io?.disconnect();
      canvas.removeEventListener('pointermove', poke);
      endPress();
      canvas.removeEventListener('pointerdown', down);
      canvas.removeEventListener('pointermove', dragMove);
      canvas.removeEventListener('pointerup', dragUp);
      canvas.removeEventListener('pointercancel', dragCancel);
      canvas.removeEventListener('lostpointercapture', dragCancel);
      canvas.removeEventListener('touchmove', holdTouch);
      canvas.removeEventListener('contextmenu', holdTouch);
      canvas.removeEventListener('keydown', key);
      unregister?.();
      unlight?.();
    },
  };
}
