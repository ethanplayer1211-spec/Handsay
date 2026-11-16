import { Recognizer } from './ml/recognizer';
import { LIVE_SEGMENTER } from './ml/segmenter';
import { LiveCaptionGate } from './live-caption.js';
import { CaptionDisplay } from './caption-display.js';
import { avatarSequence } from './replay/avatar-motion';
import { drawAvatar } from './avatar-renderer.js';
import { checkTracker } from './tracker-check.js';
import { handsMissing } from './ml/landmarks';
import { classifySegment } from './ml/consensus';

/** Entirely private demo; never calls the real composer, room, camera or voice. */
export class AvatarDemo {
  constructor(ui) { this.ui = ui; this.generation = 0; }
  stop() { this.generation++; this.recognizer?.reset(); this.pixelCheck?.abort(); this.ui.start.disabled = false; this.ui.pixels.disabled = false; }
  async play(model, clips, dropouts) {
    this.stop(); const generation = this.generation;
    this.ui.start.disabled = true; this.ui.pixels.disabled = true;
    const display = new CaptionDisplay(), gate = new LiveCaptionGate();
    let message = '', pending = 0, running = true;
    this.ui.results.replaceChildren(); this.ui.caption.textContent = 'Waiting for a model word…';
    const infer = input => model.client.infer(input);
    this.recognizer = new Recognizer(model.meta, model.labels, infer, event => {
      if (generation !== this.generation) return;
      if (event.type === 'signing') { pending++; display.beginSign(); }
      if (event.type === 'preview' && event.result) {
        const [best, next] = event.result.decision.top;
        display.considerPreview(best?.probability >= .55 && best.probability - (next?.probability || 0) >= .15 ? model.labels[best.index].label : '');
      }
      if (event.type === 'phase') this.ui.phase.textContent = ({moving:'Signing · movement continues',holding:'Natural pause · checking word',recovering:'Tracking gap · preserving this sign',checking:'Model checking the completed sign',idle:running?'Ready for the next movement':'Playback complete'})[event.phase];
      if (event.type === 'discarded') pending = Math.max(0, pending - 1);
      if (event.type === 'error') { pending = Math.max(0, pending - 1); this.ui.phase.textContent = event.message; }
      if (event.type === 'result') {
        pending = Math.max(0, pending - 1);
        const result = event.result, [best, next] = result.decision.top, checked = result.verification?.[0];
        const text = model.labels[best.index].label;
        const accepted = result.decision.kind === 'sign' && gate.accept({text, probability:best.probability, runnerUp:next?.probability || 0, verification:checked?{text:model.labels[checked.index].label, probability:checked.probability, runnerUp:result.verification[1]?.probability || 0}:null, partial:result.partial, trackingIssue:result.segment.trackingIssue, durationMs:result.segment.durationMs, at:performance.now()}).accepted;
        // Keep the full model sequence visible, explicitly marking words the
        // production acceptance gate would hold back. This is a demo, not a
        // shortcut that silently approves uncertain interview words.
        message = [message, text + (accepted ? '' : ' ?')].filter(Boolean).join(' ');
        display.setDraft(message);
        const row = document.createElement('li'); row.textContent = `${text} · ${Math.round(best.probability * 100)}% model score · ${accepted ? 'added in demo' : 'held for review'}`;
        this.ui.results.append(row);
        if (event.current) display.clearPreview();
      }
      const view = display.view(); this.ui.caption.textContent = [message, view.preview ? `[${view.preview} …]` : ''].filter(Boolean).join(' ') || 'Waiting for a model word…';
    }, true, true, LIVE_SEGMENTER);
    try {
      for (const step of avatarSequence(clips, dropouts)) {
        if (generation !== this.generation) return;
        drawAvatar(this.ui.canvas, step.frame, step);
        this.ui.reference.textContent = `Recorded reference: ${step.reference}${step.dropout ? ' · injected hand dropout' : ''}`;
        this.recognizer.push({frame:step.frame, t:step.t, poses:1});
        await new Promise(resolve => setTimeout(resolve, 1000 / clips[0].fps));
      }
      running = false; this.recognizer.flush();
      const deadline = performance.now() + 10000;
      while (generation === this.generation && pending && performance.now() < deadline) await new Promise(resolve=>setTimeout(resolve,50));
      if (generation === this.generation) this.ui.phase.textContent = pending ? 'Model still busy · replay or stop to reset' : 'Finished · question marks mean a word needs review';
    } finally { if (generation === this.generation) { this.ui.start.disabled = false; this.ui.pixels.disabled = false; } }
  }
  async checkPixels(model, clip) {
    this.stop(); const generation = this.generation;
    this.pixelCheck = new AbortController(); this.ui.start.disabled = true; this.ui.pixels.disabled = true;
    this.ui.vision.textContent = 'Running the actual image tracker on 12 silhouette frames. No webcam is requested…';
    try {
      const result = await checkTracker(model.meta.featureSet, {signal:this.pixelCheck.signal, frames:12, drawFrame:(canvas,index)=>drawAvatar(canvas,clip.frames[Math.round(index * (clip.frames.length - 1) / 11)])});
      if (generation !== this.generation) return;
      const hands = result.observations.filter(o=>o.hands>0).length, poses = result.observations.filter(o=>o.poses>0).length;
      let note = '';
      if (poses >= model.meta.minFrames && result.trackedFrames.filter(f=>!handsMissing(f)).length >= model.meta.minFrames) {
        const segment = {frames:result.trackedFrames, fps:12, durationMs:1000, timestamps:result.trackedFrames.map((_,i)=>i*1000/12)};
        const prediction = await classifySegment(model.meta,model.labels,input=>model.client.infer(input),segment,false,true);
        if (generation !== this.generation) return;
        note = ` Model suggestion from tracked pixels: ${model.labels[prediction.decision.top[0].index].label} (${prediction.decision.kind}).`;
      }
      this.ui.vision.textContent = `Image-tracker result: hands on ${hands}/12 frames; body on ${poses}/12.${note} ${hands < model.meta.minFrames ? 'The flat silhouette did not provide enough tracked hands to test word recognition.' : 'This synthetic rendering does not measure human signing accuracy.'}`;
    } catch (e) { if (generation === this.generation) this.ui.vision.textContent = `Silhouette image check could not finish: ${e.message}`; }
    finally { if (generation === this.generation) { this.ui.start.disabled = false; this.ui.pixels.disabled = false; } }
  }
}
