// settle-see/react · Settle - the React face of settle(): <Settle shape="heart" neon="mem" />.
//
// <claudes_code_comments>
// ** Function List **
// useSettle(opts)          - a canvas ref, the live handle and the latest stats, for building your own component
// Settle(props)            - a canvas that settles; every settle() option is a prop, plus width, height,
//                            className, style, label, decorative (aria-hidden), and children drawn on top
// SettleBadge(props)       - a small square settle of one shape in one neon: for cards and credits
// SettleWord(props)        - a word settling out of noise, sized to its text
// SettleReadout({ stats }) - the live numbers, in a translucent black panel meant to sit on the dots
// useTickerState()         - the ticker's halt state ('running', 'hidden', 'away') for a paused-while-away note
//
// ** Technical Review **
// - The canvas is mounted once; later prop changes go through handle.set(), so changing the colour does not
//   restart the physics, and changing the shape re-targets the running field.
// - Options that are objects or functions are compared by a JSON key, so an inline items={[...]} array does not
//   re-target every render.
// - Every Settle has role="img" and an aria-label naming what it settles into (label overrides).
// - beforeStep, afterStep and onStats are read through refs, so a page can pass fresh closures every render; whether
//   a hook is given at all is fixed at mount. onHandle(handle) hands the live settle() handle to the page (and null on
//   unmount), for show(), seek(), advance(), the field and its traces.
// - A prop change hands set() ONLY the options that changed (changedOptions), so moving the dim or the pull does not
//   re-target a cycling picture back to its first item.
// - THE GLOBAL SETTLE (src/global.js): every <Settle> takes part in page ripples by default; global={false} opts out,
//   globalId names it, and audio marks a settle with sound (a click or Enter ripples inside it and asks for a click
//   noise; the canvas gets tabIndex 0). These three are read at mount.
// - morph (a prop, true or { frames, periodMs, threshold }): a change of items / word / shape / target goes through
//   handle.morph() instead of set(), so the picture settles from the old glyphs to the new ones in TRUE TIME (the
//   bilingual site's language switch) and the cycle keeps its place. Without it, a new target restarts the cycle.
// - THE PAINT (lane LOGOHOVER, 2026-10-04): color 'map' with palette (a list of hexes) and paint ({ hue, gain } or a
//   function (field, timeSec) => that) are passed through like every other option; a stable paint function is read at
//   every draw, so a page changes the colours through what the function returns, never through a prop change.
// - THE DRAG BOX (src/dragbox.js): drag turns a press into click-or-drag (a click fires on release); onDrag(e) hears
//   { phase: 'armed' | 'move' | 'drop' | 'cancel', box, fadeMs, still, marks }, read through a ref like the hooks, so
//   the page draws the rectangle itself (the hero: sites/settle-site/src/HeroDrag.jsx).
// </claudes_code_comments>

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { settle, describe, changedOptions, tickerState, onTickerState } from '../src/index.js';

const OPTION_KEYS = [
  'shape', 'word', 'target', 'items', 'res', 'color', 'neon', 'off', 'dim', 'glow', 'core', 'lean', 'pull', 'seed', 'schedule',
  'fps', 'sweeps', 'poke', 'background', 'motion', 'soften', 'statsEvery', 'traces', 'echoes', 'echoDecay', 'echoColour',
  'heldColour', 'trail', 'pulses', 'sparks', 'pokeRadius', 'pokeValue', 'maxPower', 'comboMs', 'offset', 'still', 'stillT',
  'rest', 'restAfter', 'reducedFrames', 'stillFrames', 'fit', 'flashColour', 'flashDecay', 'perfLabel', 'renderer', 'quality', 'glDebug', 'trueTime',
  'audio', 'global', 'globalId', 'drag', 'palette', 'paint', 'level',
];

const keyOf = (v) => JSON.stringify(v, (k, x) => (typeof x === 'function' ? x.toString() : x));
export { changedOptions } from '../src/options.js';

export function useSettle(opts) {
  const ref = useRef(null);
  const handle = useRef(null);
  const [stats, setStats] = useState(null);
  const wantStats = !!opts.onStats || opts.stats;
  const clean = useMemo(() => Object.fromEntries(OPTION_KEYS.filter((k) => opts[k] !== undefined).map((k) => [k, opts[k]])), [keyOf(OPTION_KEYS.map((k) => opts[k]))]);
  const onStats = useRef(opts.onStats);
  onStats.current = opts.onStats;
  const hooks = useRef({});
  hooks.current = { before: opts.beforeStep, after: opts.afterStep, handle: opts.onHandle, drag: opts.onDrag };
  const morphRef = useRef(opts.morph);
  morphRef.current = opts.morph;

  useEffect(() => {
    if (!ref.current) return undefined;
    handle.current = settle(ref.current, {
      ...clean,
      paused: opts.paused,
      onStats: wantStats ? (s) => { onStats.current?.(s); if (opts.stats) setStats(s); } : undefined,
      beforeStep: opts.beforeStep ? (F, i) => hooks.current.before?.(F, i) : undefined,
      afterStep: opts.afterStep ? (F, i) => hooks.current.after?.(F, i) : undefined,
      onDrag: opts.onDrag ? (e) => hooks.current.drag?.(e) : undefined,
    });
    hooks.current.handle?.(handle.current);
    return () => {
      hooks.current.handle?.(null);
      handle.current?.destroy();
    };
  }, []);

  // pass on only the options that changed: set() re-targets (and restarts the schedule) whenever items, shape, word
  // or target is in what it is given, so handing it the whole option set on every change of fps or poke sent a
  // cycling settle back to its first item
  const last = useRef(clean);
  useEffect(() => {
    if (last.current === clean) return;
    const prev = last.current;
    last.current = clean;
    const changed = changedOptions(prev, clean);
    if (!Object.keys(changed).length) return;
    const how = morphRef.current;
    if (how && ['items', 'shape', 'word', 'target'].some((k) => k in changed) && handle.current?.morph) {
      handle.current.morph(changed, typeof how === 'object' ? how : {});
    } else handle.current?.set(changed);
  }, [clean]);

  useEffect(() => {
    if (opts.paused == null || !handle.current) return;
    if (opts.paused) handle.current.pause();
    else handle.current.play();
  }, [opts.paused]);

  return { ref, handle, stats };
}

// the page's halt state from settle-see's ticker: { state: 'running' | 'hidden' | 'away', awayMs, reason }, for a
// quiet "paused while you were away" note; it re-renders only when the state changes
export function useTickerState() {
  const [st, set] = useState(() => ({ state: tickerState().state, awayMs: 0, reason: '' }));
  useEffect(() => onTickerState((d) => set({ state: d.state, awayMs: d.awayMs, reason: d.reason })), []);
  return st;
}

export function Settle({ width = '100%', height = 240, className, style, label, decorative = false, children, ...opts }) {
  const { ref } = useSettle(opts);
  const what = label ?? `Lights settling out of noise into ${describe(opts.target ?? opts.items?.[0] ?? (opts.shape ? { shape: opts.shape } : { word: opts.word ?? 'SETTLE' }))}.`;
  return (
    <div className={className} style={{ position: 'relative', width, height, ...style }}>
      <canvas ref={ref} role={decorative ? undefined : 'img'} aria-label={decorative ? undefined : what} aria-hidden={decorative || undefined} style={{ display: 'block', width: '100%', height: '100%' }} />
      {children}
    </div>
  );
}

export function SettleBadge({ shape = 'star', neon = 'random', size = 96, res = 32, seed = 1, schedule = 'cycle', ...rest }) {
  return <Settle shape={shape} neon={neon} color="single" res={[res, res]} width={size} height={size} seed={seed} schedule={schedule} fps={16} poke={false} {...rest} />;
}

export function SettleWord({ word = 'SETTLE', height = 120, neon = 'yes', color = 'single', ...rest }) {
  const width = Math.round(height * Math.max(2, word.length * 0.72));
  return <Settle word={word} neon={neon} color={color} res={Math.round(width / 4)} width={width} height={height} {...rest} />;
}

const panel = {
  font: '400 12px/1.6 "IBM Plex Mono", ui-monospace, Menlo, monospace',
  color: '#ecebf2',
  background: 'rgba(0,0,0,0.5)',
  padding: '8px 12px',
  whiteSpace: 'pre',
  fontVariantNumeric: 'tabular-nums',
  pointerEvents: 'none',
  backdropFilter: 'blur(2px)',
};

export function SettleReadout({ stats, style, lean, pull }) {
  if (!stats) return null;
  const f = (x) => x.toLocaleString('en-US');
  return (
    <div style={{ ...panel, ...style }} aria-hidden="true">
      {`sweep ${f(stats.sweeps)} · T ${stats.T.toFixed(2)} · beta ${stats.beta.toFixed(2)} · ${stats.phase}
${stats.w} x ${stats.h} = ${f(stats.n)} p-bits
energy ${stats.e.toFixed(0)} · ${stats.ePer.toFixed(3)} per light
overlap ${(stats.q * 100).toFixed(1)}% · flips ${f(stats.flips)}
lean ${lean ?? 0.9} · pull ${pull ?? 0.3} · ${stats.rate.toFixed(0)} sweeps/s${stats.power ? `
click power ${'█'.repeat(stats.power)}${'░'.repeat(stats.maxPower - stats.power)} ${stats.power}/${stats.maxPower}${stats.power === stats.maxPower ? ' MAX' : ''}` : ''}`}
    </div>
  );
}
