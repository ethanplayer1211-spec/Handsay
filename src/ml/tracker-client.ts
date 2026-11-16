/** Page-side handle on the MediaPipe worker: feeds camera frames, one in flight at a time. */
import type { FeatureSet } from './features';
import type { TrackedFrame } from './recognizer';
import type { Delegate } from './tracker-core';
import type { TrackerWorkerIn, TrackerWorkerOut } from './tracker-protocol';

export interface TrackerFrame extends TrackedFrame {
  ms: number;
}

export class TrackerClient {
  private running = false;
  private busy = false;
  private onFrame: ((frame: TrackerFrame) => void) | null = null;
  private onError: ((message: string) => void) | null = null;
  private errors = 0;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private watchdog: ReturnType<typeof setTimeout> | null = null;
  private generation = 0;
  private inFlightT: number | null = null;
  private closed = false;
  private lastFrameAt = 0;

  private constructor(
    private readonly worker: Worker,
    readonly delegate: Delegate,
  ) {
    worker.onmessage = (event: MessageEvent<TrackerWorkerOut>) => {
      const msg = event.data;
      if ((msg.type === 'landmarks' || msg.type === 'frame-error') && msg.t !== this.inFlightT) return;
      if (msg.type === 'landmarks') {
        this.clearWatchdog();
        this.inFlightT = null;
        this.lastFrameAt = performance.now();
        this.errors = 0;
        this.busy = false;
        if (this.running)
          this.onFrame?.({ frame: msg.frame, t: msg.t, poses: msg.poses, ms: msg.ms });
      } else if (msg.type === 'frame-error') {
        this.clearWatchdog();
        this.inFlightT = null;
        this.busy = false;
        if (++this.errors === 5) this.fail('Camera tracking repeatedly failed');
      }
    };
    worker.onerror = () => this.fail('The tracking engine stopped');
    worker.onmessageerror = () => this.fail('The tracking engine returned unreadable data');
  }

  private clearWatchdog(): void {
    if (this.watchdog !== null) clearTimeout(this.watchdog);
    this.watchdog = null;
  }

  private fail(message: string): void {
    const report = this.onError;
    this.dispose();
    report?.(message);
  }

  static async create(featureSet: FeatureSet): Promise<TrackerClient> {
    const worker = new Worker(new URL('./tracker.worker.ts', import.meta.url), { type: 'module' });
    const reply = await new Promise<TrackerWorkerOut>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('Tracking took too long to start. Restart the camera or use typed messages')), 25000);
      worker.onmessage = (event: MessageEvent<TrackerWorkerOut>) => {
        clearTimeout(timer);
        resolve(event.data);
      };
      worker.onerror = (event) => {
        clearTimeout(timer);
        reject(new Error(event.message || 'the landmark worker failed to start'));
      };
      const msg: TrackerWorkerIn = { type: 'init', featureSet, delegate: 'GPU' };
      worker.postMessage(msg);
    }).catch((error: unknown) => {
      worker.terminate();
      throw error;
    });
    if (reply.type !== 'ready') {
      worker.terminate();
      throw new Error(reply.type === 'init-error' ? reply.message : 'unexpected reply');
    }
    return new TrackerClient(worker, reply.delegate);
  }

  /** Track `video` until stop(); frames that arrive while one is being processed are skipped. */
  start(video: HTMLVideoElement, onFrame: (frame: TrackerFrame) => void, onError?: (message: string) => void): void {
    if (this.closed) { onError?.('The tracking engine is closed. Restart the camera'); return; }
    this.stop();
    this.errors = 0;
    this.onFrame = onFrame;
    this.onError = onError ?? null;
    this.running = true;
    this.lastFrameAt = performance.now();
    const generation = this.generation;
    const tick = () => {
      if (!this.running || generation !== this.generation) return;
      if (!this.busy && performance.now() - this.lastFrameAt >= 8000) {
        this.fail('No camera images arrived. Restart the camera or use text'); return;
      }
      if (!this.busy && video.readyState >= 2 && video.videoWidth > 0) {
        this.busy = true;
        this.watchdog = setTimeout(() => this.fail('Camera tracking stopped responding. Restart the camera or use text'), 8000);
        const t = performance.now();
        this.inFlightT = t;
        createImageBitmap(video)
          .then((bitmap) => {
            if (!this.running || generation !== this.generation) { bitmap.close(); return; }
            const msg: TrackerWorkerIn = { type: 'frame', bitmap, t };
            this.worker.postMessage(msg, [bitmap]);
          })
          .catch(() => {
            if (generation !== this.generation) return;
            this.clearWatchdog();
            this.inFlightT = null;
            this.busy = false;
            if (++this.errors >= 5) this.fail('Camera frames could not be read. Restart the camera or use text');
          });
      }
      // Capture is not tied to painting the preview: the desktop window may be
      // behind a call app or minimized. One frame in flight still bounds load.
      this.timer = setTimeout(tick, 40);
    };
    tick();
  }

  stop(): void {
    this.generation++;
    this.running = false;
    this.busy = false;
    this.inFlightT = null;
    this.clearWatchdog();
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = null;
    this.onFrame = null;
    this.onError = null;
  }

  dispose(): void {
    this.stop();
    if (!this.closed) this.worker.terminate();
    this.closed = true;
  }
}

