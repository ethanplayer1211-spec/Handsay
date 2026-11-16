/** Canvas-only video: no microphone, screen capture, file upload or remote API. */
export class ClipRecorder {
  constructor({canvas,render=()=>{},onState=()=>{},Recorder=globalThis.MediaRecorder,makeURL=blob=>URL.createObjectURL(blob),revokeURL=url=>URL.revokeObjectURL(url),maxMs=120000,maxBytes=60000000}) {
    Object.assign(this,{canvas,render,onState,Recorder,makeURL,revokeURL,maxMs,maxBytes});
    this.active=false;this.finishing=false;this.url=null;this.generation=0;
  }
  start() {
    if(this.active||this.finishing)throw new Error('Stop the current recording first');
    if(!this.Recorder||!this.canvas.captureStream)throw new Error('Video recording is unavailable in this browser. Try the Handsay desktop app.');
    this.render();
    const stream=this.canvas.captureStream(20);
    if(stream.getAudioTracks().length){stream.getTracks().forEach(t=>t.stop());throw new Error('Only silent video is allowed in this recorder');}
    const mime=['video/webm;codecs=vp8','video/webm;codecs=vp9','video/webm'].find(type=>this.Recorder.isTypeSupported(type));
    let recorder;
    try {recorder=new this.Recorder(stream,mime?{mimeType:mime,videoBitsPerSecond:2500000}:{});}
    catch(error){stream.getTracks().forEach(t=>t.stop());throw error;}
    this.stream=stream;this.recorder=recorder;this.parts=[];this.bytes=0;this.discard=false;this.failure='';
    const generation=++this.generation;
    this.done=new Promise(resolve=>{this.resolve=resolve;});
    recorder.ondataavailable=event=>{
      if(generation!==this.generation||!event.data?.size)return;
      if(this.bytes+event.data.size>this.maxBytes){this.stop('Recording reached its size limit.');return;}
      this.bytes+=event.data.size;this.parts.push(event.data);
    };
    recorder.onstop=()=>{if(generation===this.generation)this.finish();};
    recorder.onerror=()=>{if(generation===this.generation){this.failure='Video encoder stopped. The partial clip may be available.';this.stop(this.failure);}};
    this.active=true;this.finishing=false;
    try {recorder.start(500);}
    catch(error){this.discard=true;this.finish();throw error;}
    if(this.url){this.revokeURL(this.url);this.url=null;}
    this.limit=setTimeout(()=>this.stop('Two-minute recording limit reached.'),this.maxMs);
    const tick=()=>{
      if(!this.active||generation!==this.generation)return;
      try {this.render();}catch{this.failure='Recording stopped because its private video frame could not be rendered.';this.stop(this.failure);return;}
      this.timer=setTimeout(tick,50);
    };
    this.timer=setTimeout(tick,50);this.onState('Recording video only · no microphone. Stop to create a local download.');
    return this.done;
  }
  stop(message='Recording stopped.') {
    if(!this.active)return this.done||Promise.resolve(null);
    this.active=false;this.finishing=true;this.message=message;
    clearTimeout(this.timer);clearTimeout(this.limit);
    this.onState('Finishing the local video…');
    this.stopWatchdog=setTimeout(()=>{this.failure='The encoder did not finish normally. Check the partial clip before using it.';this.finish();},3500);
    try {if(this.recorder.state!=='inactive')this.recorder.stop();else this.finish();}
    catch{this.finish();}
    return this.done;
  }
  finish() {
    if(!this.resolve)return;
    clearTimeout(this.timer);clearTimeout(this.limit);clearTimeout(this.stopWatchdog);
    this.active=false;this.finishing=false;this.stream?.getTracks().forEach(t=>t.stop());
    let result=null;
    if(!this.discard&&this.parts.length) {
      const blob=new Blob(this.parts,{type:this.recorder.mimeType||'video/webm'});
      this.url=this.makeURL(blob);result={url:this.url,blob};
    }
    this.parts=[];const resolve=this.resolve;this.resolve=null;
    this.onState(this.failure|| (result?'Video ready. Download it before closing Handsay.':'No video frames were saved.'));
    resolve(result);
  }
  dispose() {
    this.discard=true;
    if(this.active)this.stop();
    this.finish();this.generation++;
    if(this.url){this.revokeURL(this.url);this.url=null;}
  }
}
