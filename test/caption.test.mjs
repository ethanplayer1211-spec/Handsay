import { test } from 'node:test';
import assert from 'node:assert/strict';
import { appendWord, readableCaption, validateStoredGestures, displayScore } from '../src/caption.js';
test('captions preserve signer wording without generated grammar or answers', () => {
  assert.equal(readableCaption('  i   work yesterday  '), 'I work yesterday');
  assert.equal(appendWord('Thank', 'you'), 'Thank you');
  assert.equal(readableCaption(''), '');
  assert.equal(appendWord('a'.repeat(999), 'test').length, 1000);
  assert.equal(displayScore(NaN), 'No score');
});
test('refuses corrupted gesture data rather than creating arbitrary predictions', () => {
  assert.deepEqual(validateStoredGestures([]), []);
  assert.throws(() => validateStoredGestures([{ id: 'x', name: 'text', takes: [[1, 2]] }]));
  assert.throws(() => validateStoredGestures([{ id: 'x', name: 'text', takes: [Array(128).fill(NaN)] }]));
  const stored = validateStoredGestures([{ id: 'x', name: 'Repeat please', takes: [Array(128).fill(.1)] }]);
  assert.equal(stored[0].takes[0] instanceof Float32Array, true);
});
