import { LEFT_HAND_START, RIGHT_HAND_START, N_HAND, type Frame } from '../ml/landmarks';
import type { ReplayClip } from './clips';

export interface AvatarStep { frame: Frame; t: number; reference: string; dropout: boolean }

/** Recorded motion plus explicit synthetic losses. No labels enter the model. */
export function avatarSequence(clips: readonly ReplayClip[], dropouts = true): AvatarStep[] {
  const steps: AvatarStep[] = [];
  let t = 0;
  for (const clip of clips) {
    const dt = 1000 / clip.fps;
    const firstLoss = Math.floor(clip.frames.length * .35);
    clip.frames.forEach((source, i) => {
      const dropout = dropouts && i >= firstLoss && i < firstLoss + 3;
      const frame = source.slice();
      if (dropout) for (const start of [LEFT_HAND_START, RIGHT_HAND_START]) frame.fill(NaN, start * 3, (start + N_HAND) * 3);
      steps.push({ frame, t, reference: clip.title, dropout }); t += dt;
    });
    // Brief word boundary, not a long hands-down reset between every word.
    for (let i = 0; i < Math.ceil(1100 / dt); i++) {
      steps.push({ frame: clip.frames.at(-1)!.slice(), t, reference: clip.title, dropout: false }); t += dt;
    }
  }
  return steps;
}
