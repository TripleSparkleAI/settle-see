// examples/first.mjs - settle-see's first program: a heart settles out of noise, printed in the terminal.
// Run it from the package folder: node examples/first.mjs
// The physics is the same field the canvas components draw; here it prints each picture as text instead.
// Its output is recorded in examples/first.out, and tests/first.test.mjs fails if a run stops matching it.
import { createField } from '../src/index.js';

const w = 36;
const h = 15;

// the target: +1 inside the heart curve, -1 outside (any Int8Array of +1 and -1 works)
const target = new Int8Array(w * h);
for (let y = 0; y < h; y++) {
  for (let x = 0; x < w; x++) {
    const u = ((x + 0.5) / w) * 2.6 - 1.3;
    const v = 1.25 - ((y + 0.5) / h) * 2.5;
    target[y * w + x] = (u * u + v * v - 1) ** 3 - u * u * v ** 3 <= 0 ? 1 : -1;
  }
}

const field = createField({ w, h, target, seed: 7 });
const show = (label) => {
  const { r } = field.stats();
  console.log(`${label}  (agreement with the heart: ${r.toFixed(2)})`);
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) row += field.s[y * w + x] > 0 ? '●' : '·';
    console.log(row);
  }
  console.log('');
};

// cool from T 3.0 by 7% a sweep: each sweep is one exact Gibbs pass over every light
const T = (i) => 3 * 0.93 ** i;
show('hot: noise');
for (let i = 0; i < 12; i++) field.sweep(1 / T(i));
show('12 sweeps: cooling');
for (let i = 12; i < 40; i++) field.sweep(1 / T(i));
show('40 sweeps: settled');
