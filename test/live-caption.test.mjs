import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LiveCaptionGate } from '../src/live-caption.js';
const good = (overrides = {}) => ({ text: 'hello', probability: .93, runnerUp: .02, verification: { text: 'hello', probability: .91, runnerUp: .03 }, durationMs: 600, at: 1000, ...overrides });
test('accepts clear agreement; rejects weak scores, close alternatives, disagreement and missing verification', () => {
  assert.equal(new LiveCaptionGate().accept(good({trackingIssue:'hand-identity-change'})).accepted,false);
  for (const bad of [good({ probability: .5 }), good({ runnerUp: .8 }), good({ verification: null }), good({ verification: { text: 'loud', probability: .95, runnerUp: .01 } }), good({ verification: { text: 'hello', probability: .6, runnerUp: .1 } }), good({ partial: true }), good({ durationMs: 100 }), good({ probability: NaN })]) assert.equal(new LiveCaptionGate().accept(bad).accepted, false);
  assert.equal(new LiveCaptionGate().accept(good()).accepted, true);
});
test('suppresses fast duplicates but allows deliberate repetitions and words in order', () => {
  const gate = new LiveCaptionGate();
  assert.equal(gate.accept(good()).accepted, true);
  assert.equal(gate.accept(good({ at: 1800 })).accepted, false);
  assert.equal(gate.accept(good({ at: 3000 })).accepted, false);
  gate.release();
  assert.equal(gate.accept(good({ at: 3000 })).accepted, true);
  assert.equal(gate.accept(good({ text: 'yes', verification: { text: 'yes', probability: .9, runnerUp: .01 }, at: 3200 })).accepted, true);
  assert.equal(gate.accept(good({ at: 3300 })).accepted, true);
});
test('undo prevents the corrected word from immediately reappearing', () => {
  const gate = new LiveCaptionGate(); gate.accept(good()); gate.undo('hello');
  assert.equal(gate.accept(good({ at: 4000 })).accepted, false);
  gate.reset(); assert.equal(gate.accept(good({ at: 5000 })).accepted, true);
});
test('balanced profile still requires two agreeing predictions; personal similarity is handled separately', () => {
  assert.equal(new LiveCaptionGate().accept(good({ probability: .75, verification: { text: 'hello', probability: .76, runnerUp: .1 }, profile: 'balanced' })).accepted, true);
  assert.equal(new LiveCaptionGate().accept(good({ probability: .75 })).accepted, false);
  assert.equal(new LiveCaptionGate().accept(good({ personal: true, verification: null, probability: .9, durationMs: undefined })).accepted, true);
});
test('personal boundary views keep their own margins instead of mixing one winner with another runner-up',()=>{
  assert.equal(new LiveCaptionGate().accept(good({personal:true,verification:null,probability:.86,runnerUp:.82,personalMargin:.13})).accepted,true);
  assert.equal(new LiveCaptionGate().accept(good({personal:true,verification:null,probability:.93,runnerUp:.01,personalMargin:.04})).accepted,false);
});
