/** Run separately: npm run audit:replay. Selected upstream test-signer examples;
 * regression evidence for this app, not independent live-camera validation. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { test, expect } from 'vitest';
import * as ort from 'onnxruntime-web/wasm';
import { parseMeta, parseLabels } from '../src/ml/meta';
import { decodeReplay } from '../src/replay/clips';
import { classifySegment } from '../src/ml/consensus';
import { LiveCaptionGate } from '../src/live-caption.js';
import type { ModelInput } from '../src/ml/features';
import { Recognizer, type RecognizerEvent } from '../src/ml/recognizer';
import { LIVE_SEGMENTER } from '../src/ml/segmenter';
import { loadFixtureModel } from './model-fixture';
import { avatarSequence } from '../src/replay/avatar-motion';

test('audit real ONNX predictions and caption filtering on every bundled demo clip', async () => {
  const json = (path: string) => JSON.parse(readFileSync(resolve(path), 'utf8'));
  const meta = parseMeta(json('public/models/model-meta.json'));
  const labels = parseLabels(json('public/models/labels.json'), meta.classes);
  const replay = decodeReplay(json('public/replay/clips.json'));
  ort.env.wasm.numThreads = 1;
  ort.env.wasm.wasmBinary = new Uint8Array(readFileSync(resolve('public/vendor/ort/ort-wasm-simd-threaded.wasm')));
  const session = await ort.InferenceSession.create(new Uint8Array(readFileSync(resolve('public/models/model.onnx'))), { executionProviders: ['wasm'] });
  const infer = async (input: ModelInput) => {
    const values = await session.run({ frames: new ort.Tensor('float32', input.data, [1, input.frames, meta.featureDim]) });
    return { logits: values.logits.data as Float32Array, embedding: values.embedding.data as Float32Array };
  };
  const rows = [];
  try {
    for (const clip of replay.clips) {
      const segment = { frames: clip.frames, fps: clip.fps, durationMs: (clip.frames.length - 1) * 1000 / clip.fps, timestamps: clip.frames.map((_, i) => i * 1000 / clip.fps) };
      const result = await classifySegment(meta, labels, infer, segment, false, true);
      const [best, second] = result.decision.top;
      const checked = result.verification?.[0];
      const text = labels[best.index].label;
      const gate = new LiveCaptionGate().accept({ text, probability: best.probability, runnerUp: second?.probability ?? 0, verification: checked ? { text: labels[checked.index].label, probability: checked.probability, runnerUp: result.verification?.[1]?.probability ?? 0 } : null, partial: false, durationMs: segment.durationMs, at: 1000 });
      rows.push({ id: clip.id, expected: clip.sign, baseline: 'hello', baselineCorrect: clip.sign === 'hello', predicted: text, correct: text === clip.sign, modelScore: best.probability, acceptedByCarefulFilter: gate.accepted, filterReason: gate.reason });
    }
  } finally { await session.release(); }
  const report = {
    generatedAt: new Date().toISOString(),
    scope: 'Six author-selected clips exported from upstream held-out test signers; pinned artefact/split/export provenance is checked in data-provenance.json. These are app regression examples, not representative or independent live-camera accuracy.',
    provenance: 'data-provenance.json',
    baseline: 'Always predict hello. This is a deliberately simple constant baseline, not a majority-class estimate for the full dataset.',
    data: 'Google / PopSign ASL Signs via GestureSign bundled replay data',
    count: rows.length,
    baselineCorrect: rows.filter(r => r.baselineCorrect).length,
    rawModelCorrect: rows.filter(r => r.correct).length,
    carefulAccepted: rows.filter(r => r.acceptedByCarefulFilter).length,
    carefulIncorrectAccepted: rows.filter(r => r.acceptedByCarefulFilter && !r.correct).length,
    carefulCorrectHeldBack: rows.filter(r => !r.acceptedByCarefulFilter && r.correct).length,
    rows,
    limitations: ['Not a randomly sampled test set; used during app development.', 'No adult, fluent-signer, disability or demographic validation.', 'No non-sign negative dataset, so no general false-alarm rate can be reported.', 'Caption filtering can reject correct words; acceptance scores are not measured accuracy.'],
  };
  mkdirSync(resolve('docs/evaluation'), { recursive: true });
  writeFileSync(resolve('docs/evaluation/replay-audit.json'), JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify(report, null, 2));
  expect(rows).toHaveLength(6);
  expect(rows.every(r => Number.isFinite(r.modelScore))).toBe(true);
}, 60000);

test('a three-word avatar stream preserves completed results in order with and without synthetic tracking losses', async () => {
  const fixture = await loadFixtureModel();
  const clips = ['hello','police','giraffe'].map(sign=>fixture.replay.clips.find(c=>c.sign===sign)!);
  const rows = [];
  try {
    for (const dropouts of [false, true]) {
      const events: RecognizerEvent[] = [];
      const rec = new Recognizer(fixture.meta,fixture.labels,fixture.infer,event=>events.push(event),true,false,LIVE_SEGMENTER);
      for (const step of avatarSequence(clips,dropouts)) rec.push({frame:step.frame,t:step.t,poses:1});
      rec.flush();
      await expect.poll(()=>events.filter(e=>e.type==='result').length,{timeout:10000}).toBe(3);
      const results = events.filter(e=>e.type==='result').map(e=>({word:fixture.labels[e.result.decision.top[0].index].label,score:e.result.decision.top[0].probability,current:e.current,partial:e.result.partial,durationMs:e.result.segment.durationMs}));
      rows.push({dropouts, reference:clips.map(c=>c.sign),captures:events.filter(e=>e.type==='signing').length,results});
      expect(events.filter(e=>e.type==='signing').length).toBe(3);
      expect(results.map(r=>r.current)).toEqual([false,false,true]);
      expect(results.map(r=>r.word)).toEqual(clips.map(c=>c.sign));
      expect(events.some(e=>e.type==='error')).toBe(false);
      rec.reset();
    }
  } finally { await fixture.release(); }
  writeFileSync(resolve('docs/evaluation/avatar-continuity.json'),JSON.stringify({generatedAt:new Date().toISOString(),scope:'Actual ONNX inference on three recorded isolated-sign clips arranged as one stream, with synthetic pauses and optional 100 ms hand-coordinate losses. Input supplied directly as landmarks, bypassing image tracking. References never enter the classifier. Queued finals are deliberately resolved after later signs start. Not human, unseen-signer, or continuous-ASL accuracy.',timing:LIVE_SEGMENTER,rows},null,2)+'\n');
},60000);

test('check the live segment timing against real-model recorded landmarks with a final pose hold', async () => {
  const fixture = await loadFixtureModel();
  const rows = [];
  try {
    for (const clip of fixture.replay.clips) {
      const events: RecognizerEvent[] = [];
      const rec = new Recognizer(fixture.meta, fixture.labels, fixture.infer, e => events.push(e), true, false, LIVE_SEGMENTER);
      const dt = 1000 / clip.fps;
      clip.frames.forEach((frame, i) => rec.push({ frame, t: i * dt, poses: 1 }));
      // Synthetic extension of the recorded final pose, not a new human test.
      for (let i = 0; i < Math.ceil(3000 / dt); i++) rec.push({ frame: clip.frames.at(-1)!, t: (clip.frames.length + i) * dt, poses: 1 });
      await expect.poll(() => events.some(e => e.type === 'result' || e.type === 'discarded' || e.type === 'error')).toBe(true);
      const results = events.filter(e => e.type === 'result');
      rows.push({ reference: clip.sign, completedSegments: results.length, results: results.map(e => ({ predicted: fixture.labels[e.result.decision.top[0].index].label, score: e.result.decision.top[0].probability, durationMs: e.result.segment.durationMs, firstT:e.result.segment.timestamps[0],lastT:e.result.segment.timestamps.at(-1), partial: e.result.partial })), errors: events.filter(e => e.type === 'error') });
      rec.reset();
    }
  } finally { await fixture.release(); }
  writeFileSync(resolve('docs/evaluation/live-timing-audit.json'), JSON.stringify({ generatedAt: new Date().toISOString(), scope: 'Selected upstream recorded landmarks, extended with a synthetic final-pose hold. Live timing integration check only; not live-signer or held-out accuracy. No good or good-morning test clip is available in this bundle.', timing: LIVE_SEGMENTER, rows }, null, 2) + '\n');
  expect(rows.every(row => row.errors.length === 0)).toBe(true);
  expect(rows.some(row => row.completedSegments > 0)).toBe(true);
}, 60000);
