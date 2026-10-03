// settle-see · deck - THE DECK RULE (the navigator, 2026-10-02): every SETTLE cycle deals like a deck of cards. Deal
// one at random, it is out; deal from the cards still in the deck; when the deck is empty, reshuffle all of them,
// and the first card of the new deck is never the last card of the old one. The usual name is a shuffle bag.
//
// THE ONE HELPER. This file is the single home of the deck for the SETTLE site, settle-see and settle-hear.
// settle-hear/src/deck.js is a byte-identical copy (settle-hear imports nothing from settle-see, so each library
// stands alone); settle-hear's tests/deck.test.mjs fails if the two files differ. The site's src/bag.js re-exports
// this file.
//
// <claudes_code_comments>
// ** Function List **
// deckRng(seed)                  - mulberry32: a small seeded generator, the same numbers in node and in a browser
// freshSeed()                    - a seed from Math.random, for a page that wants a new order every visit
// createBag(items, opts)         - the deck: next() deals one; peek() shows the next deal without dealing it;
//                                  putBack(item) returns a dealt card to the top; reset() reshuffles now;
//                                  .drawn .size .left .last .round
// indexDeck(n, opts)             - a deck over the indices 0 .. n-1 (a picture, a digit, a stored pattern by number)
// bagSequence(items, n, opts)    - the first n deals of a deck as an array, safe to loop (last never equals first)
// bagRng                         - deckRng under its older name (the site's bag.js called it that)
//
// ** Technical Review **
// - opts.seed (a number) seeds deckRng, so a test and a screenshot see the same order. opts.random (a function
//   giving [0, 1)) lends the deck a caller's own generator. With neither, the deck uses Math.random: a page that
//   wants a fresh order each visit passes nothing or freshSeed().
// - A round is a Fisher-Yates shuffle of every card. THE SEAM: when a round would open with the card the last round
//   closed on, that opening card swaps with a random later card (every card in an unweighted round is different).
//   A deck of one item deals it every time, because there is no other choice.
// - opts.weights (whole numbers, one per item) puts item i into the deck weights[i] times, so a heavier item comes
//   up more often and still exactly weights[i] times a round. A weighted round is dealt card by card: never the
//   card just dealt unless nothing else is left, a card holding more than half of what remains goes now (so the
//   round cannot corner itself), else a random card weighted by the copies left.
// - opts.first deals one named item first, in the first round only (the rest of that round is shuffled).
//   opts.after names a card treated as already dealt, so the first deal never equals it (a page carrying the last
//   card over from before).
// - putBack(item) puts a dealt card on top: the next deal returns it, ahead of the round (settle-hear's house
//   passes refuse a pass that would break a chain's budget and lead the next chain with it).
// - Draws are O(1): the round is an array read by an index, never shifted.
// </claudes_code_comments>

export function deckRng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export const bagRng = deckRng;

export function freshSeed() {
  return (Math.floor(Math.random() * 4294967295) >>> 0) || 1;
}

const NONE = Symbol('none');

export function createBag(items, { seed, random, weights, first = NONE, after = NONE } = {}) {
  const list = [...(items ?? [])];
  const r = typeof random === 'function' ? random : Number.isFinite(seed) ? deckRng(seed) : Math.random;
  const cards = [];
  list.forEach((it, i) => {
    const k = weights ? Math.max(0, Math.floor(Number(weights[i]) || 0)) : 1;
    for (let c = 0; c < k; c++) cards.push(it);
  });
  const below = (n) => Math.min(n - 1, Math.floor(r() * n));
  let pool = [];
  let at = 0;
  const back = [];
  let last = after;
  let drawn = 0;
  let round = 0;
  let opening = first !== NONE && list.includes(first) ? first : NONE;

  // a weighted round, dealt card by card: never the card just dealt (the seam included) unless nothing else is left;
  // a card holding more than half of what remains is dealt now, so the round never paints itself into a corner;
  // otherwise a random card, more likely the more copies of it remain
  const weightedRound = (prev) => {
    const left = new Map();
    for (const c of cards) left.set(c, (left.get(c) ?? 0) + 1);
    const out = [];
    let total = cards.length;
    let before = prev;
    if (opening !== NONE) {
      out.push(opening);
      left.set(opening, left.get(opening) - 1);
      total -= 1;
      before = opening;
      opening = NONE;
    }
    while (total > 0) {
      const can = [...left].filter(([c, n]) => n > 0 && c !== before);
      let pick;
      if (!can.length) pick = before;
      else {
        const forced = can.find(([, n]) => 2 * n > total);
        if (forced) pick = forced[0];
        else {
          let x = r() * can.reduce((s2, [, n]) => s2 + n, 0);
          pick = can[can.length - 1][0];
          for (const [c, n] of can) { if ((x -= n) < 0) { pick = c; break; } }
        }
      }
      out.push(pick);
      left.set(pick, left.get(pick) - 1);
      total -= 1;
      before = pick;
    }
    return out;
  };

  const reshuffle = () => {
    if (weights) {
      pool = weightedRound(last);
      at = 0;
      round += 1;
      return;
    }
    const a = [...cards];
    for (let i = a.length - 1; i > 0; i--) {
      const j = below(i + 1);
      [a[i], a[j]] = [a[j], a[i]];
    }
    if (opening !== NONE) {
      const k = a.indexOf(opening);
      if (k > 0) [a[0], a[k]] = [a[k], a[0]];
      opening = NONE;
    }
    // THE SEAM: the new round never opens on the card the old round closed on; it swaps with a random later card
    if (last !== NONE && a.length > 1 && a[0] === last) {
      const j = 1 + below(a.length - 1);
      [a[0], a[j]] = [a[j], a[0]];
    }
    pool = a;
    at = 0;
    round += 1;
  };

  const deck = {
    get drawn() { return drawn; },
    get size() { return cards.length; },
    get left() { return back.length + (pool.length - at); },
    get last() { return last === NONE ? undefined : last; },
    get round() { return round; },
    next() {
      if (back.length) {
        last = back.pop();
        drawn += 1;
        return last;
      }
      if (!cards.length) return undefined;
      if (at >= pool.length) reshuffle();
      last = pool[at++];
      drawn += 1;
      return last;
    },
    peek() {
      if (back.length) return back[back.length - 1];
      if (!cards.length) return undefined;
      if (at >= pool.length) reshuffle();
      return pool[at];
    },
    putBack(item) {
      back.push(item);
      drawn = Math.max(0, drawn - 1);
    },
    reset() {
      pool = [];
      at = 0;
      back.length = 0;
    },
  };
  return deck;
}

export function indexDeck(n, opts = {}) {
  return createBag(Array.from({ length: Math.max(0, Math.floor(Number(n) || 0)) }, (_, i) => i), opts);
}

export function bagSequence(items, n, opts = {}) {
  const bag = createBag(items, opts);
  const out = Array.from({ length: Math.max(0, n) }, () => bag.next());
  // a cycle that loops back to its start puts the last deal beside the first; when they match, swap the last deal
  // with an earlier one that differs from both of its neighbours, looking first inside the last round so every round
  // still deals each card once (lane LOGOGEOM: a swap reaching into round 0 dealt one card twice there)
  if (out.length > 2 && out[out.length - 1] === out[0]) {
    const L = out.length - 1;
    const per = opts.weights ? (items ?? []).reduce((s, _, i) => s + Math.max(0, Math.floor(Number(opts.weights[i]) || 0)), 0) : (items ?? []).length;
    const lastStart = per > 0 ? Math.floor(L / per) * per : 1;
    const trySwap = (from) => {
      for (let k = Math.max(1, from); k < L - 1; k++) {
        const a = out[k];
        const okK = out[k - 1] !== out[L] && out[k + 1] !== out[L];
        const okL = out[L - 1] !== a && out[0] !== a;
        if (okK && okL) {
          [out[k], out[L]] = [out[L], out[k]];
          return true;
        }
      }
      return false;
    };
    if (!trySwap(lastStart)) trySwap(1);
  }
  return out;
}
