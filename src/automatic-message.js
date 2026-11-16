import {appendWord} from './caption.js';
export const AUTOMATIC_PHRASE_GAP_MS=2500;

/** Owns only automatically composed text. Typed/selected text is never replaced.
 * Use capture times, so slow inference cannot join two unrelated phrases.
 */
export class AutomaticMessage {
  constructor(){this.reset();}
  reset(){this.text=null;this.end=null;this.personal=false;this.latestStart=null;}
  owns(draft){return !draft.trim()||draft===this.text;}
  begin(at,draft){
    this.latestStart=at;
    if(this.owns(draft)&&draft.trim()&&this.end!==null&&at-this.end>=AUTOMATIC_PHRASE_GAP_MS){
      this.text=null;this.end=null;this.personal=false;return true;
    }
    return false;
  }
  propose(draft,word,{startAt,endAt,personal=false}){
    if(!this.owns(draft))return {applied:false,reason:'Your edited message is kept. Choose a suggestion to add to it.'};
    if(![startAt,endAt].every(Number.isFinite)||endAt<startAt)return {applied:false,reason:'Capture timing was unclear. Choose a suggestion.'};
    if(this.latestStart!==null&&this.latestStart-endAt>=AUTOMATIC_PHRASE_GAP_MS)return {applied:false,reason:'An earlier phrase finished late. Choose its suggestion if needed.'};
    const boundary=personal||this.personal||!draft.trim()||(this.end!==null&&startAt-this.end>=AUTOMATIC_PHRASE_GAP_MS);
    const base=boundary?'':draft;
    if(base.trim().length+word.trim().length+(base.trim()?1:0)>1000)return {applied:false,reason:'Message is full. Send or clear it first.'};
    const text=appendWord(base,word);
    return {applied:true,text,before:base,boundary};
  }
  append(draft,word,timing){
    const change=this.propose(draft,word,timing);
    if(change.applied){this.text=change.text;this.end=timing.endAt;this.personal=timing.personal===true;}
    return change;
  }
}
