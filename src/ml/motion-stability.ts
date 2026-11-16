import { computeAnchor } from './features';
import { LEFT_HAND_START, RIGHT_HAND_START, N_HAND, handsMissing, type Frame } from './landmarks';

type Sample = {frame: Frame; t: number};
const HANDS = [LEFT_HAND_START, RIGHT_HAND_START];
const PALM = [0,5,9,13,17];
const FINGERS = [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]];
const median = (values: number[]) => {
  const sorted=values.filter(Number.isFinite).sort((a,b)=>a-b), n=sorted.length;
  return n ? (sorted[Math.floor((n-1)/2)]+sorted[Math.floor(n/2)])/2 : NaN;
};
const point = (frame: Frame, index: number) => [frame[index*3],frame[index*3+1],frame[index*3+2]];
const distance = (a: number[], b: number[]) => Math.hypot(a[0]-b[0],a[1]-b[1]);
const seen = (frame: Frame, start: number) => Number.isFinite(frame[start*3]) && Number.isFinite(frame[start*3+1]);

/** Detect a likely detector-side reassignment, not the meaning of a palm flip. */
function association(previous: Frame, current: Frame, scale: number): Map<number,number> {
  const pairs=new Map<number,number>();
  const old=HANDS.filter(start=>seen(previous,start)), next=HANDS.filter(start=>seen(current,start));
  if(old.length===2 && next.length===2) {
    const direct=distance(point(previous,old[0]),point(current,next[0]))+distance(point(previous,old[1]),point(current,next[1]));
    const swapped=distance(point(previous,old[0]),point(current,next[1]))+distance(point(previous,old[1]),point(current,next[0]));
    const flip=swapped+scale*.15<direct && swapped<scale*.5;
    old.forEach((start,i)=>pairs.set(start,next[flip?1-i:i]));
  } else if(old.length===1 && next.length===1) {
    if(old[0]===next[0] || distance(point(previous,old[0]),point(current,next[0]))<scale*.25) pairs.set(old[0],next[0]);
  } else old.forEach(start=>{if(seen(current,start))pairs.set(start,start);});
  return pairs;
}

function normal(frame: Frame, start: number): number[] | null {
  const wrist=point(frame,start), index=point(frame,start+5), pinky=point(frame,start+17);
  if(![...wrist,...index,...pinky].every(Number.isFinite))return null;
  const u=index.map((v,i)=>v-wrist[i]), v=pinky.map((x,i)=>x-wrist[i]);
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  const length=Math.hypot(...cross), area=length/(Math.hypot(...u)*Math.hypot(...v));
  // Near-collinear MCP geometry cannot provide a trustworthy palm normal.
  return length>1e-7 && area>.15 ? cross.map(x=>x/length) : null;
}

function motionBetween(a: Frame,b: Frame,scale: number): {travel:number;rotation:number} {
  let travel=0,rotation=0;
  for(const start of HANDS) {
    if(!seen(a,start)||!seen(b,start))continue;
    const wristA=point(a,start),wristB=point(b,start);
    const displacement=(i:number,relative=false)=>{
      const p=point(a,start+i),q=point(b,start+i);
      const d=p.map((v,k)=>(q[k]- (relative?wristB[k]:0))-(v-(relative?wristA[k]:0)));
      if(!d.slice(0,2).every(Number.isFinite))return NaN;
      // Camera depth is a noisy estimate and is not a position feature in this
      // model. Do not turn depth-only wobble into hand/finger travel. Real 3D
      // palm turns are still measured separately by the normal below.
      return Math.hypot(d[0],d[1])/scale;
    };
    travel=Math.max(travel,median(PALM.map(i=>displacement(i))));
    // Median within each finger rejects one noisy joint without ignoring a
    // deliberate change in an otherwise stationary hand's finger configuration.
    for(const finger of FINGERS) {
      const flex=median(finger.map(i=>displacement(i,true)));
      if(Number.isFinite(flex))travel=Math.max(travel,flex);
    }
    const n=normal(a,start),m=normal(b,start);
    if(n&&m)rotation=Math.max(rotation,Math.acos(Math.max(-1,Math.min(1,n.reduce((s,x,i)=>s+x*m[i],0))))*180/Math.PI);
  }
  return {travel,rotation};
}

export interface StableMotion { moving:boolean; stillSince:number|null; travel:number; rotation:number; identityChanged:boolean }

/** Activity detection only. Never pass the filtered/associated coordinates to ML. */
export class MotionStability {
  private raw: Sample[]=[];
  private history: Sample[]=[];
  private previousRaw: Frame|null=null;
  private moving=false;
  private intentSince:number|null=null;
  private quietSince:number|null=null;
  reset(): void {
    this.raw=[];this.history=[];this.previousRaw=null;this.moving=false;this.intentSince=null;this.quietSince=null;
  }
  push(frame:Frame,t:number):StableMotion {
    const last=this.history.at(-1);
    if(last&&(t<=last.t||t-last.t>=600))this.reset();
    if(handsMissing(frame))return {moving:this.moving,stillSince:null,travel:0,rotation:0,identityChanged:false};
    const scale=computeAnchor([frame]).scale;
    const identity=this.previousRaw?association(this.previousRaw,frame,scale):new Map<number,number>();
    const identityChanged=[...identity].some(([before,after])=>before!==after);
    this.previousRaw=frame;
    const aligned=frame.slice();
    const prior=this.history.at(-1)?.frame;
    if(prior)for(const [before,after] of association(prior,frame,scale)) {
      if(before!==after) {
        aligned.set(frame.slice(after*3,(after+N_HAND)*3),before*3);
        if(!seen(prior,after))aligned.fill(NaN,after*3,(after+N_HAND)*3);
      }
    }
    this.raw.push({frame:aligned,t});this.raw=this.raw.filter(s=>t-s.t<=220).slice(-3);
    const filtered=aligned.slice();
    // Also filter at 10–15fps: three observations span 133–200ms there. The old
    // 111ms window silently disabled its median at the recording's lower rate.
    if(this.raw.length===3)for(const start of HANDS)for(let k=start*3;k<(start+N_HAND)*3;k++) {
      if(Number.isFinite(aligned[k])&&this.raw.every(s=>Number.isFinite(s.frame[k])))filtered[k]=median(this.raw.map(s=>s.frame[k]));
    }
    // A millisecond of tolerance prevents floating-point frame timestamps from
    // dropping an entire useful observation at an exact window boundary.
    this.history.push({frame:filtered,t});this.history=this.history.filter(s=>t-s.t<=201);
    const reference=this.history[0];
    const enough=reference&&t-reference.t>=60;
    if(!enough)return {moving:this.moving,stillSince:null,travel:0,rotation:0,identityChanged};
    const {travel,rotation}=enough?motionBetween(reference.frame,filtered,computeAnchor(this.history.map(s=>s.frame)).scale):{travel:0,rotation:0};
    const deliberate=travel>=.045||rotation>=18;
    // A returning wrist/rotation can have the same endpoints while moving in
    // between. Require the whole observed window to fit inside the still band.
    const scaleWindow=computeAnchor(this.history.map(s=>s.frame)).scale;
    const settled=t-reference.t>=120 && this.history.every(sample=>{
      const extent=motionBetween(reference.frame,sample.frame,scaleWindow);
      return extent.travel<.025 && extent.rotation<10;
    });
    if(!this.moving) {
      if(deliberate) {
        if(this.intentSince===null)this.intentSince=t;
        if(t-this.intentSince>=80){this.moving=true;this.quietSince=null;}
      }
      else this.intentSince=null;
    } else if(settled) {
      // The window itself already proves sustained stillness. Backdate to its
      // first observed pose, so filtering does not add another full pause wait.
      this.quietSince=reference.t;this.moving=false;this.intentSince=null;
    } else this.quietSince=null;
    return {moving:this.moving,stillSince:this.moving?null:this.quietSince,travel,rotation,identityChanged};
  }
}
