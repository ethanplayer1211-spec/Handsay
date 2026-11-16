import { readFileSync } from 'node:fs';
import { describe, expect, it, vi } from 'vitest';
import { LivePreview } from './live-preview';
import { emptyFrame, POSE_START, RIGHT_HAND_START } from './landmarks';
import { parseMeta, parseLabels } from './meta';
import type { Inference, RecognitionResult } from './recognizer';

const json = (file: string) => JSON.parse(readFileSync(new URL(`../../public/models/${file}`, import.meta.url), 'utf8'));
const meta = parseMeta(json('model-meta.json'));
const labels = parseLabels(json('labels.json'), meta.classes);
function frame(i: number) {
  const f = emptyFrame();
  for (const [p, x, y] of [[POSE_START + 11, .65, .6], [POSE_START + 12, .35, .6], [RIGHT_HAND_START, .3 + i / 300, .4]]) {
    f[p * 3] = x; f[p * 3 + 1] = y; f[p * 3 + 2] = 0;
  }
  return { frame: f, t: i * 1000 / 30, poses: 1 };
}
function result(index = 1): Inference {
  const logits = new Float32Array(meta.classes); logits[index] = 30;
  return { logits, embedding: new Float32Array(meta.embeddingDim) };
}
const settle = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };

describe('rolling live predictions', () => {
  it('seeds the observed lead-in without predicting an outdated prefix before the current frame arrives',async()=>{
    const infer=vi.fn(async()=>result()),emit=vi.fn();
    const preview=new LivePreview(meta,labels,infer,emit);
    preview.seed(Array.from({length:12},(_,i)=>frame(i)));
    expect(infer).not.toHaveBeenCalled();
    preview.push(frame(12));await settle();
    expect(emit.mock.calls.at(-1)?.[0].segment.frames.length).toBe(13);
    expect(emit.mock.calls.at(-1)?.[0].segment.timestamps.at(-1)).toBe(frame(12).t);
  });
  it('predicts before a sign ends and changes to a new model word during ongoing motion', async () => {
    const predictions: (RecognitionResult | null)[] = [];
    const infer = vi.fn().mockResolvedValueOnce(result(1)).mockResolvedValue(result(2));
    const preview = new LivePreview(meta, labels, infer, p => predictions.push(p));
    for (let i = 0; i < 8; i++) preview.push(frame(i));
    await settle();
    expect(predictions.at(-1)?.decision.top[0].index).toBe(1);
    for (let i = 8; i < 15; i++) preview.push(frame(i));
    await settle();
    expect(predictions.at(-1)?.decision.top[0].index).toBe(2);
    expect(infer).toHaveBeenCalledTimes(2);
  });

  it('skips stale windows under load and discards an in-flight answer after hands leave', async () => {
    let resolve!: (value: Inference) => void;
    const infer = vi.fn(() => new Promise<Inference>(r => { resolve = r; }));
    const emit = vi.fn();
    const preview = new LivePreview(meta, labels, infer, emit);
    for (let i = 0; i < 80; i++) preview.push(frame(i));
    expect(infer).toHaveBeenCalledTimes(1);
    preview.push({ frame: emptyFrame(), t: 3400, poses: 0 });
    resolve(result()); await settle();
    expect(emit).not.toHaveBeenCalled();
  });

  it('keeps a word and its history through short losses, clearing on sustained loss or reset', async () => {
    const emit = vi.fn();
    const preview = new LivePreview(meta, labels, async () => result(), emit);
    for (let i = 0; i < 8; i++) preview.push(frame(i));
    await settle();
    preview.push({ frame: emptyFrame(), t: 400, poses: 0 });
    expect(emit.mock.calls.at(-1)?.[0]?.decision.kind).toBe('sign');
    preview.push(frame(15)); await settle(); // one new frame suffices; history survived
    expect(emit.mock.calls.at(-1)?.[0]?.segment.frames.length).toBe(9);
    preview.push({ frame: emptyFrame(), t: 1200, poses: 0 });
    expect(emit.mock.calls.at(-1)?.[0]).toBe(null);
    for (let i = 20; i < 28; i++) preview.push(frame(i));
    await settle(); preview.reset();
    expect(emit).toHaveBeenLastCalledWith(null);
  });

  it('never predicts without enough frames, full framing or a single signer', async () => {
    const infer = vi.fn(async () => result());
    const preview = new LivePreview(meta, labels, infer, () => {});
    for (let i = 0; i < 7; i++) preview.push(frame(i));
    for (let i = 8; i < 30; i++) preview.push({ ...frame(i), poses: 2 });
    for (let i = 30; i < 40; i++) preview.push({ frame: emptyFrame(), t: i * 33, poses: 1 });
    await settle(); expect(infer).not.toHaveBeenCalled();
  });

  it('recovers after an inference error without keeping a busy queue', async () => {
    const infer = vi.fn().mockRejectedValueOnce(new Error('failed')).mockResolvedValue(result(2));
    const fail = vi.fn(), emit = vi.fn();
    const preview = new LivePreview(meta, labels, infer, emit, fail);
    for (let i = 0; i < 8; i++) preview.push(frame(i));
    await settle(); expect(fail).toHaveBeenCalledWith('failed');
    for (let i = 8; i < 16; i++) preview.push(frame(i));
    await settle(); expect(emit.mock.calls.at(-1)?.[0].decision.top[0].index).toBe(2);
  });
});
