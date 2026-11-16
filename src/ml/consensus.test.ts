import { describe, it, expect, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { classifySegment } from './consensus';
import { parseMeta, parseLabels } from './meta';
import { emptyFrame } from './landmarks';
const read = (name: string) => JSON.parse(readFileSync(new URL(`../../public/models/${name}`, import.meta.url), 'utf8'));
const meta = parseMeta(read('model-meta.json')), labels = parseLabels(read('labels.json'), meta.classes);
const segment = { frames: Array.from({length:20},emptyFrame), timestamps:Array.from({length:20},(_,i)=>i*33),fps:30,durationMs:633 };
const output = (index: number) => { const logits = new Float32Array(meta.classes); logits[index]=30; return {logits,embedding:new Float32Array(128)}; };
describe('motion verification', () => {
  it('recomputes a shorter input and exposes disagreement rather than silently agreeing', async () => {
    const infer=vi.fn().mockResolvedValueOnce(output(1)).mockResolvedValueOnce(output(2));
    const r=await classifySegment(meta,labels,infer,segment,false,true);
    expect(infer).toHaveBeenCalledTimes(2); expect(infer.mock.calls[1][0].frames).toBeLessThan(infer.mock.calls[0][0].frames);
    expect(r.decision.top[0]?.index).toBe(1);expect(r.verification?.[0]?.index).toBe(2);
  });
  it('never verifies partial framing and supports manual recognition without a second pass', async () => {
    const infer=vi.fn().mockResolvedValue(output(1));
    expect((await classifySegment(meta,labels,infer,segment,true,true)).verification).toBeNull();
    expect(infer).toHaveBeenCalledTimes(1);
    expect((await classifySegment(meta,labels,infer,segment,false,false)).verification).toBeNull();
  });
});
