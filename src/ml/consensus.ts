import { decide } from './decision';
import { modelInput } from './features';
import type { ModelMeta, SignLabel } from './meta';
import type { Infer } from './recognizer';
import type { Segment } from './segmenter';

// Trim the boundaries and recompute features: entry/exit movements should not
// change the word. Agreement reduces some errors, but is not independent proof.
export async function classifySegment(meta: ModelMeta, labels: readonly SignLabel[], infer: Infer, segment: Segment, partial: boolean, verify: boolean) {
  const shipped = labels.map(l => l.shipped);
  const inference = await infer(modelInput(segment.frames, segment.fps, meta));
  const decision = decide(inference.logits, shipped, meta.calibration, { partial });
  let verification = null;
  let verificationEmbedding:Float32Array|null=null;
  const trim = Math.min(Math.floor(segment.frames.length * .1), Math.floor((segment.frames.length - meta.minFrames) / 2));
  if (verify && !partial && trim > 0) {
    const trimmed = segment.frames.slice(trim, -trim);
    const second = await infer(modelInput(trimmed, segment.fps, meta));
    verificationEmbedding=second.embedding;
    const checked = decide(second.logits, shipped, meta.calibration);
    if (checked.kind === 'sign') verification = checked.top;
  }
  return { inference, decision, verification, verificationEmbedding, segment, partial };
}
