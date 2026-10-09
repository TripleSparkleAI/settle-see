// settle-see - SETTLE's drawing library: pictures that settle out of noise, lit in the SETTLE neon code.
//
// <claudes_code_comments>
// ** Function List **
// settle(canvas, opts)                        - mount.js: a live settling picture on a canvas, in one call
// createField / createRenderer / makeSchedule - the three parts settle() is built from, for custom loops
// toTarget / loadTarget / describe            - what to settle into
// defineShape / defineBits / getShape / shapeNames - the shape registry (defineBits: shapes with no canvas)
// Paint / seeded / scatter / curve            - paint.js: draw +1 / -1 targets in plain JavaScript
// KANERVA / CREDIT_SHAPES / CREDIT_NOTES      - creditshapes.js: Kanerva's memory and the credits' characters
// brainScene / BRAIN_VIEWS / CORTEX_LAYERS / CEREBELLUM_LAYERS - brainshapes.js: the cortex6, cerebellum and
//                                             brainbands shapes, their views, spike paths and layer labels
// BURSTS / createBurstDeck / createBurstPlayer - bursts.js: 25 dramatic disturbances of a live field, dealt in a
//                                             seeded order without repeats
// correlation / shuffled                      - measure.js: how close a settle came, and the shuffled control
// NEONS / NEON / neon / rgb / rgba / tint     - the neon code; neonRange: THE NEON RANGE, the full-colour palette
// createSceneSettle / rasterScene             - scenefield.js: THE SCENE SETTLE, a vector scene settled in full colour
//                                             (the site's page backgrounds)
// addTick / tickerState / onTickerState       - the shared animation loop, its meter and its halt rule (hidden tab,
//   setIdleTimeout / wakeTicker / tickerStats    5 minutes with nobody there); settlePerfs: every settle's own meter
// packFrames / unpackFrames / fitBits / filmPhase / loadFilm - film.js: SMALL FILMS, frame sequences as targets
// tracesToFilm / filmToTraces                 - traces.js: one frame-sequence format, both directions
// isLive / liveFrame / LIVE_DEFAULTS          - live.js: LIVE items, targets made on demand and sampled on TRUE TIME
// masterBeat / createMasterBeat / MASTER      - masterbeat.js: THE MASTER BEAT, one origin and one grid for everything
//                                             that keeps time (TRUE TIME, the 40 Hz light, the bar line)
// fortyHz / createFortyHz / FORTY_HZ - fortyhz.js: THE 40 Hz LIGHT, ONE MODE: one page-wide switch and one clock
//                                             every settling picture flickers to (Escape and every off button end it)
// ripple / registerSettle / onRipple / globalSettle / createGlobalSettle / clickPulse - global.js: THE GLOBAL SETTLE,
//                                             the page's registry of every settle, a face over the radial pulse bus
// RADIAL_EFFECTS / KEY_EFFECTS / effectOf / effectHolds - radialeffects.js: THE RADIAL EFFECTS, the bus's named family
//                                             of wave styles, and THE KEY SUIT of fifty gentle members (lane HEROKEYS)
// WEATHER_NEUTRAL / weatherOf             - weather.js: THE WEATHER option, a page's per-frame modulation of the knobs
// CRACKLE_LIMITS / crackleOf / createRim / crackleFrame - crackle.js: THE EDGE CRACKLE, the weather's overbright
//                                             flares along a target's rim (lane CLEARTEXT)
// FORTY_CRACKLE / fortyCrackleOf / createFortyCrackle / fortyLitCycle / FORTY_SCAN_PATTERNS / scanParams / scanAt
//                                           - fortycrackle.js + fortyscan.js: THE 40 Hz CRACKLE, TV scanlines that
//                                             brighten the lit lights on the 40 Hz light's lit phases (lanes
//                                             FORTYCRACKLE, FORTYSCAN; fortyscan.js, the generator, loads on demand)
// radialPulse / createRadialPulse / registerRadial / emitPulse / onPulse - radialpulse.js: THE RADIAL PULSE BUS, one
//                                             bus for every radial event and one consumer interface ('settle:pulse')
// DRAG / createDragGesture / rectFrom / dragFadeMs / placeChildren / stepChildren - dragbox.js: THE DRAG BOX, the
//                                             click-or-drag gesture and the four children a drop makes (opts.drag)
//
// ** Technical Review **
// - No dependencies. The React components are in settle-see/react.
// - The physics (field.js) is SETTLE's own p-bit rule and energy, the same model the settle-rs interpreter runs
//   for a picture target: lean toward the target, pull to four neighbours, a Gibbs sweep per step.
// </claudes_code_comments>

export { settle, changedOptions, settlePerfs, setQuality, getQuality, GLOBAL_KICK_DECAY, OWED_MAX_FRAMES, ringsFor, echoRings, radialAnswer, frontCells, fortyScanReady, fortyScanState } from './mount.js';
export { DRAG, createDragGesture, rectFrom, dragFadeMs, placeChildren, stepChildren, capList } from './dragbox.js';
export { GLOBAL_DEFAULTS, createGlobalSettle, globalSettle, registerSettle, ripple, onRipple, globalStats, clickPulse, nearestPoint, farthestCorner } from './global.js';
export { RADIAL_DEFAULTS, PULSE_EVENT, admits, createRadialPulse, radialPulse, registerRadial, emitPulse, onPulse, radialStats, arrivalMs, falloff, onScreen } from './radialpulse.js';
// THE RADIAL EFFECTS (lane SOUNDSHAKE): the named family of wave styles on THE RADIAL PULSE BUS; THE WEATHER option
export { RADIAL_EFFECTS, EFFECT_KEYS, SOUND_EFFECTS, KEY_EFFECTS, KEY_EFFECT_KEYS, GENTLE, isGentle, effectOf, ringCells, onSpoke, effectHolds } from './radialeffects.js';
export { WEATHER_NEUTRAL, WEATHER_LIMITS, weatherOf } from './weather.js';
export { CRACKLE_LIMITS, crackleOf, createRim, crackleRng, crackleFrame } from './crackle.js';
export {
  FORTY_CRACKLE, FORTY_CRACKLE_LIMITS, FORTY_SCAN_PATTERNS, FORTY_SCAN_COVER, fortyCrackleOf, fortyLitCycle,
} from './fortycrackle.js';
export { createFortyCrackle, scanParams, scanAt } from './fortyscan.js';
export { createField } from './field.js';
export { createRenderer, fillCells, fillMap, makeColours, lightAlpha, isClearBackground, RENDER_DEFAULTS } from './render.js';
export { createGlRenderer, glSupported } from './glrender.js';
export { createGpuField } from './gpufield.js';
export { createTrueTime, replayFrames, TRUE_TIME_DEFAULTS } from './truetime.js';
export { isLive, liveFrame, LIVE_DEFAULTS, LIVE_FRAMES } from './live.js';
export { createMorph, morphFrames, MORPH_DEFAULTS } from './morph.js';
export { makeSchedule } from './schedule.js';
export { toTarget, loadTarget, describe, makeCanvas, FONT as WORD_FONT } from './target.js';
export { defineShape, defineBits, getShape, shapeNames, SHAPES, wrapLines } from './shapes.js';
export { Paint, seeded, scatter, curve } from './paint.js';
export { KANERVA, CREDIT_SHAPES, NOTES as CREDIT_NOTES } from './creditshapes.js';
export { brainScene, rideScene, clampRide, rideTiers, RIDE_START, RIDE_LIMITS, RIDE_UP, RIDE_FAR, RIDE_FAR_END, BRAIN_VIEWS, CORTEX_LAYERS, CEREBELLUM_LAYERS, BAND_SPLIT } from './brainshapes.js';
export { BURSTS, burstDeckOrder, createBurstDeck, createBurstPlayer, burstEnv } from './bursts.js';
export { correlation, shuffled } from './measure.js';
export { NEONS, NEON, GROUND, RANDOM_KEYS, neon, rgb, rgba, mixRgb, tint, hsv, hexOfHsv, neonRange } from './palette.js';
export { SCENE_DEFAULTS, coverage, rasterScene, sceneTemperature, sameBits, pulsePrims, createSceneSettle } from './scenefield.js';
export { addTick, tickerStats, resetTickerStats, tickerState, onTickerState, setIdleTimeout, wakeTicker, holdTicker, tickerHeld, IDLE_MS } from './ticker.js';
export { createTraces, tracesToFilm, filmToTraces } from './traces.js';
export { FILM_FORMAT, packBits, unpackBits, packFrames, unpackFrames, fitBits, filmFrameIndex, filmPhase, filmMeta, loadFilm, clearFilmCache, changedLights, agreementOn } from './film.js';
export { Rng } from './rng.js';
export { createBag, indexDeck, bagSequence, deckRng, bagRng, freshSeed } from './deck.js'; // THE DECK RULE: every cycle deals like a deck
export { createGamma, nearestRate, gammaPhase, gammaLevel, clampGamma, darkTime, createDither, canShowHz, measureRefresh, refreshFromIntervals, snapRefresh, pickFlashRate, createFlashClock, DISPLAY_RATES } from './gamma.js';
export { FORTY_HZ, FORTY_HZ_ATTR, FORTY_HZ_ROOT, FORTY_HZ_SESSION, FORTY_HZ_CSS, createFortyHz, fortyHz, fortyHzRate } from './fortyhz.js';
export { createMasterBeat, masterBeat, unitMs, MASTER, MASTER_GLOBAL } from './masterbeat.js';
