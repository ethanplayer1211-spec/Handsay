import {cosine,prototypeOf,MIN_TAKES,type Gesture} from './prototypes';
const valid=(take:Float32Array)=>take.length>0&&take.every(Number.isFinite)&&Math.hypot(...take)>1e-8;
const median=(values:number[])=>{const s=[...values].sort((a,b)=>a-b);return s.length?s[Math.floor(s.length/2)]:0;};
const units=(gesture:Gesture)=>gesture.takes.filter(valid).map(take=>{const n=Math.hypot(...take);return Float32Array.from(take,v=>v/n);});

export function gestureQuality(gesture:Gesture,library:readonly Gesture[]=[]){
  const takes=units(gesture);
  if(takes.length<MIN_TAKES)return {state:'more-takes',label:'Record at least three clear examples.',minimum:.88,weakestIndex:0};
  const neighbours=takes.map((a,i)=>takes.filter((_,j)=>i!==j).map(b=>cosine(a,b)));
  const consistency=median(neighbours.map(values=>Math.max(...values)));
  const means=gesture.takes.map((take,i)=>valid(take)?gesture.takes.filter((other,j)=>i!==j&&valid(other)).reduce((sum,other)=>sum+cosine(take,other),0)/Math.max(1,gesture.takes.length-1):-1);
  const weakestIndex=means.indexOf(Math.min(...means));
  // A conservative within-library tolerance, not a measured accuracy estimate.
  const minimum=Math.max(.82,Math.min(.88,consistency-.12));
  const own=prototypeOf(takes);
  const overlap=library.some(other=>other.id!==gesture.id&&units(other).length>=MIN_TAKES&&cosine(own,prototypeOf(units(other)))>.92);
  if(overlap)return {state:'overlap',label:'Similar to another shortcut. Use a more distinct motion.',minimum,weakestIndex};
  if(consistency<.75||Math.min(...means)<.55)return {state:'inconsistent',label:'Examples vary. Replace the weakest take or add another example.',minimum,weakestIndex};
  return {state:'ready',label:'Saved examples agree. Try the gesture naturally.',minimum,weakestIndex};
}

/** Require support from two saved takes. One outlier cannot approve a phrase;
 * a mean prototype cannot erase two valid examples from the same motion.
 */
export function matchPersonalGesture(embedding:ArrayLike<number>,library:readonly Gesture[],options:{margin?:number;boundaryAllowance?:number;minimum?:number}={}){
  const rows=library.filter(g=>units(g).length>=MIN_TAKES).map(gesture=>{
    const minimum=options.minimum??Math.max(.80,gestureQuality(gesture).minimum-(options.boundaryAllowance||0));
    const scores=gesture.takes.filter(valid).map(t=>cosine(embedding,t)).sort((a,b)=>b-a);
    return {gesture,similarity:(scores[0]+scores[1])/2,support:scores.filter(s=>s>=minimum).length,minimum};
  }).sort((a,b)=>b.similarity-a.similarity);
  const best=rows[0];if(!best)return {kind:'empty' as const};
  const runnerUp=rows[1]?.similarity??-1,margin=best.similarity-runnerUp;
  return {kind:best.support>=2&&margin>=(options.margin??.1)?'match' as const:'not-sure' as const,...best,runnerUp,margin};
}
