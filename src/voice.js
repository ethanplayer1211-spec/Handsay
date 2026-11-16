// Browser voice metadata has no gender field. Profiles are editable preferences.
export function chooseVoices(voices, saved = {}) {
  const english = voices.filter(v => /^en(?:-|$)/i.test(v.lang));
  const list = english.length ? english : voices;
  const find = uri => voices.find(v => v.voiceURI === uri);
  const female = find(saved.female) ?? list.find(v => /\b(zira|jenny|aria|samantha|victoria|karen|moira|tessa|emma|michelle|sonia|hazel)\b/i.test(v.name)) ?? list.find(v => v.default) ?? list[0] ?? null;
  const male = find(saved.male) ?? list.find(v => /\b(david|mark|george|daniel|alex|fred|guy|ryan|andrew|brian|james)\b/i.test(v.name) && v.voiceURI !== female?.voiceURI) ?? list.find(v => v.voiceURI !== female?.voiceURI) ?? female;
  return { female, male };
}
export function introductionText(name = '', needs = '') {
  const who = name.trim().slice(0,80), condition = needs.trim().slice(0,200);
  return `${who ? `Hello, I'm ${who}.` : 'Hello.'} ${condition ? condition.replace(/[.!?]*$/, '.') + ' ' : ''}I communicate using sign language or text. I'm using Handsay, an AI-assisted tool, to turn my signs into captions and a synthetic voice. It can make mistakes, so I may correct or repeat anything unclear.`;
}

export class LiveVoiceQueue {
  constructor({ speak, cancel, status = () => {}, disabled = () => {}, setTimer = (fn, ms) => setTimeout(fn, ms), clearTimer = id => clearTimeout(id) }) {
    Object.assign(this,{driverSpeak:speak,driverCancel:cancel,status,disabled,setTimer,clearTimer});
    this.enabled=false;this.pending=[];this.queue=[];this.current=null;this.generation=0;
  }
  setEnabled(enabled) { this.stop(); this.enabled=enabled; this.status(enabled?'Live voice on. Only newly accepted words will be spoken.':'Live voice off. Captions remain on.'); }
  add(text) {
    if(!this.enabled||!text.trim())return;
    this.pending.push(text.trim());
    if(this.pending.length>30){this.overload();return;}
    if(!this.maxTimer)this.maxTimer=this.setTimer(()=>this.flush(),1200);
    this.clearTimer(this.timer);this.timer=this.setTimer(()=>this.flush(),350);
  }
  flush() {
    this.clearTimer(this.timer);this.clearTimer(this.maxTimer);this.timer=null;this.maxTimer=null;
    if(!this.pending.length)return;
    const text=this.pending.join(' ');this.pending=[];
    if(this.queue.length>=8){this.overload();return;}
    this.queue.push(text);this.drain();
  }
  overload() {this.stop();this.enabled=false;this.disabled();this.status('Voice could not keep up and was paused. Review the caption, then enable live voice again.');}
  say(text) {this.stop();if(!text.trim())return;this.queue.push(text.trim().slice(0,1000));this.drain();}
  stop(message) {
    this.generation++;this.clearTimer(this.timer);this.clearTimer(this.maxTimer);this.timer=null;this.maxTimer=null;
    this.pending=[];this.queue=[];this.current=null;this.driverCancel();if(message)this.status(message);
  }
  drain() {
    if(this.current||!this.queue.length)return;
    const text=this.queue.shift(), generation=this.generation;const item={text};this.current=item;
    this.status(`Speaking: ${text}`);
    const done=error=>{
      if(generation!==this.generation||this.current!==item)return;
      this.current=null;
      if(error){this.stop();this.enabled=false;this.disabled();this.status('Speech was unavailable or blocked. Live voice was paused. Try Preview voice after clicking the page. Captions still work.');return;}
      if(this.queue.length)this.drain();else this.status(this.enabled?'Live voice ready for your next words.':'Finished speaking.');
    };
    try{this.driverSpeak(text,()=>done(),()=>done(true));}catch{done(true);}
  }
}
