/** Rolling predictions are provisional: they never commit, speak or share words. */
import { classifySegment } from './consensus';
import type { ModelMeta, SignLabel } from './meta';
import type { Infer, RecognitionResult, TrackedFrame } from './recognizer';
import { frameStatus } from './segmenter';

export class LivePreview {
  private frames: TrackedFrame[] = [];
  private generation = 0;
  private busy = false;
  private lastAt = -Infinity;
  private visible = false;

  constructor(
    private readonly meta: ModelMeta,
    private readonly labels: readonly SignLabel[],
    private readonly infer: Infer,
    private readonly emit: (result: RecognitionResult | null) => void,
    private readonly fail: (message: string) => void = () => {},
  ) {}

  reset(clear = true): void {
    this.generation++;
    this.frames = [];
    this.lastAt = -Infinity;
    if (clear && this.visible) this.emit(null);
    this.visible = false;
  }

  seed(samples: TrackedFrame[]): void {
    for(const sample of samples)this.push(sample,false);
  }

  push(tracked: TrackedFrame, predict = true): void {
    const status = frameStatus(tracked.frame, tracked.poses);
    if (status !== 'ok') {
      if (status === 'crowded' || (this.frames.length && tracked.t - this.frames.at(-1)!.t >= 600)) this.reset();
      return; // short losses preserve history; never infer on fabricated hands
    }
    const last = this.frames.at(-1);
    if (last && (tracked.t <= last.t || tracked.t - last.t >= 600)) this.reset();
    // Bounded history and at most one pending inference: slow devices skip
    // intermediate windows instead of building a queue of outdated captions.
    this.frames.push(tracked);
    this.frames = this.frames.filter(f => tracked.t - f.t <= 1600).slice(-64);
    if (!predict || this.busy || this.frames.length < this.meta.minFrames || tracked.t - this.lastAt < 180) return;
    const samples = this.frames.slice();
    const durationMs = tracked.t - samples[0].t;
    if (durationMs <= 0) return;
    this.lastAt = tracked.t;
    this.busy = true;
    const generation = this.generation;
    const segment = { frames: samples.map(f => f.frame), timestamps: samples.map(f => f.t), durationMs, fps: (samples.length - 1) * 1000 / durationMs };
    void classifySegment(this.meta, this.labels, this.infer, segment, false, false)
      .then(result => {
        if (generation !== this.generation) return;
        this.visible = true;
        this.emit(result);
      })
      .catch(error => {
        if (generation !== this.generation) return;
        this.reset();
        this.fail(error instanceof Error ? error.message : String(error));
      })
      .finally(() => { this.busy = false; });
  }
}
