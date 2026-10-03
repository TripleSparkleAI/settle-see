// settle-see · schedule - how the temperature moves over time.
//
// <claudes_code_comments>
// ** Function List **
// makeSchedule(spec)  - spec -> (frame) => { T, phase, index }
//   'cycle' (default)  hot, cool geometrically to cold, hold, reheat; index counts targets for a cycling settle
//   'cool'             hot, cool to cold once, then hold for good
//   'fixed'            one temperature for ever
//   a number           the same as { kind: 'fixed', T: number }
//   a function         frame -> T, or frame -> { T, phase, index } (a page's own program: index picks the item)
//
// ** Technical Review **
// - Defaults are the home page room's: hot 3.0, cold 0.45, 20 hot frames, 170 cooling frames, 90 held frames,
//   20 reheating frames: 300 frames per target. Cooling is geometric (the same ratio every frame), which is
//   SETTLE's `anneal`.
// - phase is one of 'hot', 'cooling', 'settled', 'reheating', for captions.
// - { kind: 'cycle', on: 'master', fps } runs the cycle on THE MASTER BEAT (masterbeat.js): the frame counts are read
//   at fps, the whole cycle is rounded to whole 500 ms ticks, and the item index counts cycles from the master origin,
//   so the item changes on a master tick on every machine (the home hero, navigator 2026-10-01).
// </claudes_code_comments>

import { masterBeat } from './masterbeat.js';

export function makeSchedule(spec = 'cycle') {
  if (typeof spec === 'function') {
    return (f) => {
      const r = spec(f);
      return typeof r === 'number' ? { T: r, phase: 'custom', index: 0 } : { phase: 'custom', index: 0, ...r };
    };
  }
  if (typeof spec === 'number') spec = { kind: 'fixed', T: spec };
  if (typeof spec === 'string') spec = { kind: spec };
  const { kind = 'cycle', hot = 3.0, cold = 0.45, heat = 20, cool = 170, hold = 90, reheat = 20, T = 0.6 } = spec;
  if (kind === 'fixed') return () => ({ T, phase: 'settled', index: 0 });
  const period = heat + cool + hold + reheat;
  const within = (p) => {
    if (p < heat) return { T: hot, phase: 'hot' };
    if (p < heat + cool) return { T: hot * Math.pow(cold / hot, (p - heat) / cool), phase: 'cooling' };
    if (kind === 'cool' || p < heat + cool + hold) return { T: cold, phase: 'settled' };
    return { T: cold + ((p - heat - cool - hold) / reheat) * (hot - cold), phase: 'reheating' };
  };
  if (kind === 'cool') return (f) => ({ ...within(Math.min(f, heat + cool)), index: 0 });
  if (spec.on === 'master') {
    // ON THE MASTER BEAT: the cycle runs on the page's master clock, not on the frame count. Its frame counts are read
    // at spec.fps (24) and the whole cycle is rounded to whole 500 ms ticks, so every item change lands on a master
    // tick on every machine, however many frames it draws
    const B = spec.beat ?? masterBeat();
    const fps = spec.fps > 0 ? spec.fps : 24;
    const periodMs = Math.max(B.tickMs, Math.round(((period / fps) * 1000) / B.tickMs) * B.tickMs);
    return () => {
      const ms = B.now() - B.origin;
      const k = Math.floor(ms / periodMs);
      const p = ((ms - k * periodMs) / periodMs) * period;
      return { ...within(p), index: Math.max(0, k), period, periodMs };
    };
  }
  return (f) => ({ ...within(f % period), index: Math.floor(f / period), period });
}
