import { test } from 'node:test';
import assert from 'node:assert/strict';
import { CaptionDisplay, CAPTION_TIMES } from '../src/caption-display.js';

test('a lone Hello expires without depending on another recognition result', () => {
  let now = 1000; const display = new CaptionDisplay(() => now);
  display.setDraft('Hello'); assert.equal(display.view().text, 'Hello');
  now += CAPTION_TIMES.word; assert.equal(display.view().text, '');
});
test('the accepted first word stays in the message while the next sign forms, with a bounded lifetime', () => {
  let now = 1000; const display = new CaptionDisplay(() => now);
  display.setDraft('Hello'); display.beginSign(); assert.equal(display.view().text, 'Hello');
  display.setPreview('blue'); assert.equal(display.view().preview, 'blue');
  assert.equal(display.view().text, 'Hello');
  now += CAPTION_TIMES.word; assert.equal(display.view().text, '');
});
test('sentences stay available during the next sign, then disappear from the live display', () => {
  let now = 1000; const display = new CaptionDisplay(() => now);
  display.setDraft('I need a moment'); display.setPreview('please');
  assert.deepEqual(display.view(), { preview: 'please', text: 'I need a moment', kind: 'draft' });
  now += CAPTION_TIMES.preview; assert.equal(display.view().preview, '');
  assert.equal(display.view().text, 'I need a moment');
  now += CAPTION_TIMES.sentence; assert.equal(display.view().kind, 'empty');
});
test('old room events cannot revive expired captions when an interviewer joins late', () => {
  const display = new CaptionDisplay(() => 50000);
  display.setDraft('Hello', 1000); assert.equal(display.view().kind, 'empty');
  display.showSent('An earlier answer.', 1000); assert.equal(display.view().kind, 'empty');
  display.showSent('Current answer.', 49900); assert.equal(display.view().text, 'Current answer.');
  display.clearLive(); assert.equal(display.view().text, 'Current answer.');
});
test('a reset clears every display layer and preview updates never extend an old draft lifetime', () => {
  let now = 1000; const display = new CaptionDisplay(() => now);
  display.setDraft('My next answer'); now += CAPTION_TIMES.sentence - 1000; display.setPreview('yes');
  now += 1000; assert.equal(display.view().text, '');
  display.showSent('Sent message'); display.clear();
  assert.deepEqual(display.view(), { preview: '', text: '', kind: 'empty' });
});

test('a forming word requires agreement across time and does not flicker on weak predictions', () => {
  let now = 1000; const display = new CaptionDisplay(() => now);
  display.beginSign(); display.considerPreview('morning');
  assert.equal(display.view().preview, '');
  now += 180; display.considerPreview('morning');
  assert.equal(display.view().preview, '');
  now += 180; display.considerPreview('morning');
  assert.equal(display.view().preview, 'morning');
  now += 200; display.considerPreview('');
  assert.equal(display.view().preview, 'morning');
  now += 200; display.considerPreview('hello');
  assert.equal(display.view().preview, 'morning');
  now += 300; display.considerPreview('hello');
  assert.equal(display.view().preview, 'hello');
  display.beginSign(); assert.equal(display.view().preview, '');
});

test('a final possible word stays readable for review but expires and clears on the next sign', () => {
  let now = 1000; const display = new CaptionDisplay(() => now);
  display.setPreview('morning', true);
  now += 6000; assert.equal(display.view().preview, 'morning');
  now += 4000; assert.equal(display.view().preview, '');
  display.setPreview('morning', true); display.beginSign();
  assert.equal(display.view().preview, '');
  display.considerPreview('hello'); now += 1600; display.considerPreview('hello');
  assert.equal(display.view().preview, ''); // a long gap is not agreement
});
