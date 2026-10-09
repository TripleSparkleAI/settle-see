// THE GENTLE RINGS, THE SOFTER ANSWER AND THE BAND SPLIT (lane FOOTERLADDER, 2026-10-04): opts.rings gives a settle a
// short, thin click in time rather than frames; opts.radial scales one consumer's answer to a page wave; brainScene's
// spec.split moves the gap between the two bands. Every default is what it always was.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { ringsFor, radialAnswer, frontCells, brainScene, rideScene, RIDE_START, BAND_SPLIT } from '../src/index.js';

const read = (f) => readFileSync(new URL(`../${f}`, import.meta.url), 'utf8');

test('ringsFor with no opts.rings is the click it always was: 4 + power - 1 rings to the far corner', () => {
  const g = { w: 384, h: 216 };
  const far = Math.hypot(g.w, g.h);
  const p1 = ringsFor({}, g, 24, 1);
  assert.equal(p1.rings.length, 4);
  assert.equal(p1.strands, 16);
  assert.equal(p1.strandLife, null, 'the default strands keep their own random life');
  for (const [j, r] of p1.rings.entries()) {
    assert.equal(r.max, far);
    assert.equal(r.speed, Math.max(0.8, g.w / 160));
    assert.equal(r.width, 0.55);
    assert.equal(r.floor, 0.15);
    assert.equal(r.wait, j * 6);
  }
  const p3 = ringsFor({ pulses: 4 }, g, 24, 3);
  assert.equal(p3.rings.length, 6, 'power adds rings');
  assert.ok(p3.rings[0].speed > p1.rings[0].speed && p3.rings[0].width > p1.rings[0].width);
});

test('ringsFor with opts.rings: count rings to reach x the shorter side in ms at this fps, thin, fading to nothing', () => {
  const g = { w: 448, h: 229 };
  const o = { rings: { count: 2, reach: 0.16, ms: 700, gapMs: 180, width: 0.4, bright: 0.75, sparks: 4 } };
  for (const fps of [4, 8, 24]) {
    const p = ringsFor(o, g, fps, 5);
    assert.equal(p.rings.length, 2, 'combo power adds nothing');
    const r = p.rings[0];
    assert.equal(r.max, 0.16 * 229);
    assert.ok(Math.abs(r.max / r.speed - (0.7 * fps)) < 1e-9, `${fps} fps: reach in 700 ms`);
    assert.equal(r.floor, 0);
    assert.equal(r.bright, 0.75);
    assert.equal(p.rings[1].wait, Math.max(1, Math.round(0.18 * fps)));
    assert.equal(p.strands, 4);
    assert.equal(p.strandLife, Math.max(2, Math.round(0.7 * fps)));
  }
});

test('the mount draws a gentle ring as one moving crest, lets go of last frame\'s lights, and stays calm only once they are gone', () => {
  const src = read('src/mount.js');
  assert.match(src, /const plan = ringsFor\(o, geom, fpsOf\(\), power\);/);
  assert.match(src, /for \(const i of ringLit\) F\.held\[i\] = 0;/);
  assert.match(src, /!rings\.length && !ringLit\.length/, 'a ring\'s last lights are let go before the settle rests');
  assert.match(src, /if \(power === maxP && !o\.rings\) F\.shake\(0\.08\);/, 'no shake from a gentle click');
});

test('opts.radial scales this consumer\'s crest and kick, never the wave itself', () => {
  const src = read('src/mount.js');
  assert.match(src, /waves\.set\(w\.id, radialAnswer\(w, o\.radial\)\);/);
  assert.match(src, /kick = Math\.min\(1\.2, kick \+ a\.kick \* \(o\.radial\?\.kick \?\? 1\)\);/);
  // the React wrapper passes both through
  assert.match(read('react/Settle.jsx'), /'rings', 'radial',/);
});

test('radialAnswer: gain and band scale the crest, no opts.radial leaves the wave as it is', () => {
  const w = { id: 1, a: 0.4, band: 56, r: 300 };
  assert.equal(radialAnswer(w, null), w, 'absent: the same object');
  const soft = radialAnswer(w, { gain: 0.45, band: 0.6 });
  assert.ok(Math.abs(soft.a - 0.18) < 1e-12 && Math.abs(soft.band - 33.6) < 1e-12);
  assert.equal(soft.r, 300, 'the rest of the wave is kept');
  assert.equal(w.a, 0.4, 'the wave itself is never changed');
});

test('radialAnswer\'s floor (lane FOOTERMINI): a faint wave still draws at the floor, a strong one keeps its strength, none goes past 1', () => {
  const R = { gain: 1, band: 1.4, floor: 0.5 };
  assert.equal(radialAnswer({ a: 0.1, band: 56 }, R).a, 0.5, 'faint: lifted to the floor');
  assert.equal(radialAnswer({ a: 0.8, band: 56 }, R).a, 0.8, 'strong: its own');
  assert.equal(radialAnswer({ a: 3, band: 56 }, { gain: 1 }).a, 1, 'never past full');
  assert.equal(radialAnswer({ a: 0, band: 56 }, R).a, 0, 'a wave with no strength draws nothing, floor or not');
  assert.equal(radialAnswer({ a: 0.1, band: 56 }, { gain: 1 }).a, 0.1, 'no floor: the default is 0');
});

test('brainScene\'s split moves the gap between the bands; 0.5 is the default and is clamped to 0.3..0.7', () => {
  assert.equal(BAND_SPLIT, 0.5);
  const h = 200;
  const at = (split) => brainScene(300, h, { view: 'section', split }).rects.map((r) => [r.y0, r.y1]);
  assert.deepEqual(at(undefined), [[7, 94], [106, 193]]);
  assert.deepEqual(at(0.5), at(undefined));
  assert.deepEqual(at(0.36), [[7, 66], [78, 193]]);
  assert.deepEqual(at(0.1), at(0.3), 'clamped low');
  assert.notDeepEqual(brainScene(300, h, { view: 'section', split: 0.36 }).bits, brainScene(300, h, { view: 'section' }).bits, 'a different split is a different (and separately cached) picture');
  const ride = rideScene(300, h, { eye: 0.16, cam: RIDE_START, split: 0.36 });
  assert.deepEqual(ride.rects.map((r) => [r.y0, r.y1]), [[7, 66], [78, 193]], 'the ride follows the same split');
});

test('frontCells (lane FOOTERMINI): the lights a ring crosses, only in the rows asked for, both sides of the origin', () => {
  const w = 352;
  const h = 200;
  // a front from above the strip's middle, radius 120 lights, crossing a 10-row strip at rows 60..69
  const cells = [...frontCells(176, -40, 120, 2, w, h, 60, 69)];
  assert.ok(cells.length > 0);
  for (const i of cells) {
    const y = Math.floor(i / w);
    const x = i % w;
    assert.ok(y >= 60 && y <= 69, `row ${y} inside the window`);
    assert.ok(Math.abs(Math.hypot(x - 176, y + 40) - 120) <= 2, `(${x}, ${y}) on the ring`);
  }
  const xs = cells.map((i) => i % w);
  assert.ok(Math.min(...xs) < 176 && Math.max(...xs) > 176, 'the front travels both ways from where it enters');
  // a front that has not reached the window yet draws nothing there
  assert.equal(frontCells(176, -40, 50, 2, w, h, 60, 69).size, 0);
  // the whole grid when no rows are given, and nothing for a zero radius
  assert.ok(frontCells(176, 100, 40, 1, w, h).size > frontCells(176, 100, 40, 1, w, h, 95, 105).size);
  assert.equal(frontCells(176, 100, 0, 1, w, h).size, 0);
});

test('the handle draws the front as a flash, never a hold: the physics is untouched', () => {
  const src = read('src/mount.js');
  const body = src.slice(src.indexOf('    front(x, y, r, width = 2, level = 1, rows = null) {'), src.indexOf('    show(bits, { snap: copy'));
  assert.match(body, /F\.flash\(cells, /);
  assert.doesNotMatch(body, /F\.hold|F\.held|F\.setTarget/);
  assert.match(body, /if \(dead \|\| paused \|\| !visible/);
});
