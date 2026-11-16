/**
 * The live pipeline, independent of where frames come from (camera, Replay or
 * the e2e injection hook): frame status -> segmenter -> features -> model ->
 * decision. Inference is injected so the logic is unit-testable without
 * workers or WASM.
 */
import { type Decision } from './decision';
import { classifySegment } from './consensus';
import { modelInput, type ModelInput } from './features';
import type { Frame } from './landmarks';
import type { ModelMeta, SignLabel } from './meta';
import { Segmenter, frameStatus, type FrameStatus, type Segment, type SegmenterOptions } from './segmenter';
import { LivePreview } from './live-preview';
import { TrackingStatus } from './tracking-status';

export interface Inference {
  logits: Float32Array;
  embedding: Float32Array;
}

export type Infer = (input: ModelInput) => Promise<Inference>;

export interface RecognitionResult {
  decision: Decision;
  inference: Inference;
  segment: Segment;
  /** True when the signer's shoulders were out of view for most of the sign. */
  partial: boolean;
  verification?: { index: number; probability: number }[] | null;
  verificationEmbedding?:Float32Array|null;
}

export type RecognizerEvent =
  | { type: 'reset' }
  | { type: 'status'; status: FrameStatus }
  | { type: 'signing'; t:number }
  | { type: 'phase'; phase: 'moving' | 'holding' | 'recovering' | 'checking' | 'idle'; progress: number }
  | { type: 'discarded' }
  | { type: 'result'; result: RecognitionResult; current: boolean }
  | { type: 'preview'; result: RecognitionResult | null }
  | { type: 'error'; message: string; current?: boolean };

export interface TrackedFrame {
  frame: Frame;
  /** Milliseconds, monotonic. */
  t: number;
  /** People the pose landmarker found (0, 1 or more). */
  poses: number;
}

export class Recognizer {
  private segmenter: Segmenter;
  private lastPhase = '';
  private statuses: FrameStatus[] = [];
  private statusDisplay = new TrackingStatus();
  private capture = 0;
  private generation = 0;
  private pending: Promise<void> = Promise.resolve();
  private preview: LivePreview | null;
  private inferenceQueue: Promise<unknown> = Promise.resolve();
  private runInference: Infer = input => {
    const task = this.inferenceQueue.then(() => this.infer(input));
    this.inferenceQueue = task.catch(() => undefined);
    return task;
  };

  constructor(
    private readonly meta: ModelMeta,
    private readonly labels: readonly SignLabel[],
    private readonly infer: Infer,
    private readonly emit: (event: RecognizerEvent) => void,
    private readonly verify = false,
    livePreview = false,
    options: Partial<SegmenterOptions> = {},
  ) {
    this.segmenter = new Segmenter(options);
    this.preview = livePreview ? new LivePreview(meta, labels, this.runInference,
      result => emit({ type: 'preview', result }), message => emit({ type: 'error', message })) : null;
  }

  get shipped(): boolean[] {
    return this.labels.map((l) => l.shipped);
  }

  reset(): void {
    this.preview?.reset();
    this.generation++;
    this.segmenter.reset();
    this.statuses = [];
    this.statusDisplay.reset();
    this.phase('idle', 0);
    this.emit({ type: 'reset' });
  }

  setTiming(options: Partial<SegmenterOptions>): void {
    this.reset();
    this.segmenter = new Segmenter(options);
  }

  private phase(phase: 'moving' | 'holding' | 'recovering' | 'checking' | 'idle', progress: number): void {
    const key = `${phase}:${Math.floor(progress * 10)}`;
    if (key === this.lastPhase) return;
    this.lastPhase = key;
    this.emit({ type: 'phase', phase, progress });
  }

  push({ frame, t, poses }: TrackedFrame): void {
    const status = frameStatus(frame, poses);
    const shown = this.statusDisplay.push(status, t);
    if (status === 'crowded') {
      this.reset(); this.emit({ type: 'status', status: 'crowded' }); return;
    }
    if (shown) this.emit({ type: 'status', status: shown });
    const event = this.segmenter.push(frame, t, { crowded: status === 'crowded' });
    if (this.segmenter.state === 'signing') this.statuses.push(status);
    this.handle(event);
    if (this.segmenter.state === 'signing') {
      const { phase, progress } = this.segmenter.progress;
      this.phase(phase, progress);
      this.preview?.push({ frame, t, poses });
    }
  }

  /** End an open sign now, e.g. when a replay clip finishes. */
  flush(): void {
    this.handle(this.segmenter.flush());
  }

  private handle(event: ReturnType<Segmenter['push']>): void {
    if (!event) return;
    if (event.type === 'start') {
      this.capture++;
      this.preview?.reset();
      this.statuses = [];
      this.emit({ type: 'signing', t:event.t });
      // Reuse the observed lead-in instead of waiting for eight more camera
      // frames after deliberate movement has already been established.
      this.preview?.seed((event.preroll ?? []).map(sample=>({...sample,poses:1})));
      return;
    }
    const statuses = this.statuses;
    // Invalidate rolling work without erasing a readable word while final
    // inference is pending. A new sign/reset still clears it immediately.
    this.preview?.reset(event.type === 'discard');
    this.statuses = [];
    if (event.type === 'discard') {
      this.phase('idle', 0);
      this.emit({ type: 'discarded' });
      return;
    }
    this.phase('checking', 1);
    // Vote only over frames where the signer's hands were seen: frames without
    // hands (the gap that ends a sign, short dropouts) say nothing about framing.
    const partialFrames = statuses.filter((s) => s === 'partial').length;
    const framedFrames = partialFrames + statuses.filter((s) => s === 'ok').length;
    const partial = partialFrames > framedFrames / 2;
    const generation = this.generation;
    const capture = this.capture;
    this.pending = this.pending.then(async () => {
      if (generation === this.generation) await this.classify(event.segment, partial, generation, capture);
    }).catch(error => {
      if (generation === this.generation) this.emit({ type: 'error', message: error instanceof Error ? error.message : String(error) });
    });
  }

  private async classify(segment: Segment, partial: boolean, generation: number, capture: number): Promise<void> {
    const input = modelInput(segment.frames, segment.fps, this.meta);
    if (input.frames < this.meta.minFrames) {
      if (capture === this.capture) this.phase('idle', 0);
      this.emit({ type: 'discarded' });
      return;
    }
    try {
      const usable = segment.frames.filter(frame => frameStatus(frame, 1) === 'ok').length;
      const result = await classifySegment(this.meta, this.labels, this.runInference, segment, partial || usable / segment.frames.length < .6, this.verify);
      if (generation !== this.generation) return; // the mode or source changed meanwhile
      if (capture === this.capture) this.phase('idle', 0);
      this.emit({ type: 'result', result, current: capture === this.capture });
    } catch (error) {
      if (generation === this.generation) {
        if (capture === this.capture) this.phase('idle', 0);
        this.emit({ type: 'error', message: error instanceof Error ? error.message : String(error), ...(capture === this.capture ? {} : { current: false }) });
      }
    }
  }
}

