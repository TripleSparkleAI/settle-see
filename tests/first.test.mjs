// The first program (lane SEEPAGE, 2026-10-08): examples/first.mjs is the program the SETTLE site's #/settlesee shows
// in GETTING STARTED with its recorded output, examples/first.out. This file runs the program and fails when its output
// stops matching the record, so the page can never show an output the program no longer prints.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { createField } from '../src/index.js';

const dir = fileURLToPath(new URL('..', import.meta.url));
const run = () => execFileSync(process.execPath, ['examples/first.mjs'], { cwd: dir, encoding: 'utf8' });

test('examples/first.mjs prints exactly its recorded output', () => {
  assert.equal(run(), readFileSync(new URL('../examples/first.out', import.meta.url), 'utf8'));
});

test('the record shows a settle: noise first, the heart last, agreement rising', () => {
  const out = readFileSync(new URL('../examples/first.out', import.meta.url), 'utf8');
  const r = [...out.matchAll(/agreement with the heart: (-?[0-9.]+)/g)].map((m) => Number(m[1]));
  assert.equal(r.length, 3);
  assert.ok(r[0] < 0.2, `hot is noise: ${r[0]}`);
  assert.ok(r[2] > 0.95, `cooled is the heart: ${r[2]}`);
  assert.ok(r[0] < r[1] && r[1] < r[2], 'it rises');
});

test('negative control: another seed draws other noise, so the match above is a real check', () => {
  const t = new Int8Array(36 * 15).fill(-1);
  const a = createField({ w: 36, h: 15, target: t, seed: 7 });
  const b = createField({ w: 36, h: 15, target: t, seed: 8 });
  assert.notDeepEqual(Array.from(a.s), Array.from(b.s));
});
