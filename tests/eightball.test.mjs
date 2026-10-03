// The shape tests: the eight ball is registered, draws its cue face without text and its answer with text, and the
// word wrap keeps every word (a recording canvas stands in for a real one, so these run under node).
import test from 'node:test';
import assert from 'node:assert/strict';
import { getShape, shapeNames, SHAPES, wrapLines } from '../src/index.js';

function recorder(charW = 0.6) {
  const calls = [];
  let size = 10;
  const c = new Proxy({}, {
    get(_, k) {
      if (k === 'calls') return calls;
      if (k === 'measureText') return (t) => ({ width: String(t).length * size * charW });
      return (...a) => calls.push([k, ...a]);
    },
    set(_, k, v) {
      if (k === 'font') size = Number((String(v).match(/(\d+)px/) || [])[1] || size);
      calls.push(['set', k, v]);
      return true;
    },
  });
  return c;
}

test('the eight ball is a registered shape and in SHAPES', () => {
  assert.ok(shapeNames().includes('eightball'));
  assert.ok(SHAPES.eightball);
});

test('without text it draws the cue face: one 8', () => {
  const c = recorder();
  getShape('eightball').draw(c, 200, 200, 2, {});
  const texts = c.calls.filter((x) => x[0] === 'fillText').map((x) => x[1]);
  assert.deepEqual(texts, ['8']);
});

test('with text it writes every word of the answer and no 8', () => {
  const c = recorder();
  const text = 'Concentrate and ask again.';
  getShape('eightball').draw(c, 240, 240, 2, { text });
  const texts = c.calls.filter((x) => x[0] === 'fillText').map((x) => x[1]);
  assert.ok(texts.length >= 1 && texts.length <= 3, `${texts.length} lines`);
  assert.equal(texts.join(' '), text);
  assert.ok(!texts.includes('8'));
});

test('wrapLines keeps every word in order and respects the line cap', () => {
  const c = recorder(1);
  c.font = '700 10px sans-serif';
  const lines = wrapLines(c, 'one two three four five six seven', 30, 3);
  assert.equal(lines.length, 3);
  assert.equal(lines.join(' '), 'one two three four five six seven');
});

test('negative control: a different answer draws different words', () => {
  const a = recorder();
  const b = recorder();
  getShape('eightball').draw(a, 240, 240, 2, { text: 'Yes.' });
  getShape('eightball').draw(b, 240, 240, 2, { text: 'Very doubtful.' });
  const t = (c) => c.calls.filter((x) => x[0] === 'fillText').map((x) => x[1]).join(' ');
  assert.notEqual(t(a), t(b));
});
