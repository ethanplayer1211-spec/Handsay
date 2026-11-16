import {MotionStability} from '../src/ml/motion-stability';
import {Segmenter,LIVE_SEGMENTER} from '../src/ml/segmenter';
const $=(id:string)=>document.getElementById(id) as any;
const video=$('video') as HTMLVideoElement,canvas=$('crop') as HTMLCanvasElement;
let url:string|null=null;
async function localTracker(){
  const worker=new Worker(new URL('../src/ml/tracker.worker.ts',import.meta.url),{type:'module'});
  const ready=await new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Worker startup timeout')),45000);worker.onmessage=({data})=>{clearTimeout(timer);data.type==='ready'?resolve(data):reject(new Error(data.message||data.type));};worker.onerror=e=>{clearTimeout(timer);reject(new Error(e.message||'Worker failed'));};worker.postMessage({type:'init',featureSet:'hands_pose_lips',delegate:'GPU'});});
  return {delegate:ready.delegate,close:()=>worker.terminate(),detect:(bitmap:ImageBitmap,t:number)=>new Promise<any>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Frame timeout')),8000);worker.onmessage=({data})=>{clearTimeout(timer);data.type==='landmarks'?resolve(data):reject(new Error(data.message||data.type));};worker.postMessage({type:'frame',bitmap,t},[bitmap]);})};
}
$('file').onchange=()=>{if(url)URL.revokeObjectURL(url);url=URL.createObjectURL($('file').files[0]);video.src=url;$('status').textContent='Local file selected. Ready to analyze.';};
async function seek(t:number){
  await new Promise<void>((resolve,reject)=>{const timer=setTimeout(()=>reject(new Error('Video seek timed out')),8000);video.onseeked=()=>{clearTimeout(timer);resolve();};video.currentTime=t;});
}
$('run').onclick=async()=>{
  $('run').disabled=true;let tracker;
  try{
    if(!url)throw new Error('Choose a file first');
    $('status').textContent='Loading the local image tracker…';
    tracker=await localTracker();
    const motion=new MotionStability(),seg=new Segmenter(LIVE_SEGMENTER),frames:any[]=[],events:any[]=[];
    const start=Number($('start').value),end=Number($('end').value),fps=15;
    for(let n=0;n<Math.round((end-start)*fps);n++){
      const at=start+n/fps;await seek(at);
      // The selected owner's recording has this fixed camera rectangle.
      canvas.getContext('2d')!.drawImage(video,442,216,715,478,0,0,720,480);
      const bitmap=await createImageBitmap(canvas),t=n*1000/fps;
      const detected=await tracker.detect(bitmap,t+1);
      const state=motion.push(detected.frame,t),event=seg.push(detected.frame,t);
      if(event)events.push({t,type:event.type,...('reason' in event?{reason:event.reason}:{}),...('segment' in event?{durationMs:event.segment.durationMs}:{} )});
      frames.push({t,sourceSecond:at,poses:detected.poses,hands:detected.hands,frame:Array.from(detected.frame,v=>Number.isFinite(v)?v:null),motion:state,phase:seg.progress});
      if(n%15===0)$('status').textContent=`Analyzing locally: ${n}/${Math.round((end-start)*fps)} frames`;
      await new Promise(resolve=>setTimeout(resolve,0));
    }
    const report={kind:'Local re-tracking of compressed screen recording with baked-in overlays; not raw live accuracy',fps,start,end,delegate:tracker.delegate,events,frames};
    const result=URL.createObjectURL(new Blob([JSON.stringify(report)],{type:'application/json'}));
    $('download').href=result;$('download').download='handsay-private-tracking.json';$('download').hidden=false;
    $('status').textContent=JSON.stringify({frames:frames.length,handsSeen:frames.filter(f=>f.hands>0).length,events,delegate:tracker.delegate},null,2);
  }catch(e){$('status').textContent=String(e);}finally{tracker?.close();$('run').disabled=false;}
};
