// THE DRAG BOX (lane HERODRAG): the click-or-drag threshold, the touch long-press rule, the rectangle, four children
// born inside it and kept inside it, the 4 to 7 s fade, the cap, and settle()'s wiring: a click stays a click, a drag
// tells the page its rectangle, a drop sends four sounds and lights four children, reduced motion and a paused picture
// make still marks.
import test from 'node:test';
import assert from 'node:assert/strict';

const stubCtx = () => new Proxy({}, {
  get(t, k) {
    if (k in t) return t[k];
    if (k === 'createImageData' || k === 'getImageData') return (w, h) => ({ data: new Uint8ClampedArray(4 * (w || 1) * (h || 1)) });
    if (k === 'measureText') return () => ({ width: 1 });
    return () => ({ addColorStop() {} });
  },
  set(t, k, v) { t[k] = v; return true; },
});
class FakeCanvas {
  constructor(w = 400, h = 200) { this.width = 1; this.height = 1; this.clientWidth = w; this.clientHeight = h; this.ls = {}; this.style = {}; this.captured = null; }
  getContext() { return stubCtx(); }
  addEventListener(k, fn, opt) { this.ls[k] = fn; if (k === 'touchmove') this.touchOpt = opt; }
  removeEventListener(k) { delete this.ls[k]; }
  setPointerCapture(id) { this.captured = id; }
  releasePointerCapture() { this.captured = null; }
  getBoundingClientRect() { return { left: 0, top: 0, width: this.clientWidth, height: this.clientHeight }; }
}
globalThis.OffscreenCanvas = FakeCanvas;
let frames = [];
globalThis.requestAnimationFrame = (fn) => { frames.push(fn); return frames.length; };

const { DRAG, createDragGesture, rectFrom, dragFadeMs, dragTiming, placeChildren, stepChildren, splitChildren, stepEscape, createInterference, capList, boxesTouch, rooms, nudgeKids, createNoiseGate } = await import('../src/dragbox.js');
const { settle, globalSettle } = await import('../src/index.js');
const { dragPulse } = await import('../src/mount.js');

const seq = (vals) => { let i = 0; return () => vals[i++ % vals.length]; };
const inside = (c, b) => c.x >= b.x0 && c.x <= b.x1 && c.y >= b.y0 && c.y <= b.y1;

test('the gesture: under 6 px is a click on release, 6 px and more is a drag, a release after a drag is a drop', () => {
  assert.equal(DRAG.threshold, 6);
  const g = createDragGesture();
  g.down({ x: 100, y: 50, t: 0, type: 'mouse', button: 0 });
  assert.equal(g.move({ x: 104, y: 53, t: 10 }), 'none', '5 px: still a press');
  assert.equal(g.state, 'pressed');
  assert.equal(g.up({ x: 104, y: 53 }), 'click');
  const h = createDragGesture();
  h.down({ x: 100, y: 50, t: 0, type: 'mouse', button: 0 });
  assert.equal(h.move({ x: 106, y: 50, t: 10 }), 'start', '6 px: a drag');
  assert.equal(h.move({ x: 160, y: 90, t: 20 }), 'move');
  assert.deepEqual(h.box(), { x: 100, y: 50, w: 60, h: 40 });
  assert.equal(h.up({ x: 160, y: 90 }), 'drop');
  const r = createDragGesture();
  assert.equal(r.down({ x: 1, y: 1, t: 0, type: 'mouse', button: 2 }), 'ignore', 'a right button is not a gesture');
  assert.equal(r.up({ x: 1, y: 1 }), 'none');
});

test('the touch rule: a finger moving early is a scroll; held 300 ms it arms, then drags; a tap is a click', () => {
  const s = createDragGesture();
  s.down({ x: 50, y: 50, t: 0, type: 'touch' });
  assert.equal(s.move({ x: 50, y: 80, t: 60 }), 'scroll', 'moved 30 px in 60 ms: the page scrolls');
  assert.equal(s.up({ x: 50, y: 80 }), 'none', 'a scroll is never a click');
  const a = createDragGesture();
  a.down({ x: 50, y: 50, t: 0, type: 'touch' });
  assert.equal(a.tick(299), 'none');
  assert.equal(a.tick(300), 'arm');
  assert.equal(a.state, 'armed');
  assert.equal(a.move({ x: 90, y: 90, t: 400 }), 'start');
  assert.equal(a.up({ x: 90, y: 90 }), 'drop');
  const t = createDragGesture();
  t.down({ x: 5, y: 5, t: 0, type: 'touch' });
  assert.equal(t.move({ x: 8, y: 7, t: 40 }), 'none', 'within the slop');
  assert.equal(t.up({ x: 8, y: 7 }), 'click');
  const c = createDragGesture();
  c.down({ x: 5, y: 5, t: 0, type: 'touch' });
  c.tick(400);
  assert.equal(c.cancel(), 'cancel', 'an armed press that is cancelled says so');
});

test('the rectangle: any two corners, clamped to the canvas', () => {
  assert.deepEqual(rectFrom({ x: 80, y: 60 }, { x: 20, y: 10 }), { x: 20, y: 10, w: 60, h: 50 });
  assert.deepEqual(rectFrom({ x: 380, y: 20 }, { x: 500, y: -40 }, { w: 400, h: 200 }), { x: 380, y: 0, w: 20, h: 20 });
});

test('the clock: twice the first life (2.8 s), 20% inside the box, and the box fades over exactly that 20%', () => {
  assert.equal(DRAG.lifeS, 2 * 2.8);
  const mid = dragTiming(0.5, 24);
  assert.deepEqual(mid, { lifeMs: 5600, insideMs: 1120, fadeMs: 1120, lifeFrames: 134, insideFrames: 27 });
  assert.equal(dragFadeMs(0.5), 1120);
  for (let k = 0; k < 200; k++) {
    const T = dragTiming(Math.random(), 24);
    assert.ok(T.lifeMs >= 5040 && T.lifeMs <= 6160, String(T.lifeMs));
    assert.equal(T.fadeMs, T.insideMs, 'the box is gone when the escape starts');
    assert.ok(Math.abs(T.insideMs / T.lifeMs - 0.2) < 0.001);
    assert.ok(Math.abs(T.insideFrames / T.lifeFrames - 0.2) < 0.01);
  }
});

test('the fractal touch: each child splits into two of half the mass, heading apart, each with its own turn', () => {
  const kids = [{ id: 0, x: 5, y: 5, vx: 1, vy: 0, mass: 1, age: 27 }, { id: 1, x: 9, y: 9, vx: 0, vy: 1, mass: 1, age: 27 }];
  const two = splitChildren(kids, seq([0.25, 0.75]));
  assert.equal(two.length, 4);
  assert.ok(two.every((c) => c.mass === 0.5 && c.gen === 1 && c.age === 27));
  const a = Math.atan2(two[0].vy, two[0].vx);
  const b = Math.atan2(two[1].vy, two[1].vx);
  assert.ok(Math.abs(a - b - -2 * DRAG.splitSpread) < 1e-9, 'the halves take +-spread from the course');
  assert.ok(Math.sign(two[0].turn) !== Math.sign(two[1].turn), 'they curve away from each other');
  assert.equal(new Set(two.map((c) => c.id)).size, 4);
});

test('the escape: each child goes its own curving way over the whole picture, bounces off its edges, ends at its life', () => {
  const bounds = { x0: 0, y0: 0, x1: 199, y1: 99 };
  let kids = splitChildren(placeChildren({ x0: 90, y0: 40, x1: 110, y1: 60 }, 4, seq([0.5])), seq([0.1, 0.9, 0.4, 0.6]));
  const life = 134;
  kids = kids.map((c) => ({ ...c, age: 27 }));
  let left = false;
  let bounced = false;
  for (let f = 27; f < life + 2; f++) {
    kids = stepEscape(kids, bounds, { life });
    for (const c of kids) assert.ok(c.x >= 0 && c.x <= 199 && c.y >= 0 && c.y <= 99);
    if (kids.some((c) => c.x < 90 || c.x > 110 || c.y < 40 || c.y > 60)) left = true;
    // a child on an edge is moving back inside: it bounced
    if (kids.some((c) => (c.x === 0 && c.vx > 0) || (c.x === 199 && c.vx < 0) || (c.y === 0 && c.vy > 0) || (c.y === 99 && c.vy < 0))) bounced = true;
  }
  assert.ok(left, 'they leave the box');
  assert.ok(bounced, 'they bounce off the picture edges');
  assert.equal(kids.length, 0, 'gone at the end of the life');
  // no pull between them: one child steps the same alone as in a crowd
  const one = [{ id: 0, x: 50, y: 50, vx: 1, vy: 0.5, mass: 0.5, age: 30, turn: 0.01 }];
  const crowd = [...one, { id: 1, x: 51, y: 50, vx: -1, vy: 0, mass: 0.5, age: 30, turn: -0.02 }];
  assert.deepEqual(stepEscape(one, bounds, { life })[0], stepEscape(crowd, bounds, { life })[0]);
});

test('the interference: two crests add, a crest on a trough cancels, each light once per ring, clipped, flushed clean', () => {
  const I = createInterference(40, 40);
  const got = () => { const m = new Map(); I.flush((i, s) => m.set(i, s)); return m; };
  // one ring alone: crest +0.5, trough -0.35
  I.ring({ x: 20, y: 20, r: 8, width: 1, amp: 0.5, lambda: 4 });
  const one = got();
  const vals = [...one.values()];
  assert.ok(Math.max(...vals) <= 0.5 + 1e-6, 'a light counts once per ring');
  assert.ok(vals.some((v) => Math.abs(v - 0.5) < 1e-6) && vals.some((v) => Math.abs(v + 0.35) < 1e-6));
  assert.equal(got().size, 0, 'flush clears the sum');
  // two equal rings on one centre: every crest light doubles
  I.ring({ x: 20, y: 20, r: 8, width: 1, amp: 0.5, lambda: 4 });
  I.ring({ x: 20, y: 20, r: 8, width: 1, amp: 0.5, lambda: 4 });
  const two = [...got().values()];
  assert.ok(two.some((v) => Math.abs(v - 1) < 1e-6), 'crest on crest: double');
  // a crest laid on the other ring's trough circle cancels: a second ring whose crest sits where the first's trough is
  I.ring({ x: 20, y: 20, r: 8, width: 1, amp: 0.5, lambda: 4 }); // trough at r = 6, -0.35
  I.ring({ x: 20, y: 20, r: 6, width: 1, amp: 0.35, lambda: 40 }); // crest at r = 6, +0.35 (its trough is off the grid)
  const m = got();
  const at6 = 20 * 40 + 26; // (26, 20) is on r = 6
  assert.ok(Math.abs(m.get(at6)) < 1e-6, `crest on trough cancels (${m.get(at6)})`);
  // clipped: nothing outside the clip box
  I.ring({ x: 20, y: 20, r: 8, width: 1, amp: 0.5, lambda: 4, clip: { x0: 20, y0: 0, x1: 39, y1: 39 } });
  for (const i of got().keys()) assert.ok(i % 40 >= 20);
});

test('four children are born inside the rectangle, one in each quarter, turning the same way', () => {
  const box = { x0: 10, y0: 20, x1: 110, y1: 70 };
  const kids = placeChildren(box, 4, seq([0.5]));
  assert.equal(kids.length, 4);
  for (const c of kids) assert.ok(inside(c, box));
  assert.deepEqual(kids.map((c) => [c.x, c.y]), [[35, 32.5], [85, 32.5], [85, 57.5], [35, 57.5]]);
  const cx = 60;
  const cy = 45;
  const turn = kids.map((c) => Math.sign((c.x - cx) * c.vy - (c.y - cy) * c.vx));
  assert.ok(turn.every((s) => s === turn[0] && s !== 0), 'all orbit one way');
});

test('they move inside the walls, push apart early, pull together and merge late, and end at their life', () => {
  const box = { x0: 0, y0: 0, x1: 60, y1: 30 };
  let kids = placeChildren(box, 4, seq([0.3, 0.7, 0.5, 0.1]));
  const life = 70;
  const spread = (ks) => { const mx = ks.reduce((a, c) => a + c.x, 0) / ks.length; const my = ks.reduce((a, c) => a + c.y, 0) / ks.length; return ks.reduce((a, c) => a + Math.hypot(c.x - mx, c.y - my), 0) / ks.length; };
  const s0 = spread(kids);
  let mergeCount = 0;
  let moved = false;
  const start = kids.map((c) => [c.x, c.y]);
  for (let f = 0; f < life + 5; f++) {
    const r = stepChildren(kids, box, { life });
    if (f === 10) moved = r.kids.some((c, i) => Math.hypot(c.x - start[i][0], c.y - start[i][1]) > 0.5);
    if (f === 20) assert.ok(spread(r.kids) >= s0 * 0.9, 'early they keep apart');
    mergeCount += r.merges.length;
    for (const c of r.kids) assert.ok(inside(c, box), `inside at frame ${f}`);
    kids = r.kids;
  }
  assert.ok(moved, 'they move');
  assert.ok(mergeCount >= 1, `they merge in the pulling half (${mergeCount})`);
  assert.equal(kids.length, 0, 'gone at the end of their life');
});

test('the cap keeps the newest', () => {
  assert.deepEqual(capList([1, 2, 3, 4, 5], 3), [3, 4, 5]);
  assert.deepEqual(capList([1, 2], 3), [1, 2]);
  assert.equal(DRAG.maxBoxes, 10, 'lane MULTIRECT: ten boxes live at once (was three)');
});

// MANY BOXES (lane MULTIRECT, navigator 2026-10-04): "I want to be able to click and drag multiple! Don't cycle
// colours! Just have MULTI RECTANGLES ability, one after another. And those can interact with each other too!"
test('THE ONE ROOM: overlapping boxes, directly or through a chain, share a room; apart they do not', () => {
  const A = { x0: 0, y0: 0, x1: 10, y1: 10 };
  const B = { x0: 8, y0: 8, x1: 20, y1: 20 };
  const C = { x0: 19, y0: 0, x1: 30, y1: 9 };
  const D = { x0: 50, y0: 50, x1: 60, y1: 60 };
  assert.equal(boxesTouch(A, B), true);
  assert.equal(boxesTouch(A, C), false);
  assert.equal(boxesTouch(A, D), false);
  assert.equal(boxesTouch(A, { x0: 12, y0: 0, x1: 20, y1: 5 }, 3), true, 'within the gap counts');
  assert.deepEqual(rooms([A, B, C, D]), [0, 0, 0, 1], 'A-B-C is a chain: one room; D alone');
  assert.deepEqual(rooms([D, A]), [0, 1]);
  assert.deepEqual(rooms([]), []);
});

test('THE ONE ROOM: a twinkle walks through the overlap into its neighbour, and is held inside the union', () => {
  const A = { x0: 0, y0: 0, x1: 20, y1: 20 };
  const B = { x0: 15, y0: 5, x1: 45, y1: 15 }; // overlaps A on x 15..20
  const kid = [{ id: 0, x: 18, y: 10, vx: 1.2, vy: 0, mass: 1, age: 0 }];
  const opts = { life: 1e9, swirl: 0, damp: 1, vmax: 2 };
  // alone in A: the wall at x = 20 turns it back
  let k1 = kid;
  for (let i = 0; i < 6; i++) k1 = stepChildren(k1, A, opts).kids;
  assert.ok(k1[0].x <= A.x1, 'alone, A\'s wall holds it: ' + k1[0].x);
  // in a room with B: it walks on past A's wall, into B, and B's far wall still holds it
  let k2 = kid;
  let past = false;
  for (let i = 0; i < 40; i++) {
    k2 = stepChildren(k2, A, { ...opts, room: [A, B] }).kids;
    if (k2[0].x > A.x1 + 1) past = true;
    assert.ok(k2[0].x <= B.x1 && k2[0].x >= A.x0 && k2[0].y >= A.y0 && k2[0].y <= A.y1, JSON.stringify(k2[0]));
  }
  assert.ok(past, 'it went through the overlap into B');
  // a room of one box is the old walls, exactly
  const P = placeChildren({ x0: 0, y0: 0, x1: 30, y1: 20 }, 4, seq([0.3, 0.7]));
  const box = { x0: 0, y0: 0, x1: 30, y1: 20 };
  assert.deepEqual(stepChildren(P, box, { life: 1e9 }), stepChildren(P, box, { life: 1e9, room: [box], others: [] }));
});

test('THE ONE ROOM: the other box\'s twinkles push as a group\'s own do', () => {
  const box = { x0: 0, y0: 0, x1: 40, y1: 40 };
  const kid = [{ id: 0, x: 20, y: 20, vx: 0, vy: 0, mass: 1, age: 0 }];
  const o = { life: 1e9, swirl: 0, damp: 1 };
  const still = stepChildren(kid, box, o).kids[0];
  assert.equal(still.vx, 0);
  const pushed = stepChildren(kid, box, { ...o, others: [{ x: 18, y: 20, mass: 1 }] }).kids[0];
  assert.ok(pushed.vx > 0, 'a neighbour on its left pushes it right: ' + pushed.vx);
  assert.equal(pushed.vy, 0);
});

test('THE NUDGE: a new box kicks the twinkles away from its centre, strongest near it', () => {
  const kids = [
    { id: 0, x: 12, y: 10, vx: 0, vy: 0, mass: 1 },
    { id: 1, x: 40, y: 10, vx: 0, vy: 0, mass: 1 },
    { id: 2, x: 10, y: 10, vx: 0.3, vy: 0, mass: 1 },
  ];
  const out = nudgeKids(kids, { x: 10, y: 10 }, { strength: 1, reach: 10 });
  assert.ok(Math.abs(out[0].vx - Math.exp(-0.2)) < 1e-12, 'away from the centre, strength exp(-d / reach)');
  assert.equal(out[0].vy, 0);
  assert.ok(out[1].vx > 0 && out[1].vx < out[0].vx, 'farther, weaker');
  assert.equal(out[2].vx, 0.3, 'at the centre itself: no direction, no kick');
  assert.equal(kids[0].vx, 0, 'the input is not changed');
  assert.equal(DRAG.nudge > 0 && DRAG.nudge < 2, true, 'a modest kick');
});

test('THE CROSS PULL: an escaped twinkle bends toward another box\'s twinkles, capped; alone it keeps its course', () => {
  const bounds = { x0: 0, y0: 0, x1: 200, y1: 200 };
  const k = [{ id: 0, x: 100, y: 100, vx: 1, vy: 0, mass: 0.5, age: 0, turn: 0 }];
  const alone = stepEscape(k, bounds, { life: 100, speed: 1 })[0];
  assert.ok(Math.abs(alone.vy) < 1e-12, 'no others: straight on');
  const near = stepEscape(k, bounds, { life: 100, speed: 1, others: [{ x: 100, y: 120, mass: 0.5 }] })[0];
  assert.ok(near.vy > 0, 'bent toward the twinkle below it: ' + near.vy);
  const crowd = Array.from({ length: 40 }, () => ({ x: 100, y: 101, mass: 2 }));
  const many = stepEscape(k, bounds, { life: 100, speed: 1, others: crowd })[0];
  assert.ok(Math.atan2(many.vy, many.vx) <= DRAG.crossPull * 1.01, 'the bend is capped at crossPull of the speed a frame');
  const none = stepEscape(k, bounds, { life: 100, speed: 1, others: [{ x: 100, y: 120 }], crossPull: 0 })[0];
  assert.deepEqual(none, alone, 'crossPull 0 is the old escape exactly');
});

test('THE NOISE GATE: a burst sounds noiseBurst drops, then noisePerSecond', () => {
  assert.equal(DRAG.noiseBurst, 6);
  assert.equal(DRAG.noisePerSecond, 3);
  const g = createNoiseGate();
  const at0 = Array.from({ length: 10 }, () => g.take(1000));
  assert.deepEqual(at0, [true, true, true, true, true, true, false, false, false, false]);
  assert.equal(g.take(1300), false, 'a third of a second: 0.9 of a token');
  assert.equal(g.take(1340), true, 'one token back');
  assert.equal(g.take(1340), false);
  const h = createNoiseGate({ burst: 2, perSecond: 1 });
  h.take(0); h.take(0);
  assert.equal(h.take(60000), true, 'a long quiet refills it');
  assert.equal(h.take(60000), true);
  assert.equal(h.take(60000), false, 'never past the burst');
});

// settle() with opts.drag on a stand-in canvas
const mk = (o = {}) => {
  const c = new FakeCanvas();
  const seen = [];
  const h = settle(c, { res: [80, 40], motion: 'always', audio: true, globalId: 'hero', drag: true, onDrag: (e) => seen.push(e), ...o });
  return { c, h, seen };
};
const pe = (x, y, t, more = {}) => ({ clientX: x, clientY: y, timeStamp: t, pointerId: 1, pointerType: 'mouse', button: 0, isPrimary: true, preventDefault() { this.prevented = true; }, ...more });

test('settle(drag): a press and a release in place is the old click, at release; a drag is not a click', () => {
  const P = globalSettle();
  const heard = [];
  const off = P.onRipple((d) => heard.push(d));
  const { c, h, seen } = mk();
  const d = pe(100, 50, 1);
  c.ls.pointerdown(d);
  assert.ok(d.prevented, 'a mouse press never starts a text selection');
  assert.equal(c.captured, 1, 'the press holds the pointer');
  assert.equal(heard.length, 0, 'nothing yet: it may still be a drag');
  c.ls.pointerup(pe(102, 51, 80));
  assert.equal(heard.length, 1, 'released in place: one click');
  assert.equal(heard[0].x, 100, 'at the press point');
  assert.equal(heard[0].sound, true);
  assert.equal(seen.length, 0, 'a click draws no rectangle');
  c.ls.pointerdown(pe(40, 40, 200));
  c.ls.pointermove(pe(200, 160, 220));
  assert.equal(seen.at(-1).phase, 'move');
  assert.deepEqual(seen.at(-1).box, { x: 40, y: 40, w: 160, h: 120 });
  assert.equal(heard.length, 1, 'a drag clicks nothing while it draws');
  h.destroy();
  off();
});

test('settle(drag): a drop lights four children inside the box and sends four sounds, one after another', async () => {
  const P = globalSettle();
  const heard = [];
  const off = P.onRipple((d) => heard.push(d));
  const { c, h, seen } = mk();
  c.ls.pointerdown(pe(40, 20, 1));
  c.ls.pointermove(pe(240, 140, 20));
  c.ls.pointerup(pe(240, 140, 40));
  const drop = seen.at(-1);
  assert.equal(drop.phase, 'drop');
  assert.equal(drop.still, false);
  assert.equal(drop.children, 4);
  assert.ok(drop.fadeMs >= 1008 && drop.fadeMs <= 1232);
  assert.equal(drop.fadeMs, drop.insideMs, 'the box fades over the inside phase');
  assert.ok(Math.abs(drop.lifeMs / drop.fadeMs - 5) < 0.01, 'the four live five times the box: 20% inside, 80% escaped');
  for (const m of drop.marks) assert.ok(m.x >= 40 && m.x <= 240 && m.y >= 20 && m.y <= 140, JSON.stringify(m));
  const G = h.dragGroups;
  assert.equal(G.length, 1);
  assert.equal(G[0].kids.length, 4);
  const local = () => heard.filter((d) => d.scope === 'local');
  assert.equal(local().length, 1, 'the first sound at once');
  await new Promise((r) => setTimeout(r, 4 * DRAG.soundGapMs + 30));
  assert.equal(local().length, 4, 'four sounds');
  assert.ok(local().every((d) => d.sound && d.source === 'hero' && d.kind === 'drop'));
  h.advance(5);
  assert.ok(h.field.holding, 'the children hold lights');
  for (const k of h.dragGroups[0].kids) assert.ok(k.x >= G[0].box.x0 && k.x <= G[0].box.x1 && k.y >= G[0].box.y0 && k.y <= G[0].box.y1);
  const g0 = h.dragGroups[0];
  h.advance(g0.inside - g0.age - 1);
  assert.equal(h.dragGroups[0].out, false);
  assert.equal(h.dragGroups[0].kids.length, 4, 'four, inside, until the box is gone');
  h.advance(2);
  assert.equal(h.dragGroups[0].out, true, 'the escape starts with the box gone');
  assert.equal(h.dragGroups[0].kids.length, 8, 'each split in two');
  let outside = false;
  for (let k = 0; k < 40; k++) {
    h.advance(1);
    const gg = h.dragGroups[0];
    if (gg && gg.kids.some((c) => c.x < gg.box.x0 - 1 || c.x > gg.box.x1 + 1 || c.y < gg.box.y0 - 1 || c.y > gg.box.y1 + 1)) outside = true;
  }
  assert.ok(outside, 'escaped: they roam past the box');
  assert.ok(h.dragRings > 0, 'their rings are travelling');
  h.advance(200);
  assert.equal(h.dragGroups.length, 0, 'they end');
  assert.equal(h.dragRings, 0, 'and so do their rings');
  h.destroy();
  off();
});

test('settle(drag): ten groups alive, one after another; the eleventh drops the oldest; a tiny box is grown', () => {
  const { h, seen } = mk({ audio: false });
  const ids = [];
  for (let k = 0; k < 12; k++) ids.push(h.dropBox({ x: 10 + k * 30, y: 10, w: 30, h: 30 }));
  assert.equal(h.dragGroups.length, 10);
  assert.deepEqual(h.dragGroups.map((g) => g.id), ids.slice(2), 'the newest ten: the oldest went, never the new one');
  assert.ok(seen.filter((e) => e.phase === 'drop').every((e) => e.still === false), 'no drop refused');
  h.dropBox({ x: 100, y: 100, w: 1, h: 0 });
  const last = seen.at(-1);
  assert.ok(last.box.w >= DRAG.minBox && last.box.h >= DRAG.minBox);
  h.destroy();
});

test('settle(drag): a paused picture or reduced motion drops four still marks and no moving children', () => {
  const { h, seen } = mk({ audio: false, paused: true });
  h.dropBox({ x: 20, y: 20, w: 200, h: 120 });
  assert.equal(seen.at(-1).still, true);
  assert.equal(seen.at(-1).marks.length, 4);
  assert.equal(h.dragGroups.length, 0);
  h.destroy();
  globalThis.matchMedia = () => ({ matches: true });
  const r = mk({ audio: false, motion: undefined });
  r.h.dropBox({ x: 20, y: 20, w: 200, h: 120 });
  assert.equal(r.seen.at(-1).still, true);
  assert.equal(r.h.dragGroups.length, 0);
  r.h.destroy();
  delete globalThis.matchMedia;
});

test('settle(drag): touch arms after a hold, then owns the touch; without drag the press is still the click', async () => {
  const { c, h, seen } = mk({ audio: false, drag: { longPressMs: 20 } });
  assert.deepEqual(c.touchOpt, { passive: false });
  let blocked = false;
  c.ls.pointerdown(pe(50, 50, 0, { pointerType: 'touch' }));
  c.ls.touchmove({ preventDefault() { blocked = true; } });
  assert.equal(blocked, false, 'before the hold the page may scroll');
  await new Promise((r) => setTimeout(r, 40));
  assert.equal(seen.at(-1).phase, 'armed');
  c.ls.touchmove({ preventDefault() { blocked = true; } });
  assert.equal(blocked, true, 'armed: the finger draws, the page does not scroll');
  c.ls.pointermove(pe(150, 120, 100, { pointerType: 'touch' }));
  c.ls.pointerup(pe(150, 120, 120, { pointerType: 'touch' }));
  assert.equal(seen.at(-1).phase, 'drop');
  assert.equal(c.style.webkitTouchCallout, 'none');
  h.destroy();
  const P = globalSettle();
  const heard = [];
  const off = P.onRipple((d) => heard.push(d));
  const q = new FakeCanvas();
  const h2 = settle(q, { res: [80, 40], motion: 'always', audio: true, globalId: 'x' });
  q.ls.pointerdown(pe(10, 10, 1));
  assert.equal(heard.length, 1, 'no drag option: the click fires on the press, as it always did');
  h2.destroy();
  off();
});

test('settle(drag): a new box nudges the twinkles already alive; overlapping boxes are one room', () => {
  // a long inside phase (90% of the life) so the vortex has time to carry twinkles through the overlap
  const { h } = mk({ audio: false, drag: { insideShare: 0.9 } });
  h.dropBox({ x: 20, y: 20, w: 160, h: 120 });
  h.advance(3);
  const before = h.dragGroups[0].kids.map((c) => [c.vx, c.vy]);
  h.dropBox({ x: 120, y: 60, w: 160, h: 120 });
  const after = h.dragGroups[0].kids.map((c) => [c.vx, c.vy]);
  assert.notDeepEqual(after, before, 'the first box\'s twinkles were kicked by the second');
  const [A, B] = h.dragGroups;
  assert.ok(boxesTouch(A.box, B.box), 'the two overlap');
  // over the inside phase, some twinkle of either box stands outside its own box but inside the other: the room
  let crossed = false;
  const inBox = (c, b) => c.x >= b.x0 && c.x <= b.x1 && c.y >= b.y0 && c.y <= b.y1;
  for (let k = 0; k < 100 && h.dragGroups.every((g) => !g.out); k++) {
    h.advance(1);
    const [a, b] = h.dragGroups;
    if (a.kids.some((c) => !inBox(c, a.box) && inBox(c, b.box)) || b.kids.some((c) => !inBox(c, b.box) && inBox(c, a.box))) crossed = true;
    for (const g of [a, b]) for (const c of g.kids) assert.ok(inBox(c, a.box) || inBox(c, b.box), 'never outside the room');
  }
  assert.ok(crossed, 'a twinkle crossed through the overlap');
  h.destroy();
});

test('settle(drag): THE DROP IS ONE EVENT: quick drops sound all four noises each; the gate counts drops, never noises', async () => {
  // lane HERODRAGFIX: the gate used to take a token per NOISE, so a second drop inside a second lost two of its four
  // and a third lost all four ("like chance whether it hits"). Now a drop is one token and its answer rides all four.
  const P = globalSettle();
  const heard = [];
  const off = P.onRipple((d) => heard.push(d));
  const { h } = mk();
  for (let k = 0; k < 3; k++) h.dropBox({ x: 10 + k * 20, y: 10, w: 100, h: 80 });
  await new Promise((r) => setTimeout(r, 4 * DRAG.soundGapMs + 40));
  const births = heard.filter((d) => d.scope === 'local' && d.kind === 'drop');
  assert.equal(births.length, 12, 'every birth still ripples');
  assert.equal(births.filter((d) => d.sound).length, 12, 'three quick drops: all twelve noises sound');
  const ids = [...new Set(births.map((d) => d.drag))];
  assert.equal(ids.length, 3, 'each birth names its drop');
  for (const id of ids) {
    const mine = births.filter((d) => d.drag === id);
    assert.deepEqual(mine.map((d) => d.part).sort(), [0, 1, 2, 3], 'parts 0 .. 3');
    assert.equal(new Set(mine.map((d) => d.sound)).size, 1, 'one verdict for the whole drop');
  }
  h.destroy();
  off();
});

test('settle(drag): THE NOISE GATE in drops: eight drops at once, the first six sound whole, the last two silent whole', async () => {
  const P = globalSettle();
  const heard = [];
  const off = P.onRipple((d) => heard.push(d));
  const { h } = mk();
  for (let k = 0; k < 8; k++) h.dropBox({ x: 10 + k * 8, y: 10, w: 60, h: 50 });
  await new Promise((r) => setTimeout(r, 4 * DRAG.soundGapMs + 40));
  const births = heard.filter((d) => d.scope === 'local' && d.kind === 'drop');
  assert.equal(births.length, 32);
  const byDrop = new Map();
  for (const d of births) byDrop.set(d.drag, [...(byDrop.get(d.drag) ?? []), d.sound]);
  const verdicts = [...byDrop.entries()].sort((a, b) => a[0] - b[0]).map(([, v]) => (v.every(Boolean) ? 'all' : v.some(Boolean) ? 'part' : 'none'));
  assert.deepEqual(verdicts, ['all', 'all', 'all', 'all', 'all', 'all', 'none', 'none'], 'never half a drop');
  h.destroy();
  off();
});

test('settle(drag): THE RELEASE ANYWHERE: a mouse release the window hears completes the box', () => {
  const ls = {};
  const had = globalThis.window;
  globalThis.window = { addEventListener: (t, f) => { ls[t] = f; }, removeEventListener: (t, f) => { if (ls[t] === f) delete ls[t]; } };
  try {
    const { c, h, seen } = mk();
    c.ls.pointerdown(pe(40, 40, 1));
    assert.equal(typeof ls.pointerup, 'function', 'the window listens while pressed');
    c.ls.pointermove(pe(200, 160, 20));
    ls.pointerup(pe(900, 700, 40)); // outside the canvas; the canvas never hears it
    assert.equal(seen.at(-1).phase, 'drop', 'the box is dropped');
    assert.equal(ls.pointerup, undefined, 'and the window lets go');
    c.ls.pointerup(pe(900, 700, 41)); // a late canvas release changes nothing
    assert.equal(seen.filter((e) => e.phase === 'drop').length, 1, 'one drop, never two');
    h.destroy();
  } finally {
    if (had === undefined) delete globalThis.window;
    else globalThis.window = had;
  }
});

test('dragPulse: through the radial pulse bus when it is there, else a local ripple; always a drop with sound', () => {
  const calls = [];
  dragPulse({ x: 1, y: 2, source: 'hero' }, { clickPulse: (s) => calls.push(['bus', s]), ripple: (s) => calls.push(['local', s]) });
  dragPulse({ x: 3, y: 4, source: 'hero' }, { ripple: (s) => calls.push(['local', s]) });
  assert.equal(calls[0][0], 'bus');
  assert.deepEqual(calls[0][1], { x: 1, y: 2, source: 'hero', kind: 'drop', sound: true });
  assert.equal(calls[1][0], 'local');
  assert.deepEqual(calls[1][1], { x: 3, y: 4, source: 'hero', kind: 'drop', sound: true, scope: 'local' });
  dragPulse({ x: 5, y: 6, source: 'hero', sound: false }, { clickPulse: (s) => calls.push(['bus', s]) });
  assert.equal(calls[2][1].sound, false, 'a birth the noise gate held back pulses silent');
});
