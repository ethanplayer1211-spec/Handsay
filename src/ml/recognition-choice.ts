import {type Gesture} from './prototypes';
import {matchPersonalGesture} from './personal-gestures';
import type {RecognitionResult} from './recognizer';
import type {SignLabel} from './meta';
import {captionEvidence} from '../live-caption.js';

export type RecognitionMode='asl'|'personal'|'combined'|'combined-priority';
export function automaticChoice(result:RecognitionResult,labels:readonly SignLabel[],gestures:readonly Gesture[],mode:RecognitionMode,profile:string){
  const common={partial:result.partial,trackingIssue:result.segment.trackingIssue,durationMs:result.segment.durationMs,profile};
  const [best,next]=result.decision.top,checked=result.verification?.[0];
  const asl=best&&result.decision.kind==='sign'?{
    text:labels[best.index].label,probability:best.probability,runnerUp:next?.probability||0,personal:false,
    verification:checked?{text:labels[checked.index].label,probability:checked.probability,runnerUp:result.verification?.[1]?.probability||0}:null,
  }:null;
  const options={margin:mode.startsWith('combined')?.12:.10};
  const full=mode!=='asl'?matchPersonalGesture(result.inference.embedding,gestures,options):null;
  const trimmed=mode!=='asl'&&result.verificationEmbedding?matchPersonalGesture(result.verificationEmbedding,gestures,{...options,boundaryAllowance:.04}):null;
  const personal=full?.kind==='match'&&trimmed?.kind==='match'&&full.gesture.id===trimmed.gesture.id?{
    text:full.gesture.name,probability:Math.min(full.similarity,trimmed.similarity),runnerUp:Math.max(0,full.runnerUp,trimmed.runnerUp),personalMargin:Math.min(full.margin,trimmed.margin),personal:true,verification:null,
  }:null;
  const goodAsl=asl&&captionEvidence({...asl,...common}).accepted?asl:null;
  const goodPersonal=personal&&captionEvidence({...personal,...common}).accepted?personal:null;
  // The two scores have different meanings. Never compare them as probabilities
  // or let a personal phrase silently replace a different strong ASL result.
  if(mode==='combined'&&goodAsl&&goodPersonal&&goodAsl.text.trim().toLowerCase()!==goodPersonal.text.trim().toLowerCase())return {choice:null,conflict:true,reason:'ASL and your personal shortcut disagree. Choose the phrase you intended.'};
  const choice=mode==='asl'?goodAsl:mode==='personal'?goodPersonal:goodPersonal||goodAsl;
  return {choice,conflict:false,reason:choice?'Ready to add.':'No verified match. Choose a suggestion or try again.'};
}
