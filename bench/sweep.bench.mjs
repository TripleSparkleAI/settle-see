// settle-see · bench/sweep - the CPU cost of one frame's physics (sweep + soften), the old field against the new.
//
// Run: node bench/sweep.bench.mjs [w h frames]
// Prints ns per light per sweep, interleaved A/B (v0 = the field as it was, now = src/field.js), minimum of rounds.
import { createField as v0 } from './field_v0.js';
import { createField as now } from '../src/field.js';

const [w = 360, h = 209, frames = 60] = process.argv.slice(2).map(Number);
const n = w * h;
const target = Int8Array.from({ length: n }, (_, i) => ((i % w) < w / 2 ? 1 : -1));
const arms = { v0, now };
const best = { v0: Infinity, now: Infinity };
const fields = Object.fromEntries(Object.entries(arms).map(([k, mk]) => [k, mk({ w, h, target, seed: 7 })]));
for (let round = 0; round < 7; round++) {
  for (const k of round % 2 ? ['now', 'v0'] : ['v0', 'now']) {
    const F = fields[k];
    const c0 = process.cpuUsage();
    for (let f = 0; f < frames; f++) {
      F.sweep(1 / (0.45 + (f % 30) * 0.08));
      F.soften(0.55);
    }
    const c1 = process.cpuUsage(c0);
    const ns = ((c1.user + c1.system) * 1000) / (frames * n);
    if (round > 0) best[k] = Math.min(best[k], ns);
  }
}
const ms = (k) => ((best[k] * n) / 1e6).toFixed(2);
console.log(`field ${w} x ${h} = ${n} lights, ${frames} frames per round, min of 6 rounds after a warm-up, CPU time (process.cpuUsage)`);
console.log(`v0  ${best.v0.toFixed(2)} ns/light/frame  ${ms('v0')} ms/frame`);
console.log(`now ${best.now.toFixed(2)} ns/light/frame  ${ms('now')} ms/frame  (${(best.v0 / best.now).toFixed(2)}x)`);
