import {renderPrivateVideo,privacyMode} from './video-privacy.js';

export const OUTPUT_WIDTH = 1280, OUTPUT_HEIGHT = 720;

export function wrapCaption(context, text, width) {
  const result = []; let line = '';
  for (const word of String(text).trim().replace(/\s+/g,' ').split(' ')) {
    if (!word) continue;
    if (context.measureText((line ? line + ' ' : '') + word).width <= width) { line += (line ? ' ' : '') + word; continue; }
    if (line) { result.push(line); line = ''; }
    for (const character of Array.from(word)) {
      if (line && context.measureText(line + character).width > width) { result.push(line); line = ''; }
      line += character;
    }
  }
  if (line) result.push(line);
  return result;
}

export function captionLayout(context, text, style, width = OUTPUT_WIDTH, height = OUTPUT_HEIGHT, intro = false) {
  const families = {sans:'Arial, sans-serif',serif:'Georgia, serif',mono:'Consolas, monospace'};
  const family = families[style.font] || families.sans;
  let size = Math.min(76, Math.max(24, Number(style.size || 30) * 1.6));
  let lines;
  do {
    context.font = `${style.bold === false ? '400' : '700'} ${size}px ${family}`;
    lines = wrapCaption(context,text,width * .86);
    if (lines.length * size * 1.3 <= height * (intro ? .72 : .65) || size <= 16) break;
    size -= 2;
  } while (true);
  const lineHeight = size * 1.3, padding = 18;
  const boxHeight = lines.length * lineHeight + padding * 2;
  const y = intro || style.position === 'middle' ? (height - boxHeight) / 2 : style.position === 'top' ? height * .08 : height * .91 - boxHeight;
  return {lines,size,lineHeight,padding,y:Math.max(24,y),boxHeight,font:context.font,left:width*.05,width:width*.9};
}

export function renderCameraOutput(canvas, state) {
  const c = canvas.getContext('2d', {alpha:false}), w = canvas.width, h = canvas.height;
  c.save(); c.fillStyle = '#202124'; c.fillRect(0,0,w,h);
  const sample = !!state.sample;
  if (state.testPattern) {
    const colors = ['#ffffff','#ffff00','#00ffff','#00b830','#ff00ff','#d00000','#0000dd'];
    colors.forEach((color,i) => { c.fillStyle=color; c.fillRect(i*w/colors.length,0,w/colors.length+1,h); });
    c.fillStyle='#151515'; c.fillRect(0,0,w,95); c.fillStyle='#fff';c.font='700 30px Arial';c.textAlign='center';
    c.fillText('HANDSAY CAMERA TEST · NO LIVE CAMERA',w/2,60);
  } else if(!sample && state.videoActive && privacyMode(state.privacy)!=='camera') {
    renderPrivateVideo(canvas,state.landmarks||null,state.privacy,{showStatus:state.showCaptionLabel!==false});
  } else if (!sample && state.videoActive && state.video?.readyState >= 2 && state.video.videoWidth > 0) {
    const scale = Math.min(w/state.video.videoWidth,h/state.video.videoHeight);
    const vw=state.video.videoWidth*scale,vh=state.video.videoHeight*scale;
    // Physical camera is unmirrored for the other person. Caption letters are
    // never mirrored. The in-app selfie preview keeps its existing mirror.
    c.drawImage(state.video,(w-vw)/2,(h-vh)/2,vw,vh);
  } else {
    c.fillStyle='#bdc1c6';c.font='28px Arial';c.textAlign='center';
    if(sample||state.showCaptionLabel!==false)c.fillText(sample ? 'Recorded demo is private · camera output paused' : 'Camera off · Handsay captions',w/2,h/2);
  }
  const intro = !sample && state.intro;
  const text = sample ? '' : intro || state.text || '';
  if (text) {
    const style = state.style || {};
    const layout = captionLayout(c,text,style,w,h,!!intro);
    if (intro) { c.fillStyle='#202124';c.fillRect(0,0,w,h); }
    c.font=layout.font;c.textBaseline='top';c.textAlign=style.align==='left'?'left':'center';
    if (intro || style.design !== 'plain' && style.design !== 'outline') { c.fillStyle='rgba(0,0,0,.85)';c.fillRect(layout.left,layout.y,layout.width,layout.boxHeight); }
    const x=style.align==='left'?layout.left+layout.padding:w/2;
    c.fillStyle=style.color || '#ffffff';c.strokeStyle='#000';c.lineWidth=5;c.lineJoin='round';
    layout.lines.forEach((line,i) => {
      const y=layout.y+layout.padding+i*layout.lineHeight;
      if (style.design==='outline') c.strokeText(line,x,y);
      c.fillText(line,x,y);
    });
    if(state.showCaptionLabel!==false){
      c.font='18px Arial';c.textAlign='center';c.fillStyle='#fff';c.textBaseline='alphabetic';
      const label=intro?'Introduction':state.label || 'Sent message';
      c.fillStyle='rgba(0,0,0,.85)';c.fillRect(w/2-180,Math.max(0,layout.y-31),360,30);
      c.fillStyle='#fff';c.fillText(label,w/2,Math.max(21,layout.y-10));
    }
  }
  c.restore();
}

export class CameraOutput {
  constructor({canvas,state,onState=()=>{},fetchImpl=(...args)=>fetch(...args)}) {
    this.canvas=canvas;this.state=state;this.onState=onState;this.fetch=fetchImpl;
    this.active=false;this.preview=false;this.lease=null;this.frames=0;this.generation=0;this.busy=false;this.starting=false;
  }
  async request(path,key) {
    const res=await this.fetch('/api/camera/'+path,{method:path==='status'?'GET':'POST',headers:key?{'X-Handsay-Camera':key}:{},signal:AbortSignal.timeout(14000)});
    const data=await res.json();if(!res.ok)throw new Error(data.error || `Camera HTTP ${res.status}`);return data;
  }
  async info() { return this.request('status'); }
  setPreview(enabled) { this.preview=enabled;this.loop(); }
  async start() {
    if(this.active)return true;
    if(this.starting)return false;
    const generation=++this.generation;
    this.starting=true;this.onState('Starting camera output…');
    try {
      const info=await this.info();
      if(generation!==this.generation)return false;
      if(!info.setupReady)throw new Error('Camera helper is not set up. Run npm run setup:camera on Windows with OBS Studio installed.');
      const started=await this.request('start',info.startKey);
      if(generation!==this.generation){try{await this.request('stop',started.lease);}catch{}return false;}
      this.lease=started.lease;this.active=true;this.frames=0;
      this.onState('Output on. Choose OBS Virtual Camera in your call app.');this.loop();
      return true;
    } catch(error) {if(generation===this.generation)this.onState(error.message);throw error;}
    finally {if(generation===this.generation)this.starting=false;}
  }
  async stop(message='Camera output off.') {
    const lease=this.lease;this.active=false;this.starting=false;this.lease=null;this.generation++;clearTimeout(this.timer);this.timer=null;
    if(lease){try{await this.request('stop',lease);}catch{}}
    this.onState(message);if(this.preview)this.loop();
  }
  loop() {
    if(this.timer || this.busy || !this.preview&&!this.active)return;
    this.timer=setTimeout(()=>{this.timer=null;void this.tick();},65);
  }
  async tick() {
    if(this.busy || !this.preview&&!this.active)return;
    this.busy=true;const generation=this.generation;
    try {
      renderCameraOutput(this.canvas,this.state());
      if(this.active){
        const blob=await new Promise(resolve=>this.canvas.toBlob(resolve,'image/jpeg',.78));
        if(!blob)throw new Error('Could not render the camera frame');
        if(generation!==this.generation||!this.active)return;
        const res=await this.fetch('/api/camera/frame',{method:'POST',headers:{'Content-Type':'image/jpeg','X-Handsay-Camera':this.lease},body:blob,signal:AbortSignal.timeout(3500)});
        if(!res.ok){const data=await res.json();throw new Error(data.error || 'Camera frame was not delivered');}
        if(generation===this.generation){this.frames++;if(this.frames%15===0)this.onState(`Output on · 1280 × 720 · ${this.frames} frames sent. Choose OBS Virtual Camera in your call app.`);}
      }
    } catch(error) {if(this.active && generation===this.generation)await this.stop(`Output stopped: ${error.message}`);}
    finally {this.busy=false;this.loop();}
  }
  dispose() {
    const lease=this.lease;this.preview=false;this.active=false;this.starting=false;this.lease=null;this.generation++;clearTimeout(this.timer);
    if(lease)void this.fetch('/api/camera/stop',{method:'POST',headers:{'X-Handsay-Camera':lease},keepalive:true}).catch(()=>{});
  }
}
