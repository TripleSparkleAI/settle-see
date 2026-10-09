// settle-see · THE OBSERVER'S BATCH (lane DJVISUAL): a settle reads its IntersectionObserver batch's LAST entry, so a
// child that goes from clipped to shown inside one frame (a panel opening) runs. Red-proven: reading the first entry
// again (the old ([e]) => e.isIntersecting) fails the first test.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { seenNow } from '../src/mount.js';

test('the last entry of a batch decides: hidden then shown in one callback is shown', () => {
  assert.equal(seenNow([{ isIntersecting: false }, { isIntersecting: true }], true), true);
  assert.equal(seenNow([{ isIntersecting: true }, { isIntersecting: false }], true), false);
  assert.equal(seenNow([{ isIntersecting: false }], true), false);
});

test('an empty batch keeps what was', () => {
  assert.equal(seenNow([], false), false);
  assert.equal(seenNow(undefined, true), true);
});

test('the settle\'s own observer uses it', () => {
  const src = readFileSync(new URL('../src/mount.js', import.meta.url), 'utf8');
  assert.match(src, /new IntersectionObserver\(\(es\) => \{ visible = seenNow\(es, visible\); \}/);
  assert.doesNotMatch(src, /IntersectionObserver\(\(\[e\]\)/);
});
