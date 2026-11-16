/**
 * Cuts a continuous landmark stream into single-sign segments.
 *
 * A segment starts when a hand is present and moving, and ends when the hands
 * are gone, or held still, for `gapMs` (300 ms). Short dropouts inside a sign
 * are bridged. After a "still" ending the segmenter waits for new motion, so
 * resting a hand in view does not produce a stream of empty guesses, and a
 * quick movement out of a still hold that ends with the hands leaving the
 * frame is taken as the hands dropping after the sign, not as a new sign.
 * Motion is measured in shoulder widths per second, so it does not depend on
 * how far the signer sits from the camera or on the frame rate.
 */
import { computeAnchor } from './features';
import { MotionStability } from './motion-stability';
import {
  LEFT_HAND_START,
  N_HAND,
  POSE_LEFT_SHOULDER,
  POSE_RIGHT_SHOULDER,
  POSE_START,
  RIGHT_HAND_START,
  handsMissing,
  type Frame,
} from './landmarks';

export interface SegmenterOptions {
  /** Hands absent or still for this long ends a sign. */
  gapMs: number;
  /** Optional longer pause for finishing a pose; absent hands still use gapMs. */
  stillMs?: number;
  /** Final held-pose context retained in the model input. */
  holdTailMs?: number;
  /** Require a brief, sustained return after a tracking dropout. */
  recoverMs?: number;
  stabilizeMotion?: boolean;
  /** Hand speed (shoulder widths per second) above which the hand counts as moving. */
  moveSpeed: number;
  /** Segments with fewer frames are discarded as noise. */
  minFrames: number;
  /** A segment is closed after this long even if signing continues. */
  maxMs: number;
  /** Frames with hands just before motion starts are kept (hands entering). */
  prerollMs: number;
  /**
   * A segment that starts from a still hold and ends with the hands leaving
   * in less than this is the hands dropping after a held sign; it is discarded.
   */
  leaveMs: number;
}

export const DEFAULT_SEGMENTER: SegmenterOptions = {
  gapMs: 300,
  moveSpeed: 0.6,
  minFrames: 8,
  maxMs: 4000,
  prerollMs: 200,
  leaveMs: 500,
};

/** Live signing needs time to finish a pose, unlike tightly trimmed replay clips. */
export const LIVE_SEGMENTER: Partial<SegmenterOptions> = {
  gapMs: 650, stillMs: 700, holdTailMs: 250, recoverMs: 100, maxMs: 10000, prerollMs: 500, stabilizeMotion: true,
};

export interface Segment {
  frames: Frame[];
  timestamps: number[];
  /** Frame rate estimated from the timestamps. */
  fps: number;
  durationMs: number;
  trackingIssue?: 'hand-identity-change';
}

export type EndReason = 'absent' | 'still' | 'max' | 'flush';

export type SegmentEvent =
  | { type: 'start'; t: number; preroll?: {frame:Frame;t:number}[] }
  | { type: 'end'; reason: EndReason; segment: Segment }
  | { type: 'discard'; reason: 'too-short' | 'hands-leaving' };

export type SegmenterState = 'idle' | 'signing' | 'resting';

interface Sample {
  frame: Frame;
  t: number;
}

const HAND_STARTS = [LEFT_HAND_START, RIGHT_HAND_START];

/** Mean displacement of hand points seen in both frames, in shoulder widths per second. */
export function handSpeed(prev: Sample, next: Sample): number {
  const dt = (next.t - prev.t) / 1000;
  if (!(dt > 0)) return 0;
  const { scale } = computeAnchor([next.frame]);
  let total = 0;
  let count = 0;
  for (const start of HAND_STARTS) {
    for (let i = 0; i < N_HAND; i++) {
      const k = (start + i) * 3;
      const dx = (next.frame[k] ?? Number.NaN) - (prev.frame[k] ?? Number.NaN);
      const dy = (next.frame[k + 1] ?? Number.NaN) - (prev.frame[k + 1] ?? Number.NaN);
      const d = Math.hypot(dx, dy);
      if (Number.isFinite(d)) {
        total += d;
        count++;
      }
    }
  }
  return count ? total / count / scale / dt : 0;
}

export class Segmenter {
  private readonly opts: SegmenterOptions;
  private samples: Sample[] = [];
  private recent: Sample[] = [];
  private last: Sample | null = null;
  private speed = 0;
  private quietSince: number | null = null;
  private quietReason: 'absent' | 'still' = 'absent';
  /** The open segment started from a still hold (state 'resting'). */
  private fromRest = false;
  private missingSince: number | null = null;
  private recoverySince: number | null = null;
  private clock = 0;
  private motion = new MotionStability();
  private trackingIssue: Segment['trackingIssue'];
  state: SegmenterState = 'idle';

  constructor(options: Partial<SegmenterOptions> = {}) {
    this.opts = { ...DEFAULT_SEGMENTER, ...options };
  }

  get progress(): { phase: 'moving' | 'holding' | 'recovering' | 'idle'; progress: number } {
    if (this.state !== 'signing') return { phase: 'idle', progress: 0 };
    if (this.missingSince !== null && this.clock - this.missingSince >= 200) return { phase: 'recovering', progress: 0 };
    if (this.quietSince === null) return { phase: 'moving', progress: 0 };
    const wait = this.quietReason === 'still' ? (this.opts.stillMs ?? this.opts.gapMs) : this.opts.gapMs;
    return { phase: 'holding', progress: Math.min(1, Math.max(0, ((this.missingSince ?? this.clock) - this.quietSince) / wait)) };
  }

  reset(): void {
    this.samples = [];
    this.recent = [];
    this.last = null;
    this.speed = 0;
    this.quietSince = null;
    this.fromRest = false;
    this.missingSince = null;
    this.recoverySince = null;
    this.state = 'idle';
    this.motion.reset();this.trackingIssue=undefined;
  }

  /** Feed one frame; returns an event when a segment starts, ends or is discarded. */
  push(frame: Frame, t: number, flags: { crowded?: boolean } = {}): SegmentEvent | null {
    this.clock = t;
    const sample = { frame, t };
    const observed = !flags.crowded && !handsMissing(frame);
    // Keep real missing coordinates in the input, but do not interpret a short
    // loss as a finished pose or erase the previous observed motion reference.
    if (this.opts.recoverMs && this.state === 'signing') {
      if (!observed) { this.missingSince ??= t; this.recoverySince = null; }
      else if (this.missingSince !== null) {
        this.recoverySince ??= t;
        if (t - this.recoverySince >= this.opts.recoverMs) {
          if (this.quietSince !== null) this.quietSince += t - this.missingSince;
          this.missingSince = null; this.recoverySince = null;
        }
      }
      if (this.missingSince !== null) {
        this.samples.push(sample);
        const first = this.samples[0];
        if (first && t - first.t >= this.opts.maxMs) return this.finish('max', this.samples.length);
        if (t - this.missingSince < this.opts.gapMs) return null;
        const keep = this.samples.filter(s => s.t < this.missingSince!).length;
        const kept = this.samples.slice(0, keep);
        const leaving = this.fromRest && (kept.at(-1)?.t ?? 0) - (kept[0]?.t ?? 0) < this.opts.leaveMs;
        const event = this.finish('absent', leaving ? 0 : keep);
        return leaving ? { type: 'discard', reason: 'hands-leaving' } : event;
      }
    }
    const present = observed;
    if (present && this.last && !handsMissing(this.last.frame)) {
      // Light smoothing so one jittery frame neither starts nor ends a sign.
      this.speed = 0.5 * this.speed + 0.5 * handSpeed(this.last, sample);
    } else if (!present) {
      this.speed = 0;
    }
    this.last = present ? sample : { frame, t };
    const stability=present&&this.opts.stabilizeMotion?this.motion.push(frame,t):null;
    const moving = present && (stability?stability.moving:this.speed >= this.opts.moveSpeed);
    if(this.state==='signing'&&stability?.identityChanged)this.trackingIssue='hand-identity-change';

    if (this.state !== 'signing') {
      if (!present) this.state = 'idle';
      this.recent = this.opts.stabilizeMotion
        ? [...this.recent,sample].filter(s=>t-s.t<=this.opts.prerollMs+1)
        : present
        ? [...this.recent, sample].filter((s) => t - s.t <= this.opts.prerollMs)
        : [];
      if (!moving) return null;
      this.fromRest = this.state === 'resting';
      this.state = 'signing';
      // The decision window/dwell confirms intent later than the true onset.
      // Retain that observed onset, rather than cutting off the start of a sign.
      this.samples = [...this.recent];
      while(this.samples.length && handsMissing(this.samples[0].frame))this.samples.shift();
      this.quietSince = null;
      this.missingSince = null; this.recoverySince = null;
      this.trackingIssue=stability?.identityChanged?'hand-identity-change':undefined;
      return { type: 'start', t, ...(this.opts.stabilizeMotion?{preroll:this.samples.slice(0,-1)}:{}) };
    }

    this.samples.push(sample);
    const first = this.samples[0];
    if (first && t - first.t >= this.opts.maxMs) {
      const event = this.finish('max', this.samples.length);
      this.recent = [];
      return event;
    }
    if (moving) {
      this.quietSince = null;
      return null;
    }
    if (this.quietSince === null || this.quietReason !== (present ? 'still' : 'absent')) {
      this.quietSince = present ? (stability?.stillSince ?? t) : t;
      this.quietReason = present ? 'still' : 'absent';
    }
    const wait = present ? (this.opts.stillMs ?? this.opts.gapMs) : this.opts.gapMs;
    if (t - this.quietSince < wait) return null;
    // Keep frames up to the start of the quiet gap; a still hold keeps its first frame.
    const quietStart = this.quietSince;
    const keep = this.samples.filter((s) => s.t < quietStart).length;
    const reason = this.quietReason;
    if (reason === 'absent' && this.fromRest) {
      const kept = this.samples.slice(0, keep);
      const span = (kept[kept.length - 1]?.t ?? 0) - (kept[0]?.t ?? 0);
      if (span < this.opts.leaveMs) {
        this.finish(reason, 0);
        return { type: 'discard', reason: 'hands-leaving' };
      }
    }
    const tail = this.samples.filter(s => s.t <= quietStart + (this.opts.holdTailMs ?? 0)).length;
    const event = this.finish(reason, reason === 'still' ? tail : keep);
    this.state = present ? 'resting' : 'idle';
    return event;
  }

  /** End any open segment now (e.g. when a replay clip finishes). */
  flush(): SegmentEvent | null {
    if (this.state !== 'signing') return null;
    this.motion.reset();
    if (this.missingSince !== null) return this.finish('flush', this.samples.filter(s => s.t < this.missingSince!).length);
    const keep =
      this.quietSince === null
        ? this.samples.length
        : this.samples.filter((s) => s.t < (this.quietSince ?? 0) + (this.quietReason === 'still' ? (this.opts.holdTailMs ?? 0) : 0)).length;
    return this.finish('flush', keep);
  }

  private finish(reason: EndReason, keep: number): SegmentEvent {
    const trackingIssue=this.trackingIssue;this.trackingIssue=undefined;
    const kept = this.samples.slice(0, Math.max(0, keep));
    this.samples = [];
    this.quietSince = null;
    this.missingSince = null; this.recoverySince = null;
    this.state = 'idle';
    if (kept.length < this.opts.minFrames) return { type: 'discard', reason: 'too-short' };
    const first = kept[0]?.t ?? 0;
    const lastT = kept[kept.length - 1]?.t ?? first;
    const durationMs = lastT - first;
    const fps = durationMs > 0 ? ((kept.length - 1) * 1000) / durationMs : 30;
    return {
      type: 'end',
      reason,
      segment: {
        frames: kept.map((s) => s.frame),
        timestamps: kept.map((s) => s.t),
        fps,
        durationMs,
        ...(trackingIssue?{trackingIssue}:{}),
      },
    };
  }
}

export type FrameStatus = 'nothing' | 'no-hands' | 'crowded' | 'partial' | 'ok';

function shoulderInView(frame: Frame, index: number): boolean {
  const k = (POSE_START + index) * 3;
  const x = frame[k] ?? Number.NaN;
  const y = frame[k + 1] ?? Number.NaN;
  return x >= -0.02 && x <= 1.02 && y >= -0.02 && y <= 1.02;
}

/**
 * What the camera sees, for the status line and for refusing to guess.
 * `poses` is how many people the pose landmarker found.
 */
export function frameStatus(frame: Frame, poses: number): FrameStatus {
  if (poses > 1) return 'crowded';
  const noHands = handsMissing(frame);
  if (noHands && poses === 0) return 'nothing';
  if (noHands) return 'no-hands';
  if (!shoulderInView(frame, POSE_LEFT_SHOULDER) || !shoulderInView(frame, POSE_RIGHT_SHOULDER)) {
    return 'partial';
  }
  return 'ok';
}

