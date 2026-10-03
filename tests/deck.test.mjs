// THE DECK RULE (src/deck.js): every SETTLE cycle deals like a deck of cards. Deal without replacement, reshuffle
// when empty, never repeat across the reshuffle, seeded in tests.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createBag, bagSequence, deckRng, bagRng, freshSeed } from '../src/deck.js';

const range = (n) => Array.from({ length: n }, (_, i) => i);
const rounds = (seq, n) => Array.from({ length: Math.floor(seq.length / n) }, (_, k) => seq.slice(k * n, (k + 1) * n));

test('every item exactly once per round, over many rounds and many seeds', () => {
  for (const n of [2, 3, 5, 8, 20, 30]) {
    for (let seed = 1; seed <= 40; seed++) {
      const deck = createBag(range(n), { seed });
      const seq = Array.from({ length: n * 25 }, () => deck.next());
      for (const [k, r] of rounds(seq, n).entries()) assert.deepEqual([...r].sort((a, b) => a - b), range(n), `n ${n} seed ${seed} round ${k}`);
    }
  }
});

test('no repeat across the reshuffle: the first deal of a round never equals the last deal of the round before', () => {
  let seams = 0;
  for (const n of [2, 3, 4, 7, 30]) {
    for (let seed = 1; seed <= 200; seed++) {
      const deck = createBag(range(n), { seed });
      const seq = Array.from({ length: n * 12 }, () => deck.next());
      for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `n ${n} seed ${seed}: ${seq[i]} twice at ${i}`);
      seams += 11;
    }
  }
  assert.ok(seams > 10000);
});

test('the seam rule is not vacuous: a plain reshuffle with no seam check repeats at a seam on these seeds', () => {
  // the same generator and the same Fisher-Yates, without the seam swap; if this never repeated, the test above
  // would prove nothing
  let repeats = 0;
  for (let seed = 1; seed <= 200; seed++) {
    const r = deckRng(seed);
    let prev;
    for (let k = 0; k < 12; k++) {
      const a = range(3);
      for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
      if (prev !== undefined && a[0] === prev) repeats += 1;
      prev = a[a.length - 1];
    }
  }
  assert.ok(repeats > 50, `${repeats} seam repeats`);
});

test('seeded: the same seed deals the same order, a different seed a different one', () => {
  const a = createBag(range(30), { seed: 7 });
  const b = createBag(range(30), { seed: 7 });
  const c = createBag(range(30), { seed: 8 });
  const sa = Array.from({ length: 90 }, () => a.next());
  assert.deepEqual(sa, Array.from({ length: 90 }, () => b.next()));
  assert.notDeepEqual(sa, Array.from({ length: 90 }, () => c.next()));
  assert.equal(bagRng, deckRng);
});

test('a deck of one deals it every time; a deck of two alternates; an empty deck deals undefined', () => {
  const one = createBag(['x'], { seed: 3 });
  assert.deepEqual(Array.from({ length: 6 }, () => one.next()), ['x', 'x', 'x', 'x', 'x', 'x']);
  for (let seed = 1; seed <= 50; seed++) {
    const two = createBag(['a', 'b'], { seed });
    const seq = Array.from({ length: 20 }, () => two.next());
    for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `seed ${seed}`);
  }
  const none = createBag([], { seed: 1 });
  assert.equal(none.next(), undefined);
  assert.equal(none.peek(), undefined);
});

test('peek shows the next deal without dealing it, across a reshuffle too', () => {
  const deck = createBag(range(5), { seed: 11 });
  for (let i = 0; i < 23; i++) {
    const p = deck.peek();
    assert.equal(deck.peek(), p);
    assert.equal(deck.next(), p);
  }
});

test('the counters: drawn, size, left, round, last', () => {
  const deck = createBag(['a', 'b', 'c'], { seed: 2 });
  assert.equal(deck.size, 3);
  assert.equal(deck.round, 0);
  const x = deck.next();
  assert.equal(deck.last, x);
  assert.equal(deck.drawn, 1);
  assert.equal(deck.left, 2);
  assert.equal(deck.round, 1);
  deck.next();
  deck.next();
  deck.next();
  assert.equal(deck.round, 2);
  assert.equal(deck.drawn, 4);
});

test('putBack puts a dealt card on top: the next deal returns it, and the round still holds every card once', () => {
  const deck = createBag(range(6), { seed: 4 });
  const a = deck.next();
  deck.putBack(a);
  assert.equal(deck.peek(), a);
  assert.equal(deck.next(), a);
  const rest = Array.from({ length: 5 }, () => deck.next());
  assert.deepEqual([a, ...rest].sort(), range(6));
});

test('reset reshuffles now and still keeps the seam', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const deck = createBag(range(4), { seed });
    deck.next();
    const last = deck.next();
    deck.reset();
    assert.notEqual(deck.next(), last, `seed ${seed}`);
    const round = [deck.last, ...Array.from({ length: 3 }, () => deck.next())];
    assert.deepEqual([...round].sort(), range(4));
  }
});

test('first deals one named item first in the first round only; after keeps the first deal off a carried card', () => {
  for (let seed = 1; seed <= 60; seed++) {
    const deck = createBag(['DEFAULT', 'a', 'b', 'c'], { seed, first: 'DEFAULT' });
    const seq = Array.from({ length: 16 }, () => deck.next());
    assert.equal(seq[0], 'DEFAULT');
    for (const r of rounds(seq, 4)) assert.deepEqual([...r].sort(), ['DEFAULT', 'a', 'b', 'c']);
    assert.notEqual(createBag(['p', 'q', 'r'], { seed, after: 'p' }).next(), 'p');
  }
});

test('a weighted deck: item i comes up weights[i] times a round, and equal cards are kept apart', () => {
  for (let seed = 1; seed <= 80; seed++) {
    const deck = createBag(['home', 'x', 'y'], { seed, weights: [3, 1, 2] });
    assert.equal(deck.size, 6);
    const seq = Array.from({ length: 6 * 10 }, () => deck.next());
    for (const r of rounds(seq, 6)) {
      assert.equal(r.filter((v) => v === 'home').length, 3);
      assert.equal(r.filter((v) => v === 'x').length, 1);
      assert.equal(r.filter((v) => v === 'y').length, 2);
    }
    for (let i = 1; i < seq.length; i++) assert.notEqual(seq[i], seq[i - 1], `seed ${seed} at ${i}: ${seq.join(' ')}`);
  }
});

test('random: a caller lends its own generator; with no seed and no generator the deck still deals every card once', () => {
  const deck = createBag(range(10), { random: deckRng(5) });
  const ref = createBag(range(10), { seed: 5 });
  assert.deepEqual(Array.from({ length: 30 }, () => deck.next()), Array.from({ length: 30 }, () => ref.next()));
  const free = createBag(range(10));
  assert.deepEqual(Array.from({ length: 10 }, () => free.next()).sort((a, b) => a - b), range(10));
  const s = freshSeed();
  assert.ok(Number.isInteger(s) && s > 0);
});

test('bagSequence: n deals, safe to loop (the last never equals the first), seeded', () => {
  for (let seed = 1; seed <= 100; seed++) {
    const seq = bagSequence(range(5), 25, { seed });
    assert.equal(seq.length, 25);
    for (let i = 0; i < seq.length; i++) assert.notEqual(seq[i], seq[(i + 1) % seq.length], `seed ${seed} at ${i}`);
  }
  assert.deepEqual(bagSequence(range(9), 30, { seed: 3 }), bagSequence(range(9), 30, { seed: 3 }));
});

test('bagSequence closes the loop inside the last round: every round still deals each item once (lane LOGOGEOM)', () => {
  // 63 of these 399 seeds once swapped the loop-closing deal into round 0 and dealt a card twice there
  let closed = 0;
  for (let seed = 1; seed < 400; seed++) {
    for (const [items, weights] of [[[0, 1, 2, 3, 4, 5], null], [['a', 'b', 'c'], [2, 1, 1]]]) {
      const per = weights ? 4 : items.length;
      const out = bagSequence(items, per * 3, weights ? { seed, weights } : { seed });
      for (let p = 0; p < 3; p++) {
        const round = out.slice(p * per, (p + 1) * per);
        if (weights) assert.deepEqual([...round].sort(), ['a', 'a', 'b', 'c'], `seed ${seed} round ${p}`);
        else assert.equal(new Set(round).size, per, `seed ${seed} round ${p}`);
      }
      if (weights) continue; // a card holding half a round cannot always keep off the loop's seam; its rounds still hold
      assert.notEqual(out[out.length - 1], out[0], `seed ${seed}: the loop closes on a different card`);
      for (let i = 1; i < out.length; i++) assert.notEqual(out[i], out[i - 1]);
      closed++;
    }
  }
  assert.equal(closed, 399);
});
