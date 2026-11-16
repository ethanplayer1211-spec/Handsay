// Scores are acceptance heuristics, not calibrated correctness guarantees.
export function captionEvidence({text,probability,runnerUp=0,verification,partial,trackingIssue,durationMs,profile='careful',personal=false,personalMargin}){
  const threshold=personal?.80:profile==='balanced'?.70:.80,gap=personal?.10:profile==='balanced'?.20:.25;
  if(trackingIssue)return {accepted:false,reason:'Hand tracking changed sides. Review the suggested word or repeat the sign; nothing was added automatically.'};
  if(partial)return {accepted:false,reason:'Keep your face, shoulders and hands in view.'};
  const margin=personal&&Number.isFinite(personalMargin)?personalMargin:probability-runnerUp;
  if(!Number.isFinite(probability)||!Number.isFinite(runnerUp)||probability<threshold||margin<gap)return {accepted:false,reason:'Uncertain word held back — choose a suggestion or sign it again.'};
  if(!personal&&(!verification||verification.text!==text||!Number.isFinite(verification.probability)||!Number.isFinite(verification.runnerUp)||verification.probability<threshold||verification.probability-verification.runnerUp<gap))return {accepted:false,reason:'Motion checks disagree — the word was held back.'};
  if(!personal&&(!Number.isFinite(durationMs)||durationMs<250))return {accepted:false,reason:'Motion too short — sign clearly, then pause.'};
  return {accepted:true,reason:'Evidence accepted.'};
}
export class LiveCaptionGate {
  constructor() { this.reset(); }
  reset() { this.last = null; this.blocked = null; this.rearmed = false; }
  release() { this.rearmed = true; }
  undo(text) { this.blocked = text.trim().toLowerCase(); }
  accept({ text, probability, runnerUp = 0, verification, partial, trackingIssue, durationMs, at, profile = 'careful', personal = false,personalMargin }) {
    const evidence=captionEvidence({text,probability,runnerUp,verification,partial,trackingIssue,durationMs,profile,personal,personalMargin});
    if(!evidence.accepted)return evidence;
    const key = text.trim().toLowerCase();
    if (!key || !Number.isFinite(at)) return { accepted: false, reason: 'Invalid recognition result held back.' };
    if (key === this.blocked) return { accepted: false, reason: 'Removed word held back. Sign another word, or add it manually.' };
    if (this.last?.key === key && (!this.rearmed || at - this.last.at < 1800)) return { accepted: false, reason: 'Repeated detection held back. Lower your hands briefly to repeat the same word.' };
    this.last = { key, at }; this.blocked = null; this.rearmed = false;
    return { accepted: true, reason: 'Added to live captions.' };
  }
}
