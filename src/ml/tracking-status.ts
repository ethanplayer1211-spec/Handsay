import type { FrameStatus } from './segmenter';

/** Debounce UI status only. Coordinates are never invented or made "valid". */
export class TrackingStatus {
  private shown: FrameStatus | null = null;
  private candidate: FrameStatus | null = null;
  private since = 0;
  reset(): void { this.shown = null; this.candidate = null; }
  push(status: FrameStatus, t: number): FrameStatus | null {
    if (this.shown === null || status === 'crowded') {
      this.shown = status; this.candidate = null; return status;
    }
    if (status === this.shown) { this.candidate = null; return null; }
    if (this.candidate !== status) {
      // Different loss labels still describe one continuous interruption.
      if (this.candidate === null || this.candidate === 'ok' || status === 'ok') this.since = t;
      this.candidate = status;
    }
    const delay = status === 'ok' ? 100 : 350;
    if (t - this.since < delay) return null;
    this.shown = status; this.candidate = null; return status;
  }
}
